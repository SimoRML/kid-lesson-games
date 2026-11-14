# `number-workshop` — Division Workshop: Implementation Plan (v2)

> **Status (2026-11-14): 🗺️ Planned — plan approved by the owner on 2026-11-14, with the recommended default accepted for every question Q1–Q7 (§4).** Nothing described here exists on disk yet. Implementation proceeds one work package at a time ([06-delivery-plan.md](06-delivery-plan.md)).
> Legend used below: ✅ verified in this repo on 2026-11-14 · ⚠️ unverified / judgment call · ❓ owner decision.

This folder replaces the single-file first draft. It is written so that an agent starting cold can pick up **one work package** and deliver it without re-deriving the design.

## 1. Reading order

| # | File | Read it when you… |
|---|---|---|
| — | this file | always: scope, decisions, open questions |
| 1 | [01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) | need to know *what the child does* in each mode and age bracket |
| 2 | [02-level-schema.md](02-level-schema.md) | touch `parseCustomLevels`, the generator, or the JSON an LLM produces |
| 3 | [03-architecture.md](03-architecture.md) | write any code: file layout, module boundaries, lifecycle, repo gotchas |
| 4 | [04-ux-and-vibe.md](04-ux-and-vibe.md) | build any UI: look, feel, feedback, accessibility |
| 5 | [05-test-plan.md](05-test-plan.md) | write tests: golden values, what each suite must prove |
| 6 | [06-delivery-plan.md](06-delivery-plan.md) | are assigned a work package (WP): scope, files, acceptance criteria |
| 7 | [07-platform-integration.md](07-platform-integration.md) | work on the lesson-generator side (the LLM → `levels` contract) |

## 2. What we are building, in five sentences

A friend's platform takes a school document (PDF, image, or text prompt), hands it to an LLM behind a queue, and wants a gamified lesson back. We decided (**Reading A**, recorded in [TODO.md](../../../TODO.md) Theme 6) that the LLM produces **level data only**, never game code. Today all 6 cartridges are physics/metric games, so an ordinary arithmetic worksheet has nowhere to land. `number-workshop` is the cartridge that fills that gap, starting with **division**, grounded in a real Moroccan 4AEP worksheet (transcribed in [05-test-plan.md](05-test-plan.md) §1). Its defining rule: **the level data carries operands only, and the cartridge computes every answer itself**, so a wrong LLM answer can never reach a child.

### Goals
- Four division modes covering all four blocks of the sample sheet: `facts`, `shift`, `euclid`, `long`.
- Dual curriculum: procedural levels per age bracket and difficulty, plus validated custom `levels`.
- A small, strict, documented level schema an LLM can fill reliably.
- Zero changes to `src/`, zero new dependencies.
- Every merged PR leaves a playable, honest game on the live playground.

### Non-goals
- Other operations (addition, subtraction, multiplication, fractions, decimals). The schema is designed so they can be added later as new modes.
- A lesson sequencer, progress storage, or user accounts (platform side).
- Free text written by the LLM shown to children (see D7).
- Arabic or other locales: the core supports `en` and `fr` only today ✅.
- Any core API change. If one turns out to be needed, stop and ask (AGENTS.md §1).

## 3. Decisions (and what changed from the first draft)

Each decision is a default the plan is built on. The owner can overturn any of them at approval time; agents must not.

