# Accessibility

BookmarkMagic should be usable by anyone who has bookmarks to move — with a
keyboard and no mouse, with a screen reader, with a contrast theme, with the
page zoomed, or with animation switched off. This file says what that means
today: what the goal is, what has actually been tested, what is known not to
work well yet, and how to tell us about a barrier.

**Last reviewed:** 2026-11-10, for version 1.2.1.

## The goal

The target is the [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
at **Level AA**.

That is a goal, not a claim. BookmarkMagic has not been audited by an
accessibility specialist, and it does not claim to conform to WCAG. It is
built and tested by one person, and the testing that has been done is listed
below so you can judge it for yourself.

The priorities, in order:

1. **Everything works from the keyboard.** No task needs a mouse.
2. **A screen reader is told what is on screen and what just happened** —
   names, roles, states, and the result of an import.
3. **Nothing depends on colour, motion or a pointer's precision alone.**
4. **Every shipped language is treated the same** — English, Tiếng Việt, 日本語,
   简体中文 and Română. The page's language is declared to the browser, so a
   screen reader picks the right voice.

## Supported environments

| Environment | Status |
|---|---|
| Chrome 136 or later on Windows | Supported, and where the testing below was done |
| Chrome 136 or later on macOS, Linux and ChromeOS | Supported; expected to work the same, not tested for accessibility |
| Edge, Brave, Vivaldi and Opera (the same build) | Best effort — the extension runs there, and accessibility is untested |
| Chrome on Android or iOS | Not applicable: Chrome there does not run extensions |

## What is in place

### Keyboard

Every control is either a tab stop or has a key of its own, and every dialog
can be closed with Esc. Focus shows as a 2-pixel ring on controls; inside the
bookmark tree, the current row is marked by a highlight and a bar at its left
edge.

The bookmark tree on the **Edit** tab is a single tab stop. Inside it:

| Key | What it does |
|---|---|
| ↑ / ↓ | Move to the previous or next row |
| Home / End | Move to the first or last row |
| → | Open a closed folder, or step into an open one |
| ← | Close an open folder, or step out to its parent |
| A letter or digit | Jump to the next row whose title starts with it |
| Enter | Open a bookmark in a new tab; open or close a folder |
| F2 | Rename (Enter saves, Esc cancels) |
| Delete (Fn+Delete on a Mac laptop) | Delete, after a confirmation |
| Menu key, or Shift+F10 | **Move to…** — pick a destination folder from a filterable list |
| Alt+↑ / Alt+↓ | Move the row up or down one place inside its folder |
| Ctrl+C (⌘C on macOS) | Copy the focused bookmark's address |
| Ctrl+F (⌘F on macOS) | Go to the search box, from anywhere on the Edit tab |

The small buttons that appear on a row are shortcuts for the mouse, and are
deliberately not tab stops: Open, Copy link, Rename, Move to… and Delete each
have a key in the table above, and Sort A→Z is also a button on the toolbar.

Alt+↑ and Alt+↓ move a row past the neighbour you can see. While a search is
filtering the tree, that also carries it past any hidden items in between.

Elsewhere: the theme control is a radio group (arrow keys change the choice),
the file drop zone is a button that opens the file picker, and the folder
lists in the import preview and the export picker are ordinary lists with
buttons and checkboxes — Tab, Enter and Space.

### Screen readers

- The Edit tree is an ARIA tree: each row announces its name, its level, its
  position ("3 of 12") and whether it is expanded.
- Dialogs are native `<dialog>` elements. Focus moves in when one opens and
  returns when it closes; a confirmation reads its title and its body, and
  opens with **Cancel** focused, so Enter never confirms a deletion.
- An import is spoken as it goes: reading the file, backing up, writing,
  progress every 10 %, and the result. Failures are announced as alerts.
- Moving a row with Alt+↑ or Alt+↓ announces its new position ("Docs:
  position 2 of 5"). This is new in 1.2.1 and has not yet been checked with a
  screen reader — see "What has been tested".
- When an import moves to its next step, focus moves to that step's heading.
  When a page change removes the control that had focus, focus moves to the
  page's main content rather than back to the top of the page.
- Every icon-only button has a name. Icons themselves are hidden from
  assistive technology.
- The page title names the current section, and the page's language follows
  the language you chose.

### Seeing the page

- **Contrast.** Text is at least 4.5:1 against its background, and control
  borders and the focus ring at least 3:1, in the light and the dark theme. A
  test fails the build if a colour pair drops below that.
- **Contrast themes** (Windows "Contrast themes", `forced-colors`). Since
  1.2.1, the states that were shown only by a fill or a shadow — the focused
  row, where a dragged item will land, the selected theme, the current
  section, the selected option cards, the progress bar, the edge of the file
  drop zone — are drawn with the theme's own colours instead.
- **Zoom.** The layout reflows as the window narrows or the page is zoomed.
- **Light and dark** themes follow the system, or your choice in Settings.
- **Disabled buttons** are marked by colour and cursor, never by fading the
  text until it cannot be read. (Two kinds of button are an exception; see
  the limitations.)
- **Target size.** Since 1.2.1, every button is at least 24 × 24 CSS pixels,
  including the small icon buttons. Checkboxes, radio buttons and links in
  text keep their natural size; their labels are part of the target.

### Motion

If your system asks for reduced motion, nothing moves: no sliding, spinning or
travelling stripes. A test fails the build if an animation is added outside
that rule. Nothing flashes. An error message stays until you dismiss it;
short confirmations leave by themselves after four seconds (see the
limitations below).

## What has been tested

| Check | With | When |
|---|---|---|
| Keyboard only, mouse unplugged | Chrome on Windows 11 | November 2026, version 1.2.0 |
| Screen reader | **Narrator** with Chrome on Windows 11 | November 2026, version 1.2.0 |
| Contrast themes | Chrome with `forced-colors` emulated — not yet a real Windows theme | November 2026, version 1.2.1 |
| What 1.2.1 changed: focus, Alt+↑/↓, button sizes | A scripted keyboard run in Chrome — no screen reader | November 2026, version 1.2.1 |
| Colour contrast of the theme colours, reduced motion, the tree's key handling | Automated tests, on every change | Continuous |

**Not tested**, so we cannot tell you how well they work: anything on macOS,
Linux or ChromeOS; NVDA, JAWS, VoiceOver, ChromeVox and Orca; voice control
(Dragon, Voice Access, Voice Control); switch access; screen magnifiers; and
zoom at 200 %. Narrator has not yet been run over what 1.2.1 added.
If you use one of these, a report of what you found — good or bad — is
genuinely useful.

## Known limitations

These are known, and none of them is by design.

- **Most edits are not announced.** Alt+↑/↓ announces the result; a rename, a
  move to another folder, a sort and a new folder succeed silently. Search
  does not announce how many rows match. A key that cannot act — Alt+↑ on the
  first item of a folder, Delete on one of the three top-level folders — does
  nothing and says nothing.
- **Folders and bookmarks sound alike in the tree.** They differ by an icon a
  screen reader does not read. A folder with something in it announces
  "expanded" or "collapsed"; an empty folder announces neither. The lock on a
  bookmark your organisation manages is also only an icon, and a folder's
  item count is read as a bare number.
- **A focused row may read out its buttons** ("Open, Copy link, Rename…")
  after its name. It is noisy, not broken.
- **Reordering with a pointer needs a drag.** There is a keyboard way
  (Alt+↑/↓) and Sort A→Z, but no click-only way to place one item before
  another.
- **Alt+↑/↓ may not reach the page on a Chromebook**, where the system can turn
  those keys into Page Up and Page Down. On a Mac there is no Menu key (use
  Shift+F10), and the laptop's delete key is Backspace, which the tree does
  not act on (use Fn+Delete).
- **The tree's keys are not shown inside the extension**, apart from Ctrl+F on
  the search box. The table above is the list; the About tab links to this
  file.
- **The toolbar above the tree is announced as a toolbar**, but its buttons are
  reached with Tab, not with the arrow keys a toolbar usually offers.
- **Some hints appear only on mouse hover**: the notes in the status bar, where
  a top-level folder of an imported file will go, and the reason a section is
  unavailable while an import is writing.
- **A section that is unavailable while an import is writing looks the same as
  one that is available**; only the cursor and the hover hint differ. The same
  goes for a tree row's small buttons while a sort or a bulk delete is
  running. A screen reader does announce both as unavailable.
- **Long titles are cut short with "…"** in the tree, and there is no way to
  read the whole title there other than renaming (F2).
- **Headings are sparse.** Sections are landmarks, but the pages have few
  headings to jump between, and there is no "skip to content" link past the
  header's controls.
- **Descriptions in Settings are not tied to their controls**, so a screen
  reader reads the control's name but not the sentence under it.
- **Short notices disappear after four seconds** ("Saved", "Link copied",
  the name of an exported file). They are announced, but they cannot be
  paused. An error stays, though a second error replaces the first.
- **Text size follows zoom, not the browser's font-size setting.** Use
  Ctrl and + to enlarge the page.
- **On the Edit tab, Ctrl+F always goes to BookmarkMagic's own search box**
  rather than the browser's Find.
- **The Japanese, Chinese and Romanian translations have not been reviewed by
  native speakers**, which includes the text a screen reader speaks.

## Reporting a barrier

If something stops you, or just gets in your way, please say so. An
accessibility report is treated as a defect, not a feature request.

- **With a GitHub account:** open an
  [accessibility report](https://github.com/poli0981/bookmarkmagic/issues/new?template=accessibility.yml).
- **Without one:** write to **accessibility@poli0981.dev**.

It helps to include:

- what you were trying to do, and what happened instead;
- the BookmarkMagic version (About tab, or `chrome://extensions`);
- your browser and operating system;
- the assistive technology you use and its version, if any — a screen reader,
  a contrast theme, zoom level, voice control;
- how badly it gets in the way: **blocked** (you could not finish),
  **hard** (you finished, with a workaround), or **annoying**.

You do not need to explain why you use the tools you use, and nobody will ask.

**Please do not send your real bookmarks file**, and check a screenshot or a
recording for bookmark titles before attaching it — your bookmarks are your
browsing history. [`CONTRIBUTING.md`](CONTRIBUTING.md) explains how to
sanitize a file if a particular one is needed.

### What happens next

BookmarkMagic has one maintainer, so these are honest intentions rather than
guarantees:

- A report is acknowledged within about a week.
- A **blocking** barrier is fixed ahead of other work and shipped in its own
  patch release; Chrome then updates installed copies by itself, usually
  within days of the store's review.
- Anything else is scheduled, and added to the list above until it is fixed,
  so the next person can see it is known.
- If a fix is not possible or not planned, you will be told why.
- When a fix ships, you will be asked whether it actually works for you. Your
  answer counts for more than our test.

## For contributors

A change to the interface has to keep the above true.
[`CONTRIBUTING.md`](CONTRIBUTING.md) and the pull-request checklist list what
to check: keyboard, visible focus, names and labels, no meaning carried by
colour alone, reduced motion, contrast themes, and one pass with a screen
reader. The specification behind this statement is
[`docs/06_UI.md` §5](docs/06_UI.md); if a change makes this file wrong, the
same pull request has to correct it.

## Who is responsible

The maintainer, [@poli0981](https://github.com/poli0981), triages
accessibility reports, keeps the limitations list current, and reviews this
statement at every release.

Suggestions for the statement itself are welcome the same way as any other
report.
