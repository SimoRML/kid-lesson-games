import { describe, expect, it } from 'vitest';
import type { AgeGroup, Difficulty } from '../../src/core/types.js';
import { divide, longDivisionTrace } from './division.js';
import {
  FACTS_THEMES,
  LIMITS,
  SCHEMA_VERSION,
  generateLevelsForAge,
  isWithinLimits,
  levelsSignature,
  parseCustomLevels,
  type Level,
  type Rng
} from './levels.js';
import { ALL_MODES, BUILT_MODES, type ModeId } from './modes/types.js';
import schema from './levels.schema.json';

/** The owner's 4AEP worksheet "LA DIVISION", transcribed (05-test-plan.md §1). */
const SHEET_LEVELS: Level[] = [
  { mode: 'shift', dividend: 60000, divisor: 100 },
  { mode: 'shift', dividend: 5000, divisor: 10 },
  { mode: 'shift', dividend: 10, divisor: 10 },
  { mode: 'shift', dividend: 200, divisor: 100 },
  { mode: 'shift', dividend: 3400, divisor: 100 },
  { mode: 'shift', dividend: 789000, divisor: 1000 },
  { mode: 'facts', dividend: 27, divisor: 3 },
  { mode: 'facts', dividend: 42, divisor: 7 },
  { mode: 'facts', dividend: 64, divisor: 8 },
  { mode: 'facts', dividend: 48, divisor: 6 },
  { mode: 'facts', dividend: 16, divisor: 4 },
  { mode: 'facts', dividend: 36, divisor: 6 },
  { mode: 'facts', dividend: 63, divisor: 7 },
  { mode: 'facts', dividend: 25, divisor: 5 },
  { mode: 'euclid', dividend: 78, divisor: 8 },
  { mode: 'euclid', dividend: 57, divisor: 7 },
  { mode: 'euclid', dividend: 59, divisor: 9 },
  { mode: 'euclid', dividend: 39, divisor: 4 },
  { mode: 'euclid', dividend: 22, divisor: 3 },
  { mode: 'euclid', dividend: 47, divisor: 8 },
  { mode: 'euclid', dividend: 98, divisor: 8 },
  { mode: 'euclid', dividend: 75, divisor: 5 },
  { mode: 'euclid', dividend: 59, divisor: 4 },
  { mode: 'long', dividend: 806, divisor: 5 },
  { mode: 'long', dividend: 568, divisor: 8 }
];

const parseAll = (raw: unknown) => parseCustomLevels(raw, ALL_MODES);

