import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup } from '../../src/core/types.js';
import type { SoundEngine } from '../../src/core/audio.js';
import { getTranslations, type PendulumTranslations } from './i18n.js';

// ============================================================================
// 1. DATA TYPES & INTERFACES
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface CircleDef {
  x: number;
  y: number;
  radius: number;
}

export interface BoxDef {
  x: number;
  y: number;
  width: number;
  height: number;
  isCenter?: boolean;
}

export interface CollisionResult {
  collided: boolean;
  contactX: number;
  contactY: number;
  normalX: number;
  normalY: number;
  penetration: number;
  distance: number;
}

export interface BobKinematics {
  x?: number;
  y?: number;
  vx: number;
  vy: number;
  mass: number;
}

export interface BlockKinematics {
  x?: number;
  y?: number;
  vx: number;
  vy: number;
  mass: number;
  width?: number;
  height?: number;
  omega?: number;
}

export interface ImpulseResult {
  impulse: number;
  bobDeltaV: Vec2;
  blockDeltaV: Vec2;
  blockDeltaOmega: number;
}

export interface PendulumState {
  theta: number; // in radians
  omega: number; // in radians/s
  alpha?: number; // in radians/s^2
  length: number; // in meters or scaled
  mass?: number; // in grams
  time?: number; // accumulated seconds
}

export interface PhysicsParams {
  g?: number; // default 9.8 m/s^2
  damping?: number; // default 0 or 0.018
  minAngle?: number;
  maxAngle?: number;
}

export interface BlockItem {
  id: string;
  x: number; // top-left x
  y: number; // top-left y
  width: number;
  height: number;
  mass: number;
  color?: string;
  label?: string;
  angle?: number; // rotation in radians
  vx?: number;
  vy?: number;
  omega?: number;
  isKnocked?: boolean;
}

export interface PedestalDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PendulumConfig {
  id: string;
  pivotX: number;
  pivotY: number;
  length: number; // in cm
  mass: number; // in grams
  bobRadius?: number;
  initialAngleDeg?: number;
  color?: string;
  isAdjustableLength?: boolean;
  allowedLengths?: number[];
  allowedMasses?: number[];
}

export interface MetronomeConfig {
  bpm: number;
  toleranceMs?: number;
  targetStreak?: number;
}

export interface PolyrhythmConfig {
  ratioP: number;
  ratioQ: number;
  targetCoincidences?: number;
}

export interface PendulumLevel {
  id: string;
  levelNumber: number;
  ageGroup: AgeGroup;
  title: string;
  prompt: string;
  promptFr?: string;
  mode: 'knockdown' | 'metronome' | 'polyrhythm';
  pendulums: PendulumConfig[];
  blocks?: BlockItem[];
  pedestal?: PedestalDef;
  metronome?: MetronomeConfig;
  polyrhythm?: PolyrhythmConfig;
  availableLengths?: number[];
  availableMasses?: number[];
}

// Fallback audio dummy object for test or headless environments
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

// ============================================================================
// 2. PURE PHYSICS & MATHEMATICAL FUNCTIONS
// ============================================================================

/**
 * Calculates the theoretical period T of a simple pendulum: T = 2π * sqrt(L / g)
 * @param lengthCm Length of pendulum in centimeters
 * @param g Acceleration due to gravity in m/s² (default: 9.8)
 * @returns Period in seconds, or 0 if length or g <= 0
 */
export function calculatePeriod(lengthCm: number, g: number = 9.8): number {
  if (lengthCm <= 0 || g <= 0 || !Number.isFinite(lengthCm) || !Number.isFinite(g)) {
    return 0;
  }
  const lengthMeters = lengthCm / 100;
  return 2 * Math.PI * Math.sqrt(lengthMeters / g);
}

/**
 * Calculates the frequency f of a simple pendulum: f = 1 / T
 * @param lengthCm Length of pendulum in centimeters
 * @param g Acceleration due to gravity in m/s² (default: 9.8)
 * @returns Frequency in Hz (swings per second), or 0 if invalid
 */
export function calculateFrequency(lengthCm: number, g: number = 9.8): number {
  const period = calculatePeriod(lengthCm, g);
  if (period <= 0) return 0;
  return 1 / period;
}

/**
 * Calculates the length in centimeters needed to achieve a target period T:
 * L = g * (T / 2π)² (meters) -> converted to cm
 * @param periodSec Target period in seconds
 * @param g Acceleration due to gravity in m/s² (default: 9.8)
 * @returns Length in cm, or 0 if period or g <= 0
 */
export function calculateLengthForPeriod(periodSec: number, g: number = 9.8): number {
  if (periodSec <= 0 || g <= 0 || !Number.isFinite(periodSec) || !Number.isFinite(g)) {
    return 0;
  }
  const lengthMeters = g * Math.pow(periodSec / (2 * Math.PI), 2);
  return lengthMeters * 100;
}

/**
 * Calculates the length in cm needed for a pendulum to match a musical BPM tempo.
 * For a standard pendulum where each beat corresponds to a half-cycle swing (left-to-right is 1 beat):
 * beatsPerCycle = 2 by default (so 60 BPM = 1 beat per second = 2-second full cycle).
 * @param bpm Beats per minute (e.g. 60, 90, 120)
 * @param beatsPerCycle Beats per full pendulum cycle (default: 2)
 * @param g Acceleration due to gravity in m/s² (default: 9.8)
 */
export function calculateLengthForBpm(
  bpm: number,
  beatsPerCycle: number = 2,
  g: number = 9.8
): number {
  if (bpm <= 0 || beatsPerCycle <= 0 || !Number.isFinite(bpm)) {
    return 0;
  }
  const periodSec = (60 / bpm) * beatsPerCycle;
  return calculateLengthForPeriod(periodSec, g);
}

/**
 * Calculates the length ratio (L_B / L_A) required for harmonic polyrhythm ratio p:q (f_A : f_B = p : q).
 * Because f ∝ 1 / sqrt(L), f_A / f_B = sqrt(L_B / L_A) = p / q => L_B / L_A = (p / q)²
 * @param ratioP Numerator of frequency ratio (e.g. 2 in 2:1)
 * @param ratioQ Denominator of frequency ratio (e.g. 1 in 2:1)
 * @returns Length ratio (L_B / L_A), or 0 if invalid
 */
export function calculatePolyrhythmLengthRatio(ratioP: number, ratioQ: number): number {
  if (ratioP <= 0 || ratioQ <= 0 || !Number.isFinite(ratioP) || !Number.isFinite(ratioQ)) {
    return 0;
  }
  return Math.pow(ratioP / ratioQ, 2);
}

/**
 * Symplectic semi-implicit Euler integration step for pendulum motion.
 * Area-preserving (symplectic) scheme guarantees zero energy drift over long durations:
 *   alpha(t) = -(g / L) * sin(theta) - damping * omega
 *   omega(t + dt) = omega(t) + alpha(t) * dt
 *   theta(t + dt) = theta(t) + omega(t + dt) * dt
 */
export function simulatePendulumStep(
  state: PendulumState,
  dt: number,
  params: PhysicsParams = {}
): PendulumState {
  const g = params.g ?? 9.8;
  const damping = params.damping ?? 0;
  const clampedDt = Math.max(0, Math.min(dt, 0.033));

  const lengthMeters = Math.max(0.05, state.length);
  const alpha = -(g / lengthMeters) * Math.sin(state.theta) - damping * state.omega;
  const newOmega = state.omega + alpha * clampedDt;
  let newTheta = state.theta + newOmega * clampedDt;

  if (params.minAngle !== undefined && params.maxAngle !== undefined) {
    newTheta = Math.max(params.minAngle, Math.min(params.maxAngle, newTheta));
  }

  return {
    ...state,
    theta: newTheta,
    omega: newOmega,
    alpha,
    time: (state.time || 0) + clampedDt
  };
}

/**
 * Accurate 2D circle vs box contact and penetration test.
 */
