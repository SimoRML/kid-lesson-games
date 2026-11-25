/**
 * Level model, procedural generator and defensive custom-level parser for the
 * Candy Factory. Pure module: no DOM access.
 *
 * Modes:
 *   count    - fill an order of 1-19 candies one by one (ten becomes a bag)
 *   compare  - give the jar with more / fewer candies (bags + loose candies)
 *   add      - combine orders; packed physically (machines) or written (columns)
 *   mystery  - a torn label: find the one missing digit of a term
 *   robot    - the robot packer forgot a carry: find and fix the wrong digit
 *   estimate - choose the truck closest to the order (nearest thousand)
 */

import type { AgeGroup, Difficulty } from '../../src/core/types.js';
import {
  MAX_PHYSICAL_COLUMNS,
  carryCount,
  carryTargets,
  digitCount,
  roundToThousand,
  toDigits,
  writtenAddition
} from './numbers.js';

export type Mode = 'count' | 'compare' | 'add' | 'mystery' | 'robot' | 'estimate';
export type AddView = 'physical' | 'written';

export interface CountLevel {
  mode: 'count';
  target: number;
}

export interface CompareLevel {
  mode: 'compare';
  values: [number, number];
  ask: 'more' | 'fewer';
}

export interface AddLevel {
  mode: 'add';
  terms: number[];
  /** Forces a presentation; omitted = the game decides (auto written mode). */
  view?: AddView;
  /** Shows the terms as a shop bill in dirhams. */
  story?: 'bill';
}

export interface MysteryLevel {
  mode: 'mystery';
  terms: number[];
  /** Which term has the torn digit, and in which column (0 = units). */
  term: number;
  column: number;
}

export interface RobotLevel {
  mode: 'robot';
  terms: number[];
  /** Result column holding the robot's wrong digit (receives a carry). */
  column: number;
}

export interface EstimateLevel {
  mode: 'estimate';
  terms: number[];
}

export type Level = CountLevel | CompareLevel | AddLevel | MysteryLevel | RobotLevel | EstimateLevel;

/** Add levels completed physically before ages 9-11 switch to written mode. */
export const WRITTEN_AFTER = 2;

/** Limits for externally supplied levels. */
export const LIMITS = {
  maxLevels: 20,
  countMax: 19,
  compareMax: 999,
  termMax: 9999,
  minTerms: 2,
  maxTerms: 3
} as const;

// ---------------------------------------------------------------------------
// Random source (seedable for tests)
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Random integer with exactly `digits` digits. */
function numberWithDigits(rng: Rng, digits: number): number {
  if (digits <= 1) return int(rng, 1, 9);
  return int(rng, 10 ** (digits - 1), 10 ** digits - 1);
}

/**
 * Terms whose written addition needs between minCarries and maxCarries carries
 * and whose sum fits `maxSum`. Retries until valid; the fallback is a fixed,
 * known-good sum so generation always terminates.
 */
function termsWithCarries(
  rng: Rng,
  digitsPerTerm: number[],
  minCarries: number,
  maxCarries: number,
  maxSum: number,
  fallback: number[]
): number[] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const terms = digitsPerTerm.map((d) => numberWithDigits(rng, d));
    const sum = terms.reduce((a, b) => a + b, 0);
    if (sum > maxSum) continue;
    const carries = carryCount(terms);
    if (carries >= minCarries && carries <= maxCarries) return terms;
  }
  return fallback.slice();
}

function countLevels(rng: Rng, difficulty: Difficulty): CountLevel[] {
  const [lo, hi] = difficulty === 'easy' ? [1, 5] : difficulty === 'hard' ? [4, 9] : [2, 9];
  const targets = new Set<number>();
  while (targets.size < 2) targets.add(int(rng, lo, hi));
  const levels: CountLevel[] = [...targets].map((target) => ({ mode: 'count', target }));
  // Hard: meet ten as a bag of ten (10-15 candies).
  if (difficulty === 'hard') levels.push({ mode: 'count', target: int(rng, 11, 15) });
  return levels;
}

function compareSmall(rng: Rng, difficulty: Difficulty, ask: 'more' | 'fewer'): CompareLevel {
  const minGap = difficulty === 'easy' ? 2 : 1;
  const max = difficulty === 'easy' ? 5 : 9;
  for (;;) {
    const a = int(rng, 1, max);
    const b = int(rng, 1, max);
    if (Math.abs(a - b) >= minGap) return { mode: 'compare', values: [a, b], ask };
  }
}

/**
 * Place-value comparison: the jar with more loose candies holds fewer in total
 * (e.g. 2 bags + 9 candies vs 3 bags + 1 candy), so counting loose candies fails.
 */
function compareTens(rng: Rng, ask: 'more' | 'fewer'): CompareLevel {
  const tensA = int(rng, 1, 7);
  const tensB = tensA + 1;
  const onesA = int(rng, 6, 9);
  const onesB = int(rng, 0, onesA - 3);
  const a = tensA * 10 + onesA;
  const b = tensB * 10 + onesB;
  return { mode: 'compare', values: rng() < 0.5 ? [a, b] : [b, a], ask };
}

