/**
 * Unit tests for groq-client.js error handling and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  ErrorType,
  calculateBackoffDelay,
  RetryConfig,
  validateApiKey,
} from '../../src/groq-client.js';

describe('classifyError', () => {
  describe('Rate limit errors (429)', () => {
    it('should classify 429 as rate_limit and retryable', () => {
      const error = new Error('Rate limit exceeded');
      const result = classifyError(error, 429);

      expect(result.type).toBe(ErrorType.RATE_LIMIT);
      expect(result.retryable).toBe(true);
    });
  });

  describe('Authentication errors (401, 403)', () => {
    it('should classify 401 as auth and not retryable', () => {
      const error = new Error('Unauthorized');
      const result = classifyError(error, 401);

      expect(result.type).toBe(ErrorType.AUTH);
      expect(result.retryable).toBe(false);
    });

    it('should classify 403 as auth and not retryable', () => {
      const error = new Error('Forbidden');
      const result = classifyError(error, 403);

      expect(result.type).toBe(ErrorType.AUTH);
      expect(result.retryable).toBe(false);
    });
  });

  describe('Server errors (5xx)', () => {
    it('should classify 500 as server and retryable', () => {
      const error = new Error('Internal Server Error');
      const result = classifyError(error, 500);

      expect(result.type).toBe(ErrorType.SERVER);
      expect(result.retryable).toBe(true);
    });

    it('should classify 502 as server and retryable', () => {
      const error = new Error('Bad Gateway');
      const result = classifyError(error, 502);

      expect(result.type).toBe(ErrorType.SERVER);
      expect(result.retryable).toBe(true);
    });

    it('should classify 503 as server and retryable', () => {
      const error = new Error('Service Unavailable');
      const result = classifyError(error, 503);

      expect(result.type).toBe(ErrorType.SERVER);
      expect(result.retryable).toBe(true);
    });

    it('should classify 504 as server and retryable', () => {
      const error = new Error('Gateway Timeout');
      const result = classifyError(error, 504);

      expect(result.type).toBe(ErrorType.SERVER);
      expect(result.retryable).toBe(true);
    });
  });

  describe('Timeout errors', () => {
    it('should classify AbortError as timeout and retryable', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      const result = classifyError(error);

      expect(result.type).toBe(ErrorType.TIMEOUT);
      expect(result.retryable).toBe(true);
    });

    it('should classify "timed out" message as timeout', () => {
      const error = new Error('Request timed out');
      const result = classifyError(error);

      expect(result.type).toBe(ErrorType.TIMEOUT);
      expect(result.retryable).toBe(true);
    });
  });

  describe('Network errors', () => {
    it('should classify TypeError with "fetch" as network error', () => {
      const error = new TypeError('Failed to fetch');
      const result = classifyError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.retryable).toBe(true);
    });

    it('should classify NetworkError as network error', () => {
      const error = new Error('NetworkError when attempting to fetch resource');
      const result = classifyError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.retryable).toBe(true);
    });
  });

  describe('Invalid audio errors (400)', () => {
    it('should classify 400 with audio-related message as invalid_audio', () => {
      const error = new Error('Invalid audio format');
      const result = classifyError(error, 400);

      expect(result.type).toBe(ErrorType.INVALID_AUDIO);
      expect(result.retryable).toBe(false);
    });

    it('should classify 400 with file-related message as invalid_audio', () => {
      const error = new Error('Could not process audio file');
      const result = classifyError(error, 400);

      expect(result.type).toBe(ErrorType.INVALID_AUDIO);
      expect(result.retryable).toBe(false);
    });

    it('should classify 400 with generic message as unknown', () => {
      const error = new Error('Bad request');
      const result = classifyError(error, 400);

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.retryable).toBe(false);
    });
  });

  describe('Unknown errors', () => {
    it('should classify unknown status codes as unknown', () => {
      const error = new Error('Something went wrong');
      const result = classifyError(error, 418); // I'm a teapot

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.retryable).toBe(false);
    });

    it('should classify errors without status code as unknown', () => {
      const error = new Error('Generic error');
      const result = classifyError(error);

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.retryable).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      const result = classifyError(null);
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });
  });
});

describe('calculateBackoffDelay', () => {
  const config = RetryConfig;

  it('should return initialDelayMs for attempt 0', () => {
    const delay = calculateBackoffDelay(0, config);
    expect(delay).toBe(1000); // 1 second
  });

  it('should double delay for each attempt', () => {
    expect(calculateBackoffDelay(0, config)).toBe(1000);
    expect(calculateBackoffDelay(1, config)).toBe(2000);
    expect(calculateBackoffDelay(2, config)).toBe(4000);
    expect(calculateBackoffDelay(3, config)).toBe(8000);
    expect(calculateBackoffDelay(4, config)).toBe(16000);
    expect(calculateBackoffDelay(5, config)).toBe(32000);
  });

  it('should cap delay at maxDelayMs', () => {
    // Attempt 6 would be 64000, but should cap at 60000
    expect(calculateBackoffDelay(6, config)).toBe(60000);
    expect(calculateBackoffDelay(10, config)).toBe(60000);
    expect(calculateBackoffDelay(100, config)).toBe(60000);
  });

  it('should use default config when not provided', () => {
    const delay = calculateBackoffDelay(0);
    expect(delay).toBe(1000);
  });

  it('should respect custom config', () => {
    const customConfig = {
      initialDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 3,
    };

    expect(calculateBackoffDelay(0, customConfig)).toBe(500);
    expect(calculateBackoffDelay(1, customConfig)).toBe(1500);
    expect(calculateBackoffDelay(2, customConfig)).toBe(4500);
    expect(calculateBackoffDelay(3, customConfig)).toBe(5000); // Capped
  });
});

describe('validateApiKey', () => {
  it('should reject empty key', () => {
    const result = validateApiKey('');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('required');
  });

  it('should reject null/undefined key', () => {
    expect(validateApiKey(null).valid).toBe(false);
    expect(validateApiKey(undefined).valid).toBe(false);
  });

  it('should reject key without gsk_ prefix', () => {
    const result = validateApiKey('invalid_key_format');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('gsk_');
  });

  it('should reject key that is too short', () => {
    const result = validateApiKey('gsk_short');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('short');
  });

  it('should accept valid key format', () => {
    const result = validateApiKey('gsk_1234567890abcdefghijklmnop');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('should accept key with exactly 20 characters', () => {
    const result = validateApiKey('gsk_1234567890123456');
    expect(result.valid).toBe(true);
  });
});

describe('RetryConfig', () => {
  it('should have expected default values', () => {
    expect(RetryConfig.maxRetries).toBe(5);
    expect(RetryConfig.initialDelayMs).toBe(1000);
    expect(RetryConfig.maxDelayMs).toBe(60000);
    expect(RetryConfig.backoffMultiplier).toBe(2);
  });
});

describe('ErrorType', () => {
  it('should have all expected error types', () => {
    expect(ErrorType.RATE_LIMIT).toBe('rate_limit');
    expect(ErrorType.NETWORK).toBe('network');
    expect(ErrorType.INVALID_AUDIO).toBe('invalid_audio');
    expect(ErrorType.AUTH).toBe('auth');
    expect(ErrorType.SERVER).toBe('server');
    expect(ErrorType.TIMEOUT).toBe('timeout');
    expect(ErrorType.UNKNOWN).toBe('unknown');
  });
});
