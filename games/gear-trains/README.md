# ⚙️ Gear Trains & Mechanical Advantage

An interactive clockwork and gear transmission educational game cartridge for `kid-lesson-games`. Players place interlocking procedural gears with varying tooth counts ($N \in \{6, 8, 12, 16, 24\}$) onto pegs to connect a driving motor gear to a target windmill or dial, exploring multiplication, speed ratios, rotational parity, and mechanical advantage.

---

## 1. Educational Purpose & Scientific Concepts

Gear trains are among the foundational mechanisms of engineering and classical physics. This cartridge teaches:
- **Spatial Adjacency & Cause-and-Effect** (Ages 3–5): Understanding that interlocking teeth physically transfer movement and energy from a motor across a spatial gap to turn a windmill.
- **Rotational Direction & Parity** (Ages 6–8): Observing that every gear mesh reverses direction. A chain with an **odd** number of gears maintains the motor's direction, while a chain with an **even** number of gears reverses it ($(-1)^{k-1}$).
- **Gear Ratios & Rotational Speed ($RPM$)** (Ages 6–11): Exploring how tooth counts determine rotational velocity ($\omega_2 = -\omega_1 \cdot \frac{N_1}{N_2}$). A larger driver gear speeds up a smaller follower (speed doubling/tripling), while a smaller driver creates a reduction gear train (speed halving).
- **Least Common Multiple (LCM) & Meshing Periodicity** (Ages 9–11): Computing $\text{LCM}(N_1, N_2)$ to discover how many teeth and revolutions must pass before the initial meshing teeth re-synchronize.
- **Odd-Cycle Jamming Detection**: Experiencing real mechanical physics where 3 gears meshing in a closed triangle cannot rotate due to conflicting directional constraints, halting the drive until the player corrects the layout.

---

## 2. Three-Tier Curriculum Progression

### Ages 3–5 (Preschool) — "Windmill Whirler"
- **Focus**: Tactile spatial connection, cause-and-effect.
- **Target**: A cheerful 4-blade colorful windmill.
- **Mechanics**: Any valid continuous gear path connecting motor to windmill makes it whirl happily.
- **Levels**:
  1. *Windmill Bridge*: 1 intermediary peg ($12\text{T}$ solution vs. $8\text{T}$ distractor).
  2. *Double Step*: 2 intermediary pegs bridging a 2-step span ($12\text{T} + 12\text{T}$).
  3. *Triple Bridge*: 3 intermediary pegs bridging an alternating span ($16\text{T} + 8\text{T} + 16\text{T}$).

### Ages 6–8 (Early Elementary) — "Direction Parity & 1:2 Speed Doubling"
- **Focus**: Direction reversal (even vs. odd total gear count) and 1:2 speed doubling with strict Anti-Mirroring.
- **Target**: A calibrated tachometer dial showing target direction (CW/CCW) and RPM.
- **Mechanics**: Players must match the target's required rotation direction and speed.
- **Levels**:
  1. *Direction Reversal*: 4 gears total (even parity) to reverse Motor CW to Target CCW at 40 RPM.
  2. *Speed Doubling 1:2*: 16T motor driving 8T target via 12T idler ($30 \to 60\text{ RPM CW}$).
  3. *Double & Reverse*: 24T motor driving 12T target via 2 intermediate gears ($40 \to 80\text{ RPM CCW}$).

### Ages 9–11 (Upper Elementary) — "Gear Ratios, RPM Kinematics & LCM"
- **Focus**: Quantitative gear ratio computation, step-down and step-up gearing, LCM tooth synchronization.
- **Target**: High-precision tachometer dial displaying live RPM and directional readout.
- **Mechanics**: Calculate tooth ratios $\frac{N_{\text{motor}}}{N_{\text{target}}}$ and account for gear count parity across multiple intermediate pegs.
- **Levels**:
  1. *Speed Halving 1:2*: 12T motor driving 24T target ($120 \to 60\text{ RPM CCW}$, $\text{LCM} = 24$).
  2. *Speed Tripling 3:1*: 24T motor driving 8T target ($40 \to 120\text{ RPM CW}$, $\text{LCM} = 24$).
  3. *Fractional Ratio 2:3 & LCM*: 16T motor driving 24T target ($60 \to 40\text{ RPM CCW}$, $\text{LCM} = 48$).

---

## 3. Tactile Ergonomics & Visual Polish

1. **Dual Input (Tap/Click & Drag-and-Drop)**:
   - Tap any gear in the bottom tray (movement under ~5 px) to drop it on the first available empty peg; drag it to choose a specific peg.
   - Alternatively, drag-and-drop pieces directly onto pegs with generous snap radius ($65\text{px}$) and clear visual highlights.
2. **Granular Undo**:
   - Tapping or clicking any placed gear on a peg removes *only that gear* and returns it to the inventory tray.
   - A dedicated "Clear Gears" button resets all placed gears in one tap.
3. **Settling Confirmation Window**:
   - When the correct physical chain is established, a continuous 0.6s stabilization delay is observed so the child sees the mechanism running before victory celebration triggers.
4. **Procedural Aesthetics & Zero External Runtime Assets**:
   - 100% Canvas 2D involute gear rendering with radial gradients, spoke cutouts for larger gears ($N \ge 12$), axle holes, and distinct palette colors per tooth count ($6\text{T}$ crimson, $8\text{T}$ amber, $12\text{T}$ emerald, $16\text{T}$ sky blue, $24\text{T}$ royal purple).
   - Audio synthesized procedurally via `context.audio` (`SoundEngine`).
   - Celebratory bursts using `canvas-confetti`.
5. **Dynamic Scaffolding HUD**:
   - Live HUD guidance showing connection status, direction parity hints, speed feedback, and LCM ratio math as gears are moved.

---

## 4. Technical Architecture

- **Cartridge File Layout**:
  - `game.json`: Taxonomy, skills, and age brackets.
  - `i18n.ts`: Bilingual English (`en`) and French (`fr`) translations using `createI18nResolver`.
  - `index.ts`: `GearTrainsGame` implementing `KidGame`, plus exported pure domain math functions (`calculatePitchRadius`, `areGearsMeshed`, `calculateOutputSpeed`, `calculateDirection`, `calculateLCM`, `simulateGearTrain`, `parseCustomLevels`, `generateLevelsForAge`).
  - `index.test.ts`: Vitest test suite with 38 unit and DOM lifecycle tests.
- **Teardown & Robustness**:
  - Zero memory leaks: cleanly cancels `requestAnimationFrame`, clears all pending timeouts, disconnects `ResizeObserver`, aborts `AbortController` listeners, and clears DOM in `destroy()`.
  - Safe guards for headless and test environments (`canvas.getContext('2d')`, `ResizeObserver`).
