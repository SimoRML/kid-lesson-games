/**
 * Small DOM helpers shared by the views. Dynamic text always goes through
 * textContent; no HTML strings are ever built from data.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, text: string, label?: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
}

/**
 * Replaces the stage content while keeping keyboard focus: the element focused
 * before (identified by `data-key`) is focused again after the re-render.
 */
export function swapContent(stage: HTMLElement, content: Node): void {
  const root = stage.getRootNode() as Document | ShadowRoot;
  const active = (root as { activeElement?: Element | null }).activeElement ?? null;
  const key = active instanceof HTMLElement && stage.contains(active) ? active.dataset.key : undefined;
  stage.replaceChildren(content);
  if (!key) return;
  // Keys are internal constants such as "jar" or "bin-2" (never external data).
  const again = Array.from(stage.querySelectorAll<HTMLElement>('[data-key]')).find((n) => n.dataset.key === key);
  if (again && !(again as HTMLButtonElement).disabled) again.focus();
}

/** Movement (px) under which a press is still a tap. */
export const TAP_THRESHOLD = 5;
/** Extra radius (px) around a drop target that still counts as a hit. */
export const SNAP_RADIUS = 60;
const CLICK_ECHO_MS = 350;

export interface Point {
  x: number;
  y: number;
}

/** True when the point is inside the element's box grown by `radius`. */
export function hits(target: Element, point: Point, radius = SNAP_RADIUS): boolean {
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return (
    point.x >= r.left - radius &&
    point.x <= r.right + radius &&
    point.y >= r.top - radius &&
    point.y <= r.bottom + radius
  );
}

export interface TapDragOptions {
  signal: AbortSignal;
  enabled: () => boolean;
  /** Click, tap, Enter or Space. */
  onTap: () => void;
  /** Fired when a drag (movement beyond the threshold) ends. */
  onDrop?: (point: Point) => void;
  /**
   * What follows the pointer while dragging (e.g. one candy taken from a bin).
   * Without it the node itself moves.
   */
  ghost?: () => HTMLElement;
}

/**
 * Click is the primary action (keyboard and tests need no pointer events);
 * pointer events add dragging. The click a browser fires after a drag is ignored.
 */
export function tapOrDrag(node: HTMLElement, opts: TapDragOptions): void {
  let lastDragEnd = -Infinity;
  node.addEventListener(
    'click',
    () => {
      if (!opts.enabled() || Date.now() - lastDragEnd < CLICK_ECHO_MS) return;
      opts.onTap();
    },
    { signal: opts.signal }
  );
  if (!opts.onDrop) return;
  const onDrop = opts.onDrop;

  node.addEventListener(
    'pointerdown',
    (down) => {
      const pe = down as PointerEvent;
      if (!opts.enabled() || (pe.button !== undefined && pe.button > 0)) return;
      const start: Point = { x: pe.clientX, y: pe.clientY };
      let dragging = false;
      let ghost: HTMLElement | null = null;
      const local = new AbortController();
      const cleanup = (): void => {
        ghost?.remove();
        ghost = null;
        node.classList.remove('cf-dragging', 'cf-drag-source');
        node.style.transform = '';
      };
      const stop = (): void => local.abort();
      local.signal.addEventListener('abort', cleanup);
      opts.signal.addEventListener('abort', stop, { signal: local.signal });

      const place = (x: number, y: number): void => {
        if (ghost) ghost.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
      };

      window.addEventListener(
        'pointermove',
        (ev) => {
          const m = ev as PointerEvent;
          const dx = m.clientX - start.x;
          const dy = m.clientY - start.y;
          if (!dragging && Math.hypot(dx, dy) > TAP_THRESHOLD) {
            dragging = true;
            if (opts.ghost) {
              ghost = el('span', 'cf-ghost');
              ghost.setAttribute('aria-hidden', 'true');
              ghost.appendChild(opts.ghost());
              (node.closest('.cf-root') ?? node.parentElement ?? node).appendChild(ghost);
              node.classList.add('cf-drag-source');
            } else {
              node.classList.add('cf-dragging');
            }
          }
          if (!dragging) return;
          if (ghost) place(m.clientX, m.clientY);
          else node.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
        },
        { signal: local.signal }
      );
      const finish = (ev: Event, drop: boolean): void => {
        const wasDragging = dragging;
        stop();
        if (!wasDragging) return;
        lastDragEnd = Date.now();
        const m = ev as PointerEvent;
        if (drop && opts.enabled()) onDrop({ x: m.clientX, y: m.clientY });
      };
      window.addEventListener('pointerup', (ev) => finish(ev, true), { signal: local.signal });
      window.addEventListener('pointercancel', (ev) => finish(ev, false), { signal: local.signal });
    },
    { signal: opts.signal }
  );
}