export function checkCircleBoxCollision(circle: CircleDef, box: BoxDef): CollisionResult | null {
  const minX = box.isCenter ? box.x - box.width / 2 : box.x;
  const maxX = minX + box.width;
  const minY = box.isCenter ? box.y - box.height / 2 : box.y;
  const maxY = minY + box.height;

  // Closest point on box
  const closestX = Math.max(minX, Math.min(circle.x, maxX));
  const closestY = Math.max(minY, Math.min(circle.y, maxY));

  const distX = circle.x - closestX;
  const distY = circle.y - closestY;
  const distanceSq = distX * distX + distY * distY;

  if (distanceSq > circle.radius * circle.radius) {
    return null;
  }

  const distance = Math.sqrt(distanceSq);
  let normalX = 0;
  let normalY = 0;

  if (distance > 0.0001) {
    normalX = distX / distance;
    normalY = distY / distance;
  } else {
    // Circle center is inside box: push out along minimal axis
    const toLeft = circle.x - minX;
    const toRight = maxX - circle.x;
    const toTop = circle.y - minY;
    const toBottom = maxY - circle.y;
    const minOverlap = Math.min(toLeft, toRight, toTop, toBottom);

    if (minOverlap === toLeft) normalX = -1;
    else if (minOverlap === toRight) normalX = 1;
    else if (minOverlap === toTop) normalY = -1;
    else normalY = 1;
  }

  return {
    collided: true,
    contactX: closestX,
    contactY: closestY,
    normalX,
    normalY,
    penetration: circle.radius - distance,
    distance
  };
}

/**
 * Resolves 2D momentum exchange and angular impulse between swinging bob and block.
 */
export function resolveCollisionImpulse(
  bob: BobKinematics,
  block: BlockKinematics,
  normal: Vec2
): ImpulseResult {
  // normal points from contact surface to bob
  const relVx = bob.vx - block.vx;
  const relVy = bob.vy - block.vy;
  const normalVel = relVx * normal.x + relVy * normal.y;

  // If moving away from each other, no collision impulse
  if (normalVel >= 0) {
    return {
      impulse: 0,
      bobDeltaV: { x: 0, y: 0 },
      blockDeltaV: { x: 0, y: 0 },
      blockDeltaOmega: 0
    };
  }

  const restitution = 0.55;
  const m1 = Math.max(1, bob.mass);
  const m2 = Math.max(1, block.mass);
  const reducedMass = (m1 * m2) / (m1 + m2);

  const J = -(1 + restitution) * normalVel * reducedMass;

  // Impulse along collision normal (block receives forward impulse opposite to normal)
  const impulseVectorBlock = {
    x: -normal.x * J,
    y: -normal.y * J
  };

  const blockDeltaV = {
    x: impulseVectorBlock.x / m2,
    y: impulseVectorBlock.y / m2
  };

  const bobDeltaV = {
    x: (normal.x * J) / m1,
    y: (normal.y * J) / m1
  };

  // Torque and angular velocity increment for block
  const w = block.width || 40;
  const h = block.height || 40;
  const I = (1 / 12) * m2 * (w * w + h * h);
  const leverArm = w * 0.4;
  const torque = J * leverArm * 0.05;
  const blockDeltaOmega = torque / I;

  return {
    impulse: Math.abs(J),
    bobDeltaV,
    blockDeltaV,
    blockDeltaOmega
  };
}

/**
 * Checks whether a pendulum beat event matches the metronome timing within tolerance.
 */
export function checkBeatMatch(
  tPendulum: number,
  tMetronome: number,
  toleranceSec: number = 0.12
): boolean {
  return Math.abs(tPendulum - tMetronome) <= toleranceSec + 1e-9;
}

/**
 * Verifies that a level conforms to pedagogical Anti-Mirroring rules (AGENTS.md Section 4.1).
 */
export function verifyAntiMirroring(level: PendulumLevel): boolean {
  if (level.ageGroup === '3-5') {
    // Single pendulum knockdown doesn't have mirroring issues
    return true;
  }

  if (level.ageGroup === '6-8') {
    // Early elementary: Must provide multiple lengths AND multiple masses
    // To prove Galileo's principle (mass does not alter period, only length does)
    const hasMultipleLengths = (level.availableLengths?.length ?? 0) >= 3;
    const hasMultipleMasses = (level.availableMasses?.length ?? 0) >= 2;
    const hasMetronomeTarget = Boolean(level.metronome && level.metronome.bpm > 0);
    return hasMultipleLengths && hasMultipleMasses && hasMetronomeTarget;
  }

  if (level.ageGroup === '9-11') {
    // Upper elementary: Must require non-linear square-root ratio reasoning (T ∝ √L)
    // Anti-mirroring: Target is given as frequency ratio (e.g. 2:1), requiring (2/1)² = 4:1 length ratio
    const hasPolyrhythmRatio = Boolean(
      level.polyrhythm && level.polyrhythm.ratioP > 0 && level.polyrhythm.ratioQ > 0
    );
    const hasMultipleChoices = (level.availableLengths?.length ?? 0) >= 4;
    return hasPolyrhythmRatio && hasMultipleChoices;
  }

  return true;
}

// ============================================================================
// 3. PROCEDURAL LEVEL GENERATOR & DEFENSIVE CUSTOM LEVEL PARSER
// ============================================================================

