# 🚀 kid-lesson-games

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vite](https://img.shields.io/badge/bundler-vite-646CFF.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
[![Web Component](https://img.shields.io/badge/element-%3Ckid--game%3E-f97316.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)

A pluggable collection of interactive mini-games designed for **kids' learning platforms** (Numbers, Letters, Logic, and Spatial awareness). 

Built specifically for seamless embedding via a standard **`<kid-game>` Web Component**—drop it into **any** frontend stack (React, Vue, Svelte, Angular, Next.js, or plain HTML) with zero friction.

Designed with an **AI-first contributor vibe**: developers or AI coding agents can generate and drop in brand-new games in minutes with zero modifications to the core engine.

---

## ✨ Key Highlights

- 🧩 **Universal Web Component (`<kid-game>`)**: Framework-agnostic Shadow DOM element. Drop it anywhere with `<kid-game game="balance-scale"></kid-game>`.
- 🤖 **AI-Friendly Pluggable Architecture**: Drop new games directly into `games/<game-id>/`. The core engine automatically discovers them via `import.meta.glob`. Zero core file edits needed!
- 📐 **Grounded European Math & Physics**: 
  - Standard metric units ($50\text{g}$, $100\text{g}$, $250\text{g}$, $500\text{g}$, $1\text{ kg}$).
  - Archimedes lever physics for upper elementary ($Torque = Weight \times Distance$), complete with spring-damper beam physics and interactive sliding hooks.
- 🎯 **Configurable Levels + Auto-Generate Fallback**: Pass explicit lesson levels via attributes/properties for curriculum alignment, or omit them to let procedural puzzle generation take over.
- 🌐 **Multilingual (i18n)**: Built-in English (`en`) and French (`fr`) with dynamic pedagogical equation guidance.
- 🔊 **Zero-Asset Web Audio API**: Procedural sound effects (pops, thuds, gentle balance chimes, celebratory fanfares) synthesized on the fly—zero external audio files to fetch or fail loading.
- 📡 **Telemetry Event Bridge**: Dispatches standard DOM events (`game:ready`, `game:start`, `game:progress`, `game:score`, `game:complete`, `game:error`) for platform gamification, star ratings, and analytics.

---

## 🎮 Live Game: `balance-scale` (Balance Lab)

The flagship game teaches **metric weights**, **number decomposition**, and **lever mechanics**:

| Age Bracket | Educational Focus | Key Mechanics |
| :--- | :--- | :--- |
| **3–5 (Preschool)** | Visual equality & basic metric weights | Equal-arm scale, 1–2 weight comparison, playful colors. |
| **6–8 (Elementary)** | Addition, subtraction & metric decomposition | Equal-arm balance, decomposing $1\text{ kg}$ or $750\text{g}$ into smaller parts. Non-mirroring tray forces true mental math. |
| **9–11 (Upper)** | Archimedes lever mechanics & torque multiplication | Dynamic suspension notches ($1, 2, 3, 4$). Drag the right lever stickily along the bar to experience mechanical advantage ($Weight_L \times D_L = Weight_R \times D_R$). |

### Interactive Controls:
- **Click or Drag-and-Drop**: Click any available weight block in the tray to pop it onto the right pan, or drag-and-drop it anywhere.
- **Per-Block Removal**: Click any individual stacked weight on the pan to return just that block back to the tray.
- **Sticky Lever Drag**: Click & drag the right suspension hook or pan along the bar—it stickily snaps to notches $1..4$ with real-time physics feedback!

---

## 🚀 Quickstart

### 1. Clone & Install
```bash
git clone https://github.com/simorml/kid-lesson-games.git
cd kid-lesson-games
npm install
```

### 2. Run Local Interactive Playground
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to explore the testbed with live controls for language switching, age brackets, custom level presets, sound toggling, and real-time telemetry logs.

### 3. Build Production Bundle
```bash
npm run build
```
Generates lightweight ES and UMD bundles in `dist/`.

---

## 💻 Embedding in Your Platform

### In Plain HTML / Vanilla JS
```html
<!-- Import the bundle -->
<script type="module" src="./dist/kid-games.es.js"></script>

<!-- Place the game -->
<kid-game 
  game="balance-scale"
  age="6-8"
  difficulty="medium"
  locale="en"
  sound="true">
</kid-game>
```

### In React / Next.js
```tsx
import React, { useEffect, useRef } from 'react';
import 'kid-lesson-games'; // Registers <kid-game> custom element

export function LessonPage() {
  const gameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = gameRef.current;
    if (!el) return;

    const onProgress = (e: CustomEvent) => console.log('Step progress:', e.detail);
    const onComplete = (e: CustomEvent) => console.log('Stars earned:', e.detail.stars);

    el.addEventListener('game:progress', onProgress as EventListener);
    el.addEventListener('game:complete', onComplete as EventListener);

    return () => {
      el.removeEventListener('game:progress', onProgress as EventListener);
      el.removeEventListener('game:complete', onComplete as EventListener);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '560px' }}>
      <kid-game
        ref={gameRef}
        game="balance-scale"
        age="9-11"
        locale="en"
      />
    </div>
  );
}
```

### In Vue / Nuxt
```vue
<template>
  <div class="game-wrapper">
    <kid-game
      game="balance-scale"
      :age="currentAge"
      :locale="userLocale"
      @game:score="handleScore"
      @game:complete="handleComplete"
    />
  </div>
</template>

<script setup>
import 'kid-lesson-games';
const currentAge = '6-8';
const userLocale = 'fr';

const handleScore = (e) => console.log('Score:', e.detail.points);
const handleComplete = (e) => console.log('Summary:', e.detail.summary);
</script>
```

---

## ⚙️ Component API Reference

### Attributes & Properties

| Attribute / Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `game` | `string` | `""` | The unique game ID (e.g. `"balance-scale"`). |
| `age` | `'3-5' \| '6-8' \| '9-11'` | `'6-8'` | Target age bracket for curriculum scaling. |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | `'medium'` | Difficulty level modifier. |
| `locale` | `'en' \| 'fr'` | `'en'` | UI language. |
| `sound` | `boolean \| 'true' \| 'false'` | `true` | Enables or mutes procedural sound effects. |
| `autostart` | `boolean \| 'true' \| 'false'` | `true` | Automatically starts round on mount. |
| `levels` | `CustomLevelConfig[] \| string \| null` | `null` | Custom level sequence. If omitted/invalid, auto-generates procedural puzzles! |

### Methods (via Element DOM Reference)
```ts
const gameEl = document.querySelector('kid-game');

gameEl.start();    // Starts or begins active gameplay round
gameEl.pause();    // Pauses game timers/animations
gameEl.resume();   // Resumes gameplay
gameEl.restart();  // Reloads and restarts the current game
```

---

## 🎯 Custom Level Configuration

Platforms and educators can supply tailored lesson levels via the `levels` property or attribute. If not specified, the game automatically uses its procedural curriculum generator.

### Example: Addition Decomposition Puzzle
```js
const gameEl = document.querySelector('kid-game');

gameEl.levels = [
  {
    left: [1000],                         // 1 kg load on left pan
    inventory: [500, 250, 250, 100],      // Available metric weights to choose from
    instruction: "Lesson 1: Balance 1 kg using smaller metric weights!"
  },
  {
    left: [750],                          // 750g load
    inventory: [500, 200, 50, 100],       // Must combine 500g + 200g + 50g
    instruction: "Lesson 2: Decompose 750g!"
  }
];
```

### Example: Archimedes Lever Challenge
```js
gameEl.levels = [
  {
    left: [300],                          // 300g on left
    leftNotch: 4,                         // Left torque = 300g * 4 = 1200
    rightNotch: 2,                        // Right pan starts at Notch 2
    inventory: [600, 200, 100],           // Needs 600g (600g * 2 = 1200)
    leverMode: true,                      // Enables interactive notch selector bar
    instruction: "Lever Challenge: Torque = 1200. Find the balance at Notch 2!"
  }
];
```

---

## 📡 Telemetry & Event Bridge

Listen to custom DOM events emitted by `<kid-game>` to trigger lesson transitions, sound rewards, or store progress in your LMS:

```ts
// Fired when the game engine finishes mounting and is ready
game.addEventListener('game:ready', (e) => {
  console.log(e.detail.gameId); // e.g. "balance-scale"
});

// Fired on step progression
game.addEventListener('game:progress', (e) => {
  console.log(`Step ${e.detail.step} of ${e.detail.total}: ${e.detail.detail}`);
});

// Fired when points or streaks update
game.addEventListener('game:score', (e) => {
  console.log(`Score: ${e.detail.points}, Streak: ${e.detail.streak}`);
});

// Fired when all levels in a round are completed
game.addEventListener('game:complete', (e) => {
  console.log(`Stars: ${e.detail.stars}, Score: ${e.detail.score}, Time: ${e.detail.timeElapsed}s`);
});
```

---

## 🛠️ Adding New Games (Contributor & AI Workflow)

This repository is built for rapid expansion. A developer or an AI assistant can scaffold a new game with a single command:

```bash
npm run create-game <game-id>
```

For example:
```bash
npm run create-game letter-trace
```

This generates `games/letter-trace/` with:
- `meta.json`: Category, title, age groups, and skills.
- `index.ts`: Boilerplate implementing the `KidGame` lifecycle interface.

### The `KidGame` Lifecycle Contract
Every game is an isolated module implementing:
```ts
export interface KidGame {
  mount(container: HTMLElement, context: GameContext): Promise<void> | void;
  start(): void;
  pause?(): void;
  resume?(): void;
  updateConfig?(newContext: Partial<GameContext>): void;
  destroy(): void;
}
```

Because Vite discovers all games dynamically via `import.meta.glob('/games/*/index.ts')`, **no changes are needed in `src/`**. Just code your game in its folder and test it immediately!

---

## 📁 Repository Structure

```
kid-lesson-games/
├── games/
│   └── balance-scale/           # MVP Balance & Lever physics game
│       ├── audio.ts             # Procedural Web Audio API sound synthesizer
│       ├── i18n.ts              # English and French translations
│       ├── index.ts             # Core canvas game, spring physics & interactions
│       └── meta.json            # Game metadata & curriculum taxonomy
├── src/
│   ├── core/
│   │   ├── KidGameElement.ts    # <kid-game> custom element & Shadow DOM host
│   │   ├── registry.ts          # Dynamic game registry
│   │   └── types.ts             # TypeScript interfaces & event contracts
│   └── index.ts                 # Main library entry point & auto-discovery
├── docs/
│   └── design/                  # Architecture & mathematical specifications
├── scripts/
│   └── create-game.js           # CLI scaffolding tool (npm run create-game)
├── index.html                   # Interactive browser playground & event inspector
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 📄 License

MIT License © 2026 [simorml](https://github.com/simorml). Free to use and integrate into educational platforms!
