# 🤖 AGENTS.md — AI Agent & Contributor Guide for `kid-lesson-games`

## ⚡ 10-Line Cold-Start Orientation
1. **Purpose**: Pluggable collection of interactive educational mini-games (Ages `3-5`, `6-8`, `9-11`) embedded via a framework-agnostic `<kid-game>` Web Component.
2. **Tech Stack**: TypeScript (strict), Vite 8, HTML5 Canvas 2D / SVG / CSS, procedural Web Audio API (`SoundEngine`), `canvas-confetti`, Vitest + `jsdom`.
3. **Core Engine (`src/`)**: `src/index.ts` (auto-discovery via `import.meta.glob`), `src/core/KidGameElement.ts` (`<kid-game>` Shadow DOM host), `registry.ts`, `audio.ts`, `i18n.ts`, `types.ts`.
4. **Game Cartridges (`games/<game-id>/`)**: Isolated modules (`game.json`, `index.ts`, `i18n.ts`, `index.test.ts`, `README.md`). Currently 6 games: `balance-scale`, `buoyancy-tank`, `gear-trains`, `marble-run-angles`, `pendulum-rhythm`, `pulley-lift`.
5. **Zero Core Edits Rule**: Never modify `src/` when creating or updating a game cartridge; Vite discovers `games/*/{game,meta}.json` and `games/*/index.ts` automatically.
6. **Scaffold a Game**: Run `npm run create-game <game-id>` (generates `game.json`, `index.ts`, `README.md`; add `i18n.ts` and `index.test.ts` manually).
7. **Run Dev Playground**: `npm run dev` (starts Vite server on `http://localhost:3000/kid-lesson-games/`, serving `index.html`).
8. **Run Unit Tests**: `npm test` (`vitest run` across `src/**/*.test.ts` and `games/**/*.test.ts`).
9. **Build Library**: `npm run build` (`tsc && vite build` $\rightarrow$ ES chunks `dist/kid-games.es.js` + `dist/<game>-*.js`, and monolithic UMD `dist/kid-games.umd.js`).
10. **Build Playground (GitHub Pages)**: `npm run build:pages` (`tsc && vite build --mode pages` $\rightarrow$ `dist/index.html` + `dist/assets/*.js`).

---

## 🏷️ Status Legend & Ground-Truth Rule

- ✅ **Implemented**: Exists in code on disk and verified working (build or run it to check).
- 🚧 **Partial**: Exists in code but incomplete or unverified (notes state what is missing).
- 🗺️ **Planned**: Part of the vision/target architecture, not built yet.
- ⚠️ **Known discrepancy**: Code and old docs disagreed (notes state how it was resolved).

> [!IMPORTANT]
> **Mandatory Agent Rule**: Only treat ✅ as true. Treat 🗺️ as intent to move toward, never as existing behavior. Never write code or docs that assume a 🗺️ feature exists. When you finish a feature, update its label and the Gap analysis in [docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md).

