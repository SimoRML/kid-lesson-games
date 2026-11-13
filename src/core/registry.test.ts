import { describe, expect, it } from 'vitest';
import { registry } from './registry.js';
import type { GameMetadata, KidGame } from './types.js';

describe('GameRegistry', () => {
  it('registers, lists, and exposes games by id', () => {
    const uniqueId = `registry-game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const metadata: GameMetadata = {
      id: uniqueId,
      title: 'Registry Test Game',
      version: '1.0.0',
      description: 'Exercise registry behavior',
      category: 'numbers',
      ageGroups: ['6-8'],
      skills: ['counting']
    };

    const game: KidGame = {
      mount: async () => undefined,
      start: () => undefined,
      destroy: () => undefined
    };

    registry.register(metadata, async () => game);

    expect(registry.has(uniqueId)).toBe(true);
    expect(registry.get(uniqueId)?.metadata).toEqual(metadata);
    expect(registry.list().some((entry) => entry.id === uniqueId)).toBe(true);
  });

  it('creates a registered game', async () => {
    const uniqueId = `registry-create-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const metadata: GameMetadata = {
      id: uniqueId,
      title: 'Create Test Game',
      version: '1.0.0',
      description: 'Factory-based game creation',
      category: 'logic',
      ageGroups: ['9-11'],
      skills: ['reasoning']
    };
    const loadedGame: KidGame = {
      mount: async () => undefined,
      start: () => undefined,
      destroy: () => undefined
    };

    registry.register(metadata, async () => loadedGame);

    const created = await registry.create(uniqueId);

    expect(created.metadata.id).toBe(uniqueId);
    expect(created.game).toBe(loadedGame);
  });

  it('throws a helpful error for unknown ids', async () => {
    await expect(registry.create('not-a-real-game')).rejects.toThrow(
      'Game with id "not-a-real-game" not found in registry.'
    );
  });
});
