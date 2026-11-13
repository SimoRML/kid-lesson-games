/**
 * Core procedural audio engine for kid educational games.
 * Generates tactile feedback and UI sounds procedurally using Web Audio API
 * without external audio assets.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.3;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Lazily initializes and resumes the Web Audio AudioContext.
   */
  getContext(): AudioContext | null {
    if (!this.enabled) return null;

    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Plays a customizable tone with envelope.
   */
  playTone(
    frequency: number,
    duration = 0.1,
    type: OscillatorType = 'sine',
    options?: { endFrequency?: number; gain?: number }
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const peakGain = (options?.gain ?? 0.15) * this.volume;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (options?.endFrequency !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), now + duration);
    }

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Crisp UI tap or button click sound.
   */
  playClick() {
    this.playTone(800, 0.04, 'triangle', { endFrequency: 400, gain: 0.12 });
  }

  /**
   * Bubble pop or item select sound (rising pitch ramp).
   */
  playPop() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.15 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Weight landing, block snap, or gravity drop sound.
   */
  playDrop() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Positive step or milestone chime (two ascending harmonious notes).
   */
  playChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      // D5, A5
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  /**
   * Multi-note victory fanfare arpeggio (C5, E5, G5, C6).
   */
  playSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18 * this.volume, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  /**
   * Gentle kid-friendly error buzz for invalid moves.
   */
  playError() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

    gain.gain.setValueAtTime(0.12 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Releases and closes the Web Audio context.
   */
  close() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
