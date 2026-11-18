/**
 * Types for scripts/triage.mjs, so its tests can call it directly.
 * The script itself is plain JavaScript checked with `// @ts-check`.
 */
export interface Decision {
  action: 'close' | 'label' | 'none';
  reason: string;
  kind?: 'issue' | 'pr';
  number?: number;
  label?: string;
  comment?: string;
}

export const POLICY_URL: string;
export const IDEAS_URL: string;
export const KIND_QUESTION: string;
export const KIND: Readonly<{ roadmap: string; needed: string; fresh: string }>;
export const LABEL: Readonly<{ feature: string; closed: string; triage: string; exempt: string }>;
export const ISSUE_COMMENT: string;
export const PR_COMMENT: string;
export function kindOf(body: unknown): string | undefined;
export function decide(eventName: string | undefined, payload: unknown): Decision;
