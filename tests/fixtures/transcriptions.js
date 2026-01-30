/**
 * Mock transcription results for testing
 */

import { createMockChunk } from './chunks.js';

/**
 * Create a mock word with timestamps
 */
export function createMockWord(word, start, end) {
  return {
    word,
    start,
    end,
  };
}

/**
 * Create a mock transcription result
 */
export function createMockTranscriptionResult(options = {}) {
  const {
    success = true,
    text = 'This is a test transcription.',
    words = null,
    chunk = createMockChunk(),
    error = null,
    duration = 10,
    language = 'en',
  } = options;

  if (success) {
    return {
      success: true,
      text,
      words: words || generateWordsFromText(text, chunk.start),
      chunk,
      duration,
      language,
      segments: [],
    };
  }

  return {
    success: false,
    error: error || 'Transcription failed',
    chunk,
  };
}

/**
 * Generate word-level timestamps from text
 * Assumes ~0.3 seconds per word
 */
export function generateWordsFromText(text, _startOffset = 0) {
  const wordStrings = text.split(/\s+/).filter(w => w.length > 0);
  const words = [];
  let currentTime = 0;

  for (const word of wordStrings) {
    const duration = 0.3;
    words.push({
      word,
      start: currentTime,
      end: currentTime + duration,
    });
    currentTime += duration + 0.1; // 0.1s gap between words
  }

  return words;
}

/**
 * Create overlapping transcription results for deduplication testing
 */
export function createOverlappingResults() {
  const chunk1 = createMockChunk({
    index: 0,
    logicalStart: 0,
    logicalEnd: 10,
    overlapLeading: 0,
    overlapTrailing: 2,
  });

  const chunk2 = createMockChunk({
    index: 1,
    logicalStart: 10,
    logicalEnd: 20,
    overlapLeading: 2,
    overlapTrailing: 0,
  });

  // Chunk 1: words from 0-12 (logical 0-10 + 2s trailing overlap)
  const words1 = [
    createMockWord('Hello', 0, 0.3),
    createMockWord('world', 0.5, 0.8),
    createMockWord('this', 1.0, 1.3),
    createMockWord('is', 1.5, 1.7),
    createMockWord('chunk', 2.0, 2.3),
    createMockWord('one', 2.5, 2.8),
    createMockWord('with', 8.0, 8.3),    // Near boundary
    createMockWord('overlap', 8.5, 8.8), // Near boundary
    createMockWord('words', 9.0, 9.3),   // In overlap region
    createMockWord('here', 9.5, 9.8),    // In overlap region
    createMockWord('test', 10.0, 10.3),  // In overlap region (past logical end)
    createMockWord('more', 10.5, 10.8),  // In overlap region
  ];

  // Chunk 2: words from 8-20 (logical 10-20 with 2s leading overlap starting at 8)
  const words2 = [
    createMockWord('words', 1.0, 1.3),   // Actually at 9.0 absolute (in overlap)
    createMockWord('here', 1.5, 1.8),    // Actually at 9.5 absolute (in overlap)
    createMockWord('test', 2.0, 2.3),    // Actually at 10.0 absolute (in overlap)
    createMockWord('more', 2.5, 2.8),    // Actually at 10.5 absolute (in overlap)
    createMockWord('content', 3.0, 3.3), // Actually at 11.0 absolute (after overlap)
    createMockWord('from', 4.0, 4.3),
    createMockWord('chunk', 5.0, 5.3),
    createMockWord('two', 6.0, 6.3),
  ];

  return [
    createMockTranscriptionResult({
      chunk: chunk1,
      text: 'Hello world this is chunk one with overlap words here test more',
      words: words1,
    }),
    createMockTranscriptionResult({
      chunk: chunk2,
      text: 'words here test more content from chunk two',
      words: words2,
    }),
  ];
}

// Pre-built fixtures
export const successfulResult = createMockTranscriptionResult();

export const failedResult = createMockTranscriptionResult({
  success: false,
  error: 'API rate limit exceeded',
});

export const resultWithoutWords = createMockTranscriptionResult({
  words: [], // Empty words array
});

export const multipleSuccessfulResults = [
  createMockTranscriptionResult({
    chunk: createMockChunk({ index: 0 }),
    text: 'First chunk content.',
  }),
  createMockTranscriptionResult({
    chunk: createMockChunk({ index: 1, logicalStart: 600, logicalEnd: 1200 }),
    text: 'Second chunk content.',
  }),
];
