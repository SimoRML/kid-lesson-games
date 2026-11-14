/**
 * 0-9 keypad with backspace. Every key is a real button (click, tap, Enter,
 * Space); digit keys and Backspace on the keyboard work while focus is inside
 * `keyTarget`. The widget owns the typed digits, not their meaning.
 *
 * Spec: docs/design/number-workshop/04-ux-and-vibe.md §3
 */

export interface KeypadLabels {
  group: string;
  backspace: string;
}

export interface KeypadOptions {
  signal: AbortSignal;
  isEnabled: () => boolean;
  /** Digits kept at most; a function lets the limit change from one entry to the next. */
  maxDigits: number | (() => number);
  onChange: (value: string) => void;
  labels: KeypadLabels;
  /** Element whose subtree receives keyboard digits. Defaults to the keypad. */
  keyTarget?: HTMLElement;
}

export interface Keypad {
  readonly element: HTMLElement;
  /** Digits typed so far ('' when empty). */
  getValue(): string;
  setValue(value: string): void;
  setLabels(labels: KeypadLabels): void;
}

export function createKeypad(parent: HTMLElement, opts: KeypadOptions): Keypad {
  let value = '';
  const root = document.createElement('div');
  root.className = 'nw-keypad';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', opts.labels.group);

  const backBtn = document.createElement('button');

  function change(next: string): void {
    if (next === value) return;
    value = next;
    opts.onChange(value);
  }

  const limit = (): number => (typeof opts.maxDigits === 'function' ? opts.maxDigits() : opts.maxDigits);

  function pressDigit(d: string): void {
    if (!opts.isEnabled() || value.length >= limit()) return;
    // No leading zeros: "0" followed by a digit replaces the zero.
    change(value === '0' ? d : value + d);
  }

  function backspace(): void {
    if (!opts.isEnabled() || value.length === 0) return;
    change(value.slice(0, -1));
  }

  for (let d = 0; d <= 9; d++) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'nw-btn nw-key';
    key.textContent = String(d);
    key.addEventListener('click', () => pressDigit(String(d)), { signal: opts.signal });
    root.appendChild(key);
  }
  backBtn.type = 'button';
  backBtn.className = 'nw-btn nw-key nw-key-back';
  backBtn.textContent = '⌫';
  backBtn.setAttribute('aria-label', opts.labels.backspace);
  backBtn.addEventListener('click', backspace, { signal: opts.signal });
  root.appendChild(backBtn);
  parent.appendChild(root);

  (opts.keyTarget ?? root).addEventListener(
    'keydown',
    (ev) => {
      const e = ev as KeyboardEvent;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      }
    },
    { signal: opts.signal }
  );

  return {
    element: root,
    getValue: () => value,
    setValue(next: string) {
      value = next.replace(/[^0-9]/g, '').slice(0, limit());
    },
    setLabels(labels) {
      root.setAttribute('aria-label', labels.group);
      backBtn.setAttribute('aria-label', labels.backspace);
    }
  };
}
