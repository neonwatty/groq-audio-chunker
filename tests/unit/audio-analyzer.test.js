/**
 * Unit tests for audio-analyzer.js pure functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatSize,
  findBestCutPoint,
  findSilentRegions,
} from '../../src/audio-analyzer.js';
import {
  emptySilences,
  singleSilence,
  multipleSilences,
  createMockSilence,
} from '../fixtures/index.js';

describe('formatTime', () => {
  it('should format 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('should format seconds under a minute', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(30)).toBe('0:30');
    expect(formatTime(59)).toBe('0:59');
  });

  it('should format minutes and seconds', () => {
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(599)).toBe('9:59');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7325)).toBe('2:02:05');
  });

  it('should handle decimals by rounding down', () => {
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(59.999)).toBe('0:59');
  });

  it('should pad seconds with leading zeros', () => {
    expect(formatTime(61)).toBe('1:01');
    expect(formatTime(3605)).toBe('1:00:05');
  });
});

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(10240)).toBe('10.0 KB');
    expect(formatSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1572864)).toBe('1.5 MB');
    expect(formatSize(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatSize(100 * 1024 * 1024)).toBe('100.0 MB');
  });
});

describe('findBestCutPoint', () => {
  it('should return null for empty silences array', () => {
    expect(findBestCutPoint(emptySilences, 600)).toBeNull();
  });

  it('should return midpoint for single silence', () => {
    const result = findBestCutPoint(singleSilence, 600);
    expect(result).toBe(600); // midpoint of 599.5-600.5
  });

  it('should prefer longer silences', () => {
    const silences = [
      createMockSilence({ start: 599, end: 599.3, duration: 300 }),  // Short
      createMockSilence({ start: 600, end: 601.5, duration: 1500 }), // Long
    ];

    const result = findBestCutPoint(silences, 600);
    // Should pick the longer silence even though the short one is closer
    expect(result).toBe(600.75); // midpoint of 600-601.5
  });

  it('should balance duration and distance from target', () => {
    // Score = duration - (distance * 100)
    // Silence 1: 300 - (0 * 100) = 300
    // Silence 2: 1200 - (3 * 100) = 900 (winner)
    const silences = [
      createMockSilence({ start: 599.8, end: 600.1, duration: 300 }),  // At target
      createMockSilence({ start: 597, end: 598.2, duration: 1200 }),   // 3s away but longer
    ];

    const result = findBestCutPoint(silences, 600);
    expect(result).toBe(597.6); // midpoint of 597-598.2
  });

  it('should prefer closer silence when durations are similar', () => {
    const silences = [
      createMockSilence({ start: 599.5, end: 600.5, duration: 1000 }), // At target
      createMockSilence({ start: 595, end: 596, duration: 1000 }),     // 5s away
    ];

    const result = findBestCutPoint(silences, 600);
    expect(result).toBe(600); // Closer one wins
  });

  it('should handle multiple silences and pick the best', () => {
    const result = findBestCutPoint(multipleSilences, 600);
    // multipleSilences has: 595-595.3 (300ms), 598-599.2 (1200ms), 602-602.5 (500ms)
    // At target 600:
    // - 595.15: score = 300 - (4.85 * 100) = -185
    // - 598.6: score = 1200 - (1.4 * 100) = 1060 (winner)
    // - 602.25: score = 500 - (2.25 * 100) = 275
    expect(result).toBe(598.6); // midpoint of 598-599.2
  });
});

describe('findSilentRegions', () => {
  /**
   * Create a mock AudioBuffer for testing
   */
  function createMockAudioBuffer(samples, sampleRate = 44100) {
    return {
      numberOfChannels: 1,
      sampleRate,
      length: samples.length,
      duration: samples.length / sampleRate,
      getChannelData: () => samples,
    };
  }

  it('should return empty array for all-loud audio', () => {
    // Create 1 second of loud audio (amplitude 0.5)
    const samples = new Float32Array(44100).fill(0.5);
    const buffer = createMockAudioBuffer(samples);

    const silences = findSilentRegions(buffer, 0.01, 300);
    expect(silences).toEqual([]);
  });

  it('should return empty array for all-silent audio below minDuration', () => {
    // Create 100ms of silence (below 300ms threshold)
    const samples = new Float32Array(4410).fill(0);
    const buffer = createMockAudioBuffer(samples);

    const silences = findSilentRegions(buffer, 0.01, 300);
    expect(silences).toEqual([]);
  });

  it('should detect silence meeting minimum duration', () => {
    // Create 500ms of silence (above 300ms threshold)
    const samples = new Float32Array(22050).fill(0);
    const buffer = createMockAudioBuffer(samples);

    const silences = findSilentRegions(buffer, 0.01, 300);
    expect(silences.length).toBe(1);
    expect(silences[0].duration).toBeGreaterThanOrEqual(300);
  });

  it('should detect multiple silence regions', () => {
    // Create: 500ms silence, 500ms loud, 500ms silence
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 1.5);

    // First 500ms: silence
    for (let i = 0; i < sampleRate * 0.5; i++) {
      samples[i] = 0;
    }
    // Middle 500ms: loud
    for (let i = sampleRate * 0.5; i < sampleRate * 1.0; i++) {
      samples[i] = 0.5;
    }
    // Last 500ms: silence
    for (let i = sampleRate * 1.0; i < sampleRate * 1.5; i++) {
      samples[i] = 0;
    }

    const buffer = createMockAudioBuffer(samples, sampleRate);
    const silences = findSilentRegions(buffer, 0.01, 300);

    expect(silences.length).toBe(2);
  });

  it('should respect the threshold parameter', () => {
    // Create audio with low amplitude (0.005) - below 0.01 threshold
    const samples = new Float32Array(44100).fill(0.005);
    const buffer = createMockAudioBuffer(samples);

    // With 0.01 threshold, this should be considered silence
    const silences1 = findSilentRegions(buffer, 0.01, 300);
    expect(silences1.length).toBe(1);

    // With 0.001 threshold, this should NOT be considered silence
    const silences2 = findSilentRegions(buffer, 0.001, 300);
    expect(silences2.length).toBe(0);
  });

  it('should respect minDurationMs parameter', () => {
    // Create 400ms of silence
    const samples = new Float32Array(17640).fill(0);
    const buffer = createMockAudioBuffer(samples);

    // With 300ms minimum, should detect
    const silences1 = findSilentRegions(buffer, 0.01, 300);
    expect(silences1.length).toBe(1);

    // With 500ms minimum, should NOT detect
    const silences2 = findSilentRegions(buffer, 0.01, 500);
    expect(silences2.length).toBe(0);
  });

  it('should return correct start/end/duration values', () => {
    // Create: 200ms loud, 500ms silence, 200ms loud
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 0.9);

    // First 200ms: loud
    for (let i = 0; i < sampleRate * 0.2; i++) {
      samples[i] = 0.5;
    }
    // Middle 500ms: silence
    for (let i = sampleRate * 0.2; i < sampleRate * 0.7; i++) {
      samples[i] = 0;
    }
    // Last 200ms: loud
    for (let i = sampleRate * 0.7; i < sampleRate * 0.9; i++) {
      samples[i] = 0.5;
    }

    const buffer = createMockAudioBuffer(samples, sampleRate);
    const silences = findSilentRegions(buffer, 0.01, 300);

    expect(silences.length).toBe(1);

    const silence = silences[0];
    // Start should be around 200ms
    expect(silence.start).toBeGreaterThanOrEqual(150);
    expect(silence.start).toBeLessThanOrEqual(250);

    // End should be around 700ms
    expect(silence.end).toBeGreaterThanOrEqual(650);
    expect(silence.end).toBeLessThanOrEqual(750);

    // Duration should be around 500ms
    expect(silence.duration).toBeGreaterThanOrEqual(400);
    expect(silence.duration).toBeLessThanOrEqual(600);
  });

  it('should handle silence at the end of audio', () => {
    // Create: 500ms loud, 500ms silence at end
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate);

    // First 500ms: loud
    for (let i = 0; i < sampleRate * 0.5; i++) {
      samples[i] = 0.5;
    }
    // Last 500ms: silence
    for (let i = sampleRate * 0.5; i < sampleRate; i++) {
      samples[i] = 0;
    }

    const buffer = createMockAudioBuffer(samples, sampleRate);
    const silences = findSilentRegions(buffer, 0.01, 300);

    expect(silences.length).toBe(1);
    expect(silences[0].end).toBeCloseTo(1000, -2); // Around 1000ms
  });
});
