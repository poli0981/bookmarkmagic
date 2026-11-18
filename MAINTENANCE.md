# Maintenance

**Status: maintenance mode, since 2026-11-18.**

BookmarkMagic does what it set out to do: import, export and edit bookmarks
between browsers — offline, with two permissions and no network access. From
here the project is **maintained, not extended**. That is not abandonment: it
means keeping the extension correct, safe and current matters more than adding
to it, and every change still reaches people through a store review.

This file is the policy. The reasoning behind it is in the decision log of
[`docs/15_ROADMAP.md`](docs/15_ROADMAP.md).

## What is still done

1. **Dependencies, on a schedule.** Dependabot proposes updates weekly, for npm
   and for the GitHub Actions the workflows use, and only for releases that
   have been public for at least seven days. Each is merged after CI and the
   follow-up the docs ask for ([`docs/01 §6`](docs/01_TECH_STACK.md)).
2. **Security, urgently.** An advisory rated **high or critical** against any
   dependency — or a serious security problem in the toolchain itself, Node.js
   for example — is fixed as soon as a fixed version exists. While none exists,
   [`docs/09 §3.1`](docs/09_SECURITY_PRIVACY.md) records the advisory and why it
   cannot reach a user, until the fix lands. To report a vulnerability, follow
   [`SECURITY.md`](SECURITY.md).
3. **Major upgrades of the platform.** A new major of the language, runtime or
   framework — Node.js 24 → 26, TypeScript 6 → 7, a major of WXT or Svelte — is
   adopted on purpose, in its own pull request, with the docs updated first.
4. **Defects.** Bugs, UI/UX defects and accessibility barriers
   ([`ACCESSIBILITY.md`](ACCESSIBILITY.md)). A bookmark file that will not
   import is the most useful report there is
   ([`CONTRIBUTING.md`](CONTRIBUTING.md)).
5. **Language.** Translation fixes: wording that is wrong for a language, or
   for a region's culture or usage, and spelling mistakes that could mislead
   someone. The translation form is the way in.
6. **Roadmap features, and necessary ones.** A feature that is already on the
   roadmap ([`docs/15`](docs/15_ROADMAP.md)) can still land, and so can a change
   that is genuinely needed — to fix a defect, to remove a barrier, or to keep
   the extension working in a browser it is published for.

## What is not

**New features outside the roadmap.** Requests for them are closed
automatically, by [`.github/workflows/triage.yml`](.github/workflows/triage.yml):

- An issue opened with the **Suggest a feature** form whose first answer is
  "Something new — not on the roadmap" is labelled `maintenance-mode`, gets a
  comment that links here, and is closed as *not planned*. The form's other two
  answers — on the roadmap, or needed for a fix — keep the issue open, labelled
  `needs-triage`, for the maintainer to read.
- A pull request from outside the project whose title starts with `feat`
  (Conventional Commits) is labelled and closed the same way. Open a feature
  request first.
- The maintainer can label any issue `enhancement` to close it the same way.

Nothing is deleted. Every closed request is read, and one that fits this
policy is reopened and labelled `roadmap`, which the automation leaves alone.

**Ideas** are welcome in
[Discussions › Ideas](https://github.com/poli0981/bookmarkmagic/discussions/categories/ideas),
where they can be talked through without an issue that has to be accepted or
refused.

Out of scope permanently, maintenance mode or not: cloud sync, accounts,
analytics of any kind, and anything that would need a new browser permission —
the never list in [`docs/15`](docs/15_ROADMAP.md).

## Releases

A **patch** ships when there is something to fix: a file that will not import,
a data-integrity defect or a dead end, an accessibility barrier, a batch of
translation fixes, or a dependency advisory. A **minor** carries a roadmap
feature, a new UI language or a change to the permissions
([`docs/12 §4`](docs/12_CI_CD.md)). There is no fixed schedule.

Your browser updates the extension by itself once a new version passes store
review; there is nothing to do.

## Supported versions

The latest version published on each store. See [`SECURITY.md`](SECURITY.md).

## Changing this policy

Through a pull request like any other, recorded in `docs/15`'s decision log
and announced in Discussions.
