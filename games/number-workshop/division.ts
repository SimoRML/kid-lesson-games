/**
 * Pure division maths for the number-workshop cartridge.
 * No DOM, no randomness, no imports from the rest of the cartridge.
 *
 * Everything rests on one statement: for integers a >= 0 and b >= 1 there is
 * exactly one pair (q, r) with a = b * q + r and 0 <= r < b.
 */

export interface DivisionResult {
  /** Quotient. */
  q: number;
  /** Remainder, always 0 <= r < divisor. */
  r: number;
}

export type ShiftDivisor = 10 | 100 | 1000;

export interface LongStep {
  /** Partial dividend examined in this step. */
  partial: number;
  /** Quotient digit found in this step, 0-9. */
  digit: number;
  /** digit * divisor. */
  product: number;
  /** partial - product, always 0 <= remainder < divisor. */
  remainder: number;
  /** Dividend digit brought down to form `partial`; null on the first step. */
  broughtDown: number | null;
}

function assertOperands(a: number, b: number): void {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 1) {
    throw new RangeError('division operands must be integers with a >= 0 and b >= 1');
  }
}

/** Euclidean division of a by b. Callers pass validated integers (a >= 0, b >= 1). */
export function divide(a: number, b: number): DivisionResult {
  assertOperands(a, b);
  const r = a % b;
  return { q: (a - r) / b, r };
}

export function isShiftDivisor(b: number): b is ShiftDivisor {
  return b === 10 || b === 100 || b === 1000;
}

/** True when b is 10, 100 or 1000 and a is a non-negative integer multiple of b. */
export function isExactShift(a: number, b: number): boolean {
  return Number.isSafeInteger(a) && a >= 0 && isShiftDivisor(b) && a % b === 0;
}

/** Number of one-place shifts to the right that dividing by b represents. */
export function shiftCount(b: ShiftDivisor): 1 | 2 | 3 {
  if (b === 10) return 1;
  if (b === 100) return 2;
  return 3;
}

/**
 * Steps of written long division of a by b.
 *
 * The first partial dividend takes as many leading digits as needed to reach
 * at least b (or all the digits). After that there is one step per remaining
 * dividend digit, including steps whose quotient digit is 0. The digits of
 * all steps, concatenated, are the quotient; the last remainder is the
 * remainder of the whole division.
 */
export function longDivisionTrace(a: number, b: number): LongStep[] {
  assertOperands(a, b);
  const digits = String(a).split('').map(Number);
  const steps: LongStep[] = [];
  let current = 0;

  for (let i = 0; i < digits.length; i++) {
    current = current * 10 + digits[i];
    const isLastDigit = i === digits.length - 1;
    if (steps.length === 0 && current < b && !isLastDigit) {
      continue;
    }
    const digit = Math.floor(current / b);
    const product = digit * b;
    const remainder = current - product;
    steps.push({
      partial: current,
      digit,
      product,
      remainder,
      broughtDown: steps.length === 0 ? null : digits[i]
    });
    current = remainder;
  }

  return steps;
}
