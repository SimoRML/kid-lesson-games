import { describe, expect, it } from 'vitest';
import {
  CLEAN_LEVEL_BONUS,
  POINTS_PER_LEVEL,
  completeLevel,
  computeStars,
  createSession,
  elapsedSeconds,
  isComplete,
  pauseSession,
  recordMistake,
  resumeSession
} from './session.js';

describe('session scoring', () => {
  it('starts empty and running', () => {
    const s = createSession(3, 1000);
    expect(s).toMatchObject({ total: 3, solved: 0, score: 0, streak: 0, mistakes: 0, runningSince: 1000 });
    expect(isComplete(s)).toBe(false);
  });

  it('awards 150 for a clean level and 100 after a mistake', () => {
    expect(POINTS_PER_LEVEL).toBe(100);
    expect(CLEAN_LEVEL_BONUS).toBe(50);

    let s = createSession(3, 0);
    const first = completeLevel(s, 10);
    expect(first).toMatchObject({ delta: 150, step: 1, complete: false });
    expect(first.state).toMatchObject({ score: 150, streak: 1, solved: 1 });

    s = recordMistake(first.state);
    expect(s).toMatchObject({ mistakes: 1, mistakesThisLevel: 1 });
    const second = completeLevel(s, 20);
    expect(second).toMatchObject({ delta: 100, step: 2, complete: false });
    expect(second.state).toMatchObject({ score: 250, streak: 0, mistakes: 1, mistakesThisLevel: 0 });

    const third = completeLevel(second.state, 30);
    expect(third).toMatchObject({ delta: 150, step: 3, complete: true });
    expect(third.state).toMatchObject({ score: 400, streak: 1 });
    expect(isComplete(third.state)).toBe(true);
  });

  it('counts a streak of consecutive clean levels', () => {
    let s = createSession(4, 0);
    s = completeLevel(s, 1).state;
    s = completeLevel(s, 2).state;
    expect(s.streak).toBe(2);
    s = completeLevel(recordMistake(s), 3).state;
    expect(s.streak).toBe(0);
  });

  it('does not mutate its input', () => {
    const s = createSession(2, 0);
    const frozen = Object.freeze({ ...s });
    recordMistake(frozen);
    completeLevel(frozen, 5);
    pauseSession(frozen, 5);
    expect(frozen).toEqual(s);
  });

  it('ignores further activity once the set is complete', () => {
    const done = completeLevel(createSession(1, 0), 4000).state;
    expect(recordMistake(done)).toBe(done);
    expect(completeLevel(done, 9000)).toEqual({ state: done, delta: 0, step: 1, complete: true });
    expect(resumeSession(done, 9000)).toBe(done);
    expect(elapsedSeconds(done, 99000)).toBe(4);
  });

  it('treats an empty set as already complete', () => {
    const s = createSession(0, 0);
    expect(isComplete(s)).toBe(true);
    expect(completeLevel(s, 10).delta).toBe(0);
    expect(createSession(-3, 0).total).toBe(0);
  });
});

describe('active play time', () => {
  it('reports whole seconds while running', () => {
    const s = createSession(2, 1000);
    expect(elapsedSeconds(s, 1000)).toBe(0);
    expect(elapsedSeconds(s, 1999)).toBe(0);
    expect(elapsedSeconds(s, 3500)).toBe(2);
  });

  it('excludes paused time', () => {
    let s = createSession(2, 0);
    s = pauseSession(s, 4000);
    expect(s.runningSince).toBeNull();
    expect(elapsedSeconds(s, 60000)).toBe(4);
    s = resumeSession(s, 60000);
    expect(elapsedSeconds(s, 63000)).toBe(7);
  });

  it('makes repeated pause and resume calls harmless', () => {
    let s = pauseSession(createSession(2, 0), 2000);
    expect(pauseSession(s, 5000)).toBe(s);
    s = resumeSession(s, 10000);
    expect(resumeSession(s, 20000)).toBe(s);
    expect(elapsedSeconds(s, 11000)).toBe(3);
  });

  it('never goes backwards if the clock does', () => {
    const s = createSession(2, 5000);
    expect(elapsedSeconds(s, 1000)).toBe(0);
    expect(pauseSession(s, 1000).bankedMs).toBe(0);
  });

  it('stops the clock when the last level is solved', () => {
    const end = completeLevel(createSession(1, 0), 2500);
    expect(end.state.runningSince).toBeNull();
    expect(elapsedSeconds(end.state, 100000)).toBe(2);
  });
});

describe('computeStars', () => {
  it.each([
    [0, 5, 3],
    [1, 5, 3],
    [2, 5, 2],
    [5, 5, 2],
    [6, 5, 1],
    [1, 1, 3],
    [2, 1, 1],
    [3, 3, 2],
    [4, 3, 1]
  ])('%i mistakes over %i levels gives %i stars', (mistakes, levels, stars) => {
    expect(computeStars(mistakes, levels)).toBe(stars);
  });
});
