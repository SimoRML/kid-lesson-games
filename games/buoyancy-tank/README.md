# 🌊 Buoyancy Tank & Density Lab (`buoyancy-tank`)

An interactive physics and hydrostatics game cartridge teaching Archimedes' principle, liquid volume displacement ($1\text{ cm}^3 = 1\text{ mL}$), and density equilibrium ($\rho = m/V$) through hands-on tactile experimentation with floating manipulatives, graduated water cylinders, and a trim-balanced submarine pod.

---

## 1. Educational Mission & Pedagogical Progression

`buoyancy-tank` differentiates across three developmental stages, scaffolding from intuitive sensory exploration to algebraic hydrostatic calculations:

### 🐣 Ages 3–5 (Preschool): Qualitative Sink vs. Float
- **Core Concept**: Material classification and buoyant equilibrium.
- **Learning Experience**:
  - Children drop items (cedar wood, rubber duck, apple, granite pebble, iron bolt, glass marble) into a tank of water.
  - Floating objects bob gently at the surface using damped harmonic oscillation with part of their volume submerged.
  - Sinking objects plunge to the bottom leaving trails of rising air bubbles.
- **Pedagogical Goal**: Understanding that heavy materials sink while buoyant materials float, without needing numbers or formulas.

### 📐 Ages 6–8 (Early Elementary): Quantitative Volume Displacement & Metric Addition
- **Core Concept**: Liquid displacement ($1\text{ cm}^3 = 1\text{ mL}$) and graduated measurement.
- **Learning Experience**:
  - A graduated cylinder with major markings every $100\text{ mL}$ and minor ticks every $20\text{ mL}$ starts with an initial water level (e.g. $400\text{ mL}$).
  - A glowing golden target line (e.g. $700\text{ mL}$, requiring $+300\text{ mL}$) challenges the child to raise the water level.
  - **Strict Anti-Mirroring Rule**: No single block in the inventory equals the required displacement delta. Reaching the target waterline strictly requires combining $2$ or more blocks (e.g. $100 + 200\text{ cm}^3$), with plausible distractors (e.g. $150\text{ cm}^3$) to prevent guessing.
- **Pedagogical Goal**: Connecting cubic centimeters of solid volume to liquid milliliters displaced, practicing mental addition and conservation of volume.

### 🔬 Ages 9–11 (Upper Elementary): Density Formula ($\rho = m/V$) & Submarine Neutral Buoyancy
- **Core Concept**: Archimedes' buoyant force balance ($F_b = \rho_{fluid} \cdot V \cdot g$) and submarine ballast trimming.
- **Learning Experience**:
  - Children control a submersible exploration pod in different aquatic environments:
    - **Freshwater**: $\rho = 1.00\text{ g/cm}^3$
    - **Saltwater (Marine Brine)**: $\rho = 1.20\text{ g/cm}^3$
  - The submarine has a base hull mass and volume. Children attach modular ballast weights (dense iron/lead: $+m, 0\text{ cm}^3$) or syntactic foam floats (buoyant foam: $+m, +V\text{ cm}^3$).
  - Target condition: Achieve **Neutral Buoyancy** where submarine density matches the fluid density within $\pm 0.04\text{ g/cm}^3$, causing the submarine to hover steadily at target depth with rotating brass propellers.
- **Pedagogical Goal**: Applying the ratio $\rho = \frac{m}{V}$ to real fluid dynamics, discovering why objects float more easily in dense saltwater than in freshwater.

---

## 2. Tactile UX & Interaction Mechanics

1. **Dual Input Ergonomics**:
   - **Click / Tap**: Tapping an item in the tray automatically drops it into the tank.
   - **Drag-and-Drop**: Touch or mouse dragging with a $5\text{px}$ movement threshold and drop detection into the water area. Interactive targets are $\ge 48\times 48\text{px}$.
2. **Granular Undo**:
   - Clicking or tapping any item placed inside the tank or submarine immediately retrieves it back to the inventory tray, updating the water level smoothly without forcing a round reset.
   - A dedicated **Clear Tank** (`#btn-reset`) button returns all placed items at once.
3. **Dynamic Scaffolding HUD**:
   - The central prompt (`#hud-instruction`) updates in real time with live math readouts (e.g. current water mL, remaining delta needed, submarine mass/volume/density ratio) and helpful directional feedback without spoiling answers.
4. **Settling Window ($0.65\text{s}$)**:
   - When the win condition is achieved, a circular emerald progress ring settles for $0.65\text{s}$ to allow the child to visually observe *why* their physical solution succeeded before advancing.
5. **Procedural Aesthetics & Web Audio**:
   - HiDPI Canvas 2D rendering with dynamic sine-wave water surface, splash droplets, rising air bubbles, graduated ticks, and an animated submarine with spinning propeller.
   - Procedural Web Audio SFX via `context.audio` (`playDrop`, `playPop`, `playSuccess`, `playClick`) and celebratory bursts with `canvas-confetti`.

---

## 3. Pure Domain API & Deterministic Functions

The following pure math and domain functions are exported from `games/buoyancy-tank/index.ts`:

- `calculateDensity(massG: number, volumeCm3: number): number`
- `calculateBuoyancyState(fluidDensity: number, massG: number, volumeCm3: number, tolerance?: number): BuoyancyResult`
- `calculateDisplacement(initialWaterMl: number, items: BuoyancyItem[], fluidDensity?: number, tankCapacityMl?: number): DisplacementResult`
- `calculateSubmarineDensity(baseSub: SubmarineBase, modules: SubmarineModule[], fluidDensity?: number, tolerance?: number): SubmarineTrimResult`
- `calculateWaterSurfaceLevel(tankHeightPx: number, waterVolumeMl: number, tankCapacityMl: number, padding?: { top: number; bottom: number }): number`
- `generateLevelsForAge(ageGroup: AgeGroup): BuoyancyLevel[]`
- `verifyAntiMirroring(level: BuoyancyLevel): boolean`
- `simulateBuoyancyLevel(level: BuoyancyLevel, placedItems: PlacedItem[], settlingTimeSeconds?: number): BuoyancySimulationResult`
- `parseCustomLevels(raw: unknown): BuoyancyLevel[] | null`

---

## 4. Internationalization (`i18n.ts`)

Full bilingual localization for English (`en`) and French (`fr`) using `createI18nResolver`. All HUD labels, tooltips, measurement units, and dynamic mathematical prompts update live when `context.locale` changes.

---

## 5. Verification & Testing

Run the test suite:
```bash
# Run buoyancy tank unit tests
npx vitest run games/buoyancy-tank/index.test.ts

# Run entire repo test suite
npm test

# Production build check
npm run build
```
