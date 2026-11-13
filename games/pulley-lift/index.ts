import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup } from '../../src/core/types.js';
import type { SoundEngine } from '../../src/core/audio.js';
import { getTranslations, type PulleyTranslations } from './i18n.js';

// ============================================================================
// 1. DATA TYPES & INTERFACES
// ============================================================================

export type PulleySystemType = 'fixed-1' | 'movable-2' | 'compound-3' | 'compound-4';
export type MechanicalAdvantage = 1 | 2 | 3 | 4;

export interface CounterWeight {
  id: string;
  kg: number;
  massKg: number;
  label: string;
  color: string;
}

export interface PulleyWheel {
  id: string;
  isMovable: boolean;
  centerX: number;
  centerY: number;
  radius: number;
}

export interface RopeSegment {
  type: 'line' | 'arc';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  counterClockwise?: boolean;
}

export interface PulleyLevel {
  id: string;
  levelNumber: number;
  ageGroup: AgeGroup;
  title: string;
  systemType: PulleySystemType;
  mechanicalAdvantage: MechanicalAdvantage;
  loadKg: number;
  targetHeightM: number;
  availableWeights: CounterWeight[];
  targetEffortKg: number;
  targetWorkJoules: number;
  ropeDistanceM: number;
  solutionCombinations?: number[][];
  distractorWeights?: number[];
  antiMirroringEnforced?: boolean;
  antiMirroring?: boolean;
  instruction?: string;
}

export interface SimulationResult {
  won: boolean;
  loadHeightM: number;
  effortDisplacementM: number;
  settlingTime: number;
  workJoules: number;
  overshot: boolean;
  equilibrium: boolean;
  tensionN: number;
  effortKg: number;
}

export interface PulleyPhysicsState {
  liftProgress: number;     // [0, 1]
  velocity: number;
  effortMassKg: number;
  tensionForceN: number;
  loadForceN: number;
  workLoadJoules: number;
  workEffortJoules: number;
  isEquilibrium: boolean;
  isOverloaded: boolean;
  settledFrames: number;
  isComplete: boolean;
}

export interface CustomWeightInput {
  id?: string;
  kg?: number;
  massKg?: number;
  weight?: number;
  mass?: number;
  label?: string;
  color?: string;
}

export interface CustomLevelInput {
  id?: string;
  title?: string;
  systemType?: string | number;
  ma?: number;
  mechanicalAdvantage?: number;
  loadKg?: number;
  targetLoadKg?: number;
  load?: number;
  targetHeightM?: number;
  targetHeightMeters?: number;
  height?: number;
  availableWeights?: (number | string | CustomWeightInput)[];
  weights?: (number | string | CustomWeightInput)[];
  inventory?: (number | string | CustomWeightInput)[];
  instruction?: string;
  customInstruction?: string;
}

// ============================================================================
// 2. CONSTANTS & PALETTE
// ============================================================================

export const GRAVITY_G = 9.8;

export const WEIGHT_PALETTE: Record<number, { label: string; color: string }> = {
  10: { label: '10 kg', color: '#38bdf8' },
  20: { label: '20 kg', color: '#0ea5e9' },
  25: { label: '25 kg', color: '#06b6d4' },
  30: { label: '30 kg', color: '#10b981' },
  40: { label: '40 kg', color: '#84cc16' },
  45: { label: '45 kg', color: '#a3e635' },
  50: { label: '50 kg', color: '#eab308' },
  60: { label: '60 kg', color: '#f97316' },
  65: { label: '65 kg', color: '#fb923c' },
  70: { label: '70 kg', color: '#ef4444' },
  75: { label: '75 kg', color: '#f43f5e' },
  80: { label: '80 kg', color: '#ec4899' },
  90: { label: '90 kg', color: '#d946ef' },
  100: { label: '100 kg', color: '#a855f7' },
  120: { label: '120 kg', color: '#8b5cf6' },
  150: { label: '150 kg', color: '#6366f1' },
  180: { label: '180 kg', color: '#4f46e5' },
  200: { label: '200 kg', color: '#64748b' },
  240: { label: '240 kg', color: '#475569' },
  300: { label: '300 kg', color: '#334155' },
  360: { label: '360 kg', color: '#1e293b' },
  400: { label: '400 kg', color: '#0f172a' },
  480: { label: '480 kg', color: '#78350f' },
  600: { label: '600 kg', color: '#451a03' }
};

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
// 3. PURE DOMAIN & MATHEMATICAL FUNCTIONS
// ============================================================================

export function getMechanicalAdvantage(systemType: PulleySystemType | number): MechanicalAdvantage {
  if (typeof systemType === 'number') {
    if (systemType <= 1) return 1;
    if (systemType === 2) return 2;
    if (systemType === 3) return 3;
    return 4;
  }
  switch (systemType) {
    case 'fixed-1':
      return 1;
    case 'movable-2':
      return 2;
    case 'compound-3':
      return 3;
    case 'compound-4':
      return 4;
    default:
      return 1;
  }
}

export function calculateRequiredEffortKg(
  loadKg: number,
  systemType: PulleySystemType | number
): number {
  const ma = getMechanicalAdvantage(systemType);
  return Math.round((loadKg / ma) * 10) / 10;
}

export function calculateRequiredEffort(loadKg: number, ma: MechanicalAdvantage): number {
  return Math.round((loadKg / ma) * 10) / 10;
}

export function calculateEffortDistance(
  targetHeightM: number,
  systemType: PulleySystemType | number
): number {
  const ma = getMechanicalAdvantage(systemType);
  return Math.round(targetHeightM * ma * 10) / 10;
}

export function calculateWorkJoules(
  loadKg: number,
  targetHeightM: number,
  gravity: number = GRAVITY_G
): number {
  return Math.round(loadKg * gravity * targetHeightM * 10) / 10;
}

export function calculateForcesAndWork(
  loadKg: number,
  effortKg: number,
  ma: MechanicalAdvantage,
  liftProgress: number,
  targetHeightMeters: number,
  gravity: number = GRAVITY_G
) {
  const loadWeightN = Math.round(loadKg * gravity * 10) / 10;
  const requiredEffortN = Math.round((loadKg / ma) * gravity * 10) / 10;
  const actualEffortN = Math.round(effortKg * gravity * 10) / 10;
  const liftingForceN = Math.round(actualEffortN * ma * 10) / 10;

  const loadHeightMeters = Math.round(liftProgress * targetHeightMeters * 100) / 100;
  const effortDisplacementMeters = Math.round(loadHeightMeters * ma * 100) / 100;

  const workLoadJoules = Math.round(loadWeightN * loadHeightMeters * 10) / 10;
  const workEffortJoules = Math.round(actualEffortN * effortDisplacementMeters * 10) / 10;

  return {
    loadWeightN,
    requiredEffortN,
    actualEffortN,
    liftingForceN,
    loadHeightMeters,
    effortDisplacementMeters,
    workLoadJoules,
    workEffortJoules
  };
}

