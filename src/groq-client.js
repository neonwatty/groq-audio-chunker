/**
 * Groq API client for Whisper transcription
 */

import { log } from './logger.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Error types for categorizing API failures
 */
export const ErrorType = {
  RATE_LIMIT: 'rate_limit',      // 429 - should retry with backoff
  NETWORK: 'network',            // Connection failed - should retry
  INVALID_AUDIO: 'invalid_audio', // 400 - don't retry, audio is bad
  AUTH: 'auth',                  // 401/403 - stop, check API key
  SERVER: 'server',              // 500/502/503 - should retry
  TIMEOUT: 'timeout',            // Request timed out - should retry
  UNKNOWN: 'unknown'             // Unknown error
};

/**
 * Classify an error and determine if it should be retried
 * @param {Error} error - The error object
 * @param {number} statusCode - HTTP status code (if available)
 * @returns {{type: string, retryable: boolean, message: string}}
 */
/**
 * Retry configuration
 */
export const RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,    // 1 second
  maxDelayMs: 60000,       // 60 seconds cap
  backoffMultiplier: 2     // Double each retry: 1s, 2s, 4s, 8s, 16s, 32s (capped at 60s)
};

/**
 * Calculate delay for retry attempt using exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {object} config - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, config = RetryConfig) {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function classifyError(error, statusCode = null) {
  const errorMessage = error?.message || String(error);

  // Timeout errors
  if (error?.name === 'AbortError' || errorMessage.includes('timed out')) {
    return {
      type: ErrorType.TIMEOUT,
      retryable: true,
      message: 'Request timed out - will retry'
    };
  }

  // Network errors
  if (error?.name === 'TypeError' && errorMessage.includes('fetch')) {
    return {
      type: ErrorType.NETWORK,
      retryable: true,
      message: 'Network error - check your connection'
    };
  }

  if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
    return {
      type: ErrorType.NETWORK,
      retryable: true,
      message: 'Connection failed - will retry'
    };
  }

  // HTTP status code based classification
  if (statusCode) {
    switch (statusCode) {
      case 429:
        return {
          type: ErrorType.RATE_LIMIT,
          retryable: true,
          message: 'Rate limited - waiting before retry'
        };
      case 401:
      case 403:
        return {
          type: ErrorType.AUTH,
          retryable: false,
          message: 'Authentication failed - check your API key'
        };
      case 400:
        // Check if it's specifically about audio format
        if (errorMessage.includes('audio') || errorMessage.includes('format') || errorMessage.includes('file')) {
          return {
            type: ErrorType.INVALID_AUDIO,
            retryable: false,
            message: 'Invalid audio format - cannot process this chunk'
          };
        }
        return {
          type: ErrorType.UNKNOWN,
          retryable: false,
          message: errorMessage
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.SERVER,
          retryable: true,
          message: 'Server error - will retry'
        };
      default:
        return {
          type: ErrorType.UNKNOWN,
          retryable: false,
          message: errorMessage
        };
    }
  }

  // Default: unknown error, don't retry
  return {
    type: ErrorType.UNKNOWN,
    retryable: false,
    message: errorMessage
  };
}

/**
 * Transcribe an audio chunk using Groq's Whisper API
 */
export async function transcribeChunk(audioBlob, apiKey, options = {}) {
  const {
    model = 'whisper-large-v3',
    language = undefined, // Auto-detect if not specified
    responseFormat = 'verbose_json',
    timeout = 120000 // 2 minutes
  } = options;

  // Create form data
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', model);
  formData.append('response_format', responseFormat);

  // Request word-level timestamps for precise deduplication
  formData.append('timestamp_granularities[]', 'word');

  if (language) {
    formData.append('language', language);
  }

  // Make request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to get detailed error info from response
      let errorMessage = `Groq API error: ${response.status} ${response.statusText}`;

      try {
        const errorText = await response.text();
        log(`API Error Response (${response.status}): ${errorText}`, 'error');

        // Try to parse as JSON for structured error
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Not JSON, use raw text if it's informative
          if (errorText && errorText.length < 500) {
            errorMessage = errorText;
          }
        }
      } catch {
        log('Could not read error response body', 'warning');
      }

      // Create error with status code attached
      const error = new Error(errorMessage);
      // @ts-ignore - Custom property for error handling
      error.statusCode = response.status;
      throw error;
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    log(`Transcription completed in ${elapsed}s`, 'success');

    return {
      text: data.text,
      duration: data.duration,
      language: data.language,
      segments: data.segments || [],
      words: data.words || []
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Transcription request timed out');
    }

    throw error;
  }
}

