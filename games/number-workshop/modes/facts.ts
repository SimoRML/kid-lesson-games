/**
 * `facts` mode: division as fair sharing.
 *
 * The tier follows the dividend size, not the age (decision D8):
 *  - share  (dividend <= 12): tokens go onto plates one at a time.
 *  - deal   (13-30): same, plus a "deal one to each" button.
 *  - array  (> 30): the group builder adds rows of `divisor`; the child presses Check.
 *
 * The mode only decides when the level is solved; the shell owns scoring,
 * celebration and advancing. Spec: docs/design/number-workshop/01-pedagogy-and-modes.md §2.1
 */

import { divide } from '../division.js';
import { FACTS_THEMES, type FactsLevel, type FactsTheme, type Level } from '../levels.js';
import { attachTapOrDrag, nearestTarget, SNAP_RADIUS, targetsFrom } from '../widgets/drag.js';
import { createGroupBuilder, type GroupBuilder } from '../widgets/group-builder.js';
import type { ModeController, ModeHost } from './types.js';

export type FactsTier = 'share' | 'deal' | 'array';

export const SHARE_MAX = 12;
export const DEAL_MAX = 30;

/** Interaction tier for a dividend. */
export function factsTier(dividend: number): FactsTier {
  if (dividend <= SHARE_MAX) return 'share';
  if (dividend <= DEAL_MAX) return 'deal';
  return 'array';
}

/** Theme of a level: the one it names, else a stable pick from its operands. */
export function themeFor(level: FactsLevel): FactsTheme {
  return level.theme ?? FACTS_THEMES[(level.dividend + level.divisor) % FACTS_THEMES.length];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Friendly token drawn with SVG only (no remote assets). */
export function createTokenSvg(theme: FactsTheme): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 36 36', width: '36', height: '36', 'aria-hidden': 'true' });
  switch (theme) {
    case 'dates':
      svg.append(
        svgEl('ellipse', { cx: '18', cy: '19', rx: '9', ry: '13', fill: '#92400e' }),
        svgEl('ellipse', { cx: '14.5', cy: '13', rx: '2.6', ry: '5', fill: '#d97706', opacity: '0.7' })
      );
      break;
    case 'apples':
      svg.append(
        svgEl('circle', { cx: '18', cy: '20', r: '13', fill: '#dc2626' }),
        svgEl('ellipse', { cx: '23', cy: '9', rx: '5', ry: '2.6', fill: '#22c55e', transform: 'rotate(-25 23 9)' }),
        svgEl('circle', { cx: '13', cy: '16', r: '3', fill: '#fca5a5', opacity: '0.7' })
      );
      break;
    case 'marbles':
      svg.append(
        svgEl('circle', { cx: '18', cy: '18', r: '14', fill: '#3b82f6' }),
        svgEl('path', { d: 'M8 18a10 10 0 0 1 10-10', fill: 'none', stroke: '#f8fafc', 'stroke-width': '3', opacity: '0.6' }),
        svgEl('circle', { cx: '22', cy: '22', r: '4', fill: '#1d4ed8' })
      );
      break;
    case 'stars':
      svg.append(
        svgEl('polygon', {
          points: '18,3 22.5,13 33,14 25,21.5 27.5,32 18,26.5 8.5,32 11,21.5 3,14 13.5,13',
          fill: '#fbbf24',
          stroke: '#f59e0b',
          'stroke-width': '1.5'
        })
      );
      break;
  }
  return svg;
}

export class FactsMode implements ModeController {
  private stage!: HTMLElement;
  private host!: ModeHost;
  private theme: FactsTheme = 'dates';
  private tier: FactsTier = 'share';
  private a = 0;
  private b = 0;
  private q = 0;
  private r = 0;

  private root: HTMLElement | null = null;
  private paused = false;
  private done = false;

  // share / deal state
  private counts: number[] = [];
  private plateEls: HTMLElement[] = [];
  private plateBtns: HTMLButtonElement[] = [];
  private plateTokenBoxes: HTMLElement[] = [];
  private trayEl: HTMLElement | null = null;
  private dealBtn: HTMLButtonElement | null = null;

  // array state
  private builder: GroupBuilder | null = null;
  private checkBtn: HTMLButtonElement | null = null;
  private pileEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;

