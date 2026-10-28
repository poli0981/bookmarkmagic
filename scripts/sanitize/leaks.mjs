// @ts-check
/**
 * The backstop: check the OUTPUT, not the rules that produced it.
 *
 * The rewriting rules are patterns over untrusted markup, so each one has a
 * shape it does not match — a single-quoted attribute, a title containing `<`,
 * a JSON key nobody enumerated, a `<DD class=…>`. Every one of those is a silent
 * leak, and nobody can honestly claim to have thought of every shape. So the
 * output is inspected independently, and anything that still looks personal
 * makes the tool refuse instead of handing the file over. A rule this misses
 * degrades into a refusal — annoying — instead of a published browsing history.
 */
import { TAG_INNARDS } from './spans.mjs';

/**
 * Hosts in the output that are not one of our own `*.example` aliases.
 *
 * @param {string} text sanitized output
 * @returns {string[]} distinct suspicious hosts, empty when clean
 */
export function findLeakedHosts(text) {
  const leaked = new Set();
  for (const m of text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/([^\s"'<>)\]}\\]+)/gi)) {
    const authority = (m[1] ?? '').split(/[/?#]/, 1)[0] ?? '';
    // Strip credentials and port; what remains is the host.
    const host = authority.split('@').pop()?.replace(/:\d+$/, '').toLowerCase() ?? '';
    if (host === '' || /^[a-z]\d*\.example$/.test(host)) continue;
    leaked.add(host);
  }
  return [...leaked];
}

/**
 * Words the sanitized TEXT of a Netscape file may legitimately contain: our
 * placeholders, the default heading, and the script samples the title mapper
 * adds so an encoding bug still reproduces.
 */
const ALLOWED_WORDS = new Set(['title', 'description', 'bookmarks', 'bookmark', 'menu', 'شيء']);

/**
 * Words in the document's text content — everything outside tags and comments —
 * that are not placeholders.
 *
 * Independent of the rewriting rules on purpose: it does not look for `<A>` or
 * `<H3>` at all, it strips markup and reads whatever text is left. The old
 * backstop matched only `scheme://host`, so an unsanitized title, a `<DD>` note
 * or an `<H1>Jane Doe's bookmarks</H1>` passed it, and the test that guarded it
 * reused the same pattern and could never notice.
 *
 * @param {string} html sanitized Netscape output
 * @returns {string[]} distinct offending words, empty when clean
 */
export function findLeakedWords(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Script and style bodies are code. A browser export never contains them;
    // the T1 injection fixtures do, and their payload is the point of the file.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(new RegExp(`<${TAG_INNARDS}>`, 'g'), ' ')
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, ' ');
  const leaked = new Set();
  for (const [word] of text.matchAll(/\p{L}{3,}/gu)) {
    if (!ALLOWED_WORDS.has(word.toLowerCase())) leaked.add(word);
  }
  return [...leaked];
}
