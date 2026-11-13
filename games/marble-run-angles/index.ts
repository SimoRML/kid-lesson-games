import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup } from '../../src/core/types.js';
import type { SoundEngine } from '../../src/core/audio.js';
import { getTranslations, type Translations, type SupportedLocale } from './i18n.js';

// --- Type Definitions ---

export type PieceType = 'wood' | 'trampoline';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Manipulative {
  id: string;
  type: PieceType;
  length: number;
  angleDeg: number;
  restitution: number;
  friction: number;
  color: string;
  label: string;
}

export interface Slot {
  id: string;
  x: number;
  y: number;
  allowedTypes?: PieceType[];
  fixedAngle?: number;
  initialAngle?: number;
  placedPiece: Manipulative | null;
}

export interface FixedRamp {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: PieceType;
  restitution: number;
  friction: number;
}

export interface ObstaclePeg {
  x: number;
  y: number;
  radius: number;
}

export interface StarCollectible {
  id: string;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface TargetCup {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarbleLevel {
  id: string;
  title?: string;
  mode: 'snap' | 'rotate' | 'reflection';
  instruction?: string;
  emitter: { x: number; y: number; vx?: number; vy?: number };
  cup: TargetCup;
  slots: Slot[];
  inventory: Manipulative[];
  fixedRamps?: FixedRamp[];
  obstacles?: ObstaclePeg[];
  stars?: StarCollectible[];
  antiMirroring?: boolean;
}

export interface CustomLevelConfig {
  id?: string;
  title?: string;
  mode?: 'snap' | 'rotate' | 'reflection';
  instruction?: string;
  emitter?: { x: number; y: number; vx?: number; vy?: number };
  cup?: { x: number; y: number; width?: number; height?: number };
  slots?: {
    id?: string;
    x: number;
    y: number;
    allowedTypes?: PieceType[];
    fixedAngle?: number;
    initialAngle?: number;
  }[];
  inventory?: (
    | PieceType
    | {
        id?: string;
        type: PieceType;
        length?: number;
        angleDeg?: number;
        restitution?: number;
      }
  )[];
  fixedRamps?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type?: PieceType;
    restitution?: number;
  }[];
  obstacles?: { x: number; y: number; radius?: number }[];
  stars?: { x: number; y: number }[];
}

export interface SegmentCollisionResult {
  collided: boolean;
  closestPoint: Vector2D;
  distance: number;
  normal: Vector2D;
}

// --- Pure Physics & Mathematical Helpers ---

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function snapToAngle(angleDeg: number, stepDeg: number = 15): number {
  return Math.round(angleDeg / stepDeg) * stepDeg;
}

export function classifyAngle(angleDeg: number): 'acute' | 'right' | 'obtuse' | 'straight' {
  const norm = Math.abs(angleDeg % 180);
  if (norm >= 87 && norm <= 93) {
    return 'right';
  }
  if (norm > 0 && norm < 87) {
    return 'acute';
  }
  if (norm > 93 && norm < 177) {
    return 'obtuse';
  }
  return 'straight';
}

export function checkSegmentCollision(
  p: Vector2D,
  radius: number,
  a: Vector2D,
  b: Vector2D
): SegmentCollisionResult {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lenSq = abX * abX + abY * abY;

  if (lenSq === 0) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0.0001 ? dx / dist : 0;
    const ny = dist > 0.0001 ? dy / dist : -1;
    return {
      collided: dist <= radius,
      closestPoint: { x: a.x, y: a.y },
      distance: dist,
      normal: { x: nx, y: ny }
    };
  }

  const t = clamp(((p.x - a.x) * abX + (p.y - a.y) * abY) / lenSq, 0, 1);
  const closestX = a.x + t * abX;
  const closestY = a.y + t * abY;
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let nx: number;
  let ny: number;
  if (dist > 0.0001) {
    nx = dx / dist;
    ny = dy / dist;
  } else {
    // Marble directly on the line; use normal perpendicular to segment
    const segLen = Math.sqrt(lenSq);
    nx = -abY / segLen;
    ny = abX / segLen;
  }

  return {
    collided: dist <= radius,
    closestPoint: { x: closestX, y: closestY },
    distance: dist,
    normal: { x: nx, y: ny }
  };
}

export function computeReflectionVelocity(
  v: Vector2D,
  normal: Vector2D,
  restitution: number,
  friction: number = 0.03
): Vector2D {
  const vn = v.x * normal.x + v.y * normal.y;
  // If moving away from the normal, do not reflect again
  if (vn >= 0) {
    return { x: v.x, y: v.y };
  }

  // Tangential velocity
  const vtX = v.x - vn * normal.x;
  const vtY = v.y - vn * normal.y;

  // Reflected components
  const vnPrime = -restitution * vn;
  const frictionFactor = Math.max(0, 1 - friction);
  const vtPrimeX = vtX * frictionFactor;
  const vtPrimeY = vtY * frictionFactor;

  return {
    x: vtPrimeX + vnPrime * normal.x,
    y: vtPrimeY + vnPrime * normal.y
  };
}

export function calculateIncidenceAndReflectionAngles(
  v: Vector2D,
  normal: Vector2D
): { incidenceDeg: number; reflectionDeg: number } {
  const vSpeed = Math.sqrt(v.x * v.x + v.y * v.y);
  if (vSpeed < 0.0001) {
    return { incidenceDeg: 0, reflectionDeg: 0 };
  }

  // Vector pointing into the surface
  const inVx = -v.x / vSpeed;
  const inVy = -v.y / vSpeed;
  const cosTheta = clamp(inVx * normal.x + inVy * normal.y, -1, 1);
  const thetaRad = Math.acos(cosTheta);
  const thetaDeg = Math.round((thetaRad * 180) / Math.PI);

  return {
    incidenceDeg: thetaDeg,
    reflectionDeg: thetaDeg
  };
}

export interface MarblePhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  inCup: boolean;
  trail?: { x: number; y: number; alpha: number }[];
}

export interface PhysicsStepCallbacks {
  onStarCollect?: (star: StarCollectible) => void;
  onBounce?: (point: Vector2D, normal: Vector2D, pieceType: PieceType, angleDeg: number) => void;
  onPegHit?: (peg: ObstaclePeg) => void;
}