  mount(stage: HTMLElement, level: Level, host: ModeHost): void {
    if (level.mode !== 'facts') return;
    this.stage = stage;
    this.host = host;
    this.theme = themeFor(level);
    this.a = level.dividend;
    this.b = level.divisor;
    const { q, r } = divide(this.a, this.b);
    this.q = q;
    this.r = r;
    this.tier = factsTier(this.a);
    this.done = false;
    this.build();
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private build(): void {
    this.root?.remove();
    const root = document.createElement('div');
    root.className = 'nw-facts';
    this.root = root;
    this.stage.appendChild(root);

    if (this.tier === 'array') this.buildArray(root);
    else this.buildShare(root);
    this.render();
  }

  private isEnabled = (): boolean => !this.paused && !this.done;

  private buildShare(root: HTMLElement): void {
    this.counts = new Array<number>(this.b).fill(0);
    this.plateEls = [];
    this.plateBtns = [];
    this.plateTokenBoxes = [];

    const plates = document.createElement('div');
    plates.className = 'nw-plates';
    plates.setAttribute('role', 'group');

    for (let i = 0; i < this.b; i++) {
      const plate = document.createElement('div');
      plate.className = 'nw-plate';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nw-plate-btn';
      btn.addEventListener('click', () => this.place(i), { signal: this.host.signal });
      const box = document.createElement('div');
      box.className = 'nw-plate-tokens';
      plate.append(btn, box);
      plates.appendChild(plate);
      this.plateEls.push(plate);
      this.plateBtns.push(btn);
      this.plateTokenBoxes.push(box);
    }

    const tray = document.createElement('div');
    tray.className = 'nw-tray';
    tray.setAttribute('role', 'img');
    this.trayEl = tray;

    root.append(plates, tray);

    if (this.tier === 'deal') {
      const deal = document.createElement('button');
      deal.type = 'button';
      deal.className = 'nw-btn nw-btn-primary nw-deal';
      deal.addEventListener('click', () => this.dealOne(), { signal: this.host.signal });
      root.appendChild(deal);
      this.dealBtn = deal;
    }
  }

  private buildArray(root: HTMLElement): void {
    const pile = document.createElement('div');
    pile.className = 'nw-pile';
    this.pileEl = pile;

    this.builder = createGroupBuilder(root, {
      unit: this.b,
      maxGroups: this.q + 3,
      signal: this.host.signal,
      isEnabled: this.isEnabled,
      labels: this.builderLabels(),
      renderVisual: (visual, groups, unit) => this.renderArrayVisual(visual, groups, unit),
      onChange: (_groups, delta) => {
        this.host.audio[delta === 1 ? 'playDrop' : 'playPop']();
        this.clearHint();
        this.render();
      }
    });

    const hint = document.createElement('div');
    hint.className = 'nw-hint';
    hint.setAttribute('role', 'status');
    this.hintEl = hint;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'nw-btn nw-btn-primary nw-check';
    check.addEventListener('click', () => this.checkArray(), { signal: this.host.signal });
    this.checkBtn = check;

    root.prepend(pile);
    root.append(hint, check);
  }

  private builderLabels(): { add: string; remove: string; groupsLabel: string } {
    const t = this.host.t();
    return { add: t.addGroup, remove: t.removeGroup, groupsLabel: t.groupsLabel(this.host.formatNumber(this.b)) };
  }

  // -------------------------------------------------------------------------
  // Share / deal actions
  // -------------------------------------------------------------------------

  private placed(): number {
    return this.counts.reduce((s, c) => s + c, 0);
  }

  private tray(): number {
    return this.a - this.placed();
  }

  private place(i: number): void {
    if (!this.isEnabled() || this.tray() <= 0) return;
    this.counts[i]++;
    this.host.audio.playDrop();
    this.afterChange();
  }

  private takeBack(i: number): void {
    if (!this.isEnabled() || this.counts[i] <= 0) return;
    this.counts[i]--;
    this.host.audio.playPop();
    this.afterChange();
  }

  private move(from: number, to: number): void {
    if (!this.isEnabled() || from === to || this.counts[from] <= 0) return;
    this.counts[from]--;
    this.counts[to]++;
    this.host.audio.playDrop();
    this.afterChange();
  }

  private dealOne(): void {
    if (!this.isEnabled() || this.tray() < this.b) return;
    for (let i = 0; i < this.b; i++) this.counts[i]++;
    this.host.audio.playChime();
    this.afterChange();
  }

  /** Won when every plate holds the same (non-zero) count and fewer than `b` remain. */
  private isShareWin(): boolean {
    const first = this.counts[0];
    return first > 0 && this.counts.every((c) => c === first) && this.tray() < this.b;
  }

  private afterChange(): void {
    this.render();
    if (this.isShareWin()) {
      this.done = true;
      this.render();
      this.host.solved();
    }
  }

  // -------------------------------------------------------------------------
  // Array actions
  // -------------------------------------------------------------------------

  private checkArray(): void {
    if (!this.isEnabled() || !this.builder) return;
    const g = this.builder.getGroups();
    const t = this.host.t();
    if (g === this.q) {
      this.done = true;
      this.clearHint();
      this.render();
      this.host.solved();
      return;
    }
    this.host.reportMistake();
    this.host.audio.playError();
    this.showHint(g > this.q ? t.hintTooMany : t.hintRoomForMore(this.host.formatNumber(this.b)));
    this.wrongFeedback();
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

  private renderArrayVisual(visual: HTMLElement, groups: number, unit: number): void {
    visual.replaceChildren();
    for (let g = 0; g < groups; g++) {
      const row = document.createElement('div');
      row.className = 'nw-gb-row';
      for (let u = 0; u < unit; u++) {
        const dot = document.createElement('span');
        dot.className = 'nw-gb-dot';
        row.appendChild(dot);
      }
      visual.appendChild(row);
    }
    if (this.done && this.r > 0) {
      const left = document.createElement('div');
      left.className = 'nw-gb-row nw-gb-left';
      for (let u = 0; u < this.r; u++) {
        const dot = document.createElement('span');
        dot.className = 'nw-gb-dot nw-gb-dot-left';
        left.appendChild(dot);
      }
      visual.appendChild(left);
    }
  }

  // -------------------------------------------------------------------------
  // Rendering (updates in place so keyboard focus survives)
  // -------------------------------------------------------------------------

  private render(): void {
    if (this.tier === 'array') this.renderArray();
    else this.renderShare();
  }

  private fmt(n: number): string {
    return this.host.formatNumber(n);
  }

  private prefix(): string {
    return this.host.symbolFree ? '' : `${this.fmt(this.a)} ÷ ${this.fmt(this.b)} → `;
  }

  private renderShare(): void {
    const t = this.host.t();
    const friends = this.host.symbolFree;
    const tray = this.tray();
    const left = this.done && this.r > 0;

    for (let i = 0; i < this.b; i++) {
      const count = this.counts[i];
      const btn = this.plateBtns[i];
      btn.textContent = this.fmt(count);
      btn.setAttribute('aria-label', t.plateLabel(this.fmt(i + 1), this.fmt(count), friends));
      btn.disabled = false;
      btn.setAttribute('aria-disabled', String(!this.isEnabled() || tray <= 0));

      const box = this.plateTokenBoxes[i];
      box.replaceChildren();
      for (let k = 0; k < count; k++) {
        const tok = document.createElement('button');
        tok.type = 'button';
        tok.className = `nw-token nw-placed nw-token-${this.theme}`;
        tok.setAttribute('aria-label', t.takeBackLabel(this.fmt(i + 1), friends));
        tok.appendChild(createTokenSvg(this.theme));
        attachTapOrDrag(tok, {
          signal: this.host.signal,
          isEnabled: this.isEnabled,
          onTap: () => {
            this.takeBack(i);
            this.plateBtns[i]?.focus?.();
          },
          onDrop: (p) => {
            const to = this.plateAt(p);
            if (to !== null) this.move(i, to);
          }
        });
        box.appendChild(tok);
      }
    }

    if (this.trayEl) {
      this.trayEl.classList.toggle('nw-tray-left', left);
      this.trayEl.setAttribute('aria-label', t.trayLabel(this.fmt(tray), this.theme, left));
      this.trayEl.replaceChildren();
      const caption = document.createElement('span');
      caption.className = 'nw-tray-caption';
      caption.textContent = t.trayLabel(this.fmt(tray), this.theme, left);
      caption.setAttribute('aria-hidden', 'true');
      this.trayEl.appendChild(caption);
      for (let k = 0; k < tray; k++) {
        const tok = document.createElement('span');
        tok.className = `nw-token nw-tray-token nw-token-${this.theme}`;
        tok.setAttribute('aria-hidden', 'true');
        tok.appendChild(createTokenSvg(this.theme));
        attachTapOrDrag(tok, {
          signal: this.host.signal,
          isEnabled: this.isEnabled,
          onDrop: (p) => {
            const to = this.plateAt(p);
            if (to !== null) this.place(to);
          }
        });
        this.trayEl.appendChild(tok);
      }
    }

    if (this.dealBtn) {
      this.dealBtn.textContent = t.dealOne;
      this.dealBtn.disabled = tray < this.b || !this.isEnabled();
    }

    this.host.setInstruction(this.shareInstruction(tray));
  }

  private shareInstruction(tray: number): string {
    const t = this.host.t();
    const friends = this.host.symbolFree;
    if (this.done) {
      return this.r > 0
        ? `${this.prefix()}${t.leftOverWhy(this.fmt(tray), this.fmt(this.b), this.theme, friends)}`
        : `${this.prefix()}${t.shareLive({ plates: this.fmt(this.b), each: this.fmt(this.counts[0]), min: '', max: '', tray: this.fmt(0), theme: this.theme, friends })}`;
    }
    if (this.placed() === 0) {
      return t.sharePrompt(this.fmt(this.a), this.theme, this.fmt(this.b), friends);
    }
    const min = Math.min(...this.counts);
    const max = Math.max(...this.counts);
    return `${this.prefix()}${t.shareLive({
      plates: this.fmt(this.b),
      each: min === max ? this.fmt(min) : null,
      min: this.fmt(min),
      max: this.fmt(max),
      tray: this.fmt(tray),
      theme: this.theme,
      friends
    })}`;
  }

  private plateAt(p: { x: number; y: number }): number | null {
    const hit = nearestTarget(p, targetsFrom(this.plateEls), SNAP_RADIUS);
    return hit === null ? null : this.plateEls.indexOf(hit);
  }

  private renderArray(): void {
    if (!this.builder) return;
    const t = this.host.t();
    const g = this.builder.getGroups();
    const total = g * this.b;
    const remaining = Math.max(0, this.a - total);
    this.builder.setLabels(this.builderLabels());
    this.builder.setReadout(
      t.arrayReadout(this.fmt(this.b), this.fmt(g), this.fmt(total), this.host.symbolFree)
    );
    this.builder.setGroups(g);
    if (this.pileEl) {
      this.pileEl.textContent = t.trayLabel(this.fmt(remaining), this.theme, this.done && this.r > 0);
    }
    if (this.checkBtn) {
      this.checkBtn.textContent = t.check;
      this.checkBtn.disabled = !this.isEnabled();
    }
    if (this.done) {
      this.host.setInstruction(
        this.r > 0
          ? `${this.prefix()}${t.leftOverWhy(this.fmt(this.r), this.fmt(this.b), this.theme, this.host.symbolFree)}`
          : `${this.prefix()}${t.arrayReadout(this.fmt(this.b), this.fmt(g), this.fmt(total), this.host.symbolFree)}`
      );
    } else if (g === 0) {
      this.host.setInstruction(t.arrayPrompt(this.fmt(this.a), this.fmt(this.b), this.theme));
    } else {
      this.host.setInstruction(
        `${t.arrayReadout(this.fmt(this.b), this.fmt(g), this.fmt(total), this.host.symbolFree)} · ${t.trayLabel(this.fmt(remaining), this.theme, false)}`
      );
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
    this.clearHint();
    if (this.tier === 'array') {
      this.builder?.setGroups(0);
      this.render();
    } else {
      this.counts = new Array<number>(this.b).fill(0);
      this.render();
    }
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.builder = null;
    this.plateEls = [];
    this.plateBtns = [];
    this.plateTokenBoxes = [];
    this.trayEl = null;
    this.dealBtn = null;
    this.checkBtn = null;
    this.pileEl = null;
    this.hintEl = null;
  }
}

export function createFactsMode(): ModeController {
  return new FactsMode();
}
