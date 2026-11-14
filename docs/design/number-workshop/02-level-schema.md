# 02 — Level Schema, Parser, Generator

> Part of the [`number-workshop` plan](README.md). Status: 🗺️ Planned.
> This is the contract between a lesson generator (LLM) and the cartridge. Treat every byte of `levels` as hostile input (AGENTS.md security rules).

## 1. Shape

A flat array of level objects, or the same array inside a versioned envelope:

```json
[
  { "mode": "facts",  "dividend": 27,    "divisor": 3, "theme": "dates" },
  { "mode": "shift",  "dividend": 60000, "divisor": 100 },
  { "mode": "euclid", "dividend": 78,    "divisor": 8 },
  { "mode": "long",   "dividend": 806,   "divisor": 5 }
]
```

```json
{ "version": 1, "levels": [ { "mode": "euclid", "dividend": 78, "divisor": 8 } ] }
```

- `mode`: required, one of `"facts" | "shift" | "euclid" | "long"`.
- `dividend`, `divisor`: required, JSON **numbers** that are safe integers (decision D6).
- `theme`: optional, `facts` only, one of `"dates" | "apples" | "marbles" | "stars"`. Unknown or missing → the cartridge picks one.
- **Every other key is ignored**, including `answer`, `quotient`, `remainder`, `instruction`. The cartridge never reads an answer (decision D7 for text).
- The envelope's `version` must be `1` if present; any other value makes the whole input invalid (`null`).

Forward compatibility: a level with an unknown `mode` is skipped, so an older cartridge degrades gracefully when a newer generator emits a mode it does not know.

## 2. Limits

Named constants exported from `levels.ts` as `LIMITS`, mirrored in `levels.schema.json`, and asserted equal by a test.

| Mode | `divisor` | `dividend` | Extra rule |
|---|---|---|---|
| `facts` | 2 – 10 | `divisor` – 100 | quotient ≤ 12 |
| `shift` | 10, 100, or 1000 | 10 – 999 999 | `dividend % divisor === 0` (decision D15) |
| `euclid` | 2 – 12 | `divisor` – 150 | quotient ≤ 20 |
| `long` | 2 – 9 | 10 – 9 999 and ≥ `divisor` | — (decision D10) |

Set-level limits: at most **30** levels are kept (the rest are dropped, in order); a set of 5–10 is recommended for one play session.

Every item of the sample sheet fits these limits ✅ (checked by computation on 2026-11-14; the widest are `789 000 ÷ 1 000`, `98 = (8 × 12) + 2`, `75 = (5 × 15) + 0`).

## 3. `parseCustomLevels(raw: unknown, modes = BUILT_MODES): Level[] | null`

Pure, deterministic, no DOM, never throws (the whole parse runs inside a `try/catch` that returns `null`, so even a throwing getter or proxy cannot break the game). The optional `modes` list says which modes are accepted; it defaults to the modes that are built, and tests pass all four.

1. If `raw` is a string: reject if longer than 20 000 characters, else `JSON.parse` inside `try/catch`; failure → `null`.
2. Unwrap the envelope if `raw` is a non-array object with a `levels` array (and check `version`). A single level object is accepted as a one-item array.
3. Anything that is not an array at this point → `null`.
4. Look at the first 200 items at most, so a huge array cannot stall the parser.
5. For each item, **skip it** (do not fail the set) when: it is not a plain object; `mode` is unknown or not built yet (decision D3); `dividend` or `divisor` is not a `number` passing `Number.isSafeInteger`; any limit in §2 is violated. Out-of-range values are **rejected, never clamped** (decision D5).
6. Keep the first 30 survivors. If none survive → `null`, and the game falls back to procedural levels.
7. Output objects are freshly built with exactly the known fields; nothing from the input is passed through by reference.

`Level` is a discriminated union on `mode`. Derived values (`q`, `r`, the long-division trace) are computed later by `division.ts`, never stored from input.

### `levelsSignature(levels: Level[]): string`

A stable string of the parsed set (for example `facts:27:3|shift:60000:100`). The game uses it to decide whether a config update really changed the levels (see [03-architecture.md](03-architecture.md) §6.1).

## 4. `generateLevelsForAge(ageGroup, difficulty = 'medium', rng = Math.random, modes = BUILT_MODES): Level[]`

- Same first two parameters as every other cartridge ✅; the third is an injectable random source so tests are deterministic.
- Implements the bracket and difficulty tables and the invariants of [01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) §4.
- Builds each level from `(b, q, r)`, then asserts the result against `LIMITS` in a test, so generated levels would also pass `parseCustomLevels`.
- Only uses modes in `modes`; returns `[]` if that list is empty. While the cartridge is 🚧, a bracket whose modes are not all built gets extra levels of the built modes, so the level count stays as planned.
- Unknown `ageGroup` or `difficulty` values fall back to `'6-8'` and `'medium'`, matching the host's defaults ✅.

## 5. Pure maths module (`division.ts`)

No DOM, no randomness, no imports from the rest of the cartridge.

```ts
divide(a: number, b: number): { q: number; r: number }
isExactShift(a: number, b: number): boolean          // b ∈ {10,100,1000} and a % b === 0
shiftCount(b: 10 | 100 | 1000): 1 | 2 | 3
longDivisionTrace(a: number, b: number): LongStep[]

interface LongStep {
  partial: number;   // partial dividend for this step
  digit: number;     // quotient digit, 0–9
  product: number;   // digit × b
  remainder: number; // partial − product
  broughtDown: number | null; // dividend digit brought down to form `partial`; null on the first step
}
```

Trace rule: the first partial dividend takes as many leading digits as needed to be ≥ `b` (or all digits); after that, one step per remaining dividend digit, **including steps whose digit is 0**. The concatenated `digit`s are the quotient and the last `remainder` is the remainder. Golden values are in [05-test-plan.md](05-test-plan.md) §2.

## 6. `levels.schema.json`

A JSON Schema (draft 2020-12) file in the cartridge folder describing §1 and the numeric bounds of §2 with one `oneOf` branch per mode. It exists for the platform, which can validate LLM output with any standard tool before sending it (decision D12).

JSON Schema cannot express three rules, so the file's `description` states them in prose and [07-platform-integration.md](07-platform-integration.md) repeats them:

- `shift`: `dividend` is a multiple of `divisor`.
- `facts` and `euclid`: the quotient cap.
- all modes: `dividend ≥ divisor`.

The cartridge does not load or execute the schema at runtime (no validator dependency). A test imports it (`resolveJsonModule` is on ✅) and checks its numbers equal `LIMITS`.

## 7. Worked example: the sample sheet as levels

The full 25-item transcription lives in [05-test-plan.md](05-test-plan.md) §1 as a fixture and becomes the playground's custom preset. A platform would normally split it into four short sets, one per exercise block, rather than one 25-level session.
