/**
 * La Fabrique de Bonbons / Candy Factory: the `candy-factory` cartridge shell.
 *
 * Customers place orders; the child fills and ships them. Packing 10 candies
 * into a bag (10 bags into a box, 10 boxes into a crate) is the carry of column
 * addition, made physical. At ages 9-11 the factory switches automatically to
 * written mode after a few hand-packed orders.
 *
 * The shell owns HUD, level flow, scoring, telemetry, celebration, timers,
 * the sticker shelf and config updates. Each view (views/*) owns its stage.
 */

import confetti from 'canvas-confetti';
import type { GameContext, KidGame } from '../../src/core/types.js';
import { CUSTOMERS, formatNumber, getTranslations, normalizeLocale, type Dictionary, type Lang } from './i18n.js';
import {
  addViewFor,
  generateLevelsForAge,
  levelsSignature,
  parseCustomLevels,
  type AddView,
  type Level
} from './levels.js';
import { STYLES } from './styles.js';
import { CompareView } from './views/compare.js';
import { CountView } from './views/count.js';
import { el } from './views/dom.js';
import { EstimateView } from './views/estimate.js';
import { PackView } from './views/pack.js';
import type { View, ViewHost } from './views/types.js';
import { MysteryView, RobotView, WrittenAddView } from './views/written.js';

export { generateLevelsForAge, parseCustomLevels };

export const GAME_ID = 'candy-factory';
/** Solved state stays on screen so the child sees why it worked. */
export const SETTLE_MS = 700;
/** Celebration before the next order. */
export const CELEBRATE_MS = 1400;
/** How long the "written mode" announcement stays. */
export const INTRO_MS = 2600;

const STICKERS = ['🍭', '🍫', '🍩', '🧁', '🍪', '🍰', '🍦', '🎂', '🍬', '🥮', '🍮', '🍡'];

// ---------------------------------------------------------------------------
// Pausable timers
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

  get size(): number {
    return this.items.size;
  }
}

// ---------------------------------------------------------------------------
// Scoring (pure, exported for tests)
// ---------------------------------------------------------------------------

/** Points for one order: 100, minus 20 per mistake, never below 40. */
export function orderPoints(mistakes: number): number {
  return Math.max(40, 100 - 20 * mistakes);
}

/** 3 stars for at most one mistake, 2 for up to one per order, else 1. */
export function computeStars(mistakes: number, levels: number): 1 | 2 | 3 {
  if (mistakes <= 1) return 3;
  if (mistakes <= Math.max(1, levels)) return 2;
  return 1;
}

interface Hud {
  root: HTMLElement;
  title: HTMLElement;
  badge: HTMLElement;
  instruction: HTMLElement;
  score: HTMLElement;
  soundBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  stage: HTMLElement;
  shelf: HTMLElement;
  banner: HTMLElement;
  end: HTMLElement;
  endStars: HTMLElement;
  endScore: HTMLElement;
  endSummary: HTMLElement;
  againBtn: HTMLButtonElement;
}

type Phase = 'playing' | 'settling' | 'celebrating' | 'complete';

export class CandyFactoryGame implements KidGame {
  private container: HTMLElement | null = null;
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
  private phase: Phase = 'playing';
  private view: View | null = null;
  private currentAddView: AddView | null = null;

  private started = false;
  private paused = false;
  private score = 0;
  private streak = 0;
  private mistakes = 0;
  private levelMistakes = 0;
  private physicalDone = 0;
  private writtenIntroShown = false;
  private stickers: string[] = [];
  private customerOffset = 0;
  private activeMs = 0;
  private activeSince: number | null = null;
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
    // Timers stay frozen until the host calls start().
    this.syncActive();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.context.emit('game:start', { gameId: GAME_ID });
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
      lang: this.lang
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

    const ageChanged = this.context.ageGroup !== prev.age;
    const difficultyChanged = this.context.difficulty !== prev.difficulty;
    const custom = parseCustomLevels(this.context.customLevels);

