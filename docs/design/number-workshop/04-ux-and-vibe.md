# 04 — UX, Feel, and Accessibility

> Part of the [`number-workshop` plan](README.md). Status: 🗺️ Planned.
> The bar: a child should want to play one more level, and an adult watching should be able to see the maths happening.

## 1. Screen layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Division Workshop  [2/5]   Share 27 dates between 3 friends  │  ← HUD
│                                        ★ 250   🔊   ↺ Reset  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     27 ÷ 3 = ?                               │  ← equation line
│                                                              │
│          ( plates / table / track / potence )                │  ← mode stage
│                                                              │
│          [ tray · keypad · builder buttons ]                 │  ← controls
└──────────────────────────────────────────────────────────────┘
```

- HUD follows the house standard (AGENTS.md §5): title and level badge left, live instruction centre, score, sound toggle, and reset right. On narrow screens the instruction wraps to its own row.
- The stage must be fully usable at 375 px width and at the host's minimum height of 400 px ✅ (`:host { min-height: 400px }`), without scrolling inside the game.
- The equation line is the constant anchor: every mode shows the exercise in symbols there (except `facts` levels at age 3–5, where it is replaced by a sentence; see the symbol-free presentation in [01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) §4).

## 2. Visual system

- Palette (house standard): surfaces `#0f172a` / `#1e293b`, text `#f8fafc`, sky accent `#38bdf8`, gold `#fbbf24` for score and stars.
- Semantic colours, used the same way in every mode so the equation is colour-coded for free:

  | Role | Colour idea | Where |
  |---|---|---|
  | dividend | sky | tokens, track, dividend digits |
  | divisor | violet | plates, group bars, divisor digit |
  | quotient | green | counts per plate, group count, quotient digits |
  | remainder | amber | left-over tray, gap, remainder digit |

  Exact hex values are chosen in WP2 and must reach WCAG AA contrast (4.5:1 for text) on the slate surfaces. Colour is never the only cue: each role also has a label or a shape.
- Digits use a large, tabular-figure system font stack (`font-variant-numeric: tabular-nums`); no web fonts.
- Tokens are simple, friendly SVG shapes with a soft highlight. No images, no remote assets.

## 3. Input

- **Tap and drag both work** for anything that moves (AGENTS.md §5): movement under about 5 px between press and release is a tap; beyond that it is a drag. Drop targets snap generously (40–90 px).
- Every interactive target is at least 44×44 CSS px, including keypad keys and tokens. When 100 tokens cannot be 44 px each, they are not individually interactive (Array tier uses the builder buttons instead).
- **Granular undo**: tapping a placed token, a laid bar's "−", or backspace on the keypad undoes one thing. Reset restarts only the current level.
- **Keyboard**: every control is a real `<button>` reachable with Tab and operable with Enter/Space; the keypad also accepts digit keys and Backspace when the stage has focus; visible focus rings.
- `touch-action: none` on draggable elements so the page does not scroll mid-drag; `user-select: none` is already set by the host ✅.

## 4. Motion and juice

- Tokens ease into place and land with a small squash; plates give a tiny bounce; the digit strip in `shift` glides one column with a soft stop. Use CSS transitions and transforms.
- Buttons scale slightly on press; draggable things show grab / grabbing cursors.
- **Settle window**: about 0.6 s after a correct answer the solved state holds and the full equality writes itself in the equation line, colour-coded.
- **Celebration**: `context.audio.playSuccess()`, a `canvas-confetti` burst, and the localised banner from `context.t('wellDone')`.
- `prefers-reduced-motion: reduce` (checked through a guarded `matchMedia`): transitions become instant or simple fades and confetti is skipped; sound and the banner remain.
- Nothing flashes more than three times per second. A wrong answer is a gentle shake (or a colour pulse under reduced motion) plus `playError()`, never a red screen.

## 5. Sound

Only `context.audio` ✅: `playPop` on pick-up, `playDrop` on placement, `playClick` on keys and buttons, `playChime` on a completed step (a dealt round, a brought-down digit), `playSuccess` on level completion, `playError` on a failed check. The HUD toggle flips `context.audio.enabled` and its label uses `context.t('soundOn' | 'soundOff')`.

## 6. Words

- Instructions are short, concrete, and in the second person: "Give each friend the same number of dates."
- The live HUD line always contains the current numbers, formatted for the locale.
- Hints state the rule, never the answer ([01-pedagogy-and-modes.md](01-pedagogy-and-modes.md) §2).
- Every string exists in `en` and `fr` and updates in place on a live `locale` change without losing the child's progress.
- French typography: a narrow no-break space before `?` and `!`, `×` for multiplication, `÷` for division (the sheet's own notation).
- The HUD instruction element is an `aria-live="polite"` region; interactive groups have localised `aria-label`s.

## 7. End screen

After the last level: stars (1–3), score, a one-line summary ("5 levels, 1 mistake"), and a "Play again" button. No automatic restart (decision D13). "Play again" replays a custom set as is, or generates a fresh procedural set.

## 8. Kid-safety checklist (applies to every PR)

- No links, no tracking, no ads, no storage, no network requests, no personal data.
- No text on screen that did not come from the cartridge's own dictionary or from formatting a validated integer.
- No sound outside `context.audio`.

## 9. Manual play-test script (run before every UI PR, state results in the PR)

1. `npm run dev`, open the playground, select the game.
2. For each age bracket × the mode(s) touched: complete a level with the mouse only, with touch emulation only, and with the keyboard only.
3. Make each documented mistake once and read the hint: is it kind, true, and not the answer?
4. Toggle sound, switch `en` ↔ `fr`, and change difficulty mid-level: progress survives the first two and restarts cleanly on the third.
5. Resize to 375 px wide and to 400 px high: nothing clipped, nothing under 44 px.
6. Load the custom preset, then switch back to Auto.
7. Switch to another game and back: the console stays clean (no errors, no warnings from this cartridge).
8. Emulate reduced motion and repeat one level.
