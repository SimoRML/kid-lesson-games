# 🏗️ Architecture Reference (`kid-lesson-games`)

> Verified against `src/`, `games/`, `scripts/create-game.js`, and `vite.config.ts`.

## 🏷️ Status Legend

- ✅ **Implemented**: Exists in code on disk and verified working (via tests or build).
- 🚧 **Partial**: Exists in code but incomplete or unverified (notes specify what is missing).
- 🗺️ **Planned**: Part of the project vision and target architecture, not built yet.
- ⚠️ **Known discrepancy**: Code and earlier documentation disagreed (notes specify how it was resolved).

---

## 1. How the Code Works Today (✅ Implemented)

```mermaid
flowchart TD
    subgraph HostDOM ["Host Application DOM"]
        Tag["&lt;kid-game game='balance-scale' age='6-8' locale='en'&gt;&lt;/kid-game&gt;"]
    end

    subgraph Core ["src/ (Core Runtime)"]
        Entry["src/index.ts<br/>import.meta.glob discovery &amp; customElements.define"]
        Element["src/core/KidGameElement.ts<br/>Shadow DOM (#status + #slot), currentLoadToken, Event Bridge"]
        Registry["src/core/registry.ts<br/>GameRegistry (register, get, has, list, create)"]
        Audio["src/core/audio.ts<br/>SoundEngine (Web Audio API synthesizer)"]
        I18n["src/core/i18n.ts<br/>I18nManager + createI18nResolver (en/fr)"]
    end

    subgraph Cartridges ["games/* (Isolated Game Cartridges)"]
        Meta["games/*/game.json<br/>(Eagerly loaded metadata)"]
        Mod["games/*/index.ts<br/>(Lazily loaded createGame() factory)"]
    end

    Entry -->|Eager glob| Meta
    Entry -->|Lazy glob factory| Mod
    Entry -->|Populates| Registry
    Tag --> Element
    Element -->|registry.create(id)| Registry
    Element -->|Injects GameContext| Audio
    Element -->|Injects GameContext| I18n
    Element -->|mount / start / updateConfig / destroy| Mod
    Mod -->|context.emit('game:*', payload)| Element
    Element -->|CustomEvent (bubbles: true, composed: true)| HostDOM
```

---

### A. Entry Point & Auto-Discovery ([src/index.ts](../src/index.ts)) — ✅

When [src/index.ts](../src/index.ts) is imported:
1. **Eager Metadata Discovery** (lines 6–9):
   - Uses `import.meta.glob(['../games/*/game.json', '../games/*/meta.json'], { eager: true })`.
   - ⚠️ **Known discrepancy**: Earlier README sections referred to `meta.json` while `balance-scale` used `game.json`. In reality, [scripts/create-game.js](../scripts/create-game.js) generates `game.json` and all 6 cartridges in `games/*/` use `game.json`. `src/index.ts` accepts both `game.json` (canonical) and `meta.json` (fallback alias).
   - ✅ **Resolved**: `src/index.ts` (lines 19–29) preserves `author` and `thumbnail` when constructing `GameMetadata`, and all 6 games feature `assets/thumb.svg` vector badges on disk.
2. **Lazy Cartridge Code-Splitting** (lines 12–48):
   - Uses `import.meta.glob('../games/*/index.ts')` (lazy by default).
   - Registers an async factory with `registry.register(meta, async () => ...)` that resolves `mod.createGame || mod.default || mod.createBalanceScaleGame`.
3. **Custom Element Registration** (lines 51–53):
   - Calls `customElements.define('kid-game', KidGameElement)` after the registry is populated, guarded by `if (typeof window !== 'undefined' && !customElements.get('kid-game'))`.
   - ⚠️ **SSR Note**: Although `customElements.define` is guarded by `typeof window !== 'undefined'`, [KidGameElement.ts](../src/core/KidGameElement.ts) evaluates `export class KidGameElement extends HTMLElement` at module load time, which throws `ReferenceError: HTMLElement is not defined` if imported on the server in Node.js without a DOM shim. In SSR frameworks (Next.js, Nuxt), import the bundle dynamically inside a client-only lifecycle hook (`useEffect` / `onMounted`).

---

### B. Game Registry ([src/core/registry.ts](../src/core/registry.ts)) — ✅

`GameRegistry` (exported as singleton `registry` and class `GameRegistry`) stores a `Map<string, { metadata: GameMetadata; load: GameFactory }>` with methods:
- `registry.register(metadata, load)` — ✅
- `registry.get(id)` — ✅ returns `{ metadata, load } | undefined`
- `registry.has(id)` — ✅ returns `boolean`
- `registry.list()` — ✅ returns `GameMetadata[]` synchronously (used by the playground selector in `index.html`)
- `registry.create(id)` — ✅ awaits `entry.load()` and returns `Promise<{ game: KidGame; metadata: GameMetadata }>` (throws if `id` is not registered)
- `registry.clear()` — ✅ clears registered entries (used in unit tests)

