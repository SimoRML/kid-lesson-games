import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../../src/core/audio.js';
import type { Difficulty } from '../../../src/core/types.js';
import { getTranslations } from '../i18n.js';
import type { Level } from '../levels.js';
import { createEuclidMode, EuclidMode, judgeEuclid } from './euclid.js';
import type { ModeHost } from './types.js';

interface Rig {
  stage: HTMLElement;
  mode: EuclidMode;
  host: ModeHost;
  abort: AbortController;
  instructions: string[];
  mistakes: () => number;
  solved: () => number;
  setLang: (l: 'en' | 'fr') => void;
}

function rig(level: Level, opts: { difficulty?: Difficulty; reducedMotion?: boolean } = {}): Rig {
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  const abort = new AbortController();
  const instructions: string[] = [];
  let mistakes = 0;
  let solved = 0;
  let lang: 'en' | 'fr' = 'en';
  const host: ModeHost = {
    signal: abort.signal,
    difficulty: opts.difficulty ?? 'medium',
    reducedMotion: opts.reducedMotion ?? false,
    symbolFree: false,
    t: () => getTranslations(lang),
    formatNumber: (n) => String(n),
    audio: new SoundEngine(false),
    setInstruction: (text) => instructions.push(text),
    setTimeout: (fn, ms) => void setTimeout(fn, ms),
    reportMistake: () => void mistakes++,
    solved: () => void solved++
  };
  const mode = new EuclidMode();
  mode.mount(stage, level, host);
  return {
    stage, mode, host, abort, instructions,
    mistakes: () => mistakes,
    solved: () => solved,
    setLang: (l) => void (lang = l)
  };
}

const euclid = (dividend: number, divisor: number): Level => ({ mode: 'euclid', dividend, divisor });
const click = (el: Element | null | undefined) => (el as HTMLElement).click();
const last = (r: Rig) => r.instructions[r.instructions.length - 1];
const add = (r: Rig, n: number) => {
  const btn = r.stage.querySelectorAll<HTMLButtonElement>('.nw-gb-btn')[1];
  for (let i = 0; i < n; i++) btn.click();
};
const remove = (r: Rig) => click(r.stage.querySelectorAll('.nw-gb-btn')[0]);
const type = (r: Rig, digits: string) => {
  for (const d of digits) {
    click(Array.from(r.stage.querySelectorAll('.nw-key')).find((k) => k.textContent === d));
  }
};
const check = (r: Rig) => click(r.stage.querySelector('.nw-check'));
const hint = (r: Rig) => r.stage.querySelector('.nw-hint')?.textContent;

describe('judgeEuclid', () => {
  it('accepts only the Euclidean pair (golden: 78 = 8 × 9 + 6)', () => {
    expect(judgeEuclid(78, 8, 9, 6)).toBe('solved');
    expect(judgeEuclid(57, 7, 8, 1)).toBe('solved');
    expect(judgeEuclid(75, 5, 15, 0)).toBe('solved');
    expect(judgeEuclid(98, 8, 12, 2)).toBe('solved');
  });

  it('separates the three wrong paths', () => {
    expect(judgeEuclid(78, 8, 10, 0)).toBe('tooFar');
    expect(judgeEuclid(78, 8, 10, 6)).toBe('tooFar');
    expect(judgeEuclid(78, 8, 9, 5)).toBe('falseEquality');
    expect(judgeEuclid(78, 8, 3, 6)).toBe('falseEquality');
    expect(judgeEuclid(78, 8, 8, 14)).toBe('notEuclidean');
    expect(judgeEuclid(78, 8, 0, 78)).toBe('notEuclidean');
    expect(judgeEuclid(78, 8, 9, null)).toBe('needRemainder');
    expect(judgeEuclid(78, 8, 11, null)).toBe('tooFar');
  });

  it('solves exactly one (q, r) per exercise over a sweep', () => {
    for (let b = 2; b <= 12; b++) {
      for (let a = b; a <= 150; a += 7) {
        const solved: string[] = [];
        for (let g = 0; g <= Math.floor(a / b) + 2; g++) {
          for (let r = 0; r <= a; r++) {
            if (judgeEuclid(a, b, g, r) === 'solved') solved.push(`${g},${r}`);
          }
        }
        expect(solved).toEqual([`${Math.floor(a / b)},${a % b}`]);
      }
    }
  });
});

