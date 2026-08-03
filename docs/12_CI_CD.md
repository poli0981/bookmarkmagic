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

⚠️ **The YAML below is a copy of live files, and copies drift.** It has already
happened twice: a Dependabot bump moved `actions/setup-node` from v6 to v7 in
`.github/workflows/` and never touched this doc, and the `check:manifest` step
added to the release job in `674ac34` was missing here. Because docs win over
code in this project, someone reconciling in the wrong direction would have
downgraded a pinned action and deleted a security gate. Both are corrected
below (2026-08-03). **When these disagree again, read the workflow file first
and fix this doc — that is the one place the docs-win rule inverts, because the
running pipeline is the ground truth about itself.**

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
      - uses: actions/setup-node@v7
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
      contents: write      # see the warning below — `read` fails at startup
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

⚠️ **`contents: write` on the `build` job is not a mistake.** The reusable
declares two mutually exclusive jobs — `build` (`contents: read`,
`if: !inputs.release`) and `release` (`contents: write`, `if: inputs.release`).
GitHub validates the caller's grant against **every job the reusable declares,
before evaluating any `if:`**, so `release: false` does not exempt the caller
from the release job's requirement. Granting `contents: read` makes the entire
run fail with `startup_failure`: no jobs, no log, and only the generic "this run
likely failed because of a workflow file issue" in the UI. Verified 2026-07-26
on the first real run of this workflow.

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
      - uses: actions/setup-node@v7
        with: { node-version: '24', cache: npm }
      - run: npm ci

      # Same gates as CI — a tag must never ship what a PR would have blocked.
      - run: npm run lint
      - run: npm run check
      - run: npm run knip
      - run: npm run coverage
      - run: npm run guard

      - run: npm run zip         # wxt zip → .output/<name>-<version>-chrome.zip
      - run: npm run check:manifest  # gate the artifact, not the config it came from

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

      - name: GitHub Release          # idempotent — see below
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          if gh release view "$GITHUB_REF_NAME" >/dev/null 2>&1; then
            gh release upload "$GITHUB_REF_NAME" \
              .output/*-chrome.zip .output/SHA256SUMS.txt --clobber
          else
            gh release create "$GITHUB_REF_NAME" \
              .output/*-chrome.zip .output/SHA256SUMS.txt --generate-notes
          fi

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
    continue-on-error: true      # see below
    uses: poli0981/.github/.github/workflows/announce-release.yml@main
    permissions:
      contents: read
    with:
      tag_override: ${{ github.ref_name }}
    secrets: inherit
```

**The Release step is idempotent deliberately.** `gh release create` fails
outright when a Release for the tag already exists, so any failure *after* it —
realistically the CWS publish step, once `CWS_AUTOPUBLISH` is on — stranded the
tag: a re-run could not get past that line, and recovery meant deleting the
Release and the tag by hand. `docs/13 §7` documents the manual escape; this
removes the need for it in the common case.

`continue-on-error` because the reusable exits 1 on "No webhooks configured"
when both Discord secrets are unset — which §5 lists as optional. On the real
v1.0.0 run the Release, the zip and `SHA256SUMS.txt` all published correctly
and the run still showed red. A red run on a good release trains you to ignore
the colour, so the notification must not be able to fail the release.

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
    if: github.event.workflow_run.conclusion == 'failure'
    continue-on-error: true
    uses: poli0981/.github/.github/workflows/notify-ci-failure.yml@main
    permissions:
      contents: read
      actions: read
    secrets: inherit
```

The reusable filters to `conclusion == 'failure'` on the default branch
internally, so the caller's `if:` is redundant *for behaviour* — but not for
cost, and not for the failure below.

⚠️ **The reusable declares `DISCORD_CI_WEBHOOK` as `required: true`**, which
GitHub validates before any of the reusable's own logic runs. With the secret
unset (`00 §10.6`), the caller therefore failed on **every** CI completion —
success or failure — from the first push after this file landed. The `if:` stops
it being called on green runs at all, and `continue-on-error` keeps a missing
optional webhook from turning a genuine CI *failure* into two failures.

This is the same reasoning as `2.3`'s `continue-on-error` on `announce`, learned
the same way: a notification must never be able to change the colour of the
thing it is reporting on, because a run that is red for a reason nobody acts on
teaches everyone to stop reading the colour.

## 3. Chrome Web Store publishing automation

WXT ships publishing built-in: **`wxt submit`** (wrapping
`publish-browser-extension`). One-time local setup: `npx wxt submit init`
→ walks through creating the Google Cloud OAuth client + refresh token →
produces the four values above → store as **repo Actions secrets**.

**Gating policy:**

| Version | Method |
|---|---|
| v1.0.x | **Manual**, per the `13 §1b` runbook: download the zip from the GitHub Release (not the CI artifact — the Release asset is the one `SHA256SUMS.txt` covers) → Dashboard → Package → upload new package → submit. The original rationale was "first reviews often ask questions"; in the event the first review asked nothing. It stays manual because none of the four `CHROME_*` secrets exists yet and `CWS_AUTOPUBLISH` is unset. |
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

Only the repo-visible items can be verified from a checkout; the rest live in
GitHub settings and stay ⚠️ until the owner confirms them. An unticked box here
means "unknown", not "not done".

- [ ] ⚠️ Branch protection on `main`: require CI, require review, linear
      history. Required checks are the **job** names — `Quality gates` and
      `Build + package` — not the workflow name. (Both strings match `ci.yml`.)
- [x] CodeQL **Default setup DISABLED** (Settings → Advanced Security) —
      confirmed 2026-07-26; `codeql.yml` uploads SARIF cleanly, which is only
      possible with it off (§2.2).
- [ ] ⚠️ Actions secrets: the four `CHROME_*` values (after `wxt submit init`).
      `CHROME_EXTENSION_ID` is already known — it is the published item id in
      `00 §9`. Required before `CWS_AUTOPUBLISH` can be flipped for v1.1.
- [ ] ⚠️ Actions secrets for Discord notifications. **`DISCORD_CI_WEBHOOK` is
      not optional in practice** — see §2.4. The rest are:
      `DISCORD_RELEASES_WEBHOOK`, `DISCORD_REPO_WEBHOOK`, `DISCORD_PING_ROLE_ID`.
- [ ] ⚠️ Repo variable `CWS_AUTOPUBLISH=false` initially. Note that when the
      variable does not exist the expression is simply false, so "not configured"
      and "configured off" are indistinguishable from a run's output.
- [x] Dependabot: npm weekly, grouped dev minor+patch, `github-actions` too —
      `.github/dependabot.yml`. Note it has no awareness of the `package.json`
      `overrides` block, so those six pins must be reviewed by hand (`09 §3.1`).
- [x] Issue templates: `.github/ISSUE_TEMPLATE/` — bug, parser report (requires
      a sanitized sample), translation, feature, plus a `config.yml` chooser.
      Landed 2026-08-03; `13 §6` had asserted they existed since before launch.
- [ ] ⚠️ GPG signing required for tags (matches tracker-repo practice). The
      `v1.0.0` tag object is in fact PGP-signed, so the practice held once.
