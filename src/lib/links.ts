/**
 * Every outbound URL the product shows — docs/14 §4, docs/06 §3.5.
 *
 * Purpose: one place for the repo, legal and donate links, so the About tab and
 *   the Legal Gate cannot drift apart.
 * Inputs: none — compile-time literals.
 * Guarantees: no requests are made from here. These are hrefs the user chooses
 *   to follow; the extension itself stays offline (docs/09 §1).
 *
 * They are rendered as `<a target="_blank" rel="noopener noreferrer">`, unlike
 * bookmark URLs, which docs/09 T3 forbids putting in an href and which #edit
 * opens through `tabs.create` instead. Two mechanisms for two trust classes:
 * these are literals in this file, those are untrusted data from a user's
 * import file. Do not "harmonize" them.
 */

export const REPO_URL = 'https://github.com/poli0981/bookmarkmagic';
export const ISSUES_URL = `${REPO_URL}/issues`;

export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

/**
 * The accessibility statement (docs/06 §3.5, §5): what works, what was tested,
 * what is known not to, the tree's keys — shown nowhere in the UI — and how to
 * report a barrier. A link to the file, not an address: no email appears on an
 * in-product surface (see STORE_URL below).
 */
export const ACCESSIBILITY_URL = `${REPO_URL}/blob/main/ACCESSIBILITY.md`;

/** The Chrome Web Store item id (docs/00 §9) — also the CHROME_EXTENSION_ID secret. */
const CWS_ITEM_ID = 'eghnciphhegekmnofffpgbdfefckdhmg';

/** The published Chrome Web Store listing. */
const CWS_URL = `https://chromewebstore.google.com/detail/bookmarkmagic/${CWS_ITEM_ID}`;

/**
 * The Edge Add-ons item id — Partner Center's "CRX ID", and the `runtime.id`
 * of every copy installed from Edge Add-ons (docs/00 §9). Not the Product ID,
 * which is what the `EDGE_PRODUCT_ID` secret needs.
 */
const EDGE_ITEM_ID = 'nchfchjnlihbifggooggpmmacighmdjg';

/** The published Edge Add-ons listing (live since 2026-11-19). */
const EDGE_URL = `https://microsoftedge.microsoft.com/addons/detail/${EDGE_ITEM_ID}`;

/** Each Chromium store's item id → its listing. */
const CHROMIUM_LISTINGS: ReadonlyMap<string, string> = new Map([
  [CWS_ITEM_ID, CWS_URL],
  [EDGE_ITEM_ID, EDGE_URL],
]);

/**
 * The Firefox Add-ons listing, addressed by the gecko id, which AMO resolves
 * (docs/13 §8). The "@" is percent-encoded on purpose: AMO decodes it, and the
 * source then holds nothing that reads as an email address (see below).
 */
const AMO_URL = 'https://addons.mozilla.org/firefox/addon/bookmarkmagic%40poli0981.dev/';

/** Every store, listed: the README's install section. */
const INSTALL_URL = `${REPO_URL}#install`;

/**
 * The listing this copy was installed from — docs/06 §3.5.
 *
 * The only route from inside the product to rating or reviewing it, which
 * docs/13 §6 lists as a post-launch channel. One Chromium package serves the
 * Chrome Web Store and Edge Add-ons, so the Chromium choice is made at run
 * time, by extension id: each store's own id gets its listing (an Edge user
 * who installed from the Chrome Web Store has that store's id, and gets that
 * listing), any other id (an unpacked build) the install section.
 *
 * There is deliberately **no support email here.** Putting an address on an
 * in-product surface invites users to mail their real bookmarks file, which is
 * a browsing history and exactly the receipt of personal data that
 * `legal/PRIVACY.md` and docs/09 §6 are written to bound. The address lives in
 * SECURITY.md, CONTRIBUTING.md and the privacy policy, where it arrives with
 * the instruction to sanitize first (docs/15 decision log, 2026-08-03).
 */
export function storeUrlFor(install: { firefox: boolean; extensionId: string }): string {
  if (install.firefox) return AMO_URL;
  return CHROMIUM_LISTINGS.get(install.extensionId) ?? INSTALL_URL;
}

export interface LabelledLink {
  labelKey: string;
  url: string;
}

/**
 * The four documents the gate and About link to (docs/14 §2).
 *
 * `blob/main/` and not a pinned tag on purpose: the gate asks the user to
 * accept the *current* documents, and LEGAL_VERSION is the re-consent
 * mechanism. Pinning would show terms that are no longer the ones in force.
 */
export const LEGAL_URLS: readonly LabelledLink[] = [
  { labelKey: 'legal.eula', url: `${REPO_URL}/blob/main/legal/EULA.md` },
  { labelKey: 'legal.license', url: `${REPO_URL}/blob/main/LICENSE` },
  { labelKey: 'legal.disclaimer', url: `${REPO_URL}/blob/main/legal/DISCLAIMER.md` },
  { labelKey: 'legal.privacy', url: `${REPO_URL}/blob/main/legal/PRIVACY.md` },
];

/**
 * Donation platforms, from `.github/FUNDING.yml` (docs/14 §5).
 *
 * Labels are literals rather than i18n keys: these are brand names, which
 * docs/07 §4 leaves untranslated. Only the section heading is localized.
 */
export const DONATE_LINKS: readonly { label: string; url: string }[] = [
  { label: 'GitHub Sponsors', url: 'https://github.com/sponsors/poli0981' },
  { label: 'Ko-fi', url: 'https://ko-fi.com/skullmute' },
  { label: 'Buy Me a Coffee', url: 'https://www.buymeacoffee.com/skullmute' },
  { label: 'Patreon', url: 'https://www.patreon.com/skullmute' },
  { label: 'PayPal', url: 'https://paypal.me/DungDang212' },
];
