# 🎯 Vision, Philosophy & Target Build (`kid-lesson-games`)

> **Core Principle**: Separate *what exists today* from *what we are building toward*, and label that separation explicitly everywhere.

## 🏷️ Status Legend

- ✅ **Implemented**: Exists in code on disk and verified working (via tests or build).
- 🚧 **Partial**: Exists in code but incomplete or unverified (notes specify what is missing).
- 🗺️ **Planned**: Part of the project vision and target architecture, not built yet.
- ⚠️ **Known discrepancy**: Code and earlier documentation disagreed (notes specify how it was resolved).

---

## 1. Project Philosophy & "Vibe"

**`kid-lesson-games`** is a pluggable collection of interactive mini web games designed for **kids' learning platforms** (Numbers, Letters, Logic, and Spatial awareness) to enhance intuitive human youngsters' capabilities through grounded math and physical laws.

### Core Tenets

1. **Universal Web Component Embedding** (✅ Implemented for client-side DOM; 🚧 Partial for SSR frameworks):
   - Built specifically for seamless embedding via a standard **`<kid-game>` Web Component**—drop it into **any** modern frontend stack (React, Vue, Svelte, Angular, Next.js, Nuxt, WordPress, or plain HTML) with zero friction if the contract is fulfilled.
2. **AI-First Contributor Vibe & Zero Core Modification** (✅ Implemented):
   - Designed with an **AI-first contributor vibe**: developers or AI coding agents can generate and drop in brand-new games in minutes with **zero modifications to the core engine (`src/`)**.
   - Drop new games directly into `games/<game-id>/`. The core engine automatically discovers metadata (`games/*/{game,meta}.json`) and lazily loads game modules (`games/*/index.ts`) via Vite `import.meta.glob`.
3. **Grounded European Math & Tactile Physics** (✅ Implemented):
   - *"Look, I am not good in math so you help with grounded facts"*: every cartridge is anchored in real physical laws (Archimedes' law of the lever, hydrostatic buoyancy, gear kinematics, specular reflection, Galileo's pendulum law, mechanical advantage & conservation of work) and **real European metric units** (`g`, `kg`, `cm`, `m`, `mL`, `L`, `N`, `J`).
