# 🧮 Division Workshop (`number-workshop`) — 🚧 3 of 4 modes

Teaches **division as fair sharing and grouping**, and the one statement behind it:

```text
a = b × q + r      with   0 ≤ r < b
```

dividend `a`, divisor `b`, quotient `q`, remainder `r`. Every mode shows that `r < b` visibly: what is left over is smaller than the number of plates.

Plan and decisions: [docs/design/number-workshop/](../../docs/design/number-workshop/README.md). Status of each mode:

| Mode | What the child does | Status |
|---|---|---|
| `facts` | Shares tokens equally onto plates, or builds rows of `b` | ✅ playable |
| `shift` | Slides digits in a place-value table to divide by 10, 100, 1000 | ✅ playable |
| `euclid` | Completes `78 = (8 × ☐) + ☐`: fits groups on a number track, types the remainder | ✅ playable |
| `long` | Written long division, digit by digit | 🗺️ planned (WP5) |

While only `facts`, `shift` and `euclid` are built, the procedural generator and the custom-level parser only produce and accept those three modes; a slot of a mode that is not built yet is filled by `facts` (or `euclid`), and a custom level of an unbuilt mode is skipped, never rendered. Ages `9-11` therefore play `facts` (array tier), `shift` and `euclid` levels until `long` lands (its slot is filled by `facts`).

## `shift`: slide the digits