function preschool(rng: Rng, difficulty: Difficulty): Level[] {
  const counts = countLevels(rng, difficulty);
  const levels: Level[] = [];
  levels.push(counts[0]);
  levels.push(compareSmall(rng, difficulty, 'more'));
  levels.push(counts[1]);
  levels.push(compareSmall(rng, difficulty, 'fewer'));
  if (counts[2]) levels.push(counts[2]);
  return levels;
}

function elementary(rng: Rng, difficulty: Difficulty): Level[] {
  const levels: Level[] = [compareTens(rng, 'more')];
  if (difficulty === 'easy') {
    // 2-digit + 1-digit, then 2-digit + 2-digit, exactly one carry (units).
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 1], 1, 1, 99, [27, 5]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2], 1, 1, 99, [27, 15]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2], 1, 1, 99, [38, 24]), view: 'physical' });
  } else if (difficulty === 'medium') {
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2], 1, 1, 99, [27, 15]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2, 1], 1, 1, 99, [24, 31, 8]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2], 1, 2, 199, [58, 67]), view: 'physical' });
  } else {
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [2, 2], 1, 2, 199, [58, 67]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [3, 2], 1, 2, 999, [256, 78]), view: 'physical' });
    levels.push({ mode: 'add', terms: termsWithCarries(rng, [3, 3], 2, 2, 999, [367, 248]), view: 'physical' });
  }
  levels.push(compareTens(rng, 'fewer'));
  return levels;
}

function mysteryFrom(rng: Rng, terms: number[]): MysteryLevel {
  // Prefer a column that receives a carry so the child must reason about it.
  const targets = carryTargets(terms);
  for (let attempt = 0; attempt < 40; attempt++) {
    const term = int(rng, 0, terms.length - 1);
    const width = digitCount(terms[term]);
    const column = targets.length > 0 && rng() < 0.7 ? pick(rng, targets) : int(rng, 0, width - 1);
    if (column >= width) continue;
    // A leading zero would not be written, so never hide a leading digit equal to 0.
    if (toDigits(terms[term])[column] === 0 && column === width - 1) continue;
    return { mode: 'mystery', terms, term, column };
  }
  return { mode: 'mystery', terms, term: 0, column: 0 };
}

function robotFrom(terms: number[]): RobotLevel | null {
  const { termColumns, sum } = writtenAddition(terms);
  const digits = toDigits(sum);
  // A column inside the terms whose digit is not 0, so "one less" stays a digit and visible.
  const column = carryTargets(terms).find((c) => c < termColumns && digits[c] > 0);
  return column === undefined ? null : { mode: 'robot', terms, column };
}

function estimateTerms(rng: Rng, digits: number[]): number[] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const terms = digits.map((d) => numberWithDigits(rng, d));
    const sum = terms.reduce((a, b) => a + b, 0);
    const rest = sum % 1000;
    // Keep away from the 500 boundary, and make rounding the terms agree with rounding the sum.
    if (Math.abs(rest - 500) < 150) continue;
    const termRound = terms.reduce((a, t) => a + roundToThousand(t), 0);
    if (termRound === roundToThousand(sum) && sum >= 1500) return terms;
  }
  return [2878, 1289];
}

function upper(rng: Rng, difficulty: Difficulty): Level[] {
  const width = difficulty === 'easy' ? 3 : 4;
  const maxCarries = difficulty === 'hard' ? 3 : 2;
  const fallback2 = width === 3 ? [478, 365] : [2458, 3795];
  const physical1 = termsWithCarries(rng, [width, width], 1, maxCarries, 9999, fallback2);
  const physical2 = termsWithCarries(rng, [width, width - 1, width - 1], 2, maxCarries, 9999, width === 3 ? [356, 87, 49] : [2458, 795, 190]);
  const written1 = termsWithCarries(rng, [width, width], 2, maxCarries, 99999, fallback2);
  const bill = termsWithCarries(rng, [3, 2, 3], 1, 3, 9999, [815, 99, 478]);
  const writtenHard = termsWithCarries(rng, [4, 4, 3], 2, 3, 99999, [3986, 634, 1620]);
  const mysteryTerms = termsWithCarries(rng, [width, width], 1, 2, 9999, fallback2);
  // Retry fresh terms before using the fixed fallback, so runs rarely repeat a puzzle.
  let robot: RobotLevel | null = null;
  for (let attempt = 0; attempt < 30 && !robot; attempt++) {
    robot = robotFrom(termsWithCarries(rng, [width, width], 1, 2, 9999, fallback2));
  }
  robot = robot ?? robotFrom(fallback2) ?? { mode: 'robot', terms: fallback2, column: 1 };

  const levels: Level[] = [
    { mode: 'add', terms: physical1 },
    { mode: 'add', terms: physical2 },
    { mode: 'add', terms: difficulty === 'hard' ? writtenHard : written1 },
    { mode: 'add', terms: bill, story: 'bill' },
    mysteryFrom(rng, mysteryTerms),
    robot
  ];
  if (difficulty !== 'easy') levels.push({ mode: 'estimate', terms: estimateTerms(rng, [4, 4]) });
  return levels;
}

