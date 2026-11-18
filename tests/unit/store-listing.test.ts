import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/lib/i18n/resolve-locale';
import { CHROME_LOCALE_DIRS } from '../helpers/locales';

/**
 * The Microsoft Edge Add-ons copy in `store/listing.*.md` — docs/13 §9.
 *
 * Edge's developer policy (1.1.2) says a listing must not reference other
 * browsers, and Partner Center flags a browser name in the description. It did
 * on 2026-11-18, for "Firefox", in a copy that was then "the Chrome Web Store
 * description with two bullets swapped" — the swap had left the export bullet's
 * list of seven browsers in place. So the Edge copy is a complete description
 * of its own, and nothing else would notice a name pasted back into it.
 */

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const listing = (locale: Locale): string => read(`store/listing.${CHROME_LOCALE_DIRS[locale]}.md`);

/**
 * Every browser the listings name, Edge excepted. Bounded by ASCII letters
 * only, so a name that runs straight into CJK text ("Chrome的") still matches,
 * while a word that merely starts with one ("operare") does not.
 */
const OTHER_BROWSERS =
  /(?<![A-Za-z])(?:Chrome|Chromium|Firefox|Mozilla|Brave|Safari|Vivaldi|Opera|Netscape|Internet Explorer)(?![A-Za-z])/giu;

/** The fenced blocks between the Edge heading and the next `## ` heading. */
function edgeDescriptions(text: string): string[] {
  const [, after = ''] = text.split(/^## Microsoft Edge Add-ons.*$/mu);
  const [section = ''] = after.split(/^## /mu);
  return [...section.matchAll(/^```\n([\s\S]*?)\n```$/gmu)].map((match) => match[1] ?? '');
}

describe('the Microsoft Edge Add-ons listing', () => {
  it.each(LOCALES)('%s has one complete description, pasted whole', (locale) => {
    const descriptions = edgeDescriptions(listing(locale));
    // One block, not a recipe of bullets to swap: the recipe is how the Chrome
    // Web Store's list of browsers reached Partner Center.
    expect(descriptions).toHaveLength(1);
    // Partner Center accepts 250 to 5,000 characters.
    const length = descriptions[0]?.length ?? 0;
    expect(length).toBeGreaterThanOrEqual(250);
    expect(length).toBeLessThanOrEqual(5000);
  });

  it.each(LOCALES)('%s names no browser but Edge', (locale) => {
    const [description = ''] = edgeDescriptions(listing(locale));
    expect(description.match(OTHER_BROWSERS) ?? []).toEqual([]);
  });

  it.each(LOCALES)('%s still names them in the Chrome Web Store copy', (locale) => {
    // That copy lists the browsers on purpose. A pattern that found nothing
    // there would let the check above pass on any text at all.
    const [chromeWebStoreCopy = ''] = listing(locale).split(/^## /mu);
    expect(chromeWebStoreCopy.match(OTHER_BROWSERS)).toEqual(
      expect.arrayContaining(['Chrome', 'Brave', 'Firefox', 'Safari', 'Vivaldi', 'Opera']),
    );
  });
});
