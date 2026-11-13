import type { GameFactory, GameMetadata, KidGame } from './types.js';

interface RegisteredGame {
  metadata: GameMetadata;
  load: GameFactory;
}

class GameRegistry {
  private games = new Map<string, RegisteredGame>();

  register(metadata: GameMetadata, load: GameFactory) {
    this.games.set(metadata.id, { metadata, load });
  }

  get(id: string): RegisteredGame | undefined {
    return this.games.get(id);
  }

  has(id: string): boolean {
    return this.games.has(id);
  }

  list(): GameMetadata[] {
    return Array.from(this.games.values()).map((g) => g.metadata);
  }

  async create(id: string): Promise<{ game: KidGame; metadata: GameMetadata }> {
    const entry = this.get(id);
    if (!entry) {
      throw new Error(`Game with id "${id}" not found in registry.`);
    }
    const game = await entry.load();
    return { game, metadata: entry.metadata };
  }
}

export const registry = new GameRegistry();
