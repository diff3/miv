# miv

Modern Improved Vi for VS Code.

## Modes

- `NAV`: command mode with block cursor
- `INSERT`: normal text input with line cursor
- `Esc`: return to `NAV`
- `Space`: enter `INSERT` from empty NAV buffer

## Core Navigation

- `a` left
- `d` right
- `w` up
- `s` down
- `W` page up
- `S` page down
- `A` line start
- `D` line end
- `q` word left
- `e` word end right
- `Q` word end left
- `E` word start right
- counts work for motions, for example `10w`, `5a`, `25g`

## Editing

- `x` delete character right
- `X` delete word right
- `B` delete to line end
- `b` delete line
- `y` yank line
- `Y` yank word
- `p` paste after
- `P` paste before
- `r<char>` replace character under cursor
- `R` delete current word and enter `INSERT`
- `§` toggle case for the character under cursor
- `shift+§` toggle case for the whole word under cursor
- `-` change to line end and enter `INSERT`
- `_` change line and enter `INSERT`
- `%` jump to matching bracket
- `&` join line with next line
- `i` enter `INSERT`
- `I` line start and enter `INSERT`
- `k` line end and enter `INSERT`
- `o` open line below and enter `INSERT`
- `O` open line above and enter `INSERT`
- `u` undo
- `c` or `.` repeat the last repeatable command
- `g` go to line 1, or `[count]g` for a specific line
- `G` go to bottom of document

## Search

- `/` literal search forward
- `\` literal search backward
- `,` regex search
- regex prompt is shown as `~...`
- `n` next match
- `N` previous match
- search highlights can be toggled from the command palette with `MIV: Toggle Search Highlight`

Regex search supports normal JavaScript regular expressions, for example:

- `code\b`
- `\bcode\b`
- `\d+`

## Replace

Literal replace uses `=`.

- `=replacement`
  - replace all matches for the last search pattern
- `=replacement search`
  - replace all matches for `search` with `replacement`

Examples:

- `/foo` then `=bar`
- `,\d+` then `=NUMBER`
- `=bar foo`

After a replace command, the message shows `replaced X matches`.

The active replace rule remains available for:

- `c` / `.`
- `Enter` in `NAV`

These apply the current replace rule to the current match selection.

## Registers

- numbered registers: `0..9`
- `9` mirrors clipboard content
- `1p..9p` paste from a specific register
- `[count] [register]y` yank lines to a register, for example `10 3y`
- `[count] [register]x` delete chars to a register, for example `5 2x`
- `v` opens the register viewer

Registers store:

- `text`
- `type`: `charwise` or `linewise`

## Text Objects

Supported objects:

- `!` automatic surrounding object
- `"`
- `'`
- `(`
- `[`
- `{`
- `<`

Forms:

- `!y`
- `!x`
- `!p`
- `" 3y`
- `( 2x`
- `{ 5p`

Delimiter matching is intentionally simple:

- scan left to nearest opening delimiter
- scan right to first matching closing delimiter
- no nested delimiter resolution

## Helpers

- `Alt+a` navigate back in editor history
- `Alt+d` navigate forward in editor history
- `Alt+z` set anchor
- `Alt+x` jump to anchor
- `Ctrl+f` open VS Code find
- `Ctrl/Cmd+C` mirror clipboard into register `9`
- `Ctrl/Cmd+V` run paste through MIV

## Docs

- [Keymap](doc/KEYMAP.md)
- [Design](doc/DESIGN.md)
- [Architecture](doc/ARCHITECTURE.md)
- [Functional checklist](doc/checklist.md)

## Run

```bash
npm run compile
npm run lint
```
