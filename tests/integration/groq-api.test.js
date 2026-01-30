/**
 * Integration tests for Groq API client with mocked fetch
 * Tests full transcription flow, retry logic, and abort handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  transcribeChunk,
  transcribeChunkWithRetry,
  transcribeChunks,
  mergeTranscripts,
  ErrorType,
  RetryConfig,
} from '../../src/groq-client.js';
import { groqSuccessResponse } from '../fixtures/api-responses.js';
import { createMockChunk } from '../fixtures/chunks.js';

// Mock the logger to avoid console output
vi.mock('../../src/logger.js', () => ({
  log: vi.fn(),
}));

/**
 * Create a mock audio blob
 */
function createMockAudioBlob() {
  return new Blob(['mock audio data'], { type: 'audio/wav' });
}

/**
 * Create a mock successful fetch response
 * This mimics what fetch() returns - an object with ok, status, and json() method
 */
function mockFetchSuccess(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

/**
 * Create a mock error fetch response
 */
function mockFetchError(status, statusText, errorData = null) {
  const body = errorData || { error: { message: statusText } };
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('transcribeChunk', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should successfully transcribe audio', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    const result = await transcribeChunk(blob, 'gsk_test_api_key_12345');

    expect(result.text).toBe(groqSuccessResponse.text);
    expect(result.words).toEqual(groqSuccessResponse.words);
    expect(result.duration).toBe(groqSuccessResponse.duration);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('should include authorization header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    await transcribeChunk(blob, 'gsk_my_api_key');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer gsk_my_api_key',
        }),
      })
    );
  });

  it('should include form data with audio file', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    await transcribeChunk(blob, 'gsk_test_key');

    const call = globalThis.fetch.mock.calls[0];
    const formData = call[1].body;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('model')).toBe('whisper-large-v3');
    expect(formData.get('response_format')).toBe('verbose_json');
  });

  it('should throw on 401 authentication error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(401, 'Unauthorized'));

    const blob = createMockAudioBlob();
    await expect(transcribeChunk(blob, 'invalid_key')).rejects.toThrow();
  });

  it('should throw on 429 rate limit error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(429, 'Too Many Requests'));

    const blob = createMockAudioBlob();
    await expect(transcribeChunk(blob, 'gsk_test')).rejects.toThrow();
  });

  it('should throw on 500 server error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockFetchError(500, 'Internal Server Error')
    );

    const blob = createMockAudioBlob();
    await expect(transcribeChunk(blob, 'gsk_test')).rejects.toThrow();
  });

  it('should attach status code to error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(503, 'Service Unavailable'));

    const blob = createMockAudioBlob();
    try {
      await transcribeChunk(blob, 'gsk_test');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.statusCode).toBe(503);
    }
  });

  it('should pass custom language option', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    await transcribeChunk(blob, 'gsk_test', { language: 'es' });

    const call = globalThis.fetch.mock.calls[0];
    const formData = call[1].body;
    expect(formData.get('language')).toBe('es');
  });

  it('should request word-level timestamps', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    await transcribeChunk(blob, 'gsk_test');

    const call = globalThis.fetch.mock.calls[0];
    const formData = call[1].body;
    expect(formData.get('timestamp_granularities[]')).toBe('word');
  });
});

