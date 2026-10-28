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

**This chapter no longer copies the workflow YAML** (decided 2026-10-28). It
used to, and the copies drifted three times: a Dependabot bump moved
`actions/setup-node` v6 → v7 in `.github/workflows/` and never touched this doc,
the `check:manifest` step added to the release job in `674ac34` was missing
here, and a copy kept `continue-on-error` after the file had dropped it.
Because docs win over code in this project, a stale copy is a standing
invitation to "reconcile" a pinned action backwards or delete a security gate.
**The workflow files are the ground truth about themselves.** What follows is
what a YAML file cannot say: why each job exists, what it must keep doing, and
the traps already stepped in.

Common to every job since v1.1.0:

- `actions/checkout` with `persist-credentials: false` — no job pushes, so no
  job leaves a token in `.git/config`.
- `actions/setup-node` with `node-version-file: .nvmrc` (Node 26, `01 §2`).
  The ops reusable takes a string input and cannot read the file, so `ci.yml`
  passes it `'26'` — keep the two equal by hand.
- `npm ci --ignore-scripts`, then `npx --no-install wxt prepare`. No dependency
  gets to run code at install time (SonarCloud S6505); our own `postinstall` is
  the one script we need, so it runs explicitly, from the local binary, never
  fetched. A local `npm ci` still runs `postinstall` normally. **One exception
  we do not control:** the `build` job delegates to the ops reusable, which runs
  a plain `npm ci`, so install scripts do run there. That job holds a read-only
  token and no secrets; an ops-repo input to skip install scripts is on the
  `15` backlog.
- Reusable workflows get **named** secrets, never `secrets: inherit`: they are
  pinned to the ops repo's moving `main`, so each one receives only what it
  declares.

### 2.1 `ci.yml` — every push/PR to `main`

Three jobs. The two whose names branch protection requires (§5) are
`Quality gates` and `Build + package / build`.

- **`quality` — "Quality gates".** Local, because the ops reusable runs no
  quality gates at all (§1). In order: `lint`, `check` (svelte-check on the
  TS 6 API, then the TS 7 `tsc`), `knip`, `coverage` (`11 §1` thresholds),
  `guard` (`08 §3`), `npm audit --omit=dev --audit-level=low` (the
  zero-runtime-dependencies claim, `09 T5`), `build`, `check:manifest`. The last
  two exist because the unit test over `wxt.config.ts` proves what we *asked*
  for and only the built manifest proves what WXT *emitted* — a dev build of
  the same config carries `tabs`/`scripting`/`host_permissions`.
- **`windows` — "Windows smoke (guard + unit tests)".** Not required. The owner
  develops on Windows, and the failures that only happen there — drive letters
  and percent-encoding in script paths, CRLF checkouts — had no CI coverage.
- **`build` — "Build + package".** Delegates packaging to
  `reusable-chrome-extension.yml` with `package-manager: 'npm'`,
  `node-version: '26'`, `build-command: 'npm run build'`,
  `source-dir: '.output/chrome-mv3'`, `release: false`. All four are required in
  practice: leaving `package-manager` at its `'none'` default skips install and
  build, then fails on `test -f ./manifest.json`, a file WXT never writes to the
  repo root.

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
drift between the two (`10 §3`).

### 2.2 `codeql.yml`

Calls the current reusable, `reusable-codeql.yml` (CodeQL Action v4). Its input
is `languages` — a **JSON array encoded as a string**
(`'["javascript-typescript"]'`), not the singular `language` of the older
`codeql.yml`. Weekly schedule plus push/PR to `main`; the permission block
(`security-events: write`, `actions: read`, `contents: read`, `packages: read`)
is repeated on the job because reusable workflows do not inherit it.

⚠️ **Prerequisite:** repo Settings → Advanced Security → CodeQL **"Default
setup" must be DISABLED**, or this advanced-setup workflow is rejected at SARIF
upload time.

### 2.3 `release.yml` — on tag `v*`

Standalone, **not** the ops reusable: the reusable's `release` job only does
`gh release create --generate-notes`. It produces no `SHA256SUMS.txt` (required
by `09 §5`), performs no store submission, and exposes no `outputs:`, so a
caller cannot reference the zip it built.

Four jobs, least privilege first (split 2026-10-28):

| Job | Token | Does |
|---|---|---|
| `build` "Gate + package" | `contents: read` | install, **every CI gate again** (a tag skips the branch triggers, and must never ship what a PR would have blocked), `zip`, `check:manifest`, the tag ↔ manifest version check, `SHA256SUMS.txt`; copies both files into a plain `dist/` and uploads that as the artifact `release-<tag>` — `upload-artifact` skips hidden paths such as `.output/` by default, which failed the first v1.1.0 tag run before any Release existed |
| `publish` "GitHub Release" | `contents: write` | downloads the artifact, `sha256sum -c` it, creates the Release with `--verify-tag` (or re-uploads to an existing one). Installs nothing and runs no repository code — the only job that ever holds a write token |
| `store` "Publish to Chrome Web Store" | `contents: read` | only when the repo variable `CWS_AUTOPUBLISH` is `'true'`: `./node_modules/.bin/wxt submit` with the Release asset — the local binary, never `npx wxt`, which may fetch an unpinned package into an environment holding the four `CHROME_*` secrets (SonarCloud S6505/S8543) |
| `announce` | `contents: read` | Discord, only when `DISCORD_ANNOUNCE` is `'true'` |