export function stepPhysics(
  marble: MarblePhysicsState,
  level: MarbleLevel,
  dt: number,
  callbacks?: PhysicsStepCallbacks
): void {
  if (!marble.active) return;

  const steps = 4;
  const subDt = dt / steps;
  const gravity = 720; // px/s^2

  for (let s = 0; s < steps; s++) {
    marble.vy += gravity * subDt;
    marble.vx *= 1 - 0.001; // slight air drag
    marble.vy *= 1 - 0.001;

    marble.x += marble.vx * subDt;
    marble.y += marble.vy * subDt;

    // 1. Star collection
    if (level.stars) {
      for (const star of level.stars) {
        if (!star.collected) {
          const d = Math.hypot(marble.x - star.x, marble.y - star.y);
          if (d <= marble.radius + star.radius) {
            star.collected = true;
            callbacks?.onStarCollect?.(star);
          }
        }
      }
    }

    // 2. Obstacle pegs collision
    if (level.obstacles) {
      for (const peg of level.obstacles) {
        const d = Math.hypot(marble.x - peg.x, marble.y - peg.y);
        if (d <= marble.radius + peg.radius) {
          const nx = (marble.x - peg.x) / (d || 1);
          const ny = (marble.y - peg.y) / (d || 1);
          marble.x = peg.x + nx * (marble.radius + peg.radius + 0.5);
          marble.y = peg.y + ny * (marble.radius + peg.radius + 0.5);
          const newV = computeReflectionVelocity(
            { x: marble.vx, y: marble.vy },
            { x: nx, y: ny },
            0.65,
            0.02
          );
          marble.vx = newV.x;
          marble.vy = newV.y;
          callbacks?.onPegHit?.(peg);
        }
      }
    }

    // 3. Fixed ramps collision
    if (level.fixedRamps) {
      for (const ramp of level.fixedRamps) {
        const col = checkSegmentCollision(
          { x: marble.x, y: marble.y },
          marble.radius,
          { x: ramp.x1, y: ramp.y1 },
          { x: ramp.x2, y: ramp.y2 }
        );
        if (col.collided) {
          marble.x = col.closestPoint.x + col.normal.x * (marble.radius + 0.5);
          marble.y = col.closestPoint.y + col.normal.y * (marble.radius + 0.5);
          const newV = computeReflectionVelocity(
            { x: marble.vx, y: marble.vy },
            col.normal,
            ramp.restitution,
            ramp.friction
          );
          marble.vx = newV.x;
          marble.vy = newV.y;
          const rampAngleDeg = Math.round(
            (Math.atan2(ramp.y2 - ramp.y1, ramp.x2 - ramp.x1) * 180) / Math.PI
          );
          callbacks?.onBounce?.(col.closestPoint, col.normal, ramp.type, rampAngleDeg);
        }
      }
    }

    // 4. Placed ramps / trampolines collision
    for (const slot of level.slots) {
      if (!slot.placedPiece) continue;
      const piece = slot.placedPiece;
      const rad = (piece.angleDeg * Math.PI) / 180;
      const halfL = piece.length / 2;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const a = { x: slot.x - halfL * cos, y: slot.y - halfL * sin };
      const b = { x: slot.x + halfL * cos, y: slot.y + halfL * sin };

      const col = checkSegmentCollision(
        { x: marble.x, y: marble.y },
        marble.radius,
        a,
        b
      );

      if (col.collided) {
        marble.x = col.closestPoint.x + col.normal.x * (marble.radius + 0.5);
        marble.y = col.closestPoint.y + col.normal.y * (marble.radius + 0.5);
        const newV = computeReflectionVelocity(
          { x: marble.vx, y: marble.vy },
          col.normal,
          piece.restitution,
          piece.friction
        );
        marble.vx = newV.x;
        marble.vy = newV.y;
        callbacks?.onBounce?.(col.closestPoint, col.normal, piece.type, piece.angleDeg);
      }
    }

    // 5. Target cup entry & settling
    const cup = level.cup;
    const insideCupX =
      marble.x >= cup.x - cup.width / 2 + marble.radius &&
      marble.x <= cup.x + cup.width / 2 - marble.radius;
    const insideCupY =
      marble.y >= cup.y - 8 &&
      marble.y <= cup.y + cup.height;

    if (insideCupX && insideCupY) {
      marble.inCup = true;
      marble.vx *= 0.85;
      marble.vy *= 0.85;
      if (marble.y > cup.y + cup.height - marble.radius) {
        marble.y = cup.y + cup.height - marble.radius;
      }
    }
  }
}

export interface LevelSimulationResult {
  won: boolean;
  inCup: boolean;
  settlingTime: number;
  outOfBounds: boolean;
  finalX: number;
  finalY: number;
  manipulativeBounces: number;
  fixedWallBounces: number;
  trampolineBounces: number;
  woodBounces: number;
  starsCollected: number;
  stars: StarCollectible[];
}

