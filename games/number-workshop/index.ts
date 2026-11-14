/**
 * Division Workshop: the `number-workshop` cartridge shell.
 *
 * The shell owns everything shared (HUD, level flow, scoring, telemetry,
 * celebration, timers, end screen, config updates). Each mode owns only its
 * stage and decides when a level is solved.
 *
 * Spec: docs/design/number-workshop/03-architecture.md
 */

import confetti from 'canvas-confetti';
import type { GameContext, KidGame } from '../../src/core/types.js';
import { divide } from './division.js';
import { formatNumber, getTranslations, mistakesText, normalizeLocale, type Dictionary, type Lang } from './i18n.js';
import { generateLevelsForAge, levelsSignature, parseCustomLevels, type Level } from './levels.js';
import { themeFor } from './modes/facts.js';
import { MODE_REGISTRY } from './modes/index.js';
import type { ModeController, ModeHost } from './modes/types.js';
import {
  completeLevel,
  computeStars,
  createSession,
  elapsedSeconds,
  pauseSession,
  recordMistake,
  resumeSession,
  type SessionState
} from './session.js';
import { STYLES } from './styles.js';

export { generateLevelsForAge, parseCustomLevels };

/** How long the solved state stays on screen before the celebration. */
export const SETTLE_MS = 600;
/** How long the celebration shows before the next level. */
export const CELEBRATE_MS = 1400;

// ---------------------------------------------------------------------------
// Tracked timers that can be frozen while the game is paused
// ---------------------------------------------------------------------------

interface TimerItem {
  fn: () => void;
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

class TimerBag {
  private items = new Map<number, TimerItem>();
  private nextId = 1;
  private frozen = false;

  set(fn: () => void, ms: number): void {
    const id = this.nextId++;
    const item: TimerItem = { fn, remaining: ms, startedAt: Date.now(), handle: null };
    this.items.set(id, item);
    if (!this.frozen) this.arm(id, item);
  }

  private arm(id: number, item: TimerItem): void {
    item.startedAt = Date.now();
    item.handle = setTimeout(() => {
      this.items.delete(id);
      item.fn();
    }, item.remaining);
  }

  freeze(): void {
    if (this.frozen) return;
    this.frozen = true;
    const now = Date.now();
    for (const item of this.items.values()) {
      if (item.handle !== null) clearTimeout(item.handle);
      item.handle = null;
      item.remaining = Math.max(0, item.remaining - (now - item.startedAt));
    }
  }

  thaw(): void {
    if (!this.frozen) return;
    this.frozen = false;
    for (const [id, item] of this.items) this.arm(id, item);
  }

  clear(): void {
    for (const item of this.items.values()) {
      if (item.handle !== null) clearTimeout(item.handle);
    }
    this.items.clear();
  }
}

// ---------------------------------------------------------------------------
// DOM helpers (static structure only; dynamic text always goes through textContent)
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface Hud {
  root: HTMLElement;
  title: HTMLElement;
  badge: HTMLElement;
  instruction: HTMLElement;
  score: HTMLElement;
  soundBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  equation: HTMLElement;
  stage: HTMLElement;
  banner: HTMLElement;
  end: HTMLElement;
  endStars: HTMLElement;
  endScore: HTMLElement;
  endSummary: HTMLElement;
  againBtn: HTMLButtonElement;
}

type Phase = 'playing' | 'settling' | 'celebrating' | 'complete';

export class NumberWorkshopGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private abort: AbortController | null = null;
  private levelAbort: AbortController | null = null;
  private hud!: Hud;
  private shellTimers = new TimerBag();
  private levelTimers = new TimerBag();

  private levels: Level[] = [];
  private customActive = false;
  private signature = '';
  private levelIndex = 0;
  private session!: SessionState;
  private phase: Phase = 'playing';
  private controller: ModeController | null = null;
  private levelSolved = false;
  private started = false;
  private paused = false;
  private completeEmitted = false;

  // -------------------------------------------------------------------------
  // KidGame lifecycle
  // -------------------------------------------------------------------------

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abort = new AbortController();

    container.replaceChildren();
    const style = document.createElement('style');
    style.textContent = STYLES;
    container.appendChild(style);
    this.hud = this.buildHud();
    container.appendChild(this.hud.root);

