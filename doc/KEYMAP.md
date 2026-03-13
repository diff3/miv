# miv Keymap

## Mode

- `Space` -> NAV to INSERT (only when buffer is empty)
- `Esc` -> INSERT to NAV
- NAV cursor style -> `block`
- INSERT cursor style -> `line`

## Motion (NAV)

- `a` -> char left
- `d` -> char right
- `w` -> line up
- `s` -> line down
- `W` -> page up
- `S` -> page down
- `q` -> word left
- `e` -> end of next word
- `Q` -> word-end left
- `E` -> start of next word
- `A` (`Shift+A`) -> start of line
- `D` (`Shift+D`) -> end of line
- `[count] + motion` -> repeat motion (`10w`, `3D`)

## Edit Commands

- `x` -> delete char right
- `X` -> delete word right
- `B` -> delete from cursor to end of line
- `b` -> delete line
- `y` -> yank line
- `Y` -> yank word
- `p` -> paste after cursor (register `9`)
- `P` -> paste before cursor (register `9`)
- `r` -> replace character (delete right + enter INSERT)
- `R` -> replace word (delete word right + enter INSERT)
- `-` -> delete to end of line + enter INSERT
- `_` -> replace line + enter INSERT
- `%` -> jump to matching bracket
- `&` -> join current line with next line
- `i` -> enter INSERT
- `I` -> line start + enter INSERT
- `k` -> line end + enter INSERT
- `o` -> open line below + enter INSERT
- `O` -> open line above + enter INSERT
- `u` -> undo
- `c` / `.` -> repeat last repeatable edit
- `g` -> go to line 1
- `[count]g` -> go to line count (`25g`)
- `G` -> bottom of document
- `/` -> open find

## Registers

- registers: `0..9`
- `1p..9p` -> paste register after cursor/line
- `1v..7v` -> store clipboard in register
- `v` -> open register viewer
- `[count] [register]y` -> yank lines into register
- `[count] [register]x` -> delete chars into register
- examples: `10 3y`, `5 2x`

## Text Objects

Grammar:

- `[object] [register][command]`
- `![command]`

Objects:

- `"`, `'`, `(`, `[`, `{`, `<`

Commands:

- `x` -> delete inside object to register
- `y` -> yank inside object to register
- `p` -> replace inside object from register

Examples:

- `!y`
- `!x`
- `!p`
- `" 3y`
- `( 2x`
- `{ 5p`

Resolution:

- explicit and auto text objects use a simple delimiter scan
- scan left for the nearest opening delimiter
- scan right for the first matching closing delimiter
- nested structures are not resolved specially

## Paste Semantics

- register data is either `linewise` or `characterwise`
- linewise paste inserts full line(s)
- characterwise paste inserts at cursor
- `p` inserts after cursor/line, `P` inserts before cursor/line
- `Ctrl+C` / `Cmd+C` mirrors clipboard into register `9`
- `Ctrl+V` / `Cmd+V` runs through miv paste command path

## Navigation helpers

- `Alt+a` -> VS Code navigate back
- `Alt+d` -> VS Code navigate forward
- `Alt+z` -> set anchor
- `Alt+x` -> jump to anchor
- `Ctrl+f` -> open find in NAV
