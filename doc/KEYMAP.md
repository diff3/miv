# MIV Keymap

This document contains the full MIV command list and the behavior of each command in NAV mode.

## Modes

- `ESC` enters `NAV` mode.
- `i` enters `INSERT` mode.
- `Space` enters `INSERT` from an empty NAV buffer.
- In `INSERT`, press `ESC` to return to `NAV`.

## Motion

- `a` moves one character left.
- `d` moves one character right.
- `w` moves one line up.
- `s` moves one line down.
- `W` scrolls one page up.
- `S` scrolls one page down.
- `A` moves to the start of the line.
- `D` moves to the end of the line.
- `q` moves one word left.
- `e` moves to the end of the next word on the right.
- `Q` moves to the end of the previous word on the left.
- `E` moves to the start of the next word on the right.
- `g` jumps to line 1.
- `[count]g` jumps to the specified line number.
- `G` jumps to the bottom of the document.
- Counts work with motions, for example `10w`, `5a`, and `25g`.

## Editing

- `x` deletes the character to the right of the cursor.
- `[count]x` deletes multiple characters.
- `X` deletes the next word.
- `B` deletes from the cursor to the end of the line.
- `b` deletes the current line.
- `[count]b` deletes multiple lines.
- `y` yanks the current line.
- `[count]y` yanks multiple lines.
- `Y` yanks the next word.
- `[count]Y` yanks multiple words.
- `p` pastes after the cursor.
- `P` pastes before the cursor.
- `r<char>` replaces the character under the cursor with `<char>`.
- `R` deletes the current word and enters `INSERT`.
- `§` toggles the case of the character under the cursor.
- `shift+§` toggles the case of the word under the cursor.
- `-` changes to the end of the line and enters `INSERT`.
- `_` changes the whole line and enters `INSERT`.
- `%` jumps to the matching bracket.
- `&` joins the current line with the next line.
- `I` moves to the start of the line and enters `INSERT`.
- `k` moves to the end of the line and enters `INSERT`.
- `o` opens a new line below and enters `INSERT`.
- `O` opens a new line above and enters `INSERT`.
- `u` undoes the previous change.
- `c` repeats the last repeatable command.
- `.` repeats the last repeatable command.

## Search

- `/text` searches forward for a literal string.
- `\\text` searches backward for a literal string.
- `,pattern` starts a regex search.
- Regex search prompts are shown with the `~` prefix.
- `n` jumps to the next match.
- `N` jumps to the previous match.
- `MIV: Toggle Search Highlight` toggles match highlighting from the command palette.

Regex search uses standard JavaScript regular expressions. Example patterns:

- `code\\b`
- `\\bcode\\b`
- `\\d+`

## Replace

- `=replacement` replaces all matches for the last search pattern.
- `=replacement search` replaces all matches for `search` with `replacement`.
- After a replace rule exists, `c` or `.` applies the current rule to the current or next match.
- After a replace rule exists, `Enter` in `NAV` applies the current rule to the current match.
- After replacement, MIV reports `replaced X matches`.

Examples:

- `/foo` then `=bar`
- `,\\d+` then `=NUMBER`
- `=bar foo`

## Registers

- Registers are numbered `0..9`.
- Register `9` mirrors the system clipboard.
- `1p..9p` pastes from a specific register.
- `[count] [register]y` yanks lines into a register, for example `10 3y`.
- `[count] [register]x` deletes characters into a register, for example `5 2x`.
- `v` opens the register viewer.

Registers store:

- `text`
- `type`, either `charwise` or `linewise`

## Text Objects

Text object commands operate on the contents inside a delimiter pair.

Supported objects:

- `!` automatic surrounding object
- `"`
- `'`
- `(`
- `[`
- `{`
- `<`

Supported forms:

- `!y`
- `!x`
- `!p`
- `" 3y`
- `( 2x`
- `{ 5p`

Object actions:

- `y` yanks inside the object.
- `x` deletes inside the object.
- `p` replaces inside the object from the current register.

Delimiter matching is intentionally simple:

- Scan left to the nearest opening delimiter.
- Scan right to the first matching closing delimiter.
- Nested delimiter resolution is not performed.

## Helpers

- `Alt+a` navigates back in editor history.
- `Alt+d` navigates forward in editor history.
- `Alt+z` sets an anchor.
- `Alt+x` jumps to the current anchor.
- `Ctrl+f` opens VS Code Find.
- `Ctrl/Cmd+C` mirrors the clipboard into register `9`.
- `Ctrl/Cmd+V` pastes through the MIV paste path.
