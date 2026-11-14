/**
 * `shift` mode: slide the digits.
 *
 * A place-value table (HTh TTh Th H T O) holds the dividend's digits. Each
 * slide of the whole digit strip one column to the right is one division by
 * ten. A digit that would fall off the right edge must be a zero, otherwise
 * the strip refuses to move. The child presses Check when the number of
 * slides matches the divisor; a wrong count gets a hint that names the count.
 *
 * Spec: docs/design/number-workshop/01-pedagogy-and-modes.md §2.2
 */

import { isShiftDivisor, shiftCount } from '../division.js';
import type { Level } from '../levels.js';
import { attachTapOrDrag } from '../widgets/drag.js';
import type { ModeController, ModeHost } from './types.js';

/** Columns of the table (up to six-digit dividends). */
export const TABLE_COLUMNS = 6;
/** Slides allowed; also the width of the "off the table" area. */
export const MAX_SLIDES = 4;

/** Digits of the dividend, most significant first. */
export function digitsOf(dividend: number): string[] {
  return String(dividend).split('');
}

/**
 * Whether the strip may take one more slide to the right after `slides`
 * slides: the digit about to leave the units column must be a zero.
 */
export function canSlide(digits: readonly string[], slides: number): boolean {
  if (slides >= MAX_SLIDES) return false;
  const leaving = digits[digits.length - 1 - slides];
  return leaving === undefined || leaving === '0';
}

export type ShiftVerdict = 'solved' | 'tooFew' | 'tooMany';

export function judgeShift(divisor: number, slides: number): ShiftVerdict {
  const need = isShiftDivisor(divisor) ? shiftCount(divisor) : 0;
  if (slides === need) return 'solved';
  return slides < need ? 'tooFew' : 'tooMany';
}

export class ShiftMode implements ModeController {
  private stage!: HTMLElement;
  private host!: ModeHost;
  private a = 0;
  private b = 0;
  private digits: string[] = [];

  private root: HTMLElement | null = null;
  private headerCells: HTMLElement[] = [];
  private body: HTMLElement | null = null;
  private strip: HTMLElement | null = null;
  private digitEls: HTMLElement[] = [];
  private counterEl: HTMLElement | null = null;
  private slideBtn: HTMLButtonElement | null = null;
  private backBtn: HTMLButtonElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;
  private hintEl: HTMLElement | null = null;
  private hintText: (() => string) | null = null;
  private slides = 0;
  private paused = false;
  private done = false;

  mount(stage: HTMLElement, level: Level, host: ModeHost): void {
    if (level.mode !== 'shift') return;
    this.stage = stage;
    this.host = host;
    this.a = level.dividend;
    this.b = level.divisor;
    this.digits = digitsOf(this.a);
    this.slides = 0;
    this.done = false;
    this.hintText = null;
    this.build();
  }

  private isEnabled = (): boolean => !this.paused && !this.done;