export function generateLevelsForAge(ageGroup: AgeGroup): PendulumLevel[] {
  if (ageGroup === '3-5') {
    return [
      {
        id: 'knockdown-1',
        levelNumber: 1,
        ageGroup: '3-5',
        title: 'Gentle Breeze Knockdown',
        prompt: 'Pull back the ball and let go to knock over the blue block!',
        promptFr: 'Tire la boule en arrière et lâche-la pour faire tomber le bloc bleu !',
        mode: 'knockdown',
        pendulums: [
          {
            id: 'wrecking-ball',
            pivotX: 200,
            pivotY: 70,
            length: 70,
            mass: 250,
            bobRadius: 24,
            initialAngleDeg: 0,
            color: '#38bdf8'
          }
        ],
        pedestal: { x: 260, y: 250, width: 110, height: 20 },
        blocks: [
          {
            id: 'block-1',
            x: 270,
            y: 206,
            width: 44,
            height: 44,
            mass: 60,
            color: '#38bdf8',
            label: '1'
          }
        ]
      },
      {
        id: 'knockdown-2',
        levelNumber: 2,
        ageGroup: '3-5',
        title: 'Double Stack Smash',
        prompt: 'Pull back higher (40°+) to smash both stacked blocks!',
        promptFr: 'Tire plus haut (40°+) pour renverser les deux blocs empilés !',
        mode: 'knockdown',
        pendulums: [
          {
            id: 'wrecking-ball',
            pivotX: 200,
            pivotY: 70,
            length: 70,
            mass: 250,
            bobRadius: 24,
            initialAngleDeg: 0,
            color: '#38bdf8'
          }
        ],
        pedestal: { x: 260, y: 250, width: 110, height: 20 },
        blocks: [
          {
            id: 'block-1',
            x: 270,
            y: 206,
            width: 44,
            height: 44,
            mass: 70,
            color: '#38bdf8',
            label: '1'
          },
          {
            id: 'block-2',
            x: 270,
            y: 162,
            width: 44,
            height: 44,
            mass: 50,
            color: '#fbbf24',
            label: '2'
          }
        ]
      },
      {
        id: 'knockdown-3',
        levelNumber: 3,
        ageGroup: '3-5',
        title: 'Fortress Crash',
        prompt: 'Full power smash (60°)! Knock down the fortress tower!',
        promptFr: 'Pleine puissance (60°) ! Fais s\'écrouler la forteresse !',
        mode: 'knockdown',
        pendulums: [
          {
            id: 'wrecking-ball',
            pivotX: 200,
            pivotY: 70,
            length: 70,
            mass: 250,
            bobRadius: 24,
            initialAngleDeg: 0,
            color: '#38bdf8'
          }
        ],
        pedestal: { x: 250, y: 250, width: 130, height: 20 },
        blocks: [
          {
            id: 'block-base-1',
            x: 265,
            y: 206,
            width: 38,
            height: 44,
            mass: 65,
            color: '#38bdf8',
            label: 'A'
          },
          {
            id: 'block-base-2',
            x: 290,
            y: 206,
            width: 38,
            height: 44,
            mass: 65,
            color: '#38bdf8',
            label: 'B'
          },
          {
            id: 'block-topper',
            x: 270,
            y: 172,
            width: 78,
            height: 34,
            mass: 80,
            color: '#ef4444',
            label: '★'
          }
        ]
      }
    ];
  }

  if (ageGroup === '6-8') {
    return [
      {
        id: 'beat-60',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Walking Beat (60 BPM)',
        prompt: 'Match the 60 BPM metronome! Choose string length and test mass.',
        promptFr: 'Ajuste au rythme de 60 BPM ! Choisis la longueur et teste la masse.',
        mode: 'metronome',
        pendulums: [
          {
            id: 'metronome-pendulum',
            pivotX: 300,
            pivotY: 60,
            length: 45, // starts at wrong length (45cm)
            mass: 50,
            bobRadius: 22,
            initialAngleDeg: 25,
            color: '#38bdf8',
            isAdjustableLength: true,
            allowedLengths: [25, 45, 64, 100],
            allowedMasses: [50, 100, 200]
          }
        ],
        metronome: {
          bpm: 60,
          toleranceMs: 140,
          targetStreak: 3
        },
        availableLengths: [25, 45, 64, 100],
        availableMasses: [50, 100, 200]
      },
      {
        id: 'beat-90',
        levelNumber: 2,
        ageGroup: '6-8',
        title: 'Marching Tempo (90 BPM)',
        prompt: 'Match the brisk 90 BPM tempo! Which string length swings faster?',
        promptFr: 'Ajuste au tempo vif de 90 BPM ! Quelle longueur balance plus vite ?',
        mode: 'metronome',
        pendulums: [
          {
            id: 'metronome-pendulum',
            pivotX: 300,
            pivotY: 60,
            length: 100, // starts at wrong length (100cm)
            mass: 100,
            bobRadius: 22,
            initialAngleDeg: 25,
            color: '#38bdf8',
            isAdjustableLength: true,
            allowedLengths: [25, 45, 64, 100],
            allowedMasses: [50, 100, 200]
          }
        ],
        metronome: {
          bpm: 90,
          toleranceMs: 130,
          targetStreak: 3
        },
        availableLengths: [25, 45, 64, 100],
        availableMasses: [50, 100, 200]
      },
      {
        id: 'beat-120',
        levelNumber: 3,
        ageGroup: '6-8',
        title: 'Allegro Rhythm (120 BPM)',
        prompt: 'Match the fast 120 BPM beat! Remember: mass does not change speed!',
        promptFr: 'Ajuste au rythme rapide de 120 BPM ! Rappel : la masse ne change pas la vitesse !',
        mode: 'metronome',
        pendulums: [
          {
            id: 'metronome-pendulum',
            pivotX: 300,
            pivotY: 60,
            length: 64, // starts at wrong length (64cm)
            mass: 200,
            bobRadius: 22,
            initialAngleDeg: 25,
            color: '#38bdf8',
            isAdjustableLength: true,
            allowedLengths: [25, 45, 64, 100],
            allowedMasses: [50, 100, 200]
          }
        ],
        metronome: {
          bpm: 120,
          toleranceMs: 120,
          targetStreak: 3
        },
        availableLengths: [25, 45, 64, 100],
        availableMasses: [50, 100, 200]
      }
    ];
  }

  // Ages 9-11: Harmonic Polyrhythms (Square-root law T ∝ √L)
  return [
    {
      id: 'poly-2-1',
      levelNumber: 1,
      ageGroup: '9-11',
      title: 'The 2:1 Octave Polyrhythm',
      prompt: 'Set Pendulum B so Pendulum A swings 2 times for every 1 swing of B (T ∝ √L).',
      promptFr: 'Règle le pendule B pour que A fasse 2 oscillations pour 1 de B (T ∝ √L).',
      mode: 'polyrhythm',
      pendulums: [
        {
          id: 'pendulum-a',
          pivotX: 220,
          pivotY: 55,
          length: 25,
          mass: 100,
          bobRadius: 18,
          initialAngleDeg: 28,
          color: '#38bdf8',
          isAdjustableLength: false
        },
        {
          id: 'pendulum-b',
          pivotX: 380,
          pivotY: 55,
          length: 50, // wrong length; correct is (2/1)² * 25 = 100cm
          mass: 100,
          bobRadius: 22,
          initialAngleDeg: 28,
          color: '#fbbf24',
          isAdjustableLength: true,
          allowedLengths: [25, 50, 75, 100, 150]
        }
      ],
      polyrhythm: {
        ratioP: 2,
        ratioQ: 1,
        targetCoincidences: 2
      },
      availableLengths: [25, 50, 75, 100, 150]
    },
    {
      id: 'poly-3-1',
      levelNumber: 2,
      ageGroup: '9-11',
      title: 'The 3:1 Triple Swing',
      prompt: 'Set Pendulum B for a 3:1 polyrhythm. Length ratio = (3/1)² = 9!',
      promptFr: 'Règle le pendule B pour un polyrythme 3:1. Rapport de longueur = (3/1)² = 9 !',
      mode: 'polyrhythm',
      pendulums: [
        {
          id: 'pendulum-a',
          pivotX: 220,
          pivotY: 55,
          length: 10,
          mass: 100,
          bobRadius: 16,
          initialAngleDeg: 25,
          color: '#38bdf8',
          isAdjustableLength: false
        },
        {
          id: 'pendulum-b',
          pivotX: 380,
          pivotY: 55,
          length: 40, // wrong length; correct is 3² * 10 = 90cm
          mass: 100,
          bobRadius: 22,
          initialAngleDeg: 25,
          color: '#fbbf24',
          isAdjustableLength: true,
          allowedLengths: [10, 30, 40, 90, 100]
        }
      ],
      polyrhythm: {
        ratioP: 3,
        ratioQ: 1,
        targetCoincidences: 2
      },
      availableLengths: [10, 30, 40, 90, 100]
    },
    {
      id: 'poly-3-2',
      levelNumber: 3,
      ageGroup: '9-11',
      title: 'The 3:2 Musical Hemiola',
      prompt: 'Harmonize a 3:2 polyrhythm! Length ratio = (3/2)² = 2.25!',
      promptFr: 'Harmonise un polyrythme 3:2 ! Rapport de longueur = (3/2)² = 2,25 !',
      mode: 'polyrhythm',
      pendulums: [
        {
          id: 'pendulum-a',
          pivotX: 220,
          pivotY: 55,
          length: 40,
          mass: 100,
          bobRadius: 18,
          initialAngleDeg: 26,
          color: '#38bdf8',
          isAdjustableLength: false
        },
        {
          id: 'pendulum-b',
          pivotX: 380,
          pivotY: 55,
          length: 60, // wrong length; correct is 2.25 * 40 = 90cm
          mass: 100,
          bobRadius: 22,
          initialAngleDeg: 26,
          color: '#fbbf24',
          isAdjustableLength: true,
          allowedLengths: [20, 40, 60, 80, 90, 120]
        }
      ],
      polyrhythm: {
        ratioP: 3,
        ratioQ: 2,
        targetCoincidences: 2
      },
      availableLengths: [20, 40, 60, 80, 90, 120]
    }
  ];
}

/**
 * Defensive parser for external LMS custom levels.
 * Returns null if input is missing, empty, or unparseable, triggering procedural fallback.
 */
