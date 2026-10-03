import { defineConfig } from 'vitest/config';

/** Testes das Security Rules (precisam do Emulator — ver rules-tests/LEIA-ME.md). */
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.rtest.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
