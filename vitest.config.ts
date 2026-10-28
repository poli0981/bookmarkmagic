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
      // Every TypeScript module is MEASURED, so SonarCloud sees real numbers
      // for the browser layer, stores and edit logic too (docs/12 §2.5).
      // Components and entrypoints are excluded on Sonar's side, matching the
      // docs/11 §1 split: they are covered by the manual QA pass.
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
      // Only core is GATED, and with a glob threshold rather than a global one,
      // so widening `include` cannot loosen or tighten the CI gate: the numbers
      // below apply to src/lib/core/** alone, exactly as before (docs/11 §1).
      thresholds: {
        'src/lib/core/**': { lines: 90, functions: 90, branches: 85 },
      },
    },
  },
});
