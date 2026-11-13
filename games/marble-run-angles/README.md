# Marble Run Angles (Parcours à Billes & Angles)

An interactive educational physics cartridge for **kid-lesson-games** teaching spatial reasoning, slope geometry, and reflection physics through tactile pegboard marble puzzles.

---

## 1. Pedagogical Vision & Curriculum Progression

`marble-run-angles` is designed to build foundational physical intuition about gravity, incline slopes, angular redirection, and specular reflection across three differentiated developmental stages:

### Tier 1: Ages 3–5 (Preschool)
- **Concept**: Cause-and-effect, gravity acceleration, and spatial bridging.
- **Mechanics**: Pre-angled wooden ramps ($23^\circ, 157^\circ$) snap into glowing pegboard slots bridging chasms between the dispenser, guide ramps, and target cup.
- **Feedback**: Single-click snapping, glowing slot outlines, instant marble launch preview, and celebratory star chimes.

### Tier 2: Ages 6–8 (Early Elementary)
- **Concept**: Discrete angular rotation ($15^\circ$ increments), angle classification (Acute, Right, Obtuse), and obstacle navigation.
- **Anti-Mirroring Rule**: Direct vertical drops are physically obstructed by fixed obstacle pegs. Children cannot simply drop marbles straight down; they must calculate acute ($30^\circ, 45^\circ$) and obtuse ($120^\circ, 135^\circ$) redirection paths to steer marbles safely into the target cup.
- **Scaffolding HUD**: A circular protractor gauge overlays the active ramp showing degree ticks ($15^\circ$ steps) and dynamic angle classifications.

### Tier 3: Ages 9–11 (Upper Elementary)
- **Concept**: Law of Specular Reflection ($\theta_{\text{incidence}} = \theta_{\text{reflection}}$) and material restitution ($e$).
- **Mechanics**:
  - **Wood Ramps**: Low restitution coefficient ($e = 0.5$) dampens normal velocity, causing marbles to roll along surfaces or drop weakly.
  - **Trampoline Pads**: High restitution coefficient ($e = 0.9$) preserves normal kinetic energy, bouncing marbles across wide chasms and off ricochet walls.
- **HUD Scaffolding**: Live readout displaying incident angle $\theta_i$, reflected angle $\theta_r$, and material coefficient $e$.

---

## 2. Mathematical & Physical Principles

1. **Kinematics Integration**:
   $$\vec{v}_{t+\delta t} = \vec{v}_t + \vec{g} \, \delta t$$
   $$\vec{p}_{t+\delta t} = \vec{p}_t + \vec{v}_{t+\delta t} \, \delta t$$
   Integrated with 4 sub-steps per frame ($\delta t = \Delta t / 4$) to eliminate tunneling.

2. **Line Segment Collision**:
   For marble center $P$ and ramp segment $AB$:
   $$t = \text{clamp}\left(\frac{(P - A) \cdot (B - A)}{\|B - A\|^2}, 0, 1\right)$$
   $$\text{Closest Point } C = A + t (B - A)$$
   $$\text{Distance } d = \|P - C\| \le r_{\text{marble}}$$

3. **Restitution & Reflection Formula**:
   $$v_n = \vec{v} \cdot \hat{n}$$
   $$\vec{v}_t = \vec{v} - v_n \hat{n}$$
   $$\vec{v}' = (1 - \mu) \vec{v}_t - e \, v_n \hat{n}$$
   where $e \in \{0.5, 0.9\}$ and $\mu \in \{0.01, 0.05\}$.

4. **Law of Specular Reflection**:
   $$\theta_i = \arccos\left(\frac{-\vec{v} \cdot \hat{n}}{\|\vec{v}\|}\right) = \theta_r$$

---

## 3. Dual Input Ergonomics & Granular Undo

- **Tap / Click**:
  - Tapping a ramp in the inventory tray snaps it into the first vacant slot.
  - Tapping a placed ramp or its rotation handle advances its angle by $15^\circ$ (Ages 6–11) or returns it to the tray (Ages 3–5).
  - Tapping the "Clear Pieces" button resets all manipulatives back to the tray.
- **Drag-and-Drop**:
  - Dragging a ramp from tray or board with $> 5\text{px}$ movement displays a semi-transparent ghost piece following the pointer.
  - Releasing within a generous $75\text{px}$ snap radius locks the ramp cleanly into the closest peg slot.
  - Dropping outside snap regions returns the item safely to the tray (granular undo).

---

## 4. Architectural & Lifecycle Contract

`MarbleRunAnglesGame` strictly adheres to `AGENTS.md`:
- **Zero Core Modifications**: Resides entirely in `games/marble-run-angles/`.
- **Zero External Assets**: Pure Canvas 2D procedural rendering, procedural Web Audio via `context.audio`, and `canvas-confetti`.
- **Zero-Leak Teardown**: Cleans up all `requestAnimationFrame` IDs, `Set<setTimeout>` handles, `ResizeObserver` instances, and uses `AbortController` signal for all DOM and window event listeners.
- **Dual Curriculum**: Exports `parseCustomLevels(raw: unknown)` with automatic procedural fallback to `generateLevelsForAge(ageGroup)`.
- **Localization**: Full English (`en`) and French (`fr`) dictionaries via `createI18nResolver`.
- **Telemetry**: Emits `game:progress`, `game:score`, and `game:complete`.
