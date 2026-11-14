/**
 * Level model for the number-workshop cartridge: types, limits, the defensive
 * parser for externally supplied levels, and the procedural generator.
 *
 * Pure module: no DOM access, never throws on external input.
 * Spec: docs/design/number-workshop/02-level-schema.md
 */

import type { AgeGroup, Difficulty } from '../../src/core/types.js';
import { divide, isShiftDivisor, longDivisionTrace, type ShiftDivisor } from './division.js';
import { ALL_MODES, BUILT_MODES, type ModeId } from './modes/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const FACTS_THEMES = ['dates', 'apples', 'marbles', 'stars'] as const;
export type FactsTheme = (typeof FACTS_THEMES)[number];

export interface FactsLevel {
  mode: 'facts';
  dividend: number;
  divisor: number;
  theme?: FactsTheme;
}

export interface ShiftLevel {
  mode: 'shift';
  dividend: number;
  divisor: ShiftDivisor;
}

export interface EuclidLevel {
  mode: 'euclid';
  dividend: number;
  divisor: number;
}

export interface LongLevel {
  mode: 'long';
  dividend: number;
  divisor: number;
}

export type Level = FactsLevel | ShiftLevel | EuclidLevel | LongLevel;

/** Random source returning a number in [0, 1). Injectable for deterministic tests. */
export type Rng = () => number;

// ---------------------------------------------------------------------------
// Limits (mirrored in levels.schema.json; a test asserts they agree)
// ---------------------------------------------------------------------------

export const LIMITS = {
  /** Levels kept from one custom set. */
  maxLevels: 30,
  /** Items inspected at most, so a huge array cannot stall the parser. */
  maxScan: 200,
  /** Longest JSON string the parser will try to parse. */
  maxJsonChars: 20000,
  facts: { divisorMin: 2, divisorMax: 10, dividendMax: 100, quotientMax: 12 },
  shift: { divisors: [10, 100, 1000] as readonly number[], dividendMin: 10, dividendMax: 999999 },
  euclid: { divisorMin: 2, divisorMax: 12, dividendMax: 150, quotientMax: 20 },
  long: { divisorMin: 2, divisorMax: 9, dividendMin: 10, dividendMax: 9999 }
} as const;

/** The only envelope version this cartridge understands. */
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads an own property only, so inherited data is never trusted. */
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && (ALL_MODES as readonly string[]).includes(value);
}

function isSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * Validates one mode's operands against LIMITS. Out-of-range values make the
 * level invalid; they are never clamped, because a changed operand would be a
 * different exercise from the one that was supplied.
 */
export function isWithinLimits(mode: ModeId, dividend: number, divisor: number): boolean {
  if (!isSafeInt(dividend) || !isSafeInt(divisor)) return false;
  if (divisor < 1 || dividend < divisor) return false;

  switch (mode) {
    case 'facts': {
      const l = LIMITS.facts;
      if (divisor < l.divisorMin || divisor > l.divisorMax || dividend > l.dividendMax) return false;
      return divide(dividend, divisor).q <= l.quotientMax;
    }
    case 'shift': {
      const l = LIMITS.shift;
      if (!isShiftDivisor(divisor)) return false;
      if (dividend < l.dividendMin || dividend > l.dividendMax) return false;
      return dividend % divisor === 0;
    }
    case 'euclid': {
      const l = LIMITS.euclid;
      if (divisor < l.divisorMin || divisor > l.divisorMax || dividend > l.dividendMax) return false;
      return divide(dividend, divisor).q <= l.quotientMax;
    }
    case 'long': {
      const l = LIMITS.long;
      if (divisor < l.divisorMin || divisor > l.divisorMax) return false;
      return dividend >= l.dividendMin && dividend <= l.dividendMax;
    }
  }
}

function parseLevel(item: unknown, modes: readonly ModeId[]): Level | null {
  if (!isPlainObject(item)) return null;

  const mode = own(item, 'mode');
  if (!isModeId(mode) || !modes.includes(mode)) return null;

  const dividend = own(item, 'dividend');
  const divisor = own(item, 'divisor');
  if (!isSafeInt(dividend) || !isSafeInt(divisor)) return null;
  if (!isWithinLimits(mode, dividend, divisor)) return null;

  // Build a fresh object with known fields only; nothing is passed through.
  switch (mode) {
    case 'facts': {
      const theme = own(item, 'theme');
      const level: FactsLevel = { mode, dividend, divisor };
      if (typeof theme === 'string' && (FACTS_THEMES as readonly string[]).includes(theme)) {
        level.theme = theme as FactsTheme;
      }
      return level;
    }
    case 'shift':
      return { mode, dividend, divisor: divisor as ShiftDivisor };
    case 'euclid':
      return { mode, dividend, divisor };
    case 'long':
      return { mode, dividend, divisor };
  }
}