export function parseCustomLevels(raw: unknown): PendulumLevel[] | null {
  try {
    if (raw == null) return null;

    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
    }

    if (typeof parsed !== 'object' || parsed === null) return null;

    const rawList = Array.isArray(parsed) ? parsed : [parsed];
    if (rawList.length === 0) return null;

    const validLevels: PendulumLevel[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i] as any;
      if (!item || typeof item !== 'object') continue;

      const ageGroup: AgeGroup =
        item.ageGroup === '3-5' || item.ageGroup === '6-8' || item.ageGroup === '9-11'
          ? item.ageGroup
          : '6-8';

      const mode: 'knockdown' | 'metronome' | 'polyrhythm' =
        item.mode === 'knockdown' || item.mode === 'metronome' || item.mode === 'polyrhythm'
          ? item.mode
          : ageGroup === '3-5'
            ? 'knockdown'
            : ageGroup === '6-8'
              ? 'metronome'
              : 'polyrhythm';

      if (!Array.isArray(item.pendulums) || item.pendulums.length === 0) continue;

      const validPendulums: PendulumConfig[] = [];
      for (let pIdx = 0; pIdx < item.pendulums.length; pIdx++) {
        const p = item.pendulums[pIdx];
        if (!p || typeof p !== 'object') continue;
        const length = Number(p.length);
        const pivotX = Number(p.pivotX);
        const pivotY = Number(p.pivotY);
        if (!Number.isFinite(length) || length <= 0) continue;
        if (!Number.isFinite(pivotX) || !Number.isFinite(pivotY)) continue;

        validPendulums.push({
          id: String(p.id || `p-${pIdx + 1}`),
          pivotX,
          pivotY,
          length,
          mass: Number(p.mass) > 0 ? Number(p.mass) : 100,
          bobRadius: Number(p.bobRadius) > 0 ? Number(p.bobRadius) : 20,
          initialAngleDeg: Number.isFinite(Number(p.initialAngleDeg)) ? Number(p.initialAngleDeg) : 0,
          color: typeof p.color === 'string' ? p.color : '#38bdf8',
          isAdjustableLength: Boolean(p.isAdjustableLength),
          allowedLengths: Array.isArray(p.allowedLengths)
            ? p.allowedLengths.map(Number).filter((n: number) => n > 0)
            : undefined,
          allowedMasses: Array.isArray(p.allowedMasses)
            ? p.allowedMasses.map(Number).filter((n: number) => n > 0)
            : undefined
        });
      }

      if (validPendulums.length === 0) continue;

      // Mode-specific checks
      if (mode === 'knockdown') {
        if (!Array.isArray(item.blocks) || item.blocks.length === 0) continue;
      } else if (mode === 'metronome') {
        const bpm = Number(item.metronome?.bpm);
        if (!Number.isFinite(bpm) || bpm <= 0) continue;
      } else if (mode === 'polyrhythm') {
        const p = Number(item.polyrhythm?.ratioP);
        const q = Number(item.polyrhythm?.ratioQ);
        if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0) continue;
      }

      validLevels.push({
        id: String(item.id || `custom-${validLevels.length + 1}`),
        levelNumber: validLevels.length + 1,
        ageGroup,
        title: String(item.title || `Custom Level ${validLevels.length + 1}`),
        prompt: String(item.prompt || 'Solve the pendulum challenge!'),
        promptFr: item.promptFr ? String(item.promptFr) : undefined,
        mode,
        pendulums: validPendulums,
        blocks: Array.isArray(item.blocks) ? item.blocks : undefined,
        pedestal: item.pedestal && typeof item.pedestal === 'object' ? item.pedestal : undefined,
        metronome: item.metronome && typeof item.metronome === 'object' ? item.metronome : undefined,
        polyrhythm:
          item.polyrhythm && typeof item.polyrhythm === 'object' ? item.polyrhythm : undefined,
        availableLengths: Array.isArray(item.availableLengths)
          ? item.availableLengths.map(Number).filter((n: number) => n > 0)
          : undefined,
        availableMasses: Array.isArray(item.availableMasses)
          ? item.availableMasses.map(Number).filter((n: number) => n > 0)
          : undefined
      });
    }

    return validLevels.length > 0 ? validLevels : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 4. KIDGAME MAIN CLASS (PendulumRhythmGame)
// ============================================================================

