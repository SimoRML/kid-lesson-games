# 🚀 kid-lesson-games

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vite](https://img.shields.io/badge/bundler-vite-646CFF.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
[![Web Component](https://img.shields.io/badge/element-%3Ckid--game%3E-f97316.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)

**`kid-lesson-games`** is a pluggable collection of interactive educational mini-games for youngsters (ages 3–11), packaged as a framework-agnostic **`<kid-game>` Web Component**. Each game is an isolated cartridge teaching grounded European math and physical laws across three age brackets with zero external runtime assets.

A pluggable collection of interactive mini-games designed for **kids' learning platforms** (Numbers, Letters, Logic, and Spatial awareness). Built specifically for seamless embedding via a standard **`<kid-game>` Web Component**—drop it into **any** frontend stack (React, Vue, Svelte, Angular, Next.js, or plain HTML) with zero friction. Designed with an **AI-first contributor vibe**: developers or AI coding agents can generate and drop in brand-new games in minutes with zero modifications to the core engine.

🌐 **Live Interactive Playground**: [**https://simorml.github.io/kid-lesson-games/**](https://simorml.github.io/kid-lesson-games/) *(🚧 auto-deploys via GitHub Actions once Pages is enabled in repository settings)*

> 📸 **TODO (Screenshot / Demo GIF)**: Capture and embed a screenshot or animated GIF of the `<kid-game>` playground switching between cartridges here (e.g., `docs/assets/playground-demo.gif`).

---

## 📚 Documentation Map

- 🎯 **[docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md)** — Philosophy, pedagogical principles, curriculum categories, planned games, and Gap Analysis.
- 🏗️ **[docs/ARCHITECTURE.md](file:///home/simo/Documents/www/kid-lesson-games/docs/ARCHITECTURE.md)** — How the core engine, `<kid-game>`, registry, telemetry, audio, i18n, and Vite builds work today vs. target architecture.
- 🗺️ **[TODO.md](file:///home/simo/Documents/www/kid-lesson-games/TODO.md)** — Project roadmap grouped by vision themes.
- 🤖 **[AGENTS.md](file:///home/simo/Documents/www/kid-lesson-games/AGENTS.md)** — Cold-start onboarding, contribution contract, known gotchas, and Definition of Done for AI agents and contributors.
- 📐 **Design Specs**: [game-contract-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/game-contract-spec.md) · [web-component-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/web-component-spec.md) · [balance-scale-math-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/balance-scale-math-spec.md)

---

## 🏷️ Status Legend

- ✅ **Implemented**: Exists in code on disk and verified working (via tests or build).
- 🚧 **Partial**: Exists in code but incomplete or unverified (notes state what is missing).
- 🗺️ **Planned**: Part of the vision/target architecture, not built yet.
- ⚠️ **Known discrepancy**: Code and old docs disagreed (notes state how it was resolved).

---

## 📊 Current Status Overview

| Capability / Feature | Status | Reality Check |
| :--- | :---: | :--- |
| Universal `<kid-game>` Web Component (Shadow DOM) | ✅ | Implemented in [KidGameElement.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/KidGameElement.ts); client-side ready (SSR requires dynamic client import ⚠️) |
| Auto-Discovery & Lazy ES Chunking (`import.meta.glob`) | ✅ | `dist/kid-games.es.js` (~12.7 kB) lazily loads per-game ES chunks (`dist/<game-id>-*.js`) |
| UMD Bundle (`dist/kid-games.umd.js`) | ⚠️ | Produced by `npm run build` (~236 kB), but UMD cannot code-split dynamic imports so all 6 games are bundled together |
| Grounded Math & Physics Cartridges (`numbers`, `logic`, `spatial`) | ✅ | 6 playable cartridges (`balance-scale`, `buoyancy-tank`, `gear-trains`, `marble-run-angles`, `pendulum-rhythm`, `pulley-lift`) with 277 passing Vitest tests |
| `letters` Curriculum Category | 🗺️ | Taxonomy category `'letters'` exists in `src/core/types.ts`, no letter games built yet |
| Configurable `levels` + Procedural Fallback | ✅ | All 6 cartridges export `parseCustomLevels()` and fall back to `generateLevelsForAge(ageGroup, difficulty)` |
| Multilingual UI (`en` & `fr`) | ✅ | Core `I18nManager` + all 6 cartridges provide full English (`en`) and French (`fr`) dictionaries |
| Zero-Asset Procedural Web Audio (`SoundEngine`) | ✅ | Synthesizes clicks, pops, drops, chimes, victory fanfares, error buzzes, and custom tones |
| Telemetry Event Bridge (`game:*` CustomEvents) | ✅ | Dispatched on `<kid-game>` with `bubbles: true, composed: true` to cross Shadow DOM boundaries |
| `difficulty` Attribute (`easy` \| `medium` \| `hard`) | ✅ | Parsed on `<kid-game>` and passed in `context.difficulty`; all 6 cartridges modulate distractor counts, physical parameters, and tolerances via `generateLevelsForAge(age, difficulty)` |
| Scaffolding CLI (`npm run create-game <id>`) | ✅ | Scaffolds `game.json`, `assets/thumb.svg`, `i18n.ts`, `index.ts`, `index.test.ts`, and `README.md` with complete zero-leak lifecycle contracts |
| Published npm Package (`npm i kid-lesson-games`) | 🗺️ | Not published to npm yet (`"private": true`); install via git dependency, local path, or built script bundle |

---

## 📦 Installation & Quickstart

> ⚠️ **Not on npm yet (🗺️ Planned)**: `kid-lesson-games` is not published to the public npm registry yet. Use one of the three verified methods below today.

### 1. Clone, Install & Build Locally (✅)
```bash
git clone https://github.com/simorml/kid-lesson-games.git
cd kid-lesson-games
npm install
npm test          # Runs 277 Vitest unit & DOM lifecycle tests
npm run build     # Type-checks & builds ES chunks + UMD bundle in dist/
```

### 2. Run the Local Interactive Playground (✅)
```bash
npm run dev
```
Open [http://localhost:3000/kid-lesson-games/](http://localhost:3000/kid-lesson-games/) to test all 6 games with live controls for game switching, language (`en`/`fr`), age brackets (`3-5`, `6-8`, `9-11`), custom level presets, sound toggling, and real-time telemetry logs.

### 3. Build Outputs (`npm run build` vs. `npm run build:pages`)
- **`npm run build`** (Library mode — ✅ / ⚠️):
  - `dist/kid-games.es.js` (~12.7 kB) + on-demand chunks (`dist/balance-scale-*.js`, `dist/buoyancy-tank-*.js`, `dist/gear-trains-*.js`, `dist/marble-run-angles-*.js`, `dist/pendulum-rhythm-*.js`, `dist/pulley-lift-*.js`, `dist/audio-*.js`, `dist/i18n-*.js`, `dist/confetti.module-*.js`).
  - `dist/kid-games.umd.js` (~236 kB single-file UMD bundle containing core + all 6 games; ⚠️ UMD does not code-split).
- **`npm run build:pages`** (Playground static site — ✅):
  - Builds `dist/index.html` and `dist/assets/*.js` with `base: '/kid-lesson-games/'` for GitHub Pages deployment.

### 4. Install in Another Project via Git Dependency or Local Path (✅)
Because `package.json` includes a `"prepare": "npm run build"` script and exports `./dist/kid-games.es.js`, you can install directly from GitHub or a local checkout:
```bash
# Via GitHub repository:
npm install github:simorml/kid-lesson-games

# Or via local filesystem path:
npm install ../path/to/kid-lesson-games
```

---

## 💻 Embedding in Your Platform

### In Plain HTML / Vanilla JS (✅)
```html
<!-- Option A: ES module (code-split per game chunk) -->
<script type="module" src="./dist/kid-games.es.js"></script>

<!-- Option B: Single-file UMD bundle -->
<!-- <script src="./dist/kid-games.umd.js"></script> -->

<kid-game
  game="balance-scale"
  age="6-8"
  locale="en"
  sound="true">
</kid-game>
```

### In React / Next.js (✅ Client / ⚠️ SSR Note)
> ⚠️ **SSR Note**: `KidGameElement` extends `HTMLElement` at module evaluation time. In Next.js or SSR environments, import the package dynamically inside `useEffect` so it only evaluates in the browser.

```tsx
import React, { useEffect, useRef } from 'react';
// If installed via `npm i github:simorml/kid-lesson-games`, import 'kid-lesson-games'
// or import from your local built bundle path './dist/kid-games.es.js'

export function LessonPage() {
  const gameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Dynamic client-side import registers <kid-game> safely in both SPA and SSR (Next.js)
    import('kid-lesson-games');

    const el = gameRef.current;
    if (!el) return;

    const onProgress = (e: Event) => console.log('Step progress:', (e as CustomEvent).detail);
    const onComplete = (e: Event) => console.log('Stars earned:', (e as CustomEvent).detail.stars);

    el.addEventListener('game:progress', onProgress);
    el.addEventListener('game:complete', onComplete);

    return () => {
      el.removeEventListener('game:progress', onProgress);
      el.removeEventListener('game:complete', onComplete);
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

### In Vue / Nuxt (✅ Client / ⚠️ SSR Note)
```vue
<template>
  <div class="game-wrapper" style="width: 100%; height: 560px;">
    <kid-game
      game="gear-trains"
      :age="currentAge"
      :locale="userLocale"
      @game:score="handleScore"
      @game:complete="handleComplete"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

// Installed via `npm i github:simorml/kid-lesson-games` or local `./dist/kid-games.es.js`
onMounted(() => {
  import('kid-lesson-games');
});

const currentAge = '6-8';
const userLocale = 'fr';

const handleScore = (e) => console.log('Score:', e.detail.points);
const handleComplete = (e) => console.log('Summary:', e.detail.summary);
</script>
```

---

## 🎮 Implemented Games Catalog (6 Cartridges)

All 6 games in `games/*/` support ages **`3-5`**, **`6-8`**, and **`9-11`**, bilingual **`en` / `fr`** localization, procedural Web Audio, and custom `levels` with procedural fallback. (See [docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md) for 🗺️ planned games such as `number-line` and `letter-sound-safari`.)

| Game ID | Title | Category | Ages | Teaches (`skills`) | Locales | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| [`balance-scale`](#1-balance-scale--balance-the-scale-balance-lab--) | Balance the Scale (*⚖️ Balance Lab*) | `numbers` | `3-5`, `6-8`, `9-11` | `addition`, `number-sense`, `visual-physics`, `equilibrium` | `en`, `fr` | ✅ |
| [`buoyancy-tank`](#2-buoyancy-tank--buoyancy-tank--density-lab--) | Buoyancy Tank & Density Lab | `logic` | `3-5`, `6-8`, `9-11` | `density`, `volume-displacement`, `buoyancy`, `spatial-reasoning` | `en`, `fr` | ✅ |
| [`gear-trains`](#3-gear-trains--gear-trains--) | Gear Trains | `logic` | `3-5`, `6-8`, `9-11` | `multiplication`, `ratios`, `rotational-direction`, `spatial-reasoning` | `en`, `fr` | ✅ |
| [`marble-run-angles`](#4-marble-run-angles--marble-run-angles--) | Marble Run Angles | `spatial` | `3-5`, `6-8`, `9-11` | `geometry`, `angles`, `reflection`, `slopes`, `spatial-reasoning` | `en`, `fr` | ✅ |
| [`pendulum-rhythm`](#5-pendulum-rhythm--pendulum-rhythm-lab--) | Pendulum Rhythm Lab | `numbers` | `3-5`, `6-8`, `9-11` | `pendulum-physics`, `periodicity`, `fractions`, `rhythm-sync`, `variable-isolation`, `momentum` | `en`, `fr` | ✅ |
| [`pulley-lift`](#6-pulley-lift--pulley-lift--mechanical-advantage--) | Pulley Lift & Mechanical Advantage | `logic` | `3-5`, `6-8`, `9-11` | `simple-machines`, `fractions`, `work-conservation`, `mechanical-advantage`, `proportional-thinking` | `en`, `fr` | ✅ |

---

### 1. `balance-scale` — Balance the Scale (*Balance Lab*) — ✅

Teaches **metric weights (`g`, `kg`)**, **additive number decomposition**, and **Archimedes lever mechanics ($\tau = m \times d$)**:

| Age Bracket | Educational Focus | Key Mechanics |
| :--- | :--- | :--- |
| **3–5 (Preschool)** | Visual equality & basic metric weights | Equal-arm scale, 1–2 weight comparison, playful colors. |
| **6–8 (Elementary)** | Addition, subtraction & metric decomposition | Equal-arm balance, decomposing $1\text{ kg}$ or $750\text{g}$ into smaller parts. Non-mirroring tray forces mental math. |
| **9–11 (Upper)** | Archimedes lever mechanics & torque multiplication | Dynamic suspension notches ($1, 2, 3, 4$). Drag the right hook stickily along the beam to experience mechanical advantage ($m_L \times d_L = m_R \times d_R$). |

- **Controls**: Click or drag-and-drop weight blocks from the tray onto the right pan; click any stacked weight on the pan to return just that block; drag the right hook or click notch buttons (`1..4`) in lever mode.
- **Tested `levels` Example** (verified against `games/balance-scale/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    left: [1000],                         // 1 kg load on left pan
    inventory: [500, 250, 250, 100],      // Combine 500g + 250g + 250g
    instruction: 'Lesson 1: Balance 1 kg using smaller metric weights!'
  },
  {
    left: [300],                          // 300g load at Notch 4 -> Torque = 1200
    leftNotch: 4,
    rightNotch: 2,                        // Right pan at Notch 2 -> Needs 600g (600 * 2 = 1200)
    inventory: [600, 200, 100],
    leverMode: true,
    instruction: 'Lesson 2: Torque = 1200. Balance at Notch 2!'
  }
];
```

---

### 2. `buoyancy-tank` — Buoyancy Tank & Density Lab — ✅

Teaches **qualitative sink vs. float (`3-5`)**, **graduated cylinder liquid displacement $1\text{ cm}^3 = 1\text{ mL}$ (`6-8`)**, and **submarine neutral buoyancy trim $\rho = m/V$ in freshwater ($1.00\text{ g/cm}^3$) and saltwater ($1.20\text{ g/cm}^3$) (`9-11`)** ([games/buoyancy-tank/README.md](file:///home/simo/Documents/www/kid-lesson-games/games/buoyancy-tank/README.md)).

- **Controls**: Tap or drag objects/ballast modules from the tray into the water tank or submarine pod; tap any submerged or floating item to return it to the tray.
- **Tested `levels` Example** (verified against `games/buoyancy-tank/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    id: 'custom-bt-disp',
    title: 'Graduated Cylinder +300 mL',
    ageGroup: '6-8',
    fluidType: 'freshwater',
    initialWaterMl: 400,
    targetWaterMl: 700,
    tankCapacityMl: 1000,
    inventory: [
      { id: 'b1', name: 'Block 100', label: '100 cm³', volumeCm3: 100, massG: 250 },
      { id: 'b2', name: 'Block 200', label: '200 cm³', volumeCm3: 200, massG: 500 },
      { id: 'b3', name: 'Distractor 150', label: '150 cm³', volumeCm3: 150, massG: 375, isDistractor: true }
    ]
  }
];
```

---

### 3. `gear-trains` — Gear Trains — ✅

Teaches **spatial cause-and-effect windmill bridging (`3-5`)**, **odd/even rotational direction reversal & $1:2$ speed doubling (`6-8`)**, and **tooth ratios $\omega_2 = -\omega_1 (N_1/N_2)$, RPM kinematics & LCM tooth synchronization (`9-11`)**, including real odd-cycle triangle jam detection ([games/gear-trains/README.md](file:///home/simo/Documents/www/kid-lesson-games/games/gear-trains/README.md)).

- **Controls**: Tap or drag gears ($6\text{T}, 8\text{T}, 12\text{T}, 16\text{T}, 24\text{T}$) onto open pegs; tap a placed gear to return it to the inventory tray.
- **Tested `levels` Example** (verified against `games/gear-trains/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    id: 'custom-gear-3x',
    title: '3:1 Speed Tripler',
    ageGroup: '9-11',
    motor: { pegId: 'motor', x: 160, y: 230, teeth: 24, rpm: 40, direction: 'cw' },
    target: { pegId: 'target', x: 480, y: 230, teeth: 8, targetRpm: 120, targetDirection: 'cw', type: 'dial' },
    pegs: [{ id: 'p1', x: 360, y: 230 }],
    inventory: [{ teeth: 16 }, { teeth: 12 }, { teeth: 6 }],
    instruction: 'Bridge the 24T motor and 8T target with a 16T idler gear to reach 120 RPM CW!'
  }
];
```

---

### 4. `marble-run-angles` — Marble Run Angles — ✅

Teaches **slope bridging (`3-5`)**, **$15^\circ$ discrete ramp rotation & acute/right/obtuse angle classification around obstacle pegs (`6-8`)**, and **the law of specular reflection ($\theta_i = \theta_r$) comparing low-restitution wood ramps ($e=0.5$) vs. bouncy trampolines ($e=0.9$) (`9-11`)** ([games/marble-run-angles/README.md](file:///home/simo/Documents/www/kid-lesson-games/games/marble-run-angles/README.md)).

- **Controls**: Tap or drag ramps/trampolines into glowing pegboard slots; tap placed ramps to rotate by $15^\circ$ increments; tap **Launch** (`▶`) to release the marble.
- **Tested `levels` Example** (verified against `games/marble-run-angles/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    id: 'custom-chasm-1',
    title: 'Custom Chasm Bounce',
    mode: 'reflection',
    emitter: { x: 140, y: 50, vx: 0, vy: 40 },
    cup: { x: 600, y: 350, width: 80, height: 44 },
    fixedRamps: [{ x1: 360, y1: 320, x2: 570, y2: 340, type: 'wood', restitution: 0.5 }],
    obstacles: [{ x: 280, y: 440, radius: 24 }],
    slots: [{ id: 'slot-1', x: 140, y: 190, allowedTypes: ['wood', 'trampoline'], initialAngle: 45 }],
    inventory: [
      { type: 'trampoline', angleDeg: 45, length: 120, restitution: 0.9 },
      { type: 'wood', angleDeg: 45, length: 120, restitution: 0.5 }
    ],
    stars: [{ x: 260, y: 230 }, { x: 460, y: 310 }],
    instruction: 'Snap the bouncy trampoline into the slot to launch across the chasm!'
  }
];
```

---

### 5. `pendulum-rhythm` — Pendulum Rhythm Lab — ✅

Teaches **wrecking-ball momentum knockdown (`3-5`)**, **variable isolation & Galileo's pendulum law (string length $L$ controls swing period $T = 2\pi\sqrt{L/g}$, while bob mass does not) synced to a musical BPM metronome (`6-8`)**, and **non-linear square-root polyrhythms ($L_B/L_A = (p/q)^2$ for $2:1, 3:1, 3:2$ harmonic ratios) (`9-11`)** ([games/pendulum-rhythm/README.md](file:///home/simo/Documents/www/kid-lesson-games/games/pendulum-rhythm/README.md)).

- **Controls**: Drag the pendulum bob to set release angle (or use angle preset buttons in `3-5`), select string lengths (`cm`) and bob masses (`g`), or tap **Release Together** in dual-pendulum polyrhythm mode.
- **Tested `levels` Example** (verified against `games/pendulum-rhythm/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    id: 'custom-poly-1',
    ageGroup: '9-11',
    mode: 'polyrhythm',
    title: 'Custom 2:1 Polyrhythm',
    prompt: 'Set Pendulum B to 100cm so length ratio is (2/1)² = 4!',
    pendulums: [
      { id: 'pendulum-a', pivotX: 220, pivotY: 55, length: 25, mass: 100, isAdjustableLength: false },
      {
        id: 'pendulum-b',
        pivotX: 380,
        pivotY: 55,
        length: 50,
        mass: 100,
        isAdjustableLength: true,
        allowedLengths: [25, 50, 75, 100]
      }
    ],
    availableLengths: [25, 50, 75, 100],
    polyrhythm: { ratioP: 2, ratioQ: 1, targetCoincidences: 2 }
  }
];
```

---

### 6. `pulley-lift` — Pulley Lift & Mechanical Advantage — ✅

Teaches **simple machines, mechanical advantage ($MA \in \{1, 2, 3, 4\}$), force division ($F_{\text{effort}} = F_{\text{load}} / MA$), rope distance multiplication ($d_{\text{effort}} = MA \cdot d_{\text{load}}$), and conservation of work ($W = F \times d$ in Joules)** across fixed (`fixed-1`), movable (`movable-2`), and compound block-and-tackle (`compound-3`, `compound-4`) cranes ([games/pulley-lift/README.md](file:///home/simo/Documents/www/kid-lesson-games/games/pulley-lift/README.md)).

- **Controls**: Tap or drag metric counterweights (`kg`) from the inventory into the suspended effort tray; tap any placed weight in the effort tray to return it.
- **Tested `levels` Example** (verified against `games/pulley-lift/index.ts#parseCustomLevels`):
```js
gameEl.levels = [
  {
    id: 'custom-pulley-4x',
    title: 'Compound 4x Hoist',
    loadKg: 240,
    targetHeightM: 2.0,
    systemType: 'compound-4',
    availableWeights: [40, 20, 30, 50],
    instruction: '4-pulley compound tackle (MA = 4)! Combine 40 kg + 20 kg = 60 kg to lift 240 kg.'
  }
];
```

---

## ⚙️ Component API Reference ([src/core/KidGameElement.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/KidGameElement.ts))

### Attributes & Properties

| HTML Attribute | JS Property Getter | JS Property Setter | Type | Default | Status & Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `game` | `el.gameId` (⚠️) | *(use `setAttribute('game', id)`)* | `string` | `""` | ✅ Unique game ID (e.g. `"balance-scale"`, `"gear-trains"`). |
| `age` | `el.age` | *(use `setAttribute('age', val)`)* | `'3-5' \| '6-8' \| '9-11'` | `'6-8'` | ✅ Target age bracket for curriculum scaling. |
| `difficulty` | `el.difficulty` | *(use `setAttribute('difficulty', val)`)* | `'easy' \| 'medium' \| 'hard'` | `'medium'` | ✅ Passed in `context.difficulty`; all 6 cartridges scale puzzles, tolerances, and distractors by difficulty. |
| `locale` | `el.locale` | *(use `setAttribute('locale', val)`)* | `string` (`'en'`, `'fr'`) | `'en'` | ✅ UI language (`I18nManager` normalizes regional tags like `'fr-FR'` $\rightarrow$ `'fr'`). |
| `sound` | `el.sound` | *(use `setAttribute('sound', val)`)* | `boolean` (`attr !== 'false'`) | `true` | ✅ Enables or mutes procedural Web Audio SFX (`el.audio.enabled`). |
| `autostart` | `el.autostart` | *(use `setAttribute('autostart', val)`)* | `boolean` (`attr !== 'false'`) | `true` | ✅ Automatically calls `game.start()` and dispatches `game:start` after mount. |
| `levels` | `el.levels` | `el.levels = [...]` | `unknown` (array or JSON string) | `null` | ✅ Custom level sequence (`context.customLevels`). Falls back to procedural generation when `null` or invalid. |

### Methods (via Element DOM Reference — ✅)
```ts
const gameEl = document.querySelector('kid-game') as KidGameElement;

gameEl.start();    // Starts active gameplay round
gameEl.pause();    // Pauses game timers/animations (supported in all 6 games)
gameEl.resume();   // Resumes gameplay
gameEl.restart();  // Tears down and reloads the active game
```

### Telemetry & Event Bridge (`bubbles: true, composed: true` — ✅)
All `game:*` events are dispatched as standard `CustomEvent` instances with `bubbles: true, composed: true` so they cross the Shadow DOM boundary:
- `game:ready` $\rightarrow$ `{ gameId: string }`
- `game:start` $\rightarrow$ `{ gameId: string }`
- `game:progress` $\rightarrow$ `{ step: number; total: number; detail?: string }`
- `game:score` $\rightarrow$ `{ points: number; streak?: number; delta?: number }`
- `game:complete` $\rightarrow$ `{ stars: 1 | 2 | 3; score: number; timeElapsed: number; summary?: string }`
- `game:error` $\rightarrow$ `{ message: string; code?: string }`

---

## 🛠️ Adding New Games (Contributor & AI Workflow)

Scaffold a new game cartridge with a single command ([scripts/create-game.js](file:///home/simo/Documents/www/kid-lesson-games/scripts/create-game.js)):

```bash
npm run create-game <game-id>
```

The CLI generator automatically scaffolds all 6 production files (`game.json`, `assets/thumb.svg`, `i18n.ts`, `index.ts`, `index.test.ts`, and `README.md`) implementing the full zero-leak lifecycle contract (`AbortController`, `pendingTimeouts`, `ResizeObserver`, `pause()`/`resume()`), dual-curriculum `generateLevelsForAge(age, difficulty)` with `parseCustomLevels()`, and a passing Vitest suite. See [AGENTS.md](file:///home/simo/Documents/www/kid-lesson-games/AGENTS.md) for contribution rules.

---

## 📁 Repository Structure

```text
kid-lesson-games/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml      # ✅ GitHub Actions workflow deploying playground to GitHub Pages
├── docs/
│   ├── ARCHITECTURE.md           # ✅ Verified architecture reference (today vs. target)
│   ├── VISION.md                 # ✅ Vision, pedagogy, roadmap & Gap Analysis
│   └── design/                   # ✅/🚧 Original design & math specifications
│       ├── balance-scale-math-spec.md
│       ├── game-contract-spec.md
│       └── web-component-spec.md
├── games/
│   ├── balance-scale/            # ✅ Numbers: Metric weights, decomposition & Archimedes lever
│   │   ├── assets/thumb.svg
│   │   ├── audio.ts
│   │   ├── audio.test.ts
│   │   ├── game.json
│   │   ├── i18n.ts
│   │   ├── i18n.test.ts
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── buoyancy-tank/            # ✅ Logic: Sink/float, mL displacement & submarine density trim
│   │   ├── assets/thumb.svg
│   │   ├── README.md
│   │   ├── game.json
│   │   ├── i18n.ts
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── gear-trains/              # ✅ Logic: Gear ratios, rotational direction parity & LCM
│   │   ├── assets/thumb.svg
│   │   ├── README.md
│   │   ├── game.json
│   │   ├── i18n.ts
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── marble-run-angles/        # ✅ Spatial: Ramp slopes, 15° angles & specular reflection
│   │   ├── assets/thumb.svg
│   │   ├── README.md
│   │   ├── game.json
│   │   ├── i18n.ts
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── pendulum-rhythm/          # ✅ Numbers: Momentum knockdown, BPM sync & √L polyrhythms
│   │   ├── assets/thumb.svg
│   │   ├── README.md
│   │   ├── game.json
│   │   ├── i18n.ts
│   │   ├── index.ts
│   │   └── index.test.ts
│   └── pulley-lift/              # ✅ Logic: Simple machines, MA (1..4) & work conservation
│       ├── assets/thumb.svg
│       ├── README.md
│       ├── game.json
│       ├── i18n.ts
│       ├── index.ts
│       └── index.test.ts
├── scripts/
│   └── create-game.js            # ✅ CLI scaffolding tool (npm run create-game <id>)
├── src/
│   ├── core/
│   │   ├── KidGameElement.ts     # ✅ <kid-game> custom element & Shadow DOM host
│   │   ├── KidGameElement.test.ts
│   │   ├── audio.ts              # ✅ Shared procedural Web Audio engine (SoundEngine)
│   │   ├── audio.test.ts
│   │   ├── i18n.ts               # ✅ Core i18n resolver & dictionaries (I18nManager)
│   │   ├── i18n.test.ts
│   │   ├── registry.ts           # ✅ Dynamic game registry with lazy factory support
│   │   ├── registry.test.ts
│   │   └── types.ts              # ✅ TypeScript interfaces & telemetry event contracts
│   ├── index.ts                  # ✅ Main library entry point & import.meta.glob discovery
│   └── index.test.ts
├── AGENTS.md                     # ✅ AI agent & contributor guide
├── README.md                     # ✅ Project front door & quick reference
├── TODO.md                       # ✅ Roadmap grouped by vision themes
├── index.html                    # ✅ Interactive browser playground & telemetry inspector
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 📄 License

MIT License © 2026 [simorml](https://github.com/simorml). Free to use and integrate into educational platforms!
