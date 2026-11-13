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
  instructionKey: keyof Translations['instructions'];
  leftNotch?: 1 | 2 | 3 | 4;
  rightNotch?: 1 | 2 | 3 | 4;
  leverMode?: boolean;
}

const PALETTE: Record<number, { label: string; color: string }> = {
  50: { label: '50g', color: '#f59e0b' },
  100: { label: '100g', color: '#06b6d4' },
  200: { label: '200g', color: '#3b82f6' },
  250: { label: '250g', color: '#10b981' },
  300: { label: '300g', color: '#8b5cf6' },
  400: { label: '400g', color: '#6366f1' },
  500: { label: '500g', color: '#ec4899' },
  600: { label: '600g', color: '#f97316' },
  1000: { label: '1 kg', color: '#eab308' }
};

function createWeight(grams: number): MetricWeight {
  const p = PALETTE[grams] || { label: `${grams}g`, color: '#6366f1' };
  return {
    id: `${grams}-${Math.random().toString(36).slice(2, 7)}`,
    grams,
    label: p.label,
    color: p.color
  };
}

const AGE_LEVELS: Record<string, Level[]> = {
  '3-5': [
    {
      targetLeft: [createWeight(200)],
      targetRight: [],
      inventory: [createWeight(100), createWeight(100), createWeight(200)],
      instructionKey: 'lvl1_3_5',
      leftNotch: 4,
      rightNotch: 4
    },
    {
      targetLeft: [createWeight(300)],
      targetRight: [createWeight(100)],
      inventory: [createWeight(100), createWeight(200)],
      instructionKey: 'lvl2_3_5',
      leftNotch: 4,
      rightNotch: 4
    }
  ],
  '6-8': [
    {
      targetLeft: [createWeight(1000)],
      targetRight: [],
      inventory: [createWeight(500), createWeight(500), createWeight(250), createWeight(250)],
      instructionKey: 'lvl1_6_8',
      leftNotch: 4,
      rightNotch: 4
    },
    {
      targetLeft: [createWeight(500), createWeight(250)],
      targetRight: [],
      inventory: [createWeight(250), createWeight(500), createWeight(100), createWeight(100)],
      instructionKey: 'lvl2_6_8',
      leftNotch: 4,
      rightNotch: 4
    },
    {
      targetLeft: [createWeight(1000)],
      targetRight: [createWeight(250)],
      inventory: [createWeight(500), createWeight(250), createWeight(200)],
      instructionKey: 'lvl3_6_8',
      leftNotch: 4,
      rightNotch: 4
    }
  ],
  '9-11': [
    {
      // 400g at notch 2 (torque 800) vs 200g at notch 4 (torque 800)
      targetLeft: [createWeight(400)],
      targetRight: [],
      inventory: [createWeight(200), createWeight(300), createWeight(100)],
      instructionKey: 'lvl1_9_11',
      leftNotch: 2,
      rightNotch: 4,
      leverMode: true
    },
    {
      // 600g at notch 2 (torque 1200) -> user can move right pan to notch 3 with 400g, or notch 4 with 300g
      targetLeft: [createWeight(600)],
      targetRight: [],
      inventory: [createWeight(300), createWeight(400), createWeight(200)],
      instructionKey: 'lvl2_9_11',
      leftNotch: 2,
      rightNotch: 3,
      leverMode: true
    },
    {
      // 500g at notch 3 (torque 1500) -> e.g. notch 3 with 500g, or notch 2 with 500g+250g (750*2=1500)
      targetLeft: [createWeight(500)],
      targetRight: [],
      inventory: [createWeight(500), createWeight(250), createWeight(250)],
      instructionKey: 'lvl3_9_11',
      leftNotch: 3,
      rightNotch: 2,
      leverMode: true
    }
  ]
};

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

  // Interaction
  private draggedWeight: MetricWeight | null = null;
  private mousePos = { x: 0, y: 0 };

  mount(container: HTMLElement, context: GameContext) {
    this.container = container;
    this.context = context;
    this.t = getTranslations(context.locale);
    sound.enabled = context.sound;

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 25%, #1e293b, #090d16); color: #f8fafc; font-family: inherit;">
        <!-- Top HUD -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 800; font-size: 1.15rem; color: #38bdf8; letter-spacing: -0.02em;" id="hud-title">${this.t.title}</span>
            <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 3px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;"></span>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div id="instruction" style="font-size: 0.95rem; color: #cbd5e1; font-weight: 500; max-width: 440px; text-align: center;"></div>
            <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.1rem;">⭐ 0</div>
            <button id="btn-sound-toggle" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 5px 10px; border-radius: 8px; font-size: 0.8rem; cursor: pointer;">${sound.enabled ? this.t.soundOn : this.t.soundOff}</button>
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

  private setupEvents() {
    const wrapper = this.container.querySelector('#canvas-wrapper') as HTMLElement;

    const getPos = (e: MouseEvent | Touch) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handlePointerDown = (pos: { x: number; y: number }) => {
      this.mousePos = pos;

      // In Lever Mode (9-11), check if user clicked a right-side notch (1, 2, 3, 4) to move the right pan hook!
      if (this.leverMode) {
        for (const n of [1, 2, 3, 4] as const) {
          const anchor = this.getNotchPosition('right', n);
          if (Math.hypot(pos.x - anchor.x, pos.y - anchor.y) < 22) {
            this.rightNotch = n;
            sound.playPop();
            return;
          }
        }
      }

      // Click on right pan to return top weight to inventory
      const rightPan = this.getRightPanCenter();
      const dist = Math.hypot(pos.x - rightPan.x, pos.y - (rightPan.y - 30));
      if (dist < 48 && this.rightWeights.length > 0) {
        const removed = this.rightWeights.pop()!;
        this.inventory.push(removed);
        sound.playPop();
        this.renderInventory();
      }
    };

    const handlePointerMove = (pos: { x: number; y: number }) => {
      this.mousePos = pos;
    };

    const handlePointerUp = () => {
      if (this.draggedWeight !== null) {
        // Also allow dropping directly onto a right-side notch in leverMode
        let droppedOnNotch = false;
        if (this.leverMode) {
          for (const n of [1, 2, 3, 4] as const) {
            const anchor = this.getNotchPosition('right', n);
            if (Math.hypot(this.mousePos.x - anchor.x, this.mousePos.y - anchor.y) < 36) {
              this.rightNotch = n;
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

        this.draggedWeight = null;
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
      this.loadLevel(this.currentLevelIndex);
      sound.playPop();
    });
  }

  private setAgeGroup(age: string) {
    this.levels = AGE_LEVELS[age] || AGE_LEVELS['6-8'];
    this.loadLevel(0);
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
    this.isLevelComplete = false;
    this.balancedTimer = 0;
    this.angle = 0;
    this.angularVelocity = 0;

    const badge = this.container.querySelector('#level-badge');
    if (badge) badge.textContent = `${this.t.level} ${index + 1}/${this.levels.length}`;

    const instruction = this.container.querySelector('#instruction');
    const msg = this.t.instructions[lvl.instructionKey];
    if (instruction) instruction.textContent = msg;

    this.renderInventory();
    this.context.emit('game:progress', {
      step: index + 1,
      total: this.levels.length,
      detail: msg
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
        cursor: grab;
        user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
        border: ${isKg ? '2px solid #fef08a' : '1px solid rgba(255,255,255,0.2)'};
      `;
      btn.innerHTML = `
        <span>${item.label}</span>
        <span style="font-size: 0.65rem; opacity: 0.85; font-weight: 600;">${item.grams}g</span>
      `;

      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.08)');
      btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');

      const startDrag = () => {
        this.draggedWeight = item;
        this.inventory.splice(idx, 1);
        sound.playPop();
        this.renderInventory();
      };

      btn.addEventListener('mousedown', startDrag);
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrag();
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
      centerY: rect.height * 0.46,
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
    const anchor = this.getNotchPosition('left', this.leftNotch);
    return { x: anchor.x, y: anchor.y + 90, anchorX: anchor.x, anchorY: anchor.y };
  }

  private getRightPanCenter() {
    const anchor = this.getNotchPosition('right', this.rightNotch);
    return { x: anchor.x, y: anchor.y + 90, anchorX: anchor.x, anchorY: anchor.y };
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

    // Torque comparison using actual visible notch positions (1..4)
    const torqueDiff = rightTorque - leftTorque;
    const maxAngle = 0.35;
    const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, torqueDiff * 0.00025));

    const spring = 0.08;
    const damping = 0.88;
    const force = (targetAngle - this.angle) * spring;
    this.angularVelocity = (this.angularVelocity + force) * damping;
    this.angle += this.angularVelocity;

    // Equilibrium condition: Left Torque === Right Torque
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
    ctx.lineTo(centerX + 34, centerY + 145);
    ctx.lineTo(centerX - 34, centerY + 145);
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

    // Draw notches 1..4 on left and right
    for (const n of [1, 2, 3, 4] as const) {
      const leftX = -half * (n / 4);
      const rightX = half * (n / 4);

      // Tick marks
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(leftX - 1, -7, 2, 14);
      ctx.fillRect(rightX - 1, -7, 2, 14);

      // Notch numbers above beam
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.leftNotch === n ? '#38bdf8' : '#94a3b8';
      ctx.fillText(String(n), leftX, -15);

      ctx.fillStyle = this.rightNotch === n ? '#fbbf24' : '#94a3b8';
      ctx.fillText(String(n), rightX, -15);

      // Interactive clickable ring on right-side notches in leverMode
      if (this.leverMode) {
        ctx.beginPath();
        ctx.arc(rightX, 0, this.rightNotch === n ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = this.rightNotch === n ? '#fbbf24' : '#475569';
        ctx.fill();
      }
    }

    // Active Attachment Eyelets at actual notch positions!
    const leftAnchorLocalX = -half * (this.leftNotch / 4);
    const rightAnchorLocalX = half * (this.rightNotch / 4);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(leftAnchorLocalX, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(rightAnchorLocalX, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. Left & Right Pans (hanging from their actual notch positions!)
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
      this.leftNotch
    );
    this.drawHangingPan(
      rightPan.anchorX,
      rightPan.anchorY,
      rightPan.x,
      rightPan.y,
      this.rightWeights,
      '#fbbf24',
      rightGrams,
      this.rightNotch
    );

    // 4. Cursor Dragged Weight
    if (this.draggedWeight !== null) {
      this.drawWeightBlock(this.mousePos.x, this.mousePos.y, this.draggedWeight, true);
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
    notch: number
  ) {
    const ctx = this.ctx;
    const panWidth = 116;

    // Suspension cords attached to the actual notch eyelet
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(panX - panWidth / 2 + 10, panY);
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(panX + panWidth / 2 - 10, panY);
    ctx.stroke();

    // Pan plate
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(panX - panWidth / 2, panY, panWidth, 14, [0, 0, 8, 8]);
    ctx.fill();
    ctx.stroke();

    // Stacked weights inside the pan
    let currentY = panY - 4;
    weights.forEach((w) => {
      this.drawWeightBlock(panX, currentY - 18, w, false);
      currentY -= 38;
    });

    // Metric Total / Torque Indicator below Pan
    let displayLabel: string;
    let badgeWidth = 76;
    if (this.leverMode) {
      displayLabel = `${totalGrams}g × ${notch} = ${totalGrams * notch}`;
      badgeWidth = 114;
    } else {
      const isKg = totalGrams >= 1000;
      displayLabel = isKg
        ? `${(totalGrams / 1000).toLocaleString(this.context.locale || 'en', { maximumFractionDigits: 2 })} kg`
        : `${totalGrams} g`;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(panX - badgeWidth / 2, panY + 20, badgeWidth, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLabel, panX, panY + 32);
  }

  private drawWeightBlock(x: number, y: number, item: MetricWeight, isDragging: boolean) {
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
    }

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 7);
    ctx.fill();

    // Value text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, 0, 0);

    ctx.restore();
  }

  updateConfig(newContext: Partial<GameContext>) {
    if (newContext.sound !== undefined) {
      sound.enabled = newContext.sound;
    }
    if (newContext.locale !== undefined) {
      this.t = getTranslations(newContext.locale);
      const hudTitle = this.container.querySelector('#hud-title');
      if (hudTitle) hudTitle.textContent = this.t.title;
      const soundBtn = this.container.querySelector('#btn-sound-toggle');
      if (soundBtn) soundBtn.textContent = sound.enabled ? this.t.soundOn : this.t.soundOff;
      const weightsLabel = this.container.querySelector('#hud-weights-label');
      if (weightsLabel) weightsLabel.textContent = this.t.yourWeights;
      const resetBtn = this.container.querySelector('#btn-reset');
      if (resetBtn) resetBtn.textContent = this.t.reset;
      this.loadLevel(this.currentLevelIndex);
    }
    if (newContext.ageGroup !== undefined) {
      this.setAgeGroup(newContext.ageGroup);
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
