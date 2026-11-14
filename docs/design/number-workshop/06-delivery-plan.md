# 06 — Delivery Plan (Work Packages)

> Part of the [`number-workshop` plan](README.md). Status: ✅ Implemented in `1.0.0`; deviations from this text are recorded in [README §7](README.md).
> One work package (WP) = one branch = one PR = one agent, delivered in order, each following AGENTS.md §0 Gates 1–10 including independent review. A WP starts only after the previous one is merged.

## Overview

```mermaid
graph LR
  WP0[WP0 plan] --> WP1[WP1 pure logic]
  WP1 --> WP2[WP2 shell + facts]
  WP2 --> WP3[WP3 euclid]
  WP3 --> WP4[WP4 shift]
  WP4 --> WP5[WP5 long]
  WP5 --> WP6[WP6 finish to 1.0.0]
```

| WP | Branch | Visible on the playground? | Cartridge status after merge | Library semver impact |
|---|---|---|---|---|
| 0 | `docs/number-workshop-plan` | no | 🗺️ | none (docs) |
| 1 | `feat/number-workshop-logic` | no (no `game.json`) | 🗺️ | patch (internal, not user-visible) |
| 2 | `feat/number-workshop-facts` | **yes**: `facts` playable for all ages | 🚧 `0.1.0` | minor (new game) |
| 3 | `feat/number-workshop-euclid` | yes | 🚧 `0.2.0` | minor |
| 4 | `feat/number-workshop-shift` | yes | 🚧 `0.3.0` | minor |
| 5 | `feat/number-workshop-long` | yes | 🚧 `0.4.0` | minor |
| 6 | `feat/number-workshop-finish` (built on `feat/number-workshop-polish`) | yes | ✅ `1.0.0` | minor (cartridge `0.4.0` -> `1.0.0`; the library version is the Merger's) |

All six packages are delivered; see the README §7 for deviations.

Version note: AGENTS.md says feature PRs never bump versions (multi-agent rule 4) and also that a cartridge change updates that cartridge's `game.json` version (Gate 6, Gate 9). This plan reads that as: the author sets the **cartridge** version shown above; the **library** version in `package.json` is touched only by the Merger. The owner confirmed this reading (Q7).

Rules common to every WP:

- Files listed under "Touches" are the claimed territory. Anything else needs the owner's OK first.
- Never touched by any WP: `src/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.github/**`, other cartridges, `scripts/**`.
- `CHANGELOG.md`: one line under `[Unreleased]` per WP.
- Commits: tests and pure code, then UI, then docs, as separate Conventional Commits with scope `number-workshop`.
- The PR description pastes the Gate 5 output and the play-test results ([04-ux-and-vibe.md](04-ux-and-vibe.md) §9) for UI packages.
- **Size guard**: if a WP's non-test diff is heading past roughly 1 200 lines, stop and propose a split to the owner instead of pushing through.

---

> Checkbox key at `1.0.0`: each box is that package's own acceptance as of its merge. `[x]` met (some, such as the WP1 "game list unchanged" line, described the state at that merge), `[~]` partly met with the gap stated (see [README §7](README.md)).

## WP0 — This plan

**Done when**: the docs PR is reviewed and merged. The owner approved the plan and accepted every default for Q1–Q7 on 2026-11-14 ([README.md](README.md) §4).

---

## WP1 — Pure logic (invisible)

**Goal**: all maths, parsing, generation, and session scoring exist and are proven, with no game registered.

**Touches** (all new, under `games/number-workshop/`): `division.ts`, `levels.ts`, `session.ts`, `modes/types.ts` (only the `ModeId` type, `ALL_MODES`, and `BUILT_MODES = []`; the controller interfaces arrive in WP2 because they depend on `i18n.ts`), `levels.schema.json`, and `division.test.ts`, `levels.test.ts`, `session.test.ts`. Plus `CHANGELOG.md`.

**Must not add**: `game.json`, `index.ts` (decision D2). Do not run `npm run create-game` in this WP: it creates both.

**Notes**
- `parseCustomLevels(raw, modes = BUILT_MODES)` and `generateLevelsForAge(age, difficulty, rng, modes = BUILT_MODES)` take the enabled-mode list as a last optional parameter so tests can exercise all four modes while none is built. With an empty list the parser returns `null` and the generator returns `[]`; nothing calls them that way in WP1.
- Spec: [02-level-schema.md](02-level-schema.md); tests: [05-test-plan.md](05-test-plan.md) §3 (`division`, `levels`, `session`).

**Acceptance**
- [x] Every golden value and every listed parser/generator case passes.
- [x] `npm run build` output has no `number-workshop` chunk and the playground's game list is unchanged (still 6).
- [x] No DOM access in any of the three modules (the test files run without touching `document`).
- [x] Coverage of the three modules ≥ 95 % lines.

---

## WP2 — Shell + `facts` (first playable slice)

**Goal**: a complete, polished, honest game with one mode. This PR sets the quality bar and the visual language for everything after it.

**Touches** (cartridge): `game.json` (`0.1.0`, category `numbers`, all three age groups, skills `division`, `equal-sharing`), `assets/thumb.svg`, `index.ts`, `i18n.ts`, `styles.ts`, `modes/index.ts`, `modes/types.ts` (`BUILT_MODES = ['facts']`, plus the `ModeHost` and `ModeController` interfaces), `modes/facts.ts`, `widgets/drag.ts`, `widgets/group-builder.ts`, `README.md`, tests for each. Do **not** run `npm run create-game number-workshop`: the script refuses when the directory already exists, and WP1 created it. Write the files by hand, using `scripts/create-game.js` and an existing cartridge only as reading material for the lifecycle pattern.

**Touches** (shared, minimal): `index.html` (static `<option>` and a `customPresetsByGame` entry with a `facts`-only preset), root `README.md` (game table row labelled 🚧, counts), `docs/VISION.md` (catalogue row and gap table), `TODO.md`, `AGENTS.md` (cold-start "6 games" count and list), `CHANGELOG.md`.

**Notes**
- While only `facts` is built, ages `9-11` play `facts` levels in the Array tier with remainders; the cartridge README says clearly which modes exist and which are 🗺️.
- Choose and document the semantic colours ([04-ux-and-vibe.md](04-ux-and-vibe.md) §2) with their contrast ratios in the cartridge README.
- Implement every repo gotcha of [03-architecture.md](03-architecture.md) §6; each has a named test in [05-test-plan.md](05-test-plan.md).

**Acceptance**
- [x] All three `facts` tiers are playable by mouse, touch, and keyboard; undo works; remainder levels explain the left-over.
- [x] Ages 3–5 see no `÷` and no equation.
- [x] Shell tests and `facts` tests pass; the custom preset in `index.html` round-trips through `parseCustomLevels`.
- [~] Play-test: done automatically (`playthrough.test.ts`) and in a desktop browser for all three ages; no screenshots or GIF were attached; no human/real-device pass (see README §7).
- [x] (Superseded at `1.0.0`: docs now say ✅ and every game count is true.)

---

## WP3 — `euclid`

**Touches**: `modes/euclid.ts`, `widgets/keypad.ts`, tests for both, `modes/types.ts` + `modes/index.ts` (register), `i18n.ts`, `styles.ts`, `game.json` (`0.2.0`, add skill `euclidean-division`), cartridge `README.md`, `index.html` preset (add `euclid` levels), the cartridge's status row in root `README.md` and `docs/VISION.md` ("2 of 4 modes"), `CHANGELOG.md`.

**Acceptance**
- [x] Reuses `group-builder` unchanged or with a backward-compatible extension (no fork).
- [x] The three wrong paths (too far, false equality, true equality with `r ≥ b`) each give their own hint; test for each.
- [x] Ages `6-8` at `medium`/`hard` now end with an `euclid` level; `9-11` sets include it.
- [~] Automated play-through covers the mode and `facts` regressions; no human play-test (see README §7).

---

## WP4 — `shift`

**Touches**: `modes/shift.ts` + test, register, `i18n.ts`, `styles.ts`, `game.json` (`0.3.0`, add skill `place-value`), cartridge `README.md`, `index.html` preset, the status row in root `README.md` and `docs/VISION.md` ("3 of 4 modes"), `CHANGELOG.md`.

**Acceptance**
- [x] Digit strip moves by drag and by button; a non-zero digit cannot leave the table.
- [x] Over-shift and under-shift each fail Check with a hint that names the number of slides.
- [x] Six-digit dividends (`789 000`) fit at 375 px width.
- [x] Column labels in `en` and `fr` (⚠️ French abbreviations confirmed by the owner or flagged in the PR).

---

## WP5 — `long`

The largest mode; plan it as its own careful PR.

**Touches**: `modes/long.ts` + test, register, `i18n.ts`, `styles.ts`, `game.json` (`0.4.0`, add skill `long-division`), cartridge `README.md`, `index.html` preset, the status row in root `README.md` and `docs/VISION.md` ("4 of 4 modes, finishing"), `CHANGELOG.md`.

**Acceptance**
- [x] Walks the computed trace step by step in the potence layout; the three difficulty levels differ exactly as in [01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) §2.4.
- [x] `568 ÷ 8` (first partial is two digits) and `816 ÷ 8` (zero digit) are both solvable and tested end to end.
- [x] Ends with the equality step.
- [~] Width ✅; the long-division stage is 366 px high, but the whole game scrolls in a 400 px viewport ⚠️ (README §7).
- [x] Too-big and too-small digit hints are correct for every step of the four golden traces.

---

## WP6 — Finish to 1.0.0

**Goal**: the cartridge meets every line of AGENTS.md §3 and §9 and is labelled ✅.

**Touches**: `game.json` (`1.0.0`, final description), cartridge `README.md` (full write-up: purpose, age progression, formulas, level schema, example), `index.html` (the full 25-level sheet preset of [05-test-plan.md](05-test-plan.md) §1, plus one short preset per mode), root `README.md`, `docs/VISION.md`, `TODO.md` (tick Theme 3 item and Theme 6 items that are now true), `docs/design/number-workshop/*` (status lines → ✅ with any ⚠️ deviations recorded, as the other design specs do), `CHANGELOG.md`.

**Acceptance**
- [~] Cross-mode play-test at every age × difficulty and the 25-level sheet played to the end: automated (`playthrough.test.ts`) and once in a desktop browser; no human/real-device pass (README §7).
- [x] Coverage for the cartridge reported in the PR; no file under 80 % lines without a stated reason.
- [x] Every status label and game count in the repo is true.
- [x] Follow-ups discovered along the way are listed in `TODO.md` as proposals, not silently built.

---

## After 1.0.0 (not part of this plan, listed so nobody builds them by accident)

Other operations as new modes; two-digit divisors in `long`; decimals in `shift`; a bracket layout for `en`; Arabic and RTL (needs core work); a cross-cartridge level-schema catalogue for the platform ([TODO.md](../../../TODO.md) Theme 6).
