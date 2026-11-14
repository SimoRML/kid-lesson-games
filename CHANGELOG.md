# Changelog

All notable changes to `kid-lesson-games` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/).
Feature PRs add entries under `[Unreleased]` only; the Merger moves them into a version heading at release time (see AGENTS.md §0, Gate 9).

## [Unreleased]

### Added
- `AGENTS.md` §0 Mandatory Agent Workflow (plan, branch, multi-agent safety, security, semver, PR, independent review/merge).
- This changelog.
- Implementation plan for the `number-workshop` division cartridge (`docs/design/number-workshop/`, 8 files: decisions, pedagogy, level schema, architecture, UX, test plan with golden values, work packages, platform contract) and TODO Theme 6 (external lesson-generator integration).

### Fixed
- `AGENTS.md` workflow nits: committed-state `src/` check, same-account review fallback, post-merge branch cleanup, wording consistency.

### Security
- `<kid-game>` status screen (loading and error) is now built with DOM APIs and `textContent` instead of `innerHTML`, so error messages are always rendered as plain text.

## [0.1.0] - Initial release

- Initial collection of 6 cartridges (`balance-scale`, `buoyancy-tank`, `gear-trains`, `marble-run-angles`, `pendulum-rhythm`, `pulley-lift`) and the `<kid-game>` Web Component.