describe('euclid mode', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    vi.useRealTimers();
  });

  it('creates a controller from the factory and ignores levels of other modes', () => {
    expect(createEuclidMode()).toBeInstanceOf(EuclidMode);
    r = rig({ mode: 'facts', dividend: 6, divisor: 3 });
    expect(r.stage.children).toHaveLength(0);
  });

  it('starts with the prompt, an empty track and a remainder placeholder', () => {
    r = rig(euclid(78, 8));
    expect(last(r)).toBe('Fit as many groups of 8 as you can, then type what is left over.');
    expect(r.stage.querySelectorAll('.nw-bar')).toHaveLength(0);
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('?');
    expect(r.stage.querySelector('.nw-axis-end')?.textContent).toBe('78');
  });

  it('solves the sheet item 78 = (8 x 9) + 6 once, with no mistake', () => {
    r = rig(euclid(78, 8));
    add(r, 9);
    type(r, '6');
    check(r);
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(0);
    expect(last(r)).toBe('78 = (8 × 9) + 6');
    check(r);
    expect(r.solved()).toBe(1);
  });

  it('solves exact and large-quotient cases (75 / 5 and 98 / 8)', () => {
    r = rig(euclid(75, 5));
    add(r, 15);
    type(r, '0');
    check(r);
    expect(r.solved()).toBe(1);
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    r = rig(euclid(98, 8));
    add(r, 12);
    type(r, '2');
    check(r);
    expect(r.solved()).toBe(1);
  });

  it('shows a live equation and the gap left, with a live read-out', () => {
    r = rig(euclid(78, 8));
    add(r, 3);
    expect(last(r)).toBe('78 = (8 × 3) + ? · 54 left in the gap');
    expect(r.stage.querySelector('.nw-gb-readout')?.textContent).toBe('8 × 3 = 24');
    expect(r.stage.querySelector('.nw-live-eq')?.textContent).toBe('78 = (8 × 3) + ?');
    type(r, '5');
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('5');
  });

  it('wrong path 1, too far: its own hint, one mistake, bars past the end are marked', () => {
    r = rig(euclid(78, 8));
    add(r, 10);
    type(r, '0');
    expect(r.stage.querySelectorAll('.nw-bar-over').length).toBeGreaterThan(0);
    check(r);
    expect(hint(r)).toBe('Too far: 80 is more than 78. Take a group away.');
    expect(r.mistakes()).toBe(1);
    expect(r.solved()).toBe(0);
  });

  it('wrong path 2, false equality: its own hint, one mistake', () => {
    r = rig(euclid(78, 8));
    add(r, 9);
    type(r, '5');
    check(r);
    expect(hint(r)).toBe('The groups and the left-over do not add up to 78. Count the gap again.');
    expect(r.mistakes()).toBe(1);
  });

  it('at hard the false-equality hint does not point at an unmarked gap', () => {
    r = rig(euclid(78, 8), { difficulty: 'hard' });
    add(r, 9);
    type(r, '5');
    check(r);
    expect(hint(r)).toBe('The groups and the left-over do not add up to 78. Check your groups and your left-over.');
    expect(hint(r)).not.toMatch(/gap/);
  });

  it('a visible hint is redrawn in the new language on a locale change and cleared by reset', () => {
    r = rig(euclid(78, 8));
    add(r, 10);
    type(r, '0');
    check(r);
    expect(hint(r)).toContain('Too far');
    r.setLang('fr');
    r.mode.onLocaleChange();
    expect(hint(r)).toBe('Trop loin\u202f: 80 dépasse 78. Enlève un groupe.');
    r.mode.reset();
    expect(hint(r)).toBe('');
    r.mode.onLocaleChange();
    expect(hint(r)).toBe('');
  });

  it('wrong path 3, true equality with r >= b: names the room for another group', () => {
    r = rig(euclid(78, 8));
    add(r, 8);
    type(r, '14');
    check(r);
    expect(hint(r)).toBe('The equality is true, but you can still fit another group of 8.');
    expect(r.mistakes()).toBe(1);
    expect(r.solved()).toBe(0);
    add(r, 1);
    type(r, '');
    // Fix the remainder: delete both digits, type 6.
    click(r.stage.querySelector('.nw-key-back'));
    click(r.stage.querySelector('.nw-key-back'));
    type(r, '6');
    check(r);
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(1);
  });

  it('asks for the remainder without counting a mistake', () => {
    r = rig(euclid(78, 8));
    add(r, 9);
    check(r);
    expect(hint(r)).toBe('Type what is left over, then check.');
    expect(r.mistakes()).toBe(0);
  });

  it('a hint clears on the next action; undo and typing are never mistakes', () => {
    r = rig(euclid(78, 8));
    add(r, 9);
    type(r, '5');
    check(r);
    expect(hint(r)).not.toBe('');
    remove(r);
    expect(hint(r)).toBe('');
    type(r, '1');
    click(r.stage.querySelector('.nw-key-back'));
    expect(r.mistakes()).toBe(1);
  });

  it('draws the gap as countable unit squares at easy and medium, unmarked at hard', () => {
    r = rig(euclid(78, 8), { difficulty: 'easy' });
    add(r, 3);
    expect(r.stage.querySelectorAll('.nw-unit')).toHaveLength(54);
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    r = rig(euclid(78, 8), { difficulty: 'hard' });
    add(r, 3);
    expect(r.stage.querySelectorAll('.nw-unit')).toHaveLength(0);
    expect(r.stage.querySelector('.nw-gap-hidden')).not.toBeNull();
    expect(last(r)).toBe('78 = (8 × 3) + ?');
  });

  it('keyboard digits typed anywhere in the stage reach the remainder', () => {
    r = rig(euclid(78, 8));
    r.stage.querySelector('.nw-check')?.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('6');
    r.stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('?');
  });

  it('uses the reduced-motion pulse instead of a shake', () => {
    vi.useFakeTimers();
    r = rig(euclid(78, 8), { reducedMotion: true });
    add(r, 10);
    type(r, '0');
    check(r);
    expect(r.stage.querySelector('.nw-pulse')).not.toBeNull();
    expect(r.stage.querySelector('.nw-shake')).toBeNull();
  });

  it('reset restores the initial state; locale change keeps progress and switches language', () => {
    r = rig(euclid(78, 8));
    add(r, 2);
    type(r, '4');
    r.setLang('fr');
    r.mode.onLocaleChange();
    expect(r.stage.querySelectorAll('.nw-bar')).toHaveLength(2);
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('4');
    expect(r.stage.querySelector('.nw-check')?.textContent).toBe('Vérifier');
    expect(last(r)).toContain('à combler');
    r.mode.reset();
    expect(r.stage.querySelectorAll('.nw-bar')).toHaveLength(0);
    expect(r.stage.querySelector('.nw-rem-display')?.textContent).toBe('?');
  });

  it('blocks everything while paused', () => {
    r = rig(euclid(78, 8));
    r.mode.setPaused(true);
    add(r, 3);
    type(r, '6');
    check(r);
    expect(r.stage.querySelectorAll('.nw-bar')).toHaveLength(0);
    expect(r.mistakes()).toBe(0);
  });

  it('every interactive element is a button with an accessible name', () => {
    r = rig(euclid(78, 8));
    const buttons = Array.from(r.stage.querySelectorAll('button'));
    expect(buttons).toHaveLength(14);
    for (const b of buttons) expect(b.getAttribute('aria-label') || b.textContent).toBeTruthy();
  });

  it('destroy empties the stage', () => {
    r = rig(euclid(78, 8));
    r.abort.abort();
    r.mode.destroy();
    expect(r.stage.children).toHaveLength(0);
  });
});
