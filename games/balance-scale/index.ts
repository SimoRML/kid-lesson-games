import confetti from 'canvas-confetti';
import type { GameContext, KidGame } from '../../src/core/types.js';
import { sound } from './audio.js';
import { getTranslations, type Translations } from './i18n.js';

export interface MetricWeight {
  id: string;
  grams: number;
  label: string;
  color: string;
}

interface Level {
  targetLeft: MetricWeight[];
  targetRight: MetricWeight[];
  inventory: MetricWeight[];
  leftNotch: 1 | 2 | 3 | 4;
  rightNotch: 1 | 2 | 3 | 4;
  leverMode: boolean;
  customInstruction?: string;
}

export interface CustomLevelConfig {
  left?: (number | string | { grams: number; label?: string; color?: string })[];
  targetLeft?: (number | string | { grams: number; label?: string; color?: string })[];
  right?: (number | string | { grams: number; label?: string; color?: string })[];
  targetRight?: (number | string | { grams: number; label?: string; color?: string })[];
  inventory?: (number | string | { grams: number; label?: string; color?: string })[];
  weights?: (number | string | { grams: number; label?: string; color?: string })[];
  leftNotch?: 1 | 2 | 3 | 4;
  rightNotch?: 1 | 2 | 3 | 4;
  leverMode?: boolean;
  instruction?: string;
}

const PALETTE: Record<number, { label: string; color: string }> = {
  50: { label: '50g', color: '#f59e0b' },
  100: { label: '100g', color: '#06b6d4' },
  150: { label: '150g', color: '#14b8a6' },
  200: { label: '200g', color: '#3b82f6' },
  250: { label: '250g', color: '#10b981' },
  300: { label: '300g', color: '#8b5cf6' },
  400: { label: '400g', color: '#6366f1' },
  500: { label: '500g', color: '#ec4899' },
  600: { label: '600g', color: '#f97316' },
  750: { label: '750g', color: '#e11d48' },
  1000: { label: '1 kg', color: '#eab308' }
};

