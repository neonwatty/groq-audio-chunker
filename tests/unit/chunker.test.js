/**
 * Unit tests for chunker.js utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateChunkSize,
  estimateTotalTranscriptionTime,
} from '../../src/chunker.js';
import {
  createMockChunk,
  createMockChunks,
  singleChunk,
  twoChunksWithOverlap,
} from '../fixtures/index.js';

describe('validateChunkSize', () => {
  /**
   * Create a mock blob with a specific size
   */
  function createMockBlob(sizeBytes) {
    return {
      size: sizeBytes,
      type: 'audio/wav',
    };
  }

  describe('Valid chunks', () => {
    it('should validate chunk under default limit', () => {
      const blob = createMockBlob(10 * 1024 * 1024); // 10MB
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(true);
      expect(result.size).toBeCloseTo(10, 0);
    });

    it('should validate chunk exactly at limit', () => {
      const blob = createMockBlob(25 * 1024 * 1024); // Exactly 25MB
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(true);
    });

    it('should validate small chunks', () => {
      const blob = createMockBlob(1024); // 1KB
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(true);
    });

    it('should validate empty blob', () => {
      const blob = createMockBlob(0);
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(true);
      expect(result.size).toBe(0);
    });
  });

  describe('Invalid chunks', () => {
    it('should reject chunk over default limit', () => {
      const blob = createMockBlob(30 * 1024 * 1024); // 30MB
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(false);
      expect(result.size).toBeCloseTo(30, 0);
      expect(result.message).toContain('30');
      expect(result.message).toContain('25');
    });

    it('should reject chunk slightly over limit', () => {
      const blob = createMockBlob(25.1 * 1024 * 1024); // 25.1MB
      const result = validateChunkSize(blob);

      expect(result.valid).toBe(false);
    });
  });

  describe('Custom limit', () => {
    it('should respect custom maxSizeMB parameter', () => {
      const blob = createMockBlob(15 * 1024 * 1024); // 15MB

      // With default 25MB limit, should be valid
      expect(validateChunkSize(blob).valid).toBe(true);

      // With 10MB limit, should be invalid
      expect(validateChunkSize(blob, 10).valid).toBe(false);

      // With 20MB limit, should be valid
      expect(validateChunkSize(blob, 20).valid).toBe(true);
    });

    it('should include custom limit in error message', () => {
      const blob = createMockBlob(15 * 1024 * 1024);
      const result = validateChunkSize(blob, 10);

      expect(result.message).toContain('10');
    });
  });

  describe('Size calculation', () => {
    it('should return size in MB', () => {
      const blob = createMockBlob(5 * 1024 * 1024);
      const result = validateChunkSize(blob);

      expect(result.size).toBeCloseTo(5, 1);
    });

    it('should handle fractional MB sizes', () => {
      const blob = createMockBlob(2.5 * 1024 * 1024);
      const result = validateChunkSize(blob);

      expect(result.size).toBeCloseTo(2.5, 1);
    });
  });
});

describe('estimateTotalTranscriptionTime', () => {
  it('should return 0 for empty chunks array', () => {
    const result = estimateTotalTranscriptionTime([]);
    expect(result).toBe(0);
  });

  it('should return duration for single chunk', () => {
    const result = estimateTotalTranscriptionTime([singleChunk]);
    expect(result).toBe(singleChunk.duration);
  });

  it('should sum durations for multiple chunks', () => {
    const result = estimateTotalTranscriptionTime(twoChunksWithOverlap);

    const expectedTotal = twoChunksWithOverlap.reduce((sum, c) => sum + c.duration, 0);
    expect(result).toBe(expectedTotal);
  });

  it('should include overlap in total duration', () => {
    // With overlap, total duration > logical duration
    const chunks = createMockChunks(1200, 600, 10); // 20 minutes, 10s overlap
    const result = estimateTotalTranscriptionTime(chunks);

    // Should be more than 1200 due to overlaps
    expect(result).toBeGreaterThan(1200);
  });

  it('should handle chunks with varying durations', () => {
    const chunks = [
      createMockChunk({ logicalStart: 0, logicalEnd: 100 }),
      createMockChunk({ logicalStart: 100, logicalEnd: 300 }),
      createMockChunk({ logicalStart: 300, logicalEnd: 350 }),
    ];

    const result = estimateTotalTranscriptionTime(chunks);

    // Sum of durations: 100 + 200 + 50 = 350
    expect(result).toBe(350);
  });
});

describe('Chunk fixtures', () => {
  describe('createMockChunk', () => {
    it('should create chunk with default values', () => {
      const chunk = createMockChunk();

      expect(chunk.index).toBe(0);
      expect(chunk.logicalStart).toBe(0);
      expect(chunk.logicalEnd).toBe(600);
      expect(chunk.overlap.leading).toBe(0);
      expect(chunk.overlap.trailing).toBe(0);
    });

    it('should create chunk with custom values', () => {
      const chunk = createMockChunk({
        index: 2,
        logicalStart: 1200,
        logicalEnd: 1800,
        overlapLeading: 10,
        overlapTrailing: 10,
      });

      expect(chunk.index).toBe(2);
      expect(chunk.logicalStart).toBe(1200);
      expect(chunk.logicalEnd).toBe(1800);
      expect(chunk.start).toBe(1190); // logicalStart - leading
      expect(chunk.end).toBe(1810); // logicalEnd + trailing
      expect(chunk.duration).toBe(620);
    });

    it('should calculate overlap boundaries correctly', () => {
      const chunk = createMockChunk({
        logicalStart: 600,
        logicalEnd: 1200,
        overlapLeading: 10,
        overlapTrailing: 10,
      });

      expect(chunk.overlap.leadingStart).toBe(590);
      expect(chunk.overlap.leadingEnd).toBe(600);
      expect(chunk.overlap.trailingStart).toBe(1200);
      expect(chunk.overlap.trailingEnd).toBe(1210);
    });
  });

  describe('createMockChunks', () => {
    it('should create correct number of chunks for duration', () => {
      const chunks = createMockChunks(1800, 600, 10); // 30 min, 10 min chunks

      expect(chunks.length).toBe(3);
    });

    it('should have no leading overlap on first chunk', () => {
      const chunks = createMockChunks(1200, 600, 10);

      expect(chunks[0].overlap.leading).toBe(0);
      expect(chunks[0].overlap.trailing).toBe(10);
    });

    it('should have no trailing overlap on last chunk', () => {
      const chunks = createMockChunks(1200, 600, 10);

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.overlap.leading).toBe(10);
      expect(lastChunk.overlap.trailing).toBe(0);
    });

    it('should have both overlaps on middle chunks', () => {
      const chunks = createMockChunks(1800, 600, 10); // Need at least 3 chunks

      const middleChunk = chunks[1];
      expect(middleChunk.overlap.leading).toBe(10);
      expect(middleChunk.overlap.trailing).toBe(10);
    });

    it('should handle single chunk case', () => {
      const chunks = createMockChunks(300, 600, 10); // Less than chunk length

      expect(chunks.length).toBe(1);
      expect(chunks[0].overlap.leading).toBe(0);
      expect(chunks[0].overlap.trailing).toBe(0);
    });
  });
});
