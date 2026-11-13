import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup } from '../../src/core/types.js';
import { getTranslations, type RotationDirection } from './i18n.js';

// ============================================================================
// 1. DATA TYPES & INTERFACES
// ============================================================================

export const GEAR_MODULE = 10;
export const VALID_TEETH_COUNTS = [6, 8, 12, 16, 24] as const;
export type ToothCount = typeof VALID_TEETH_COUNTS[number];
export type Direction = RotationDirection;
export type TargetType = 'windmill' | 'dial' | 'clock';

export interface GearColorDef {
  primary: string;
  dark: string;
  light: string;
  accent: string;
  label: string;
}

export const GEAR_PALETTE: Record<number, GearColorDef> = {
  6:  { primary: '#ef4444', dark: '#b91c1c', light: '#f87171', accent: '#fca5a5', label: '6T' },
  8:  { primary: '#f59e0b', dark: '#b45309', light: '#fbbf24', accent: '#fde68a', label: '8T' },
  12: { primary: '#10b981', dark: '#047857', light: '#34d399', accent: '#a7f3d0', label: '12T' },
  16: { primary: '#0284c7', dark: '#075985', light: '#38bdf8', accent: '#bae6fd', label: '16T' },
  24: { primary: '#8b5cf6', dark: '#6d28d9', light: '#a78bfa', accent: '#ddd6fe', label: '24T' }
};

export const GEAR_COLORS: Record<number, string> = {
  6: '#ef4444',
  8: '#f59e0b',
  12: '#10b981',
  16: '#0284c7',
  24: '#8b5cf6'
};

export interface GearItem {
  id: string;
  teeth: number;
  pitchRadius: number;
  color: string;
  label?: string;
}

export interface PegDef {
  id: string;
  x: number;
  y: number;
  isMotor?: boolean;
  isTarget?: boolean;
  teeth?: number;
  fixed?: boolean;
}

export interface GearLevel {
  id: string;
  levelNumber: number;
  ageGroup: AgeGroup;
  title: string;
  instruction?: string;
  motor: {
    pegId: string;
    x: number;
    y: number;
    teeth: number;
    rpm: number;
    direction: Direction;
  };
  target: {
    pegId: string;
    x: number;
    y: number;
    teeth: number;
    targetRpm?: number;
    targetDirection?: Direction;
    toleranceRpm?: number;
    type: TargetType;
  };
  pegs: PegDef[];
  inventory: GearItem[];
  solutionPath?: string[];
  distractors?: GearItem[];
  antiMirroring?: boolean;
}

export interface PlacedGear {
  pegId: string;
  gear: GearItem;
}

export interface GearTrainSimulationResult {
  connected: boolean;
  won: boolean;
  isJammed: boolean;
  pathPegIds: string[];
  outputRpm: number;
  outputDirection: Direction | null;
  directionCorrect: boolean;
  speedCorrect: boolean;
  settlingTime: number;
  targetReached: boolean;
  /** Why the train is jammed: plain tooth overlap vs. a closed odd loop (null when not jammed). */
  jamReason?: 'overlap' | 'odd-cycle' | null;
}

// ============================================================================
// 2. PURE DOMAIN MATHEMATICS & KINEMATICS
// ============================================================================

/**
 * Calculates the pitch radius for a given tooth count.
 * R = (teeth * module) / 2
 */
export function calculatePitchRadius(teeth: number, module: number = GEAR_MODULE): number {
  if (!teeth || typeof teeth !== 'number' || teeth <= 0 || isNaN(teeth)) return 0;
  return (teeth * module) / 2;
}

export const getPitchRadius = calculatePitchRadius;

/**
 * Calculates outer tip (addendum) radius.
 */
export function calculateOuterRadius(teeth: number, module: number = GEAR_MODULE): number {
  const r = calculatePitchRadius(teeth, module);
  return r > 0 ? r + 0.85 * (module * 0.8) : 0;
}

/**
 * Calculates root dedendum radius.
 */
export function calculateRootRadius(teeth: number, module: number = GEAR_MODULE): number {
  const r = calculatePitchRadius(teeth, module);
  return r > 0 ? Math.max(8, r - 1.10 * (module * 0.8)) : 0;
}

/**
 * Calculates ideal peg center distance for two meshing gears.
 */
export function calculatePegDistance(n1: number, n2: number, module: number = GEAR_MODULE): number {
  return calculatePitchRadius(n1, module) + calculatePitchRadius(n2, module);
}

/**
 * Greatest Common Divisor (Euclidean)
 */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export const calculateGCD = gcd;

/**
 * Least Common Multiple
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.round(a * b)) / gcd(a, b);
}

export const calculateLCM = lcm;

/**
 * Calculates meshing cycle period and revolutions before re-alignment
 */
export function calculateMeshingCycle(n1: number, n2: number): { lcm: number; revs1: number; revs2: number } {
  const l = lcm(n1, n2);
  return {
    lcm: l,
    revs1: n1 > 0 ? l / n1 : 0,
    revs2: n2 > 0 ? l / n2 : 0
  };
}

/**
 * Simplifies gear ratio into irreducible fraction and numeric ratio
 */
export function simplifyGearRatio(driverTeeth: number, drivenTeeth: number): {
  numerator: number;
  denominator: number;
  ratio: number;
  display: string;
} {
  if (driverTeeth <= 0 || drivenTeeth <= 0) {
    return { numerator: 0, denominator: 0, ratio: 0, display: '0:0' };
  }
  const g = gcd(driverTeeth, drivenTeeth);
  const num = driverTeeth / g;
  const den = drivenTeeth / g;
  const ratio = Math.round((driverTeeth / drivenTeeth) * 100) / 100;
  return {
    numerator: num,
    denominator: den,
    ratio,
    display: `${num}:${den}`
  };
}

/**
 * Checks if two gears are meshed within tolerance.
 */
export function areGearsMeshed(
  g1: { x: number; y: number; radius?: number; teeth?: number },
  g2: { x: number; y: number; radius?: number; teeth?: number },
  tolerance: number = 3,
  module: number = GEAR_MODULE
): boolean {
  if (g1.x === g2.x && g1.y === g2.y) return false;
  const r1 = g1.radius !== undefined ? g1.radius : calculatePitchRadius(g1.teeth ?? 0, module);
  const r2 = g2.radius !== undefined ? g2.radius : calculatePitchRadius(g2.teeth ?? 0, module);
  if (r1 <= 0 || r2 <= 0) return false;

  const dx = g2.x - g1.x;
  const dy = g2.y - g1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const idealDist = r1 + r2;
  return Math.abs(dist - idealDist) <= tolerance;
}

/**
 * Checks if two gears collide / interfere (distance too small for pitch radii).
 */
export function doGearsCollide(
  g1: { x: number; y: number; radius?: number; teeth?: number },
  g2: { x: number; y: number; radius?: number; teeth?: number },
  tolerance: number = 3,
  module: number = GEAR_MODULE
): boolean {
  if (g1.x === g2.x && g1.y === g2.y) return true;
  const r1 = g1.radius !== undefined ? g1.radius : calculatePitchRadius(g1.teeth ?? 0, module);
  const r2 = g2.radius !== undefined ? g2.radius : calculatePitchRadius(g2.teeth ?? 0, module);
  if (r1 <= 0 || r2 <= 0) return false;

  const dx = g2.x - g1.x;
  const dy = g2.y - g1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < (r1 + r2) - tolerance;
}

/**
 * Inverts rotational direction ('cw' <-> 'ccw')
 */
