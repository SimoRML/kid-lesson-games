# Balance the Scale (`balance-scale`)

Place metric weights on a scale to reach equilibrium. Bilingual (EN/FR), fully procedural visuals and audio.

## Age progression

- **3-5**: Balance one or two left weights using 2-3 different right-pan weights (concrete addition, one distractor).
- **6-8**: Anti-mirroring: the answer is never a copy of the left pan (e.g. 1 kg is balanced with 500g + 250g + 250g). Some levels pre-fill the right pan. Real g / kg conversions.
- **9-11**: Lever mode, torque = mass x notch distance. Left torque is shown, the right hook starts on a notch that does **not** solve the puzzle, and the child chooses both notch and weights. Hints never state the needed grams.

## Mechanics

- Tap/click a tray weight to add it, or drag it onto the right pan (or a notch in lever mode). Tap a stacked weight to return it to the tray.
- Drag the right hook along the beam or use the notch buttons (lever mode).
- The HUD instruction updates live: `Right: 500g of 750g, keep going!`, `Right torque: 300g x 2 = 600 / 800. A little more!`, or a "too heavy" hint.
- A localized banner, confetti and a success sound play on each win, followed by a short settling window.

## Lifecycle

Implements `mount`, `start`, `pause`, `resume`, `updateConfig` (locale, sound, ageGroup, difficulty, customLevels) and a zero-leak `destroy` (AbortController window listeners, tracked timeouts, ResizeObserver, rAF). Shared `context.audio` is never closed by the cartridge.

## Custom levels

`context.customLevels` / the `levels` attribute accepts an array validated by `parseCustomLevels` (invalid input falls back to `generateLevelsForAge(ageGroup, difficulty)`):

```json
[
  { "left": [1000], "inventory": [500, 250, 250, 100], "instruction": "Balance 1 kg!" },
  { "left": [300], "leftNotch": 4, "rightNotch": 4, "leverMode": true, "inventory": [400, 200, 250] }
]
```

Weights may be numbers (grams), strings (`"250g"`, `"0.5kg"`) or `{ grams, label?, color? }`.
