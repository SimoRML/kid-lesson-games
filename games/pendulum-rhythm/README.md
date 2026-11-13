# ⏱️ Pendulum Rhythm Lab (`pendulum-rhythm`)

An interactive, tactile physics playground for children aged 3–11 to explore time, periodic oscillation, momentum transfer, Galileo's pendulum invariant, and harmonic polyrhythm ratios.

---

## 1. Educational Purpose & Curriculum

Periodic motion and rhythm form the physical foundation of clocks, musical tempos, and acoustic waves. `pendulum-rhythm` provides an intuitive, hands-on progression:

### Age Bracket 1: Ages 3–5 (Preschool) — "Wrecking Ball Knockdown"
- **Focus**: Concrete cause-and-effect, potential energy conversion, and momentum transfer.
- **Mechanics**: Pull back the steel bob like a wrecking ball and let go to topple colorful wooden toy blocks perched on a pedestal.
- **Scaffolding**: Visual arc guide, pullback angle readout, and quick preset buttons (`"Gentle (20°)"`, `"Medium (40°)"`, `"Smash! (60°)"`) assisting emerging fine motor skills.
- **Victory Condition**: All blocks knocked off the pedestal or tilted beyond $35^\circ$, celebrated with block tumbling sounds and confetti.

### Age Bracket 2: Ages 6–8 (Early Elementary) — "Metronome Beat & Galileo's Invariant"
- **Focus**: Variable isolation and discovering Galileo Galilei's Law of the Pendulum:
  $$\text{String length controls swing period — bob mass does NOT!}$$
- **Anti-Mirroring Curriculum Rule (AGENTS.md §4.1)**:
  - Forbids trivial 1-to-1 visual matching.
  - The goal is presented acoustically and visually as a musical tempo ($60\text{ BPM}$, $90\text{ BPM}$, $120\text{ BPM}$).
  - The tray provides multiple string lengths ($25\text{ cm}$, $45\text{ cm}$, $64\text{ cm}$, $100\text{ cm}$) AND multiple bob masses ($50\text{ g}$, $100\text{ g}$, $200\text{ g}$).
  - The child discovers that swapping a $50\text{ g}$ mass for a $200\text{ g}$ mass leaves the period unchanged, while shortening the string dramatically speeds up the swing.
- **Victory Condition**: 3 consecutive beats where (1) the measured time between nadir crossings equals the beat interval within 6% (rejects 2x too fast / too slow swings; `checkPeriodMatch`) and (2) the crossing lands on the beat within the level tolerance. Dragging is limited to 30 deg so the period reflects string length, and *Reset Swing* restarts swing and metronome in phase.
- **Scaffolding**: no answer is stated up front. The HUD asks questions about the mass, gives a directional hint when out of sync ("faster/slower than the beat"), and explains the invariance only after success.

### Age Bracket 3: Ages 9–11 (Upper Elementary) — "Harmonic Polyrhythms & Square-Root Law ($T \propto \sqrt{L}$)"
- **Focus**: Proportional and non-linear reasoning, fractions, and musical polyrhythms ($2:1$, $3:1$, $3:2$).
- **The Square-Root Law**:
  $$\frac{T_B}{T_A} = \sqrt{\frac{L_B}{L_A}} \iff \frac{f_A}{f_B} = \sqrt{\frac{L_B}{L_A}} \iff \frac{L_B}{L_A} = \left(\frac{f_A}{f_B}\right)^2$$
- **Core Insight**: Doubling the frequency ($2:1$) requires reducing the length to $\frac{1}{4}$ ($L_B = 4 L_A$). Length ratio is the *square* of the frequency ratio!
- **Mechanics**: Dual pendulums suspended side-by-side. Tapping `"Release Together"` launches both in sync. Optical nadir sensors detect coincidences and play harmonious chords.
- **Victory Condition**: 2 consecutive polyrhythmic coincidences locked.

---

## 2. Mathematical & Physical Formulation

