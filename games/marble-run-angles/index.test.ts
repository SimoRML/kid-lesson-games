import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext, AgeGroup } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
import { DICTIONARY } from './i18n.js';
import {
  MarbleRunAnglesGame,
  createGame,
  createMarbleRunAnglesGame,
  snapToAngle,
  classifyAngle,
  checkSegmentCollision,
  computeReflectionVelocity,
  calculateIncidenceAndReflectionAngles,
  generateLevelsForAge,
  parseCustomLevels,
  createManipulative,
  simulateLevel,
  stepPhysics,
  type MarbleLevel,
  type MarblePhysicsState,
  type Manipulative,
  type PieceType
} from './index.js';

describe('Marble Run Angles Game & Physics Helpers', () => {
  describe('snapToAngle & classifyAngle', () => {
    it('snaps angles cleanly to 15 degree discrete steps', () => {
      expect(snapToAngle(0, 15)).toBe(0);
      expect(snapToAngle(14, 15)).toBe(15);
      expect(snapToAngle(22, 15)).toBe(15);
      expect(snapToAngle(23, 15)).toBe(30);
      expect(snapToAngle(44, 15)).toBe(45);
      expect(snapToAngle(89, 15)).toBe(90);
      expect(snapToAngle(93, 15)).toBe(90);
      expect(snapToAngle(136, 15)).toBe(135);
    });

    it('classifies angles into acute, right, obtuse, and straight', () => {
      expect(classifyAngle(0)).toBe('straight');
      expect(classifyAngle(180)).toBe('straight');
      expect(classifyAngle(360)).toBe('straight');
      expect(classifyAngle(30)).toBe('acute');
      expect(classifyAngle(45)).toBe('acute');
      expect(classifyAngle(85)).toBe('acute');
      expect(classifyAngle(90)).toBe('right');
      expect(classifyAngle(89)).toBe('right');
      expect(classifyAngle(91)).toBe('right');
      expect(classifyAngle(105)).toBe('obtuse');
      expect(classifyAngle(135)).toBe('obtuse');
      expect(classifyAngle(150)).toBe('obtuse');
    });
  });

  describe('checkSegmentCollision', () => {
    it('detects collision when marble intersects segment interior', () => {
      const a = { x: 100, y: 200 };
      const b = { x: 300, y: 200 };
      const marble = { x: 200, y: 195 }; // 5px above horizontal segment
      const radius = 10;

      const res = checkSegmentCollision(marble, radius, a, b);
      expect(res.collided).toBe(true);
      expect(res.closestPoint.x).toBe(200);
      expect(res.closestPoint.y).toBe(200);
      expect(res.distance).toBeCloseTo(5, 2);
      expect(res.normal.x).toBeCloseTo(0, 2);
      expect(res.normal.y).toBeCloseTo(-1, 2); // normal pointing upwards to marble
    });

    it('reports no collision when marble is outside radius', () => {
      const a = { x: 100, y: 200 };
      const b = { x: 300, y: 200 };
      const marble = { x: 200, y: 150 }; // 50px away
      const radius = 10;

      const res = checkSegmentCollision(marble, radius, a, b);
      expect(res.collided).toBe(false);
      expect(res.distance).toBe(50);
    });

    it('clamps properly to segment endpoints', () => {
      const a = { x: 100, y: 100 };
      const b = { x: 200, y: 100 };
      // Marble to the left of A
      const marble = { x: 90, y: 100 };
      const res = checkSegmentCollision(marble, 12, a, b);
      expect(res.collided).toBe(true);
      expect(res.closestPoint.x).toBe(100);
      expect(res.closestPoint.y).toBe(100);
      expect(res.distance).toBe(10);
    });

    it('handles zero-length degenerate segment gracefully', () => {
      const a = { x: 50, y: 50 };
      const b = { x: 50, y: 50 };
      const marble = { x: 50, y: 54 };
      const res = checkSegmentCollision(marble, 10, a, b);
      expect(res.collided).toBe(true);
      expect(res.closestPoint.x).toBe(50);
      expect(res.closestPoint.y).toBe(50);
      expect(res.distance).toBe(4);
    });
  });

  describe('computeReflectionVelocity & calculateIncidenceAndReflectionAngles', () => {
    it('calculates reflection velocity with wood restitution (e=0.5)', () => {
      const v = { x: 0, y: 100 }; // falling straight down
      const normal = { x: 0, y: -1 }; // horizontal surface normal pointing up
      const eWood = 0.5;

      const vReflected = computeReflectionVelocity(v, normal, eWood, 0);
      expect(vReflected.x).toBe(0);
      expect(vReflected.y).toBeCloseTo(-50, 2); // normal velocity halved and inverted
    });

    it('calculates reflection velocity with trampoline restitution (e=0.9)', () => {
      const v = { x: 0, y: 100 };
      const normal = { x: 0, y: -1 };
      const eTrampoline = 0.9;

      const vReflected = computeReflectionVelocity(v, normal, eTrampoline, 0);
      expect(vReflected.x).toBe(0);
      expect(vReflected.y).toBeCloseTo(-90, 2); // 90% velocity preserved
    });

    it('applies tangential surface friction properly', () => {
      const v = { x: 100, y: 100 };
      const normal = { x: 0, y: -1 };
      const e = 0.8;
      const friction = 0.1;

      const vReflected = computeReflectionVelocity(v, normal, e, friction);
      expect(vReflected.x).toBeCloseTo(90, 2); // 100 * (1 - 0.1)
      expect(vReflected.y).toBeCloseTo(-80, 2); // -100 * 0.8
    });

    it('does not re-reflect if ball is moving away from the normal', () => {
      const v = { x: 50, y: -50 }; // moving upwards
      const normal = { x: 0, y: -1 }; // normal pointing up (v . n = 50 >= 0)

      const vOut = computeReflectionVelocity(v, normal, 0.9);
      expect(vOut.x).toBe(50);
      expect(vOut.y).toBe(-50);
    });

    it('calculates law of reflection angles correctly', () => {
      const vNormal = { x: 0, y: 100 };
      const nNormal = { x: 0, y: -1 };
      const angles1 = calculateIncidenceAndReflectionAngles(vNormal, nNormal);
      expect(angles1.incidenceDeg).toBe(0);
      expect(angles1.reflectionDeg).toBe(0);

      // 45 degree angle of incidence
      const v45 = { x: 100, y: 100 };
      const n45 = { x: 0, y: -1 };
      const angles2 = calculateIncidenceAndReflectionAngles(v45, n45);
      expect(angles2.incidenceDeg).toBe(45);
      expect(angles2.reflectionDeg).toBe(45);
    });
  });

  describe('createManipulative helper', () => {
    it('creates wood and trampoline manipulatives with accurate properties', () => {
      const wood = createManipulative('wood');
      expect(wood.type).toBe('wood');
      expect(wood.restitution).toBe(0.5);
      expect(wood.friction).toBe(0.05);

      const tramp = createManipulative('trampoline');
      expect(tramp.type).toBe('trampoline');
      expect(tramp.restitution).toBe(0.9);
      expect(tramp.friction).toBe(0.01);
    });
  });

  describe('generateLevelsForAge', () => {
    it('generates preschool levels for age "3-5" with snap mode', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.mode).toBe('snap');
        expect(lvl.slots.length).toBeGreaterThanOrEqual(1);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
        expect(lvl.emitter).toBeDefined();
        expect(lvl.cup).toBeDefined();
        // Fixed angles provided for preschool snap slots
        for (const slot of lvl.slots) {
          expect(slot.fixedAngle).toBeDefined();
        }
      }
    });

    it('generates elementary levels for age "6-8" with rotation and anti-mirroring pegs', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.mode).toBe('rotate');
        expect(lvl.antiMirroring).toBe(true);
        expect(lvl.obstacles).toBeDefined();
        expect(lvl.obstacles!.length).toBeGreaterThanOrEqual(2); // Obstacle pegs block straight fall
        expect(lvl.slots.length).toBeGreaterThanOrEqual(2);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('generates upper elementary levels for age "9-11" with reflection physics and trampolines', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.mode).toBe('reflection');
        expect(lvl.slots.length).toBeGreaterThanOrEqual(1);
        // Must contain at least one trampoline in inventory
        const hasTrampoline = lvl.inventory.some((i) => i.type === 'trampoline');
        expect(hasTrampoline).toBe(true);
      }
    });

    it('modulates distractors and target tolerance based on difficulty parameter', () => {
      const easy = generateLevelsForAge('3-5', 'easy');
      const hard = generateLevelsForAge('3-5', 'hard');
      expect(easy[0].inventory.length).toBeLessThan(hard[0].inventory.length);

      const easyElem = generateLevelsForAge('6-8', 'easy');
      const hardElem = generateLevelsForAge('6-8', 'hard');
      expect(easyElem[0].cup.width).toBeGreaterThan(hardElem[0].cup.width);
    });
  });

