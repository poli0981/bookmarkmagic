/**
 * Types for scripts/check-licenses.mjs, so its tests can call it directly.
 * The script itself is plain JavaScript checked with `// @ts-check`.
 */
export const SHIPPED_LICENSES: readonly string[];
export const TOOLCHAIN_LICENSES: readonly string[];
export const EXCEPTIONS: Readonly<Record<string, string>>;
export function satisfies(expression: string, allowed: readonly string[]): boolean;
export function packageNameOf(key: string): string;
export function checkLockfile(
  lock: unknown,
  options?: { shipsCode?: boolean },
): {
  problems: string[];
  checked: number;
  counts: Map<string, number>;
};
