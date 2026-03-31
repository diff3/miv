# MIV Keymap

This document contains the full MIV command list and the behavior of each command in `NAV`, MIV's command mode.

## Modes

- `ESC` enters `NAV`, MIV's command mode.
- `i` enters `INSERT`, normal typing mode.
- In `INSERT`, press `ESC` to return to `NAV`.
- In `NAV`, `Enter` is handled by MIV and does not insert a new line.
- The status bar shows the current mode and a live command line while you type.

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
- `Alt+Q` jumps to the previous paragraph.
- `Alt+E` jumps to the next paragraph.
- `g` jumps to line 1.
- `[count]g` jumps to the specified line number.
- `m` jumps to 50% of the document.
- `1m..9m` jumps to 10%..90% of the document.
- `G` jumps to the bottom of the document.
- `[count]G` jumps to the line that is `[count]` rows up from the bottom.
- Counts work with motions, for example `10w`, `5a`, and `25g`.

Paragraph rules:

- A paragraph is a contiguous block of non-empty lines.
- One or more empty lines between text blocks count as one separator.

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
- `p` pastes before the cursor.
- `P` pastes after the cursor.
- `r<char>` replaces the character under the cursor with `<char>` and returns to `NAV`.
- `R` deletes the current word and enters `INSERT`.
- `§` toggles the case of the character under the cursor.
- `°` toggles the case of the word under the cursor.
- `-` changes to the end of the line and enters `INSERT`.
- `_` changes the whole line and enters `INSERT`.
- `%` jumps to the matching bracket.
- `&` joins the current line with the next line.
- `I` moves to the start of the line and enters `INSERT`.
- `k` moves to the end of the line and enters `INSERT`.
- `o` opens a new line below and enters `INSERT`.
- `O` opens a new line above and enters `INSERT`.
- `u` undoes the previous change.
- `.` repeats the last repeatable command.

## Search

- `/text` searches forward for a literal string.
- `\text` searches backward for a literal string.
- `,pattern` starts a regex search.
- Regex search prompts are shown with the `~` prefix.
- `n` jumps to the next match.
- `N` jumps to the previous match.
- `MIV: Toggle Search Highlight` toggles match highlighting from the command palette.

Regex search uses standard JavaScript regular expressions. Example patterns:

- `code\b`
- `\bcode\b`
- `\d+`

## Replace

- `=replacement` replaces all matches for the last search pattern.
- `=search replacement` replaces all matches for `search` with `replacement`.
- After a replace rule exists, `.` applies the current rule to the current or next match.
- After a replace rule exists, `Enter` in `NAV` applies the current rule to the current match.
- After replacement, MIV reports `replaced X matches`.

Examples:

- `/foo` then `=bar`
- `,\d+` then `=NUMBER`
- `=foo bar`

## Registers

- Registers are numbered `0..9`.
- Register `9` mirrors the system clipboard.
- `p` pastes from the default register after the cursor.
- `P` pastes from the default register before the cursor.
- `1p..9p` pastes from a specific register after the cursor, for example `3p`.
- `1P..9P` pastes from a specific register after the cursor, for example `3P`.
- `[count] [register]y` yanks lines into a register.
- `[count] [register]x` deletes characters into a register.
- `v` opens the register viewer so you can inspect the current contents of all registers.
- `[register]v` stores the current clipboard in a numbered register, for example `2v`.

Command format:

- The first number is the count.
- The second number is the target register.
- The final letter is the action.
- Counts and registers are separate.
- `2y` means yank 2 lines.
- `10 2y` means yank 10 lines into register `2`.
- `5x` means delete 5 characters.
- `5 3x` means delete 5 characters into register `3`.
- `2p` means paste from register `2`.
- `2P` means paste after the cursor from register `2`.
- `2v` means store the current clipboard in register `2`.

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

## VS Code Commands

Most common VS Code commands still work alongside MIV.

Examples:

- Find
- editor history navigation
- clipboard copy and paste
- command palette actions

In some cases MIV intentionally replaces or remaps a key so it can use it for modal editing.

MIV-specific helper commands:

- `Alt+z` sets an anchor.
- `Alt+x` jumps to the current anchor, then toggles between anchor and the last jump origin.
- `Ctrl+f` opens VS Code Find.
- `Ctrl/Cmd+C` mirrors the clipboard into register `9`.
- `Ctrl/Cmd+V` uses the normal VS Code paste path.
