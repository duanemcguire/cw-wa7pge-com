# TODO: "My Phrases" practice tool

## Original notes

create a new practice tool.

place menu item below "phrase flow/ifr"

New area:  "My Phrases"

"My Phrases" exercise will be functionally equivalent to the Phrase Flow Exercises

Users will be able to create edit and maintain up to 10 named phrase files in local storage.  Like files in api/app/routes/phrases/text_files the local files will be organized as one phrase per line.

---

## Development plan

### Decisions made

- **Two pages.** `/phrases/my-phrases` is the practice exercise (a clone of Phrase
  Flow whose Collection dropdown lists the user's local files, with no Category
  dropdown). `/phrases/my-phrases/edit` manages the files.
- **Backup affordances:** export/import to a file, seed a new file from any
  built-in collection, and paste-in bulk add/append.
- **No share button.** Local files can't travel by URL; the settings alone aren't
  worth a share link.
- **No database, no server-side storage.** Everything lives in `localStorage`.
  The server only renders two templates.

### 1. Storage layer — `api/app/static/js/my-phrases.js` (new)

A small module in the style of `form-state.js`. Single localStorage key
`cw:myphrases:v1` holding all files (10 files of a few hundred short lines is
far under the ~5 MB quota, so there's no reason to shard per file):

```js
{ version: 1,
  files: [ { id: "f_1a2b3c", name: "My Ragchew", lines: ["hows the wx there", ...],
             updated: 1757300000000 } ] }
```

API: `MAX_FILES = 10`, `list()`, `get(id)`, `create(name, lines)`,
`update(id, {name, lines})`, `remove(id)`, `exportBlob()`, `importJson(text, mode)`.
Writes are wrapped in try/catch so a `QuotaExceededError` surfaces as a message
instead of silently dropping the user's work.

**`simplifyCwLine(line)` — a JS twin of the server's Python normalizer.**
This is the one piece that is easy to miss. Built-in phrases are cleaned in
`phrases_controller.py:11-28` before they ever reach the browser: `’`→`'`,
`&`→` and `, accents stripped via NFKD, and the `{}[];:\|-_+*&^%$#@!<>`
character class replaced with spaces. Local phrases never pass through that
code, so a pasted em-dash or smart quote would reach `jscwlib` unnormalized.
Port the same rules with `String.prototype.normalize('NFKD')` and a regex, and
apply them at playback time (not on save) so the editor keeps showing the user
what they typed.

Validation on save: name required, unique, ≤ 40 chars; blank lines dropped;
≤ 2000 lines per file and ≤ 200 chars per line.

### 2. Routes — `api/app/routes/phrases/phrases_controller.py`

Two thin routes. **Do not call `getPhraseAttr()`** — it reads the filesystem and,
worse, calls `os.chdir()` (line 39), which mutates process-wide state we don't
need here. Both routes only need the option lists:

```python
WPM_OPTIONS = [12,14,16,18,20,22,25,27,30,31,40]
WS_OPTIONS  = ["1","1.2","1.4","1.6","1.8","2","2.2","2.4","2.6","2.8","3.0"]
```

Lift these to module constants — they're already duplicated at lines 111-112 and
line 127 — then:

- `@phrases.route('/my-phrases')` → `phrases/my-phrases.html`, passing
  `wpm_options`, `ws_options`, default wpm 20 / ws "1" / repetitions "1".
- `@phrases.route('/my-phrases/edit')` → `phrases/my-phrases-edit.html`.

No new server API is needed: the "copy from a built-in collection" feature reuses
the existing `/phrases/api/index` and `/phrases/api/data` endpoints
(lines 204-231), which already return normalized lines as JSON.

### 3. Practice page — `api/app/templates/phrases/my-phrases.html` (new)

Start from `phrase-flow.html` and change only what has to change:

- Drop the Category `<select>` and the share-link `<span>` (line 17).
- Populate the Collection `<select>` from `MyPhrases.list()` on load instead of
  from Jinja; `change` reads that file's lines out of localStorage rather than
  fetching `/phrases/api/data`.
- Keep WPM / Repetitions / Word Spacing, the `wordSpace` ms readout, Play/Stop,
  the `VVV` prefix and ` = ` separator, `getLine()`'s repetition logic, and
  `FormState.autoSave(['wpm','ws','repititions','selectCollection'])` — so it
  really is functionally equivalent.
- Run every line through `MyPhrases.simplifyCwLine()` in `getLine()`.
- **Empty state:** with zero files, hide the controls and show
  "You haven't created any phrase files yet →  Create one" linking to the editor,
  with Play disabled. This is also how the editor gets discovered.
- Add a persistent "Edit my phrases →" link next to the Play/Stop buttons.
- `gtag` events: `cw_session_start` / `cw_session_stop` with `tool:'my_phrases'`.
  Send `line_count` and the file's ordinal position — **not** the file name or
  contents, which are user-authored text and shouldn't go to Analytics.
- Keep the instructional panel, reworded for user-supplied material.

### 4. Editor page — `api/app/templates/phrases/my-phrases-edit.html` (new)

```
Files (3 / 10)              ┌──────────────────────────────┐
 • My Ragchew               │ hows the wx there            │
 • POTA exchanges           │ rig is ic 7300               │
 • Numbers drill            │ ant is a dipole up 30 ft     │
[+ New] [Rename] [Delete]   └──────────────────────────────┘
                            [Save]  [Revert]     42 phrases

Start from a built-in collection
  Category [Common Phrase ▾]  Collection [Level I ▾]   [Replace] [Append]

Paste phrases (one per line)
  ┌────────────────────────────┐
  │                            │   [Replace] [Append]
  └────────────────────────────┘

Backup   [Export all to file]   [Import from file…]
```

- The main editor is a plain `<textarea>`, one phrase per line — which covers
  paste-in editing directly. The separate paste box exists so a paste can
  *append* without the user having to hand-merge text.
- Unsaved-changes guard on switching files and on `beforeunload`.
- "Start from a built-in collection" fetches `/phrases/api/index` for the two
  dropdowns and `/phrases/api/data` for the lines.
- Export: `Blob` download named `my-phrases-YYYY-MM-DD.json`. Import: file input,
  validate the shape, then prompt merge-vs-replace and enforce the 10-file cap
  (report what was skipped rather than silently truncating).
- "← Back to practice" link.

### 5. Menu — `api/app/templates/base.html`

One entry immediately after the Phrase Flow/IFR line (line 112):

```html
<li><a href="/phrases/my-phrases">My Phrases</a></li>
```

The editor is reached from the practice page rather than the sidebar — a second
sidebar entry for an editor most visitors won't have data for adds clutter, and
the empty state already routes first-time users there. (If you'd rather have it
in the sidebar, use the nested `<ul>`/`class="opener"` pattern the Books entry
uses at lines 114-122.)

### 6. Offline / PWA — `api/app/static/sw.js`

- Add `/static/js/my-phrases.js` to `STATIC_ASSETS` (line 19).
- Add `/phrases/my-phrases` and `/phrases/my-phrases/edit` to `PAGE_SHELLS`
  (line 49).
- Bump `CACHE_VERSION` from `'cw-v6'` to `'cw-v7'` (line 4) so existing installs
  pick up the new shells.

Because the phrase data is local, this tool works fully offline with no data
warm needed — a nice property worth calling out in the user guide.

### 7. User guide — `api/app/templates/user-guide.html`

Add a `Practice Tool: My Phrases` section after the Phrase Flow / IFR section
(line 99), matching the existing `<h3>` + anchor style. Cover: the 10-file limit,
one phrase per line, that files live in this browser only, and that Export is
how you move them to another device or guard against clearing site data.

### 8. Verification

`api/tests/` currently contains only `models/` — there are no route tests to
extend, so verification is manual via `make dev`:

1. Empty state renders and Play is disabled.
2. Create → save → the file appears in the practice page's Collection dropdown.
3. Playback matches Phrase Flow at the same WPM/spacing/repetitions.
4. Paste text containing `—`, `’`, `&`, `[` and an accented word; confirm it
   sounds correct (normalizer working) and still *displays* as typed.
5. Hit the 10-file cap; confirm New is blocked with a clear message.
6. Export, clear localStorage, import, confirm round-trip.
7. Delete and rename, including the currently-selected practice file.
8. Reload with DevTools offline; confirm both pages load from the service worker.

### Files touched

| File | Change |
| --- | --- |
| `api/app/static/js/my-phrases.js` | new — storage + CW normalizer |
| `api/app/templates/phrases/my-phrases.html` | new — practice page |
| `api/app/templates/phrases/my-phrases-edit.html` | new — editor |
| `api/app/routes/phrases/phrases_controller.py` | +2 routes, lift option-list constants |
| `api/app/templates/base.html` | +1 menu item |
| `api/app/static/sw.js` | +2 shells, +1 asset, bump cache version |
| `api/app/templates/user-guide.html` | +1 section |


### Revision 1
- When a phrase file is all single words, eliminate the "="  (<BT>) break between phrases on playback

- Phrase editor: 
   - the text at the top of the current list should read:  Phrases - edit with one of the tools below
   - Put the paste block tool first and the from built-in second
   - Prompt in the paste phrases area should be "Type or past a block of text, one phrase per line"
   - include the explanation text  of the replace/append buttons in both tools. 
- since we have an export to json, we should also have an import from json

#### Revision 1 — done

- **Single-word files play with no `=` break.** Detected per file in `loadLines()`:
  true when every line, *after* the same transform playback uses, contains no
  space. So a hyphenated word (the hyphen becomes a space) or a `(…)` phrase
  counts as multi-word and keeps the break. When it's true, `playNext()` sets
  `prefix = ''` between items — the same thing Word Building/TTR does
  (`ttr.html:167`), rather than a new convention.
- **Editor:** heading now "Phrases — edit with one of the tools below"; Paste
  phrases moved above Start from a built-in collection (JS sections moved to
  match); paste prompt reads "Type or paste a block of text, one phrase per
  line"; both tools now spell out what Replace and Append do and that nothing
  is stored until Save.
- **Import from JSON was already built** in the first pass — the Backup block
  had a mode dropdown and a file input, which is easy to miss because a bare
  `<input type="file">` just says "Choose File". Not rebuilt; relabelled as
  "Backup — export and import" with an explicit Import paragraph.
- Also added a "Word lists" paragraph to the user guide covering the dropped
  `BT`.