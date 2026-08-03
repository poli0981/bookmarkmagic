# Contributing to BookmarkMagic

Bug reports, parser samples and translation fixes are all genuinely useful, and
none of them requires you to write code. If you only want to report something,
[open an issue](https://github.com/poli0981/bookmarkmagic/issues/new/choose) and
stop reading here — the forms ask for what is needed.

Security problems go through [`SECURITY.md`](SECURITY.md), never a public issue.

## Reporting a bookmark file that will not import

This is the most valuable report this project gets, because a sample becomes a
permanent test and the bug can then never come back.

**Sanitize the file first.** From a clone of this repository:

```bash
node scripts/sanitize-bookmarks.mjs your-bookmarks.html
```

It needs nothing installed — plain Node. It writes
`your-bookmarks.sanitized.html` next to the original, and prints what it found.

What it **destroys**: every hostname, path, query value and fragment; every
bookmark and folder title; Firefox keywords and tags; favicon data.

What it **keeps**, because this is where the bug lives: the byte order mark, the
doctype, the `<META>` line, comments, line endings, indentation, tag and
attribute **case**, quoting style, attribute order, the tree's shape and depth,
every timestamp exactly as written, whether a URL had a port, how deep its path
was, whether it ended in a slash, how many query parameters it had, whether
there was a fragment, any percent-escapes, and any HTML entities in a title.
Distinct hosts stay distinct, so duplicate-detection bugs survive too.

That combination is the point: the sanitized file still reproduces the problem,
without telling us where you browse. A test in `tests/unit/scripts/` asserts
exactly that against every fixture in the repo.

Please do not send a real bookmarks file — an export is a browsing history.
Anything you attach to a GitHub issue is public and permanent; see
[`legal/PRIVACY.md`](legal/PRIVACY.md) for what happens to anything you email.

## Suggesting a translation fix

You do not need to clone anything. Use the translation issue form: the language,
where the text appears, what it says now, and what it should say. Vietnamese is
reviewed by the maintainer; **Japanese is best-effort until a native pass**, so
JA corrections are especially welcome.

One constraint if you send the change yourself: placeholders like `{n}` or
`{name}` must appear in the translation exactly as in English — same names, same
count. A build gate enforces it.

## Setting up to write code

Node **24 or newer** (see `.nvmrc`).

```bash
npm ci
npx wxt prepare
npm run verify
```

`wxt prepare` is not optional: `tsconfig.json` extends `./.wxt/tsconfig.json`,
which does not exist until it has run.

> **Using a git worktree?** It needs its own `npm ci` *and* `npx wxt prepare`.
> With an empty `node_modules/` the packages resolve upward from the parent
> checkout and almost everything appears to work — but knip then reports every
> devDependency as unused and `verify` fails in a way that looks like your
> change broke something.

Then `npm run dev` and load `.output/chrome-mv3` at `chrome://extensions` with
Developer mode on.

`npm run verify` runs lint, type-check, knip, the grep gate and the tests. It
must be green before every commit. For anything release-bearing use
`npm run verify:full`, which additionally runs coverage, the build, and the gate
that inspects the *built* manifest — `verify` alone is weaker than what CI and a
release tag enforce.

## The rules that are not negotiable

These are what the extension promises in its store listing and privacy policy,
so they are not style preferences:

- **Zero runtime dependencies.** Not "few". A new one needs discussion first.
- **Exactly two permissions**, `bookmarks` and `storage`. Changing that list is
  a minor-version event that also requires re-certifying the store's privacy
  answers.
- **No network access of any kind** — no `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource` or `sendBeacon`. `npm run guard` fails the build on any of them.
- **No `eval`, `{@html}` or `innerHTML`.** File content reaches the DOM as text.
- `src/lib/core/` is pure: it imports nothing from `browser/`, `stores/`, Svelte
  or `chrome.*`.
- Files stay under 300 lines (hard limit 500), functions under 50 (hard 80).
- Every user-visible string is an i18n key present in **all three** locales.

[`CLAUDE.md`](CLAUDE.md) is the entry point and [`docs/`](docs/) is the binding
specification — **where code and docs disagree, the docs win.** A behaviour
change that skips its doc leaves the spec lying, which is why the PR checklist
asks about it.

## Turning a reported file into a regression test

The full ritual, in order, because it is easy to do four fifths of it:

1. **Commit the sanitized sample** to `tests/fixtures/` (or `weird/`, or
   `malformed/`). Note that `.gitattributes` sets `tests/fixtures/** -text`, so
   line-ending normalization cannot rewrite the CRLF or BOM bytes the bug may
   depend on — do not "fix" that.
2. **Add the regression test** to `tests/unit/core/fixtures.test.ts`, the only
   fixture-driven suite. A browser export goes in its `BROWSER_EXPORTS` array,
   which drives a shared set of assertions; anything else gets its own case.
   There is no shared fixture-loading helper — that file has its own loader.
3. **Fix the parser** in `src/lib/core/parse/`. The test and the fix land in the
   **same** pull request; a fixture with no test is just a file.
4. **Write the quirk down** in the parser source *and* in `docs/04 §1.2`. The
   format chapter is where the next person looks to understand why the code is
   shaped oddly.
5. **Update** `docs/11 §2`'s inventory and `CHANGELOG.md`'s `[Unreleased]`.

If the fix changes what a format is able to preserve, that is a specification
change: update `docs/04` first, then `tests/helpers/tree.ts`'s `project()` — it
models each format's documented lossiness, and widening it without the doc turns
a real regression into a passing test.

## Translations, in code

`src/lib/i18n/locales/en.ts` is the schema; `vi.ts` and `ja.ts` are typed
`satisfies Dict` against it, so a missing key is a compile error.

**Never add `as const` to `en.ts`.** It would make `Dict` a tree of string
*literal* types, and every correct translation would become a type error — the
only way to make the build pass would be leaving VI and JA in English.

Four gates run on every change: identical key paths across the three locales,
identical interpolation tokens per string, no empty leaves, and plural keys
carrying exactly `{one, other}` everywhere. See `docs/07` for register and tone
(VI: neutral-friendly, "bạn"; JA: です／ます with katakana loanwords).

## Commits and pull requests

Conventional Commits (`fix(import): …`, `feat(edit): …`, `docs: …`,
`chore(deps): …`). Small commits, one concern each; tests land with or before
the implementation. The PR template lists the rest.
