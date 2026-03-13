# miv

Modern Improved Vi as a VS Code extension.

## Modes

- `NAV`: command mode, block cursor.
- `INSERT`: text input mode, line cursor.
- `Esc`: returns to `NAV`.
- `Space`: enters `INSERT` from `NAV` when pressed as first key in an empty NAV sequence.

## NAV keymap

Motions:

- `a` left, `d` right, `w` up, `s` down
- `W` page up, `S` page down
- `A` line start, `D` line end
- `q` word left, `e` word end right
- `Q` word end left, `E` word start right
- counts for motions: `10w`, `3D`

Edit and command keys:

- `x`: delete char right
- `X`: delete word right
- `B`: delete from cursor to end of line
- `b`: delete line
- `y`: yank line
- `Y`: yank word
- `p`: paste after cursor (register `9`)
- `P`: paste before cursor (register `9`)
- `r`: replace char and enter INSERT
- `R`: replace word and enter INSERT
- `-`: change to end of line and enter INSERT
- `_`: change line and enter INSERT
- `%`: jump to matching bracket
- `&`: join current line with next line
- `i`: enter INSERT at cursor
- `I`: go to line start + enter INSERT
- `k`: go to line end + enter INSERT
- `o`: open line below + enter INSERT
- `O`: open line above + enter INSERT
- `u`: undo
- `c` or `.`: repeat last repeatable edit
- `g`: go to line 1 (or `N g` to go to line `N`)
- `G`: bottom of document
- `/`: open find

## Registers and paste

- numbered registers: `0..9`
- `1p..9p`: paste from register (after cursor)
- `1v..7v`: store clipboard into register
- `v`: open register viewer
- `[count] [register]y`: yank lines to register (example: `10 3y`)
- `[count] [register]x`: delete chars to register (example: `5 2x`)
- text-objects: `[object] [register][command]`
  - objects: `!`, `"`, `'`, `(`, `[`, `{`, `<`
  - commands: `x`, `y`, `p`
  - examples: `!y`, `!x`, `!p`, `" 3y`, `( 2x`, `{ 5p`
  - delimiter scan is intentionally simple: nearest opening delimiter to the left, first matching closing delimiter to the right, no nested matching

Register content stores metadata:

- `linewise`: used for line yanks and linewise clipboard copies
- `characterwise`: used for char/word operations

Paste behavior:

- linewise register content pastes as full line(s)
- characterwise register content pastes at cursor position
- `Ctrl/Cmd+C` mirrors clipboard into register `9`
- `Ctrl/Cmd+V` pastes through miv command path

## Navigation helpers

- `Alt+a` / `Alt+d`: VS Code history back/forward
- `Alt+z` / `Alt+x`: set/jump anchor
- `Ctrl+f`: find in NAV

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

## Support the project

If you enjoy using MIV you can support development and 
Buy me a coffee https://ko-fi.com/diff3


Your support helps continue development.