/** Small deterministic PRNG (mulberry32) so generator tests are repeatable. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AGES: AgeGroup[] = ['3-5', '6-8', '9-11'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = [1, 2, 3, 7, 42, 1234, 99999, 20261114];

describe('parseCustomLevels: accepted shapes', () => {
  it('parses the whole sample sheet, in order', () => {
    expect(parseAll(SHEET_LEVELS)).toEqual(SHEET_LEVELS);
    expect(parseAll(SHEET_LEVELS)).toHaveLength(25);
  });

  it('accepts a single level object', () => {
    expect(parseAll({ mode: 'euclid', dividend: 78, divisor: 8 })).toEqual([
      { mode: 'euclid', dividend: 78, divisor: 8 }
    ]);
  });

  it('accepts a JSON string', () => {
    expect(parseAll(JSON.stringify(SHEET_LEVELS))).toEqual(SHEET_LEVELS);
    expect(parseAll('{"mode":"long","dividend":806,"divisor":5}')).toEqual([
      { mode: 'long', dividend: 806, divisor: 5 }
    ]);
  });

  it('accepts a versioned envelope, with or without the version', () => {
    const levels = [{ mode: 'facts', dividend: 27, divisor: 3 }];
    expect(parseAll({ version: SCHEMA_VERSION, levels })).toEqual(levels);
    expect(parseAll({ levels })).toEqual(levels);
    expect(parseAll(JSON.stringify({ version: 1, levels }))).toEqual(levels);
  });

  it('keeps a known facts theme and drops an unknown one', () => {
    for (const theme of FACTS_THEMES) {
      expect(parseAll([{ mode: 'facts', dividend: 12, divisor: 3, theme }])).toEqual([
        { mode: 'facts', dividend: 12, divisor: 3, theme }
      ]);
    }
    expect(parseAll([{ mode: 'facts', dividend: 12, divisor: 3, theme: 'dragons' }])).toEqual([
      { mode: 'facts', dividend: 12, divisor: 3 }
    ]);
    expect(parseAll([{ mode: 'facts', dividend: 12, divisor: 3, theme: 7 }])).toEqual([
      { mode: 'facts', dividend: 12, divisor: 3 }
    ]);
    // theme belongs to facts only
    expect(parseAll([{ mode: 'euclid', dividend: 12, divisor: 5, theme: 'dates' }])).toEqual([
      { mode: 'euclid', dividend: 12, divisor: 5 }
    ]);
  });
});

describe('parseCustomLevels: whole-input rejection', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a boolean', true],
    ['an empty string', ''],
    ['invalid JSON', '{not json'],
    ['a JSON string of a number', '12'],
    ['an empty object', {}],
    ['an empty array', []],
    ['an all-invalid array', [{ mode: 'nope' }, 3, null, 'x']],
    ['an unsupported envelope version', { version: 2, levels: [{ mode: 'facts', dividend: 27, divisor: 3 }] }],
    ['a non-numeric envelope version', { version: '1', levels: [{ mode: 'facts', dividend: 27, divisor: 3 }] }],
    ['an envelope whose levels is not an array', { version: 1, levels: 'facts' }]
  ])('returns null for %s', (_name, raw) => {
    expect(parseAll(raw)).toBeNull();
  });

  it('returns null for a string longer than the JSON limit', () => {
    const padded = JSON.stringify(SHEET_LEVELS) + ' '.repeat(LIMITS.maxJsonChars);
    expect(padded.length).toBeGreaterThan(LIMITS.maxJsonChars);
    expect(parseAll(padded)).toBeNull();
  });

  it('accepts no mode at all with an empty mode list, which is the default before any mode is built', () => {
    expect(parseCustomLevels(SHEET_LEVELS, [])).toBeNull();
    expect(BUILT_MODES).toEqual([]);
    expect(parseCustomLevels(SHEET_LEVELS)).toBeNull();
  });
});

describe('parseCustomLevels: per-level skipping', () => {
  const good = { mode: 'facts', dividend: 27, divisor: 3 };

  it.each([
    ['unknown mode', { mode: 'add', dividend: 27, divisor: 3 }],
    ['missing mode', { dividend: 27, divisor: 3 }],
    ['non-string mode', { mode: 1, dividend: 27, divisor: 3 }],
    ['numeric string dividend', { mode: 'facts', dividend: '27', divisor: 3 }],
    ['numeric string divisor', { mode: 'facts', dividend: 27, divisor: '3' }],
    ['spaced numeric string', { mode: 'shift', dividend: '60 000', divisor: 100 }],
    ['fractional dividend', { mode: 'facts', dividend: 27.5, divisor: 3 }],
    ['NaN', { mode: 'facts', dividend: Number.NaN, divisor: 3 }],
    ['Infinity', { mode: 'long', dividend: Number.POSITIVE_INFINITY, divisor: 3 }],
    ['negative dividend', { mode: 'facts', dividend: -27, divisor: 3 }],
    ['negative divisor', { mode: 'facts', dividend: 27, divisor: -3 }],
    ['unsafe integer', { mode: 'long', dividend: 2 ** 53, divisor: 3 }],
    ['divisor 0', { mode: 'facts', dividend: 27, divisor: 0 }],
    ['divisor 1', { mode: 'facts', dividend: 27, divisor: 1 }],
    ['missing divisor', { mode: 'facts', dividend: 27 }],
    ['dividend below divisor', { mode: 'euclid', dividend: 5, divisor: 8 }],
    ['null item', null],
    ['array item', [27, 3]],
    ['string item', 'facts 27 3']
  ])('skips a level with %s and keeps the rest', (_name, bad) => {
    expect(parseAll([bad, good])).toEqual([good]);
  });

  it('skips modes that are not enabled', () => {
    const onlyFacts: ModeId[] = ['facts'];
    expect(parseCustomLevels(SHEET_LEVELS, onlyFacts)).toEqual(
      SHEET_LEVELS.filter((l) => l.mode === 'facts')
    );
  });

  it('ignores answer fields and any other extra key', () => {
    const parsed = parseAll([
      {
        mode: 'euclid',
        dividend: 78,
        divisor: 8,
        answer: 999,
        quotient: 1,
        remainder: 70,
        instruction: '<img src=x onerror=alert(1)>',
        nested: { deep: true }
      }
    ]);
    expect(parsed).toEqual([{ mode: 'euclid', dividend: 78, divisor: 8 }]);
    expect(Object.keys(parsed![0]).sort()).toEqual(['dividend', 'divisor', 'mode']);
  });

  it('reads own properties only', () => {
    const viaJson = JSON.parse('{"__proto__": {"mode": "facts"}, "dividend": 6, "divisor": 2}');
    expect(parseAll([viaJson])).toBeNull();

    const inherited = Object.create({ mode: 'facts', dividend: 6, divisor: 2 });
    expect(inherited.mode).toBe('facts');
    expect(parseAll([inherited])).toBeNull();

    const parsed = parseAll([{ mode: 'facts', dividend: 6, divisor: 2 }])!;
    expect(Object.getPrototypeOf(parsed[0])).toBe(Object.prototype);
  });

  it('returns fresh objects, never the caller’s', () => {
    const input = [{ mode: 'facts', dividend: 27, divisor: 3 }];
    const parsed = parseAll(input)!;
    expect(parsed[0]).not.toBe(input[0]);
    expect(parsed).not.toBe(input);
  });
});

describe('parseCustomLevels: limits (reject, never clamp)', () => {
  const ok = (mode: ModeId, dividend: number, divisor: number) =>
    expect(parseAll([{ mode, dividend, divisor }]), `${mode} ${dividend}÷${divisor}`).toEqual([
      { mode, dividend, divisor }
    ]);
  const no = (mode: ModeId, dividend: number, divisor: number) =>
    expect(parseAll([{ mode, dividend, divisor }]), `${mode} ${dividend}÷${divisor}`).toBeNull();

  it('facts: divisor 2-10, dividend up to 100, quotient up to 12', () => {
    ok('facts', 2, 2);
    ok('facts', 24, 2); // quotient 12
    ok('facts', 25, 2); // quotient 12 r 1
    no('facts', 26, 2); // quotient 13
    ok('facts', 100, 10);
    no('facts', 100, 2); // quotient 50
    no('facts', 101, 10);
    no('facts', 22, 11);
    no('facts', 5, 1);
    no('facts', 2, 3);
  });

  it('shift: divisor 10/100/1000, exact, dividend 10 to 999 999', () => {
    ok('shift', 10, 10);
    ok('shift', 999990, 10);
    ok('shift', 999000, 1000);
    no('shift', 1000000, 10);
    no('shift', 3400, 1000); // not exact
    no('shift', 34, 10);
    no('shift', 100, 20);
    no('shift', 100000, 10000);
    no('shift', 10, 100);
  });

  it('euclid: divisor 2-12, dividend up to 150, quotient up to 20', () => {
    ok('euclid', 2, 2);
    ok('euclid', 150, 12);
    ok('euclid', 41, 2); // quotient 20 r 1
    no('euclid', 42, 2); // quotient 21
    no('euclid', 151, 12);
    no('euclid', 26, 13);
    no('euclid', 9, 1);
  });

  it('long: divisor 2-9, dividend 10 to 9 999', () => {
    ok('long', 10, 2);
    ok('long', 9999, 9);
    no('long', 9, 2);
    no('long', 10000, 9);
    no('long', 100, 10);
    no('long', 100, 1);
  });

  it('isWithinLimits agrees for non-integers', () => {
    expect(isWithinLimits('long', 100.5, 5)).toBe(false);
    expect(isWithinLimits('facts', 12, Number.NaN)).toBe(false);
  });

  it('every sheet level is within limits', () => {
    for (const l of SHEET_LEVELS) {
      expect(isWithinLimits(l.mode, l.dividend, l.divisor), levelsSignature([l])).toBe(true);
    }
  });
});

describe('parseCustomLevels: size and hostile input', () => {
  it('keeps the first 30 valid levels', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ mode: 'long', dividend: 100 + i, divisor: 5 }));
    const parsed = parseAll(many)!;
    expect(parsed).toHaveLength(LIMITS.maxLevels);
    expect(parsed[29]).toEqual({ mode: 'long', dividend: 129, divisor: 5 });
  });

  it('only scans the first 200 items', () => {
    const junk = Array.from({ length: 10000 }, () => ({ mode: 'junk' }));
    expect(parseAll(junk)).toBeNull();

    const lateValid = [...Array.from({ length: LIMITS.maxScan }, () => null), { mode: 'facts', dividend: 27, divisor: 3 }];
    expect(parseAll(lateValid)).toBeNull();

    const justInside = [...Array.from({ length: LIMITS.maxScan - 1 }, () => null), { mode: 'facts', dividend: 27, divisor: 3 }];
    expect(parseAll(justInside)).toHaveLength(1);
  });

  it('never throws', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const throwing = {
      get mode(): string {
        throw new Error('boom');
      }
    };
    const hostile: unknown[] = [
      Symbol('x'),
      () => 1,
      new Date(),
      new Map(),
      cyclic,
      [cyclic],
      { levels: [cyclic] },
      '[' + '['.repeat(5000),
      '{"levels": 5}',
      Object.create(null),
      [Object.create(null)],
      new Proxy({}, {}),
      1n
    ];
    for (const value of hostile) {
      expect(() => parseAll(value)).not.toThrow();
    }
    expect(parseAll([throwing, { mode: 'facts', dividend: 6, divisor: 2 }])).toBeNull();
    const angryProxy = new Proxy([], {
      get() {
        throw new Error('boom');
      }
    });
    expect(parseAll(angryProxy)).toBeNull();
  });
});

describe('levelsSignature', () => {
  it('is equal for equal sets and stable', () => {
    expect(levelsSignature(SHEET_LEVELS)).toBe(levelsSignature(parseAll(JSON.stringify(SHEET_LEVELS))!));
    expect(levelsSignature([{ mode: 'facts', dividend: 27, divisor: 3 }, { mode: 'shift', dividend: 60000, divisor: 100 }])).toBe(
      'facts:27:3|shift:60000:100'
    );
    expect(levelsSignature([])).toBe('');
  });

  it('differs when a mode, operand, theme or the order differs', () => {
    const first: Level = { mode: 'facts', dividend: 27, divisor: 3 };
    const second: Level = { mode: 'euclid', dividend: 78, divisor: 8 };
    const sig = levelsSignature([first, second]);
    expect(levelsSignature([second, first])).not.toBe(sig);
    expect(levelsSignature([{ mode: 'facts', dividend: 28, divisor: 3 }, second])).not.toBe(sig);
    expect(levelsSignature([{ mode: 'facts', dividend: 27, divisor: 9 }, second])).not.toBe(sig);
    expect(levelsSignature([{ mode: 'euclid', dividend: 27, divisor: 3 }, second])).not.toBe(sig);
    expect(levelsSignature([{ mode: 'facts', dividend: 27, divisor: 3, theme: 'dates' }, second])).not.toBe(sig);
    expect(levelsSignature([first])).not.toBe(sig);
  });
});

describe('generateLevelsForAge', () => {
  const gen = (age: AgeGroup, difficulty: Difficulty, seed: number, modes: readonly ModeId[] = ALL_MODES) =>
    generateLevelsForAge(age, difficulty, seeded(seed), modes);

  const EXPECTED_MODES: Record<AgeGroup, Record<Difficulty, ModeId[]>> = {
    '3-5': {
      easy: ['facts', 'facts', 'facts'],
      medium: ['facts', 'facts', 'facts'],
      hard: ['facts', 'facts', 'facts']
    },
    '6-8': {
      easy: ['facts', 'facts', 'facts', 'facts'],
      medium: ['facts', 'facts', 'facts', 'euclid'],
      hard: ['facts', 'facts', 'facts', 'euclid']
    },
    '9-11': {
      easy: ['facts', 'facts', 'shift', 'euclid', 'long'],
      medium: ['facts', 'shift', 'euclid', 'euclid', 'long'],
      hard: ['facts', 'shift', 'euclid', 'long', 'long']
    }
  };

  function forEveryCell(check: (levels: Level[], age: AgeGroup, difficulty: Difficulty, seed: number) => void) {
    for (const age of AGES) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          check(gen(age, difficulty, seed), age, difficulty, seed);
        }
      }
    }
  }

  it('produces the planned modes in teaching order for every cell', () => {
    forEveryCell((levels, age, difficulty) => {
      expect(levels.map((l) => l.mode), `${age} ${difficulty}`).toEqual(EXPECTED_MODES[age][difficulty]);
    });
  });

  it('is deterministic for a given seed', () => {
    forEveryCell((levels, age, difficulty, seed) => {
      expect(gen(age, difficulty, seed)).toEqual(levels);
    });
    expect(gen('9-11', 'medium', 1)).not.toEqual(gen('9-11', 'medium', 2));
  });

  it('only emits levels that the parser accepts unchanged', () => {
    forEveryCell((levels) => {
      expect(parseAll(levels)).toEqual(levels);
    });
  });

  it('never emits a trivial level (quotient >= 2, divisor >= 2)', () => {
    forEveryCell((levels) => {
      for (const l of levels) {
        expect(l.divisor).toBeGreaterThanOrEqual(2);
        expect(divide(l.dividend, l.divisor).q).toBeGreaterThanOrEqual(2);
      }
    });
  });

  it('never repeats a level within a set', () => {
    forEveryCell((levels, age, difficulty, seed) => {
      const keys = levels.map((l) => levelsSignature([l]));
      expect(new Set(keys).size, `${age} ${difficulty} seed ${seed}`).toBe(keys.length);
    });
  });

  it('varies the facts divisor when the cell allows more than one', () => {
    forEveryCell((levels, age, difficulty, seed) => {
      const divisors = levels.filter((l) => l.mode === 'facts').map((l) => l.divisor);
      if (divisors.length < 2) return;
      if (age === '3-5' && difficulty === 'easy') {
        expect(new Set(divisors)).toEqual(new Set([2]));
        return;
      }
      expect(new Set(divisors).size, `${age} ${difficulty} seed ${seed}`).toBeGreaterThan(1);
    });
  });

  it('ages 3-5: small exact sharing only', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const levels = gen('3-5', difficulty, seed);
        expect(levels).toHaveLength(3);
        const allowed = difficulty === 'easy' ? [2] : difficulty === 'medium' ? [2, 3] : [2, 3, 4];
        const maxDividend = difficulty === 'easy' ? 8 : 12;
        for (const l of levels) {
          expect(l.mode).toBe('facts');
          expect(allowed).toContain(l.divisor);
          expect(l.dividend).toBeLessThanOrEqual(maxDividend);
          expect(divide(l.dividend, l.divisor).r).toBe(0);
        }
      }
    }
    // easy has exactly three possible exercises, all with different dividends
    expect(gen('3-5', 'easy', 5).map((l) => l.dividend).sort((a, b) => a - b)).toEqual([4, 6, 8]);
  });

  it('ages 6-8: divisors up to 5, dividends up to 30, remainders by difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const levels = gen('6-8', difficulty, seed);
        expect(levels).toHaveLength(4);
        const allowed = difficulty === 'easy' ? [2, 3] : [2, 3, 4, 5];
        for (const l of levels) {
          expect(allowed).toContain(l.divisor);
          expect(l.dividend).toBeLessThanOrEqual(30);
        }
        const withRemainder = levels.filter((l) => divide(l.dividend, l.divisor).r > 0).length;
        expect(withRemainder).toBe(difficulty === 'easy' ? 0 : difficulty === 'medium' ? 2 : 3);
        if (difficulty !== 'easy') {
          expect(levels[3].mode).toBe('euclid');
        }
      }
    }
  });

  it('ages 9-11: facts in the array tier with tables 2-9', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        for (const l of gen('9-11', difficulty, seed).filter((x) => x.mode === 'facts')) {
          const { q, r } = divide(l.dividend, l.divisor);
          expect(l.dividend).toBeGreaterThan(30);
          expect(l.divisor).toBeGreaterThanOrEqual(2);
          expect(l.divisor).toBeLessThanOrEqual(9);
          expect(q).toBeLessThanOrEqual(9);
          if (difficulty === 'hard') expect(r).toBeGreaterThan(0);
          else expect(r).toBe(0);
        }
      }
    }
  });

  it('ages 9-11: shift divisors grow with difficulty', () => {
    for (const seed of SEEDS) {
      for (const l of gen('9-11', 'easy', seed).filter((x) => x.mode === 'shift')) {
        expect([10, 100]).toContain(l.divisor);
      }
    }
    const hardDivisors = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const l of gen('9-11', 'hard', seed).filter((x) => x.mode === 'shift')) {
        hardDivisors.add(l.divisor);
        expect(l.dividend % l.divisor).toBe(0);
      }
    }
    expect(hardDivisors).toEqual(new Set([10, 100, 1000]));
  });

  it('ages 9-11: euclid uses divisors 3-9, dividends up to 99, always with a remainder', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        for (const l of gen('9-11', difficulty, seed).filter((x) => x.mode === 'euclid')) {
          expect(l.divisor).toBeGreaterThanOrEqual(3);
          expect(l.divisor).toBeLessThanOrEqual(9);
          expect(l.dividend).toBeLessThanOrEqual(99);
          expect(divide(l.dividend, l.divisor).r).toBeGreaterThan(0);
        }
      }
    }
  });

  it('ages 9-11: long division shape follows difficulty', () => {
    const leading = (n: number) => Number(String(n)[0]);
    const hasZero = (l: Level) => longDivisionTrace(l.dividend, l.divisor).some((s) => s.digit === 0);

    for (const seed of SEEDS) {
      for (const l of gen('9-11', 'easy', seed).filter((x) => x.mode === 'long')) {
        expect(String(l.dividend)).toHaveLength(3);
        expect(divide(l.dividend, l.divisor).r).toBe(0);
        expect(leading(l.dividend)).toBeGreaterThanOrEqual(l.divisor);
        expect(hasZero(l)).toBe(false);
      }
      for (const l of gen('9-11', 'medium', seed).filter((x) => x.mode === 'long')) {
        expect(String(l.dividend)).toHaveLength(3);
      }
      const hard = gen('9-11', 'hard', seed).filter((x) => x.mode === 'long');
      expect(hard).toHaveLength(2);
      for (const l of hard) {
        expect(String(l.dividend)).toHaveLength(4);
        expect(leading(l.dividend) < l.divisor || hasZero(l)).toBe(true);
      }
    }
  });

  it('fills slots of unbuilt modes with a built mode, keeping the level count', () => {
    for (const age of AGES) {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const levels = gen(age, difficulty, seed, ['facts']);
          expect(levels).toHaveLength(EXPECTED_MODES[age][difficulty].length);
          expect(levels.every((l) => l.mode === 'facts')).toBe(true);
          expect(parseCustomLevels(levels, ['facts'])).toEqual(levels);
          if (age === '3-5') {
            expect(levels.every((l) => l.dividend % l.divisor === 0)).toBe(true);
          }
        }
      }
    }
    expect(gen('9-11', 'medium', 3, ['facts', 'euclid']).map((l) => l.mode)).toEqual([
      'facts',
      'facts',
      'euclid',
      'euclid',
      'facts'
    ]);
  });

  it('returns an empty set when no enabled mode suits the bracket', () => {
    expect(gen('9-11', 'medium', 1, [])).toEqual([]);
    expect(gen('3-5', 'medium', 1, ['long', 'shift', 'euclid'])).toEqual([]);
    expect(generateLevelsForAge('6-8')).toEqual([]); // default: nothing built yet
  });

  it('falls back to 6-8 / medium for unknown age or difficulty', () => {
    const reference = gen('6-8', 'medium', 11);
    expect(
      generateLevelsForAge('12-99' as AgeGroup, 'extreme' as Difficulty, seeded(11), ALL_MODES)
    ).toEqual(reference);
  });

  it('survives a misbehaving random source', () => {
    for (const bad of [() => Number.NaN, () => 1, () => -5, () => 0, () => 0.999999, () => Number.POSITIVE_INFINITY]) {
      for (const age of AGES) {
        for (const difficulty of DIFFICULTIES) {
          const levels = generateLevelsForAge(age, difficulty, bad, ALL_MODES);
          expect(levels).toHaveLength(EXPECTED_MODES[age][difficulty].length);
          for (const l of levels) {
            expect(isWithinLimits(l.mode, l.dividend, l.divisor)).toBe(true);
          }
        }
      }
    }
  });

  it('works with the default random source', () => {
    const levels = generateLevelsForAge('9-11', 'hard', undefined, ALL_MODES);
    expect(levels).toHaveLength(5);
    expect(parseAll(levels)).toEqual(levels);
  });
});

describe('levels.schema.json mirrors LIMITS', () => {
  const defs = schema.$defs;

  it('has the same set-level limits', () => {
    expect(defs.levelList.maxItems).toBe(LIMITS.maxLevels);
    const envelope = schema.oneOf[2] as unknown as { properties: { version: { const: number } } };
    expect(envelope.properties.version.const).toBe(SCHEMA_VERSION);
  });

  it('has one branch per mode', () => {
    const modes = [defs.facts, defs.shift, defs.euclid, defs.long].map((d) => d.properties.mode.const);
    expect(modes).toEqual([...ALL_MODES]);
    expect(defs.level.oneOf).toHaveLength(ALL_MODES.length);
  });

  it('has the same numeric bounds', () => {
    expect(defs.facts.properties.divisor).toMatchObject({ minimum: LIMITS.facts.divisorMin, maximum: LIMITS.facts.divisorMax });
    expect(defs.facts.properties.dividend).toMatchObject({ minimum: LIMITS.facts.divisorMin, maximum: LIMITS.facts.dividendMax });
    expect(defs.facts.properties.theme.enum).toEqual([...FACTS_THEMES]);

    expect(defs.shift.properties.divisor.enum).toEqual([...LIMITS.shift.divisors]);
    expect(defs.shift.properties.dividend).toMatchObject({ minimum: LIMITS.shift.dividendMin, maximum: LIMITS.shift.dividendMax });

    expect(defs.euclid.properties.divisor).toMatchObject({ minimum: LIMITS.euclid.divisorMin, maximum: LIMITS.euclid.divisorMax });
    expect(defs.euclid.properties.dividend).toMatchObject({ minimum: LIMITS.euclid.divisorMin, maximum: LIMITS.euclid.dividendMax });

    expect(defs.long.properties.divisor).toMatchObject({ minimum: LIMITS.long.divisorMin, maximum: LIMITS.long.divisorMax });
    expect(defs.long.properties.dividend).toMatchObject({ minimum: LIMITS.long.dividendMin, maximum: LIMITS.long.dividendMax });
  });

  it('states the quotient caps that JSON Schema cannot express', () => {
    expect(schema.description).toContain(`at most ${LIMITS.facts.quotientMax} in 'facts'`);
    expect(schema.description).toContain(`at most ${LIMITS.euclid.quotientMax} in 'euclid'`);
  });
});