4. **Concept Mastery Over Button-Mashing** (✅ Implemented):
   - **Meaningful Age Bracket Differentiation** (*tranches d'âge*):
     - **`3-5` (Preschool / Early Explorers)**: Concrete visual/tactile counting, direct 1-to-1 correspondence, 1–2 elements per step, clear color/shape coding, immediate feedback.
     - **`6-8` (Early Elementary)**: Multi-step composition/decomposition and the **Anti-Mirroring Rule**—forbid trivial 1-to-1 visual copying (e.g., if target is `500g`, never place a single `500g` block in the tray; require combining `250g + 250g` or `200g + 200g + 100g`), plus real metric conversions.
     - **`9-11` (Upper Elementary)**: Multi-variable reasoning, ratios, fractions, or physical laws (e.g., Archimedes lever torque $\tau = m \times d$, square-root pendulum period $T \propto \sqrt{L}$, density $\rho = m/V$).
   - **Guaranteed Solvability + Plausible Distractors**: Procedural puzzle generators construct or mathematically verify a valid solution path *before* mixing in 1–2 plausible distractor pieces.
   - **Live Pedagogical Scaffolding**: Dynamic HUD prompts update as the child interacts, showing live totals, equation progress, or gentle directional hints without giving away the exact click.
5. **No Reinventing the Wheel & Zero External Runtime Assets** (✅ Implemented):
   - Prioritize safe, open packages (`canvas-confetti` ✅; `matter-js` is installed in `package.json` but currently unused ⚠️) while rendering all visuals via HTML5 Canvas 2D, SVG, or CSS and synthesizing all sound effects procedurally via the Web Audio API (`SoundEngine`) so games never fail offline or suffer asset-loading latency.

---

## 2. Target Build & Architectural Capabilities

### A. Core Runtime & Packaging
- ✅ **Universal `<kid-game>` Custom Element**: Shadow DOM isolation, reactive attributes (`game`, `age`, `difficulty`, `sound`, `autostart`, `locale`, `levels`), lifecycle methods (`start()`, `pause()`, `resume()`, `restart()`), and race-condition-safe async mounting (`currentLoadToken`).
- ✅ **Telemetry Event Bridge**: Standard `CustomEvent` dispatching (`game:ready`, `game:start`, `game:progress`, `game:score`, `game:complete`, `game:error`) with `bubbles: true, composed: true` to cross Shadow DOM boundaries.
- ✅ **Dual Curriculum Mode (`customLevels` + Procedural Fallback)**: Educators and LMS platforms can pass custom lesson configurations via the `levels` attribute/property, while every cartridge exports `parseCustomLevels(raw)` and falls back to `generateLevelsForAge(ageGroup)` when omitted or invalid.
- ✅ **Shared Procedural Web Audio (`SoundEngine`)**: Zero-asset synthesized clicks, pops, drops, chimes, victory fanfares, error buzzes, and custom tones in [audio.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/audio.ts).
- ✅ **Shared Bilingual i18n (`I18nManager` & `createI18nResolver`)**: English (`en`) and French (`fr`) translations with parameter interpolation in [i18n.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/i18n.ts).
- ✅ **Per-Cartridge Code-Split ES Chunks**: In ES module builds (`dist/kid-games.es.js`), each game cartridge is split into its own on-demand chunk (`dist/<game-id>-*.js`).
- ⚠️ **UMD Bundle Code-Splitting Limitation**: UMD (`dist/kid-games.umd.js`) cannot code-split dynamic imports in Vite/Rolldown library mode and instead bundles all cartridges into a single 236 kB file.
- ✅ **`difficulty` Modifier Integration**: `<kid-game difficulty="easy|medium|hard">` is parsed by the core element and injected into `GameContext.difficulty`; all 6 cartridges scale puzzle distractor counts, physical parameters, and tolerances via `generateLevelsForAge(ageGroup, difficulty)` and react live in `updateConfig()`.
- 🗺️ **Published npm Package (`npm i kid-lesson-games`)**: Currently unpublished (`"private": true` in `package.json`); today consumers install via git dependency, local path, or built bundle script tag.
- 🗺️ **TypeScript Declaration Output (`dist/index.d.ts`)**: `tsconfig.json` currently uses `"noEmit": true`; generating standalone `.d.ts` files in `dist/` for published npm consumers is planned.
- 🗺️ **SSR-Safe Import Guard (`HTMLElement` in Node.js)**: Guarding `class KidGameElement extends HTMLElement` so `import 'kid-lesson-games'` can execute on the server in Next.js/Nuxt without `ReferenceError: HTMLElement is not defined`.
- 🗺️ **Programmatic `mountGame(gameId, container, options)` Helper**: Proposed in [game-contract-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/game-contract-spec.md) as `@kid-games/core` Method B; today programmatic mounting is done via `<kid-game>` or `registry.create(gameId)`.
- 🗺️ **Named Shadow DOM Slots (`<slot name="loading">`, `<slot name="error">`)**: Proposed in [web-component-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/web-component-spec.md); today `<kid-game>` uses an internal `.status-screen` overlay.

---

## 3. Target Curriculum Categories & Game Catalog

The project targets four core educational taxonomy categories across three age brackets (`3-5`, `6-8`, `9-11`):

| Category | Educational Focus | Current Coverage | Status |
| :--- | :--- | :--- | :--- |
| **`numbers`** | Counting, addition, decomposition, metric conversions, periodicity, harmonic fractions | 2 games (`balance-scale`, `pendulum-rhythm`) | ✅ Implemented |
| **`logic`** | Simple machines, mechanical advantage, gear ratios, Archimedes density & hydrostatics | 3 games (`buoyancy-tank`, `gear-trains`, `pulley-lift`) | ✅ Implemented |
| **`spatial`** | Geometry, slope angles, acute/right/obtuse classification, specular reflection | 1 game (`marble-run-angles`) | ✅ Implemented |
| **`letters`** | Phonetics, letter recognition, audio-tactile phonics, word building | 0 games in `games/` | 🗺️ Planned |

### Implemented Cartridges (✅) & Planned Roadmap Games (🗺️)

| Game ID | Title | Category | Ages | Pedagogical Core | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `balance-scale` | Balance the Scale (*Balance Lab*) | `numbers` | `3-5`, `6-8`, `9-11` | Metric weights (`g`/`kg`), additive decomposition, Archimedes lever torque ($\tau = m \times d$) | ✅ Implemented |
| `buoyancy-tank` | Buoyancy Tank & Density Lab | `logic` | `3-5`, `6-8`, `9-11` | Sink vs. float, volume displacement ($1\text{ cm}^3 = 1\text{ mL}$), submarine density trim ($\rho = m/V$) | ✅ Implemented |
| `gear-trains` | Gear Trains | `logic` | `3-5`, `6-8`, `9-11` | Interlocking gears, rotational direction parity, tooth ratios ($N_1/N_2$), RPM & LCM | ✅ Implemented |
| `marble-run-angles` | Marble Run Angles | `spatial` | `3-5`, `6-8`, `9-11` | Ramp bridging, $15^\circ$ angle rotation, acute/right/obtuse angles, specular reflection ($\theta_i = \theta_r$) | ✅ Implemented |
| `pendulum-rhythm` | Pendulum Rhythm Lab | `numbers` | `3-5`, `6-8`, `9-11` | Momentum knockdown, Galileo's mass-invariance & BPM sync, square-root polyrhythms ($T \propto \sqrt{L}$) | ✅ Implemented |
| `pulley-lift` | Pulley Lift & Mechanical Advantage | `logic` | `3-5`, `6-8`, `9-11` | Fixed/movable/compound pulleys ($MA = 1..4$), effort fractions, work conservation ($W = F \times d$) | ✅ Implemented |
| `number-line` | Number Line Hopper | `numbers` / `spatial` | `3-5`, `6-8`, `9-11` | Frog/fennec jumping along positive/negative number lines to master addition and subtraction | 🗺️ Planned |
| `fraction-feast` | Fraction Slices & Equal Shares | `numbers` / `spatial` | `6-8`, `9-11` | Part-whole geometric partitions, equivalent fractions ($2/4 = 1/2$), and common-denominator sums | 🗺️ Planned |
| `money-market` | Souk & Dirham Counter | `numbers` | `3-5`, `6-8`, `9-11` | Moroccan Dirhams (`DH`) & centimes, additive payment composition, and calculating change | 🗺️ Planned |
| `electric-circuit` | Circuit Spark | `logic` | `3-5`, `6-8`, `9-11` | Complete circuits, conductors vs. insulators, series & parallel branch logic | 🗺️ Planned |
| `food-web` | Eco-Balance | `logic` | `3-5`, `6-8`, `9-11` | Trophic chains (producers, consumers, predators) and ecological balance stability | 🗺️ Planned |
| `clock-time` | Time Master | `numbers` / `spatial` | `3-5`, `6-8`, `9-11` | Geared clock hands, reading hours/half-hours/quarter-hours, and elapsed duration | 🗺️ Planned |
| `shadow-theater` | Shadow & Optics Lab | `spatial` / `logic` | `3-5`, `6-8`, `9-11` | Raycasting shadows, opaque vs. transparent materials, eclipse geometry | 🗺️ Planned |
| `axial-symmetry` | Mirror Symmetry Grid | `spatial` | `6-8`, `9-11` | Grid reflections across vertical, horizontal, and diagonal axes with distance preservation | 🗺️ Planned |
| `letter-sound-safari` | Letter Sound Safari | `letters` | `3-5` | Audio-tactile phonics and letter-sound matching | 🗺️ Planned |
| `letter-trace` | Letter Trace | `letters` | `3-5`, `6-8` | Guided stroke order and letter formation tracing | 🗺️ Planned |
| `word-builder` | Word Builder | `letters` | `6-8`, `9-11` | Syllable and morpheme composition with audio feedback | 🗺️ Planned |

> [!NOTE]
> *Pattern Cogwheels* from the original Phase 3 pipeline in `TODO.md` has been realized as the **`gear-trains`** cartridge (✅ Implemented).

---

## 4. Gap Analysis (Vision vs. Current Reality)

| Target Capability | Current State | Label | What's Missing / Next Steps |
| :--- | :--- | :---: | :--- |
| `<kid-game>` Web Component & Shadow DOM | Implemented in [KidGameElement.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/KidGameElement.ts) with Shadow DOM, status overlay, and event bridge | ✅ | Complete for browser environments |
| Telemetry DOM Events (`game:*`) | All 6 events dispatched with `bubbles: true, composed: true` | ✅ | Complete |
| Lazy Per-Game Code Splitting | ES build (`dist/kid-games.es.js`) splits all 6 games into separate chunks | ✅ | UMD build (`dist/kid-games.umd.js`) bundles all games together due to UMD format constraints (⚠️) |
| Bilingual Localization (`en` / `fr`) | Core `I18nManager` + all 6 cartridges support `en` and `fr` | ✅ | Additional EU locales (`es`, `de`, `it`, `nl`) are 🗺️ Planned |
| Procedural Web Audio (`SoundEngine`) | Shared `SoundEngine` injected via `context.audio` across all games | ✅ | Complete |
| `numbers`, `logic`, `spatial` Categories | 6 full physics/math games implemented and tested (277 Vitest tests) | ✅ | Expand with Moroccan curriculum games: `money-market`, `number-line`, `fraction-feast` (🗺️) |
| `letters` Curriculum Category | Taxonomy type `'letters'` exists in `GameCategory`, 0 games built | 🗺️ | Scaffold and implement `letter-sound-safari`, `letter-trace`, or `word-builder` |
| `difficulty` Attribute (`easy`/`medium`/`hard`) | Parsed on `<kid-game>` and passed in `context.difficulty`; all 6 cartridges modulate distractor counts, physical parameters, and tolerances via `generateLevelsForAge(age, difficulty)` | ✅ | Complete across all cartridges |
| Cartridge Metadata (`author`, `thumbnail`) | Preserved during registration in `src/index.ts`; all 6 games feature `assets/thumb.svg` vector badges on disk | ✅ | Complete |
| `balance-scale` Lifecycle Teardown | Zero-leak teardown, pause/resume, README | ✅ | Fixed in PR #27 (AbortController teardown, tracked timeouts, `pause()`/`resume()`, README) |
| Scaffolding CLI (`npm run create-game`) | Scaffolds `game.json`, `assets/thumb.svg`, `i18n.ts`, `index.ts`, `index.test.ts`, and `README.md` with complete zero-leak lifecycle contracts | ✅ | Complete |
| npm Registry Package (`kid-lesson-games`) | Not published to npm (`"private": true`); installable via git or local bundle | 🗺️ | Emit `.d.ts` declarations, guard `HTMLElement` for Node SSR, and publish to npm |
| Programmatic `mountGame()` Helper & Named Slots | Documented in early design specs (`docs/design/`) | 🗺️ | Optional convenience wrapper around `registry.create(id)` and `<slot name="loading\|error">` in `KidGameElement` |
