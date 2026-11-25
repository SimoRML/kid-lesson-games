import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgeGroup, Difficulty } from '../../src/core/types.js';
import {
  addViewFor,
  estimateOptions,
  generateLevelsForAge,
  LIMITS,
  parseCustomLevels,
  seededRng,
  WRITTEN_AFTER,
  type Level
} from './levels.js';
import { carryCount, carryTargets, digitCount, roundToThousand, toDigits, writtenAddition } from './numbers.js';

const AGES: AgeGroup[] = ['3-5', '6-8', '9-11'];
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

function sweep(age: AgeGroup, diff: Difficulty, runs = 60): Level[][] {
  return Array.from({ length: runs }, (_, i) => generateLevelsForAge(age, diff, seededRng(1000 + i)));
}

describe('age brackets differ in kind, not just size', () => {
  it('3-5 only counts and compares small quantities', () => {
    for (const diff of DIFFS) {
      for (const levels of sweep('3-5', diff)) {
        expect(levels.every((l) => l.mode === 'count' || l.mode === 'compare')).toBe(true);
        for (const l of levels) {
          if (l.mode === 'count') expect(l.target).toBeLessThanOrEqual(diff === 'hard' ? 15 : 9);
          if (l.mode === 'compare') expect(Math.max(...l.values)).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('3-5 easy keeps quantities to 5 with a visible gap; hard meets ten', () => {
    for (const levels of sweep('3-5', 'easy')) {
      for (const l of levels) {
        if (l.mode === 'count') expect(l.target).toBeLessThanOrEqual(5);
        if (l.mode === 'compare') expect(Math.abs(l.values[0] - l.values[1])).toBeGreaterThanOrEqual(2);
      }
    }
    for (const levels of sweep('3-5', 'hard')) {
      expect(levels.some((l) => l.mode === 'count' && l.target > 10)).toBe(true);
    }
  });

  it('6-8 additions always force at least one carry (anti-mirroring)', () => {
    for (const diff of DIFFS) {
      for (const levels of sweep('6-8', diff)) {
        const adds = levels.filter((l) => l.mode === 'add');
        expect(adds.length).toBeGreaterThanOrEqual(3);
        for (const l of adds) {
          expect(carryCount(l.terms)).toBeGreaterThanOrEqual(1);
          expect(l.view).toBe('physical');
        }
      }
    }
  });

  it('6-8 compare jars: more loose candies but fewer in total', () => {
    for (const levels of sweep('6-8', 'medium')) {
      for (const l of levels) {
        if (l.mode !== 'compare') continue;
        const [a, b] = l.values;
        const big = Math.max(a, b);
        const small = Math.min(a, b);
        expect(small % 10).toBeGreaterThan(big % 10);
        expect(Math.floor(big / 10)).toBeGreaterThan(Math.floor(small / 10));
      }
    }
  });

  it('9-11 mixes written addition, mystery digits, robot errors and estimation', () => {
    for (const levels of sweep('9-11', 'medium')) {
      const modes = new Set(levels.map((l) => l.mode));
      for (const m of ['add', 'mystery', 'robot', 'estimate']) expect(modes.has(m as Level['mode'])).toBe(true);
      expect(levels.some((l) => l.mode === 'add' && l.story === 'bill')).toBe(true);
      expect(levels.some((l) => l.mode === 'add' && l.terms.length === 3)).toBe(true);
    }
  });

  it('difficulty changes number size at 9-11', () => {
    const easy = sweep('9-11', 'easy')[0].find((l) => l.mode === 'add');
    const hard = sweep('9-11', 'hard')[0].find((l) => l.mode === 'add');
    expect(easy && digitCount(easy.terms[0])).toBe(3);
    expect(hard && digitCount(hard.terms[0])).toBe(4);
  });
});

describe('every generated puzzle is solvable', () => {
  it('holds across all ages, difficulties and many seeds', () => {
    for (const age of AGES) {
      for (const diff of DIFFS) {
        for (const levels of sweep(age, diff)) {
          expect(levels.length).toBeGreaterThan(0);
          for (const l of levels) {
            switch (l.mode) {
              case 'count':
                expect(l.target).toBeGreaterThanOrEqual(1);
                break;
              case 'compare':
                expect(l.values[0]).not.toBe(l.values[1]);
                break;
              case 'add': {
                const sum = l.terms.reduce((a, b) => a + b, 0);
                // Hand-packed levels fit the four physical columns.
                if (addViewFor(l, age, 0) === 'physical') expect(digitCount(sum)).toBeLessThanOrEqual(4);
                break;
              }
              case 'mystery': {
                const width = digitCount(l.terms[l.term]);
                expect(l.column).toBeLessThan(width);
                const hidden = toDigits(l.terms[l.term])[l.column];
                // Never hide a leading zero (it would not be written).
                if (l.column === width - 1) expect(hidden).not.toBe(0);
                break;
              }
              case 'robot': {
                expect(carryTargets(l.terms)).toContain(l.column);
                expect(l.column).toBeLessThan(writtenAddition(l.terms).termColumns);
                expect(toDigits(writtenAddition(l.terms).sum)[l.column]).toBeGreaterThan(0);
                break;
              }
              case 'estimate': {
                const sum = l.terms.reduce((a, b) => a + b, 0);
                const { answer, options } = estimateOptions(l.terms);
                expect(options).toContain(answer);
                expect(new Set(options).size).toBe(3);
                expect(answer).toBe(roundToThousand(sum));
                // Rounding each order gives the same truck: no ambiguity.
                expect(l.terms.reduce((a, t) => a + roundToThousand(t), 0)).toBe(answer);
                break;
              }
            }
          }
        }
      }
    }
  });

  it('a mystery digit is uniquely determined', () => {
    for (const levels of sweep('9-11', 'hard')) {
      for (const l of levels) {
        if (l.mode !== 'mystery') continue;
        const sum = l.terms.reduce((a, b) => a + b, 0);
        const hidden = toDigits(l.terms[l.term])[l.column];
        let matches = 0;
        for (let d = 0; d <= 9; d++) {
          const changed = l.terms[l.term] + (d - hidden) * 10 ** l.column;
          const terms = l.terms.map((t, i) => (i === l.term ? changed : t));
          // The visible sum digits must match; only the true digit does.
          const s = terms.reduce((a, b) => a + b, 0);
          if (s === sum) matches++;
        }
        expect(matches).toBe(1);
      }
    }
  });
});

describe('auto written mode', () => {
  const level = { mode: 'add' as const, terms: [2458, 3795] };

  it('9-11 switches to written after WRITTEN_AFTER physical orders', () => {
    expect(addViewFor(level, '9-11', 0)).toBe('physical');
    expect(addViewFor(level, '9-11', WRITTEN_AFTER - 1)).toBe('physical');
    expect(addViewFor(level, '9-11', WRITTEN_AFTER)).toBe('written');
  });

  it('younger children stay physical; a forced view wins', () => {
    expect(addViewFor(level, '6-8', 10)).toBe('physical');
    expect(addViewFor({ ...level, view: 'written' }, '6-8', 0)).toBe('written');
    expect(addViewFor({ ...level, view: 'physical' }, '9-11', 10)).toBe('physical');
  });

  it('sums over four digits are always written (no fifth physical column)', () => {
    expect(addViewFor({ mode: 'add', terms: [9999, 9999], view: 'physical' }, '6-8', 0)).toBe('written');
  });
});

describe('parseCustomLevels (hostile input)', () => {
  it('rejects non-arrays, empty arrays and junk', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, [], [{}], [{ mode: 'boom' }], '{"x":1}', '[]']) {
      expect(parseCustomLevels(bad)).toBeNull();
    }
  });

  it('rejects NaN, Infinity, floats, negatives and out-of-range values', () => {
    expect(parseCustomLevels([{ mode: 'count', target: NaN }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'count', target: Infinity }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'count', target: 2.5 }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'count', target: 99 }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'add', terms: [-5, 3] }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'add', terms: [10000, 3] }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'add', terms: [1] }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'add', terms: [1, 2, 3, 4] }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'compare', values: [4, 4] }])).toBeNull();
  });

  it('accepts every mode and JSON strings, skipping invalid entries', () => {
    const levels = parseCustomLevels(
      JSON.stringify([
        { mode: 'count', target: 7 },
        { mode: 'compare', values: [29, 31], ask: 'fewer' },
        { mode: 'add', terms: [2458, 3795, 1900], view: 'written', story: 'bill' },
        { mode: 'mystery', terms: [2571, 4271], term: 1, column: 2 },
        { mode: 'robot', terms: [5972, 2956] },
        { mode: 'estimate', terms: [2878, 1289] },
        { mode: 'add', terms: ['<img>', 2] }
      ])
    );
    expect(levels).not.toBeNull();
    expect(levels?.map((l) => l.mode)).toEqual(['count', 'compare', 'add', 'mystery', 'robot', 'estimate']);
    const robot = levels?.[4];
    expect(robot?.mode === 'robot' && carryTargets(robot.terms).includes(robot.column)).toBe(true);
  });

  it('rejects a robot level whose additions need no carry or a non-carry column', () => {
    expect(parseCustomLevels([{ mode: 'robot', terms: [1234, 4321] }])).toBeNull();
    expect(parseCustomLevels([{ mode: 'robot', terms: [5972, 2956], column: 0 }])).toBeNull();
  });

  it('caps the level count and the raw string size', () => {
    const many = Array.from({ length: 500 }, () => ({ mode: 'count', target: 3 }));
    expect(parseCustomLevels(many)?.length).toBe(LIMITS.maxLevels);
    expect(parseCustomLevels('x'.repeat(60_000))).toBeNull();
  });
});

describe('playground presets (index.html)', () => {
  for (const name of ['textbook', 'written']) {
    it(`the ${name} preset parses fully, in order`, () => {
      const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
      const match = new RegExp(`/\\*cf-${name}-preset\\*/([\\s\\S]*?)/\\*end-cf-${name}-preset\\*/`).exec(html);
      expect(match).not.toBeNull();
      const raw = JSON.parse(match ? match[1] : '[]') as Array<{ mode: string }>;
      const parsed = parseCustomLevels(raw);
      expect(parsed?.map((l) => l.mode)).toEqual(raw.map((l) => l.mode));
    });
  }
});
