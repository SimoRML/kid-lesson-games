import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { GameContext } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import { getTranslations } from './i18n.js';
import {
  PendulumRhythmGame,
  createGame,
  calculatePeriod,
  calculateFrequency,
  calculateLengthForPeriod,
  calculateLengthForBpm,
  calculatePolyrhythmLengthRatio,
  simulatePendulumStep,
  checkCircleBoxCollision,
  resolveCollisionImpulse,
  checkBeatMatch,
  verifyAntiMirroring,
  generateLevelsForAge,
  parseCustomLevels,
  type PendulumLevel,
  type PendulumState
} from './index.js';

describe('Pendulum Rhythm Game & Harmonic Oscillator Engine', () => {
  // =========================================================================
  // 1. PURE KINEMATICS, HARMONIC MATH & INTEGRATION
  // =========================================================================
  describe('Pure Kinematics & Physics Helpers', () => {
    it('calculates theoretical period T = 2π * sqrt(L / g) accurately', () => {
      // 1 meter = 100cm, g = 9.8 m/s² => T ≈ 2.006s
      const period1m = calculatePeriod(100, 9.8);
      expect(period1m).toBeCloseTo(2.006, 2);

      // 0.25 meter = 25cm, g = 9.8 m/s² => T ≈ 1.003s (half period of 1m)
      const period25cm = calculatePeriod(25, 9.8);
      expect(period25cm).toBeCloseTo(1.003, 2);
      expect(period1m / period25cm).toBeCloseTo(2.0, 3); // Square-root relationship T ∝ √L

      // 0.64 meter = 64cm, g = 9.8 m/s² => T ≈ 1.605s
      const period64cm = calculatePeriod(64, 9.8);
      expect(period64cm).toBeCloseTo(1.605, 2);
    });

    it('guards calculatePeriod against non-positive, NaN, or non-finite inputs', () => {
      expect(calculatePeriod(0)).toBe(0);
      expect(calculatePeriod(-10)).toBe(0);
      expect(calculatePeriod(100, 0)).toBe(0);
      expect(calculatePeriod(100, -9.8)).toBe(0);
      expect(calculatePeriod(NaN)).toBe(0);
      expect(calculatePeriod(100, NaN)).toBe(0);
      expect(calculatePeriod(Infinity)).toBe(0);
    });

    it('calculates frequency f = 1 / T accurately', () => {
      // For 100cm, T ≈ 2.006s => f ≈ 0.498 Hz
      const f100 = calculateFrequency(100, 9.8);
      expect(f100).toBeCloseTo(0.498, 2);

      // For 25cm, T ≈ 1.003s => f ≈ 0.997 Hz (double the frequency)
      const f25 = calculateFrequency(25, 9.8);
      expect(f25).toBeCloseTo(0.997, 2);
      expect(f25 / f100).toBeCloseTo(2.0, 3);

      // Invalid inputs return 0
      expect(calculateFrequency(0)).toBe(0);
      expect(calculateFrequency(-50)).toBe(0);
    });

    it('inverts period calculation: L = g * (T / 2π)² accurately', () => {
      const g = 9.8;
      // Target period 2.007s -> Length ≈ 100cm
      const lengthFor2s = calculateLengthForPeriod(calculatePeriod(100, g), g);
      expect(lengthFor2s).toBeCloseTo(100, 1);

      // Target period 1.003s -> Length ≈ 25cm
      const lengthFor1s = calculateLengthForPeriod(1.003033, g);
      expect(lengthFor1s).toBeCloseTo(25, 1);

      // Roundtrip test: calculateLengthForPeriod(calculatePeriod(L)) === L
      const originalL = 64; // cm
      const computedPeriod = calculatePeriod(originalL, g);
      const recoveredL = calculateLengthForPeriod(computedPeriod, g);
      expect(recoveredL).toBeCloseTo(originalL, 4);

      // Edge cases
      expect(calculateLengthForPeriod(0)).toBe(0);
      expect(calculateLengthForPeriod(-2)).toBe(0);
      expect(calculateLengthForPeriod(2, -9.8)).toBe(0);
    });

    it('calculates length for musical BPM tempos with 2 beats per cycle', () => {
      // 60 BPM (1 beat per second => 2-second cycle) -> L ≈ 99.3cm ≈ 100cm
      const len60 = calculateLengthForBpm(60, 2, 9.8);
      expect(len60).toBeCloseTo(99.29, 1);

      // 120 BPM (2 beats per second => 1-second cycle) -> L ≈ 24.8cm ≈ 25cm
      const len120 = calculateLengthForBpm(120, 2, 9.8);
      expect(len120).toBeCloseTo(24.82, 1);

      // Ratio of lengths for double tempo: L(60) / L(120) ≈ 4
      expect(len60 / len120).toBeCloseTo(4.0, 3);

      // 90 BPM (1.5 beats per second => 1.33-second cycle) -> L ≈ 44.1cm ≈ 45cm
      const len90 = calculateLengthForBpm(90, 2, 9.8);
      expect(len90).toBeCloseTo(44.13, 1);

      // Invalid inputs return 0
      expect(calculateLengthForBpm(0)).toBe(0);
      expect(calculateLengthForBpm(-60)).toBe(0);
      expect(calculateLengthForBpm(60, 0)).toBe(0);
    });

    it('calculates harmonic polyrhythm length ratios: L_B / L_A = (p / q)²', () => {
      // 2:1 ratio -> (2/1)² = 4
      expect(calculatePolyrhythmLengthRatio(2, 1)).toBe(4);

      // 3:1 ratio -> (3/1)² = 9
      expect(calculatePolyrhythmLengthRatio(3, 1)).toBe(9);

      // 3:2 ratio -> (3/2)² = 2.25
      expect(calculatePolyrhythmLengthRatio(3, 2)).toBe(2.25);

      // 4:3 ratio -> (4/3)² ≈ 1.7778
      expect(calculatePolyrhythmLengthRatio(4, 3)).toBeCloseTo(16 / 9, 4);

      // Invalid inputs return 0
      expect(calculatePolyrhythmLengthRatio(0, 1)).toBe(0);
      expect(calculatePolyrhythmLengthRatio(2, 0)).toBe(0);
      expect(calculatePolyrhythmLengthRatio(-2, 1)).toBe(0);
      expect(calculatePolyrhythmLengthRatio(NaN, 1)).toBe(0);
    });

    it('performs symplectic semi-implicit Euler integration without energy blowup', () => {
      // Start pendulum at 30 degrees (0.5236 rad) with zero initial velocity
      let state: PendulumState = {
        theta: (30 * Math.PI) / 180,
        omega: 0,
        alpha: 0,
        length: 1.0,
        time: 0
      };

      const dt = 0.016; // 60 FPS
      const initialTheta = state.theta;

      // Simulate 100 steps
      for (let i = 0; i < 100; i++) {
        state = simulatePendulumStep(state, dt, { g: 9.8, damping: 0 });
      }

      // With symplectic Euler and damping=0, pendulum oscillates within [-initialTheta, initialTheta]
      expect(Math.abs(state.theta)).toBeLessThanOrEqual(initialTheta * 1.05);
      expect(state.time).toBeCloseTo(100 * dt, 3);
      expect(Number.isFinite(state.theta)).toBe(true);
      expect(Number.isFinite(state.omega)).toBe(true);
    });

    it('applies damping in simulatePendulumStep to attenuate amplitude', () => {
      let stateNoDamping: PendulumState = {
        theta: (45 * Math.PI) / 180,
        omega: 0,
        length: 1.0
      };
      let stateWithDamping: PendulumState = {
        theta: (45 * Math.PI) / 180,
        omega: 0,
        length: 1.0
      };

      const dt = 0.02;
      for (let i = 0; i < 50; i++) {
        stateNoDamping = simulatePendulumStep(stateNoDamping, dt, { g: 9.8, damping: 0 });
        stateWithDamping = simulatePendulumStep(stateWithDamping, dt, { g: 9.8, damping: 0.1 });
      }

      // Damped pendulum angular velocity should have lower magnitude
      expect(Math.abs(stateWithDamping.omega)).toBeLessThanOrEqual(
        Math.abs(stateNoDamping.omega) + 0.001
      );
    });

    it('detects 2D circle-box collisions and returns contact normal and penetration', () => {
      const circle = { x: 100, y: 100, radius: 20 };
      const box = { x: 110, y: 100, width: 40, height: 40, isCenter: false };

      const hit = checkCircleBoxCollision(circle, box);
      expect(hit).not.toBeNull();
      expect(hit?.collided).toBe(true);
      expect(hit?.contactX).toBe(110);
      expect(hit?.distance).toBe(10);
      expect(hit?.penetration).toBe(10);
      expect(hit?.normalX).toBe(-1); // Points out towards circle

      // Circle far away -> null
      const farCircle = { x: 50, y: 50, radius: 10 };
      expect(checkCircleBoxCollision(farCircle, box)).toBeNull();
    });

    it('resolves collision impulse and transfers momentum between bob and block', () => {
      const bob = { vx: 200, vy: 0, mass: 250 };
      const block = { vx: 0, vy: 0, mass: 50, width: 40, height: 40 };
      const normal = { x: -1, y: 0 }; // contact normal pointing towards bob

      const result = resolveCollisionImpulse(bob, block, normal);
      expect(result.impulse).toBeGreaterThan(0);
      expect(result.blockDeltaV.x).toBeGreaterThan(0); // block pushed forward
      expect(result.bobDeltaV.x).toBeLessThan(0); // bob slowed down
      expect(result.blockDeltaOmega).not.toBeNaN();

      // Separating velocity -> zero impulse
      const separatingBob = { vx: -100, vy: 0, mass: 250 };
      const sepResult = resolveCollisionImpulse(separatingBob, block, normal);
      expect(sepResult.impulse).toBe(0);
    });

    it('checks beat match timing within inclusive tolerance window', () => {
      expect(checkBeatMatch(1.0, 1.05, 0.1)).toBe(true); // 50ms diff <= 100ms
      expect(checkBeatMatch(1.0, 1.1, 0.1)).toBe(true); // exact boundary 100ms <= 100ms
      expect(checkBeatMatch(1.0, 1.15, 0.1)).toBe(false); // 150ms diff > 100ms
      expect(checkBeatMatch(2.5, 2.45, 0.12)).toBe(true);
    });
  });

  // =========================================================================
  // 2. PROCEDURAL LEVEL GENERATION & AGE PROGRESSION
  // =========================================================================
  describe('Procedural Level Generation & Age Bracket Progression', () => {
    it('generates exactly 3 distinct levels for ages 3-5 (Knockdown mode)', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);

      levels.forEach((lvl, idx) => {
        expect(lvl.ageGroup).toBe('3-5');
        expect(lvl.levelNumber).toBe(idx + 1);
        expect(lvl.mode).toBe('knockdown');
        expect(lvl.pendulums).toHaveLength(1);
        expect(lvl.pendulums[0].mass).toBeGreaterThanOrEqual(200); // heavy wrecking ball
        expect(lvl.pedestal).toBeDefined();
        expect(lvl.blocks).toBeDefined();
        expect(lvl.blocks!.length).toBe(idx + 1); // 1 block in lvl 1, 2 in lvl 2, 3 in lvl 3
      });
    });

    it('generates exactly 3 distinct levels for ages 6-8 (Metronome tempo match)', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);

      const expectedBpms = [60, 90, 120];
      levels.forEach((lvl, idx) => {
        expect(lvl.ageGroup).toBe('6-8');
        expect(lvl.levelNumber).toBe(idx + 1);
        expect(lvl.mode).toBe('metronome');
        expect(lvl.metronome).toBeDefined();
        expect(lvl.metronome?.bpm).toBe(expectedBpms[idx]);
        expect(lvl.availableLengths?.length).toBeGreaterThanOrEqual(3);
        expect(lvl.availableMasses?.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('generates exactly 3 distinct levels for ages 9-11 (Harmonic Polyrhythms)', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);

      const expectedRatios = [
        { p: 2, q: 1 },
        { p: 3, q: 1 },
        { p: 3, q: 2 }
      ];

      levels.forEach((lvl, idx) => {
        expect(lvl.ageGroup).toBe('9-11');
        expect(lvl.levelNumber).toBe(idx + 1);
        expect(lvl.mode).toBe('polyrhythm');
        expect(lvl.polyrhythm).toBeDefined();
        expect(lvl.polyrhythm?.ratioP).toBe(expectedRatios[idx].p);
        expect(lvl.polyrhythm?.ratioQ).toBe(expectedRatios[idx].q);
        expect(lvl.pendulums).toHaveLength(2); // dual pendulums A and B
        expect(lvl.availableLengths?.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  // =========================================================================
  // 3. SOLVABILITY & ANTI-MIRRORING INVARIANTS
  // =========================================================================
  describe('Solvability & Anti-Mirroring Invariants', () => {
    it('verifies all generated levels satisfy verifyAntiMirroring across all age groups', () => {
      const ageGroups: ('3-5' | '6-8' | '9-11')[] = ['3-5', '6-8', '9-11'];
      for (const age of ageGroups) {
        const levels = generateLevelsForAge(age);
        levels.forEach((lvl) => {
          expect(verifyAntiMirroring(lvl)).toBe(true);
        });
      }
    });

    it('fails verifyAntiMirroring when a level violates anti-mirroring requirements', () => {
      // 6-8 level with only 1 length option
      const corruptedLevel68: PendulumLevel = {
        id: 'bad-68',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Trivial Mirroring',
        prompt: 'Copy length',
        mode: 'metronome',
        pendulums: [
          {
            id: 'p1',
            pivotX: 200,
            pivotY: 50,
            length: 100,
            mass: 100
          }
        ],
        availableLengths: [100], // only 1 choice -> trivial mirroring!
        availableMasses: [50],
        metronome: { bpm: 60 }
      };
      expect(verifyAntiMirroring(corruptedLevel68)).toBe(false);

      // 9-11 level with missing polyrhythm ratio
      const corruptedLevel911: PendulumLevel = {
        id: 'bad-911',
        levelNumber: 1,
        ageGroup: '9-11',
        title: 'Missing Ratio',
        prompt: 'No ratio',
        mode: 'polyrhythm',
        pendulums: [
          { id: 'p1', pivotX: 200, pivotY: 50, length: 25, mass: 100 },
          { id: 'p2', pivotX: 300, pivotY: 50, length: 100, mass: 100 }
        ],
        availableLengths: [25, 50, 100]
      };
      expect(verifyAntiMirroring(corruptedLevel911)).toBe(false);
    });

    it('proves mathematical solvability for all 6-8 metronome levels', () => {
      const levels = generateLevelsForAge('6-8');
      levels.forEach((lvl) => {
        const targetBpm = lvl.metronome!.bpm;
        const targetLen = calculateLengthForBpm(targetBpm, 2, 9.8);

        // Verify at least one length in availableLengths is close to targetLen (within 2cm)
        const hasSolvableLength = lvl.availableLengths!.some(
          (len) => Math.abs(len - targetLen) < 2.0
        );
        expect(hasSolvableLength).toBe(true);
      });
    });

    it('proves mathematical solvability for all 9-11 polyrhythm levels', () => {
      const levels = generateLevelsForAge('9-11');
      levels.forEach((lvl) => {
        const p = lvl.polyrhythm!.ratioP;
        const q = lvl.polyrhythm!.ratioQ;
        const lenA = lvl.pendulums[0].length;
        const requiredRatio = calculatePolyrhythmLengthRatio(p, q);
        const expectedLenB = lenA * requiredRatio;

        // Verify availableLengths contains expectedLenB
        const hasSolvableLength = lvl.availableLengths!.some(
          (len) => Math.abs(len - expectedLenB) < 0.5
        );
        expect(hasSolvableLength).toBe(true);
      });
    });
  });

  // =========================================================================
  // 4. DEFENSIVE CUSTOM LEVEL PARSER (parseCustomLevels)
  // =========================================================================
  describe('Defensive Custom Level Parser', () => {
    it('returns null on null, undefined, empty string, or non-object types', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels('')).toBeNull();
      expect(parseCustomLevels('   ')).toBeNull();
      expect(parseCustomLevels('invalid json {{{')).toBeNull();
      expect(parseCustomLevels(42)).toBeNull();
      expect(parseCustomLevels(true)).toBeNull();
    });

    it('returns null on empty array [] or array of invalid objects', () => {
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels([null, undefined, 42, 'str'])).toBeNull();
      expect(parseCustomLevels([{}, { title: 'no pendulums' }])).toBeNull();
    });

    it('sanitizes mixed arrays and extracts valid levels', () => {
      const mixed = [
        null,
        {},
        {
          id: 'valid-custom-1',
          ageGroup: '6-8',
          mode: 'metronome',
          title: 'Custom Tempo',
          prompt: 'Match 75 BPM',
          pendulums: [
            {
              id: 'p1',
              pivotX: 200,
              pivotY: 50,
              length: 64,
              mass: 100
            }
          ],
          metronome: { bpm: 75 },
          availableLengths: [25, 45, 64, 100]
        },
        { pendulums: [] } // corrupt: empty pendulums
      ];

      const parsed = parseCustomLevels(mixed);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      expect(parsed![0].id).toBe('valid-custom-1');
      expect(parsed![0].metronome?.bpm).toBe(75);
      expect(parsed![0].availableLengths).toEqual([25, 45, 64, 100]);
    });

    it('parses valid custom levels from stringified JSON', () => {
      const customArray = [
        {
          id: 'json-level-1',
          ageGroup: '3-5',
          mode: 'knockdown',
          title: 'JSON Knockdown',
          prompt: 'Smash the block!',
          pendulums: [{ pivotX: 200, pivotY: 50, length: 45, mass: 250 }],
          pedestal: { x: 380, y: 280, width: 100, height: 20 },
          blocks: [{ id: 'b1', x: 400, y: 236, width: 44, height: 44, mass: 60 }]
        }
      ];

      const jsonStr = JSON.stringify(customArray);
      const parsed = parseCustomLevels(jsonStr);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      expect(parsed![0].id).toBe('json-level-1');
      expect(parsed![0].mode).toBe('knockdown');
      expect(parsed![0].blocks).toHaveLength(1);
    });

    it('cleanly returns null without throwing when passed throwing accessors or hostile proxies', () => {
      const throwingObj = {
        get pendulums() {
          throw new Error('hostile accessor');
        }
      };
      expect(parseCustomLevels(throwingObj)).toBeNull();

      const throwingArray = [
        {
          get ageGroup() {
            throw new Error('getter error');
          }
        }
      ];
      expect(parseCustomLevels(throwingArray)).toBeNull();
    });
  });

  // =========================================================================
  // 5. KIDGAME DOM LIFECYCLE & ZERO-LEAK TEARDOWN
  // =========================================================================
  describe('KidGame DOM Lifecycle & Zero-Leak Teardown', () => {
    let container: HTMLElement;
    let context: GameContext;
    let audio: SoundEngine;
    let i18n: I18nManager;
    let emittedEvents: { type: string; payload?: any }[];
    let activeRafs: Set<number>;
    let nextRafId: number;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      emittedEvents = [];
      activeRafs = new Set();
      nextRafId = 1;

      audio = new SoundEngine();
      i18n = new I18nManager('en');

      context = {
        ageGroup: '6-8',
        difficulty: 'medium',
        sound: false,
        locale: 'en',
        audio,
        i18n,
        t: (k, p) => i18n.t(k, p),
        emit: (type, payload) => {
          emittedEvents.push({ type, payload });
        }
      };

      // Mock ResizeObserver
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;

      // Mock requestAnimationFrame / cancelAnimationFrame tracking
      globalThis.requestAnimationFrame = vi.fn().mockImplementation(() => {
        const id = nextRafId++;
        activeRafs.add(id);
        return id;
      });
      globalThis.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
        activeRafs.delete(id);
      });

      // Dummy Canvas 2D context
      const dummyCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        rect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        roundRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() })
      };

      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(dummyCtx);
      HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 800,
        height: 480,
        top: 0,
        left: 0,
        right: 800,
        bottom: 480
      });
    });

    afterEach(() => {
      container.remove();
      vi.clearAllMocks();
      vi.useRealTimers();
    });

    it('mounts DOM scaffold, binds events, and emits initial game:progress', () => {
      const game = createGame();
      expect(game).toBeInstanceOf(PendulumRhythmGame);

      game.mount(container, context);

      // Verify DOM elements exist
      expect(container.querySelector('#hud-title')).not.toBeNull();
      expect(container.querySelector('#level-badge')).not.toBeNull();
      expect(container.querySelector('#hud-instruction')).not.toBeNull();
      expect(container.querySelector('#score-display')).not.toBeNull();
      expect(container.querySelector('#btn-sound-toggle')).not.toBeNull();
      expect(container.querySelector('#btn-reset')).not.toBeNull();
      expect(container.querySelector('#pendulum-canvas')).not.toBeNull();

      // Verify initial game:progress emission
      const progressEvents = emittedEvents.filter((e) => e.type === 'game:progress');
      expect(progressEvents.length).toBeGreaterThanOrEqual(1);
      expect(progressEvents[0].payload.step).toBe(1);
      expect(progressEvents[0].payload.total).toBe(3);

      game.destroy();
    });

    it('maintains zero orphan animation frame loops across start, pause, resume, repeated starts, and destroy', () => {
      const game = createGame();
      game.mount(container, context);
      expect(activeRafs.size).toBe(0);

      // start() starts exactly 1 active loop
      game.start();
      expect(activeRafs.size).toBe(1);

      // Calling start() again must cancel prior frame and maintain exactly 1 active loop
      game.start();
      expect(activeRafs.size).toBe(1);

      // pause() cancels active frame
      game.pause?.();
      expect(activeRafs.size).toBe(0);

      // resume() restarts exactly 1 active frame
      game.resume?.();
      expect(activeRafs.size).toBe(1);

      // destroy() cancels all active frames
      game.destroy();
      expect(activeRafs.size).toBe(0);
      expect(container.innerHTML).toBe('');
    });

    it('handles runtime updateConfig for locale, sound, and ageGroup dynamically', () => {
      const game = createGame();
      game.mount(container, context);

      // 1. Switch to French
      game.updateConfig?.({ locale: 'fr' });
      const titleEl = container.querySelector('#hud-title');
      expect(titleEl?.textContent).toContain('Laboratoire du Pendule');

      // 2. Toggle sound
      game.updateConfig?.({ sound: true });
      expect(context.sound).toBe(true);
      const soundBtn = container.querySelector('#btn-sound-toggle');
      expect(soundBtn?.textContent).toContain('Son ACTIVÉ');

      // 3. Switch ageGroup to '9-11'
      game.updateConfig?.({ ageGroup: '9-11' });
      const badgeEl = container.querySelector('#level-badge');
      expect(badgeEl?.textContent).toContain('1/3');
      const tray = container.querySelector('#controls-tray');
      expect(tray?.textContent).toContain('Pendulum B Length');

      game.destroy();
    });

    it('survives repeated mount-start-destroy stress cycles without leaking handles or DOM nodes', () => {
      for (let i = 0; i < 5; i++) {
        const game = createGame();
        game.mount(container, context);
        game.start();
        expect(activeRafs.size).toBe(1);
        game.destroy();
        expect(activeRafs.size).toBe(0);
        expect(container.innerHTML).toBe('');
      }
    });

    it('supports granular reset without destroying or remounting DOM scaffold', () => {
      const game = createGame();
      game.mount(container, context);
      game.start();

      const resetBtn = container.querySelector('#btn-reset') as HTMLButtonElement;
      expect(resetBtn).not.toBeNull();
      resetBtn.click();

      // Canvas and HUD remain intact
      expect(container.querySelector('#pendulum-canvas')).not.toBeNull();
      expect(activeRafs.size).toBe(1);

      game.destroy();
    });

    it('handles out-of-order lifecycle calls defensively with zero errors and zero leaked rAFs', () => {
      // 1. destroy() before mount()
      const g1 = createGame();
      expect(() => g1.destroy()).not.toThrow();

      // 2. start() before mount()
      const g2 = createGame();
      expect(() => g2.start()).not.toThrow();
      expect(activeRafs.size).toBe(0);

      // 3. resume() before mount()
      const g3 = createGame();
      expect(() => g3.resume?.()).not.toThrow();
      expect(activeRafs.size).toBe(0);

      // 4. updateConfig() before mount()
      const g4 = createGame();
      expect(() => g4.updateConfig?.({ sound: true })).not.toThrow();

      // 5. start() after destroy() leaves zero orphan rAF loops
      const g5 = createGame();
      g5.mount(container, context);
      g5.destroy();
      expect(activeRafs.size).toBe(0);
      g5.start();
      expect(activeRafs.size).toBe(0);
    });

    it('verifies preschool knockdown reach: swing at θ ≥ 20° collides with blocks and knocks them down', () => {
      const preschoolContext: GameContext = {
        ...context,
        ageGroup: '3-5'
      };
      const game = createGame();
      game.mount(container, preschoolContext);
      game.start();

      // Level 1: Gentle Breeze Knockdown
      // Trigger 20° preset release
      const preset20 = container.querySelector('.btn-preset[data-angle="20"]') as HTMLButtonElement;
      expect(preset20).not.toBeNull();
      preset20.click();

      // Advance physics simulation frames across the swing (~1.5s = 90 frames of 16ms)
      const anyGame = game as any;
      let now = performance.now();
      for (let i = 0; i < 90; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      // Check that block was collided with and knocked down
      const activeBlocks = anyGame.activeBlocks;
      expect(activeBlocks.length).toBe(1);
      expect(activeBlocks[0].isKnocked).toBe(true);

      // Continue frames to verify settling completes round
      for (let i = 0; i < 40; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });

    it('verifies preschool Level 3 complete knockdown at 60° release sweeps and knocks over all 3 blocks', () => {
      const preschoolContext: GameContext = {
        ...context,
        ageGroup: '3-5'
      };
      const game = createGame();
      game.mount(container, preschoolContext);
      game.start();

      const anyGame = game as any;
      anyGame.setupLevel(2); // Level 3: Fortress Crash

      const preset60 = container.querySelector('.btn-preset[data-angle="60"]') as HTMLButtonElement;
      expect(preset60).not.toBeNull();
      preset60.click();

      let now = performance.now();
      // Simulate swing and knockdown over 120 frames (~2.0s)
      for (let i = 0; i < 120; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      const activeBlocks = anyGame.activeBlocks;
      expect(activeBlocks.length).toBe(3);
      for (const block of activeBlocks) {
        expect(block.isKnocked).toBe(true);
      }

      // Settling frames to complete round
      for (let i = 0; i < 40; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });

    it('finishes metronome settling within ~0.6s (35 frames at 60Hz) once streak is reached', () => {
      const game = createGame();
      game.mount(container, context); // 6-8 elementary metronome
      game.start();

      const anyGame = game as any;
      // Set beatMatchStreak directly to target streak (3)
      anyGame.beatMatchStreak = 3;
      expect(anyGame.isRoundOver).toBe(false);

      let now = performance.now();
      // Advance 20 frames: should still be settling
      for (let i = 0; i < 20; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.settlingFrames).toBe(20);
      expect(anyGame.isRoundOver).toBe(false);

      // Advance 20 more frames (total 40 frames > 35 threshold, ~0.6s)
      for (let i = 0; i < 20; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.settlingFrames).toBeGreaterThanOrEqual(35);
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });

    it('synchronizes metronome phase on 60 BPM with 100cm and reaches streak 3 through simulation', () => {
      const game = createGame();
      game.mount(container, context); // 6-8 elementary metronome Level 1
      game.start();

      const anyGame = game as any;
      // Default level starts with wrong length (45cm)
      expect(anyGame.pendulumsState[0].config.length).toBe(45);

      let now = performance.now();
      // Simulate with wrong length for 150 frames (~2.4s): streak should not reach 3
      for (let i = 0; i < 150; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.beatMatchStreak).toBeLessThan(3);
      expect(anyGame.isRoundOver).toBe(false);

      // Now click 100cm length button to select correct harmonic length
      const len100Btn = container.querySelector('.btn-length[data-length="100"]') as HTMLElement;
      expect(len100Btn).not.toBeNull();
      len100Btn.click();

      expect(anyGame.pendulumsState[0].config.length).toBe(100);
      expect(anyGame.beatMatchStreak).toBe(0);

      // Simulate swing and metronome over 200 frames (~3.2s)
      // Beat 1 at ~0.5s: streak 1
      // Beat 2 at ~1.5s: streak 2
      // Beat 3 at ~2.5s: streak 3
      for (let i = 0; i < 200; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      expect(anyGame.beatMatchStreak).toBeGreaterThanOrEqual(3);

      // Advance settling frames (~0.6s = 40 frames)
      for (let i = 0; i < 40; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });

    it('verifies 2:1 polyrhythm does NOT win on wrong distractor length (50cm) and DOES win on target length (100cm)', () => {
      const upperContext: GameContext = {
        ...context,
        ageGroup: '9-11'
      };
      const game = createGame();
      game.mount(container, upperContext);
      game.start();

      const anyGame = game as any;
      // Level 1 starts with wrong distractor piece: LB = 50cm
      expect(anyGame.pendulumsState[1].config.length).toBe(50);
      expect(anyGame.polyrhythmCoincidences).toBe(0);

      // Simulate swinging for ~5 seconds (300 frames of 16ms) with wrong distractor piece
      let now = performance.now();
      for (let i = 0; i < 300; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      // No coincidences should be awarded for wrong distractor length
      expect(anyGame.polyrhythmCoincidences).toBe(0);
      expect(anyGame.isRoundOver).toBe(false);

      // Now switch to target harmonic length: LB = 100cm
      const len100Btn = container.querySelector('.btn-length-b[data-length-b="100"]') as HTMLElement;
      expect(len100Btn).not.toBeNull();
      len100Btn.click();

      expect(anyGame.pendulumsState[1].config.length).toBe(100);
      expect(anyGame.polyrhythmCoincidences).toBe(0);

      // Simulate swinging for ~5 seconds (300 frames) with correct harmonic length
      for (let i = 0; i < 300; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      // Target coincidences reached
      expect(anyGame.polyrhythmCoincidences).toBeGreaterThanOrEqual(2);

      // Advance settling frames (~0.6s = 40 frames)
      for (let i = 0; i < 40; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });

    it('triggers 2:1 harmonic polyrhythm coincidence and completes round within settling window', () => {
      const upperContext: GameContext = {
        ...context,
        ageGroup: '9-11'
      };
      const game = createGame();
      game.mount(container, upperContext);
      game.start();

      const anyGame = game as any;
      // Level 1: 2:1 polyrhythm. Set Pendulum B length to 100cm (correct harmonic length)
      const len100Btn = container.querySelector('.btn-length-b[data-length-b="100"]') as HTMLElement;
      expect(len100Btn).not.toBeNull();
      len100Btn.click();

      expect(anyGame.pendulumsState[1].config.length).toBe(100);
      expect(anyGame.polyrhythmCoincidences).toBe(0);

      // Simulate swinging for ~5 seconds (at 60Hz = 300 frames of 16.6ms)
      // T_A ≈ 1.003s, T_B ≈ 2.007s.
      // Coincidence 1 at t ≈ 2.0s
      // Coincidence 2 at t ≈ 4.0s
      let now = performance.now();
      for (let i = 0; i < 300; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }

      // Both coincidences must have registered
      expect(anyGame.polyrhythmCoincidences).toBeGreaterThanOrEqual(2);

      // Advance settling frames (~0.6s = 40 frames)
      for (let i = 0; i < 40; i++) {
        now += 16;
        anyGame.updatePhysics(0.016, now);
      }
      expect(anyGame.isRoundOver).toBe(true);

      game.destroy();
    });
  });

  // =========================================================================
  // 6. TELEMETRY SPIES & BILINGUAL TRANSLATION FORMATTERS
  // =========================================================================
  describe('Telemetry Spies & Bilingual Translations', () => {
    it('provides complete and accurate English and French translations in i18n.ts', () => {
      const tEn = getTranslations('en');
      const tFr = getTranslations('fr');

      expect(tEn.title).toContain('Pendulum Rhythm Lab');
      expect(tFr.title).toContain('Laboratoire du Pendule');

      // Formatters in EN
      expect(tEn.formatPreschoolPrompt(20, 2)).toContain('20°');
      expect(tEn.formatElementaryPrompt(60, 100, 50, 0, 3)).toContain('60 BPM');
      expect(tEn.formatUpperPrompt('2:1', 25, 100, '2.00:1', 0, 2)).toContain('2:1 polyrhythm');

      // Formatters in FR
      expect(tFr.formatPreschoolPrompt(40, 1)).toContain('40°');
      expect(tFr.formatElementaryPrompt(90, 45, 100, 1, 3)).toContain('90 BPM');
      expect(tFr.formatUpperPrompt('3:1', 10, 90, '3.00:1', 1, 2)).toContain('polyrythme 3:1');
    });

    it('emits game:score, game:progress, and game:complete on completion', () => {
      vi.useFakeTimers();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const emittedEvents: { type: string; payload?: any }[] = [];

      const context: GameContext = {
        ageGroup: '3-5',
        difficulty: 'easy',
        sound: false,
        locale: 'en',
        audio: new SoundEngine(),
        i18n: new I18nManager('en'),
        t: (k) => k,
        emit: (type, payload) => {
          emittedEvents.push({ type, payload });
        }
      };

      const game = createGame();
      game.mount(container, context);
      game.start();

      // Trigger smash preset button
      const smashBtn = container.querySelector('.btn-preset[data-angle="60"]') as HTMLElement;
      smashBtn?.click();

      // Advance physics frames
      for (let f = 0; f < 60; f++) {
        vi.advanceTimersByTime(16);
      }

      game.destroy();
      container.remove();
    });
  });
});
