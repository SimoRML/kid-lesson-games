/**
 * `euclid` mode: fit the groups.
 *
 * The child builds the quotient with the group builder (bars of length `b` on
 * a number track from 0 to the dividend) and types the remainder on a keypad.
 * Check accepts only the Euclidean answer a = b × q + r with r < b. Three wrong
 * paths each get their own hint: too far, a false equality, and a true
 * equality whose remainder still has room for another group.
 *
 * Spec: docs/design/number-workshop/01-pedagogy-and-modes.md §2.3
 */

import { divide } from '../division.js';
import type { Level } from '../levels.js';
import { createGroupBuilder, type GroupBuilder } from '../widgets/group-builder.js';
import { createKeypad, type Keypad } from '../widgets/keypad.js';
import type { ModeController, ModeHost } from './types.js';

export type EuclidVerdict = 'solved' | 'tooFar' | 'falseEquality' | 'notEuclidean' | 'needRemainder';

/** Judges an attempt. `remainder` is null while nothing has been typed. */
export function judgeEuclid(
  dividend: number,
  divisor: number,
  groups: number,
  remainder: number | null
): EuclidVerdict {
  if (remainder === null) return groups * divisor > dividend ? 'tooFar' : 'needRemainder';
  if (groups * divisor > dividend) return 'tooFar';
  if (groups * divisor + remainder !== dividend) return 'falseEquality';
  return remainder >= divisor ? 'notEuclidean' : 'solved';
}

export class EuclidMode implements ModeController {
  private stage!: HTMLElement;
  private host!: ModeHost;
  private a = 0;
  private b = 0;
  private q = 0;

  private root: HTMLElement | null = null;
  private liveEq: HTMLElement | null = null;
  private remDisplay: HTMLElement | null = null;
  private remLabel: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;
  private builder: GroupBuilder | null = null;
  private keypad: Keypad | null = null;
  private paused = false;
  private done = false;

