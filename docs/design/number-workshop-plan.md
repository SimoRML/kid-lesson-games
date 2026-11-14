# `number-workshop` — Division Cartridge (First Draft Plan)

> **Status: 🗺️ Planned — DRAFT for review.** Nothing in this document exists on disk yet. No code is written until this plan is approved (AGENTS.md §0, Gate 2). Items marked **❓** are open questions for the owner; items marked **⚠️ unverified** are facts I could not confirm from this repo.

## 1. Why this cartridge

An external lesson generator (an LLM behind a queue, *Reading A*) will produce **level data** (JSON) for existing cartridges. It will **not** write game code. Today every cartridge is physics/metric, so a typical school exercise such as the sample sheet *"La division — 4AEP"* has no matching game.

`number-workshop` is a **generic arithmetic cartridge designed to be the target of LLM output**:

- A small, flat, discriminated-union level schema that an LLM can fill reliably.
- **The LLM supplies operands only; the cartridge computes every answer itself.** A wrong LLM answer can never be shown to a child.
- Defensive parsing (`parseCustomLevels`) with hard clamps, falling back to procedural levels (AGENTS.md §3.4, §Security).

### Goals
- Cover the exercise types in the sample sheet (all four, see §2).
- Dual curriculum: procedural fallback per age bracket and difficulty, plus validated `customLevels`.
- Zero changes to `src/` (cartridge isolation, AGENTS.md §1).

### Non-goals (this plan)
- Other operations (add / subtract / multiply, fractions). Possible later modes; not in scope.
- A shared cross-cartridge lesson schema, a lesson sequencer or progress storage (platform side).
- Arabic locale, other EU locales (core supports `en`/`fr` only today).
- Any core API, e.g. a public `verify()` hook (separate approved PR if wanted, see §9 ❓3).

## 2. Exercise modes (grounded in the sample sheet)

The sheet is *Mathématiques, Niveau 4 AEP, "La division"*. Its four exercise blocks map to four modes:

| Mode id | Sheet block | Example from the sheet | Concept |
|---|---|---|---|
| `shift` | 1 — Complète | `60 000 ÷ 100`, `789 000 ÷ 1 000`, `10 ÷ 10` | Dividing by 10/100/1000 removes zeros (place value) |
| `facts` | 2 — Calcule | `27 ÷ 3`, `42 ÷ 7`, `64 ÷ 8` | Division tables; sharing equally / grouping |
| `euclid` | 3 — Complète les égalités | `78 = (8 × …) + …` | Euclidean division `a = b × q + r`, `0 ≤ r < b` |
| `long` | 4 — Pose et calcule | `806 ÷ 5`, `568 ÷ 8` | Written long division, digit by digit |

Math facts used (standard, checkable): for integers `a ≥ 0`, `b ≥ 1` there are unique `q, r` with `a = b·q + r` and `0 ≤ r < b`. For `shift`, `a ÷ 10^k` is exact only if `a` ends in at least `k` zeros.

### Interaction sketches (tap/click **and** drag, ≥ 44×44 px targets, AGENTS.md §5)
- **`facts`**: `N` tokens (apples/dates, drawn with Canvas/SVG, no remote assets) and `b` plates. Child drags/taps tokens onto plates until shared equally. Live HUD: `27 ÷ 3 → 3 plates, 9 each so far…`. Remainder tokens appear in a "left over" tray.
- **`euclid`**: child sets `q` (stepper or drag bars of size `b`) and `r`; live equation `78 = (8 × 9) + 6`; win when both are correct. Hint (never the answer): "r must be smaller than 8".
- **`shift`**: place-value chips; child slides digits right / strikes zeros; live `60 000 ÷ 100` → `600`.
- **`long`**: guided steps of the written algorithm (divide, multiply, subtract, bring down); each step checked locally against a computed trace.

## 3. Age brackets (never "just bigger numbers", AGENTS.md §4)

> ❓1: The sheet is 4AEP. I believe 4AEP is about 9–10 years old (⚠️ unverified, please confirm). The mapping below assumes it falls in `9-11`.

| Age | Modes | Rules |
|---|---|---|
| `3-5` | `facts` | Dividend ≤ 12, divisor ∈ {2, 3}, **no remainder**, tokens on plates, 1 distractor-free step |
| `6-8` | `facts`, `euclid` (small) | Divisor ≤ 5, dividend ≤ 50, remainders introduced; **anti-mirroring**: never the trivial one-token-per-plate case |
| `9-11` | all four | Tables up to ÷9 (`facts`), `shift` with ÷10/100/1000, `euclid` up to `b ≤ 9`, `long` with 3-digit dividend ÷ 1-digit divisor |

`difficulty` modulates: remainder frequency, dividend size, zero density (`shift`), how many guided steps are pre-filled (`long`).

**Guaranteed solvability** is structural: levels are generated from `(b, q, r)` so the answer exists by construction; custom levels are recomputed, never trusted.

## 4. Level schema (LLM-facing contract)

Flat JSON array; each item has `mode` plus integers. **No answer fields are read** (extra keys, including any `answer`, `quotient`, `remainder`, are ignored).

```json
[
  { "mode": "shift",  "dividend": 60000, "divisor": 100 },
  { "mode": "facts",  "dividend": 27,    "divisor": 3 },
  { "mode": "euclid", "dividend": 78,    "divisor": 8 },
  { "mode": "long",   "dividend": 806,   "divisor": 5 }
]
```

Optional per level: `instruction` (string, ≤ 120 chars, rendered with `textContent` only).

