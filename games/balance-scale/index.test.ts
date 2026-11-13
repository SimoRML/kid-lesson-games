import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext } from '../../src/core/types.js';
import {
  BalanceScaleGame,
  createBalanceScaleGame,
  createWeight,
  findDecompositions,
  generateLevelsForAge,
  parseCustomLevels,
  parseWeightItem
} from './index.js';

describe('Balance Scale Game & Helpers', () => {
  describe('createWeight & parseWeightItem', () => {
    it('creates metric weights with appropriate palette colors and labels', () => {
      const w50 = createWeight(50);
      expect(w50.grams).toBe(50);
      expect(w50.label).toBe('50g');
      expect(w50.color).toBe('#f59e0b');

      const w1000 = createWeight(1000);
      expect(w1000.grams).toBe(1000);
      expect(w1000.label).toBe('1 kg');
      expect(w1000.color).toBe('#eab308');

      const custom = createWeight(350);
      expect(custom.grams).toBe(350);
      expect(custom.label).toBe('350g');
    });

    it('parses weight items from various raw types', () => {
      expect(parseWeightItem(200)?.grams).toBe(200);
      expect(parseWeightItem('250g')?.grams).toBe(250);
      expect(parseWeightItem('1kg')?.grams).toBe(1000);
      expect(parseWeightItem('0.5kg')?.grams).toBe(500);

      const objParsed = parseWeightItem({ grams: 600, label: '600 grams', color: '#ff0000' });
      expect(objParsed?.grams).toBe(600);
      expect(objParsed?.label).toBe('600 grams');
      expect(objParsed?.color).toBe('#ff0000');

      expect(parseWeightItem(null)).toBeNull();
      expect(parseWeightItem(-50)).toBeNull();
      expect(parseWeightItem('invalid')).toBeNull();
      expect(parseWeightItem({})).toBeNull();
    });
  });

  describe('findDecompositions', () => {
    it('finds valid partition combinations without forbidden numbers', () => {
      const forbidden = new Set([500, 250]);
      const pool = [50, 100, 150, 200];
      const decomps = findDecompositions(250, forbidden, pool, 2, 3);
      expect(decomps.length).toBeGreaterThan(0);
      for (const decomp of decomps) {
        const sum = decomp.reduce((a, b) => a + b, 0);
        expect(sum).toBe(250);
        for (const item of decomp) {
          expect(forbidden.has(item)).toBe(false);
        }
      }
    });
  });

  describe('generateLevelsForAge', () => {
    it('generates preschool levels for age "3-5"', () => {
      const levels = generateLevelsForAge('3-5');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.leverMode).toBe(false);
        expect(lvl.leftNotch).toBe(4);
        expect(lvl.rightNotch).toBe(4);
        expect(lvl.targetLeft.length).toBeGreaterThanOrEqual(1);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('generates elementary non-mirroring levels for age "6-8"', () => {
      const levels = generateLevelsForAge('6-8');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.leverMode).toBe(false);
        expect(lvl.targetLeft.length).toBeGreaterThanOrEqual(1);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);

        // Verify non-mirroring rule: inventory must not contain single block equal to target
        const leftSum = lvl.targetLeft.reduce((a, b) => a + b.grams, 0);
        const rightStartSum = lvl.targetRight.reduce((a, b) => a + b.grams, 0);
        const needed = leftSum - rightStartSum;
        const exactMatch = lvl.inventory.some((w) => w.grams === needed);
        expect(exactMatch).toBe(false);
      }
    });

    it('generates lever physics levels for age "9-11"', () => {
      const levels = generateLevelsForAge('9-11');
      expect(levels).toHaveLength(3);
      for (const lvl of levels) {
        expect(lvl.leverMode).toBe(true);
        expect([1, 2, 3, 4]).toContain(lvl.leftNotch);
        expect([1, 2, 3, 4]).toContain(lvl.rightNotch);
        expect(lvl.inventory.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('parseCustomLevels', () => {
    it('parses valid custom levels from array and JSON string', () => {
      const rawConfig = [
        {
          left: [500],
          inventory: [250, 250, 100],
          instruction: 'Custom Decomposition Challenge'
        },
        {
          left: [300],
          leftNotch: 4,
          rightNotch: 2,
          inventory: [600, 100]
        }
      ];

      const parsed = parseCustomLevels(rawConfig);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveLength(2);

      const lvl1 = parsed![0];
      expect(lvl1.targetLeft[0].grams).toBe(500);
      expect(lvl1.inventory).toHaveLength(3);
      expect(lvl1.customInstruction).toBe('Custom Decomposition Challenge');
      expect(lvl1.leverMode).toBe(false);

      const lvl2 = parsed![1];
      expect(lvl2.leftNotch).toBe(4);
      expect(lvl2.rightNotch).toBe(2);
      expect(lvl2.leverMode).toBe(true);

      // JSON string parsing
      const jsonParsed = parseCustomLevels(JSON.stringify(rawConfig));
      expect(jsonParsed).toHaveLength(2);
    });

    it('returns null on invalid or missing inputs', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels(undefined)).toBeNull();
      expect(parseCustomLevels('')).toBeNull();
      expect(parseCustomLevels('not json')).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels([{ left: [] }])).toBeNull();
    });
  });

  describe('BalanceScaleGame Lifecycle & Interactions', () => {
    let container: HTMLDivElement;
    let emittedEvents: Array<{ type: string; payload: unknown }>;
    let context: GameContext;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      emittedEvents = [];

      context = {
        ageGroup: '9-11',
        difficulty: 'medium',
        sound: false,
        locale: 'en',
        emit: (type, payload) => {
          emittedEvents.push({ type, payload });
        }
      };

      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;

      globalThis.requestAnimationFrame = vi.fn().mockReturnValue(1);
      globalThis.cancelAnimationFrame = vi.fn();

      // Mock HTML5 Canvas 2D Context
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
        scale: vi.fn()
      };

      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(dummyCtx);
      HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600
      });
    });

    it('mounts and initializes HUD, canvas and custom levels', async () => {
      const game = createBalanceScaleGame() as BalanceScaleGame;
      context.customLevels = [
        {
          left: [1000],
          inventory: [500, 500],
          instruction: 'Custom Test Instruction'
        }
      ];

      game.mount(container, context);

      expect(container.querySelector('#hud-title')?.textContent).toBe('⚖️ Balance Lab');
      expect(container.querySelector('#instruction')?.textContent).toBe('Custom Test Instruction');
      expect(container.querySelectorAll('.btn-notch')).toHaveLength(4);

      // Verify game:progress event was emitted
      const progressEvt = emittedEvents.find((e) => e.type === 'game:progress');
      expect(progressEvt).toBeDefined();

      game.start();
      (game as any).pause?.();
      (game as any).resume?.();

      // Update configuration dynamically
      game.updateConfig({
        locale: 'fr',
        sound: true,
        ageGroup: '6-8'
      });

      expect(container.querySelector('#hud-title')?.textContent).toBe('⚖️ Labo d’Équilibre');

      game.destroy();
      document.body.removeChild(container);
    });

    it('handles interactive notch buttons, sound toggle, and puzzle reset', () => {
      const game = createBalanceScaleGame() as BalanceScaleGame;
      context.customLevels = [
        {
          left: [300],
          leftNotch: 4,
          rightNotch: 2,
          leverMode: true,
          inventory: [600]
        }
      ];

      game.mount(container, context);

      // Test notch button clicks
      const notch3Btn = container.querySelector('.btn-notch[data-notch="3"]') as HTMLButtonElement;
      expect(notch3Btn).toBeDefined();
      notch3Btn.click();
      expect(container.querySelector('#instruction')?.textContent).toContain('At right notch 3');

      // Test sound toggle button
      const soundBtn = container.querySelector('#btn-sound-toggle') as HTMLButtonElement;
      expect(soundBtn.textContent).toBe('🔇 Sound OFF');
      soundBtn.click();
      expect(soundBtn.textContent).toBe('🔊 Sound ON');
      soundBtn.click();
      expect(soundBtn.textContent).toBe('🔇 Sound OFF');

      // Test reset button
      const resetBtn = container.querySelector('#btn-reset') as HTMLButtonElement;
      resetBtn.click();
      expect(emittedEvents.some((e) => e.type === 'game:progress')).toBe(true);

      game.destroy();
      document.body.removeChild(container);
    });

    it('adds weight to pan on tray click and removes on stacked weight click', () => {
      const game = createBalanceScaleGame() as BalanceScaleGame;
      context.customLevels = [
        {
          left: [500],
          inventory: [500]
        }
      ];

      game.mount(container, context);

      const tray = container.querySelector('#inventory-tray') as HTMLDivElement;
      const weightBlock = tray.firstElementChild as HTMLElement;
      expect(weightBlock).toBeDefined();

      // Click on weight in tray -> adds to right pan
      weightBlock.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      // Tray should now be empty
      expect(tray.children).toHaveLength(0);

      // Now click on right pan canvas area where the stacked weight sits
      const canvasWrapper = container.querySelector('#canvas-wrapper') as HTMLElement;
      const canvas = container.querySelector('#balance-canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const rightPan = (game as any).getRightPanCenter();

      canvasWrapper.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: rect.left + rightPan.x,
          clientY: rect.top + rightPan.y - 22
        })
      );

      // Inventory should have recovered the removed weight block
      expect(tray.children).toHaveLength(1);

      game.destroy();
      document.body.removeChild(container);
    });

    it('drags right lever stickily along the bar to change notch', () => {
      const game = createBalanceScaleGame() as BalanceScaleGame;
      context.customLevels = [
        {
          left: [200],
          leftNotch: 4,
          rightNotch: 4,
          leverMode: true,
          inventory: [800]
        }
      ];

      game.mount(container, context);

      const canvasWrapper = container.querySelector('#canvas-wrapper') as HTMLElement;

      // Pointer down on right arm of beam near Notch 4 (localX ~ 250)
      canvasWrapper.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: 400 + 250,
          clientY: 200
        })
      );

      // Drag pointer towards Notch 2 (localX ~ 125, ratio 0.5)
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 400 + 125,
          clientY: 200
        })
      );

      expect(container.querySelector('#instruction')?.textContent).toContain('At right notch 2');

      // Release pointer
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      game.destroy();
      document.body.removeChild(container);
    });
  });
});
