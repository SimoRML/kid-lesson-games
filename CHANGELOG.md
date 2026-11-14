# Changelog

All notable changes to `kid-lesson-games` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/).
Feature PRs add entries under `[Unreleased]` only; the Merger moves them into a version heading at release time (see AGENTS.md §0, Gate 9).

## [Unreleased]

## [0.2.0] - 2026-11-14

New cartridge `number-workshop` (division, 4 modes, cartridge `1.0.0`) plus the agent workflow, plan and a security fix.

### Added
- `number-workshop` `1.0.0` (WP6): the cartridge is ✅ with all four modes. Adds the 25-level sample-sheet playground preset, an automated cross-mode play-through (`playthrough.test.ts`: complete sessions at every age × difficulty and the sheet at every difficulty, all solvable through the real controls), the full cartridge README (purpose, formulas, level schema, known limitations), and records the deviations from the plan in `docs/design/number-workshop/README.md` §7. Known limitations ⚠️ are tracked in `TODO.md` (unconfirmed French column abbreviations, whole-game height at 400 px, no real-device play-test).
- `AGENTS.md` §0 Mandatory Agent Workflow (plan, branch, multi-agent safety, security, semver, PR, independent review/merge).
- This changelog.
- `number-workshop` `long` mode (WP5, 🚧 all 4 modes built): written long division in the potence layout, walked step by step from the computed trace (divide, multiply, subtract, bring down by tapping the next digit), then the equality step `a = (b × q) + r`. What the child types follows difficulty (easy: digit; medium: digit and step remainder; hard: digit, product, step remainder). Too-big / too-small / wrong-product / wrong-remainder / wrong-equality hints never give the answer. Cartridge `0.4.0`, "Long division" playground preset; `keypad` accepts a limit function. Procedural sets now use `long` (9-11).
- `number-workshop` `shift` mode (WP4, 🚧 now 3 of 4 modes): slide the dividend's digits through a place-value table (`HTh TTh Th H T O` / `CM DM UM C D U`) by button or drag to divide by 10, 100, 1000; a non-zero digit cannot leave the table; under- and over-shift each get a hint naming the slide count. Cartridge `0.3.0`, "Slide the digits" playground preset; `drag.ts` `onDrop` also reports the movement since the press (backward compatible). Procedural 9-11 sets now include `shift`.
- `number-workshop` `euclid` mode (WP3, 🚧 now 2 of 4 modes): fit groups on a number track and type the remainder on a keypad; three wrong paths (too far, false equality, true equality with `r ≥ b`) each have their own hint. New keypad widget, written-equality anchor in the shell, cartridge `0.2.0`, "Fit the groups" playground preset. Procedural sets now include `euclid` (ages 6-8 at `medium`/`hard` end with it; 9-11 sets include it).
- `number-workshop` playable shell + `facts` mode (WP2, 🚧 1 of 4 modes): Division Workshop is now in the playground. Fair-sharing tiers by dividend size (share, deal, array with Check), live HUD, granular undo, tap and drag, symbol-free presentation for ages 3-5, EN/FR, custom `levels` preset, and the shared group-builder and drag widgets. Library UMD bundle grows to ~309 kB.
- `number-workshop` pure logic (WP1, not yet a playable game): division maths with long-division traces, defensive custom-level parser, procedural level generator, session scoring, and `levels.schema.json`, all under `games/number-workshop/` with tests.
- Implementation plan for the `number-workshop` division cartridge (`docs/design/number-workshop/`, 8 files: decisions, pedagogy, level schema, architecture, UX, test plan with golden values, work packages, platform contract) and TODO Theme 6 (external lesson-generator integration).

### Changed
- The French place-value abbreviations of `number-workshop` (`CM DM UM C D U`) were checked on the web against French primary-school materials; the unconfirmed warnings were removed from the docs.

### Fixed
- `AGENTS.md` workflow nits: committed-state `src/` check, same-account review fallback, post-merge branch cleanup, wording consistency.

### Security
- `<kid-game>` status screen (loading and error) is now built with DOM APIs and `textContent` instead of `innerHTML`, so error messages are always rendered as plain text.

## [0.1.0] - Initial release

- Initial collection of 6 cartridges (`balance-scale`, `buoyancy-tank`, `gear-trains`, `marble-run-angles`, `pendulum-rhythm`, `pulley-lift`) and the `<kid-game>` Web Component.
