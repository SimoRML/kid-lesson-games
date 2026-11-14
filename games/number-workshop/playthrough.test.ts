/**
 * Automated cross-mode play-through: a scripted "child" plays whole sessions
 * through the public DOM of the shell, at every age x difficulty and on the
 * 25-level sample sheet, and every session must end solved, once, with no
 * mistake. This replaces nothing a human play-test checks (feel, hints read by
 * a child), but it proves every level the generator and the preset can
 * produce is actually solvable through the real controls.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import type { AgeGroup, Difficulty, GameContext } from '../../src/core/types.js';
import { divide, longDivisionTrace, shiftCount, type ShiftDivisor } from './division.js';
import { CELEBRATE_MS, NumberWorkshopGame, SETTLE_MS } from './index.js';
import { generateLevelsForAge, type Level, type Rng } from './levels.js';
import { buildPlan, quotientOf } from './modes/long.js';
import { factsTier } from './modes/facts.js';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

/** The 25-level sheet, read from the playground preset so the two can never drift apart. */
const SHEET: Level[] = (() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const match = /\/\*nw-sheet-preset\*\/([\s\S]*?)\/\*end-nw-sheet-preset\*\//.exec(html);
  if (!match) throw new Error('sheet preset markers not found in index.html');
  return JSON.parse(match[1]) as Level[];
})();

function seeded(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Session {
  container: HTMLElement;
  game: NumberWorkshopGame;
  emit: ReturnType<typeof vi.fn>;
}

function start(ageGroup: AgeGroup, difficulty: Difficulty, customLevels?: unknown): Session {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const i18n = new I18nManager('en');
  const emit = vi.fn();
  const context: GameContext = {
    ageGroup,
    difficulty,
    sound: false,
    locale: 'en',
    customLevels,
    audio: new SoundEngine(false),
    i18n,
    t: (k, p) => i18n.t(k, p),
    emit: emit as unknown as GameContext['emit']
  };
  const game = new NumberWorkshopGame();
  game.mount(container, context);
  game.start();
  return { container, game, emit };
}

const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('missing control');
  (el as HTMLElement).click();
};
const key = (c: HTMLElement, d: string) =>
  click(Array.from(c.querySelectorAll('.nw-key')).find((k) => k.textContent === d));

/** Plays one level like a careful child would. */
function play(c: HTMLElement, level: Level, difficulty: Difficulty): void {
  const { q, r } = divide(level.dividend, level.divisor);
  switch (level.mode) {
    case 'facts': {
      if (factsTier(level.dividend) === 'array') {
        for (let i = 0; i < q; i++) click(c.querySelectorAll('.nw-gb-btn')[1]);
        click(c.querySelector('.nw-check'));
      } else {
        const plates = Array.from(c.querySelectorAll('.nw-plate-btn'));
        for (let i = 0; i < q; i++) plates.forEach((p) => click(p));
      }
      return;
    }
    case 'shift': {
      for (let i = 0; i < shiftCount(level.divisor as ShiftDivisor); i++) {
        click(c.querySelectorAll('.nw-shift-buttons .nw-btn')[1]);
      }
      click(c.querySelector('.nw-check'));
      return;
    }
    case 'euclid': {
      for (let i = 0; i < q; i++) click(c.querySelectorAll('.nw-gb-btn')[1]);
      for (const d of String(r)) key(c, d);
      click(c.querySelector('.nw-check'));
      return;
    }
    case 'long': {
      const trace = longDivisionTrace(level.dividend, level.divisor);
      for (const item of buildPlan(trace.length, difficulty)) {
        const step = trace[item.step];
        if (item.kind === 'bring') {
          click(c.querySelector('.nw-lbring'));
          continue;
        }
        const value =
          item.kind === 'digit' ? step.digit
          : item.kind === 'product' ? step.product
          : item.kind === 'remainder' ? step.remainder
          : item.kind === 'eqQ' ? quotientOf(trace)
          : trace[trace.length - 1].remainder;
        for (const d of String(value)) key(c, d);
        click(c.querySelector('.nw-check'));
      }
    }
  }
}

function playAll(s: Session, levels: Level[], difficulty: Difficulty): void {
  for (const level of levels) {
    play(s.container, level, difficulty);
    vi.advanceTimersByTime(SETTLE_MS + CELEBRATE_MS);
  }
}

const events = (s: Session, type: string) => s.emit.mock.calls.filter((c) => c[0] === type).map((c) => c[1]);

describe('automated cross-mode play-through', () => {
  const sessions: Session[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    sessions.splice(0).forEach((s) => {
      s.game.destroy();
      s.container.remove();
    });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const AGES: AgeGroup[] = ['3-5', '6-8', '9-11'];
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

  for (const age of AGES) {
    for (const diff of DIFFS) {
      it(`plays complete procedural sessions at ${age} / ${diff} to three stars`, { timeout: 60_000 }, () => {
        for (const seed of [1, 7, 42]) {
          vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
          const expected = generateLevelsForAge(age, diff, seeded(seed));
          const s = start(age, diff);
          sessions.push(s);
          expect(s.container.querySelector('.nw-badge')?.textContent).toBe(`1/${expected.length}`);
          playAll(s, expected, diff);
          expect(events(s, 'game:progress')).toHaveLength(expected.length);
          const done = events(s, 'game:complete') as Array<{ stars: number; score: number }>;
          expect(done).toHaveLength(1);
          expect(done[0].stars).toBe(3);
          expect(done[0].score).toBe(expected.length * 150);
          expect((s.container.querySelector('.nw-end') as HTMLElement).hidden).toBe(false);
          vi.restoreAllMocks();
        }
      });
    }
  }

  it('a complete 9-11 session uses all four modes at medium and hard', () => {
    for (const diff of ['medium', 'hard'] as Difficulty[]) {
      const modes = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5]) {
        generateLevelsForAge('9-11', diff, seeded(seed)).forEach((l) => modes.add(l.mode));
      }
      expect([...modes].sort()).toEqual(['euclid', 'facts', 'long', 'shift']);
    }
  });

  it('plays the 25-level sample sheet to the end at every difficulty', { timeout: 60_000 }, () => {
    for (const diff of DIFFS) {
      const s = start('9-11', diff, SHEET);
      sessions.push(s);
      expect(s.container.querySelector('.nw-badge')?.textContent).toBe('1/25');
      playAll(s, SHEET, diff);
      const done = events(s, 'game:complete') as Array<{ stars: number; score: number }>;
      expect(done).toHaveLength(1);
      expect(done[0]).toMatchObject({ stars: 3, score: 25 * 150 });
    }
  });
});
