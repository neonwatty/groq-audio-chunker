/**
 * Mock chunk data for testing
 */

/**
 * Create a mock chunk with configurable options
 */
export function createMockChunk(options = {}) {
  const {
    index = 0,
    logicalStart = 0,
    logicalEnd = 600,
    overlapLeading = 0,
    overlapTrailing = 0,
  } = options;

  const start = logicalStart - overlapLeading;
  const end = logicalEnd + overlapTrailing;

  return {
    index,
    logicalStart,
    logicalEnd,
    start,
    end,
    duration: end - start,
    overlap: {
      leading: overlapLeading,
      trailing: overlapTrailing,
      leadingStart: overlapLeading > 0 ? start : null,
      leadingEnd: overlapLeading > 0 ? logicalStart : null,
      trailingStart: overlapTrailing > 0 ? logicalEnd : null,
      trailingEnd: overlapTrailing > 0 ? end : null,
    },
    cutInfo: {
      type: 'silence',
      silence: null,
    },
  };
}

/**
 * Create a set of mock chunks for a given duration
 */
export function createMockChunks(totalDuration, chunkLength = 600, overlap = 10) {
  const chunks = [];
  let position = 0;
  let index = 0;

  while (position < totalDuration) {
    const logicalStart = position;
    const logicalEnd = Math.min(position + chunkLength, totalDuration);
    const isFirst = index === 0;
    const isLast = logicalEnd >= totalDuration;

    chunks.push(createMockChunk({
      index,
      logicalStart,
      logicalEnd,
      overlapLeading: isFirst ? 0 : overlap,
      overlapTrailing: isLast ? 0 : overlap,
    }));

    position = logicalEnd;
    index++;
  }

  return chunks;
}

// Pre-built fixtures
export const singleChunk = createMockChunk({
  index: 0,
  logicalStart: 0,
  logicalEnd: 180, // 3 minutes
  overlapLeading: 0,
  overlapTrailing: 0,
});

export const twoChunksWithOverlap = [
  createMockChunk({
    index: 0,
    logicalStart: 0,
    logicalEnd: 600,
    overlapLeading: 0,
    overlapTrailing: 10,
  }),
  createMockChunk({
    index: 1,
    logicalStart: 600,
    logicalEnd: 1200,
    overlapLeading: 10,
    overlapTrailing: 0,
  }),
];

export const threeChunksWithOverlap = createMockChunks(1800, 600, 10);