---

### C. Web Component Host ([src/core/KidGameElement.ts](../src/core/KidGameElement.ts)) — ✅

`KidGameElement` attaches an open Shadow DOM (`this.attachShadow({ mode: 'open' })`) containing:
- `<div class="viewport">`
  - `<div class="status-screen" id="status">` — displays a CSS spinner + localized loading text during async import/mount, or an error screen if loading fails. Its content is built with DOM APIs and `textContent` (never `innerHTML`), so error messages are always shown as plain text.
  - `<div class="game-slot" id="slot">` — the `HTMLElement` container passed to `game.mount(container, context)`.

#### Observed Attributes & DOM Properties

| HTML Attribute | JS Property Getter | JS Property Setter | Type | Default | Status & Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `game` | `el.gameId` (⚠️ not `el.game`) | *(use `setAttribute('game', id)`)* | `string` | `""` | ✅ Changing `game` increments `currentLoadToken`, tears down the active game, and mounts the new cartridge. |
| `age` | `el.age` | *(use `setAttribute('age', val)`)* | `'3-5' \| '6-8' \| '9-11'` | `'6-8'` | ✅ Invalid values fall back to `'6-8'`. Updates running game via `updateConfig()`. |
| `difficulty` | `el.difficulty` | *(use `setAttribute('difficulty', val)`)* | `'easy' \| 'medium' \| 'hard'` | `'medium'` | ✅ Parsed and forwarded in `context.difficulty`. All 6 cartridges scale distractor counts, physical parameters, and tolerances via `generateLevelsForAge(age, difficulty)`. |
| `sound` | `el.sound` | *(use `setAttribute('sound', val)`)* | `boolean` (`attr !== 'false'`) | `true` | ✅ Updates `el.audio.enabled` and calls `updateConfig()`. |
| `autostart` | `el.autostart` | *(use `setAttribute('autostart', val)`)* | `boolean` (`attr !== 'false'`) | `true` | ✅ When `true`, automatically calls `game.start()` and emits `game:start` after `mount()`. |
| `locale` | `el.locale` | *(use `setAttribute('locale', val)`)* | `string` | `'en'` | ✅ Updates `el.i18n.locale` and calls `updateConfig()`. Core & all 6 games bundle `'en'` and `'fr'`. |
| `levels` | `el.levels` | `el.levels = [...]` | `unknown` | `null` | ✅ Accepts a JS value via property `el.levels = [...]` or a JSON string via `setAttribute('levels', '...')`. ⚠️ Once `el.levels` is set to a non-null value via property, it takes precedence over the HTML attribute until `el.levels = null` is set. |

#### Public Element Methods
- `el.start()` — ✅ calls `this.currentGame?.start()`
- `el.pause()` — ✅ calls `this.currentGame?.pause?.()`
- `el.resume()` — ✅ calls `this.currentGame?.resume?.()`
- `el.restart()` — ✅ re-runs `loadAndMountGame()`

#### Concurrency & Race-Condition Protection
- `currentLoadToken` (lines 82, 244, 256, 275, 289, 314) is incremented on every `loadAndMountGame()` call. If `game` changes or the element disconnects while an async chunk import or `game.mount()` is still in flight, the stale operation immediately aborts and calls `game.destroy?.()`, preventing orphaned animation loops or stale telemetry events.

---

### D. `KidGame` & `GameContext` Contracts ([src/core/types.ts](../src/core/types.ts)) — ✅

```ts
export type AgeGroup = '3-5' | '6-8' | '9-11';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameCategory = 'numbers' | 'letters' | 'logic' | 'spatial';

export interface GameContext {
  ageGroup: AgeGroup;
  difficulty: Difficulty;
  sound: boolean;
  locale: string;
  customLevels?: unknown;
  audio: SoundEngine;
  i18n: I18nManager;
  t: (key: string, params?: Record<string, string | number>) => string;
  emit: <T extends GameEventType>(type: T, payload: GameEventPayloads[T]) => void;
}

export interface KidGame {
  mount(container: HTMLElement, context: GameContext): Promise<void> | void;
  start(): void;
  pause?(): void;
  resume?(): void;
  updateConfig?(newContext: Partial<GameContext>): void;
  destroy(): void;
}
```

> ⚠️ **Note on `updateConfig` payload**: When an attribute changes, `KidGameElement.propagateConfigUpdate()` passes `{ ageGroup, difficulty, sound, locale, customLevels, audio, i18n, t }` (everything in `GameContext` except `emit`). Cartridges should therefore merge `newContext` into `this.context` (or update fields selectively) rather than overwriting `this.context = newContext as GameContext`, which would lose `this.context.emit`.

---

### E. Telemetry Event Bridge — ✅