### Key Documentation Map
- **Why & Target State**: [docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md) — philosophy, pedagogical mission, curriculum categories, and Gap Analysis table.
- **How It Works Now**: [docs/ARCHITECTURE.md](file:///home/simo/Documents/www/kid-lesson-games/docs/ARCHITECTURE.md) — verified walkthrough of `src/`, `<kid-game>`, `GameRegistry`, `GameContext`, telemetry events, and build outputs.
- **What's Next**: [TODO.md](file:///home/simo/Documents/www/kid-lesson-games/TODO.md) — prioritized roadmap grouped by vision themes.
- **Original Design Specs**: [docs/design/game-contract-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/game-contract-spec.md), [docs/design/web-component-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/web-component-spec.md), [docs/design/balance-scale-math-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/balance-scale-math-spec.md).

---

## 1. Zero Core Modification & Cartridge Isolation Rule (✅)
- **Never edit files in `src/`** when creating or updating a game cartridge.
- Vite automatically discovers metadata (`games/*/{game,meta}.json`) and lazily code-splits entrypoints (`games/*/index.ts`) via `import.meta.glob` in ES builds.
- **Zero External Runtime Assets**: Never fetch remote images, icons, audio files, or fonts (which fail offline or add latency). Render all visuals using HTML5 Canvas 2D, SVG, or pure CSS, use `context.audio` for procedural Web Audio SFX, and `canvas-confetti` for celebratory bursts.

---

## 2. Fast Scaffolding & File Layout (`create-game` Workflow)
Initialize a new cartridge with the CLI generator ([scripts/create-game.js](file:///home/simo/Documents/www/kid-lesson-games/scripts/create-game.js)):

```bash
npm run create-game <game-id>
# Example: npm run create-game number-line
```

> ⚠️ **Note on `create-game` output (🚧 Partial)**: `scripts/create-game.js` generates starter `game.json`, `index.ts`, and `README.md`. To reach full ✅ production status, you **must** also create `i18n.ts` and `index.test.ts` and upgrade `index.ts` to the full zero-leak lifecycle shown below.

Required cartridge structure for a ✅ game:
```text
games/<game-id>/
├── game.json        # Taxonomy, age brackets, skills, title (canonical filename)
├── index.ts         # KidGame implementation, pure level/math helpers & createGame() factory
├── i18n.ts          # Typed EN/FR dictionary using createI18nResolver
├── index.test.ts    # Deterministic unit tests + DOM mount/start/updateConfig/destroy tests
└── README.md        # Educational purpose, age progression, math formulas & mechanics
```

---

## 3. Contribution Contract: What Must Be True for a Game to Count as ✅

A game cartridge may only be labeled ✅ **Implemented** when ALL of the following are verified:
1. **Implements Full `KidGame` Lifecycle**: Exports `createGame(): KidGame` and `export default createGame` in `games/<id>/index.ts` implementing `mount`, `start`, `pause`, `resume`, `updateConfig`, and zero-leak `destroy`.
2. **Has Valid Metadata (`game.json`)**: Declares `id`, `title`, `version`, `description`, `author`, `category` (`"numbers" | "letters" | "logic" | "spatial"`), `ageGroups` (`["3-5", "6-8", "9-11"]`), and `skills`.
3. **Bilingual i18n (`en` & `fr`)**: Uses `createI18nResolver` in `games/<id>/i18n.ts` with complete English and French strings and updates live inside `updateConfig` when `newContext.locale` changes.
4. **Dual Curriculum + Working `levels` Example**: Exports `generateLevelsForAge(ageGroup)` and defensive `parseCustomLevels(raw: unknown)` (returning `null` on invalid input so the game falls back to procedural generation), plus a tested custom `levels` example in `README.md` and `index.html`.
5. **Vitest Suite Passes (`games/<id>/index.test.ts`)**: Deterministic unit tests for domain math, age-bracket rules (`3-5`, `6-8`, `9-11`), anti-mirroring invariants, `parseCustomLevels`, and DOM lifecycle (`mount` $\rightarrow$ `start` $\rightarrow$ `pause`/`resume` $\rightarrow$ `updateConfig` $\rightarrow$ `destroy`).
6. **Appears in the Playground (`index.html`)**: Listed in `<select id="select-game">` and `customPresetsByGame` in `index.html`.

---

## 4. Pedagogical Design & Curriculum Quality Bar
Great educational games teach *concepts*, not button-mashing. Apply these standards:

1. **Meaningful Age Bracket Differentiation** (never just scale up the numbers):
   - **`3-5` (Preschool)**: Concrete visual/tactile counting, direct 1-to-1 correspondence, 1–2 elements per step, clear color/shape coding, immediate feedback.
   - **`6-8` (Early Elementary)**: Multi-step composition/decomposition and **Anti-Mirroring Rule**—forbid trivial 1-to-1 visual copying (e.g., if target is `500g`, don't put a single `500g` block in the tray; require combining `250g + 250g` or `200g + 200g + 100g`), plus real metric conversions.
   - **`9-11` (Upper Elementary)**: Multi-variable reasoning, ratios, fractions, or physical laws (e.g., Archimedes lever torque $\tau = m \times d$, hydrostatics $\rho = m/V$, pendulum period $T = 2\pi\sqrt{L/g}$).
2. **Guaranteed Solvability + Plausible Distractors**:
   - Procedural puzzle generators must construct or mathematically prove a valid solution path *before* mixing in 1–2 plausible distractor pieces.
3. **Live Pedagogical Scaffolding**:
   - Update the HUD instruction text dynamically as the child interacts (e.g., showing current live totals, equation progress, or gentle hints like *"Move hook to a notch that divides 750 evenly"*) without revealing the exact final click.
4. **Dual Curriculum Mode (`customLevels` + Procedural Fallback)**:
   - Always export a defensive `parseCustomLevels(raw: unknown)` validator that safely sanitizes LMS-supplied levels and seamlessly falls back to `generateLevelsForAge(ageGroup)` when `context.customLevels` is omitted or invalid.
5. **Metric & European Standards**:
   - Always use real metric units (`g`, `kg`, `cm`, `m`, `L`, `mL`, `N`, `J`) and consistent decimal/space formatting per locale.

---

## 5. Smooth "Vibe", Tactile UX & Visual Polish
A cartridge should feel alive, forgiving, and rewarding on both desktop mice and children's touchscreens:

1. **Dual Input Ergonomics (Tap/Click AND Drag-and-Drop)**:
   - Support *both* quick click/tap placement and continuous drag-and-drop. Distinguish them using a small movement threshold (e.g. `~5px`) and generous snap/drop radii (`40–90px`) with interactive targets at least **44×44px**.
2. **Granular Undo**:
   - Clicking or tapping a placed manipulative should return that exact piece back to the tray rather than forcing a full level reset.
3. **Physics & Motion "Juice"**:
   - Use spring-damper physics (`stiffness`, `damping`, `velocity`) or smooth easing curves instead of teleporting state changes.
   - Provide hover/grab cursor states and subtle button scale transitions.
   - Include a brief settling/confirmation window (`~0.5–0.8s`) once the win condition is reached so the child visually observes *why* their answer succeeded before advancing.
4. **Celebratory Feedback**:
   - Combine `context.audio.playSuccess()`, a `canvas-confetti` burst, and a localized banner (`✨ Well Done!`) on round completion.
5. **Cohesive Visual System & HiDPI Canvas**:
   - Match the dark-slate playground palette (`#0f172a` / `#1e293b` surfaces, `#f8fafc` primary text, `#38bdf8` sky accent, `#fbbf24` gold score/stars, high-contrast semantic manipulatives).
   - Standardize the HUD: Title + Level badge (`1/3`) on the left, live Instruction prompt centered, Score + Sound toggle (`context.audio.enabled`) + Reset button on the right.
   - Scale Canvas 2D dimensions responsively via `ResizeObserver` and `window.devicePixelRatio` for razor-sharp rendering on Retina displays and tablets.

---

## 6. The `KidGame` Lifecycle & Robustness Contract
Your `index.ts` must export `createGame(): KidGame` and `export default createGame`:

```typescript
import type { GameContext, KidGame } from '../../src/core/types.js';

export class MyGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private abortController: AbortController | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();
    // 1. Render DOM/Canvas, attach ResizeObserver, bind listeners with { signal: this.abortController.signal }
    // 2. Guard for test/headless envs: check `if (typeof ResizeObserver !== 'undefined')` and `canvas.getContext('2d')`
  }

  start(): void {
    // Begin gameplay round, start timers/rAF loop, enable interactions
  }

  pause(): void {
    // Freeze active timers / physics loops when host pauses
  }

  resume(): void {
    // Unfreeze active timers / physics loops
  }

  updateConfig(newContext: Partial<GameContext>): void {
    // Handle live attribute updates without remounting:
    // newContext.sound, newContext.locale, newContext.difficulty, newContext.ageGroup, newContext.customLevels
    // NOTE: Do NOT replace `this.context = newContext as GameContext` directly because
    // KidGameElement.propagateConfigUpdate() omits `emit`. Merge properties instead.
  }

  destroy(): void {
    // MANDATORY ZERO-LEAK TEARDOWN:
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
}

export function createGame(): KidGame {
  return new MyGame();
}
export default createGame;
```

**Robustness Rules**:
- **Zero-Leak Teardown**: Always remove `window` listeners (`mousemove`, `mouseup`, `touchmove`, `touchend`), cancel `requestAnimationFrame`, clear all `setTimeout`/`setInterval` handles (especially level-advance timers), and disconnect `ResizeObserver` in `destroy()`. Passing `{ signal: abortController.signal }` to `addEventListener` makes window listener cleanup effortless.
- **Do Not Close Shared `context.audio` in `destroy()`**: `context.audio` belongs to the host `<kid-game>` element (`KidGameElement` closes it in `disconnectedCallback()`). Cartridges must not call `this.context.audio.close()` in `destroy()`.
- **Headless/Test Environment Safety**: Always guard `canvas.getContext('2d')` (may be `null` in `jsdom`) and `ResizeObserver` so unit tests run cleanly without crashing.

---

## 7. Shared Core Utilities & Telemetry (`GameContext`)

### A. Procedural Audio (`context.audio`) — ✅
Never create raw `AudioContext` instances in cartridges. Use the injected `SoundEngine` ([src/core/audio.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/audio.ts)):
- `context.audio.playClick()`: Short tactile UI tap
- `context.audio.playPop()`: Bubble pop or item pick up
- `context.audio.playDrop()`: Weight placement or block snap
- `context.audio.playChime()`: Step or milestone completion
- `context.audio.playSuccess()`: Multi-note victory fanfare
- `context.audio.playError()`: Gentle low buzz for invalid moves
- `context.audio.playTone(freq, duration, type, options)`: Custom synth tone

### B. Internationalization (`context.i18n` & `context.t`) — ✅
- Shared UI tokens (`soundOn`, `soundOff`, `score`, `level`, `reset`, `wellDone`, `loading`, `error`) are available via `context.t('key')`.
- For cartridge-specific strings and dynamic pedagogical formatters, use `createI18nResolver` in `i18n.ts`:
  ```typescript
  import { createI18nResolver } from '../../src/core/i18n.js';

  export const DICTIONARY = {
    en: { prompt: 'Balance {target}g!' },
    fr: { prompt: 'Équilibrez {target}g !' }
  };
  export const getTranslations = createI18nResolver(DICTIONARY, 'en');
  ```

### C. Standard Telemetry Events (`context.emit`) — ✅
All events emitted via `context.emit` are dispatched on `<kid-game>` as `CustomEvent`s with `bubbles: true, composed: true`:
```typescript
this.context.emit('game:progress', { step: 1, total: 3, detail: 'Solved level 1' });
this.context.emit('game:score', { points: 100, streak: 1, delta: 100 });
this.context.emit('game:complete', {
  stars: 3,             // 1 | 2 | 3
  score: 300,
  timeElapsed: 25,      // seconds
  summary: 'All levels completed!'
});
```

---

## 8. Known Gotchas & Discrepancies (⚠️)

1. ⚠️ **Metadata Filename (`game.json` vs `meta.json`)**:
   - Old README text mentioned `meta.json`. In fact, `scripts/create-game.js` generates `game.json`, and all 6 cartridges use `game.json`. `src/index.ts` globs both `game.json` and `meta.json`, so **always use `game.json`** as the canonical filename.
2. ⚠️ **UMD Bundle Cannot Code-Split (`dist/kid-games.umd.js`)**:
   - ES module builds (`dist/kid-games.es.js`, ~12.7 kB) split each cartridge into its own on-demand chunk (`dist/<game-id>-*.js`). However, UMD format does not support code-splitting dynamic imports, so `dist/kid-games.umd.js` (~236 kB) bundles all 6 games into a single file.
3. ⚠️ **Library Build vs. Playground Build (`vite.config.ts`)**:
   - Default `npm run build` runs Vite in library mode (`build.lib`), which outputs JS bundles to `dist/` and ignores `index.html`. To build the interactive playground static site (`dist/index.html` + `dist/assets/`), use `npm run build:pages` (`vite build --mode pages`).
4. ⚠️ **Not Published to npm Yet (`"private": true`)**:
   - `kid-lesson-games` is not published on the public npm registry yet (🗺️ Planned). Do not instruct users to run `npm install kid-lesson-games`; use git dependency (`npm i github:simorml/kid-lesson-games`), local path, or built `./dist/kid-games.es.js`.
5. ⚠️ **No `.d.ts` Emission in `dist/` Yet**:
   - `tsconfig.json` has `"noEmit": true`, so `tsc` only type-checks. `package.json` points `"types"` to `./src/index.ts`.
6. ⚠️ **Node.js SSR Import Throws `ReferenceError: HTMLElement is not defined`**:
   - `src/core/KidGameElement.ts` declares `export class KidGameElement extends HTMLElement` at module top-level. In SSR frameworks (Next.js, Nuxt), import the library dynamically inside `useEffect` / `onMounted` or with `{ ssr: false }`.
7. ⚠️ **`KidGameElement` Property vs. Attribute Quirks**:
   - The getter for the `game` attribute is `el.gameId` (there is no `el.game` property).
   - Only `el.levels` has a JS property setter (`el.levels = [...]`). Once `el.levels` is set to a non-null value via JS property, `this._customLevels` takes precedence over `el.setAttribute('levels', ...)` until `el.levels = null` is assigned.
8. ⚠️ **`context.difficulty` Is Currently Ignored by Cartridges (🚧 Partial)**:
   - `<kid-game difficulty="easy|medium|hard">` is parsed and passed in `context.difficulty`, but the 6 existing games only branch level generation by `context.ageGroup` (`3-5`, `6-8`, `9-11`).
9. ⚠️ **`src/index.ts` Drops `author` and `thumbnail` from `GameMetadata`**:
   - `src/index.ts` constructs `GameMetadata` without copying `raw.author` or `raw.thumbnail`, and 4 of the 6 games (`balance-scale`, `buoyancy-tank`, `marble-run-angles`, `pulley-lift`) do not yet have `assets/thumb.svg` on disk.
10. ✅ **`games/balance-scale` Lifecycle (resolved)**:
    - Fixed in PR #27: `AbortController` window-listener cleanup, tracked timeouts cleared in `destroy()`, `pause()`/`resume()`, no `audio.close()`, and a `README.md` was added.
11. ⚠️ **Unused `matter-js` Dependency in `package.json`**:
    - `matter-js` is listed in `package.json`, but zero files in `src/` or `games/` import it; all 6 cartridges use custom deterministic TypeScript physics.

---

## 9. Agent "Definition of Done" Checklist

Before declaring any task or new cartridge complete, verify every item below:
- [ ] **Zero Core Leaks**: `git status --porcelain src/` is clean (if building a cartridge), and `destroy()` cleans up all `requestAnimationFrame`, `setTimeout`, `ResizeObserver`, and `window` listeners (`AbortController`).
- [ ] **Tests Pass**: `npm test` passes 100% of Vitest suites with zero unhandled errors.
- [ ] **Builds Pass**: Both `npm run build` (library ES + UMD) and `npm run build:pages` (playground app) succeed with zero TypeScript or Vite errors.
- [ ] **Playground Updated**: Any new game is added to `<select id="select-game">` and `customPresetsByGame` in `index.html`, with its custom `levels` preset verified against `parseCustomLevels()`.
- [ ] **Status Labels Updated**: Update status labels (✅ / 🚧 / 🗺️ / ⚠️) in `README.md`, `TODO.md`, and the Gap Analysis table in [docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md).
