/**
 * Mode identifiers for the number-workshop cartridge.
 *
 * The ids and BUILT_MODES are plain constants so that pure modules (levels.ts)
 * can know which modes exist without importing any DOM code. The controller
 * interfaces below are type-only and are what the shell and every mode share.
 * Spec: docs/design/number-workshop/03-architecture.md §3
 */

import type { SoundEngine } from '../../../src/core/audio.js';
import type { Difficulty } from '../../../src/core/types.js';
import type { Dictionary } from '../i18n.js';
import type { Level } from '../levels.js';

export type ModeId = 'facts' | 'shift' | 'euclid' | 'long';

/** Every mode the level schema knows about, in teaching order. */
export const ALL_MODES: readonly ModeId[] = ['facts', 'shift', 'euclid', 'long'];

/**
 * Modes that have a playable implementation. Grows by one per mode PR.
 * The parser and the generator default to this list, so a level whose mode is
 * not built yet is skipped instead of reaching a game that cannot render it.
 */
export const BUILT_MODES: readonly ModeId[] = ['facts', 'shift', 'euclid'];

/** What the shell offers to a mode. A mode never emits events or advances levels itself. */
export interface ModeHost {
  /** Aborted when the level or the whole game is torn down. */
  readonly signal: AbortSignal;
  readonly difficulty: Difficulty;
  readonly reducedMotion: boolean;
  /** True for `facts` levels at ages 3-5: no `÷`, no equation, sentences only. */
  readonly symbolFree: boolean;
  /** Current locale's strings. */
  t(): Dictionary;
  formatNumber(n: number): string;
  /** `context.audio`; never closed by the cartridge. */
  readonly audio: SoundEngine;
  /** Live HUD text (written with textContent). */
  setInstruction(text: string): void;
  /** Tracked timer: cleared on teardown and frozen while the game is paused. */
  setTimeout(fn: () => void, ms: number): void;
  reportMistake(): void;
  /** Call once per level; the shell then runs settle, celebrate, advance. */
  solved(): void;
}

export interface ModeController {
  mount(stage: HTMLElement, level: Level, host: ModeHost): void;
  /** Re-render text in place and keep the child's progress. */
  onLocaleChange(): void;
  setPaused(paused: boolean): void;
  /** HUD reset button: restart this level. */
  reset(): void;
  /** Remove own DOM; listeners die with `host.signal`. */
  destroy(): void;
}