/** Visual item for a place-value column: candy, bag, box or crate (pure CSS). */
export function item(column: number, extra = ''): HTMLElement {
  const kinds = ['candy', 'bag', 'box', 'crate'];
  const kind = kinds[Math.max(0, Math.min(3, column))];
  const node = el('span', `cf-item cf-${kind}${extra ? ` ${extra}` : ''}`);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export interface KeypadOptions {
  signal: AbortSignal;
  enabled: () => boolean;
  onDigit: (d: number) => void;
  eraseLabel?: string;
  onErase?: () => void;
  checkLabel?: string;
  onCheck?: () => void;
}

/** 0-9 keypad (plus optional erase / check keys). Physical keyboard digits work too. */
export function keypad(opts: KeypadOptions): HTMLElement {
  const pad = el('div', 'cf-keypad');
  pad.setAttribute('role', 'group');
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
    const key = button('cf-key', String(d));
    key.dataset.digit = String(d);
    key.addEventListener('click', () => opts.enabled() && opts.onDigit(d), { signal: opts.signal });
    pad.appendChild(key);
  }
  if (opts.onErase) {
    const erase = button('cf-key cf-key-erase', '⌫', opts.eraseLabel);
    erase.addEventListener('click', () => opts.enabled() && opts.onErase?.(), { signal: opts.signal });
    pad.appendChild(erase);
  }
  if (opts.onCheck) {
    const check = button('cf-key cf-key-check', opts.checkLabel ?? '✓');
    check.addEventListener('click', () => opts.enabled() && opts.onCheck?.(), { signal: opts.signal });
    pad.appendChild(check);
  }
  return pad;
}

/**
 * Binds physical keyboard digits (and Backspace / Enter) while focus is inside
 * `scope` (listening on the game, not the page, so two games never share keys).
 */
export function bindKeyboard(scope: HTMLElement, opts: KeypadOptions): void {
  scope.addEventListener(
    'keydown',
    (ev) => {
      if (!opts.enabled() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (/^[0-9]$/.test(ev.key)) opts.onDigit(Number(ev.key));
      else if (ev.key === 'Backspace' && opts.onErase) opts.onErase();
      else if (ev.key === 'Enter' && opts.onCheck) {
        // Enter on a focused button already clicks it.
        const target = ev.target as HTMLElement | null;
        if (target && target.tagName === 'BUTTON') return;
        opts.onCheck();
      }
    },
    { signal: opts.signal }
  );
}

/** The customer card: avatar, name and a speech bubble. */
export function customerCard(name: string, avatarIndex: number, bubble: Node): HTMLElement {
  const avatars = ['🧒', '👧', '👦', '🧑', '👩', '👨'];
  const card = el('div', 'cf-customer');
  const avatar = el('span', 'cf-avatar', avatars[Math.abs(avatarIndex) % avatars.length]);
  avatar.setAttribute('aria-hidden', 'true');
  const who = el('span', 'cf-name', name);
  const speech = el('div', 'cf-bubble');
  speech.appendChild(bubble);
  card.append(avatar, who, speech);
  return card;
}
