import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext } from '../../src/core/types.js';
import {
  CELEBRATE_MS,
  CandyFactoryGame,
  computeStars,
  createGame,
  generateLevelsForAge,
  orderPoints,
  parseCustomLevels,
  SETTLE_MS
} from './index.js';
import { writtenAddition, toDigits } from './numbers.js';
import { CountView } from './views/count.js';
import { CompareView } from './views/compare.js';
import { PackView } from './views/pack.js';
import { MysteryView, RobotView, WrittenAddView } from './views/written.js';
import { EstimateView } from './views/estimate.js';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

function makeContext(overrides: Partial<GameContext> = {}): GameContext {
  return {
    ageGroup: '6-8',
    difficulty: 'medium',
    locale: 'en',
    sound: true,
    audio: {
      enabled: true,
      playClick: vi.fn(),
      playPop: vi.fn(),
      playDrop: vi.fn(),
      playChime: vi.fn(),
      playSuccess: vi.fn(),
      playError: vi.fn(),
      playTone: vi.fn(),
      close: vi.fn()
    } as unknown as GameContext['audio'],
    i18n: {} as unknown as GameContext['i18n'],
    t: vi.fn((key: string) => key),
    emit: vi.fn(),
    ...overrides
  };
}

function q<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const found = root.querySelector<T>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
}

function clickKey(root: ParentNode, d: number): void {
  q<HTMLButtonElement>(root, `.cf-key[data-digit="${d}"]`).click();
}

/** Solves whatever level is on screen, through the DOM. */
function solveCurrent(game: CandyFactoryGame, container: HTMLElement): void {
  const { view } = game.debugState;
  if (view instanceof CountView) {
    const level = game.debugState.level;
    if (level?.mode !== 'count') throw new Error('bad level');
    for (let i = 0; i < level.target; i++) q<HTMLButtonElement>(container, '.cf-jar').click();
    q<HTMLButtonElement>(container, '.cf-ship').click();
  } else if (view instanceof CompareView) {
    q<HTMLButtonElement>(container, `[data-key="jar-${view.answer}"]`).click();
  } else if (view instanceof PackView) {
    for (let c = 0; c < view.columns - 1; c++) {
      while (view.counts[c] + view.funnel[c] >= 10) {
        q<HTMLButtonElement>(container, `[data-key="bin-${c}"]`).click();
      }
    }
    q<HTMLButtonElement>(container, '.cf-ship').click();
    for (const ch of String(view.sum)) clickKey(container, Number(ch));
    q<HTMLButtonElement>(container, '.cf-key-check').click();
  } else if (view instanceof WrittenAddView) {
    const plan = view.plan;
    for (let c = 0; c < plan.resultColumns; c++) {
      const digit = c < plan.termColumns ? plan.steps[c].resultDigit : plan.carries[c];
      clickKey(container, digit);
      if (view.awaitingCarry) {
        for (let k = 0; k < plan.steps[c].carryOut; k++) q<HTMLButtonElement>(container, `[data-key="carry-${c + 1}"]`).click();
      }
    }
  } else if (view instanceof MysteryView) {
    clickKey(container, view.answer);
  } else if (view instanceof RobotView) {
    const level = game.debugState.level;
    if (level?.mode !== 'robot') throw new Error('bad level');
    q<HTMLButtonElement>(container, `[data-key="pick-${level.column}"]`).click();
    clickKey(container, view.correct[level.column]);
  } else if (view instanceof EstimateView) {
    const i = view.options.indexOf(view.answer);
    q<HTMLButtonElement>(container, `[data-key="truck-${i}"]`).click();
  } else {
    throw new Error('no view');
  }
}

