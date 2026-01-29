/**
 * Groq API client for Whisper transcription
 */

import { log } from './logger.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

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
        log(`Could not read error response body`, 'warning');
      }

      throw new Error(errorMessage);
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
 * Transcribe multiple chunks sequentially
 */
export async function transcribeChunks(chunks, extractChunkFn, apiKey, options = {}) {
  const {
    onChunkStart = () => {},
    onChunkComplete = () => {},
    onChunkError = () => {},
    delayBetweenChunks = 500 // Small delay to avoid rate limiting
  } = options;

  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      onChunkStart(chunk, i);

      // Extract the chunk blob
      const blob = await extractChunkFn(chunk);

      // Transcribe
      const result = await transcribeChunk(blob, apiKey, options);

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

      results.push({
        chunk,
        success: false,
        error: error.message
      });

      onChunkError(chunk, i, error);
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
