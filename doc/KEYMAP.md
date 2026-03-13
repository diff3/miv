# miv Keymap

## Modes

- `Space` -> enter `INSERT` from empty NAV buffer
- `Esc` -> return to `NAV`

## Motion

- `a` -> char left
- `d` -> char right
- `w` -> line up
- `s` -> line down
- `W` -> page up
- `S` -> page down
- `A` -> line start
- `D` -> line end
- `q` -> word left
- `e` -> word end right
- `Q` -> word end left
- `E` -> word start right
- `[count]motion` -> counted motion, for example `10w`, `3D`
- `g` -> go to line 1
- `[count]g` -> go to line `[count]`
- `G` -> document bottom

## Edit

- `x` -> delete char right
- `X` -> delete word right
- `B` -> delete to line end
- `b` -> delete line
- `[count]x` -> delete `[count]` characters
- `[count]b` -> delete `[count]` lines
- `y` -> yank line
- `Y` -> yank word
- `[count]y` -> yank `[count]` lines
- `[count]Y` -> yank `[count]` words
- `p` -> paste after
- `P` -> paste before
- `r<char>` -> replace one character
- `R` -> replace current word and enter `INSERT`
- `§` -> toggle case under cursor
- `shift+§` -> toggle case for current word
- `-` -> change to line end and enter `INSERT`
- `_` -> change line and enter `INSERT`
- `%` -> jump bracket match
- `&` -> join line with next line
- `i` -> enter `INSERT`
- `I` -> line start + `INSERT`
- `k` -> line end + `INSERT`
- `o` -> open line below + `INSERT`
- `O` -> open line above + `INSERT`
- `u` -> undo
- `c` -> repeat last repeatable command
- `.` -> repeat last repeatable command

## Search

- `/` -> literal search forward
- `\` -> literal search backward
- `,` -> regex search
- prompt prefix for regex search -> `~`
- `n` -> next match
- `N` -> previous match

## Replace

- `=replacement` -> replace all matches for the last search pattern
- `=replacement search` -> replace all matches for `search` with `replacement`
- after a replace rule exists:
  - `c` / `.` -> replace next/current match with the active rule
  - `Enter` in `NAV` -> replace current match with the active rule

## Registers

- registers -> `0..9`
- `1p..9p` -> paste from register
- `[count] [register]y` -> yank lines to register
- `[count] [register]x` -> delete chars to register
- `v` -> open register viewer

## Text Objects

Forms:

- `!y`
- `!x`
- `!p`
- `" 3y`
- `( 2x`
- `{ 5p`

Objects:

- `!`
- `"`
- `'`
- `(`
- `[`
- `{`
- `<`

Commands:

- `y` -> yank inside object
- `x` -> delete inside object
- `p` -> replace inside object from register

## Helpers

- `Alt+a` -> history back
- `Alt+d` -> history forward
- `Alt+z` -> set anchor
- `Alt+x` -> jump to anchor
- `Ctrl+f` -> VS Code find
- `Ctrl/Cmd+C` -> mirror clipboard to register `9`
- `Ctrl/Cmd+V` -> MIV paste path
