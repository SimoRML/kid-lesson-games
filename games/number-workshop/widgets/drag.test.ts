import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachTapOrDrag, nearestTarget, SNAP_RADIUS, TAP_THRESHOLD, targetsFrom } from './drag.js';

function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
}

describe('nearestTarget', () => {
  const boxes = [
    { item: 'a', box: { left: 0, top: 0, width: 100, height: 100 } },
    { item: 'b', box: { left: 300, top: 0, width: 100, height: 100 } }
  ];

  it('returns the box containing the point', () => {
    expect(nearestTarget({ x: 50, y: 50 }, boxes)).toBe('a');
    expect(nearestTarget({ x: 350, y: 50 }, boxes)).toBe('b');
  });

  it('snaps to a box centre within the radius and ignores farther ones', () => {
    expect(nearestTarget({ x: 50 + SNAP_RADIUS - 1, y: 50 }, boxes)).toBe('a');
    expect(nearestTarget({ x: 200, y: 50 }, boxes, 10)).toBeNull();
    expect(nearestTarget({ x: 1000, y: 1000 }, boxes)).toBeNull();
  });

  it('builds boxes from elements', () => {
    const div = document.createElement('div');
    const result = targetsFrom([div]);
    expect(result[0].item).toBe(div);
    expect(result[0].box).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe('attachTapOrDrag', () => {
  let abort: AbortController;
  let btn: HTMLButtonElement;
  beforeEach(() => {
    abort = new AbortController();
    btn = document.createElement('button');
    document.body.appendChild(btn);
  });
  afterEach(() => {
    abort.abort();
    btn.remove();
    vi.useRealTimers();
  });

  it('treats a click as a tap', () => {
    const onTap = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onTap });
    btn.click();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('does not drag for movement under the threshold', () => {
    const onDrop = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onDrop });
    btn.dispatchEvent(mouse('pointerdown', 10, 10));
    window.dispatchEvent(mouse('pointermove', 10 + TAP_THRESHOLD - 1, 10));
    window.dispatchEvent(mouse('pointerup', 12, 10));
    expect(onDrop).not.toHaveBeenCalled();
    expect(btn.style.transform).toBe('');
  });

  it('drags beyond the threshold, drops with the pointer position and swallows the echo click', () => {
    const onDrop = vi.fn();
    const onTap = vi.fn();
    const onDragStart = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onDrop, onTap, onDragStart });
    btn.dispatchEvent(mouse('pointerdown', 0, 0));
    window.dispatchEvent(mouse('pointermove', 30, 40));
    expect(btn.style.transform).toBe('translate(30px, 40px)');
    expect(btn.classList.contains('nw-dragging')).toBe(true);
    window.dispatchEvent(mouse('pointerup', 30, 40));
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({ x: 30, y: 40 }, { x: 30, y: 40 });
    expect(btn.style.transform).toBe('');
    btn.click();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('accepts a click again once the echo window has passed', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onTap, onDrop: () => {} });
    btn.dispatchEvent(mouse('pointerdown', 0, 0));
    window.dispatchEvent(mouse('pointermove', 30, 0));
    window.dispatchEvent(mouse('pointerup', 30, 0));
    vi.advanceTimersByTime(1000);
    btn.click();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('ignores input while disabled', () => {
    const onTap = vi.fn();
    const onDragStart = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onTap, onDragStart, isEnabled: () => false });
    btn.click();
    btn.dispatchEvent(mouse('pointerdown', 0, 0));
    window.dispatchEvent(mouse('pointermove', 50, 50));
    expect(onTap).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('cancels cleanly on pointercancel and drops nothing', () => {
    const onDrop = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onDrop });
    btn.dispatchEvent(mouse('pointerdown', 0, 0));
    window.dispatchEvent(mouse('pointermove', 50, 0));
    window.dispatchEvent(new Event('pointercancel'));
    window.dispatchEvent(mouse('pointerup', 50, 0));
    expect(onDrop).not.toHaveBeenCalled();
    expect(btn.style.transform).toBe('');
  });

  it('removes every listener when the signal aborts', () => {
    const onTap = vi.fn();
    const onDragStart = vi.fn();
    attachTapOrDrag(btn, { signal: abort.signal, onTap, onDragStart });
    btn.dispatchEvent(mouse('pointerdown', 0, 0));
    abort.abort();
    window.dispatchEvent(mouse('pointermove', 50, 50));
    btn.click();
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });
});
