# 🧮 Division Workshop (`number-workshop`) — 🚧 1 of 4 modes

Teaches **division as fair sharing and grouping**, and the one statement behind it:

```text
a = b × q + r      with   0 ≤ r < b
```

dividend `a`, divisor `b`, quotient `q`, remainder `r`. Every mode shows that `r < b` visibly: what is left over is smaller than the number of plates.

Plan and decisions: [docs/design/number-workshop/](../../docs/design/number-workshop/README.md). Status of each mode:

| Mode | What the child does | Status |
|---|---|---|
| `facts` | Shares tokens equally onto plates, or builds rows of `b` | ✅ playable |
| `shift` | Slides digits to divide by 10, 100, 1000 | 🗺️ planned (WP4) |
| `euclid` | Completes `78 = (8 × ☐) + ☐` | 🗺️ planned (WP3) |
| `long` | Written long division, digit by digit | 🗺️ planned (WP5) |

While only `facts` is built, the procedural generator and the custom-level parser only produce and accept `facts` levels. Ages `9-11` therefore play `facts` levels in the **array** tier (tables 2–9, dividends above 30, remainders at `medium` and `hard`). A level of a mode that is not built yet is skipped, never rendered.

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
| `6-8` | 4 | Divisor 2–5, dividend ≤ 30, remainders at `medium`/`hard`. `÷` appears beside the picture. (The `euclid` finale arrives with WP3.) |
| `9-11` | 5 | Array tier, tables 2–9, dividend above 30, remainders at `medium`/`hard`. |

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

Tested example (also the "Custom: Sharing & arrays" preset in the playground):

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

`index.ts` (shell, lifecycle) · `modes/facts.ts` · `modes/index.ts` (registry) · `modes/types.ts` · `widgets/drag.ts` · `widgets/group-builder.ts` · `i18n.ts` · `styles.ts` · pure logic `division.ts`, `levels.ts`, `session.ts` · a test file beside each module.

## Not verified by tests

Drag feel and snap radii, animation timing, 44 px targets at real sizes, layout at 375 px, reduced-motion behaviour, sound, and whether the hints read well to a child. These are covered by the manual play-test script in [04-ux-and-vibe.md](../../docs/design/number-workshop/04-ux-and-vibe.md) §9.
