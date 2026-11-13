# Project Roadmap & TODO

## 🎯 Phase 1: Core Framework & MVP (Completed)
- [x] Establish Git repository and remote structure with zero leaks for private ideation (`.brainstorm/`).
- [x] Define pluggable game interface and metadata specification ([game-contract-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/game-contract-spec.md)).
- [x] Define `<kid-game>` Web Component specification ([web-component-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/web-component-spec.md)).
- [x] Configure Vite + TypeScript library and testbed build.
- [x] Implement `<kid-game>` custom element with Shadow DOM and event bridge.
- [x] Implement MVP: **Balance Scale Game** (`games/balance-scale`) with physics equilibrium, tactile weights, procedural sound effects, and confetti celebrations.
- [x] Build interactive testbed playground (`index.html`).

---

## ⚖️ Phase 2: Math Grounding & Contributor Ergonomics (Completed)
- [x] **Metric & EU Standard Defaults**: Real metric units (grams `g`, kilograms `kg`, centimeters `cm`).
- [x] **Number Conversions**: $1\text{ kg} = 1\,000\text{ g}$, $500\text{g} + 500\text{g} = 1\text{kg}$, $250\text{g} \times 4 = 1\text{kg}$.
- [x] **Archimedes Lever Physics (Ages 9–11)**: Torque balancing ($\tau = m \times d$).
- [x] **Multilingual UI (i18n)**: English (`en`) and French (`fr`) with in-game sound toggle button.
- [x] **Automatic Game Discovery**: Vite `import.meta.glob` loads any game folder dropped in `games/` without editing core files.
- [x] **Contributor CLI**: `npm run create-game <game-id>` scaffolds starter boilerplate in seconds.

---

## ⚡ Phase 2.5: Scaling Architecture & Core Isolation (Completed)
- [x] **Shared Procedural Web Audio Engine**: `SoundEngine` in `src/core/audio.ts` providing tactile pops, thuds, clicks, chimes, victory fanfare, and custom tones without external audio assets.
- [x] **Shared i18n & Localization Resolver**: `I18nManager` & `createI18nResolver` in `src/core/i18n.ts` supporting standard UI dictionary tokens, parameter interpolation, and type-safe cartridge overlays.
- [x] **Dynamic Lazy Loading via `import.meta.glob`**: Eager lightweight catalog metadata discovery (`game.json` / `meta.json`) paired with lazy code-split cartridge loading.
- [x] **Race-Condition & Telemetry Resilience**: Generation token sequence in `<kid-game>` preventing stale mount race conditions on rapid game switching.
- [x] **Scaffolding CLI Update**: `npm run create-game` generates cartridges adhering to updated `GameContext` contract with zero boilerplate.

---

## 🎨 Phase 3: Next Game Ideas (Pipeline)
- [ ] **Number Line Hopper** (*Numbers / Spatial* - Ages 3-5 & 6-8): Frog jumping along positive/negative number lines to solve addition/subtraction.
- [ ] **Letter Sound Safari** (*Letters / Phonetics* - Ages 3-5): Audio-tactile phonics matching.
- [ ] **Pattern Cogwheels** (*Logic / Spatial* - Ages 6-8 & 9-11): Gear rotation direction and ratio puzzle.
