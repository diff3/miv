# miv Design

## Core idea

miv is a modal editing model for VS Code:

- directional NAV movement keys
- immediate edit commands for common operations
- parser -> dispatcher pipeline for deterministic command execution

## Directional layout

NAV motion keys:

- `a d w s` for left/right/up/down
- `W S` for page up/down
- `q e Q E` for word scopes
- `A D` for line start/end

Counts apply to motions (`10w`, `5a`, `3D`).

## Edit language

Immediate edit commands:

- delete: `x`, `X`, `B`, `b`
- yank: `y`, `Y`, `y + motion`
- paste: `p`, `P`, `<digit>p`
- change: `-`, `_`
- structure: `%`
- line join: `&`
- replace/insert transitions: `r`, `R`, `i`, `I`, `k`, `o`, `O`
- repeat/undo: `c`, `.`, `u`

Line navigation:

- `g` (line 1 / count target)
- `G` (document bottom)

Search:

- `/`

## Text objects

Grammar:

- `[object] [register][command]`
- `![command]`

Objects:

- `"`, `'`, `(`, `[`, `{`, `<`

Commands:

- `x` delete inside object to register
- `y` yank inside object to register
- `p` replace inside object from register

Behavior:

- `!x`, `!y`, `!p` auto-detect the surrounding delimiter pair
- delimiter resolution is intentionally simple
- scan left to the nearest opening delimiter, then scan right to the first matching closing delimiter
- nested delimiter depth is ignored

## Registers and clipboard

miv keeps numbered registers `0..9`.

Each register stores:

- `text`
- `linewise` flag

Storage rules:

- line yank stores `linewise = true`
- char/word delete/yank stores `linewise = false`
- clipboard mirror (`register 9`) preserves linewise/characterwise intent

Paste rules:

- linewise paste inserts whole line(s)
- characterwise paste inserts at cursor
- `p` pastes after cursor/line
- `P` pastes before cursor/line

## Interaction model

- NAV interprets keys as commands
- INSERT passes keys through
- `Space` enters INSERT only from empty NAV buffer
- `Esc` returns to NAV
