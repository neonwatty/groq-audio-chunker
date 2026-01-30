/**
 * Smoke test to verify Vitest setup is working
 */

import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to DOM APIs via happy-dom', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello';
    expect(div.textContent).toBe('Hello');
  });

  it('should have mocked AudioContext', () => {
    expect(AudioContext).toBeDefined();
    const ctx = new AudioContext();
    expect(ctx.sampleRate).toBe(44100);
  });

  it('should have mocked URL methods', () => {
    expect(URL.createObjectURL).toBeDefined();
    expect(URL.revokeObjectURL).toBeDefined();
  });

  it('should have mocked Audio element', () => {
    expect(Audio).toBeDefined();
    const audio = new Audio();
    expect(audio.duration).toBe(180);
  });
});
