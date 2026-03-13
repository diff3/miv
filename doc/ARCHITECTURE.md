# miv Architecture

miv is implemented as a VS Code extension with a command pipeline.

## Runtime flow

Keyboard input
-> key normalization (`NAV_KEY_MAP`)
-> sequence buffer (`extension.ts`)
-> parser (`parser.ts`)
-> dispatcher (`dispatcher.ts`)
-> VS Code commands/API

## Modules

- `src/extension.ts`
  - mode state sync, input buffer, timer handling
  - clipboard mirror to register `9`
  - status bar/cursor feedback hooks
- `src/parser.ts`
  - converts buffered NAV input into `ParsedCommand`
  - handles motions, immediate commands, counts, register forms, text-objects
- `src/dispatcher.ts`
  - executes parsed actions
  - applies register writes/reads
  - implements paste semantics (linewise vs characterwise)
  - keeps repeatable command state
- `src/state.ts`
  - in-memory runtime state
  - registers `0..9` with `{ text, linewise }`
- `src/config.ts`
  - key constants and NAV key normalization map

## Parser model

Responsibilities:

1. resolve motion from `MOTION_TABLE`
2. resolve command and syntax forms
3. return dispatch-ready command object

Supported syntax families:

- single-key commands (`x`, `X`, `B`, `b`, `y`, `Y`, `p`, `P`, `-`, `_`, `%`, `&`, `i`, `I`, `k`, `o`, `O`, `r`, `R`, `u`, `c`, `.`, `/`, `g`, `G`, `v`)
- counted commands (`10x`, `5b`, `25g`, counted motions)
- operator+motion yank (`y` + motion)
- register-targeted count commands (`10 3y`, `5 2x`)
- register paste (`3p`)
- text-object commands (`" 3y`, `( 2x`, `{ 5p`)

## Dispatcher model

Action groups:

- motion actions (`cursor...`)
- edit actions (delete/yank/paste/change/replace/join)
- navigation actions (`gotoLine`, bracket match)
- register actions (`storeRegister`, register paste)

## Register model

Registers are typed:

- `text: string`
- `linewise: boolean`

Write behavior:

- line yanks -> linewise
- char/word deletes/yanks -> characterwise
- clipboard mirror updates register `9`

Paste behavior:

- linewise register content inserts as full lines
- characterwise register content inserts at cursor
- `p` and `P` choose after/before insertion direction

## Repeat model

Repeat commands: `c` and `.`.

Dispatcher stores repeatable edits and replays the last stored command.
