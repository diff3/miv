# miv Architecture

## Runtime Flow

Keyboard input
-> key normalization in `config.ts`
-> buffered handling in `extension.ts`
-> parse in `parser.ts`
-> execution in `dispatcher.ts`
-> VS Code editor APIs

## Modules

### `src/config.ts`

Central source of truth for:

- modes
- normalized key sequences
- NAV key bindings
- command constants

### `src/state.ts`

Mutable runtime session state:

- current mode
- last repeatable command
- search state
- replace state
- active match list
- registers
- anchors

### `src/parser.ts`

Turns buffered input into `ParsedCommand`.

Key responsibilities:

- resolve motions from `MOTION_TABLE`
- resolve single-key commands
- parse counted forms
- parse register-targeted forms
- parse text-object forms
- parse replace input payloads

### `src/dispatcher.ts`

Executes parsed commands that are pure editor actions:

- motions
- delete/yank/paste
- replace char / replace word
- line change commands
- case toggles
- register reads and writes
- text-object execution

### `src/extension.ts`

Handles command flows that need session context and temporary input modes:

- sequence buffering
- mode switching
- search input
- regex input
- replace input
- match highlighting
- repeat routing for extension-managed commands
- clipboard mirroring

### `src/uiFeedback.ts`

UI-only feedback:

- status bar
- command preview
- transient messages
- yank highlight

### `src/registerViewer.ts`

QuickPick UI for register inspection and register paste/store actions.

## Parser Model

Supported syntax families:

- single-key commands
- counted motions and commands
- `r<char>`
- register-targeted delete/yank
- register paste
- text-object commands
- replace payloads after `=`

The parser intentionally avoids nested or recursive grammars.

## Search Model

Search is extension-managed, not delegated to VS Code find.

The state keeps:

- current search input
- last search pattern
- whether the last search was regex
- match offsets
- match lengths
- current active match index

That shared match state is reused by:

- `/`
- `\`
- `,`
- `n`
- `N`
- replace rule targeting

## Repeat Model

Repeatable commands are split between two layers:

- dispatcher-managed repeat for editor actions
- extension-managed repeat for search and replace flows

`c` and `.` always replay `state.lastCommand` through the same execution path that originally handled it.

## Register Model

Registers are typed:

- `text: string`
- `type: 'charwise' | 'linewise'`

This allows paste semantics to stay correct for:

- line yanks
- line deletes
- charwise operations
- clipboard mirror
