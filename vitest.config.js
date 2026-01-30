import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for DOM testing without full browser
    environment: 'happy-dom',

    // Global test setup
    globals: true,

    // Include test files
    include: ['tests/**/*.test.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/main.js', // Entry point with side effects
        'src/logger.js', // Simple logging utility
      ],
      thresholds: {
        // Start with lower thresholds, increase as more tests are added
        lines: 25,
        functions: 25,
        branches: 25,
        statements: 25,
      },
    },

    // Mock browser APIs not available in happy-dom
    setupFiles: ['./tests/setup.js'],
  },

  // Resolve aliases matching vite.config.js (if any)
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