export function createWeight(grams: number): MetricWeight {
  const p = PALETTE[grams] || { label: `${grams}g`, color: '#6366f1' };
  return {
    id: `${grams}-${Math.random().toString(36).slice(2, 7)}`,
    grams,
    label: p.label,
    color: p.color
  };
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function findDecompositions(
  targetSum: number,
  forbiddenGrams: Set<number>,
  pool: number[],
  minParts: number,
  maxParts: number
): number[][] {
  const allowed = pool.filter((g) => !forbiddenGrams.has(g) && g <= targetSum).sort((a, b) => b - a);
  const results: number[][] = [];

  function backtrack(remaining: number, current: number[], startIdx: number) {
    if (remaining === 0) {
      if (current.length >= minParts && current.length <= maxParts) {
        results.push([...current]);
      }
      return;
    }
    if (current.length >= maxParts) return;

    for (let i = startIdx; i < allowed.length; i++) {
      const val = allowed[i];
      if (val <= remaining) {
        current.push(val);
        backtrack(remaining - val, current, i);
        current.pop();
      }
    }
  }

  backtrack(targetSum, [], 0);
  return results;
}

export function generateLevelsForAge(age: string): Level[] {
  if (age === '3-5') {
    const pool = [50, 100, 150, 200, 250, 300, 400];
    const leftCandidates: number[][] = [
      [200],
      [250],
      [300],
      [400],
      [150, 100],
      [200, 100],
      [200, 150]
    ];

    const pickedLefts = shuffle(leftCandidates).slice(0, 3);
    return pickedLefts.map((leftArr) => {
      const leftSum = leftArr.reduce((a, b) => a + b, 0);
      const forbidden = new Set<number>([...leftArr, leftSum]);
      const decomps = findDecompositions(leftSum, forbidden, pool, 2, 3);
      const solution = decomps.length > 0 ? randomItem(decomps) : [100, 100];

      const distractorPool = pool.filter((g) => !forbidden.has(g));
      const distractors = [randomItem(distractorPool)];

      return {
        targetLeft: leftArr.map((g) => createWeight(g)),
        targetRight: [],
        inventory: shuffle([...solution, ...distractors]).map((g) => createWeight(g)),
        leftNotch: 4,
        rightNotch: 4,
        leverMode: false
      };
    });
  }

  if (age === '9-11') {
    const pool = [50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000];
    // Lever puzzles: Left at notch 4 (outer anchor) is the primary intuitive pattern (~80%),
    // demonstrating mechanical advantage as the right hook moves closer (notch 2, notch 1) or matches (notch 4).
    const leverTemplates: Array<{
      leftArr: number[];
      leftNotch: 1 | 2 | 3 | 4;
      solNotch: 1 | 2 | 3 | 4;
    }> = [
      // Primary: Left at Notch 4 (Load anchor)
      { leftArr: [200], leftNotch: 4, solNotch: 2 }, // 200*4 = 800 -> at notch 2 needs 400g (250+150 or 300+100)
      { leftArr: [250], leftNotch: 4, solNotch: 2 }, // 250*4 = 1000 -> at notch 2 needs 500g (300+200)
      { leftArr: [300], leftNotch: 4, solNotch: 2 }, // 300*4 = 1200 -> at notch 2 needs 600g (400+200)
      { leftArr: [300], leftNotch: 4, solNotch: 3 }, // 300*4 = 1200 -> at notch 3 needs 400g (250+150)
      { leftArr: [150], leftNotch: 4, solNotch: 3 }, // 150*4 = 600 -> at notch 3 needs 200g (100+100)
      { leftArr: [150], leftNotch: 4, solNotch: 2 }, // 150*4 = 600 -> at notch 2 needs 300g (200+100)
      { leftArr: [250], leftNotch: 4, solNotch: 1 }, // 250*4 = 1000 -> at notch 1 needs 1000g (1 kg!)
      // Advanced variant: Inner load notch
      { leftArr: [500], leftNotch: 2, solNotch: 4 }, // 500*2 = 1000 -> at notch 4 needs 250g (effort reduction!)
      { leftArr: [600], leftNotch: 2, solNotch: 3 }  // 600*2 = 1200 -> at notch 3 needs 400g
    ];

    const picked = shuffle(leverTemplates).slice(0, 3);
    return picked.map((tpl) => {
      const leftSum = tpl.leftArr.reduce((a, b) => a + b, 0);
      const targetTorque = leftSum * tpl.leftNotch;
      const rightTargetGrams = targetTorque / tpl.solNotch;

      // Forbid all left pan weights AND the total leftSum
      const forbidden = new Set<number>([...tpl.leftArr, leftSum]);
      const decomps = findDecompositions(rightTargetGrams, forbidden, pool, 1, 3);
      const solution = decomps.length > 0 ? randomItem(decomps) : [200];

      const distractorPool = pool.filter((g) => !forbidden.has(g) && !solution.includes(g));
      const distractors = shuffle(distractorPool).slice(0, 2);

      return {
        targetLeft: tpl.leftArr.map((g) => createWeight(g)),
        targetRight: [],
        inventory: shuffle([...solution, ...distractors]).map((g) => createWeight(g)),
        leftNotch: tpl.leftNotch,
        rightNotch: tpl.solNotch, // Starts right at the solvable notch!
        leverMode: true
      };
    });
  }

  // Default: Age '6-8'
  const pool = [50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000];
  const templates68: Array<{ leftArr: number[]; rightArr: number[] }> = [
    { leftArr: [1000], rightArr: [] },
    { leftArr: [500, 250], rightArr: [] },
    { leftArr: [600, 400], rightArr: [] },
    { leftArr: [500, 300], rightArr: [] },
    { leftArr: [400, 250], rightArr: [] },
    { leftArr: [750], rightArr: [] },
    { leftArr: [1000], rightArr: [250] },
    { leftArr: [1000], rightArr: [300] }
  ];

  const picked = shuffle(templates68).slice(0, 3);
  return picked.map((tpl) => {
    const leftSum = tpl.leftArr.reduce((a, b) => a + b, 0);
    const rightStartSum = tpl.rightArr.reduce((a, b) => a + b, 0);
    const neededGrams = leftSum - rightStartSum;

    const forbidden = new Set<number>([...tpl.leftArr, ...tpl.rightArr, leftSum, neededGrams]);
    let decomps = findDecompositions(neededGrams, forbidden, pool, 2, 3);
    if (decomps.length === 0) {
      decomps = findDecompositions(neededGrams, new Set([...tpl.leftArr, leftSum]), pool, 2, 4);
    }
    const solution = decomps.length > 0 ? randomItem(decomps) : [250, 250];

    const distractorPool = pool.filter((g) => !forbidden.has(g));
    const distractors = shuffle(distractorPool).slice(0, 2);

    return {
      targetLeft: tpl.leftArr.map((g) => createWeight(g)),
      targetRight: tpl.rightArr.map((g) => createWeight(g)),
      inventory: shuffle([...solution, ...distractors]).map((g) => createWeight(g)),
      leftNotch: 4,
      rightNotch: 4,
      leverMode: false
    };
  });
}

export function parseWeightItem(item: unknown): MetricWeight | null {
  if (typeof item === 'number' && !isNaN(item) && item > 0) {
    return createWeight(item);
  }
  if (typeof item === 'string') {
    const trimmed = item.trim().toLowerCase();
    const isKg = trimmed.includes('kg');
    const cleaned = trimmed.replace(/k?g$/, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      return createWeight(isKg ? Math.round(num * 1000) : Math.round(num));
    }
  }
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const grams = typeof obj.grams === 'number' ? obj.grams : typeof obj.weight === 'number' ? obj.weight : 0;
    if (grams > 0) {
      const w = createWeight(grams);
      if (typeof obj.label === 'string') w.label = obj.label;
      if (typeof obj.color === 'string') w.color = obj.color;
      return w;
    }
  }
  return null;
}

