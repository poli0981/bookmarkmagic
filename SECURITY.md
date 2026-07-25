# Security Policy

## Reporting a vulnerability

Report privately via **GitHub Security Advisories**:
<https://github.com/poli0981/bookmarkmagic/security/advisories/new>

Please do not open a public issue for a security problem.

Include, where possible: the affected version, a description of the impact, and
a minimal reproduction. If a bookmark file triggers the issue, attach a
**sanitized** sample — replace real URLs and titles with placeholders.

## Response targets

| Stage | Target |
|---|---|
| Acknowledgement | 72 hours |
| Fix or mitigation for High/Critical | 14 days |

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
