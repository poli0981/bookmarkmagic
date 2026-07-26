# 12 — CI/CD

Integrates with the centralized ops repo **`poli0981/.github`**, whose reusable
workflows use the `reusable-*` naming family. There is **no
`browser-extension-*` family** — the single Chrome-extension workflow is
`reusable-chrome-extension.yml`.

## 1. Known constraints (from the ops-repo migration)

- `poli0981` is a **user account** → no org-level secrets; repo-level
  Actions secrets only.
- **Caller stubs MUST declare explicit `permissions:` blocks** — reusable
  workflows do not inherit them (bug already burned once; never omit).
- New repo joins in side-by-side mode is unnecessary (greenfield) — adopt the
  centralized workflows directly from day one.
- **`reusable-chrome-extension.yml` runs no quality gates.** Its complete
  `workflow_call` surface is inputs `package-manager` (default `'none'`),
  `node-version` (`'24'`), `build-command` (`'npm run build'`),
  `source-dir` (`'.'`), `release` (`false`) — and **no `secrets:` block at
  all**, so passing any named secret to it is a workflow-compile error. It
  installs, builds, asserts `manifest_version == 3`, `zip -rq`s `source-dir`
  and uploads an artifact. Lint, type-check, knip, tests, coverage and the
  grep gates are the caller's job (§2.1).
- Sibling precedent for the same stack is `poli0981/switch-every-tab-hotkey`,
  which currently keeps its CI self-contained rather than calling the ops
  reusables. Do not assume its workflows are a drop-in template.

## 2. Workflows (caller stubs in this repo)

### 2.1 `.github/workflows/ci.yml` — every push/PR to `main`

The local `quality` job exists because the ops reusable workflow performs none
of it (§1). The `build` job delegates packaging.

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  quality:
    name: Quality gates
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: '24', cache: npm }
      - run: npm ci
      - run: npm run lint          # biome check .
      - run: npm run check         # svelte-check + tsc --noEmit
      - run: npm run knip
      - run: npm run coverage      # vitest --coverage, thresholds per 11 §1
      - run: npm run guard         # canonical grep gate, 08_MV3 §3
      - run: npm run build
      - run: npm run check:manifest  # the BUILT artifact, not just the config

  build:
    name: Build + package
    needs: quality
    uses: poli0981/.github/.github/workflows/reusable-chrome-extension.yml@main
    permissions:
      contents: read
    with:
      package-manager: 'npm'          # 01 §6 commits package-lock.json
      node-version: '24'
      build-command: 'npm run build'
      source-dir: '.output/chrome-mv3'   # WXT emits the manifest here
      release: false
```

All four `with:` values are required. Omitting `package-manager` defaults it to
`'none'`, which skips install/build entirely and then fails on
`test -f ./manifest.json` — a file WXT never writes to the repo root.

`npm run guard` runs the same script locally and in CI, so the gate cannot
drift between the two (`10 §3`). It is the single canonical pattern defined in
`08_MV3_COMPLIANCE.md §3`; do not restate the pattern here or anywhere else.

### 2.2 `.github/workflows/codeql.yml`

Use the current reusable (`reusable-codeql.yml`, CodeQL Action v4). Its input is
`languages` — a **JSON array encoded as a string**, not the singular `language`
of the older `codeql.yml`.

```yaml
name: CodeQL

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  schedule:
    - cron: '0 14 * * 1'          # weekly, Monday

permissions:
  security-events: write
  actions: read
  contents: read
  packages: read

jobs:
  analyze:
    uses: poli0981/.github/.github/workflows/reusable-codeql.yml@main
    permissions:
      security-events: write
      actions: read
      contents: read
      packages: read
    with:
      languages: '["javascript-typescript"]'