describe('transcribeChunkWithRetry', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Run any remaining timers to complete pending operations
    await vi.runAllTimersAsync();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('should succeed on first attempt without retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const blob = createMockAudioBlob();
    const result = await transcribeChunkWithRetry(blob, 'gsk_test');

    expect(result.text).toBe(groqSuccessResponse.text);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on rate limit (429) and succeed', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(mockFetchError(429, 'Too Many Requests'));
      }
      return Promise.resolve(mockFetchSuccess(groqSuccessResponse));
    });

    const blob = createMockAudioBlob();
    const onRetry = vi.fn();

    const resultPromise = transcribeChunkWithRetry(blob, 'gsk_test', {}, {
      onRetry,
      config: { ...RetryConfig, maxRetries: 5, initialDelayMs: 100, maxDelayMs: 1000 },
    });

    // Advance timers to process all retries
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(200);
    }

    const result = await resultPromise;

    expect(result.text).toBe(groqSuccessResponse.text);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should retry on server error (500) and succeed', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.resolve(mockFetchError(500, 'Internal Server Error'));
      }
      return Promise.resolve(mockFetchSuccess(groqSuccessResponse));
    });

    const blob = createMockAudioBlob();

    const resultPromise = transcribeChunkWithRetry(blob, 'gsk_test', {}, {
      config: { ...RetryConfig, maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000 },
    });

    // Advance timers
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(200);
    }

    const result = await resultPromise;

    expect(result.text).toBe(groqSuccessResponse.text);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on auth error (401)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(401, 'Unauthorized'));

    const blob = createMockAudioBlob();
    const onRetry = vi.fn();

    await expect(
      transcribeChunkWithRetry(blob, 'gsk_test', {}, { onRetry })
    ).rejects.toThrow();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('should NOT retry on invalid audio error (400)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockFetchError(400, 'Bad Request', {
        error: { message: 'Invalid audio format' },
      })
    );

    const blob = createMockAudioBlob();
    const onRetry = vi.fn();

    await expect(
      transcribeChunkWithRetry(blob, 'gsk_test', {}, { onRetry })
    ).rejects.toThrow();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('should fail after max retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(429, 'Too Many Requests'));

    const blob = createMockAudioBlob();
    const onRetry = vi.fn();

    const resultPromise = transcribeChunkWithRetry(blob, 'gsk_test', {}, {
      onRetry,
      config: { ...RetryConfig, maxRetries: 2, initialDelayMs: 100, maxDelayMs: 500 },
    });

    // Attach rejection handler immediately to prevent unhandled rejection warning
    let caughtError = null;
    const handledPromise = resultPromise.catch((err) => {
      caughtError = err;
    });

    // Advance timers to process all retries
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(200);
    }

    await handledPromise;

    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toContain('Too Many Requests');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should abort when shouldAbort returns true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(429, 'Too Many Requests'));

    const blob = createMockAudioBlob();
    let aborted = false;

    const resultPromise = transcribeChunkWithRetry(blob, 'gsk_test', {}, {
      shouldAbort: () => aborted,
      config: { ...RetryConfig, maxRetries: 5, initialDelayMs: 100, maxDelayMs: 500 },
    });

    // Attach rejection handler immediately to prevent unhandled rejection warning
    let caughtError = null;
    const handledPromise = resultPromise.catch((err) => {
      caughtError = err;
    });

    // First attempt fails, then abort before retry
    await vi.advanceTimersByTimeAsync(50);
    aborted = true;
    await vi.advanceTimersByTimeAsync(200);

    await handledPromise;

    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toContain('aborted');
  });

  it('should call onRetry with correct parameters', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(mockFetchError(429, 'Too Many Requests'));
      }
      return Promise.resolve(mockFetchSuccess(groqSuccessResponse));
    });

    const blob = createMockAudioBlob();
    const onRetry = vi.fn();

    const resultPromise = transcribeChunkWithRetry(blob, 'gsk_test', {}, {
      onRetry,
      config: { ...RetryConfig, maxRetries: 5, initialDelayMs: 1000, maxDelayMs: 5000 },
    });

    // Advance timers
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }

    await resultPromise;

    expect(onRetry).toHaveBeenCalledWith(
      1, // attempt
      5, // maxRetries
      1000, // delay
      expect.objectContaining({ type: ErrorType.RATE_LIMIT })
    );
  });
});

