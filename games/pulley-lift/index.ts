import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup } from '../../src/core/types.js';
import type { SoundEngine } from '../../src/core/audio.js';
import { getTranslations, type HintState, type PulleyTranslations } from './i18n.js';

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
      counterClockwise: true
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
      counterClockwise: true
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
      counterClockwise: true
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
      counterClockwise: true
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
  springK = 24.0,
  dampingZ = 0.95,
  settleFramesRequired = 30
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
// 5. SCENE LAYOUT (pure, virtual coordinates)
// ============================================================================

/** Reference virtual scene size (4:3). The canvas is scaled uniformly to fit. */
export const VIRTUAL_W = 480;
export const VIRTUAL_H = 360;

const PULLEY_RADIUS = 16;
const STONE_W = 84;
const STONE_H = 48;
const PLATFORM_W = 60;
const PLATFORM_H = 20;
const PLATFORM_CORD = 24;
const SLING_GAP = 12;
const MAX_LIFT_PX = 104;
const EFFORT_START_Y = 112;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayout {
  ma: MechanicalAdvantage;
  vw: number;
  vh: number;
  radius: number;
  groundY: number;
  boomY: number;
  pulleyY: number;
  mastX: number;
  /** Centre x of the effort platform (left of the rig). */
  platformX: number;
  /** Centre x of the guide pulley that redirects the rope to the platform. */
  guideX: number;
  /** Centre x of the lifted stone (right of the rig). */
  stoneX: number;
  effortStartY: number;
  effortMaxY: number;
  /** Maximum drawn lift of the stone in virtual px (scaled so the effort platform stays on screen). */
  maxLiftPx: number;
}

export interface SceneState {
  progress: number;
  liftPx: number;
  stoneCenterY: number;
  stoneTopY: number;
  hookY: number;
  movableY: number;
  effortY: number;
  stoneBox: Box;
  platformBox: Box;
}

export function clampLiftProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function computeSceneLayout(
  ma: MechanicalAdvantage,
  vw: number = VIRTUAL_W,
  vh: number = VIRTUAL_H
): SceneLayout {
  const groundY = vh - 40;
  const boomY = 56;
  const platformX = Math.round(vw * 0.19);
  const effortMaxY = groundY - PLATFORM_H - 6;
  return {
    ma,
    vw,
    vh,
    radius: PULLEY_RADIUS,
    groundY,
    boomY,
    pulleyY: boomY + 30,
    mastX: 28,
    platformX,
    guideX: platformX + PULLEY_RADIUS,
    stoneX: Math.round(vw * 0.72),
    effortStartY: EFFORT_START_Y,
    effortMaxY,
    maxLiftPx: Math.min(MAX_LIFT_PX, (effortMaxY - EFFORT_START_Y) / ma)
  };
}

