import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sound } from './audio.js';

describe('SoundFx Audio Synthesizer', () => {
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

  it('plays procedural sounds when enabled', () => {
    sound.enabled = true;

    sound.playPop();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();

    sound.playDrop();
    expect(mockAudioContext.createGain).toHaveBeenCalled();

    sound.playSuccess();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(6); // 1 + 1 + 4
  });

  it('does not play sounds when disabled', () => {
    sound.enabled = false;
    sound.close();

    sound.playPop();
    sound.playDrop();
    sound.playSuccess();

    expect(sound.enabled).toBe(false);
  });

  it('resumes suspended audio context and closes cleanly', () => {
    mockAudioContext.state = 'suspended';
    sound.enabled = true;

    sound.playPop();
    expect(mockAudioContext.resume).toHaveBeenCalled();

    sound.close();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });
});