### 2.1 Simple Pendulum Kinematics
For small to moderate angles:
$$T = 2\pi \sqrt{\frac{L}{g}}, \quad f = \frac{1}{T} = \frac{1}{2\pi} \sqrt{\frac{g}{L}}$$

Inverting for required length given target period $T$ or BPM ($g = 9.8\text{ m/s}^2$):
$$L = g \left(\frac{T}{2\pi}\right)^2, \quad T = \frac{60}{\text{BPM}} \times \text{beatsPerCycle}$$

### 2.2 Symplectic Semi-Implicit Euler Integrator
To guarantee energy conservation and zero numerical drift over long simulation runs:
$$\alpha(t) = -\frac{g}{L}\sin\theta(t) - \gamma \omega(t)$$
$$\omega(t + \Delta t) = \omega(t) + \alpha(t) \cdot \Delta t$$
$$\theta(t + \Delta t) = \theta(t) + \omega(t + \Delta t) \cdot \Delta t$$

$\Delta t$ is clamped to $\le 0.033\text{ s}$ to prevent numerical instability.

### 2.3 Rigid Body 2D Contact & Momentum Exchange
Circle-AABB contact resolution computes the contact normal $\vec{n}$ and impulse $J$:
$$J = \frac{-(1 + e) v_{\text{rel}}}{\frac{1}{m_{\text{bob}}} + \frac{1}{m_{\text{block}}}}$$
Transfers forward linear impulse to topple target blocks and imparts rotational torque $\tau = \vec{r} \times \vec{J}$.

---

## 3. Controls & Tactile Ergonomics

- **Dual Input Ergonomics**: Unified pointer events discriminate between taps and dragging using a $5\text{ px}$ threshold. Interactive hit targets are $\ge 44\times 44\text{ px}$.
- **Granular Reset**: Tapping `"Reset Blocks"` smoothly restacks the tower without reinitializing level progress or score.
- **Settling Confirmation Window**: Once win criteria are satisfied, an emerald settling window ($0.5\text{ s} - 0.7\text{ s}$) allows the child to observe *why* their answer succeeded before the next round begins.
- **Dynamic Live HUD**: The centered instruction `#hud-instruction` adapts dynamically to player interactions, providing immediate feedback on angle, mass invariance, and polyrhythm ratio progress.
- **Procedural Web Audio**: Uses `context.audio` (`playClick`, `playPop`, `playDrop`, `playChime`, `playSuccess`, `playTone`) without raw `AudioContext` instantiation.

---

## 4. Exported API Reference

From `games/pendulum-rhythm/index.ts`:

| Export | Type | Description |
|---|---|---|
| `calculatePeriod` | Function | $T = 2\pi\sqrt{L/g}$ (length in cm, period in sec) |
| `calculateFrequency` | Function | $f = 1/T$ in Hz |
| `calculateLengthForPeriod` | Function | Inverts formula: $L = g(T/2\pi)^2$ |
| `calculateLengthForBpm` | Function | Solves length for musical tempo |
| `calculatePolyrhythmLengthRatio` | Function | Computes $(p/q)^2$ |
| `simulatePendulumStep` | Function | Symplectic semi-implicit Euler step |
| `checkCircleBoxCollision` | Function | Accurate circle vs. box contact test |
| `resolveCollisionImpulse` | Function | 2D momentum and rotational impulse |
| `checkBeatMatch` | Function | Beat coincidence check with floating-point tolerance |
| `verifyAntiMirroring` | Function | Proof of pedagogical anti-mirroring compliance |
| `generateLevelsForAge` | Function | Procedural levels for `3-5`, `6-8`, and `9-11` |
| `parseCustomLevels` | Function | Defensive LMS custom level parser with safe fallback |
| `PendulumRhythmGame` | Class | `KidGame` implementation with zero-leak teardown |
| `createGame` | Factory | Entrypoint factory returning `KidGame` instance |

---

## 5. Verification Commands

```bash
# Run unit tests
npm test

# Run TypeScript type-check and Vite production build
npm run build

# Verify zero changes in src/
git status --porcelain src/
```
