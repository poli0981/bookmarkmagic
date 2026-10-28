/**
 * Types for scripts/check-manifest.mjs, so its tests can call it directly.
 * The script itself is plain JavaScript checked with `// @ts-check`.
 */
export function checkExtension(outDir: string): { problems: string[]; readError?: string };