export function parseCustomLevels(input: unknown): Level[] | null {
  if (!input) return null;
  let data = input;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  const rawList = Array.isArray(data) ? data : [data];
  const validLevels: Level[] = [];

  for (const raw of rawList) {
    if (typeof raw !== 'object' || raw === null) continue;

    const leftRaw = Array.isArray(raw.left) ? raw.left : (raw.targetLeft && Array.isArray(raw.targetLeft) ? raw.targetLeft : []);
    const rightRaw = Array.isArray(raw.right) ? raw.right : (raw.targetRight && Array.isArray(raw.targetRight) ? raw.targetRight : []);
    const invRaw = Array.isArray(raw.inventory) ? raw.inventory : (Array.isArray(raw.weights) ? raw.weights : []);

    const targetLeft = leftRaw.map(parseWeightItem).filter((w: MetricWeight | null): w is MetricWeight => w !== null);
    const targetRight = rightRaw.map(parseWeightItem).filter((w: MetricWeight | null): w is MetricWeight => w !== null);
    const inventory = invRaw.map(parseWeightItem).filter((w: MetricWeight | null): w is MetricWeight => w !== null);

    if (targetLeft.length === 0 || inventory.length === 0) {
      continue;
    }

    const leftNotchVal = Number(raw.leftNotch);
    const leftNotch: 1 | 2 | 3 | 4 = (leftNotchVal >= 1 && leftNotchVal <= 4) ? (leftNotchVal as 1 | 2 | 3 | 4) : 4;

    const rightNotchVal = Number(raw.rightNotch);
    const rightNotch: 1 | 2 | 3 | 4 = (rightNotchVal >= 1 && rightNotchVal <= 4) ? (rightNotchVal as 1 | 2 | 3 | 4) : 4;

    const leverMode = typeof raw.leverMode === 'boolean'
      ? raw.leverMode
      : (leftNotch !== 4 || rightNotch !== 4);

    validLevels.push({
      targetLeft,
      targetRight,
      inventory,
      leftNotch,
      rightNotch,
      leverMode,
      customInstruction: typeof raw.instruction === 'string' && raw.instruction.trim().length > 0 ? raw.instruction.trim() : undefined
    });
  }

  return validLevels.length > 0 ? validLevels : null;
}

