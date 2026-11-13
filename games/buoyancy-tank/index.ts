import confetti from 'canvas-confetti';
import type { GameContext, KidGame, AgeGroup, Difficulty } from '../../src/core/types.js';
import { getTranslations, type SupportedLocale } from './i18n.js';

// ============================================================================
// 1. DATA TYPES & INTERFACES
// ============================================================================

export type FluidType = 'freshwater' | 'saltwater';

export interface BuoyancyItem {
  id: string;
  name: string;
  massG: number;
  volumeCm3: number;
  density: number; // massG / volumeCm3
  label: string;
  color: string;
  material: string;
  behavior: 'float' | 'sink';
  shape: string;
  isDistractor: boolean;
  width: number;
  height: number;
}

export interface SubmarineModule {
  id: string;
  name: string;
  massG: number;
  volumeCm3: number;
  type: 'ballast' | 'foam';
  density: number; // massG / volumeCm3 (or high for ballast)
  label: string;
  color: string;
  isDistractor: boolean;
}

export interface SubmarineBase {
  massG: number;
  volumeCm3: number;
  slots?: number;
}

export type PlacedItem = BuoyancyItem | SubmarineModule;

export interface BuoyancyLevel {
  id: string;
  levelNumber: number;
  ageGroup: AgeGroup;
  title: string;
  fluidType: FluidType;
  fluidDensity: number;
  initialWaterMl: number;
  targetWaterMl: number;
  tankCapacityMl: number;
  targetType: 'float' | 'sink' | 'displacement' | 'submarine';
  requiredCount?: number;
  inventory: BuoyancyItem[];
  submarine?: SubmarineBase;
  modules: SubmarineModule[];
  antiMirroringEnforced?: boolean;
  instruction?: string;
}

export interface BuoyancyResult {
  density: number;
  classification: 'floats' | 'sinks' | 'neutral';
  status: 'floats' | 'sinks' | 'neutral';
  submergedFraction: number;
  displacedVolumeCm3: number;
  displacedMassG: number;
  gravityForceN: number;
  buoyantForceN: number;
  netForceN: number;
  netForceDir?: 'up' | 'down' | 'neutral';
}

export interface DisplacementResult {
  initialWaterMl: number;
  addedVolumeMl: number;
  currentWaterMl: number;
  displacedMl: number;
  currentVolumeMl: number;
  isOverflowing: boolean;
}

export interface SubmarineTrimResult {
  totalMassG: number;
  totalVolumeCm3: number;
  density: number;
  isNeutral: boolean;
  status: 'floats' | 'sinks' | 'neutral';
  deltaDensity: number;
}

