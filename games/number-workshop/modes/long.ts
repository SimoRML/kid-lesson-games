/**
 * `long` mode: the written algorithm, in the French "potence" layout
 * (dividend on the left, divisor top right, quotient under the divisor).
 *
 * The cartridge computes the trace with `longDivisionTrace` and walks the
 * child through it, one step per quotient digit: divide, multiply, subtract,
 * bring down. After the last digit comes the equality step: the child writes
 * `a = (b × q) + r`. What must be typed depends on difficulty:
 *
 *   easy    quotient digit                         (product and subtraction are shown)
 *   medium  quotient digit, step remainder         (product is shown)
 *   hard    quotient digit, product, step remainder
 *
 * Spec: docs/design/number-workshop/01-pedagogy-and-modes.md §2.4
 */

import type { Difficulty } from '../../../src/core/types.js';
import { divide, longDivisionTrace, type LongStep } from '../division.js';
import type { Level } from '../levels.js';
import { createKeypad, type Keypad } from '../widgets/keypad.js';
import type { ModeController, ModeHost } from './types.js';

// ---------------------------------------------------------------------------
// Pure helpers (no DOM)
// ---------------------------------------------------------------------------

export type EntryKind = 'digit' | 'product' | 'remainder' | 'bring' | 'eqQ' | 'eqR';

export interface PlanItem {
  kind: EntryKind;
  /** Index of the trace step; 0 for the equality entries. */
  step: number;
}

/** The ordered things the child does, for a trace of `steps` steps. */
export function buildPlan(steps: number, difficulty: Difficulty): PlanItem[] {
  const plan: PlanItem[] = [];
  for (let k = 0; k < steps; k++) {
    plan.push({ kind: 'digit', step: k });
    if (difficulty === 'hard') plan.push({ kind: 'product', step: k });
    if (difficulty !== 'easy') plan.push({ kind: 'remainder', step: k });
    if (k < steps - 1) plan.push({ kind: 'bring', step: k });
  }
  plan.push({ kind: 'eqQ', step: 0 }, { kind: 'eqR', step: 0 });
  return plan;
}

export type DigitVerdict = 'ok' | 'tooBig' | 'tooSmall';
export type ProductVerdict = 'ok' | 'product';
export type RemainderVerdict = 'ok' | 'remainderBig' | 'remainder';

/** A digit is right if it is the largest that fits; others are too big or leave room for more. */
export function judgeDigit(step: LongStep, divisor: number, entered: number): DigitVerdict {
  if (entered === step.digit) return 'ok';
  return entered * divisor > step.partial ? 'tooBig' : 'tooSmall';
}

export function judgeProduct(step: LongStep, entered: number): ProductVerdict {
  return entered === step.product ? 'ok' : 'product';
}

export function judgeRemainder(step: LongStep, divisor: number, entered: number): RemainderVerdict {
  if (entered === step.remainder) return 'ok';
  return entered >= divisor ? 'remainderBig' : 'remainder';
}

