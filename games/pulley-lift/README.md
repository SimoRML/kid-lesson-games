# 🏗️ Pulley Lift & Mechanical Advantage

An interactive educational physics cartridge for `kid-lesson-games` teaching simple machines, mechanical advantage ($MA = 1, 2, 3, 4$), fractions, and conservation of work ($W = F \times d$).

---

## 1. Educational Purpose & Concepts

Simple machines are fundamental to understanding how force, distance, and work interact in the physical world. `pulley-lift` gives children hands-on experience rigging ropes and counterweights on a vertical construction crane to hoist heavy metric stone blocks (from 20 kg up to 600 kg).

### Key Physics Principles
1. **Mechanical Advantage ($MA$)**:
   The ideal mechanical advantage equals the number of supporting rope strands $n$ holding the movable load:
   $$MA = n \in \{1, 2, 3, 4\}$$
2. **Equilibrium Effort Force and Mass**:
   $$F_{effort} = \frac{F_{load}}{MA} = \frac{m_{load} \times g}{MA}$$
   In counterweight mass equivalence:
   $$m_{effort} = \frac{m_{load}}{MA}$$
3. **Kinematics & Rope Travel**:
   When the load block rises by distance $d_{load}$, the effort rope travels downward by:
   $$d_{effort} = MA \times d_{load}$$
4. **Conservation of Work ($W = F \times d$)**:
   Neglecting friction, the work input equals the work output:
   $$W_{effort} = F_{effort} \times d_{effort} = \left(\frac{m_{load} g}{MA}\right) \times (MA \cdot d_{load}) = m_{load} g \cdot d_{load} = W_{load}$$
   Energy is conserved!

---

## 2. Three-Tier Age Progression Matrix

| Age Bracket | Pulley Configuration | Mechanical Advantage ($MA$) | Load Masses | Pedagogical Objective & Rules |
|---|---|---|---|---|
| **`3-5` (Preschool)** | **Single Fixed Pulley** (`fixed-1`) | $MA = 1$ | 20 kg, 50 kg, 80 kg | Concrete 1-to-1 mass correspondence and direction reversal (pulling down raises the stone). Immediate feedback. |
| **`6-8` (Elementary)** | **2-Pulley System** (`movable-2`, 1 fixed + 1 movable) | $MA = 2$ | 100 kg, 200 kg, 360 kg | Force halving ($1/2$ effort, $2\times$ rope distance). **Strict Anti-Mirroring Rule**: no single weight matches target effort; children must combine multiple pieces (e.g. $60 + 40 = 100$ kg) avoiding distractor weights. |
| **`9-11` (Upper Elementary)** | **Compound Tackle** (`compound-3` & `compound-4`) | $MA = 3$ and $MA = 4$ | 240 kg, 480 kg, 600 kg | Proportional fractions ($1/3$ and $1/4$ force vs $3\times$ and $4\times$ displacement) and explicit Work conservation $W = F \times d$ in Joules ($J$). |

---

## 3. Strict Anti-Mirroring & Solvability Rules
- **Anti-Mirroring Guarantee**: For ages `6-8` and `9-11`, the inventory never provides a single counterweight matching the target effort mass. The child must decompose the target into two or more additive weights.
- **Raw Load Mass Exclusion**: The inventory never offers a weight matching the total load block mass.
- **Plausible Distractors**: Each level includes 1 to 2 distractor weights that would cause an underweight stall or overweight overshoot.
- **Settling Confirmation Window**: The win condition requires the system to stabilize in equilibrium at the target platform for at least $0.5$s, letting the child visually understand *why* the balance worked.

---

## 4. Tactile UX & Controls
- **Dual Input Ergonomics**:
  - **Tap / Click Placement**: Tap any counterweight in the inventory tray to immediately place it into the suspended effort tray.
  - **Continuous Drag & Drop**: Drag weights with a smooth $\sim 5$px threshold and generous snap radii.
- **Granular Undo**:
  - Tapping any placed weight in the effort tray immediately pops that exact piece back into the inventory tray without resetting the level.
- **Stable Trays**:
  - Counterweights keep their slot (an empty placeholder is left behind) and the trays have a fixed height, so the scene never resizes or reflows while playing. Undo returns a piece to its original slot.
- **Clear Tray Button**:
  - Returns all placed weights back to the Counterweights tray.
- **Guiding (not answer-giving) HUD**:
  - `3-5`: matching prompt ("Tap a weight to balance the stone"), no Newtons.
  - `6-8`: shows the load, the MA and what the rig does ("the effort is half the load"); the child works out the required effort. Live feedback is directional only ("not enough", "getting close", "too heavy").
  - `9-11`: shows load and MA (with Newtons); the target effort and work are hidden until the level is balanced, when $W = F \times d$ is revealed.
- **Scene Layout**: effort platform on the left, rig above the stone on the right; rope travel is scaled so the platform stays on screen and the stone stops below the crane arm.
- **Pacing**: the lift is integrated at a fixed time step (frame-rate independent); the next level starts within ~3 s of balancing (lift, ~0.5 s settle window, short celebration), and a fresh round starts after the final level.
- **Score convention**: changing `age` resets score, streak and elapsed time.

---

## 5. Engineering & Cartridge Contract
- **Zero Core Modification Rule**: Does not modify any file in `src/`.
- **Zero External Runtime Assets**: 100% procedural Canvas 2D graphics, Web Audio synthesis via `context.audio`, and celebrations via `canvas-confetti`.
- **Zero-Leak Teardown**: Cleans up all `requestAnimationFrame` loops, `ResizeObserver` instances, `setTimeout` timers, and DOM listeners via `AbortController`.
- **Dual Curriculum Mode**: Exports `parseCustomLevels(raw: unknown)` with safe fallback to `generateLevelsForAge`.
- **Bilingual i18n**: Type-safe English (`en`) and French (`fr`) translations using `createI18nResolver`.
- **Telemetry Bridge**: Dispatches `game:progress`, `game:score`, and `game:complete` events.
