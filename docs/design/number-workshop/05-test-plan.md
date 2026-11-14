# 05 — Test Plan and Golden Values

> Part of the [`number-workshop` plan](README.md). Status: 🗺️ Planned.
> All numbers in this file were computed by script on 2026-11-14 ✅, not typed from memory. Tests must hard-code these values, not recompute them with the function under test.

## 1. Fixture: the sample sheet (25 levels)

Source: worksheet "LA DIVISION", Mathématiques, niveau 4 AEP, semestre 1 (owner-supplied; the PDF itself is not in the repository). Save as a test fixture (`SHEET_LEVELS` in `levels.test.ts`) and reuse it as the playground preset in WP6.

```json
[
  { "mode": "shift", "dividend": 60000,  "divisor": 100 },
  { "mode": "shift", "dividend": 5000,   "divisor": 10 },
  { "mode": "shift", "dividend": 10,     "divisor": 10 },
  { "mode": "shift", "dividend": 200,    "divisor": 100 },
  { "mode": "shift", "dividend": 3400,   "divisor": 100 },
  { "mode": "shift", "dividend": 789000, "divisor": 1000 },

  { "mode": "facts", "dividend": 27, "divisor": 3 },
  { "mode": "facts", "dividend": 42, "divisor": 7 },
  { "mode": "facts", "dividend": 64, "divisor": 8 },
  { "mode": "facts", "dividend": 48, "divisor": 6 },
  { "mode": "facts", "dividend": 16, "divisor": 4 },
  { "mode": "facts", "dividend": 36, "divisor": 6 },
  { "mode": "facts", "dividend": 63, "divisor": 7 },
  { "mode": "facts", "dividend": 25, "divisor": 5 },

  { "mode": "euclid", "dividend": 78, "divisor": 8 },
  { "mode": "euclid", "dividend": 57, "divisor": 7 },
  { "mode": "euclid", "dividend": 59, "divisor": 9 },
  { "mode": "euclid", "dividend": 39, "divisor": 4 },
  { "mode": "euclid", "dividend": 22, "divisor": 3 },
  { "mode": "euclid", "dividend": 47, "divisor": 8 },
  { "mode": "euclid", "dividend": 98, "divisor": 8 },
  { "mode": "euclid", "dividend": 75, "divisor": 5 },
  { "mode": "euclid", "dividend": 59, "divisor": 4 },

  { "mode": "long", "dividend": 806, "divisor": 5 },
  { "mode": "long", "dividend": 568, "divisor": 8 }
]
```

## 2. Golden answers

| Mode | Exercise → `q` r `r` |
|---|---|
| `shift` | 60000÷100 → 600 · 5000÷10 → 500 · 10÷10 → 1 · 200÷100 → 2 · 3400÷100 → 34 · 789000÷1000 → 789 (all r 0) |
| `facts` | 27÷3 → 9 · 42÷7 → 6 · 64÷8 → 8 · 48÷6 → 8 · 16÷4 → 4 · 36÷6 → 6 · 63÷7 → 9 · 25÷5 → 5 (all r 0) |
| `euclid` | 78÷8 → 9 r 6 · 57÷7 → 8 r 1 · 59÷9 → 6 r 5 · 39÷4 → 9 r 3 · 22÷3 → 7 r 1 · 47÷8 → 5 r 7 · 98÷8 → 12 r 2 · 75÷5 → 15 r 0 · 59÷4 → 14 r 3 |
| `long` | 806÷5 → 161 r 1 · 568÷8 → 71 r 0 |

### Long-division traces (`partial`, `digit`, `product`, `remainder`)

| Exercise | Steps | Why it is in the suite |
|---|---|---|
| 806 ÷ 5 | (8, 1, 5, 3) → (30, 6, 30, 0) → (6, 1, 5, 1) | sheet item; plain case with remainder |
| 568 ÷ 8 | (56, 7, 56, 0) → (8, 1, 8, 0) | sheet item; first digit smaller than the divisor |
| 816 ÷ 8 | (8, 1, 8, 0) → (1, 0, 0, 1) → (16, 2, 16, 0) = 102 | zero inside the quotient |
| 100 ÷ 7 | (10, 1, 7, 3) → (30, 4, 28, 2) = 14 r 2 | zeros in the dividend, remainder |

## 3. Suites

One test file beside each module. Deterministic: inject `rng`, use fake timers, no real waiting.

### `division.test.ts`
- Every golden value in §2.
- Sweep: for all `1 ≤ b ≤ 12`, `0 ≤ a ≤ 500`: `a === b*q + r` and `0 ≤ r < b`.
- Trace property over a sweep of `long`-legal inputs: digits concatenate to `q`; last `remainder` equals `r`; every step has `0 ≤ remainder < b` and `product === digit * b`.
- `isExactShift`: true for the six sheet items; false for `3400 ÷ 1000`, `34 ÷ 10`, and any divisor outside {10, 100, 1000}.

