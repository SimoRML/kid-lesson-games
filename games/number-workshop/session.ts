/**
 * Pure session state for the number-workshop cartridge: level progress, score,
 * mistakes, streak, stars and active play time.
 *
 * No DOM and no clock access: callers pass the current time in milliseconds.
 * Every function returns a new state and leaves its input untouched.
 * Spec: docs/design/number-workshop/03-architecture.md §5
 */

export const POINTS_PER_LEVEL = 100;
export const CLEAN_LEVEL_BONUS = 50;

export type Stars = 1 | 2 | 3;

export interface SessionState {
  /** Number of levels in the set. */
  readonly total: number;
  /** Levels solved so far (0-based index of the level being played). */
  readonly solved: number;
  readonly score: number;
  /** Consecutive levels solved without a mistake. */
  readonly streak: number;
  readonly mistakes: number;
  readonly mistakesThisLevel: number;
  /** Active play time banked before the current running stretch, in ms. */
  readonly bankedMs: number;
  /** Start of the current running stretch, or null while paused or finished. */
  readonly runningSince: number | null;
}

export interface LevelOutcome {
  state: SessionState;
  /** Points earned by this level. */
  delta: number;
  /** 1-based number of the level just solved. */
  step: number;
  /** True when this was the last level of the set. */
  complete: boolean;
}

export function createSession(total: number, now: number): SessionState {
  return {
    total: Math.max(0, Math.floor(total)),
    solved: 0,
    score: 0,
    streak: 0,
    mistakes: 0,
    mistakesThisLevel: 0,
    bankedMs: 0,
    runningSince: now
  };
}

export function isComplete(state: SessionState): boolean {
  return state.solved >= state.total;
}

/** A failed check or a rejected step. Undo is not a mistake. */
export function recordMistake(state: SessionState): SessionState {
  if (isComplete(state)) return state;
  return {
    ...state,
    mistakes: state.mistakes + 1,
    mistakesThisLevel: state.mistakesThisLevel + 1
  };
}

/** Stops the clock. Does nothing if it is already stopped. */
export function pauseSession(state: SessionState, now: number): SessionState {
  if (state.runningSince === null) return state;
  return {
    ...state,
    bankedMs: state.bankedMs + Math.max(0, now - state.runningSince),
    runningSince: null
  };
}

/** Restarts the clock. Does nothing if it is running or the set is finished. */
export function resumeSession(state: SessionState, now: number): SessionState {
  if (state.runningSince !== null || isComplete(state)) return state;
  return { ...state, runningSince: now };
}

/** Marks the current level solved and scores it. The clock stops on the last level. */
export function completeLevel(state: SessionState, now: number): LevelOutcome {
  if (isComplete(state)) {
    return { state, delta: 0, step: state.solved, complete: true };
  }

  const clean = state.mistakesThisLevel === 0;
  const delta = POINTS_PER_LEVEL + (clean ? CLEAN_LEVEL_BONUS : 0);
  const solved = state.solved + 1;
  const complete = solved >= state.total;

  let next: SessionState = {
    ...state,
    solved,
    score: state.score + delta,
    streak: clean ? state.streak + 1 : 0,
    mistakesThisLevel: 0
  };
  if (complete) next = pauseSession(next, now);

  return { state: next, delta, step: solved, complete };
}

/** Whole seconds of active play, excluding paused time. */
export function elapsedSeconds(state: SessionState, now: number): number {
  const running = state.runningSince === null ? 0 : Math.max(0, now - state.runningSince);
  return Math.floor((state.bankedMs + running) / 1000);
}

/** 3 stars for at most one mistake, 2 for at most one per level on average, else 1. */
export function computeStars(mistakes: number, levels: number): Stars {
  if (mistakes <= 1) return 3;
  if (mistakes <= levels) return 2;
  return 1;
}