All events are dispatched as standard DOM `CustomEvent` instances on the `<kid-game>` element with **`bubbles: true, composed: true`** ([KidGameElement.ts](../src/core/KidGameElement.ts#L276-L327)), so they cross Shadow DOM boundaries and can be listened to either directly on `<kid-game>` or on any ancestor element:

| Event Name | Dispatched By | `event.detail` Payload Type | Status |
| :--- | :--- | :--- | :---: |
| `game:ready` | `KidGameElement` (after `mount()` resolves) | `{ gameId: string }` | ✅ |
| `game:start` | `KidGameElement` (when `autostart` triggers `start()`) | `{ gameId: string }` | ✅ |
| `game:progress` | Cartridge via `context.emit('game:progress', ...)` | `{ step: number; total: number; detail?: string }` | ✅ |
| `game:score` | Cartridge via `context.emit('game:score', ...)` | `{ points: number; streak?: number; delta?: number }` | ✅ |
| `game:complete` | Cartridge via `context.emit('game:complete', ...)` | `{ stars: 1 \| 2 \| 3; score: number; timeElapsed: number; summary?: string }` | ✅ |
| `game:error` | `KidGameElement` (if `registry.create` or `mount` throws) | `{ message: string; code?: string }` | ✅ |

---

### F. Procedural Audio Engine ([src/core/audio.ts](../src/core/audio.ts)) — ✅

`SoundEngine` synthesizes zero-asset procedural Web Audio SFX:
- Lazily initializes `AudioContext` (or `webkitAudioContext`) only when `enabled === true` and a sound is triggered, and automatically resumes suspended contexts.
- Methods: `playClick()`, `playPop()`, `playDrop()`, `playChime()`, `playSuccess()`, `playError()`, `playTone(frequency, duration, type, options)`, `close()`.
- `KidGameElement.disconnectedCallback()` calls `this.audio.close()`.

---

### G. Internationalization ([src/core/i18n.ts](../src/core/i18n.ts)) — ✅

- `CORE_DICTIONARY` provides `en` and `fr` strings for shared UI tokens: `soundOn`, `soundOff`, `level`, `score`, `reset`, `wellDone`, `loading`, `error`.
- `I18nManager` normalizes locale tags (e.g. `'fr-FR'` $\rightarrow$ `'fr'`, `'en_US'` $\rightarrow$ `'en'`) and supports `{param}` placeholder interpolation via `interpolate(text, params)`.
- Cartridges define their own typed `en`/`fr` dictionaries in `games/<id>/i18n.ts` and resolve them via `createI18nResolver(DICTIONARY, 'en')`.

---

### H. Build Output Reality ([vite.config.ts](../vite.config.ts)) — ✅ / ⚠️

1. **Library Build (`npm run build` $\rightarrow$ `tsc && vite build`)**:
   - **ES Module format (`dist/kid-games.es.js`, ~12.7 kB)**: ✅ Code-splits each cartridge into its own on-demand ES chunk:
     - `dist/balance-scale-*.js` (~32 kB)
     - `dist/pulley-lift-*.js` (~42 kB)
     - `dist/gear-trains-*.js` (~42 kB)
     - `dist/buoyancy-tank-*.js` (~43 kB)
     - `dist/pendulum-rhythm-*.js` (~48 kB)
     - `dist/marble-run-angles-*.js` (~50 kB)
     - Shared chunks: `dist/i18n-*.js` (~1.5 kB), `dist/audio-*.js` (~3.3 kB), `dist/confetti.module-*.js` (~13.7 kB)
   - **UMD format (`dist/kid-games.umd.js`, ~236 kB)**: ⚠️ Because the UMD module format does not support code-splitting dynamic `import()` statements, Vite bundles the core engine, all 6 games, and `canvas-confetti` into a single 236 kB file.
2. **Playground Static Site Build (`npm run build:pages` $\rightarrow$ `tsc && vite build --mode pages`)**:
   - ✅ Builds `index.html` and code-split `dist/assets/*.js` chunks configured with `base: '/kid-lesson-games/'` for deployment to GitHub Pages via `.github/workflows/deploy-pages.yml`.

---

## 2. Target Architecture (🗺️ Planned Changes)

The following items from the design specifications and roadmap are **not built yet** (🗺️ Planned):

1. 🗺️ **SSR-Safe `KidGameElement` Definition**: Wrap or lazy-define `KidGameElement` so importing the package in a Node.js SSR environment (Next.js / Nuxt server pass) does not evaluate `extends HTMLElement` when `typeof HTMLElement === 'undefined'`.
2. 🗺️ **TypeScript Declaration Emission (`dist/index.d.ts`)**: Add a dedicated build tsconfig (`tsconfig.build.json` with `"noEmit": false, "emitDeclarationOnly": true, "declaration": true, "outDir": "dist"`) before publishing to npm.
3. 🗺️ **Programmatic `mountGame(id, container, options)` Helper & Named Shadow DOM Slots**: Provide the standalone imperative helper and `<slot name="loading">` / `<slot name="error">` customization hooks originally sketched in `docs/design/`.