  private fmt(n: number): string {
    return this.host.formatNumber(n);
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private build(): void {
    this.root?.remove();
    const root = document.createElement('div');
    root.className = 'nw-shift';
    this.root = root;
    this.stage.appendChild(root);

    this.counterEl = document.createElement('div');
    this.counterEl.className = 'nw-counter';
    root.appendChild(this.counterEl);

    const table = document.createElement('div');
    table.className = 'nw-pv';
    table.setAttribute('role', 'img');

    const header = document.createElement('div');
    header.className = 'nw-pv-head';
    this.headerCells = [];
    for (let c = 0; c < TABLE_COLUMNS + MAX_SLIDES; c++) {
      const cell = document.createElement('span');
      cell.className = c < TABLE_COLUMNS ? 'nw-pv-col' : 'nw-pv-col nw-pv-off';
      header.appendChild(cell);
      this.headerCells.push(cell);
    }

    const body = document.createElement('div');
    body.className = 'nw-pv-body';
    this.body = body;
    const strip = document.createElement('div');
    strip.className = 'nw-strip';
    strip.setAttribute('role', 'group');
    this.strip = strip;
    this.digitEls = this.digits.map((d) => {
      const cell = document.createElement('span');
      cell.className = 'nw-digit';
      cell.textContent = d;
      strip.appendChild(cell);
      return cell;
    });
    body.appendChild(strip);
    table.append(header, body);
    root.appendChild(table);

    attachTapOrDrag(strip, {
      signal: this.host.signal,
      isEnabled: this.isEnabled,
      onDrop: (_point, delta) => this.dragTo(delta.x)
    });

    const buttons = document.createElement('div');
    buttons.className = 'nw-shift-buttons';
    this.backBtn = document.createElement('button');
    this.backBtn.type = 'button';
    this.backBtn.className = 'nw-btn';
    this.backBtn.addEventListener('click', () => this.slideBack(), { signal: this.host.signal });
    this.slideBtn = document.createElement('button');
    this.slideBtn.type = 'button';
    this.slideBtn.className = 'nw-btn nw-btn-primary';
    this.slideBtn.addEventListener('click', () => this.slideRight(), { signal: this.host.signal });
    buttons.append(this.backBtn, this.slideBtn);
    root.appendChild(buttons);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'nw-hint';
    this.hintEl.setAttribute('role', 'status');
    this.checkBtn = document.createElement('button');
    this.checkBtn.type = 'button';
    this.checkBtn.className = 'nw-btn nw-btn-primary nw-check';
    this.checkBtn.addEventListener('click', () => this.check(), { signal: this.host.signal });
    root.append(this.hintEl, this.checkBtn);

    this.render();
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /** One slide right. Returns false (with a gentle refusal) when a non-zero digit would fall off. */
  private slideRight(): boolean {
    if (!this.isEnabled()) return false;
    if (!canSlide(this.digits, this.slides)) {
      this.host.audio.playError();
      this.clearHint();
      const text = this.host.t().shiftRefuse;
      this.hintText = () => this.host.t().shiftRefuse;
      if (this.hintEl) this.hintEl.textContent = text;
      this.host.setInstruction(text);
      this.refuseFeedback();
      return false;
    }
    this.slides++;
    this.host.audio.playClick();
    this.clearHint();
    this.render();
    return true;
  }

  private slideBack(): boolean {
    if (!this.isEnabled() || this.slides === 0) return false;
    this.slides--;
    this.host.audio.playPop();
    this.clearHint();
    this.render();
    return true;
  }

  /** Drag the strip: whole columns only, stopping at the first refusal. */
  private dragTo(dx: number): void {
    const cell = this.headerCells[0]?.getBoundingClientRect().width ?? 0;
    const colWidth = cell > 0 ? cell : 44;
    const target = Math.max(0, Math.min(MAX_SLIDES, this.slides + Math.round(dx / colWidth)));
    while (this.slides < target) {
      if (!this.slideRight()) break;
    }
    while (this.slides > target) {
      if (!this.slideBack()) break;
    }
  }

  private check(): void {
    if (!this.isEnabled()) return;
    const verdict = judgeShift(this.b, this.slides);
    if (verdict === 'solved') {
      this.done = true;
      this.clearHint();
      this.render();
      this.host.solved();
      return;
    }
    const need = shiftCount(this.b as 10 | 100 | 1000);
    const build = (): string => {
      const t = this.host.t();
      const args = [this.fmt(this.b), this.fmt(need), need, this.fmt(this.slides)] as const;
      return verdict === 'tooFew' ? t.shiftTooFew(...args) : t.shiftTooMany(...args);
    };
    this.hintText = build;
    const text = build();
    if (this.hintEl) this.hintEl.textContent = text;
    this.host.setInstruction(text);
    this.host.reportMistake();
    this.host.audio.playError();
    this.refuseFeedback();
  }

  private refuseFeedback(): void {
    const cls = this.host.reducedMotion ? 'nw-pulse' : 'nw-shake';
    this.root?.classList.add(cls);
    this.host.setTimeout(() => this.root?.classList.remove(cls), 450);
  }

  private clearHint(): void {
    this.hintText = null;
    if (this.hintEl) this.hintEl.textContent = '';
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** Value read from the table after the current slides (exact while only zeros fell). */
  private value(): number {
    return Math.floor(this.a / 10 ** this.slides);
  }

  private render(): void {
    const t = this.host.t();
    const lead = TABLE_COLUMNS - this.digits.length;

    t.columns.forEach((label, c) => {
      if (this.headerCells[c]) this.headerCells[c].textContent = label;
    });

    // The strip's left edge sits `lead + slides` columns in; digits past the last
    // table column are "off the table" and drawn dimmed.
    this.strip?.style.setProperty('--nw-offset', String(lead + this.slides));
    this.digitEls.forEach((el, i) => {
      el.classList.toggle('nw-digit-off', lead + this.slides + i >= TABLE_COLUMNS);
    });
    this.strip?.setAttribute('aria-label', t.stripLabel);
    this.body?.parentElement?.setAttribute('aria-label', t.tableLabel(this.fmt(this.value())));

    if (this.counterEl) {
      this.counterEl.textContent = t.shiftCounter(
        this.slides,
        this.fmt(this.slides),
        this.fmt(10 ** this.slides)
      );
    }
    if (this.slideBtn) {
      this.slideBtn.textContent = t.slideBtn;
      this.slideBtn.disabled = !this.isEnabled();
    }
    if (this.backBtn) {
      this.backBtn.textContent = t.slideBackBtn;
      this.backBtn.disabled = !this.isEnabled() || this.slides === 0;
    }
    if (this.checkBtn) {
      this.checkBtn.textContent = t.check;
      this.checkBtn.disabled = !this.isEnabled();
    }
    if (this.hintEl) this.hintEl.textContent = this.hintText ? this.hintText() : '';

    if (this.done) {
      this.host.setInstruction(`${this.fmt(this.a)} ÷ ${this.fmt(this.b)} = ${this.fmt(this.value())}`);
    } else if (this.slides === 0) {
      this.host.setInstruction(t.shiftPrompt(this.fmt(this.a), this.fmt(this.b)));
    } else {
      const counter = t.shiftCounter(this.slides, this.fmt(this.slides), this.fmt(10 ** this.slides));
      this.host.setInstruction(`${counter} → ${this.fmt(this.value())}`);
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
    this.slides = 0;
    this.clearHint();
    this.render();
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.body = null;
    this.strip = null;
    this.digitEls = [];
    this.headerCells = [];
    this.counterEl = null;
    this.slideBtn = null;
    this.backBtn = null;
    this.checkBtn = null;
    this.hintEl = null;
  }
}

export function createShiftMode(): ModeController {
  return new ShiftMode();
}
