# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| The latest version published on the Chrome Web Store | ✅ |
| Anything older | ❌ |

There is no back-porting, and there is nothing for you to do to stay current:
Chrome auto-updates extensions once a new version passes store review. You can
see which version you are running in the extension's **About** tab, or on
`chrome://extensions`.

## Reporting a vulnerability

Report privately via **GitHub Security Advisories**:
<https://github.com/poli0981/bookmarkmagic/security/advisories/new>

No GitHub account? Email **contact@poli0981.dev** instead. Please say up front
that it is a security report.

Please do not open a public issue for a security problem.

Include, where possible: the affected version, a description of the impact, and
a minimal reproduction. If a bookmark file triggers the issue, **sanitize it
first**:

```bash
node scripts/sanitize-bookmarks.mjs your-file.html
```

That replaces every hostname, path, query value and title while preserving the
structure, encoding and timestamp shape a parser bug actually depends on — so
the sanitized file still reproduces the problem. `CONTRIBUTING.md` explains what
it keeps and why. Please do not send us a real bookmarks file; we would rather
have a slow reproduction than your browsing history. Anything you do send by
email is kept only as long as it takes to reproduce and fix the issue, and is
then deleted.

## Response targets

| Stage | Target |
|---|---|
| Acknowledgement | 72 hours |
| Fix prepared for High/Critical | 14 days |
| Fix **reaching users** | the above, plus Chrome Web Store review |

That last row is the honest one: a shipped fix has to pass store review before
Chrome rolls it out, and that step is not ours to control. If a defect is severe
enough to warrant it, we will say so publicly in the advisory so users can
mitigate — for this extension, that generally means "do not import untrusted
files until the update lands".

This is a hobby project with no bounty programme. Credit is given in the
release notes unless you ask otherwise.

## Scope

In scope: the extension's parsing, serialization, storage and UI code in this
repository, and the release/build pipeline.

Out of scope: vulnerabilities in Chrome itself, and issues that require the
user to install a modified build.

## Design notes relevant to reporters

The extension holds exactly two permissions (`bookmarks`, `storage`), makes no
network requests at runtime, ships no remote code, and never loosens the MV3
default Content Security Policy. Imported files are parsed with
`DOMParser('text/html')` into an inert document; nodes from that document are
never adopted into the live DOM, and all file-derived strings reach the UI via
text interpolation only. See `docs/09_SECURITY_PRIVACY.md` for the full threat
model (T1–T8).