export function invertDirection(dir: Direction): Direction {
  return dir === 'cw' ? 'ccw' : 'cw';
}

/**
 * Computes output direction for gear train of length k.
 * Each mesh alternates direction.
 */
export function calculateDirection(initialDir: Direction, trainLength: number): Direction {
  if (trainLength <= 0) return initialDir;
  return trainLength % 2 === 1 ? initialDir : invertDirection(initialDir);
}

/**
 * Computes single mesh output rotational speed (RPM).
 * RPM_out = RPM_in * (N_in / N_out)
 */
export function calculateOutputSpeed(motorRpm: number, driverTeeth: number, drivenTeeth: number): number {
  if (drivenTeeth <= 0) return 0;
  return Math.round((motorRpm * (driverTeeth / drivenTeeth)) * 100) / 100;
}

/**
 * Computes output speed across a multi-gear simple train.
 * Intermediate gears act as idlers, canceling algebraically.
 */
export function calculateTrainOutputSpeed(motorRpm: number, teethSequence: number[]): number {
  if (!teethSequence || teethSequence.length <= 1) return motorRpm;
  const first = teethSequence[0];
  const last = teethSequence[teethSequence.length - 1];
  if (last <= 0) return 0;
  return Math.round((motorRpm * (first / last)) * 100) / 100;
}

/**
 * Helper to construct a validated GearItem manipulative
 */
export function createGearItem(teeth: number, id?: string): GearItem {
  const t = Math.max(0, teeth);
  const color = GEAR_COLORS[t] || '#64748b';
  return {
    id: id || `gear-${t}-${Math.random().toString(36).substring(2, 7)}`,
    teeth: t,
    pitchRadius: calculatePitchRadius(t),
    color,
    label: `${t}T`
  };
}

// ============================================================================
// 3. GRAPH-BASED SIMULATOR & KINEMATICS SOLVER
// ============================================================================

interface GraphNode {
  id: string;
  x: number;
  y: number;
  teeth: number;
  isMotor?: boolean;
  isTarget?: boolean;
}

/**
 * Headless simulator function executing full physical meshing,
 * odd-cycle jamming detection via BFS 2-coloring, direction parity,
 * speed calculation, and settling window evaluation.
 */
export function simulateGearTrain(
  level: GearLevel,
  placedGears: PlacedGear[],
  durationSeconds?: number
): GearTrainSimulationResult {
  const emptyResult: GearTrainSimulationResult = {
    connected: false,
    won: false,
    isJammed: false,
    pathPegIds: [],
    outputRpm: 0,
    outputDirection: null,
    directionCorrect: false,
    speedCorrect: false,
    settlingTime: 0,
    targetReached: false,
    jamReason: null
  };

  if (!placedGears || placedGears.length === 0) {
    return emptyResult;
  }

  const motorId = level.motor.pegId || '__motor__';
  const targetId = level.target.pegId || '__target__';

  const nodes = new Map<string, GraphNode>();
  nodes.set(motorId, {
    id: motorId,
    x: level.motor.x,
    y: level.motor.y,
    teeth: level.motor.teeth,
    isMotor: true
  });
  nodes.set(targetId, {
    id: targetId,
    x: level.target.x,
    y: level.target.y,
    teeth: level.target.teeth,
    isTarget: true
  });

  const pegLookup = new Map<string, PegDef>();
  level.pegs.forEach((p) => pegLookup.set(p.id, p));

  for (const placed of placedGears) {
    const peg = pegLookup.get(placed.pegId);
    if (!peg) continue;
    nodes.set(peg.id, {
      id: peg.id,
      x: peg.x,
      y: peg.y,
      teeth: placed.gear.teeth
    });
  }

  // Build meshing graph
  const nodeIds = Array.from(nodes.keys());
  const adj = new Map<string, string[]>();
  nodeIds.forEach((id) => adj.set(id, []));

  let hasCollision = false;

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const u = nodes.get(nodeIds[i])!;
      const v = nodes.get(nodeIds[j])!;

      if (areGearsMeshed(u, v)) {
        adj.get(u.id)!.push(v.id);
        adj.get(v.id)!.push(u.id);
      } else if (doGearsCollide(u, v)) {
        hasCollision = true;
      }
    }
  }

  // BFS from motor node with 2-coloring for rotational direction
  let isJammed = hasCollision;
  let hasOddCycle = false;
  const kinematics = new Map<string, { rpm: number; direction: Direction; depth: number; parent: string | null }>();
  const queue: string[] = [motorId];
  kinematics.set(motorId, {
    rpm: level.motor.rpm,
    direction: level.motor.direction,
    depth: 1,
    parent: null
  });

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currKin = kinematics.get(currId)!;
    const currNode = nodes.get(currId)!;

    const neighbors = adj.get(currId) || [];
    for (const nbrId of neighbors) {
      const nbrNode = nodes.get(nbrId)!;
      const expectedDir = invertDirection(currKin.direction);
      const expectedRpm = calculateOutputSpeed(currKin.rpm, currNode.teeth, nbrNode.teeth);

      if (kinematics.has(nbrId)) {
        const existing = kinematics.get(nbrId)!;
        if (existing.direction !== expectedDir) {
          isJammed = true;
          hasOddCycle = true;
        }
      } else {
        kinematics.set(nbrId, {
          rpm: expectedRpm,
          direction: expectedDir,
          depth: currKin.depth + 1,
          parent: currId
        });
        queue.push(nbrId);
      }
    }
  }

  const targetReached = kinematics.has(targetId);
  const targetKin = targetReached ? kinematics.get(targetId)! : null;

  // Path reconstruction
  const pathPegIds: string[] = [];
  if (targetReached) {
    let curr: string | null = targetId;
    while (curr) {
      if (curr !== motorId && curr !== targetId) {
        pathPegIds.unshift(curr);
      }
      curr = kinematics.get(curr)?.parent ?? null;
    }
  }

  const connected = targetReached && !isJammed;
  const outputRpm = isJammed ? 0 : (targetKin ? targetKin.rpm : 0);
  const outputDirection = isJammed ? null : (targetKin ? targetKin.direction : null);

  const directionCorrect =
    level.target.targetDirection == null ||
    (outputDirection !== null && outputDirection === level.target.targetDirection);

  const speedCorrect =
    level.target.targetRpm == null ||
    (outputRpm > 0 && Math.abs(outputRpm - level.target.targetRpm) <= (level.target.toleranceRpm ?? 1.0));

  const satisfiesTarget = connected && !isJammed && directionCorrect && speedCorrect;

  const duration = durationSeconds !== undefined ? durationSeconds : 1.0;
  const settlingTime = satisfiesTarget ? duration : 0;
  const won = satisfiesTarget && duration >= 0.5;

  return {
    connected,
    won,
    isJammed,
    pathPegIds,
    outputRpm,
    outputDirection,
    directionCorrect,
    speedCorrect,
    settlingTime,
    targetReached,
    jamReason: isJammed ? (hasCollision ? 'overlap' : hasOddCycle ? 'odd-cycle' : null) : null
  };
}

export type GearDiagnosis = 'none' | 'overlap' | 'odd-cycle' | 'gap-bigger' | 'gap';

/**
 * Explains why a placed arrangement does not drive the target, so the HUD can give
 * a specific hint (without revealing the answer).
 * - overlap: teeth collide (a gear is too big)
 * - odd-cycle: real closed loop with an odd number of gears
 * - gap-bigger: all pegs are filled but neighbours do not touch (a gear is too small)
 * - gap: all pegs filled, not connected, no single obvious gap
 * - none: nothing to report (incomplete placement or connected)
 */
