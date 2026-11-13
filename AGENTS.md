# AGENTS.md — Contributor & AI Agent Guide for `kid-lesson-games`

This guide defines the architectural standards, pedagogical quality bar, tactile UX conventions, and engineering robustness required when creating new educational game cartridges in `kid-lesson-games`.

---

## 1. Zero Core Modification & Cartridge Isolation Rule
- **Never edit files in `src/`** when creating or updating a game cartridge.
- Vite automatically discovers metadata (`games/*/{game,meta}.json`) and lazily code-splits entrypoints (`games/*/index.ts`) via `import.meta.glob`.
- **Zero External Runtime Assets**: Never fetch remote images, icons, audio files, or fonts (which fail offline or add latency). Render all visuals using HTML5 Canvas 2D, SVG, or pure CSS, use `context.audio` for procedural Web Audio SFX, and `canvas-confetti` for celebratory bursts.

---

## 2. Fast Scaffolding & File Layout
Always initialize a new cartridge with the CLI generator:

```bash
npm run create-game <game-id>
# Example: npm run create-game number-line
```

Recommended cartridge structure for non-trivial games:
```text
games/<game-id>/
├── game.json        # Taxonomy, age brackets, skills, title
├── index.ts         # KidGame implementation, pure level/math helpers & factory
├── i18n.ts          # Typed EN/FR dictionary using createI18nResolver
├── index.test.ts    # Deterministic unit tests + DOM mount/destroy tests
└── README.md        # Educational purpose, age progression & mechanics
```

---

## 3. Metadata Contract (`game.json` or `meta.json`)
Every cartridge must declare its taxonomy cleanly:
```json
{
  "id": "number-line",
  "title": "Number Line Hopper",
  "version": "1.0.0",
  "description": "Hop along numbers to master addition and subtraction!",
  "author": "Contributor",
  "category": "numbers",
  "ageGroups": ["3-5", "6-8", "9-11"],
  "skills": ["counting", "addition", "spatial-mapping"],
  "thumbnail": "assets/thumb.svg"
}
```
- **Categories**: `"numbers"` | `"letters"` | `"logic"` | `"spatial"`
- **Age Brackets**: `"3-5"` (preschool) | `"6-8"` (early elementary) | `"9-11"` (upper elementary)

---

## 4. Pedagogical Design & Curriculum Quality Bar
Great educational games teach *concepts*, not button-mashing. Apply these standards:

1. **Meaningful Age Bracket Differentiation** (never just scale up the numbers):
   - **`3-5` (Preschool)**: Concrete visual/tactile counting, direct 1-to-1 correspondence, 1–2 elements per step, clear color/shape coding, immediate feedback.
   - **`6-8` (Early Elementary)**: Multi-step composition/decomposition and **Anti-Mirroring Rule**—forbid trivial 1-to-1 visual copying (e.g., if target is `500g`, don't put a single `500g` block in the tray; require combining `250g + 250g` or `200g + 200g + 100g`), plus real metric conversions.
   - **`9-11` (Upper Elementary)**: Multi-variable reasoning, ratios, fractions, or physical laws (e.g., Archimedes lever torque $\tau = m \times d$).
2. **Guaranteed Solvability + Plausible Distractors**:
   - Procedural puzzle generators must construct or mathematically prove a valid solution path *before* mixing in 1–2 plausible distractor pieces.
3. **Live Pedagogical Scaffolding**:
   - Update the HUD instruction text dynamically as the child interacts (e.g., showing current live totals, equation progress, or gentle hints like *"Move hook to a notch that divides 750 evenly"*) without revealing the exact final click.
4. **Dual Curriculum Mode (`customLevels` + Procedural Fallback)**:
   - Always export a defensive `parseCustomLevels(raw: unknown)` validator that safely sanitizes LMS-supplied levels and seamlessly falls back to `generateLevelsForAge(ageGroup)` when `context.customLevels` is omitted or invalid.
5. **Metric & European Standards**:
   - Always use real metric units (`g`, `kg`, `cm`, `m`, `L`, `mL`) and consistent decimal/space formatting per locale.

---

## 5. Smooth "Vibe", Tactile UX & Visual Polish
A cartridge should feel alive, forgiving, and rewarding on both desktop mice and children's touchscreens:

1. **Dual Input Ergonomics (Tap/Click AND Drag-and-Drop)**:
   - Support *both* quick click/tap placement and continuous drag-and-drop. Distinguish them using a small movement threshold (e.g. `~5px`) and generous snap/drop radii (`40–90px`) with interactive targets at least **44×44px**.
2. **Granular Undo**:
   - Clicking or tapping a placed manipulative should return that exact piece back to the tray rather than forcing a full level reset.
3. **Physics & Motion "Juice"**:
   - Use spring-damper physics (`stiffness`, `damping`, `velocity`) or smooth easing curves instead of teleporting state changes.
   - Provide hover/grab cursor states and subtle button scale transitions.
   - Include a brief settling/confirmation window (`~0.5–0.8s`) once the win condition is reached so the child visually observes *why* their answer succeeded before advancing.
4. **Celebratory Feedback**:
   - Combine `context.audio.playSuccess()`, a `canvas-confetti` burst, and a localized banner (`✨ Well Done!`) on round completion.
5. **Cohesive Visual System & HiDPI Canvas**:
   - Match the dark-slate playground palette (`#0f172a` / `#1e293b` surfaces, `#f8fafc` primary text, `#38bdf8` sky accent, `#fbbf24` gold score/stars, high-contrast semantic manipulatives).
   - Standardize the HUD: Title + Level badge (`1/3`) on the left, live Instruction prompt centered, Score + Sound toggle (`context.audio.enabled`) + Reset button on the right.
   - Scale Canvas 2D dimensions responsively via `ResizeObserver` and `window.devicePixelRatio` for razor-sharp rendering on Retina displays and tablets.

---

## 6. The `KidGame` Lifecycle & Robustness Contract
Your `index.ts` must export `createGame(): KidGame` and `export default createGame`:

```typescript
import type { GameContext, KidGame } from '../../src/core/types.js';

export class MyGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;
  private abortController: AbortController | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    this.abortController = new AbortController();
    // 1. Render DOM/Canvas, attach ResizeObserver, bind listeners with { signal: this.abortController.signal }
    // 2. Guard for test/headless envs: check `if (typeof ResizeObserver !== 'undefined')` and `canvas.getContext('2d')`
  }

  start(): void {
    // Begin gameplay round, start timers/rAF loop, enable interactions
  }

  pause(): void {
    // Freeze active timers / physics loops when host pauses
  }

  resume(): void {
    // Unfreeze active timers / physics loops
  }

  updateConfig(newContext: Partial<GameContext>): void {
    // Handle live attribute updates without remounting:
    // newContext.sound, newContext.locale, newContext.difficulty, newContext.ageGroup, newContext.customLevels
  }

  destroy(): void {
    // MANDATORY ZERO-LEAK TEARDOWN:
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController?.abort();
    this.abortController = null;
    this.container.innerHTML = '';
  }
}

export function createGame(): KidGame {
  return new MyGame();
}
export default createGame;
```

**Robustness Rules**:
- **Zero-Leak Teardown**: Always remove `window` listeners (`mousemove`, `mouseup`, `touchmove`, `touchend`), cancel `requestAnimationFrame`, clear all `setTimeout`/`setInterval` handles (especially level-advance timers), and disconnect `ResizeObserver` in `destroy()`. Passing `{ signal: abortController.signal }` to `addEventListener` makes window listener cleanup effortless.
- **Headless/Test Environment Safety**: Always guard `canvas.getContext('2d')` (may be `null` in `jsdom`) and `ResizeObserver` so unit tests run cleanly without crashing.

---

## 7. Shared Core Utilities

### A. Procedural Audio (`context.audio`)
Never create raw `AudioContext` instances in cartridges. Use the injected `SoundEngine`:
- `context.audio.playClick()`: Short tactile UI tap
- `context.audio.playPop()`: Bubble pop or item pick up
- `context.audio.playDrop()`: Weight placement or block snap
- `context.audio.playChime()`: Step or milestone completion
- `context.audio.playSuccess()`: Multi-note victory fanfare
- `context.audio.playError()`: Gentle low buzz for invalid moves
- `context.audio.playTone(freq, duration, type, options)`: Custom synth tone

Muting (`sound` attribute) and browser user-gesture resumption are managed automatically by `<kid-game>`. If you render an in-game sound toggle button, keep it synced with `context.audio.enabled`.

### B. Internationalization (`context.i18n` & `context.t`)
- Shared UI tokens (`soundOn`, `soundOff`, `score`, `level`, `reset`, `wellDone`, `loading`, `error`) are available via `context.t('key')`.
- For cartridge-specific strings and dynamic pedagogical formatters, use `createI18nResolver` in `i18n.ts`:
  ```typescript
  import { createI18nResolver } from '../../src/core/i18n.js';

  export const DICTIONARY = {
    en: { prompt: 'Balance {target}g!' },
    fr: { prompt: 'Équilibrez {target}g !' }
  };
  export const getTranslations = createI18nResolver(DICTIONARY, 'en');
  ```
- Always provide **at least English (`en`) and French (`fr`)**, and update visible text immediately inside `updateConfig` when `newContext.locale` changes.

---

## 8. Standard Telemetry Events (`context.emit`)
Always emit standard events so host LMS platforms can track mastery and award stars:

```typescript
// Sub-step / level completion (e.g., solved puzzle 1 of 3)
this.context.emit('game:progress', { step: 1, total: 3, detail: 'Solved level 1' });

// Score increments
this.context.emit('game:score', { points: 100, streak: 1, delta: 100 });

// Round completion (triggers celebratory rewards)
this.context.emit('game:complete', {
  stars: 3,             // 1 | 2 | 3
  score: 300,
  timeElapsed: 25,      // seconds
  summary: 'All levels completed!'
});
```

---

## 9. Testability & Verification Checklist
1. **Export Pure Logic**: Export level generators (`generateLevelsForAge`), custom level parsers (`parseCustomLevels`), and domain math helpers from `index.ts` so they can be verified deterministically without DOM overhead.
2. **Write Cartridge Tests (`games/<game-id>/index.test.ts`)**:
   - Test age-bracket rules (`3-5`, `6-8`, `9-11`) and solvability invariants.
   - Test `parseCustomLevels` with valid, partial, and malformed inputs.
   - Test full lifecycle (`mount` $\rightarrow$ `start` $\rightarrow$ `updateConfig` $\rightarrow$ `pause`/`resume` $\rightarrow$ `destroy`) and verify zero lingering timers/errors.
3. **Run Full Verification**:
   - `npm test` — all Vitest suites pass.
   - `npm run build` — `tsc` compiles with zero errors and Vite generates ES chunks + UMD bundle cleanly.