### `levels.test.ts`
- `SHEET_LEVELS` parses to 25 levels (with all modes enabled) in the same order.
- Accepts: array, single object, JSON string, `{ version: 1, levels }`.
- Returns `null` for: `null`, `undefined`, numbers, `''`, invalid JSON, `{}`, `[]`, an all-invalid array, `{ version: 2, levels: [...] }`, a string over 20 000 characters.
- Skips (keeps the rest): unknown mode; a mode not in the enabled list; `"27"` as a string; `27.5`; `NaN`; `Infinity`; `-27`; `2**53`; divisor `0` and `1`; each limit of [02-level-schema.md](02-level-schema.md) §2 at one past its bound, and accepts each at its bound; `shift` with `3400 ÷ 1000`; `facts` with `100 ÷ 2` (quotient 50).
- Ignores extra keys: a level with `"answer": 999`, `"quotient"`, `"remainder"`, `"instruction": "<img src=x onerror=alert(1)>"` parses to an object with only the known fields.
- Prototype safety: an item created with `JSON.parse('{"__proto__": {"mode": "facts"}, "dividend": 6, "divisor": 2}')` is skipped (it has no `mode` of its own); an item built with `Object.create({ mode: 'facts', dividend: 6, divisor: 2 })` is skipped too, because only own properties are read; output objects have no inherited data.
- Truncation: 31 valid levels → 30; an array of 10 000 junk items returns quickly and yields `null`.
- Never throws: run the parser over a table of hostile values inside `expect(() => …).not.toThrow()`.
- `levelsSignature`: equal for equal sets, different when any operand, mode, or order differs.
- Generator, for each of the 9 age × difficulty cells and several seeds: level count; allowed modes; every rule of [01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) §4; anti-mirroring invariants; every level passes `parseCustomLevels`; ages `3-5` always exact; same seed → same set.
- `levels.schema.json` bounds equal `LIMITS`.
- With an empty `modes` list: parser → `null`, generator → `[]`.

### `session.test.ts`
- Score (100 / 150), streak, stars thresholds at their boundaries, `timeElapsed` excluding paused time (fake timers).

### `index.test.ts` (shell, jsdom)
- `BUILT_MODES` matches the keys of the mode registry (from WP2 on).
- `createGame` and the default export both return a game; `generateLevelsForAge` and `parseCustomLevels` are re-exported.
- `mount` → `start` renders the HUD with level badge `1/N`, in `en` and in `fr`.
- Mount does not throw when `ResizeObserver`, `matchMedia`, and `PointerEvent` are undefined (the jsdom default).
- Hostile config: `customLevels` garbage → procedural set, no throw; `locale: '<bad>'` → English, no throw.
- `updateConfig({ sound: false, customLevels: null })` mid-level does **not** restart the level or the score; neither does a locale change; the visible text switches language.
- One test per row of the restart table in [03-architecture.md](03-architecture.md) §6.1: a different custom set restarts; the same custom set resent does not; a difficulty change restarts in both custom and procedural play; an age change restarts procedural play but not a custom set.
- Solving every level emits `game:progress` and `game:score` per level and `game:complete` exactly once, with a valid `stars` value; no automatic restart afterwards; "Play again" starts a new run.
- `pause()` blocks input and freezes the pending advance; `resume()` continues.
- `destroy()`: container empty; no pending timers (`vi.getTimerCount() === 0`); a `pointermove` dispatched on `window` afterwards has no effect; `context.audio.close` was not called (spy).
- No `innerHTML` assignment with dynamic data: assert by test that a level containing markup-looking extra keys never produces an element that was not in the static template (for example, no `img` in the container).

### `modes/<mode>.test.ts` (one per mode PR)
- Drive the mode through its public DOM (clicks on buttons, `MouseEvent('pointerdown' | 'pointermove' | 'pointerup')` for drags) to a solved state for at least: one sheet item, one remainder case, and the mode's special case (`facts`: each tier; `shift`: over-shift; `euclid`: the `r ≥ b` equality; `long`: first digit below divisor and a zero quotient digit).
- Each documented wrong action calls `reportMistake` once and shows the documented hint; undo does not.
- `solved()` is called exactly once per level.
- `onLocaleChange()` keeps progress; `reset()` restores the initial state; `destroy()` leaves the stage empty.
- Every interactive element is a `<button>` or has a role and an accessible name.

## 4. What tests cannot prove (must be checked by hand and stated in the PR)

Drag feel, snap radii, animation timing, 44 px targets at real sizes, layout at 375 px, reduced-motion behaviour, sound, and whether the hints are actually understandable. Use the play-test script in [04-ux-and-vibe.md](04-ux-and-vibe.md) §9.

## 5. Gate 5 commands (every PR)

```bash
npm ci                    # fresh worktree only
npx tsc --noEmit
npm test
npm run build
npm run build:pages
git diff --name-only origin/main -- src/   # must print nothing
npm run test:coverage     # coverage of touched files must not drop
```
