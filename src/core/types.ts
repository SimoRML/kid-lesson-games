export type AgeGroup = '3-5' | '6-8' | '9-11';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameCategory = 'numbers' | 'letters' | 'logic' | 'spatial';

export interface GameMetadata {
  id: string;
  title: string;
  version: string;
  description: string;
  category: GameCategory;
  ageGroups: AgeGroup[];
  skills: string[];
  thumbnail?: string;
  author?: string;
}

export type GameEventType =
  | 'game:ready'
  | 'game:start'
  | 'game:progress'
  | 'game:score'
  | 'game:complete'
  | 'game:error';

export interface GameEventPayloads {
  'game:ready': { gameId: string };
  'game:start': { gameId: string };
  'game:progress': { step: number; total: number; detail?: string };
  'game:score': { points: number; streak?: number; delta?: number };
  'game:complete': { stars: 1 | 2 | 3; score: number; timeElapsed: number; summary?: string };
  'game:error': { message: string; code?: string };
}

export interface GameContext {
  ageGroup: AgeGroup;
  difficulty: Difficulty;
  sound: boolean;
  locale: string;
  emit: <T extends GameEventType>(type: T, payload: GameEventPayloads[T]) => void;
}

export interface KidGame {
  /**
   * Mounts the game into the host element and initializes listeners/resources.
   */
  mount(container: HTMLElement, context: GameContext): Promise<void> | void;

  /**
   * Starts the active gameplay round.
   */
  start(): void;

  /**
   * Optional pause handler.
   */
  pause?(): void;

  /**
   * Optional resume handler.
   */
  resume?(): void;

  /**
   * Updates configuration dynamically (e.g. toggling sound or difficulty mid-game).
   */
  updateConfig?(newContext: Partial<GameContext>): void;

  /**
   * Teardown: Must cancel animation loops, disconnect event listeners,
   * clear physics engines and audio contexts.
   */
  destroy(): void;
}

export type GameFactory = () => KidGame | Promise<KidGame>;