/**
 * Sanitizes externally supplied levels (LMS / lesson generator).
 *
 * Accepts an array of levels, a single level object, a `{ version, levels }`
 * envelope, or a JSON string of any of those. Invalid levels are skipped;
 * `null` is returned when nothing usable remains so the game can fall back to
 * procedural levels. Answers are never read: the cartridge computes them.
 *
 * @param modes Modes to accept. Defaults to the modes that are built.
 */
export function parseCustomLevels(
  raw: unknown,
  modes: readonly ModeId[] = BUILT_MODES
): Level[] | null {
  try {
    return parseUntrusted(raw, modes);
  } catch {
    // Exotic inputs (throwing getters, proxies) must never break the game.
    return null;
  }
}

function parseUntrusted(raw: unknown, modes: readonly ModeId[]): Level[] | null {
  let data: unknown = raw;

  if (typeof data === 'string') {
    if (data.length > LIMITS.maxJsonChars) return null;
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (isPlainObject(data)) {
    const inner = own(data, 'levels');
    if (Array.isArray(inner)) {
      const version = own(data, 'version');
      if (version !== undefined && version !== SCHEMA_VERSION) return null;
      data = inner;
    } else {
      data = [data];
    }
  }

  if (!Array.isArray(data)) return null;

  const levels: Level[] = [];
  const scan = Math.min(data.length, LIMITS.maxScan);
  for (let i = 0; i < scan && levels.length < LIMITS.maxLevels; i++) {
    const level = parseLevel(data[i], modes);
    if (level) levels.push(level);
  }

  return levels.length > 0 ? levels : null;
}

/** Stable identity of a parsed level, used for de-duplication and signatures. */
function levelKey(level: Level): string {
  const theme = level.mode === 'facts' && level.theme ? `:${level.theme}` : '';
  return `${level.mode}:${level.dividend}:${level.divisor}${theme}`;
}

/**
 * Stable string describing a level set. Two sets have the same signature only
 * if they hold the same levels in the same order, which lets the game tell a
 * real change of levels from the host merely resending its configuration.
 */
export function levelsSignature(levels: readonly Level[]): string {
  return levels.map(levelKey).join('|');
}

// ---------------------------------------------------------------------------
// Procedural generator
// ---------------------------------------------------------------------------

/** 'none': exact division; 'some': remainder > 0; 'any': either. */
type RemainderRule = 'none' | 'some' | 'any';

interface Slot {
  mode: ModeId;
  remainder: RemainderRule;
}

const AGE_MODES: Record<AgeGroup, readonly ModeId[]> = {
  '3-5': ['facts'],
  '6-8': ['facts', 'euclid'],
  '9-11': ALL_MODES
};

function slot(mode: ModeId, remainder: RemainderRule = 'none'): Slot {
  return { mode, remainder };
}

/** The planned sequence of modes for one age bracket and difficulty. */
function planSlots(age: AgeGroup, difficulty: Difficulty): Slot[] {
  if (age === '3-5') {
    return [slot('facts'), slot('facts'), slot('facts')];
  }
  if (age === '6-8') {
    if (difficulty === 'easy') {
      return [slot('facts'), slot('facts'), slot('facts'), slot('facts')];
    }
    if (difficulty === 'medium') {
      return [slot('facts'), slot('facts', 'some'), slot('facts'), slot('euclid', 'some')];
    }
    return [slot('facts'), slot('facts', 'some'), slot('facts', 'some'), slot('euclid', 'some')];
  }
  // 9-11: all four modes in teaching order; the fifth level doubles one mode.
  if (difficulty === 'easy') {
    return [slot('facts'), slot('facts'), slot('shift'), slot('euclid', 'some'), slot('long')];
  }
  if (difficulty === 'medium') {
    return [
      slot('facts'),
      slot('shift'),
      slot('euclid', 'some'),
      slot('euclid', 'some'),
      slot('long', 'any')
    ];
  }
  return [
    slot('facts', 'some'),
    slot('shift'),
    slot('euclid', 'some'),
    slot('long', 'any'),
    slot('long', 'any')
  ];
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  const raw = Math.floor(rng() * list.length);
  const index = Number.isFinite(raw) ? Math.min(list.length - 1, Math.max(0, raw)) : 0;
  return list[index];
}

function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let n = min; n <= max; n++) out.push(n);
  return out;
}

