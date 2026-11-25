/**
 * The cartridge's CSS as one string, injected into the container because the
 * game lives inside the host's shadow root (page CSS does not reach it).
 *
 * Place-value colours are shared by the factory and the written grid so that a
 * carry box shows the very pack it stands for:
 *   candies (units) #f472b6 · bags (tens) #38bdf8 · boxes (hundreds) #fb923c
 *   crates (thousands) #4ade80 · ten thousands #c4b5fd
 */

export const STYLES = `
.cf-root {
  --cf-bg: #0f172a; --cf-surface: #1e293b; --cf-line: #334155; --cf-text: #f8fafc; --cf-muted: #cbd5e1;
  --cf-sky: #38bdf8; --cf-gold: #fbbf24; --cf-ok: #4ade80; --cf-bad: #f87171;
  --cf-p0: #f472b6; --cf-p1: #38bdf8; --cf-p2: #fb923c; --cf-p3: #4ade80; --cf-p4: #c4b5fd;
  display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;
  min-height: 420px; height: 100%; padding: 12px; position: relative; overflow-x: hidden; overflow-y: auto;
  background: var(--cf-bg); color: var(--cf-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-variant-numeric: tabular-nums;
}
.cf-root *, .cf-root *::before, .cf-root *::after { box-sizing: border-box; }
.cf-root [hidden] { display: none !important; }
.cf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* HUD */
.cf-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.cf-hud-left { display: flex; align-items: center; gap: 10px; }
.cf-title { margin: 0; font-size: 1.05rem; font-weight: 800; }
.cf-badge { background: var(--cf-surface); border: 1px solid var(--cf-line); border-radius: 999px; padding: 2px 10px; font-weight: 700; white-space: nowrap; }
.cf-instruction { flex: 1 1 260px; min-width: 0; text-align: center; color: var(--cf-muted); font-size: 1rem; line-height: 1.35; }
.cf-hud-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.cf-score { color: var(--cf-gold); font-weight: 800; min-width: 4.5ch; }
@media (max-width: 560px) { .cf-instruction { order: 3; flex-basis: 100%; } }

.cf-btn {
  min-height: 44px; min-width: 44px; padding: 8px 14px; border-radius: 12px;
  background: var(--cf-surface); color: var(--cf-text); border: 1px solid #475569;
  font: inherit; font-weight: 700; cursor: pointer; transition: transform 0.12s ease, background 0.12s ease;
}
.cf-btn:hover:not(:disabled) { background: var(--cf-line); }
.cf-btn:active:not(:disabled) { transform: scale(0.95); }
.cf-btn:disabled { opacity: 0.45; cursor: default; }
.cf-btn-primary { background: var(--cf-sky); color: var(--cf-bg); border-color: var(--cf-sky); }
.cf-btn-primary:hover:not(:disabled) { background: #7dd3fc; }
.cf-root button:focus-visible { outline: 3px solid var(--cf-gold); outline-offset: 2px; }
.cf-root button { -webkit-tap-highlight-color: transparent; }

/* Stage, banner, shelf, end */
.cf-stage { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.cf-stage.cf-solved { filter: drop-shadow(0 0 12px rgba(74, 222, 128, 0.45)); }
.cf-paused .cf-stage { opacity: 0.5; pointer-events: none; }
.cf-banner {
  position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) scale(0.6); opacity: 0; pointer-events: none;
  background: var(--cf-surface); border: 2px solid var(--cf-gold); color: var(--cf-gold);
  padding: 14px 26px; border-radius: 18px; font-size: 1.6rem; font-weight: 900; text-align: center;
  transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease; z-index: 5; max-width: 90%;
}
.cf-banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.cf-banner.cf-banner-info { border-color: var(--cf-sky); color: var(--cf-sky); font-size: 1.15rem; top: 18%; }
.cf-shelf { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 30px; font-size: 1.3rem; }
.cf-shelf-label { font-size: 0.75rem; color: var(--cf-muted); margin-right: 6px; }
.cf-sticker { animation: cf-pop 0.45s cubic-bezier(.34,1.56,.64,1) both; }
.cf-end { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.cf-end-stars { font-size: 3rem; color: var(--cf-gold); letter-spacing: 0.15em; }
.cf-end-score { font-size: 1.3rem; font-weight: 800; }
.cf-end-summary { color: var(--cf-muted); }

/* Items (pure CSS, colour = place value) */
.cf-item { display: inline-block; position: relative; flex: none; }
.cf-candy { width: 18px; height: 18px; border-radius: 50%; margin: 0 6px;
  background: radial-gradient(circle at 35% 35%, #fbcfe8, var(--cf-p0) 55%, #be185d); }
.cf-candy::before, .cf-candy::after { content: ''; position: absolute; top: 4px; border: 5px solid transparent; }
.cf-candy::before { left: -8px; border-right: 6px solid var(--cf-p0); }
.cf-candy::after { right: -8px; border-left: 6px solid var(--cf-p0); }
.cf-bag { width: 22px; height: 26px; border-radius: 4px 4px 9px 9px; background: linear-gradient(#7dd3fc, var(--cf-p1)); margin: 1px; }
.cf-bag::before { content: ''; position: absolute; left: 3px; right: 3px; top: -4px; height: 7px; border-radius: 3px; background: #0ea5e9; }
.cf-box { width: 26px; height: 24px; border-radius: 3px; background: linear-gradient(#fdba74, var(--cf-p2)); margin: 1px; }
.cf-box::before { content: ''; position: absolute; left: 11px; width: 4px; top: 0; bottom: 0; background: #c2410c; opacity: 0.6; }
.cf-crate { width: 30px; height: 26px; border-radius: 3px; margin: 1px;
  background: repeating-linear-gradient(90deg, var(--cf-p3) 0 7px, #16a34a 7px 9px); border: 2px solid #15803d; }
.cf-pop { animation: cf-pop 0.3s cubic-bezier(.34,1.56,.64,1) both; }
.cf-squish { animation: cf-squish 0.55s cubic-bezier(.34,1.56,.64,1) both; }
.cf-shake { animation: cf-shake 0.4s ease both; }
.cf-dragging { z-index: 10; position: relative; cursor: grabbing !important; transition: none !important; }
.cf-ghost { position: fixed; left: 0; top: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 20; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5)); }
.cf-ghost .cf-item { transform: scale(1.3); }
.cf-drag-source { cursor: grabbing; }

/* Customer */
.cf-customer { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; align-items: center; gap: 2px 10px; }
.cf-avatar { grid-row: 1 / span 2; font-size: 2.6rem; animation: cf-bob 2.4s ease-in-out infinite; }
.cf-name { font-weight: 800; color: var(--cf-muted); font-size: 0.9rem; }
.cf-bubble { background: var(--cf-surface); border: 2px solid var(--cf-line); border-radius: 16px; padding: 6px 14px; }
.cf-order { display: flex; align-items: center; gap: 12px; }
.cf-order-num { font-size: 2.2rem; font-weight: 900; color: var(--cf-p0); }
.cf-dots { display: inline-grid; grid-template-columns: repeat(5, 12px); gap: 4px; }
.cf-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cf-p0); }
.cf-dot-ghost { background: transparent; border: 2px solid var(--cf-p0); }

/* Count view */
.cf-count { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
.cf-count-row { display: flex; align-items: center; justify-content: center; gap: 18px; flex-wrap: wrap; }
.cf-jar { width: 110px; height: 120px; border-radius: 18px 18px 30px 30px; border: 3px solid #94a3b8;
  background: rgba(148, 163, 184, 0.15); cursor: pointer; display: flex; flex-wrap: wrap; align-content: flex-end; justify-content: center;
  gap: 4px; padding: 10px 4px; position: relative; touch-action: none; transition: transform 0.12s ease; }
.cf-jar:active { transform: scale(0.95) rotate(-3deg); }
.cf-jar-lid { position: absolute; top: -10px; left: 14px; right: 14px; height: 12px; border-radius: 6px; background: #94a3b8; }
.cf-bag-area { min-width: 200px; max-width: 320px; min-height: 120px; padding: 10px; border-radius: 18px;
  border: 3px dashed var(--cf-p1); display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 2px; }
.cf-piece { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; background: transparent; padding: 0; cursor: pointer; }
.cf-piece:disabled { cursor: default; }
.cf-counter { font-size: 2.4rem; font-weight: 900; color: var(--cf-p0); min-height: 1.2em; }
.cf-ship { font-size: 1.1rem; padding: 10px 26px; }

/* Compare view */
.cf-compare { display: flex; gap: 22px; justify-content: center; flex-wrap: wrap; width: 100%; }
.cf-jar-big { width: min(42vw, 190px); min-height: 190px; border-radius: 20px 20px 34px 34px; border: 3px solid #94a3b8;
  background: rgba(148, 163, 184, 0.12); color: var(--cf-text); cursor: pointer; position: relative; padding: 18px 8px 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; font: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease; }
.cf-jar-big:hover { border-color: var(--cf-sky); transform: translateY(-3px); }
.cf-jar-contents { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 4px 0; }
.cf-jar-num { font-size: 1.8rem; font-weight: 900; }

/* Pack view */
.cf-pack { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
.cf-tickets { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; }
.cf-ticket { background: #fef3c7; color: #1e293b; border-radius: 6px; padding: 6px 12px; font-weight: 900; font-size: 1.25rem;
  display: flex; gap: 6px; align-items: baseline; box-shadow: 0 2px 0 #d97706; }
.cf-ticket-label { font-size: 0.75rem; font-weight: 700; color: #92400e; }
.cf-plus { font-size: 1.5rem; font-weight: 900; color: var(--cf-muted); }
.cf-belt { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; width: 100%; max-width: 720px;
  padding: 8px; border-radius: 16px; background: repeating-linear-gradient(90deg, #1e293b 0 18px, #243244 18px 36px); }
.cf-col { display: flex; flex-direction: column; align-items: stretch; gap: 6px; min-width: 0; }
.cf-machine-slot { min-height: 58px; display: flex; }
.cf-machine { flex: 1; min-height: 56px; border-radius: 12px; border: 2px solid #64748b; background: #334155; color: var(--cf-text);
  font: inherit; font-weight: 800; cursor: pointer; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 6px; }
.cf-machine-busy { border-color: var(--cf-gold); }
.cf-machine-arrow { font-size: 1.2rem; }
.cf-funnel { position: relative; z-index: 1; }
.cf-funnel-bar { position: absolute; left: 0; bottom: 0; height: 6px; background: var(--cf-gold); transition: width 0.2s ease; }
.cf-bin { min-height: 150px; border-radius: 14px; border: 2px solid var(--cf-line); background: rgba(15, 23, 42, 0.75); color: var(--cf-text);
  display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 6px 2px; cursor: pointer; font: inherit; touch-action: none; }
.cf-bin:disabled { cursor: default; opacity: 1; }
.cf-bin-new { border-color: var(--cf-gold); }
.cf-pile { display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; gap: 3px 0; }
.cf-bin-count { font-size: 1.5rem; font-weight: 900; }
.cf-col-name { text-align: center; font-size: 0.8rem; font-weight: 800; }
.cf-place-0 .cf-col-name, .cf-place-0 .cf-bin-count { color: var(--cf-p0); }
.cf-place-1 .cf-col-name, .cf-place-1 .cf-bin-count { color: var(--cf-p1); }
.cf-place-2 .cf-col-name, .cf-place-2 .cf-bin-count { color: var(--cf-p2); }
.cf-place-3 .cf-col-name, .cf-place-3 .cf-bin-count { color: var(--cf-p3); }
.cf-cols-4 .cf-pile .cf-item, .cf-cols-3 .cf-pile .cf-item { transform: scale(0.75); margin: -2px; }
.cf-cols-4 .cf-candy { margin: -2px 3px; }
@media (max-width: 480px) {
  .cf-bin { min-height: 112px; }
  .cf-machine-slot { min-height: 48px; }
  .cf-machine { min-height: 46px; }
  .cf-belt { gap: 5px; padding: 5px; }
  .cf-written { font-size: 1.6rem; }
}
.cf-label { display: flex; align-items: center; gap: 10px; font-size: 2rem; font-weight: 900; background: #fef3c7; color: #1e293b;
  padding: 6px 18px; border-radius: 10px; min-width: 8ch; justify-content: center; }

/* Keypad */
.cf-keypad { display: grid; grid-template-columns: repeat(6, 52px); gap: 6px; justify-content: center; }
.cf-key { min-height: 52px; border-radius: 12px; border: 1px solid #475569; background: var(--cf-surface); color: var(--cf-text);
  font: inherit; font-size: 1.4rem; font-weight: 800; cursor: pointer; transition: transform 0.1s ease; }
.cf-key:active { transform: scale(0.92); }
.cf-key-check { grid-column: span 2; background: var(--cf-ok); color: var(--cf-bg); font-size: 1rem; }
@media (max-width: 420px) { .cf-keypad { grid-template-columns: repeat(5, 52px); } }

/* Written grid */
.cf-written-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
.cf-written { display: grid; gap: 4px; align-items: center; justify-items: center; font-size: 1.9rem; font-weight: 900; }
.cf-w-op { color: var(--cf-muted); }
.cf-w-cell { min-height: 2.6rem; display: flex; align-items: center; justify-content: center; width: 100%; }
.cf-w-head { font-size: 0.8rem; font-weight: 800; color: var(--cf-muted); }
.cf-w-header.cf-place-0 .cf-w-head, .cf-w-digit.cf-place-0, .cf-w-pick.cf-place-0 { color: var(--cf-p0); }
.cf-w-header.cf-place-1 .cf-w-head, .cf-w-digit.cf-place-1, .cf-w-pick.cf-place-1 { color: var(--cf-p1); }
.cf-w-header.cf-place-2 .cf-w-head, .cf-w-digit.cf-place-2, .cf-w-pick.cf-place-2 { color: var(--cf-p2); }
.cf-w-header.cf-place-3 .cf-w-head, .cf-w-digit.cf-place-3, .cf-w-pick.cf-place-3 { color: var(--cf-p3); }
.cf-w-header.cf-place-4 .cf-w-head, .cf-w-digit.cf-place-4, .cf-w-pick.cf-place-4 { color: var(--cf-p4); }
.cf-w-rule { height: 3px; width: 100%; background: var(--cf-text); border-radius: 2px; }
.cf-w-slot { width: 2.4rem; height: 2.8rem; border-radius: 8px; border: 2px solid var(--cf-line); display: flex; align-items: center; justify-content: center; }
.cf-w-slot.cf-active, .cf-w-pick.cf-active { border-color: var(--cf-gold); color: var(--cf-gold); animation: cf-glow 1.2s ease-in-out infinite; }
.cf-torn { border-style: dashed; }
.cf-carry { width: 2.6rem; height: 2.6rem; min-width: 44px; min-height: 44px; border-radius: 10px; border: 2px dashed #64748b; background: transparent;
  color: var(--cf-gold); font: inherit; font-size: 1.1rem; font-weight: 900; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; gap: 2px; }
.cf-carry:disabled { cursor: default; opacity: 0.6; }
.cf-carry-set { border-style: solid; border-color: var(--cf-gold); opacity: 1 !important; }
.cf-carry.cf-target { border-color: var(--cf-gold); animation: cf-glow 1s ease-in-out infinite; opacity: 1; }
.cf-carry-icon { transform: scale(0.55); margin: -6px; }
.cf-w-pick { min-width: 44px; min-height: 48px; border-radius: 10px; border: 2px solid var(--cf-line); background: var(--cf-surface);
  font: inherit; cursor: pointer; }
.cf-w-pick.cf-wrong { border-color: var(--cf-bad); }
.cf-w-pick:disabled { cursor: default; }
.cf-story { font-size: 2.4rem; }
.cf-robot { animation: cf-bob 1.6s ease-in-out infinite; }
.cf-bill { background: #f8fafc; color: #1e293b; border-radius: 8px; padding: 8px 14px; min-width: 220px; font-weight: 700; }
.cf-bill-title { font-weight: 900; margin-bottom: 4px; }
.cf-bill-line { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px dotted #94a3b8; padding: 2px 0; }
.cf-bill-total { border-bottom: 0; font-weight: 900; }

/* Estimate view */
.cf-estimate { display: flex; flex-direction: column; align-items: center; gap: 18px; width: 100%; }
.cf-trucks { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.cf-truck { min-width: 110px; min-height: 96px; border-radius: 16px; border: 2px solid #475569; background: var(--cf-surface); color: var(--cf-text);
  font: inherit; font-weight: 900; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  transition: transform 0.6s cubic-bezier(.5,-0.3,.7,1), opacity 0.6s ease; }
.cf-truck-icon { font-size: 2rem; transform: scaleX(-1); }
.cf-truck-0 .cf-truck-icon { font-size: 1.6rem; }
.cf-truck-2 .cf-truck-icon { font-size: 2.6rem; }
.cf-truck-go { transform: translateX(60vw); opacity: 0; }

@keyframes cf-pop { from { transform: scale(0.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes cf-squish { 0% { transform: scale(1.6, 0.4); } 45% { transform: scale(0.8, 1.25); } 75% { transform: scale(1.1, 0.92); } 100% { transform: scale(1); } }
@keyframes cf-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@keyframes cf-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.0); } 50% { box-shadow: 0 0 0 5px rgba(251, 191, 36, 0.35); } }
@keyframes cf-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

@media (prefers-reduced-motion: reduce) {
  .cf-root *, .cf-root *::before, .cf-root *::after { animation: none !important; transition: none !important; }
}
`;
