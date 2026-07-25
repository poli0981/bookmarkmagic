import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

/**
 * jsdom, not happy-dom (docs/02 §3). The Netscape parser walk depends on
 * HTML5 "generate implied end tags" — the child <DL> nesting inside an
 * unclosed <DT> — and on `:scope > h3` from an element root. jsdom uses
 * parse5 and is spec-compliant on both; happy-dom is not, so a suite run
 * there would validate a DOM the browser never produces.
 */
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/core/**'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
});