export interface BuoyancySimulationResult {
  won: boolean;
  targetMatched: boolean;
  isNeutral: boolean;
  settlingTime: number;
  currentWaterMl: number;
  totalMassG?: number;
  totalVolumeCm3?: number;
  density?: number;
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface BubbleParticle {
  x: number;
  y: number;
  vy: number;
  radius: number;
  alpha: number;
  swayFreq: number;
  swayAmp: number;
  time: number;
}

export interface PlacedItemEntity {
  item: BuoyancyItem | SubmarineModule;
  x: number;
  y: number;
  vy: number;
  bobPhase: number;
  isSettled: boolean;
}

// ============================================================================
// 2. PURE DOMAIN MATH HELPERS & FACTORIES
// ============================================================================

export function calculateDensity(massG: number, volumeCm3: number): number {
  if (volumeCm3 <= 0 || massG <= 0 || !Number.isFinite(massG) || !Number.isFinite(volumeCm3)) {
    return 0;
  }
  return Math.round((massG / volumeCm3) * 1000) / 1000;
}

export function calculateBuoyancyState(
  fluidDensity: number,
  massG: number,
  volumeCm3: number,
  tolerance: number = 0.04
): BuoyancyResult {
  if (volumeCm3 <= 0 || massG <= 0) {
    return {
      density: 0,
      classification: 'floats',
      status: 'floats',
      submergedFraction: 0,
      displacedVolumeCm3: 0,
      displacedMassG: 0,
      gravityForceN: 0,
      buoyantForceN: 0,
      netForceN: 0,
      netForceDir: 'neutral'
    };
  }

  const density = calculateDensity(massG, volumeCm3);
  const gravityForceN = (massG / 1000) * 9.8;

  if (Math.abs(density - fluidDensity) <= tolerance) {
    const displacedVolumeCm3 = volumeCm3;
    const displacedMassG = displacedVolumeCm3 * fluidDensity;
    const buoyantForceN = (displacedMassG / 1000) * 9.8;
    return {
      density,
      classification: 'neutral',
      status: 'neutral',
      submergedFraction: 1.0,
      displacedVolumeCm3,
      displacedMassG,
      gravityForceN,
      buoyantForceN,
      netForceN: buoyantForceN - gravityForceN,
      netForceDir: 'neutral'
    };
  }

  if (density < fluidDensity - tolerance) {
    const submergedFraction = Math.min(1.0, Math.max(0, density / fluidDensity));
    const displacedVolumeCm3 = submergedFraction * volumeCm3;
    const displacedMassG = displacedVolumeCm3 * fluidDensity;
    // In equilibrium floating: buoyantForce equals gravityForce
    const buoyantForceN = gravityForceN;
    return {
      density,
      classification: 'floats',
      status: 'floats',
      submergedFraction,
      displacedVolumeCm3,
      displacedMassG,
      gravityForceN,
      buoyantForceN,
      netForceN: 0,
      netForceDir: 'up'
    };
  }

  // Sinks: fully submerged
  const displacedVolumeCm3 = volumeCm3;
  const displacedMassG = displacedVolumeCm3 * fluidDensity;
  const buoyantForceN = (displacedMassG / 1000) * 9.8;
  const netForceN = buoyantForceN - gravityForceN; // < 0 (net downward)
  return {
    density,
    classification: 'sinks',
    status: 'sinks',
    submergedFraction: 1.0,
    displacedVolumeCm3,
    displacedMassG,
    gravityForceN,
    buoyantForceN,
    netForceN,
    netForceDir: 'down'
  };
}

export const calculateBuoyancy = calculateBuoyancyState;

export function calculateDisplacement(
  initialWaterMl: number,
  items: BuoyancyItem[],
  fluidDensity: number = 1.0,
  tankCapacityMl: number = 1000
): DisplacementResult {
  let addedVolumeMl = 0;
  for (const item of items) {
    if (!item) continue;
    const state = calculateBuoyancyState(fluidDensity, item.massG, item.volumeCm3);
    addedVolumeMl += state.displacedVolumeCm3;
  }

  addedVolumeMl = Math.round(addedVolumeMl);
  const rawTotal = initialWaterMl + addedVolumeMl;
  const isOverflowing = rawTotal > tankCapacityMl;
  const currentWaterMl = Math.min(rawTotal, tankCapacityMl);

  return {
    initialWaterMl,
    addedVolumeMl,
    currentWaterMl,
    displacedMl: addedVolumeMl,
    currentVolumeMl: currentWaterMl,
    isOverflowing
  };
}

export const calculateDisplacedVolume = calculateDisplacement;

export function calculateSubmarineDensity(
  baseSub: { massG: number; volumeCm3: number },
  modules: SubmarineModule[],
  fluidDensity: number = 1.0,
  tolerance: number = 0.04
): SubmarineTrimResult {
  const totalMassG = baseSub.massG + modules.reduce((sum, m) => sum + (m.massG || 0), 0);
  const totalVolumeCm3 = baseSub.volumeCm3 + modules.reduce((sum, m) => sum + (m.volumeCm3 || 0), 0);
  const density = calculateDensity(totalMassG, totalVolumeCm3);
  const deltaDensity = density - fluidDensity;
  const isNeutral = Math.abs(deltaDensity) <= tolerance;
  const status: 'floats' | 'sinks' | 'neutral' = isNeutral ? 'neutral' : (density < fluidDensity ? 'floats' : 'sinks');

  return {
    totalMassG,
    totalVolumeCm3,
    density,
    isNeutral,
    status,
    deltaDensity
  };
}

export function calculateWaterSurfaceLevel(
  tankHeightPx: number,
  waterVolumeMl: number,
  tankCapacityMl: number,
  padding: { top: number; bottom: number } = { top: 40, bottom: 40 }
): number {
  const usableHeight = tankHeightPx - padding.top - padding.bottom;
  const fraction = Math.min(1.0, Math.max(0, waterVolumeMl / tankCapacityMl));
  return (tankHeightPx - padding.bottom) - fraction * usableHeight;
}

export function createBuoyancyItem(
  id: string,
  name: string,
  massG: number,
  volumeCm3: number,
  options?: Partial<BuoyancyItem>
): BuoyancyItem {
  const density = calculateDensity(massG, volumeCm3);
  const behavior: 'float' | 'sink' = density < 1.0 ? 'float' : 'sink';
  return {
    id,
    name,
    massG,
    volumeCm3,
    density,
    label: options?.label || `${volumeCm3} cm³`,
    color: options?.color || (behavior === 'float' ? '#fbbf24' : '#38bdf8'),
    material: options?.material || (behavior === 'float' ? 'wood' : 'stone'),
    behavior: options?.behavior || behavior,
    shape: options?.shape || (behavior === 'float' ? 'log' : 'block'),
    isDistractor: options?.isDistractor || false,
    width: options?.width || 56,
    height: options?.height || 56
  };
}

export function createSubmarineModule(
  id: string,
  name: string,
  massG: number,
  volumeCm3: number,
  options?: Partial<SubmarineModule>
): SubmarineModule {
  const type: 'ballast' | 'foam' = volumeCm3 > 0 ? 'foam' : 'ballast';
  const density = volumeCm3 > 0 ? calculateDensity(massG, volumeCm3) : 999;
  return {
    id,
    name,
    massG,
    volumeCm3,
    type,
    density,
    label: options?.label || (type === 'foam' ? `+${volumeCm3} cm³` : `+${massG} g`),
    color: options?.color || (type === 'foam' ? '#38bdf8' : '#64748b'),
    isDistractor: options?.isDistractor || false
  };
}

// ============================================================================
// 3. CURRICULUM GENERATOR & ANTI-MIRRORING VERIFIER
// ============================================================================

export function generateLevelsForAge(ageGroup: AgeGroup, difficulty: Difficulty = 'medium'): BuoyancyLevel[] {
  if (ageGroup === '3-5') {
    const levels: BuoyancyLevel[] = [
      {
        id: 'preschool-1',
        levelNumber: 1,
        ageGroup: '3-5',
        title: 'Float or Sink? First Splash',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 500,
        targetWaterMl: 500,
        tankCapacityMl: 1000,
        targetType: 'float',
        requiredCount: 1,
        inventory: [
          createBuoyancyItem('wood-block', 'Wood Block', 60, 100, {
            material: 'wood',
            shape: 'log',
            label: 'Wood 🪵',
            color: '#d97706',
            behavior: 'float'
          }),
          createBuoyancyItem('stone-pebble', 'Stone Pebble', 150, 60, {
            material: 'stone',
            shape: 'pebble',
            label: 'Stone 🪨',
            color: '#64748b',
            behavior: 'sink',
            isDistractor: true
          })
        ],
        modules: []
      },
      {
        id: 'preschool-2',
        levelNumber: 2,
        ageGroup: '3-5',
        title: 'Find the Floaters',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 500,
        targetWaterMl: 500,
        tankCapacityMl: 1000,
        targetType: 'float',
        requiredCount: 2,
        inventory: [
          createBuoyancyItem('rubber-duck', 'Rubber Duck', 20, 100, {
            material: 'rubber',
            shape: 'duck',
            label: 'Duck 🦆',
            color: '#fbbf24',
            behavior: 'float'
          }),
          createBuoyancyItem('red-apple', 'Apple', 70, 100, {
            material: 'organic',
            shape: 'ball',
            label: 'Apple 🍎',
            color: '#ef4444',
            behavior: 'float'
          }),
          createBuoyancyItem('iron-bolt', 'Iron Bolt', 160, 20, {
            material: 'metal',
            shape: 'bolt',
            label: 'Iron Bolt 🔩',
            color: '#475569',
            behavior: 'sink',
            isDistractor: true
          })
        ],
        modules: []
      },
      {
        id: 'preschool-3',
        levelNumber: 3,
        ageGroup: '3-5',
        title: 'Sink & Float Classification',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 500,
        targetWaterMl: 500,
        tankCapacityMl: 1000,
        targetType: 'sink',
        requiredCount: 2,
        inventory: [
          createBuoyancyItem('metal-nut', 'Metal Nut', 120, 15, {
            material: 'metal',
            shape: 'nut',
            label: 'Metal Nut ⚙️',
            color: '#334155',
            behavior: 'sink'
          }),
          createBuoyancyItem('glass-marble', 'Marble', 75, 30, {
            material: 'glass',
            shape: 'marble',
            label: 'Marble 🔮',
            color: '#8b5cf6',
            behavior: 'sink'
          }),
          createBuoyancyItem('cork-stopper', 'Cork', 25, 100, {
            material: 'cork',
            shape: 'cork',
            label: 'Cork 🍾',
            color: '#f59e0b',
            behavior: 'float',
            isDistractor: true
          }),
          createBuoyancyItem('plastic-ball', 'Plastic Ball', 40, 100, {
            material: 'plastic',
            shape: 'ball',
            label: 'Ball ⚽',
            color: '#06b6d4',
            behavior: 'float',
            isDistractor: true
          })
        ],
        modules: []
      }
    ];

    if (difficulty === 'easy') {
      levels[0].inventory = levels[0].inventory.filter((i) => !i.isDistractor);
      levels[1].inventory = levels[1].inventory.slice(0, 2);
    } else if (difficulty === 'hard') {
      levels[0].inventory.push(
        createBuoyancyItem('metal-key', 'Key', 40, 5, {
          material: 'metal',
          shape: 'bolt',
          label: 'Key 🔑',
          color: '#64748b',
          behavior: 'sink',
          isDistractor: true
        })
      );
    }
    return levels;
  }

  if (ageGroup === '6-8') {
    const levels: BuoyancyLevel[] = [
      {
        id: 'elem-1',
        levelNumber: 1,
        ageGroup: '6-8',
        title: 'Two-Block Displacement (+300 mL)',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 400,
        targetWaterMl: 700,
        tankCapacityMl: 1000,
        targetType: 'displacement',
        antiMirroringEnforced: true,
        inventory: [
          createBuoyancyItem('block-100', '100 cm³ Block', 250, 100, {
            label: '100 cm³',
            color: '#38bdf8'
          }),
          createBuoyancyItem('block-200', '200 cm³ Block', 500, 200, {
            label: '200 cm³',
            color: '#0284c7'
          }),
          createBuoyancyItem('block-150-d', '150 cm³ Block', 375, 150, {
            label: '150 cm³',
            color: '#f59e0b',
            isDistractor: true
          })
        ],
        modules: []
      },
      {
        id: 'elem-2',
        levelNumber: 2,
        ageGroup: '6-8',
        title: 'Target Waterline (+450 mL)',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 300,
        targetWaterMl: 750,
        tankCapacityMl: 1000,
        targetType: 'displacement',
        antiMirroringEnforced: true,
        inventory: [
          createBuoyancyItem('block-200-b', '200 cm³ Block', 500, 200, {
            label: '200 cm³',
            color: '#0ea5e9'
          }),
          createBuoyancyItem('block-250', '250 cm³ Block', 625, 250, {
            label: '250 cm³',
            color: '#6366f1'
          }),
          createBuoyancyItem('block-100-d', '100 cm³ Block', 250, 100, {
            label: '100 cm³',
            color: '#10b981',
            isDistractor: true
          }),
          createBuoyancyItem('block-150-d2', '150 cm³ Block', 375, 150, {
            label: '150 cm³',
            color: '#ec4899',
            isDistractor: true
          })
        ],
        modules: []
      },
      {
        id: 'elem-3',
        levelNumber: 3,
        ageGroup: '6-8',
        title: 'High Volume Challenge (+400 mL)',
        fluidType: 'freshwater',
        fluidDensity: 1.0,
        initialWaterMl: 500,
        targetWaterMl: 900,
        tankCapacityMl: 1000,
        targetType: 'displacement',
        antiMirroringEnforced: true,
        inventory: [
          createBuoyancyItem('block-150-c', '150 cm³ Block', 375, 150, {
            label: '150 cm³',
            color: '#8b5cf6'
          }),
          createBuoyancyItem('block-250-c', '250 cm³ Block', 625, 250, {
            label: '250 cm³',
            color: '#06b6d4'
          }),
          createBuoyancyItem('block-100-d3', '100 cm³ Block', 250, 100, {
            label: '100 cm³',
            color: '#eab308',
            isDistractor: true
          }),
          createBuoyancyItem('block-200-d3', '200 cm³ Block', 500, 200, {
            label: '200 cm³',
            color: '#14b8a6',
            isDistractor: true
          })
        ],
        modules: []
      }
    ];

    if (difficulty === 'easy') {
      levels[0].inventory = levels[0].inventory.filter((i) => !i.isDistractor);
    } else if (difficulty === 'hard') {
      levels[0].inventory.push(
        createBuoyancyItem('block-50-d', '50 cm³ Block', 125, 50, {
          label: '50 cm³',
          color: '#a855f7',
          isDistractor: true
        })
      );
    }
    return levels;
  }

  // 9-11 Upper Elementary
  const levels: BuoyancyLevel[] = [
    {
      id: 'upper-1',
      levelNumber: 1,
      ageGroup: '9-11',
      title: 'Freshwater Submarine Trim (1.00 g/cm³)',
      fluidType: 'freshwater',
      fluidDensity: 1.0,
      initialWaterMl: 600,
      targetWaterMl: 600,
      tankCapacityMl: 1000,
      targetType: 'submarine',
      antiMirroringEnforced: true,
      submarine: {
        massG: 300,
        volumeCm3: 400,
        slots: 2
      },
      inventory: [],
      modules: [
        createSubmarineModule('ballast-1', 'Ballast 60g', 60, 0, { label: '+60 g', color: '#64748b' }),
        createSubmarineModule('ballast-2', 'Ballast 40g', 40, 0, { label: '+40 g', color: '#475569' }),
        createSubmarineModule('ballast-d1', 'Ballast 20g', 20, 0, { label: '+20 g', color: '#94a3b8', isDistractor: true }),
        createSubmarineModule('ballast-d2', 'Ballast 140g', 140, 0, { label: '+140 g', color: '#334155', isDistractor: true })
      ]
    },
    {
      id: 'upper-2',
      levelNumber: 2,
      ageGroup: '9-11',
      title: 'Freshwater Foam Trim (1.00 g/cm³)',
      fluidType: 'freshwater',
      fluidDensity: 1.0,
      initialWaterMl: 600,
      targetWaterMl: 600,
      tankCapacityMl: 1000,
      targetType: 'submarine',
      antiMirroringEnforced: true,
      submarine: {
        massG: 460,
        volumeCm3: 400,
        slots: 2
      },
      inventory: [],
      modules: [
        createSubmarineModule('foam-1', 'Foam 40cm³', 10, 40, { label: '+40 cm³', color: '#38bdf8' }),
        createSubmarineModule('foam-2', 'Foam 40cm³', 10, 40, { label: '+40 cm³', color: '#0ea5e9' }),
        createSubmarineModule('foam-d1', 'Foam 100cm³', 10, 100, { label: '+100 cm³', color: '#06b6d4', isDistractor: true }),
        createSubmarineModule('ballast-d3', 'Ballast 50g', 50, 0, { label: '+50 g', color: '#64748b', isDistractor: true })
      ]
    },
    {
      id: 'upper-3',
      levelNumber: 3,
      ageGroup: '9-11',
      title: 'Saltwater Ocean Brine Trim (1.20 g/cm³)',
      fluidType: 'saltwater',
      fluidDensity: 1.2,
      initialWaterMl: 600,
      targetWaterMl: 600,
      tankCapacityMl: 1000,
      targetType: 'submarine',
      antiMirroringEnforced: true,
      submarine: {
        massG: 360,
        volumeCm3: 400,
        slots: 2
      },
      inventory: [],
      modules: [
        createSubmarineModule('ballast-a', 'Ballast 70g', 70, 0, { label: '+70 g', color: '#059669' }),
        createSubmarineModule('ballast-b', 'Ballast 50g', 50, 0, { label: '+50 g', color: '#10b981' }),
        createSubmarineModule('ballast-d4', 'Ballast 30g', 30, 0, { label: '+30 g', color: '#34d399', isDistractor: true }),
        createSubmarineModule('ballast-d5', 'Ballast 100g', 100, 0, { label: '+100 g', color: '#047857', isDistractor: true })
      ]
    }
  ];

  if (difficulty === 'easy') {
    levels.forEach((lvl) => {
      const distractors = lvl.modules.filter((m) => m.isDistractor);
      if (distractors.length > 1) {
        const keep = distractors[0];
        lvl.modules = lvl.modules.filter((m) => !m.isDistractor || m.id === keep.id);
      }
    });
  } else if (difficulty === 'hard') {
    levels[0].modules.push(
      createSubmarineModule('ballast-d3', 'Ballast 10g', 10, 0, { label: '+10 g', color: '#1e293b', isDistractor: true })
    );
  }

  return levels;
}

export function verifyAntiMirroring(level: BuoyancyLevel): boolean {
  if (level.ageGroup === '6-8' || level.targetType === 'displacement') {
    const deltaNeeded = level.targetWaterMl - level.initialWaterMl;
    const blocks = level.inventory || [];

    // Invariant 1: No single block equals deltaNeeded
    for (const b of blocks) {
      if (b.volumeCm3 === deltaNeeded) return false;
    }

    // Invariant 2: At least one combination of >= 2 blocks equals deltaNeeded
    let hasMultiBlockSolution = false;
    const n = blocks.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      let count = 0;
      let sumVol = 0;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          count++;
          sumVol += blocks[i].volumeCm3;
        }
      }
      if (count >= 2 && sumVol === deltaNeeded) {
        hasMultiBlockSolution = true;
        break;
      }
    }
    return hasMultiBlockSolution;
  }

  if (level.ageGroup === '9-11' || level.targetType === 'submarine') {
    if (!level.submarine) return true;
    const mods = level.modules || [];

    // Invariant 1: No single module alone achieves neutral buoyancy
    for (const m of mods) {
      const trim = calculateSubmarineDensity(level.submarine, [m], level.fluidDensity);
      if (trim.isNeutral) return false;
    }

    // Invariant 2: At least one combination of >= 2 modules achieves neutral buoyancy
    let hasMultiModuleSolution = false;
    const n = mods.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const subset: SubmarineModule[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) subset.push(mods[i]);
      }
      if (subset.length >= 2) {
        const trim = calculateSubmarineDensity(level.submarine, subset, level.fluidDensity);
        if (trim.isNeutral) {
          hasMultiModuleSolution = true;
          break;
        }
      }
    }
    return hasMultiModuleSolution;
  }

  return true;
}

