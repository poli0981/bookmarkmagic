# Building BookmarkMagic from source

How to rebuild the packages attached to each
[GitHub Release](https://github.com/poli0981/bookmarkmagic/releases) — for
Firefox Add-ons reviewers, who must be able to reproduce the submitted package
from its sources, and for anyone who wants to check that a store build matches
this repository.

## Requirements

| Tool | Version | Where |
|---|---|---|
| Node.js | **26** (the version in `.nvmrc`; tested with 26.13) | <https://nodejs.org/en/download> |
| npm | the one bundled with Node.js 26 (11.x) | ships with Node.js |
| OS | any — Windows 11, macOS and Ubuntu all build the same files | |

No other tool, account, network service or environment variable is needed
beyond what `npm ci` installs from `package-lock.json`.

> **The Firefox sources archive omits dotfiles**, so `.nvmrc` and `.npmrc` are
> not in it. Use Node.js 26: an older Node may install but is not what the
> package was built with, and `package.json` says `"engines": { "node": ">=26" }`.

## Steps

```bash
npm ci                 # exactly the versions in package-lock.json
npm run zip:firefox    # the Firefox package (and a sources archive)
npm run zip            # the Chromium package (Chrome Web Store, Edge Add-ons)
```

`npm ci` runs one install script of this project's own, `wxt prepare`, which
generates the TypeScript configuration the build reads. (CI installs with
`--ignore-scripts` and runs `npx --no-install wxt prepare` itself; the result
is the same.)

## Output

| Command | Unpacked build | Package |
|---|---|---|
| `npm run zip:firefox` | `.output/firefox-mv3/` | `.output/bookmarkmagic-<version>-firefox.zip` |
| `npm run zip` | `.output/chrome-mv3/` | `.output/bookmarkmagic-<version>-chrome.zip` |

Compare the **files inside** the package with the submitted one, not the
archives themselves: a zip records file times, so two builds of the same
commit hash differently while every entry is identical (`docs/09 §5`).

## What the build does

- [WXT](https://wxt.dev) bundles `src/` with Vite into plain JavaScript, CSS
  and HTML. The code is **minified, not obfuscated**.
- The only third-party code compiled in is the Svelte runtime, its `clsx`
  helper and WXT's one-line browser shim, all MIT
  ([`legal/THIRD_PARTY_NOTICES.md`](legal/THIRD_PARTY_NOTICES.md)); the build
  fails if anything else would ship.
- Nothing is downloaded at build time beyond `npm ci`, and the built extension
  makes no network requests at all — its content security policy forbids them
  ([`docs/08_MV3_COMPLIANCE.md`](docs/08_MV3_COMPLIANCE.md) §3).

To check a build the way CI does: `npm run check:manifest` (Chromium) and
`npm run check:manifest -- --browser firefox` (Firefox) verify the manifest,
the permissions, the CSP, the file inventory and that no network API is in the
bundle.
