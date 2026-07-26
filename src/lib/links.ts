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

/**
 * Releases, not `blob/main/CHANGELOG.md` — the changelog is authored in Phase 5
 * and the file does not exist yet. A releases page renders as a valid (empty)
 * page; a missing blob is a 404 shown from inside a legal-adjacent surface.
 */
export const CHANGELOG_URL = `${REPO_URL}/releases`;

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