export function simulateBuoyancyLevel(
  level: BuoyancyLevel,
  placedItems: (BuoyancyItem | SubmarineModule)[],
  settlingTimeSeconds: number = 0
): BuoyancySimulationResult {
  // Empty items invariant: cannot win with empty tank/tray
  if (!placedItems || placedItems.length === 0) {
    return {
      won: false,
      targetMatched: false,
      isNeutral: false,
      settlingTime: 0,
      currentWaterMl: level.initialWaterMl || 500
    };
  }

  if (level.ageGroup === '3-5' || level.targetType === 'float' || level.targetType === 'sink') {
    const targetType = level.targetType || 'float';
    let correctCount = 0;
    let wrongCount = 0;

    for (const item of placedItems as BuoyancyItem[]) {
      const isFloat = (item.massG / item.volumeCm3) < 1.0;
      if (targetType === 'float') {
        if (isFloat) correctCount++;
        else wrongCount++;
      } else {
        if (!isFloat) correctCount++;
        else wrongCount++;
      }
    }

    const targetMatched = (wrongCount === 0 && correctCount >= (level.requiredCount || 1));
    const won = targetMatched && settlingTimeSeconds >= 0.5;

    return {
      won,
      targetMatched,
      isNeutral: false,
      settlingTime: settlingTimeSeconds,
      currentWaterMl: level.initialWaterMl || 500
    };
  }

  if (level.ageGroup === '6-8' || level.targetType === 'displacement') {
    const disp = calculateDisplacement(
      level.initialWaterMl,
      placedItems as BuoyancyItem[],
      level.fluidDensity,
      level.tankCapacityMl || 1000
    );
    const targetMatched = (disp.currentWaterMl === level.targetWaterMl);
    const won = targetMatched && settlingTimeSeconds >= 0.5;

    return {
      won,
      targetMatched,
      isNeutral: false,
      settlingTime: settlingTimeSeconds,
      currentWaterMl: disp.currentWaterMl
    };
  }

  // 9-11 Submarine Trim
  const base = level.submarine || { massG: 300, volumeCm3: 400 };
  const trim = calculateSubmarineDensity(base, placedItems as SubmarineModule[], level.fluidDensity);
  const targetMatched = trim.isNeutral;
  const won = targetMatched && settlingTimeSeconds >= 0.5;

  return {
    won,
    targetMatched,
    isNeutral: trim.isNeutral,
    settlingTime: settlingTimeSeconds,
    currentWaterMl: level.initialWaterMl || 600,
    totalMassG: trim.totalMassG,
    totalVolumeCm3: trim.totalVolumeCm3,
    density: trim.density
  };
}