A place-value table with one column per position (`HTh TTh Th H T O` in English, `CM DM UM C D U` in French ⚠️ the French abbreviations still need confirming against the classroom's habit) holds the dividend's digits. The child slides the whole digit strip one column to the right, by the **÷10 →** button or by dragging the strip (whole columns, stopping at the first refusal), and **← ×10** slides back. A counter reads `÷10 × 2 = ÷100`. Every slide is one division by ten, so the lesson is place value, not "cross out the zeros".

- A digit that would fall off the right edge must be a zero. If it is not (for example a third slide of `3 400`), the strip refuses to move and the HUD explains that only zeros can leave. A refusal is gentle feedback, not a mistake.
- **Check** compares the number of slides with the divisor. Too few and too many each give a hint that names the count ("÷100 is 2 slides. You made 1: keep sliding.") and count one mistake.
- Slides are capped at 4; the digits that fell off stay visible, dimmed, in a hatched area beside the table. Six-digit dividends (`789 000`) fill all six columns and fit at 375 px.

## `euclid`: fit the groups

The anchor above the stage reads `78 = (8 × ?) + ?`. The child builds the quotient with the same **group builder** as `facts`' array tier (bars of length `b` laid on a number track from 0 to the dividend) and types the remainder on a **keypad** (buttons, or digit keys and Backspace anywhere in the stage). The gap between the last bar and the end of the track is drawn as countable unit squares at `easy` and `medium`, and left unmarked at `hard`. Going past the dividend is allowed and drawn hatched ("too far"). **Check** accepts only the Euclidean answer (`r < b`), and each wrong path has its own hint (never the answer):

| Wrong path | Example for 78 ÷ 8 | Hint says |
|---|---|---|
| Too far | 10 groups | the groups pass the dividend, take one away |
| False equality | 9 groups, remainder 5 | they do not add up to 78, count the gap again |
| True equality, `r ≥ b` | 8 groups, remainder 14 | the equality is true, but another group of 8 still fits |

Forgetting to type the remainder shows a reminder and is not a mistake. Undo (− group, backspace) never is.

## `facts` interaction tiers (chosen by dividend size, not by age)

| Tier | Dividend | What the child does | Win |
|---|---|---|---|
| Share | ≤ 12 | Press a plate (or drag a token onto it) to add one token. Tap a placed token to take it back. | Automatic: every plate holds the same count and fewer than `b` tokens remain |
| Deal | 13 – 30 | Same, plus **Deal one to each** | Same |
| Array | > 30 | **+ group / − group** add rows of `b` (hold to repeat) | Explicit **Check**: the right number of full rows |

Mistakes are failed Checks only. Undo, moving a token and unequal plates are never mistakes. Hints name the rule, not the answer: *"There is still room for another row of 8."*

With a remainder, the tray relabels itself **left over** and the HUD says why: *"2 dates left over: fewer than 4 plates, so they cannot be shared equally."*

## Age brackets (procedural levels)

| Age | Levels | Rules |
|---|---|---|
| `3-5` | 3 | `facts` share tier, always exact, divisor 2–4 by difficulty. **No `÷` and no equation anywhere**: sentences only ("Give each of the 3 friends…", "Each friend has 4 dates."). |
| `6-8` | 4 | `facts` with divisor 2–5, dividend ≤ 30, remainders at `medium`/`hard`; at `medium` and `hard` the last level is `euclid`. `÷` appears beside the picture. |
| `9-11` | 5 | `facts` in the array tier (tables 2–9, dividend above 30), a `shift` level (by 10/100, and 1000 at `medium`/`hard`) and `euclid` levels (remainder always > 0), remainders at `medium`/`hard`. |

`easy` is exact-only and has smaller numbers; see the slot plan in [01-pedagogy-and-modes.md](../../docs/design/number-workshop/01-pedagogy-and-modes.md) §4. Levels never repeat in a set.

## Semantic colours

The same four roles are colour-coded everywhere (equation, tokens, tray, readouts) and each also has a label, so colour is never the only cue. Contrast ratios are measured against the two surface colours:

| Role | Colour | on `#0f172a` | on `#1e293b` |
|---|---|---|---|
| dividend | `#38bdf8` sky | 8.33 : 1 | 6.83 : 1 |
| divisor | `#c4b5fd` violet | 9.67 : 1 | 7.92 : 1 |
| quotient | `#4ade80` green | 10.25 : 1 | 8.40 : 1 |
| remainder | `#fb923c` orange | 7.89 : 1 | 6.46 : 1 |
| text | `#f8fafc` | 17.06 : 1 | 13.98 : 1 |

All pass WCAG AA (4.5 : 1) for text.

## Custom `levels`

Operands only: the cartridge computes every answer itself, so a wrong answer in the data can never reach a child. Out-of-range or unbuilt-mode levels are skipped; if nothing usable remains, procedural levels are used. Schema: [levels.schema.json](levels.schema.json), rules: [02-level-schema.md](../../docs/design/number-workshop/02-level-schema.md).

Tested example (also the "Custom: Sharing & arrays" preset in the playground; two more presets, "Slide the digits" (`shift`, e.g. `{ "mode": "shift", "dividend": 60000, "divisor": 100 }`) and "Fit the groups", hold `euclid` levels from the sample sheet such as `{ "mode": "euclid", "dividend": 78, "divisor": 8 }`):

```json
[
  { "mode": "facts", "dividend": 12, "divisor": 3, "theme": "apples" },
  { "mode": "facts", "dividend": 27, "divisor": 3, "theme": "dates" },
  { "mode": "facts", "dividend": 25, "divisor": 4, "theme": "marbles" },
  { "mode": "facts", "dividend": 63, "divisor": 7, "theme": "stars" },
  { "mode": "facts", "dividend": 47, "divisor": 8 }
]
```

`theme` is optional (`dates`, `apples`, `marbles`, `stars`); at ages 3-5 the symbol-free presentation is used for any `facts` level.

## Config updates

`<kid-game>` resends its whole config on any attribute change. The game restarts only when the level set or the rules really change; a sound or locale change never resets progress. The table is in [03-architecture.md](../../docs/design/number-workshop/03-architecture.md) §6.1 and each row has a test.

## Telemetry

`game:progress` (`facts 27÷3`), `game:score` (100 per level, +50 for a level without a mistake), `game:complete` once with stars (3 for at most one mistake, 2 for at most one per level on average, else 1). After the last level an end screen offers **Play again**; nothing restarts automatically.

## Files

`index.ts` (shell, lifecycle) · `modes/facts.ts` · `modes/shift.ts` · `modes/euclid.ts` · `modes/index.ts` (registry) · `modes/types.ts` · `widgets/drag.ts` · `widgets/group-builder.ts` · `widgets/keypad.ts` · `i18n.ts` · `styles.ts` · pure logic `division.ts`, `levels.ts`, `session.ts` · a test file beside each module.

## Not verified by tests

Drag feel and snap radii, animation timing, 44 px targets at real sizes, layout at 375 px, reduced-motion behaviour, sound, and whether the hints read well to a child. These are covered by the manual play-test script in [04-ux-and-vibe.md](../../docs/design/number-workshop/04-ux-and-vibe.md) §9.
