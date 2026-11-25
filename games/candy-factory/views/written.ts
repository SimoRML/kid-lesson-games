/**
 * Written column views (ages 9-11 after the auto switch, or forced by a level):
 *
 *  - WrittenAddView:  the child works right to left, types each result digit
 *                     and sets the carry box when a column reaches 10 or more.
 *  - MysteryView:     a torn label: one digit of a term is missing.
 *  - RobotView:       the robot's answer has one wrong digit (a forgotten carry):
 *                     tap it, then type the right digit.
 *
 * Column colours match the physical factory (candies, bags, boxes, crates), so
 * a carry box shows the little bag it stands for.
 */

import type { AddLevel, MysteryLevel, RobotLevel } from '../levels.js';
import { robotAnswer, toDigits, writtenAddition, type WrittenAddition } from '../numbers.js';
import type { Dictionary } from '../i18n.js';
import { bindKeyboard, button, el, item, keypad, swapContent, type KeypadOptions } from './dom.js';
import type { View, ViewHost } from './types.js';

type Cell = (column: number) => Node | null;

/** One grid row: an operator cell then the columns, highest place value first. */
function row(grid: HTMLElement, width: number, op: string, cell: Cell, className = ''): void {
  grid.appendChild(el('span', `cf-w-op ${className}`.trim(), op));
  for (let c = width - 1; c >= 0; c--) {
    const slot = el('span', `cf-w-cell cf-place-${Math.min(c, 4)} ${className}`.trim());
    const content = cell(c);
    if (content) slot.appendChild(content);
    grid.appendChild(slot);
  }
}

function digitText(d: number, place: number): HTMLElement {
  return el('span', `cf-w-digit cf-place-${Math.min(place, 4)}`, String(d));
}

interface GridOptions {
  t: Dictionary;
  terms: readonly number[];
  width: number;
  /** Optional per-term override of one digit cell (mystery). */
  termCell?: (term: number, column: number) => Node | null;
  carryCell?: Cell;
  resultCell: Cell;
}

function buildGrid(o: GridOptions): HTMLElement {
  const grid = el('div', 'cf-written');
  grid.style.gridTemplateColumns = `2rem repeat(${o.width}, minmax(2.4rem, 3.2rem))`;
  grid.setAttribute('role', 'group');
  row(grid, o.width, '', (c) => el('span', 'cf-w-head', o.t.colLetter(c)), 'cf-w-header');
  if (o.carryCell) row(grid, o.width, '', o.carryCell, 'cf-w-carry-row');
  o.terms.forEach((term, i) => {
    const digits = toDigits(term);
    row(grid, o.width, i === 0 ? '' : '+', (c) => {
      const custom = o.termCell?.(i, c);
      if (custom) return custom;
      return c < digits.length ? digitText(digits[c], c) : null;
    });
  });
  const rule = el('div', 'cf-w-rule');
  rule.style.gridColumn = `1 / span ${o.width + 1}`;
  grid.appendChild(rule);
  row(grid, o.width, '=', o.resultCell, 'cf-w-result-row');
  return grid;
}

/** Bill card (shop story): items and prices in dirhams, total unknown. */
function billCard(t: Dictionary, terms: readonly number[], fmt: (n: number) => string): HTMLElement {
  const card = el('div', 'cf-bill');
  card.appendChild(el('div', 'cf-bill-title', `🧾 ${t.bill}`));
  terms.forEach((term, i) => {
    const line = el('div', 'cf-bill-line');
    line.append(el('span', '', t.items[i % t.items.length]), el('span', '', `${fmt(term)} ${t.currency}`));
    card.appendChild(line);
  });
  const total = el('div', 'cf-bill-line cf-bill-total');
  total.append(el('span', '', t.total), el('span', '', `? ${t.currency}`));
  card.appendChild(total);
  return card;
}

abstract class KeypadView implements View {
  private keyboardBound = false;

  constructor(
    protected readonly stage: HTMLElement,
    protected readonly host: ViewHost
  ) {}

  abstract render(): void;

  protected keypadFor(onDigit: (d: number) => void): HTMLElement {
    const opts: KeypadOptions = {
      signal: this.host.signal,
      enabled: () => this.host.isActive(),
      onDigit
    };
    if (!this.keyboardBound) {
      bindKeyboard(this.stage, opts);
      this.keyboardBound = true;
    }
    return keypad(opts);
  }
}

// ---------------------------------------------------------------------------
// Written addition
// ---------------------------------------------------------------------------

export class WrittenAddView extends KeypadView {
  readonly plan: WrittenAddition;
  readonly width: number;
  /** Column being worked on (0 = units). */
  column = 0;
  /** Waiting for the child to set the carry of the column just written. */
  awaitingCarry = false;
  readonly result: Array<number | null>;
  /** carries[c] = what the child put in the carry box above column c. */
  readonly carries: number[];
  private flash = -1;

