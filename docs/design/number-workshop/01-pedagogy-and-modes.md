# 01 — Pedagogy and Modes

> Part of the [`number-workshop` plan](README.md). Status: 🗺️ Planned.

## 1. The maths, stated once

For integers `a ≥ 0` and `b ≥ 1` there is exactly one pair `(q, r)` with

```text
a = b × q + r     and     0 ≤ r < b
```

`q` is the quotient, `r` the remainder. Everything in this cartridge is that one statement seen from four angles. The condition `r < b` is the part children most often miss, so every mode makes it visible.

Vocabulary used in the UI: dividend / dividende, divisor / diviseur, quotient / quotient, remainder / reste.

## 2. The four modes

| Mode | Sheet block | Concept | The child's insight |
|---|---|---|---|
| `facts` | 2 — Calcule (`27 ÷ 3`) | Division as fair sharing and as grouping; inverse of the times tables | "Dividing is sharing equally. What is left over is smaller than the number of plates." |
| `shift` | 1 — Complète (`60 000 ÷ 100`) | Dividing by 10, 100, 1000 as a place-value shift | "Each ÷10 moves every digit one place to the right." |
| `euclid` | 3 — Complète les égalités (`78 = (8 × …) + …`) | Euclidean division written as an equality | "I fit as many 8s as I can; what is left must be smaller than 8." |
| `long` | 4 — Pose et calcule (`806 ÷ 5`) | The written algorithm, digit by digit | "Long division is the same small question asked once per digit." |

Recommended teaching order inside a session, concrete to abstract: `facts` → `shift` → `euclid` → `long`.

### 2.1 `facts` — share it out

The dividend is a pile of tokens, the divisor is a row of plates. The interaction tier depends on the **dividend size** (decision D8), so the same level behaves the same at any `age`:

| Tier | Dividend | What the child does | Win check |
|---|---|---|---|
| **Share** | ≤ 12 | Drags or taps tokens one at a time onto plates. Tapping a placed token sends it back (granular undo). | Automatic, after a short settle: all plates hold the same count **and** the tray holds fewer tokens than there are plates. |
| **Deal** | 13 – 30 | Same, plus a "one for everyone" button that deals one token to each plate while the tray still has enough. | Same automatic check. |
| **Array** | > 30 | Uses the **group builder** (§3): adds or removes rows of `b` tokens until the array matches the dividend, then presses Check. | Explicit Check (decision D9). |

- Each plate shows a live count badge. The HUD reads, for example, `27 ÷ 3 → 3 plates, 8 each, 3 still to share`.
- Unequal plates are never an error state, just "not there yet": the HUD says who has fewer.
- With a remainder, the tray relabels itself "left over" once fewer than `b` tokens remain, and the HUD says why they cannot be shared.
- Themes for tokens (level field `theme`): `dates`, `apples`, `marbles`, `stars`. All drawn with SVG, no remote assets.

### 2.2 `shift` — slide the digits

A place-value table with one column per position and the dividend's digits sitting in it.

- The child slides the whole digit strip one column to the right (drag, or a "÷10" button). Each slide is one division by ten; a counter shows `÷10 × 2 = ÷100`.
- A digit that would fall off the right edge must be a zero. If it is not, the strip refuses to move and the HUD explains that only zeros can leave. (With valid levels this can only happen when the child over-shifts.)
- The child presses Check when they believe the shift matches the divisor. Too few or too many slides gets a hint that names the count, not the answer: "÷100 is two slides".
- This teaches the place-value shift, not the "cross out the zeros" trick, because the trick breaks later with decimals.

Column labels: `en` uses `HTh TTh Th H T O`; `fr` uses `CM DM UM C D U`. ⚠️ Confirm the French abbreviations match the classroom's habit.

### 2.3 `euclid` — fit the groups

The equation `78 = (8 × ☐) + ☐` sits above a number track from 0 to the dividend.

- The child builds `q` with the **group builder**: each added group lays one bar of length `b` on the track. Going past the dividend is allowed and shown clearly as "too far"; it is instructive.
- The child enters `r` on a small keypad. At `easy` and `medium` the gap between the last bar and the end of the track is drawn as countable unit squares; at `hard` the gap is unmarked.
- Check accepts only the Euclidean answer. The important wrong answer is a **true equality with `r ≥ b`** (for example `78 = (8 × 8) + 14`): the hint is "the equality is true, but you can still fit another 8".
- Other hints: `b × q` beyond the dividend → "too far, take one group away"; equality false → "count the gap again".

### 2.4 `long` — the written algorithm

The potence layout from the sheet: dividend on the left, divisor top right, quotient under the divisor (decision D11).

The cartridge computes a **trace** (see [02-level-schema.md](02-level-schema.md) §5) and walks the child through it. One step per quotient digit:

