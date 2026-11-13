#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rawName = process.argv[2];

if (!rawName) {
  console.log(`
❌ Usage: npm run create-game <game-id>
Example: npm run create-game number-line
`);
  process.exit(1);
}

// Format slug
const id = rawName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const title = id
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

const gameDir = path.resolve(import.meta.dirname, '..', 'games', id);

if (fs.existsSync(gameDir)) {
  console.error(`❌ Game directory already exists: ${gameDir}`);
  process.exit(1);
}

fs.mkdirSync(path.join(gameDir, 'assets'), { recursive: true });

// 1. game.json
const gameJson = {
  id,
  title,
  version: '1.0.0',
  description: `Educational mini-game for youngsters: ${title}`,
  author: 'Contributor',
  category: 'logic',
  ageGroups: ['3-5', '6-8', '9-11'],
  skills: ['problem-solving', 'intuition'],
  thumbnail: 'assets/thumb.svg'
};

fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify(gameJson, null, 2) + '\n');

// 2. assets/thumb.svg
const thumbSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="thumbBg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </radialGradient>
  </defs>
  <rect width="120" height="120" rx="20" fill="url(#thumbBg)"/>
  <circle cx="60" cy="60" r="32" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5" opacity="0.8"/>
  <polygon points="52,44 76,60 52,76" fill="#f8fafc"/>
</svg>
`;
fs.writeFileSync(path.join(gameDir, 'assets', 'thumb.svg'), thumbSvg);

// 3. i18n.ts
const i18nTs = `import { createI18nResolver } from '../../src/core/i18n.js';

export const DICTIONARY = {
  en: {
    title: '${title}',
    instruction: 'Tap to complete the challenge!',
    targetLabel: 'Target',
    scoreAction: 'Score Point',
    levelComplete: 'Level complete!',
    roundWon: '✨ Well Done!'
  },
  fr: {
    title: '${title}',
    instruction: 'Appuie pour relever le défi !',
    targetLabel: 'Cible',
    scoreAction: 'Marquer un point',
    levelComplete: 'Niveau terminé !',
    roundWon: '✨ Bravo !'
  }
} as const;

