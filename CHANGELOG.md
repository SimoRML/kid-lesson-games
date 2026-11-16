# Changelog

All notable changes to `kid-lesson-games` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/).
Feature PRs add entries under `[Unreleased]` only; the Merger moves them into a version heading at release time (see AGENTS.md §0, Gate 9).

## [Unreleased]

### Changed
- Restricted test coverage to `.ts` sources so vitest 5 no longer tries (and warns) to parse cartridge `README.md` files.
- Bumped vitest, @vitest/coverage-v8 and jsdom to latest majors; added Node types to `tsconfig.json` and typed test mocks to satisfy vitest 5.

## [0.3.0] - 2026-11-14

### Added
- Unprivatized package by removing `"private": true` from `package.json`, enabling npm package distribution and automated releases (T-16).
- Updated `AGENTS.md`, `README.md`, `TODO.md`, and `docs/VISION.md` status tables and guides to reflect public npm package availability for `@simorml/kid-lesson-games` (T-16).
- Added GitHub Actions release workflow (`.github/workflows/release.yml`) supporting tag-triggered (`v*`) and `workflow_dispatch` dry-run execution, release tag consistency verification, approval-gated npm publish with OIDC provenance, and GitHub Release creation (T-15).
- Hardened GitHub Pages deployment workflow (`.github/workflows/deploy-pages.yml`) with pinned action commit SHAs, least-privilege permissions scoped to the deploy job, `timeout-minutes`, Node 24 from `.nvmrc`, and `--ignore-scripts` dependency installation (T-18).
- Added `publint`, `@arethetypeswrong/cli`, and automated tarball smoke test script `scripts/smoke-test.js` to CI, and configured UMD bundle output as `.cjs` for CommonJS compatibility (T-13).
- Added Node SSR guard in `src/core/KidGameElement.ts` and `src/index.ts` so importing `@simorml/kid-lesson-games` in Node.js / SSR runtimes does not throw `HTMLElement is not defined` (T-17).
- Removed unused `matter-js` and `@types/matter-js` dependencies and updated AGENTS.md §8.11 (T-14).
- Renamed package to `@simorml/kid-lesson-games` in `package.json` and `package-lock.json`, and updated install and integration examples in `README.md` and `AGENTS.md` (T-12).
- Trimmed package tarball `files` to `dist`, `README.md`, `LICENSE`, and `CHANGELOG.md`, added `sideEffects`, `repository`, `bugs`, `homepage`, and `publishConfig`, updated author to `Simo (@SimoRML)`, and migrated lifecycle build hook from `prepare` to `prepack` (T-11).
- Added `tsconfig.build.json` for TypeScript declaration (`.d.ts`) emission into `dist/` excluding test files, added `build:types` script, and updated `package.json` `types` and `exports["."].types` to point to `./dist/index.d.ts` (T-10).
- Added repository `LICENSE` file under the MIT license, copyright Simo (@SimoRML) (T-09).
- Completed Phase P1 of CI & Security Pipeline: verified Gitleaks scanner detection and push protection behavior, completed live CI/security workflows validation, and marked all P1 tasks (T-04..T-08) complete.
- Repository hygiene and security policy files (T-07):
  - `.github/dependabot.yml` configured for weekly grouped dependency updates across `npm` and `github-actions`.
  - `.github/PULL_REQUEST_TEMPLATE.md` standardizing Gate 7 submissions and verification logging.
  - `.github/CODEOWNERS` assigning review ownership for `.github/**`, `package.json`, `src/**`, and `vite.config.ts`.
  - `SECURITY.md` establishing private vulnerability reporting policy and secret rotation protocols.
  - `.gitignore` credential protections for `*.pem`, `*.key`, and `.npmrc`.
- GitHub Actions Security workflow (`.github/workflows/security.yml`) with pinned checksum-verified Gitleaks scanner, GitHub Dependency Review, and `npm audit --omit=dev --audit-level=high` production audit gate (T-06).
- Gitleaks configuration (`.gitleaks.toml`) extending default detection rules with allowlists for lockfiles and design documents.
- GitHub repository ruleset `protect-main` enforcing PRs, linear history, branch protection, and required `ci / verify` status check (T-05).
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) testing across Node 22 and 24 with aggregate `verify` job, SHA-pinned actions, coverage artifact upload, and core modification warning check (T-04).
- Added `.nvmrc` pinned to Node 24 and `engines.node >=22.0.0` in `package.json`.
- Implementation plan for the CI, security (secret detection) and npm release pipeline (`docs/design/ci-release-pipeline.md`) and TODO Theme 7. Planning only: no workflow or package change yet.

## [0.2.0] - 2026-11-14

New cartridge `number-workshop` (division, 4 modes, cartridge `1.0.0`) plus the agent workflow, plan and a security fix.

### Added
- `number-workshop` `1.0.0` (WP6): the cartridge is ✅ with all four modes. Adds the 25-level sample-sheet playground preset, an automated cross-mode play-through (`playthrough.test.ts`: complete sessions at every age × difficulty and the sheet at every difficulty, all solvable through the real controls), the full cartridge README (purpose, formulas, level schema, known limitations), and records the deviations from the plan in `docs/design/number-workshop/README.md` §7. Known limitations ⚠️ are tracked in `TODO.md` (whole-game height at 400 px, no real-device play-test).
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
