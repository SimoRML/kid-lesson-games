import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext, AgeGroup } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import { getTranslations } from './i18n.js';
import {
  PulleyLiftGame,
  createGame,
  createPulleyLiftGame,
  getMechanicalAdvantage,
  calculateRequiredEffortKg,
  calculateEffortDistance,
  calculateWorkJoules,
  createWeightItem,
  parseWeightItem,
  generateLevelsForAge,
  parseCustomLevels,
  simulatePulleyLevel,
  verifyAntiMirroring,
  computeSceneLayout,
  getSceneState,
  buildRig,
  boxesOverlap,
  clampLiftProgress,
  WEIGHT_PALETTE,
  type PulleySystemType
} from './index.js';

describe('Pulley Lift Game & Mechanical Advantage Engine', () => {
  // =========================================================================
  // 1. PURE MATHEMATICS, WORK CONSERVATION & KINEMATICS
  // =========================================================================
  describe('Pure Mechanical Advantage & Kinematic Helpers', () => {
    it('returns exact mechanical advantage (MA) for all system types', () => {
      expect(getMechanicalAdvantage('fixed-1')).toBe(1);
      expect(getMechanicalAdvantage('movable-2')).toBe(2);
      expect(getMechanicalAdvantage('compound-3')).toBe(3);
      expect(getMechanicalAdvantage('compound-4')).toBe(4);
      expect(getMechanicalAdvantage(1)).toBe(1);
      expect(getMechanicalAdvantage(2)).toBe(2);
      expect(getMechanicalAdvantage(3)).toBe(3);
      expect(getMechanicalAdvantage(4)).toBe(4);
    });

    it('calculates required effort mass (F = mg / MA) accurately', () => {
      // MA = 1 (Fixed)
      expect(calculateRequiredEffortKg(50, 'fixed-1')).toBe(50);
      expect(calculateRequiredEffortKg(80, 'fixed-1')).toBe(80);

      // MA = 2 (Movable 1/2 force)
      expect(calculateRequiredEffortKg(100, 'movable-2')).toBe(50);
      expect(calculateRequiredEffortKg(200, 'movable-2')).toBe(100);
      expect(calculateRequiredEffortKg(240, 'movable-2')).toBe(120);

      // MA = 3 (Compound 3:1)
      expect(calculateRequiredEffortKg(240, 'compound-3')).toBe(80);
      expect(calculateRequiredEffortKg(300, 'compound-3')).toBe(100);

      // MA = 4 (Compound 4:1)
      expect(calculateRequiredEffortKg(320, 'compound-4')).toBe(80);
      expect(calculateRequiredEffortKg(400, 'compound-4')).toBe(100);
      expect(calculateRequiredEffortKg(480, 'compound-4')).toBe(120);
    });

    it('calculates rope pull distance (d_effort = MA * d_load) accurately', () => {
      expect(calculateEffortDistance(2.0, 'fixed-1')).toBe(2.0);
      expect(calculateEffortDistance(2.0, 'movable-2')).toBe(4.0);
      expect(calculateEffortDistance(2.0, 'compound-3')).toBe(6.0);
      expect(calculateEffortDistance(2.5, 'compound-4')).toBe(10.0);
    });

    it('verifies conservation of work: W = F * d = m * g * h is invariant across MA configurations', () => {
      const loadKg = 240;
      const targetHeightM = 2.0;
      const g = 9.8;

      // Potential energy gained by load
      const expectedWorkJoules = Math.round(loadKg * g * targetHeightM * 10) / 10;
      expect(calculateWorkJoules(loadKg, targetHeightM, g)).toBe(expectedWorkJoules);

      // Test across MA = 1, 2, 3, 4:
      const systems: PulleySystemType[] = ['fixed-1', 'movable-2', 'compound-3', 'compound-4'];
      for (const sys of systems) {
        const ma = getMechanicalAdvantage(sys);
        const effortKg = loadKg / ma;
        const effortDistM = targetHeightM * ma;

        const workEffort = Math.round(effortKg * g * effortDistM * 10) / 10;
        expect(workEffort).toBeCloseTo(expectedWorkJoules, 1);
      }
    });

    it('creates and parses weight items from numbers, strings, and objects', () => {
      const w50 = createWeightItem(50);
      expect(w50.kg).toBe(50);
      expect(w50.label).toBe('50 kg');
      expect(w50.color).toBe(WEIGHT_PALETTE[50].color);

      // parseWeightItem variations
      expect(parseWeightItem(20)?.kg).toBe(20);
      expect(parseWeightItem('40kg')?.kg).toBe(40);
      expect(parseWeightItem(' 60 kg ')?.kg).toBe(60);
      expect(parseWeightItem({ kg: 80, label: 'Custom 80' })?.kg).toBe(80);
      expect(parseWeightItem({ massKg: 100 })?.kg).toBe(100);
      expect(parseWeightItem({ weight: 120 })?.kg).toBe(120);

      // Invalid weights
      expect(parseWeightItem(null)).toBeNull();
      expect(parseWeightItem(undefined)).toBeNull();
      expect(parseWeightItem(-10)).toBeNull();
      expect(parseWeightItem(0)).toBeNull();
      expect(parseWeightItem('not-a-number')).toBeNull();
      expect(parseWeightItem({})).toBeNull();
    });
  });

  // =========================================================================
  // 2. AGE BRACKET CURRICULUM & ANTI-MIRRORING PROGRESSION
  // =========================================================================
  describe('Age Bracket Curriculum Generation (generateLevelsForAge)', () => {
    it('generates 3 preschool levels for age "3-5" with fixed 1:1 pulleys', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(lvl.systemType).toBe('fixed-1');
        expect(lvl.mechanicalAdvantage).toBe(1);
        expect(lvl.loadKg).toBeGreaterThan(0);
        expect(lvl.targetHeightM).toBeGreaterThanOrEqual(1.5);
        expect(lvl.availableWeights.length).toBeGreaterThanOrEqual(2);

        // Required effort matches load mass directly (1:1 correspondence)
        const reqEffort = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);
        expect(reqEffort).toBe(lvl.loadKg);
      }
    });

    it('generates 3 elementary levels for age "6-8" strictly enforcing ANTI-MIRRORING', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(lvl.systemType).toBe('movable-2');
        expect(lvl.mechanicalAdvantage).toBe(2);
        expect(lvl.loadKg).toBeGreaterThanOrEqual(100);
        expect(lvl.availableWeights.length).toBeGreaterThanOrEqual(3);

        const targetEffort = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);

        // ANTI-MIRRORING ASSERTION:
        // No single weight in inventory may equal the target effort!
        const singleMatch = lvl.availableWeights.some((w) => w.kg === targetEffort);
        expect(
          singleMatch,
          `Level "${lvl.id}" violates anti-mirroring: found single ${targetEffort}kg piece in inventory`
        ).toBe(false);

        // Raw load mass must also not be present as a single piece
        const rawMatch = lvl.availableWeights.some((w) => w.kg === lvl.loadKg);
        expect(rawMatch, `Level "${lvl.id}" must not contain raw load mass in inventory`).toBe(false);

        // verifyAntiMirroring helper must return true
        expect(verifyAntiMirroring(lvl)).toBe(true);

        // At least 2 weights must be combined to reach targetEffort
        const hasSolvableSubset = lvl.availableWeights.some((w1, idx1) =>
          lvl.availableWeights.some((w2, idx2) => idx1 !== idx2 && w1.kg + w2.kg === targetEffort)
        );
        expect(hasSolvableSubset, `Level "${lvl.id}" must have a valid 2-piece combination`).toBe(true);
      }
    });

    it('generates 3 upper elementary levels for age "9-11" with compound block-and-tackle (MA=3, 4)', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(['compound-3', 'compound-4']).toContain(lvl.systemType);
        expect([3, 4]).toContain(lvl.mechanicalAdvantage);
        expect(lvl.loadKg).toBeGreaterThanOrEqual(200);

        const targetEffort = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);

        // ANTI-MIRRORING ASSERTION FOR UPPER:
        const singleMatch = lvl.availableWeights.some((w) => w.kg === targetEffort);
        expect(
          singleMatch,
          `Upper level "${lvl.id}" violates anti-mirroring: found single ${targetEffort}kg piece in inventory`
        ).toBe(false);

        expect(verifyAntiMirroring(lvl)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. ANTI-CHEAT & ANTI-FACADE INVARIANTS
  // =========================================================================
  describe('Anti-Cheat & Anti-Facade Invariants', () => {
    it('strictly prevents auto-win on empty effort tray across ALL 9 default levels', () => {
      const ageGroups: AgeGroup[] = ['3-5', '6-8', '9-11'];
      for (const age of ageGroups) {
        const levels = generateLevelsForAge(age);
        for (const lvl of levels) {
          const res = simulatePulleyLevel(lvl, []);
          expect(res.won, `Level "${lvl.id}" must NOT be won with empty effort tray`).toBe(false);
          expect(res.loadHeightM, `Level "${lvl.id}" stone load must stay on the ground`).toBe(0);
          expect(res.effortDisplacementM, `Level "${lvl.id}" effort displacement must be 0`).toBe(0);
          expect(res.settlingTime, `Level "${lvl.id}" settling time must remain 0`).toBe(0);
        }
      }
    });

    it('strictly fails when counterweight is insufficient (underweight)', () => {
      // 1. Preschool Level 1 (Load 20 kg, MA=1, needed 20 kg): effort 10 kg fails
      const p1 = generateLevelsForAge('3-5')[0];
      const resP1 = simulatePulleyLevel(p1, [10]);
      expect(resP1.won).toBe(false);
      expect(resP1.loadHeightM).toBe(0);

      // 2. Elementary Level 1 (Load 100 kg, MA=2, needed 50 kg): effort 20 kg fails
      const e1 = generateLevelsForAge('6-8')[0];
      const resE1 = simulatePulleyLevel(e1, [20]);
      expect(resE1.won).toBe(false);
      expect(resE1.loadHeightM).toBe(0);

      // 3. Elementary Level 2 (Load 200 kg, MA=2, needed 100 kg): effort 50 kg fails
      const e2 = generateLevelsForAge('6-8')[1];
      const resE2 = simulatePulleyLevel(e2, [50]);
      expect(resE2.won).toBe(false);
      expect(resE2.loadHeightM).toBe(0);

      // 4. Upper Level 1 (Load 240 kg, MA=3, needed 80 kg): effort 50 kg fails
      const u1 = generateLevelsForAge('9-11')[0];
      const resU1 = simulatePulleyLevel(u1, [50]);
      expect(resU1.won).toBe(false);
      expect(resU1.loadHeightM).toBe(0);
    });

    it('strictly rejects distractor weight combinations across default levels', () => {
      // Preschool-1 distractor: 50 kg for 20 kg target (overshoots)
      const p1 = generateLevelsForAge('3-5')[0];
      const distractorP1 = p1.availableWeights.find((w) => w.kg !== 20)!;
      const resP1 = simulatePulleyLevel(p1, [distractorP1]);
      expect(resP1.won, 'Preschool-1 distractor piece must fail').toBe(false);
      expect(resP1.overshot, 'Excess counterweight must flag overshot').toBe(true);

      // Elementary-1 distractor: 70 kg for 50 kg target (overshoots)
      const e1 = generateLevelsForAge('6-8')[0];
      const distractorE1 = e1.availableWeights.find((w) => w.kg === 70 || w.kg === 40)!;
      const resE1 = simulatePulleyLevel(e1, [distractorE1]);
      expect(resE1.won, 'Elementary-1 distractor piece must fail').toBe(false);

      // Upper-1 distractor: 70 kg for 80 kg target (underweight)
      const u1 = generateLevelsForAge('9-11')[0];
      const distractorU1 = u1.availableWeights.find((w) => w.kg === 70)!;
      const resU1 = simulatePulleyLevel(u1, [distractorU1]);
      expect(resU1.won, 'Upper-1 distractor piece must fail').toBe(false);
    });

    it('requires continuous settling delay (>= 0.5s) at target height before triggering win', () => {
      const lvl = generateLevelsForAge('6-8')[0]; // needed 50 kg
      const targetEffort = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);
      expect(targetEffort).toBe(50);

      // Simulate short time below 0.5s settling
      const shortRun = simulatePulleyLevel(lvl, [30, 20], 0.2); // only 0.2s duration
      expect(shortRun.won, 'Cannot win before 0.5s settling time elapses').toBe(false);
      expect(shortRun.settlingTime).toBeLessThan(0.5);

      // Simulate full time >= 0.5s
      const fullRun = simulatePulleyLevel(lvl, [30, 20], 3.0);
      expect(fullRun.won, 'Must win after settling at target height for >= 0.5s').toBe(true);
      expect(fullRun.settlingTime).toBeGreaterThanOrEqual(0.5);
    });
  });

  // =========================================================================
  // 4. GUARANTEED SOLVABILITY OF ALL 9 DEFAULT LEVELS
  // =========================================================================
  describe('Guaranteed Solvability of Default Levels', () => {
    it('solves all preschool levels (3-5) with intended counterweights', () => {
      const levels = generateLevelsForAge('3-5');

      for (const lvl of levels) {
        const target = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);
        const intendedPiece = lvl.availableWeights.find((w) => w.kg === target);
        expect(intendedPiece, `Preschool level ${lvl.id} must offer matching piece`).toBeDefined();

        const res = simulatePulleyLevel(lvl, [intendedPiece!]);
        expect(res.won).toBe(true);
        expect(res.loadHeightM).toBeCloseTo(lvl.targetHeightM, 1);
        expect(res.settlingTime).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('solves all elementary levels (6-8) with intended multi-piece combinations', () => {
      const levels = generateLevelsForAge('6-8');

      for (const lvl of levels) {
        const target = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);

        // Find valid 2-piece combination
        let solved = false;
        for (let i = 0; i < lvl.availableWeights.length; i++) {
          for (let j = i + 1; j < lvl.availableWeights.length; j++) {
            const w1 = lvl.availableWeights[i];
            const w2 = lvl.availableWeights[j];
            if (w1.kg + w2.kg === target) {
              const res = simulatePulleyLevel(lvl, [w1, w2]);
              expect(res.won).toBe(true);
              expect(res.loadHeightM).toBeCloseTo(lvl.targetHeightM, 1);
              expect(res.effortDisplacementM).toBeCloseTo(lvl.targetHeightM * 2, 1);
              solved = true;
              break;
            }
          }
          if (solved) break;
        }
        expect(solved, `Elementary level ${lvl.id} must be solved with 2 weights`).toBe(true);
      }
    });

    it('solves all upper elementary levels (9-11) asserting work conservation and rope extension', () => {
      const levels = generateLevelsForAge('9-11');

      for (const lvl of levels) {
        const target = calculateRequiredEffortKg(lvl.loadKg, lvl.systemType);
        const ma = lvl.mechanicalAdvantage;

        // Find matching combination (2 or 3 weights)
        let solved = false;
        const weights = lvl.availableWeights;

        // Try pairs
        for (let i = 0; i < weights.length; i++) {
          for (let j = i + 1; j < weights.length; j++) {
            if (weights[i].kg + weights[j].kg === target) {
              const res = simulatePulleyLevel(lvl, [weights[i], weights[j]]);
              expect(res.won).toBe(true);
              expect(res.effortDisplacementM).toBeCloseTo(lvl.targetHeightM * ma, 1);
              expect(res.workJoules).toBeGreaterThan(0);
              solved = true;
              break;
            }
          }
          if (solved) break;
        }

        // Try triplets if needed
        if (!solved) {
          for (let i = 0; i < weights.length; i++) {
            for (let j = i + 1; j < weights.length; j++) {
              for (let k = j + 1; k < weights.length; k++) {
                if (weights[i].kg + weights[j].kg + weights[k].kg === target) {
                  const res = simulatePulleyLevel(lvl, [weights[i], weights[j], weights[k]]);
                  expect(res.won).toBe(true);
                  expect(res.effortDisplacementM).toBeCloseTo(lvl.targetHeightM * ma, 1);
                  solved = true;
                  break;
                }
              }
              if (solved) break;
            }
            if (solved) break;
          }
        }

        expect(solved, `Upper elementary level ${lvl.id} must have a valid solution`).toBe(true);
      }
    });
  });

  // =========================================================================
  // 5. DEFENSIVE CUSTOM LEVEL PARSER (parseCustomLevels)
  // =========================================================================
  describe('Defensive Custom Level Parser (parseCustomLevels)', () => {
    it('returns null on null, undefined, empty array, or invalid JSON', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels('not a json string')).toBeNull();
      expect(parseCustomLevels({})).toBeNull();
      expect(parseCustomLevels(12345)).toBeNull();
    });

    it('gracefully filters null and corrupted items in custom level definitions', () => {
      const corrupted = [
        null,
        undefined,
        {},
        { loadKg: -100 },
        { loadKg: 200, availableWeights: [] },
        { loadKg: 200, availableWeights: [null, undefined, 'bad-weight'] },
        {
          id: 'valid-1',
          title: 'Resilient Custom Level',
          systemType: 'movable-2',
          loadKg: 200,
          targetHeightM: 2.5,
          availableWeights: [null, 50, '50kg', { kg: 20 }]
        }
      ];

      expect(() => parseCustomLevels(corrupted)).not.toThrow();
      const parsed = parseCustomLevels(corrupted);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);

      const lvl = parsed![0];
      expect(lvl.id).toBe('valid-1');
      expect(lvl.systemType).toBe('movable-2');
      expect(lvl.mechanicalAdvantage).toBe(2);
      expect(lvl.loadKg).toBe(200);
      expect(lvl.targetHeightM).toBe(2.5);
      expect(lvl.availableWeights).toHaveLength(3); // 50, 50, 20
    });

    it('parses valid custom levels from array and JSON string with aliases', () => {
      const raw = [
        {
          id: 'custom-crane-1',
          title: 'Granite Lift',
          systemType: 'compound-3',
          load: 300,
          height: 3.0,
          inventory: [50, 50, 25],
          instruction: 'Lift the heavy granite block!'
        }
      ];

      const parsed = parseCustomLevels(raw);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      const lvl = parsed![0];
      expect(lvl.id).toBe('custom-crane-1');
      expect(lvl.systemType).toBe('compound-3');
      expect(lvl.mechanicalAdvantage).toBe(3);
      expect(lvl.loadKg).toBe(300);
      expect(lvl.targetHeightM).toBe(3.0);
      expect(lvl.availableWeights).toHaveLength(3);
      expect(lvl.instruction).toBe('Lift the heavy granite block!');

      // From JSON string
      const jsonStr = JSON.stringify(raw);
      const parsedFromJson = parseCustomLevels(jsonStr);
      expect(parsedFromJson).not.toBeNull();
      expect(parsedFromJson).toHaveLength(1);
    });

    it('returns null if all levels in array fail validation', () => {
      const allInvalid = [
        { title: 'No load', availableWeights: [50] },
        { loadKg: 100, availableWeights: [] }
      ];
      expect(parseCustomLevels(allInvalid)).toBeNull();
    });
  });

  // =========================================================================
  // 6. KIDGAME DOM LIFECYCLE & ZERO-LEAK TEARDOWN
  // =========================================================================
  describe('PulleyLiftGame DOM Lifecycle & Zero-Leak Teardown', () => {
    let container: HTMLElement;
    let context: GameContext;
    let audio: SoundEngine;
    let i18n: I18nManager;
    let emittedEvents: { type: string; payload?: any }[];
    let activeRafs: Set<number>;
    let nextRafId: number;
    let dummyCtx: Record<string, any>;

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
      dummyCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
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
        setLineDash: vi.fn()
      };

      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(dummyCtx);
      HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 800,
        height: 500,
        top: 0,
        left: 0,
        right: 800,
        bottom: 500
      });
    });

    it('mounts, starts, pauses, resumes, updates config, and destroys cleanly', () => {
      const game = createGame();
      expect(game).toBeDefined();

      game.mount(container, context);

      // Verify DOM HUD elements exist
      expect(container.querySelector('#hud-title')?.textContent).toContain('Pulley Lift');
      expect(container.querySelector('#level-badge')?.textContent).toContain('Level 1/3');
      expect(container.querySelector('#hud-instruction')).toBeDefined();
      expect(container.querySelector('#btn-sound-toggle')).toBeDefined();
      expect(container.querySelector('#btn-reset')).toBeDefined();

      // Verify telemetry bridge emitted game:progress
      const progressEvt = emittedEvents.find((e) => e.type === 'game:progress');
      expect(progressEvt).toBeDefined();

      game.start();
      game.pause?.();
      game.resume?.();

      // Dynamic locale update to French
      game.updateConfig?.({ locale: 'fr', sound: true });
      expect(container.querySelector('#hud-title')?.textContent).toContain('Poulies & Palans');
      expect(container.querySelector('#btn-sound-toggle')?.textContent).toContain('Son ACTIVÉ');

      // Dynamic ageGroup update
      game.updateConfig?.({ ageGroup: '9-11' });
      expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');

      // Zero-leak teardown
      game.destroy();
      expect(container.innerHTML).toBe('');
      document.body.removeChild(container);
    });

    it('maintains zero orphan animation frame loops across pause, resume, multiple starts, and destroy', () => {
      const game = createGame();
      game.mount(container, context);
      expect(activeRafs.size).toBe(0);

      game.start();
      expect(activeRafs.size).toBe(1);

      // Calling start() again cancels previous frame, preventing duplicate loops
      game.start();
      expect(activeRafs.size).toBe(1);

      // Pausing cancels active frame
      game.pause?.();
      expect(activeRafs.size).toBe(0);

      // Resuming restarts 1 active loop
      game.resume?.();
      expect(activeRafs.size).toBe(1);

      // Destroy cancels all active frames
      game.destroy();
      expect(activeRafs.size).toBe(0);
      document.body.removeChild(container);
    });

    const weightButtons = (tray: Element) =>
      Array.from(tray.children).map((el) => (el.classList.contains('weight-item') ? el.textContent : ''));

    it('supports granular undo and keeps every weight in its original tray slot', () => {
      const game = createPulleyLiftGame() as PulleyLiftGame;
      game.mount(container, context);

      const invTray = container.querySelector('#inventory-tray') as HTMLElement;
      const effortTray = container.querySelector('#effort-tray') as HTMLElement;
      expect(invTray).toBeDefined();
      expect(effortTray).toBeDefined();

      const initialLayout = weightButtons(invTray);
      const slotCount = invTray.children.length;
      expect(slotCount).toBeGreaterThan(0);
      expect(effortTray.children.length).toBe(0);

      // Place the SECOND weight: the tray must not reflow (placeholder keeps its slot)
      (invTray.children[1] as HTMLElement).click();
      expect(invTray.children.length).toBe(slotCount);
      expect(effortTray.children.length).toBe(1);
      const afterPlace = weightButtons(invTray);
      expect(afterPlace[1]).toBe('');
      expect(afterPlace[0]).toBe(initialLayout[0]);
      expect(afterPlace[2]).toBe(initialLayout[2]);

      // Granular undo: the exact piece returns to its original slot (index 1), not the end
      (effortTray.firstElementChild as HTMLElement).click();
      expect(effortTray.children.length).toBe(0);
      expect(invTray.children.length).toBe(slotCount);
      expect(weightButtons(invTray)).toEqual(initialLayout);

      // Same for the Clear Tray button after placing several pieces out of order
      (invTray.children[2] as HTMLElement).click();
      (invTray.children[0] as HTMLElement).click();
      (container.querySelector('#btn-reset') as HTMLButtonElement).click();
      expect(weightButtons(invTray)).toEqual(initialLayout);

      game.destroy();
      document.body.removeChild(container);
    });

    it('renders the trays in fixed-height grids so the scene never resizes', () => {
      const game = createPulleyLiftGame() as PulleyLiftGame;
      game.mount(container, context);
      const css = container.querySelector('style')?.textContent ?? '';
      expect(css).toMatch(/\.pl-tray\s*\{[^}]*height:\s*\d+px/);
      expect(css).toMatch(/\.pl-tray\s*\{[^}]*grid-template-rows:\s*repeat\(2,\s*44px\)/);
      expect(css).toMatch(/\.pl-stage\s*\{[^}]*min-height:\s*260px/);
      expect(container.querySelector('#inventory-tray')?.classList.contains('pl-tray')).toBe(true);
      expect(container.querySelector('#effort-tray')?.classList.contains('pl-tray')).toBe(true);
      game.destroy();
      document.body.removeChild(container);
    });

    it('handles sound toggle button and reset button clicks', () => {
      const game = createPulleyLiftGame() as PulleyLiftGame;
      game.mount(container, context);

      const soundBtn = container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
      expect(soundBtn.textContent).toContain('Sound OFF');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound ON');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound OFF');

      // Click reset button
      const resetBtn = container.querySelector('#btn-reset') as HTMLButtonElement;
      resetBtn.click();

      game.destroy();
      document.body.removeChild(container);
    });
  });

  // =========================================================================
  // 7. BILINGUAL TRANSLATION FORMATTERS
  // =========================================================================
  describe('Bilingual Translation Formatters', () => {
    it('formats English and French prompts correctly across age brackets', () => {
      const en = getTranslations('en');
      const fr = getTranslations('fr');

      // Preschool
      expect(en.formatPreschoolPrompt(20, 0, 'empty')).toContain('20 kg');
      expect(fr.formatPreschoolPrompt(20, 0, 'empty')).toContain('20 kg');

      // Elementary
      expect(en.formatElementaryPrompt(200, 0, 2, 'empty')).toContain('MA = 2');
      expect(en.formatElementaryPrompt(200, 0, 2, 'empty')).toContain('half the load');
      expect(fr.formatElementaryPrompt(200, 0, 2, 'empty')).toContain('AM = 2');
      expect(fr.formatElementaryPrompt(200, 0, 2, 'empty')).toContain('moitié');

      // Upper Elementary: work is only revealed on success
      expect(en.formatUpperElementaryPrompt(300, 2940, 100, 980, 3, 'match', 6.0, 5880)).toContain(
        '5880 J'
      );
      expect(fr.formatUpperElementaryPrompt(300, 2940, 100, 980, 3, 'match', 6.0, 5880)).toContain(
        '5880 J'
      );
      expect(en.formatUpperElementaryPrompt(300, 2940, 0, 0, 3, 'empty', 6.0, 5880)).not.toContain(
        ' J'
      );
    });

    it('never reveals the target effort or the exact remainder for ages 6-11 (EN + FR)', () => {
      const states = ['empty', 'low', 'close', 'over'] as const;
      for (const locale of ['en', 'fr'] as const) {
        const t = getTranslations(locale);
        for (const age of ['6-8', '9-11'] as AgeGroup[]) {
          for (const lvl of generateLevelsForAge(age)) {
            const target = lvl.targetEffortKg;
            const samples: Record<string, number> = {
              empty: 0,
              low: 10,
              close: Math.round(target * 0.8),
              over: target + 10
            };
            for (const state of states) {
              const cur = samples[state];
              const text =
                age === '6-8'
                  ? t.formatElementaryPrompt(lvl.loadKg, cur, lvl.mechanicalAdvantage, state)
                  : t.formatUpperElementaryPrompt(
                      lvl.loadKg,
                      Math.round(lvl.loadKg * 9.8),
                      cur,
                      Math.round(cur * 9.8),
                      lvl.mechanicalAdvantage,
                      state,
                      lvl.ropeDistanceM,
                      lvl.targetWorkJoules
                    );
              const forbidden = [target, Math.abs(target - cur), Math.round(target * 9.8)];
              for (const n of forbidden) {
                if (n === cur || n === lvl.loadKg || n === 0) continue;
                expect(text, `${locale} ${lvl.id} ${state}: "${text}" leaks ${n}`).not.toMatch(
                  new RegExp(`(^|[^0-9.,])${n}([^0-9]|$)`)
                );
              }
              if (age === '9-11') {
                expect(text, `${locale} ${lvl.id} ${state}`).not.toMatch(/\d+ J/);
              }
            }
          }
        }
      }
    });

    it('shows no Newtons to preschoolers and uses unambiguous tray wording', () => {
      for (const locale of ['en', 'fr'] as const) {
        const t = getTranslations(locale);
        for (const state of ['empty', 'low', 'close', 'over', 'match'] as const) {
          expect(t.formatPreschoolPrompt(20, 10, state)).not.toMatch(/\bN\b/);
        }
        // 3-5 instruction matches the interaction: there is no rope to pull
        expect(t.formatPreschoolPrompt(20, 0, 'empty').toLowerCase()).not.toMatch(
          /rope|corde|pull|tire/
        );
      }
      expect(getTranslations('en').formatPreschoolPrompt(20, 30, 'over')).toContain('Effort tray');
      expect(getTranslations('fr').formatElementaryPrompt(100, 80, 2, 'over')).toContain(
        "plateau d'effort"
      );
    });
  });

  // =========================================================================
  // 8. SCENE LAYOUT (issues #18, #19, #21)
  // =========================================================================
  describe('Scene layout & clamped lift', () => {
    const mas = [1, 2, 3, 4] as const;
    const sizes: [number, number][] = [
      [480, 360],
      [640, 360],
      [800, 400],
      [480, 420]
    ];

    it('keeps effort platform left of the rig and the stone right, never overlapping', () => {
      for (const ma of mas) {
        for (const [vw, vh] of sizes) {
          const layout = computeSceneLayout(ma, vw, vh);
          for (let p = 0; p <= 1.0001; p += 0.05) {
            const st = getSceneState(layout, p);
            const rig = buildRig(layout, st);
            expect(boxesOverlap(st.stoneBox, st.platformBox), `ma=${ma} p=${p}`).toBe(false);
            // Clear horizontal gap of at least a platform + stone width
            const gap = st.stoneBox.x - (st.platformBox.x + st.platformBox.w);
            expect(gap).toBeGreaterThanOrEqual(140);
            // Platform left of every rig pulley except its own guide; stone on the right half
            const rigPulleys = rig.pulleys.filter((q) => q.id !== 'guide');
            for (const q of rigPulleys) {
              expect(q.centerX - q.radius).toBeGreaterThan(st.platformBox.x + st.platformBox.w);
            }
            expect(layout.stoneX).toBeGreaterThan(vw / 2);
            // Everything stays on the canvas
            expect(st.platformBox.y + st.platformBox.h).toBeLessThanOrEqual(layout.groundY);
            expect(st.stoneBox.y + st.stoneBox.h).toBeLessThanOrEqual(layout.groundY + 0.001);
            expect(st.stoneBox.x + st.stoneBox.w).toBeLessThanOrEqual(vw);
          }
        }
      }
    });

    it('clamps the lifted stone below the arm and pulleys with a visible gap', () => {
      for (const ma of mas) {
        const layout = computeSceneLayout(ma);
        // Spring overshoot (progress > 1) must not lift the stone any higher
        const atTarget = getSceneState(layout, 1);
        const overshoot = getSceneState(layout, 1.35);
        expect(overshoot.liftPx).toBeCloseTo(atTarget.liftPx, 6);
        expect(overshoot.stoneBox.y).toBeCloseTo(atTarget.stoneBox.y, 6);
        expect(getSceneState(layout, -0.5).liftPx).toBe(0);
        expect(clampLiftProgress(Number.NaN)).toBe(0);

        const rig = buildRig(layout, overshoot);
        for (const q of rig.pulleys) {
          // stone top is clearly below every pulley frame and the arm
          expect(overshoot.stoneBox.y).toBeGreaterThanOrEqual(q.centerY + q.radius + 2 + 8);
        }
        expect(overshoot.stoneBox.y).toBeGreaterThan(layout.boomY + 40);
      }
    });

    it('scales rope travel so the platform stays inside the canvas for every MA', () => {
      for (const ma of mas) {
        const layout = computeSceneLayout(ma);
        const end = getSceneState(layout, 1);
        // Effort end travels MA x the load displacement (conservation of rope)
        expect(end.effortY - layout.effortStartY).toBeCloseTo(end.liftPx * ma, 6);
        expect(end.platformBox.y + end.platformBox.h).toBeLessThan(layout.groundY);
      }
    });

    it('draws one supporting rope strand per unit of mechanical advantage', () => {
      for (const ma of mas) {
        const layout = computeSceneLayout(ma);
        const rig = buildRig(layout, getSceneState(layout, 0.5));
        const strands = rig.segments
          .slice(0, -1) // last segment is the free end running to the effort platform
          .filter((s) => s.type === 'line' && s.startX === s.endX);
        expect(strands.length, `ma=${ma}`).toBe(ma);
      }
    });
  });

  // =========================================================================
  // 9. FLOW, PACING, SCORE CONVENTION (issues #19, #20, #22)
  // =========================================================================
  describe('Win flow, pacing, replay and score convention', () => {
    let container: HTMLElement;
    let context: GameContext;
    let emitted: { type: string; payload?: any }[];
    let dummyCtx: Record<string, any>;

    beforeEach(() => {
      vi.useFakeTimers();
      container = document.createElement('div');
      document.body.appendChild(container);
      emitted = [];
      const i18n = new I18nManager('en');
      context = {
        ageGroup: '6-8',
        difficulty: 'medium',
        sound: false,
        locale: 'en',
        audio: new SoundEngine(),
        i18n,
        t: (k, p) => i18n.t(k, p),
        emit: (type, payload) => {
          emitted.push({ type, payload });
        }
      };
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;
      globalThis.requestAnimationFrame = vi.fn().mockReturnValue(1);
      globalThis.cancelAnimationFrame = vi.fn();
      dummyCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn()
      };
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(dummyCtx);
      HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 640,
        height: 400,
        top: 0,
        left: 0,
        right: 640,
        bottom: 400
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const events = (type: string) => emitted.filter((e) => e.type === type);
    const badge = () => container.querySelector('#level-badge')?.textContent ?? '';
    const scoreText = () => container.querySelector('#score-display')?.textContent ?? '';

    /** Taps the weights of the intended solution of the given level. */
    function placeSolution(age: AgeGroup, levelIndex: number): void {
      const lvl = generateLevelsForAge(age)[levelIndex];
      const wanted = [...lvl.solutionCombinations![0]];
      const buttons = Array.from(
        container.querySelectorAll<HTMLElement>('#inventory-tray .weight-item')
      );
      for (const kg of wanted) {
        const idx = buttons.findIndex((b) => Number(b.dataset.kg) === kg);
        expect(idx, `solution weight ${kg} kg present`).toBeGreaterThanOrEqual(0);
        buttons.splice(idx, 1)[0].click();
      }
    }

    /** Drives the render loop at a fixed fps until `done()`; returns simulated seconds. */
    function runUntil(game: PulleyLiftGame, done: () => boolean, fps = 60, maxSeconds = 30): number {
      const g = game as any;
      const dt = 1000 / fps;
      let t = g.lastTime as number;
      let seconds = 0;
      while (!done() && seconds < maxSeconds) {
        t += dt;
        seconds += dt / 1000;
        g.tick(t);
      }
      return seconds;
    }

    it('advances to the next level within ~3 s of balancing, at any frame rate and age', () => {
      for (const age of ['3-5', '6-8', '9-11'] as AgeGroup[]) {
        for (const fps of [60, 30]) {
          emitted = [];
          context.ageGroup = age;
          const game = createGame() as PulleyLiftGame;
          game.mount(container, context);
          game.start();
          placeSolution(age, 0);
          const winSeconds = runUntil(game, () => events('game:score').length > 0, fps);
          expect(events('game:score').length, `${age}@${fps}`).toBe(1);
          // lift + settle window, then the short celebration pause
          expect(winSeconds + 0.8, `${age}@${fps} total ${winSeconds}`).toBeLessThanOrEqual(3);
          expect(winSeconds).toBeGreaterThanOrEqual(0.5);
          vi.advanceTimersByTime(900);
          expect(badge()).toContain('2/3');
          game.destroy();
        }
      }
    });

    it('starts a fresh round after the final level instead of freezing the board', () => {
      const game = createGame() as PulleyLiftGame;
      game.mount(container, context);
      game.start();
      for (let i = 0; i < 3; i++) {
        placeSolution('6-8', i);
        runUntil(game, () => events('game:score').length === i + 1);
        vi.advanceTimersByTime(900);
      }
      expect(events('game:complete').length).toBe(1);
      expect(events('game:complete')[0].payload.score).toBe(100 + 120 + 140);

      vi.advanceTimersByTime(4000);
      expect(badge()).toContain('1/3');
      expect(scoreText()).toContain('0');
      expect(container.querySelectorAll('#inventory-tray .weight-item').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('#effort-tray .weight-item').length).toBe(0);
      // the new round is playable
      placeSolution('6-8', 0);
      runUntil(game, () => events('game:score').length === 4);
      expect(events('game:score')[3].payload.points).toBe(100);
      game.destroy();
    });

    it('resets score, streak and elapsed time when the age group changes (SCORE CONVENTION)', () => {
      const game = createGame() as PulleyLiftGame;
      game.mount(container, context);
      game.start();
      placeSolution('6-8', 0);
      runUntil(game, () => events('game:score').length === 1);
      expect(scoreText()).toContain('100');

      // The level-advance timer is pending; switching age must cancel it
      game.updateConfig({ ageGroup: '3-5' });
      vi.advanceTimersByTime(30000);
      expect(scoreText()).toContain('0');
      expect(scoreText()).not.toContain('100');
      expect((game as any).score).toBe(0);
      expect((game as any).streak).toBe(0);
      expect(badge()).toContain('1/3');
      // Time origin restarted at the change
      expect(Math.abs((game as any).startTime - Date.now())).toBeLessThan(31000);
      const changeAt = Date.now();
      game.updateConfig({ ageGroup: '9-11' });
      expect(Math.abs((game as any).startTime - changeAt)).toBeLessThan(50);
      game.updateConfig({ ageGroup: '3-5' });

      // Streak restarted: next win is worth exactly 100 again
      placeSolution('3-5', 0);
      runUntil(game, () => events('game:score').length === 2);
      expect(events('game:score')[1].payload).toMatchObject({ points: 100, streak: 1 });

      // Same age group again does not reset
      game.updateConfig({ ageGroup: '3-5' });
      expect((game as any).score).toBe(100);
      game.destroy();
    });

    it('keeps the live HUD free of the target effort at ages 6-11 while playing', () => {
      const game = createGame() as PulleyLiftGame;
      game.mount(container, context);
      const hud = () => container.querySelector('#hud-instruction')?.textContent ?? '';
      expect(hud()).toContain('MA = 2');
      expect(hud()).not.toMatch(/\b50 kg\b/);
      const buttons = Array.from(
        container.querySelectorAll<HTMLElement>('#inventory-tray .weight-item')
      );
      buttons.find((b) => b.dataset.kg === '30')!.click(); // 30 placed, 50 needed
      expect(hud()).not.toMatch(/\b(50|20)\b/);
      game.destroy();
    });

    it('translates canvas text and redraws on locale change; no newtons for 3-5', () => {
      context.ageGroup = '3-5';
      const game = createGame() as PulleyLiftGame;
      game.mount(container, context);
      const drawn = () => dummyCtx.fillText.mock.calls.map((c: any[]) => String(c[0]));
      expect(drawn().some((s: string) => s.includes('Target'))).toBe(true);
      expect(drawn().some((s: string) => /\d+ N$/.test(s))).toBe(false);

      dummyCtx.fillText.mockClear();
      game.updateConfig({ locale: 'fr' });
      expect(drawn().some((s: string) => s.includes('Cible'))).toBe(true);
      expect(drawn().some((s: string) => s.includes('Target'))).toBe(false);
      game.destroy();

      // 6-8 keeps the load in newtons on the stone
      dummyCtx.fillText.mockClear();
      context.ageGroup = '6-8';
      context.locale = 'en';
      const g2 = createGame() as PulleyLiftGame;
      g2.mount(container, context);
      expect(drawn().some((s: string) => /\d+ N$/.test(s))).toBe(true);
      g2.destroy();
    });
  });
});
