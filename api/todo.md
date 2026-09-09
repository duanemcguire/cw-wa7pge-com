In My Phrases:
- eliminate parenthetical count of items in list on the display
- disallow use of edit blocks when the list of files is empty or no file is selected.
- Change text "Phrases — edit with one of the tools below" to "{filename} Phrases — edit with one of the tools below"
- provide warning when a list as characters other than alphanumeric plus these punctuation marks:  ".,/-=" , e.g. "Warning: The following characters are unusual for Morse code: {list} "

## Done

- **Parenthetical counts gone** from the practice page's Collection dropdown, the
  editor's file list, and the phrase-count that sat beside the editor heading.
  Kept `Files (3 / 10)` — that one is the cap indicator, not an item count.
- **Edit blocks inert with no file selected.** `setEditingEnabled()` now disables
  the inputs too (paste textarea, both seed dropdowns) not just the buttons, and
  dims both blocks via `.tool-block.needs-file`. Export/Import and `+ New` stay
  live — Import is the only way back if you have no files at all. Dropped the old
  "Seed/Replace with no file creates one named after the collection" path, which
  this makes unreachable.
- **Heading** is now `{filename} Phrases — edit with one of the tools below`, set
  with `textContent` since the name is user text. With nothing selected it reads
  `No file selected — create or select a phrase file`.
- **Unusual-character warning** live under the textarea as you type. Allowed set
  is the one constant `MORSE_OK` in `my-phrases.js`; advisory only, never alters
  what is stored or sent.

### Open question on the allowed set

`.,/-=` plus alphanumerics flags **13% of this site's own built-in phrases**
(1,942 of 15,381). The top offenders are `'` (574), `(` and `)` (534 each), `–`,
`’`, `:`, `!`, `?` (120), `~` (112).

Two of those are this project's own markup conventions: `(` `)` become ` = ` (BT)
and `~` becomes a space, both handled in playback. And `'` and `?` are real Morse
characters that appear throughout the collections — "How are you?" is the first
line of Common Phrase / Level I, so seeding from a built-in collection warns
immediately.

`?` has since been added to `MORSE_OK`, so the allowed set is alphanumerics plus
`. , / - = ?`. That drops built-in phrases that warn to 12.2% (1,874). The rest
stand as noted; Duane is considering editing the source files instead of widening
the set further.