    this.loadLevels();
    this.beginRun();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.session = resumeSession(this.session, Date.now());
    this.syncActive();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.syncActive();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.syncActive();
  }

  updateConfig(newContext: Partial<GameContext>): void {
    if (!this.abort) return;
    const prev = {
      age: this.context.ageGroup,
      difficulty: this.context.difficulty,
      lang: normalizeLocale(this.context.locale)
    };

    // Merge, never replace: the host omits `emit` from partial updates.
    for (const key of Object.keys(newContext) as Array<keyof GameContext>) {
      if (newContext[key] !== undefined) {
        (this.context as unknown as Record<string, unknown>)[key] = newContext[key];
      }
    }

    if (newContext.sound !== undefined) {
      this.context.audio.enabled = Boolean(newContext.sound);
      this.updateSoundLabel();
    }

    const lang = normalizeLocale(this.context.locale);
    if (lang !== prev.lang) this.applyLocale();

    const ageChanged = this.context.ageGroup !== prev.age;
    const difficultyChanged = this.context.difficulty !== prev.difficulty;
    const custom = parseCustomLevels(this.context.customLevels);

    if (custom) {
      const sig = levelsSignature(custom);
      if (!this.customActive || sig !== this.signature) {
        this.loadLevels();
        this.beginRun();
      } else if (difficultyChanged) {
        this.beginRun();
      } else if (ageChanged) {
        this.mountLevel(this.levelIndex);
      }
    } else if (this.customActive || ageChanged || difficultyChanged) {
      this.loadLevels();
      this.beginRun();
    }
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    this.teardownLevel();
    this.shellTimers.clear();
    this.levelTimers.clear();
    this.container?.replaceChildren();
  }

  // -------------------------------------------------------------------------
  // Locale and text
  // -------------------------------------------------------------------------

  private get lang(): Lang {
    return normalizeLocale(this.context.locale);
  }

  private get dict(): Dictionary {
    return getTranslations(this.lang);
  }

  private fmt(n: number): string {
    return formatNumber(n, this.lang);
  }

  private get reducedMotion(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch {
      return false;
    }
  }

  private get isActive(): boolean {
    return this.started && !this.paused;
  }

  private applyLocale(): void {
    this.hud.title.textContent = this.dict.title;
    this.hud.root.setAttribute('lang', this.lang);
    this.updateChrome();
    this.renderEquation();
    this.controller?.onLocaleChange();
    if (this.phase === 'complete') this.renderEnd();
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private buildHud(): Hud {
    const signal = this.abort!.signal;
    const root = el('div', 'nw-root');
    root.setAttribute('lang', this.lang);

    const bar = el('header', 'nw-hud');
    const left = el('div', 'nw-hud-left');
    const title = el('h2', 'nw-title', this.dict.title);
    const badge = el('span', 'nw-badge');
    left.append(title, badge);

    const instruction = el('div', 'nw-instruction');
    instruction.setAttribute('aria-live', 'polite');

    const right = el('div', 'nw-hud-right');
    const score = el('span', 'nw-score');
    const soundBtn = el('button', 'nw-btn nw-sound');
    soundBtn.type = 'button';
    const resetBtn = el('button', 'nw-btn nw-reset');
    resetBtn.type = 'button';
    right.append(score, soundBtn, resetBtn);
    bar.append(left, instruction, right);

    const equation = el('div', 'nw-equation');
    const stage = el('div', 'nw-stage');
    const banner = el('div', 'nw-banner');
    banner.setAttribute('role', 'status');

    const end = el('div', 'nw-end');
    end.hidden = true;
    const endStars = el('div', 'nw-end-stars');
    endStars.setAttribute('role', 'img');
    const endScore = el('div', 'nw-end-score');
    const endSummary = el('div', 'nw-end-summary');
    const againBtn = el('button', 'nw-btn nw-btn-primary nw-again');
    againBtn.type = 'button';
    end.append(endStars, endScore, endSummary, againBtn);

    root.append(bar, equation, stage, banner, end);

    soundBtn.addEventListener(
      'click',
      () => {
        this.context.audio.enabled = !this.context.audio.enabled;
        this.context.sound = this.context.audio.enabled;
        this.updateSoundLabel();
        this.context.audio.playClick();
      },
      { signal }
    );
    resetBtn.addEventListener(
      'click',
      () => {
        if (this.phase !== 'playing' || !this.isActive) return;
        this.context.audio.playClick();
        this.controller?.reset();
      },
      { signal }
    );
    againBtn.addEventListener(
      'click',
      () => {
        this.context.audio.playClick();
        if (!this.customActive) this.loadLevels();
        this.beginRun();
      },
      { signal }
    );

    return { root, title, badge, instruction, score, soundBtn, resetBtn, equation, stage, banner, end, endStars, endScore, endSummary, againBtn };
  }

  private updateSoundLabel(): void {
    this.hud.soundBtn.textContent = this.context.t(this.context.audio.enabled ? 'soundOn' : 'soundOff');
  }

  /** Text that depends on locale or progress: badge, score, buttons. */
  private updateChrome(): void {
    const total = this.levels.length;
    const index = Math.min(this.levelIndex + 1, total);
    const badge = this.dict.levelWord(this.fmt(index), this.fmt(total));
    this.hud.badge.textContent = badge;
    this.hud.badge.setAttribute('aria-label', `${this.context.t('level')} ${badge}`);
    const score = this.session ? this.session.score : 0;
    this.hud.score.textContent = `★ ${this.fmt(score)}`;
    this.hud.score.setAttribute('aria-label', `${this.context.t('score')}: ${this.fmt(score)}`);
    this.hud.resetBtn.textContent = `↺ ${this.context.t('reset')}`;
    this.hud.againBtn.textContent = this.dict.playAgain;
    this.updateSoundLabel();
  }

  private get currentLevel(): Level | undefined {
    return this.levels[this.levelIndex];
  }

  private get symbolFree(): boolean {
    return this.currentLevel?.mode === 'facts' && this.context.ageGroup === '3-5';
  }

  /** The equation line: the constant anchor, colour-coded by role. */
  private renderEquation(): void {
    const level = this.currentLevel;
    const box = this.hud.equation;
    box.replaceChildren();
    box.classList.remove('nw-equation-solved');
    if (!level) return;
    const solved = this.levelSolved;
    const { q, r } = divide(level.dividend, level.divisor);
    const t = this.dict;

    if (this.symbolFree) {
      // No division sign and no equation at ages 3-5: a sentence, only once solved.
      box.hidden = !solved;
      if (solved) {
        box.textContent = this.resultSentence(level, q, r);
        box.classList.add('nw-equation-solved');
      }
      return;
    }

    box.hidden = false;
    const term = (value: string, role: string, label: string): HTMLElement => {
      const span = el('span', `nw-term nw-role-${role}`);
      span.append(el('span', 'nw-num', value), el('span', 'nw-lab', label));
      return span;
    };
    const op = (text: string): HTMLElement => el('span', 'nw-op', text);

    const visual = el('span', 'nw-eq-visual');
    visual.setAttribute('aria-hidden', 'true');
    visual.append(
      term(this.fmt(level.dividend), 'dividend', t.dividend),
      op('÷'),
      term(this.fmt(level.divisor), 'divisor', t.divisor),
      op('=')
    );
    if (solved) {
      visual.appendChild(term(this.fmt(q), 'quotient', t.quotient));
      if (r > 0) visual.appendChild(term(this.fmt(r), 'remainder', `${t.remainder} (r)`));
      box.classList.add('nw-equation-solved');
    } else {
      visual.appendChild(term('?', 'quotient', t.quotient));
    }
    box.appendChild(visual);

    const sr = el('span', 'nw-sr');
    sr.textContent = solved
      ? t.resultEquality(this.fmt(level.dividend), this.fmt(level.divisor), this.fmt(q), this.fmt(r))
      : `${this.fmt(level.dividend)} ÷ ${this.fmt(level.divisor)} = ?`;
    box.appendChild(sr);
  }

  private resultSentence(level: Level, q: number, r: number): string {
    // Only facts levels are symbol-free; the theme matches the one the mode drew.
    const theme = level.mode === 'facts' ? themeFor(level) : 'dates';
    return this.dict.resultSentence(this.fmt(q), theme, true, this.fmt(r));
  }

  // -------------------------------------------------------------------------
  // Level sets and runs
  // -------------------------------------------------------------------------

  private loadLevels(): void {
    const custom = parseCustomLevels(this.context.customLevels);
    if (custom) {
      this.levels = custom;
      this.customActive = true;
      this.signature = levelsSignature(custom);
    } else {
      this.levels = generateLevelsForAge(this.context.ageGroup, this.context.difficulty);
      this.customActive = false;
      this.signature = '';
    }
  }

  /** A new run: level 1, score 0, clock restarted. */
  private beginRun(): void {
    this.shellTimers.clear();
    this.completeEmitted = false;
    this.session = createSession(this.levels.length, Date.now());
    if (!this.isActive) this.session = pauseSession(this.session, Date.now());
    this.hud.end.hidden = true;
    this.hud.stage.hidden = false;
    this.hud.banner.classList.remove('show');
    this.levelIndex = 0;
    this.mountLevel(0);
  }

  private mountLevel(index: number): void {
    this.teardownLevel();
    this.levelIndex = index;
    this.levelSolved = false;
    this.phase = 'playing';
    this.hud.stage.classList.remove('nw-solved');
    this.hud.root.dataset.phase = 'playing';

    const level = this.currentLevel;
    if (!level) {
      this.updateChrome();
      this.renderEquation();
      return;
    }
    const factory = MODE_REGISTRY[level.mode];
    this.levelAbort = new AbortController();
    this.updateChrome();
    this.renderEquation();
    if (!factory) return;

    const controller = factory();
    this.controller = controller;
    controller.mount(this.hud.stage, level, this.makeHost(this.levelAbort));
    controller.setPaused(!this.isActive);
  }

  private teardownLevel(): void {
    this.levelAbort?.abort();
    this.levelAbort = null;
    this.levelTimers.clear();
    this.controller?.destroy();
    this.controller = null;
    this.hud?.stage.replaceChildren();
  }

  private makeHost(abort: AbortController): ModeHost {
    const game = this;
    const live = (): boolean => !abort.signal.aborted;
    return {
      signal: abort.signal,
      get difficulty() {
        return game.context.difficulty;
      },
      get reducedMotion() {
        return game.reducedMotion;
      },
      get symbolFree() {
        return game.symbolFree;
      },
      t: () => game.dict,
      formatNumber: (n) => game.fmt(n),
      audio: game.context.audio,
      setInstruction: (text) => {
        if (live()) game.hud.instruction.textContent = text;
      },
      setTimeout: (fn, ms) => {
        if (live()) game.levelTimers.set(fn, ms);
      },
      reportMistake: () => {
        if (live() && game.phase === 'playing') game.session = recordMistake(game.session);
      },
      solved: () => {
        if (live()) game.onSolved();
      }
    };
  }

  // -------------------------------------------------------------------------
  // Solve, celebrate, advance
  // -------------------------------------------------------------------------

  private onSolved(): void {
    if (this.levelSolved || this.phase !== 'playing') return;
    const level = this.currentLevel;
    if (!level) return;
    this.levelSolved = true;
    this.phase = 'settling';
    this.hud.root.dataset.phase = 'settling';
    this.hud.stage.classList.add('nw-solved');

    const outcome = completeLevel(this.session, Date.now());
    this.session = outcome.state;
    this.updateChrome();
    this.renderEquation();

    this.context.emit('game:progress', {
      step: outcome.step,
      total: this.levels.length,
      detail: `${level.mode} ${level.dividend}÷${level.divisor}`
    });
    this.context.emit('game:score', {
      points: this.session.score,
      streak: this.session.streak,
      delta: outcome.delta
    });
    if (outcome.complete && !this.completeEmitted) {
      this.completeEmitted = true;
      const total = this.levels.length;
      this.context.emit('game:complete', {
        stars: computeStars(this.session.mistakes, total),
        score: this.session.score,
        timeElapsed: elapsedSeconds(this.session, Date.now()),
        summary: this.summaryText()
      });
    }

    this.shellTimers.set(() => this.celebrate(outcome.complete), SETTLE_MS);
  }

  private celebrate(last: boolean): void {
    this.phase = 'celebrating';
    this.hud.root.dataset.phase = 'celebrating';
    this.context.audio.playSuccess();
    if (!this.reducedMotion) {
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
      } catch {
        // Canvas is missing in headless environments.
      }
    }
    this.hud.banner.textContent = this.context.t('wellDone');
    this.hud.banner.classList.add('show');
    this.shellTimers.set(() => {
      this.hud.banner.classList.remove('show');
      if (last) this.showEnd();
      else this.mountLevel(this.levelIndex + 1);
    }, CELEBRATE_MS);
  }

  private summaryText(): string {
    const m = this.session.mistakes;
    return this.dict.summary(this.fmt(this.levels.length), mistakesText(this.lang, this.fmt(m), m));
  }

  private showEnd(): void {
    this.phase = 'complete';
    this.hud.root.dataset.phase = 'complete';
    this.teardownLevel();
    this.hud.stage.hidden = true;
    this.renderEnd();
    this.hud.end.hidden = false;
  }

  private renderEnd(): void {
    const stars = computeStars(this.session.mistakes, this.levels.length);
    this.hud.endStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.hud.endStars.setAttribute('aria-label', this.dict.starsLabel(stars));
    this.hud.endScore.textContent = `${this.context.t('score')}: ${this.fmt(this.session.score)}`;
    this.hud.endSummary.textContent = this.summaryText();
    this.updateChrome();
  }

  // -------------------------------------------------------------------------
  // Pause / resume
  // -------------------------------------------------------------------------

  private syncActive(): void {
    const active = this.isActive;
    this.hud.root.classList.toggle('nw-paused', !active && this.started);
    if (active) {
      this.session = resumeSession(this.session, Date.now());
      this.shellTimers.thaw();
      this.levelTimers.thaw();
    } else {
      this.session = pauseSession(this.session, Date.now());
      this.shellTimers.freeze();
      this.levelTimers.freeze();
    }
    this.controller?.setPaused(!active);
  }
}

export function createGame(): KidGame {
  return new NumberWorkshopGame();
}

export default createGame;
