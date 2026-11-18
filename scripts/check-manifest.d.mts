/**
 * Types for scripts/check-manifest.mjs, so its tests can call it directly.
 * The script itself is plain JavaScript checked with `// @ts-check`.
 */
export const TARGETS: Record<string, { dir: string; keys: string[]; label: string }>;
export function checkExtension(
  outDir: string,
  target?: string,
): { problems: string[]; readError?: string };
