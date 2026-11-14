import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import type { AgeGroup, Difficulty, GameContext } from '../../src/core/types.js';
import createGameDefault, {
  CELEBRATE_MS,
  createGame,
  generateLevelsForAge,
  NumberWorkshopGame,
  parseCustomLevels,
  SETTLE_MS
} from './index.js';
import { MODE_REGISTRY } from './modes/index.js';
import { BUILT_MODES } from './modes/types.js';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const SET_A = [
  { mode: 'facts', dividend: 4, divisor: 2 },
  { mode: 'facts', dividend: 6, divisor: 3 }
];
const SET_B = [{ mode: 'facts', dividend: 8, divisor: 2 }];

interface Setup {
  game: NumberWorkshopGame;
  container: HTMLElement;
  context: GameContext;
  emit: ReturnType<typeof vi.fn>;
  audio: SoundEngine;
  i18n: I18nManager;
}

function setup(over: Partial<{ ageGroup: AgeGroup; difficulty: Difficulty; locale: string; customLevels: unknown; autostart: boolean }> = {}): Setup {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const audio = new SoundEngine(false);
  const i18n = new I18nManager(over.locale ?? 'en');
  const emit = vi.fn();
  const context: GameContext = {
    ageGroup: over.ageGroup ?? '6-8',
    difficulty: over.difficulty ?? 'medium',
    sound: false,
    locale: over.locale ?? 'en',
    customLevels: over.customLevels,
    audio,
    i18n,
    t: (k, p) => i18n.t(k, p),
    emit: emit as unknown as GameContext['emit']
  };
  const game = new NumberWorkshopGame();
  game.mount(container, context);
  if (over.autostart !== false) game.start();
  return { game, container, context, emit, audio, i18n };
}

const q = <T extends HTMLElement>(s: Setup, sel: string) => s.container.querySelector<T>(sel);
const badge = (s: Setup) => q(s, '.nw-badge')?.textContent;
const plateBtns = (s: Setup) => Array.from(s.container.querySelectorAll<HTMLButtonElement>('.nw-plate-btn'));
const plateCounts = (s: Setup) => plateBtns(s).map((b) => b.textContent);
const events = (s: Setup, type: string) => s.emit.mock.calls.filter((c) => c[0] === type).map((c) => c[1]);

/** Solves the current share-tier level by giving each plate `each` tokens. */
function solveShare(s: Setup, each: number): void {
  for (let k = 0; k < each; k++) plateBtns(s).forEach((b) => b.click());
}
const settleAndAdvance = () => vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS);

