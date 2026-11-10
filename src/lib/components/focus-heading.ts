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
  if (focusLost() || scope?.contains(active) === true) heading.focus();
}

/**
 * Focus fell to `<body>`, or is about to: the control that had it was removed,
 * or sits in a dialog that just closed. The browser moves such a focus to
 * `<body>` only at its next rendering update, after any code that runs now —
 * so checking for `<body>` alone left focus to fall there anyway.
 */
export function focusLost(): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body) return true;
  return !active.isConnected || active.closest('dialog:not([open])') !== null;
}

/**
 * Put focus on `target` if it has fallen to `<body>` — for when the control
 * that had it was removed by the very action it started (a dialog cannot hand
 * focus back to a button that went with what it deleted).
 */
export function focusIfLost(target: HTMLElement | null | undefined): void {
  if (target !== null && target !== undefined && focusLost()) target.focus();
}

/**
 * Hand focus to the tree a row control sits in — docs/06 §5.
 *
 * The #edit tree's row buttons and chevron are mouse shortcuts, not tab stops
 * (`tabindex="-1"`), but Chrome still focuses one when it is clicked. The
 * tree's key handler ignores keys aimed at a row's own control, so a single
 * click used to switch the arrow keys off until the next click on a row; and
 * "Move to…" opened from the button returned focus to a button on a row that
 * had since moved. Called from the click, before any dialog opens, so the
 * dialog remembers the tree as the place to return to.
 */
export function focusOwningTree(from: EventTarget | null): void {
  if (from instanceof Element) from.closest<HTMLElement>('[role="tree"]')?.focus();
}