1. **Divide**: the current partial dividend is highlighted; the child enters the quotient digit on the keypad.
2. **Multiply**: `digit × divisor` is written under the partial dividend.
3. **Subtract**: the remainder of the step is written.
4. **Bring down**: the child taps the next digit of the dividend to bring it down.

After the last digit comes the **equality step**, because the sheet asks for it ("puis indique l'égalité"): the child completes `806 = (5 × ☐) + ☐` by placing the quotient and the remainder they just found.

What the child must enter depends on `difficulty`:

| Difficulty | Child enters | Cartridge animates |
|---|---|---|
| `easy` | quotient digit | product and subtraction |
| `medium` | quotient digit, step remainder | product |
| `hard` | quotient digit, product, step remainder | nothing |

Hints for a wrong quotient digit never give the digit: too big → "5 × 2 = 10 is more than 8"; too small → "there is room for one more 5".

Two cases the trace must handle and the tests must cover: a first digit smaller than the divisor (`568 ÷ 8` starts with `56`), and a zero inside the quotient (`816 ÷ 8 = 102`), which is a full step where the child enters `0`.

## 3. Shared widget: the group builder

Used by `facts` (Array tier) and `euclid`. One widget, two skins:

- "+ group" and "− group" buttons (≥ 44×44 px), holdable for repeat on touch.
- A visual that grows by exactly `b` units per group: an array of rows (`facts`) or bars on a number track (`euclid`).
- A live read-out `b × groups = total`.
- It never decides the win. The mode owns Check.

Building it once is the main implementation economy of the cartridge.

## 4. Age brackets (procedural levels)

Meaningful differentiation, never just bigger numbers (AGENTS.md §4). Custom levels bypass this table: they are played as supplied, within the schema limits. The one thing `age` still controls for a custom level is presentation: at `3-5`, a `facts` level (any tier) uses the symbol-free presentation described below; `shift`, `euclid`, and `long` are symbolic by nature and always show their symbols, at any age.

| Age | Levels | Modes | Rules |
|---|---|---|---|
| `3-5` | 3 | `facts` (Share tier only) | Dividend ≤ 12, divisor 2–4 (which ones depends on difficulty), **always exact**, quotient ≥ 2. **Symbol-free presentation**: no `÷` and no equation; the prompt is a sentence ("Give each friend the same number of dates") and so is the result ("Each friend has 4 dates"). |
| `6-8` | 4 | `facts` (Share / Deal), then `euclid` as the last level at `medium` and `hard` | Divisor 2–5, dividend ≤ 30. Remainders appear. The symbol `÷` is introduced beside the picture. |
| `9-11` | 5 | all four, in teaching order | `facts` in Array tier with tables 2–9; `shift` by 10/100/1000; `euclid` with divisor 3–9 and dividend ≤ 99; `long` with a 3-digit dividend (4-digit at `hard`) and 1-digit divisor. `medium` is the 4AEP sheet's range. |

### Difficulty

The bracket table above is the outer envelope; each cell below narrows it. Where the two seem to differ, the cell wins.

| | `easy` | `medium` | `hard` |
|---|---|---|---|
| `3-5` | divisor 2, dividend ≤ 8 | divisor 2–3, dividend ≤ 12 | adds divisor 4 (dividends 8, 12) |
| `6-8` | exact only, divisor 2–3, all four levels `facts` | remainders in about half the levels, divisor 2–5, `euclid` finale | remainder in most levels, divisor 2–5, `euclid` finale |
| `9-11` | exact `facts`; `shift` by 10/100; `long` with first digit ≥ divisor and no zero in the quotient | sheet-like mix, remainders, `shift` by 1000 | `long` with a first digit below the divisor or a zero in the quotient, 4-digit dividends; `euclid` gap unmarked |

### Anti-mirroring and variety rules (generator invariants, all tested)

- Never the trivial case: quotient ≥ 2 and divisor ≥ 2 in every generated level (one token per plate, or one plate, teaches nothing).
- No two consecutive levels with the same `(mode, dividend, divisor)`.
- A level set never uses the same divisor in all of its `facts` levels, **except** in a cell that allows only one divisor (`3-5` `easy`), where the dividends must all differ instead.
- **Solvable by construction**: the generator picks `(b, q, r)` with `0 ≤ r < b` first and derives `a = b × q + r`. There are no distractor pieces in this cartridge; the "plausible wrong paths" are the over-shoot, the over-shift, and the non-Euclidean equality, each of which gets its own hint.

## 5. Feedback and scaffolding principles

- The HUD instruction is **live**: it restates the current state in words and numbers after every action.
- Hints name the rule, never the answer.
- A mistake is a failed Check or a rejected step entry. Undo is never a mistake.
- On success there is a settle window of about 0.6 s in which the solved state stays on screen with the full equality written out (`27 ÷ 3 = 9`, `78 = (8 × 9) + 6`; in the symbol-free presentation, the result sentence instead), so the child sees why it worked before the celebration.
- Number formatting follows the locale: `60 000` in `fr`, `60,000` in `en`.
