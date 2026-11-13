import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext } from '../../src/core/types.js';
import { SoundEngine } from '../../src/core/audio.js';
import { I18nManager } from '../../src/core/i18n.js';
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

  describe('9-11 lever generation (no answer giveaway)', () => {
    it('starts the right hook off the solving notch and stays solvable', () => {
      for (let run = 0; run < 40; run++) {
        for (const lvl of generateLevelsForAge('9-11')) {
          expect(lvl.solutionNotch).toBeDefined();
          expect(lvl.rightNotch).not.toBe(lvl.solutionNotch);

          const torque = lvl.targetLeft.reduce((a, w) => a + w.grams, 0) * lvl.leftNotch;
          const grams = lvl.inventory.map((w) => w.grams);
          const solvableAt = (notch: number) => {
            for (let mask = 1; mask < 1 << grams.length; mask++) {
              let sum = 0;
              grams.forEach((g, i) => { if (mask & (1 << i)) sum += g; });
              if (sum * notch === torque) return true;
            }
            return false;
          };
          expect(solvableAt(lvl.solutionNotch!)).toBe(true);
        }
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

      const audio = new SoundEngine(false);
      const i18n = new I18nManager('en');

      context = {
        ageGroup: '9-11',
        difficulty: 'medium',
        sound: false,
        locale: 'en',
        audio,
        i18n,
        t: (k, p) => i18n.t(k, p),
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
      expect(container.querySelector('#instruction')?.textContent).toContain('Left: 300g × 4 = 1200');

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

      expect(container.querySelector('#instruction')?.textContent).toContain('Left: 200g × 4 = 800');
      expect(container.querySelector('.btn-notch[data-notch="2"]')?.textContent).toContain('✓ Notch 2');

      // Release pointer
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      game.destroy();
      document.body.removeChild(container);
    });

    describe('issue fixes', () => {
      const setup = (levels: unknown, locale: 'en' | 'fr' = 'en') => {
        const game = createBalanceScaleGame() as BalanceScaleGame;
        context.customLevels = levels as any;
        context.locale = locale;
        game.mount(container, context);
        return game;
      };
      const clickTray = (index: number) => {
        const tray = container.querySelector('#inventory-tray') as HTMLDivElement;
        (tray.children[index] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      };
      const instruction = () => container.querySelector('#instruction')?.textContent ?? '';

      it('#1 does not repeat the target for a single-weight level', () => {
        const game = setup([{ left: [750], inventory: [500, 250] }]);
        expect(instruction()).toBe('Balance 750g using a different combination of weights!');
        game.destroy();
        const game2 = setup([{ left: [1000], inventory: [500, 500] }]);
        expect(instruction()).toBe('Balance 1 kg using a different combination of weights!');
        game2.destroy();
      });

      it('#2 updates the instruction live on place and undo (standard mode)', () => {
        const game = setup([{ left: [600, 400], inventory: [250, 500, 750] }]);
        expect(instruction()).toContain('600g + 400g (1 kg)');
        clickTray(0); // first tray item
        expect(instruction()).toMatch(/^Right: \d+g of 1 kg, keep going!$/);
        clickTray(0);
        clickTray(0);
        expect(instruction()).toContain('too heavy');
        // Undo the heaviest: click the top stacked weight
        const rightPan = (game as any).getRightPanCenter();
        const wrapper = container.querySelector('#canvas-wrapper') as HTMLElement;
        const topIdx = (game as any).rightWeights.length - 1;
        wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rightPan.x, clientY: rightPan.y - 22 - topIdx * 38 }));
        expect((game as any).rightWeights).toHaveLength(2);
        game.destroy();
      });

      it('#2 updates the instruction live in lever mode and when the notch moves', () => {
        const game = setup([{ left: [200], leftNotch: 4, rightNotch: 4, leverMode: true, inventory: [300, 100] }]);
        expect(instruction()).toBe('Left: 200g × 4 = 800. Make the right side equal 800!');
        clickTray(0);
        expect(instruction()).toBe('Right torque: 300g × 4 = 1200 is more than 800. Too heavy!');
        (container.querySelector('.btn-notch[data-notch="2"]') as HTMLButtonElement).click();
        expect(instruction()).toBe('Right torque: 300g × 2 = 600 / 800. A little more!');
        game.updateConfig({ locale: 'fr' });
        expect(instruction()).toBe('Force à droite : 300g × 2 = 600 / 800. Encore un peu !');
        game.destroy();
      });

      it('#3 lever instruction never contains the needed grams (EN and FR)', () => {
        for (const locale of ['en', 'fr'] as const) {
          const game = setup([{ left: [200], leftNotch: 4, rightNotch: 3, leverMode: true, inventory: [250, 150] }], locale);
          expect(instruction()).not.toContain('400g');
          game.destroy();
        }
      });

      it('#4 translates notch buttons and updates them live on locale change', () => {
        const game = setup([{ left: [200], leftNotch: 4, rightNotch: 2, leverMode: true, inventory: [400] }]);
        const labels = () => Array.from(container.querySelectorAll('.btn-notch')).map((b) => b.textContent);
        expect(labels()).toEqual(['Notch 1', '✓ Notch 2', 'Notch 3', 'Notch 4']);
        game.updateConfig({ locale: 'fr' });
        expect(labels()).toEqual(['Cran 1', '✓ Cran 2', 'Cran 3', 'Cran 4']);
        game.destroy();
        const frGame = setup([{ left: [200], leftNotch: 4, rightNotch: 2, leverMode: true, inventory: [400] }], 'fr');
        expect(labels()[0]).toBe('Cran 1');
        frGame.destroy();
      });

      describe('win banner and teardown', () => {
        const winLevel = () => setup([
          { left: [500], inventory: [250, 250] },
          { left: [100], inventory: [50, 50] }
        ]);
        const forceWin = (game: BalanceScaleGame) => {
          (game as any).rightWeights = [createWeight(250), createWeight(250)];
          for (let i = 0; i < 80; i++) (game as any).updatePhysics();
        };

        it('#5 shows the localized banner on win, hides it on next level', () => {
          vi.useFakeTimers();
          try {
            const game = winLevel();
            const banner = () => container.querySelector('#win-banner') as HTMLElement;
            expect(banner().classList.contains('show')).toBe(false);
            forceWin(game);
            expect(banner().classList.contains('show')).toBe(true);
            expect(banner().textContent).toBe('✨ Perfect Balance!');
            game.updateConfig({ locale: 'fr' });
            expect(banner().textContent).toBe('✨ Équilibre Parfait !');
            vi.advanceTimersByTime(1600);
            expect(banner().classList.contains('show')).toBe(false);
            expect((game as any).currentLevelIndex).toBe(1);
            game.destroy();
          } finally {
            vi.useRealTimers();
          }
        });

        it('#5 destroy during the win window leaves no pending timers', () => {
          vi.useFakeTimers();
          try {
            const game = winLevel();
            forceWin(game);
            expect(vi.getTimerCount()).toBeGreaterThan(0);
            game.destroy();
            expect(vi.getTimerCount()).toBe(0);
            expect((game as any).pendingTimeouts.size).toBe(0);
          } finally {
            vi.useRealTimers();
          }
        });
      });

      it('lifecycle: pause/resume control rAF, destroy removes window listeners and does not close audio', () => {
        const game = setup([{ left: [500], inventory: [500] }]);
        const raf = globalThis.requestAnimationFrame as any;
        const caf = globalThis.cancelAnimationFrame as any;
        raf.mockClear();
        game.start();
        expect(raf).toHaveBeenCalledTimes(1);
        game.pause();
        expect(caf).toHaveBeenCalled();
        raf.mockClear();
        game.resume();
        expect(raf).toHaveBeenCalledTimes(1);

        const closeSpy = vi.spyOn(context.audio, 'close');
        const removeSpy = vi.spyOn(AbortController.prototype, 'abort');
        game.destroy();
        expect(closeSpy).not.toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
        expect(container.innerHTML).toBe('');
        removeSpy.mockRestore();

        // After destroy, window events must not reach the game (no throw, no state change)
        expect(() => {
          window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
          window.dispatchEvent(new MouseEvent('mouseup'));
        }).not.toThrow();
      });

      it('does not crash without ResizeObserver or a 2D context', () => {
        (globalThis as any).ResizeObserver = undefined;
        (HTMLCanvasElement.prototype.getContext as any) = vi.fn().mockReturnValue(null);
        const game = setup([{ left: [500], inventory: [500] }]);
        expect(() => game.start()).not.toThrow();
        game.destroy();
      });
    });
  });
});