Before the split, one job ran `npm ci` — every dependency's install script plus
our own tests — while holding `contents: write`, with the token also left in
`.git/config` by checkout.

**The Release step is idempotent deliberately.** `gh release create` fails
outright when a Release for the tag already exists, so any failure *after* it —
realistically the store job, once `CWS_AUTOPUBLISH` is on — stranded the tag: a
re-run could not get past that line, and recovery meant deleting the Release
and the tag by hand. `docs/13 §7` documents the manual escape; this removes the
need for it in the common case.

The announcement is gated because the reusable exits 1 on "No webhooks
configured". On the real v1.0.0 run the Release, the zip and `SHA256SUMS.txt`
all published correctly and the run still showed red. A red run on a good
release trains you to ignore the colour, so the notification must not be able
to fail the release.

⚠️ **It is gated with `if:` on a repo VARIABLE, not with `continue-on-error`.**
GitHub **rejects** `continue-on-error` on a job that calls a reusable workflow
(`Property continue-on-error is not allowed`), and a rejected file does not
fail one job — the whole run is a `startup_failure` with zero jobs and no log.
That sat undetected from `5f4c6e7` until 2026-08-03 because the commit landed
after the `v1.0.0` tag and no tag was pushed in between. A variable and not a
secret: secrets cannot be referenced in a job-level `if:`.

⚠️ **The webhook secrets are mapped by name.** This repo stores
`RELEASES_WEBHOOK` and `REPO_WEBHOOK`; the reusable reads
`DISCORD_RELEASES_WEBHOOK` and `DISCORD_REPO_WEBHOOK`. Under the old
`secrets: inherit` the reusable received neither, so the day `DISCORD_ANNOUNCE`
was set the job would have failed on "No webhooks configured". It now passes
each one explicitly under the name the reusable reads — found 2026-10-28 by
comparing the repo's secret list with the reusable's `workflow_call` block.

`tag_override` is **required**: the reusable resolves
`TAG="${INPUT_TAG:-$EVENT_TAG}"` with `EVENT_TAG = github.event.release.tag_name`,
which is empty under `on: push: tags`, so without it the job exits 1 on "No
release tag available". The announcement is a **job inside this workflow**, not
a separate `on: release: [published]` caller, because a Release created by
`gh release create` under the default `GITHUB_TOKEN` emits no event that starts
new workflow runs.

### 2.4 `notify-ci-failure.yml`

Runs on `workflow_run` of CI, gated on
`conclusion == 'failure' && vars.DISCORD_CI_NOTIFY == 'true'`, and passes the
one secret the reusable declares (`DISCORD_CI_WEBHOOK`) by name. The reusable
declares that secret `required: true` and GitHub validates it before any of the
reusable's own logic, so without the gate this caller failed on **every** CI
completion, success included. `DISCORD_CI_WEBHOOK` exists (set 2026-07-26); the
variable is still unset, so notifications stay off until the owner opts in. A
notification must never be able to change the colour of the thing it reports
on.

### 2.5 `sonarcloud.yml` — SonarCloud CI analysis

Added 2026-10-28, replacing SonarCloud's Automatic Analysis so the project gets
**coverage** and a scan of exactly what CI builds. Project
`poli0981_bookmarkmagic`, organisation `poli0981`; settings live in
`sonar-project.properties`.

- **A separate workflow, not a job in `ci.yml`:** a Sonar outage or a
  quality-gate opinion must never turn CI red. The verdict reaches PRs as the
  SonarCloud GitHub App's own check. It is not a required check.
- **Two jobs, so the token never shares a runner with dependency code.** A
  job's secrets are loaded into its runner for the whole job, and any step can
  read them from the runner process whatever its own `env:` says (the shape of
  the March 2025 tj-actions compromise). `coverage` does the common install and
  `npm run coverage` with **no secret**, and uploads `coverage/lcov.info` and
  the generated `.wxt/` (which `tsconfig.json` extends, and which defines the
  `@/` alias) as a one-day artifact; `scan` installs nothing — full-history checkout
  (`fetch-depth: 0`, for new-code detection), the artifact, then the scan with
  `-Dsonar.projectVersion=<package.json version>`, so "new code" means "since
  the last release".
- The price of that isolation: the scan job has no `node_modules`, so Sonar's
  type-aware rules resolve our own modules (through `.wxt/`) but not the
  dependencies' types.
