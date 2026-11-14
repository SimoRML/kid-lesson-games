import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../../src/core/audio.js';
import type { Difficulty } from '../../../src/core/types.js';
import { longDivisionTrace } from '../division.js';
import { getTranslations } from '../i18n.js';
import type { Level } from '../levels.js';
import {
  buildPlan,
  createLongMode,
  judgeDigit,
  judgeProduct,
  judgeRemainder,
  LongMode,
  quotientOf
} from './long.js';
import type { ModeHost } from './types.js';

interface Rig {
  stage: HTMLElement;
  mode: LongMode;
  abort: AbortController;
  instructions: string[];
  mistakes: () => number;
  solved: () => number;
  setLang: (l: 'en' | 'fr') => void;
}

function rig(level: Level, difficulty: Difficulty = 'medium', reducedMotion = false): Rig {
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  const abort = new AbortController();
  const instructions: string[] = [];
  let mistakes = 0;
  let solved = 0;
  let lang: 'en' | 'fr' = 'en';
  const host: ModeHost = {
    signal: abort.signal,
    difficulty,
    reducedMotion,
    symbolFree: false,
    t: () => getTranslations(lang),
    formatNumber: (n) => String(n),
    audio: new SoundEngine(false),
    setInstruction: (text) => instructions.push(text),
    setTimeout: (fn, ms) => void setTimeout(fn, ms),
    reportMistake: () => void mistakes++,
    solved: () => void solved++
  };
  const mode = new LongMode();
  mode.mount(stage, level, host);
  return {
    stage, mode, abort, instructions,
    mistakes: () => mistakes,
    solved: () => solved,
    setLang: (l) => void (lang = l)
  };
}

const long = (dividend: number, divisor: number): Level => ({ mode: 'long', dividend, divisor });
const last = (r: Rig) => r.instructions[r.instructions.length - 1];
const hint = (r: Rig) => r.stage.querySelector('.nw-hint')?.textContent;
const type = (r: Rig, digits: string) => {
  for (const d of digits) {
    (Array.from(r.stage.querySelectorAll('.nw-key')).find((k) => k.textContent === d) as HTMLElement).click();
  }
};
const back = (r: Rig) => (r.stage.querySelector('.nw-key-back') as HTMLElement).click();
const ok = (r: Rig) => (r.stage.querySelector('.nw-check') as HTMLElement).click();
const bring = (r: Rig) => (r.stage.querySelector('.nw-lbring') as HTMLElement).click();
const entry = (r: Rig, digits: string) => {
  type(r, digits);
  ok(r);
};

const GOLDEN: Array<[number, number, string]> = [
  [806, 5, '161'],
  [568, 8, '71'],
  [816, 8, '102'],
  [100, 7, '14']
];

/** Walks the whole level with correct entries. Optionally runs a callback before each plan item. */
function solve(
  r: Rig,
  a: number,
  b: number,
  difficulty: Difficulty,
  before?: (kind: string, step: number) => void,
  stopAt?: string
) {
  const trace = longDivisionTrace(a, b);
  const plan = buildPlan(trace.length, difficulty);
  for (const item of plan) {
    if (item.kind === stopAt) return;
    before?.(item.kind, item.step);
    const s = trace[item.step];
    switch (item.kind) {
      case 'digit': entry(r, String(s.digit)); break;
      case 'product': entry(r, String(s.product)); break;
      case 'remainder': entry(r, String(s.remainder)); break;
      case 'bring': bring(r); break;
      case 'eqQ': entry(r, String(quotientOf(trace))); break;
      case 'eqR': entry(r, String(trace[trace.length - 1].remainder)); break;
    }
  }
}

describe('long helpers', () => {
  it('builds the plan for each difficulty (806 / 5 has 3 steps)', () => {
    const kinds = (d: Difficulty) => buildPlan(3, d).map((p) => p.kind);
    expect(kinds('easy')).toEqual(['digit', 'bring', 'digit', 'bring', 'digit', 'eqQ', 'eqR']);
    expect(kinds('medium')).toEqual([
      'digit', 'remainder', 'bring', 'digit', 'remainder', 'bring', 'digit', 'remainder', 'eqQ', 'eqR'
    ]);
    expect(kinds('hard')).toEqual([
      'digit', 'product', 'remainder', 'bring', 'digit', 'product', 'remainder', 'bring',
      'digit', 'product', 'remainder', 'eqQ', 'eqR'
    ]);
  });

  it('takes the quotient from the trace digits (golden values)', () => {
    for (const [a, b, q] of GOLDEN) expect(quotientOf(longDivisionTrace(a, b))).toBe(Number(q));
  });

  it('classifies digits at every step of the four golden traces', () => {
    for (const [a, b] of GOLDEN) {
      for (const step of longDivisionTrace(a, b)) {
        expect(judgeDigit(step, b, step.digit)).toBe('ok');
        expect(judgeDigit(step, b, step.digit + 1)).toBe('tooBig');
        if (step.digit > 0) expect(judgeDigit(step, b, step.digit - 1)).toBe('tooSmall');
        expect(judgeProduct(step, step.product)).toBe('ok');
        expect(judgeProduct(step, step.product + 1)).toBe('product');
        expect(judgeRemainder(step, b, step.remainder)).toBe('ok');
        expect(judgeRemainder(step, b, b)).toBe('remainderBig');
        const wrong = step.remainder === 0 ? 1 : step.remainder - 1;
        expect(judgeRemainder(step, b, wrong)).toBe('remainder');
      }
    }
  });

  it('creates a controller from the factory', () => {
    expect(createLongMode()).toBeInstanceOf(LongMode);
  });
});