  constructor(stage: HTMLElement, private readonly level: AddLevel, host: ViewHost) {
    super(stage, host);
    this.plan = writtenAddition(level.terms);
    this.width = Math.max(this.plan.resultColumns, this.plan.termColumns);
    this.result = new Array<number | null>(this.width).fill(null);
    this.carries = new Array<number>(this.width).fill(0);
    this.render();
  }

  get done(): boolean {
    return this.column >= this.plan.resultColumns;
  }

  /** Is `column` the leading digit made only of the last carry? */
  private isCarryOnlyColumn(column: number): boolean {
    return column >= this.plan.termColumns;
  }

  private expectedDigit(column: number): number {
    if (this.isCarryOnlyColumn(column)) return this.plan.carries[column] ?? 0;
    return this.plan.steps[column].resultDigit;
  }

  private instruction(): string {
    const t = this.host.t();
    if (this.awaitingCarry) {
      return t.needCarry(this.host.fmt(this.plan.steps[this.column].total));
    }
    if (this.isCarryOnlyColumn(this.column)) return t.lastCarry;
    return t.writtenPrompt(t.columnName(this.column));
  }

  render(): void {
    const t = this.host.t();
    const signal = this.host.signal;
    this.host.setInstruction(this.instruction());
    const root = el('div', 'cf-written-wrap');
    if (this.level.story === 'bill') root.appendChild(billCard(t, this.level.terms, (n) => this.host.fmt(n)));

    const grid = buildGrid({
      t,
      terms: this.level.terms,
      width: this.width,
      carryCell: (c) => {
        // Carry boxes sit above columns 1 .. termColumns - 1; the final carry is written in the result.
        if (c === 0 || c >= this.plan.termColumns) return null;
        const value = this.carries[c];
        const target = this.awaitingCarry && c === this.column + 1;
        const box = button(
          `cf-carry${value > 0 ? ' cf-carry-set' : ''}${target ? ' cf-target' : ''}`,
          value > 0 ? String(value) : '',
          t.carryBox(t.columnName(c))
        );
        box.dataset.key = `carry-${c}`;
        if (value > 0) box.appendChild(item(Math.min(c, 3), 'cf-carry-icon'));
        box.disabled = c !== this.column + 1 || this.done;
        box.addEventListener('click', () => this.host.isActive() && this.tapCarry(c), { signal });
        return box;
      },
      resultCell: (c) => {
        const value = this.result[c];
        const active = c === this.column && !this.awaitingCarry && !this.done;
        const slot = el(
          'span',
          `cf-w-slot${active ? ' cf-active' : ''}${this.flash === c ? ' cf-shake' : ''}`,
          value === null ? (active ? '?' : '') : String(value)
        );
        return slot;
      }
    });
    root.appendChild(grid);
    root.appendChild(this.keypadFor((d) => this.typeDigit(d)));
    this.flash = -1;
    swapContent(this.stage, root);
  }

  typeDigit(d: number): void {
    if (this.done || this.awaitingCarry) {
      if (this.awaitingCarry) this.host.audio.playError();
      return;
    }
    const t = this.host.t();
    if (d !== this.expectedDigit(this.column)) {
      this.host.audio.playError();
      this.host.mistake();
      this.flash = this.column;
      this.render();
      this.host.setInstruction(t.writtenWrong(t.columnName(this.column)));
      return;
    }
    this.result[this.column] = d;
    this.host.audio.playClick();
    if (this.isCarryOnlyColumn(this.column)) {
      this.column++;
      this.finishIfDone();
      return;
    }
    const step = this.plan.steps[this.column];
    const needsBox = step.carryOut > 0 && this.column + 1 < this.plan.termColumns;
    if (needsBox && this.carries[this.column + 1] !== step.carryOut) {
      this.awaitingCarry = true;
      this.host.audio.playPop();
      this.render();
      return;
    }
    this.column++;
    this.finishIfDone();
  }

  tapCarry(c: number): void {
    if (this.done || c !== this.column + 1) return;
    const t = this.host.t();
    const step = this.plan.steps[this.column];
    const next = this.carries[c] + 1;
    if (next > step.carryOut) {
      // No carry here, or one too many: gentle error, the box empties.
      this.carries[c] = 0;
      this.host.audio.playError();
      this.host.mistake();
      this.render();
      this.host.setInstruction(step.carryOut === 0 ? t.noCarry : t.needCarry(this.host.fmt(step.total)));
      return;
    }
    this.carries[c] = next;
    this.host.audio.playPop();
    if (this.awaitingCarry && next === step.carryOut) {
      this.awaitingCarry = false;
      this.column++;
      this.finishIfDone();
      return;
    }
    this.render();
  }

