import { registry } from './core/registry.js';
import type { GameMetadata } from './core/types.js';

// Import balance-scale metadata and factory
import balanceScaleMeta from '../games/balance-scale/game.json';
import { createBalanceScaleGame } from '../games/balance-scale/index.js';

// Register built-in games
registry.register(balanceScaleMeta as GameMetadata, createBalanceScaleGame);

// Export types and classes
export * from './core/types.js';
export { registry } from './core/registry.js';
export { KidGameElement } from './core/KidGameElement.js';
