/**
 * Mode identifiers for the number-workshop cartridge.
 *
 * This file holds ids only so that pure modules (levels.ts) can know which
 * modes exist without importing any DOM code. The controller interfaces are
 * added together with the first playable mode.
 */

export type ModeId = 'facts' | 'shift' | 'euclid' | 'long';

/** Every mode the level schema knows about, in teaching order. */
export const ALL_MODES: readonly ModeId[] = ['facts', 'shift', 'euclid', 'long'];

/**
 * Modes that have a playable implementation. Grows by one per mode PR.
 * The parser and the generator default to this list, so a level whose mode is
 * not built yet is skipped instead of reaching a game that cannot render it.
 */
export const BUILT_MODES: readonly ModeId[] = [];
