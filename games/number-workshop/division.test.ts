import { describe, expect, it } from 'vitest';
import {
  divide,
  isExactShift,
  isShiftDivisor,
  longDivisionTrace,
  shiftCount,
  type LongStep
} from './division.js';

// Golden values from docs/design/number-workshop/05-test-plan.md (hard-coded on purpose).
const GOLDEN: Array<[a: number, b: number, q: number, r: number]> = [
  // shift block
  [60000, 100, 600, 0],
  [5000, 10, 500, 0],
  [10, 10, 1, 0],
  [200, 100, 2, 0],
  [3400, 100, 34, 0],
  [789000, 1000, 789, 0],
  // facts block
  [27, 3, 9, 0],
  [42, 7, 6, 0],
  [64, 8, 8, 0],
  [48, 6, 8, 0],
  [16, 4, 4, 0],
  [36, 6, 6, 0],
  [63, 7, 9, 0],
  [25, 5, 5, 0],
  // euclid block
  [78, 8, 9, 6],
  [57, 7, 8, 1],
  [59, 9, 6, 5],
  [39, 4, 9, 3],
  [22, 3, 7, 1],
  [47, 8, 5, 7],
  [98, 8, 12, 2],
  [75, 5, 15, 0],
  [59, 4, 14, 3],
  // long block
  [806, 5, 161, 1],
  [568, 8, 71, 0]
];

type StepTuple = [partial: number, digit: number, product: number, remainder: number];

function tuples(steps: LongStep[]): StepTuple[] {
  return steps.map((s) => [s.partial, s.digit, s.product, s.remainder]);
}

describe('divide', () => {
  it.each(GOLDEN)('%i ÷ %i = %i remainder %i', (a, b, q, r) => {
    expect(divide(a, b)).toEqual({ q, r });
  });

  it('satisfies a = b*q + r with 0 <= r < b over a sweep', () => {
    for (let b = 1; b <= 12; b++) {
      for (let a = 0; a <= 500; a++) {
        const { q, r } = divide(a, b);
        expect(b * q + r).toBe(a);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(b);
        expect(Number.isInteger(q)).toBe(true);
      }
    }
  });

  it('rejects operands that are not valid for Euclidean division', () => {
    expect(() => divide(10, 0)).toThrow(RangeError);
    expect(() => divide(-1, 2)).toThrow(RangeError);
    expect(() => divide(1.5, 2)).toThrow(RangeError);
    expect(() => divide(10, Number.NaN)).toThrow(RangeError);
    expect(() => divide(Number.POSITIVE_INFINITY, 2)).toThrow(RangeError);
  });
});

describe('shift helpers', () => {
  it('accepts the six sheet items', () => {
    expect(isExactShift(60000, 100)).toBe(true);
    expect(isExactShift(5000, 10)).toBe(true);
    expect(isExactShift(10, 10)).toBe(true);
    expect(isExactShift(200, 100)).toBe(true);
    expect(isExactShift(3400, 100)).toBe(true);
    expect(isExactShift(789000, 1000)).toBe(true);
  });

  it('rejects inexact shifts and other divisors', () => {
    expect(isExactShift(3400, 1000)).toBe(false);
    expect(isExactShift(34, 10)).toBe(false);
    expect(isExactShift(100, 20)).toBe(false);
    expect(isExactShift(100, 1)).toBe(false);
    expect(isExactShift(100, 10000)).toBe(false);
    expect(isExactShift(-100, 10)).toBe(false);
    expect(isExactShift(10.5, 10)).toBe(false);
  });

  it('knows the shift divisors and their slide counts', () => {
    expect(isShiftDivisor(10)).toBe(true);
    expect(isShiftDivisor(100)).toBe(true);
    expect(isShiftDivisor(1000)).toBe(true);
    expect(isShiftDivisor(50)).toBe(false);
    expect(shiftCount(10)).toBe(1);
    expect(shiftCount(100)).toBe(2);
    expect(shiftCount(1000)).toBe(3);
  });
});

describe('longDivisionTrace', () => {
  it('806 ÷ 5: plain case with a remainder', () => {
    const steps = longDivisionTrace(806, 5);
    expect(tuples(steps)).toEqual([
      [8, 1, 5, 3],
      [30, 6, 30, 0],
      [6, 1, 5, 1]
    ]);
    expect(steps.map((s) => s.broughtDown)).toEqual([null, 0, 6]);
  });

  it('568 ÷ 8: first digit smaller than the divisor', () => {
    const steps = longDivisionTrace(568, 8);
    expect(tuples(steps)).toEqual([
      [56, 7, 56, 0],
      [8, 1, 8, 0]
    ]);
    expect(steps.map((s) => s.broughtDown)).toEqual([null, 8]);
  });

  it('816 ÷ 8: zero inside the quotient is a full step', () => {
    expect(tuples(longDivisionTrace(816, 8))).toEqual([
      [8, 1, 8, 0],
      [1, 0, 0, 1],
      [16, 2, 16, 0]
    ]);
  });

  it('100 ÷ 7: zeros in the dividend, remainder', () => {
    expect(tuples(longDivisionTrace(100, 7))).toEqual([
      [10, 1, 7, 3],
      [30, 4, 28, 2]
    ]);
  });

  it('handles a dividend smaller than the divisor as a single zero step', () => {
    expect(tuples(longDivisionTrace(3, 5))).toEqual([[3, 0, 0, 3]]);
    expect(tuples(longDivisionTrace(0, 5))).toEqual([[0, 0, 0, 0]]);
  });

  it('is consistent with divide over a sweep of long-legal inputs', () => {
    const failures: string[] = [];
    for (let b = 2; b <= 9; b++) {
      for (let a = 10; a <= 9999; a++) {
        const steps = longDivisionTrace(a, b);
        const { q, r } = divide(a, b);
        const stepsOk = steps.every(
          (s) =>
            s.digit >= 0 &&
            s.digit <= 9 &&
            s.product === s.digit * b &&
            s.remainder === s.partial - s.product &&
            s.remainder >= 0 &&
            s.remainder < b
        );
        const ok =
          stepsOk &&
          Number(steps.map((s) => s.digit).join('')) === q &&
          steps[steps.length - 1].remainder === r &&
          steps[0].broughtDown === null;
        if (!ok) failures.push(`${a} ÷ ${b}`);
      }
    }
    // One assertion for the whole sweep keeps it fast.
    expect(failures).toEqual([]);
  });

  it('rejects invalid operands', () => {
    expect(() => longDivisionTrace(10, 0)).toThrow(RangeError);
    expect(() => longDivisionTrace(-5, 2)).toThrow(RangeError);
  });
});