export class PendulumRhythmGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private t!: PendulumTranslations;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animFrameId: number | null = null;
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  private levels: PendulumLevel[] = [];
  private currentLevelIndex: number = 0;
  private score: number = 0;
  private streak: number = 0;
  private startTime: number = 0;

  private isPaused: boolean = false;
  private isDestroyed: boolean = false;
  private lastTime: number = 0;
  private isRoundOver: boolean = false;
  private settlingFrames: number = 0;

  // Active pendulum simulation state
  private pendulumsState: Array<{
    config: PendulumConfig;
    theta: number; // current angle (radians)
    omega: number; // angular velocity (rad/s)
    alpha: number; // angular acceleration
    isDragging: boolean;
    lastNadirCrossingTime: number;
    crossingCount: number;
    lastPeakTime: number;
    lastNegPeakTime: number;
  }> = [];

  // Active blocks for preschool knockdown mode
  private activeBlocks: BlockItem[] = [];

  // Metronome timing state
  private metronomeTimer: number = 0;
  private metronomeBeatCount: number = 0;
  private lastMetronomeBeatTime: number = 0;
  private beatMatchStreak: number = 0;

  // Polyrhythm state
  private polyrhythmCoincidences: number = 0;
  private lastCoincidenceTime: number = 0;

  // Drag and click ergonomics
  private pointerDownPos: Vec2 = { x: 0, y: 0 };
  private activeDragIndex: number = -1;
  private isDraggingBeyondThreshold: boolean = false;

  private get audio(): SoundEngine {
    return this.context?.audio || fallbackAudio;
  }

  private get currentLevel(): PendulumLevel {
    return this.levels[this.currentLevelIndex] || this.levels[0];
  }

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();
    this.t = getTranslations(context.locale);
    this.isDestroyed = false;

    if (context.sound !== undefined) {
      this.audio.enabled = context.sound;
    }

    this.score = 0;
    this.streak = 0;
    this.startTime = Date.now();
    this.isRoundOver = false;

    // Load curriculum
    this.loadLevels();

    // Render DOM Scaffold
    this.renderDOM();

    // Setup Canvas 2D
    this.setupCanvas();

    // Setup active level
    this.setupLevel(0);

    // Bind Pointer & Button Events
    this.bindEvents();

    // Emit initial progress
    this.context.emit('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Starting level 1: ${this.currentLevel.title}`
    });
  }

  start(): void {
    if (this.isDestroyed || !this.container || !this.context || this.levels.length === 0) return;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isPaused = false;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  resume(): void {
    if (this.isDestroyed || !this.container || !this.context || this.levels.length === 0) return;
    if (!this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  updateConfig(newContext: Partial<GameContext>): void {
    if (!this.context) return;

    if (newContext.locale && newContext.locale !== this.context.locale) {
      this.context.locale = newContext.locale;
      this.t = getTranslations(newContext.locale);
      this.updateHUDStaticLabels();
      this.updateDynamicInstruction();
    }

    if (newContext.sound !== undefined) {
      this.context.sound = newContext.sound;
      this.audio.enabled = newContext.sound;
      const soundBtn = this.container.querySelector('#btn-sound-toggle');
      if (soundBtn) {
        soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
      }
    }

    if (newContext.ageGroup && newContext.ageGroup !== this.context.ageGroup) {
      this.context.ageGroup = newContext.ageGroup;
      this.loadLevels();
      this.setupLevel(0);
    }

    if (newContext.customLevels !== undefined) {
      this.context.customLevels = newContext.customLevels;
      this.loadLevels();
      this.setupLevel(0);
    }
  }

  destroy(): void {
    this.isDestroyed = true;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  // ============================================================================
  // INTERNAL LOGIC & RENDERING
  // ============================================================================

  private loadLevels(): void {
    let loaded: PendulumLevel[] | null = null;
    if (this.context.customLevels) {
      loaded = parseCustomLevels(this.context.customLevels);
    }
    if (!loaded || loaded.length === 0) {
      loaded = generateLevelsForAge(this.context.ageGroup);
    }
    this.levels = loaded;
    this.currentLevelIndex = 0;
  }

  private setupLevel(index: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(index, this.levels.length - 1));
    const lvl = this.currentLevel;
    this.isRoundOver = false;
    this.settlingFrames = 0;
    this.beatMatchStreak = 0;
    this.polyrhythmCoincidences = 0;
    if (lvl.mode === 'metronome') {
      const bpm = lvl.metronome?.bpm || 60;
      const beatIntervalSec = 60 / bpm;
      this.metronomeTimer = beatIntervalSec / 2;
    } else {
      this.metronomeTimer = 0;
    }
    this.metronomeBeatCount = 0;
    this.lastMetronomeBeatTime = 0;
    this.activeDragIndex = -1;
    this.isDraggingBeyondThreshold = false;

    // Initialize pendulums simulation state
    this.pendulumsState = lvl.pendulums.map((p) => {
      const initRad = ((p.initialAngleDeg || 0) * Math.PI) / 180;
      return {
        config: { ...p },
        theta: initRad,
        omega: 0,
        alpha: 0,
        isDragging: false,
        lastNadirCrossingTime: 0,
        crossingCount: 0,
        lastPeakTime: 0,
        lastNegPeakTime: 0
      };
    });

    // Initialize blocks if knockdown mode
    if (lvl.mode === 'knockdown' && lvl.blocks) {
      this.activeBlocks = lvl.blocks.map((b) => ({
        ...b,
        angle: 0,
        vx: 0,
        vy: 0,
        omega: 0,
        isKnocked: false
      }));
    } else {
      this.activeBlocks = [];
    }

    this.updateHUDStaticLabels();
    this.renderControlsTray();
    this.updateDynamicInstruction();
  }

  private renderDOM(): void {
    this.container.innerHTML = `
      <div id="game-shell" style="display:flex; flex-direction:column; width:100%; height:100%; background:#0f172a; color:#f8fafc; font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; user-select:none; overflow:hidden;">
        <!-- HUD Header -->
        <header id="hud-header" style="min-height:50px; padding:8px 16px; background:#1e293b; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:12px; z-index:10;">
          <!-- Left: Title & Level Badge -->
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="hud-title" style="font-weight:800; font-size:1.05rem; color:#38bdf8;">${this.t.title}</span>
            <span id="level-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 8px; border-radius:12px; font-weight:700; font-size:0.8rem; border:1px solid rgba(56,189,248,0.3);">
              ${this.t.level} 1/${this.levels.length}
            </span>
          </div>

          <!-- Center: Dynamic Pedagogical Instruction -->
          <div id="hud-instruction" style="flex:1; text-align:center; font-weight:600; font-size:0.9rem; color:#f8fafc; padding:0 8px;">
            ${this.currentLevel.prompt}
          </div>

          <!-- Right: Score, Sound & Reset -->
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="score-display" style="font-weight:700; color:#fbbf24; font-size:0.95rem;">⭐ ${this.score}</span>
            <button id="btn-sound-toggle" type="button" style="min-height:44px; min-width:44px; padding:6px 12px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#cbd5e1; font-weight:600; font-size:0.82rem; cursor:pointer;">
              ${this.audio.enabled ? this.t.soundOn : this.t.soundOff}
            </button>
            <button id="btn-reset" type="button" style="min-height:44px; min-width:44px; padding:6px 12px; border-radius:8px; border:1px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.12); color:#fca5a5; font-weight:600; font-size:0.82rem; cursor:pointer;">
              ${this.t.reset}
            </button>
          </div>
        </header>

        <!-- Main Canvas Area -->
        <div id="canvas-container" style="position:relative; flex:1; width:100%; height:100%; min-height:0; overflow:hidden;">
          <canvas id="pendulum-canvas" style="display:block; width:100%; height:100%; touch-action:none;"></canvas>
        </div>

        <!-- Controls Tray -->
        <footer id="controls-tray" style="min-height:64px; background:#1e293b; border-top:1px solid rgba(255,255,255,0.08); padding:8px 16px; display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; z-index:10;">
        </footer>
      </div>
    `;

    this.canvas = this.container.querySelector('#pendulum-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');
  }

  private setupCanvas(): void {
    const resize = () => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = rect.width || 800;
      const height = rect.height || 480;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => resize());
      this.resizeObserver.observe(this.canvas);
    }
    resize();
  }

  private renderControlsTray(): void {
    const tray = this.container.querySelector('#controls-tray');
    if (!tray) return;
    const lvl = this.currentLevel;

    if (lvl.mode === 'knockdown') {
      tray.innerHTML = `
        <span style="font-size:0.85rem; color:#94a3b8; font-weight:600;">Presets:</span>
        <button type="button" data-angle="20" class="btn-preset" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#38bdf8; font-weight:600; cursor:pointer;">
          ${this.t.gentlePreset}
        </button>
        <button type="button" data-angle="40" class="btn-preset" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#fbbf24; font-weight:600; cursor:pointer;">
          ${this.t.mediumPreset}
        </button>
        <button type="button" data-angle="60" class="btn-preset" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#ef4444; font-weight:600; cursor:pointer;">
          ${this.t.smashPreset}
        </button>
        <button type="button" id="btn-reset-blocks" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #475569; background:#334155; color:#f8fafc; font-weight:600; cursor:pointer;">
          ${this.t.resetBlocks}
        </button>
      `;
    } else if (lvl.mode === 'metronome') {
      const pState = this.pendulumsState[0];
      const curL = pState ? pState.config.length : 45;
      const curM = pState ? pState.config.mass : 100;

      const lengthsHtml = (lvl.availableLengths || [25, 45, 64, 100])
        .map(
          (len) => `
          <button type="button" data-length="${len}" class="btn-length" style="min-height:44px; padding:6px 12px; border-radius:8px; border:1px solid ${len === curL ? '#38bdf8' : '#334155'}; background:${len === curL ? 'rgba(56,189,248,0.2)' : '#0f172a'}; color:${len === curL ? '#38bdf8' : '#cbd5e1'}; font-weight:700; cursor:pointer;">
            ${len}cm
          </button>
        `
        )
        .join('');

      const massesHtml = (lvl.availableMasses || [50, 100, 200])
        .map(
          (m) => `
          <button type="button" data-mass="${m}" class="btn-mass" style="min-height:44px; padding:6px 12px; border-radius:8px; border:1px solid ${m === curM ? '#fbbf24' : '#334155'}; background:${m === curM ? 'rgba(251,191,36,0.2)' : '#0f172a'}; color:${m === curM ? '#fbbf24' : '#cbd5e1'}; font-weight:700; cursor:pointer;">
            ${m}g
          </button>
        `
        )
        .join('');

      tray.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.85rem; color:#94a3b8; font-weight:600;">Length:</span>
          ${lengthsHtml}
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin-left:12px;">
          <span style="font-size:0.85rem; color:#94a3b8; font-weight:600;">Mass:</span>
          ${massesHtml}
        </div>
        <button type="button" id="btn-release-swing" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #10b981; background:rgba(16,185,129,0.2); color:#10b981; font-weight:700; cursor:pointer; margin-left:8px;">
          ${this.t.resetSwing}
        </button>
      `;
    } else if (lvl.mode === 'polyrhythm') {
      const pB = this.pendulumsState[1];
      const curL = pB ? pB.config.length : 50;

      const lengthsHtml = (lvl.availableLengths || [25, 50, 75, 100, 150])
        .map(
          (len) => `
          <button type="button" data-length-b="${len}" class="btn-length-b" style="min-height:44px; padding:6px 12px; border-radius:8px; border:1px solid ${len === curL ? '#fbbf24' : '#334155'}; background:${len === curL ? 'rgba(251,191,36,0.2)' : '#0f172a'}; color:${len === curL ? '#fbbf24' : '#cbd5e1'}; font-weight:700; cursor:pointer;">
            ${len}cm
          </button>
        `
        )
        .join('');

      tray.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.85rem; color:#fbbf24; font-weight:600;">Pendulum B Length:</span>
          ${lengthsHtml}
        </div>
        <button type="button" id="btn-release-both" style="min-height:44px; padding:6px 14px; border-radius:8px; border:1px solid #38bdf8; background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:700; cursor:pointer; margin-left:12px;">
          ${this.t.releaseBoth}
        </button>
      `;
    }
  }

  private updateHUDStaticLabels(): void {
    const titleEl = this.container.querySelector('#hud-title');
    if (titleEl) titleEl.textContent = this.t.title;

    const badgeEl = this.container.querySelector('#level-badge');
    if (badgeEl) {
      badgeEl.textContent = `${this.t.level} ${this.currentLevelIndex + 1}/${this.levels.length}`;
    }

    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
    }

    const resetBtn = this.container.querySelector('#btn-reset');
    if (resetBtn) resetBtn.textContent = this.t.reset;

    const scoreEl = this.container.querySelector('#score-display');
    if (scoreEl) scoreEl.textContent = `⭐ ${this.score}`;
  }

  private updateDynamicInstruction(): void {
    const instructionEl = this.container.querySelector('#hud-instruction');
    if (!instructionEl) return;
    const lvl = this.currentLevel;

    if (lvl.mode === 'knockdown') {
      const remaining = this.activeBlocks.filter((b) => !b.isKnocked).length;
      const angleDeg = Math.round(
        Math.abs(((this.pendulumsState[0]?.theta || 0) * 180) / Math.PI)
      );
      instructionEl.textContent = this.t.formatPreschoolPrompt(angleDeg, remaining);
    } else if (lvl.mode === 'metronome') {
      const bpm = lvl.metronome?.bpm || 60;
      const targetStreak = lvl.metronome?.targetStreak || 3;
      const curL = this.pendulumsState[0]?.config.length || 45;
      const curM = this.pendulumsState[0]?.config.mass || 100;
      instructionEl.textContent = this.t.formatElementaryPrompt(
        bpm,
        curL,
        curM,
        this.beatMatchStreak,
        targetStreak
      );
    } else if (lvl.mode === 'polyrhythm') {
      const p = lvl.polyrhythm?.ratioP || 2;
      const q = lvl.polyrhythm?.ratioQ || 1;
      const targetRatioStr = `${p}:${q}`;
      const lenA = this.pendulumsState[0]?.config.length || 25;
      const lenB = this.pendulumsState[1]?.config.length || 100;
      const approxFreqRatio = Math.sqrt(lenB / lenA);
      const currentRatioStr = `${approxFreqRatio.toFixed(2)}:1`;
      const targetCoincidences = lvl.polyrhythm?.targetCoincidences || 2;

      instructionEl.textContent = this.t.formatUpperPrompt(
        targetRatioStr,
        lenA,
        lenB,
        currentRatioStr,
        this.polyrhythmCoincidences,
        targetCoincidences
      );
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    // Sound toggle
    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    soundBtn?.addEventListener(
      'click',
      () => {
        this.audio.enabled = !this.audio.enabled;
        this.context.sound = this.audio.enabled;
        this.audio.playClick();
        if (soundBtn) {
          soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
        }
      },
      { signal }
    );

    // Level Reset
    const resetBtn = this.container.querySelector('#btn-reset');
    resetBtn?.addEventListener(
      'click',
      () => {
        this.audio.playPop();
        this.setupLevel(this.currentLevelIndex);
      },
      { signal }
    );

    // Controls Tray delegation
    const tray = this.container.querySelector('#controls-tray');
    tray?.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        // Preschool presets
        const presetBtn = target.closest('.btn-preset') as HTMLElement;
        if (presetBtn && presetBtn.dataset.angle) {
          const angleDeg = Number(presetBtn.dataset.angle);
          if (this.pendulumsState[0]) {
            this.pendulumsState[0].theta = -(angleDeg * Math.PI) / 180;
            this.pendulumsState[0].omega = 0;
            this.audio.playClick();
            this.updateDynamicInstruction();
          }
          return;
        }

        // Reset blocks in preschool
        if (target.id === 'btn-reset-blocks') {
          this.audio.playPop();
          if (this.currentLevel.blocks) {
            this.activeBlocks = this.currentLevel.blocks.map((b) => ({
              ...b,
              angle: 0,
              vx: 0,
              vy: 0,
              omega: 0,
              isKnocked: false
            }));
            this.updateDynamicInstruction();
          }
          return;
        }

        // Elementary Length button
        const lenBtn = target.closest('.btn-length') as HTMLElement;
        if (lenBtn && lenBtn.dataset.length) {
          const newLen = Number(lenBtn.dataset.length);
          if (this.pendulumsState[0]) {
            this.pendulumsState[0].config.length = newLen;
            this.pendulumsState[0].theta = (25 * Math.PI) / 180;
            this.pendulumsState[0].omega = 0;
            this.pendulumsState[0].lastNadirCrossingTime = 0;
            this.beatMatchStreak = 0;
            const bpm = this.currentLevel.metronome?.bpm || 60;
            const beatIntervalSec = 60 / bpm;
            this.metronomeTimer = beatIntervalSec / 2;
            this.audio.playClick();
            this.renderControlsTray();
            this.updateDynamicInstruction();
          }
          return;
        }

        // Elementary Mass button
        const massBtn = target.closest('.btn-mass') as HTMLElement;
        if (massBtn && massBtn.dataset.mass) {
          const newMass = Number(massBtn.dataset.mass);
          if (this.pendulumsState[0]) {
            this.pendulumsState[0].config.mass = newMass;
            this.audio.playPop();
            this.renderControlsTray();
            this.updateDynamicInstruction();
          }
          return;
        }

        // Elementary Release / Reset swing
        if (target.id === 'btn-release-swing') {
          if (this.pendulumsState[0]) {
            this.pendulumsState[0].theta = (25 * Math.PI) / 180;
            this.pendulumsState[0].omega = 0;
            this.beatMatchStreak = 0;
            this.audio.playPop();
            this.updateDynamicInstruction();
          }
          return;
        }

        // Upper Elementary Polyrhythm Length B button
        const lenBBtn = target.closest('.btn-length-b') as HTMLElement;
        if (lenBBtn && lenBBtn.dataset.lengthB) {
          const newLenB = Number(lenBBtn.dataset.lengthB);
          if (this.pendulumsState[1]) {
            this.pendulumsState[1].config.length = newLenB;
            this.pendulumsState[0].theta = (26 * Math.PI) / 180;
            this.pendulumsState[0].omega = 0;
            this.pendulumsState[0].lastPeakTime = 0;
            this.pendulumsState[0].lastNegPeakTime = 0;
            this.pendulumsState[0].lastNadirCrossingTime = 0;
            this.pendulumsState[1].theta = (26 * Math.PI) / 180;
            this.pendulumsState[1].omega = 0;
            this.pendulumsState[1].lastPeakTime = 0;
            this.pendulumsState[1].lastNegPeakTime = 0;
            this.pendulumsState[1].lastNadirCrossingTime = 0;
            this.polyrhythmCoincidences = 0;
            this.settlingFrames = 0;
            this.lastCoincidenceTime = performance.now();
            this.audio.playClick();
            this.renderControlsTray();
            this.updateDynamicInstruction();
          }
          return;
        }

        // Upper Elementary Release Both
        if (target.id === 'btn-release-both') {
          if (this.pendulumsState[0] && this.pendulumsState[1]) {
            this.pendulumsState[0].theta = (26 * Math.PI) / 180;
            this.pendulumsState[0].omega = 0;
            this.pendulumsState[0].lastPeakTime = 0;
            this.pendulumsState[0].lastNegPeakTime = 0;
            this.pendulumsState[0].lastNadirCrossingTime = 0;
            this.pendulumsState[1].theta = (26 * Math.PI) / 180;
            this.pendulumsState[1].omega = 0;
            this.pendulumsState[1].lastPeakTime = 0;
            this.pendulumsState[1].lastNegPeakTime = 0;
            this.pendulumsState[1].lastNadirCrossingTime = 0;
            this.polyrhythmCoincidences = 0;
            this.settlingFrames = 0;
            this.lastCoincidenceTime = performance.now();
            this.audio.playPop();
            this.updateDynamicInstruction();
          }
        }
      },
      { signal }
    );

    // Pointer events on canvas
    this.canvas.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        this.pointerDownPos = { x: px, y: py };
        this.isDraggingBeyondThreshold = false;

        // Check if pointer is near any pendulum bob
        for (let i = 0; i < this.pendulumsState.length; i++) {
          const p = this.pendulumsState[i];
          const lenPx = this.getLengthInPixels(p.config.length);
          const bobX = p.config.pivotX + lenPx * Math.sin(p.theta);
          const bobY = p.config.pivotY + lenPx * Math.cos(p.theta);
          const hitRadius = Math.max(30, p.config.bobRadius || 22);

          const dist = Math.hypot(px - bobX, py - bobY);
          if (dist <= hitRadius) {
            this.activeDragIndex = i;
            p.isDragging = true;
            p.omega = 0;
            this.audio.playPop();
            break;
          }
        }
      },
      { signal }
    );

    // Window-level pointer tracking
    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (this.activeDragIndex === -1) return;
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        if (
          !this.isDraggingBeyondThreshold &&
          Math.hypot(px - this.pointerDownPos.x, py - this.pointerDownPos.y) > 5
        ) {
          this.isDraggingBeyondThreshold = true;
        }

        const p = this.pendulumsState[this.activeDragIndex];
        if (p) {
          const dx = px - p.config.pivotX;
          const dy = py - p.config.pivotY;
          let angle = Math.atan2(dx, dy); // 0 is hanging straight down
          // Clamp angle within [-75°, 75°]
          const maxRad = (75 * Math.PI) / 180;
          angle = Math.max(-maxRad, Math.min(maxRad, angle));
          p.theta = angle;
          p.omega = 0;
          this.updateDynamicInstruction();
        }
      },
      { signal }
    );

    const onPointerUp = () => {
      if (this.activeDragIndex !== -1) {
        const p = this.pendulumsState[this.activeDragIndex];
        if (p) {
          p.isDragging = false;
          p.omega = 0;
          p.lastPeakTime = 0;
          p.lastNegPeakTime = 0;
          p.lastNadirCrossingTime = 0;
        }
        if (this.currentLevel.mode === 'polyrhythm') {
          this.polyrhythmCoincidences = 0;
          this.settlingFrames = 0;
          this.lastCoincidenceTime = performance.now();
        } else if (this.currentLevel.mode === 'metronome') {
          const bpm = this.currentLevel.metronome?.bpm || 60;
          const beatIntervalSec = 60 / bpm;
          this.metronomeTimer = beatIntervalSec / 2;
          this.beatMatchStreak = 0;
        }
        this.activeDragIndex = -1;
        this.audio.playDrop();
      }
    };

    window.addEventListener('pointerup', onPointerUp, { signal });
    window.addEventListener('pointercancel', onPointerUp, { signal });
  }

  private getLengthInPixels(lengthCm: number): number {
    // Map real metric lengths (10cm - 150cm) to canvas pixels (~80px - 260px)
    const minL = 10;
    const maxL = 150;
    const minPx = 70;
    const maxPx = 250;
    const clamped = Math.max(minL, Math.min(maxL, lengthCm));
    return minPx + ((clamped - minL) / (maxL - minL)) * (maxPx - minPx);
  }

  private tick(timestamp: number): void {
    if (this.isPaused) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.033);
    this.lastTime = timestamp;

    this.updatePhysics(dt, timestamp);
    this.render();

    this.animFrameId = requestAnimationFrame((ts) => this.tick(ts));
  }

  private updatePhysics(dt: number, timestamp: number): void {
    const lvl = this.currentLevel;

    // 1. Update Pendulums via symplectic semi-implicit Euler
    for (let i = 0; i < this.pendulumsState.length; i++) {
      const p = this.pendulumsState[i];
      if (p.isDragging) continue;

      const lengthM = Math.max(0.1, p.config.length / 100);
      const damping = lvl.mode === 'knockdown' ? 0.015 : 0; // zero damping in timing modes for exact harmonics
      const state: PendulumState = {
        theta: p.theta,
        omega: p.omega,
        alpha: p.alpha,
        length: lengthM
      };

      const newState = simulatePendulumStep(state, dt, { g: 9.8, damping });
      const prevTheta = p.theta;
      const prevOmega = p.omega;
      p.theta = newState.theta;
      p.omega = newState.omega;
      p.alpha = newState.alpha || 0;

      // Check Nadir Crossing (theta crosses 0)
      if ((prevTheta < 0 && p.theta >= 0) || (prevTheta > 0 && p.theta <= 0)) {
        p.crossingCount++;
        p.lastNadirCrossingTime = timestamp;
        if (this.audio.enabled && !this.isRoundOver) {
          if (lvl.mode === 'polyrhythm') {
            const freq = i === 0 ? 880 : 440;
            this.audio.playTone(freq, 0.04, 'triangle');
          }
        }
      }

      // Check Positive Peak Turnaround (omega crosses 0 while theta > 0)
      if (prevOmega >= 0 && p.omega < 0 && p.theta > 0.05) {
        p.lastPeakTime = timestamp;
      }

      // Check Negative Peak Turnaround (omega crosses 0 while theta < 0)
      if (prevOmega <= 0 && p.omega > 0 && p.theta < -0.05) {
        p.lastNegPeakTime = timestamp;
      }
    }

    // 2. Mode-Specific Mechanics
    if (lvl.mode === 'knockdown') {
      this.updateKnockdownMode(dt);
    } else if (lvl.mode === 'metronome') {
      this.updateMetronomeMode(dt, timestamp);
    } else if (lvl.mode === 'polyrhythm') {
      this.updatePolyrhythmMode(timestamp);
    }
  }

  private updateKnockdownMode(dt: number): void {
    const p = this.pendulumsState[0];
    if (!p) return;

    const lenPx = this.getLengthInPixels(p.config.length);
    const bobX = p.config.pivotX + lenPx * Math.sin(p.theta);
    const bobY = p.config.pivotY + lenPx * Math.cos(p.theta);
    const bobRadius = p.config.bobRadius || 24;

    const bobVx = lenPx * p.omega * Math.cos(p.theta);
    const bobVy = -lenPx * p.omega * Math.sin(p.theta);

    // Collision detection against active blocks
    for (const block of this.activeBlocks) {
      if (block.isKnocked) continue;

      const circle: CircleDef = { x: bobX, y: bobY, radius: bobRadius };
      const box: BoxDef = {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        isCenter: false
      };

      const collision = checkCircleBoxCollision(circle, box);
      if (collision && collision.collided) {
        const bobK: BobKinematics = { vx: bobVx, vy: bobVy, mass: p.config.mass };
        const blockK: BlockKinematics = {
          vx: block.vx || 0,
          vy: block.vy || 0,
          mass: block.mass,
          width: block.width,
          height: block.height
        };

        const impulseResult = resolveCollisionImpulse(bobK, blockK, {
          x: collision.normalX,
          y: collision.normalY
        });

        // Impart impulse
        block.vx = (block.vx || 0) + impulseResult.blockDeltaV.x;
        block.vy = (block.vy || 0) + impulseResult.blockDeltaV.y - 40; // slight lift
        block.omega = (block.omega || 0) + impulseResult.blockDeltaOmega + 3.0;

        // Bob rebound
        p.omega -= (impulseResult.impulse * 0.003) / Math.max(1, p.config.mass);

        this.audio.playDrop();
      }
    }

    // Update block physics (falling & tumbling)
    const pedestalY = this.currentLevel.pedestal?.y ?? 250;
    let allKnocked = true;

    for (const block of this.activeBlocks) {
      if (Math.abs(block.vx || 0) > 0.1 || Math.abs(block.vy || 0) > 0.1 || (block.angle || 0) > 0.1) {
        block.x += (block.vx || 0) * dt;
        block.y += (block.vy || 0) * dt;
        block.vy = (block.vy || 0) + 400 * dt; // gravity
        block.angle = (block.angle || 0) + (block.omega || 0) * dt;

        // Ground floor bounce
        if (block.y > 380) {
          block.y = 380;
          block.vy = -(block.vy || 0) * 0.3;
          block.vx = (block.vx || 0) * 0.8;
          block.omega = (block.omega || 0) * 0.7;
        }

        // Check if knocked off pedestal
        if (block.y > pedestalY + 15 || Math.abs(block.angle || 0) > 0.6) {
          block.isKnocked = true;
        }
      }

      if (!block.isKnocked) {
        allKnocked = false;
      }
    }

    if (allKnocked && !this.isRoundOver) {
      this.settlingFrames++;
      if (this.settlingFrames > 35) {
        // ~0.6s confirmation window
        this.completeRound();
      }
    }
  }

  private updateMetronomeMode(dt: number, timestamp: number): void {
    const lvl = this.currentLevel;
    const bpm = lvl.metronome?.bpm || 60;
    const beatIntervalSec = 60 / bpm;
    const targetStreak = lvl.metronome?.targetStreak || 3;

    // Settling confirmation window at 60Hz (~0.5s - 0.6s)
    if (this.beatMatchStreak >= targetStreak && !this.isRoundOver) {
      this.settlingFrames++;
      if (this.settlingFrames > 35) {
        this.completeRound();
      }
      return;
    }

    this.metronomeTimer += dt;
    if (this.metronomeTimer >= beatIntervalSec) {
      this.metronomeTimer -= beatIntervalSec;
      this.metronomeBeatCount++;
      this.lastMetronomeBeatTime = timestamp;

      // Acoustic & visual tick
      this.audio.playClick();

      // Check synchronization with pendulum swing using pure checkBeatMatch
      const p = this.pendulumsState[0];
      if (p && !p.isDragging && p.lastNadirCrossingTime > 0) {
        const tolerance = (lvl.metronome?.toleranceMs || 140) / 1000;
        const timeDiff = Math.abs(this.lastMetronomeBeatTime - p.lastNadirCrossingTime) / 1000;
        const isMatched =
          checkBeatMatch(
            p.lastNadirCrossingTime / 1000,
            this.lastMetronomeBeatTime / 1000,
            tolerance
          ) || Math.abs(timeDiff - beatIntervalSec) <= tolerance;

        if (isMatched) {
          this.beatMatchStreak++;
          this.audio.playChime();
          this.updateDynamicInstruction();
        } else {
          // If out of sync, reset streak
          if (this.beatMatchStreak > 0) {
            this.beatMatchStreak = 0;
            this.updateDynamicInstruction();
          }
        }
      }
    }
  }

  private updatePolyrhythmMode(timestamp: number): void {
    const lvl = this.currentLevel;
    const targetCoincidences = lvl.polyrhythm?.targetCoincidences || 2;
    const pA = this.pendulumsState[0];
    const pB = this.pendulumsState[1];

    if (!pA || !pB) return;

    // Settling check: once target coincidences reached, increment settlingFrames at 60Hz (~0.5s - 0.6s)
    if (this.polyrhythmCoincidences >= targetCoincidences && !this.isRoundOver) {
      this.settlingFrames++;
      if (this.settlingFrames > 35) {
        this.completeRound();
      }
      return;
    }

    if (pA.isDragging || pB.isDragging) return;

    // Gate polyrhythm coincidence checking so that coincidences are ONLY awarded if the actual length ratio matches the target ratio within tolerance
    if (lvl.polyrhythm && lvl.polyrhythm.ratioP && lvl.polyrhythm.ratioQ) {
      const targetRatio = Math.pow(lvl.polyrhythm.ratioP / lvl.polyrhythm.ratioQ, 2);
      const actualRatio = pB.config.length / pA.config.length;
      if (Math.abs(actualRatio - targetRatio) > 0.1) return;
    }

    // Harmonic coincidence detection:
    // 1. Positive peak turnaround coincidence (both reach positive peak extrema together)
    const isPosPeakMatch =
      pA.lastPeakTime > 0 &&
      pB.lastPeakTime > 0 &&
      Math.abs(pA.lastPeakTime - pB.lastPeakTime) <= 120 &&
      pA.theta > 0.05 &&
      pB.theta > 0.05;

    // 2. Negative peak turnaround coincidence (both reach negative peak extrema together)
    const isNegPeakMatch =
      pA.lastNegPeakTime > 0 &&
      pB.lastNegPeakTime > 0 &&
      Math.abs(pA.lastNegPeakTime - pB.lastNegPeakTime) <= 120 &&
      pA.theta < -0.05 &&
      pB.theta < -0.05;

    // 3. Nadir crossing coincidence (both cross center within 80ms)
    const isNadirMatch =
      pA.lastNadirCrossingTime > 0 &&
      pB.lastNadirCrossingTime > 0 &&
      Math.abs(pA.lastNadirCrossingTime - pB.lastNadirCrossingTime) <= 80;

    const isCoincident = isPosPeakMatch || isNegPeakMatch || isNadirMatch;

    if (isCoincident && timestamp - this.lastCoincidenceTime > 600) {
      this.lastCoincidenceTime = timestamp;
      this.polyrhythmCoincidences++;
      this.audio.playChime();
      this.updateDynamicInstruction();
    }
  }

  private completeRound(): void {
    this.isRoundOver = true;
    this.score += 100;
    this.streak++;

    // Audio & celebratory confetti
    this.audio.playSuccess();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 }
    });

    const isLastLevel = this.currentLevelIndex >= this.levels.length - 1;

    // Emit telemetry score & progress
    this.context.emit('game:score', {
      points: this.score,
      streak: this.streak,
      delta: 100
    });

    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: `Completed level ${this.currentLevelIndex + 1}: ${this.currentLevel.title}`
    });

    // Advance or complete
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      if (isLastLevel) {
        this.context.emit('game:complete', {
          stars: 3,
          score: this.score,
          timeElapsed: Math.round((Date.now() - this.startTime) / 1000),
          summary: this.t.summary
        });
      } else {
        this.setupLevel(this.currentLevelIndex + 1);
      }
    }, 1200);
    this.pendingTimeouts.add(timeoutId);
  }

  // ============================================================================
  // CANVAS RENDERING
  // ============================================================================

  private render(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 480;

    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const lvl = this.currentLevel;

    // Render mode background elements
    if (lvl.mode === 'knockdown') {
      this.renderPedestalAndBlocks(ctx);
    } else if (lvl.mode === 'metronome') {
      this.renderMetronome(ctx, width);
    } else if (lvl.mode === 'polyrhythm') {
      this.renderPolyrhythmGrid(ctx, width);
    }

    // Render pendulums
    for (let i = 0; i < this.pendulumsState.length; i++) {
      this.renderPendulum(ctx, this.pendulumsState[i], i);
    }
  }

  private renderPendulum(
    ctx: CanvasRenderingContext2D,
    p: (typeof this.pendulumsState)[0],
    index: number
  ): void {
    const lenPx = this.getLengthInPixels(p.config.length);
    const pivotX = p.config.pivotX;
    const pivotY = p.config.pivotY;
    const bobX = pivotX + lenPx * Math.sin(p.theta);
    const bobY = pivotY + lenPx * Math.cos(p.theta);
    const bobRadius = p.config.bobRadius || 22;

    // 1. Pivot mount bar
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.fillRect(pivotX - 16, pivotY - 8, 32, 10);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.restore();

    // 2. Trajectory arc guide
    ctx.save();
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, lenPx, Math.PI / 2 - 1.1, Math.PI / 2 + 1.1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // 3. String
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = p.isDragging ? '#38bdf8' : 'rgba(203, 213, 225, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 4. Bob with shadow and gradient
    ctx.save();
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = p.config.color || (index === 0 ? '#38bdf8' : '#fbbf24');
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fill();

    // Highlight sheen
    ctx.beginPath();
    ctx.ellipse(bobX - bobRadius * 0.3, bobY - bobRadius * 0.3, bobRadius * 0.35, bobRadius * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    ctx.restore();

    // 5. Length / Mass label chip beside bob
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.config.length}cm`, bobX, bobY + bobRadius + 14);
    if (this.currentLevel.mode === 'metronome') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`${p.config.mass}g`, bobX, bobY + bobRadius + 26);
    }
    ctx.restore();
  }

  private renderPedestalAndBlocks(ctx: CanvasRenderingContext2D): void {
    const ped = this.currentLevel.pedestal;
    if (ped) {
      // Pedestal stand
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.fillRect(ped.x, ped.y, ped.width, ped.height);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(ped.x, ped.y, ped.width, ped.height);
      ctx.restore();
    }

    // Active wooden toy blocks
    for (const b of this.activeBlocks) {
      ctx.save();
      ctx.translate(b.x + b.width / 2, b.y + b.height / 2);
      if (b.angle) {
        ctx.rotate(b.angle);
      }
      ctx.fillStyle = b.color || '#38bdf8';
      ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

      if (b.label) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, 0, 0);
      }
      ctx.restore();
    }
  }

  private renderMetronome(ctx: CanvasRenderingContext2D, width: number): void {
    const bpm = this.currentLevel.metronome?.bpm || 60;
    const mx = width - 140;
    const my = 180;

    ctx.save();
    // Metronome wooden body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 30, my + 60);
    ctx.lineTo(mx - 15, my - 60);
    ctx.lineTo(mx + 15, my - 60);
    ctx.lineTo(mx + 30, my + 60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Metronome pendulum wand
    const wandAngle = Math.sin((this.metronomeTimer / (60 / bpm)) * Math.PI * 2) * 0.45;
    ctx.save();
    ctx.translate(mx, my + 45);
    ctx.rotate(wandAngle);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -90);
    ctx.stroke();
    // Sliding weight
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-6, -65, 12, 10);
    ctx.restore();

    // Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`🎵 ${bpm} BPM`, mx, my + 82);

    // Sync streak dots
    const targetStreak = this.currentLevel.metronome?.targetStreak || 3;
    for (let s = 0; s < targetStreak; s++) {
      ctx.beginPath();
      ctx.arc(mx - 20 + s * 20, my + 98, 5, 0, Math.PI * 2);
      ctx.fillStyle = s < this.beatMatchStreak ? '#10b981' : '#334155';
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPolyrhythmGrid(ctx: CanvasRenderingContext2D, width: number): void {
    const lvl = this.currentLevel;
    const p = lvl.polyrhythm?.ratioP || 2;
    const q = lvl.polyrhythm?.ratioQ || 1;

    ctx.save();
    // Nadir optical sensors line
    ctx.beginPath();
    ctx.moveTo(140, 310);
    ctx.lineTo(width - 140, 310);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.stroke();

    // Ratio badge
    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Polyrhythm Ratio ${p}:${q}`, width / 2, 28);

    // Coincidence indicator
    const targetCoincidences = lvl.polyrhythm?.targetCoincidences || 2;
    for (let c = 0; c < targetCoincidences; c++) {
      ctx.beginPath();
      ctx.arc(width / 2 - 15 + c * 30, 48, 6, 0, Math.PI * 2);
      ctx.fillStyle = c < this.polyrhythmCoincidences ? '#10b981' : '#334155';
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================================
// 5. CARTRIDGE ENTRYPOINT FACTORIES
// ============================================================================

export function createGame(): KidGame {
  return new PendulumRhythmGame();
}

export default createGame;