export function parseCustomLevels(raw: unknown): BuoyancyLevel[] | null {
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

  const result: BuoyancyLevel[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const obj = parsed[i];
    if (!obj || typeof obj !== 'object') return null;

    const v0 = Number(obj.initialWaterMl ?? obj.initialWater ?? obj.initialMl);
    const vTarget = Number(obj.targetWaterMl ?? obj.targetWater ?? obj.targetMl ?? v0);
    const capacity = Number(obj.tankCapacityMl ?? obj.capacity ?? 1000);

    // Negative volume or target < initial validation
    if (v0 < 0 || !Number.isFinite(v0)) return null;
    if (vTarget < 0 || !Number.isFinite(vTarget)) return null;

    const ageGroup: AgeGroup = (['3-5', '6-8', '9-11'].includes(obj.ageGroup)) ? obj.ageGroup : '6-8';
    const fluidType: FluidType = obj.fluidType === 'saltwater' ? 'saltwater' : 'freshwater';
    const fluidDensity = fluidType === 'saltwater' ? 1.2 : 1.0;

    let targetType: 'float' | 'sink' | 'displacement' | 'submarine' = 'displacement';
    if (ageGroup === '3-5') {
      targetType = obj.targetType === 'sink' ? 'sink' : 'float';
    } else if (ageGroup === '9-11' || obj.submarine || obj.modules) {
      targetType = 'submarine';
    } else {
      targetType = 'displacement';
      if (vTarget <= v0) return null; // Target must exceed initial for displacement
    }

    const rawInventory = Array.isArray(obj.inventory) ? obj.inventory : (Array.isArray(obj.items) ? obj.items : []);
    const rawModules = Array.isArray(obj.modules) ? obj.modules : [];

    // Parse inventory blocks/items
    const inventory: BuoyancyItem[] = [];
    for (let j = 0; j < rawInventory.length; j++) {
      const it = rawInventory[j];
      if (!it || typeof it !== 'object') continue;
      const vol = Number(it.volumeCm3 ?? it.volume ?? 100);
      const mass = Number(it.massG ?? it.mass ?? vol * 2.5);
      if (vol <= 0 || mass <= 0) continue;
      inventory.push(createBuoyancyItem(
        String(it.id || `custom-item-${j + 1}`),
        String(it.name || `Item ${j + 1}`),
        mass,
        vol,
        {
          label: it.label,
          color: it.color,
          material: it.material,
          isDistractor: Boolean(it.isDistractor)
        }
      ));
    }

    // Parse submarine modules
    const modules: SubmarineModule[] = [];
    for (let k = 0; k < rawModules.length; k++) {
      const m = rawModules[k];
      if (!m || typeof m !== 'object') continue;
      const vol = Number(m.volumeCm3 ?? m.volume ?? 0);
      const mass = Number(m.massG ?? m.mass ?? 50);
      modules.push(createSubmarineModule(
        String(m.id || `custom-mod-${k + 1}`),
        String(m.name || `Module ${k + 1}`),
        mass,
        vol,
        {
          label: m.label,
          color: m.color,
          isDistractor: Boolean(m.isDistractor)
        }
      ));
    }

    if (ageGroup === '6-8' && inventory.length < 2) return null;
    if (ageGroup === '9-11' && modules.length < 2) return null;
    if (ageGroup === '3-5' && inventory.length < 2) return null;

    result.push({
      id: String(obj.id || `custom-bt-${i + 1}`),
      levelNumber: i + 1,
      ageGroup,
      title: String(obj.title || `Custom Level ${i + 1}`),
      fluidType,
      fluidDensity,
      initialWaterMl: v0,
      targetWaterMl: vTarget,
      tankCapacityMl: capacity > 0 ? capacity : 1000,
      targetType,
      requiredCount: Number(obj.requiredCount ?? 2),
      inventory,
      submarine: obj.submarine ? {
        massG: Number(obj.submarine.massG ?? 300),
        volumeCm3: Number(obj.submarine.volumeCm3 ?? 400),
        slots: Number(obj.submarine.slots ?? 2)
      } : (ageGroup === '9-11' ? { massG: 300, volumeCm3: 400, slots: 2 } : undefined),
      modules,
      antiMirroringEnforced: obj.antiMirroringEnforced !== false
    });
  }

  return result.length > 0 ? result : null;
}

