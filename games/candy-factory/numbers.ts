/**
 * Place-value maths for the Candy Factory. Pure module: no DOM access.
 *
 * The factory's units are the base-ten place values:
 *   column 0 = candies (units), 1 = bags (tens), 2 = boxes (hundreds), 3 = crates (thousands).
 * "Packing" 10 items of one column into 1 item of the next is exactly the carry
 * of written column addition.
 */

/** Highest column the physical factory can show (crates = thousands). */
export const MAX_PHYSICAL_COLUMNS = 4;
/** Items of one column that make one item of the next column. */
export const PACK_SIZE = 10;

/** Digits of a non-negative integer, least significant first, padded to `minLength`. */
export function toDigits(n: number, minLength = 1): number[] {
  const value = Math.max(0, Math.floor(n));
  const digits: number[] = [];
  let rest = value;
  do {
    digits.push(rest % 10);
    rest = Math.floor(rest / 10);
  } while (rest > 0);
  while (digits.length < minLength) digits.push(0);
  return digits;
}

/** Number of decimal digits of a non-negative integer (0 has one digit). */
export function digitCount(n: number): number {
  return toDigits(n).length;
}

/** Value of per-column counts (counts may exceed 9 before packing). */
export function valueOf(counts: readonly number[]): number {
  let total = 0;
  for (let i = counts.length - 1; i >= 0; i--) total = total * 10 + counts[i];
  return total;
}

/**
 * The raw column totals when all terms are poured into the factory at once,
 * before any packing: column c holds the sum of the terms' c-th digits.
 */
export function columnSums(terms: readonly number[], columns: number): number[] {
  const sums = new Array<number>(columns).fill(0);
  for (const term of terms) {
    const digits = toDigits(term, columns);
    for (let c = 0; c < columns; c++) sums[c] += digits[c] ?? 0;
  }
  return sums;
}

/** True when the column holds enough items to fill the packing machine. */
export function canPack(counts: readonly number[], column: number): boolean {
  return column >= 0 && column < counts.length - 1 && counts[column] >= PACK_SIZE;
}

/** Packs 10 items of `column` into 1 item of the next column. Returns a new array. */
export function pack(counts: readonly number[], column: number): number[] {
  if (!canPack(counts, column)) return counts.slice();
  const next = counts.slice();
  next[column] -= PACK_SIZE;
  next[column + 1] += 1;
  return next;
}

/** Every column below 10: the shipment is packed compactly (no carry left). */
export function isCompact(counts: readonly number[]): boolean {
  return counts.every((c) => c < PACK_SIZE);
}

/** Packs everything, lowest column first. Used by tests and as the reference answer. */
export function packAll(counts: readonly number[]): number[] {
  let next = counts.slice();
  for (let c = 0; c < next.length - 1; c++) {
    while (canPack(next, c)) next = pack(next, c);
  }
  return next;
}

/** One column of the written algorithm, right to left. */
export interface WrittenStep {
  column: number;
  /** Digits of every term in this column (0 where a term is shorter). */
  digits: number[];
  carryIn: number;
  /** digits + carryIn */
  total: number;
  /** The digit written under the line. */
  resultDigit: number;
  carryOut: number;
}

/** The full written column addition: every step plus the result digits. */
export interface WrittenAddition {
  sum: number;
  /** Columns spanned by the terms. */
  termColumns: number;
  /** Columns of the result (one more than termColumns when the last step carries). */
  resultColumns: number;
  steps: WrittenStep[];
  /** carries[c] = carry written above column c (carries[0] is always 0). */
  carries: number[];
}

export function writtenAddition(terms: readonly number[]): WrittenAddition {
  const termColumns = Math.max(1, ...terms.map(digitCount));
  const steps: WrittenStep[] = [];
  const carries: number[] = [0];
  let carry = 0;
  for (let c = 0; c < termColumns; c++) {
    const digits = terms.map((t) => toDigits(t, termColumns)[c]);
    const total = digits.reduce((a, b) => a + b, 0) + carry;
    const step: WrittenStep = {
      column: c,
      digits,
      carryIn: carry,
      total,
      resultDigit: total % 10,
      carryOut: Math.floor(total / 10)
    };
    steps.push(step);
    carry = step.carryOut;
    carries.push(carry);
  }
  const sum = terms.reduce((a, b) => a + b, 0);
  const resultColumns = digitCount(sum);
  // carries has termColumns + 1 entries; trim to the result width.
  carries.length = Math.max(resultColumns, termColumns);
  return { sum, termColumns, resultColumns, steps, carries };
}

/** How many carries the written addition needs. */
export function carryCount(terms: readonly number[]): number {
  return writtenAddition(terms).steps.filter((s) => s.carryOut > 0).length;
}

/** Nearest thousand (half rounds up). */
export function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/**
 * The robot's answer: the correct sum with the digit at `column` lowered by one,
 * the trace a forgotten carry leaves. Exactly one digit differs from the real sum.
 */
export function robotAnswer(terms: readonly number[], column: number): number[] {
  const { sum, resultColumns } = writtenAddition(terms);
  const digits = toDigits(sum, resultColumns);
  digits[column] = (digits[column] + 9) % 10;
  return digits;
}

/** The columns that receive a carry: where a robot "forgets" one. */
export function carryTargets(terms: readonly number[]): number[] {
  const { carries } = writtenAddition(terms);
  const out: number[] = [];
  carries.forEach((c, i) => {
    if (c > 0) out.push(i);
  });
  return out;
}