export function getSceneState(layout: SceneLayout, progress: number): SceneState {
  const p = clampLiftProgress(progress);
  const liftPx = p * layout.maxLiftPx;
  const stoneCenterY = layout.groundY - STONE_H / 2 - liftPx;
  const stoneTopY = stoneCenterY - STONE_H / 2;
  const hookY = stoneTopY - SLING_GAP;
  const movableY = layout.ma === 1 ? hookY : hookY - (layout.radius + 2);
  // Rope conservation: the effort end travels MA times the load displacement.
  const effortY = layout.effortStartY + liftPx * layout.ma;
  return {
    progress: p,
    liftPx,
    stoneCenterY,
    stoneTopY,
    hookY,
    movableY,
    effortY,
    stoneBox: { x: layout.stoneX - STONE_W / 2, y: stoneTopY, w: STONE_W, h: STONE_H },
    platformBox: {
      x: layout.platformX - PLATFORM_W / 2,
      y: effortY - PLATFORM_CORD,
      w: PLATFORM_W,
      h: PLATFORM_CORD + PLATFORM_H
    }
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export interface RigGeometry {
  segments: RopeSegment[];
  pulleys: PulleyWheel[];
  /** Vertical brackets joining fixed pulleys / the rope anchor to the crane jib. */
  hangers: { x: number; y1: number; y2: number }[];
  /** Slings and yokes joining the movable pulleys (or the rope end) to the stone. */
  slings: { x1: number; y1: number; x2: number; y2: number }[];
}

/**
 * Lays the rope and pulleys out across the scene: effort platform on the left, rig above the
 * stone on the right, with a guide pulley carrying the rope along the jib to the platform.
 */
export function buildRig(layout: SceneLayout, state: SceneState): RigGeometry {
  const r = layout.radius;
  const ma = layout.ma;
  const raw = generateRopePath(ma, 0, layout.pulleyY, state.movableY, state.effortY, r);

  // Distance (in raw x) from the rope origin to the stone hook point.
  const loadOffset = ma === 1 ? 0 : ma === 2 ? r : 3 * r;
  const base = layout.stoneX + loadOffset;
  const mx = (x: number | undefined): number => base - (x ?? 0);

  const pulleys: PulleyWheel[] = raw.pulleys.map((p) => ({ ...p, centerX: mx(p.centerX) }));
  const segments: RopeSegment[] = [];
  const lastIdx = raw.segments.length - 1;
  const lastArcIdx = lastIdx - 1;

  raw.segments.forEach((s, i) => {
    if (i === lastIdx) return; // the free effort strand is re-routed below
    if (s.type === 'line') {
      segments.push({ ...s, startX: mx(s.startX), endX: mx(s.endX) });
    } else {
      const arc: RopeSegment = {
        ...s,
        centerX: mx(s.centerX),
        startAngle: Math.PI - (s.startAngle ?? 0),
        endAngle: Math.PI - (s.endAngle ?? 0),
        counterClockwise: !(s.counterClockwise ?? false)
      };
      if (i === lastArcIdx) arc.endAngle = -Math.PI / 2; // leave over the top of the last fixed pulley
      segments.push(arc);
    }
  });

  const lastFixedX = mx(raw.segments[lastArcIdx].centerX);
  const ropeTopY = layout.pulleyY - r;
  segments.push({
    type: 'line',
    startX: lastFixedX,
    startY: ropeTopY,
    endX: layout.guideX,
    endY: ropeTopY
  });
  segments.push({
    type: 'arc',
    centerX: layout.guideX,
    centerY: layout.pulleyY,
    radius: r,
    startAngle: -Math.PI / 2,
    endAngle: Math.PI,
    counterClockwise: true
  });
  segments.push({
    type: 'line',
    startX: layout.platformX,
    startY: layout.pulleyY,
    endX: layout.platformX,
    endY: state.effortY
  });
  pulleys.push({
    id: 'guide',
    isMovable: false,
    centerX: layout.guideX,
    centerY: layout.pulleyY,
    radius: r
  });

  const hangers: RigGeometry['hangers'] = [];
  for (const p of pulleys) {
    if (!p.isMovable) {
      hangers.push({ x: p.centerX, y1: layout.boomY, y2: p.centerY - r - 2 });
    }
  }
  if (ma === 2 || ma === 4) {
    hangers.push({ x: base, y1: layout.boomY, y2: layout.pulleyY });
  }

  const slings: RigGeometry['slings'] = [];
  if (ma === 1) {
    slings.push({ x1: layout.stoneX, y1: state.hookY, x2: layout.stoneX, y2: state.stoneTopY });
  } else {
    for (const p of pulleys) {
      if (p.isMovable) {
        slings.push({ x1: p.centerX, y1: p.centerY + r + 2, x2: p.centerX, y2: state.stoneTopY });
      }
    }
  }
  if (ma === 3) {
    // The rope's standing end is made fast to the movable block through a yoke.
    const beamY = state.movableY + r + 2;
    const movable = pulleys.find((p) => p.isMovable);
    if (movable) {
      slings.push({ x1: base, y1: state.movableY, x2: base, y2: beamY });
      slings.push({ x1: base, y1: beamY, x2: movable.centerX, y2: beamY });
    }
  }

  return { segments, pulleys, hangers, slings };
}

function hintStateFor(currentKg: number, requiredKg: number): HintState {
  if (currentKg <= 0) return 'empty';
  if (currentKg === requiredKg) return 'match';
  if (currentKg > requiredKg) return 'over';
  return currentKg / requiredKg >= 0.7 ? 'close' : 'low';
}

/** Fixed time step used to integrate the lift so pacing does not depend on the frame rate. */
const PHYSICS_STEP = 1 / 60;
/** Pause after the settle window so the child can see the result before the next level. */
const LEVEL_ADVANCE_MS = 800;
/** Pause on the final banner before a fresh round starts. */
const NEW_ROUND_MS = 3500;

// ============================================================================
// 6. KIDGAME MAIN CLASS (PulleyLiftGame)
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

  // Level weights keep their original slot; placed ones leave a placeholder behind.
  private levelWeights: CounterWeight[] = [];
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
  private accumulator: number = 0;
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
    this.accumulator = 0;
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
      this.draw();
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
      // Score convention: a new age bracket is a new run (score, streak and timer restart).
      this.resetProgress();
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

  /** Resets score, streak and the elapsed-time origin, and refreshes the score HUD. */
  private resetProgress(): void {
    this.score = 0;
    this.streak = 0;
    this.startTime = Date.now();
    this.updateScoreDisplay();
  }

  private updateScoreDisplay(): void {
    const scoreEl = this.container?.querySelector('#score-display');
    if (scoreEl) scoreEl.textContent = `⭐ ${this.score}`;
  }

  private clearPendingTimeouts(): void {
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();
  }

  private renderDOM(): void {
    this.container.innerHTML = `
      <style>
        .pl-root { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 20%, #1e293b, #090d16); color: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; user-select: none; -webkit-user-select: none; overflow-x: hidden; overflow-y: auto; box-sizing: border-box; }
        .pl-root *, .pl-root *::before, .pl-root *::after { box-sizing: border-box; }
        .pl-hud { display: flex; flex-direction: column; gap: 4px; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10; }
        .pl-hud-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pl-hud-left, .pl-hud-right { display: flex; align-items: center; gap: 10px; }
        .pl-btn { padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; min-height: 44px; display: flex; align-items: center; transition: transform 0.1s ease; }
        .pl-btn:hover { transform: scale(1.04); }
        #hud-instruction { min-height: 2.7em; display: flex; align-items: center; justify-content: center; font-size: 0.88rem; color: #cbd5e1; font-weight: 500; text-align: center; line-height: 1.35; }
        .pl-stage { position: relative; flex: 1 1 0; min-height: 260px; display: flex; justify-content: center; overflow: hidden; touch-action: none; }
        #pulley-canvas { display: block; width: 100%; max-width: 760px; height: 100%; }
        #win-banner { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); padding: 6px 16px; border-radius: 9999px; background: rgba(251,191,36,0.18); border: 1px solid rgba(251,191,36,0.5); color: #fbbf24; font-weight: 800; font-size: 0.95rem; white-space: nowrap; opacity: 0; transition: opacity 0.25s ease; pointer-events: none; }
        #win-banner.show { opacity: 1; }
        .pl-panel { position: sticky; bottom: 0; z-index: 10; padding: 8px 16px 12px; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.08); }
        .pl-panel-inner { display: flex; align-items: flex-start; gap: 12px; max-width: 960px; margin: 0 auto; }
        .pl-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .pl-col-effort { flex: 0 0 36%; }
        .pl-col-inventory { flex: 1 1 0; }
        .pl-col-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pl-tray { display: grid; grid-template-rows: repeat(2, 44px); grid-auto-flow: column; grid-auto-columns: minmax(56px, max-content); gap: 6px; height: 112px; padding: 4px; border-radius: 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; align-content: start; }
        #effort-tray { background: rgba(56, 189, 248, 0.08); border: 2px dashed rgba(56, 189, 248, 0.4); }
        #inventory-tray { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
        .weight-item { display: inline-flex; align-items: center; justify-content: center; min-width: 56px; min-height: 44px; padding: 6px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.18); color: #0f172a; font-weight: 800; font-size: 0.8rem; white-space: nowrap; cursor: grab; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.1s ease, filter 0.1s ease; touch-action: none; }
        .weight-item:hover { transform: scale(1.05); filter: brightness(1.08); }
        .weight-slot { min-width: 56px; min-height: 44px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.14); }
        @media (max-width: 520px) {
          .pl-panel-inner { gap: 8px; }
          #hud-instruction { min-height: 4.05em; }
          .pl-btn { padding: 6px 10px; font-size: 0.78rem; }
        }
      </style>
      <div class="pl-root">
        <!-- Top HUD -->
        <div class="pl-hud">
          <div class="pl-hud-row">
            <div class="pl-hud-left">
              <span style="font-weight: 800; font-size: 1.05rem; color: #38bdf8; letter-spacing: -0.02em;" id="hud-title">${this.t.title}</span>
              <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; white-space: nowrap;">${this.t.level} 1/${this.levels.length}</span>
            </div>
            <div class="pl-hud-right">
              <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.05rem;">⭐ 0</div>
              <button id="btn-sound-toggle" class="pl-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1;">${this.audio.enabled ? this.t.soundOn : this.t.soundOff}</button>
              <button id="btn-reset" class="pl-btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5;">${this.t.reset}</button>
            </div>
          </div>
          <div id="hud-instruction" aria-live="polite"></div>
        </div>

        <!-- Canvas Middle Viewport -->
        <div id="canvas-wrapper" class="pl-stage">
          <canvas id="pulley-canvas"></canvas>
          <div id="win-banner" aria-hidden="true">${this.t.wellDone}</div>
        </div>

        <!-- Bottom Controls & Manipulatives Tray -->
        <div class="pl-panel">
          <div class="pl-panel-inner">
            <div class="pl-col pl-col-effort">
              <span id="effort-tray-label" class="pl-col-label" style="color: #38bdf8;">${this.t.effortTrayLabel}:</span>
              <div id="effort-tray" class="pl-tray"></div>
            </div>
            <div class="pl-col pl-col-inventory">
              <span id="inventory-label" class="pl-col-label" style="color: #94a3b8;">${this.t.inventoryLabel}:</span>
              <div id="inventory-tray" class="pl-tray"></div>
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

    const banner = this.container.querySelector('#win-banner');
    if (banner) banner.textContent = this.t.wellDone;

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
      this.draw();
    };

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => resize());
      this.resizeObserver.observe(this.canvas);
    }
    resize();
  }

  private setupLevel(index: number): void {
    // Any pending level-advance / new-round timer belongs to the previous setup.
    this.clearPendingTimeouts();
    this.currentLevelIndex = index;
    const lvl = this.currentLevel;

    // Reset weights
    this.levelWeights = lvl.availableWeights.map((w) => ({ ...w }));
    this.placedWeights = [];
    this.isRoundOver = false;
    this.accumulator = 0;
    this.container.querySelector('#win-banner')?.classList.remove('show');

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

  private isPlaced(w: CounterWeight): boolean {
    return this.placedWeights.some((p) => p.id === w.id);
  }

  private renderTrays(): void {
    const invTray = this.container.querySelector('#inventory-tray');
    const effortTray = this.container.querySelector('#effort-tray');
    if (!invTray || !effortTray) return;

    invTray.innerHTML = '';
    effortTray.innerHTML = '';

    // Inventory keeps every weight in its original slot; placed ones leave an empty placeholder
    // so the tray never reflows (and the canvas above never resizes).
    this.levelWeights.forEach((w) => {
      if (this.isPlaced(w)) {
        const slot = document.createElement('div');
        slot.className = 'weight-slot';
        slot.setAttribute('aria-hidden', 'true');
        invTray.appendChild(slot);
      } else {
        invTray.appendChild(this.createWeightDOM(w, false));
      }
    });

    // Effort tray pieces, in placement order
    this.placedWeights.forEach((w) => {
      effortTray.appendChild(this.createWeightDOM(w, true));
    });

    this.updateHUDPrompt();
  }

  private createWeightDOM(w: CounterWeight, inEffortTray: boolean): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'weight-item';
    btn.dataset.id = w.id;
    btn.dataset.kg = String(w.kg);
    btn.style.background = w.color || '#38bdf8';
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
        // Granular undo: the piece returns to its original slot in the counterweights tray
        this.removeWeightFromEffortTray(w);
      } else {
        // Tap to add to effort tray
        this.addWeightToEffortTray(w);
      }
    });

    return btn;
  }

  private addWeightToEffortTray(w: CounterWeight): void {
    if (this.isRoundOver) return;
    const weight = this.levelWeights.find((item) => item.id === w.id);
    if (weight && !this.isPlaced(weight)) {
      this.placedWeights.push(weight);
      this.audio.playDrop();
      this.renderTrays();
    }
  }

  private removeWeightFromEffortTray(w: CounterWeight): void {
    if (this.isRoundOver) return;
    const idx = this.placedWeights.findIndex((item) => item.id === w.id);
    if (idx !== -1) {
      this.placedWeights.splice(idx, 1);
      this.audio.playPop();
      this.renderTrays();
    }
  }

  private clearEffortTray(): void {
    if (this.isRoundOver || this.placedWeights.length === 0) return;
    this.placedWeights = [];
    this.audio.playPop();
    this.renderTrays();
  }

  private updateHUDPrompt(): void {
    const promptEl = this.container.querySelector('#hud-instruction');
    if (!promptEl) return;

    const lvl = this.currentLevel;
    const currentKg = this.placedWeights.reduce((sum, w) => sum + (w.kg ?? w.massKg), 0);
    const loadKg = lvl.loadKg;
    const ma = lvl.mechanicalAdvantage;
    // Only the coarse direction is derived from the hidden target; the target itself is never shown.
    const state = hintStateFor(currentKg, lvl.targetEffortKg);

    let text = '';
    if (lvl.ageGroup === '3-5') {
      text = this.t.formatPreschoolPrompt(loadKg, currentKg, state);
    } else if (lvl.ageGroup === '6-8') {
      text = this.t.formatElementaryPrompt(loadKg, currentKg, ma, state);
    } else {
      text = this.t.formatUpperElementaryPrompt(
        loadKg,
        Math.round(loadKg * GRAVITY_G),
        currentKg,
        Math.round(currentKg * GRAVITY_G),
        ma,
        state,
        lvl.ropeDistanceM,
        lvl.targetWorkJoules
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

    this.container.querySelector('#win-banner')?.classList.add('show');

    this.score += 100 + this.streak * 20;
    this.streak++;
    this.updateScoreDisplay();

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
        return;
      }

      const timeElapsed = Math.round((Date.now() - this.startTime) / 1000);
      this.context.emit('game:complete', {
        stars: 3,
        score: this.score,
        timeElapsed,
        summary: this.t.summary
      });

      // Do not leave the board frozen: after a short celebration a fresh round begins.
      const replay = setTimeout(() => {
        this.pendingTimeouts.delete(replay);
        this.startNewRound();
      }, NEW_ROUND_MS);
      this.pendingTimeouts.add(replay);
    }, LEVEL_ADVANCE_MS);
    this.pendingTimeouts.add(timeout);
  }

  private startNewRound(): void {
    this.resetProgress();
    this.loadLevels();
    this.setupLevel(0);
    this.context.emit('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Starting level 1: ${this.currentLevel.title}`
    });
  }

  // ============================================================================
  // TICK / RENDER LOOP
  // ============================================================================

  private tick = (timestamp: number): void => {
    if (this.isPaused) return;

    const elapsed = Math.min(0.25, (timestamp - this.lastTime) / 1000 || PHYSICS_STEP);
    this.lastTime = timestamp;

    // Fixed-step integration keeps the pacing identical at any frame rate.
    this.accumulator += elapsed;
    while (this.accumulator >= PHYSICS_STEP) {
      this.updatePhysics(PHYSICS_STEP);
      this.accumulator -= PHYSICS_STEP;
    }
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
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssW = this.canvas.width / dpr;
    const cssH = this.canvas.height / dpr;

    // Uniform scale of the 4:3 reference scene; extra room is used by re-laying out the scene.
    const scale = Math.min(cssW / VIRTUAL_W, cssH / VIRTUAL_H) || 1;
    const vw = cssW / scale;
    const vh = cssH / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

    const lvl = this.currentLevel;
    const layout = computeSceneLayout(lvl.mechanicalAdvantage, vw, vh);
    // Overshoot of the spring is clamped: the stone never rises past the target line.
    const state = getSceneState(layout, this.physicsState.liftProgress);
    const rig = buildRig(layout, state);

    // Text never renders smaller than ~11 CSS px, whatever the scale.
    const px = (n: number) => Math.max(n, 11 / scale);

    // 1. Crane, ground and target line
    this.drawCrane(ctx, layout);
    this.drawTargetLine(ctx, layout, px);

    // 2. Rope, brackets, pulleys
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of rig.segments) {
      ctx.beginPath();
      if (seg.type === 'line') {
        ctx.moveTo(seg.startX ?? 0, seg.startY ?? 0);
        ctx.lineTo(seg.endX ?? 0, seg.endY ?? 0);
      } else {
        ctx.arc(
          seg.centerX ?? 0,
          seg.centerY ?? 0,
          seg.radius ?? layout.radius,
          seg.startAngle ?? 0,
          seg.endAngle ?? Math.PI,
          seg.counterClockwise ?? false
        );
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    for (const h of rig.hangers) {
      ctx.beginPath();
      ctx.moveTo(h.x, h.y1);
      ctx.lineTo(h.x, h.y2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    for (const s of rig.slings) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();

    for (const p of rig.pulleys) {
      this.drawPulley(ctx, p.centerX, p.centerY, p.radius, p.isMovable);
    }

    // 3. Stone load and effort platform
    this.drawStoneBlock(ctx, layout.stoneX, state.stoneCenterY, lvl.loadKg, lvl.ageGroup !== '3-5', px);
    this.drawEffortTray(ctx, layout.platformX, state.effortY, px);

    // 4. Ghost weight while dragging (pointer position converted to scene units)
    if (this.isDraggingBeyondThreshold && this.draggingWeight) {
      const gx = this.dragCurrentPos.x / scale;
      const gy = this.dragCurrentPos.y / scale;
      ctx.save();
      ctx.fillStyle = this.draggingWeight.color || '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(gx - 28, gy - 16, 56, 32);
      ctx.strokeRect(gx - 28, gy - 16, 56, 32);
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 ${px(11)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.draggingWeight.kg} kg`, gx, gy);
      ctx.restore();
    }
  }

  private drawCrane(ctx: CanvasRenderingContext2D, layout: SceneLayout): void {
    const { vw, boomY, groundY, mastX } = layout;
    ctx.save();

    // Ground Line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(vw, groundY);
    ctx.stroke();

    // Ground safety hatching
    ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
    for (let x = 10; x < vw; x += 30) {
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
    ctx.moveTo(mastX - 20, boomY);
    ctx.lineTo(vw - 16, boomY);
    ctx.stroke();

    // Boom top stay cable
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mastX, boomY - 30);
    ctx.lineTo(vw - 40, boomY);
    ctx.moveTo(mastX, boomY - 30);
    ctx.lineTo(mastX - 12, boomY);
    ctx.stroke();

    ctx.restore();
  }

  /** Dotted target line at the stone's final resting height; the tag sits to the left of the line. */
  private drawTargetLine(
    ctx: CanvasRenderingContext2D,
    layout: SceneLayout,
    px: (n: number) => number
  ): void {
    const y = layout.groundY - layout.maxLiftPx;
    const x0 = layout.stoneX - 58;
    const x1 = layout.vw - 8;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8';
    ctx.font = `600 ${px(11)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // Left of the line start: clear of the stone, the pulleys and the rope path.
    ctx.fillText(this.t.targetHeight(this.currentLevel.targetHeightM), x0 - 8, y + 4);
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
    loadKg: number,
    showNewtons: boolean,
    px: (n: number) => number
  ): void {
    ctx.save();
    const x = centerX - STONE_W / 2;
    const y = centerY - STONE_H / 2;

    // Stone body
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.fillRect(x, y, STONE_W, STONE_H);
    ctx.strokeRect(x, y, STONE_W, STONE_H);

    // Stone chiseled bevel lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + STONE_W - 5, y + 5);
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + 5, y + STONE_H - 5);
    ctx.stroke();

    // Hoisting Straps
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 8, y, 8, STONE_H);
    ctx.strokeRect(x + STONE_W - 16, y, 8, STONE_H);

    // Text Label (newtons are too advanced for preschoolers)
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 ${px(13)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${loadKg} kg`, centerX, showNewtons ? centerY - 7 : centerY);

    if (showNewtons) {
      const newtons = Math.round(loadKg * GRAVITY_G);
      ctx.font = `600 ${px(10)}px system-ui, sans-serif`;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${newtons} N`, centerX, centerY + 10);
    }

    ctx.restore();
  }

  private drawEffortTray(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    px: (n: number) => number
  ): void {
    ctx.save();

    // Suspension cords
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - PLATFORM_CORD);
    ctx.lineTo(x - PLATFORM_W / 2, y);
    ctx.moveTo(x, y - PLATFORM_CORD);
    ctx.lineTo(x + PLATFORM_W / 2, y);
    ctx.stroke();

    // Tray base platform
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x - PLATFORM_W / 2, y, PLATFORM_W, PLATFORM_H);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - PLATFORM_W / 2, y, PLATFORM_W, PLATFORM_H);

    // Total effort label inside tray
    const totalEffort = this.placedWeights.reduce((s, w) => s + (w.kg ?? w.massKg), 0);
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${Math.min(px(11), PLATFORM_H - 4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${totalEffort} kg`, x, y + PLATFORM_H / 2);

    ctx.restore();
  }
}

// ============================================================================
// 7. FACTORIES & EXPORTS
// ============================================================================

export function createGame(): KidGame {
  return new PulleyLiftGame();
}

export const createPulleyLiftGame = createGame;
export default createGame;
