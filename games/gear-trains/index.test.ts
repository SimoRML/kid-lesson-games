import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext, AgeGroup } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import { getTranslations } from './i18n.js';
import {
  GearTrainsGame,
  createGame,
  createGearTrainsGame,
  calculatePitchRadius,
  calculateOuterRadius,
  calculateRootRadius,
  calculatePegDistance,
  areGearsMeshed,
  doGearsCollide,
  calculateOutputSpeed,
  calculateTrainOutputSpeed,
  calculateDirection,
  invertDirection,
  gcd,
  lcm,
  calculateGCD,
  calculateLCM,
  simplifyGearRatio,
  calculateMeshingCycle,
  createGearItem,
  generateLevelsForAge,
  parseCustomLevels,
  simulateGearTrain,
  diagnoseGearTrain,
  verifyAntiMirroring,
  GEAR_MODULE,
  type GearLevel,
  type PlacedGear
} from './index.js';

describe('Gear Trains Game & Kinematic Transmission Engine', () => {
  // =========================================================================
  // 1. PURE DOMAIN MATH, GEOMETRY & KINEMATICS
  // =========================================================================
  describe('Pure Gear Geometry & Pitch Radius (calculatePitchRadius)', () => {
    it('calculates exact pitch radius for standard tooth counts {6, 8, 12, 16, 24}', () => {
      expect(GEAR_MODULE).toBe(10);
      // Nominal module = 10 (pitch radius = teeth * 5)
      expect(calculatePitchRadius(6)).toBe(30);
      expect(calculatePitchRadius(8)).toBe(40);
      expect(calculatePitchRadius(12)).toBe(60);
      expect(calculatePitchRadius(16)).toBe(80);
      expect(calculatePitchRadius(24)).toBe(120);
    });

    it('supports custom module scaling factor', () => {
      expect(calculatePitchRadius(12, 8)).toBe(48); // 12 * 8 / 2 = 48
      expect(calculatePitchRadius(6, 6)).toBe(18);  // 6 * 6 / 2 = 18
    });

    it('safely handles non-positive or invalid tooth counts', () => {
      expect(calculatePitchRadius(0)).toBe(0);
      expect(calculatePitchRadius(-8)).toBe(0);
      expect(calculatePitchRadius(NaN)).toBe(0);
    });

    it('computes outer tip and root radii with proportional clearance', () => {
      expect(calculateOuterRadius(12)).toBeGreaterThan(calculatePitchRadius(12));
      expect(calculateRootRadius(12)).toBeLessThan(calculatePitchRadius(12));
    });

    it('computes exact peg distance for meshing teeth', () => {
      expect(calculatePegDistance(8, 12)).toBe(100);
      expect(calculatePegDistance(12, 16)).toBe(140);
    });
  });

  describe('Meshing Detection (areGearsMeshed & doGearsCollide)', () => {
    it('detects meshing when distance exactly equals sum of pitch radii', () => {
      const g1 = { x: 100, y: 100, radius: 40 }; // 8T
      const g2 = { x: 200, y: 100, radius: 60 }; // 12T (sum = 100, dist = 100)
      expect(areGearsMeshed(g1, g2)).toBe(true);
    });

    it('accepts meshing within tolerance window (+/- 3px)', () => {
      const g1 = { x: 100, y: 100, radius: 40 };
      const g2Near = { x: 198, y: 100, radius: 60 }; // dist = 98 (-2px)
      const g2Far = { x: 202, y: 100, radius: 60 };  // dist = 102 (+2px)
      expect(areGearsMeshed(g1, g2Near, 3)).toBe(true);
      expect(areGearsMeshed(g1, g2Far, 3)).toBe(true);
    });

    it('rejects gears that are too far apart (disconnection)', () => {
      const g1 = { x: 100, y: 100, radius: 40 };
      const g2 = { x: 220, y: 100, radius: 60 }; // dist = 120 > 100 + 3
      expect(areGearsMeshed(g1, g2, 3)).toBe(false);
    });

    it('rejects gears that collide / overlap too deeply (interference)', () => {
      const g1 = { x: 100, y: 100, radius: 40 };
      const g2 = { x: 170, y: 100, radius: 60 }; // dist = 70 << 100 - 3
      expect(areGearsMeshed(g1, g2, 3)).toBe(false);
      expect(doGearsCollide(g1, g2, 3)).toBe(true);
    });

    it('rejects coincident gears at the same coordinates', () => {
      const g1 = { x: 150, y: 150, radius: 40 };
      const g2 = { x: 150, y: 150, radius: 40 };
      expect(areGearsMeshed(g1, g2)).toBe(false);
      expect(doGearsCollide(g1, g2)).toBe(true);
    });
  });

  describe('Rotational Transmission Kinematics (calculateOutputSpeed & calculateDirection)', () => {
    it('calculates speed doubling (1:2 ratio) for 16T driver and 8T follower', () => {
      const speed = calculateOutputSpeed(60, 16, 8);
      expect(speed).toBe(120);
    });

    it('calculates speed halving (2:1 ratio) for 8T driver and 16T follower', () => {
      const speed = calculateOutputSpeed(60, 8, 16);
      expect(speed).toBe(30);
    });

    it('computes output speed across multi-gear train with idler cancellation', () => {
      // Simple train: 8T (motor, 60 RPM) -> 12T (idler) -> 16T (target)
      const speed = calculateTrainOutputSpeed(60, [8, 12, 16]);
      expect(speed).toBe(30); // 60 * (8 / 16) = 30
    });

    it('alternates rotational direction according to train length parity', () => {
      // k = 1 (single gear) -> same
      expect(calculateDirection('cw', 1)).toBe('cw');
      expect(calculateDirection('ccw', 1)).toBe('ccw');

      // k = 2 (mesh of 2 gears) -> reversed
      expect(calculateDirection('cw', 2)).toBe('ccw');
      expect(calculateDirection('ccw', 2)).toBe('cw');

      // k = 3 (mesh of 3 gears) -> same
      expect(calculateDirection('cw', 3)).toBe('cw');
      expect(calculateDirection('ccw', 3)).toBe('ccw');

      // k = 4 (mesh of 4 gears) -> reversed
      expect(calculateDirection('cw', 4)).toBe('ccw');
      expect(calculateDirection('ccw', 4)).toBe('cw');
    });

    it('inverts direction accurately', () => {
      expect(invertDirection('cw')).toBe('ccw');
      expect(invertDirection('ccw')).toBe('cw');
    });
  });

  describe('LCM & Gear Ratio Arithmetic (gcd, lcm, simplifyGearRatio)', () => {
    it('calculates GCD and LCM accurately for standard tooth combinations', () => {
      expect(gcd(6, 8)).toBe(2);
      expect(lcm(6, 8)).toBe(24);
      expect(calculateGCD(6, 8)).toBe(2);
      expect(calculateLCM(6, 8)).toBe(24);

      expect(gcd(8, 16)).toBe(8);
      expect(lcm(8, 16)).toBe(16);

      expect(gcd(12, 16)).toBe(4);
      expect(lcm(12, 16)).toBe(48);

      expect(gcd(6, 24)).toBe(6);
      expect(lcm(6, 24)).toBe(24);

      expect(gcd(16, 24)).toBe(8);
      expect(lcm(16, 24)).toBe(48);
    });

    it('simplifies gear ratios into irreducible fractions and numeric values', () => {
      const r1 = simplifyGearRatio(16, 8);
      expect(r1.numerator).toBe(2);
      expect(r1.denominator).toBe(1);
      expect(r1.ratio).toBe(2.0);
      expect(r1.display).toBe('2:1');

      const r2 = simplifyGearRatio(8, 16);
      expect(r2.numerator).toBe(1);
      expect(r2.denominator).toBe(2);
      expect(r2.ratio).toBe(0.5);
      expect(r2.display).toBe('1:2');

      const r3 = simplifyGearRatio(12, 16);
      expect(r3.numerator).toBe(3);
      expect(r3.denominator).toBe(4);
      expect(r3.ratio).toBe(0.75);
      expect(r3.display).toBe('3:4');

      const r4 = simplifyGearRatio(24, 6);
      expect(r4.numerator).toBe(4);
      expect(r4.denominator).toBe(1);
      expect(r4.ratio).toBe(4.0);
      expect(r4.display).toBe('4:1');
    });

    it('calculates meshing cycle revolutions accurately', () => {
      const cycle = calculateMeshingCycle(12, 16);
      expect(cycle.lcm).toBe(48);
      expect(cycle.revs1).toBe(4); // 48 / 12 = 4
      expect(cycle.revs2).toBe(3); // 48 / 16 = 3
    });
  });

  // =========================================================================
  // 2. AGE BRACKET CURRICULUM GENERATION & ANTI-MIRRORING PROGRESSION
  // =========================================================================
  describe('Age Bracket Curriculum Generation (generateLevelsForAge)', () => {
    it('generates 3 preschool levels for age "3-5" focused on spatial windmill pathing', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('3-5');
        expect(lvl.target.type).toBe('windmill');
        expect(lvl.motor).toBeDefined();
        expect(lvl.motor.teeth).toBeGreaterThan(0);
        expect(lvl.target).toBeDefined();
        expect(lvl.target.teeth).toBeGreaterThan(0);
        expect(lvl.pegs.length).toBeGreaterThanOrEqual(1);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('generates 3 elementary levels for age "6-8" strictly enforcing ANTI-MIRRORING & Direction Parity', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('6-8');
        expect(lvl.target.targetDirection).toBeDefined();
        expect(['cw', 'ccw']).toContain(lvl.target.targetDirection);
        expect(lvl.target.targetRpm).toBeDefined();
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(3);

        // ANTI-MIRRORING RULE ASSERTION:
        expect(verifyAntiMirroring(lvl)).toBe(true);
      }
    });

    it('generates 3 upper elementary levels for age "9-11" enforcing Gear Ratios & Target RPM', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);

      for (const lvl of levels) {
        expect(lvl.ageGroup).toBe('9-11');
        expect(lvl.target.targetRpm).toBeDefined();
        expect(lvl.target.targetDirection).toBeDefined();
        expect(lvl.target.targetRpm).toBeGreaterThan(0);
        expect(lvl.pegs.length).toBeGreaterThanOrEqual(1);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(3);

        expect(verifyAntiMirroring(lvl)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. ANTI-CHEAT & FORENSIC INTEGRITY CHECKS
  // =========================================================================
  describe('Anti-Cheat & Anti-Facade Invariants', () => {
    it('strictly prevents auto-win on empty pegboard across ALL 9 default levels', () => {
      const ageGroups: AgeGroup[] = ['3-5', '6-8', '9-11'];
      for (const age of ageGroups) {
        const levels = generateLevelsForAge(age);
        for (const lvl of levels) {
          const res = simulateGearTrain(lvl, []);
          expect(res.won, `Level "${lvl.id}" must NOT be won on an empty board`).toBe(false);
          expect(res.connected, `Level "${lvl.id}" must NOT report connected on empty board`).toBe(false);
          expect(res.outputRpm, `Level "${lvl.id}" target RPM must be 0 without gears`).toBe(0);
          expect(res.settlingTime, `Level "${lvl.id}" settling time must be 0`).toBe(0);
        }
      }
    });

    it('strictly prevents transmission when there is a spatial gap between gears', () => {
      const lvl = generateLevelsForAge('3-5')[1]; // 2 pegs
      // Place gear only on the second peg, leaving peg 1 empty (gap between motor and gear)
      const disconnectedPlacement: PlacedGear[] = [
        { pegId: lvl.pegs[1].id, gear: lvl.inventory[0] }
      ];
      const res = simulateGearTrain(lvl, disconnectedPlacement);
      expect(res.connected).toBe(false);
      expect(res.won).toBe(false);
      expect(res.outputRpm).toBe(0);
    });

    it('strictly prevents win when target spins in wrong direction (parity violation)', () => {
      const lvl = generateLevelsForAge('6-8')[0]; // Requires 'ccw'
      // Level 1 solution requires 2 gears (Peg 1 & Peg 2) to reach CCW.
      // If we only bridge with an odd configuration that gives CW, it must fail direction check.
      const wrongPlacement: PlacedGear[] = [
        { pegId: lvl.pegs[0].id, gear: lvl.inventory[0] }
      ];
      const resWrong = simulateGearTrain(lvl, wrongPlacement);
      expect(resWrong.won).toBe(false);
    });

    it('strictly rejects distractor gears producing incorrect RPM', () => {
      const lvl = generateLevelsForAge('9-11')[0];
      const distractor = lvl.distractors?.[0];
      if (distractor && lvl.pegs.length > 0) {
        const distractorPlacement: PlacedGear[] = [
          { pegId: lvl.pegs[0].id, gear: distractor }
        ];
        const res = simulateGearTrain(lvl, distractorPlacement);
        expect(res.won).toBe(false);
      }
    });

    it('requires continuous settling delay (>= 0.5s) before triggering win', () => {
      const lvl = generateLevelsForAge('3-5')[0];
      // Construct valid winning placement (12T on peg p1)
      const winningPlacement: PlacedGear[] = [
        { pegId: lvl.pegs[0].id, gear: lvl.inventory[0] }
      ];

      // Short run < 0.5s must NOT win
      const shortRun = simulateGearTrain(lvl, winningPlacement, 0.2);
      expect(shortRun.won, 'Cannot win before 0.5s settling time elapses').toBe(false);
      expect(shortRun.settlingTime).toBe(0.2);

      // Full run >= 0.5s must win
      const fullRun = simulateGearTrain(lvl, winningPlacement, 1.0);
      expect(fullRun.won, 'Must win after settling for >= 0.5s').toBe(true);
      expect(fullRun.settlingTime).toBeGreaterThanOrEqual(0.5);
    });

    it('detects odd-cycle mechanical jamming and halts transmission', () => {
      // Create a 3-gear triangle peg configuration where gears mesh in an odd loop
      const jamLevel: GearLevel = {
        id: 'jam-test',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Jam Test',
        motor: { pegId: 'm1', x: 200, y: 200, teeth: 12, rpm: 60, direction: 'cw' },
        target: { pegId: 't1', x: 200, y: 320, teeth: 12, targetRpm: 60, targetDirection: 'ccw', type: 'dial' },
        pegs: [
          // Peg forms equilateral triangle of side 120 with m1(200, 200) and t1(200, 320)
          // Distances: m1 to t1 = 120 (sum of radii 60 + 60 = 120!)
          // Peg at (200 + 120 * sqrt(3)/2, 260) ~= (304, 260)
          { id: 'p1', x: 304, y: 260 }
        ],
        inventory: [createGearItem(12, 'g1')]
      };

      const placed: PlacedGear[] = [
        { pegId: 'p1', gear: createGearItem(12, 'g1') }
      ];

      const sim = simulateGearTrain(jamLevel, placed);
      expect(sim.isJammed, '3-gear odd cycle must trigger mechanical jamming').toBe(true);
      expect(sim.connected, 'Jammed gears must not be marked connected').toBe(false);
      expect(sim.outputRpm, 'Jammed mechanism must have 0 output RPM').toBe(0);
      expect(sim.outputDirection, 'Jammed mechanism must have null output direction').toBeNull();
      expect(sim.won, 'Jammed gears cannot win').toBe(false);
    });

    it('zeros out output velocity and halts motion when gears collide with interference', () => {
      // Peg positioned so placed gear collides into motor/target gear
      const collideLevel: GearLevel = {
        id: 'collide-test',
        levelNumber: 2,
        ageGroup: '6-8',
        title: 'Collision Jam Test',
        motor: { pegId: 'm1', x: 100, y: 200, teeth: 12, rpm: 60, direction: 'cw' },
        target: { pegId: 't1', x: 220, y: 200, teeth: 12, targetRpm: 60, targetDirection: 'ccw', type: 'dial' },
        pegs: [
          // Distance 60 from motor (overlap collision, pitch radii sum = 120)
          { id: 'p1', x: 160, y: 200 }
        ],
        inventory: [createGearItem(12, 'g1')]
      };

      const placed: PlacedGear[] = [
        { pegId: 'p1', gear: createGearItem(12, 'g1') }
      ];

      const sim = simulateGearTrain(collideLevel, placed);
      expect(sim.isJammed, 'Deep gear overlap must trigger mechanical collision jam').toBe(true);
      expect(sim.outputRpm).toBe(0);
      expect(sim.outputDirection).toBeNull();
      expect(sim.won).toBe(false);
    });
  });

  // =========================================================================
  // 4. GUARANTEED SOLVABILITY OF ALL 9 DEFAULT LEVELS
  // =========================================================================
  describe('Guaranteed Solvability of Default Levels', () => {
    it('solves all preschool levels (3-5) with intended gears', () => {
      const levels = generateLevelsForAge('3-5');
      for (const lvl of levels) {
        // Construct solution using gears from inventory matching peg count
        const solutionGears: PlacedGear[] = lvl.pegs.map((peg, idx) => ({
          pegId: peg.id,
          gear: lvl.inventory[idx]
        }));

        const res = simulateGearTrain(lvl, solutionGears, 1.0);
        expect(res.connected, `Preschool level ${lvl.id} must be connected`).toBe(true);
        expect(res.won, `Preschool level ${lvl.id} must be won`).toBe(true);
        expect(res.settlingTime).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('solves all elementary levels (6-8) satisfying both speed and direction', () => {
      const levels = generateLevelsForAge('6-8');
      for (const lvl of levels) {
        const solutionGears: PlacedGear[] = lvl.pegs.map((peg, idx) => ({
          pegId: peg.id,
          gear: lvl.inventory[idx]
        }));

        const res = simulateGearTrain(lvl, solutionGears, 1.0);
        expect(res.connected, `Elementary level ${lvl.id} must be connected`).toBe(true);
        expect(res.directionCorrect, `Level ${lvl.id} direction must be correct`).toBe(true);
        expect(res.speedCorrect, `Level ${lvl.id} speed must be correct`).toBe(true);
        expect(res.won, `Elementary level ${lvl.id} must be won`).toBe(true);
      }
    });

    it('solves all upper elementary levels (9-11) matching target RPM and direction', () => {
      const levels = generateLevelsForAge('9-11');
      for (const lvl of levels) {
        const solutionGears: PlacedGear[] = lvl.pegs.map((peg, idx) => ({
          pegId: peg.id,
          gear: lvl.inventory[idx]
        }));

        const res = simulateGearTrain(lvl, solutionGears, 1.0);
        expect(res.connected, `Upper level ${lvl.id} must be connected`).toBe(true);
        expect(res.directionCorrect, `Upper level ${lvl.id} direction must match`).toBe(true);
        expect(res.speedCorrect, `Upper level ${lvl.id} speed must match`).toBe(true);
        expect(res.won, `Upper level ${lvl.id} must be won`).toBe(true);
      }
    });
  });

  // =========================================================================
  // 5. CUSTOM LEVEL PARSER (parseCustomLevels)
  // =========================================================================
  describe('diagnoseGearTrain (gap / overlap / odd-cycle)', () => {
    const pre = generateLevelsForAge('3-5');
    const el = generateLevelsForAge('6-8');
    const pick = (lvl: GearLevel, teeth: number) => lvl.inventory.find((g) => g.teeth === teeth)!;

    it('reports a gap when all pegs are filled but gears do not touch', () => {
      expect(diagnoseGearTrain(pre[0], [{ pegId: 'p1', gear: pick(pre[0], 8) }])).toBe('gap-bigger');
      const l2 = pre[1];
      expect(
        diagnoseGearTrain(l2, [
          { pegId: 'p1', gear: pick(l2, 6) },
          { pegId: 'p2', gear: pick(l2, 12) }
        ])
      ).toBe('gap-bigger');
    });

    it('gives no diagnosis while pegs remain empty or when solved', () => {
      expect(diagnoseGearTrain(pre[1], [{ pegId: 'p1', gear: pick(pre[1], 12) }])).toBe('none');
      expect(diagnoseGearTrain(pre[0], [{ pegId: 'p1', gear: pick(pre[0], 12) }])).toBe('none');
    });

    it('reports a plain overlap (not an odd-cycle) for an oversized gear', () => {
      const lvl = el[0];
      const placed: PlacedGear[] = [{ pegId: 'p1', gear: pick(lvl, 16) }];
      const sim = simulateGearTrain(lvl, placed);
      expect(sim.isJammed).toBe(true);
      expect(sim.jamReason).toBe('overlap');
      expect(diagnoseGearTrain(lvl, placed)).toBe('overlap');
    });

    it('reports an odd-cycle only for a real closed odd loop', () => {
      const h = Math.sqrt(120 * 120 - 60 * 60);
      const lvl: GearLevel = {
        id: 'loop',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'loop',
        motor: { pegId: 'motor', x: 200, y: 300, teeth: 12, rpm: 30, direction: 'cw' },
        target: { pegId: 'target', x: 700, y: 100, teeth: 12, type: 'dial' },
        pegs: [
          { id: 'p1', x: 320, y: 300 },
          { id: 'p2', x: 260, y: 300 - h }
        ],
        inventory: [createGearItem(12, 'a'), createGearItem(12, 'b')]
      };
      const placed: PlacedGear[] = [
        { pegId: 'p1', gear: lvl.inventory[0] },
        { pegId: 'p2', gear: lvl.inventory[1] }
      ];
      const sim = simulateGearTrain(lvl, placed);
      expect(sim.isJammed).toBe(true);
      expect(sim.jamReason).toBe('odd-cycle');
      expect(diagnoseGearTrain(lvl, placed)).toBe('odd-cycle');
    });
  });

  describe('Custom Level Parser (parseCustomLevels)', () => {
    it('parses valid custom levels from objects and JSON strings', () => {
      const raw = [
        {
          id: 'custom-gear-1',
          title: 'Clockwork Test',
          ageGroup: '6-8',
          motor: { pegId: 'm1', x: 100, y: 250, teeth: 16, rpm: 60, direction: 'cw' },
          target: { pegId: 't1', x: 300, y: 250, teeth: 8, targetRpm: 120, targetDirection: 'ccw', type: 'dial' },
          pegs: [{ id: 'p1', x: 200, y: 250 }],
          inventory: [
            { id: 'g1', teeth: 12, color: '#38bdf8' },
            { id: 'g2', teeth: 8, color: '#fbbf24' }
          ]
        }
      ];

      const parsed = parseCustomLevels(raw);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      const lvl = parsed![0];
      expect(lvl.id).toBe('custom-gear-1');
      expect(lvl.motor.teeth).toBe(16);
      expect(lvl.target.targetRpm).toBe(120);

      // JSON string parsing
      const jsonStr = JSON.stringify(raw);
      const parsedFromJson = parseCustomLevels(jsonStr);
      expect(parsedFromJson).not.toBeNull();
      expect(parsedFromJson).toHaveLength(1);
    });

    it('rejects malformed levels lacking motor or target or pegs', () => {
      expect(parseCustomLevels([{ title: 'No Motor', target: { teeth: 8 } }])).toBeNull();
      expect(parseCustomLevels([{ title: 'No Target', motor: { teeth: 16 } }])).toBeNull();
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels('not valid json')).toBeNull();
      expect(parseCustomLevels(12345)).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
    });

    it('sanitizes or rejects non-positive teeth counts and NaN coordinates', () => {
      const invalidTeeth = [
        {
          motor: { teeth: -8, rpm: 60, x: 100, y: 100 },
          target: { teeth: 0, x: 200, y: 100 },
          pegs: []
        }
      ];
      expect(parseCustomLevels(invalidTeeth)).toBeNull();
    });
  });

  // =========================================================================
  // 6. DOM LIFECYCLE & ZERO-LEAK TEARDOWN
  // =========================================================================
  describe('GearTrainsGame DOM Lifecycle & Zero-Leak Teardown', () => {
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
        bezierCurveTo: vi.fn()
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
      expect(container.querySelector('#hud-title')?.textContent).toContain('Gear Trains');
      expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');
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
      expect(container.querySelector('#hud-title')?.textContent).toContain('Engrenages');
      expect(container.querySelector('#btn-sound-toggle')?.textContent).toContain('Son ACTIVÉ');

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
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });

    it('supports granular undo: tapping gear in tray places it, reset clears it back to tray', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);

      const tray = container.querySelector('#gear-tray') as HTMLElement;
      expect(tray).toBeDefined();

      const initialCount = tray.children.length;
      expect(initialCount).toBeGreaterThan(0);

      // Click first gear in tray to place on peg
      const firstGear = tray.firstElementChild as HTMLElement;
      firstGear.click();

      expect(tray.children.length).toBe(initialCount - 1);

      // Reset button restores all gears to tray
      const resetBtn = container.querySelector('#btn-reset') as HTMLButtonElement;
      resetBtn.click();
      expect(tray.children.length).toBe(initialCount);

      game.destroy();
      if (container.parentElement) {
        document.body.removeChild(container);
      }
    });

    const ptr = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));

    it('places a tray gear on a real pointer tap (pointerdown + pointerup, no click)', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      const tray = container.querySelector('#gear-tray') as HTMLElement;
      const before = tray.children.length;
      ptr(tray.firstElementChild as HTMLElement, 'pointerdown', 20, 500);
      ptr(window, 'pointerup', 22, 501); // 2px movement, below the 5px threshold
      expect(tray.children.length).toBe(before - 1);
      game.destroy();
    });

    it('drag from tray onto a peg places the gear, and tapping it returns it to the tray', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      const tray = container.querySelector('#gear-tray') as HTMLElement;
      const before = tray.children.length;
      ptr(tray.firstElementChild as HTMLElement, 'pointerdown', 20, 500);
      ptr(window, 'pointermove', 300, 300);
      ptr(window, 'pointermove', 455, 235);
      ptr(window, 'pointerup', 455, 235);
      expect(tray.children.length).toBe(before - 1);
      expect((game as any).placedGears.has('p2')).toBe(true);
      expect((game as any).placedGears.has('p1')).toBe(false);
      ptr(container.querySelector('#gear-canvas')!, 'pointerdown', 460, 230);
      ptr(window, 'pointerup', 460, 230);
      expect(tray.children.length).toBe(before);
      game.destroy();
    });

    it('a cancelled pointer gesture places nothing', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      const tray = container.querySelector('#gear-tray') as HTMLElement;
      const before = tray.children.length;
      ptr(tray.firstElementChild as HTMLElement, 'pointerdown', 20, 500);
      ptr(window, 'pointercancel', 20, 500);
      expect(tray.children.length).toBe(before);
      game.destroy();
    });

    it('translates the tray label and updates it live on locale change', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      expect(container.querySelector('#tray-label')?.textContent).toBe(getTranslations('en').trayLabel);
      game.updateConfig?.({ locale: 'fr' });
      expect(container.querySelector('#tray-label')?.textContent).toBe(getTranslations('fr').trayLabel);
      expect(getTranslations('fr').trayLabel).not.toBe(getTranslations('en').trayLabel);
      game.destroy();
    });

    it('resets score, streak and elapsed time when the age bracket changes', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      game.start();
      (game as any).score = 300;
      (game as any).streak = 3;
      (game as any).startTimeMs = 1;
      game.updateConfig?.({ ageGroup: '9-11' });
      expect((game as any).score).toBe(0);
      expect((game as any).streak).toBe(0);
      expect((game as any).startTimeMs).toBeGreaterThan(1);
      expect(container.querySelector('#hud-score')?.textContent).toContain('0');
      game.destroy();
    });

    it('starts a fresh round after the final level is won', () => {
      vi.useFakeTimers();
      try {
        const game = createGearTrainsGame() as GearTrainsGame;
        game.mount(container, context);
        (game as any).currentLevelIndex = 2;
        (game as any).handleLevelWin();
        expect(emittedEvents.some((e) => e.type === 'game:complete')).toBe(true);
        expect((game as any).hasWonLevel).toBe(true);
        vi.advanceTimersByTime(3100);
        expect((game as any).hasWonLevel).toBe(false);
        expect((game as any).currentLevelIndex).toBe(0);
        expect((game as any).score).toBe(0);
        expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');
        game.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('HUD instruction spans the full row and reserves a min-height (stable layout)', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      const hudText = container.querySelector('#hud-instruction') as HTMLElement;
      expect(hudText.style.flex).toContain('100%');
      expect(container.innerHTML).toContain('.hud-instruction { min-height');
      game.destroy();
    });

    it('shows a gap hint in the HUD in EN and FR', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
      game.mount(container, context);
      game.updateConfig?.({ ageGroup: '3-5' });
      const tray = container.querySelector('#gear-tray') as HTMLElement;
      const hud = () => container.querySelector('#hud-instruction')!.textContent;
      (Array.from(tray.children).find((b) => b.textContent === '8T') as HTMLElement).click();
      expect(hud()).toBe(getTranslations('en').gapBiggerHint);
      game.updateConfig?.({ locale: 'fr' });
      expect(hud()).toBe(getTranslations('fr').gapBiggerHint);
      game.destroy();
    });

    it('handles sound toggle button click', () => {
      const game = createGearTrainsGame() as GearTrainsGame;
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

  // =========================================================================
  // 7. BILINGUAL TRANSLATION FORMATTERS
  // =========================================================================
  describe('Bilingual Translation Formatters', () => {
    it('formats English and French prompts and direction labels correctly', () => {
      const en = getTranslations('en');
      const fr = getTranslations('fr');

      // Titles and direction labels
      expect(en.title).toContain('Gear Trains');
      expect(fr.title).toContain('Engrenages');
      expect(en.directionLabels.cw).toBe('Clockwise');
      expect(fr.directionLabels.cw).toBe('Sens horaire');
      expect(en.directionLabels.ccw).toBe('Counter-Clockwise');
      expect(fr.directionLabels.ccw).toBe('Sens anti-horaire');

      // Unit labels
      expect(en.units.rpm).toBe('RPM');
      expect(fr.units.rpm).toBe('tr/min');
    });
  });
});
