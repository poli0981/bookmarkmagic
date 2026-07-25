# Third-Party Notices — BookmarkMagic

**Runtime dependencies: None.**

The shipped extension bundles no third-party code. Parsing, serializing and
downloading use platform APIs only (`DOMParser`, `Blob`, `URL`,
`crypto.randomUUID`).

Build-time tooling (WXT, Vite, Svelte, TypeScript, Biome, Knip, Vitest) is not
distributed with the extension and is not listed here. All of it is
MIT/Apache-2.0/ISC licensed and compatible with GPL-3.0-or-later.

If a runtime dependency is ever added — see `docs/01_TECH_STACK.md §4` for the
gated list — its name and full license text must be added to this file in the
same pull request, and the About tab must render it (`docs/14 §5`).
