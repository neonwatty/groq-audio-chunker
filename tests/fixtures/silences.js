/**
 * Mock silence data for testing
 */

/**
 * Create a mock silence region
 */
export function createMockSilence(options = {}) {
  const {
    start = 0,
    end = 0.5,
    duration = null,
  } = options;

  const calculatedDuration = duration !== null ? duration : (end - start) * 1000;

  return {
    start,
    end,
    duration: calculatedDuration,
    midpoint: (start + end) / 2,
  };
}

/**
 * Create multiple silence regions around a target time
 */
export function createSilencesAroundTarget(targetTime, count = 3) {
  const silences = [];

  for (let i = 0; i < count; i++) {
    const offset = (i - Math.floor(count / 2)) * 2; // -4, -2, 0, 2, 4 for count=5
    const start = targetTime + offset;
    const duration = 300 + i * 100; // Varying durations

    silences.push(createMockSilence({
      start,
      end: start + duration / 1000,
      duration,
    }));
  }

  return silences;
}

// Pre-built fixtures
export const emptySilences = [];

export const singleSilence = [
  createMockSilence({
    start: 599.5,
    end: 600.5,
    duration: 1000, // 1 second
  }),
];

export const multipleSilences = [
  createMockSilence({
    start: 595,
    end: 595.3,
    duration: 300, // Short silence
  }),
  createMockSilence({
    start: 598,
    end: 599.2,
    duration: 1200, // Longer silence (preferred)
  }),
  createMockSilence({
    start: 602,
    end: 602.5,
    duration: 500, // Medium silence but further from target
  }),
];

export const silenceAtTarget = [
  createMockSilence({
    start: 599.8,
    end: 600.2,
    duration: 400,
  }),
];