describe('transcribeChunks', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Run any remaining timers to complete pending operations
    await vi.runAllTimersAsync();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockExtractChunk = vi.fn(() => Promise.resolve(createMockAudioBlob()));

  it('should transcribe multiple chunks', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1, logicalStart: 600, logicalEnd: 1200 }),
    ];

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      delayBetweenChunks: 0,
    });

    // Advance timers
    await vi.advanceTimersByTimeAsync(1000);

    const results = await resultsPromise;

    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should call onChunkStart for each chunk', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1 }),
    ];
    const onChunkStart = vi.fn();

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      onChunkStart,
      delayBetweenChunks: 0,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await resultsPromise;

    expect(onChunkStart).toHaveBeenCalledTimes(2);
    expect(onChunkStart).toHaveBeenNthCalledWith(1, chunks[0], 0);
    expect(onChunkStart).toHaveBeenNthCalledWith(2, chunks[1], 1);
  });

  it('should call onChunkComplete for successful chunks', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const chunks = [createMockChunk({ index: 0 })];
    const onChunkComplete = vi.fn();

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      onChunkComplete,
      delayBetweenChunks: 0,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await resultsPromise;

    expect(onChunkComplete).toHaveBeenCalledWith(
      chunks[0],
      0,
      expect.objectContaining({ text: groqSuccessResponse.text })
    );
  });

  it('should call onChunkError for failed chunks', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchError(400, 'Invalid audio'));

    const chunks = [createMockChunk({ index: 0 })];
    const onChunkError = vi.fn();

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      onChunkError,
      delayBetweenChunks: 0,
      retryConfig: { ...RetryConfig, maxRetries: 0 },
    });

    await vi.advanceTimersByTimeAsync(1000);
    await resultsPromise;

    expect(onChunkError).toHaveBeenCalledWith(
      chunks[0],
      0,
      expect.any(Error)
    );
  });

  it('should abort when shouldAbort returns true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1 }),
      createMockChunk({ index: 2 }),
    ];

    let processedCount = 0;
    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      shouldAbort: () => processedCount >= 1,
      onChunkComplete: () => processedCount++,
      delayBetweenChunks: 0,
    });

    await vi.advanceTimersByTimeAsync(2000);
    const results = await resultsPromise;

    // Only first chunk should complete
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
  });

  it('should abort immediately on auth error', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve(mockFetchError(401, 'Unauthorized'));
      }
      return Promise.resolve(mockFetchSuccess(groqSuccessResponse));
    });

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1 }),
      createMockChunk({ index: 2 }),
    ];

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      delayBetweenChunks: 0,
      retryConfig: { ...RetryConfig, maxRetries: 0 },
    });

    await vi.advanceTimersByTimeAsync(2000);
    const results = await resultsPromise;

    // Should stop after auth error (chunk 2 not processed)
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].errorType).toBe(ErrorType.AUTH);
  });

  it('should continue after non-auth failures', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // Server error - not auth, should continue
        return Promise.resolve(mockFetchError(500, 'Server Error'));
      }
      return Promise.resolve(mockFetchSuccess(groqSuccessResponse));
    });

    const chunks = [
      createMockChunk({ index: 0 }),
      createMockChunk({ index: 1 }),
      createMockChunk({ index: 2 }),
    ];

    const resultsPromise = transcribeChunks(chunks, mockExtractChunk, 'gsk_test', {
      delayBetweenChunks: 0,
      retryConfig: { ...RetryConfig, maxRetries: 0 },
    });

    await vi.advanceTimersByTimeAsync(2000);
    const results = await resultsPromise;

    // Should process all 3 chunks
    expect(results.length).toBe(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  it('should include chunk data in results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchSuccess(groqSuccessResponse));

    const chunk = createMockChunk({ index: 0, logicalStart: 100, logicalEnd: 700 });

    const resultsPromise = transcribeChunks([chunk], mockExtractChunk, 'gsk_test', {
      delayBetweenChunks: 0,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const results = await resultsPromise;

    expect(results[0].chunk).toBe(chunk);
    expect(results[0].chunk.logicalStart).toBe(100);
  });
});

describe('mergeTranscripts', () => {
  it('should merge successful results', () => {
    const results = [
      { success: true, text: 'First chunk.' },
      { success: true, text: 'Second chunk.' },
      { success: true, text: 'Third chunk.' },
    ];

    const merged = mergeTranscripts(results);

    expect(merged).toBe('First chunk. Second chunk. Third chunk.');
  });

  it('should skip failed results', () => {
    const results = [
      { success: true, text: 'First chunk.' },
      { success: false, error: 'Failed' },
      { success: true, text: 'Third chunk.' },
    ];

    const merged = mergeTranscripts(results);

    expect(merged).toBe('First chunk. Third chunk.');
  });

  it('should return empty string for all failures', () => {
    const results = [
      { success: false, error: 'Failed 1' },
      { success: false, error: 'Failed 2' },
    ];

    const merged = mergeTranscripts(results);

    expect(merged).toBe('');
  });

  it('should return empty string for empty array', () => {
    const merged = mergeTranscripts([]);

    expect(merged).toBe('');
  });

  it('should skip results with empty text', () => {
    const results = [
      { success: true, text: 'Hello' },
      { success: true, text: '' },
      { success: true, text: null },
      { success: true, text: 'World' },
    ];

    const merged = mergeTranscripts(results);

    expect(merged).toBe('Hello World');
  });

  it('should trim whitespace from texts', () => {
    const results = [
      { success: true, text: '  First.  ' },
      { success: true, text: '\n\nSecond.\n' },
    ];

    const merged = mergeTranscripts(results);

    expect(merged).toBe('First. Second.');
  });
});
