import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../../src/core/audio.js';
import { getTranslations } from '../i18n.js';
import type { Level } from '../levels.js';
import { createFactsMode, createTokenSvg, factsTier, FactsMode, themeFor } from './facts.js';
import type { ModeHost } from './types.js';

interface Rig {
  stage: HTMLElement;
  mode: FactsMode;
  host: ModeHost;
  abort: AbortController;
  instructions: string[];
  mistakes: () => number;
  solved: () => number;
}

function rig(level: Level, opts: { symbolFree?: boolean; lang?: 'en' | 'fr' } = {}): Rig {
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  const abort = new AbortController();
  const instructions: string[] = [];
  let mistakes = 0;
  let solved = 0;
  let lang: 'en' | 'fr' = opts.lang ?? 'en';
  const host: ModeHost = {
    signal: abort.signal,
    difficulty: 'medium',
    reducedMotion: false,
    symbolFree: opts.symbolFree ?? false,
    t: () => getTranslations(lang),
    formatNumber: (n) => String(n),
    audio: new SoundEngine(false),
    setInstruction: (text) => instructions.push(text),
    setTimeout: (fn, ms) => void setTimeout(fn, ms),
    reportMistake: () => void mistakes++,
    solved: () => void solved++
  };
  const mode = new FactsMode();
  mode.mount(stage, level, host);
  return {
    stage,
    mode,
    host,
    abort,
    instructions,
    mistakes: () => mistakes,
    solved: () => solved,
    ...{ setLang: (l: 'en' | 'fr') => (lang = l) }
  } as Rig;
}

const facts = (dividend: number, divisor: number): Level => ({ mode: 'facts', dividend, divisor, theme: 'dates' });
const plateBtns = (r: Rig) => Array.from(r.stage.querySelectorAll<HTMLButtonElement>('.nw-plate-btn'));
const click = (el: Element | null | undefined) => (el as HTMLElement).click();
const last = (r: Rig) => r.instructions[r.instructions.length - 1];

describe('facts helpers', () => {
  it('chooses the tier from the dividend, not the age', () => {
    expect(factsTier(2)).toBe('share');
    expect(factsTier(12)).toBe('share');
    expect(factsTier(13)).toBe('deal');
    expect(factsTier(30)).toBe('deal');
    expect(factsTier(31)).toBe('array');
    expect(factsTier(100)).toBe('array');
  });

  it('picks the named theme, else a stable one', () => {
    expect(themeFor({ mode: 'facts', dividend: 6, divisor: 2, theme: 'stars' })).toBe('stars');
    const a = themeFor({ mode: 'facts', dividend: 6, divisor: 2 });
    expect(themeFor({ mode: 'facts', dividend: 6, divisor: 2 })).toBe(a);
  });

  it('draws every theme with SVG only', () => {
    for (const theme of ['dates', 'apples', 'marbles', 'stars'] as const) {
      const svg = createTokenSvg(theme);
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.querySelector('image')).toBeNull();
    }
  });

  it('creates a controller from the factory', () => {
    expect(createFactsMode()).toBeInstanceOf(FactsMode);
  });
});

