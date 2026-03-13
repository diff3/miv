# miv Extension Quickstart

## Run locally

- Install dependencies: `npm install`
- Compile once: `npm run compile`
- Start extension host: press `F5` in VS Code

## Development loop

- Rebuild on changes: `npm run watch`
- Reload extension host window after rebuild when needed
- Lint: `npm run lint`

## Project structure

- `src/extension.ts` -> activation, input pipeline, mode/context sync
- `src/config.ts` -> key vocabulary and keybinding normalization
- `src/parser.ts` -> buffered sequence parsing
- `src/dispatcher.ts` -> command execution and register behavior
- `src/state.ts` -> in-memory runtime state
- `src/uiFeedback.ts` -> status bar and yank flash feedback

## Validate behavior quickly

- Mode switching: `Space` to INSERT, `Esc` to NAV
- Core edits: `x`, `X`, `B`, `b`, `y`, `Y`, `p`, `P`
- Change/structure: `-`, `_`, `%`, `&`
- Insert transitions: `i`, `I`, `k`, `o`, `O`, `r`, `R`
- Registers: `1v`..`7v`, `1p`..`9p`, viewer `v`
- Text objects: `" 3y`, `( 2x`, `{ 5p`
- Repeat: `c` or `.`