export function simulateLevel(
  level: MarbleLevel,
  placed: { slotId: string; piece: Manipulative }[],
  maxSeconds: number = 8,
  callbacks?: PhysicsStepCallbacks
): LevelSimulationResult {
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
  const dt = 1 / 60;
  const totalFrames = Math.round(maxSeconds / dt);

  for (let frame = 0; frame < totalFrames; frame++) {
    stepPhysics(marble, testLevel, dt, {
      onStarCollect: (star) => {
        starsCollected++;
        callbacks?.onStarCollect?.(star);
      },
      onBounce: (point, normal, pieceType, angleDeg) => {
        let onSlot = false;
        for (const slot of testLevel.slots) {
          if (slot.placedPiece) {
            const d = Math.hypot(point.x - slot.x, point.y - slot.y);
            if (d <= slot.placedPiece.length / 2 + 5) {
              onSlot = true;
              manipulativeBounces++;
              if (slot.placedPiece.type === 'trampoline') trampolineBounces++;
              else woodBounces++;
              break;
            }
          }
        }
        if (!onSlot && testLevel.fixedRamps) {
          for (const ramp of testLevel.fixedRamps) {
            const col = checkSegmentCollision(point, 5, { x: ramp.x1, y: ramp.y1 }, { x: ramp.x2, y: ramp.y2 });
            if (col.collided || col.distance <= 5) {
              fixedWallBounces++;
              break;
            }
          }
        }
        callbacks?.onBounce?.(point, normal, pieceType, angleDeg);
      },
      onPegHit: (peg) => {
        callbacks?.onPegHit?.(peg);
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
        stars: testLevel.stars || []
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
    stars: testLevel.stars || []
  };
}

// --- Manipulative Factory ---

export function createManipulative(
  type: PieceType,
  options?: Partial<Manipulative>
): Manipulative {
  const id = options?.id || `${type}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'trampoline') {
    return {
      id,
      type: 'trampoline',
      length: options?.length ?? 110,
      angleDeg: options?.angleDeg ?? 45,
      restitution: options?.restitution ?? 0.9,
      friction: options?.friction ?? 0.01,
      color: '#8b5cf6',
      label: 'Trampoline (e=0.9)'
    };
  }
  return {
    id,
    type: 'wood',
    length: options?.length ?? 110,
    angleDeg: options?.angleDeg ?? 30,
    restitution: options?.restitution ?? 0.5,
    friction: options?.friction ?? 0.05,
    color: '#d97706',
    label: 'Wood Ramp (e=0.5)'
  };
}

// --- Procedural Level Generation ---

export function generateLevelsForAge(ageGroup: AgeGroup): MarbleLevel[] {
  if (ageGroup === '3-5') {
    return [
      {
        id: 'preschool-1',
        title: 'Downhill Slide',
        mode: 'snap',
        emitter: { x: 100, y: 70, vx: 30, vy: 0 },
        cup: { x: 610, y: 310, width: 80, height: 44 },
        fixedRamps: [
          { x1: 80, y1: 75, x2: 200, y2: 125, type: 'wood', restitution: 0.4, friction: 0.05 },
          { x1: 380, y1: 200, x2: 560, y2: 275, type: 'wood', restitution: 0.4, friction: 0.05 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 290,
            y: 162,
            allowedTypes: ['wood'],
            fixedAngle: 23,
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 23, length: 180 }),
          createManipulative('wood', { angleDeg: 75, length: 180 }) // distractor
        ],
        stars: [{ id: 'star-1', x: 290, y: 138, radius: 14, collected: false }]
      },
      {
        id: 'preschool-2',
        title: 'Two Bridge Steps',
        mode: 'snap',
        emitter: { x: 90, y: 65, vx: 30, vy: 0 },
        cup: { x: 650, y: 325, width: 80, height: 44 },
        fixedRamps: [
          { x1: 70, y1: 70, x2: 170, y2: 112, type: 'wood', restitution: 0.4, friction: 0.05 },
          { x1: 475, y1: 241, x2: 600, y2: 294, type: 'wood', restitution: 0.4, friction: 0.05 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 245,
            y: 144,
            allowedTypes: ['wood'],
            fixedAngle: 23,
            placedPiece: null
          },
          {
            id: 'slot-2',
            x: 395,
            y: 207,
            allowedTypes: ['wood'],
            fixedAngle: 23,
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 23, length: 160 }),
          createManipulative('wood', { angleDeg: 23, length: 160 }),
          createManipulative('wood', { angleDeg: 80, length: 160 }) // distractor
        ],
        stars: [
          { id: 'star-1', x: 245, y: 120, radius: 14, collected: false },
          { id: 'star-2', x: 395, y: 185, radius: 14, collected: false }
        ]
      },
      {
        id: 'preschool-3',
        title: 'Zigzag Bounce',
        mode: 'snap',
        emitter: { x: 100, y: 60, vx: 30, vy: 0 },
        cup: { x: 200, y: 360, width: 80, height: 44 },
        fixedRamps: [
          { x1: 80, y1: 65, x2: 180, y2: 107, type: 'wood', restitution: 0.4, friction: 0.05 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 260,
            y: 141,
            allowedTypes: ['wood'],
            fixedAngle: 23, // slopes down-right
            placedPiece: null
          },
          {
            id: 'slot-2',
            x: 380,
            y: 300,
            allowedTypes: ['wood'],
            fixedAngle: 157, // slopes down-left towards cup
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 23, length: 170 }),
          createManipulative('wood', { angleDeg: 157, length: 260 }),
          createManipulative('wood', { angleDeg: 90, length: 170 }) // distractor
        ],
        stars: [
          { id: 'star-1', x: 260, y: 115, radius: 14, collected: false },
          { id: 'star-2', x: 340, y: 305, radius: 14, collected: false }
        ]
      }
    ];
  }

  if (ageGroup === '6-8') {
    return [
      {
        id: 'elementary-1',
        title: 'Around the Pegs',
        mode: 'rotate',
        antiMirroring: true,
        emitter: { x: 180, y: 60, vx: 10, vy: 10 },
        cup: { x: 600, y: 320, width: 80, height: 44 },
        // Anti-mirroring obstacle pegs blocking the straight fall:
        obstacles: [
          { x: 180, y: 190, radius: 15 },
          { x: 180, y: 240, radius: 15 },
          { x: 180, y: 290, radius: 15 }
        ],
        fixedRamps: [
          { x1: 340, y1: 210, x2: 570, y2: 300, type: 'wood', restitution: 0.5, friction: 0.05 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 180,
            y: 110,
            allowedTypes: ['wood'],
            initialAngle: 30, // acute angle deflecting past pegs
            placedPiece: null
          },
          {
            id: 'slot-2',
            x: 290,
            y: 175,
            allowedTypes: ['wood'],
            initialAngle: 30,
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 30, length: 120 }),
          createManipulative('wood', { angleDeg: 30, length: 120 }),
          createManipulative('wood', { angleDeg: 90, length: 120 }) // distractor vertical
        ],
        stars: [
          { id: 'star-1', x: 240, y: 140, radius: 14, collected: false },
          { id: 'star-2', x: 450, y: 250, radius: 14, collected: false }
        ]
      },
      {
        id: 'elementary-2',
        title: 'Double Deflection',
        mode: 'rotate',
        antiMirroring: true,
        emitter: { x: 140, y: 60, vx: 15, vy: 5 },
        cup: { x: 600, y: 320, width: 80, height: 44 },
        obstacles: [
          { x: 140, y: 200, radius: 16 },
          { x: 320, y: 290, radius: 16 }
        ],
        fixedRamps: [
          { x1: 340, y1: 230, x2: 570, y2: 300, type: 'wood', restitution: 0.5, friction: 0.05 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 160,
            y: 110,
            allowedTypes: ['wood'],
            initialAngle: 30,
            placedPiece: null
          },
          {
            id: 'slot-2',
            x: 280,
            y: 180,
            allowedTypes: ['wood'],
            initialAngle: 30,
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 30, length: 120 }),
          createManipulative('wood', { angleDeg: 30, length: 120 }),
          createManipulative('wood', { angleDeg: 0, length: 120 }) // distractor flat
        ],
        stars: [
          { id: 'star-1', x: 220, y: 140, radius: 14, collected: false },
          { id: 'star-2', x: 450, y: 260, radius: 14, collected: false }
        ]
      },
      {
        id: 'elementary-3',
        title: 'Slalom Maze',
        mode: 'rotate',
        antiMirroring: true,
        emitter: { x: 200, y: 55, vx: 10, vy: 10 },
        cup: { x: 380, y: 340, width: 80, height: 44 },
        obstacles: [
          { x: 200, y: 180, radius: 15 },
          { x: 380, y: 260, radius: 15 }
        ],
        slots: [
          {
            id: 'slot-1',
            x: 220,
            y: 110,
            allowedTypes: ['wood'],
            initialAngle: 30,
            placedPiece: null
          },
          {
            id: 'slot-2',
            x: 320,
            y: 190,
            allowedTypes: ['wood'],
            initialAngle: 150, // steer back left
            placedPiece: null
          },
          {
            id: 'slot-3',
            x: 240,
            y: 280,
            allowedTypes: ['wood'],
            initialAngle: 30,
            placedPiece: null
          }
        ],
        inventory: [
          createManipulative('wood', { angleDeg: 30, length: 130 }),
          createManipulative('wood', { angleDeg: 150, length: 180 }),
          createManipulative('wood', { angleDeg: 30, length: 160 })
        ],
        stars: [
          { id: 'star-1', x: 270, y: 135, radius: 14, collected: false },
          { id: 'star-2', x: 275, y: 205, radius: 14, collected: false },
          { id: 'star-3', x: 310, y: 315, radius: 14, collected: false }
        ]
      }
    ];
  }

  // Upper Elementary (9-11): Law of Reflection & Trampoline physics
  return [
    {
      id: 'upper-1',
      title: 'The Great Chasm',
      mode: 'reflection',
      emitter: { x: 140, y: 50, vx: 0, vy: 40 },
      cup: { x: 600, y: 350, width: 80, height: 44 },
      fixedRamps: [
        { x1: 360, y1: 320, x2: 570, y2: 340, type: 'wood', restitution: 0.5, friction: 0.05 }
      ],
      obstacles: [{ x: 280, y: 440, radius: 24 }],
      slots: [
        {
          id: 'slot-1',
          x: 140,
          y: 190,
          allowedTypes: ['wood', 'trampoline'],
          initialAngle: 45, // 45° trampoline reflects vertical drop horizontally across chasm
          placedPiece: null
        }
      ],
      inventory: [
        createManipulative('trampoline', { angleDeg: 45, length: 120 }),
        createManipulative('wood', { angleDeg: 45, length: 120 }) // distractor: wood absorbs bounce
      ],
      stars: [
        { id: 'star-1', x: 260, y: 230, radius: 14, collected: false },
        { id: 'star-2', x: 460, y: 310, radius: 14, collected: false }
      ]
    },
    {
      id: 'upper-2',
      title: 'Wall Ricochet',
      mode: 'reflection',
      emitter: { x: 140, y: 40, vx: 0, vy: 30 },
      cup: { x: 180, y: 440, width: 80, height: 44 },
      // Reflective fixed wall on the right (x = 460):
      fixedRamps: [
        { x1: 460, y1: 60, x2: 460, y2: 440, type: 'wood', restitution: 0.85, friction: 0.02 }
      ],
      slots: [
        {
          id: 'slot-1',
          x: 140,
          y: 190,
          allowedTypes: ['trampoline'],
          initialAngle: 30, // launches ball towards wall
          placedPiece: null
        },
        {
          id: 'slot-2',
          x: 360,
          y: 410,
          allowedTypes: ['wood', 'trampoline'],
          initialAngle: 155, // catches wall rebound and guides to cup
          placedPiece: null
        }
      ],
      inventory: [
        createManipulative('trampoline', { angleDeg: 30, length: 120 }),
        createManipulative('wood', { angleDeg: 155, length: 200 }),
        createManipulative('wood', { angleDeg: 30, length: 120 }) // distractor
      ],
      stars: [
        { id: 'star-1', x: 254, y: 160, radius: 14, collected: false },
        { id: 'star-2', x: 419, y: 298, radius: 14, collected: false },
        { id: 'star-3', x: 245, y: 445, radius: 14, collected: false }
      ]
    },
    {
      id: 'upper-3',
      title: 'Double Trampoline Arc',
      mode: 'reflection',
      emitter: { x: 120, y: 50, vx: 0, vy: 30 },
      cup: { x: 600, y: 320, width: 80, height: 44 },
      slots: [
        {
          id: 'slot-1',
          x: 140,
          y: 190,
          allowedTypes: ['trampoline'],
          initialAngle: 45,
          placedPiece: null
        },
        {
          id: 'slot-2',
          x: 340,
          y: 310,
          allowedTypes: ['trampoline', 'wood'],
          initialAngle: 40,
          placedPiece: null
        }
      ],
      inventory: [
        createManipulative('trampoline', { angleDeg: 45, length: 120 }),
        createManipulative('trampoline', { angleDeg: 40, length: 120 }),
        createManipulative('wood', { angleDeg: 45, length: 120 }) // distractor
      ],
      stars: [
        { id: 'star-1', x: 240, y: 220, radius: 14, collected: false },
        { id: 'star-2', x: 470, y: 280, radius: 14, collected: false }
      ]
    }
  ];
}

// --- Custom Levels Validator ---

export function parseCustomLevels(raw: unknown): MarbleLevel[] | null {
  if (raw === null || raw === undefined) return null;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const levels: MarbleLevel[] = [];

  for (let idx = 0; idx < parsed.length; idx++) {
    try {
      const item = parsed[idx] as CustomLevelConfig;
      if (!item || typeof item !== 'object') continue;

      // Validate emitter
      if (
        !item.emitter ||
        typeof item.emitter !== 'object' ||
        typeof item.emitter.x !== 'number' ||
        typeof item.emitter.y !== 'number'
      ) {
        continue;
      }

      // Validate cup
      if (
        !item.cup ||
        typeof item.cup !== 'object' ||
        typeof item.cup.x !== 'number' ||
        typeof item.cup.y !== 'number'
      ) {
        continue;
      }

      const cup: TargetCup = {
        x: item.cup.x,
        y: item.cup.y,
        width: typeof item.cup.width === 'number' && item.cup.width > 0 ? item.cup.width : 70,
        height: typeof item.cup.height === 'number' && item.cup.height > 0 ? item.cup.height : 44
      };

      // Validate slots
      const slots: Slot[] = [];
      if (Array.isArray(item.slots)) {
        for (let sIdx = 0; sIdx < item.slots.length; sIdx++) {
          const s = item.slots[sIdx];
          if (s && typeof s === 'object' && typeof s.x === 'number' && typeof s.y === 'number') {
            slots.push({
              id: (typeof s.id === 'string' && s.id) || `custom-slot-${sIdx + 1}`,
              x: s.x,
              y: s.y,
              allowedTypes: Array.isArray(s.allowedTypes)
                ? s.allowedTypes.filter((t): t is PieceType => t === 'wood' || t === 'trampoline')
                : undefined,
              fixedAngle: typeof s.fixedAngle === 'number' ? s.fixedAngle : undefined,
              initialAngle: typeof s.initialAngle === 'number' ? s.initialAngle : undefined,
              placedPiece: null
            });
          }
        }
      }

      // Validate inventory
      const inventory: Manipulative[] = [];
      if (Array.isArray(item.inventory)) {
        for (let iIdx = 0; iIdx < item.inventory.length; iIdx++) {
          const inv = item.inventory[iIdx];
          if (typeof inv === 'string' && (inv === 'wood' || inv === 'trampoline')) {
            inventory.push(createManipulative(inv));
          } else if (
            inv &&
            typeof inv === 'object' &&
            'type' in inv &&
            (inv.type === 'trampoline' || inv.type === 'wood')
          ) {
            inventory.push(
              createManipulative(inv.type, {
                id: typeof inv.id === 'string' ? inv.id : undefined,
                length: typeof inv.length === 'number' ? inv.length : undefined,
                angleDeg: typeof inv.angleDeg === 'number' ? inv.angleDeg : undefined,
                restitution: typeof inv.restitution === 'number' ? inv.restitution : undefined
              })
            );
          }
        }
      }

      // Fallback if inventory is empty
      if (inventory.length === 0 && slots.length > 0) {
        slots.forEach(() => {
          inventory.push(createManipulative('wood'));
        });
      }

      // Fixed ramps
      const fixedRamps: FixedRamp[] = [];
      if (Array.isArray(item.fixedRamps)) {
        for (const r of item.fixedRamps) {
          if (
            r &&
            typeof r === 'object' &&
            typeof r.x1 === 'number' &&
            typeof r.y1 === 'number' &&
            typeof r.x2 === 'number' &&
            typeof r.y2 === 'number'
          ) {
            const isTrampoline = r.type === 'trampoline';
            fixedRamps.push({
              x1: r.x1,
              y1: r.y1,
              x2: r.x2,
              y2: r.y2,
              type: isTrampoline ? 'trampoline' : 'wood',
              restitution:
                typeof r.restitution === 'number' ? r.restitution : isTrampoline ? 0.9 : 0.5,
              friction: isTrampoline ? 0.01 : 0.05
            });
          }
        }
      }

      // Obstacles
      const obstacles: ObstaclePeg[] = [];
      if (Array.isArray(item.obstacles)) {
        for (const o of item.obstacles) {
          if (o && typeof o === 'object' && typeof o.x === 'number' && typeof o.y === 'number') {
            obstacles.push({
              x: o.x,
              y: o.y,
              radius: typeof o.radius === 'number' && o.radius > 0 ? o.radius : 15
            });
          }
        }
      }

      // Stars
      const stars: StarCollectible[] = [];
      if (Array.isArray(item.stars)) {
        for (let stIdx = 0; stIdx < item.stars.length; stIdx++) {
          const st = item.stars[stIdx];
          if (st && typeof st === 'object' && typeof st.x === 'number' && typeof st.y === 'number') {
            stars.push({
              id: `star-${stIdx + 1}`,
              x: st.x,
              y: st.y,
              radius: 14,
              collected: false
            });
          }
        }
      }

      const mode =
        item.mode === 'reflection' || item.mode === 'rotate' ? item.mode : 'snap';

      levels.push({
        id: item.id || `custom-level-${idx + 1}`,
        title: item.title || `Custom Level ${idx + 1}`,
        mode,
        instruction: item.instruction,
        emitter: {
          x: item.emitter.x,
          y: item.emitter.y,
          vx: typeof item.emitter.vx === 'number' ? item.emitter.vx : 20,
          vy: typeof item.emitter.vy === 'number' ? item.emitter.vy : 0
        },
        cup,
        slots,
        inventory,
        fixedRamps,
        obstacles,
        stars
      });
    } catch {
      continue;
    }
  }

  return levels.length > 0 ? levels : null;
}

// --- Visual Particles & Audio Mock Fallback ---

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

interface BounceFeedback {
  x: number;
  y: number;
  text: string;
  alpha: number;
}

const fallbackAudio: SoundEngine = {
  enabled: true,
  playClick: () => {},
  playPop: () => {},
  playDrop: () => {},
  playChime: () => {},
  playSuccess: () => {},
  playError: () => {},
  playTone: () => {},
  close: () => {}
} as unknown as SoundEngine;

// --- Main Cartridge Class ---

export class MarbleRunAnglesGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private t!: Translations;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animFrameId: number | null = null;
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  private levels: MarbleLevel[] = [];
  private currentLevelIndex: number = 0;
  private score: number = 0;
  private streak: number = 0;
  private startTime: number = 0;

  // Marble simulation state
  private marble = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 10,
    active: false,
    inCup: false,
    trail: [] as { x: number; y: number; alpha: number }[]
  };

  private settlingTime: number = 0;
  private levelWon: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;

  // Interaction & UX state
  private selectedSlotId: string | null = null;
  private hoveredSlotId: string | null = null;
  private hoveredRotateSlotId: string | null = null;
  private pointerDownPos: { x: number; y: number } | null = null;
  private draggingPiece: Manipulative | null = null;
  private draggingFromSlotId: string | null = null;
  private dragCurrentPos: { x: number; y: number } = { x: 0, y: 0 };
  private isDragging: boolean = false;

  private particles: Particle[] = [];
  private bounceFeedbacks: BounceFeedback[] = [];

  private get audio(): SoundEngine {
    return this.context?.audio || fallbackAudio;
  }

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();
    this.t = getTranslations(context.locale);
    if (context.sound !== undefined) {
      this.audio.enabled = context.sound;
    }
    this.score = 0;
    this.streak = 0;
    this.startTime = Date.now();

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 20%, #1e293b, #090d16); color: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none; -webkit-user-select: none; overflow: hidden;">
        <!-- Top HUD -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; min-height: 48px; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 800; font-size: 1.1rem; color: #38bdf8; letter-spacing: -0.02em;" id="hud-title">${this.t.title}</span>
            <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;">${this.t.level} 1/3</span>
          </div>

          <div id="instruction" style="flex: 1; min-width: 200px; font-size: 0.9rem; color: #cbd5e1; font-weight: 500; text-align: center;"></div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.05rem;">⭐ 0</div>
            <button id="btn-sound-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600;">${this.audio.enabled ? this.t.soundOn : this.t.soundOff}</button>
          </div>
        </div>

        <!-- Canvas Game Board -->
        <div id="canvas-wrapper" style="flex: 1; position: relative; overflow: hidden; touch-action: none;">
          <canvas id="marble-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Bottom Controls & Manipulatives Tray -->
        <div style="padding: 10px 20px 14px; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 860px; margin: 0 auto; gap: 16px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button id="btn-launch" style="background: #0284c7; hover:background: #0369a1; border: none; color: #ffffff; padding: 8px 18px; border-radius: 8px; font-size: 0.9rem; font-weight: 700; cursor: pointer; min-height: 44px; box-shadow: 0 2px 8px rgba(2,132,199,0.4); display: flex; align-items: center; gap: 6px;">${this.t.launch}</button>
              <button id="btn-reset-marble" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; min-height: 44px;">${this.t.resetMarble}</button>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex: 1; justify-content: center; min-width: 240px;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;" id="tray-title">${this.t.trayLabel}:</span>
              <div id="inventory-tray" style="display: flex; gap: 10px; align-items: center; justify-content: center; min-height: 48px; flex-wrap: wrap;"></div>
            </div>

            <button id="btn-clear-pieces" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; min-height: 44px;">${this.t.reset}</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#marble-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.setupResize();
    this.setupEvents();
    this.loadCurriculum();
    this.loadLevel(0);
  }

  start(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isPaused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  resume(): void {
    if (this.isPaused) {
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.isPaused = false;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  updateConfig(newContext: Partial<GameContext>): void {
    let reload = false;
    if (newContext.locale && newContext.locale !== this.context.locale) {
      this.context.locale = newContext.locale;
      this.t = getTranslations(newContext.locale as SupportedLocale);
      this.updateStaticHUD();
    }
    if (newContext.sound !== undefined) {
      this.audio.enabled = newContext.sound;
      const soundBtn = this.container.querySelector('#btn-sound-toggle');
      if (soundBtn) soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
    }
    if (newContext.ageGroup && newContext.ageGroup !== this.context.ageGroup) {
      this.context.ageGroup = newContext.ageGroup;
      reload = true;
    }
    if ('customLevels' in newContext && newContext.customLevels !== this.context.customLevels) {
      this.context.customLevels = newContext.customLevels;
      reload = true;
    }
    if (reload) {
      this.loadCurriculum();
      this.loadLevel(0);
    }
  }

  destroy(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController?.abort();
    this.abortController = null;
    this.container.innerHTML = '';
  }

  // --- Curriculum & Level Management ---

  private loadCurriculum(): void {
    const custom = parseCustomLevels(this.context.customLevels);
    if (custom && custom.length > 0) {
      this.levels = custom;
    } else {
      this.levels = generateLevelsForAge(this.context.ageGroup);
    }
  }

  private loadLevel(index: number): void {
    this.currentLevelIndex = index;
    const level = this.levels[index];
    this.settlingTime = 0;
    this.levelWon = false;
    this.selectedSlotId = null;
    this.hoveredSlotId = null;
    this.hoveredRotateSlotId = null;
    this.draggingPiece = null;
    this.isDragging = false;
    this.particles = [];
    this.bounceFeedbacks = [];

    // Reset stars collected flag
    level.stars?.forEach((s) => (s.collected = false));

    // Reset marble position to emitter
    this.resetMarble();

    // Render Tray UI & HUD
    this.renderTrayUI();
    this.updateStaticHUD();
    this.updateDynamicInstruction();

    // Emit progress event
    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: `Started level ${this.currentLevelIndex + 1}: ${level.title || ''}`
    });
  }

  private resetMarble(): void {
    const level = this.levels[this.currentLevelIndex];
    if (!level) return;
    this.marble.x = level.emitter.x;
    this.marble.y = level.emitter.y;
    this.marble.vx = 0;
    this.marble.vy = 0;
    this.marble.radius = 10;
    this.marble.active = false;
    this.marble.inCup = false;
    this.marble.trail = [];
    this.settlingTime = 0;
  }

  private launchMarble(): void {
    const level = this.levels[this.currentLevelIndex];
    if (!level) return;
    if (this.marble.active) {
      this.resetMarble();
      return;
    }
    this.marble.x = level.emitter.x;
    this.marble.y = level.emitter.y;
    this.marble.vx = level.emitter.vx ?? 25;
    this.marble.vy = level.emitter.vy ?? 0;
    this.marble.active = true;
    this.marble.inCup = false;
    this.audio.playPop();
  }

  private clearPlacedPieces(): void {
    const level = this.levels[this.currentLevelIndex];
    if (!level) return;
    let returnedAny = false;
    for (const slot of level.slots) {
      if (slot.placedPiece) {
        level.inventory.push(slot.placedPiece);
        slot.placedPiece = null;
        returnedAny = true;
      }
    }
    if (returnedAny) {
      this.audio.playPop();
    }
    this.selectedSlotId = null;
    this.resetMarble();
    this.renderTrayUI();
    this.updateDynamicInstruction();
  }

  // --- Board Coordinate Mapping ---

  private getDimensions() {
    const rect = this.canvas?.getBoundingClientRect() || { width: 800, height: 480 };
    const boardW = 800;
    const boardH = 480;
    const scale = Math.min(rect.width / boardW, rect.height / boardH);
    const offsetX = (rect.width - boardW * scale) / 2;
    const offsetY = (rect.height - boardH * scale) / 2;
    return {
      scale: scale > 0 ? scale : 1,
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
      boardW,
      boardH
    };
  }

  private toBoardCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.getDimensions();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale
    };
  }

  // --- Resize & DOM Event Listeners ---

  private setupResize(): void {
    const wrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.canvas || !this.ctx) return;
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    });
    this.resizeObserver.observe(wrapper);
  }

  private setupEvents(): void {
    if (!this.abortController) return;
    const signal = this.abortController.signal;

    // Launch button
    const launchBtn = this.container.querySelector('#btn-launch');
    launchBtn?.addEventListener('click', () => this.launchMarble(), { signal });

    // Reset marble button
    const resetMarbleBtn = this.container.querySelector('#btn-reset-marble');
    resetMarbleBtn?.addEventListener('click', () => {
      this.resetMarble();
      this.audio.playClick();
    }, { signal });

    // Clear pieces button
    const clearBtn = this.container.querySelector('#btn-clear-pieces');
    clearBtn?.addEventListener('click', () => this.clearPlacedPieces(), { signal });

    // Sound toggle button
    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    soundBtn?.addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      if (soundBtn) soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
      this.audio.playClick();
    }, { signal });

    // Pointer events on canvas
    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
      window.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
      window.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
    }
  }

  // --- Interaction & Dual Input (Tap + Drag & Drop) ---

  private onPointerDown(e: PointerEvent): void {
    const pos = this.toBoardCoords(e.clientX, e.clientY);
    this.pointerDownPos = { ...pos };
    this.dragCurrentPos = { ...pos };
    this.isDragging = false;

    const level = this.levels[this.currentLevelIndex];
    if (!level) return;

    // 1. Check if clicking launcher to launch
    const dLauncher = Math.hypot(pos.x - level.emitter.x, pos.y - level.emitter.y);
    if (dLauncher < 28) {
      this.launchMarble();
      return;
    }

    // 2. Check if clicking rotation handle on a selected slot in rotate/reflection mode
    for (const slot of level.slots) {
      if (!slot.placedPiece) continue;
      if (level.mode !== 'snap') {
        const piece = slot.placedPiece;
        const rad = (piece.angleDeg * Math.PI) / 180;
        const handleX = slot.x + (piece.length / 2 + 18) * Math.cos(rad);
        const handleY = slot.y + (piece.length / 2 + 18) * Math.sin(rad);
        const dHandle = Math.hypot(pos.x - handleX, pos.y - handleY);
        if (dHandle < 24) {
          // Rotate by 15°
          piece.angleDeg = (snapToAngle(piece.angleDeg + 15, 15)) % 180;
          this.audio.playClick();
          this.resetMarble();
          this.updateDynamicInstruction();
          return;
        }
      }

      // Check clicking placed piece itself to select or pick up
      const dSlot = Math.hypot(pos.x - slot.x, pos.y - slot.y);
      if (dSlot < 40) {
        this.selectedSlotId = slot.id;
        this.draggingPiece = slot.placedPiece;
        this.draggingFromSlotId = slot.id;
        return;
      }
    }

    // Deselect if clicked empty area
    this.selectedSlotId = null;
    this.updateDynamicInstruction();
  }

  private onPointerMove(e: PointerEvent): void {
    const pos = this.toBoardCoords(e.clientX, e.clientY);
    this.dragCurrentPos = { ...pos };

    if (this.pointerDownPos && this.draggingPiece) {
      const dist = Math.hypot(pos.x - this.pointerDownPos.x, pos.y - this.pointerDownPos.y);
      if (dist > 5) {
        this.isDragging = true;
      }
    }

    // Hover detection for slots & rotate handles
    const level = this.levels[this.currentLevelIndex];
    if (!level) return;

    this.hoveredSlotId = null;
    this.hoveredRotateSlotId = null;

    for (const slot of level.slots) {
      const d = Math.hypot(pos.x - slot.x, pos.y - slot.y);
      if (d < 45) {
        this.hoveredSlotId = slot.id;
      }
      if (slot.placedPiece && level.mode !== 'snap') {
        const piece = slot.placedPiece;
        const rad = (piece.angleDeg * Math.PI) / 180;
        const handleX = slot.x + (piece.length / 2 + 18) * Math.cos(rad);
        const handleY = slot.y + (piece.length / 2 + 18) * Math.sin(rad);
        if (Math.hypot(pos.x - handleX, pos.y - handleY) < 22) {
          this.hoveredRotateSlotId = slot.id;
        }
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const pos = this.toBoardCoords(e.clientX, e.clientY);
    const level = this.levels[this.currentLevelIndex];

    if (this.isDragging && this.draggingPiece && level) {
      // Find closest valid slot
      let closestSlot: Slot | null = null;
      let minDistance = 75; // generous snap radius

      for (const slot of level.slots) {
        const d = Math.hypot(pos.x - slot.x, pos.y - slot.y);
        if (d < minDistance) {
          minDistance = d;
          closestSlot = slot;
        }
      }

      if (closestSlot) {
        // If slot already had a piece, return old piece to inventory
        if (closestSlot.placedPiece && closestSlot.id !== this.draggingFromSlotId) {
          level.inventory.push(closestSlot.placedPiece);
        }

        // Remove from old slot if dragged from another slot
        if (this.draggingFromSlotId && this.draggingFromSlotId !== closestSlot.id) {
          const oldSlot = level.slots.find((s) => s.id === this.draggingFromSlotId);
          if (oldSlot) oldSlot.placedPiece = null;
        }

        // Apply slot fixed angle if in 3-5 snap mode
        if (closestSlot.fixedAngle !== undefined) {
          this.draggingPiece.angleDeg = closestSlot.fixedAngle;
        } else if (closestSlot.initialAngle !== undefined && this.draggingPiece.angleDeg === 0) {
          this.draggingPiece.angleDeg = closestSlot.initialAngle;
        }

        closestSlot.placedPiece = this.draggingPiece;
        this.selectedSlotId = closestSlot.id;
        this.audio.playDrop();
      } else {
        // Dropped outside: granular undo (returns to inventory)
        if (this.draggingFromSlotId) {
          const oldSlot = level.slots.find((s) => s.id === this.draggingFromSlotId);
          if (oldSlot) oldSlot.placedPiece = null;
          level.inventory.push(this.draggingPiece);
          this.audio.playPop();
        }
      }
    } else if (!this.isDragging && this.draggingPiece && this.draggingFromSlotId && level) {
      // Tap on placed piece: in rotate mode, advance angle; in snap mode, return to tray (granular undo)
      const slot = level.slots.find((s) => s.id === this.draggingFromSlotId);
      if (slot && slot.placedPiece) {
        if (level.mode !== 'snap') {
          slot.placedPiece.angleDeg = (snapToAngle(slot.placedPiece.angleDeg + 15, 15)) % 180;
          this.audio.playClick();
        } else {
          // Granular undo: tap placed piece returns it to tray
          level.inventory.push(slot.placedPiece);
          slot.placedPiece = null;
          this.selectedSlotId = null;
          this.audio.playPop();
        }
      }
    }

    this.pointerDownPos = null;
    this.draggingPiece = null;
    this.draggingFromSlotId = null;
    this.isDragging = false;
    this.resetMarble();
    this.renderTrayUI();
    this.updateDynamicInstruction();
  }

  // --- Tray UI Rendering ---

  private renderTrayUI(): void {
    const tray = this.container.querySelector('#inventory-tray');
    if (!tray) return;
    tray.innerHTML = '';

    const level = this.levels[this.currentLevelIndex];
    if (!level) return;

    level.inventory.forEach((piece, index) => {
      const itemEl = document.createElement('div');
      itemEl.setAttribute('data-id', piece.id);
      itemEl.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: #1e293b;
        border: 1px solid ${piece.type === 'trampoline' ? '#8b5cf6' : '#d97706'};
        border-radius: 8px;
        color: #f8fafc;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: grab;
        min-height: 44px;
        transition: transform 0.15s, background 0.15s;
      `;

      const dot = document.createElement('span');
      dot.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${piece.color};
        display: inline-block;
      `;

      const text = document.createElement('span');
      text.textContent = piece.type === 'trampoline' ? this.t.trampoline : this.t.woodRamp;

      itemEl.appendChild(dot);
      itemEl.appendChild(text);

      // Tap on tray item: quick snap into first empty slot
      itemEl.addEventListener('click', () => {
        const emptySlot = level.slots.find((s) => !s.placedPiece);
        if (emptySlot) {
          level.inventory.splice(index, 1);
          if (emptySlot.fixedAngle !== undefined) {
            piece.angleDeg = emptySlot.fixedAngle;
          } else if (emptySlot.initialAngle !== undefined) {
            piece.angleDeg = emptySlot.initialAngle;
          }
          emptySlot.placedPiece = piece;
          this.selectedSlotId = emptySlot.id;
          this.audio.playDrop();
          this.renderTrayUI();
          this.resetMarble();
          this.updateDynamicInstruction();
        } else {
          this.audio.playError();
        }
      });

      tray.appendChild(itemEl);
    });
  }

  // --- Scaffolding & Dynamic HUD Text ---

  private updateStaticHUD(): void {
    const titleEl = this.container.querySelector('#hud-title');
    if (titleEl) titleEl.textContent = this.t.title;

    const badgeEl = this.container.querySelector('#level-badge');
    if (badgeEl) badgeEl.textContent = `${this.t.level} ${this.currentLevelIndex + 1}/${this.levels.length}`;

    const trayLabel = this.container.querySelector('#tray-title');
    if (trayLabel) trayLabel.textContent = `${this.t.trayLabel}:`;

    const launchBtn = this.container.querySelector('#btn-launch');
    if (launchBtn) launchBtn.textContent = this.t.launch;

    const resetMarbleBtn = this.container.querySelector('#btn-reset-marble');
    if (resetMarbleBtn) resetMarbleBtn.textContent = this.t.resetMarble;

    const clearBtn = this.container.querySelector('#btn-clear-pieces');
    if (clearBtn) clearBtn.textContent = this.t.reset;

    const scoreEl = this.container.querySelector('#score-display');
    if (scoreEl) scoreEl.textContent = `⭐ ${this.score}`;
  }

  private updateDynamicInstruction(): void {
    const instEl = this.container.querySelector('#instruction');
    if (!instEl) return;

    const level = this.levels[this.currentLevelIndex];
    if (!level) return;

    if (level.instruction) {
      instEl.textContent = level.instruction;
      return;
    }

    // Default pedagogical hints based on age bracket & mode
    if (level.mode === 'snap') {
      const placedCount = level.slots.filter((s) => s.placedPiece).length;
      if (placedCount < level.slots.length) {
        instEl.textContent = this.t.promptPreschool;
      } else {
        instEl.textContent = `✨ ${placedCount}/${level.slots.length} ramps placed. Tap Launch to roll!`;
      }
    } else if (level.mode === 'rotate') {
      const selected = level.slots.find((s) => s.id === this.selectedSlotId)?.placedPiece;
      if (selected) {
        const cls = classifyAngle(selected.angleDeg);
        const localizedCls = this.t[cls] || cls;
        instEl.textContent = `Angle: ${this.t.formatAngleInfo(selected.angleDeg, localizedCls)}. Tap handle or ramp to rotate by 15°!`;
      } else {
        instEl.textContent = this.t.promptElementary;
      }
    } else {
      // Reflection mode
      const selected = level.slots.find((s) => s.id === this.selectedSlotId)?.placedPiece;
      if (selected) {
        const iDeg = selected.angleDeg;
        instEl.textContent = this.t.formatReflectionHUD(iDeg, iDeg, selected.restitution);
      } else {
        instEl.textContent = this.t.promptUpperElementary;
      }
    }
  }

  // --- Main Game Loop (Physics & Animation) ---

  private loop(currentTime: number): void {
    if (this.isPaused) {
      this.animFrameId = null;
      return;
    }

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    this.updatePhysics(dt);
    this.draw();

    if (!this.isPaused) {
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    } else {
      this.animFrameId = null;
    }
  }

  private updatePhysics(dt: number): void {
    const level = this.levels[this.currentLevelIndex];
    if (!level) return;

    // Update floating particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 1.5;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update bounce HUD messages
    for (let i = this.bounceFeedbacks.length - 1; i >= 0; i--) {
      const b = this.bounceFeedbacks[i];
      b.y -= dt * 20;
      b.alpha -= dt * 1.2;
      if (b.alpha <= 0) {
        this.bounceFeedbacks.splice(i, 1);
      }
    }

    if (!this.marble.active) return;

    stepPhysics(this.marble, level, dt, {
      onStarCollect: (star) => {
        this.score += 50;
        this.updateStaticHUD();
        this.audio.playChime();
        this.spawnParticleBurst(star.x, star.y, '#fbbf24', 16);
        this.context.emit('game:score', { points: this.score, delta: 50, streak: this.streak });
      },
      onPegHit: () => {
        this.audio.playClick();
      },
      onBounce: (point, _normal, type, angleDeg) => {
        if (type === 'trampoline') {
          this.audio.playPop();
          this.spawnParticleBurst(point.x, point.y, '#8b5cf6', 10);
          this.bounceFeedbacks.push({
            x: point.x,
            y: point.y - 12,
            text: `e = 0.9 (θ_r = ${angleDeg}°)`,
            alpha: 1.0
          });
        } else {
          this.audio.playDrop();
          this.bounceFeedbacks.push({
            x: point.x,
            y: point.y - 12,
            text: `e = 0.5 (${angleDeg}°)`,
            alpha: 0.8
          });
        }
      }
    });

    // Settling confirmation window (0.5 - 0.8s)
    if (this.marble.inCup) {
      this.settlingTime += dt;
      if (this.settlingTime >= 0.6 && !this.levelWon) {
        this.levelWon = true;
        this.handleLevelWin();
      }
    } else {
      this.settlingTime = 0;
    }

    // Motion trail update
    this.marble.trail.unshift({ x: this.marble.x, y: this.marble.y, alpha: 0.8 });
    if (this.marble.trail.length > 8) {
      this.marble.trail.pop();
    }
    for (const t of this.marble.trail) {
      t.alpha -= dt * 1.5;
    }

    // Out of bounds reset
    if (this.marble.y > 540 || this.marble.x < -40 || this.marble.x > 840) {
      this.resetMarble();
    }
  }

  private handleLevelWin(): void {
    this.score += 100;
    this.streak += 1;
    this.updateStaticHUD();

    const instEl = this.container.querySelector('#instruction');
    if (instEl) instEl.textContent = this.t.wellDone;

    this.audio.playSuccess();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    this.context.emit('game:score', { points: this.score, streak: this.streak, delta: 100 });
    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: `Completed level ${this.currentLevelIndex + 1}`
    });

    const timeout = setTimeout(() => {
      if (this.currentLevelIndex + 1 < this.levels.length) {
        this.loadLevel(this.currentLevelIndex + 1);
      } else {
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        this.context.emit('game:complete', {
          stars: 3,
          score: this.score,
          timeElapsed: elapsed,
          summary: this.t.summary
        });
        const loopTimeout = setTimeout(() => {
          this.loadCurriculum();
          this.loadLevel(0);
        }, 2200);
        this.pendingTimeouts.add(loopTimeout);
      }
    }, 1500);
    this.pendingTimeouts.add(timeout);
  }

  private spawnParticleBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  // --- Rendering Pipeline ---

  private draw(): void {
    if (!this.ctx || !this.canvas) return;
    const { scale, offsetX, offsetY, boardW, boardH } = this.getDimensions();
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Center and scale virtual board
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const level = this.levels[this.currentLevelIndex];
    if (!level) {
      ctx.restore();
      return;
    }

    // 1. Pegboard background dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 40; x < boardW; x += 40) {
      for (let y = 40; y < boardH; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Fixed ramps
    if (level.fixedRamps) {
      for (const r of level.fixedRamps) {
        ctx.save();
        ctx.strokeStyle = r.type === 'trampoline' ? '#8b5cf6' : '#d97706';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x1, r.y1);
        ctx.lineTo(r.x2, r.y2);
        ctx.stroke();

        // Inner highlight
        ctx.strokeStyle = r.type === 'trampoline' ? '#c4b5fd' : '#fde68a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Obstacle pegs
    if (level.obstacles) {
      for (const peg of level.obstacles) {
        ctx.save();
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner highlight dot
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(peg.x - peg.radius * 0.3, peg.y - peg.radius * 0.3, peg.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. Slots (Empty or Placed)
    for (const slot of level.slots) {
      const isSelected = slot.id === this.selectedSlotId;
      const isHovered = slot.id === this.hoveredSlotId;

      if (!slot.placedPiece) {
        // Empty slot ghost outline
        ctx.save();
        ctx.strokeStyle = isHovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Slot pin center
        ctx.fillStyle = isHovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)';
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Fixed slot angle indicator in 3-5
        if (slot.fixedAngle !== undefined) {
          const rad = (slot.fixedAngle * Math.PI) / 180;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(slot.x - 40 * Math.cos(rad), slot.y - 40 * Math.sin(rad));
          ctx.lineTo(slot.x + 40 * Math.cos(rad), slot.y + 40 * Math.sin(rad));
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Placed manipulative ramp / trampoline
        const piece = slot.placedPiece;
        const rad = (piece.angleDeg * Math.PI) / 180;
        const halfL = piece.length / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const x1 = slot.x - halfL * cos;
        const y1 = slot.y - halfL * sin;
        const x2 = slot.x + halfL * cos;
        const y2 = slot.y + halfL * sin;

        ctx.save();
        ctx.strokeStyle = piece.color;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Surface highlight
        ctx.strokeStyle = piece.type === 'trampoline' ? '#e9d5ff' : '#fef3c7';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Center pivot screw
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Protractor overlay & rotation handle in 6-8 and 9-11
        if (level.mode !== 'snap' && isSelected) {
          this.drawProtractorOverlay(
            ctx,
            slot.x,
            slot.y,
            piece.angleDeg,
            slot.id === this.hoveredRotateSlotId
          );
        }

        ctx.restore();
      }
    }

    // 5. Collectible Stars
    if (level.stars) {
      for (const star of level.stars) {
        if (!star.collected) {
          this.drawStar(ctx, star.x, star.y, star.radius);
        }
      }
    }

    // 6. Emitter (Dispenser)
    ctx.save();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(level.emitter.x - 22, level.emitter.y - 30);
    ctx.lineTo(level.emitter.x + 22, level.emitter.y - 30);
    ctx.lineTo(level.emitter.x + 12, level.emitter.y);
    ctx.lineTo(level.emitter.x - 12, level.emitter.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Waiting marble preview inside emitter
    if (!this.marble.active) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(level.emitter.x, level.emitter.y - 12, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(level.emitter.x - 3, level.emitter.y - 15, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 7. Target Cup
    ctx.save();
    const cup = level.cup;
    ctx.fillStyle = this.levelWon ? '#10b981' : '#059669';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cup.x - cup.width / 2, cup.y, cup.width, cup.height, [0, 0, 12, 12]);
    ctx.fill();
    ctx.stroke();

    // Target rim flag or star icon
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', cup.x, cup.y + cup.height / 2);
    ctx.restore();

    // 8. Motion Trail & Active Marble
    if (this.marble.active) {
      for (const t of this.marble.trail) {
        if (t.alpha > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(239, 68, 68, ${t.alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.marble.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.save();
      // Marble body
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.marble.x, this.marble.y, this.marble.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(
        this.marble.x - this.marble.radius * 0.35,
        this.marble.y - this.marble.radius * 0.35,
        this.marble.radius * 0.35,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // 9. Floating Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 10. Bounce Feedbacks
    for (const b of this.bounceFeedbacks) {
      ctx.save();
      ctx.fillStyle = `rgba(251, 191, 36, ${b.alpha})`;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x, b.y);
      ctx.restore();
    }

    // 11. Ghost dragging manipulative
    if (this.isDragging && this.draggingPiece) {
      ctx.save();
      ctx.strokeStyle = this.draggingPiece.color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.8;
      const rad = (this.draggingPiece.angleDeg * Math.PI) / 180;
      const halfL = this.draggingPiece.length / 2;
      const x1 = this.dragCurrentPos.x - halfL * Math.cos(rad);
      const y1 = this.dragCurrentPos.y - halfL * Math.sin(rad);
      const x2 = this.dragCurrentPos.x + halfL * Math.cos(rad);
      const y2 = this.dragCurrentPos.y + halfL * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // --- Protractor Overlay Drawing ---

  private drawProtractorOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    currentDeg: number,
    isRotateHovered: boolean
  ): void {
    const radius = 64;
    ctx.save();

    // Protractor semi-transparent arc disc
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Degree tick marks (every 15°)
    for (let deg = 0; deg <= 180; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 45 === 0;
      const tickLen = isMajor ? 10 : 5;
      const tx1 = x + (radius - tickLen) * Math.cos(rad);
      const ty1 = y + (radius - tickLen) * Math.sin(rad);
      const tx2 = x + radius * Math.cos(rad);
      const ty2 = y + radius * Math.sin(rad);

      ctx.strokeStyle = deg === currentDeg ? '#fbbf24' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = deg === currentDeg ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();
    }

    // Rotation handle circle
    const currentRad = (currentDeg * Math.PI) / 180;
    const handleDist = radius + 14;
    const hx = x + handleDist * Math.cos(currentRad);
    const hy = y + handleDist * Math.sin(currentRad);

    ctx.fillStyle = isRotateHovered ? '#38bdf8' : '#0284c7';
    ctx.strokeStyle = isRotateHovered ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = isRotateHovered ? 3 : 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟳', hx, hy);

    // Angle label bubble
    const cls = classifyAngle(currentDeg);
    const localizedCls = this.t[cls] || cls;
    const labelText = `${currentDeg}° (${localizedCls})`;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 55, y - 32, 110, 20, [4]);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, y - 22);

    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number
  ): void {
    const innerR = outerR * 0.45;
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function createMarbleRunAnglesGame(): KidGame {
  return new MarbleRunAnglesGame();
}

export const createGame = createMarbleRunAnglesGame;
export default createMarbleRunAnglesGame;
