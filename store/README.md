# Store listing copy

The canonical source for the Chrome Web Store listing text, per `docs/13 §4`.

**Edit these files first, then paste into the dashboard** — a listing edit made
straight into the dashboard has no diff, no history and no reviewer.

⚠️ These files were reconstructed from `docs/13 §3` *after* the listing went
live on 2026-08-03. They are a faithful copy of the specified copy, not a
transcript of what the dashboard currently shows. Until someone diffs the two,
treat the dashboard as authoritative and correct these files, not the listing.

| File | Field |
|---|---|
| `listing.en.md` | Name, summary, description — English is required by CWS and is the canonical version |
| `listing.vi.md` | Vietnamese localized fields |
| `listing.ja.md` | Japanese localized fields |

The summary field is capped at **132 characters** by the dashboard. Each file
records its own count; re-check after any edit, because the limit is enforced at
submission time and a rejection there costs a round trip.

Legal documents are English-only by design (`docs/07 §5`, `docs/14`), so there
is no localized privacy policy to keep in step — the privacy-policy URL is the
same in all three listings.
