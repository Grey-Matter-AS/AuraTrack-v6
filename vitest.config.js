import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic and the Dexie data layer (fake IndexedDB, no browser)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    setupFiles: ['./src/test/setup.js'],
  },
});