/**
 * Hardened simulation runner that executes stepPhysics, tracking manipulative collisions,
 * fixed wall reflections, obstacle peg strikes, settling time, and star collectibles.
 */
function simulateAndTrack(
  level: MarbleLevel,
  placed: { slotId: string; piece: Manipulative }[],
  maxSeconds: number = 8
) {
  const testLevel: MarbleLevel = {
    ...level,
    slots: level.slots.map((s) => {
      const match = placed.find((p) => p.slotId === s.id);
      return {
        ...s,
        placedPiece: match ? { ...match.piece } : null
      };
    }),
    stars: level.stars ? level.stars.map((st) => ({ ...st, collected: false })) : []
  };

  const marble: MarblePhysicsState = {
    x: level.emitter.x,
    y: level.emitter.y,
    vx: level.emitter.vx ?? 25,
    vy: level.emitter.vy ?? 0,
    radius: 10,
    active: true,
    inCup: false
  };

  let settlingTime = 0;
  let won = false;
  let manipulativeBounces = 0;
  let fixedWallBounces = 0;
  let trampolineBounces = 0;
  let woodBounces = 0;
  let starsCollected = 0;
  const bounceEvents: { type: PieceType | 'wall'; point: { x: number; y: number } }[] = [];

  const dt = 1 / 60;
  const totalFrames = Math.round(maxSeconds / dt);

  for (let frame = 0; frame < totalFrames; frame++) {
    stepPhysics(marble, testLevel, dt, {
      onStarCollect: (_star) => {
        starsCollected++;
      },
      onBounce: (point, _normal, _pieceType, _angleDeg) => {
        let onSlot = false;
        for (const slot of testLevel.slots) {
          if (slot.placedPiece) {
            const d = Math.hypot(point.x - slot.x, point.y - slot.y);
            if (d <= slot.placedPiece.length / 2 + 5) {
              onSlot = true;
              manipulativeBounces++;
              if (slot.placedPiece.type === 'trampoline') {
                trampolineBounces++;
                bounceEvents.push({ type: 'trampoline', point });
              } else {
                woodBounces++;
                bounceEvents.push({ type: 'wood', point });
              }
              break;
            }
          }
        }
        if (!onSlot && testLevel.fixedRamps) {
          for (const ramp of testLevel.fixedRamps) {
            const col = checkSegmentCollision(point, 5, { x: ramp.x1, y: ramp.y1 }, { x: ramp.x2, y: ramp.y2 });
            if (col.collided || col.distance <= 5) {
              fixedWallBounces++;
              bounceEvents.push({ type: 'wall', point });
              break;
            }
          }
        }
      }
    });

    if (marble.inCup) {
      settlingTime += dt;
      if (settlingTime >= 0.6) {
        won = true;
        break;
      }
    } else {
      settlingTime = 0;
    }

    if (marble.y > 540 || marble.x < -40 || marble.x > 840) {
      return {
        won: false,
        inCup: false,
        settlingTime,
        outOfBounds: true,
        finalX: marble.x,
        finalY: marble.y,
        manipulativeBounces,
        fixedWallBounces,
        trampolineBounces,
        woodBounces,
        starsCollected,
        stars: testLevel.stars || [],
        bounceEvents
      };
    }
  }

  return {
    won,
    inCup: marble.inCup,
    settlingTime,
    outOfBounds: false,
    finalX: marble.x,
    finalY: marble.y,
    manipulativeBounces,
    fixedWallBounces,
    trampolineBounces,
    woodBounces,
    starsCollected,
    stars: testLevel.stars || [],
    bounceEvents
  };
}

  describe('Anti-Cheat & Anti-Facade Invariants', () => {
    it('strictly prevents auto-win on empty board (simulateLevel with [] pieces) for all 9 default levels', () => {
      const ageGroups: AgeGroup[] = ['3-5', '6-8', '9-11'];
      for (const age of ageGroups) {
        const levels = generateLevelsForAge(age);
        for (const lvl of levels) {
          const res = simulateLevel(lvl, []);
          expect(res.won, `Level "${lvl.id}" must NOT be won on an empty board`).toBe(false);
          expect(res.inCup, `Level "${lvl.id}" marble must NOT enter cup on an empty board`).toBe(false);
          expect(res.outOfBounds, `Level "${lvl.id}" marble must fall out of bounds without placed manipulatives`).toBe(true);
        }
      }
    });

    it('strictly rejects distractor manipulatives across default levels', () => {
      // 1. preschool-1 distractor: 75° wood ramp (inventory[1])
      const p1 = generateLevelsForAge('3-5')[0];
      const resP1 = simulateLevel(p1, [{ slotId: p1.slots[0].id, piece: p1.inventory[1] }]);
      expect(resP1.won, 'preschool-1 distractor piece (75°) must fail').toBe(false);

      // 2. preschool-2 distractor: 80° wood ramp in slot-2 (inventory[2])
      const p2 = generateLevelsForAge('3-5')[1];
      const resP2 = simulateLevel(p2, [
        { slotId: p2.slots[0].id, piece: p2.inventory[0] },
        { slotId: p2.slots[1].id, piece: p2.inventory[2] }
      ]);
      expect(resP2.won, 'preschool-2 distractor piece (80°) must fail').toBe(false);

      // 3. preschool-3 distractor: 90° wood ramp in slot-2 (inventory[2])
      const p3 = generateLevelsForAge('3-5')[2];
      const resP3 = simulateLevel(p3, [
        { slotId: p3.slots[0].id, piece: p3.inventory[0] },
        { slotId: p3.slots[1].id, piece: p3.inventory[2] }
      ]);
      expect(resP3.won, 'preschool-3 distractor piece (90°) must fail').toBe(false);

      // 4-5. (6-8 levels have no distractors: pieces are rotatable, so any ramp can be turned to any angle.)

      // 6. upper-1 distractor: wood ramp in place of trampoline (inventory[1]) fails to clear chasm
      const u1 = generateLevelsForAge('9-11')[0];
      const resU1 = simulateLevel(u1, [{ slotId: u1.slots[0].id, piece: u1.inventory[1] }]);
      expect(resU1.won, 'upper-1 wood distractor must absorb bounce and fail to clear chasm').toBe(false);

      // 7. upper-2 distractor: wood ramp in place of trampoline in slot-1 (inventory[2])
      const u2 = generateLevelsForAge('9-11')[1];
      const resU2 = simulateLevel(u2, [
        { slotId: u2.slots[0].id, piece: u2.inventory[2] },
        { slotId: u2.slots[1].id, piece: u2.inventory[1] }
      ]);
      expect(resU2.won, 'upper-2 wood distractor in slot 1 must fail to reach the wall').toBe(false);

      // 8. upper-3 distractor: wood ramp in place of trampoline in slot-2 (inventory[2])
      const u3 = generateLevelsForAge('9-11')[2];
      const resU3 = simulateLevel(u3, [
        { slotId: u3.slots[0].id, piece: u3.inventory[0] },
        { slotId: u3.slots[1].id, piece: u3.inventory[2] }
      ]);
      expect(resU3.won, 'upper-3 wood distractor must absorb bounce and fail').toBe(false);
    });
  });

  describe('Default Levels Guaranteed Solvability & Physical Interaction', () => {
    it('solves all preschool levels (3-5) with intended pieces, verifying settling time and manipulatives interaction', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);

      // Level 1: Downhill Slide (1 snap slot)
      const lvl1 = levels[0];
      const placed1 = [{ slotId: lvl1.slots[0].id, piece: lvl1.inventory[0] }];
      const res1 = simulateLevel(lvl1, placed1);
      expect(res1.won).toBe(true);
      expect(res1.inCup).toBe(true);
      expect(res1.outOfBounds).toBe(false);
      expect(res1.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track1 = simulateAndTrack(lvl1, placed1);
      expect(track1.manipulativeBounces).toBeGreaterThan(0);
      expect(track1.starsCollected).toBe(lvl1.stars ? lvl1.stars.length : 1);
      track1.stars.forEach((st) => expect(st.collected).toBe(true));

      // Level 2: Two Bridge Steps (2 snap slots)
      const lvl2 = levels[1];
      const placed2 = [
        { slotId: lvl2.slots[0].id, piece: lvl2.inventory[0] },
        { slotId: lvl2.slots[1].id, piece: lvl2.inventory[1] }
      ];
      const res2 = simulateLevel(lvl2, placed2);
      expect(res2.won).toBe(true);
      expect(res2.inCup).toBe(true);
      expect(res2.outOfBounds).toBe(false);
      expect(res2.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track2 = simulateAndTrack(lvl2, placed2);
      expect(track2.manipulativeBounces).toBeGreaterThan(0);
      expect(track2.starsCollected).toBe(2);
      track2.stars.forEach((st) => expect(st.collected).toBe(true));

      // Level 3: Zigzag Bounce (2 snap slots with direction reversal)
      const lvl3 = levels[2];
      const placed3 = [
        { slotId: lvl3.slots[0].id, piece: lvl3.inventory[0] },
        { slotId: lvl3.slots[1].id, piece: lvl3.inventory[1] }
      ];
      const res3 = simulateLevel(lvl3, placed3);
      expect(res3.won).toBe(true);
      expect(res3.inCup).toBe(true);
      expect(res3.outOfBounds).toBe(false);
      expect(res3.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track3 = simulateAndTrack(lvl3, placed3);
      expect(track3.manipulativeBounces).toBeGreaterThan(0);
      expect(track3.starsCollected).toBe(2);
      track3.stars.forEach((st) => expect(st.collected).toBe(true));
    });

    it('solves all elementary levels (6-8) with intended angles, verifying anti-mirroring obstacle pegs and full star collection', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);

      // Verify anti-mirroring obstacle pegs across all elementary levels
      for (const lvl of levels) {
        expect(lvl.mode).toBe('rotate');
        expect(lvl.antiMirroring).toBe(true);
        expect(lvl.obstacles).toBeDefined();
        expect(lvl.obstacles!.length).toBeGreaterThanOrEqual(2);
      }

      // Level 1: Around the Pegs (2 rotated slots)
      const lvl1 = levels[0];
      const placed1 = [
        { slotId: lvl1.slots[0].id, piece: lvl1.inventory[0] },
        { slotId: lvl1.slots[1].id, piece: lvl1.inventory[1] }
      ];
      const res1 = simulateLevel(lvl1, placed1);
      expect(res1.won).toBe(true);
      expect(res1.inCup).toBe(true);
      expect(res1.outOfBounds).toBe(false);
      expect(res1.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track1 = simulateAndTrack(lvl1, placed1);
      expect(track1.manipulativeBounces).toBeGreaterThan(0);
      expect(track1.starsCollected).toBe(2);
      track1.stars.forEach((st) => expect(st.collected).toBe(true));

      // Level 2: Double Deflection (2 rotated slots)
      const lvl2 = levels[1];
      const placed2 = [
        { slotId: lvl2.slots[0].id, piece: lvl2.inventory[0] },
        { slotId: lvl2.slots[1].id, piece: lvl2.inventory[1] }
      ];
      const res2 = simulateLevel(lvl2, placed2);
      expect(res2.won).toBe(true);
      expect(res2.inCup).toBe(true);
      expect(res2.outOfBounds).toBe(false);
      expect(res2.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track2 = simulateAndTrack(lvl2, placed2);
      expect(track2.manipulativeBounces).toBeGreaterThan(0);
      expect(track2.starsCollected).toBe(2);
      track2.stars.forEach((st) => expect(st.collected).toBe(true));

      // Level 3: Slalom Maze (3 rotated slots)
      const lvl3 = levels[2];
      const placed3 = [
        { slotId: lvl3.slots[0].id, piece: lvl3.inventory[0] },
        { slotId: lvl3.slots[1].id, piece: lvl3.inventory[1] },
        { slotId: lvl3.slots[2].id, piece: lvl3.inventory[2] }
      ];
      const res3 = simulateLevel(lvl3, placed3);
      expect(res3.won).toBe(true);
      expect(res3.inCup).toBe(true);
      expect(res3.outOfBounds).toBe(false);
      expect(res3.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track3 = simulateAndTrack(lvl3, placed3);
      expect(track3.manipulativeBounces).toBeGreaterThan(0);
      expect(track3.starsCollected).toBe(3);
      track3.stars.forEach((st) => expect(st.collected).toBe(true));
    });

    it('solves all upper elementary levels (9-11) with reflection physics and trampolines, asserting genuine wall ricochet', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);

      // Level 1: The Great Chasm (45° trampoline bounce across chasm)
      const lvl1 = levels[0];
      const placed1 = [{ slotId: lvl1.slots[0].id, piece: lvl1.inventory[0] }];
      const res1 = simulateLevel(lvl1, placed1);
      expect(res1.won).toBe(true);
      expect(res1.inCup).toBe(true);
      expect(res1.outOfBounds).toBe(false);
      expect(res1.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track1 = simulateAndTrack(lvl1, placed1);
      expect(track1.trampolineBounces).toBeGreaterThan(0);
      expect(track1.starsCollected).toBe(2);
      track1.stars.forEach((st) => expect(st.collected).toBe(true));

      // Level 2: Wall Ricochet (trampoline + wall rebound + wood guide)
      const lvl2 = levels[1];
      const placed2 = [
        { slotId: lvl2.slots[0].id, piece: lvl2.inventory[0] },
        { slotId: lvl2.slots[1].id, piece: lvl2.inventory[1] }
      ];
      const res2 = simulateLevel(lvl2, placed2);
      expect(res2.won).toBe(true);
      expect(res2.inCup).toBe(true);
      expect(res2.outOfBounds).toBe(false);
      expect(res2.settlingTime).toBeGreaterThanOrEqual(0.6);

      // CRITICAL HARDENED VERIFICATION FOR UPPER-2:
      const track2 = simulateAndTrack(lvl2, placed2);
      expect(track2.trampolineBounces, 'upper-2 must bounce off slot-1 trampoline').toBeGreaterThan(0);
      expect(track2.fixedWallBounces, 'upper-2 must reflect off fixed vertical wall').toBeGreaterThan(0);
      expect(track2.woodBounces, 'upper-2 must hit slot-2 wood ramp to enter cup').toBeGreaterThan(0);
      expect(track2.starsCollected, 'upper-2 must collect all 3 stars along reflection path').toBe(3);
      track2.stars.forEach((st) => expect(st.collected).toBe(true));

      // Verify physical sequence of collisions: trampoline -> wall -> wood
      const eventTypes = track2.bounceEvents.map((e) => e.type);
      const trampIdx = eventTypes.indexOf('trampoline');
      const wallIdx = eventTypes.indexOf('wall');
      const woodIdx = eventTypes.indexOf('wood');
      expect(trampIdx, 'trampoline must be hit before wall').toBeLessThan(wallIdx);
      expect(wallIdx, 'wall must be hit before wood ramp').toBeLessThan(woodIdx);

      // Level 3: Double Trampoline Arc (two trampolines in succession)
      const lvl3 = levels[2];
      const placed3 = [
        { slotId: lvl3.slots[0].id, piece: lvl3.inventory[0] },
        { slotId: lvl3.slots[1].id, piece: lvl3.inventory[1] }
      ];
      const res3 = simulateLevel(lvl3, placed3);
      expect(res3.won).toBe(true);
      expect(res3.inCup).toBe(true);
      expect(res3.outOfBounds).toBe(false);
      expect(res3.settlingTime).toBeGreaterThanOrEqual(0.6);

      const track3 = simulateAndTrack(lvl3, placed3);
      expect(track3.trampolineBounces).toBeGreaterThanOrEqual(2);
      expect(track3.starsCollected).toBe(2);
      track3.stars.forEach((st) => expect(st.collected).toBe(true));
    });
  });

  describe('6-8 rotation is required (issue #15)', () => {
    it('default slot start angles do NOT solve any 6-8 level, but the documented rotation solution does', () => {
      const levels = generateLevelsForAge('6-8');
      for (const lvl of levels) {
        const asDropped = lvl.slots.map((slot, i) => ({
          slotId: slot.id,
          piece: { ...lvl.inventory[i], angleDeg: slot.initialAngle! }
        }));
        expect(simulateLevel(lvl, asDropped).won, `${lvl.id} must not win at start angles`).toBe(false);

        const solved = lvl.slots.map((slot, i) => ({
          slotId: slot.id,
          piece: { ...lvl.inventory[i], angleDeg: slot.solutionAngle! }
        }));
        expect(simulateLevel(lvl, solved).won, `${lvl.id} must win at documented angles`).toBe(true);

        // Every slot needs 15-90 degrees of forward rotation in 15 degree steps
        for (const slot of lvl.slots) {
          const need = (((slot.solutionAngle! - slot.initialAngle!) % 180) + 180) % 180;
          expect(need).toBeGreaterThanOrEqual(15);
          expect(need).toBeLessThanOrEqual(90);
          expect(need % 15).toBe(0);
        }
      }
    });

    it('snap-mode custom inventory without own angle defaults to the slot fixedAngle', () => {
      const parsed = parseCustomLevels([
        {
          emitter: { x: 10, y: 10 },
          cup: { x: 500, y: 300 },
          slots: [{ x: 100, y: 100, fixedAngle: 40 }],
          inventory: ['wood', { type: 'wood', angleDeg: 80 }]
        }
      ])!;
      expect(parsed[0].inventory[0].angleDeg).toBe(40);
      expect(parsed[0].inventory[1].angleDeg).toBe(80);
    });
  });

  describe('parseCustomLevels defensive null-guarding', () => {
    it('returns null on null, undefined, empty, or invalid JSON', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels('not a json string')).toBeNull();
      expect(parseCustomLevels({})).toBeNull();
    });

    it('gracefully handles null and corrupted items in obstacles, fixedRamps, slots, and inventory', () => {
      const corrupted = [
        {
          emitter: { x: 100, y: 50 },
          cup: { x: 500, y: 400 },
          obstacles: [null, undefined, {}, { x: 150, y: 200, radius: 10 }],
          fixedRamps: [null, undefined, {}, { x1: 50, y1: 50, x2: 150, y2: 100 }],
          slots: [null, undefined, {}, { x: 200, y: 200 }],
          inventory: [null, undefined, 'not-a-piece', 'wood']
        }
      ];

      expect(() => parseCustomLevels(corrupted)).not.toThrow();
      const parsed = parseCustomLevels(corrupted);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      const lvl = parsed![0];
      expect(lvl.obstacles).toHaveLength(1);
      expect(lvl.fixedRamps).toHaveLength(1);
      expect(lvl.slots).toHaveLength(1);
      expect(lvl.inventory).toHaveLength(1);
    });

    it('parses valid custom levels from array and JSON string', () => {
      const raw = [
        {
          id: 'custom-1',
          title: 'Custom Bounce',
          mode: 'reflection',
          emitter: { x: 100, y: 50 },
          cup: { x: 500, y: 400, width: 80, height: 50 },
          slots: [{ x: 200, y: 150 }],
          inventory: ['wood', 'trampoline'],
          stars: [{ x: 300, y: 250 }],
          obstacles: [{ x: 250, y: 200, radius: 18 }]
        }
      ];

      const parsed = parseCustomLevels(raw);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(1);
      const lvl = parsed![0];
      expect(lvl.id).toBe('custom-1');
      expect(lvl.title).toBe('Custom Bounce');
      expect(lvl.mode).toBe('reflection');
      expect(lvl.emitter.x).toBe(100);
      expect(lvl.cup.width).toBe(80);
      expect(lvl.slots).toHaveLength(1);
      expect(lvl.inventory).toHaveLength(2);
      expect(lvl.inventory[0].type).toBe('wood');
      expect(lvl.inventory[1].type).toBe('trampoline');
      expect(lvl.stars).toHaveLength(1);
      expect(lvl.obstacles).toHaveLength(1);

      // JSON string parsing
      const jsonStr = JSON.stringify(raw);
      const parsedFromJson = parseCustomLevels(jsonStr);
      expect(parsedFromJson).not.toBeNull();
      expect(parsedFromJson).toHaveLength(1);
    });

    it('rejects malformed levels lacking emitter or cup', () => {
      const invalid = [
        { title: 'No Emitter', cup: { x: 100, y: 100 } },
        { title: 'No Cup', emitter: { x: 50, y: 50 } }
      ];
      expect(parseCustomLevels(invalid)).toBeNull();
    });
  });

  describe('MarbleRunAnglesGame DOM Lifecycle & Interactions', () => {
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
        setLineDash: vi.fn()
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

      // Verify DOM HUD elements
      expect(container.querySelector('#hud-title')?.textContent).toContain('Marble Run Angles');
      expect(container.querySelector('#level-badge')?.textContent).toContain('Level 1/3');
      expect(container.querySelector('#btn-launch')).toBeDefined();
      expect(container.querySelector('#btn-sound-toggle')).toBeDefined();

      // Verify game:progress event emission
      const progressEvt = emittedEvents.find((e) => e.type === 'game:progress');
      expect(progressEvt).toBeDefined();

      game.start();
      game.pause?.();
      game.resume?.();

      // Test dynamic locale update
      game.updateConfig?.({ locale: 'fr', sound: true });
      expect(container.querySelector('#hud-title')?.textContent).toContain('Parcours à Billes & Angles');
      expect(container.querySelector('#btn-sound-toggle')?.textContent).toContain('Son ACTIVÉ');

      // Test dynamic ageGroup update
      game.updateConfig?.({ ageGroup: '9-11' });
      expect(container.querySelector('#level-badge')?.textContent).toContain('1/3');

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

      // Resuming schedules 1 active loop
      game.resume?.();
      expect(activeRafs.size).toBe(1);

      // Destroy cancels all pending animation frames and sets isPaused
      game.destroy();
      expect(activeRafs.size).toBe(0);
      document.body.removeChild(container);
    });

    it('handles launch button, sound toggle, and clear pieces button clicks', () => {
      const game = createMarbleRunAnglesGame() as MarbleRunAnglesGame;
      game.mount(container, context);

      const soundBtn = container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
      expect(soundBtn.textContent).toContain('Sound OFF');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound ON');
      soundBtn.click();
      expect(soundBtn.textContent).toContain('Sound OFF');

      const launchBtn = container.querySelector('#btn-launch') as HTMLButtonElement;
      expect(launchBtn).toBeDefined();
      launchBtn.click(); // Launches marble

      const resetMarbleBtn = container.querySelector('#btn-reset-marble') as HTMLButtonElement;
      resetMarbleBtn.click(); // Resets marble

      const clearBtn = container.querySelector('#btn-clear-pieces') as HTMLButtonElement;
      clearBtn.click(); // Clears placed pieces

      game.destroy();
      document.body.removeChild(container);
    });

    it('snaps item from tray to slot on tray click and clears pieces properly', () => {
      const game = createMarbleRunAnglesGame() as MarbleRunAnglesGame;
      game.mount(container, context);

      const tray = container.querySelector('#inventory-tray') as HTMLDivElement;
      const initialCount = tray.children.length;
      expect(initialCount).toBeGreaterThan(0);

      // Click first item in tray to snap it to slot
      const firstPiece = tray.firstElementChild as HTMLElement;
      firstPiece.click();

      // Tray should have one less item
      expect(tray.children.length).toBe(initialCount - 1);

      // Click clear pieces to restore all items to tray
      const clearBtn = container.querySelector('#btn-clear-pieces') as HTMLButtonElement;
      clearBtn.click();
      expect(tray.children.length).toBe(initialCount);

      game.destroy();
      document.body.removeChild(container);
    });
    // --- Real pointer input helpers (issue #14): dispatch events like a browser would ---
    const fire = (target: EventTarget, type: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
      Object.assign(ev, extra);
      target.dispatchEvent(ev);
    };
    const tap = (el: Element, x = 400, y = 600, pointerType = 'mouse') => {
      fire(el, 'pointerdown', x, y, { pointerType });
      fire(el, 'pointerup', x, y, { pointerType });
      if (pointerType === 'touch') {
        el.dispatchEvent(new Event('touchstart', { bubbles: true }));
        el.dispatchEvent(new Event('touchend', { bubbles: true }));
      }
      // The browser dispatches click only when the pressed element survived pointerup
      if (el.isConnected) fire(el, 'click', x, y);
    };
    const drag = (el: Element, to: { x: number; y: number }, from = { x: 400, y: 600 }) => {
      fire(el, 'pointerdown', from.x, from.y);
      fire(window, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
      fire(window, 'pointermove', to.x, to.y);
      fire(window, 'pointerup', to.x, to.y);
      if (el.isConnected) fire(el, 'click', to.x, to.y);
    };
    const mountGame = (age: AgeGroup, locale: 'en' | 'fr' = 'en') => {
      context.ageGroup = age;
      context.locale = locale;
      const game = createMarbleRunAnglesGame() as MarbleRunAnglesGame;
      game.mount(container, context);
      return game;
    };
    const lvlOf = (game: MarbleRunAnglesGame) => {
      const g = game as any;
      return g.levels[g.currentLevelIndex] as MarbleLevel;
    };
    const tapFirst = (c: HTMLElement) => {
      tap(c.querySelector('#inventory-tray')!.firstElementChild as HTMLElement);
    };

    it('real tap (pointerdown, pointerup, click) on a tray item snaps it into the first slot without losing the click', () => {
      for (const pointerType of ['mouse', 'touch']) {
        const game = mountGame('3-5');
        const tray = container.querySelector('#inventory-tray') as HTMLElement;
        const count = tray.children.length;
        const item = tray.firstElementChild as HTMLElement;

        fire(item, 'pointerdown', 400, 600, { pointerType });
        fire(item, 'pointerup', 400, 600, { pointerType });
        // pointerup must not rebuild the tray: the pressed element has to survive until click
        expect(item.isConnected).toBe(true);
        fire(item, 'click', 400, 600);

        expect(tray.children.length).toBe(count - 1);
        const lvl = lvlOf(game);
        expect(lvl.slots[0].placedPiece).not.toBeNull();
        // The piece keeps its own angle (slot no longer overwrites it)
        expect(lvl.slots[0].placedPiece!.angleDeg).toBe(23);
        game.destroy();
        container.innerHTML = '';
      }
    });

    it('3-5: a distractor keeps its own angle when placed (no silent overwrite)', () => {
      const game = mountGame('3-5');
      const tray = container.querySelector('#inventory-tray') as HTMLElement;
      tap(tray.children[1]); // 75 degree distractor
      const lvl = lvlOf(game);
      expect(lvl.slots[0].placedPiece!.angleDeg).toBe(75);
      expect(simulateLevel(lvl, [{ slotId: lvl.slots[0].id, piece: lvl.slots[0].placedPiece! }]).won).toBe(false);
      game.destroy();
    });

    it('real drag from the tray drops on the nearest slot within the snap radius', () => {
      const game = mountGame('3-5');
      const tray = container.querySelector('#inventory-tray') as HTMLElement;
      const count = tray.children.length;
      const slot = lvlOf(game).slots[0];
      drag(tray.firstElementChild as HTMLElement, { x: slot.x + 30, y: slot.y - 20 });
      expect(lvlOf(game).slots[0].placedPiece).not.toBeNull();
      expect(tray.children.length).toBe(count - 1);
      expect(lvlOf(game).slots.filter((s) => s.placedPiece).length).toBe(1);
      game.destroy();
    });

    it('dropping a tray piece outside every slot returns it to the tray', () => {
      const game = mountGame('3-5');
      const tray = container.querySelector('#inventory-tray') as HTMLElement;
      const count = tray.children.length;
      drag(tray.firstElementChild as HTMLElement, { x: 760, y: 40 });
      expect(lvlOf(game).slots[0].placedPiece).toBeNull();
      expect(tray.children.length).toBe(count);
      game.destroy();
    });

    it('placed pieces can be picked up again via real canvas pointer events (granular undo)', () => {
      const game = mountGame('3-5');
      const canvas = container.querySelector('#marble-canvas') as HTMLCanvasElement;
      const tray = container.querySelector('#inventory-tray') as HTMLElement;
      tapFirst(container);
      const slot = lvlOf(game).slots[0];
      expect(slot.placedPiece).not.toBeNull();
      fire(canvas, 'pointerdown', slot.x, slot.y);
      fire(window, 'pointerup', slot.x, slot.y);
      expect(slot.placedPiece).toBeNull();
      expect(tray.children.length).toBeGreaterThan(0);
      game.destroy();
    });

    it('pointer events outside the game never reset a running marble', () => {
      const game = mountGame('3-5');
      const g = game as any;
      g.launchMarble();
      g.updatePhysics(1 / 60);
      expect(g.marble.active).toBe(true);
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      fire(outside, 'pointerdown', 5, 5);
      fire(outside, 'pointerup', 5, 5);
      fire(window, 'pointerup', 5, 5);
      expect(g.marble.active).toBe(true);
      // Tapping an empty canvas area does not reset it either
      const canvas = container.querySelector('#marble-canvas') as HTMLCanvasElement;
      fire(canvas, 'pointerdown', 700, 20);
      fire(window, 'pointerup', 700, 20);
      expect(g.marble.active).toBe(true);
      outside.remove();
      game.destroy();
    });

    it('enforces allowedTypes for tap and drag (wood cannot enter a trampoline-only slot)', () => {
      const game = mountGame('9-11');
      (game as any).loadLevel(1); // Wall Ricochet: slot-1 is trampoline-only
      const lvl = lvlOf(game);
      const tray = container.querySelector('#inventory-tray') as HTMLElement;
      const woodItem = () =>
        Array.from(tray.children).find((el) => el.textContent === DICTIONARY.en.woodRamp) as HTMLElement;

      // Drag wood onto the trampoline-only slot: rejected
      drag(woodItem(), { x: lvl.slots[0].x, y: lvl.slots[0].y });
      expect(lvl.slots[0].placedPiece).toBeNull();
      expect(lvl.slots[1].placedPiece).toBeNull();

      // Tap wood: first slot that ACCEPTS it (slot-2)
      tap(woodItem());
      expect(lvl.slots[0].placedPiece).toBeNull();
      expect(lvl.slots[1].placedPiece?.type).toBe('wood');

      // Tap the second wood: only the trampoline-only slot is empty, so it is refused
      tap(woodItem());
      expect(lvl.slots[0].placedPiece).toBeNull();

      // Trampoline goes into slot-1
      const tramp = Array.from(tray.children).find((el) => el.textContent === DICTIONARY.en.trampoline) as HTMLElement;
      tap(tramp);
      expect(lvl.slots[0].placedPiece?.type).toBe('trampoline');
      game.destroy();
    });

    it('6-8: dropped pieces start at the slot start angle and need real rotation taps to win', () => {
      const game = mountGame('6-8');
      const canvas = container.querySelector('#marble-canvas') as HTMLCanvasElement;
      const lvl = lvlOf(game);
      tapFirst(container);
      tapFirst(container);
      expect(lvl.slots.map((s) => s.placedPiece!.angleDeg)).toEqual(lvl.slots.map((s) => s.initialAngle));
      // Rotate each piece with real canvas taps on the piece
      for (const slot of lvl.slots) {
        let guard = 0;
        while (slot.placedPiece!.angleDeg !== slot.solutionAngle && guard++ < 12) {
          fire(canvas, 'pointerdown', slot.x, slot.y);
          fire(window, 'pointerup', slot.x, slot.y);
        }
      }
      expect(lvl.slots.map((s) => s.placedPiece!.angleDeg)).toEqual(lvl.slots.map((s) => s.solutionAngle));
      const placed = lvl.slots.map((s) => ({ slotId: s.id, piece: s.placedPiece! }));
      expect(simulateLevel(lvl, placed).won).toBe(true);
      game.destroy();
    });

    it('shows a localized hint and resets when the marble falls off the board (all age brackets)', () => {
      const expected = {
        '3-5': 'hintMissPreschool',
        '6-8': 'hintMissElementary',
        '9-11': 'hintMissUpperElementary'
      } as const;
      for (const locale of ['en', 'fr'] as const) {
        for (const age of ['3-5', '6-8', '9-11'] as AgeGroup[]) {
          const game = mountGame(age, locale);
          const g = game as any;
          g.launchMarble();
          let steps = 0;
          while (g.marble.active && steps++ < 1200) g.updatePhysics(1 / 30);
          expect(g.marble.active).toBe(false);
          const inst = container.querySelector('#instruction')!.textContent;
          expect(inst).toBe(DICTIONARY[locale][expected[age]]);
          // Changing something clears the hint
          g.clearPlacedPieces();
          expect(container.querySelector('#instruction')!.textContent).not.toBe(inst);
          game.destroy();
          container.innerHTML = '';
        }
      }
    });

    it('detects a stalled marble after ~2 s with fake timers and resets with a hint', () => {
      vi.useFakeTimers();
      try {
        context.customLevels = [
          {
            emitter: { x: 200, y: 150, vx: 0, vy: 0 },
            cup: { x: 700, y: 400 },
            mode: 'reflection',
            fixedRamps: [{ x1: 50, y1: 300, x2: 400, y2: 300, restitution: 0 }],
            slots: [],
            inventory: []
          }
        ] as any;
        const game = mountGame('9-11');
        const g = game as any;
        g.launchMarble();
        let t = 0;
        while (g.marble.active && t < 15) {
          g.updatePhysics(1 / 60);
          t += 1 / 60;
          vi.advanceTimersByTime(16);
        }
        expect(g.marble.active).toBe(false);
        expect(t).toBeLessThan(10);
        expect(container.querySelector('#instruction')!.textContent).toBe(DICTIONARY.en.hintStalled);
        game.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('no English strings remain in FR mode for tray and HUD, and a live locale change updates them', () => {
      for (const age of ['3-5', '6-8', '9-11'] as AgeGroup[]) {
        const game = mountGame(age, 'en');
        game.updateConfig({ locale: 'fr' });
        const fr = DICTIONARY.fr;
        const labels = Array.from(container.querySelectorAll('#inventory-tray > div')).map((el) => el.textContent);
        for (const l of labels) expect([fr.woodRamp, fr.trampoline]).toContain(l);
        const inst = container.querySelector('#instruction')!.textContent!;
        expect([fr.promptPreschool, fr.promptElementary, fr.promptUpperElementary]).toContain(inst);
        game.destroy();
        container.innerHTML = '';
      }
      // Selected-piece instructions are localized too
      const game = mountGame('6-8', 'fr');
      tapFirst(container);
      expect(container.querySelector('#instruction')!.textContent).toMatch(/^Angle :/);
      game.destroy();
    });

    it('resets score, streak and timer when ageGroup changes (issue #17)', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
        const game = mountGame('3-5');
        const g = game as any;
        g.score = 550;
        g.streak = 3;
        g.updateStaticHUD();
        expect(container.querySelector('#score-display')!.textContent).toBe('⭐ 550');

        vi.setSystemTime(new Date('2026-01-01T10:05:00Z'));
        game.updateConfig({ ageGroup: '6-8' });
        expect(g.score).toBe(0);
        expect(g.streak).toBe(0);
        expect(g.startTime).toBe(Date.now());
        expect(container.querySelector('#score-display')!.textContent).toBe('⭐ 0');

        // Re-sending the same ageGroup must not wipe progress
        g.score = 100;
        game.updateConfig({ ageGroup: '6-8' });
        expect(g.score).toBe(100);
        game.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('reserves a fixed HUD instruction height so the canvas cannot resize (issue #17)', () => {
      const game = mountGame('3-5');
      const inst = container.querySelector('#instruction') as HTMLElement;
      expect(inst.style.height).not.toBe('');
      const before = inst.style.height;
      tapFirst(container);
      expect(inst.style.height).toBe(before);
      game.destroy();
    });
  });
});