/** Quotient of the whole division, from the trace digits (no leading zeros). */
export function quotientOf(trace: readonly LongStep[]): number {
  return Number(trace.map((s) => s.digit).join('') || '0');
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

const PRODUCT_DIGITS = 2; // b <= 9 and digit <= 9, so at most 81
const REMAINDER_DIGITS = 1; // remainder < b <= 9
const QUOTIENT_DIGITS = 4; // dividend <= 9999

export class LongMode implements ModeController {
  private stage!: HTMLElement;
  private host!: ModeHost;
  private a = 0;
  private b = 0;
  private trace: LongStep[] = [];
  private plan: PlanItem[] = [];
  private digits: string[] = [];
  /** Dividend digit index where step 0's partial ends. */
  private firstEnd = 0;

  private root: HTMLElement | null = null;
  private workEl: HTMLElement | null = null;
  private eqEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private okBtn: HTMLButtonElement | null = null;
  private keypad: Keypad | null = null;
  private hintText: (() => string) | null = null;

  // Progress
  private cursor = 0;
  private accDigit: Array<number | undefined> = [];
  private accProduct: Array<number | undefined> = [];
  private accRemainder: Array<number | undefined> = [];
  private accQ: number | undefined;
  private accR: number | undefined;
  private paused = false;
  private done = false;

  mount(stage: HTMLElement, level: Level, host: ModeHost): void {
    if (level.mode !== 'long') return;
    this.stage = stage;
    this.host = host;
    this.a = level.dividend;
    this.b = level.divisor;
    this.trace = longDivisionTrace(this.a, this.b);
    this.plan = buildPlan(this.trace.length, host.difficulty);
    this.digits = String(this.a).split('');
    this.firstEnd = String(this.trace[0].partial).length - 1;
    this.resetProgress();
    this.build();
  }

  private resetProgress(): void {
    this.cursor = 0;
    this.accDigit = [];
    this.accProduct = [];
    this.accRemainder = [];
    this.accQ = undefined;
    this.accR = undefined;
    this.hintText = null;
    this.done = false;
  }

  private isEnabled = (): boolean => !this.paused && !this.done;

  private fmt(n: number): string {
    return this.host.formatNumber(n);
  }

  private get current(): PlanItem | undefined {
    return this.plan[this.cursor];
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private build(): void {
    this.root?.remove();
    const root = document.createElement('div');
    root.className = 'nw-long';
    this.root = root;
    this.stage.appendChild(root);

    this.workEl = document.createElement('div');
    this.workEl.className = 'nw-potence';
    this.workEl.setAttribute('role', 'group');
    root.appendChild(this.workEl);

    this.eqEl = document.createElement('div');
    this.eqEl.className = 'nw-long-eq';
    root.appendChild(this.eqEl);

    this.keypad = createKeypad(root, {
      signal: this.host.signal,
      isEnabled: this.isEnabled,
      maxDigits: () => this.maxDigits(),
      keyTarget: this.stage,
      labels: { group: this.host.t().keypadLabel, backspace: this.host.t().backspaceLabel },
      onChange: () => {
        this.host.audio.playClick();
        this.clearHint();
        this.render();
      }
    });

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'nw-hint';
    this.hintEl.setAttribute('role', 'status');
    this.okBtn = document.createElement('button');
    this.okBtn.type = 'button';
    this.okBtn.className = 'nw-btn nw-btn-primary nw-check';
    this.okBtn.addEventListener('click', () => this.submit(), { signal: this.host.signal });
    root.append(this.hintEl, this.okBtn);

    this.render();
  }

  private maxDigits(): number {
    switch (this.current?.kind) {
      case 'product':
        return PRODUCT_DIGITS;
      case 'eqQ':
        return QUOTIENT_DIGITS;
      case 'remainder':
      case 'eqR':
        return REMAINDER_DIGITS;
      default:
        return 1;
    }
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private typed(): number | null {
    const v = this.keypad?.getValue() ?? '';
    return v === '' ? null : Number(v);
  }

  private fail(build: () => string): void {
    this.hintText = build;
    const text = build();
    if (this.hintEl) this.hintEl.textContent = text;
    this.host.setInstruction(text);
    this.host.reportMistake();
    this.host.audio.playError();
    const cls = this.host.reducedMotion ? 'nw-pulse' : 'nw-shake';
    this.root?.classList.add(cls);
    this.host.setTimeout(() => this.root?.classList.remove(cls), 450);
  }

  private clearHint(): void {
    this.hintText = null;
    if (this.hintEl) this.hintEl.textContent = '';
  }

  private advance(): void {
    this.cursor++;
    this.keypad?.setValue('');
    this.clearHint();
    this.host.audio.playChime();
    if (this.cursor >= this.plan.length) {
      this.done = true;
      this.render();
      this.host.solved();
      return;
    }
    this.render();
  }

  /** The OK button: judge what has been typed for the current entry. */
  private submit(): void {
    const item = this.current;
    if (!item || !this.isEnabled() || item.kind === 'bring') return;
    const entered = this.typed();
    if (entered === null) {
      this.hintText = () => this.host.t().longNeedEntry;
      if (this.hintEl) this.hintEl.textContent = this.hintText();
      return; // a reminder, not a mistake
    }
    const step = this.trace[item.step];
    const t = (): ReturnType<ModeHost['t']> => this.host.t();

    switch (item.kind) {
      case 'digit': {
        const verdict = judgeDigit(step, this.b, entered);
        if (verdict !== 'ok') {
          this.fail(() =>
            verdict === 'tooBig'
              ? t().longTooBig(this.fmt(entered), this.fmt(this.b), this.fmt(entered * this.b), this.fmt(step.partial))
              : t().longTooSmall(this.fmt(this.b), this.fmt(step.partial))
          );
          return;
        }
        this.accDigit[item.step] = entered;
        break;
      }
      case 'product': {
        if (judgeProduct(step, entered) !== 'ok') {
          this.fail(() => t().longProduct(this.fmt(step.digit), this.fmt(this.b)));
          return;
        }
        this.accProduct[item.step] = entered;
        break;
      }
      case 'remainder': {
        const verdict = judgeRemainder(step, this.b, entered);
        if (verdict !== 'ok') {
          this.fail(() =>
            verdict === 'remainderBig'
              ? t().longRemainderBig(this.fmt(this.b))
              : t().longRemainder(this.fmt(step.partial), this.fmt(step.product))
          );
          return;
        }
        this.accRemainder[item.step] = entered;
        break;
      }
      case 'eqQ': {
        if (entered !== quotientOf(this.trace)) {
          this.fail(() => t().longEqQ);
          return;
        }
        this.accQ = entered;
        break;
      }
      case 'eqR': {
        if (entered !== divide(this.a, this.b).r) {
          this.fail(() => t().longEqR);
          return;
        }
        this.accR = entered;
        break;
      }
    }
    this.advance();
  }

  /** Tap the highlighted dividend digit to bring it down. */
  private bringDown(): void {
    const item = this.current;
    if (!item || item.kind !== 'bring' || !this.isEnabled()) return;
    this.advance();
  }

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  private stepEnd(k: number): number {
    return this.firstEnd + k;
  }

  /** Dividend digits already consumed into a partial dividend: indexes 0..this. */
  private consumedEnd(): number {
    const brought = this.plan.slice(0, this.cursor).filter((p) => p.kind === 'bring').length;
    return this.firstEnd + brought;
  }

  private digitShown(k: number): number | undefined {
    return this.accDigit[k];
  }

  private productShown(k: number): number | undefined {
    if (this.accDigit[k] === undefined) return undefined;
    return this.host.difficulty === 'hard' ? this.accProduct[k] : this.trace[k].product;
  }

  private remainderShown(k: number): number | undefined {
    if (this.host.difficulty === 'easy') {
      return this.accDigit[k] === undefined ? undefined : this.trace[k].remainder;
    }
    return this.accRemainder[k];
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private cell(text: string, cls = ''): HTMLElement {
    const c = document.createElement('span');
    c.className = cls ? `nw-lcell ${cls}` : 'nw-lcell';
    c.textContent = text;
    return c;
  }

  /** A row of N cells (plus a sign cell) with `text` right-aligned to column `end`. */
  private numberRow(
    cls: string,
    sign: string,
    text: string,
    end: number,
    extra?: { text: string; col: number; cls?: string },
    textCls = ''
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `nw-lrow ${cls}`;
    const signEl = this.cell(sign, 'nw-lsign');
    row.appendChild(signEl);
    const n = this.digits.length;
    const start = end - text.length + 1;
    for (let c = 0; c < n; c++) {
      let t = '';
      let k = '';
      if (c >= start && c <= end) {
        t = text[c - start];
        k = textCls;
      } else if (extra && c === extra.col) {
        t = extra.text;
        k = extra.cls ?? '';
      }
      row.appendChild(this.cell(t, k));
    }
    return row;
  }

  private render(): void {
    if (!this.workEl || !this.keypad) return;
    const t = this.host.t();
    const item = this.current;
    const typed = this.keypad.getValue();
    const work = this.workEl;
    work.replaceChildren();
    work.setAttribute('aria-label', t.longWorkLabel(this.fmt(this.a), this.fmt(this.b)));

    const left = document.createElement('div');
    left.className = 'nw-lleft';
    const right = document.createElement('div');
    right.className = 'nw-lright';

    // Dividend row: leading digits of the current partial are highlighted; the next
    // digit becomes a button while bringing down.
    const divRow = document.createElement('div');
    divRow.className = 'nw-lrow nw-ldividend';
    divRow.appendChild(this.cell('', 'nw-lsign'));
    const consumed = this.consumedEnd();
    this.digits.forEach((d, i) => {
      const bringTarget = item?.kind === 'bring' && i === consumed + 1;
      if (bringTarget) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nw-lcell nw-lbring';
        btn.textContent = d;
        btn.setAttribute('aria-label', t.longBringLabel(d));
        btn.addEventListener('click', () => this.bringDown(), { signal: this.host.signal });
        divRow.appendChild(btn);
      } else {
        divRow.appendChild(this.cell(d, i <= consumed ? 'nw-lpart' : 'nw-lrest'));
      }
    });
    left.appendChild(divRow);

    const lastStep = Math.min(this.trace.length - 1, this.stepReached());
    for (let k = 0; k <= lastStep; k++) {
      const end = this.stepEnd(k);
      const prodActive = item?.kind === 'product' && item.step === k;
      const prod = this.productShown(k);
      const prodText = prodActive ? typed : prod === undefined ? '' : String(prod);
      if (this.digitShown(k) !== undefined) {
        left.appendChild(
          this.numberRow(
            'nw-lproduct',
            '−',
            prodText,
            end,
            undefined,
            prodActive ? 'nw-lactive' : this.host.difficulty === 'hard' ? '' : 'nw-lauto'
          )
        );
        const remActive = item?.kind === 'remainder' && item.step === k;
        const showRem = this.host.difficulty !== 'hard' || this.accProduct[k] !== undefined;
        if (showRem) {
          const rem = this.remainderShown(k);
          const remText = remActive ? typed : rem === undefined ? '' : String(rem);
          const broughtDone = this.plan.slice(0, this.cursor).some((p) => p.kind === 'bring' && p.step === k);
          const extra = broughtDone
            ? { text: this.digits[end + 1] ?? '', col: end + 1, cls: 'nw-lpart' }
            : undefined;
          left.appendChild(
            this.numberRow(
              'nw-lremainder',
              '',
              remText,
              end,
              extra,
              remActive ? 'nw-lactive' : this.host.difficulty === 'easy' ? 'nw-lauto' : ''
            )
          );
        }
      }
    }

    // Right: divisor on top, quotient digits under the bar.
    const divisor = document.createElement('div');
    divisor.className = 'nw-ldivisor nw-role-divisor';
    divisor.textContent = this.fmt(this.b);
    const quotient = document.createElement('div');
    quotient.className = 'nw-lquotient nw-role-quotient';
    const qDigits = this.trace.map((_, k) => this.digitShown(k)).filter((d): d is number => d !== undefined);
    quotient.textContent = qDigits.join('');
    if (item?.kind === 'digit') {
      const active = document.createElement('span');
      active.className = 'nw-lactive-digit';
      active.textContent = typed === '' ? '?' : typed;
      quotient.appendChild(active);
    }
    right.append(divisor, quotient);
    work.append(left, right);

    this.renderEquality(typed, item);
    this.okBtn!.textContent = t.check;
    this.okBtn!.hidden = item?.kind === 'bring';
    this.okBtn!.disabled = !this.isEnabled();
    if (this.hintEl) this.hintEl.textContent = this.hintText ? this.hintText() : '';
    this.keypad.setLabels({ group: t.keypadLabel, backspace: t.backspaceLabel });
    this.host.setInstruction(this.instruction(item));
  }

  /** Last step whose rows should be visible. */
  private stepReached(): number {
    const item = this.current;
    if (!item) return this.trace.length - 1;
    if (item.kind === 'eqQ' || item.kind === 'eqR') return this.trace.length - 1;
    return item.step;
  }

  private renderEquality(typed: string, item: PlanItem | undefined): void {
    const box = this.eqEl;
    if (!box) return;
    const inEquality = this.done || item?.kind === 'eqQ' || item?.kind === 'eqR';
    box.hidden = !inEquality;
    box.replaceChildren();
    if (!inEquality) return;
    const part = (text: string, role: string): void => {
      const s = document.createElement('span');
      s.className = role ? `nw-role-${role}` : 'nw-op';
      s.textContent = text;
      box.appendChild(s);
    };
    const field = (text: string, active: boolean): void => {
      const s = document.createElement('span');
      s.className = active ? 'nw-role-quotient nw-lfield nw-lactive' : 'nw-role-quotient nw-lfield';
      s.textContent = text === '' ? '?' : text;
      box.appendChild(s);
    };
    part(this.fmt(this.a), 'dividend');
    part(' = (', '');
    part(this.fmt(this.b), 'divisor');
    part(' × ', '');
    const qActive = item?.kind === 'eqQ';
    field(this.accQ !== undefined ? this.fmt(this.accQ) : qActive ? typed : '', qActive);
    part(') + ', '');
    const rActive = item?.kind === 'eqR';
    const rEl = document.createElement('span');
    rEl.className = rActive ? 'nw-role-remainder nw-lfield nw-lactive' : 'nw-role-remainder nw-lfield';
    rEl.textContent = this.accR !== undefined ? this.fmt(this.accR) : rActive && typed !== '' ? typed : '?';
    box.appendChild(rEl);
  }

  private instruction(item: PlanItem | undefined): string {
    const t = this.host.t();
    if (this.done) {
      return `${this.fmt(this.a)} = (${this.fmt(this.b)} × ${this.fmt(this.accQ ?? 0)}) + ${this.fmt(this.accR ?? 0)}`;
    }
    if (!item) return '';
    const step = this.trace[item.step];
    switch (item.kind) {
      case 'digit':
        return t.longDivide(this.fmt(step.partial), this.fmt(this.b));
      case 'product':
        return t.longMultiply(this.fmt(step.digit), this.fmt(this.b));
      case 'remainder':
        return t.longSubtract(this.fmt(step.partial), this.fmt(step.product));
      case 'bring':
        return t.longBring;
      case 'eqQ':
        return t.longEqQPrompt;
      case 'eqR':
        return t.longEqRPrompt;
    }
  }

  // -------------------------------------------------------------------------
  // ModeController
  // -------------------------------------------------------------------------

  onLocaleChange(): void {
    this.render();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.root?.classList.toggle('nw-paused', paused);
    this.render();
  }

  reset(): void {
    if (this.done) return;
    this.resetProgress();
    this.keypad?.setValue('');
    this.render();
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.workEl = null;
    this.eqEl = null;
    this.hintEl = null;
    this.okBtn = null;
    this.keypad = null;
  }
}

export function createLongMode(): ModeController {
  return new LongMode();
}