describe('facts: share tier (dividend <= 12)', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
  });

  it('renders one plate per divisor and all tokens in the tray', () => {
    r = rig(facts(6, 3));
    expect(plateBtns(r)).toHaveLength(3);
    expect(r.stage.querySelectorAll('.nw-tray-token')).toHaveLength(6);
    expect(r.stage.querySelector('.nw-deal')).toBeNull();
    expect(last(r)).toMatch(/6 .* 3 plates/);
  });

  it('solves an exact level once, after every plate holds the same count', () => {
    r = rig(facts(6, 3));
    for (let k = 0; k < 2; k++) plateBtns(r).forEach((b) => click(b));
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(0);
    click(plateBtns(r)[0]);
    expect(r.solved()).toBe(1);
  });

  it('shows live totals and who has fewer, without calling it a mistake', () => {
    r = rig(facts(6, 3));
    click(plateBtns(r)[0]);
    expect(last(r)).toContain('6 ÷ 3 →');
    expect(last(r)).toMatch(/some have 0, some have 1/);
    expect(r.mistakes()).toBe(0);
  });

  it('solves a remainder level and explains the left-over', () => {
    r = rig(facts(7, 3));
    for (let k = 0; k < 2; k++) plateBtns(r).forEach((b) => click(b));
    expect(r.solved()).toBe(1);
    expect(r.stage.querySelector('.nw-tray-left')).not.toBeNull();
    expect(last(r)).toMatch(/1 date left over: fewer than 3 plates/);
  });

  it('undo returns exactly one token and is not a mistake', () => {
    r = rig(facts(6, 3));
    click(plateBtns(r)[0]);
    click(plateBtns(r)[0]);
    expect(plateBtns(r)[0].textContent).toBe('2');
    click(r.stage.querySelector('.nw-placed'));
    expect(plateBtns(r)[0].textContent).toBe('1');
    expect(r.stage.querySelectorAll('.nw-tray-token')).toHaveLength(5);
    expect(r.mistakes()).toBe(0);
  });

  it('can win by taking a token back', () => {
    r = rig(facts(7, 3));
    click(plateBtns(r)[0]);
    click(plateBtns(r)[0]);
    click(plateBtns(r)[0]);
    click(plateBtns(r)[1]);
    click(plateBtns(r)[2]);
    expect(r.solved()).toBe(0);
    click(r.stage.querySelector('.nw-placed'));
    click(plateBtns(r)[1]);
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['2', '2', '1']);
    click(plateBtns(r)[2]);
    expect(r.solved()).toBe(1);
  });

  it('does nothing when the tray is empty', () => {
    r = rig(facts(2, 2));
    plateBtns(r).forEach((b) => click(b));
    expect(r.solved()).toBe(1);
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['1', '1']);
  });

  it('drags a tray token onto a plate and a placed token to another plate', () => {
    r = rig(facts(6, 3));
    const plates = Array.from(r.stage.querySelectorAll<HTMLElement>('.nw-plate'));
    plates.forEach((p, i) => {
      p.getBoundingClientRect = () =>
        ({ left: i * 200, top: 0, width: 100, height: 100, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    });
    const token = r.stage.querySelector('.nw-tray-token') as HTMLElement;
    token.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 250, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 250, clientY: 50, bubbles: true }));
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['0', '1', '0']);

    const placed = r.stage.querySelector('.nw-placed') as HTMLElement;
    placed.dispatchEvent(new MouseEvent('pointerdown', { clientX: 250, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 450, clientY: 50, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 450, clientY: 50, bubbles: true }));
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['0', '0', '1']);
  });

  it('a drop far from every plate changes nothing', () => {
    r = rig(facts(6, 3));
    const token = r.stage.querySelector('.nw-tray-token') as HTMLElement;
    token.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 900, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 900, clientY: 900, bubbles: true }));
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['0', '0', '0']);
  });

  it('reset restores the initial state, and ignores input while paused', () => {
    r = rig(facts(6, 3));
    click(plateBtns(r)[0]);
    r.mode.setPaused(true);
    click(plateBtns(r)[1]);
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['1', '0', '0']);
    r.mode.setPaused(false);
    r.mode.reset();
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['0', '0', '0']);
  });

  it('keeps progress and switches language on a locale change', () => {
    r = rig(facts(6, 3));
    click(plateBtns(r)[0]);
    (r as unknown as { setLang: (l: 'fr') => void }).setLang('fr');
    r.mode.onLocaleChange();
    expect(plateBtns(r)[0].textContent).toBe('1');
    expect(last(r)).toContain('assiettes');
  });

  it('uses friends and no symbols when the presentation is symbol-free', () => {
    r = rig(facts(6, 3), { symbolFree: true });
    click(plateBtns(r)[0]);
    expect(last(r)).toContain('friends');
    expect(last(r)).not.toMatch(/[÷→×=]/);
    expect(plateBtns(r)[0].getAttribute('aria-label')).toContain('Friend 1');
  });

  it('every interactive element is a button with an accessible name', () => {
    r = rig(facts(6, 3));
    click(plateBtns(r)[0]);
    const buttons = Array.from(r.stage.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(3);
    for (const b of buttons) expect(b.getAttribute('aria-label') || b.textContent).toBeTruthy();
  });

  it('destroy empties the stage; a later drag has no effect', () => {
    r = rig(facts(6, 3));
    const token = r.stage.querySelector('.nw-tray-token') as HTMLElement;
    token.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    r.abort.abort();
    r.mode.destroy();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, clientY: 90, bubbles: true }));
    expect(r.stage.children).toHaveLength(0);
    expect(r.solved()).toBe(0);
  });
});

describe('facts: deal tier (13-30)', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
  });

  it('deals one token to every plate per press and solves an exact level', () => {
    r = rig(facts(24, 4));
    const deal = r.stage.querySelector('.nw-deal') as HTMLButtonElement;
    click(deal);
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['1', '1', '1', '1']);
    for (let k = 0; k < 5; k++) click(deal);
    expect(r.solved()).toBe(1);
  });

  it('solves a remainder level by dealing, and disables the button when too few remain', () => {
    r = rig(facts(26, 4));
    const deal = r.stage.querySelector('.nw-deal') as HTMLButtonElement;
    for (let k = 0; k < 6; k++) click(deal);
    expect(r.solved()).toBe(1);
    expect(deal.disabled).toBe(true);
    expect(last(r)).toContain('2 dates left over');
  });

  it('mixes dealing with single tokens', () => {
    r = rig(facts(14, 3));
    click(r.stage.querySelector('.nw-deal'));
    click(plateBtns(r)[0]);
    expect(plateBtns(r).map((b) => b.textContent)).toEqual(['2', '1', '1']);
    expect(r.solved()).toBe(0);
  });
});

