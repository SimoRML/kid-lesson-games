/**
 * Group builder: "+ group" / "− group" buttons, a visual that grows by exactly
 * `unit` tokens per group, and a live read-out. It never decides the win; the
 * mode that owns it provides a Check button.
 *
 * Buttons act on click (keyboard, tap) and repeat while held with a pointer.
 * Spec: docs/design/number-workshop/01-pedagogy-and-modes.md §3
 */

const HOLD_DELAY_MS = 450;
const HOLD_REPEAT_MS = 130;

export interface GroupBuilderOptions {
  /** Tokens per group (the divisor). */
  unit: number;
  /** Upper bound on groups, so the visual stays bounded. */
  maxGroups: number;
  signal: AbortSignal;
  isEnabled: () => boolean;
  /** Called after each change with the new group count and the direction. */
  onChange: (groups: number, delta: 1 | -1) => void;
  labels: { add: string; remove: string; groupsLabel: string };
  /** Replaces the default array-of-rows visual. */
  renderVisual?: (visual: HTMLElement, groups: number, unit: number) => void;
  tokenClass?: string;
}

export interface GroupBuilder {
  readonly element: HTMLElement;
  getGroups(): number;
  setGroups(n: number): void;
  setLabels(labels: { add: string; remove: string; groupsLabel: string }): void;
  setReadout(text: string): void;
}

function defaultVisual(tokenClass: string) {
  return (visual: HTMLElement, groups: number, unit: number): void => {
    visual.replaceChildren();
    for (let g = 0; g < groups; g++) {
      const row = document.createElement('div');
      row.className = 'nw-gb-row';
      for (let u = 0; u < unit; u++) {
        const dot = document.createElement('span');
        dot.className = tokenClass;
        row.appendChild(dot);
      }
      visual.appendChild(row);
    }
  };
}

export function createGroupBuilder(
  parent: HTMLElement,
  opts: GroupBuilderOptions
): GroupBuilder {
  let groups = 0;
  let labels = opts.labels;
  const render = opts.renderVisual ?? defaultVisual(opts.tokenClass ?? 'nw-gb-dot');

  const root = document.createElement('div');
  root.className = 'nw-gb';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', labels.groupsLabel);

  const visual = document.createElement('div');
  visual.className = 'nw-gb-visual';
  visual.setAttribute('aria-hidden', 'true');

  const readout = document.createElement('div');
  readout.className = 'nw-gb-readout';
  readout.setAttribute('aria-live', 'polite');

  const buttons = document.createElement('div');
  buttons.className = 'nw-gb-buttons';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'nw-btn nw-gb-btn';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'nw-btn nw-gb-btn nw-btn-primary';
  buttons.append(removeBtn, addBtn);
  root.append(visual, readout, buttons);
  parent.appendChild(root);

  function refresh(): void {
    render(visual, groups, opts.unit);
    removeBtn.disabled = groups <= 0;
    addBtn.disabled = groups >= opts.maxGroups;
  }

  function step(delta: 1 | -1): boolean {
    if (!opts.isEnabled()) return false;
    const next = groups + delta;
    if (next < 0 || next > opts.maxGroups) return false;
    groups = next;
    refresh();
    opts.onChange(groups, delta);
    return true;
  }

  function bind(btn: HTMLButtonElement, delta: 1 | -1): void {
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let repeatTimer: ReturnType<typeof setInterval> | null = null;
    let repeated = false;
    let lastRepeat = -Infinity;

    const stop = (): void => {
      if (holdTimer !== null) clearTimeout(holdTimer);
      if (repeatTimer !== null) clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
    };

    btn.addEventListener(
      'click',
      () => {
        // The click that ends a hold-to-repeat press is not a new step.
        if (repeated && Date.now() - lastRepeat < 350) {
          repeated = false;
          return;
        }
        repeated = false;
        step(delta);
      },
      { signal: opts.signal }
    );

    btn.addEventListener(
      'pointerdown',
      () => {
        stop();
        repeated = false;
        holdTimer = setTimeout(() => {
          repeatTimer = setInterval(() => {
            if (!step(delta)) {
              stop();
              return;
            }
            repeated = true;
            lastRepeat = Date.now();
          }, HOLD_REPEAT_MS);
        }, HOLD_DELAY_MS);
      },
      { signal: opts.signal }
    );

    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
      btn.addEventListener(type, stop, { signal: opts.signal });
    }
    opts.signal.addEventListener('abort', stop, { once: true });
  }

  bind(removeBtn, -1);
  bind(addBtn, 1);

  function applyLabels(): void {
    removeBtn.textContent = labels.remove;
    addBtn.textContent = labels.add;
    root.setAttribute('aria-label', labels.groupsLabel);
  }
  applyLabels();
  refresh();

  return {
    element: root,
    getGroups: () => groups,
    setGroups(n: number) {
      groups = Math.max(0, Math.min(opts.maxGroups, Math.floor(n)));
      refresh();
    },
    setLabels(next) {
      labels = next;
      applyLabels();
    },
    setReadout(text: string) {
      readout.textContent = text;
    }
  };
}
