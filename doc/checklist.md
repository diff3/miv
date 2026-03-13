# MIV Functional Checklist

## Modes

- [ ] Startup enters `NAV`
- [ ] `Space` enters `INSERT` from empty NAV buffer
- [ ] `Esc` returns to `NAV`
- [ ] NAV cursor is block
- [ ] INSERT cursor is line

## Motion

- [ ] `a` left
- [ ] `d` right
- [ ] `w` up
- [ ] `s` down
- [ ] `W` page up
- [ ] `S` page down
- [ ] `A` line start
- [ ] `D` line end
- [ ] `q` word left
- [ ] `e` word end right
- [ ] `Q` word end left
- [ ] `E` word start right
- [ ] `10w` counted motion
- [ ] `25g` goto line
- [ ] `G` bottom of document

## Editing

- [ ] `x` delete char
- [ ] `10x` delete counted chars
- [ ] `X` delete word
- [ ] `B` delete to line end
- [ ] `b` delete line
- [ ] `5b` delete counted lines
- [ ] `y` yank line
- [ ] `10y` yank counted lines
- [ ] `Y` yank word
- [ ] `p` paste after
- [ ] `P` paste before
- [ ] `r<char>` replace one char
- [ ] `R` replace word and enter `INSERT`
- [ ] `§` toggle case at cursor
- [ ] `shift+§` toggle case for current word
- [ ] `-` change to line end
- [ ] `_` change line
- [ ] `%` jump bracket match
- [ ] `&` join with next line
- [ ] `i` enter `INSERT`
- [ ] `I` line start + `INSERT`
- [ ] `k` line end + `INSERT`
- [ ] `o` open line below
- [ ] `O` open line above
- [ ] `u` undo
- [ ] `c` repeat
- [ ] `.` repeat alias

## Search

- [ ] `/text` literal forward search
- [ ] `\text` literal backward search
- [ ] `,regex` regex search with `~` prompt
- [ ] `n` next match
- [ ] `N` previous match
- [ ] highlights appear for matches
- [ ] current match gets stronger highlight
- [ ] search highlight toggle works
- [ ] `Esc` clears visible highlights but keeps match state

## Replace

- [ ] `=replacement` uses last search pattern
- [ ] `=replacement search` uses explicit literal search text
- [ ] `/foo` then `=bar` replaces all `foo`
- [ ] `,\d+` then `=NUMBER` replaces all regex matches
- [ ] replace shows `replaced X matches`
- [ ] `Enter` in `NAV` applies current replace rule to current match
- [ ] `c` / `.` reuse the current replace rule

## Registers

- [ ] registers `0..9` exist
- [ ] clipboard mirrors to register `9`
- [ ] `1p..9p` paste specific register
- [ ] `[count] [register]y` stores to target register
- [ ] `[count] [register]x` stores to target register
- [ ] register viewer opens with `v`
- [ ] linewise register pastes as whole line
- [ ] charwise register pastes inline

## Text Objects

- [ ] `!y`
- [ ] `!x`
- [ ] `!p`
- [ ] `" 3y`
- [ ] `( 2x`
- [ ] `{ 5p`
- [ ] simple delimiter scan works without nesting

## Helpers

- [ ] `Alt+a` history back
- [ ] `Alt+d` history forward
- [ ] `Alt+z` set anchor
- [ ] `Alt+x` jump to anchor
- [ ] `Ctrl/Cmd+C` mirrors clipboard
- [ ] `Ctrl/Cmd+V` uses MIV paste path