    if (custom) {
      if (!this.customActive || levelsSignature(custom) !== this.signature || difficultyChanged) {
        this.loadLevels();
        this.beginRun();
        return;
      }
      if (ageChanged && this.phase === 'playing') {
        this.mountLevel(this.levelIndex);
        return;
      }
    } else if (this.customActive || ageChanged || difficultyChanged) {
      this.loadLevels();
      this.beginRun();
      return;
    }
    if (this.lang !== prev.lang) this.applyLocale();
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    this.teardownLevel();
    this.shellTimers.clear();
    this.levelTimers.clear();
    this.container?.replaceChildren();
    this.container = null;
  }

  // -------------------------------------------------------------------------
  // Helpers
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

  private customerFor(index: number): string {
    return CUSTOMERS[(this.customerOffset + index) % CUSTOMERS.length];
  }

  /** Test/inspection hook: the current level, phase and view. */
  get debugState(): { levelIndex: number; phase: Phase; level: Level | undefined; view: View | null; addView: AddView | null; score: number; mistakes: number } {
    return {
      levelIndex: this.levelIndex,
      phase: this.phase,
      level: this.levels[this.levelIndex],
      view: this.view,
      addView: this.currentAddView,
      score: this.score,
      mistakes: this.mistakes
    };
  }

  /** Levels of the current run (copy). */
  get levelList(): Level[] {
    return this.levels.slice();
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private buildHud(): Hud {
    const signal = this.abort!.signal;
    const root = el('div', 'cf-root');
    root.setAttribute('lang', this.lang);

    const bar = el('header', 'cf-hud');
    const left = el('div', 'cf-hud-left');
    const title = el('h2', 'cf-title', this.dict.title);
    const badge = el('span', 'cf-badge');
    left.append(title, badge);
    const instruction = el('div', 'cf-instruction');
    instruction.setAttribute('aria-live', 'polite');
    const right = el('div', 'cf-hud-right');
    const score = el('span', 'cf-score');
    const soundBtn = el('button', 'cf-btn cf-sound');
    soundBtn.type = 'button';
    const resetBtn = el('button', 'cf-btn cf-reset');
    resetBtn.type = 'button';
    right.append(score, soundBtn, resetBtn);
    bar.append(left, instruction, right);

    const stage = el('div', 'cf-stage');
    const shelf = el('div', 'cf-shelf');
    const banner = el('div', 'cf-banner');
    banner.setAttribute('role', 'status');

    const end = el('div', 'cf-end');
    end.hidden = true;
    const endStars = el('div', 'cf-end-stars');
    endStars.setAttribute('role', 'img');
    const endScore = el('div', 'cf-end-score');
    const endSummary = el('div', 'cf-end-summary');
    const againBtn = el('button', 'cf-btn cf-btn-primary cf-again');
    againBtn.type = 'button';
    end.append(endStars, endScore, endSummary, againBtn);

    root.append(bar, stage, shelf, end, banner);

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
        this.mountLevel(this.levelIndex);
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
    return { root, title, badge, instruction, score, soundBtn, resetBtn, stage, shelf, banner, end, endStars, endScore, endSummary, againBtn };
  }

  private updateSoundLabel(): void {
    this.hud.soundBtn.textContent = this.context.t(this.context.audio.enabled ? 'soundOn' : 'soundOff');
  }

  private updateChrome(): void {
    const total = this.levels.length;
    const index = Math.min(this.levelIndex + 1, total);
    const badge = this.dict.levelWord(this.fmt(index), this.fmt(total));
    this.hud.badge.textContent = badge;
    this.hud.score.textContent = `★ ${this.fmt(this.score)}`;
    this.hud.score.setAttribute('aria-label', `${this.context.t('score')}: ${this.fmt(this.score)}`);
    this.hud.resetBtn.textContent = `↺ ${this.context.t('reset')}`;
    this.hud.againBtn.textContent = this.dict.playAgain;
    this.updateSoundLabel();
    this.renderShelf();
  }

  private renderShelf(): void {
    const shelf = this.hud.shelf;
    shelf.replaceChildren();
    shelf.setAttribute('aria-label', this.dict.stickers);
    shelf.appendChild(el('span', 'cf-shelf-label', this.dict.stickers));
    this.stickers.forEach((s, i) => {
      const sticker = el('span', i === this.stickers.length - 1 && this.phase !== 'playing' ? 'cf-sticker' : '', s);
      sticker.setAttribute('aria-hidden', 'true');
      shelf.appendChild(sticker);
    });
  }

  private applyLocale(): void {
    this.hud.title.textContent = this.dict.title;
    this.hud.root.setAttribute('lang', this.lang);
    this.updateChrome();
    if (this.phase === 'complete') this.renderEnd();
    else this.view?.render();
  }

  // -------------------------------------------------------------------------
  // Runs and levels
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

  private beginRun(): void {
    this.shellTimers.clear();
    this.completeEmitted = false;
    this.score = 0;
    this.streak = 0;
    this.mistakes = 0;
    this.physicalDone = 0;
    this.writtenIntroShown = false;
    this.stickers = [];
    this.activeMs = 0;
    this.activeSince = this.isActive ? Date.now() : null;
    this.customerOffset = Math.floor(Math.random() * CUSTOMERS.length);
    this.hud.end.hidden = true;
    this.hud.stage.hidden = false;
    this.hud.shelf.hidden = false;
    this.hud.banner.classList.remove('show', 'cf-banner-info');
    this.mountLevel(0);
  }

  private mountLevel(index: number): void {
    this.teardownLevel();
    this.levelIndex = index;
    this.levelMistakes = 0;
    this.phase = 'playing';
    this.hud.root.dataset.phase = 'playing';
    this.hud.stage.classList.remove('cf-solved');
    this.updateChrome();

    const level = this.levels[index];
    if (!level) return;
    this.levelAbort = new AbortController();
    const host = this.makeHost(this.levelAbort, index);
    const stage = this.hud.stage;
    this.currentAddView = null;

    switch (level.mode) {
      case 'count':
        this.view = new CountView(stage, level, host, index);
        break;
      case 'compare':
        this.view = new CompareView(stage, level, host);
        break;
      case 'add': {
        const view = addViewFor(level, this.context.ageGroup, this.physicalDone);
        this.currentAddView = view;
        if (view === 'written') {
          this.view = new WrittenAddView(stage, level, host);
          if (!level.view && !this.writtenIntroShown) this.showWrittenIntro();
        } else {
          this.view = new PackView(stage, level, host);
        }
        break;
      }
      case 'mystery':
        this.view = new MysteryView(stage, level, host);
        break;
      case 'robot':
        this.view = new RobotView(stage, level, host);
        break;
      case 'estimate':
        this.view = new EstimateView(stage, level, host);
        break;
    }
  }

  private showWrittenIntro(): void {
    this.writtenIntroShown = true;
    const banner = this.hud.banner;
    banner.textContent = this.dict.writtenIntro;
    banner.classList.add('show', 'cf-banner-info');
    this.levelTimers.set(() => banner.classList.remove('show', 'cf-banner-info'), INTRO_MS);
  }

  private teardownLevel(): void {
    this.levelAbort?.abort();
    this.levelAbort = null;
    // The written-mode banner's timer lives in levelTimers, cleared just below:
    // hide that banner here so a reset or config change never leaves it stuck.
    this.hud?.banner.classList.remove('show', 'cf-banner-info');
    this.levelTimers.clear();
    this.view = null;
    this.hud?.stage.replaceChildren();
  }

  private makeHost(abort: AbortController, index: number): ViewHost {
    const game = this;
    const live = (): boolean => !abort.signal.aborted;
    return {
      signal: abort.signal,
      get ageGroup() {
        return game.context.ageGroup;
      },
      get difficulty() {
        return game.context.difficulty;
      },
      get reducedMotion() {
        return game.reducedMotion;
      },
      customer: game.customerFor(index),
      audio: game.context.audio,
      t: () => game.dict,
      fmt: (n) => game.fmt(n),
      isActive: () => live() && game.isActive && game.phase === 'playing',
      setInstruction: (text) => {
        if (live()) game.hud.instruction.textContent = text;
      },
      setTimeout: (fn, ms) => {
        if (live()) game.levelTimers.set(fn, ms);
      },
      mistake: () => {
        if (live() && game.phase === 'playing') {
          game.mistakes++;
          game.levelMistakes++;
          game.streak = 0;
        }
      },
      solved: () => {
        if (live()) game.onSolved();
      }
    };
  }

  // -------------------------------------------------------------------------
  // Solve, celebrate, advance
  // -------------------------------------------------------------------------

  private elapsedSeconds(): number {
    const running = this.activeSince !== null ? Date.now() - this.activeSince : 0;
    return Math.round((this.activeMs + running) / 1000);
  }

  private onSolved(): void {
    if (this.phase !== 'playing') return;
    const level = this.levels[this.levelIndex];
    if (!level) return;
    this.phase = 'settling';
    this.hud.root.dataset.phase = 'settling';
    this.hud.stage.classList.add('cf-solved');
    if (level.mode === 'add' && this.currentAddView === 'physical') this.physicalDone++;

    const delta = orderPoints(this.levelMistakes);
    this.score += delta;
    if (this.levelMistakes === 0) this.streak++;
    this.stickers.push(STICKERS[this.levelIndex % STICKERS.length]);
    this.updateChrome();

    const step = this.levelIndex + 1;
    const total = this.levels.length;
    const complete = step >= total;
    this.context.emit('game:progress', { step, total, detail: `${level.mode} ${step}/${total}` });
    this.context.emit('game:score', { points: this.score, streak: this.streak, delta });
    if (complete && !this.completeEmitted) {
      this.completeEmitted = true;
      this.context.emit('game:complete', {
        stars: computeStars(this.mistakes, total),
        score: this.score,
        timeElapsed: this.elapsedSeconds(),
        summary: this.summaryText()
      });
    }
    this.shellTimers.set(() => this.celebrate(complete), SETTLE_MS);
  }

  private celebrate(last: boolean): void {
    this.phase = 'celebrating';
    this.hud.root.dataset.phase = 'celebrating';
    this.context.audio.playSuccess();
    if (!this.reducedMotion) {
      try {
        confetti({ particleCount: 50, spread: 65, origin: { y: 0.6 }, colors: ['#f472b6', '#38bdf8', '#fb923c', '#4ade80', '#fbbf24'] });
      } catch {
        // No canvas in headless environments.
      }
    }
    const banner = this.hud.banner;
    banner.classList.remove('cf-banner-info');
    banner.textContent = this.context.t('wellDone');
    banner.classList.add('show');
    this.shellTimers.set(() => {
      banner.classList.remove('show');
      if (last) this.showEnd();
      else this.mountLevel(this.levelIndex + 1);
    }, CELEBRATE_MS);
  }

  private summaryText(): string {
    const m = this.mistakes;
    return this.dict.summary(this.fmt(this.levels.length), `${this.fmt(m)} ${this.dict.mistakesWord(m)}`);
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
    const stars = computeStars(this.mistakes, this.levels.length);
    this.hud.endStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.hud.endStars.setAttribute('aria-label', this.dict.starsLabel(stars));
    this.hud.endScore.textContent = `${this.context.t('score')}: ${this.fmt(this.score)}`;
    this.hud.endSummary.textContent = this.summaryText();
    this.hud.instruction.textContent = this.context.t('wellDone');
    this.updateChrome();
  }

  // -------------------------------------------------------------------------
  // Pause / resume
  // -------------------------------------------------------------------------

  private syncActive(): void {
    const active = this.isActive;
    this.hud.root.classList.toggle('cf-paused', !active && this.started);
    if (active) {
      if (this.activeSince === null) this.activeSince = Date.now();
      this.shellTimers.thaw();
      this.levelTimers.thaw();
    } else {
      if (this.activeSince !== null) {
        this.activeMs += Date.now() - this.activeSince;
        this.activeSince = null;
      }
      this.shellTimers.freeze();
      this.levelTimers.freeze();
    }
  }
}

export function createGame(): KidGame {
  return new CandyFactoryGame();
}

export default createGame;