export function diagnoseGearTrain(level: GearLevel, placedGears: PlacedGear[]): GearDiagnosis {
  const sim = simulateGearTrain(level, placedGears, 0.1);
  if (sim.isJammed) return sim.jamReason === 'odd-cycle' ? 'odd-cycle' : 'overlap';
  if (sim.connected) return 'none';
  if (placedGears.length === 0 || placedGears.length < level.pegs.length) return 'none';

  const pegLookup = new Map(level.pegs.map((p) => [p.id, p] as const));
  const chain = [
    { x: level.motor.x, y: level.motor.y, r: calculatePitchRadius(level.motor.teeth) },
    ...placedGears
      .map((pg) => {
        const peg = pegLookup.get(pg.pegId);
        return peg ? { x: peg.x, y: peg.y, r: calculatePitchRadius(pg.gear.teeth) } : null;
      })
      .filter((n): n is { x: number; y: number; r: number } => n !== null)
      .sort((a, b) => a.x - b.x || a.y - b.y),
    { x: level.target.x, y: level.target.y, r: calculatePitchRadius(level.target.teeth) }
  ];
  for (let i = 0; i < chain.length - 1; i++) {
    const dist = Math.hypot(chain[i + 1].x - chain[i].x, chain[i + 1].y - chain[i].y);
    if (dist - (chain[i].r + chain[i + 1].r) > 3) return 'gap-bigger';
  }
  return 'gap';
}

/**
 * Enforces the Anti-Mirroring Rule across levels
 */
export function verifyAntiMirroring(level: GearLevel): boolean {
  if (level.ageGroup === '3-5') return true;

  // Rule 1: Empty board must never win
  if (simulateGearTrain(level, []).won) return false;

  // Rule 2: If multiple pegs are present, no single gear can trivially win
  if (level.pegs.length >= 2) {
    for (const gear of level.inventory) {
      for (const peg of level.pegs) {
        const testRes = simulateGearTrain(level, [{ pegId: peg.id, gear }]);
        if (testRes.won) return false;
      }
    }
  }

  // Rule 3: Inventory should offer diverse tooth counts rather than identical copies
  const uniqueTeeth = new Set(level.inventory.map((g) => g.teeth));
  if (level.inventory.length >= 3 && uniqueTeeth.size < 2) return false;

  return level.antiMirroring !== false;
}

// ============================================================================
// 4. CURRICULUM GENERATOR & CUSTOM LEVEL PARSER
// ============================================================================

export function generateLevelsForAge(ageGroup: AgeGroup): GearLevel[] {
  if (ageGroup === '3-5') {
    return [
      {
        id: 'preschool-1',
        levelNumber: 1,
        ageGroup: '3-5',
        title: 'Windmill Bridge',
        motor: { pegId: 'motor', x: 220, y: 230, teeth: 12, rpm: 30, direction: 'cw' },
        target: { pegId: 'target', x: 460, y: 230, teeth: 12, type: 'windmill' },
        pegs: [{ id: 'p1', x: 340, y: 230 }],
        inventory: [createGearItem(12, 'sol-12'), createGearItem(8, 'dist-8')],
        distractors: [createGearItem(8, 'dist-8')],
        solutionPath: ['p1']
      },
      {
        id: 'preschool-2',
        levelNumber: 2,
        ageGroup: '3-5',
        title: 'Double Step',
        motor: { pegId: 'motor', x: 180, y: 230, teeth: 16, rpm: 30, direction: 'cw' },
        target: { pegId: 'target', x: 580, y: 230, teeth: 16, type: 'windmill' },
        pegs: [
          { id: 'p1', x: 320, y: 230 },
          { id: 'p2', x: 440, y: 230 }
        ],
        inventory: [createGearItem(12, 'sol-1'), createGearItem(12, 'sol-2'), createGearItem(6, 'dist-6')],
        distractors: [createGearItem(6, 'dist-6')],
        solutionPath: ['p1', 'p2']
      },
      {
        id: 'preschool-3',
        levelNumber: 3,
        ageGroup: '3-5',
        title: 'Triple Bridge',
        motor: { pegId: 'motor', x: 160, y: 230, teeth: 8, rpm: 30, direction: 'cw' },
        target: { pegId: 'target', x: 640, y: 230, teeth: 8, type: 'windmill' },
        pegs: [
          { id: 'p1', x: 280, y: 230 },
          { id: 'p2', x: 400, y: 230 },
          { id: 'p3', x: 520, y: 230 }
        ],
        inventory: [
          createGearItem(16, 'sol-16a'),
          createGearItem(8, 'sol-8'),
          createGearItem(16, 'sol-16b'),
          createGearItem(12, 'dist-12')
        ],
        distractors: [createGearItem(12, 'dist-12')],
        solutionPath: ['p1', 'p2', 'p3']
      }
    ];
  }

  if (ageGroup === '6-8') {
    return [
      {
        id: 'elementary-1',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Direction Reversal',
        motor: { pegId: 'motor', x: 220, y: 230, teeth: 12, rpm: 40, direction: 'cw' },
        target: { pegId: 'target', x: 580, y: 230, teeth: 12, targetRpm: 40, targetDirection: 'ccw', type: 'dial' },
        pegs: [
          { id: 'p1', x: 340, y: 230 },
          { id: 'p2', x: 460, y: 230 }
        ],
        inventory: [
          createGearItem(12, 'sol-1'),
          createGearItem(12, 'sol-2'),
          createGearItem(8, 'dist-8'),
          createGearItem(16, 'dist-16')
        ],
        distractors: [createGearItem(8, 'dist-8'), createGearItem(16, 'dist-16')],
        antiMirroring: true,
        solutionPath: ['p1', 'p2']
      },
      {
        id: 'elementary-2',
        levelNumber: 2,
        ageGroup: '6-8',
        title: 'Speed Doubling 1:2',
        motor: { pegId: 'motor', x: 200, y: 230, teeth: 16, rpm: 30, direction: 'cw' },
        target: { pegId: 'target', x: 440, y: 230, teeth: 8, targetRpm: 60, targetDirection: 'cw', type: 'dial' },
        pegs: [{ id: 'p1', x: 340, y: 230 }],
        inventory: [createGearItem(12, 'sol-12'), createGearItem(16, 'dist-16'), createGearItem(8, 'dist-8')],
        distractors: [createGearItem(16, 'dist-16'), createGearItem(8, 'dist-8')],
        antiMirroring: true,
        solutionPath: ['p1']
      },
      {
        id: 'elementary-3',
        levelNumber: 3,
        ageGroup: '6-8',
        title: 'Double & Reverse',
        motor: { pegId: 'motor', x: 160, y: 230, teeth: 24, rpm: 40, direction: 'cw' },
        target: { pegId: 'target', x: 620, y: 230, teeth: 12, targetRpm: 80, targetDirection: 'ccw', type: 'dial' },
        pegs: [
          { id: 'p1', x: 340, y: 230 },
          { id: 'p2', x: 480, y: 230 }
        ],
        inventory: [
          createGearItem(12, 'sol-12'),
          createGearItem(16, 'sol-16'),
          createGearItem(8, 'dist-8'),
          createGearItem(24, 'dist-24')
        ],
        distractors: [createGearItem(8, 'dist-8'), createGearItem(24, 'dist-24')],
        antiMirroring: true,
        solutionPath: ['p1', 'p2']
      }
    ];
  }

  // Upper Elementary (9-11)
  return [
    {
      id: 'upper-1',
      levelNumber: 1,
      ageGroup: '9-11',
      title: 'Speed Halving 1:2',
      motor: { pegId: 'motor', x: 180, y: 230, teeth: 12, rpm: 120, direction: 'cw' },
      target: { pegId: 'target', x: 640, y: 230, teeth: 24, targetRpm: 60, targetDirection: 'ccw', type: 'dial' },
      pegs: [
        { id: 'p1', x: 300, y: 230 },
        { id: 'p2', x: 440, y: 230 }
      ],
      inventory: [
        createGearItem(12, 'sol-12'),
        createGearItem(16, 'sol-16'),
        createGearItem(8, 'dist-8'),
        createGearItem(6, 'dist-6')
      ],
      distractors: [createGearItem(8, 'dist-8'), createGearItem(6, 'dist-6')],
      antiMirroring: true,
      solutionPath: ['p1', 'p2']
    },
    {
      id: 'upper-2',
      levelNumber: 2,
      ageGroup: '9-11',
      title: 'Speed Tripling 3:1',
      motor: { pegId: 'motor', x: 160, y: 230, teeth: 24, rpm: 40, direction: 'cw' },
      target: { pegId: 'target', x: 480, y: 230, teeth: 8, targetRpm: 120, targetDirection: 'cw', type: 'dial' },
      pegs: [{ id: 'p1', x: 360, y: 230 }],
      inventory: [createGearItem(16, 'sol-16'), createGearItem(12, 'dist-12'), createGearItem(6, 'dist-6')],
      distractors: [createGearItem(12, 'dist-12'), createGearItem(6, 'dist-6')],
      antiMirroring: true,
      solutionPath: ['p1']
    },
    {
      id: 'upper-3',
      levelNumber: 3,
      ageGroup: '9-11',
      title: 'Fractional Ratio 2:3 & LCM',
      motor: { pegId: 'motor', x: 160, y: 230, teeth: 16, rpm: 60, direction: 'cw' },
      target: { pegId: 'target', x: 640, y: 230, teeth: 24, targetRpm: 40, targetDirection: 'ccw', type: 'dial' },
      pegs: [
        { id: 'p1', x: 300, y: 230 },
        { id: 'p2', x: 440, y: 230 }
      ],
      inventory: [
        createGearItem(12, 'sol-12'),
        createGearItem(16, 'sol-16'),
        createGearItem(6, 'dist-6'),
        createGearItem(8, 'dist-8'),
        createGearItem(24, 'dist-24')
      ],
      distractors: [createGearItem(6, 'dist-6'), createGearItem(8, 'dist-8'), createGearItem(24, 'dist-24')],
      antiMirroring: true,
      solutionPath: ['p1', 'p2']
    }
  ];
}

