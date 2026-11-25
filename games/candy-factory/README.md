# 🍬 Candy Factory / La Fabrique de Bonbons

Customers place candy orders and the child fills and ships them. The factory packs **10 candies into a bag, 10 bags into a box and 10 boxes into a crate**. That packing machine *is* the carry of column addition: when the child sends 10 loose candies into the machine and 1 bag comes out, they are doing a carry with their own hands. At ages 9–11 the factory then switches automatically to **written mode**, where the same columns appear as a written addition and the bag becomes the little carried `1`.

- **Category**: `numbers`
- **Ages**: `3-5`, `6-8`, `9-11` (each bracket plays different modes, see below)
- **Languages**: `en`, `fr` (French is the main classroom language; customer names are Moroccan, amounts in a bill are in dirhams)
- **Skills**: counting, comparing numbers, place value, regrouping, addition with carrying, written addition, missing digit, error analysis, estimation
- **Version**: 1.0.0

## Learning goals (from the textbook pages it was designed for)

| Textbook exercise | What it trains | How the factory trains it |
|---|---|---|
| *Comparer et ranger les nombres de 1 à 9* (count fruit, colour the biggest/smallest) | Quantity ↔ numeral, more/fewer | **count**: fill an order of N candies; **compare**: give the jar with more / fewer |
| *L'addition posée avec retenue* (column additions) | The carry as regrouping 10 units into 1 of the next place | **add (physical)**: pack 10 into the machine; the truck refuses loose packs |
| Additions with three terms (`5 684 + 2 473 + 98`) | Column sums above 19, carry of 2 | Three orders combined; the carry box takes 2 |
| Missing digits (`2 5 _ _ + _ 7 1 = 6 4 2 7`) | Reasoning backwards through a column | **mystery**: the label is torn, find the digit |
| *Corrige les additions* | Checking a method, finding a forgotten carry | **robot**: Robo-Packer forgot a carry, tap the wrong digit and fix it |
| *Entoure l'estimation la plus proche* | Rounding to the nearest thousand | **estimate**: pick the right truck (≈ 2 000 / 4 000 / 6 000) |
| Invoice / shopping problems in Dh | Addition in context | **add** with `"story": "bill"`: a shop bill in dirhams |

## Age progression

| Age | Modes | What changes |
|---|---|---|
| **3–5** | `count`, `compare` | Quantities 1–5 with a gap of at least 2 (`easy`), 1–9 (`medium`); `hard` adds an order of 11–15 where 10 candies close into a bag on their own. A rising tone per candy lets the child *hear* the count. Numerals are hidden on `easy` compare (pure quantity). |
| **6–8** | `compare`, `add` (physical) | Compare jars where the jar with **more loose candies holds fewer** (e.g. 2 bags + 9 vs 3 bags + 1): the child must read the bags first. Every addition forces at least one carry (anti-mirroring). The child moves candies into the machine **one by one** (counting to 10), then writes the shipment's label (the total). `easy` 2-digit + 1/2-digit, `medium` 2-digit (+ a third order), `hard` 3-digit with up to 2 carries. |
| **9–11** | `add` (physical → written), `mystery`, `robot`, `estimate` | The first 2 orders are packed by hand (tapping a machine packs 10 at once), then **written mode switches on automatically** with a banner. Written mode enforces the method: type each column's digit right to left, and set the carry box when a column reaches 10 or more. `easy` uses 3-digit numbers (no estimate), `medium` 4-digit, `hard` 4-digit with three orders and up to 3 carries. |

The settings (age, difficulty, language) can change live, without remounting.

## How it plays

- **Tap or drag**: tap a candy jar or a bin, or drag a candy onto the bag / machine. All targets are at least 44×44 px.
- **Granular undo**: tap a candy in the bag to take it back; tap a half-filled machine to get its candies back (ages 6–8).
- **Forgiving refusals**: shipping with loose packs is refused by the driver with a hint. Refusals are not mistakes. Only wrong answers (wrong label, wrong digit, wrong jar, wrong truck) count as mistakes.
- **Feedback**: tones, a squish animation when a pack is made, a short settle pause, then `context.audio.playSuccess()`, confetti and the localized banner. Each shipped order adds a sticker to the shelf.
- **Stars**: 3 stars for at most 1 mistake, 2 for up to one mistake per order, else 1. An order is worth 100 points, minus 20 per mistake (at least 40).
- **Keyboard**: every control is a button; in written, mystery and robot modes and on the label keypad, the digit keys of a physical keyboard also work while focus is inside the game.
- `prefers-reduced-motion` turns off animations and confetti.

