# Third-Party Notices — BookmarkMagic

Last updated: 2026-10-29

**No runtime dependencies are installed** — `package.json` has an empty
`dependencies` list (`docs/01 §4`). Two small MIT-licensed pieces are,
however, **compiled into** the shipped extension by the build, and their
notices travel with it in `THIRD_PARTY_NOTICES.txt` at the root of the package:

| Component | What ships | License |
|---|---|---|
| [Svelte](https://github.com/sveltejs/svelte) 5 | The runtime the compiler emits into each page (reactivity, DOM updates) | MIT |
| [@wxt-dev/browser](https://github.com/wxt-dev/wxt) | The one-line `browser` export: `globalThis.browser` when it exists, else `globalThis.chrome` | MIT |

Neither contains network code; the extension's Content-Security-Policy forbids
it anyway (`docs/08 §3`). Parsing, serializing and downloading otherwise use
platform APIs only (`DOMParser`, `Blob`, `URL`, `URL.canParse`,
`Intl.Collator`, Web Locks, `BroadcastChannel`).

Build-time tooling (WXT, Vite, TypeScript, Biome, Knip, Vitest, svelte-check)
is not distributed with the extension and is not listed here. All of it is
MIT/Apache-2.0/ISC licensed and compatible with GPL-3.0-or-later.

If a runtime dependency is ever added — see `docs/01 §4` for the gated list —
its name and full license text must be added here and to
`src/public/THIRD_PARTY_NOTICES.txt` in the same pull request, and the About
tab must say so (`docs/14 §5`).

Licensing questions: **copyright@poli0981.dev**.

## Svelte — MIT

Copyright (c) 2016-2025 Svelte Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## @wxt-dev/browser — MIT

Copyright (c) Aaron Klinker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