### `parseCustomLevels(raw: unknown): Level[] | null`
- Accepts an array, a single object, or a JSON string; returns `null` if **no** level survives (game falls back to procedural).
- Per-level rejection (skip, not crash) when: unknown `mode`; non-integer / negative / `NaN` / `Infinity`; `divisor < 1`; `shift` not exact (`dividend % divisor !== 0`) or divisor not in `{10, 100, 1000}`; mode-specific caps below.
- **Clamps**: `dividend ≤ 999 999`; `divisor ≤ 1000`; `facts` dividend ≤ 100 (tokens are drawn); `euclid` divisor ≤ 12; `long` dividend ≤ 9 999 and divisor ≤ 99; max **20 levels** per set; `instruction` truncated to 120 chars.
- Pure function, deterministic, no DOM access.

### Pure math module (`division.ts`, no DOM → trivially testable)
`divide(a, b) → { q, r }`, `isExactShift(a, b)`, `longDivisionTrace(a, b)` (list of steps: partial dividend, digit, product, remainder, bring-down), `generateLevelsForAge(age, difficulty, seed?)`.

## 5. Files

**Create (cartridge only):**
```text
games/number-workshop/
├── game.json        # category "numbers", ageGroups per §3, skills: division, remainder, place-value, long-division
├── assets/thumb.svg
├── division.ts      # pure math + parser + generator (no DOM)
├── i18n.ts          # EN + FR via createI18nResolver
├── index.ts         # KidGame lifecycle + per-mode renderers
├── index.test.ts    # math, parser, age rules, DOM lifecycle
└── README.md
```
**Modify (serialized shared files, minimal edits, rebase right before PR):** `index.html` (select + `customPresetsByGame`), root `README.md` (game list), `TODO.md`, `docs/VISION.md` (gap table + catalog), `CHANGELOG.md` (`[Unreleased]` only).

**Will NOT touch:** `src/**`, `package.json` / lockfile, `vite.config.ts`, `tsconfig.json`, `.github/**`, any existing cartridge, any version number in a feature PR.

Scaffold with `npm run create-game number-workshop`, then trim/replace the generated files.

## 6. Tests (deterministic, Vitest)
- `divide`: `78 → (9, 6)` for `÷8`; property check `a = b·q + r`, `0 ≤ r < b` over a sweep.
- `shift`: `60000 ÷ 100 = 600`; reject `3400 ÷ 1000` (not exact).
- `longDivisionTrace(806, 5)` ends at `q = 161, r = 1`; `568 ÷ 8 = 71, r = 0`.
- `parseCustomLevels`: valid sheet sample, wrong answer keys ignored, `NaN`/`Infinity`/negative/huge strings/21+ levels/garbage JSON, `null` on all-invalid.
- `generateLevelsForAge`: per-bracket rules (§3), anti-mirroring at `6-8`, every generated level solvable.
- DOM lifecycle: `mount → start → pause/resume → updateConfig(locale, difficulty, ageGroup, customLevels) → destroy`, with no leaked timers/listeners; headless guards for `getContext('2d')` and `ResizeObserver`.

## 7. Delivery in small chunks (AGENTS.md §0: one concern per PR, small logical commits)

Each row is its own branch/PR, reviewed and merged before the next one builds on it.

| # | PR | Content | Semver |
|---|---|---|---|
| 0 | `docs/number-workshop-plan` | This plan + TODO items | none (docs) |
| 1 | `feat/number-workshop-core` | Scaffold, `division.ts`, parser, generator, tests (headless; stub renderer) | minor |
| 2 | `feat/number-workshop-facts` | `facts` mode UI, i18n, thumb | minor |
| 3 | `feat/number-workshop-euclid` | `euclid` mode | minor |
| 4 | `feat/number-workshop-shift` | `shift` mode | minor |
| 5 | `feat/number-workshop-long` | `long` mode | minor |
| 6 | `docs/number-workshop-wiring` | Playground select + presets, README/VISION gap rows to ✅ | patch |

Commits inside each PR: tests + pure code, then UI, then docs, in separate Conventional Commits.

> ❓2: Should PR 1 already register the cartridge in `index.html`, or stay invisible until a mode is playable (my recommendation: invisible, wire it in PR 6)?

## 8. Security, a11y, kid-safety
- Treat `levels` as hostile: only `textContent`/DOM APIs, clamped numerics, capped list length and string length.
- No remote assets, no new dependencies, no analytics; audio via `context.audio` only, no unbounded loud sound.
- `prefers-reduced-motion` respected for token/confetti animation where feasible; nothing flashes > 3×/s.
- Targets ≥ 44×44 px; HiDPI canvas via `ResizeObserver` + `devicePixelRatio`.

## 9. Open questions for the owner
1. ❓1 Age mapping of 4AEP (see §3).
2. ❓2 Register in the playground early or late (see §7).
3. ❓3 Where does the **platform-side** math verifier live? Recommendation: nothing in `src/`; the cartridge already recomputes everything, and the platform can reuse `division.ts` helpers if exported. A core `verify` API would be a separate, explicitly approved `src/` PR.
4. ❓4 Initial `game.json` version: `0.1.0` until all four modes land, or `1.0.0` like the others?
5. ❓5 Should `shift` also allow ÷10/100/1000 with non-exact dividends (decimals, e.g. `34 ÷ 10 = 3,4`)? The sample sheet only uses exact cases, so this plan excludes it.

## 10. Risks & rollback
- **Pedagogy risk**: curriculum wording and progression are only grounded in one sample sheet; broader 4AEP coverage is ⚠️ unverified.
- **Scope risk**: four UIs in one cartridge is large, hence the 6-PR split.
- **Rollback**: each PR is independent and revertable via `git revert`.
