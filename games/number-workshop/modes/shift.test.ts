import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../../src/core/audio.js';
import { getTranslations } from '../i18n.js';
import type { Level } from '../levels.js';
import { canSlide, createShiftMode, digitsOf, judgeShift, MAX_SLIDES, ShiftMode } from './shift.js';
import type { ModeHost } from './types.js';

interface Rig {
  stage: HTMLElement;
  mode: ShiftMode;
  host: ModeHost;
  abort: AbortController;
  instructions: string[];
  mistakes: () => number;
  solved: () => number;
  setLang: (l: 'en' | 'fr') => void;
}

function rig(level: Level, opts: { reducedMotion?: boolean } = {}): Rig {
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  const abort = new AbortController();
  const instructions: string[] = [];
  let mistakes = 0;
  let solved = 0;
  let lang: 'en' | 'fr' = 'en';
  const host: ModeHost = {
    signal: abort.signal,
    difficulty: 'medium',
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
  const mode = new ShiftMode();
  mode.mount(stage, level, host);
  return {
    stage, mode, host, abort, instructions,
    mistakes: () => mistakes,
    solved: () => solved,
    setLang: (l) => void (lang = l)
  };
}

const shift = (dividend: number, divisor: 10 | 100 | 1000): Level => ({ mode: 'shift', dividend, divisor });
const last = (r: Rig) => r.instructions[r.instructions.length - 1];
const hint = (r: Rig) => r.stage.querySelector('.nw-hint')?.textContent;
const slideBtn = (r: Rig) => r.stage.querySelectorAll<HTMLButtonElement>('.nw-shift-buttons .nw-btn')[1];
const backBtn = (r: Rig) => r.stage.querySelectorAll<HTMLButtonElement>('.nw-shift-buttons .nw-btn')[0];
const slide = (r: Rig, n: number) => {
  for (let i = 0; i < n; i++) slideBtn(r).click();
};
const check = (r: Rig) => (r.stage.querySelector('.nw-check') as HTMLElement).click();
const offset = (r: Rig) => (r.stage.querySelector('.nw-strip') as HTMLElement).style.getPropertyValue('--nw-offset');

const SHEET: Array<[number, 10 | 100 | 1000, number]> = [
  [60000, 100, 2],
  [5000, 10, 1],
  [10, 10, 1],
  [200, 100, 2],
  [3400, 100, 2],
  [789000, 1000, 3]
];

describe('shift helpers', () => {
  it('splits the dividend into digits', () => {
    expect(digitsOf(60000)).toEqual(['6', '0', '0', '0', '0']);
    expect(digitsOf(789000)).toHaveLength(6);
  });

  it('allows exactly the slides each sheet item needs and refuses a non-zero digit leaving', () => {
    for (const [a, , need] of SHEET) {
      const digits = digitsOf(a);
      for (let s = 0; s < need; s++) expect(canSlide(digits, s)).toBe(true);
    }
    expect(canSlide(digitsOf(3400), 2)).toBe(false);
    expect(canSlide(digitsOf(10), 1)).toBe(false);
    expect(canSlide(digitsOf(789000), 3)).toBe(false);
    expect(canSlide(digitsOf(60000), 3)).toBe(true);
    expect(canSlide(digitsOf(60000), 4)).toBe(false); // the 6 would leave
    expect(canSlide(['1', '0', '0', '0', '0', '0'], MAX_SLIDES)).toBe(false);
  });

  it('judges the slide count against the divisor', () => {
    for (const [, b, need] of SHEET) {
      expect(judgeShift(b, need)).toBe('solved');
      expect(judgeShift(b, need - 1)).toBe('tooFew');
      expect(judgeShift(b, need + 1)).toBe('tooMany');
    }
  });

  it('creates a controller from the factory', () => {
    expect(createShiftMode()).toBeInstanceOf(ShiftMode);
  });
});

describe('shift mode', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
  });

  it('ignores levels of other modes', () => {
    r = rig({ mode: 'facts', dividend: 6, divisor: 3 });
    expect(r.stage.children).toHaveLength(0);
  });

  it('shows the table with column labels and the digit strip right-aligned', () => {
    r = rig(shift(60000, 100));
    const labels = Array.from(r.stage.querySelectorAll('.nw-pv-col')).slice(0, 6).map((c) => c.textContent);
    expect(labels).toEqual(['HTh', 'TTh', 'Th', 'H', 'T', 'O']);
    expect(Array.from(r.stage.querySelectorAll('.nw-digit')).map((d) => d.textContent).join('')).toBe('60000');
    expect(offset(r)).toBe('1');
    expect(last(r)).toBe('Slide the digits of 60000 to the right to divide by 100.');
  });

  it('solves the sheet items with the right number of slides, once, with no mistake', () => {
    for (const [a, b, need] of SHEET) {
      r = rig(shift(a, b));
      slide(r, need);
      check(r);
      expect(r.solved()).toBe(1);
      expect(r.mistakes()).toBe(0);
      expect(last(r)).toBe(`${a} ÷ ${b} = ${a / b}`);
      r.abort.abort();
      r.mode.destroy();
      r.stage.remove();
    }
    r = rig(shift(60000, 100));
  });

  it('shows the counter and the live value as the strip slides', () => {
    r = rig(shift(60000, 100));
    expect(r.stage.querySelector('.nw-counter')?.textContent).toBe('no slides yet');
    slide(r, 1);
    expect(r.stage.querySelector('.nw-counter')?.textContent).toBe('÷10');
    slide(r, 1);
    expect(r.stage.querySelector('.nw-counter')?.textContent).toBe('÷10 × 2 = ÷100');
    expect(last(r)).toBe('÷10 × 2 = ÷100 → 600');
    expect(offset(r)).toBe('3');
    expect(r.stage.querySelectorAll('.nw-digit-off')).toHaveLength(2);
    expect(r.stage.querySelector('.nw-pv')?.getAttribute('aria-label')).toBe('Place-value table showing 600');
  });

  it('under-shift fails Check with a hint naming the count; one mistake', () => {
    r = rig(shift(60000, 100));
    slide(r, 1);
    check(r);
    expect(hint(r)).toBe('÷100 is 2 slides. You made 1: keep sliding.');
    expect(r.mistakes()).toBe(1);
    expect(r.solved()).toBe(0);
    check(r);
    expect(r.mistakes()).toBe(2);
  });

  it('no slides at all is an under-shift too', () => {
    r = rig(shift(5000, 10));
    check(r);
    expect(hint(r)).toBe('÷10 is 1 slide. You made 0: keep sliding.');
    expect(r.mistakes()).toBe(1);
  });

  it('over-shift fails Check with a hint naming the count; one mistake', () => {
    r = rig(shift(60000, 100));
    slide(r, 3);
    check(r);
    expect(hint(r)).toBe('÷100 is 2 slides. You made 3: slide some back.');
    expect(r.mistakes()).toBe(1);
    backBtn(r).click();
    check(r);
    expect(r.solved()).toBe(1);
  });

  it('a non-zero digit cannot leave the table: the strip refuses, gently, without a mistake', () => {
    r = rig(shift(3400, 100));
    slide(r, 3);
    expect(offset(r)).toBe('4'); // lead 2 + 2 slides, the third was refused
    expect(hint(r)).toBe('Only zeros can slide off the table. This strip stays here.');
    expect(r.mistakes()).toBe(0);
    check(r);
    expect(r.solved()).toBe(1);
  });

  it('refuses at 10 ÷ 10 after one slide and at the slide cap', () => {
    r = rig(shift(10, 10));
    slide(r, 2);
    expect(offset(r)).toBe('5');
    expect(r.mistakes()).toBe(0);
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    r = rig(shift(100000, 1000));
    slide(r, 6);
    expect(offset(r)).toBe(String(MAX_SLIDES));
  });

  it('fits six-digit dividends: 789 000 uses all six columns', () => {
    r = rig(shift(789000, 1000));
    expect(r.stage.querySelectorAll('.nw-digit')).toHaveLength(6);
    expect(offset(r)).toBe('0');
    slide(r, 3);
    expect(offset(r)).toBe('3');
    check(r);
    expect(r.solved()).toBe(1);
  });

  it('slides back by button, never below zero', () => {
    r = rig(shift(60000, 100));
    expect(backBtn(r).disabled).toBe(true);
    slide(r, 2);
    backBtn(r).click();
    expect(offset(r)).toBe('2');
    expect(r.mistakes()).toBe(0);
  });

  it('drags the strip by whole columns and stops at the first refusal', () => {
    r = rig(shift(60000, 100));
    const strip = r.stage.querySelector('.nw-strip') as HTMLElement;
    const drag = (dx: number) => {
      strip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: dx, clientY: 0, bubbles: true }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: dx, clientY: 0, bubbles: true }));
    };
    drag(90); // about two columns (44 px fallback width)
    expect(offset(r)).toBe('3');
    expect(strip.classList.contains('nw-snap')).toBe(false); // the no-glide class never lingers
    drag(-45);
    expect(offset(r)).toBe('2');
    drag(-500);
    expect(offset(r)).toBe('1');
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    r = rig(shift(3400, 100));
    const strip2 = r.stage.querySelector('.nw-strip') as HTMLElement;
    strip2.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 300, clientY: 0, bubbles: true }));
    expect(offset(r)).toBe('4');
    expect(r.mistakes()).toBe(0);
  });

  it('uses the reduced-motion pulse instead of a shake', () => {
    vi.useFakeTimers();
    r = rig(shift(60000, 100), { reducedMotion: true });
    check(r);
    expect(r.stage.querySelector('.nw-pulse')).not.toBeNull();
    expect(r.stage.querySelector('.nw-shake')).toBeNull();
    vi.useRealTimers();
  });

  it('keeps progress and redraws labels and hints in French on a locale change', () => {
    r = rig(shift(60000, 100));
    slide(r, 1);
    check(r);
    r.setLang('fr');
    r.mode.onLocaleChange();
    expect(offset(r)).toBe('2');
    const labels = Array.from(r.stage.querySelectorAll('.nw-pv-col')).slice(0, 6).map((c) => c.textContent);
    expect(labels).toEqual(['CM', 'DM', 'UM', 'C', 'D', 'U']);
    expect(hint(r)).toBe('÷100 fait 2 glissements. Tu en as fait 1 : continue.');
    expect(r.stage.querySelector('.nw-check')?.textContent).toBe('Vérifier');
  });

  it('reset restores the strip and clears the hint; paused blocks everything', () => {
    r = rig(shift(60000, 100));
    slide(r, 1);
    check(r);
    r.mode.reset();
    expect(offset(r)).toBe('1');
    expect(hint(r)).toBe('');
    r.mode.setPaused(true);
    slide(r, 2);
    check(r);
    expect(offset(r)).toBe('1');
    expect(r.mistakes()).toBe(1);
  });

  it('every control is a labelled button and destroy empties the stage', () => {
    r = rig(shift(60000, 100));
    const buttons = Array.from(r.stage.querySelectorAll('button'));
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.textContent).toBeTruthy();
    r.abort.abort();
    r.mode.destroy();
    expect(r.stage.children).toHaveLength(0);
  });
});
