import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeypad, type Keypad } from './keypad.js';

describe('keypad', () => {
  let abort: AbortController;
  let parent: HTMLElement;
  let enabled: boolean;
  let onChange: ReturnType<typeof vi.fn>;
  let pad: Keypad;

  const keys = () => Array.from(parent.querySelectorAll<HTMLButtonElement>('button'));
  const key = (label: string) => keys().find((k) => k.textContent === label)!;

  beforeEach(() => {
    abort = new AbortController();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    enabled = true;
    onChange = vi.fn();
    pad = createKeypad(parent, {
      signal: abort.signal,
      isEnabled: () => enabled,
      maxDigits: 3,
      onChange,
      labels: { group: 'Number keys', backspace: 'Delete' }
    });
  });
  afterEach(() => {
    abort.abort();
    parent.remove();
  });

  it('has ten digit buttons and a labelled backspace, all real buttons', () => {
    expect(keys()).toHaveLength(11);
    expect(keys().slice(0, 10).map((k) => k.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(keys()[10].getAttribute('aria-label')).toBe('Delete');
    expect(pad.element.getAttribute('aria-label')).toBe('Number keys');
  });

  it('types digits, caps the length and backspaces one at a time', () => {
    key('1').click();
    key('4').click();
    key('2').click();
    key('9').click();
    expect(pad.getValue()).toBe('142');
    expect(onChange).toHaveBeenLastCalledWith('142');
    keys()[10].click();
    expect(pad.getValue()).toBe('14');
    keys()[10].click();
    keys()[10].click();
    keys()[10].click();
    expect(pad.getValue()).toBe('');
  });

  it('replaces a lone zero instead of keeping a leading zero', () => {
    key('0').click();
    key('7').click();
    expect(pad.getValue()).toBe('7');
  });

  it('accepts digit keys and Backspace from the keyboard, ignoring modified keys', () => {
    const press = (k: string, mods: KeyboardEventInit = {}) =>
      pad.element.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
    press('3');
    press('5');
    press('a');
    press('7', { ctrlKey: true });
    expect(pad.getValue()).toBe('35');
    press('Backspace');
    expect(pad.getValue()).toBe('3');
  });

  it('listens on a custom key target', () => {
    const stage = document.createElement('div');
    const p2 = createKeypad(parent, {
      signal: abort.signal,
      isEnabled: () => true,
      maxDigits: 2,
      onChange: () => {},
      keyTarget: stage,
      labels: { group: 'g', backspace: 'b' }
    });
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: '8', bubbles: true }));
    expect(p2.getValue()).toBe('8');
  });

  it('ignores input while disabled and after abort', () => {
    enabled = false;
    key('5').click();
    expect(pad.getValue()).toBe('');
    enabled = true;
    abort.abort();
    key('5').click();
    expect(pad.getValue()).toBe('');
  });

  it('setValue sanitises and does not fire onChange; setLabels relabels', () => {
    pad.setValue('1a2b3c4');
    expect(pad.getValue()).toBe('123');
    expect(onChange).not.toHaveBeenCalled();
    pad.setLabels({ group: 'Touches', backspace: 'Effacer' });
    expect(pad.element.getAttribute('aria-label')).toBe('Touches');
    expect(keys()[10].getAttribute('aria-label')).toBe('Effacer');
  });
});
