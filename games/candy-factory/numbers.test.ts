import { describe, expect, it } from 'vitest';
import {
  canPack,
  carryCount,
  carryTargets,
  columnSums,
  digitCount,
  isCompact,
  pack,
  packAll,
  robotAnswer,
  roundToThousand,
  toDigits,
  valueOf,
  writtenAddition
} from './numbers.js';
import { seededRng } from './levels.js';

describe('place-value helpers', () => {
  it('splits numbers into digits, units first', () => {
    expect(toDigits(0)).toEqual([0]);
    expect(toDigits(2458)).toEqual([8, 5, 4, 2]);
    expect(toDigits(7, 3)).toEqual([7, 0, 0]);
    expect(digitCount(9999)).toBe(4);
    expect(digitCount(10000)).toBe(5);
  });

  it('values un-packed columns correctly (counts may exceed 9)', () => {
    expect(valueOf([12, 3])).toBe(42);
    expect(valueOf([0, 0, 1])).toBe(100);
  });

  it('pours orders into raw column sums', () => {
    // 27 + 15: 3 bags and 12 candies on the belt.
    expect(columnSums([27, 15], 2)).toEqual([12, 3]);
    expect(columnSums([2458, 3795, 1900], 4)).toEqual([13, 14, 20, 6]);
  });
});

describe('packing = carrying', () => {
  it('packs 10 items into 1 of the next column, keeping the value', () => {
    const counts = [12, 3];
    expect(canPack(counts, 0)).toBe(true);
    const packed = pack(counts, 0);
    expect(packed).toEqual([2, 4]);
    expect(valueOf(packed)).toBe(valueOf(counts));
    expect(isCompact(packed)).toBe(true);
  });

  it('never packs the last column or a column below 10', () => {
    expect(canPack([9, 1], 0)).toBe(false);
    expect(canPack([0, 12], 1)).toBe(false);
    expect(pack([9, 1], 0)).toEqual([9, 1]);
  });

  it('packAll gives the digits of the sum for many random orders', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 300; i++) {
      const terms = [1 + Math.floor(rng() * 9999), 1 + Math.floor(rng() * 9999), 1 + Math.floor(rng() * 999)];
      const sum = terms.reduce((a, b) => a + b, 0);
      const cols = digitCount(sum);
      expect(packAll(columnSums(terms, cols))).toEqual(toDigits(sum, cols));
    }
  });
});

describe('written column addition', () => {
  it('reproduces the textbook example 5 684 + 2 473 + 98', () => {
    const w = writtenAddition([5684, 2473, 98]);
    expect(w.sum).toBe(8255);
    expect(w.steps.map((s) => s.resultDigit)).toEqual([5, 5, 2, 8]);
    expect(w.steps.map((s) => s.carryOut)).toEqual([1, 2, 1, 0]);
    expect(w.carries).toEqual([0, 1, 2, 1]);
  });

  it('adds a leading result column for a final carry', () => {
    const w = writtenAddition([958, 67]);
    expect(w.sum).toBe(1025);
    expect(w.termColumns).toBe(3);
    expect(w.resultColumns).toBe(4);
    expect(w.carries[3]).toBe(1);
  });

  it('counts carries', () => {
    expect(carryCount([12, 13])).toBe(0);
    expect(carryCount([27, 15])).toBe(1);
    expect(carryCount([999, 1])).toBe(3);
  });

  it('result digits always rebuild the sum', () => {
    const rng = seededRng(11);
    for (let i = 0; i < 300; i++) {
      const terms = [1 + Math.floor(rng() * 9999), 1 + Math.floor(rng() * 9999)];
      const w = writtenAddition(terms);
      const digits = w.steps.map((s) => s.resultDigit);
      if (w.resultColumns > w.termColumns) digits.push(w.carries[w.termColumns]);
      expect(valueOf(digits)).toBe(w.sum);
    }
  });
});

describe('estimation and robot errors', () => {
  it('rounds to the nearest thousand', () => {
    expect(roundToThousand(4167)).toBe(4000);
    expect(roundToThousand(4500)).toBe(5000);
    expect(roundToThousand(499)).toBe(0);
  });

  it('a robot answer differs from the sum in exactly one digit', () => {
    const terms = [2583, 4576];
    const targets = carryTargets(terms);
    expect(targets.length).toBeGreaterThan(0);
    for (const column of targets) {
      const wrong = robotAnswer(terms, column);
      const right = toDigits(7159, wrong.length);
      const diffs = wrong.filter((d, i) => d !== right[i]).length;
      expect(diffs).toBe(1);
      expect(wrong[column]).toBe((right[column] + 9) % 10);
    }
  });
});