  private finishIfDone(): void {
    this.render();
    if (this.done) {
      this.host.audio.playDrop();
      this.host.solved();
    }
  }
}

// ---------------------------------------------------------------------------
// Mystery digit (torn label)
// ---------------------------------------------------------------------------

export class MysteryView extends KeypadView {
  readonly answer: number;
  private found = false;
  private flash = false;

  constructor(stage: HTMLElement, private readonly level: MysteryLevel, host: ViewHost) {
    super(stage, host);
    this.answer = toDigits(level.terms[level.term])[level.column];
    this.render();
  }

  render(): void {
    const t = this.host.t();
    this.host.setInstruction(t.mysteryPrompt);
    const plan = writtenAddition(this.level.terms);
    const width = Math.max(plan.resultColumns, plan.termColumns);
    const sumDigits = toDigits(plan.sum);
    const root = el('div', 'cf-written-wrap');
    root.appendChild(el('div', 'cf-story', '🏷️✂️'));
    const grid = buildGrid({
      t,
      terms: this.level.terms,
      width,
      termCell: (term, c) => {
        if (term !== this.level.term || c !== this.level.column) return null;
        return el(
          'span',
          `cf-w-slot cf-torn${this.found ? '' : ' cf-active'}${this.flash ? ' cf-shake' : ''}`,
          this.found ? String(this.answer) : '?'
        );
      },
      resultCell: (c) => (c < sumDigits.length ? digitText(sumDigits[c], c) : null)
    });
    root.append(grid, this.keypadFor((d) => this.typeDigit(d)));
    this.flash = false;
    swapContent(this.stage, root);
  }

  typeDigit(d: number): void {
    if (this.found) return;
    if (d === this.answer) {
      this.found = true;
      this.host.audio.playChime();
      this.render();
      this.host.solved();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.flash = true;
    this.render();
    this.host.setInstruction(this.host.t().mysteryWrong);
  }
}

// ---------------------------------------------------------------------------
// Robot packer error
// ---------------------------------------------------------------------------

export class RobotView extends KeypadView {
  phase: 'find' | 'fix' | 'fixed' = 'find';
  readonly robotDigits: number[];
  readonly correct: number[];
  private flash = -1;

  constructor(stage: HTMLElement, private readonly level: RobotLevel, host: ViewHost) {
    super(stage, host);
    const plan = writtenAddition(level.terms);
    this.correct = toDigits(plan.sum, plan.resultColumns);
    this.robotDigits = robotAnswer(level.terms, level.column);
    this.render();
  }

  render(): void {
    const t = this.host.t();
    const signal = this.host.signal;
    this.host.setInstruction(this.phase === 'find' ? t.robotPrompt : t.robotFix);
    const width = this.correct.length;
    const root = el('div', 'cf-written-wrap');
    root.appendChild(el('div', 'cf-story cf-robot', '🤖'));
    const grid = buildGrid({
      t,
      terms: this.level.terms,
      width: Math.max(width, ...this.level.terms.map((n) => toDigits(n).length)),
      resultCell: (c) => {
        if (c >= width) return null;
        const isTarget = c === this.level.column;
        const shown = isTarget && this.phase === 'fixed' ? this.correct[c] : this.robotDigits[c];
        const digit = button(
          `cf-w-pick cf-place-${Math.min(c, 4)}${isTarget && this.phase === 'fix' ? ' cf-wrong cf-active' : ''}${this.flash === c ? ' cf-shake' : ''}`,
          isTarget && this.phase === 'fix' ? '?' : String(shown),
          `${t.columnName(c)}: ${shown}`
        );
        digit.dataset.key = `pick-${c}`;
        digit.disabled = this.phase !== 'find';
        digit.addEventListener('click', () => this.host.isActive() && this.pick(c), { signal });
        return digit;
      }
    });
    root.appendChild(grid);
    if (this.phase === 'fix') root.appendChild(this.keypadFor((d) => this.typeDigit(d)));
    this.flash = -1;
    swapContent(this.stage, root);
  }

  pick(c: number): void {
    if (this.phase !== 'find') return;
    if (c === this.level.column) {
      this.phase = 'fix';
      this.host.audio.playPop();
      this.render();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.flash = c;
    this.render();
    this.host.setInstruction(this.host.t().robotRight);
  }

  typeDigit(d: number): void {
    if (this.phase !== 'fix') return;
    if (d === this.correct[this.level.column]) {
      this.phase = 'fixed';
      this.host.audio.playChime();
      this.render();
      this.host.solved();
      return;
    }
    this.host.audio.playError();
    this.host.mistake();
    this.render();
    this.host.setInstruction(this.host.t().robotWrongFix);
  }
}