```

⚠️ **Prerequisite:** repo Settings → Advanced Security → CodeQL **"Default
setup" must be DISABLED**, or this advanced-setup workflow is rejected at SARIF
upload time.

### 2.3 `.github/workflows/release.yml` — on tag `v*`

Standalone, **not** the ops reusable: the reusable's `release` job only does
`gh release create --generate-notes`. It produces no `SHA256SUMS.txt`
(required by `09 §5`), performs no store submission, and exposes no `outputs:`,
so a caller cannot reference the zip it built.

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: read

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: write            # create the GitHub Release
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: '24', cache: npm }
      - run: npm ci

      # Same gates as CI — a tag must never ship what a PR would have blocked.
      - run: npm run lint
      - run: npm run check
      - run: npm run knip
      - run: npm run coverage
      - run: npm run guard

      - run: npm run zip         # wxt zip → .output/<name>-<version>-chrome.zip

      - name: Verify tag matches manifest version
        run: |
          set -euo pipefail
          MANIFEST_VERSION=$(jq -r '.version' .output/chrome-mv3/manifest.json)
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          test "$MANIFEST_VERSION" = "$TAG_VERSION" \
            || { echo "::error::tag $TAG_VERSION != manifest $MANIFEST_VERSION"; exit 1; }

      - name: SHA256SUMS
        working-directory: .output
        run: sha256sum *-chrome.zip > SHA256SUMS.txt

      - name: GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "$GITHUB_REF_NAME" \
            .output/*-chrome.zip .output/SHA256SUMS.txt --generate-notes

      - name: Publish to Chrome Web Store
        if: vars.CWS_AUTOPUBLISH == 'true'
        env:
          CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
          CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
          CHROME_CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
          CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
        run: npx wxt submit --chrome-zip .output/*-chrome.zip

  announce:
    needs: release
    uses: poli0981/.github/.github/workflows/announce-release.yml@main
    permissions:
      contents: read
    with:
      tag_override: ${{ github.ref_name }}
    secrets: inherit
```

`tag_override` is **required here**, and for the same reason the announcement
is a job rather than a caller. The reusable resolves
`TAG="${INPUT_TAG:-$EVENT_TAG}"` with `EVENT_TAG = github.event.release.tag_name`
— empty under `on: push: tags` — so omitting it makes the job exit 1 on
"No release tag available" and the announcement never fires for any release.

The announcement is a **job inside this workflow**, not a separate
`on: release: [published]` caller. A Release created by `gh release create`
under the default `GITHUB_TOKEN` does not emit an event that starts new
workflow runs, so an event-driven caller would silently never fire.

### 2.4 `.github/workflows/notify-ci-failure.yml`

```yaml
name: Notify CI failure

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]

permissions:
  contents: read
  actions: read

jobs:
  notify:
    uses: poli0981/.github/.github/workflows/notify-ci-failure.yml@main
    permissions:
      contents: read
      actions: read
    secrets: inherit
```

The reusable already filters to `conclusion == 'failure'` on the default
branch, so the caller needs no `if:`.

## 3. Chrome Web Store publishing automation

WXT ships publishing built-in: **`wxt submit`** (wrapping
`publish-browser-extension`). One-time local setup: `npx wxt submit init`
→ walks through creating the Google Cloud OAuth client + refresh token →
produces the four values above → store as **repo Actions secrets**.

**Gating policy:**

| Version | Method |
|---|---|
| v1.0.x (first listing + first reviews) | **Manual**: download the zip from the GitHub Release (not the CI artifact — the Release asset is the one `SHA256SUMS.txt` covers) → Dashboard upload → fill listing/privacy → submit. First reviews often ask questions; keep a human in the loop. |
| v1.1+ | **Automated**: the `Publish to Chrome Web Store` step in §2.3 runs after the Release succeeds, gated on the repo variable `CWS_AUTOPUBLISH=true` so it can be flipped off instantly if a review dispute is ongoing. |

Notes: uploaded builds still go through CWS review before rollout (automation
removes the clicking, not the review). Consider Dashboard "staged rollout"
manually for risky releases.

## 4. Branch/version flow

```
feat branch → PR (CI green + review) → squash-merge to main
release: bump package.json (semver) → CHANGELOG.md (Keep a Changelog) →
         git tag -s vX.Y.Z → push tag → release.yml
```

- Patch = fixes/translations · Minor = features / any permission or
  privacy-tab change (per `09 §4`) · Major = breaking format/schema changes
  (BM JSON version bump).

## 5. Repo settings checklist (one-time ⚠️)

- [ ] Branch protection on `main`: require CI, require review, linear history.
      Required checks are the **job** names — `Quality gates` and
      `Build + package` — not the workflow name.
- [ ] CodeQL **Default setup DISABLED** (Settings → Advanced Security),
      otherwise `codeql.yml` fails at SARIF upload (§2.2).
- [ ] Actions secrets: the four `CHROME_*` values (after `wxt submit init`).
- [ ] Actions secrets for Discord notifications (all optional — the reusables
      skip cleanly when unset, except `DISCORD_CI_WEBHOOK` which
      `notify-ci-failure.yml` declares `required: true`):
      `DISCORD_CI_WEBHOOK`, `DISCORD_RELEASES_WEBHOOK`, `DISCORD_REPO_WEBHOOK`,
      `DISCORD_PING_ROLE_ID`.
- [ ] Repo variable `CWS_AUTOPUBLISH=false` initially.
- [ ] Dependabot: npm weekly, grouped minors; `github-actions` ecosystem too.
- [ ] Issue templates: bug (asks for browser + a sanitized sample file),
      feature, translation.
- [ ] GPG signing required for tags (matches tracker-repo practice).
