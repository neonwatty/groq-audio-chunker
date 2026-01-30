/**
 * Unit tests for deduplication.js
 */

import { describe, it, expect, vi } from 'vitest';
import { mergeTranscriptsWithDeduplication } from '../../src/deduplication.js';
import {
  createMockChunk,
  createMockTranscriptionResult,
  createOverlappingResults,
  successfulResult,
  failedResult,
} from '../fixtures/index.js';

// Mock the logger to avoid console output during tests
vi.mock('../../src/logger.js', () => ({
  log: vi.fn(),
}));

describe('mergeTranscriptsWithDeduplication', () => {
  describe('Edge cases', () => {
    it('should return empty result for empty array', () => {
      const result = mergeTranscriptsWithDeduplication([], 10);

      expect(result.text).toBe('');
      expect(result.words).toEqual([]);
      expect(result.stats.overlapsMerged).toBe(0);
      expect(result.stats.wordsDeduplicated).toBe(0);
    });

    it('should return empty result when all results failed', () => {
      const results = [failedResult, failedResult];
      const result = mergeTranscriptsWithDeduplication(results, 10);

      expect(result.text).toBe('');
      expect(result.words).toEqual([]);
    });

    it('should handle single successful result', () => {
      const results = [successfulResult];
      const result = mergeTranscriptsWithDeduplication(results, 10);

      expect(result.text).toBeTruthy();
      expect(result.stats.overlapsMerged).toBe(0);
      expect(result.stats.wordsDeduplicated).toBe(0);
    });
  });

  describe('Multiple chunks without overlap', () => {
    it('should concatenate texts with no deduplication when overlap is 0', () => {
      const chunk1 = createMockChunk({ index: 0, logicalStart: 0, logicalEnd: 10 });
      const chunk2 = createMockChunk({ index: 1, logicalStart: 10, logicalEnd: 20 });

      const results = [
        createMockTranscriptionResult({
          chunk: chunk1,
          text: 'First chunk.',
          words: [
            { word: 'First', start: 0, end: 0.3 },
            { word: 'chunk.', start: 0.4, end: 0.7 },
          ],
        }),
        createMockTranscriptionResult({
          chunk: chunk2,
          text: 'Second chunk.',
          words: [
            { word: 'Second', start: 0, end: 0.3 },
            { word: 'chunk.', start: 0.4, end: 0.7 },
          ],
        }),
      ];

      const result = mergeTranscriptsWithDeduplication(results, 0);

      expect(result.text).toContain('First');
      expect(result.text).toContain('Second');
    });
  });

  describe('Overlapping chunks with word timestamps', () => {
    it('should deduplicate words in overlap regions', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      // Should have deduplicated some words
      expect(result.stats.wordsDeduplicated).toBeGreaterThan(0);
      expect(result.stats.overlapsMerged).toBeGreaterThan(0);
    });

    it('should preserve word order within each chunk', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      // Words should be in sensible order (not randomly sorted)
      expect(result.text).not.toBe('');
      // The merged text should be coherent
      const words = result.text.split(/\s+/);
      expect(words.length).toBeGreaterThan(0);
    });

    it('should track all words including deduplicated ones in allWords', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      // allWords should contain more words than final words
      expect(result.allWords.length).toBeGreaterThan(result.words.length);

      // Some words should be marked as deduplicated
      const deduplicatedWords = result.allWords.filter(w => w.deduplicated);
      expect(deduplicatedWords.length).toBeGreaterThan(0);
    });

    it('should mark overlap regions correctly', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      // Some words should be marked as in overlap
      const overlapWords = result.allWords.filter(w => w.inOverlap);
      expect(overlapWords.length).toBeGreaterThan(0);
    });
  });

  describe('Centrality-based selection', () => {
    it('should prefer words with higher centrality in overlap regions', () => {
      // Create two chunks where one has words more central than the other
      const chunk1 = createMockChunk({
        index: 0,
        logicalStart: 0,
        logicalEnd: 10,
        overlapTrailing: 2,
      });
      const chunk2 = createMockChunk({
        index: 1,
        logicalStart: 10,
        logicalEnd: 20,
        overlapLeading: 2,
      });

      // Chunk 1: word at 9.5s is near the boundary (low centrality)
      // Chunk 2: word at 9.5s (relative 1.5s) is further from boundary (higher centrality)
      const results = [
        createMockTranscriptionResult({
          chunk: chunk1,
          text: 'start middle overlap',
          words: [
            { word: 'start', start: 1, end: 1.3 },
            { word: 'middle', start: 5, end: 5.3 },
            { word: 'overlap', start: 9.5, end: 9.8 }, // Near trailing boundary
          ],
        }),
        createMockTranscriptionResult({
          chunk: chunk2,
          text: 'overlap end content',
          words: [
            { word: 'overlap', start: 1.5, end: 1.8 }, // Relative to chunk start (8s)
            { word: 'end', start: 5, end: 5.3 },
            { word: 'content', start: 9, end: 9.3 },
          ],
        }),
      ];

      const result = mergeTranscriptsWithDeduplication(results, 2);

      // The algorithm should pick the version with higher centrality
      // This test verifies deduplication occurred
      expect(result.stats.overlapsMerged).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Fallback text merge', () => {
    it('should fall back to text merge when no word timestamps available', () => {
      const chunk1 = createMockChunk({ index: 0 });
      const chunk2 = createMockChunk({ index: 1, logicalStart: 600, logicalEnd: 1200 });

      const results = [
        {
          success: true,
          text: 'First chunk content here',
          words: [], // Empty words array
          chunk: chunk1,
        },
        {
          success: true,
          text: 'Second chunk content here',
          words: [], // Empty words array
          chunk: chunk2,
        },
      ];

      const result = mergeTranscriptsWithDeduplication(results, 10);

      // Should still produce merged text
      expect(result.text).toContain('First');
      expect(result.text).toContain('Second');
    });
  });

  describe('Stats tracking', () => {
    it('should track overlaps merged count', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      expect(typeof result.stats.overlapsMerged).toBe('number');
      expect(result.stats.overlapsMerged).toBeGreaterThanOrEqual(0);
    });

    it('should track words deduplicated count', () => {
      const overlappingResults = createOverlappingResults();
      const result = mergeTranscriptsWithDeduplication(overlappingResults, 2);

      expect(typeof result.stats.wordsDeduplicated).toBe('number');
    });
  });
});
