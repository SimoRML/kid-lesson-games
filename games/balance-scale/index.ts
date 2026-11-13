import confetti from 'canvas-confetti';
import type { GameContext, KidGame } from '../../src/core/types.js';
import { sound } from './audio.js';

interface Level {
  targetLeft: number[];
  targetRight: number[];
  inventory: number[];
  message: string;
}

const LEVELS: Level[] = [
  {
    targetLeft: [3],
    targetRight: [],
    inventory: [1, 2, 3],
    message: 'Make the scale even! Balance the number 3.'
  },
  {
    targetLeft: [5],
    targetRight: [2],
    inventory: [1, 2, 3, 4],
    message: 'What number plus 2 equals 5?'
  },
  {
    targetLeft: [4, 4],
    targetRight: [3],
    inventory: [2, 4, 5],
    message: 'Left side is 4 + 4 = 8. Balance the right side!'
  }
];

export class BalanceScaleGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Level state
  private currentLevelIndex = 0;
  private leftWeights: number[] = [];
  private rightWeights: number[] = [];
  private inventory: number[] = [];
  private score = 0;
  private streak = 0;
  private startTime = 0;

  // Physics state
  private angle = 0; // beam rotation in radians
  private angularVelocity = 0;
  private balancedTimer = 0;
  private isLevelComplete = false;

  // Interaction
  private draggedWeight: number | null = null;
  private mousePos = { x: 0, y: 0 };

  mount(container: HTMLElement, context: GameContext) {
    this.container = container;
    this.context = context;
    sound.enabled = context.sound;

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 30%, #1e293b, #0f172a); color: #f8fafc; font-family: inherit;">
        <!-- Top HUD -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 800; font-size: 1.1rem; color: #38bdf8; letter-spacing: -0.02em;">⚖️ Balance Lab</span>
            <span id="level-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 10px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;">Level 1/3</span>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div id="instruction" style="font-size: 0.95rem; color: #cbd5e1; font-weight: 500;"></div>
            <div id="score-display" style="font-weight: 700; color: #fbbf24; font-size: 1.1rem;">⭐ 0</div>
          </div>
        </div>

        <!-- Interactive Canvas Area -->
        <div id="canvas-wrapper" style="flex: 1; position: relative; overflow: hidden; touch-action: none;">
          <canvas id="balance-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Inventory / Tray at Bottom -->
        <div style="padding: 16px 24px 20px; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); border-top: 1px solid rgba(255,255,255,0.08); z-index: 10;">
          <div style="display: flex; align-items: center; justify-content: space-between; max-width: 600px; margin: 0 auto; gap: 16px;">
            <span style="font-size: 0.85rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Your Weights</span>
            <div id="inventory-tray" style="display: flex; gap: 12px; align-items: center; justify-content: center; min-height: 52px;"></div>
            <button id="btn-reset" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; transition: background 0.2s;">Reset</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#balance-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupResize();
    this.setupEvents();
    this.loadLevel(0);
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

      // Check click on right pan weights to return them to inventory
      const rightPan = this.getRightPanCenter();
      const dist = Math.hypot(pos.x - rightPan.x, pos.y - (rightPan.y - 30));
      if (dist < 40 && this.rightWeights.length > 0) {
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
        const rightPan = this.getRightPanCenter();
        const dist = Math.hypot(this.mousePos.x - rightPan.x, this.mousePos.y - rightPan.y);

        if (dist < 80) {
          // Dropped on right pan!
          this.rightWeights.push(this.draggedWeight);
          sound.playDrop();
        } else {
          // Returned to inventory
          this.inventory.push(this.draggedWeight);
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

    const resetBtn = this.container.querySelector('#btn-reset') as HTMLButtonElement;
    resetBtn?.addEventListener('click', () => {
      this.loadLevel(this.currentLevelIndex);
      sound.playPop();
    });
  }

  private loadLevel(index: number) {
    this.currentLevelIndex = index;
    const lvl = LEVELS[index];
    this.leftWeights = [...lvl.targetLeft];
    this.rightWeights = [...lvl.targetRight];
    this.inventory = [...lvl.inventory];
    this.isLevelComplete = false;
    this.balancedTimer = 0;

    const badge = this.container.querySelector('#level-badge');
    if (badge) badge.textContent = `Level ${index + 1}/${LEVELS.length}`;

    const instruction = this.container.querySelector('#instruction');
    if (instruction) instruction.textContent = lvl.message;

    this.renderInventory();
    this.context.emit('game:progress', {
      step: index + 1,
      total: LEVELS.length,
      detail: lvl.message
    });
  }

  private renderInventory() {
    const tray = this.container.querySelector('#inventory-tray');
    if (!tray) return;

    tray.innerHTML = '';
    this.inventory.forEach((val, idx) => {
      const btn = document.createElement('div');
      btn.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #38bdf8, #2563eb);
        color: white;
        font-weight: 800;
        font-size: 1.25rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
        cursor: grab;
        user-select: none;
        transition: transform 0.15s, box-shadow 0.15s;
      `;
      btn.innerHTML = `
        <span>${val}</span>
        <div style="display: flex; gap: 2px; margin-top: 2px;">
          ${Array(Math.min(val, 5)).fill('<div style="width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.7);"></div>').join('')}
        </div>
      `;

      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.08)');
      btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');

      // Tap to place or drag
      const startDrag = () => {
        this.draggedWeight = val;
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
      centerY: rect.height * 0.48,
      beamLength: Math.min(rect.width * 0.72, 440)
    };
  }

  private getLeftPanCenter() {
    const { centerX, centerY, beamLength } = this.getDimensions();
    const half = beamLength / 2;
    const x = centerX - half * Math.cos(this.angle);
    const y = centerY - half * Math.sin(this.angle);
    return { x, y: y + 90 };
  }

  private getRightPanCenter() {
    const { centerX, centerY, beamLength } = this.getDimensions();
    const half = beamLength / 2;
    const x = centerX + half * Math.cos(this.angle);
    const y = centerY + half * Math.sin(this.angle);
    return { x, y: y + 90 };
  }

  private updatePhysics() {
    const leftSum = this.leftWeights.reduce((a, b) => a + b, 0);
    const rightSum = this.rightWeights.reduce((a, b) => a + b, 0);

    // Target angle based on mass difference
    const diff = rightSum - leftSum; // positive tilts right
    const maxAngle = 0.35; // radians (~20 deg)
    const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, diff * 0.12));

    // Spring-damper physics
    const spring = 0.08;
    const damping = 0.88;
    const force = (targetAngle - this.angle) * spring;
    this.angularVelocity = (this.angularVelocity + force) * damping;
    this.angle += this.angularVelocity;

    // Check for equilibrium
    if (leftSum > 0 && leftSum === rightSum && Math.abs(this.angle) < 0.02 && Math.abs(this.angularVelocity) < 0.005) {
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
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
      if (this.currentLevelIndex + 1 < LEVELS.length) {
        this.loadLevel(this.currentLevelIndex + 1);
      } else {
        // Game Completed!
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        this.context.emit('game:complete', {
          stars: 3,
          score: this.score,
          timeElapsed: elapsed,
          summary: 'Mastered balance and addition!'
        });
      }
    }, 1400);
  }

  private draw() {
    const { width, height, centerX, centerY, beamLength } = this.getDimensions();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 1. Pedestal / Stand
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(centerX - 16, centerY);
    ctx.lineTo(centerX + 16, centerY);
    ctx.lineTo(centerX + 32, centerY + 140);
    ctx.lineTo(centerX - 32, centerY + 140);
    ctx.closePath();
    ctx.fill();

    // Fulcrum Pivot Pin
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Rotating Beam
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    // Beam Bar
    const half = beamLength / 2;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-half, -6, beamLength, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-half, -2, beamLength, 4);

    // Left & Right Pivot Eyelets
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(-half, 0, 7, 0, Math.PI * 2);
    ctx.arc(half, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Hanging Strings and Pans
    const leftPan = this.getLeftPanCenter();
    const rightPan = this.getRightPanCenter();

    this.drawHangingPan(centerX - half * Math.cos(this.angle), centerY - half * Math.sin(this.angle), leftPan.x, leftPan.y, this.leftWeights, '#38bdf8', 'Left');
    this.drawHangingPan(centerX + half * Math.cos(this.angle), centerY + half * Math.sin(this.angle), rightPan.x, rightPan.y, this.rightWeights, '#fbbf24', 'Right');

    // 4. Dragged weight following cursor
    if (this.draggedWeight !== null) {
      this.drawWeightBlock(this.mousePos.x, this.mousePos.y, this.draggedWeight, '#2563eb', true);
    }
  }

  private drawHangingPan(anchorX: number, anchorY: number, panX: number, panY: number, weights: number[], accentColor: string, _label: string) {
    const ctx = this.ctx;
    const panWidth = 110;

    // Strings
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

    // Weights sitting in the pan
    let currentY = panY - 4;
    weights.forEach((w) => {
      this.drawWeightBlock(panX, currentY - 18, w, accentColor, false);
      currentY -= 38;
    });

    // Sum Badge below Pan
    const sum = weights.reduce((a, b) => a + b, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(panX - 28, panY + 20, 56, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${sum}`, panX, panY + 32);
  }

  private drawWeightBlock(x: number, y: number, value: number, color: string, isDragging: boolean) {
    const ctx = this.ctx;
    const size = 36;

    ctx.save();
    ctx.translate(x, y);
    if (isDragging) {
      ctx.scale(1.15, 1.15);
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 8);
    ctx.fill();

    // Value text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 0, 0);

    ctx.restore();
  }

  updateConfig(newContext: Partial<GameContext>) {
    if (newContext.sound !== undefined) {
      sound.enabled = newContext.sound;
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