export type GameDictionary = typeof DICTIONARY;
export const getTranslations = createI18nResolver(DICTIONARY, 'en');
`;
fs.writeFileSync(path.join(gameDir, 'i18n.ts'), i18nTs);

// 4. index.ts
const className = `${id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Game`;
const indexTs = `import type { AgeGroup, Difficulty, GameContext, KidGame } from '../../src/core/types.js';
import { getTranslations } from './i18n.js';

export interface StarterLevel {
  id: string;
  target: number;
  options: number[];
  tolerance?: number;
}

export function generateLevelsForAge(
  ageGroup: AgeGroup,
  difficulty: Difficulty = 'medium'
): StarterLevel[] {
  const distractorCount = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2;

  switch (ageGroup) {
    case '3-5': {
      const base = difficulty === 'hard' ? 4 : 2;
      return [
        { id: 'preschool-1', target: base, options: [base, ...Array.from({ length: distractorCount }, (_, i) => base + i + 1)] },
        { id: 'preschool-2', target: base + 1, options: [base + 1, ...Array.from({ length: distractorCount }, (_, i) => base + i + 2)] }
      ];
    }
    case '9-11': {
      const mult = difficulty === 'easy' ? 10 : difficulty === 'hard' ? 25 : 15;
      return [
        { id: 'upper-1', target: mult * 2, options: [mult * 2, mult, mult * 3, mult * 4].slice(0, 1 + distractorCount) },
        { id: 'upper-2', target: mult * 3, options: [mult * 3, mult * 2, mult * 4, mult * 5].slice(0, 1 + distractorCount) }
      ];
    }
    case '6-8':
    default: {
      const step = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 12 : 8;
      return [
        { id: 'elem-1', target: step, options: [step, step + 2, Math.max(1, step - 2), step + 4].slice(0, 1 + distractorCount) },
        { id: 'elem-2', target: step * 2, options: [step * 2, step * 2 - 2, step * 2 + 2, step * 2 + 4].slice(0, 1 + distractorCount) }
      ];
    }
  }
}

export function parseCustomLevels(raw: unknown): StarterLevel[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const parsed: StarterLevel[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') return null;
    const { target, options } = item as Record<string, unknown>;
    if (typeof target !== 'number' || !Number.isFinite(target)) return null;
    if (!Array.isArray(options) || options.some((o) => typeof o !== 'number' || !Number.isFinite(o))) {
      return null;
    }
    parsed.push({
      id: typeof (item as Record<string, unknown>).id === 'string' ? (item as Record<string, unknown>).id as string : \`custom-\${i + 1}\`,
      target,
      options: options as number[]
    });
  }

  return parsed.length > 0 ? parsed : null;
}

export class ${className} implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private abortController: AbortController | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  private levels: StarterLevel[] = [];
  private currentLevelIndex = 0;
  private score = 0;
  private isPaused = false;

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();

    const custom = parseCustomLevels(this.context.customLevels);
    this.levels = custom || generateLevelsForAge(this.context.ageGroup, this.context.difficulty);
    this.currentLevelIndex = 0;
    this.score = 0;

    this.render();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        // Handle responsive reflow if needed
      });
      this.resizeObserver.observe(this.container);
    }
  }

  start(): void {
    this.isPaused = false;
    this.context.emit('game:start', { gameId: '${id}' });
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  updateConfig(newConfig: Partial<GameContext>): void {
    const prevAge = this.context.ageGroup;
    const prevDiff = this.context.difficulty;
    const prevLevels = this.context.customLevels;

    Object.assign(this.context, newConfig);

    const levelsChanged = newConfig.customLevels !== undefined && newConfig.customLevels !== prevLevels;
    const ageChanged = newConfig.ageGroup !== undefined && newConfig.ageGroup !== prevAge;
    const diffChanged = newConfig.difficulty !== undefined && newConfig.difficulty !== prevDiff;

    if (levelsChanged || ageChanged || diffChanged) {
      const custom = parseCustomLevels(this.context.customLevels);
      this.levels = custom || generateLevelsForAge(this.context.ageGroup, this.context.difficulty);
      this.currentLevelIndex = 0;
      this.score = 0;
    }

    this.render();
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

  private render(): void {
    if (!this.container) return;
    const strings = getTranslations(this.context.locale);
    const level = this.levels[this.currentLevelIndex] || this.levels[0];

    this.container.innerHTML = \`
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #f8fafc; text-align: center; padding: 24px;">
        <h2 style="color: #38bdf8; font-size: 1.5rem; margin-bottom: 8px;">\${strings.title}</h2>
        <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 16px;">\${strings.instruction}</p>
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px 24px; margin-bottom: 20px;">
          <span style="color: #94a3b8; font-size: 0.85rem;">\${strings.targetLabel}:</span>
          <span style="color: #fbbf24; font-size: 1.5rem; font-weight: bold; margin-left: 8px;">\${level ? level.target : 0}</span>
        </div>
        <button id="btn-action" style="background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 9999px; font-weight: bold; cursor: pointer; transition: transform 0.1s;">
          \${strings.scoreAction}
        </button>
      </div>
    \`;

    const btn = this.container.querySelector<HTMLButtonElement>('#btn-action');
    btn?.addEventListener(
      'click',
      () => {
        if (this.isPaused) return;
        this.handleSuccess();
      },
      { signal: this.abortController?.signal }
    );
  }

  private handleSuccess(): void {
    this.context.audio.playDrop();
    this.context.audio.playSuccess();

    this.score += 50;
    this.context.emit('game:score', { points: this.score, streak: 1, delta: 50 });
    this.context.emit('game:progress', {
      step: this.currentLevelIndex + 1,
      total: this.levels.length,
      detail: \`Completed level \${this.currentLevelIndex + 1}\`
    });

    if (this.currentLevelIndex + 1 < this.levels.length) {
      const timer = setTimeout(() => {
        this.pendingTimeouts.delete(timer);
        this.currentLevelIndex++;
        this.render();
      }, 600);
      this.pendingTimeouts.add(timer);
    } else {
      this.context.emit('game:complete', {
        stars: 3,
        score: this.score,
        timeElapsed: 10,
        summary: this.context.t('wellDone') || 'Great job!'
      });
    }
  }
}

export function createGame(): KidGame {
  return new ${className}();
}

export default createGame;
`;
fs.writeFileSync(path.join(gameDir, 'index.ts'), indexTs);

// 5. index.test.ts
const indexTestTs = `import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, generateLevelsForAge, parseCustomLevels, ${className} } from './index.js';
import type { GameContext } from '../../src/core/types.js';

describe('${title} Cartridge', () => {
  let mockContext: GameContext;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    mockContext = {
      ageGroup: '6-8',
      difficulty: 'medium',
      locale: 'en',
      sound: true,
      audio: {
        enabled: true,
        playClick: vi.fn(),
        playPop: vi.fn(),
        playDrop: vi.fn(),
        playChime: vi.fn(),
        playSuccess: vi.fn(),
        playError: vi.fn(),
        playTone: vi.fn(),
        close: vi.fn()
      } as unknown as GameContext['audio'],
      i18n: {} as unknown as GameContext['i18n'],
      t: vi.fn((key: string) => key),
      emit: vi.fn()
    };
  });

  describe('Curriculum & Level Generation', () => {
    it('generates distinct levels for each age bracket', () => {
      const p = generateLevelsForAge('3-5');
      const e = generateLevelsForAge('6-8');
      const u = generateLevelsForAge('9-11');

      expect(p.length).toBeGreaterThan(0);
      expect(e.length).toBeGreaterThan(0);
      expect(u.length).toBeGreaterThan(0);
      expect(p[0].target).not.toBe(u[0].target);
    });

    it('modulates difficulty cleanly', () => {
      const easy = generateLevelsForAge('6-8', 'easy');
      const hard = generateLevelsForAge('6-8', 'hard');

      expect(easy[0].options.length).toBeLessThan(hard[0].options.length);
    });

    it('safely validates custom levels with parseCustomLevels', () => {
      expect(parseCustomLevels(null)).toBeNull();
      expect(parseCustomLevels([])).toBeNull();
      expect(parseCustomLevels([{ invalid: true }])).toBeNull();

      const valid = parseCustomLevels([{ target: 42, options: [42, 10, 20] }]);
      expect(valid).not.toBeNull();
      expect(valid?.[0].target).toBe(42);
    });
  });

  describe('KidGame Lifecycle & Teardown', () => {
    it('mounts, renders, and handles button interaction', () => {
      const game = createGame();
      game.mount(container, mockContext);
      game.start();

      expect(mockContext.emit).toHaveBeenCalledWith('game:start', { gameId: '${id}' });

      const btn = container.querySelector<HTMLButtonElement>('#btn-action');
      expect(btn).not.toBeNull();
      btn?.click();

      expect(mockContext.audio.playSuccess).toHaveBeenCalled();
      expect(mockContext.emit).toHaveBeenCalledWith('game:score', expect.any(Object));

      game.destroy();
      expect(container.innerHTML).toBe('');
    });

    it('handles pause and resume properly', () => {
      const game = new ${className}();
      game.mount(container, mockContext);
      game.start();

      game.pause();
      const btn = container.querySelector<HTMLButtonElement>('#btn-action');
      vi.clearAllMocks();
      btn?.click();
      expect(mockContext.audio.playSuccess).not.toHaveBeenCalled();

      game.resume();
      btn?.click();
      expect(mockContext.audio.playSuccess).toHaveBeenCalled();

      game.destroy();
    });

    it('updates config dynamically without leaking listeners or state', () => {
      const game = createGame();
      game.mount(container, mockContext);

      game.updateConfig({ locale: 'fr', difficulty: 'hard' });
      expect(container.textContent).toContain('Cible');

      game.destroy();
      expect(container.innerHTML).toBe('');
    });
  });
});
`;
fs.writeFileSync(path.join(gameDir, 'index.test.ts'), indexTestTs);

// 6. README.md
const readmeMd = `# ${title}

## Educational Purpose
- **Category**: Logic / Reasoning
- **Target Age Groups**: Ages 3–5, 6–8, 9–11
- **Skills**: Problem solving, pattern recognition, quantitative intuition

## Age Progression & Pedagogical Grounding
- **Ages 3–5**: Concrete correspondence and immediate tactile feedback.
- **Ages 6–8**: Multi-step decomposition, distractor filtering, and early quantitative operations.
- **Ages 9–11**: Multi-variable ratios, higher magnitudes, and systematic reasoning.

## Dual Curriculum & Custom Levels
Accepts custom levels via the \`levels\` attribute / \`context.customLevels\`:

\`\`\`json
[
  { "id": "custom-1", "target": 10, "options": [10, 5, 15] },
  { "id": "custom-2", "target": 20, "options": [20, 10, 30] }
]
\`\`\`

If omitted or invalid, automatically falls back to procedural generation via \`generateLevelsForAge(ageGroup, difficulty)\`.
`;
fs.writeFileSync(path.join(gameDir, 'README.md'), readmeMd);

console.log(`
✅ Successfully created complete game: "${title}"
📁 Directory: games/${id}/
   ├── game.json
   ├── assets/
   │   └── thumb.svg
   ├── i18n.ts
   ├── index.ts
   ├── index.test.ts
   └── README.md

🚀 Zero-leak lifecycle, dual-curriculum, i18n, and Vitest suite generated!
Test with:
  npm test games/${id}/index.test.ts
`);