export class BalanceScaleGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private t!: Translations;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Level state
  private levels: Level[] = [];
  private currentLevelIndex = 0;
  private leftWeights: MetricWeight[] = [];
  private rightWeights: MetricWeight[] = [];
  private inventory: MetricWeight[] = [];
  private leftNotch: 1 | 2 | 3 | 4 = 4;
  private rightNotch: 1 | 2 | 3 | 4 = 4;
  private leverMode = false;
  private score = 0;
  private streak = 0;
  private startTime = 0;

  // Physics state
  private angle = 0;
  private angularVelocity = 0;
  private balancedTimer = 0;
  private isLevelComplete = false;

  private initLevels(): Level[] {
    if (this.context.customLevels) {
      const parsed = parseCustomLevels(this.context.customLevels);
      if (parsed && parsed.length > 0) {
        return parsed;
      }
    }
    return generateLevelsForAge(this.context.ageGroup);
  }

  // Interaction
  private draggedWeight: MetricWeight | null = null;
  private dragStartPos = { x: 0, y: 0 };
  private hasDraggedBeyondThreshold = false;
  private hoveredRightWeightIndex: number = -1;
  private hoveredRightNotch: number = -1;
  private isDraggingRightNotch = false;
  private isHoveringRightLever = false;
  private mousePos = { x: 0, y: 0 };

  private getNotchFromPointer(pos: { x: number; y: number }): 1 | 2 | 3 | 4 {
    const { centerX, centerY, beamLength } = this.getDimensions();
    const half = beamLength / 2;
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const localX = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
    const ratio = localX / half;
    const rounded = Math.round(ratio * 4);
    return Math.max(1, Math.min(4, rounded)) as 1 | 2 | 3 | 4;
  }

  mount(container: HTMLElement, context: GameContext) {
    this.container = container;
    this.context = context;
    this.t = getTranslations(context.locale);
    sound.enabled = context.sound;

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 25%, #1e293b, #090d16); color: #f8fafc; font-family: inherit;">
        <!-- Top HUD -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 800; font-size: 1.15rem; color: #38bdf8; letter-spacing: -0.02em;" id="hud-title">${this.t.title}</span>
            <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 3px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;"></span>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div id="instruction" style="font-size: 0.92rem; color: #cbd5e1; font-weight: 500; max-width: 480px; text-align: center;"></div>
            <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.1rem;">⭐ 0</div>
            <button id="btn-sound-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 5px 10px; border-radius: 8px; font-size: 0.8rem; cursor: pointer;">${sound.enabled ? this.t.soundOn : this.t.soundOff}</button>
          </div>
        </div>

        <!-- Interactive Notch Selector Toolbar (Ages 9-11 Lever Mode) -->
        <div id="notch-selector-row" style="display: none; align-items: center; justify-content: center; gap: 12px; padding: 6px 16px; background: rgba(15, 23, 42, 0.85); border-bottom: 1px solid rgba(255,255,255,0.06); z-index: 10;">
          <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;" id="hud-hook-label">${this.t.rightHookLabel}</span>
          <div style="display: flex; gap: 8px;" id="notch-button-group">
            <button class="btn-notch" data-notch="1" style="min-width: 48px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.15s;">Notch 1</button>
            <button class="btn-notch" data-notch="2" style="min-width: 48px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.15s;">Notch 2</button>
            <button class="btn-notch" data-notch="3" style="min-width: 48px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.15s;">Notch 3</button>
            <button class="btn-notch" data-notch="4" style="min-width: 48px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #cbd5e1; cursor: pointer; transition: all 0.15s;">Notch 4</button>
          </div>
        </div>

        <!-- Interactive Canvas Area -->
        <div id="canvas-wrapper" style="flex: 1; position: relative; overflow: hidden; touch-action: none;">
          <canvas id="balance-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Inventory Tray at Bottom -->
        <div style="padding: 14px 24px 18px; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 680px; margin: 0 auto; gap: 16px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;" id="hud-weights-label">${this.t.yourWeights}</span>
            <div id="inventory-tray" style="display: flex; gap: 12px; align-items: center; justify-content: center; min-height: 52px; flex-wrap: wrap;"></div>
            <button id="btn-reset" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 6px 14px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600;">${this.t.reset}</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#balance-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupResize();
    this.setupEvents();
    this.setAgeGroup(context.ageGroup);
  }

  private setupResize() {
    const wrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;
    this.resizeObserver = new ResizeObserver(() => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
    });
    this.resizeObserver.observe(wrapper);
  }

  private setRightNotch(n: 1 | 2 | 3 | 4) {
    if (this.rightNotch === n) return;
    this.rightNotch = n;
    sound.playPop();
    this.updateNotchButtonsUI();
    this.updateInstructionText();
  }

  private updateNotchButtonsUI() {
    const row = this.container.querySelector('#notch-selector-row') as HTMLElement;
    if (!row) return;
    row.style.display = this.leverMode ? 'flex' : 'none';

    const buttons = this.container.querySelectorAll('.btn-notch');
    buttons.forEach((btn) => {
      const notchNum = Number(btn.getAttribute('data-notch'));
      const htmlBtn = btn as HTMLButtonElement;
      if (notchNum === this.rightNotch) {
        htmlBtn.style.background = '#fbbf24';
        htmlBtn.style.color = '#0f172a';
        htmlBtn.style.borderColor = '#f59e0b';
        htmlBtn.style.boxShadow = '0 0 12px rgba(251, 191, 36, 0.4)';
        htmlBtn.textContent = `✓ Notch ${notchNum}`;
      } else {
        htmlBtn.style.background = '#1e293b';
        htmlBtn.style.color = '#cbd5e1';
        htmlBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        htmlBtn.style.boxShadow = 'none';
        htmlBtn.textContent = `Notch ${notchNum}`;
      }
    });
  }

  private updateInstructionText() {
    const instruction = this.container.querySelector('#instruction');
    if (instruction && this.levels[this.currentLevelIndex]) {
      instruction.textContent = this.getLevelInstruction(this.levels[this.currentLevelIndex]);
    }
  }

  private setupEvents() {
    const wrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;

    const getPos = (e: MouseEvent | Touch) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    // Notch buttons click
    const notchButtons = this.container.querySelectorAll('.btn-notch');
    notchButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.getAttribute('data-notch')) as 1 | 2 | 3 | 4;
        if (n >= 1 && n <= 4) {
          this.setRightNotch(n);
        }
      });
    });

    const handlePointerDown = (pos: { x: number; y: number }) => {
      this.mousePos = pos;

      // 1. Click on a specific stacked weight in the right pan to remove that exact weight
      const hitIdx = this.getHitRightWeightIndex(pos);
      if (hitIdx !== -1) {
        const [removed] = this.rightWeights.splice(hitIdx, 1);
        this.inventory.push(removed);
        this.hoveredRightWeightIndex = -1;
        sound.playPop();
        this.renderInventory();
        return;
      }

      // 2. In Lever Mode, check drag / stick interaction on right lever
      if (this.leverMode) {
        const { centerX, centerY, beamLength } = this.getDimensions();
        const half = beamLength / 2;
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        const localX = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const localY = -dx * Math.sin(this.angle) + dy * Math.cos(this.angle);

        // Near right arm of the beam (from fulcrum to slightly beyond notch 4)
        const isNearRightBeam = localX >= 10 && localX <= half + 40 && Math.abs(localY) <= 45;

        // Near current active right hook / attachment ring
        const activeHook = this.getNotchPosition('right', this.rightNotch);
        const isNearActiveHook = Math.hypot(pos.x - activeHook.x, pos.y - activeHook.y) <= 44;

        // Near right pan base / cords
        const rightPan = this.getRightPanCenter();
        const isNearRightPan = Math.hypot(pos.x - rightPan.x, pos.y - rightPan.y) <= 60;

        // Near any notch anchor
        let isNearAnyNotch = false;
        for (const n of [1, 2, 3, 4] as const) {
          const anchor = this.getNotchPosition('right', n);
          if (Math.hypot(pos.x - anchor.x, pos.y - anchor.y) <= 38) {
            isNearAnyNotch = true;
            break;
          }
        }

        if (isNearRightBeam || isNearActiveHook || isNearRightPan || isNearAnyNotch) {
          this.isDraggingRightNotch = true;
          const targetNotch = this.getNotchFromPointer(pos);
          if (targetNotch !== this.rightNotch) {
            this.setRightNotch(targetNotch);
          }
          return;
        }
      }
    };

    const handlePointerMove = (pos: { x: number; y: number }) => {
      this.mousePos = pos;

      // Handle active lever notch drag stickily along the bar
      if (this.isDraggingRightNotch) {
        const targetNotch = this.getNotchFromPointer(pos);
        if (targetNotch !== this.rightNotch) {
          this.setRightNotch(targetNotch);
        }
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (this.draggedWeight !== null && !this.hasDraggedBeyondThreshold) {
        if (Math.hypot(pos.x - this.dragStartPos.x, pos.y - this.dragStartPos.y) > 8) {
          this.hasDraggedBeyondThreshold = true;
        }
      }

      this.hoveredRightWeightIndex = this.draggedWeight === null ? this.getHitRightWeightIndex(pos) : -1;

      // Check hover on right notches / beam lever
      let foundNotch = -1;
      let isHoveringLever = false;

      if (this.leverMode && this.draggedWeight === null) {
        const { centerX, centerY, beamLength } = this.getDimensions();
        const half = beamLength / 2;
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        const localX = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const localY = -dx * Math.sin(this.angle) + dy * Math.cos(this.angle);

        const isNearRightBeam = localX >= 10 && localX <= half + 35 && Math.abs(localY) <= 45;
        const activeHook = this.getNotchPosition('right', this.rightNotch);
        const isNearActiveHook = Math.hypot(pos.x - activeHook.x, pos.y - activeHook.y) <= 42;

        if (isNearRightBeam || isNearActiveHook) {
          isHoveringLever = true;
        }

        for (const n of [1, 2, 3, 4] as const) {
          const anchor = this.getNotchPosition('right', n);
          if (Math.hypot(pos.x - anchor.x, pos.y - anchor.y) < 38) {
            foundNotch = n;
            break;
          }
        }
      }

      this.hoveredRightNotch = foundNotch;
      this.isHoveringRightLever = isHoveringLever;

      if (this.hoveredRightWeightIndex !== -1) {
        this.canvas.style.cursor = 'pointer';
      } else if (isHoveringLever || this.hoveredRightNotch !== -1) {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    };

    const handlePointerUp = () => {
      if (this.isDraggingRightNotch) {
        this.isDraggingRightNotch = false;
        sound.playDrop();
      }

      if (this.draggedWeight !== null) {
        if (!this.hasDraggedBeyondThreshold) {
          // Quick click on available weight -> adds to right pan
          this.rightWeights.push(this.draggedWeight);
          sound.playDrop();
        } else {
          // Dragged weight -> check if dropped onto a notch or pan
          let droppedOnNotch = false;
          if (this.leverMode) {
            for (const n of [1, 2, 3, 4] as const) {
              const anchor = this.getNotchPosition('right', n);
              if (Math.hypot(this.mousePos.x - anchor.x, this.mousePos.y - anchor.y) < 42) {
                this.setRightNotch(n);
                this.rightWeights.push(this.draggedWeight);
                sound.playDrop();
                droppedOnNotch = true;
                break;
              }
            }
          }

          if (!droppedOnNotch) {
            const rightPan = this.getRightPanCenter();
            const dist = Math.hypot(this.mousePos.x - rightPan.x, this.mousePos.y - rightPan.y);

            if (dist < 90) {
              this.rightWeights.push(this.draggedWeight);
              sound.playDrop();
            } else {
              this.inventory.push(this.draggedWeight);
            }
          }
        }

        this.draggedWeight = null;
        this.hasDraggedBeyondThreshold = false;
        this.renderInventory();
      }
    };

    wrapper.addEventListener('mousedown', (e) => handlePointerDown(getPos(e)));
    window.addEventListener('mousemove', (e) => handlePointerMove(getPos(e)));
    window.addEventListener('mouseup', handlePointerUp);

    wrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) handlePointerDown(getPos(e.touches[0]));
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) handlePointerMove(getPos(e.touches[0]));
    }, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    const soundBtn = this.container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
    soundBtn?.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      soundBtn.textContent = sound.enabled ? this.t.soundOn : this.t.soundOff;
    });

    const resetBtn = this.container.querySelector('#btn-reset') as HTMLButtonElement;
    resetBtn?.addEventListener('click', () => {
      this.levels = this.initLevels();
      this.loadLevel(0);
      sound.playPop();
    });
  }

  private setAgeGroup(age: string) {
    this.context.ageGroup = (age as GameContext['ageGroup']) || '6-8';
    this.levels = this.initLevels();
    this.loadLevel(0);
  }

  private getLevelInstruction(lvl: Level): string {
    if (lvl.customInstruction) {
      return lvl.customInstruction;
    }
    const leftSum = lvl.targetLeft.reduce((a, b) => a + b.grams, 0);
    const rightStartSum = lvl.targetRight.reduce((a, b) => a + b.grams, 0);
    const leftDesc = lvl.targetLeft.map((w) => w.label).join(' + ');

    if (lvl.leverMode) {
      return this.t.formatLeverInstruction(leftSum, lvl.leftNotch, leftSum * lvl.leftNotch, this.rightNotch);
    }
    return this.t.formatStandardInstruction(leftDesc, leftSum, rightStartSum);
  }

  private loadLevel(index: number) {
    this.currentLevelIndex = index;
    const lvl = this.levels[index];
    this.leftWeights = lvl.targetLeft.map((w) => ({ ...w }));
    this.rightWeights = lvl.targetRight.map((w) => ({ ...w }));
    this.inventory = lvl.inventory.map((w) => ({ ...w }));
    this.leftNotch = lvl.leftNotch || 4;
    this.rightNotch = lvl.rightNotch || 4;
    this.leverMode = !!lvl.leverMode;
    this.isDraggingRightNotch = false;
    this.isHoveringRightLever = false;
    this.isLevelComplete = false;
    this.balancedTimer = 0;
    this.angle = 0;
    this.angularVelocity = 0;

    const badge = this.container.querySelector('#level-badge');
    if (badge) badge.textContent = `${this.t.level} ${index + 1}/${this.levels.length}`;

    this.updateNotchButtonsUI();
    this.updateInstructionText();

    this.renderInventory();
    this.context.emit('game:progress', {
      step: index + 1,
      total: this.levels.length,
      detail: this.getLevelInstruction(lvl)
    });
  }

  private renderInventory() {
    const tray = this.container.querySelector('#inventory-tray');
    if (!tray) return;

    tray.innerHTML = '';
    this.inventory.forEach((item, idx) => {
      const btn = document.createElement('div');
      const isKg = item.grams >= 1000;
      btn.style.cssText = `
        min-width: 52px;
        height: 50px;
        padding: 0 10px;
        border-radius: 12px;
        background: ${item.color};
        color: #ffffff;
        font-weight: 800;
        font-size: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
        border: ${isKg ? '2px solid #fef08a' : '1px solid rgba(255,255,255,0.2)'};
      `;
      btn.innerHTML = `
        <span>${item.label}</span>
        <span style="font-size: 0.65rem; opacity: 0.85; font-weight: 600;">${item.grams}g</span>
      `;

      btn.addEventListener('mouseenter', () => (btn.style.transform = 'scale(1.08)'));
      btn.addEventListener('mouseleave', () => (btn.style.transform = 'scale(1)'));

      const startDrag = (clientX: number, clientY: number) => {
        const rect = this.canvas.getBoundingClientRect();
        const pos = { x: clientX - rect.left, y: clientY - rect.top };
        this.mousePos = pos;
        this.dragStartPos = { ...pos };
        this.hasDraggedBeyondThreshold = false;
        this.draggedWeight = item;
        this.inventory.splice(idx, 1);
        sound.playPop();
        this.renderInventory();
      };

      btn.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      });

      tray.appendChild(btn);
    });
  }

  start() {
    this.startTime = Date.now();
    this.loop();
  }

  private loop = () => {
    this.updatePhysics();
    this.draw();
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private getDimensions() {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      centerX: rect.width / 2,
      centerY: rect.height * 0.38,
      beamLength: Math.min(rect.width * 0.76, 480)
    };
  }

  private getNotchPosition(side: 'left' | 'right', notch: 1 | 2 | 3 | 4) {
    const { centerX, centerY, beamLength } = this.getDimensions();
    const half = beamLength / 2;
    const ratio = (notch / 4) * (side === 'left' ? -1 : 1);
    const dist = half * ratio;
    return {
      x: centerX + dist * Math.cos(this.angle),
      y: centerY + dist * Math.sin(this.angle)
    };
  }

  private getLeftPanCenter() {
    const rect = this.canvas.getBoundingClientRect();
    const anchor = this.getNotchPosition('left', this.leftNotch);
    const panY = Math.min(anchor.y + 68, rect.height - 44);
    return { x: anchor.x, y: panY, anchorX: anchor.x, anchorY: anchor.y };
  }

  private getRightPanCenter() {
    const rect = this.canvas.getBoundingClientRect();
    const anchor = this.getNotchPosition('right', this.rightNotch);
    const panY = Math.min(anchor.y + 68, rect.height - 44);
    return { x: anchor.x, y: panY, anchorX: anchor.x, anchorY: anchor.y };
  }

  private getHitRightWeightIndex(pos: { x: number; y: number }): number {
    const rightPan = this.getRightPanCenter();
    for (let i = this.rightWeights.length - 1; i >= 0; i--) {
      const blockX = rightPan.x;
      const blockY = rightPan.y - 22 - i * 38;
      if (Math.abs(pos.x - blockX) <= 26 && Math.abs(pos.y - blockY) <= 18) {
        return i;
      }
    }
    return -1;
  }

  private calculateTorque() {
    const leftGrams = this.leftWeights.reduce((acc, w) => acc + w.grams, 0);
    const rightGrams = this.rightWeights.reduce((acc, w) => acc + w.grams, 0);
    const leftTorque = leftGrams * this.leftNotch;
    const rightTorque = rightGrams * this.rightNotch;
    return { leftGrams, rightGrams, leftTorque, rightTorque };
  }

  private updatePhysics() {
    const { leftGrams, leftTorque, rightTorque } = this.calculateTorque();

    const torqueDiff = rightTorque - leftTorque;
    const maxAngle = 0.35;
    const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, torqueDiff * 0.00025));

    const spring = 0.08;
    const damping = 0.88;
    const force = (targetAngle - this.angle) * spring;
    this.angularVelocity = (this.angularVelocity + force) * damping;
    this.angle += this.angularVelocity;

    const isBalanced = leftGrams > 0 && leftTorque === rightTorque;

    if (isBalanced && Math.abs(this.angle) < 0.02 && Math.abs(this.angularVelocity) < 0.005) {
      this.balancedTimer++;
      if (this.balancedTimer > 45 && !this.isLevelComplete) {
        this.handleLevelWin();
      }
    } else {
      this.balancedTimer = 0;
    }
  }

  private handleLevelWin() {
    this.isLevelComplete = true;
    sound.playSuccess();

    this.score += 100;
    this.streak++;
    const scoreDisplay = this.container.querySelector('#score-display');
    if (scoreDisplay) scoreDisplay.textContent = `⭐ ${this.score}`;

    this.context.emit('game:score', {
      points: this.score,
      streak: this.streak,
      delta: 100
    });

    confetti({
      particleCount: 55,
      spread: 65,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
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
        setTimeout(() => {
          this.levels = this.initLevels();
          this.loadLevel(0);
        }, 1800);
      }
    }, 1500);
  }

  private draw() {
    const { width, height, centerX, centerY, beamLength } = this.getDimensions();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 1. Fulcrum Pedestal
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(centerX - 16, centerY);
    ctx.lineTo(centerX + 16, centerY);
    ctx.lineTo(centerX + 34, height);
    ctx.lineTo(centerX - 34, height);
    ctx.closePath();
    ctx.fill();

    // Pivot Pin
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Rotating Beam & Numbered Notches (1, 2, 3, 4)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    const half = beamLength / 2;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-half, -7, beamLength, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-half, -2, beamLength, 4);

    // If Lever Mode, draw prominent slider track slot on the right arm
    if (this.leverMode) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, -2, half, 4);
      // Subtle slide groove border
      ctx.strokeStyle = this.isDraggingRightNotch ? '#fbbf24' : 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(half * 0.2 - 6, -5, half * 0.8 + 12, 10);
    }

    // Draw notches 1..4 on left and right
    for (const n of [1, 2, 3, 4] as const) {
      const leftX = -half * (n / 4);
      const rightX = half * (n / 4);

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(leftX - 1, -7, 2, 14);
      ctx.fillRect(rightX - 1, -7, 2, 14);

      // Notch numbers above beam inside circular pill
      const isLeftActive = this.leftNotch === n;
      const isRightActive = this.rightNotch === n;
      const isRightHovered = this.hoveredRightNotch === n || (this.isHoveringRightLever && isRightActive);

      // Left pill
      ctx.fillStyle = isLeftActive ? '#0284c7' : 'rgba(30, 41, 59, 0.8)';
      ctx.beginPath();
      ctx.arc(leftX, -16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isLeftActive ? '#ffffff' : '#94a3b8';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), leftX, -16);

      // Right pill (interactive with sticky drag feedback)
      const isStickLocked = isRightActive && this.isDraggingRightNotch;
      const pillRadius = isStickLocked ? 12 : (isRightActive || isRightHovered) ? 10.5 : 9;
      ctx.fillStyle = isRightActive ? '#f59e0b' : isRightHovered ? '#334155' : 'rgba(30, 41, 59, 0.8)';
      ctx.beginPath();
      ctx.arc(rightX, -16, pillRadius, 0, Math.PI * 2);
      ctx.fill();
      if (isRightHovered || isRightActive) {
        ctx.strokeStyle = isStickLocked ? '#ffffff' : '#fbbf24';
        ctx.lineWidth = isStickLocked ? 2.5 : 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = isRightActive ? '#0f172a' : '#f8fafc';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), rightX, -16);
    }

    // Active Attachment Eyelets at actual notch positions
    const leftAnchorLocalX = -half * (this.leftNotch / 4);
    const rightAnchorLocalX = half * (this.rightNotch / 4);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(leftAnchorLocalX, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // Right Eyelet: Interactive Hook Ring that sticks/drags along the bar
    const isLeverDragging = this.isDraggingRightNotch;
    const isLeverHovered = this.isHoveringRightLever || this.hoveredRightNotch !== -1;

    ctx.save();
    if (this.leverMode && isLeverDragging) {
      // Magnetic sticky glow ring
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.beginPath();
      ctx.arc(rightAnchorLocalX, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isLeverDragging ? '#f59e0b' : isLeverHovered ? '#fde047' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(rightAnchorLocalX, 0, isLeverDragging ? 10.5 : isLeverHovered ? 9.5 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isLeverDragging ? 2.5 : 1.5;
    ctx.stroke();

    // Slider pin hole
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rightAnchorLocalX, 0, isLeverDragging ? 3.5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // 3. Left & Right Pans
    const leftPan = this.getLeftPanCenter();
    const rightPan = this.getRightPanCenter();

    const { leftGrams, rightGrams } = this.calculateTorque();

    this.drawHangingPan(
      leftPan.anchorX,
      leftPan.anchorY,
      leftPan.x,
      leftPan.y,
      this.leftWeights,
      '#38bdf8',
      leftGrams,
      this.leftNotch,
      -1
    );
    this.drawHangingPan(
      rightPan.anchorX,
      rightPan.anchorY,
      rightPan.x,
      rightPan.y,
      this.rightWeights,
      '#fbbf24',
      rightGrams,
      this.rightNotch,
      this.hoveredRightWeightIndex
    );

    // 4. Cursor Dragged Weight
    if (this.draggedWeight !== null && this.hasDraggedBeyondThreshold) {
      this.drawWeightBlock(this.mousePos.x, this.mousePos.y, this.draggedWeight, true, false);
    }
  }

  private drawHangingPan(
    anchorX: number,
    anchorY: number,
    panX: number,
    panY: number,
    weights: MetricWeight[],
    accentColor: string,
    totalGrams: number,
    notch: number,
    hoveredIndex: number
  ) {
    const ctx = this.ctx;
    const panWidth = 116;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(panX - panWidth / 2 + 10, panY);
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(panX + panWidth / 2 - 10, panY);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(panX - panWidth / 2, panY, panWidth, 14, [0, 0, 8, 8]);
    ctx.fill();
    ctx.stroke();

    let currentY = panY - 4;
    weights.forEach((w, idx) => {
      this.drawWeightBlock(panX, currentY - 18, w, false, idx === hoveredIndex);
      currentY -= 38;
    });

    let displayLabel: string;
    let badgeWidth = 76;
    if (this.leverMode) {
      displayLabel = `${totalGrams}g × ${notch} = ${totalGrams * notch}`;
      badgeWidth = 118;
    } else {
      const isKg = totalGrams >= 1000;
      displayLabel = isKg
        ? `${(totalGrams / 1000).toLocaleString(this.context.locale || 'en', { maximumFractionDigits: 2 })} kg`
        : `${totalGrams} g`;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(panX - badgeWidth / 2, panY + 16, badgeWidth, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLabel, panX, panY + 27);
  }

  private drawWeightBlock(x: number, y: number, item: MetricWeight, isDragging: boolean, isHovered: boolean) {
    const ctx = this.ctx;
    const width = 50;
    const height = 34;

    ctx.save();
    ctx.translate(x, y);
    if (isDragging) {
      ctx.scale(1.15, 1.15);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 8;
    } else if (isHovered) {
      ctx.scale(1.06, 1.06);
    }

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 7);
    ctx.fill();

    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, 0, 0);

    ctx.restore();
  }

  updateConfig(newContext: Partial<GameContext>) {
    let reloadLevels = false;
    if (newContext.sound !== undefined) {
      sound.enabled = newContext.sound;
    }
    if (newContext.locale !== undefined) {
      this.context.locale = newContext.locale;
      this.t = getTranslations(newContext.locale);
      const hudTitle = this.container.querySelector('#hud-title');
      if (hudTitle) hudTitle.textContent = this.t.title;
      const soundBtn = this.container.querySelector('#btn-sound-toggle');
      if (soundBtn) soundBtn.textContent = sound.enabled ? this.t.soundOn : this.t.soundOff;
      const weightsLabel = this.container.querySelector('#hud-weights-label');
      if (weightsLabel) weightsLabel.textContent = this.t.yourWeights;
      const hookLabel = this.container.querySelector('#hud-hook-label');
      if (hookLabel) hookLabel.textContent = this.t.rightHookLabel;
      const resetBtn = this.container.querySelector('#btn-reset');
      if (resetBtn) resetBtn.textContent = this.t.reset;

      this.updateInstructionText();
      const badge = this.container.querySelector('#level-badge');
      if (badge) badge.textContent = `${this.t.level} ${this.currentLevelIndex + 1}/${this.levels.length}`;
    }
    if (newContext.ageGroup !== undefined && newContext.ageGroup !== this.context.ageGroup) {
      this.context.ageGroup = newContext.ageGroup;
      reloadLevels = true;
    }
    if ('customLevels' in newContext && newContext.customLevels !== this.context.customLevels) {
      this.context.customLevels = newContext.customLevels;
      reloadLevels = true;
    }
    if (reloadLevels) {
      this.levels = this.initLevels();
      this.loadLevel(0);
    }
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    sound.close();
  }
}

export function createBalanceScaleGame(): KidGame {
  return new BalanceScaleGame();
}

export const createGame = createBalanceScaleGame;
export default createBalanceScaleGame;
