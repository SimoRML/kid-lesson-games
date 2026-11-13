# 🗺️ Project Roadmap & TODO (`kid-lesson-games`)

> Grouped by vision themes ([docs/VISION.md](file:///home/simo/Documents/www/kid-lesson-games/docs/VISION.md)) and verified against the codebase ([docs/ARCHITECTURE.md](file:///home/simo/Documents/www/kid-lesson-games/docs/ARCHITECTURE.md)).

## 🏷️ Status Legend

- ✅ **Implemented**: Exists in code on disk and verified working (via tests or build).
- 🚧 **Partial**: Exists in code but incomplete or unverified (notes specify what is missing).
- 🗺️ **Planned**: Part of the project vision and target architecture, not built yet.
- ⚠️ **Known discrepancy**: Code and earlier documentation disagreed (notes specify how it was resolved).

---

## 🧩 Theme 1: Universal `<kid-game>` Web Component & Core Runtime

- [x] ✅ Define pluggable `KidGame` lifecycle and metadata contract ([game-contract-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/game-contract-spec.md), [src/core/types.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/types.ts)).
- [x] ✅ Implement `<kid-game>` custom element with open Shadow DOM and reactive attributes ([web-component-spec.md](file:///home/simo/Documents/www/kid-lesson-games/docs/design/web-component-spec.md), [src/core/KidGameElement.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/KidGameElement.ts)).
- [x] ✅ Implement Telemetry Event Bridge (`game:ready`, `game:start`, `game:progress`, `game:score`, `game:complete`, `game:error`) dispatched with `bubbles: true, composed: true`.
- [x] ✅ Implement race-condition protection via monotonic `currentLoadToken` in `<kid-game>` on rapid game switching.
- [x] ✅ Implement shared procedural Web Audio engine (`SoundEngine` in [src/core/audio.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/audio.ts)) with zero external audio assets.
- [x] ✅ Implement shared bilingual (`en`/`fr`) localization manager (`I18nManager` & `createI18nResolver` in [src/core/i18n.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/i18n.ts)).
- [x] ✅ Build interactive browser testbed & event inspector ([index.html](file:///home/simo/Documents/www/kid-lesson-games/index.html)) with live cartridge selector, custom level presets, and telemetry log.
- [ ] 🚧 Wire `context.difficulty` (`easy` | `medium` | `hard`) into cartridge puzzle generators (currently parsed on `<kid-game>` and passed in `GameContext`, but ignored by cartridges).
- [ ] 🚧 Preserve `author` and `thumbnail` fields when registering `GameMetadata` in [src/index.ts](file:///home/simo/Documents/www/kid-lesson-games/src/index.ts).
- [ ] 🗺️ Add named Shadow DOM customization slots (`<slot name="loading">` and `<slot name="error">`) to `KidGameElement`.
- [ ] 🗺️ Add optional programmatic `mountGame(gameId, container, options)` convenience helper alongside `<kid-game>`.
- [ ] 🗺️ Guard `class KidGameElement extends HTMLElement` in [src/core/KidGameElement.ts](file:///home/simo/Documents/www/kid-lesson-games/src/core/KidGameElement.ts) so server-side imports in Node.js (Next.js / Nuxt SSR) do not throw `ReferenceError: HTMLElement is not defined`.

---

## 🤖 Theme 2: AI-First Contributor Ergonomics & Cartridge Isolation

- [x] ✅ Establish Git repository structure with `.brainstorm/` ignored for private ideation.
- [x] ✅ Automatic cartridge discovery via Vite `import.meta.glob` (`games/*/{game,meta}.json` eagerly + `games/*/index.ts` lazily) with zero edits to `src/`.
- [x] ✅ Contributor CLI scaffolding tool (`npm run create-game <game-id>` in [scripts/create-game.js](file:///home/simo/Documents/www/kid-lesson-games/scripts/create-game.js)).
- [x] ✅ Set up Vitest + `jsdom` test suite (`npm test`, 13 test files / 271 tests passing).
- [ ] 🚧 Upgrade `scripts/create-game.js` to also scaffold `i18n.ts`, `index.test.ts`, `pause()`/`resume()`, and `AbortController` zero-leak teardown boilerplate.
- [x] ✅ Bring `games/balance-scale` lifecycle teardown up to the strict zero-leak standard of the newer 5 cartridges (remove `window` mouse/touch listeners via `AbortController`, clear win `setTimeout`s in `destroy()`, implement `pause()`/`resume()`, and add `games/balance-scale/README.md`).
- [ ] 🚧 Add missing `assets/thumb.svg` thumbnails for `balance-scale`, `buoyancy-tank`, `marble-run-angles`, and `pulley-lift` (already present for `gear-trains` and `pendulum-rhythm`).

---

## 🎓 Theme 3: Grounded Curriculum & Game Cartridges

### Numbers (`"numbers"`)
- [x] ✅ **`balance-scale` — Balance the Scale / Balance Lab** (*Ages 3–5, 6–8, 9–11*): Equal-arm metric weight equality (`g`/`kg`), additive decomposition ($500\text{g} + 500\text{g} = 1\text{ kg}$), and Archimedes lever torque ($\tau = m \times d$).
- [x] ✅ **`pendulum-rhythm` — Pendulum Rhythm Lab** (*Ages 3–5, 6–8, 9–11*): Wrecking-ball momentum knockdown, Galileo's mass-invariance & BPM metronome sync, and square-root law ($T \propto \sqrt{L}$) harmonic polyrhythms ($2:1, 3:1, 3:2$).
- [ ] 🗺️ **`number-line` — Number Line Hopper** (*Ages 3–5, 6–8*): Frog jumping along positive/negative number lines to solve addition and subtraction.

### Logic & Simple Machines (`"logic"`)
- [x] ✅ **`buoyancy-tank` — Buoyancy Tank & Density Lab** (*Ages 3–5, 6–8, 9–11*): Qualitative sink vs. float, graduated cylinder volume displacement ($1\text{ cm}^3 = 1\text{ mL}$), and submarine neutral buoyancy trim ($\rho = m/V$ in freshwater & saltwater).
- [x] ✅ **`gear-trains` — Gear Trains** (*Ages 3–5, 6–8, 9–11*): Realizes the *Pattern Cogwheels* concept—interlocking gears ($6\text{T}..24\text{T}$), odd/even rotational direction parity, tooth ratios ($N_1/N_2$), RPM kinematics, and LCM synchronization.
- [x] ✅ **`pulley-lift` — Pulley Lift & Mechanical Advantage** (*Ages 3–5, 6–8, 9–11*): Fixed ($MA=1$), movable ($MA=2$), and compound block-and-tackle ($MA=3, 4$) cranes teaching force division and conservation of work ($W = F \times d$).

### Spatial & Geometry (`"spatial"`)
- [x] ✅ **`marble-run-angles` — Marble Run Angles** (*Ages 3–5, 6–8, 9–11*): Ramp slot bridging, $15^\circ$ discrete angle rotation, acute/right/obtuse classification, and law of specular reflection ($\theta_i = \theta_r$) with wood vs. trampoline restitution ($e$).

### Letters & Phonics (`"letters"`)
- [ ] 🗺️ **`letter-sound-safari` — Letter Sound Safari** (*Ages 3–5*): Audio-tactile phonics and letter-sound matching.
- [ ] 🗺️ **`letter-trace` — Letter Trace** (*Ages 3–5, 6–8*): Guided stroke order and letter formation tracing.
- [ ] 🗺️ **`word-builder` — Word Builder** (*Ages 6–8, 9–11*): Syllable and morpheme composition with procedural audio feedback.

---

## 📦 Theme 4: Packaging, Distribution & Discoverability

- [x] ✅ Configure Vite library build (`npm run build`) producing code-split ES modules (`dist/kid-games.es.js` + per-game chunks) and UMD bundle (`dist/kid-games.umd.js`, ⚠️ single-file bundle without code-splitting).
- [x] ✅ Configure `package.json` entrypoints (`main`, `module`, `types`, `exports`, `files`, `prepare`) for local and git-based installation (`npm i github:simorml/kid-lesson-games`).
- [x] ✅ Add GitHub Pages deployment workflow ([.github/workflows/deploy-pages.yml](file:///home/simo/Documents/www/kid-lesson-games/.github/workflows/deploy-pages.yml)) and `npm run build:pages` with `base: '/kid-lesson-games/'`.
- [ ] 🗺️ Emit standalone TypeScript declaration files (`dist/index.d.ts`) during build (`tsconfig.json` currently sets `"noEmit": true`).
- [ ] 🗺️ Publish `kid-lesson-games` to the public npm registry (remove `"private": true` once `.d.ts` generation and SSR guard are complete).
- [ ] 🗺️ Add additional European locales (`es`, `de`, `it`, `nl`) to core `I18nManager` and cartridge dictionaries.

---

## 🧪 Theme 5: Playtest Quality Pass (issues #1–26)

- [x] ✅ All 26 playtest issues (HUD/hints, tray input, layout on narrow cards, French strings, score reset on age change) fixed in PRs #27–#32, one per game.
- [ ] 🚧 Not verified: exact 360px and 620px card widths; miss/stall paths in `marble-run-angles` are unit-tested only (browser pane throttles rAF).
- [ ] 🚧 Score still carries across the automatic restart after the final level in some games; gear-trains does not reset score when `customLevels` changes.
- [ ] 🗺️ Decide whether auto-restart after `game:complete` (3–3.5 s in gear-trains, pendulum-rhythm, pulley-lift) is desired.