## Place-value colours

The same colours are used by the factory and the written grid, so a carry box shows the pack it stands for:

| Column | Factory item | Colour |
|---|---|---|
| units (u / U) | candy | pink `#f472b6` |
| tens (d / T) | bag | sky `#38bdf8` |
| hundreds (c / H) | box | orange `#fb923c` |
| thousands (m / Th) | crate | green `#4ade80` |
| ten thousands (dm / TTh) | written mode only | violet `#c4b5fd` |

## Maths

- Pouring all orders onto the belt gives the **raw column sums**: `27 + 15` → 12 candies and 3 bags.
- Packing moves 10 items of column *c* into 1 item of column *c + 1*; the value never changes (`valueOf` is invariant), and packing until every column is below 10 gives the digits of the sum.
- Written column *c*: `total = Σ digits + carryIn`, `digit = total mod 10`, `carryOut = ⌊total / 10⌋`. With three terms the carry can be 2.
- A **mystery** digit is unique: the visible sum and the other digits fix it.
- A **robot** answer is the sum with one carried-into column lowered by 1 (a forgotten carry), so exactly one digit is wrong.
- An **estimate** is the sum rounded to the nearest thousand. Generated levels keep the sum at least 150 away from a …500 boundary, and make rounding each order give the same truck, so there is a single correct answer.

## Custom levels (`levels` attribute / `context.customLevels`)

An array (or JSON string) of up to 20 levels. Invalid entries are skipped; if nothing valid remains the game falls back to procedural generation. Numbers must be integers; terms are 1–9 999, with 2 or 3 terms per addition.

```json
[
  { "mode": "count", "target": 7 },
  { "mode": "compare", "values": [29, 31], "ask": "more" },
  { "mode": "add", "terms": [27, 15], "view": "physical" },
  { "mode": "add", "terms": [5684, 2473, 98], "view": "written" },
  { "mode": "add", "terms": [815, 99, 478], "view": "written", "story": "bill" },
  { "mode": "mystery", "terms": [2571, 4271], "term": 0, "column": 1 },
  { "mode": "robot", "terms": [5972, 2956] },
  { "mode": "estimate", "terms": [2878, 1289] }
]
```

| Mode | Fields |
|---|---|
| `count` | `target` 1–19 |
| `compare` | `values` two different numbers 1–999, `ask` `"more"` (default) or `"fewer"` |
| `add` | `terms`; optional `view` `"physical"` / `"written"` (omitted: auto, written after 2 hand-packed orders at 9–11; sums above 9 999 are always written); optional `story: "bill"` |
| `mystery` | `terms`, `term` (index of the torn term), `column` (0 = units, must be a digit of that term) |
| `robot` | `terms` (must need a carry into a column of the terms whose sum digit is not 0); optional `column` = such a column (default: the first one) |
| `estimate` | `terms` with a sum of at least 1 000, not ending in exactly 500 (that would tie two trucks) |

This example is the playground's *Custom: Textbook sheet* preset in `index.html` (a test checks that it parses).

## Files

| File | Role |
|---|---|
| `index.ts` | Shell: HUD, level flow, scoring, telemetry, celebration, pausable timers, sticker shelf, `updateConfig` |
| `numbers.ts` | Pure place-value maths: column sums, packing, written addition steps, rounding, robot answers |
| `levels.ts` | Level types, `generateLevelsForAge(age, difficulty, rng?)`, `parseCustomLevels`, auto written-mode rule |
| `i18n.ts` | EN/FR dictionary and number formatting |
| `styles.ts` | Scoped CSS (pure CSS candies, bags, boxes, crates) |
| `views/` | One class per stage: `count`, `compare`, `pack` (physical), `written` (add, mystery, robot), `estimate`; `dom.ts` has the tap-or-drag and keypad helpers |
| `*.test.ts` | Maths, generator invariants for every age and difficulty, hostile-input parsing, i18n parity, and full DOM playthroughs to `game:complete` |

## Telemetry

`game:start`, `game:progress` (`step`, `total`), `game:score` (`points`, `streak`, `delta`) per order, and `game:complete` (`stars`, `score`, `timeElapsed`, `summary`) after the last order.

## Known limitations

- Tested in Chromium at desktop width and at 375 px with emulated touch (tap); dragging was tested with a mouse. It has not been play-tested on a real touch device or with children yet.
- Progress (stickers) lasts for one session only; nothing is stored.
