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

## 🚀 Phase 2: Game Enhancements & Contributor Experience
- [ ] Add Age Bracket levels to Balance Scale (e.g. 9-11 bracket with distance lever physics: $\text{Torque} = \text{Weight} \times \text{Distance}$).
- [ ] Add sound mute button directly in `<kid-game>` status overlay.
- [ ] Add CLI generator / template for contributors (`npm run create-game <name>`).
- [ ] Automated contract validator test suite (checks that every game in `games/` exports required lifecycle methods and valid `game.json`).

---

## 🎨 Phase 3: Next Game Ideas (Pipeline)
- [ ] **Number Line Hopper** (*Numbers / Spatial* - Ages 3-5 & 6-8): Frog jumping along positive/negative number lines to solve addition/subtraction.
- [ ] **Letter Sound Safari** (*Letters / Phonetics* - Ages 3-5): Audio-tactile phonics matching.
- [ ] **Pattern Cogwheels** (*Logic / Spatial* - Ages 6-8 & 9-11): Gear rotation direction and ratio puzzle.