describe('Candy Factory cartridge', () => {
  let container: HTMLElement;
  let ctx: GameContext;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    ctx = makeContext();
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it('exports the factory and the curriculum helpers', () => {
    expect(createGame()).toBeInstanceOf(CandyFactoryGame);
    expect(generateLevelsForAge('9-11').length).toBeGreaterThan(0);
    expect(parseCustomLevels(null)).toBeNull();
  });

  it('scores orders and stars fairly', () => {
    expect(orderPoints(0)).toBe(100);
    expect(orderPoints(2)).toBe(60);
    expect(orderPoints(10)).toBe(40);
    expect(computeStars(0, 5)).toBe(3);
    expect(computeStars(1, 5)).toBe(3);
    expect(computeStars(4, 5)).toBe(2);
    expect(computeStars(9, 5)).toBe(1);
  });

  for (const age of ['3-5', '6-8', '9-11'] as const) {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      it(`plays a full ${age} ${difficulty} run to game:complete through the DOM`, () => {
        ctx = makeContext({ ageGroup: age, difficulty });
        const game = new CandyFactoryGame();
        game.mount(container, ctx);
        game.start();
        const total = game.levelList.length;
        for (let i = 0; i < total; i++) {
          expect(game.debugState.levelIndex).toBe(i);
          solveCurrent(game, container);
          expect(game.debugState.phase).toBe('settling');
          vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS + 10);
        }
        expect(game.debugState.phase).toBe('complete');
        expect(ctx.emit).toHaveBeenCalledWith('game:complete', expect.objectContaining({ stars: 3, score: total * 100 }));
        expect(container.querySelector('.cf-end')?.hasAttribute('hidden')).toBe(false);
        game.destroy();
      });
    }
  }

  it('switches 9-11 to written mode automatically after two packed orders', () => {
    ctx = makeContext({
      ageGroup: '9-11',
      customLevels: [
        { mode: 'add', terms: [358, 467] },
        { mode: 'add', terms: [129, 293] },
        { mode: 'add', terms: [2458, 3795] }
      ]
    });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    expect(game.debugState.addView).toBe('physical');
    solveCurrent(game, container);
    vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS + 10);
    expect(game.debugState.addView).toBe('physical');
    solveCurrent(game, container);
    vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS + 10);
    expect(game.debugState.addView).toBe('written');
    expect(q(container, '.cf-banner').textContent).toContain('Written mode');
    game.destroy();
  });

  describe('pack view (carry made physical)', () => {
    function mountAdd(terms: number[], age: GameContext['ageGroup'] = '6-8'): { game: CandyFactoryGame; view: PackView } {
      ctx = makeContext({ ageGroup: age, customLevels: [{ mode: 'add', terms, view: 'physical' }] });
      const game = new CandyFactoryGame();
      game.mount(container, ctx);
      game.start();
      const view = game.debugState.view;
      if (!(view instanceof PackView)) throw new Error('expected pack view');
      return { game, view };
    }

    it('pours 27 + 15 as 3 bags and 12 candies; ten taps make a bag', () => {
      const { game, view } = mountAdd([27, 15]);
      expect(view.counts).toEqual([12, 3]);
      for (let i = 0; i < 9; i++) q<HTMLButtonElement>(container, '[data-key="bin-0"]').click();
      expect(view.funnel[0]).toBe(9);
      q<HTMLButtonElement>(container, '[data-key="bin-0"]').click();
      expect(view.counts).toEqual([2, 4]);
      expect(view.funnel[0]).toBe(0);
      expect(ctx.audio.playPop).toHaveBeenCalled();
      game.destroy();
    });

    it('the truck refuses loose packs (a hint, not a mistake)', () => {
      const { game, view } = mountAdd([27, 15]);
      q<HTMLButtonElement>(container, '.cf-ship').click();
      expect(view.phase).toBe('packing');
      expect(q(container, '.cf-instruction').textContent).toContain('too many loose candies');
      expect(game.debugState.mistakes).toBe(0);
      game.destroy();
    });

    it('tapping the machine gives the funnel back at 6-8 (granular undo)', () => {
      const { game, view } = mountAdd([27, 15]);
      for (let i = 0; i < 4; i++) q<HTMLButtonElement>(container, '[data-key="bin-0"]').click();
      q<HTMLButtonElement>(container, '[data-key="machine-0"]').click();
      expect(view.counts[0]).toBe(12);
      expect(view.funnel[0]).toBe(0);
      game.destroy();
    });

    it('9-11 can pack ten at once by tapping the machine', () => {
      const { game, view } = mountAdd([2458, 3795], '9-11');
      expect(view.counts).toEqual([13, 14, 11, 5]);
      q<HTMLButtonElement>(container, '[data-key="machine-0"]').click();
      expect(view.counts).toEqual([3, 15, 11, 5]);
      game.destroy();
    });

    it('a wrong label is a mistake; the right one ships', () => {
      const { game, view } = mountAdd([27, 15]);
      for (let i = 0; i < 10; i++) q<HTMLButtonElement>(container, '[data-key="bin-0"]').click();
      q<HTMLButtonElement>(container, '.cf-ship').click();
      expect(view.phase).toBe('label');
      clickKey(container, 3);
      clickKey(container, 2);
      q<HTMLButtonElement>(container, '.cf-key-check').click();
      expect(game.debugState.mistakes).toBe(1);
      clickKey(container, 4);
      clickKey(container, 2);
      q<HTMLButtonElement>(container, '.cf-key-check').click();
      expect(game.debugState.phase).toBe('settling');
      game.destroy();
    });
  });

  describe('written view', () => {
    function mountWritten(terms: number[]): { game: CandyFactoryGame; view: WrittenAddView } {
      ctx = makeContext({ ageGroup: '9-11', customLevels: [{ mode: 'add', terms, view: 'written' }] });
      const game = new CandyFactoryGame();
      game.mount(container, ctx);
      game.start();
      const view = game.debugState.view;
      if (!(view instanceof WrittenAddView)) throw new Error('expected written view');
      return { game, view };
    }

    it('requires the carry box after a column of 10 or more', () => {
      const { game, view } = mountWritten([5684, 2473, 98]);
      clickKey(container, 5); // 4 + 3 + 8 = 15
      expect(view.awaitingCarry).toBe(true);
      clickKey(container, 7); // typing is blocked until the carry is set
      expect(view.column).toBe(0);
      q<HTMLButtonElement>(container, '[data-key="carry-1"]').click();
      expect(view.column).toBe(1);
      expect(view.carries[1]).toBe(1);
      // 8 + 7 + 9 + 1 = 25: carry 2 needs two taps.
      clickKey(container, 5);
      q<HTMLButtonElement>(container, '[data-key="carry-2"]').click();
      expect(view.awaitingCarry).toBe(true);
      q<HTMLButtonElement>(container, '[data-key="carry-2"]').click();
      expect(view.column).toBe(2);
      expect(game.debugState.mistakes).toBe(0);
      game.destroy();
    });

    it('a wrong digit or an unneeded carry is a mistake', () => {
      const { game, view } = mountWritten([123, 456]);
      clickKey(container, 8);
      expect(game.debugState.mistakes).toBe(1);
      q<HTMLButtonElement>(container, '[data-key="carry-1"]').click();
      expect(view.carries[1]).toBe(0);
      expect(game.debugState.mistakes).toBe(2);
      game.destroy();
    });

    it('writes the final carry as the leading digit', () => {
      const { game, view } = mountWritten([958, 67]);
      const plan = writtenAddition([958, 67]);
      for (let c = 0; c < plan.termColumns; c++) {
        clickKey(container, plan.steps[c].resultDigit);
        if (view.awaitingCarry) q<HTMLButtonElement>(container, `[data-key="carry-${c + 1}"]`).click();
      }
      expect(view.column).toBe(3);
      expect(q(container, '.cf-instruction').textContent).toContain('last carry');
      clickKey(container, 1);
      expect(view.done).toBe(true);
      expect(game.debugState.phase).toBe('settling');
      game.destroy();
    });

    it('physical keyboard digits work while focus is in the game', () => {
      const { game, view } = mountWritten([123, 456]);
      q(container, '.cf-key').dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }));
      expect(view.result[0]).toBe(9);
      game.destroy();
    });
  });

  it('robot: tapping a right digit is a mistake; the wrong one then the fix solves', () => {
    ctx = makeContext({ ageGroup: '9-11', customLevels: [{ mode: 'robot', terms: [5972, 2956] }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    const view = game.debugState.view as RobotView;
    expect(view.robotDigits).not.toEqual(toDigits(8928));
    q<HTMLButtonElement>(container, '[data-key="pick-0"]').click();
    expect(game.debugState.mistakes).toBe(1);
    q<HTMLButtonElement>(container, '[data-key="pick-2"]').click();
    expect(view.phase).toBe('fix');
    clickKey(container, 9);
    expect(game.debugState.phase).toBe('settling');
    game.destroy();
  });

  it('count: ten candies become a bag, extra candies can be taken back', () => {
    ctx = makeContext({ ageGroup: '3-5', customLevels: [{ mode: 'count', target: 12 }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    for (let i = 0; i < 13; i++) q<HTMLButtonElement>(container, '.cf-jar').click();
    expect(container.querySelectorAll('.cf-bag-area .cf-bag').length).toBe(1);
    q<HTMLButtonElement>(container, '.cf-ship').click();
    expect(game.debugState.mistakes).toBe(1);
    const loose = container.querySelectorAll<HTMLButtonElement>('.cf-bag-area .cf-piece:not(:disabled)');
    loose[loose.length - 1].click();
    q<HTMLButtonElement>(container, '.cf-ship').click();
    expect(game.debugState.phase).toBe('settling');
    game.destroy();
  });

  it('ignores input before start and while paused; freezes timers', () => {
    ctx = makeContext({ ageGroup: '3-5', customLevels: [{ mode: 'count', target: 1 }, { mode: 'count', target: 2 }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    q<HTMLButtonElement>(container, '.cf-jar').click();
    expect((game.debugState.view as CountView).current).toBe(0);
    game.start();
    game.pause();
    q<HTMLButtonElement>(container, '.cf-jar').click();
    expect((game.debugState.view as CountView).current).toBe(0);
    game.resume();
    q<HTMLButtonElement>(container, '.cf-jar').click();
    q<HTMLButtonElement>(container, '.cf-ship').click();
    game.pause();
    vi.advanceTimersByTime(10_000);
    expect(game.debugState.levelIndex).toBe(0);
    game.resume();
    vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS + 10);
    expect(game.debugState.levelIndex).toBe(1);
    game.destroy();
  });

  it('updateConfig: locale changes live, age/difficulty regenerate, emit is kept', () => {
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    game.updateConfig({ locale: 'fr' });
    expect(q(container, '.cf-title').textContent).toBe('La Fabrique de Bonbons');
    expect(q(container, '.cf-badge').textContent).toContain('Commande');
    game.updateConfig({ ageGroup: '3-5' });
    expect(['count', 'compare']).toContain(game.debugState.level?.mode);
    game.updateConfig({ customLevels: [{ mode: 'estimate', terms: [2878, 1289] }] });
    expect(game.debugState.view).toBeInstanceOf(EstimateView);
    solveCurrent(game, container);
    expect(ctx.emit).toHaveBeenCalledWith('game:progress', expect.objectContaining({ step: 1, total: 1 }));
    game.updateConfig({ sound: false });
    expect(ctx.audio.enabled).toBe(false);
    game.destroy();
  });

  it('reset rebuilds the current order without losing progress', () => {
    ctx = makeContext({ customLevels: [{ mode: 'add', terms: [27, 15], view: 'physical' }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    for (let i = 0; i < 5; i++) q<HTMLButtonElement>(container, '[data-key="bin-0"]').click();
    q<HTMLButtonElement>(container, '.cf-reset').click();
    expect((game.debugState.view as PackView).counts).toEqual([12, 3]);
    game.destroy();
  });

  it('destroy leaves no DOM, timers or listeners behind', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    ctx = makeContext({ ageGroup: '3-5', customLevels: [{ mode: 'count', target: 1 }, { mode: 'count', target: 1 }] });
    // Detached on purpose: jsdom schedules its own timer when a <style> joins the document.
    const detached = document.createElement('div');
    const game = new CandyFactoryGame();
    game.mount(detached, ctx);
    game.start();
    q<HTMLButtonElement>(detached, '.cf-jar').click();
    q<HTMLButtonElement>(detached, '.cf-ship').click();
    expect(vi.getTimerCount()).toBe(1);
    game.destroy();
    expect(detached.childNodes.length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(ctx.emit).not.toHaveBeenCalledWith('game:complete', expect.anything());
    expect(ctx.audio.close).not.toHaveBeenCalled();
    // No window listeners are attached without a drag in progress.
    expect(addSpy).not.toHaveBeenCalled();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('dragging shows one candy under the pointer; a reset mid-drag removes it', () => {
    ctx = makeContext({ customLevels: [{ mode: 'add', terms: [27, 15], view: 'physical' }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    const bin = q<HTMLButtonElement>(container, '[data-key="bin-0"]');
    bin.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }));
    expect(container.querySelectorAll('.cf-ghost .cf-candy').length).toBe(1);
    q<HTMLButtonElement>(container, '.cf-reset').click();
    expect(container.querySelector('.cf-ghost')).toBeNull();
    game.destroy();
  });

  it('drag listeners on window are removed when the level is torn down mid-drag', () => {
    ctx = makeContext({ ageGroup: '3-5', customLevels: [{ mode: 'count', target: 3 }] });
    const game = new CandyFactoryGame();
    game.mount(container, ctx);
    game.start();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const jar = q<HTMLButtonElement>(container, '.cf-jar');
    jar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(addSpy).toHaveBeenCalled();
    const signals = addSpy.mock.calls.map((c) => (c[2] as AddEventListenerOptions | undefined)?.signal);
    game.destroy();
    expect(signals.every((s) => s?.aborted)).toBe(true);
    addSpy.mockRestore();
  });
});
