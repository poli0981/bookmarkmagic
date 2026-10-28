// @ts-check
/**
 * Value mappers: deterministic placeholders that keep what parsers branch on.
 *
 * Replacements are stable per distinct input value, so "how many distinct
 * hosts" and "which two bookmarks are duplicates" survive sanitizing.
 */

/** @typedef {(raw: string) => string} Mapper */

/**
 * Replace addresses while preserving everything a parser branches on: the
 * scheme, whether there is a port, how deep the path is, whether it ends in a
 * slash, how many query parameters there are and in what order, and whether
 * there is a fragment. Percent-escapes are carried across literally, so a
 * decoding bug still reproduces.
 *
 * @returns {Mapper}
 */
export function makeUrlMapper() {
  /** @type {Map<string, string>} */
  const seen = new Map();
  /** @type {Map<string, string>} */
  const hosts = new Map();

  /** @param {string} host */
  const hostAlias = (host) => {
    let alias = hosts.get(host);
    if (alias === undefined) {
      const n = hosts.size;
      // a.example … z.example, then a1.example, a2.example …
      const letter = String.fromCharCode(97 + (n % 26));
      const round = Math.floor(n / 26);
      alias = round === 0 ? `${letter}.example` : `${letter}${round}.example`;
      hosts.set(host, alias);
    }
    return alias;
  };

  /** @param {string} segment */
  const escapesIn = (segment) => (segment.match(/%[0-9a-fA-F]{2}/g) ?? []).join('');

  /** @param {string} pathname */
  const mapPath = (pathname) => {
    if (pathname === '' || pathname === '/') return pathname;
    const trailing = pathname.endsWith('/');
    const parts = pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
    const mapped = parts.map((p, i) => (p === '' ? '' : `p${i + 1}${escapesIn(p)}`));
    return `/${mapped.join('/')}${trailing ? '/' : ''}`;
  };

  /** @param {string} search */
  const mapQuery = (search) => {
    if (search === '') return '';
    return `?${search
      .slice(1)
      .split('&')
      .map((pair, i) => (pair.includes('=') ? `q${i + 1}=v${i + 1}` : `q${i + 1}`))
      .join('&')}`;
  };

  return (raw) => {
    if (raw === '') return raw;
    const cached = seen.get(raw);
    if (cached !== undefined) return cached;

    let out;
    let url;
    try {
      url = new URL(raw);
    } catch {
      url = undefined;
    }

    if (url === undefined) {
      // Keep it unparseable, and keep distinct values distinct — the dedupe
      // path treats an unparseable URL as its own trimmed self.
      out = `not-a-url-${seen.size + 1}`;
    } else if (url.host === '') {
      // Opaque or hostless scheme (javascript:, data:, mailto:, file:, place:).
      // The scheme is the whole point for the T1/T3 threat cases; the payload —
      // which for file: is a local path with a user name in it — is not ours.
      out = `${url.protocol}sanitized-${seen.size + 1}`;
    } else {
      // Credentials are never round-tripped, not even as placeholders.
      const port = url.port === '' ? '' : `:${url.port}`;
      const hash = url.hash === '' ? '' : '#frag';
      out = `${url.protocol}//${hostAlias(url.host.replace(/:\d+$/, ''))}${port}${mapPath(url.pathname)}${mapQuery(url.search)}${hash}`;
    }

    seen.set(raw, out);
    return out;
  };
}

/**
 * Replace titles while preserving what encoding bugs live in: emptiness, the
 * scripts present (so a CJK or RTL or emoji bug still reproduces), and any HTML
 * entity references, which are carried across verbatim.
 *
 * @returns {Mapper}
 */
export function makeTitleMapper() {
  /** @type {Map<string, string>} */
  const seen = new Map();
  /** @type {[RegExp, string][]} */
  const SCRIPTS = [
    [/[一-鿿぀-ヿ]/, '文字'],
    [/[֐-ࣿ]/, 'شيء'],
    [/[\p{Extended_Pictographic}]/u, '🌸'],
  ];

  return (raw) => {
    if (raw.trim() === '') return raw;
    const cached = seen.get(raw);
    if (cached !== undefined) return cached;

    const entities = (raw.match(/&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g) ?? []).join('');
    const extras = SCRIPTS.filter(([re]) => re.test(raw))
      .map(([, sample]) => sample)
      .join('');
    const out = `Title ${seen.size + 1}${extras === '' ? '' : ` ${extras}`}${entities}`;
    seen.set(raw, out);
    return out;
  };
}

/** Firefox's fixed root GUIDs — structural, and the parser keys off them. */
const RESERVED_GUID = /^(?:root|menu|toolbar|unfiled|mobile|tags)_+$/;

/**
 * Replace bookmark GUIDs with stable fakes of the same shape. They are random,
 * but they are also the identifier sync uses, so they could tie a public sample
 * to an account; the root GUIDs are kept because they carry meaning.
 *
 * @returns {Mapper}
 */
export function makeGuidMapper() {
  /** @type {Map<string, string>} */
  const seen = new Map();
  return (raw) => {
    if (raw === '' || RESERVED_GUID.test(raw)) return raw;
    const cached = seen.get(raw);
    if (cached !== undefined) return cached;
    const n = String(seen.size + 1);
    const out = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
      ? `00000000-0000-4000-8000-${n.padStart(12, '0')}`
      : `g${n.padStart(Math.max(raw.length - 1, n.length), '0')}`;
    seen.set(raw, out);
    return out;
  };
}

/**
 * True when a value is a URL whose payload could identify someone: it has a
 * host, or it is a `file:` path (`file:///C:/Users/<name>/…` has no host).
 *
 * @param {string} value
 */
export function isAddressLike(value) {
  try {
    const url = new URL(value);
    return url.host !== '' || url.protocol === 'file:';
  } catch {
    return false;
  }
}
