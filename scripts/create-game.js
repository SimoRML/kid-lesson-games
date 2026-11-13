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

fs.mkdirSync(gameDir, { recursive: true });

// 1. game.json
const gameJson = {
  id,
  title,
  version: '1.0.0',
  description: `Educational mini-game for youngsters: ${title}`,
  author: 'Contributor',
  category: 'logic',
  ageGroups: ['6-8'],
  skills: ['problem-solving', 'intuition'],
  thumbnail: 'assets/thumb.svg'
};

fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify(gameJson, null, 2) + '\n');

// 2. index.ts
const className = `${id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Game`;
const indexTs = `import type { GameContext, KidGame } from '../../src/core/types.js';

export class ${className} implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;

  mount(container: HTMLElement, context: GameContext) {
    this.container = container;
    this.context = context;
    this.render();
  }

  private render() {
    const isFr = this.context.locale?.startsWith('fr');
    const welcome = isFr ? 'Bienvenue à' : 'Welcome to';
    const scoreBtnText = isFr ? 'Gagner le point !' : 'Score a Point!';

    this.container.innerHTML = \`
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #f8fafc; text-align: center; padding: 24px;">
        <h2 style="color: #38bdf8; font-size: 1.5rem; margin-bottom: 8px;">🎮 \${welcome} ${title}</h2>
        <p style="color: #94a3b8; max-width: 400px; margin-bottom: 24px;">
          Age: <strong>\${this.context.ageGroup}</strong> | Difficulty: <strong>\${this.context.difficulty}</strong>
        </p>
        <button id="btn-play" style="background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 9999px; font-weight: bold; cursor: pointer; transition: transform 0.1s;">
          \${scoreBtnText}
        </button>
      </div>
    \`;

    const btn = this.container.querySelector('#btn-play');
    btn?.addEventListener('click', () => {
      this.context.audio.playPop();
      this.context.audio.playSuccess();
      this.context.emit('game:score', { points: 50, streak: 1, delta: 50 });
      this.context.emit('game:complete', {
        stars: 3,
        score: 50,
        timeElapsed: 5,
        summary: this.context.t('wellDone') || 'Great job!'
      });
    });
  }

  start() {
    console.log('${title} started');
  }

  updateConfig(newConfig: Partial<GameContext>) {
    Object.assign(this.context, newConfig);
    this.render();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

export function createGame(): KidGame {
  return new ${className}();
}

export default createGame;
`;

fs.writeFileSync(path.join(gameDir, 'index.ts'), indexTs);

// 3. README.md
const readmeMd = `# ${title}

## Educational Purpose
- **Category**: Logic / Reasoning
- **Target Age Group**: Ages 6–8
- **Skills**: Problem solving, pattern recognition

## Implementation Notes
This game fulfills the \`KidGame\` interface (\`mount\`, \`start\`, \`destroy\`).
`;

fs.writeFileSync(path.join(gameDir, 'README.md'), readmeMd);

console.log(`
✅ Successfully created game: "${title}"
📁 Directory: games/${id}/
   ├── game.json
   ├── index.ts
   └── README.md

🚀 Vite auto-discovery will load this game automatically!
Test it with:
<kid-game game="${id}"></kid-game>
`);
