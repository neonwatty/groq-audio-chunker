/**
 * Mock API responses for testing
 */

/**
 * Create a successful Groq API response
 */
export function createSuccessResponse(options = {}) {
  const {
    text = 'This is the transcribed text.',
    duration = 10.5,
    language = 'en',
    words = null,
  } = options;

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      text,
      duration,
      language,
      segments: [],
      words: words || [
        { word: 'This', start: 0, end: 0.3 },
        { word: 'is', start: 0.4, end: 0.5 },
        { word: 'the', start: 0.6, end: 0.7 },
        { word: 'transcribed', start: 0.8, end: 1.2 },
        { word: 'text.', start: 1.3, end: 1.6 },
      ],
    }),
    text: async () => JSON.stringify({ text, duration, language }),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(status, message, options = {}) {
  const { statusText = 'Error' } = options;

  return {
    ok: false,
    status,
    statusText,
    json: async () => ({
      error: {
        message,
        type: 'api_error',
        code: status,
      },
    }),
    text: async () => JSON.stringify({
      error: { message },
    }),
  };
}

// Pre-built error responses
export const rateLimitResponse = createErrorResponse(
  429,
  'Rate limit exceeded. Please retry after 60 seconds.',
  { statusText: 'Too Many Requests' }
);

export const authErrorResponse = createErrorResponse(
  401,
  'Invalid API key provided.',
  { statusText: 'Unauthorized' }
);

export const forbiddenResponse = createErrorResponse(
  403,
  'Access denied.',
  { statusText: 'Forbidden' }
);

export const badRequestResponse = createErrorResponse(
  400,
  'Invalid audio format. Please provide a valid audio file.',
  { statusText: 'Bad Request' }
);

export const serverErrorResponse = createErrorResponse(
  500,
  'Internal server error.',
  { statusText: 'Internal Server Error' }
);

export const badGatewayResponse = createErrorResponse(
  502,
  'Bad gateway.',
  { statusText: 'Bad Gateway' }
);

export const serviceUnavailableResponse = createErrorResponse(
  503,
  'Service temporarily unavailable.',
  { statusText: 'Service Unavailable' }
);

export const gatewayTimeoutResponse = createErrorResponse(
  504,
  'Gateway timeout.',
  { statusText: 'Gateway Timeout' }
);

/**
 * Create a mock fetch function that returns the given response
 */
export function createMockFetch(response) {
  return async () => response;
}

/**
 * Create a mock fetch that fails with a network error
 */
export function createNetworkErrorFetch() {
  return async () => {
    throw new TypeError('Failed to fetch');
  };
}

/**
 * Create a mock fetch that times out
 */
export function createTimeoutFetch(delayMs = 5000) {
  return async (url, options) => {
    return new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, delayMs);

      // Listen for abort signal
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }
    });
  };
}

/**
 * Pre-built success response for Groq API
 */
export const groqSuccessResponse = {
  text: 'This is the transcribed text from Groq.',
  duration: 10.5,
  language: 'en',
  segments: [],
  words: [
    { word: 'This', start: 0, end: 0.3 },
    { word: 'is', start: 0.4, end: 0.5 },
    { word: 'the', start: 0.6, end: 0.7 },
    { word: 'transcribed', start: 0.8, end: 1.2 },
    { word: 'text', start: 1.3, end: 1.5 },
    { word: 'from', start: 1.6, end: 1.8 },
    { word: 'Groq.', start: 1.9, end: 2.2 },
  ],
};

// Alias exports for backward compatibility
export const groq429Response = rateLimitResponse;
export const groq401Response = authErrorResponse;
export const groq500Response = serverErrorResponse;
export const createMockApiResponse = createSuccessResponse;
