# MIV FUNCTIONAL TEST CHECKLIST

## GENERAL
- [x] Extension activates on startup (`onStartupFinished`) with no errors
- [x] Status bar shows current mode
- [x] NAV mode is active on startup
- [x] `SPACE` from NAV with empty input buffer enters INSERT mode
- [x] `ESC` returns to NAV mode from INSERT
- [x] Cursor style is `block` in NAV and `line` in INSERT

## NAVIGATION
- [x] `a` -> move cursor left
- [x] `d` -> move cursor right
- [x] `w` -> move cursor up
- [x] `s` -> move cursor down
- [x] `W` -> page up
- [x] `S` -> page down
- [x] `A` -> line start
- [x] `D` -> line end
- [x] `q` -> word left
- [x] `e` -> word end right
- [x] `Q` -> word end left
- [x] `E` -> word start right
- [x] `g` -> go to line 1
- [x] `G` -> bottom of document

Counted navigation
- [x] `10w` -> move up 10 lines
- [x] `5a` -> move left 5 characters
- [x] `8s` -> move down 8 lines
- [x] `25g` -> go to line 25

## EDIT COMMANDS
- [x] `x` -> delete char right
- [x] `X` -> delete word right
- [x] `B` -> delete to end of line
- [x] `b` -> delete line
- [x] `y` -> yank line
- [ ] `Y` -> yank word
- [x] `p` -> paste after cursor (register `9`)
- [x] `P` -> paste before cursor (register `9`)
- [ ] `r` -> replace char (delete + INSERT + insert one word + ESC)
- [ ] `R` -> replace word (delete + INSERT)
- [x] `_` -> change line (replace line + INSERT)
- [x] `%` -> jump to matching bracket
- [x] `&` -> join line with next line
- [x] `i` -> enter INSERT at cursor
- [x] `I` -> line start + INSERT
- [x] `k` -> line end + INSERT
- [x] `o` -> open line below + INSERT
- [x] `O` -> open line above + INSERT
- [x] `u` -> undo
- [ ] `c` -> repeat last repeatable edit - got some errors
- [ ] `.` -> repeat last repeatable edit - got some errors

Counted edit commands
- [x] `10x` -> delete 10 chars
- [x] `5X` -> delete 5 words
- [ ] `3B` -> delete to line end 3 times - should not have a counter
- [x] `5b` -> delete 5 lines
- [x] `10y` -> yank 10 lines
- [x] `4Y` -> yank 4 words

## REGISTER STORAGE
- [ ] Registers `0..9` exist and persist values during session
- [ ] `y` stores with `linewise = true`
- [ ] `10y` stores with `linewise = true`
- [ ] `Y` stores with `linewise = false`
- [ ] `x` stores with `linewise = false`
- [ ] `X` stores with `linewise = false`
- [ ] `10 3y` stores yank lines in register `3`
- [ ] `5 2x` stores deleted chars in register `2`
- [ ] `1v..7v` stores clipboard in target register
- [ ] `Ctrl/Cmd+C` mirrors clipboard in register `9`

## TEXT OBJECT COMMANDS
Syntax:
`[object] [register][command]`

Supported objects
- [ ] `"` (double quotes)
- [ ] `'` (single quotes)
- [ ] `(` ... `)`
- [ ] `[` ... `]`
- [ ] `{` ... `}`
- [ ] `<` ... `>`

Supported commands
- [ ] `" 3y` -> yank text inside quotes to register `3`
- [ ] `" 3x` -> delete text inside quotes to register `3`
- [ ] `" 3p` -> replace text inside quotes from register `3`
- [ ] `( 2x` -> delete text inside parentheses to register `2`
- [ ] `[ 4y` -> yank text inside brackets to register `4`
- [ ] `{ 5p` -> replace text inside braces from register `5`

## PASTE BEHAVIOR
Characterwise content
- [ ] `p` inserts at cursor-after position
- [ ] `P` inserts at cursor position

Linewise content
- [ ] `p` inserts full line(s) below current line
- [ ] `P` inserts full line(s) above current line
- [ ] Cursor moves to start of first pasted line after linewise paste
- [ ] Repeated linewise `p` stacks correctly
- [ ] Multiline linewise register preserves line breaks

Register pastes
- [ ] `3p` pastes register `3` after cursor/line
- [ ] `9p` pastes register `9` after cursor/line
- [ ] `0p` is rejected

## MODE SWITCHING
- [ ] NAV -> INSERT with `SPACE` when input buffer is empty
- [ ] INSERT -> NAV with `ESC`
- [ ] Commands only execute in NAV mode
- [ ] `r`, `R`, `-`, `_`, `i`, `I`, `k`, `o`, `O` end in INSERT mode

## COMMAND EXECUTION MODEL
- [ ] `y` executes immediately
- [ ] `x` executes immediately
- [ ] `X` executes immediately
- [ ] `B` executes immediately
- [ ] `b` executes immediately
- [ ] `Y` executes immediately
- [ ] `p` executes immediately
- [ ] `P` executes immediately
- [ ] `-` executes immediately
- [ ] `_` executes immediately
- [ ] `%` executes immediately
- [ ] `&` executes immediately
- [ ] `g` executes immediately

Repeat behavior
- [ ] `c` repeats last repeatable edit action
- [ ] `.` repeats last repeatable edit action
- [ ] Repeat works for `x`, `X`, `B`, `b`, `y`, `Y`, `p`, `P`, `-`, `_`, `&`

## INPUT BUFFER
- [ ] Count parsing works (`10w`, `10x`, `5b`, `25g`)
- [ ] Space-register syntax parses as partial until complete (`10 `, `10 3`, `10 3y`)
- [ ] Text-object syntax parses as partial until complete (`"`, `" `, `" 3`, `" 3y`)
- [ ] Invalid sequences reset command preview/buffer

## VISUAL FEEDBACK
- [ ] Status bar updates on mode change
- [ ] Command preview updates during NAV input
- [ ] Command preview clears after complete/invalid command
- [ ] Yank highlight appears for yank operations
- [ ] Status messages appear for register/yank/paste events

## EDGE CASES
- [ ] Commands at beginning of file
- [ ] Commands at end of file
- [ ] `b` on last line
- [ ] `y` on empty line
- [ ] `%` outside bracket context does nothing safely
- [ ] `%` inside nested brackets jumps to a safe match
- [ ] Text-object command outside delimiters does nothing safely
- [ ] Text-object command with unmatched delimiters does nothing safely

## STRESS TEST
- [ ] Large counts (`100y`, `200x`, `250w`)
- [ ] Rapid NAV key input
- [ ] Rapid mode switching (`SPACE` / `ESC` repeatedly)
- [ ] Repeated register operations (`1v`, `1p`, `2v`, `2p`)
- [ ] Repeat stress (`c` / `.` over many edit commands)