function remainderAllowed(rule: RemainderRule, r: number): boolean {
  if (rule === 'none') return r === 0;
  if (rule === 'some') return r > 0;
  return true;
}

interface GroupingRules {
  divisors: readonly number[];
  dividendMin: number;
  dividendMax: number;
  quotientMax: number;
}

function factsRules(age: AgeGroup, difficulty: Difficulty): GroupingRules {
  if (age === '3-5') {
    // Share tier only (dividend <= 12), always exact.
    if (difficulty === 'easy') {
      return { divisors: [2], dividendMin: 4, dividendMax: 8, quotientMax: 12 };
    }
    if (difficulty === 'medium') {
      return { divisors: [2, 3], dividendMin: 4, dividendMax: 12, quotientMax: 12 };
    }
    return { divisors: [2, 3, 4], dividendMin: 4, dividendMax: 12, quotientMax: 12 };
  }
  if (age === '6-8') {
    const divisors = difficulty === 'easy' ? [2, 3] : [2, 3, 4, 5];
    return { divisors, dividendMin: 4, dividendMax: 30, quotientMax: LIMITS.facts.quotientMax };
  }
  // 9-11: Array tier (dividend > 30), tables 2-9.
  return { divisors: range(2, 9), dividendMin: 31, dividendMax: LIMITS.facts.dividendMax, quotientMax: 9 };
}

function euclidRules(age: AgeGroup): GroupingRules {
  if (age === '6-8') {
    return { divisors: [2, 3, 4, 5], dividendMin: 4, dividendMax: 30, quotientMax: LIMITS.euclid.quotientMax };
  }
  return { divisors: range(3, 9), dividendMin: 6, dividendMax: 99, quotientMax: LIMITS.euclid.quotientMax };
}

/**
 * Builds every (dividend, divisor) allowed by the rules from (b, q, r), so each
 * candidate is solvable by construction and never trivial (quotient >= 2).
 */
function groupingCandidates(
  mode: 'facts' | 'euclid',
  rules: GroupingRules,
  remainder: RemainderRule
): Level[] {
  const out: Level[] = [];
  for (const b of rules.divisors) {
    for (let q = 2; q <= rules.quotientMax; q++) {
      for (let r = 0; r < b; r++) {
        const a = b * q + r;
        if (a < rules.dividendMin || a > rules.dividendMax) continue;
        if (!remainderAllowed(remainder, r)) continue;
        out.push({ mode, dividend: a, divisor: b });
      }
    }
  }
  return out;
}

function pickGrouping(
  rng: Rng,
  candidates: Level[],
  used: Set<string>,
  avoidDivisor: number | null
): Level | null {
  const fresh = candidates.filter((c) => !used.has(levelKey(c)));
  const varied = avoidDivisor === null ? fresh : fresh.filter((c) => c.divisor !== avoidDivisor);
  const pool = varied.length > 0 ? varied : fresh.length > 0 ? fresh : candidates;
  return pool.length > 0 ? pick(rng, pool) : null;
}

const SAMPLE_ATTEMPTS = 300;

function makeShift(rng: Rng, difficulty: Difficulty, used: Set<string>): Level {
  const divisors: readonly ShiftDivisor[] = difficulty === 'easy' ? [10, 100] : [10, 100, 1000];
  const mantissaMax = difficulty === 'easy' ? 99 : 999;
  const extraZerosMax = difficulty === 'hard' ? 2 : 1;

  for (let i = 0; i < SAMPLE_ATTEMPTS; i++) {
    const divisor = pick(rng, divisors);
    const mantissa = pick(rng, range(1, mantissaMax));
    const quotient = mantissa * 10 ** pick(rng, range(0, extraZerosMax));
    const dividend = quotient * divisor;
    const level: Level = { mode: 'shift', dividend, divisor };
    if (quotient >= 2 && isWithinLimits('shift', dividend, divisor) && !used.has(levelKey(level))) {
      return level;
    }
  }
  return { mode: 'shift', dividend: 60000, divisor: 100 };
}