/**
 * Transcribe a chunk with automatic retry and exponential backoff
 * @param {Blob} audioBlob - Audio blob to transcribe
 * @param {string} apiKey - Groq API key
 * @param {object} options - Transcription options
 * @param {object} retryOptions - Retry-specific options
 * @returns {Promise<object>} - Transcription result
 */
export async function transcribeChunkWithRetry(audioBlob, apiKey, options = {}, retryOptions = {}) {
  const {
    onRetry = () => {},
    shouldAbort = () => false,
    config = RetryConfig
  } = retryOptions;

  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Check for abort before each attempt
      if (shouldAbort()) {
        throw new Error('Transcription aborted by user');
      }

      return await transcribeChunk(audioBlob, apiKey, options);
    } catch (error) {
      lastError = error;

      // Classify the error
      const errorInfo = classifyError(error, error.statusCode);

      // Don't retry non-retryable errors
      if (!errorInfo.retryable) {
        log(`Error not retryable (${errorInfo.type}): ${errorInfo.message}`, 'warning');
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        log(`Max retries (${config.maxRetries}) exceeded`, 'error');
        throw error;
      }

      // Check for abort before waiting
      if (shouldAbort()) {
        throw new Error('Transcription aborted by user');
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, config);
      const delaySec = (delay / 1000).toFixed(1);

      log(`Retry ${attempt + 1}/${config.maxRetries} in ${delaySec}s (${errorInfo.type})...`, 'warning');
      onRetry(attempt + 1, config.maxRetries, delay, errorInfo);

      // Wait with abort check
      const startWait = Date.now();
      while (Date.now() - startWait < delay) {
        if (shouldAbort()) {
          throw new Error('Transcription aborted by user');
        }
        await sleep(Math.min(500, delay - (Date.now() - startWait)));
      }
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Unknown error during retry');
}

/**
 * Transcribe multiple chunks sequentially
 */
export async function transcribeChunks(chunks, extractChunkFn, apiKey, options = {}) {
  const {
    onChunkStart = () => {},
    onChunkComplete = () => {},
    onChunkError = () => {},
    onRetry = () => {},
    shouldAbort = () => false,
    retryConfig = RetryConfig,
    delayBetweenChunks = 500 // Small delay to avoid rate limiting
  } = options;

  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    // Check if we should abort before starting each chunk
    if (shouldAbort()) {
      log('Transcription aborted by user', 'warning');
      break;
    }

    const chunk = chunks[i];

    try {
      onChunkStart(chunk, i);

      // Check abort after callback (in case it was set during callback)
      if (shouldAbort()) {
        log('Transcription aborted by user', 'warning');
        break;
      }

      // Extract the chunk blob
      const blob = await extractChunkFn(chunk);

      // Check abort after extraction
      if (shouldAbort()) {
        log('Transcription aborted by user', 'warning');
        break;
      }

      // Transcribe with retry
      const result = await transcribeChunkWithRetry(blob, apiKey, options, {
        onRetry: (attempt, maxRetries, delay, errorInfo) => {
          onRetry(chunk, i, attempt, maxRetries, delay, errorInfo);
        },
        shouldAbort,
        config: retryConfig
      });

      results.push({
        chunk,
        success: true,
        ...result
      });

      onChunkComplete(chunk, i, result);

      // Small delay between chunks
      if (i < chunks.length - 1 && delayBetweenChunks > 0) {
        await new Promise(r => setTimeout(r, delayBetweenChunks));
      }
    } catch (error) {
      log(`Chunk ${i + 1} failed: ${error.message}`, 'error');

      // Attach status code if available
      const enhancedError = error;
      if (!enhancedError.statusCode && error.message) {
        // Try to extract status from error message
        const statusMatch = error.message.match(/(\d{3})/);
        if (statusMatch) {
          enhancedError.statusCode = parseInt(statusMatch[1]);
        }
      }

      results.push({
        chunk,
        success: false,
        error: error.message,
        errorType: classifyError(error, enhancedError.statusCode).type
      });

      onChunkError(chunk, i, enhancedError);

      // If auth error, abort immediately
      const errorInfo = classifyError(error, enhancedError.statusCode);
      if (errorInfo.type === ErrorType.AUTH) {
        break;
      }
    }
  }

  return results;
}

/**
 * Merge transcription results into a single text
 */
export function mergeTranscripts(results) {
  return results
    .filter(r => r.success && r.text)
    .map(r => r.text.trim())
    .join(' ');
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, message: 'API key is required' };
  }

  if (!apiKey.startsWith('gsk_')) {
    return { valid: false, message: 'API key should start with "gsk_"' };
  }

  if (apiKey.length < 20) {
    return { valid: false, message: 'API key appears too short' };
  }

  return { valid: true };
}
