import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext, AgeGroup } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import { getTranslations } from './i18n.js';
import {
  BuoyancyTankGame,
  createGame,
  createBuoyancyTankGame,
  calculateDensity,
  calculateBuoyancyState,
  calculateDisplacement,
  calculateSubmarineDensity,
  calculateWaterSurfaceLevel,
  createBuoyancyItem,
  createSubmarineModule,
  generateLevelsForAge,
  parseCustomLevels,
  simulateBuoyancyLevel,
  verifyAntiMirroring,
  type BuoyancyItem,
  type SubmarineModule
} from './index.js';

describe('Buoyancy Tank Game & Archimedes Hydrostatic Engine', () => {
  // =========================================================================
  // 1. PURE HYDROSTATIC MATH & DISPLACEMENT HELPERS
  // =========================================================================
  describe('Pure Hydrostatic Math & Displacement Helpers', () => {
    it('calculates density rho = m / V accurately with safety guards', () => {
      expect(calculateDensity(100, 100)).toBe(1.0);
      expect(calculateDensity(60, 100)).toBe(0.6);
      expect(calculateDensity(250, 100)).toBe(2.5);
      expect(calculateDensity(0, 100)).toBe(0);
      expect(calculateDensity(-50, 100)).toBe(0);
      expect(calculateDensity(100, 0)).toBe(0);
      expect(calculateDensity(100, -10)).toBe(0);
    });

    it('classifies floating objects with correct submerged fraction and force balance', () => {
      // Wood block: mass 60g, volume 100cm3, fluid = freshwater (1.0 g/cm3)
      const res = calculateBuoyancyState(1.0, 60, 100);
      expect(res.classification).toBe('floats');
      expect(res.submergedFraction).toBeCloseTo(0.6, 2);
      expect(res.displacedVolumeCm3).toBeCloseTo(60, 2);
      expect(res.displacedMassG).toBeCloseTo(60, 2);
      expect(res.gravityForceN).toBeCloseTo((60 / 1000) * 9.8, 3);
      expect(res.buoyantForceN).toBeCloseTo(res.gravityForceN, 3);
      expect(res.netForceN).toBeCloseTo(0, 3);
    });

    it('classifies sinking objects with full displacement and net downward force', () => {
      // Stone: mass 250g, volume 100cm3, fluid = freshwater (1.0 g/cm3)
      const res = calculateBuoyancyState(1.0, 250, 100);
      expect(res.classification).toBe('sinks');
      expect(res.submergedFraction).toBe(1.0);
      expect(res.displacedVolumeCm3).toBe(100);
      expect(res.gravityForceN).toBeCloseTo((250 / 1000) * 9.8, 3);
      expect(res.buoyantForceN).toBeCloseTo((100 / 1000) * 9.8, 3);
      expect(res.netForceN).toBeLessThan(0); // Net downward force
    });

    it('classifies neutrally buoyant objects within tolerance', () => {
      // Object with density 1.02 in freshwater (tolerance 0.04)
      const res = calculateBuoyancyState(1.0, 102, 100, 0.04);
      expect(res.classification).toBe('neutral');
      expect(res.submergedFraction).toBe(1.0);
      expect(res.displacedVolumeCm3).toBe(100);
    });

    it('calculates water volume displacement addition (1 cm3 = 1 mL)', () => {
      const items: BuoyancyItem[] = [
        createBuoyancyItem('b1', 'Block 100', 250, 100), // Sinks, V_sub = 100
        createBuoyancyItem('b2', 'Block 200', 500, 200)  // Sinks, V_sub = 200
      ];
      const disp = calculateDisplacement(400, items, 1.0, 1000);
      expect(disp.initialWaterMl).toBe(400);
      expect(disp.addedVolumeMl).toBe(300);
      expect(disp.currentWaterMl).toBe(700);
      expect(disp.isOverflowing).toBe(false);
    });

    it('detects overflow when water displacement exceeds tank capacity', () => {
      const hugeItems: BuoyancyItem[] = [
        createBuoyancyItem('b1', 'Huge', 2000, 700)
      ];
      const disp = calculateDisplacement(500, hugeItems, 1.0, 1000);
      expect(disp.currentWaterMl).toBe(1000); // Clamped
      expect(disp.isOverflowing).toBe(true);
    });

    it('calculates submarine pod density with attached modules', () => {
      const baseSub = { massG: 300, volumeCm3: 400 };
      const modules: SubmarineModule[] = [
        createSubmarineModule('m1', 'Ballast 1', 60, 0),
        createSubmarineModule('m2', 'Ballast 2', 40, 0)
      ];
      const trim = calculateSubmarineDensity(baseSub, modules);
      expect(trim.totalMassG).toBe(400);
      expect(trim.totalVolumeCm3).toBe(400);
      expect(trim.density).toBe(1.0);
      expect(trim.isNeutral).toBe(true);
    });

    it('calculates water surface level coordinate mapping', () => {
      // Tank height 400, capacity 1000, padding 40 top and bottom -> usable height 320
      // At 0 mL: surface is at bottom padding (400 - 40 = 360)
      expect(calculateWaterSurfaceLevel(400, 0, 1000, { top: 40, bottom: 40 })).toBe(360);
      // At 500 mL (50%): surface is at 360 - 0.5 * 320 = 200
      expect(calculateWaterSurfaceLevel(400, 500, 1000, { top: 40, bottom: 40 })).toBe(200);
      // At 1000 mL (100%): surface is at 360 - 320 = 40
      expect(calculateWaterSurfaceLevel(400, 1000, 1000, { top: 40, bottom: 40 })).toBe(40);
    });
  });

  // =========================================================================
  // 2. AGE BRACKET CURRICULUM GENERATION & ANTI-MIRRORING PROGRESSION
  // =========================================================================
  describe('Age Bracket Curriculum Generation (generateLevelsForAge)', () => {
    it('generates 3 preschool levels for age "3-5" focused on qualitative sink vs float', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('3-5');
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
        // Density separation invariant
        for (const item of lvl.inventory) {
          const rho = item.massG / item.volumeCm3;
          expect(Math.abs(rho - 1.0)).toBeGreaterThanOrEqual(0.25);
        }
      }
    });

    it('generates 3 elementary levels for age "6-8" strictly enforcing ANTI-MIRRORING', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('6-8');
        expect(lvl.initialWaterMl).toBeGreaterThan(0);
        expect(lvl.targetWaterMl).toBeGreaterThan(lvl.initialWaterMl);
        const requiredDelta = lvl.targetWaterMl - lvl.initialWaterMl;

        // ANTI-MIRRORING INVARIANT:
        // No single block in inventory equals requiredDelta!
        const singleMatch = lvl.inventory.some((b) => b.volumeCm3 === requiredDelta);
        expect(
          singleMatch,
          `Level "${lvl.id}" violates anti-mirroring: found single ${requiredDelta}cm3 piece`
        ).toBe(false);

        expect(verifyAntiMirroring(lvl)).toBe(true);

        // At least 2 blocks required to solve
        const hasPair = lvl.inventory.some((b1, i1) =>
          lvl.inventory.some((b2, i2) => i1 !== i2 && b1.volumeCm3 + b2.volumeCm3 === requiredDelta)
        );
        expect(hasPair, `Level "${lvl.id}" must have a valid 2-block combination`).toBe(true);
      }
    });

    it('generates 3 upper elementary levels for age "9-11" with freshwater & saltwater neutral buoyancy', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('9-11');
        expect([1.0, 1.2]).toContain(lvl.fluidDensity);
        expect(lvl.submarine).toBeDefined();
        expect(lvl.modules.length).toBeGreaterThanOrEqual(3);
        expect(verifyAntiMirroring(lvl)).toBe(true);
      }
    });

    it('modulates distractors based on difficulty parameter', () => {
      const easy = generateLevelsForAge('3-5', 'easy');
      const hard = generateLevelsForAge('3-5', 'hard');
      expect(easy[0].inventory.length).toBeLessThan(hard[0].inventory.length);

      const easyUpper = generateLevelsForAge('9-11', 'easy');
      const hardUpper = generateLevelsForAge('9-11', 'hard');
      expect(easyUpper[0].modules.length).toBeLessThan(hardUpper[0].modules.length);
    });
  });

  // =========================================================================
  // 3. ANTI-CHEAT & FORENSIC INTEGRITY CHECKS
  // =========================================================================
  describe('Anti-Cheat & Anti-Facade Invariants', () => {
    it('strictly prevents auto-win on empty tank across ALL 9 default levels', () => {
      const ageGroups: AgeGroup[] = ['3-5', '6-8', '9-11'];
      for (const age of ageGroups) {
        const levels = generateLevelsForAge(age);
        for (const lvl of levels) {
          const res = simulateBuoyancyLevel(lvl, []);
          expect(res.won, `Level "${lvl.id}" must NOT be won with empty tank`).toBe(false);
          expect(res.settlingTime).toBe(0);
        }
      }
    });

    it('strictly fails when water level is below target (underfill in 6-8)', () => {
      const lvl = generateLevelsForAge('6-8')[0];
      // Only place first block (100cm3, needed 300cm3)
      const res = simulateBuoyancyLevel(lvl, [lvl.inventory[0]]);
      expect(res.won).toBe(false);
      expect(res.targetMatched).toBe(false);
    });

    it('strictly fails when water level exceeds target (overfill in 6-8)', () => {
      const lvl = generateLevelsForAge('6-8')[0];
      // Place all blocks including distractor (100 + 200 + 150 = 450cm3, needed 300cm3)
      const res = simulateBuoyancyLevel(lvl, lvl.inventory);
      expect(res.won).toBe(false);
      expect(res.targetMatched).toBe(false);
    });

    it('strictly rejects distractor modules causing submarine sinking or floating in 9-11', () => {
      const lvl = generateLevelsForAge('9-11')[0];
      const distractor = lvl.modules.find((m) => m.isDistractor);
      if (distractor) {
        const res = simulateBuoyancyLevel(lvl, [distractor]);
        expect(res.won).toBe(false);
        expect(res.isNeutral).toBe(false);
      }
    });

    it('requires continuous settling delay (>= 0.5s) before triggering win', () => {
      const lvl = generateLevelsForAge('6-8')[0];
      const winningItems = [lvl.inventory[0], lvl.inventory[1]]; // 100 + 200 = 300cm3

      // Short run < 0.5s must NOT win
      const shortRun = simulateBuoyancyLevel(lvl, winningItems, 0.2);
      expect(shortRun.won, 'Cannot win before 0.5s settling time elapses').toBe(false);
      expect(shortRun.settlingTime).toBe(0.2);

      // Full run >= 0.5s must win
      const fullRun = simulateBuoyancyLevel(lvl, winningItems, 0.8);
      expect(fullRun.won, 'Must win after settling >= 0.5s').toBe(true);
    });
  });

  // =========================================================================
  // 4. GUARANTEED SOLVABILITY OF ALL 9 DEFAULT LEVELS
  // =========================================================================
  describe('Guaranteed Solvability of Default Levels', () => {
    it('solves all preschool levels (3-5) with intended manipulatives', () => {
      const levels = generateLevelsForAge('3-5');
      for (const lvl of levels) {
        const solutionItems = lvl.inventory.filter((item) => lvl.targetType === 'float' ? item.massG / item.volumeCm3 < 1.0 : item.massG / item.volumeCm3 > 1.0);
        const res = simulateBuoyancyLevel(lvl, solutionItems, 1.0);
        expect(res.won, `Preschool level ${lvl.id} must be solvable`).toBe(true);
      }
    });

    it('solves all elementary levels (6-8) matching target displacement with 2+ blocks', () => {
      const levels = generateLevelsForAge('6-8');
      for (const lvl of levels) {
        const reqDelta = lvl.targetWaterMl - lvl.initialWaterMl;
        // Find 2-block combination
        let sol: BuoyancyItem[] = [];
        for (let i = 0; i < lvl.inventory.length; i++) {
          for (let j = i + 1; j < lvl.inventory.length; j++) {
            if (lvl.inventory[i].volumeCm3 + lvl.inventory[j].volumeCm3 === reqDelta) {
              sol = [lvl.inventory[i], lvl.inventory[j]];
              break;
            }
          }
          if (sol.length > 0) break;
        }
        expect(sol.length).toBeGreaterThanOrEqual(2);
        const res = simulateBuoyancyLevel(lvl, sol, 1.0);
        expect(res.targetMatched).toBe(true);
        expect(res.won).toBe(true);
      }
    });

    it('solves all upper elementary levels (9-11) achieving neutral trim in freshwater and saltwater', () => {
      const levels = generateLevelsForAge('9-11');
      for (const lvl of levels) {
        const solModules = lvl.modules.filter((m) => !m.isDistractor);
        const res = simulateBuoyancyLevel(lvl, solModules, 1.0);
        expect(res.isNeutral, `Level ${lvl.id} must achieve neutral buoyancy`).toBe(true);
        expect(res.won, `Upper level ${lvl.id} must be solvable`).toBe(true);
      }
    });
  });

  // =========================================================================
  // 5. CUSTOM LEVEL PARSER (parseCustomLevels)
  // =========================================================================
  describe('Custom Level Parser (parseCustomLevels)', () => {
    it('parses valid custom levels from objects and JSON strings', () => {
      const raw = [
        {
          id: 'custom-bt-1',
          title: 'Custom Tank',
          ageGroup: '6-8',
          initialWaterMl: 400,
          targetWaterMl: 700,
          tankCapacityMl: 1000,
          inventory: [
            { id: 'b1', label: '100 cm³', volumeCm3: 100, massG: 250 },
            { id: 'b2', label: '200 cm³', volumeCm3: 200, massG: 500 }
          ]
        }
      ];

      const parsed = parseCustomLevels(raw);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      expect(parsed![0].id).toBe('custom-bt-1');
      expect(parsed![0].targetWaterMl).toBe(700);

      // JSON string parsing
      const parsedFromJson = parseCustomLevels(JSON.stringify(raw));
      expect(parsedFromJson).not.toBeNull();
      expect(parsedFromJson).toHaveLength(1);
    });

    it('sanitizes missing fields with safe defaults', () => {
      const rawPartial = [
        {
          id: 'partial-1',
          ageGroup: '6-8',
          initialWaterMl: 300,
          targetWaterMl: 600,
          inventory: [{ volumeCm3: 150, massG: 300 }, { volumeCm3: 150, massG: 300 }]
        }
      ];
      const parsed = parseCustomLevels(rawPartial);
      expect(parsed).not.toBeNull();
      expect(parsed![0].tankCapacityMl).toBe(1000); // Default applied
      expect(parsed![0].title).toBeDefined();
    });

    it('rejects malformed levels and returns null safely', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels('')).toBeNull();
      expect(parseCustomLevels('invalid-json')).toBeNull();
      expect(parseCustomLevels(12345)).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels([{ ageGroup: '6-8' }])).toBeNull(); // Missing required fields
      expect(parseCustomLevels([{ initialWaterMl: -100 }])).toBeNull(); // Negative volume
      expect(parseCustomLevels([{ initialWaterMl: 500, targetWaterMl: 400 }])).toBeNull(); // Target <= initial
    });
  });

  // =========================================================================
  // 6. DOM LIFECYCLE & ZERO-LEAK TEARDOWN
  // =========================================================================
  describe('BuoyancyTankGame DOM Lifecycle & Zero-Leak Teardown', () => {
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

      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;

      globalThis.requestAnimationFrame = vi.fn().mockImplementation(() => {
        const id = nextRafId++;
        activeRafs.add(id);
        return id;
      });
      globalThis.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
        activeRafs.delete(id);
      });

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
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        bezierCurveTo: vi.fn(),
        ellipse: vi.fn()
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

    it('mounts, starts, pauses, resumes, updates config, and destroys cleanly', () => {
      const game = createGame();
      expect(game).toBeDefined();

      game.mount(container, context);

      // Verify DOM HUD elements exist
      expect(container.querySelector('#hud-title')?.textContent).toContain('Buoyancy Tank');
      expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');
      expect(container.querySelector('#hud-instruction')).toBeDefined();
      expect(container.querySelector('#btn-sound-toggle')).toBeDefined();
      expect(container.querySelector('#btn-reset')).toBeDefined();

      // Telemetry emission
      const progressEvt = emittedEvents.find((e) => e.type === 'game:progress');
      expect(progressEvt).toBeDefined();

      game.start();
      game.pause?.();
      game.resume?.();

      // Dynamic locale update to French
      game.updateConfig?.({ locale: 'fr', sound: true });
      expect(container.querySelector('#btn-sound-toggle')?.textContent).toContain('Son ACTIF');

      // Dynamic ageGroup update
      game.updateConfig?.({ ageGroup: '9-11' });
      expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');

      // Zero-leak teardown
      game.destroy();
      expect(container.innerHTML).toBe('');
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });

    it('maintains zero orphan animation frame loops across pause, resume, multiple starts, and destroy', () => {
      const game = createGame();
      game.mount(container, context);
      expect(activeRafs.size).toBe(0);

      game.start();
      expect(activeRafs.size).toBe(1);

      game.start(); // Multiple start calls
      expect(activeRafs.size).toBe(1);

      game.pause?.();
      expect(activeRafs.size).toBe(0);

      game.resume?.();
      expect(activeRafs.size).toBe(1);

      game.destroy();
      expect(activeRafs.size).toBe(0);
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });

    it('supports granular undo: tapping item in tray places it in tank, reset button restores tray', () => {
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);

      const tray = container.querySelector('#item-tray') as HTMLElement;
      expect(tray).toBeDefined();

      const initialCount = tray.children.length;
      expect(initialCount).toBeGreaterThan(0);

      // Click first item to place in tank
      const firstItem = tray.firstElementChild as HTMLElement;
      firstItem.click();
      expect(tray.children.length).toBe(initialCount - 1);

      // Reset button restores all items to tray
      const resetBtn = container.querySelector('#btn-reset') as HTMLButtonElement;
      resetBtn.click();
      expect(tray.children.length).toBe(initialCount);

      game.destroy();
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });

    it('#6: renderSubmarine never uses a negative ellipse radius across a full propeller cycle', () => {
      context.ageGroup = '9-11';
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      const radii: number[] = [];
      const ctx = { ...(HTMLCanvasElement.prototype.getContext as any)() } as any;
      ctx.ellipse = vi.fn((_x: number, _y: number, rx: number, ry: number) => radii.push(rx, ry));
      for (let a = 0; a < Math.PI * 4; a += 0.1) {
        (game as any).propellerAngle = a;
        expect(() => (game as any).renderSubmarine(ctx, 400, 240)).not.toThrow();
      }
      expect(radii.length).toBeGreaterThan(0);
      expect(radii.every((r) => r >= 0)).toBe(true);
      game.destroy();
    });

    it('#6: loop survives a throwing render and keeps scheduling frames', () => {
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (game as any).renderCanvas = () => {
        throw new Error('boom');
      };
      game.start();
      expect(() => (game as any).loop(performance.now() + 16)).not.toThrow();
      expect((game as any).animFrameId).not.toBeNull();
      expect(activeRafs.size).toBeGreaterThan(0);
      errSpy.mockRestore();
      game.destroy();
    });

    it('#6: updateConfig restarts a dead loop but respects a paused host', () => {
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      game.start();
      (game as any).animFrameId = null; // simulate a dead loop
      game.updateConfig?.({ ageGroup: '9-11' });
      expect((game as any).animFrameId).not.toBeNull();
      game.pause?.();
      game.updateConfig?.({ ageGroup: '3-5' });
      expect((game as any).animFrameId).toBeNull();
      game.destroy();
    });

    it('#9: changing ageGroup resets score, streak, elapsed start time and the HUD score', () => {
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      game.start();
      (game as any).score = 300;
      (game as any).streak = 3;
      (game as any).startTimeMs = 1;
      (game as any).updateScoreDisplay();
      expect(container.querySelector('#hud-score')?.textContent).toContain('300');

      const before = Date.now();
      game.updateConfig?.({ ageGroup: '9-11' });
      expect((game as any).score).toBe(0);
      expect((game as any).streak).toBe(0);
      expect((game as any).startTimeMs).toBeGreaterThanOrEqual(before);
      expect(container.querySelector('#hud-score')?.textContent).toContain('0');
      expect(container.querySelector('#hud-score')?.textContent).not.toContain('300');
      game.destroy();
    });

    it('#9: game:complete summary is age-appropriate', () => {
      context.ageGroup = '3-5';
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      vi.useFakeTimers();
      (game as any).currentLevelIndex = (game as any).levels.length - 1;
      (game as any).triggerWin();
      vi.advanceTimersByTime(1300);
      vi.useRealTimers();
      const done = emittedEvents.find((e) => e.type === 'game:complete');
      expect(done?.payload.summary).toBe(getTranslations('en').summaries['3-5']);
      game.destroy();
    });

    it('#8: 9-11 HUD hint never mentions foam when the level has no foam', () => {
      context.ageGroup = '9-11';
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);
      const lvl = (game as any).levels[0];
      expect(lvl.modules.some((m: SubmarineModule) => m.type === 'foam')).toBe(false);
      const ballast = lvl.modules.filter((m: SubmarineModule) => m.type === 'ballast');
      (game as any).placedEntities = ballast.map((item: SubmarineModule) => ({ item, x: 0, y: 0, vy: 0, bobPhase: 0, isSettled: false }));
      (game as any).currentLevel = { ...lvl, submarine: { massG: 900, volumeCm3: 400 } };
      (game as any).updateHUDText();
      const text = container.querySelector('#hud-instruction')?.textContent || '';
      expect(text).toMatch(/sinks/i);
      expect(text).not.toMatch(/foam/i);
      expect(text).toMatch(/Remove some ballast/);
      game.destroy();
    });

    it('handles sound toggle button click', () => {
      const game = createBuoyancyTankGame() as BuoyancyTankGame;
      game.mount(container, context);

      const soundBtn = container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
      expect(soundBtn.textContent).toContain('Sound OFF');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound ON');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound OFF');

      game.destroy();
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });
  });

  describe('Hint scaffolding does not reveal answers (#8)', () => {
    it('6-8 hints never contain the exact remaining mL, in both locales', () => {
      for (const locale of ['en', 'fr'] as const) {
        const t = getTranslations(locale);
        const under = t.formatElementaryPrompt(500, 737, 613, 237, 113); // remaining 124
        expect(under).not.toContain('124');
        expect(under).toContain('613');
        expect(under).toContain('737');
        const start = t.formatElementaryPrompt(500, 737, 500, 237, 0);
        expect(start).not.toContain('237');
        const over = t.formatElementaryPrompt(500, 737, 761, 237, 261); // overshoot 24
        expect(over).not.toContain('+24');
        expect(over).not.toMatch(/\b24 mL/);
        expect(t.hintUnderfill(613, 737)).not.toContain('124');
      }
    });

    it('9-11 hints adapt to the inventory in both locales', () => {
      for (const locale of ['en', 'fr'] as const) {
        const t = getTranslations(locale);
        const sinksNoFoam = t.formatUpperElementaryPrompt('x', 1, 500, 400, 1.25, 'sinks', { hasFoam: false, hasBallast: true });
        const sinksFoam = t.formatUpperElementaryPrompt('x', 1, 500, 400, 1.25, 'sinks', { hasFoam: true, hasBallast: true });
        expect(sinksNoFoam).not.toMatch(/foam|mousse/i);
        expect(sinksFoam).toMatch(/foam|mousse/i);
        const floatsNoBallast = t.formatUpperElementaryPrompt('x', 1, 200, 400, 0.5, 'floats', { hasFoam: true, hasBallast: false });
        expect(floatsNoBallast).not.toMatch(/ballast|lest/i);
      }
    });

    it('completion summaries are distinct per age bracket in EN and FR', () => {
      for (const locale of ['en', 'fr'] as const) {
        const t = getTranslations(locale);
        expect(new Set(Object.values(t.summaries)).size).toBe(3);
      }
    });
  });

  // =========================================================================
  // 7. BILINGUAL TRANSLATION FORMATTERS
  // =========================================================================
  describe('Bilingual Translation Formatters', () => {
    it('formats English and French prompts and unit labels correctly', () => {
      const en = getTranslations('en');
      const fr = getTranslations('fr');

      expect(en.title).toContain('Buoyancy Tank');
      expect(fr.title).toMatch(/Cuve|Flottaison|Archimède/);

      expect(en.units.ml).toBe('mL');
      expect(fr.units.ml).toBe('mL');
      expect(en.units.cm3).toBe('cm³');
      expect(fr.units.cm3).toBe('cm³');
      expect(en.units.density).toBe('g/cm³');
      expect(fr.units.density).toBe('g/cm³');
    });
  });
});