function hasZeroQuotientDigit(dividend: number, divisor: number): boolean {
  return longDivisionTrace(dividend, divisor).some((step) => step.digit === 0);
}

function leadingDigit(n: number): number {
  return Number(String(n)[0]);
}

function makeLong(rng: Rng, difficulty: Difficulty, remainder: RemainderRule, used: Set<string>): Level {
  const [min, max] = difficulty === 'hard' ? [1000, 9999] : [100, 999];
  const span = max - min + 1;

  for (let i = 0; i < SAMPLE_ATTEMPTS; i++) {
    const divisor = pick(rng, range(LIMITS.long.divisorMin, LIMITS.long.divisorMax));
    const offset = Math.floor(rng() * span);
    const dividend = min + (Number.isFinite(offset) ? Math.min(span - 1, Math.max(0, offset)) : 0);
    const level: Level = { mode: 'long', dividend, divisor };

    if (!remainderAllowed(remainder, divide(dividend, divisor).r)) continue;
    const smallLead = leadingDigit(dividend) < divisor;
    const zeroDigit = hasZeroQuotientDigit(dividend, divisor);
    if (difficulty === 'easy' && (smallLead || zeroDigit)) continue;
    if (difficulty === 'hard' && !smallLead && !zeroDigit) continue;
    if (used.has(levelKey(level))) continue;
    return level;
  }

  if (difficulty === 'easy') return { mode: 'long', dividend: 844, divisor: 4 };
  if (difficulty === 'hard') return { mode: 'long', dividend: 4816, divisor: 8 };
  return { mode: 'long', dividend: 806, divisor: 5 };
}

function normalizeAge(age: unknown): AgeGroup {
  return age === '3-5' || age === '6-8' || age === '9-11' ? age : '6-8';
}

function normalizeDifficulty(difficulty: unknown): Difficulty {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' ? difficulty : 'medium';
}

/**
 * Generates a procedural level set for an age bracket and difficulty.
 *
 * Every level is built from (divisor, quotient, remainder), so it is solvable
 * by construction, and every level also satisfies LIMITS. A slot whose mode is
 * not in `modes` is filled by another enabled mode suited to the bracket, so
 * the level count stays the same while the cartridge is still growing.
 *
 * @param rng Random source in [0, 1); inject a seeded one for deterministic output.
 * @param modes Modes that may be used. Defaults to the modes that are built.
 * @returns The level set, or an empty array when no enabled mode suits the bracket.
 */
export function generateLevelsForAge(
  ageGroup: AgeGroup,
  difficulty: Difficulty = 'medium',
  rng: Rng = Math.random,
  modes: readonly ModeId[] = BUILT_MODES
): Level[] {
  const age = normalizeAge(ageGroup);
  const diff = normalizeDifficulty(difficulty);

  const fallbackMode = AGE_MODES[age].find((m) => modes.includes(m));
  if (fallbackMode === undefined) return [];

  const slots = planSlots(age, diff).map((s) =>
    modes.includes(s.mode) ? s : slot(fallbackMode, s.remainder)
  );

  const rules = factsRules(age, diff);
  const factsTotal = slots.filter((s) => s.mode === 'facts').length;
  const factsDivisors: number[] = [];
  const used = new Set<string>();
  const levels: Level[] = [];

  for (const s of slots) {
    let level: Level | null;

    if (s.mode === 'facts') {
      // Ages 3-5 never see a remainder, whatever slot was substituted in.
      const remainder: RemainderRule = age === '3-5' ? 'none' : s.remainder;
      const isLastFacts = factsDivisors.length === factsTotal - 1;
      const allSame = factsDivisors.length > 0 && factsDivisors.every((d) => d === factsDivisors[0]);
      const avoid = isLastFacts && allSame && rules.divisors.length > 1 ? factsDivisors[0] : null;
      level = pickGrouping(rng, groupingCandidates('facts', rules, remainder), used, avoid);
      if (level) factsDivisors.push(level.divisor);
    } else if (s.mode === 'euclid') {
      level = pickGrouping(rng, groupingCandidates('euclid', euclidRules(age), s.remainder), used, null);
    } else if (s.mode === 'shift') {
      level = makeShift(rng, diff, used);
    } else {
      level = makeLong(rng, diff, diff === 'easy' ? 'none' : s.remainder, used);
    }

    if (level) {
      used.add(levelKey(level));
      levels.push(level);
    }
  }

  return levels;
}