- The scan action is **pinned to a commit** (`v8.3.0`): it is the step that
  holds `SONAR_TOKEN`. Dependabot and fork PRs get no repository secrets, so the
  scan is skipped with a notice instead of failing.
- Coverage: `vitest.config.ts` measures every `src/**/*.ts` module and reports
  `text` + `lcov`; the CI *gate* is still the core-only glob threshold of
  `11 §1`. `sonar.coverage.exclusions` drops components, entrypoints and
  scripts — the same split as `11 §1`, where those are covered by the manual
  pass and the script tests. The three locale files are excluded from
  duplication detection: they are parallel by design.
- No `sonar.qualitygate.wait`: an unreviewed Security Hotspot can only be
  cleared by a person in the Sonar UI, and a CI step that waits on a human is a
  step that is red for a reason nobody can fix from the repo.

⚠️ **Prerequisite:** Automatic Analysis must be **off** in the SonarCloud project
(Administration → Analysis Method). With it on, the scanner refuses to run.

Snyk is connected only as a GitHub App (the `security/snyk (poli0981)` PR
check); there is no `SNYK_TOKEN` and no Snyk step in any workflow.

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

- [x] Branch protection on `main` — configured 2026-08-03. Two corrections to
      what this line used to say, both learned by applying it:
      - **Required checks are `Quality gates` and `Build + package / build`.**
        The old text said `Build + package`, the job name in `ci.yml`. That is
        not what gets reported: a job that *calls a reusable workflow* publishes
        its check as `<caller job> / <reusable job>`. Requiring the caller's
        name alone matches nothing, so every PR waits forever on a check that
        can never arrive — `main` becomes permanently unmergeable.
      - **`required_approving_review_count: 0`, not 1.** "Require review" is
        right for a team and a lockout for one maintainer, who cannot approve
        their own pull request. Zero still forces every change through a PR and
        through the checks above; it only drops the second pair of eyes that
        does not exist. Raise it the day a second maintainer does.

      Also set: linear history (matches the rebase-merge practice), no force
      pushes, no branch deletion, conversation resolution required. **Admins are
      deliberately NOT enforced** — with a single maintainer, an escape hatch
      from your own protection rules is the difference between a safety net and
      a locked door.
- [x] CodeQL **Default setup DISABLED** (Settings → Advanced Security) —
      confirmed 2026-07-26; `codeql.yml` uploads SARIF cleanly, which is only
      possible with it off (§2.2).
- [ ] ⚠️ Actions secrets: the four `CHROME_*` values (after `wxt submit init`).
      `CHROME_EXTENSION_ID` is already known — it is the published item id in
      `00 §9`. Required before `CWS_AUTOPUBLISH` can be flipped for v1.1.
- [x] Actions secrets for Discord notifications — **present as of 2026-10-28:**
      `DISCORD_CI_WEBHOOK`, `RELEASES_WEBHOOK`, `REPO_WEBHOOK` (the last two under
      names the reusable does not read; `release.yml` maps them, §2.3).
      `DISCORD_PING_ROLE_ID` is optional and unset.
- [x] `SONAR_TOKEN` — set 2026-10-28, used only by `sonarcloud.yml` (§2.5).
- [ ] ⚠️ SonarCloud **Automatic Analysis OFF** (SonarCloud → bookmarkmagic →
      Administration → Analysis Method). Required for §2.5; with it on, the CI
      scan errors out. The owner agreed to switch it off on 2026-10-28.
- [x] Private vulnerability reporting **enabled** (verified 2026-10-28 via the
      API) — `SECURITY.md` and the issue chooser send reporters there first.
- [ ] ⚠️ Repo variable `CWS_AUTOPUBLISH=false` initially. Note that when the
      variable does not exist the expression is simply false, so "not configured"
      and "configured off" are indistinguishable from a run's output.
- [ ] ⚠️ Repo variables `DISCORD_ANNOUNCE` and `DISCORD_CI_NOTIFY` — both still
      unset (2026-10-28), so no notification fires. The webhook secrets now
      exist, so either can be flipped to `true` whenever the owner wants the
      posts. Unset means skipped; a reusable-workflow caller cannot use
      `continue-on-error` to absorb a failure (§2.3).
- [x] Dependabot: npm weekly, grouped dev minor+patch, `github-actions` too —
      `.github/dependabot.yml`. Both ecosystems have a 7-day `cooldown`
      (matching `.npmrc` `min-release-age=7`, `09 §3.1`); WXT is excluded from
      the group so every WXT bump arrives alone and gets its built-manifest
      diff; majors of the TypeScript pair and `@types/node` are ignored.
- [x] Issue templates: `.github/ISSUE_TEMPLATE/` — bug, parser report (requires
      a sanitized sample), translation, feature, plus a `config.yml` chooser.
      Landed 2026-08-03; `13 §6` had asserted they existed since before launch.
- [ ] ⚠️ GPG signing required for tags (matches tracker-repo practice). The
      `v1.0.0` tag object is in fact PGP-signed, so the practice held once.
