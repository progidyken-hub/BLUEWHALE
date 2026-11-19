import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/stories/**',
        'src/**/*.stories.{ts,tsx}',
        // Re-export barrel – nothing to cover here
        'src/index.ts',
      ],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        // Branch coverage is harder to reach 95% in UI components because v8
        // counts implicit JS branches (null-coalescing, optional chaining, etc.)
        // 90% is the enforced minimum; actual coverage is currently ~94%.
        branches: 90,
      },
    },
  },
});