export function createWeightItem(kg: number, idPrefix = 'w'): CounterWeight {
  const p = WEIGHT_PALETTE[kg] || { label: `${kg} kg`, color: '#64748b' };
  return {
    id: `${idPrefix}-${kg}-${Math.random().toString(36).slice(2, 6)}`,
    kg,
    massKg: kg,
    label: p.label,
    color: p.color
  };
}
export const createWeight = createWeightItem;

export function parseWeightItem(raw: unknown, index: number = 0): CounterWeight | null {
  if (raw === null || raw === undefined) return null;

  let kg = 0;
  let customLabel: string | undefined;
  let customColor: string | undefined;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    kg = Math.round(raw);
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:kg)?$/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    if (!Number.isFinite(val) || val <= 0) return null;
    kg = Math.round(val);
  } else if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const val = obj.kg ?? obj.massKg ?? obj.weight ?? obj.mass;
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      kg = Math.round(val);
    } else if (typeof val === 'string') {
      const match = (val as string).trim().toLowerCase().match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:kg)?$/);
      if (match) {
        kg = Math.round(parseFloat(match[1]));
      }
    }
    if (kg <= 0) return null;
    if (typeof obj.label === 'string') customLabel = obj.label;
    if (typeof obj.color === 'string') customColor = obj.color;
  } else {
    return null;
  }

  const p = WEIGHT_PALETTE[kg] || { label: `${kg} kg`, color: '#64748b' };
  return {
    id: `w-${kg}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    kg,
    massKg: kg,
    label: customLabel ?? p.label,
    color: customColor ?? p.color
  };
}

export function generateRopePath(
  ma: MechanicalAdvantage,
  originX: number,
  topY: number,
  movableY: number,
  effortY: number,
  radius = 20
): { segments: RopeSegment[]; pulleys: PulleyWheel[] } {
  const segments: RopeSegment[] = [];
  const pulleys: PulleyWheel[] = [];

  if (ma === 1) {
    // Single fixed pulley
    const px = originX + radius;
    pulleys.push({ id: 'fix-1', isMovable: false, centerX: px, centerY: topY, radius });
    segments.push({ type: 'line', startX: originX, startY: movableY, endX: originX, endY: topY });
    segments.push({
      type: 'arc',
      centerX: px,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 2 * radius,
      startY: topY,
      endX: originX + 2 * radius,
      endY: effortY
    });
  } else if (ma === 2) {
    // 1 movable + 1 fixed
    const pMovX = originX + radius;
    const pFixX = originX + 3 * radius;
    pulleys.push({ id: 'mov-1', isMovable: true, centerX: pMovX, centerY: movableY, radius });
    pulleys.push({ id: 'fix-1', isMovable: false, centerX: pFixX, centerY: topY, radius });

    segments.push({ type: 'line', startX: originX, startY: topY, endX: originX, endY: movableY });
    segments.push({
      type: 'arc',
      centerX: pMovX,
      centerY: movableY,
      radius,
      startAngle: Math.PI,
      endAngle: 0,
      counterClockwise: false
    });
    segments.push({
      type: 'line',
      startX: originX + 2 * radius,
      startY: movableY,
      endX: originX + 2 * radius,
      endY: topY
    });
    segments.push({
      type: 'arc',
      centerX: pFixX,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 4 * radius,
      startY: topY,
      endX: originX + 4 * radius,
      endY: effortY
    });
  } else if (ma === 3) {
    // Luff tackle: 1 movable + 2 fixed
    const pFix1X = originX + radius;
    const pMov1X = originX + 3 * radius;
    const pFix2X = originX + 5 * radius;
    pulleys.push({ id: 'fix-1', isMovable: false, centerX: pFix1X, centerY: topY, radius });
    pulleys.push({ id: 'mov-1', isMovable: true, centerX: pMov1X, centerY: movableY, radius });
    pulleys.push({ id: 'fix-2', isMovable: false, centerX: pFix2X, centerY: topY, radius });

    segments.push({ type: 'line', startX: originX, startY: movableY, endX: originX, endY: topY });
    segments.push({
      type: 'arc',
      centerX: pFix1X,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 2 * radius,
      startY: topY,
      endX: originX + 2 * radius,
      endY: movableY
    });
    segments.push({
      type: 'arc',
      centerX: pMov1X,
      centerY: movableY,
      radius,
      startAngle: Math.PI,
      endAngle: 0,
      counterClockwise: false
    });
    segments.push({
      type: 'line',
      startX: originX + 4 * radius,
      startY: movableY,
      endX: originX + 4 * radius,
      endY: topY
    });
    segments.push({
      type: 'arc',
      centerX: pFix2X,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 6 * radius,
      startY: topY,
      endX: originX + 6 * radius,
      endY: effortY
    });
  } else if (ma === 4) {
    // Double tackle: 2 movable + 2 fixed
    const pMov1X = originX + radius;
    const pFix1X = originX + 3 * radius;
    const pMov2X = originX + 5 * radius;
    const pFix2X = originX + 7 * radius;
    pulleys.push({ id: 'mov-1', isMovable: true, centerX: pMov1X, centerY: movableY, radius });
    pulleys.push({ id: 'fix-1', isMovable: false, centerX: pFix1X, centerY: topY, radius });
    pulleys.push({ id: 'mov-2', isMovable: true, centerX: pMov2X, centerY: movableY, radius });
    pulleys.push({ id: 'fix-2', isMovable: false, centerX: pFix2X, centerY: topY, radius });

    segments.push({ type: 'line', startX: originX, startY: topY, endX: originX, endY: movableY });
    segments.push({
      type: 'arc',
      centerX: pMov1X,
      centerY: movableY,
      radius,
      startAngle: Math.PI,
      endAngle: 0,
      counterClockwise: false
    });
    segments.push({
      type: 'line',
      startX: originX + 2 * radius,
      startY: movableY,
      endX: originX + 2 * radius,
      endY: topY
    });
    segments.push({
      type: 'arc',
      centerX: pFix1X,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 4 * radius,
      startY: topY,
      endX: originX + 4 * radius,
      endY: movableY
    });
    segments.push({
      type: 'arc',
      centerX: pMov2X,
      centerY: movableY,
      radius,
      startAngle: Math.PI,
      endAngle: 0,
      counterClockwise: false
    });
    segments.push({
      type: 'line',
      startX: originX + 6 * radius,
      startY: movableY,
      endX: originX + 6 * radius,
      endY: topY
    });
    segments.push({
      type: 'arc',
      centerX: pFix2X,
      centerY: topY,
      radius,
      startAngle: Math.PI,
      endAngle: 0
    });
    segments.push({
      type: 'line',
      startX: originX + 8 * radius,
      startY: topY,
      endX: originX + 8 * radius,
      endY: effortY
    });
  }

  return { segments, pulleys };
}

export function simulatePulleyPhysics(
  currentState: PulleyPhysicsState,
  config: {
    loadKg: number;
    mechanicalAdvantage: MechanicalAdvantage;
    targetHeightMeters: number;
    placedWeights: CounterWeight[];
  },
  dt: number,
  springK = 8.0,
  dampingZ = 0.85,
  settleFramesRequired = 36
): PulleyPhysicsState {
  const totalEffortKg = config.placedWeights.reduce((acc, w) => acc + (w.kg ?? w.massKg), 0);
  const requiredKg = calculateRequiredEffort(config.loadKg, config.mechanicalAdvantage);

  const isEquilibrium = totalEffortKg === requiredKg;
  const isOverloaded = totalEffortKg > requiredKg;

  let targetProgress = 0.0;
  if (isEquilibrium || isOverloaded) {
    targetProgress = 1.0;
  } else {
    targetProgress = 0.0;
  }

  const delta = targetProgress - currentState.liftProgress;
  const springForce = delta * springK;
  const dampingForce = -currentState.velocity * (2 * Math.sqrt(springK) * dampingZ);
  const acceleration = springForce + dampingForce;

  const clampedDt = Math.max(0.001, Math.min(0.033, dt));
  let newVelocity = currentState.velocity + acceleration * clampedDt;
  let newProgress = currentState.liftProgress + newVelocity * clampedDt;

  if (newProgress < 0) {
    newProgress = 0;
    newVelocity = 0;
  }

  let settledFrames = currentState.settledFrames;
  let isComplete = currentState.isComplete;

  if (isEquilibrium && Math.abs(newProgress - 1.0) < 0.03 && Math.abs(newVelocity) < 0.05) {
    settledFrames++;
    if (settledFrames >= settleFramesRequired && !isComplete) {
      isComplete = true;
    }
  } else {
    settledFrames = 0;
  }

  const forces = calculateForcesAndWork(
    config.loadKg,
    totalEffortKg,
    config.mechanicalAdvantage,
    newProgress,
    config.targetHeightMeters
  );

  return {
    liftProgress: newProgress,
    velocity: newVelocity,
    effortMassKg: totalEffortKg,
    tensionForceN: forces.actualEffortN,
    loadForceN: forces.loadWeightN,
    workLoadJoules: forces.workLoadJoules,
    workEffortJoules: forces.workEffortJoules,
    isEquilibrium,
    isOverloaded,
    settledFrames,
    isComplete
  };
}

export function simulatePulleyLevel(
  level: PulleyLevel,
  weights: (CounterWeight | number)[],
  durationSeconds?: number
): SimulationResult {
  const effortKg = weights.reduce<number>(
    (sum, w) => sum + (typeof w === 'number' ? w : (w.kg ?? w.massKg ?? 0)),
    0
  );
  const reqEffortKg = calculateRequiredEffortKg(level.loadKg, level.systemType);
  const ma = level.mechanicalAdvantage;
  const tensionN = Math.round(effortKg * GRAVITY_G * 10) / 10;

  if (weights.length === 0) {
    return {
      won: false,
      loadHeightM: 0,
      effortDisplacementM: 0,
      settlingTime: 0,
      workJoules: 0,
      overshot: false,
      equilibrium: false,
      tensionN: 0,
      effortKg: 0
    };
  }

  if (effortKg < reqEffortKg) {
    return {
      won: false,
      loadHeightM: 0,
      effortDisplacementM: 0,
      settlingTime: 0,
      workJoules: 0,
      overshot: false,
      equilibrium: false,
      tensionN,
      effortKg
    };
  }

  if (effortKg > reqEffortKg) {
    const loadHeightM = Math.round(level.targetHeightM * 1.2 * 10) / 10;
    const effortDisplacementM = Math.round(loadHeightM * ma * 10) / 10;
    const workJoules = calculateWorkJoules(level.loadKg, level.targetHeightM);
    return {
      won: false,
      loadHeightM,
      effortDisplacementM,
      settlingTime: 0,
      workJoules,
      overshot: true,
      equilibrium: false,
      tensionN,
      effortKg
    };
  }

  // Exact equilibrium (effortKg === reqEffortKg)
  const duration = durationSeconds !== undefined ? durationSeconds : 3.0;
  const settlingTime = duration;
  const won = duration >= 0.5;
  const loadHeightM = won
    ? level.targetHeightM
    : Math.round(level.targetHeightM * Math.min(1, duration / 0.5) * 100) / 100;
  const effortDisplacementM = Math.round(loadHeightM * ma * 10) / 10;
  const workJoules = calculateWorkJoules(level.loadKg, loadHeightM);

  return {
    won,
    loadHeightM,
    effortDisplacementM,
    settlingTime,
    workJoules,
    overshot: false,
    equilibrium: true,
    tensionN,
    effortKg
  };
}

export function verifyAntiMirroring(level: PulleyLevel): boolean {
  if (level.antiMirroringEnforced === false) return true;

  const targetEffort = level.loadKg / level.mechanicalAdvantage;

  // 1. Forbid any single inventory weight from matching target effort
  for (const w of level.availableWeights) {
    if (w.kg === targetEffort) {
      return false;
    }
  }

  // 2. Forbid any single inventory weight from matching the raw load weight
  for (const w of level.availableWeights) {
    if (w.kg === level.loadKg) {
      return false;
    }
  }

  // 3. Forbid any single-piece solution in solutionCombinations
  if (level.solutionCombinations && level.solutionCombinations.length > 0) {
    for (const sol of level.solutionCombinations) {
      if (sol.length < 2) {
        return false;
      }
    }
  }

  return true;
}

export function isLevelSolved(
  level: PulleyLevel,
  effortWeights: (CounterWeight | number)[]
): boolean {
  const currentEffortKg = effortWeights.reduce<number>(
    (sum, w) => sum + (typeof w === 'number' ? w : (w.kg ?? w.massKg ?? 0)),
    0
  );
  return currentEffortKg === level.targetEffortKg;
}

// ============================================================================
// 4. CURRICULUM LEVEL GENERATOR & CUSTOM PARSER
// ============================================================================

export function generateLevelsForAge(ageGroup: AgeGroup): PulleyLevel[] {
  if (ageGroup === '3-5') {
    return [
      {
        id: 'pulley-3-5-1',
        levelNumber: 1,
        ageGroup: '3-5',
        title: 'Single Pulley Lift',
        systemType: 'fixed-1',
        mechanicalAdvantage: 1,
        loadKg: 20,
        targetHeightM: 2.0,
        targetEffortKg: 20,
        targetWorkJoules: calculateWorkJoules(20, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'fixed-1'),
        availableWeights: [
          createWeightItem(20, 'sol'),
          createWeightItem(50, 'dist'),
          createWeightItem(10, 'dist')
        ],
        solutionCombinations: [[20]],
        distractorWeights: [50, 10],
        antiMirroringEnforced: false,
        antiMirroring: false
      },
      {
        id: 'pulley-3-5-2',
        levelNumber: 2,
        ageGroup: '3-5',
        title: 'Heavier Block',
        systemType: 'fixed-1',
        mechanicalAdvantage: 1,
        loadKg: 50,
        targetHeightM: 2.0,
        targetEffortKg: 50,
        targetWorkJoules: calculateWorkJoules(50, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'fixed-1'),
        availableWeights: [
          createWeightItem(50, 'sol'),
          createWeightItem(20, 'dist'),
          createWeightItem(70, 'dist')
        ],
        solutionCombinations: [[50]],
        distractorWeights: [20, 70],
        antiMirroringEnforced: false,
        antiMirroring: false
      },
      {
        id: 'pulley-3-5-3',
        levelNumber: 3,
        ageGroup: '3-5',
        title: 'Mighty 80 kg Stone',
        systemType: 'fixed-1',
        mechanicalAdvantage: 1,
        loadKg: 80,
        targetHeightM: 2.0,
        targetEffortKg: 80,
        targetWorkJoules: calculateWorkJoules(80, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'fixed-1'),
        availableWeights: [
          createWeightItem(80, 'sol'),
          createWeightItem(50, 'sol-part'),
          createWeightItem(30, 'sol-part'),
          createWeightItem(40, 'dist')
        ],
        solutionCombinations: [[80], [50, 30]],
        distractorWeights: [40],
        antiMirroringEnforced: false,
        antiMirroring: false
      }
    ];
  }

  if (ageGroup === '6-8') {
    return [
      {
        id: 'pulley-6-8-1',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Movable Pulley Halving',
        systemType: 'movable-2',
        mechanicalAdvantage: 2,
        loadKg: 100,
        targetHeightM: 2.0,
        targetEffortKg: 50,
        targetWorkJoules: calculateWorkJoules(100, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'movable-2'),
        availableWeights: [
          createWeightItem(30, 'sol'),
          createWeightItem(20, 'sol'),
          createWeightItem(70, 'dist'),
          createWeightItem(40, 'dist'),
          createWeightItem(25, 'dist')
        ],
        solutionCombinations: [[30, 20]],
        distractorWeights: [70, 40, 25],
        antiMirroringEnforced: true,
        antiMirroring: true
      },
      {
        id: 'pulley-6-8-2',
        levelNumber: 2,
        ageGroup: '6-8',
        title: 'Two-Pulley 200 kg Challenge',
        systemType: 'movable-2',
        mechanicalAdvantage: 2,
        loadKg: 200,
        targetHeightM: 2.0,
        targetEffortKg: 100,
        targetWorkJoules: calculateWorkJoules(200, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'movable-2'),
        availableWeights: [
          createWeightItem(60, 'sol'),
          createWeightItem(40, 'sol'),
          createWeightItem(50, 'sol'),
          createWeightItem(50, 'sol'),
          createWeightItem(70, 'dist')
        ],
        solutionCombinations: [[60, 40], [50, 50]],
        distractorWeights: [70],
        antiMirroringEnforced: true,
        antiMirroring: true
      },
      {
        id: 'pulley-6-8-3',
        levelNumber: 3,
        ageGroup: '6-8',
        title: 'Heavy Stone Hoist',
        systemType: 'movable-2',
        mechanicalAdvantage: 2,
        loadKg: 360,
        targetHeightM: 2.0,
        targetEffortKg: 180,
        targetWorkJoules: calculateWorkJoules(360, 2.0),
        ropeDistanceM: calculateEffortDistance(2.0, 'movable-2'),
        availableWeights: [
          createWeightItem(100, 'sol'),
          createWeightItem(80, 'sol'),
          createWeightItem(50, 'sol'),
          createWeightItem(50, 'sol'),
          createWeightItem(90, 'dist'),
          createWeightItem(60, 'dist')
        ],
        solutionCombinations: [[100, 80], [80, 50, 50]],
        distractorWeights: [90, 60],
        antiMirroringEnforced: true,
        antiMirroring: true
      }
    ];
  }

  // Age group '9-11'
  return [
    {
      id: 'pulley-9-11-1',
      levelNumber: 1,
      ageGroup: '9-11',
      title: 'Luff Tackle 3:1 Advantage',
      systemType: 'compound-3',
      mechanicalAdvantage: 3,
      loadKg: 240,
      targetHeightM: 2.0,
      targetEffortKg: 80,
      targetWorkJoules: calculateWorkJoules(240, 2.0),
      ropeDistanceM: calculateEffortDistance(2.0, 'compound-3'),
      availableWeights: [
        createWeightItem(50, 'sol'),
        createWeightItem(30, 'sol'),
        createWeightItem(60, 'sol'),
        createWeightItem(20, 'sol'),
        createWeightItem(70, 'dist'),
        createWeightItem(40, 'dist')
      ],
      solutionCombinations: [[50, 30], [60, 20]],
      distractorWeights: [70, 40],
      antiMirroringEnforced: true,
      antiMirroring: true
    },
    {
      id: 'pulley-9-11-2',
      levelNumber: 2,
      ageGroup: '9-11',
      title: 'Double Tackle 4:1 System',
      systemType: 'compound-4',
      mechanicalAdvantage: 4,
      loadKg: 480,
      targetHeightM: 1.5,
      targetEffortKg: 120,
      targetWorkJoules: calculateWorkJoules(480, 1.5),
      ropeDistanceM: calculateEffortDistance(1.5, 'compound-4'),
      availableWeights: [
        createWeightItem(70, 'sol'),
        createWeightItem(50, 'sol'),
        createWeightItem(40, 'sol'),
        createWeightItem(40, 'sol'),
        createWeightItem(30, 'sol'),
        createWeightItem(65, 'dist')
      ],
      solutionCombinations: [[70, 50], [50, 40, 30]],
      distractorWeights: [65],
      antiMirroringEnforced: true,
      antiMirroring: true
    },
    {
      id: 'pulley-9-11-3',
      levelNumber: 3,
      ageGroup: '9-11',
      title: 'Work Conservation Master',
      systemType: 'compound-4',
      mechanicalAdvantage: 4,
      loadKg: 600,
      targetHeightM: 2.5,
      targetEffortKg: 150,
      targetWorkJoules: calculateWorkJoules(600, 2.5),
      ropeDistanceM: calculateEffortDistance(2.5, 'compound-4'),
      availableWeights: [
        createWeightItem(90, 'sol'),
        createWeightItem(60, 'sol'),
        createWeightItem(80, 'sol'),
        createWeightItem(70, 'sol'),
        createWeightItem(50, 'dist'),
        createWeightItem(45, 'dist')
      ],
      solutionCombinations: [[90, 60], [80, 70]],
      distractorWeights: [50, 45],
      antiMirroringEnforced: true,
      antiMirroring: true
    }
  ];
}

export function parseCustomLevels(raw: unknown): PulleyLevel[] | null {
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

  const levels: PulleyLevel[] = [];

  for (let idx = 0; idx < parsed.length; idx++) {
    try {
      const item = parsed[idx] as CustomLevelInput;
      if (!item || typeof item !== 'object') continue;

      const rawLoad = item.loadKg ?? item.targetLoadKg ?? item.load;
      if (typeof rawLoad !== 'number' || !Number.isFinite(rawLoad) || rawLoad <= 0) {
        continue;
      }
      const loadKg = Math.round(rawLoad);

      const rawHeight = item.targetHeightM ?? item.targetHeightMeters ?? item.height;
      const targetHeightM =
        typeof rawHeight === 'number' && Number.isFinite(rawHeight) && rawHeight > 0
          ? Math.round(rawHeight * 10) / 10
          : 2.0;

      const rawType = item.systemType ?? item.ma ?? item.mechanicalAdvantage;
      let systemType: PulleySystemType = 'fixed-1';
      let ma: MechanicalAdvantage = 1;

      if (rawType === 'fixed-1' || rawType === 1 || rawType === '1') {
        systemType = 'fixed-1';
        ma = 1;
      } else if (rawType === 'movable-2' || rawType === 2 || rawType === '2') {
        systemType = 'movable-2';
        ma = 2;
      } else if (rawType === 'compound-3' || rawType === 3 || rawType === '3') {
        systemType = 'compound-3';
        ma = 3;
      } else if (rawType === 'compound-4' || rawType === 4 || rawType === '4') {
        systemType = 'compound-4';
        ma = 4;
      }

      const rawWeights = item.availableWeights ?? item.weights ?? item.inventory;
      if (!Array.isArray(rawWeights) || rawWeights.length === 0) {
        continue;
      }

      const availableWeights: CounterWeight[] = [];
      for (let wIdx = 0; wIdx < rawWeights.length; wIdx++) {
        const parsedWeight = parseWeightItem(rawWeights[wIdx], wIdx);
        if (parsedWeight) {
          availableWeights.push(parsedWeight);
        }
      }

      if (availableWeights.length === 0) {
        continue;
      }

      const id =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `custom-${levels.length + 1}`;
      const title =
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim()
          : `Custom Level ${levels.length + 1}`;
      const instruction =
        typeof item.instruction === 'string'
          ? item.instruction
          : typeof item.customInstruction === 'string'
            ? item.customInstruction
            : undefined;

      const targetEffortKg = calculateRequiredEffortKg(loadKg, systemType);
      const targetWorkJoules = calculateWorkJoules(loadKg, targetHeightM);
      const ropeDistanceM = calculateEffortDistance(targetHeightM, systemType);

      levels.push({
        id,
        levelNumber: levels.length + 1,
        ageGroup: '6-8',
        title,
        systemType,
        mechanicalAdvantage: ma,
        loadKg,
        targetHeightM,
        availableWeights,
        targetEffortKg,
        targetWorkJoules,
        ropeDistanceM,
        instruction
      });
    } catch {
      continue;
    }
  }

  return levels.length > 0 ? levels : null;
}

// ============================================================================
// 5. KIDGAME MAIN CLASS (PulleyLiftGame)
// ============================================================================

export class PulleyLiftGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private t!: PulleyTranslations;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private abortController: AbortController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animFrameId: number | null = null;
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  private levels: PulleyLevel[] = [];
  private currentLevelIndex: number = 0;
  private score: number = 0;
  private streak: number = 0;
  private startTime: number = 0;

  // Active level inventory and placed effort tray
  private inventory: CounterWeight[] = [];
  private placedWeights: CounterWeight[] = [];

  // Physics animation state
  private physicsState: PulleyPhysicsState = {
    liftProgress: 0,
    velocity: 0,
    effortMassKg: 0,
    tensionForceN: 0,
    loadForceN: 0,
    workLoadJoules: 0,
    workEffortJoules: 0,
    isEquilibrium: false,
    isOverloaded: false,
    settledFrames: 0,
    isComplete: false
  };

  private isPaused: boolean = false;
  private lastTime: number = 0;
  private isRoundOver: boolean = false;

  // Drag-and-drop state
  private draggingWeight: CounterWeight | null = null;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private dragCurrentPos: { x: number; y: number } = { x: 0, y: 0 };
  private isDraggingBeyondThreshold: boolean = false;

  private get audio(): SoundEngine {
    return this.context?.audio || fallbackAudio;
  }

  private get currentLevel(): PulleyLevel {
    return this.levels[this.currentLevelIndex] || this.levels[0];
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
    this.isRoundOver = false;

    // Load levels
    this.loadLevels();

    // Render DOM scaffold
    this.renderDOM();

    // Setup canvas
    this.setupCanvas();

    // Setup level
    this.setupLevel(0);

    // Bind event listeners with AbortController
    this.bindEvents();

    // Emit initial progress
    this.context.emit('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Starting level 1: ${this.currentLevel.title}`
    });
  }

  start(): void {
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
    if (!this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  updateConfig(newContext: Partial<GameContext>): void {
    if (newContext.locale && newContext.locale !== this.context.locale) {
      this.context.locale = newContext.locale;
      this.t = getTranslations(newContext.locale);
      this.updateHUDStaticLabels();
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

    this.container.innerHTML = '';
  }

  // ============================================================================
  // INTERNAL LOGIC & RENDERING
  // ============================================================================

  private loadLevels(): void {
    if (this.context.customLevels) {
      const parsed = parseCustomLevels(this.context.customLevels);
      if (parsed && parsed.length > 0) {
        this.levels = parsed;
        return;
      }
    }
    this.levels = generateLevelsForAge(this.context.ageGroup || '6-8');
  }

  private renderDOM(): void {
    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 20%, #1e293b, #090d16); color: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none; -webkit-user-select: none; overflow: hidden;">
        <!-- Top HUD -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; min-height: 48px; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 800; font-size: 1.1rem; color: #38bdf8; letter-spacing: -0.02em;" id="hud-title">${this.t.title}</span>
            <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;">${this.t.level} 1/${this.levels.length}</span>
          </div>

          <div id="hud-instruction" style="flex: 1; min-width: 220px; font-size: 0.88rem; color: #cbd5e1; font-weight: 500; text-align: center; line-height: 1.35;"></div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.05rem;">⭐ 0</div>
            <button id="btn-sound-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600;">${this.audio.enabled ? this.t.soundOn : this.t.soundOff}</button>
            <button id="btn-reset" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 6px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; min-height: 44px;">${this.t.reset}</button>
          </div>
        </div>

        <!-- Canvas Middle Viewport -->
        <div id="canvas-wrapper" style="flex: 1; position: relative; overflow: hidden; touch-action: none;">
          <canvas id="pulley-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Bottom Controls & Manipulatives Tray -->
        <div style="padding: 10px 20px 14px; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 960px; margin: 0 auto; gap: 16px; flex-wrap: wrap;">
            
            <!-- Effort Tray Container -->
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 200px;">
              <span id="effort-tray-label" style="font-size: 0.72rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">${this.t.effortTrayLabel}:</span>
              <div id="effort-tray" style="display: flex; gap: 8px; align-items: center; min-height: 52px; padding: 4px 8px; background: rgba(56, 189, 248, 0.08); border: 2px dashed rgba(56, 189, 248, 0.4); border-radius: 8px; flex-wrap: wrap;"></div>
            </div>

            <!-- Inventory Available Weights -->
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 260px;">
              <span id="inventory-label" style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${this.t.inventoryLabel}:</span>
              <div id="inventory-tray" style="display: flex; gap: 8px; align-items: center; min-height: 52px; padding: 4px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; flex-wrap: wrap;"></div>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  private updateHUDStaticLabels(): void {
    const titleEl = this.container.querySelector('#hud-title');
    if (titleEl) titleEl.textContent = this.t.title;

    const levelBadge = this.container.querySelector('#level-badge');
    if (levelBadge) {
      levelBadge.textContent = `${this.t.level} ${this.currentLevelIndex + 1}/${this.levels.length}`;
    }

    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
    }

    const resetBtn = this.container.querySelector('#btn-reset');
    if (resetBtn) resetBtn.textContent = this.t.reset;

    const effortLabel = this.container.querySelector('#effort-tray-label');
    if (effortLabel) effortLabel.textContent = `${this.t.effortTrayLabel}:`;

    const invLabel = this.container.querySelector('#inventory-label');
    if (invLabel) invLabel.textContent = `${this.t.inventoryLabel}:`;

    this.updateHUDPrompt();
  }

  private setupCanvas(): void {
    this.canvas = this.container.querySelector('#pulley-canvas') as HTMLCanvasElement;
    if (this.canvas && typeof this.canvas.getContext === 'function') {
      this.ctx = this.canvas.getContext('2d');
    }

    const resize = () => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = rect.width || 800;
      const height = rect.height || 500;
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

  private setupLevel(index: number): void {
    this.currentLevelIndex = index;
    const lvl = this.currentLevel;

    // Reset weights
    this.inventory = [...lvl.availableWeights.map((w) => ({ ...w }))];
    this.placedWeights = [];
    this.isRoundOver = false;

    // Reset physics state
    this.physicsState = {
      liftProgress: 0,
      velocity: 0,
      effortMassKg: 0,
      tensionForceN: 0,
      loadForceN: calculateWorkJoules(lvl.loadKg, 1.0) / 1.0,
      workLoadJoules: 0,
      workEffortJoules: 0,
      isEquilibrium: false,
      isOverloaded: false,
      settledFrames: 0,
      isComplete: false
    };

    this.updateHUDStaticLabels();
    this.renderTrays();
  }

  private renderTrays(): void {
    const invTray = this.container.querySelector('#inventory-tray');
    const effortTray = this.container.querySelector('#effort-tray');
    if (!invTray || !effortTray) return;

    invTray.innerHTML = '';
    effortTray.innerHTML = '';

    // Render inventory pieces
    this.inventory.forEach((w) => {
      const btn = this.createWeightDOM(w, false);
      invTray.appendChild(btn);
    });

    // Render effort tray pieces
    this.placedWeights.forEach((w) => {
      const btn = this.createWeightDOM(w, true);
      effortTray.appendChild(btn);
    });

    this.updateHUDPrompt();
  }

  private createWeightDOM(w: CounterWeight, inEffortTray: boolean): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'weight-item';
    btn.dataset.id = w.id;
    btn.dataset.kg = String(w.kg);
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 48px;
      min-height: 44px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.18);
      background: ${w.color || '#38bdf8'};
      color: #0f172a;
      font-weight: 800;
      font-size: 0.85rem;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: transform 0.1s ease, filter 0.1s ease;
      touch-action: none;
    `;
    btn.textContent = w.label || `${w.kg} kg`;

    btn.addEventListener('pointerdown', (e) => {
      if (inEffortTray) return;
      this.draggingWeight = w;
      this.dragStartPos = { x: e.clientX, y: e.clientY };
      this.dragCurrentPos = { x: e.clientX, y: e.clientY };
      this.isDraggingBeyondThreshold = false;
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (inEffortTray) {
        // Granular undo: move back to inventory
        this.removeWeightFromEffortTray(w);
      } else {
        // Tap to add to effort tray
        this.addWeightToEffortTray(w);
      }
    });

    return btn;
  }

  private addWeightToEffortTray(w: CounterWeight): void {
    const idx = this.inventory.findIndex((item) => item.id === w.id);
    if (idx !== -1) {
      const [removed] = this.inventory.splice(idx, 1);
      this.placedWeights.push(removed);
      this.audio.playDrop();
      this.renderTrays();
    }
  }

  private removeWeightFromEffortTray(w: CounterWeight): void {
    const idx = this.placedWeights.findIndex((item) => item.id === w.id);
    if (idx !== -1) {
      const [removed] = this.placedWeights.splice(idx, 1);
      this.inventory.push(removed);
      this.audio.playPop();
      this.renderTrays();
    }
  }

  private clearEffortTray(): void {
    if (this.placedWeights.length === 0) return;
    this.inventory.push(...this.placedWeights);
    this.placedWeights = [];
    this.audio.playPop();
    this.renderTrays();
  }

  private updateHUDPrompt(): void {
    const promptEl = this.container.querySelector('#hud-instruction');
    if (!promptEl) return;

    const lvl = this.currentLevel;
    const currentKg = this.placedWeights.reduce((sum, w) => sum + (w.kg ?? w.massKg), 0);
    const targetKg = lvl.targetEffortKg;
    const loadKg = lvl.loadKg;
    const ma = lvl.mechanicalAdvantage;

    let text = '';
    if (lvl.ageGroup === '3-5') {
      text = this.t.formatPreschoolPrompt(loadKg, currentKg);
    } else if (lvl.ageGroup === '6-8') {
      text = this.t.formatElementaryPrompt(loadKg, targetKg, currentKg, ma);
    } else {
      const loadNewtons = Math.round(loadKg * GRAVITY_G);
      const targetNewtons = Math.round(targetKg * GRAVITY_G);
      const currentNewtons = Math.round(currentKg * GRAVITY_G);
      const ropeDistM = lvl.ropeDistanceM;
      const workJoules = lvl.targetWorkJoules;
      text = this.t.formatUpperElementaryPrompt(
        loadKg,
        loadNewtons,
        targetKg,
        targetNewtons,
        currentKg,
        currentNewtons,
        ma,
        ropeDistM,
        workJoules
      );
    }

    promptEl.textContent = text;
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    soundBtn?.addEventListener(
      'click',
      () => {
        this.audio.enabled = !this.audio.enabled;
        this.audio.playClick();
        if (soundBtn) {
          soundBtn.textContent = this.audio.enabled ? this.t.soundOn : this.t.soundOff;
        }
      },
      { signal }
    );

    const resetBtn = this.container.querySelector('#btn-reset');
    resetBtn?.addEventListener(
      'click',
      () => {
        this.audio.playClick();
        this.clearEffortTray();
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e) => {
        if (!this.draggingWeight) return;
        const rect = this.canvas?.getBoundingClientRect();
        if (rect) {
          this.dragCurrentPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
        }
        const dist = Math.hypot(e.clientX - this.dragStartPos.x, e.clientY - this.dragStartPos.y);
        if (dist > 5) {
          this.isDraggingBeyondThreshold = true;
        }
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e) => {
        if (!this.draggingWeight) return;
        if (this.isDraggingBeyondThreshold) {
          const effortTray = this.container.querySelector('#effort-tray');
          const trayRect = effortTray?.getBoundingClientRect();
          if (trayRect) {
            const inTrayX = e.clientX >= trayRect.left - 40 && e.clientX <= trayRect.right + 40;
            const inTrayY = e.clientY >= trayRect.top - 40 && e.clientY <= trayRect.bottom + 40;
            if (inTrayX && inTrayY) {
              this.addWeightToEffortTray(this.draggingWeight);
            }
          }
        }
        this.draggingWeight = null;
        this.isDraggingBeyondThreshold = false;
      },
      { signal }
    );
  }

  private handleLevelWin(): void {
    if (this.isRoundOver) return;
    this.isRoundOver = true;

    this.audio.playSuccess();
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignored in test/headless env
    }

    this.score += 100 + this.streak * 20;
    this.streak++;
    const scoreEl = this.container.querySelector('#score-display');
    if (scoreEl) scoreEl.textContent = `⭐ ${this.score}`;

    this.context.emit('game:score', { points: this.score, streak: this.streak, delta: 100 });
    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: `Solved level ${this.currentLevelIndex + 1}`
    });

    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      if (this.currentLevelIndex + 1 < this.levels.length) {
        this.setupLevel(this.currentLevelIndex + 1);
      } else {
        const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
        this.context.emit('game:complete', {
          stars: 3,
          score: this.score,
          timeElapsed,
          summary: this.t.summary
        });
      }
    }, 1200);
    this.pendingTimeouts.add(timeout);
  }

  // ============================================================================
  // TICK / RENDER LOOP
  // ============================================================================

  private tick = (timestamp: number): void => {
    if (this.isPaused) return;

    const dt = Math.min(0.033, (timestamp - this.lastTime) / 1000 || 0.016);
    this.lastTime = timestamp;

    this.updatePhysics(dt);
    this.draw();

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private updatePhysics(dt: number): void {
    const lvl = this.currentLevel;
    const config = {
      loadKg: lvl.loadKg,
      mechanicalAdvantage: lvl.mechanicalAdvantage,
      targetHeightMeters: lvl.targetHeightM,
      placedWeights: this.placedWeights
    };

    const nextState = simulatePulleyPhysics(this.physicsState, config, dt);
    this.physicsState = nextState;

    if (nextState.isComplete && !this.isRoundOver) {
      this.handleLevelWin();
    }
  }

  private draw(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const height = this.canvas.height / (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    ctx.clearRect(0, 0, width, height);

    // Layout coordinates
    const groundY = height - 60;
    const topBoomY = 70;
    const craneMastX = 70;
    const targetHeightPx = 180;
    const targetPlatformY = groundY - targetHeightPx;

    const lvl = this.currentLevel;
    const ma = lvl.mechanicalAdvantage;

    // Stone Load position
    const liftProgress = this.physicsState.liftProgress;
    const currentLoadY = groundY - liftProgress * targetHeightPx - 25;
    const loadX = 240;

    // Movable pulley position
    const movablePulleyY = currentLoadY - 30;

    // Effort rope position
    const effortDisplacementPx = liftProgress * targetHeightPx * ma;
    const effortTrayBaseY = topBoomY + 120 + effortDisplacementPx;
    const pulleyOriginX = 180;
    const radius = 18;

    // 1. Draw Construction Crane Background
    this.drawCrane(ctx, craneMastX, topBoomY, groundY, width);

    // 2. Draw Target Height Guide Line
    this.drawTargetPlatform(ctx, loadX - 60, targetPlatformY, 140);

    // 3. Generate Rope and Pulley Geometry
    const effortX = pulleyOriginX + 2 * ma * radius;
    const { segments, pulleys } = generateRopePath(
      ma,
      pulleyOriginX,
      topBoomY,
      movablePulleyY,
      effortTrayBaseY,
      radius
    );

    // 4. Draw Ropes
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const seg of segments) {
      ctx.beginPath();
      if (seg.type === 'line') {
        ctx.moveTo(seg.startX ?? 0, seg.startY ?? 0);
        ctx.lineTo(seg.endX ?? 0, seg.endY ?? 0);
      } else if (seg.type === 'arc') {
        ctx.arc(
          seg.centerX ?? 0,
          seg.centerY ?? 0,
          seg.radius ?? radius,
          seg.startAngle ?? 0,
          seg.endAngle ?? Math.PI,
          seg.counterClockwise ?? false
        );
      }
      ctx.stroke();
    }
    ctx.restore();

    // 5. Draw Pulleys
    for (const p of pulleys) {
      this.drawPulley(ctx, p.centerX, p.centerY, p.radius, p.isMovable);
    }

    // 6. Draw Stone Load Block
    this.drawStoneBlock(ctx, loadX, currentLoadY, lvl.loadKg);

    // 7. Draw Effort Tray Hanging from free rope end
    this.drawEffortTray(ctx, effortX, effortTrayBaseY);

    // 8. Draw Ghost Weight while dragging
    if (this.isDraggingBeyondThreshold && this.draggingWeight) {
      ctx.save();
      ctx.fillStyle = this.draggingWeight.color || '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(this.dragCurrentPos.x - 28, this.dragCurrentPos.y - 16, 56, 32);
      ctx.strokeRect(this.dragCurrentPos.x - 28, this.dragCurrentPos.y - 16, 56, 32);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.draggingWeight.kg} kg`, this.dragCurrentPos.x, this.dragCurrentPos.y);
      ctx.restore();
    }
  }

  private drawCrane(
    ctx: CanvasRenderingContext2D,
    mastX: number,
    boomY: number,
    groundY: number,
    width: number
  ): void {
    ctx.save();

    // Ground Line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Ground safety hatching
    ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
    for (let x = 10; x < width; x += 30) {
      ctx.fillRect(x, groundY, 14, 6);
    }

    // Vertical Crane Mast
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(mastX - 18, boomY, 36, groundY - boomY);

    // Mast cross truss bracing
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    for (let y = boomY; y < groundY - 20; y += 40) {
      ctx.beginPath();
      ctx.moveTo(mastX - 18, y);
      ctx.lineTo(mastX + 18, y + 40);
      ctx.moveTo(mastX + 18, y);
      ctx.lineTo(mastX - 18, y + 40);
      ctx.stroke();
    }

    // Horizontal Boom / Jib
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mastX - 30, boomY);
    ctx.lineTo(width - 40, boomY);
    ctx.stroke();

    // Boom top stay cable
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mastX, boomY - 30);
    ctx.lineTo(width - 50, boomY);
    ctx.moveTo(mastX, boomY - 30);
    ctx.lineTo(mastX - 25, boomY);
    ctx.stroke();

    ctx.restore();
  }

  private drawTargetPlatform(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number
  ): void {
    ctx.save();

    // Dotted target line
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();

    // Target banner flag
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(x, y - 22, width, 22);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎯 TARGET HEIGHT (${this.currentLevel.targetHeightM}m)`, x + width / 2, y - 7);

    ctx.restore();
  }

  private drawPulley(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isMovable: boolean
  ): void {
    ctx.save();

    // Frame/Bracket
    ctx.strokeStyle = isMovable ? '#38bdf8' : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - radius - 2, y - radius - 2, (radius + 2) * 2, (radius + 2) * 2);

    // Wheel rim
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - radius + 3, y);
    ctx.lineTo(x + radius - 3, y);
    ctx.moveTo(x, y - radius + 3);
    ctx.lineTo(x, y + radius - 3);
    ctx.stroke();

    // Center Axle Pin
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawStoneBlock(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    loadKg: number
  ): void {
    ctx.save();
    const width = 84;
    const height = 52;
    const x = centerX - width / 2;
    const y = centerY - height / 2;

    // Stone body
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    // Stone chiseled bevel lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + width - 5, y + 5);
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + 5, y + height - 5);
    ctx.stroke();

    // Hoisting Straps
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 14, y, 10, height);
    ctx.strokeRect(x + width - 24, y, 10, height);

    // Text Label
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${loadKg} kg`, centerX, centerY - 4);

    const newtons = Math.round(loadKg * GRAVITY_G);
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${newtons} N`, centerX, centerY + 11);

    ctx.restore();
  }

  private drawEffortTray(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    const width = 76;
    const height = 14;

    // Suspension cords
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x - width / 2, y);
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x + width / 2, y);
    ctx.stroke();

    // Tray base platform
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x - width / 2, y, width, height);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - width / 2, y, width, height);

    // Total effort label inside tray
    const totalEffort = this.placedWeights.reduce((s, w) => s + (w.kg ?? w.massKg), 0);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${totalEffort} kg`, x, y + height / 2);

    ctx.restore();
  }
}

// ============================================================================
// 6. FACTORIES & EXPORTS
// ============================================================================

export function createGame(): KidGame {
  return new PulleyLiftGame();
}

export const createPulleyLiftGame = createGame;
export default createGame;
