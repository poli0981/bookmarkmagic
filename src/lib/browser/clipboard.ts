/**
 * Copying a bookmark's URL — the docs/09 T8 surface.
 *
 * Purpose: the only place this extension touches the clipboard.
 * Inputs: a URL string, from an explicit user click.
 * Guarantees: **write only**. Nothing here ever reads the clipboard, and the
 *   write is never triggered by anything but a click, so no permission is
 *   needed — `clipboard-write` is granted to a transient user activation.
 *   Never throws; returns whether the copy landed.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  // Absent in a non-secure context and in jsdom. A missing clipboard is a
  // "could not copy", not a crash.
  if (clipboard === undefined) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