describe('facts: array tier (> 30)', () => {
  let r: Rig;
  afterEach(() => {
    r.abort.abort();
    r.mode.destroy();
    r.stage.remove();
  });

  const gbBtns = (x: Rig) => {
    const [remove, add] = Array.from(x.stage.querySelectorAll<HTMLButtonElement>('.nw-gb-btn'));
    return { remove, add };
  };
  const check = (x: Rig) => click(x.stage.querySelector('.nw-check'));

  it('needs an explicit Check: building the right array alone does not solve', () => {
    r = rig(facts(40, 8));
    for (let k = 0; k < 5; k++) click(gbBtns(r).add);
    expect(r.solved()).toBe(0);
    check(r);
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(0);
  });

  it('shows a live read-out and the number still to place', () => {
    r = rig(facts(40, 8));
    click(gbBtns(r).add);
    click(gbBtns(r).add);
    expect(r.stage.querySelector('.nw-gb-readout')?.textContent).toBe('8 × 2 = 16');
    expect(last(r)).toContain('24 dates to share');
  });

  it('gives a distinct hint for too few rows and for too many, each a single mistake', () => {
    r = rig(facts(40, 8));
    click(gbBtns(r).add);
    check(r);
    expect(r.mistakes()).toBe(1);
    expect(r.stage.querySelector('.nw-hint')?.textContent).toMatch(/room for another row of 8/);
    for (let k = 0; k < 5; k++) click(gbBtns(r).add);
    check(r);
    expect(r.mistakes()).toBe(2);
    expect(r.stage.querySelector('.nw-hint')?.textContent).toMatch(/more than you have/);
    expect(r.solved()).toBe(0);
    click(gbBtns(r).remove);
    expect(r.stage.querySelector('.nw-hint')?.textContent).toBe('');
    check(r);
    expect(r.solved()).toBe(1);
    expect(r.mistakes()).toBe(2);
  });

  it('adding and removing rows is never a mistake', () => {
    r = rig(facts(40, 8));
    click(gbBtns(r).add);
    click(gbBtns(r).remove);
    expect(r.mistakes()).toBe(0);
  });

  it('accepts the largest fitting row count for a remainder level and shows the left-over row', () => {
    r = rig(facts(47, 8));
    for (let k = 0; k < 5; k++) click(gbBtns(r).add);
    check(r);
    expect(r.solved()).toBe(1);
    expect(r.stage.querySelectorAll('.nw-gb-left .nw-gb-dot-left')).toHaveLength(7);
    expect(last(r)).toContain('7 dates left over');
  });

  it('uses a sentence read-out when symbol-free', () => {
    r = rig(facts(40, 8), { symbolFree: true });
    for (let k = 0; k < 5; k++) click(gbBtns(r).add);
    expect(r.stage.querySelector('.nw-gb-readout')?.textContent).toBe('5 rows of 8 make 40');
  });

  it('uses the reduced-motion pulse instead of a shake on a wrong check', () => {
    vi.useFakeTimers();
    const base = rig(facts(40, 8));
    (base.host as { reducedMotion: boolean }).reducedMotion = true;
    r = base;
    check(r);
    expect(r.stage.querySelector('.nw-pulse')).not.toBeNull();
    expect(r.stage.querySelector('.nw-shake')).toBeNull();
    vi.useRealTimers();
  });

  it('reset clears the rows; locale change keeps them', () => {
    r = rig(facts(40, 8));
    click(gbBtns(r).add);
    click(gbBtns(r).add);
    r.mode.onLocaleChange();
    expect(r.stage.querySelectorAll('.nw-gb-row')).toHaveLength(2);
    r.mode.reset();
    expect(r.stage.querySelectorAll('.nw-gb-row')).toHaveLength(0);
  });

  it('blocks Check and the builder while paused', () => {
    r = rig(facts(40, 8));
    r.mode.setPaused(true);
    click(gbBtns(r).add);
    check(r);
    expect(r.stage.querySelectorAll('.nw-gb-row')).toHaveLength(0);
    expect(r.mistakes()).toBe(0);
  });

  it('ignores a level of another mode', () => {
    const stage = document.createElement('div');
    const mode = new FactsMode();
    mode.mount(stage, { mode: 'long', dividend: 806, divisor: 5 }, rig(facts(6, 3)).host);
    expect(stage.children).toHaveLength(0);
    r = rig(facts(6, 3));
  });
});
