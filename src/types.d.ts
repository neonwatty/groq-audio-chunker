// Type declarations for browser APIs and custom types

// Vendor-prefixed AudioContext for Safari
interface Window {
  webkitAudioContext: typeof AudioContext;
}

// Custom error with status code
interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}
