/**
 * Vitest global setup file
 * Mocks browser APIs not available in happy-dom
 */

import { vi } from 'vitest';

// Mock AudioContext (not fully supported in happy-dom)
class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.state = 'running';
  }

  async decodeAudioData(_arrayBuffer) {
    // Return a mock AudioBuffer
    return {
      duration: 180, // 3 minutes default
      numberOfChannels: 2,
      sampleRate: 44100,
      length: 180 * 44100,
      getChannelData: (_channel) => new Float32Array(180 * 44100),
    };
  }

  createBuffer(channels, length, sampleRate) {
    const channelData = [];
    for (let i = 0; i < channels; i++) {
      channelData.push(new Float32Array(length));
    }
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel) => channelData[channel],
    };
  }

  async close() {
    this.state = 'closed';
  }
}

// Set up global mocks
globalThis.AudioContext = MockAudioContext;
globalThis.webkitAudioContext = MockAudioContext;

// Mock URL.createObjectURL and URL.revokeObjectURL
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = vi.fn();
}

// Mock fetch if not available
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn();
}

// Mock Audio element
class MockAudio {
  constructor() {
    this.src = '';
    this.preload = '';
    this.duration = 180;
    this._listeners = {};
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }
  }

  // Simulate loading metadata
  set src(value) {
    this._src = value;
    // Trigger loadedmetadata after a tick
    setTimeout(() => {
      if (this._listeners.loadedmetadata) {
        this._listeners.loadedmetadata.forEach(h => h());
      }
    }, 0);
  }

  get src() {
    return this._src;
  }
}

globalThis.Audio = MockAudio;

// Console log grouping for cleaner test output
beforeEach(() => {
  // Suppress console.log during tests unless DEBUG=true
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});
