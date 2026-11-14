/**
 * The one list of built modes: id -> controller factory.
 * `BUILT_MODES` (modes/types.ts) must list exactly the keys of this registry;
 * a test asserts it.
 */

import { createFactsMode } from './facts.js';
import type { ModeController, ModeId } from './types.js';

export const MODE_REGISTRY: Partial<Record<ModeId, () => ModeController>> = {
  facts: createFactsMode
};
