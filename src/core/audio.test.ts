import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from './audio.js';

describe('SoundEngine Core Utility', () => {
  let mockOscillator: any;
  let mockGain: any;
  let mockAudioContext: any;

  beforeEach(() => {
    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };

    (globalThis as any).AudioContext = vi.fn().mockReturnValue(mockAudioContext);
  });

  it('initializes with default enabled state and volume', () => {
    const engine = new SoundEngine();
    expect(engine.enabled).toBe(true);
    expect(engine.volume).toBe(0.3);
  });

  it('synthesizes procedural sounds when enabled', () => {
    const engine = new SoundEngine(true);

    engine.playClick();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();

    engine.playPop();
    expect(mockOscillator.start).toHaveBeenCalled();

    engine.playDrop();
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalled();

    engine.playChime();
    engine.playError();
    engine.playSuccess();

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
  });

  it('plays nothing when disabled', () => {
    const engine = new SoundEngine(false);

    engine.playPop();
    engine.playDrop();
    engine.playClick();
    engine.playSuccess();

    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    expect(engine.getContext()).toBeNull();
  });

  it('resumes suspended audio context automatically', () => {
    mockAudioContext.state = 'suspended';
    const engine = new SoundEngine(true);

    engine.playPop();
    expect(mockAudioContext.resume).toHaveBeenCalled();

    engine.close();
    expect(mockAudioContext.close).toHaveBeenCalled();

    engine.enabled = false;
    expect(engine.getContext()).toBeNull();
  });

  it('supports custom playTone synthesis', () => {
    const engine = new SoundEngine(true);
    engine.playTone(440, 0.2, 'triangle', { endFrequency: 880, gain: 0.5 });

    expect(mockOscillator.type).toBe('triangle');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10);
    expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(880, 10.2);
  });
});
