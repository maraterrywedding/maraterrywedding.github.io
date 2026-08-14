import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // The form-serialization tests need a DOM; they opt in per-file with
    // `// @vitest-environment happy-dom`.
    restoreMocks: true,
  },
});