describe('long mode', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    vi.useRealTimers();
  });
  const fresh = (a: number, b: number, d: Difficulty = 'medium') => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
    r = rig(long(a, b), d);
  };

  it('ignores levels of other modes', () => {
    r = rig({ mode: 'facts', dividend: 6, divisor: 3 });
    expect(r.stage.children).toHaveLength(0);
  });

  it('draws the potence: dividend left, divisor top right, quotient under it', () => {
    r = rig(long(806, 5));
    expect(Array.from(r.stage.querySelectorAll('.nw-ldividend .nw-lcell:not(.nw-lsign)')).map((c) => c.textContent).join('')).toBe('806');
    expect(r.stage.querySelector('.nw-ldivisor')?.textContent).toBe('5');
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('?');
    expect(last(r)).toBe('How many 5s fit in 8? Type the digit.');
    expect(r.stage.querySelector('.nw-long-eq')?.hasAttribute('hidden')).toBe(true);
  });

  it('solves every golden trace end to end at every difficulty, no mistakes, one solved()', () => {
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      for (const [a, b] of GOLDEN) {
        fresh(a, b, d);
        solve(r, a, b, d);
        expect(r.solved()).toBe(1);
        expect(r.mistakes()).toBe(0);
        expect(last(r)).toBe(`${a} = (${b} × ${quotientOf(longDivisionTrace(a, b))}) + ${longDivisionTrace(a, b).at(-1)!.remainder}`);
      }
    }
    r = rig(long(806, 5));
  });

  it('568 / 8 starts with a two-digit partial dividend (56)', () => {
    r = rig(long(568, 8));
    expect(r.stage.querySelectorAll('.nw-ldividend .nw-lpart')).toHaveLength(2);
    expect(last(r)).toBe('How many 8s fit in 56? Type the digit.');
    entry(r, '7');
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('7');
  });

  it('816 / 8 has a full step where the child enters 0', () => {
    r = rig(long(816, 8), 'easy');
    entry(r, '1');
    bring(r);
    expect(last(r)).toBe('How many 8s fit in 1? Type the digit.');
    entry(r, '0');
    expect(r.mistakes()).toBe(0);
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('10');
    bring(r);
    entry(r, '2');
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('102');
  });

  it('gives the right too-big and too-small hints at every step of the golden traces, never the digit', () => {
    for (const [a, b] of GOLDEN) {
      fresh(a, b, 'medium');
      const trace = longDivisionTrace(a, b);
      let wrong = 0;
      solve(r, a, b, 'medium', (kind, k) => {
        if (kind !== 'digit') return;
        const s = trace[k];
        const big = s.digit + 1;
        if (big <= 9) {
          entry(r, String(big));
          wrong++;
          expect(hint(r)).toBe(`${b} × ${big} = ${big * b} is more than ${s.partial}.`);
          back(r);
        }
        if (s.digit > 0) {
          entry(r, String(s.digit - 1));
          wrong++;
          expect(hint(r)).toBe(`There is room for one more ${b} in ${s.partial}.`);
          back(r);
        }
        expect(hint(r)).toBe('');
      });
      expect(r.mistakes()).toBe(wrong);
      expect(r.solved()).toBe(1);
    }
    r = rig(long(806, 5));
  });

  it('easy shows product and subtraction itself; the next thing to do is bring down', () => {
    r = rig(long(806, 5), 'easy');
    entry(r, '1');
    expect(r.stage.querySelectorAll('.nw-lproduct .nw-lauto')).toHaveLength(1);
    expect(r.stage.querySelector('.nw-lproduct')?.textContent).toContain('5');
    expect(r.stage.querySelector('.nw-lremainder')?.textContent).toContain('3');
    expect(last(r)).toContain('Bring down');
    expect(r.stage.querySelector('.nw-check')?.hasAttribute('hidden')).toBe(true);
  });

  it('medium shows the product, then asks for the step remainder', () => {
    r = rig(long(806, 5), 'medium');
    entry(r, '1');
    expect(r.stage.querySelector('.nw-lproduct')?.textContent).toContain('5');
    expect(last(r)).toBe('Subtract: 8 − 5 = ?');
    entry(r, '2');
    expect(hint(r)).toBe('Subtract again: 8 − 5.');
    expect(r.mistakes()).toBe(1);
    back(r);
    entry(r, '5');
    expect(hint(r)).toBe('The left-over must be smaller than 5. Is there room for one more?');
    expect(r.mistakes()).toBe(2);
    back(r);
    entry(r, '3');
    expect(r.mistakes()).toBe(2);
    expect(last(r)).toContain('Bring down');
  });

  it('hard asks for the product too, and the remainder row appears only after it', () => {
    r = rig(long(806, 5), 'hard');
    entry(r, '1');
    expect(last(r)).toBe('Multiply: 1 × 5 = ?');
    expect(r.stage.querySelector('.nw-lremainder')).toBeNull();
    entry(r, '6');
    expect(hint(r)).toBe('Check 5 × 1 again.');
    expect(r.mistakes()).toBe(1);
    back(r);
    entry(r, '5');
    expect(r.stage.querySelector('.nw-lremainder')).not.toBeNull();
    expect(last(r)).toBe('Subtract: 8 − 5 = ?');
  });

  it('bring down: only the next dividend digit is a button and it lands next to the remainder', () => {
    r = rig(long(806, 5), 'easy');
    entry(r, '1');
    const btn = r.stage.querySelector('.nw-lbring') as HTMLElement;
    expect(r.stage.querySelectorAll('.nw-lbring')).toHaveLength(1);
    expect(btn.textContent).toBe('0');
    expect(btn.getAttribute('aria-label')).toBe('Bring down the digit 0');
    btn.click();
    expect(r.stage.querySelector('.nw-lbring')).toBeNull();
    expect(Array.from(r.stage.querySelectorAll('.nw-lremainder .nw-lcell')).map((c) => c.textContent).join('')).toBe('30');
    expect(last(r)).toBe('How many 5s fit in 30? Type the digit.');
  });

  it('the equality step checks the quotient and the remainder, each with its own hint', () => {
    r = rig(long(806, 5), 'easy');
    solve(r, 806, 5, 'easy', undefined, 'eqQ');
    expect(last(r)).toBe('Now write the equality. What is the quotient?');
    expect(r.stage.querySelector('.nw-long-eq')?.hasAttribute('hidden')).toBe(false);
    ok(r);
    expect(hint(r)).toBe('Type a number, then press Check.');
    expect(r.mistakes()).toBe(0);
    entry(r, '160');
    expect(hint(r)).toBe('The quotient is the digits you wrote above the line, in order.');
    expect(r.mistakes()).toBe(1);
    back(r);
    back(r);
    back(r);
    entry(r, '161');
    expect(last(r)).toBe('And what is the remainder?');
    expect(r.stage.querySelector('.nw-long-eq')?.textContent).toBe('806 = (5 × 161) + ?');
    entry(r, '2');
    expect(hint(r)).toBe('The remainder is the last number left under the lines.');
    expect(r.mistakes()).toBe(2);
    expect(r.solved()).toBe(0);
    back(r);
    entry(r, '1');
    expect(r.solved()).toBe(1);
    expect(r.stage.querySelector('.nw-long-eq')?.textContent).toBe('806 = (5 × 161) + 1');
    ok(r);
    expect(r.solved()).toBe(1);
  });

  it('fits a four-digit dividend: five cells per row, quotient up to four digits', () => {
    r = rig(long(9999, 9), 'hard');
    expect(r.stage.querySelectorAll('.nw-ldividend .nw-lcell')).toHaveLength(5);
    solve(r, 9999, 9, 'hard');
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(0);
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('1111');
  });

  it('keeps progress and redraws prompts and hints in French on a locale change', () => {
    r = rig(long(806, 5), 'medium');
    entry(r, '0');
    r.setLang('fr');
    r.mode.onLocaleChange();
    expect(hint(r)).toBe('Il y a encore la place pour un 5 de plus dans 8.');
    expect(r.stage.querySelector('.nw-check')?.textContent).toBe('Vérifier');
    expect(r.stage.querySelector('.nw-potence')?.getAttribute('aria-label')).toBe('Division posée de 806 par 5');
    back(r);
    entry(r, '1');
    expect(last(r)).toBe('Soustrais\u202f: 8 − 5 = ?');
  });

  it('reset restarts the level; paused blocks entry; the reduced-motion pulse replaces the shake', () => {
    vi.useFakeTimers();
    r = rig(long(806, 5), 'easy', true);
    entry(r, '9');
    expect(r.stage.querySelector('.nw-pulse')).not.toBeNull();
    expect(r.stage.querySelector('.nw-shake')).toBeNull();
    back(r);
    entry(r, '1');
    r.mode.reset();
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('?');
    expect(hint(r)).toBe('');
    r.mode.setPaused(true);
    type(r, '1');
    ok(r);
    expect(r.stage.querySelector('.nw-lquotient')?.textContent).toBe('?');
    expect(r.mistakes()).toBe(1);
  });

  it('every interactive element is a button with an accessible name; destroy empties the stage', () => {
    r = rig(long(806, 5), 'easy');
    entry(r, '1');
    for (const b of Array.from(r.stage.querySelectorAll('button'))) {
      expect(b.getAttribute('aria-label') || b.textContent).toBeTruthy();
    }
    r.abort.abort();
    r.mode.destroy();
    expect(r.stage.children).toHaveLength(0);
  });
});