describe('number-workshop shell', () => {
  let s: Setup;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    s?.game.destroy();
    s?.container.remove();
    vi.useRealTimers();
  });

  describe('module surface', () => {
    it('lists exactly the registered modes as built', () => {
      expect([...BUILT_MODES].sort()).toEqual(Object.keys(MODE_REGISTRY).sort());
    });

    it('exports the factory, the default export and the contract helpers', () => {
      expect(createGame()).toBeInstanceOf(NumberWorkshopGame);
      expect(createGameDefault()).toBeInstanceOf(NumberWorkshopGame);
      expect(typeof generateLevelsForAge).toBe('function');
      expect(parseCustomLevels(SET_A)).toHaveLength(2);
    });
  });

  describe('playground preset', () => {
    it('the facts preset in index.html round-trips through parseCustomLevels', () => {
      const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
      const match = /\/\*nw-facts-preset\*\/([\s\S]*?)\/\*end-nw-facts-preset\*\//.exec(html);
      expect(match).not.toBeNull();
      const raw: unknown = JSON.parse(match![1]);
      const parsed = parseCustomLevels(raw);
      expect(parsed).toHaveLength((raw as unknown[]).length);
      // The preset exercises every tier and a remainder.
      expect(parsed?.map((l) => l.dividend)).toEqual([12, 27, 25, 63, 47]);
    });
  });

  describe('mount and start', () => {
    it('renders the HUD with a level badge in English and in French', () => {
      s = setup({ ageGroup: '3-5' });
      expect(badge(s)).toBe('1/3');
      expect(q(s, '.nw-title')?.textContent).toBe('Division Workshop');
      expect(q(s, '.nw-reset')?.textContent).toContain('Reset');
      s.game.destroy();
      s = setup({ ageGroup: '3-5', locale: 'fr' });
      expect(q(s, '.nw-title')?.textContent).toBe('Atelier de division');
      expect(q(s, '.nw-reset')?.textContent).toContain('Réinitialiser');
    });

    it('mounts without ResizeObserver, matchMedia or PointerEvent (jsdom defaults)', () => {
      expect(typeof (globalThis as { PointerEvent?: unknown }).PointerEvent).toBe('undefined');
      expect(() => (s = setup())).not.toThrow();
    });

    it('falls back to procedural levels for garbage customLevels and English for a bad locale', () => {
      for (const junk of ['{nope', 42, [], [{ mode: 'facts', dividend: 'x' }], { levels: 'no' }]) {
        s = setup({ ageGroup: '3-5', customLevels: junk, locale: '<bad>' });
        expect(badge(s)).toBe('1/3');
        expect(q(s, '.nw-title')?.textContent).toBe('Division Workshop');
        s.game.destroy();
      }
    });

    it('plays custom levels as supplied', () => {
      s = setup({ customLevels: SET_A });
      expect(badge(s)).toBe('1/2');
      expect(plateBtns(s)).toHaveLength(2);
    });

    it('never builds elements from markup-looking level data', () => {
      s = setup({
        customLevels: [
          { mode: 'facts', dividend: 4, divisor: 2, instruction: '<img src=x onerror=alert(1)>', theme: '<svg onload=1>' }
        ]
      });
      expect(s.container.querySelector('img')).toBeNull();
      expect(s.container.querySelector('[onerror],[onload]')).toBeNull();
      expect(s.container.textContent).not.toContain('onerror');
    });

    it('ignores input until start()', () => {
      s = setup({ customLevels: SET_A, autostart: false });
      plateBtns(s)[0].click();
      expect(plateCounts(s)).toEqual(['0', '0']);
      s.game.start();
      plateBtns(s)[0].click();
      expect(plateCounts(s)).toEqual(['1', '0']);
    });
  });

  describe('presentation by age', () => {
    it('ages 3-5 never show a division sign or an equation, even after solving', () => {
      s = setup({ ageGroup: '3-5', customLevels: SET_A });
      const text = () => q(s, '.nw-root')?.textContent ?? '';
      expect(text()).not.toMatch(/[÷=×→]/);
      solveShare(s, 2);
      expect(text()).not.toMatch(/[÷=×→]/);
      expect(q(s, '.nw-equation')?.textContent).toMatch(/Each friend has 2/);
    });

    it('ages 6-8 show the colour-coded equation and write the result into it', () => {
      s = setup({ ageGroup: '6-8', customLevels: SET_A });
      expect(q(s, '.nw-equation')?.textContent).toContain('÷');
      expect(q(s, '.nw-equation .nw-role-quotient .nw-num')?.textContent).toBe('?');
      solveShare(s, 2);
      expect(q(s, '.nw-equation .nw-role-quotient .nw-num')?.textContent).toBe('2');
      expect(q(s, '.nw-sr')?.textContent).toBe('4 ÷ 2 = 2');
    });

    it('writes a remainder into the equation with its own role', () => {
      s = setup({ customLevels: [{ mode: 'facts', dividend: 7, divisor: 3 }] });
      solveShare(s, 2);
      expect(q(s, '.nw-equation .nw-role-remainder .nw-num')?.textContent).toBe('1');
      expect(q(s, '.nw-sr')?.textContent).toBe('7 ÷ 3 = 2 r 1');
    });
  });

  describe('level flow and telemetry', () => {
    it('settles, celebrates and advances; emits progress and score per level and complete once', () => {
      s = setup({ customLevels: SET_A });
      solveShare(s, 2);
      expect(events(s, 'game:progress')).toEqual([{ step: 1, total: 2, detail: 'facts 4÷2' }]);
      expect(events(s, 'game:score')).toEqual([{ points: 150, streak: 1, delta: 150 }]);
      expect(badge(s)).toBe('1/2');
      expect(q(s, '.nw-stage')?.classList.contains('nw-solved')).toBe(true);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(q(s, '.nw-banner')?.classList.contains('show')).toBe(true);
      vi.advanceTimersByTime(CELEBRATE_MS);
      expect(badge(s)).toBe('2/2');
      expect(q(s, '.nw-banner')?.classList.contains('show')).toBe(false);

      solveShare(s, 2);
      expect(events(s, 'game:complete')).toHaveLength(1);
      const done = events(s, 'game:complete')[0] as { stars: number; score: number };
      expect([1, 2, 3]).toContain(done.stars);
      expect(done.stars).toBe(3);
      expect(done.score).toBe(300);
      settleAndAdvance();
      vi.advanceTimersByTime(60_000);
      expect(events(s, 'game:complete')).toHaveLength(1);
      expect(q(s, '.nw-end')?.hidden).toBe(false);
      expect(q(s, '.nw-end-summary')?.textContent).toBe('2 levels, no mistakes');
      expect(q(s, '.nw-end-stars')?.getAttribute('aria-label')).toBe('3 out of 3 stars');
    });

    it('does not restart by itself; Play again starts a new run', () => {
      s = setup({ customLevels: SET_B });
      solveShare(s, 4);
      settleAndAdvance();
      vi.advanceTimersByTime(30_000);
      expect(q(s, '.nw-end')?.hidden).toBe(false);
      q(s, '.nw-again')?.click();
      expect(q(s, '.nw-end')?.hidden).toBe(true);
      expect(badge(s)).toBe('1/1');
      expect(q(s, '.nw-score')?.textContent).toContain('0');
      solveShare(s, 4);
      expect(events(s, 'game:complete')).toHaveLength(2);
    });

    it('Play again draws a fresh procedural set when no custom levels are active', () => {
      s = setup({ ageGroup: '3-5' });
      const total = generateLevelsForAge('3-5', 'medium').length;
      expect(total).toBe(3);
      q(s, '.nw-again')?.click();
      expect(badge(s)).toBe('1/3');
    });

    it('reset restarts only the current level, keeping score and level index', () => {
      s = setup({ customLevels: SET_A });
      solveShare(s, 2);
      settleAndAdvance();
      plateBtns(s)[0].click();
      expect(plateCounts(s)[0]).toBe('1');
      q(s, '.nw-reset')?.click();
      expect(plateCounts(s)).toEqual(['0', '0', '0']);
      expect(badge(s)).toBe('2/2');
      expect(q(s, '.nw-score')?.textContent).toContain('150');
    });

    it('reset during the settle window does nothing', () => {
      s = setup({ customLevels: SET_B });
      solveShare(s, 4);
      q(s, '.nw-reset')?.click();
      expect(plateCounts(s)).toEqual(['4', '4']);
    });
  });

  describe('pause and resume', () => {
    it('blocks input while paused and continues after resume', () => {
      s = setup({ customLevels: SET_A });
      s.game.pause();
      plateBtns(s)[0].click();
      expect(plateCounts(s)).toEqual(['0', '0']);
      s.game.resume();
      plateBtns(s)[0].click();
      expect(plateCounts(s)).toEqual(['1', '0']);
    });

    it('freezes the pending advance and thaws it with the remaining time', () => {
      s = setup({ customLevels: SET_A });
      solveShare(s, 2);
      vi.advanceTimersByTime(SETTLE_MS + 500);
      s.game.pause();
      vi.advanceTimersByTime(60_000);
      expect(badge(s)).toBe('1/2');
      s.game.resume();
      vi.advanceTimersByTime(CELEBRATE_MS - 500 - 1);
      expect(badge(s)).toBe('1/2');
      vi.advanceTimersByTime(2);
      expect(badge(s)).toBe('2/2');
    });

    it('excludes paused time from timeElapsed', () => {
      s = setup({ customLevels: SET_B });
      vi.advanceTimersByTime(3000);
      s.game.pause();
      vi.advanceTimersByTime(100_000);
      s.game.resume();
      vi.advanceTimersByTime(2000);
      solveShare(s, 4);
      const done = events(s, 'game:complete')[0] as { timeElapsed: number };
      expect(done.timeElapsed).toBe(5);
    });
  });

  describe('updateConfig', () => {
    it('sound and locale changes never reset progress (host resends the whole config)', () => {
      s = setup({ ageGroup: '3-5' });
      plateBtns(s)[0].click();
      s.game.updateConfig({
        ageGroup: '3-5',
        difficulty: 'medium',
        sound: false,
        locale: 'en',
        customLevels: null,
        audio: s.audio
      });
      expect(plateCounts(s)[0]).toBe('1');
      expect(badge(s)).toBe('1/3');

      s.i18n.locale = 'fr';
      s.game.updateConfig({ locale: 'fr', sound: false, customLevels: null });
      expect(plateCounts(s)[0]).toBe('1');
      expect(q(s, '.nw-title')?.textContent).toBe('Atelier de division');
      expect(q(s, '.nw-instruction')?.textContent).toMatch(/amis/);
      expect(q(s, '.nw-reset')?.textContent).toContain('Réinitialiser');
    });

    it('keeps emit after a partial update (merge, not replace)', () => {
      s = setup({ customLevels: SET_B });
      s.game.updateConfig({ sound: true });
      solveShare(s, 4);
      expect(events(s, 'game:progress')).toHaveLength(1);
    });

    it('applies sound to the shared audio engine and the HUD label', () => {
      s = setup({ ageGroup: '3-5' });
      s.game.updateConfig({ sound: true });
      expect(s.audio.enabled).toBe(true);
      expect(q(s, '.nw-sound')?.textContent).toContain('ON');
      q(s, '.nw-sound')?.click();
      expect(s.audio.enabled).toBe(false);
      expect(q(s, '.nw-sound')?.textContent).toContain('OFF');
    });

    it('a different custom set restarts; the same set resent does not', () => {
      s = setup({ customLevels: SET_A });
      plateBtns(s)[0].click();
      s.game.updateConfig({ customLevels: JSON.stringify(SET_A) });
      expect(plateCounts(s)).toEqual(['1', '0']);
      s.game.updateConfig({ customLevels: SET_B });
      expect(plateCounts(s)).toEqual(['0', '0']);
      expect(badge(s)).toBe('1/1');
    });

    it('switching between custom and procedural levels restarts in both directions', () => {
      s = setup({ ageGroup: '3-5' });
      plateBtns(s)[0].click();
      s.game.updateConfig({ customLevels: SET_B });
      expect(badge(s)).toBe('1/1');
      expect(plateCounts(s)).toEqual(['0', '0']);
      plateBtns(s)[0].click();
      s.game.updateConfig({ customLevels: null });
      expect(badge(s)).toBe('1/3');
      expect(plateCounts(s)[0]).toBe('0');
    });

    it('a difficulty change restarts a custom set and a procedural one', () => {
      s = setup({ customLevels: SET_A, difficulty: 'easy' });
      solveShare(s, 2);
      settleAndAdvance();
      expect(badge(s)).toBe('2/2');
      s.game.updateConfig({ difficulty: 'hard' });
      expect(badge(s)).toBe('1/2');
      expect(q(s, '.nw-score')?.textContent).toContain('0');
      s.game.destroy();

      s = setup({ ageGroup: '3-5', difficulty: 'easy' });
      plateBtns(s)[0].click();
      s.game.updateConfig({ difficulty: 'hard' });
      expect(plateCounts(s)[0]).toBe('0');
    });

    it('an age change restarts procedural play but not a custom set', () => {
      s = setup({ ageGroup: '3-5' });
      s.game.updateConfig({ ageGroup: '6-8' });
      expect(badge(s)).toBe('1/4');
      s.game.destroy();

      s = setup({ ageGroup: '6-8', customLevels: SET_A });
      solveShare(s, 2);
      settleAndAdvance();
      s.game.updateConfig({ ageGroup: '3-5' });
      expect(badge(s)).toBe('2/2');
      expect(q(s, '.nw-score')?.textContent).toContain('150');
      expect(q(s, '.nw-equation')?.hidden).toBe(true);
    });

    it('ignores updates after destroy', () => {
      s = setup({ customLevels: SET_A });
      s.game.destroy();
      expect(() => s.game.updateConfig({ locale: 'fr' })).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('empties the container, leaves no timers and no window listeners', () => {
      s = setup({ customLevels: SET_A });
      const token = q(s, '.nw-tray-token') as HTMLElement;
      token.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
      solveShare(s, 2);
      const close = vi.spyOn(s.audio, 'close');
      s.game.destroy();
      expect(s.container.children).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(close).not.toHaveBeenCalled();
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 99, clientY: 99, bubbles: true }));
      expect(s.container.children).toHaveLength(0);
    });

    it('does not emit anything after destroy even if timers were pending', () => {
      s = setup({ customLevels: SET_A });
      solveShare(s, 2);
      const before = s.emit.mock.calls.length;
      s.game.destroy();
      vi.advanceTimersByTime(10_000);
      expect(s.emit.mock.calls.length).toBe(before);
    });
  });
});