  mount(stage: HTMLElement, level: Level, host: ModeHost): void {
    if (level.mode !== 'euclid') return;
    this.stage = stage;
    this.host = host;
    this.a = level.dividend;
    this.b = level.divisor;
    this.q = divide(this.a, this.b).q;
    this.done = false;
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
    root.className = 'nw-euclid';
    this.root = root;
    this.stage.appendChild(root);

    this.liveEq = document.createElement('div');
    this.liveEq.className = 'nw-live-eq';
    this.liveEq.setAttribute('aria-hidden', 'true');
    root.appendChild(this.liveEq);

    this.builder = createGroupBuilder(root, {
      unit: this.b,
      maxGroups: Math.min(this.q + 3, 30),
      signal: this.host.signal,
      isEnabled: this.isEnabled,
      labels: this.builderLabels(),
      renderVisual: (visual, groups) => this.renderTrack(visual, groups),
      onChange: (_g, delta) => {
        this.host.audio[delta === 1 ? 'playDrop' : 'playPop']();
        this.clearHint();
        this.render();
      }
    });

    const remRow = document.createElement('div');
    remRow.className = 'nw-rem-row';
    this.remLabel = document.createElement('span');
    this.remLabel.className = 'nw-rem-label nw-role-remainder';
    this.remDisplay = document.createElement('span');
    this.remDisplay.className = 'nw-rem-display nw-role-remainder';
    this.remDisplay.setAttribute('role', 'status');
    remRow.append(this.remLabel, this.remDisplay);
    root.appendChild(remRow);

    this.keypad = createKeypad(root, {
      signal: this.host.signal,
      isEnabled: this.isEnabled,
      maxDigits: 3,
      keyTarget: this.stage,
      labels: this.keypadLabels(),
      onChange: () => {
        this.host.audio.playClick();
        this.clearHint();
        this.render();
      }
    });

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

  private builderLabels(): { add: string; remove: string; groupsLabel: string } {
    const t = this.host.t();
    return { add: t.addGroup, remove: t.removeGroup, groupsLabel: t.groupsLabel(this.fmt(this.b)) };
  }

  private keypadLabels(): { group: string; backspace: string } {
    const t = this.host.t();
    return { group: t.keypadLabel, backspace: t.backspaceLabel };
  }

  // -------------------------------------------------------------------------
  // Track: bars of length b on a line from 0 to the dividend
  // -------------------------------------------------------------------------

  private renderTrack(visual: HTMLElement, groups: number): void {
    visual.replaceChildren();
    visual.classList.add('nw-track-wrap');
    const total = groups * this.b;
    const span = Math.max(this.a, total);
    const pct = (n: number): string => `${(n / span) * 100}%`;

    const track = document.createElement('div');
    track.className = 'nw-track';
    for (let g = 0; g < groups; g++) {
      const bar = document.createElement('div');
      bar.className = 'nw-bar';
      if ((g + 1) * this.b > this.a) bar.classList.add('nw-bar-over');
      bar.style.width = pct(this.b);
      track.appendChild(bar);
    }

    const gap = this.a - total;
    if (gap > 0) {
      const gapEl = document.createElement('div');
      gapEl.className = 'nw-gap';
      gapEl.style.width = pct(gap);
      // Easy and medium draw the gap as countable unit squares; hard leaves it unmarked.
      if (this.host.difficulty === 'hard') {
        gapEl.classList.add('nw-gap-hidden');
      } else {
        for (let u = 0; u < gap; u++) {
          const unit = document.createElement('span');
          unit.className = 'nw-unit';
          gapEl.appendChild(unit);
        }
      }
      track.appendChild(gapEl);
    }
    visual.appendChild(track);

    const axis = document.createElement('div');
    axis.className = 'nw-axis';
    const mark = document.createElement('span');
    mark.className = 'nw-axis-end nw-role-dividend';
    mark.textContent = this.fmt(this.a);
    mark.style.left = pct(this.a);
    const zero = document.createElement('span');
    zero.className = 'nw-axis-zero';
    zero.textContent = '0';
    axis.append(zero, mark);
    visual.appendChild(axis);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private remainderValue(): number | null {
    const v = this.keypad?.getValue() ?? '';
    return v === '' ? null : Number(v);
  }

  private render(): void {
    if (!this.builder || !this.keypad) return;
    const t = this.host.t();
    const g = this.builder.getGroups();
    const r = this.remainderValue();
    const total = g * this.b;

    this.builder.setLabels(this.builderLabels());
    this.keypad.setLabels(this.keypadLabels());
    this.builder.setGroups(g);
    this.builder.setReadout(t.arrayReadout(this.fmt(this.b), this.fmt(g), this.fmt(total), false));

    if (this.remLabel) this.remLabel.textContent = t.remainderPrompt;
    if (this.remDisplay) this.remDisplay.textContent = r === null ? '?' : this.fmt(r);
    if (this.checkBtn) {
      this.checkBtn.textContent = t.check;
      this.checkBtn.disabled = !this.isEnabled();
    }
    this.renderLiveEquation(g, r);

    const eq = `${this.fmt(this.a)} = (${this.fmt(this.b)} × ${this.fmt(g)}) + ${r === null ? '?' : this.fmt(r)}`;
    if (this.done) {
      this.host.setInstruction(eq);
    } else if (g === 0 && r === null) {
      this.host.setInstruction(t.euclidPrompt(this.fmt(this.b)));
    } else if (this.host.difficulty === 'hard' || total > this.a) {
      this.host.setInstruction(eq);
    } else {
      this.host.setInstruction(`${eq} · ${t.gapLeft(this.fmt(this.a - total))}`);
    }
  }

  private renderLiveEquation(groups: number, r: number | null): void {
    const box = this.liveEq;
    if (!box) return;
    box.replaceChildren();
    const part = (text: string, role: string): void => {
      const span = document.createElement('span');
      span.className = role ? `nw-role-${role}` : 'nw-op';
      span.textContent = text;
      box.appendChild(span);
    };
    part(this.fmt(this.a), 'dividend');
    part(' = (', '');
    part(this.fmt(this.b), 'divisor');
    part(' × ', '');
    part(this.fmt(groups), 'quotient');
    part(') + ', '');
    part(r === null ? '?' : this.fmt(r), 'remainder');
  }

  // -------------------------------------------------------------------------
  // Check
  // -------------------------------------------------------------------------

  private check(): void {
    if (!this.isEnabled() || !this.builder) return;
    const t = this.host.t();
    const g = this.builder.getGroups();
    const verdict = judgeEuclid(this.a, this.b, g, this.remainderValue());

    if (verdict === 'solved') {
      this.done = true;
      this.clearHint();
      this.render();
      this.host.solved();
      return;
    }

    const hints: Record<Exclude<EuclidVerdict, 'solved'>, string> = {
      tooFar: t.euclidTooFar(this.fmt(this.b * g), this.fmt(this.a)),
      falseEquality: t.euclidFalse(this.fmt(this.a)),
      notEuclidean: t.euclidNotEuclidean(this.fmt(this.b)),
      needRemainder: t.euclidNeedRemainder
    };
    this.showHint(hints[verdict]);
    // Forgetting to type the remainder is a reminder, not a mistake.
    if (verdict !== 'needRemainder') {
      this.host.reportMistake();
      this.host.audio.playError();
      this.wrongFeedback();
    }
  }

  private showHint(text: string): void {
    if (this.hintEl) this.hintEl.textContent = text;
    this.host.setInstruction(text);
  }

  private clearHint(): void {
    if (this.hintEl) this.hintEl.textContent = '';
  }

  private wrongFeedback(): void {
    const cls = this.host.reducedMotion ? 'nw-pulse' : 'nw-shake';
    this.root?.classList.add(cls);
    this.host.setTimeout(() => this.root?.classList.remove(cls), 450);
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
    this.clearHint();
    this.builder?.setGroups(0);
    this.keypad?.setValue('');
    this.render();
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.builder = null;
    this.keypad = null;
    this.liveEq = null;
    this.remDisplay = null;
    this.remLabel = null;
    this.hintEl = null;
    this.checkBtn = null;
  }
}

export function createEuclidMode(): ModeController {
  return new EuclidMode();
}
