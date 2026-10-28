/**
 * Focus for multi-step screens — docs/06 §5.
 *
 * Purpose: when a step replaces the one before it (the import's preview, its
 *   progress, its result), the control that had focus is gone and focus falls
 *   to `<body>`: a keyboard user starts again from the top of the page, and a
 *   screen reader says nothing (v1.1.0 review). This attachment moves focus to
 *   the new step's heading as it appears.
 * Guarantees: never steals focus. It acts only when focus was lost or was
 *   already inside the same `[data-focus-scope]` container.
 */
export function focusWhenShown(heading: HTMLElement): void {
  const active = document.activeElement;
  const scope = heading.closest('[data-focus-scope]');
  const lost = active === null || active === document.body;
  if (lost || scope?.contains(active) === true) heading.focus();
}