export function generateLevelsForAge(
  ageGroup: AgeGroup,
  difficulty: Difficulty = 'medium',
  rng: Rng = Math.random
): Level[] {
  switch (ageGroup) {
    case '3-5':
      return preschool(rng, difficulty);
    case '9-11':
      return upper(rng, difficulty);
    case '6-8':
    default:
      return elementary(rng, difficulty);
  }
}

// ---------------------------------------------------------------------------
// Presentation rules
// ---------------------------------------------------------------------------

/**
 * Auto written mode: at ages 9-11, add levels are packed by hand until
 * WRITTEN_AFTER of them are done, then switch to the written column view.
 * The physical factory also cannot show more than four columns.
 */
export function addViewFor(level: AddLevel, ageGroup: AgeGroup, physicalDone: number): AddView {
  const sum = level.terms.reduce((a, b) => a + b, 0);
  if (digitCount(sum) > MAX_PHYSICAL_COLUMNS) return 'written';
  if (level.view) return level.view;
  if (ageGroup === '9-11' && physicalDone >= WRITTEN_AFTER) return 'written';
  return 'physical';
}

/** Truck choices for an estimate level: the right thousand plus two neighbours. */
export function estimateOptions(terms: readonly number[]): { answer: number; options: number[] } {
  const sum = terms.reduce((a, b) => a + b, 0);
  const answer = Math.max(1000, roundToThousand(sum));
  const options =
    answer <= 1000 ? [answer, answer + 1000, answer + 2000] : [answer - 1000, answer, answer + 1000];
  return { answer, options };
}

// ---------------------------------------------------------------------------
// Defensive parser for LMS-supplied levels
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function intIn(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function parseTerms(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length < LIMITS.minTerms || v.length > LIMITS.maxTerms) return null;
  const terms: number[] = [];
  for (const t of v) {
    const n = intIn(t, 1, LIMITS.termMax);
    if (n === null) return null;
    terms.push(n);
  }
  return terms;
}

function parseLevel(item: unknown): Level | null {
  if (!isRecord(item)) return null;
  switch (item.mode) {
    case 'count': {
      const target = intIn(item.target, 1, LIMITS.countMax);
      return target === null ? null : { mode: 'count', target };
    }
    case 'compare': {
      const values = item.values;
      if (!Array.isArray(values) || values.length !== 2) return null;
      const a = intIn(values[0], 1, LIMITS.compareMax);
      const b = intIn(values[1], 1, LIMITS.compareMax);
      if (a === null || b === null || a === b) return null;
      const ask = item.ask === 'fewer' ? 'fewer' : 'more';
      return { mode: 'compare', values: [a, b], ask };
    }
    case 'add': {
      const terms = parseTerms(item.terms);
      if (!terms) return null;
      const level: AddLevel = { mode: 'add', terms };
      if (item.view === 'physical' || item.view === 'written') level.view = item.view;
      if (item.story === 'bill') level.story = 'bill';
      return level;
    }
    case 'mystery': {
      const terms = parseTerms(item.terms);
      if (!terms) return null;
      const term = intIn(item.term, 0, terms.length - 1);
      if (term === null) return null;
      const width = digitCount(terms[term]);
      const column = intIn(item.column, 0, width - 1);
      return column === null ? null : { mode: 'mystery', terms, term, column };
    }
    case 'robot': {
      const terms = parseTerms(item.terms);
      if (!terms) return null;
      // Same rule as the generator: a column inside the terms whose digit is not 0,
      // so "one less" is a real forgotten-carry trace (55 + 45 must not show 190).
      const { termColumns, sum } = writtenAddition(terms);
      const sumDigits = toDigits(sum);
      const targets = carryTargets(terms).filter((c) => c < termColumns && sumDigits[c] > 0);
      if (targets.length === 0) return null;
      if (item.column === undefined) return { mode: 'robot', terms, column: targets[0] };
      const column = intIn(item.column, 0, 9);
      return column !== null && targets.includes(column) ? { mode: 'robot', terms, column } : null;
    }
    case 'estimate': {
      const terms = parseTerms(item.terms);
      if (!terms) return null;
      const sum = terms.reduce((a, b) => a + b, 0);
      // A sum ending in exactly 500 is equally close to two trucks: no single answer.
      return sum >= 1000 && sum % 1000 !== 500 ? { mode: 'estimate', terms } : null;
    }
    default:
      return null;
  }
}

/**
 * Validates LMS-supplied levels (JSON array). Returns null when the input is not
 * a usable array, so the game falls back to procedural generation. Invalid
 * entries inside an otherwise valid array are skipped.
 */
export function parseCustomLevels(raw: unknown): Level[] | null {
  let value = raw;
  if (typeof value === 'string') {
    if (value.length > 50_000) return null;
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  const levels: Level[] = [];
  for (const item of value.slice(0, LIMITS.maxLevels)) {
    const level = parseLevel(item);
    if (level) levels.push(level);
  }
  return levels.length > 0 ? levels : null;
}

/** Stable identity of a level list (to detect a changed custom set). */
export function levelsSignature(levels: readonly Level[]): string {
  return JSON.stringify(levels);
}
