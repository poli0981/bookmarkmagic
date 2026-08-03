import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

/**
 * jsdom, not happy-dom (docs/02 §3). The Netscape parser walk depends on
 * HTML5 "generate implied end tags" — the child <DL> nesting inside an
 * unclosed <DT> — and on `:scope > h3` from an element root. jsdom uses
 * parse5 and is spec-compliant on both; happy-dom is not, so a suite run
 * there would validate a DOM the browser never produces.
 */
export default defineConfig({
  // The svelte plugin is what compiles runes inside `.svelte.ts` store modules;
  // without it they throw "$state is not defined" under vitest.
  plugins: [svelte(), WxtVitest()],
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
