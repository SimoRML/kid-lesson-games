import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createGroupBuilder, type GroupBuilder } from './group-builder.js';

const LABELS = { add: '+ group', remove: '− group', groupsLabel: 'Rows of 4' };

describe('group builder', () => {
  let abort: AbortController;
  let parent: HTMLElement;
  let enabled: boolean;
  let onChange: Mock<(groups: number, delta: -1 | 1) => void>;
  let gb: GroupBuilder;

  const buttons = () => {
    const [remove, add] = Array.from(parent.querySelectorAll('button'));
    return { remove, add };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    abort = new AbortController();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    enabled = true;
    onChange = vi.fn<(groups: number, delta: -1 | 1) => void>();
    gb = createGroupBuilder(parent, {
      unit: 4,
      maxGroups: 3,
      signal: abort.signal,
      isEnabled: () => enabled,
      onChange,
      labels: LABELS
    });
  });
  afterEach(() => {
    abort.abort();
    parent.remove();
    vi.useRealTimers();
  });

  it('grows by exactly one row of `unit` tokens per group', () => {
    buttons().add.click();
    buttons().add.click();
    expect(gb.getGroups()).toBe(2);
    expect(parent.querySelectorAll('.nw-gb-row')).toHaveLength(2);
    expect(parent.querySelectorAll('.nw-gb-dot')).toHaveLength(8);
    expect(onChange).toHaveBeenLastCalledWith(2, 1);
  });

  it('removes a group and never goes below zero or above the maximum', () => {
    buttons().remove.click();
    expect(gb.getGroups()).toBe(0);
    expect(buttons().remove.disabled).toBe(true);
    for (let i = 0; i < 5; i++) buttons().add.click();
    expect(gb.getGroups()).toBe(3);
    expect(buttons().add.disabled).toBe(true);
    buttons().remove.click();
    expect(gb.getGroups()).toBe(2);
    expect(onChange).toHaveBeenLastCalledWith(2, -1);
  });

  it('ignores clicks while disabled', () => {
    enabled = false;
    buttons().add.click();
    expect(gb.getGroups()).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets groups, labels and readout without firing onChange', () => {
    gb.setGroups(9);
    expect(gb.getGroups()).toBe(3);
    gb.setGroups(-2);
    expect(gb.getGroups()).toBe(0);
    gb.setLabels({ add: 'A', remove: 'R', groupsLabel: 'G' });
    gb.setReadout('4 × 1 = 4');
    expect(buttons().add.textContent).toBe('A');
    expect(parent.querySelector('.nw-gb')?.getAttribute('aria-label')).toBe('G');
    expect(parent.querySelector('.nw-gb-readout')?.textContent).toBe('4 × 1 = 4');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('repeats while a pointer holds the button, and the echo click adds nothing', () => {
    const { add } = buttons();
    add.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(450 + 130 * 2);
    add.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    const held = gb.getGroups();
    expect(held).toBe(2);
    add.click();
    expect(gb.getGroups()).toBe(held);
    vi.advanceTimersByTime(2000);
    expect(gb.getGroups()).toBe(held);
  });

  it('a quick press and release is a single click step', () => {
    const { add } = buttons();
    add.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    add.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    add.click();
    vi.advanceTimersByTime(2000);
    expect(gb.getGroups()).toBe(1);
  });

  it('stops repeating and leaves no timers after the signal aborts', () => {
    const { add } = buttons();
    add.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(450 + 130);
    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a custom visual renderer when given', () => {
    const custom = vi.fn((visual: HTMLElement, groups: number) => {
      visual.textContent = `bars:${groups}`;
    });
    const other = document.createElement('div');
    const gb2 = createGroupBuilder(other, {
      unit: 2,
      maxGroups: 5,
      signal: abort.signal,
      isEnabled: () => true,
      onChange: () => {},
      labels: LABELS,
      renderVisual: custom
    });
    gb2.setGroups(2);
    expect(other.querySelector('.nw-gb-visual')?.textContent).toBe('bars:2');
  });
});