// ============================================================================
// 4. MAIN GAME IMPLEMENTATION (BuoyancyTankGame)
// ============================================================================

export class BuoyancyTankGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private abortController: AbortController | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  // Gameplay state
  private levels: BuoyancyLevel[] = [];
  private currentLevelIndex = 0;
  private currentLevel!: BuoyancyLevel;
  private placedEntities: PlacedItemEntity[] = [];
  private availableItems: (BuoyancyItem | SubmarineModule)[] = [];
  private settlingTimer = 0;
  private isRoundWon = false;
  private score = 0;
  private streak = 0;
  private lastTimestamp = 0;
  private startTimeMs = 0;
  private hasStarted = false;
  private isPaused = false;

  // Visuals & physics
  private wavePhase = 0;
  private propellerAngle = 0;
  private particles: SplashParticle[] = [];
  private bubbles: BubbleParticle[] = [];
  private subY = 240;
  private subTargetY = 240;

  // Drag-and-drop state
  private isDragging = false;
  private draggedItem: (BuoyancyItem | SubmarineModule) | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragCurrentY = 0;
  private hasPassedDragThreshold = false;

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();

    this.initLevels();
    this.renderDOM();
    this.initCanvas();
    this.loadLevel(0);

    // Initial Telemetry
    this.context.emit?.('game:ready', {
      gameId: 'buoyancy-tank'
    });
    this.context.emit?.('game:progress', {
      step: 1,
      total: this.levels.length,
      detail: `Started level 1 of ${this.levels.length}`
    });
  }

  start(): void {
    if (this.animFrameId !== null) return;
    this.context.emit?.('game:start', {
      gameId: 'buoyancy-tank'
    });
    this.hasStarted = true;
    this.isPaused = false;
    this.startTimeMs = Date.now();
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  resume(): void {
    this.isPaused = false;
    if (this.animFrameId === null) {
      this.lastTimestamp = performance.now();
      this.loop(this.lastTimestamp);
    }
  }

  updateConfig(newContext: Partial<GameContext>): void {
    const prevLocale = this.context.locale;
    const prevSound = this.context.sound;
    const prevAge = this.context.ageGroup;
    const prevDiff = this.context.difficulty;
    const prevLevels = this.context.customLevels;

    Object.assign(this.context, newContext);

    if (newContext.locale && newContext.locale !== prevLocale) {
      this.updateHUDText();
      this.renderTrayItems();
    }

    if (newContext.sound !== undefined && newContext.sound !== prevSound) {
      this.updateSoundButton();
    }

    const ageChanged = newContext.ageGroup !== undefined && newContext.ageGroup !== prevAge;
    const diffChanged = newContext.difficulty !== undefined && newContext.difficulty !== prevDiff;
    const levelsChanged = newContext.customLevels !== undefined && newContext.customLevels !== prevLevels;

    if (ageChanged || diffChanged || levelsChanged) {
      // Score convention: each age bracket / difficulty is a fresh run.
      this.score = 0;
      this.streak = 0;
      this.startTimeMs = Date.now();
      this.initLevels();
      this.loadLevel(0);
      this.updateScoreDisplay();
    }

    // Recover the render loop if it died (or was never restarted) while the host is running us.
    if (this.hasStarted && !this.isPaused && this.animFrameId === null) {
      this.lastTimestamp = performance.now();
      this.loop(this.lastTimestamp);
    }
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
  // LEVEL & DOM INITIALIZATION
  // ==========================================================================

  private initLevels(): void {
    if (this.context.customLevels) {
      const parsed = parseCustomLevels(this.context.customLevels);
      if (parsed && parsed.length > 0) {
        this.levels = parsed;
        return;
      }
    }
    this.levels = generateLevelsForAge(this.context.ageGroup || '6-8', this.context.difficulty);
  }

  private loadLevel(index: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(index, this.levels.length - 1));
    this.currentLevel = this.levels[this.currentLevelIndex];
    this.placedEntities = [];
    this.settlingTimer = 0;
    this.isRoundWon = false;
    this.particles = [];
    this.bubbles = [];

    if (this.currentLevel.ageGroup === '9-11' || this.currentLevel.targetType === 'submarine') {
      this.availableItems = [...(this.currentLevel.modules || [])];
      this.subY = 240;
      this.subTargetY = 240;
    } else {
      this.availableItems = [...(this.currentLevel.inventory || [])];
    }

    this.updateHUDText();
    this.renderTrayItems();
  }

  private renderDOM(): void {
    const t = getTranslations(this.context.locale as SupportedLocale || 'en');
    this.container.innerHTML = `
      <style>
        .bt-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0f172a;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
          overflow-x: hidden;
          overflow-y: auto;
          box-sizing: border-box;
          container-type: inline-size;
        }
        .bt-hud {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #1e293b;
          border-bottom: 2px solid #334155;
          gap: 8px 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
          z-index: 10;
        }
        .bt-hud-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bt-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #38bdf8;
          white-space: nowrap;
        }
        @container (max-width: 760px) {
          .bt-title { font-size: 1rem; white-space: normal; }
          .bt-hud { padding: 8px 10px; }
          .bt-hud-left { order: 1; flex: 1 1 auto; min-width: 0; }
          .bt-hud-right { order: 2; flex-wrap: wrap; justify-content: flex-end; }
          .bt-instruction { order: 3; flex: 1 1 100%; font-size: 0.85rem; }
          .bt-item { min-height: 56px; }
        }
        .bt-badge {
          background: #334155;
          color: #fbbf24;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.85rem;
        }
        .bt-instruction {
          flex: 1 1 280px;
          min-width: 0;
          text-align: center;
          font-size: 0.95rem;
          font-weight: 600;
          color: #e2e8f0;
          background: rgba(15, 23, 42, 0.6);
          padding: 6px 14px;
          border-radius: 8px;
          border: 1px solid #475569;
          min-height: 24px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bt-hud-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bt-btn {
          background: #334155;
          color: #f8fafc;
          border: 1px solid #475569;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bt-btn:hover {
          background: #475569;
          border-color: #38bdf8;
        }
        .bt-main {
          flex: 1 0 auto;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .bt-canvas-wrap {
          flex: 1 1 auto;
          position: relative;
          min-height: 240px;
        }
        canvas.bt-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .bt-tray {
          background: #1e293b;
          border-top: 2px solid #334155;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px 14px;
          flex-wrap: wrap;
          flex-shrink: 0;
          min-height: 76px;
          box-sizing: border-box;
          z-index: 10;
        }
        .bt-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 64px;
          min-height: 64px;
          box-sizing: border-box;
          padding: 4px 8px;
          background: #0f172a;
          border: 2px solid #475569;
          border-radius: 12px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 700;
          color: #f8fafc;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          transition: transform 0.1s ease, border-color 0.1s ease;
          touch-action: none;
        }
        .bt-item:hover {
          transform: translateY(-2px);
          border-color: #38bdf8;
        }
        .bt-item:active {
          transform: scale(0.95);
        }
      </style>
      <div class="bt-container">
        <header class="bt-hud">
          <div class="bt-hud-left">
            <span id="hud-title" class="bt-title">${t.title}</span>
            <span id="level-badge" class="bt-badge">1/${this.levels.length}</span>
          </div>
          <div id="hud-instruction" class="bt-instruction">...</div>
          <div class="bt-hud-right">
            <span id="hud-score" class="bt-badge">${t.score}: ${this.score}</span>
            <button id="btn-sound-toggle" class="bt-btn">${this.context.sound ? t.soundOn : t.soundOff}</button>
            <button id="btn-reset" class="bt-btn">${t.reset}</button>
          </div>
        </header>
        <main class="bt-main">
          <div class="bt-canvas-wrap">
            <canvas id="tank-canvas" class="bt-canvas"></canvas>
          </div>
          <footer id="item-tray" class="bt-tray" aria-label="${t.trayLabel}"></footer>
        </main>
      </div>
    `;

    const signal = this.abortController?.signal;

    // Button event listeners
    const soundBtn = this.container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    soundBtn?.addEventListener('click', () => {
      this.context.sound = !this.context.sound;
      if (this.context.audio) {
        this.context.audio.enabled = this.context.sound;
      }
      this.updateSoundButton();
      this.context.audio?.playClick();
    }, { signal });

    const resetBtn = this.container.querySelector('#btn-reset') as HTMLButtonElement;
    resetBtn?.addEventListener('click', () => {
      this.resetPlacedItems();
      this.context.audio?.playPop();
    }, { signal });
  }

  private initCanvas(): void {
    this.canvas = this.container.querySelector('#tank-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    const resize = () => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      this.canvas.height = Math.max(200, Math.floor(rect.height * dpr));
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => resize());
      this.resizeObserver.observe(this.canvas);
    }
    resize();

    // Canvas click for granular undo (remove clicked item from water)
    const signal = this.abortController?.signal;
    this.canvas?.addEventListener('click', (e) => {
      this.handleCanvasClick(e);
    }, { signal });
  }

  // ==========================================================================
  // HUD & TRAY UPDATES
  // ==========================================================================

  private updateSoundButton(): void {
    const t = getTranslations(this.context.locale as SupportedLocale || 'en');
    const soundBtn = this.container.querySelector('#btn-sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = this.context.sound ? t.soundOn : t.soundOff;
    }
  }

  private updateScoreDisplay(): void {
    const t = getTranslations(this.context.locale as SupportedLocale || 'en');
    const el = this.container.querySelector('#hud-score');
    if (el) el.textContent = `${t.score}: ${this.score}`;
  }

  private updateHUDText(): void {
    const t = getTranslations(this.context.locale as SupportedLocale || 'en');
    this.updateScoreDisplay();

    // Title & Badge
    const titleEl = this.container.querySelector('#hud-title');
    if (titleEl) titleEl.textContent = t.title;

    const badgeEl = this.container.querySelector('#level-badge');
    if (badgeEl) badgeEl.textContent = `${this.currentLevelIndex + 1}/${this.levels.length}`;

    // Dynamic Instruction Prompt
    const promptEl = this.container.querySelector('#hud-instruction');
    if (!promptEl) return;

    if (this.currentLevel.ageGroup === '3-5') {
      const placedCount = this.placedEntities.length;
      const targetCat = this.currentLevel.targetType === 'sink' ? 'sink' : 'float';
      const lastPlaced = this.placedEntities[this.placedEntities.length - 1];
      const lastAction = lastPlaced ? {
        behavior: (lastPlaced.item as BuoyancyItem).behavior,
        name: lastPlaced.item.name
      } : undefined;

      promptEl.textContent = t.formatPreschoolPrompt(
        targetCat,
        placedCount,
        this.currentLevel.requiredCount || 2,
        lastAction
      );
    } else if (this.currentLevel.ageGroup === '6-8') {
      const v0 = this.currentLevel.initialWaterMl;
      const vTarget = this.currentLevel.targetWaterMl;
      const deltaNeeded = vTarget - v0;
      const disp = calculateDisplacement(
        v0,
        this.placedEntities.map((e) => e.item as BuoyancyItem),
        this.currentLevel.fluidDensity,
        this.currentLevel.tankCapacityMl
      );
      promptEl.textContent = t.formatElementaryPrompt(
        v0,
        vTarget,
        disp.currentWaterMl,
        deltaNeeded,
        disp.addedVolumeMl
      );
    } else {
      // 9-11 Submarine Trim
      const fluidName = this.currentLevel.fluidType === 'saltwater' ? t.fluids.saltwater : t.fluids.freshwater;
      const base = this.currentLevel.submarine || { massG: 300, volumeCm3: 400 };
      const trim = calculateSubmarineDensity(
        base,
        this.placedEntities.map((e) => e.item as SubmarineModule),
        this.currentLevel.fluidDensity
      );
      promptEl.textContent = t.formatUpperElementaryPrompt(
        fluidName,
        this.currentLevel.fluidDensity,
        trim.totalMassG,
        trim.totalVolumeCm3,
        trim.density,
        trim.status,
        {
          hasFoam: (this.currentLevel.modules || []).some((m) => m.type === 'foam'),
          hasBallast: (this.currentLevel.modules || []).some((m) => m.type === 'ballast')
        }
      );
    }
  }

  private renderTrayItems(): void {
    const tray = this.container.querySelector('#item-tray');
    if (!tray) return;

    tray.innerHTML = '';
    const signal = this.abortController?.signal;

    for (const item of this.availableItems) {
      const btn = document.createElement('div');
      btn.className = 'bt-item';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', item.name);
      btn.style.borderColor = item.color;

      btn.innerHTML = `
        <span style="font-size: 1.2rem;">${(item as any).shape === 'duck' ? '🦆' : (item as any).shape === 'log' ? '🪵' : (item as any).shape === 'ball' ? '⚽' : (item as any).shape === 'pebble' ? '🪨' : (item as any).shape === 'bolt' ? '🔩' : (item as any).shape === 'nut' ? '⚙️' : (item as any).shape === 'marble' ? '🔮' : (item as any).shape === 'cork' ? '🍾' : (item as any).type === 'foam' ? '🪶' : '📦'}</span>
        <span>${item.label}</span>
      `;

      // Tap / Click handling (instant drop into water)
      btn.addEventListener('click', () => {
        if (!this.hasPassedDragThreshold) {
          this.placeItemFromTray(item);
        }
      }, { signal });

      // Pointer drag handling
      btn.addEventListener('pointerdown', (e) => {
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragCurrentY = e.clientY;
        this.draggedItem = item;
        this.hasPassedDragThreshold = false;
        this.isDragging = true;
      }, { signal });

      tray.appendChild(btn);
    }

    // Window pointer move and up for drag threshold
    if (!signal?.aborted) {
      window.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        this.dragCurrentY = e.clientY;
        const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
        if (dist > 5) {
          this.hasPassedDragThreshold = true;
        }
      }, { signal });

      window.addEventListener('pointerup', () => {
        if (!this.isDragging) return;
        if (this.hasPassedDragThreshold && this.draggedItem) {
          // Check if dropped inside canvas
          const rect = this.canvas?.getBoundingClientRect();
          if (rect && this.dragCurrentY < rect.bottom) {
            this.placeItemFromTray(this.draggedItem);
          }
        }
        this.isDragging = false;
        this.draggedItem = null;
        setTimeout(() => {
          this.hasPassedDragThreshold = false;
        }, 50);
      }, { signal });
    }
  }

  private placeItemFromTray(item: BuoyancyItem | SubmarineModule): void {
    const idx = this.availableItems.indexOf(item);
    if (idx === -1) return;

    this.availableItems.splice(idx, 1);

    const canvasWidth = this.canvas?.getBoundingClientRect().width || 600;
    const dropX = canvasWidth / 2 + (Math.random() - 0.5) * 80;

    this.placedEntities.push({
      item,
      x: dropX,
      y: 60,
      vy: 120,
      bobPhase: Math.random() * Math.PI * 2,
      isSettled: false
    });

    this.spawnSplash(dropX, 100);
    this.context.audio?.playDrop();

    this.settlingTimer = 0;
    this.updateHUDText();
    this.renderTrayItems();
  }

  private handleCanvasClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check hit test against placed items (reverse order to pick top item)
    for (let i = this.placedEntities.length - 1; i >= 0; i--) {
      const ent = this.placedEntities[i];
      const radius = 32;
      const dist = Math.hypot(clickX - ent.x, clickY - ent.y);
      if (dist <= radius) {
        // Return item to tray
        const removed = this.placedEntities.splice(i, 1)[0];
        this.availableItems.push(removed.item);
        this.context.audio?.playPop();
        this.settlingTimer = 0;
        this.updateHUDText();
        this.renderTrayItems();
        return;
      }
    }
  }

  private resetPlacedItems(): void {
    for (const ent of this.placedEntities) {
      this.availableItems.push(ent.item);
    }
    this.placedEntities = [];
    this.settlingTimer = 0;
    this.updateHUDText();
    this.renderTrayItems();
  }

  // ==========================================================================
  // PHYSICS SIMULATION & RENDERING LOOP
  // ==========================================================================

  private spawnSplash(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 120 - 40,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 0.9,
        life: 0,
        maxLife: Math.random() * 0.3 + 0.3
      });
    }
  }

  private spawnBubbles(x: number, y: number): void {
    if (Math.random() < 0.25) {
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vy: -Math.random() * 40 - 30,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 0.7,
        swayFreq: Math.random() * 3 + 2,
        swayAmp: Math.random() * 4 + 2,
        time: 0
      });
    }
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(rawDt, 0.033);

    // Schedule the next frame first so a single bad frame can never freeze the game.
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));

    try {
      this.updatePhysics(dt);
      this.renderCanvas();
    } catch (err) {
      console.error('[buoyancy-tank] frame error (loop continues):', err);
    }
  }

  private updatePhysics(dt: number): void {
    this.wavePhase += dt * 3.0;
    this.propellerAngle += dt * 12.0;

    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 600, height: 380 };
    const tankHeight = rect.height;
    const tankFloorY = tankHeight - 30;

    // Calculate current water level
    let currentWaterMl = this.currentLevel.initialWaterMl;
    if (this.currentLevel.ageGroup === '6-8') {
      const disp = calculateDisplacement(
        this.currentLevel.initialWaterMl,
        this.placedEntities.map((e) => e.item as BuoyancyItem),
        this.currentLevel.fluidDensity,
        this.currentLevel.tankCapacityMl
      );
      currentWaterMl = disp.currentWaterMl;
    }

    const waterSurfaceY = calculateWaterSurfaceLevel(
      tankHeight,
      currentWaterMl,
      this.currentLevel.tankCapacityMl || 1000
    );

    // Update splash particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Update bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.time += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.time * b.swayFreq) * b.swayAmp * dt;
      if (b.y <= waterSurfaceY) {
        this.bubbles.splice(i, 1);
      }
    }

    // Horizontal slots keep placed items from overlapping (and attached to the pod in 9-11)
    const isSubLevel = this.currentLevel.ageGroup === '9-11' || this.currentLevel.targetType === 'submarine';
    const n = this.placedEntities.length;
    const slotGap = Math.min(56, Math.max(30, (Math.min(rect.width - 40, 500) - 60) / Math.max(1, n)));

    // Update placed items (bobbing floaters, sinking blocks)
    for (let idx = 0; idx < n; idx++) {
      const ent = this.placedEntities[idx];
      const slotX = rect.width / 2 + (idx - (n - 1) / 2) * slotGap;
      ent.x += (slotX - ent.x) * Math.min(1.0, dt * 8.0);

      if (isSubLevel) {
        // Modules are strapped under the pod hull so they visibly belong to it
        const attachY = this.subY + 48;
        ent.y += (attachY - ent.y) * Math.min(1.0, dt * 8.0);
        continue;
      }

      const isFloater = (ent.item as BuoyancyItem).behavior === 'float';

      if (isFloater) {
        // Floats on water surface
        ent.bobPhase += dt * 3.5;
        const targetY = waterSurfaceY + Math.sin(ent.bobPhase) * 4;
        ent.y += (targetY - ent.y) * Math.min(1.0, dt * 6.0);
      } else {
        // Sinks to tank floor
        const targetFloorY = tankFloorY - 24;
        if (ent.y < targetFloorY) {
          ent.y = Math.min(targetFloorY, ent.y + 140 * dt);
          this.spawnBubbles(ent.x, ent.y);
        }
      }
    }

    // Update submarine physics (Ages 9-11)
    if (this.currentLevel.ageGroup === '9-11' || this.currentLevel.targetType === 'submarine') {
      const base = this.currentLevel.submarine || { massG: 300, volumeCm3: 400 };
      const trim = calculateSubmarineDensity(
        base,
        this.placedEntities.map((e) => e.item as SubmarineModule),
        this.currentLevel.fluidDensity
      );

      const midDepthY = (waterSurfaceY + tankFloorY) / 2;

      if (trim.isNeutral) {
        this.subTargetY = midDepthY;
        this.spawnBubbles(rect.width / 2 - 60, this.subY + 10);
      } else if (trim.status === 'floats') {
        this.subTargetY = waterSurfaceY + 20; // breaches surface
      } else {
        this.subTargetY = tankFloorY - 34; // sinks to seabed
        this.spawnBubbles(rect.width / 2 - 60, this.subY + 10);
      }

      this.subY += (this.subTargetY - this.subY) * Math.min(1.0, dt * 4.0);
    }

    // Simulate level win condition
    const sim = simulateBuoyancyLevel(
      this.currentLevel,
      this.placedEntities.map((e) => e.item),
      this.settlingTimer
    );

    if (sim.targetMatched) {
      this.settlingTimer += dt;
      if (this.settlingTimer >= 0.65 && !this.isRoundWon) {
        this.triggerWin();
      }
    } else {
      this.settlingTimer = 0;
    }
  }

  private triggerWin(): void {
    this.isRoundWon = true;
    this.score += 100;
    this.streak += 1;
    this.updateScoreDisplay();

    this.context.audio?.playSuccess();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    this.context.emit?.('game:score', {
      points: this.score,
      streak: this.streak,
      delta: 100
    });

    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      if (this.currentLevelIndex < this.levels.length - 1) {
        this.loadLevel(this.currentLevelIndex + 1);
        this.context.emit?.('game:progress', {
          step: this.currentLevelIndex + 1,
          total: this.levels.length,
          detail: `Advanced to level ${this.currentLevelIndex + 1}`
        });
      } else {
        // Game Completed
        this.context.emit?.('game:complete', {
          stars: 3,
          score: this.score,
          timeElapsed: Math.max(0, Math.round((Date.now() - (this.startTimeMs || Date.now())) / 1000)),
          summary: getTranslations(this.context.locale as SupportedLocale || 'en').summaries[
            (this.currentLevel.ageGroup || this.context.ageGroup || '6-8') as '3-5' | '6-8' | '9-11'
          ]
        });
      }
    }, 1200);

    this.pendingTimeouts.add(timeout);
  }

  // ==========================================================================
  // CANVAS RENDERING
  // ==========================================================================

  private renderCanvas(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Tank dimensions
    const tankWidth = Math.min(width - 40, 500);
    const tankHeight = height - 40;
    const tankX = (width - tankWidth) / 2;
    const tankY = 20;
    const tankFloorY = tankY + tankHeight;

    // Current water volume and surface Y
    let currentWaterMl = this.currentLevel.initialWaterMl;
    if (this.currentLevel.ageGroup === '6-8') {
      const disp = calculateDisplacement(
        this.currentLevel.initialWaterMl,
        this.placedEntities.map((e) => e.item as BuoyancyItem),
        this.currentLevel.fluidDensity,
        this.currentLevel.tankCapacityMl
      );
      currentWaterMl = disp.currentWaterMl;
    }

    const waterSurfaceY = calculateWaterSurfaceLevel(
      height,
      currentWaterMl,
      this.currentLevel.tankCapacityMl || 1000
    );

    // 1. Draw Tank Glass Frame
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(tankX, tankY, tankWidth, tankHeight);

    // Glass reflection highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(tankX + 2, tankY + 2, tankWidth - 4, tankHeight - 4);
    ctx.restore();

    // 2. Draw Fluid Body
    ctx.save();
    const isSalt = this.currentLevel.fluidType === 'saltwater';
    const grad = ctx.createLinearGradient(0, waterSurfaceY, 0, tankFloorY);
    if (isSalt) {
      grad.addColorStop(0, 'rgba(45, 212, 191, 0.55)');
      grad.addColorStop(1, 'rgba(15, 118, 110, 0.85)');
    } else {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.50)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0.80)');
    }

    // Animated water surface sine curve
    ctx.beginPath();
    ctx.moveTo(tankX, tankFloorY);
    ctx.lineTo(tankX, waterSurfaceY);

    const step = 8;
    for (let x = tankX; x <= tankX + tankWidth; x += step) {
      const wave = Math.sin((x / 50) + this.wavePhase) * 2.5;
      ctx.lineTo(x, waterSurfaceY + wave);
    }
    ctx.lineTo(tankX + tankWidth, tankFloorY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Surface waterline highlight
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. Graduated Scale Markings (Ages 6-8 and general)
    ctx.save();
    const maxCapacity = this.currentLevel.tankCapacityMl || 1000;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let vol = 100; vol <= maxCapacity; vol += 100) {
      const tickY = calculateWaterSurfaceLevel(height, vol, maxCapacity);
      if (tickY >= tankY && tickY <= tankFloorY) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tankX + 4, tickY);
        ctx.lineTo(tankX + 18, tickY);
        ctx.stroke();

        ctx.fillText(`${vol} mL`, tankX - 4, tickY);
      }
    }

    // Minor ticks every 20 mL
    for (let vol = 20; vol <= maxCapacity; vol += 20) {
      if (vol % 100 === 0) continue;
      const tickY = calculateWaterSurfaceLevel(height, vol, maxCapacity);
      if (tickY >= tankY && tickY <= tankFloorY) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tankX + 4, tickY);
        ctx.lineTo(tankX + 10, tickY);
        ctx.stroke();
      }
    }

    // Target Waterline (if elementary displacement)
    if (this.currentLevel.targetWaterMl && this.currentLevel.ageGroup === '6-8') {
      const targetY = calculateWaterSurfaceLevel(height, this.currentLevel.targetWaterMl, maxCapacity);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(tankX + 2, targetY);
      ctx.lineTo(tankX + tankWidth - 2, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`🎯 Target: ${this.currentLevel.targetWaterMl} mL`, tankX + 24, targetY - 8);
    }
    ctx.restore();

    // 4. Submarine Rendering (Ages 9-11)
    if (this.currentLevel.ageGroup === '9-11' || this.currentLevel.targetType === 'submarine') {
      this.renderSubmarine(ctx, width / 2, this.subY);
    }

    // 5. Draw Placed Manipulatives
    ctx.save();
    for (const ent of this.placedEntities) {
      ctx.fillStyle = ent.item.color || '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Draw item round shape
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ent.item.label || '', ent.x, ent.y);
    }
    ctx.restore();

    // 6. Splash particles and bubbles
    ctx.save();
    for (const p of this.particles) {
      ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of this.bubbles) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 7. Settling Progress Ring
    if (this.settlingTimer > 0 && !this.isRoundWon) {
      ctx.save();
      const progress = Math.min(1.0, this.settlingTimer / 0.65);
      const ringX = width - 40;
      const ringY = 50;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ringX, ringY, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ringX, ringY, 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderSubmarine(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Streamlined hull
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Conning Tower
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.rect(-18, -42, 36, 16);
    ctx.fill();
    ctx.stroke();

    // Periscope
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(0, -52);
    ctx.lineTo(8, -52);
    ctx.stroke();

    // Observation porthole
    ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Propeller at stern
    const bladeScale = Math.max(0.05, Math.abs(Math.sin(this.propellerAngle)));
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(-72, 0, 4, 18 * bladeScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Target depth indicator line
    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 600, height: 380 };
    const tankWidth = Math.min(rect.width - 40, 500);
    const tankX = (rect.width - tankWidth) / 2;
    const midY = 0; // relative to sub
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tankX - x, midY);
    ctx.lineTo(tankX + tankWidth - x, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live Submarine Density Badge
    const base = this.currentLevel.submarine || { massG: 300, volumeCm3: 400 };
    const trim = calculateSubmarineDensity(
      base,
      this.placedEntities.map((e) => e.item as SubmarineModule),
      this.currentLevel.fluidDensity
    );

    ctx.fillStyle = trim.isNeutral ? '#10b981' : '#f8fafc';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`ρ = ${trim.density.toFixed(2)} g/cm³`, 0, -58);

    ctx.restore();
  }
}

export function createBuoyancyTankGame(): KidGame {
  return new BuoyancyTankGame();
}

export function createGame(): KidGame {
  return new BuoyancyTankGame();
}

export default createGame;
