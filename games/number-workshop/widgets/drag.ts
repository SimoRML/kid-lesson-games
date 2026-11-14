/**
 * Tap-or-drag helper shared by the modes.
 *
 * A plain `click` (mouse, touch tap, Enter, Space) is the primary action, so
 * keyboard users and tests need no pointer events. Pointer events add dragging:
 * movement beyond a small threshold turns a press into a drag, and the click
 * that browsers fire right after a drag is swallowed.
 *
 * All listeners are bound to the supplied AbortSignal.
 * Spec: docs/design/number-workshop/04-ux-and-vibe.md §3
 */

/** Movement (px) under which a press is still a tap. */
export const TAP_THRESHOLD = 5;
/** Default snap radius (px) around a drop target; the spec asks for 40-90. */
export const SNAP_RADIUS = 70;
/** A click this soon after a drag ends is the browser's echo of the drag. */
const CLICK_ECHO_MS = 350;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DragOptions {
  signal: AbortSignal;
  /** Return false to ignore all input (paused, solved). */
  isEnabled?: () => boolean;
  /** Fired for a click, a tap, or a keyboard activation. */
  onTap?: () => void;
  onDragStart?: () => void;
  /** Fired once the drag ends, with the pointer position and the movement since the press. */
  onDrop?: (point: Point, delta: Point) => void;
  threshold?: number;
}

/** Nearest target whose centre is within `radius` of the point, or null. */
export function nearestTarget<T>(
  point: Point,
  targets: ReadonlyArray<{ item: T; box: Box }>,
  radius: number = SNAP_RADIUS
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const { item, box } of targets) {
    const dx = point.x - (box.left + box.width / 2);
    const dy = point.y - (box.top + box.height / 2);
    // A point inside the box always counts, even for a box larger than the radius.
    const inside =
      point.x >= box.left &&
      point.x <= box.left + box.width &&
      point.y >= box.top &&
      point.y <= box.top + box.height;
    const dist = inside ? 0 : Math.hypot(dx, dy);
    if ((inside || dist <= radius) && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Convenience: boxes for a list of elements, ready for `nearestTarget`. */
export function targetsFrom<T extends Element>(
  els: readonly T[]
): Array<{ item: T; box: Box }> {
  return els.map((el) => ({ item: el, box: boxOf(el) }));
}

/** Makes `el` respond to taps and to drags. Returns nothing: teardown is the signal. */
export function attachTapOrDrag(el: HTMLElement, opts: DragOptions): void {
  const threshold = opts.threshold ?? TAP_THRESHOLD;
  const enabled = (): boolean => (opts.isEnabled ? opts.isEnabled() : true);
  let lastDragEnd = -Infinity;

  el.addEventListener(
    'click',
    () => {
      if (!enabled()) return;
      if (Date.now() - lastDragEnd < CLICK_ECHO_MS) return;
      opts.onTap?.();
    },
    { signal: opts.signal }
  );

  el.addEventListener(
    'pointerdown',
    (down) => {
      if (!enabled()) return;
      const pe = down as MouseEvent;
      if (pe.button !== undefined && pe.button > 0) return;
      const start: Point = { x: pe.clientX, y: pe.clientY };
      let dragging = false;

      const move = (ev: Event): void => {
        const m = ev as MouseEvent;
        const dx = m.clientX - start.x;
        const dy = m.clientY - start.y;
        if (!dragging && Math.hypot(dx, dy) > threshold) {
          dragging = true;
          el.classList.add('nw-dragging');
          opts.onDragStart?.();
        }
        if (dragging) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      };

      const end = (ev: Event): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', cancel);
        if (!dragging) return;
        const m = ev as MouseEvent;
        el.classList.remove('nw-dragging');
        el.style.transform = '';
        lastDragEnd = Date.now();
        if (enabled()) {
          opts.onDrop?.({ x: m.clientX, y: m.clientY }, { x: m.clientX - start.x, y: m.clientY - start.y });
        }
      };

      const cancel = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', cancel);
        if (dragging) {
          el.classList.remove('nw-dragging');
          el.style.transform = '';
          lastDragEnd = Date.now();
        }
      };

      window.addEventListener('pointermove', move, { signal: opts.signal });
      window.addEventListener('pointerup', end, { signal: opts.signal });
      window.addEventListener('pointercancel', cancel, { signal: opts.signal });
    },
    { signal: opts.signal }
  );
}
