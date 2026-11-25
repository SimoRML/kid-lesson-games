/**
 * Contract between the Candy Factory shell (index.ts) and its stage views.
 * The shell owns HUD, scoring, timers, celebration and level flow; a view owns
 * only its stage and tells the shell when the level is solved.
 */

import type { SoundEngine } from '../../../src/core/audio.js';
import type { AgeGroup, Difficulty } from '../../../src/core/types.js';
import type { Dictionary } from '../i18n.js';

export interface ViewHost {
  /** Aborted when the level is torn down: bind every listener to it. */
  readonly signal: AbortSignal;
  readonly ageGroup: AgeGroup;
  readonly difficulty: Difficulty;
  readonly reducedMotion: boolean;
  /** Name of this order's customer. */
  readonly customer: string;
  readonly audio: SoundEngine;
  t(): Dictionary;
  fmt(n: number): string;
  /** False while paused, before start, or once solved. */
  isActive(): boolean;
  setInstruction(text: string): void;
  /** Tracked, pausable timeout (cleared on teardown). */
  setTimeout(fn: () => void, ms: number): void;
  /** A wrong answer (affects stars). Hints and refusals are not mistakes. */
  mistake(): void;
  solved(): void;
}

export interface View {
  /** Re-renders the stage from the view's own state (e.g. after a locale change). */
  render(): void;
}