/**
 * Defensive custom level parser with sanitization and safe null return for fallback
 */
export function parseCustomLevels(raw: unknown): GearLevel[] | null {
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

  let rawList: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else {
    rawList = [parsed];
  }

  if (rawList.length === 0) return null;

  const validLevels: GearLevel[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i] as any;
    if (!item || typeof item !== 'object') continue;

    // Must have motor, target, and pegs
    if (!item.motor || typeof item.motor !== 'object') continue;
    if (!item.target || typeof item.target !== 'object') continue;
    if (!Array.isArray(item.pegs)) continue;

    const motorTeeth = Number(item.motor.teeth);
    const targetTeeth = Number(item.target.teeth);
    if (!motorTeeth || motorTeeth <= 0 || isNaN(motorTeeth)) continue;
    if (!targetTeeth || targetTeeth <= 0 || isNaN(targetTeeth)) continue;

    const motorX = Number(item.motor.x) || 160;
    const motorY = Number(item.motor.y) || 230;
    const targetX = Number(item.target.x) || 640;
    const targetY = Number(item.target.y) || 230;

    const motorRpm = Number(item.motor.rpm) > 0 ? Number(item.motor.rpm) : 60;
    const motorDir: Direction = item.motor.direction === 'ccw' ? 'ccw' : 'cw';

    const targetType: TargetType =
      item.target.type === 'windmill' || item.target.type === 'clock' ? item.target.type : 'dial';

    const targetDir: Direction | undefined =
      item.target.targetDirection === 'cw' || item.target.targetDirection === 'ccw'
        ? item.target.targetDirection
        : undefined;

    const targetRpm =
      typeof item.target.targetRpm === 'number' && item.target.targetRpm > 0 ? item.target.targetRpm : undefined;

    const pegs: PegDef[] = item.pegs
      .map((p: any, idx: number) => ({
        id: typeof p.id === 'string' ? p.id : `peg-${idx + 1}`,
        x: Number(p.x) || 300,
        y: Number(p.y) || 230,
        teeth: Number(p.teeth) || undefined
      }))
      .filter((p: PegDef) => !isNaN(p.x) && !isNaN(p.y));

    // Inventory
    let inventory: GearItem[] = [];
    if (Array.isArray(item.inventory)) {
      inventory = item.inventory
        .map((g: any, idx: number) => {
          const t = typeof g === 'number' ? g : Number(g?.teeth);
          if (t && t > 0) {
            return createGearItem(t, typeof g === 'object' && g.id ? g.id : `g-${idx + 1}`);
          }
          return null;
        })
        .filter((g: GearItem | null): g is GearItem => g !== null);
    }

    if (inventory.length === 0) {
      inventory = [createGearItem(12), createGearItem(16)];
    }

    const ageGroup: AgeGroup =
      item.ageGroup === '3-5' || item.ageGroup === '9-11' ? item.ageGroup : '6-8';

    validLevels.push({
      id: typeof item.id === 'string' ? item.id : `custom-${i + 1}`,
      levelNumber: i + 1,
      ageGroup,
      title: typeof item.title === 'string' ? item.title : `Custom Level ${i + 1}`,
      instruction: item.instruction,
      motor: {
        pegId: item.motor.pegId || 'motor',
        x: motorX,
        y: motorY,
        teeth: motorTeeth,
        rpm: motorRpm,
        direction: motorDir
      },
      target: {
        pegId: item.target.pegId || 'target',
        x: targetX,
        y: targetY,
        teeth: targetTeeth,
        targetRpm,
        targetDirection: targetDir,
        toleranceRpm: Number(item.target.toleranceRpm) || 1.0,
        type: targetType
      },
      pegs,
      inventory,
      antiMirroring: item.antiMirroring !== false
    });
  }

  return validLevels.length > 0 ? validLevels : null;
}

// ============================================================================
// 5. PROCEDURAL CANVAS 2D RENDERING ENGINE
// ============================================================================

