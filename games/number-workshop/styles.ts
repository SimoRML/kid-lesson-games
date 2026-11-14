/**
 * The cartridge's CSS as one string, injected into the container because the
 * game lives inside the host's shadow root (page CSS does not reach it).
 *
 * Semantic colours (contrast measured against #0f172a / #1e293b):
 *   dividend  #38bdf8 (8.33 / 6.83)   divisor   #c4b5fd (9.67 / 7.92)
 *   quotient  #4ade80 (10.25 / 8.40)  remainder #fb923c (7.89 / 6.46)
 */

export const STYLES = `
.nw-root {
  --nw-bg: #0f172a; --nw-surface: #1e293b; --nw-text: #f8fafc; --nw-muted: #cbd5e1;
  --nw-sky: #38bdf8; --nw-gold: #fbbf24;
  --nw-dividend: #38bdf8; --nw-divisor: #c4b5fd; --nw-quotient: #4ade80; --nw-remainder: #fb923c;
  display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;
  min-height: 400px; height: 100%; padding: 12px;
  background: var(--nw-bg); color: var(--nw-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-variant-numeric: tabular-nums; position: relative;
}
.nw-root *, .nw-root *::before, .nw-root *::after { box-sizing: border-box; }
.nw-root [hidden] { display: none !important; }

.nw-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.nw-hud-left { display: flex; align-items: center; gap: 10px; }
.nw-title { margin: 0; font-size: 1.05rem; font-weight: 700; }
.nw-badge { background: var(--nw-surface); border: 1px solid #334155; border-radius: 999px; padding: 2px 10px; font-weight: 700; }
.nw-instruction { flex: 1 1 260px; min-width: 0; text-align: center; color: var(--nw-muted); font-size: 0.95rem; line-height: 1.35; }
.nw-hud-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.nw-score { color: var(--nw-gold); font-weight: 700; min-width: 4.5ch; }
@media (max-width: 560px) { .nw-instruction { order: 3; flex-basis: 100%; } }

.nw-btn {
  min-height: 44px; min-width: 44px; padding: 8px 14px; border-radius: 10px;
  background: var(--nw-surface); color: var(--nw-text); border: 1px solid #475569;
  font: inherit; font-weight: 600; cursor: pointer; transition: transform 0.12s ease, background 0.12s ease;
}
.nw-btn:hover:not(:disabled) { background: #334155; }
.nw-btn:active:not(:disabled) { transform: scale(0.96); }
.nw-btn:disabled { opacity: 0.45; cursor: default; }
.nw-btn-primary { background: var(--nw-sky); color: var(--nw-bg); border-color: var(--nw-sky); }
.nw-btn-primary:hover:not(:disabled) { background: #7dd3fc; }
.nw-root button:focus-visible { outline: 3px solid var(--nw-gold); outline-offset: 2px; }

.nw-equation { min-height: 4.2rem; display: flex; align-items: center; justify-content: center; font-size: 1.9rem; font-weight: 800; text-align: center; }
.nw-eq-visual { display: inline-flex; align-items: flex-start; gap: 0.5rem; }
.nw-term { display: inline-flex; flex-direction: column; align-items: center; }
.nw-num { line-height: 1.1; }
.nw-lab { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; }
.nw-op { color: var(--nw-muted); line-height: 1.1; }
.nw-role-dividend { color: var(--nw-dividend); }
.nw-role-divisor { color: var(--nw-divisor); }
.nw-role-quotient { color: var(--nw-quotient); }
.nw-role-remainder { color: var(--nw-remainder); }
.nw-equation-solved { animation: nw-write 0.4s ease both; }
.nw-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.nw-stage { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.nw-stage.nw-solved .nw-facts { filter: drop-shadow(0 0 10px rgba(74, 222, 128, 0.45)); }
.nw-paused .nw-stage { opacity: 0.5; pointer-events: none; }

.nw-facts { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.nw-plates { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.nw-plate {
  width: 118px; min-height: 118px; padding: 8px; border-radius: 22px;
  background: var(--nw-surface); border: 3px solid var(--nw-divisor);
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: transform 0.15s ease;
}
.nw-plate-btn {
  min-height: 44px; min-width: 44px; width: 100%; border-radius: 12px; border: 1px dashed var(--nw-divisor);
  background: transparent; color: var(--nw-quotient); font: inherit; font-size: 1.4rem; font-weight: 800; cursor: pointer;
}
.nw-plate-btn::after { content: ' +'; color: var(--nw-muted); font-size: 1rem; }
.nw-plate-btn:active { transform: scale(0.96); }
.nw-plate-tokens { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px; min-height: 44px; }
.nw-token { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; touch-action: none; }
.nw-placed { cursor: pointer; animation: nw-land 0.25s ease both; }
.nw-tray-token { cursor: grab; width: 34px; height: 34px; }
.nw-tray-token svg { width: 30px; height: 30px; }
.nw-token.nw-dragging { cursor: grabbing; z-index: 5; position: relative; transition: none; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.5)); }
.nw-tray {
  width: min(100%, 560px); min-height: 70px; padding: 8px 12px; border-radius: 16px;
  background: var(--nw-surface); border: 2px solid var(--nw-dividend);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px;
}
.nw-tray-left { border-color: var(--nw-remainder); border-style: dashed; }
.nw-tray-caption { flex-basis: 100%; text-align: center; font-size: 0.8rem; font-weight: 700; color: var(--nw-dividend); }
.nw-tray-left .nw-tray-caption { color: var(--nw-remainder); }
.nw-deal { min-width: 180px; }

.nw-pile { font-weight: 700; color: var(--nw-dividend); text-align: center; }
.nw-gb { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.nw-gb-visual { display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; gap: 5px 14px; max-height: 190px; overflow: hidden; min-height: 40px; }
.nw-gb-row { display: flex; gap: 3px; padding: 3px 6px; border-radius: 8px; background: rgba(196, 181, 253, 0.12); border: 1px solid var(--nw-divisor); animation: nw-land 0.2s ease both; }
.nw-gb-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--nw-dividend); }
.nw-gb-left { background: rgba(251, 146, 60, 0.12); border-color: var(--nw-remainder); border-style: dashed; }
.nw-gb-dot-left { background: var(--nw-remainder); }
.nw-gb-readout { font-size: 1.3rem; font-weight: 800; color: var(--nw-quotient); text-align: center; min-height: 1.6em; }
.nw-gb-buttons { display: flex; gap: 12px; }
.nw-gb-btn { min-width: 96px; }
.nw-hint { min-height: 1.4em; color: var(--nw-remainder); font-weight: 600; text-align: center; }
.nw-check { min-width: 140px; }

.nw-euclid { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.nw-live-eq { font-size: 1.25rem; font-weight: 800; text-align: center; min-height: 1.6em; }
.nw-gb-visual.nw-track-wrap { display: block; width: min(100%, 620px); max-height: none; overflow: visible; }
.nw-track { display: flex; width: 100%; min-height: 34px; border-radius: 8px; background: rgba(56, 189, 248, 0.1); border: 2px solid var(--nw-dividend); overflow: hidden; }
.nw-bar { height: 30px; background: var(--nw-divisor); border-right: 2px solid var(--nw-bg); animation: nw-land 0.2s ease both; }
.nw-bar-over { background: repeating-linear-gradient(45deg, #fb7185, #fb7185 6px, #be123c 6px, #be123c 12px); }
.nw-gap { display: flex; height: 30px; border-left: 2px dashed var(--nw-remainder); }
.nw-gap-hidden { background: rgba(251, 146, 60, 0.08); }
.nw-unit { flex: 1; min-width: 0; border-right: 1px solid rgba(251, 146, 60, 0.7); background: rgba(251, 146, 60, 0.22); }
.nw-axis { position: relative; height: 1.4em; font-size: 0.8rem; font-weight: 700; }
.nw-axis-zero { position: absolute; left: 0; color: var(--nw-muted); }
.nw-axis-end { position: absolute; transform: translateX(-100%); }
.nw-rem-row { display: flex; align-items: center; gap: 10px; font-weight: 800; }
.nw-rem-display { min-width: 3ch; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border: 2px dashed var(--nw-remainder); border-radius: 10px; font-size: 1.5rem; background: var(--nw-surface); }
.nw-keypad { display: grid; grid-template-columns: repeat(auto-fit, minmax(48px, 1fr)); gap: 6px; width: min(100%, 300px); }
.nw-key { padding: 6px; font-size: 1.15rem; }
.nw-shift { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; --nw-col: clamp(28px, 8.5vw, 48px); }
@supports (width: 1cqw) { .nw-stage { container-type: inline-size; } .nw-shift { --nw-col: clamp(24px, 8.5cqw, 48px); } }
.nw-counter { min-height: 1.6em; font-size: 1.2rem; font-weight: 800; color: var(--nw-divisor); text-align: center; }
.nw-pv { display: flex; flex-direction: column; }
.nw-pv-head { display: flex; }
.nw-pv-col { width: var(--nw-col); text-align: center; font-size: 0.7rem; font-weight: 800; color: var(--nw-dividend); padding: 4px 0; border-bottom: 2px solid var(--nw-dividend); box-sizing: border-box; }
.nw-pv-off { border-bottom: 2px dashed var(--nw-remainder); }
.nw-pv-body { position: relative; height: calc(var(--nw-col) * 1.4); width: calc(var(--nw-col) * 10); background: linear-gradient(90deg, var(--nw-surface) calc(var(--nw-col) * 6), rgba(251, 146, 60, 0.1) 0); border-radius: 0 0 10px 10px; touch-action: none; }
.nw-strip { position: absolute; top: 0; left: calc(var(--nw-col) * var(--nw-offset, 0)); height: 100%; display: flex; cursor: grab; transition: left 0.25s ease; touch-action: none; }
.nw-strip.nw-dragging, .nw-strip.nw-snap { cursor: grabbing; transition: none; }
.nw-digit { width: var(--nw-col); display: flex; align-items: center; justify-content: center; font-size: calc(var(--nw-col) * 0.75); font-weight: 800; color: var(--nw-dividend); }
.nw-digit-off { color: var(--nw-remainder); opacity: 0.55; }
.nw-shift-buttons { display: flex; gap: 12px; }
.nw-long { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; --nw-lcol: clamp(26px, 8vw, 40px); }
@supports (width: 1cqw) { .nw-long { --nw-lcol: clamp(22px, 7cqw, 40px); } }
.nw-potence { display: flex; align-items: flex-start; gap: 0; font-variant-numeric: tabular-nums; }
.nw-lleft { display: flex; flex-direction: column; }
.nw-lrow { display: flex; }
.nw-lcell { width: var(--nw-lcol); height: calc(var(--nw-lcol) * 0.95); display: inline-flex; align-items: center; justify-content: center; font-size: calc(var(--nw-lcol) * 0.7); font-weight: 800; color: var(--nw-dividend); padding: 0; border: 0; background: transparent; font-family: inherit; box-sizing: border-box; }
.nw-lsign { color: var(--nw-muted); width: calc(var(--nw-lcol) * 0.7); }
.nw-lrest { color: var(--nw-muted); }
.nw-lpart { color: var(--nw-dividend); background: rgba(56, 189, 248, 0.16); border-radius: 6px; }
.nw-lbring { color: var(--nw-bg); background: var(--nw-gold); border-radius: 6px; cursor: pointer; min-width: 0; animation: nw-land 0.3s ease both; }
.nw-lbring:hover { background: #fcd34d; }
.nw-lproduct .nw-lcell { color: var(--nw-divisor); }
.nw-lproduct { border-bottom: 3px solid var(--nw-muted); }
.nw-lremainder .nw-lcell { color: var(--nw-remainder); }
.nw-lremainder .nw-lpart { color: var(--nw-dividend); }
.nw-lauto { opacity: 0.85; animation: nw-write 0.35s ease both; }
.nw-lactive { outline: 2px dashed var(--nw-gold); border-radius: 6px; }
.nw-lright { display: flex; flex-direction: column; margin-left: 4px; border-left: 3px solid var(--nw-muted); min-width: calc(var(--nw-lcol) * 2.4); }
.nw-ldivisor { padding: 0 10px; height: calc(var(--nw-lcol) * 0.95); display: flex; align-items: center; font-size: calc(var(--nw-lcol) * 0.7); font-weight: 800; border-bottom: 3px solid var(--nw-muted); }
.nw-lquotient { padding: 4px 10px; min-height: calc(var(--nw-lcol) * 0.95); font-size: calc(var(--nw-lcol) * 0.7); font-weight: 800; letter-spacing: 0.15em; }
.nw-lactive-digit { outline: 2px dashed var(--nw-gold); border-radius: 6px; padding: 0 4px; }
.nw-long-eq { font-size: 1.3rem; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; }
.nw-lfield { min-width: 1.6ch; text-align: center; padding: 0 6px; border-radius: 6px; background: var(--nw-surface); }
.nw-shake { animation: nw-shake 0.4s ease; }
.nw-pulse { animation: nw-pulse 0.45s ease; }

.nw-banner { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) scale(0.8); font-size: 2.2rem; font-weight: 800; color: var(--nw-gold); text-shadow: 0 2px 12px rgba(0,0,0,0.6); opacity: 0; pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease; text-align: center; }
.nw-banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }

.nw-end { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.nw-end-stars { font-size: 3rem; color: var(--nw-gold); letter-spacing: 0.2em; }
.nw-end-score { font-size: 1.4rem; font-weight: 800; }
.nw-end-summary { color: var(--nw-muted); }

@keyframes nw-land { 0% { transform: scale(0.6, 1.3); } 60% { transform: scale(1.1, 0.9); } 100% { transform: scale(1); } }
@keyframes nw-write { from { opacity: 0.2; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes nw-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@keyframes nw-pulse { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 10px #fb923c); } }

@media (prefers-reduced-motion: reduce) {
  .nw-root *, .nw-root *::before, .nw-root *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  .nw-root .nw-pulse { animation-duration: 0.45s !important; }
}
`;
