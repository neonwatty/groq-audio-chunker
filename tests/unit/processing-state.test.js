/**
 * Unit tests for processing state management
 *
 * Since processingState is defined in main.js and not exported,
 * we test it by creating a similar standalone implementation
 * that mirrors the expected behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Processing state factory - mirrors the implementation in main.js
 * This allows us to test the state management logic in isolation
 */
function createProcessingState() {
  return {
    isProcessing: false,
    isAborted: false,
    currentChunkIndex: -1,
    failedChunks: [],

    reset() {
      this.isProcessing = false;
      this.isAborted = false;
      this.currentChunkIndex = -1;
      this.failedChunks = [];
    },

    start() {
      this.reset();
      this.isProcessing = true;
    },

    abort() {
      this.isAborted = true;
      this.isProcessing = false;
    },

    complete() {
      this.isProcessing = false;
    },

    addFailedChunk(index, error, errorType, chunk) {
      this.failedChunks.push({ index, error, errorType, chunk });
    },
  };
}

describe('processingState', () => {
  let state;

  beforeEach(() => {
    state = createProcessingState();
  });

  describe('Initial state', () => {
    it('should have isProcessing false initially', () => {
      expect(state.isProcessing).toBe(false);
    });

    it('should have isAborted false initially', () => {
      expect(state.isAborted).toBe(false);
    });

    it('should have currentChunkIndex as -1 initially', () => {
      expect(state.currentChunkIndex).toBe(-1);
    });

    it('should have empty failedChunks array initially', () => {
      expect(state.failedChunks).toEqual([]);
    });
  });

  describe('reset()', () => {
    it('should reset all state to initial values', () => {
      // Set some values
      state.isProcessing = true;
      state.isAborted = true;
      state.currentChunkIndex = 5;
      state.failedChunks = [{ index: 0, error: 'test' }];

      state.reset();

      expect(state.isProcessing).toBe(false);
      expect(state.isAborted).toBe(false);
      expect(state.currentChunkIndex).toBe(-1);
      expect(state.failedChunks).toEqual([]);
    });
  });

  describe('start()', () => {
    it('should set isProcessing to true', () => {
      state.start();
      expect(state.isProcessing).toBe(true);
    });

    it('should reset isAborted to false', () => {
      state.isAborted = true;
      state.start();
      expect(state.isAborted).toBe(false);
    });

    it('should clear failedChunks', () => {
      state.failedChunks = [{ index: 0 }];
      state.start();
      expect(state.failedChunks).toEqual([]);
    });

    it('should reset currentChunkIndex', () => {
      state.currentChunkIndex = 5;
      state.start();
      expect(state.currentChunkIndex).toBe(-1);
    });
  });

  describe('abort()', () => {
    it('should set isAborted to true', () => {
      state.start();
      state.abort();
      expect(state.isAborted).toBe(true);
    });

    it('should set isProcessing to false', () => {
      state.start();
      state.abort();
      expect(state.isProcessing).toBe(false);
    });

    it('should preserve failedChunks', () => {
      state.start();
      state.addFailedChunk(0, 'error', 'network', {});
      state.abort();
      expect(state.failedChunks.length).toBe(1);
    });
  });

  describe('complete()', () => {
    it('should set isProcessing to false', () => {
      state.start();
      state.complete();
      expect(state.isProcessing).toBe(false);
    });

    it('should preserve isAborted state', () => {
      state.start();
      state.isAborted = true;
      state.complete();
      expect(state.isAborted).toBe(true);
    });

    it('should preserve failedChunks', () => {
      state.start();
      state.addFailedChunk(0, 'error', 'network', {});
      state.complete();
      expect(state.failedChunks.length).toBe(1);
    });
  });

  describe('addFailedChunk()', () => {
    it('should add failed chunk to array', () => {
      const chunk = { index: 0, start: 0, end: 600 };
      state.addFailedChunk(0, 'Rate limit exceeded', 'rate_limit', chunk);

      expect(state.failedChunks.length).toBe(1);
      expect(state.failedChunks[0]).toEqual({
        index: 0,
        error: 'Rate limit exceeded',
        errorType: 'rate_limit',
        chunk,
      });
    });

    it('should append multiple failed chunks', () => {
      state.addFailedChunk(0, 'Error 1', 'network', {});
      state.addFailedChunk(2, 'Error 2', 'server', {});
      state.addFailedChunk(5, 'Error 3', 'timeout', {});

      expect(state.failedChunks.length).toBe(3);
      expect(state.failedChunks[0].index).toBe(0);
      expect(state.failedChunks[1].index).toBe(2);
      expect(state.failedChunks[2].index).toBe(5);
    });

    it('should preserve error type for retry logic', () => {
      state.addFailedChunk(0, 'Auth failed', 'auth', {});

      expect(state.failedChunks[0].errorType).toBe('auth');
    });
  });

  describe('State transitions', () => {
    it('should handle full workflow: start -> process -> complete', () => {
      // Start processing
      state.start();
      expect(state.isProcessing).toBe(true);
      expect(state.isAborted).toBe(false);

      // Process chunks
      state.currentChunkIndex = 0;
      state.currentChunkIndex = 1;
      state.currentChunkIndex = 2;

      // Complete
      state.complete();
      expect(state.isProcessing).toBe(false);
      expect(state.isAborted).toBe(false);
    });

    it('should handle workflow with abort: start -> abort', () => {
      state.start();
      state.currentChunkIndex = 1;

      state.abort();

      expect(state.isProcessing).toBe(false);
      expect(state.isAborted).toBe(true);
      expect(state.currentChunkIndex).toBe(1); // Preserved for reference
    });

    it('should handle workflow with failures: start -> failures -> complete', () => {
      state.start();

      state.currentChunkIndex = 0;
      // Chunk 0 succeeds

      state.currentChunkIndex = 1;
      state.addFailedChunk(1, 'Network error', 'network', { index: 1 });

      state.currentChunkIndex = 2;
      // Chunk 2 succeeds

      state.complete();

      expect(state.isProcessing).toBe(false);
      expect(state.failedChunks.length).toBe(1);
      expect(state.failedChunks[0].index).toBe(1);
    });

    it('should handle restart after completion', () => {
      // First run
      state.start();
      state.addFailedChunk(0, 'Error', 'network', {});
      state.complete();

      // Second run (retry)
      state.start();

      expect(state.isProcessing).toBe(true);
      expect(state.failedChunks).toEqual([]); // Cleared on start
    });

    it('should handle restart after abort', () => {
      // First run - aborted
      state.start();
      state.currentChunkIndex = 2;
      state.abort();

      // Second run
      state.start();

      expect(state.isProcessing).toBe(true);
      expect(state.isAborted).toBe(false);
      expect(state.currentChunkIndex).toBe(-1);
    });
  });

  describe('Abort checking pattern', () => {
    it('should support abort check pattern used in transcription loop', () => {
      state.start();

      // Simulate transcription loop checking abort flag
      const shouldContinue = () => !state.isAborted;

      expect(shouldContinue()).toBe(true);

      // User clicks cancel
      state.abort();

      expect(shouldContinue()).toBe(false);
    });
  });
});