export function drawProceduralGear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  teeth: number,
  angle: number,
  colorDef: GearColorDef,
  isHighlighted: boolean = false,
  isJammed: boolean = false,
  module: number = GEAR_MODULE
): void {
  const pitchR = calculatePitchRadius(teeth, module);
  const tipR = calculateOuterRadius(teeth, module);
  const rootR = calculateRootRadius(teeth, module);
  const deltaTheta = (2 * Math.PI) / teeth;

  ctx.save();

  // 1. Tooth Profile Path
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const tAngle = angle + i * deltaTheta;

    const a0 = tAngle - 0.28 * deltaTheta;
    const x0 = cx + rootR * Math.cos(a0);
    const y0 = cy + rootR * Math.sin(a0);
    if (i === 0) ctx.moveTo(x0, y0);
    else ctx.lineTo(x0, y0);

    const a1 = tAngle - 0.20 * deltaTheta;
    ctx.lineTo(cx + pitchR * Math.cos(a1), cy + pitchR * Math.sin(a1));

    const a2 = tAngle - 0.12 * deltaTheta;
    ctx.lineTo(cx + tipR * Math.cos(a2), cy + tipR * Math.sin(a2));

    const a3 = tAngle + 0.12 * deltaTheta;
    ctx.lineTo(cx + tipR * Math.cos(a3), cy + tipR * Math.sin(a3));

    const a4 = tAngle + 0.20 * deltaTheta;
    ctx.lineTo(cx + pitchR * Math.cos(a4), cy + pitchR * Math.sin(a4));

    const a5 = tAngle + 0.28 * deltaTheta;
    ctx.lineTo(cx + rootR * Math.cos(a5), cy + rootR * Math.sin(a5));

    const a6 = tAngle + 0.72 * deltaTheta;
    ctx.arc(cx, cy, rootR, a5, a6, false);
  }
  ctx.closePath();

  // Shading & Fill
  const grad = ctx.createRadialGradient(cx, cy, rootR * 0.2, cx, cy, tipR);
  if (isJammed) {
    grad.addColorStop(0, '#f87171');
    grad.addColorStop(0.7, '#dc2626');
    grad.addColorStop(1, '#991b1b');
  } else {
    grad.addColorStop(0, colorDef.light);
    grad.addColorStop(0.7, colorDef.primary);
    grad.addColorStop(1, colorDef.dark);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = isHighlighted ? '#38bdf8' : 'rgba(15, 23, 42, 0.8)';
  ctx.lineWidth = isHighlighted ? 3 : 2;
  ctx.stroke();

  // 2. Decorative Spoke Cutouts for N >= 12
  if (teeth >= 12) {
    const cutoutCount = teeth >= 16 ? 4 : 3;
    const cutoutDist = pitchR * 0.58;
    const cutoutRadius = pitchR * 0.16;

    for (let c = 0; c < cutoutCount; c++) {
      const cAngle = angle + (c * 2 * Math.PI) / cutoutCount;
      const ccx = cx + cutoutDist * Math.cos(cAngle);
      const ccy = cy + cutoutDist * Math.sin(cAngle);

      ctx.beginPath();
      ctx.arc(ccx, ccy, cutoutRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // 3. Central Hub & Axle Hole
  const hubRadius = pitchR * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
  ctx.fillStyle = colorDef.dark;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Axle peg hole
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  // Center axle pin highlight
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();

  // 4. Tooth Count Label
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(10, Math.round(pitchR * 0.22))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(colorDef.label, cx, cy - hubRadius - 4);

  // 5. Pitch Circle when highlighted
  if (isHighlighted) {
    ctx.beginPath();
    ctx.arc(cx, cy, pitchR, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ============================================================================
// 6. KIDGAME IMPLEMENTATION (GearTrainsGame)
// ============================================================================

export class GearTrainsGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private abortController: AbortController | null = null;
  private animFrameId: number | null = null;
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  // Game state
  private levels: GearLevel[] = [];
  private currentLevelIndex: number = 0;
  private placedGears = new Map<string, GearItem>(); // pegId -> GearItem
  private gearRotations = new Map<string, number>(); // pegId -> current angle (rad)
  private score: number = 0;
  private streak: number = 0;
  private startTimeMs: number = 0;
  private isPaused: boolean = false;
  private lastFrameTime: number = 0;

  // Settling state
  private settlingStartTime: number | null = null;
  private hasWonLevel: boolean = false;

  // Drag-and-drop & pointer tracking
  private isPointerDown: boolean = false;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;
  private isDragging: boolean = false;
  private draggedGear: GearItem | null = null;
  private dragOriginPegId: string | null = null;
  private dragCurrentX: number = 0;
  private dragCurrentY: number = 0;
  private hoveredPegId: string | null = null;

  // Logical coordinate system bounds (800 x 480 nominal)
  private readonly VIRTUAL_WIDTH = 800;
  private readonly VIRTUAL_HEIGHT = 480;
  private scaleFactor: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Load curriculum levels
    const custom = parseCustomLevels(this.context.customLevels);
    this.levels = custom || generateLevelsForAge(this.context.ageGroup);
    this.currentLevelIndex = 0;
    this.placedGears.clear();
    this.gearRotations.clear();
    this.score = 0;
    this.hasWonLevel = false;
    this.settlingStartTime = null;

    // Build DOM layout
    this.renderDOM();

    // Setup canvas
    this.canvas = this.container.querySelector('#gear-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    // Attach ResizeObserver with headless environment guard
    if (typeof ResizeObserver !== 'undefined' && this.canvas) {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvas);
    }
    this.resizeCanvas();

    // Bind UI button listeners with abort signal
    const btnSound = this.container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    if (btnSound) {
      btnSound.addEventListener('click', () => this.toggleSound(), { signal });
    }

    const btnReset = this.container.querySelector('#btn-reset') as HTMLButtonElement;
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetLevelGears(), { signal });
    }

    // Pointer events on canvas
    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
      window.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
      window.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
      window.addEventListener('pointercancel', (e) => this.onPointerUp(e, true), { signal });
    }

    // Initial HUD & tray rendering
    this.updateHUD();
    this.renderTray();

    // Telemetry: initial ready and progress
    this.context.emit('game:ready', {
      gameId: 'gear-trains'
    });
    this.context.emit('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Started level 1 of ${this.levels.length}`
    });
  }

  start(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isPaused = false;
    this.startTimeMs = Date.now();
    this.lastFrameTime = performance.now();
    this.context.emit('game:start', { gameId: 'gear-trains' });
    this.loop(this.lastFrameTime);
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
      this.isPaused = false;
      this.lastFrameTime = performance.now();
      if (this.animFrameId === null) {
        this.loop(this.lastFrameTime);
      }
    }
  }

  updateConfig(newContext: Partial<GameContext>): void {
    if (newContext.locale && newContext.locale !== this.context.locale) {
      this.context.locale = newContext.locale;
      this.updateHUD();
      this.renderTray();
    }
    if (newContext.sound !== undefined) {
      this.context.sound = newContext.sound;
      const btnSound = this.container.querySelector('#btn-sound-toggle');
      if (btnSound) {
        const t = getTranslations(this.context.locale);
        btnSound.textContent = this.context.sound ? t.soundOn : t.soundOff;
      }
    }
    if (newContext.ageGroup && newContext.ageGroup !== this.context.ageGroup) {
      this.context.ageGroup = newContext.ageGroup;
      this.levels = generateLevelsForAge(this.context.ageGroup);
      this.currentLevelIndex = 0;
      this.placedGears.clear();
      this.gearRotations.clear();
      this.hasWonLevel = false;
      this.settlingStartTime = null;
      // Score convention: a new age bracket is a fresh run
      this.score = 0;
      this.streak = 0;
      this.startTimeMs = Date.now();
      this.clearPendingTimeouts();
      this.updateHUD();
      this.renderTray();
    }
    if (newContext.customLevels !== undefined) {
      this.context.customLevels = newContext.customLevels;
      const parsed = parseCustomLevels(this.context.customLevels);
      this.levels = parsed || generateLevelsForAge(this.context.ageGroup);
      this.currentLevelIndex = 0;
      this.placedGears.clear();
      this.gearRotations.clear();
      this.hasWonLevel = false;
      this.settlingStartTime = null;
      this.updateHUD();
      this.renderTray();
    }
  }

  private clearPendingTimeouts(): void {
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();
  }

  destroy(): void {
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

  // ==========================================================================
  // DOM RENDERING & HUD MANAGEMENT
  // ==========================================================================

  private renderDOM(): void {
    const t = getTranslations(this.context.locale);
    this.container.innerHTML = `
      <style>
          .gear-game-root { container-type: inline-size; }
          .gear-game-root .hud-instruction { min-height: 6.5em; }
          @container (min-width: 700px) { .gear-game-root .hud-instruction { min-height: 2.6em; } }
        </style>
        <div class="gear-game-root" style="display:flex; flex-direction:column; width:100%; height:100%; background:#0f172a; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; user-select:none; position:relative; overflow:hidden;">
        <!-- Header HUD: fixed-height instruction row so the canvas never resizes when the text changes -->
        <div class="hud" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; padding:8px 12px; background:#1e293b; border-bottom:1px solid #334155; gap:6px 12px; z-index:10; flex:none;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="hud-title" style="font-size:1.15rem; font-weight:800; color:#38bdf8;">${t.title}</span>
            <span id="level-badge" style="background:#0f172a; border:1px solid #475569; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; color:#fbbf24;">${t.level} 1/${this.levels.length}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span id="hud-score" style="font-size:0.875rem; font-weight:700; color:#fbbf24;">⭐ ${this.score}</span>
            <button id="btn-sound-toggle" style="background:#334155; color:#f8fafc; border:none; border-radius:6px; padding:6px 10px; min-height:32px; cursor:pointer; font-size:0.8rem; font-weight:600;">${this.context.sound ? t.soundOn : t.soundOff}</button>
            <button id="btn-reset" style="background:#ef4444; color:#ffffff; border:none; border-radius:6px; padding:6px 12px; min-height:32px; cursor:pointer; font-size:0.8rem; font-weight:600;">${t.reset}</button>
          </div>
          <div id="hud-instruction" class="hud-instruction" style="flex:1 1 100%; order:3; box-sizing:border-box; text-align:center; font-size:0.875rem; line-height:1.3; font-weight:600; color:#f8fafc; padding:0 4px; display:flex; align-items:center; justify-content:center; overflow-wrap:anywhere;">
            ...
          </div>
        </div>

        <!-- Canvas Container -->
        <div class="canvas-container" style="flex:1; position:relative; overflow:hidden; min-height:0;">
          <canvas id="gear-canvas" style="display:block; width:100%; height:100%; touch-action:none;"></canvas>
        </div>

        <!-- Inventory Tray -->
        <div id="inventory-tray-bar" style="background:#1e293b; border-top:1px solid #334155; padding:8px 16px; display:flex; flex-direction:column; align-items:center; gap:6px; z-index:10;">
          <div id="tray-label" style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">${t.trayLabel}</div>
          <div id="gear-tray" style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center; align-items:center; min-height:56px;">
          </div>
        </div>
      </div>
    `;
  }

  private updateHUD(): void {
    const t = getTranslations(this.context.locale);
    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return;

    const titleEl = this.container.querySelector('#hud-title');
    if (titleEl) titleEl.textContent = t.title;

    const badgeEl = this.container.querySelector('#level-badge');
    if (badgeEl) badgeEl.textContent = `${t.level} ${this.currentLevelIndex + 1}/${this.levels.length}`;

    const scoreEl = this.container.querySelector('#hud-score');
    if (scoreEl) scoreEl.textContent = `⭐ ${this.score}`;

    const soundEl = this.container.querySelector('#btn-sound-toggle');
    if (soundEl) soundEl.textContent = this.context.sound ? t.soundOn : t.soundOff;

    const resetEl = this.container.querySelector('#btn-reset');
    if (resetEl) resetEl.textContent = t.reset;

    const trayLabelEl = this.container.querySelector('#tray-label');
    if (trayLabelEl) trayLabelEl.textContent = t.trayLabel;

    const instructionEl = this.container.querySelector('#hud-instruction') as HTMLElement | null;
    if (!instructionEl) return;

    // Evaluate live dynamic scaffolding
    const placedList = this.getPlacedGearList();
    const sim = simulateGearTrain(lvl, placedList, 0.1);

    const diagnosis = diagnoseGearTrain(lvl, placedList);
    if (diagnosis === 'overlap' || diagnosis === 'odd-cycle') {
      instructionEl.textContent = diagnosis === 'overlap' ? t.overlapAlert : t.jammedAlert;
      instructionEl.style.color = '#ef4444';
      return;
    }
    if (diagnosis === 'gap-bigger' || diagnosis === 'gap') {
      instructionEl.textContent = diagnosis === 'gap-bigger' ? t.gapBiggerHint : t.gapHint;
      instructionEl.style.color = '#fbbf24';
      return;
    }
    instructionEl.style.color = '#f8fafc';

    if (lvl.ageGroup === '3-5') {
      instructionEl.textContent = t.formatPreschoolPrompt(sim.connected, placedList.length, lvl.pegs.length);
    } else if (lvl.ageGroup === '6-8') {
      instructionEl.textContent = t.formatElementaryPrompt(
        sim.outputRpm,
        sim.outputDirection,
        lvl.target.targetRpm ?? 0,
        lvl.target.targetDirection ?? 'cw',
        sim.connected
      );
    } else {
      const ratioObj = simplifyGearRatio(lvl.motor.teeth, lvl.target.teeth);
      const cycle = calculateMeshingCycle(lvl.motor.teeth, lvl.target.teeth);
      instructionEl.textContent = t.formatUpperElementaryPrompt(
        sim.outputRpm,
        sim.outputDirection,
        lvl.target.targetRpm ?? 0,
        lvl.target.targetDirection ?? 'cw',
        ratioObj.display,
        cycle.lcm,
        sim.connected
      );
    }
  }

  private renderTray(): void {
    const trayEl = this.container.querySelector('#gear-tray') as HTMLElement;
    if (!trayEl) return;
    trayEl.innerHTML = '';

    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return;

    // Determine which inventory items are placed
    const placedIds = new Set<string>();
    this.placedGears.forEach((g) => placedIds.add(g.id));

    const availableGears = lvl.inventory.filter((g) => !placedIds.has(g.id));

    availableGears.forEach((gear) => {
      const button = document.createElement('button');
      button.className = 'gear-tray-item';
      button.dataset.gearId = gear.id;
      button.style.minWidth = '48px';
      button.style.minHeight = '48px';
      button.style.width = '52px';
      button.style.height = '52px';
      button.style.borderRadius = '50%';
      button.style.border = `3px solid ${gear.color}`;
      button.style.background = '#0f172a';
      button.style.color = '#ffffff';
      button.style.fontWeight = '800';
      button.style.fontSize = '0.85rem';
      button.style.cursor = 'grab';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      button.style.transition = 'transform 0.15s ease, border-color 0.15s ease';
      button.textContent = gear.label || `${gear.teeth}T`;

      button.style.touchAction = 'none';

      // Keyboard / assistive activation (detail === 0). Real mouse/touch taps are handled by
      // pointerdown + pointerup (tap vs drag threshold) because the tray is rebuilt on pointerup.
      button.addEventListener('click', (e) => {
        if (e.detail === 0) this.placeFirstAvailable(gear);
      });

      // Pointer down arms either a tap (place on first empty peg) or a drag
      button.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.startDragFromTray(gear, e.clientX, e.clientY);
      });

      trayEl.appendChild(button);
    });
  }

  private placeFirstAvailable(gear: GearItem): void {
    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return;

    // Find first unoccupied peg
    const emptyPeg = lvl.pegs.find((p) => !this.placedGears.has(p.id));
    if (emptyPeg) {
      this.placedGears.set(emptyPeg.id, gear);
      this.context.audio.playDrop();
      this.updateHUD();
      this.renderTray();
    } else {
      this.context.audio.playError();
    }
  }

  private resetLevelGears(): void {
    if (this.placedGears.size > 0) {
      this.placedGears.clear();
      this.context.audio.playClick();
      this.updateHUD();
      this.renderTray();
    }
  }

  private toggleSound(): void {
    this.context.sound = !this.context.sound;
    this.context.audio.enabled = this.context.sound;
    const btnSound = this.container.querySelector('#btn-sound-toggle');
    if (btnSound) {
      const t = getTranslations(this.context.locale);
      btnSound.textContent = this.context.sound ? t.soundOn : t.soundOff;
    }
  }

  // ==========================================================================
  // POINTER & DRAG-AND-DROP INTERACTIONS
  // ==========================================================================

  private startDragFromTray(gear: GearItem, clientX: number, clientY: number): void {
    this.draggedGear = gear;
    this.dragOriginPegId = null;
    this.isPointerDown = true;
    this.isDragging = false; // becomes true only after moving past the tap threshold
    this.pointerStartX = clientX;
    this.pointerStartY = clientY;
    this.dragCurrentX = clientX;
    this.dragCurrentY = clientY;
  }

  private onPointerDown(e: PointerEvent): void {
    const clientX = e.clientX;
    const clientY = e.clientY;
    this.pointerStartX = clientX;
    this.pointerStartY = clientY;
    this.isPointerDown = true;

    const logical = this.clientToLogical(clientX, clientY);

    // Check if clicked a placed gear on a peg
    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return;

    for (const peg of lvl.pegs) {
      const gear = this.placedGears.get(peg.id);
      if (!gear) continue;

      const dx = logical.x - peg.x;
      const dy = logical.y - peg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= gear.pitchRadius + 10) {
        // Prepare potential drag from peg
        this.draggedGear = gear;
        this.dragOriginPegId = peg.id;
        this.dragCurrentX = clientX;
        this.dragCurrentY = clientY;
        return;
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown && !this.isDragging) return;

    const dx = e.clientX - this.pointerStartX;
    const dy = e.clientY - this.pointerStartY;
    const moveDist = Math.sqrt(dx * dx + dy * dy);

    if (moveDist > 5) {
      this.isDragging = true;
    }

    if (this.isDragging) {
      this.dragCurrentX = e.clientX;
      this.dragCurrentY = e.clientY;

      const logical = this.clientToLogical(e.clientX, e.clientY);
      this.hoveredPegId = this.findNearestSnapPeg(logical.x, logical.y);
    }
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean = false): void {
    if (cancelled) {
      // Interrupted gesture: drop nothing, place nothing
    } else if (this.isPointerDown && !this.isDragging && this.draggedGear && this.dragOriginPegId === null) {
      // Tap (movement below threshold) on a tray gear: place on the first empty peg
      this.placeFirstAvailable(this.draggedGear);
    } else if (this.isDragging && this.draggedGear) {
      const logical = this.clientToLogical(e.clientX, e.clientY);
      const snapPegId = this.findNearestSnapPeg(logical.x, logical.y);

      if (snapPegId) {
        // If moved from another peg, free that peg
        if (this.dragOriginPegId && this.dragOriginPegId !== snapPegId) {
          this.placedGears.delete(this.dragOriginPegId);
        }
        this.placedGears.set(snapPegId, this.draggedGear);
        this.context.audio.playDrop();
      } else {
        // Dropped outside snap radius
        if (this.dragOriginPegId) {
          // Granular undo: returned to tray!
          this.placedGears.delete(this.dragOriginPegId);
          this.context.audio.playPop();
        }
      }

      this.updateHUD();
      this.renderTray();
    } else if (this.isPointerDown && !this.isDragging && this.dragOriginPegId) {
      // Tap on placed gear: Granular Undo!
      this.placedGears.delete(this.dragOriginPegId);
      this.context.audio.playPop();
      this.updateHUD();
      this.renderTray();
    }

    this.isPointerDown = false;
    this.isDragging = false;
    this.draggedGear = null;
    this.dragOriginPegId = null;
    this.hoveredPegId = null;
  }

  private findNearestSnapPeg(logicalX: number, logicalY: number): string | null {
    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return null;

    let closestPegId: string | null = null;
    let minDist = 65; // Snap radius (40-90px)

    for (const peg of lvl.pegs) {
      // Check distance
      const dx = logicalX - peg.x;
      const dy = logicalY - peg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        closestPegId = peg.id;
      }
    }

    return closestPegId;
  }

  private clientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas) return { x: clientX, y: clientY };
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return {
      x: (px - this.offsetX) / this.scaleFactor,
      y: (py - this.offsetY) / this.scaleFactor
    };
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);

    // Compute uniform aspect-ratio scaling
    const s = Math.min(rect.width / this.VIRTUAL_WIDTH, rect.height / this.VIRTUAL_HEIGHT);
    this.scaleFactor = s;
    this.offsetX = (rect.width - this.VIRTUAL_WIDTH * s) / 2;
    this.offsetY = (rect.height - this.VIRTUAL_HEIGHT * s) / 2;
  }

  private getPlacedGearList(): PlacedGear[] {
    const list: PlacedGear[] = [];
    this.placedGears.forEach((gear, pegId) => {
      list.push({ pegId, gear });
    });
    return list;
  }

  // ==========================================================================
  // MAIN ANIMATION LOOP & PHYSICS UPDATE
  // ==========================================================================

  private loop(timestamp: number): void {
    if (this.isPaused) return;

    const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
    this.lastFrameTime = timestamp;

    this.updatePhysics(dt);
    this.renderCanvas();

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  private updatePhysics(dt: number): void {
    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) return;

    const placedList = this.getPlacedGearList();
    const sim = simulateGearTrain(lvl, placedList, 0.1);

    // Update rotations
    if (!sim.isJammed) {
      // Motor rotation
      const motorAngle = (this.gearRotations.get('motor') || 0) +
        (lvl.motor.direction === 'cw' ? 1 : -1) * (lvl.motor.rpm * 2 * Math.PI / 60) * dt;
      this.gearRotations.set('motor', motorAngle);

      // Rotating gears in meshed chain
      if (sim.connected) {
        placedList.forEach((placed) => {
          const prev = this.gearRotations.get(placed.pegId) || 0;
          const speed = calculateOutputSpeed(lvl.motor.rpm, lvl.motor.teeth, placed.gear.teeth);
          const dir = lvl.motor.direction === 'cw' ? -1 : 1;
          this.gearRotations.set(placed.pegId, prev + dir * (speed * 2 * Math.PI / 60) * dt);
        });

        const targetPrev = this.gearRotations.get('target') || 0;
        const targetDir = sim.outputDirection === 'cw' ? 1 : -1;
        this.gearRotations.set('target', targetPrev + targetDir * (sim.outputRpm * 2 * Math.PI / 60) * dt);
      }
    }

    // Settling window verification
    if (!this.hasWonLevel) {
      if (sim.connected && !sim.isJammed && sim.directionCorrect && sim.speedCorrect) {
        if (this.settlingStartTime === null) {
          this.settlingStartTime = performance.now();
        } else {
          const elapsedSec = (performance.now() - this.settlingStartTime) / 1000;
          if (elapsedSec >= 0.6) {
            this.handleLevelWin();
          }
        }
      } else {
        this.settlingStartTime = null;
      }
    }
  }

  private handleLevelWin(): void {
    this.hasWonLevel = true;
    this.score += 100;
    this.streak += 1;
    this.updateHUD();

    this.context.audio.playSuccess();
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {
      // headless test guard
    }

    const isLast = this.currentLevelIndex >= this.levels.length - 1;
    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: `Completed level ${this.currentLevelIndex + 1}`
    });
    this.context.emit('game:score', {
      points: 100,
      streak: this.streak,
      delta: 100
    });

    if (isLast) {
      const timeElapsed = Math.round((Date.now() - this.startTimeMs) / 1000);
      this.context.emit('game:complete', {
        stars: 3,
        score: this.score,
        timeElapsed,
        summary: 'All levels completed!'
      });

      // Start a fresh round after the celebration so the board is never left stuck on the banner
      const tid = setTimeout(() => {
        this.pendingTimeouts.delete(tid);
        this.restartRound();
      }, 3000);
      this.pendingTimeouts.add(tid);
    } else {
      const tid = setTimeout(() => {
        this.pendingTimeouts.delete(tid);
        this.currentLevelIndex++;
        this.placedGears.clear();
        this.gearRotations.clear();
        this.hasWonLevel = false;
        this.settlingStartTime = null;
        this.updateHUD();
        this.renderTray();
      }, 1500);
      this.pendingTimeouts.add(tid);
    }
  }

  private restartRound(): void {
    this.levels = parseCustomLevels(this.context.customLevels) || generateLevelsForAge(this.context.ageGroup);
    this.currentLevelIndex = 0;
    this.placedGears.clear();
    this.gearRotations.clear();
    this.hasWonLevel = false;
    this.settlingStartTime = null;
    this.score = 0;
    this.streak = 0;
    this.startTimeMs = Date.now();
    this.updateHUD();
    this.renderTray();
    this.context.emit('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Started level 1 of ${this.levels.length}`
    });
  }

  // ==========================================================================
  // PROCEDURAL CANVAS RENDERING
  // ==========================================================================

  private renderCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Apply viewport scale and translation
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scaleFactor, this.scaleFactor);

    // Draw pegboard surface
    this.drawPegboard(ctx);

    const lvl = this.levels[this.currentLevelIndex];
    if (!lvl) {
      ctx.restore();
      return;
    }

    const sim = simulateGearTrain(lvl, this.getPlacedGearList(), 0.1);

    // 1. Draw Pegs & Pegboard Holes
    for (const peg of lvl.pegs) {
      this.drawPegHole(ctx, peg.x, peg.y, peg.id === this.hoveredPegId);
    }

    // 2. Draw Motor Gear
    const motorPalette = GEAR_PALETTE[lvl.motor.teeth] || GEAR_PALETTE[12];
    const motorAngle = this.gearRotations.get('motor') || 0;
    drawProceduralGear(ctx, lvl.motor.x, lvl.motor.y, lvl.motor.teeth, motorAngle, motorPalette, false, sim.isJammed);
    this.drawMotorCore(ctx, lvl.motor.x, lvl.motor.y, lvl.motor.direction, lvl.motor.rpm);

    // 3. Draw Placed Gears on Pegs
    for (const peg of lvl.pegs) {
      const gear = this.placedGears.get(peg.id);
      if (gear) {
        const pal = GEAR_PALETTE[gear.teeth] || GEAR_PALETTE[12];
        const angle = this.gearRotations.get(peg.id) || 0;
        const isHovered = peg.id === this.hoveredPegId;
        drawProceduralGear(ctx, peg.x, peg.y, gear.teeth, angle, pal, isHovered, sim.isJammed);
      }
    }

    // 4. Draw Target (Windmill or Dial)
    const targetAngle = this.gearRotations.get('target') || 0;
    if (lvl.target.type === 'windmill') {
      const targetPal = GEAR_PALETTE[lvl.target.teeth] || GEAR_PALETTE[12];
      drawProceduralGear(ctx, lvl.target.x, lvl.target.y, lvl.target.teeth, targetAngle, targetPal, false, sim.isJammed);
      this.drawWindmillBlades(ctx, lvl.target.x, lvl.target.y, targetAngle);
    } else {
      const targetPal = GEAR_PALETTE[lvl.target.teeth] || GEAR_PALETTE[12];
      drawProceduralGear(ctx, lvl.target.x, lvl.target.y, lvl.target.teeth, targetAngle, targetPal, false, sim.isJammed);
      this.drawTargetDial(
        ctx,
        lvl.target.x,
        lvl.target.y,
        sim.outputRpm,
        lvl.target.targetRpm ?? 0,
        sim.outputDirection,
        lvl.target.targetDirection ?? 'cw'
      );
    }

    // 5. Draw Currently Dragged Gear (if any)
    if (this.isDragging && this.draggedGear) {
      const logical = this.clientToLogical(this.dragCurrentX, this.dragCurrentY);
      const dragPal = GEAR_PALETTE[this.draggedGear.teeth] || GEAR_PALETTE[12];
      drawProceduralGear(ctx, logical.x, logical.y, this.draggedGear.teeth, 0, dragPal, true, false);
    }

    // 6. Victory Overlay when settled
    if (this.hasWonLevel) {
      this.drawVictoryBanner(ctx);
    }

    ctx.restore();
  }

  private drawPegboard(ctx: CanvasRenderingContext2D): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);

    // Decorative grid of subtle pegboard holes
    ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
    for (let x = 40; x < this.VIRTUAL_WIDTH; x += 40) {
      for (let y = 40; y < this.VIRTUAL_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawPegHole(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean): void {
    ctx.save();
    // Outer peg mounting rim
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? 'rgba(56, 189, 248, 0.3)' : 'rgba(51, 65, 85, 0.5)';
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#38bdf8' : '#64748b';
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    ctx.stroke();

    // Steel peg pin
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  private drawMotorCore(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Direction, rpm: number): void {
    ctx.save();
    // Glowing cyan center
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Direction indicator arrow
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${dir.toUpperCase()}`, x, y - 4);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(`${rpm}`, x, y + 6);
    ctx.restore();
  }

  private drawWindmillBlades(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const bladeColors = ['#f43f5e', '#38bdf8', '#fbbf24', '#10b981'];
    for (let b = 0; b < 4; b++) {
      ctx.save();
      ctx.rotate((b * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(10, -20, 25, -45, 0, -55);
      ctx.bezierCurveTo(-15, -45, -5, -20, 0, 0);
      ctx.fillStyle = bladeColors[b];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Windmill center pin
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.restore();
  }

  private drawTargetDial(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    currentRpm: number,
    targetRpm: number,
    currentDir: Direction | null,
    targetDir: Direction
  ): void {
    ctx.save();
    // Dial face
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = currentRpm === targetRpm && currentDir === targetDir ? '#10b981' : '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dial text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(currentRpm)}/${targetRpm}`, x, y - 4);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(targetDir.toUpperCase(), x, y + 7);
    ctx.restore();
  }

  private drawVictoryBanner(ctx: CanvasRenderingContext2D): void {
    const t = getTranslations(this.context.locale);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, this.VIRTUAL_HEIGHT / 2 - 40, this.VIRTUAL_WIDTH, 80);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.wellDone, this.VIRTUAL_WIDTH / 2, this.VIRTUAL_HEIGHT / 2);
    ctx.restore();
  }
}

// ============================================================================
// 7. FACTORIES & EXPORTS
// ============================================================================

export function createGame(): KidGame {
  return new GearTrainsGame();
}

export const createGearTrainsGame = createGame;
export default createGame;
