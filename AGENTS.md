# AGENTS.md — Contributor & AI Agent Guide for `kid-lesson-games`

This guide specifies how autonomous agents and human developers should create, structure, and verify new educational game cartridges in this repository.

---

## 1. Zero Core Modification Rule
- **Never edit files in `src/`** when building a game cartridge.
- The engine uses Vite's dynamic `import.meta.glob` to auto-discover metadata and lazily load game modules directly from `games/<game-id>/`.
- Each cartridge is automatically code-split into its own bundle on build.

---

## 2. Fast Scaffolding
Always scaffold a new game with the generator CLI:

```bash
npm run create-game <game-id>
# Example: npm run create-game number-line
```

This creates:
```text
games/<game-id>/
├── game.json        # Taxonomy, age brackets, skills, title
├── index.ts         # KidGame class implementation & factory export
└── README.md        # Educational purpose & pedagogical mechanics
```

---

## 3. Metadata Contract (`game.json` or `meta.json`)
Every cartridge must provide:
```json
{
  "id": "number-line",
  "title": "Number Line Hopper",
  "version": "1.0.0",
  "description": "Hop along numbers to master addition and subtraction!",
  "author": "Contributor",
  "category": "numbers",
  "ageGroups": ["3-5", "6-8"],
  "skills": ["counting", "addition", "spatial-mapping"],
  "thumbnail": "assets/thumb.svg"
}
```
- **Categories**: `"numbers"` | `"letters"` | `"logic"` | `"spatial"`
- **Age Brackets**: `"3-5"` (preschool) | `"6-8"` (early elementary) | `"9-11"` (upper elementary)

---

## 4. The `KidGame` Lifecycle Contract
Your `index.ts` must export `createGame(): KidGame` (and `export default createGame`):

```typescript
import type { GameContext, KidGame } from '../../src/core/types.js';

export class MyGame implements KidGame {
  private container!: HTMLElement;
  private context!: GameContext;

  mount(container: HTMLElement, context: GameContext): void {
    this.container = container;
    this.context = context;
    // Render initial UI, observe container size, bind listeners
  }

  start(): void {
    // Begin gameplay round, start timers, enable interactions
  }

  pause?(): void {
    // Freeze timers / physics loops when component is paused
  }

  resume?(): void {
    // Unfreeze timers / physics loops
  }

  updateConfig?(newContext: Partial<GameContext>): void {
    // Handle live attribute changes without remounting:
    // newContext.sound, newContext.locale, newContext.difficulty, newContext.ageGroup
  }

  destroy(): void {
    // MANDATORY CLEANUP — Zero memory leaks:
    // 1. cancelAnimationFrame()
    // 2. Clear intervals / timeouts
    // 3. Disconnect ResizeObserver / MutationObserver
    // 4. Remove window and container event listeners
    // 5. Empty container: this.container.innerHTML = ''
  }
}

export function createGame(): KidGame {
  return new MyGame();
}
export default createGame;
```

---

## 5. Shared Core Utilities

### A. Procedural Audio (`context.audio`)
Never create raw `AudioContext` instances or load heavy external MP3s. Use the injected procedural sound engine:
- `context.audio.playClick()`: Short tactile UI tap
- `context.audio.playPop()`: Bubble pop or item pick up
- `context.audio.playDrop()`: Weight placement or block snap
- `context.audio.playChime()`: Step or milestone completion
- `context.audio.playSuccess()`: Multi-note victory fanfare
- `context.audio.playError()`: Gentle low buzz for invalid moves
- `context.audio.playTone(freq, duration, type, options)`: Custom synth tone

Audio muting and user-gesture resumption are managed automatically by `<kid-game>`.

### B. Internationalization (`context.i18n` & `context.t`)
- Common UI strings (`soundOn`, `soundOff`, `score`, `level`, `reset`, `wellDone`) are available via `context.t('key')`.
- For cartridge-specific strings, create a typed dictionary with `createI18nResolver`:
  ```typescript
  import { createI18nResolver } from '../../src/core/i18n.js';

  const DICTIONARY = {
    en: { prompt: 'Find number {target}' },
    fr: { prompt: 'Trouve le nombre {target}' }
  };
  const getTranslations = createI18nResolver(DICTIONARY, 'en');
  ```
- Always provide at least English (`en`) and French (`fr`).

---

## 6. Standard Telemetry Events (`context.emit`)
Always dispatch standard platform events so host LMS / learning apps can track progress:

```typescript
// Sub-step completion (e.g. solved puzzle 2 of 5)
this.context.emit('game:progress', { step: 2, total: 5, detail: 'Solved step 2' });

// Score increments
this.context.emit('game:score', { points: 100, streak: 2, delta: 50 });

// Round completion (triggers celebratory rewards)
this.context.emit('game:complete', {
  stars: 3,             // 1 | 2 | 3
  score: 300,
  timeElapsed: 25,      // seconds
  summary: 'All levels completed!'
});
```

---

## 7. Child UX & Pedagogy Guidelines
1. **Zero External Assets**: Render all visuals with HTML5 Canvas 2D, SVG, or pure CSS. Never rely on external CDN images or sound files that could fail offline or introduce latency.
2. **Touch-First Ergonomics**: Interactive targets must be at least 44×44px with immediate visual hover/active feedback.
3. **Metric & European Standards**: Always use real metric units ($g, kg, cm, m$) and accurate physical concepts.
4. **Adaptive Curriculum**: Support curriculum customization via `context.customLevels`, falling back to age-appropriate procedural level generators when omitted.

---

## 8. Verification Checklist
Before completing any game cartridge, verify:
1. `npm test`: All cartridge tests in `games/<game-id>/*.test.ts` pass.
2. `npm run build`: `tsc` compiles with zero errors and Vite builds both ES and UMD bundles cleanly.
3. Teardown check: Test that calling `destroy()` clears all canvas render loops, listeners, and observers without console warnings.