| ID | Decision | Why (what the review found) |
|---|---|---|
| D1 | **Vertical slices, not a headless first PR.** The first PR that adds `game.json` + `index.ts` must already be a complete, playable game (one mode). | ✅ The playground fills its game selector from `registry.list()` and merging to `main` deploys to GitHub Pages. A cartridge is live the moment both files exist, so the draft's "invisible stub in PR 1, wire it in PR 6" would have shipped a broken game. |
| D2 | **Pure logic lands first, without `game.json`.** | ✅ `src/index.ts` registers a game only when `game.json` *and* `index.ts` both exist. Pure modules plus tests can merge safely and invisibly. |
| D3 | **Modes are plug-ins inside the cartridge** (`modes/<mode>.ts` behind one small interface, listed in one registry array). The parser and generator only emit modes present in that registry. | Lets each mode ship as its own small PR while the game stays coherent; a level whose mode is not built yet is skipped, not crashed on. |
| D4 | **DOM + SVG + CSS rendering, not Canvas.** | The game is digits, equations, and grids. DOM gives real buttons, keyboard access, `aria-live`, crisp text, and tests that can assert on content in jsdom. Canvas would need all of that rebuilt by hand. ❓ Q1 |
| D5 | **Out-of-range numbers reject the level; they are never clamped.** Only list length is cut. | The draft said "clamp", which would silently turn `806 ÷ 5` into a different exercise than the teacher's sheet. |
| D6 | **Integers only: JSON numbers that are safe integers.** Numeric strings such as `"60 000"` are rejected. | One unambiguous rule is easier for an LLM prompt and for the parser than locale-dependent string parsing. |
| D7 | **No LLM free text in v1.** The draft's optional `instruction` string is dropped; all wording comes from the cartridge's own EN/FR dictionary. A level may pick a visual `theme` from a fixed list. | Unmoderated generated text in front of young children is a kid-safety risk, and a single string cannot follow a live `locale` switch. ❓ Q2 |
| D8 | **Interaction is chosen by number size, not by age.** `facts` uses one-by-one sharing for small dividends, round dealing for medium, and an array builder for large. | The draft had a 9-year-old dragging 64 tokens one at a time: that is button-mashing, which AGENTS.md §4 forbids. It also makes custom levels behave the same at any `age`. |
| D9 | **Builder-style modes need an explicit "Check" action.** | Otherwise pressing "+" until the game auto-wins solves every level without thinking. |
| D10 | **Limits fit the real sheet.** Up to 30 levels per set (the sheet has 25 items; the draft's cap of 20 could not hold it). `long` is 1-digit divisors only in v1. | Two-digit long division needs quotient-digit estimation, a different and much harder UI. Not in the sheet. |
| D11 | **French "potence" layout for long division in both locales.** | It is the layout on the sheet and the convention of the target curriculum. ⚠️ An `en`-locale audience used to the bracket layout may find it unfamiliar. ❓ Q3 |
| D12 | **A `levels.schema.json` file ships in the cartridge**, plus prose rules for what JSON Schema cannot express. No `src/` verify API. | Resolves the draft's open question on where the verifier lives: the cartridge recomputes everything, and the platform can pre-validate with any JSON Schema tool. |
| D13 | **No automatic restart after `game:complete`.** An end screen with a "Play again" button instead. | Auto-restart is an open roadmap question for other games ([TODO.md](../../../TODO.md)); a button is the neutral choice and keeps `game:complete` meaningful for an LMS. |
| D14 | **`game.json` version starts at `0.1.0`** and reaches `1.0.0` when all four modes are ✅. | Honest labelling while the cartridge is 🚧. Resolves draft question 4. |
| D15 | **`shift` stays exact-only** (`dividend` must end in enough zeros). | Decimals are outside the sheet and outside 4AEP block 1. Resolves draft question 5. |

Other corrections made during review: the sheet item `3 400 ÷ 100` is exact (34) and is now a golden test; the sheet's block 4 also asks for the final equality, so `long` ends with an equality step; `updateConfig` behaviour, locale handling, and jsdom limits are now specified from the actual code (see [03-architecture.md](03-architecture.md) §6).

## 4. Owner decisions on the open questions

**Settled on 2026-11-14: the owner accepted the default in every row.** The alternatives are kept for the record; reopening one is an owner decision.

| # | Question | Decided (the recommended default) | Alternative not taken |
|---|---|---|---|
| Q1 | Rendering technology (D4) | DOM + SVG + CSS | Canvas 2D like the physics cartridges, for visual consistency, at higher cost and weaker accessibility |
| Q2 | LLM-written text (D7) | None in v1; `theme` enum only | Allow a short per-level `instruction` string, `textContent` only, capped at 120 chars, accepting the moderation risk |
| Q3 | Long-division layout for `en` (D11) | Potence everywhere | Add a bracket layout for `en` later as its own PR |
| Q4 | Is "fair sharing" for ages 3–5 the right entry point? | Yes: sharing 4–12 objects between 2–3 friends, no symbols, no remainder | Publish the cartridge for `6-8` and `9-11` only |
| Q5 | 4AEP ↔ age bracket | `9-11` (see note) | — |
| Q6 | May mode PRs run in parallel after WP2? | No: one writer per cartridge (AGENTS.md multi-agent rule 2) | Yes, since each mode lives in its own file; only `modes/index.ts` and `i18n.ts` would conflict |
| Q7 | Who sets the cartridge's `game.json` version? ([06-delivery-plan.md](06-delivery-plan.md), version note) | The PR author sets the cartridge version; only the Merger touches the library version | The Merger sets both |

> Note on Q5: Moroccan primary school covers ages 6–11 according to the OECD's review of Morocco's education system; with six primary grades that places grade 4 (4AEP) at roughly 9–10 years old. ⚠️ Derived, not read from a ministry text; the owner knows the local reality better.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Pedagogy is grounded in **one** worksheet | Progressions are standard arithmetic and all facts are machine-checked in tests; wider curriculum coverage stays ⚠️ until the owner or a teacher reviews it |
| Four UIs in one cartridge is a lot | Mode plug-ins, shared widgets, one mode per PR, each PR shippable |
| An LLM produces garbage levels | Strict parser, per-level skip, procedural fallback, answers never trusted |
| Shared files conflict (`index.html`, `README.md`, `TODO.md`, `docs/VISION.md`, `CHANGELOG.md`) | Only WP2 and WP6 touch more than `CHANGELOG.md`; rebase right before each PR |
| Rollback | Every WP is one squash-merged PR; revert with `git revert` in a new PR |

## 6. Hand-off rules for implementing agents

1. Follow AGENTS.md §0 in full. This plan is the Gate 2 plan **once the owner approves it**; your PR description links the work package you are delivering.
2. One work package = one branch = one PR. Do not start WP *n+1* before WP *n* is merged.
3. If this plan and the code disagree, the code is the truth: stop, tell the owner, and fix the plan in the same PR as a separate commit.
4. If something is not specified here, do not guess: ask. The plan is deliberately explicit so that guessing is never needed.
5. Quality over speed. A mode is done when a child can understand *why* the answer is right from what happens on screen, not when the tests pass.
