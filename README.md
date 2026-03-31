# MIV – Modern Improved Vi

[![Repository](https://img.shields.io/badge/GitHub-diff3%2Fmiv-24292f?logo=github)](https://github.com/diff3/miv)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Support](https://img.shields.io/badge/Ko--fi-Support-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/diff3)

MIV is a lightweight modal editing extension for VS Code inspired by Vim but designed for modern IDE workflows.

You do not need Vim experience to use MIV.

The goal is not to replicate Vim, but to provide a lightweight modal interface that works naturally with VS Code features such as LSP, refactoring, multi-cursor editing, and extensions.

It focuses on:

- simple modal editing
- fast navigation
- predictable commands
- minimal configuration

## Why MIV?
- You get a modal workflow in VS Code without needing to learn Vim first.
- Navigation is built around `W A S D E Q`, with uppercase keys for larger movement.
- Search and replace are part of the command flow, so you can go from finding text to changing it without leaving `NAV`.
- Registers give you a small set of named clipboard slots, so copy, yank, delete, and paste can be more deliberate.
- MIV keeps working with normal VS Code features like search, clipboard, and command palette.
- The command line in the status bar shows what you are typing right now.
- It is designed to feel lightweight and practical, not like a full Vim emulation layer.

## Getting Started In One Minute
If you remember only this, you can already use MIV:

- `ESC` -> go to `NAV`, MIV's command mode
- `i` -> go to `INSERT`, normal typing mode
- `w a s d` -> move
- `g` / `m` / `G` -> jump to top, middle, or bottom
- `x` -> delete one character
- `b` -> delete the current line
- `y` -> yank the current line
- `p` -> paste
- `/text` -> search

Try this once in order:

1. Press `ESC`
2. Move with `w a s d`
3. Press `x`
4. Press `y`
5. Press `p`
6. Press `i`
7. Type normally
8. Press `ESC`
9. Type `/text`

That is enough to understand the basic loop.

## Movement Model
MIV navigation is built around `W A S D E Q`.

Small letters do small steps:

- `a` left
- `d` right
- `w` up
- `s` down
- `q` one word left
- `e` one word to the right

Capital letters do larger steps:

- `A` line start
- `D` line end
- `W` page up
- `S` page down
- `Q` previous word edge
- `E` next word edge

The idea is simple:

- lowercase = smaller movement
- uppercase = larger movement

## Modes
- `NAV` is MIV's command mode.
- It includes movement, search, yank, paste, and edits.
- `INSERT` is for normal typing.
- In `INSERT`, press `ESC` to return to `NAV`.
- In `NAV`, press `i` to enter `INSERT`.
- In `NAV`, `Enter` is handled by MIV and does not insert a new line.

## Status Bar
MIV shows two things in the status bar:

- the current mode: `MIV NAV` or `MIV INSERT`
- a live command line while you type a command

Examples:

- `/text`
- `2p`
- `rA`
- `=foo bar`

That second area is meant to show what you are typing right now, not generic hints.

## The Keys You Will Use First
Think in physical keys rather than locale-specific characters.

- Movement: `a` left, `d` right, `w` up, `s` down
- Bigger movement: `A`, `D`, `W`, `S`
- Word movement: `q`, `e`, `Q`, `E`
- Paragraph movement: `Alt+Q`, `Alt+E`
- Go to line: `g` for line 1, `[count]g` for a specific line, `m` for 50% of the document, `1m..9m` for 10%..90%, `G` for the document bottom, `[count]G` for a line counted from the bottom
- Back to typing: `i`
- Delete: `x`, `b`, `X`, `B`
- Yank and paste: `y`, `p`, `P`
- Search: `/text`, `\text`, `n`, `N`
- Replace: `=search replacement`

## Registers
MIV has numbered registers `0..9`.

The most important one to know at first is:

- register `9` mirrors the system clipboard

Basic register workflow:

- `y` stores the current line
- `p` pastes from the default register
- `P` pastes before the cursor
- `2p` pastes from register `2`
- `2P` pastes after the cursor from register `2`
- `v` opens the register viewer

You can think of registers as named clipboard slots.

Examples:

- `y` -> yank the current line
- `p` -> paste the current register
- `3p` -> paste register `3`
- `Ctrl/Cmd+C` -> copy to the system clipboard and mirror it into register `9`

### Moving Data Between Registers
Counts and registers are separate.

Examples:

- `2y` -> yank 2 lines
- `2 2y` -> yank 2 lines into register `2`
- `5x` -> delete 5 characters
- `5 3x` -> delete 5 characters into register `3`
- `2p` -> paste from register `2`
- `2P` -> paste after the cursor from register `2`
- `2v` -> store the current clipboard in register `2`

You are not really "moving" data between registers with a separate transfer command.
Instead, you choose:

- an optional count first
- then an optional register for `y` and `x`
- or a register directly for `p` and `P`

For the full register behavior, see [`doc/KEYMAP.md`](doc/KEYMAP.md).

## Search And Replace
Search starts from `NAV` mode.

- `/text` -> search forward
- `\text` -> search backward
- `,pattern` -> regex search
- `n` -> next match
- `N` -> previous match

Replace builds on the last search:

- `=bar` -> replace the current search matches with `bar`
- `=foo bar` -> replace all `foo` with `bar`

Examples:

- `/user` then `=account`
- `,\d+` then `=NUMBER`
- `/foo` then `n` then `=bar`
- `=foo bar`

The command line in the status bar shows the command as you type it, for example:

- `/foo`
- `,\\d+`
- `=foo bar`

## Paragraph Movement
- `Alt+Q` -> jump to the previous paragraph
- `Alt+E` -> jump to the next paragraph
- A paragraph is a block of non-empty lines
- One or more empty lines between text blocks count as a single separator

## Full Key Summary

### Motion
- `a` -> move one character left
- `d` -> move one character right
- `w` -> move one line up
- `s` -> move one line down
- `W` -> page up
- `S` -> page down
- `A` -> move to line start
- `D` -> move to line end
- `q` -> move one word left
- `e` -> move to the end of the next word on the right
- `Q` -> move to the end of the previous word on the left
- `E` -> move to the start of the next word on the right
- `g` -> go to line 1
- `[count]g` -> go to a specific line
- `m` -> go to 50% of the document
- `1m..9m` -> go to 10%..90% of the document
- `G` -> go to the bottom of the document
- `[count]G` -> go to the line that is `[count]` rows up from the bottom
- Counts work with motions, for example `10w`, `5a`, `25g`

### Editing
- `x` -> delete one character to the right
- `[count]x` -> delete multiple characters
- `X` -> delete the next word
- `b` -> delete the current line
- `[count]b` -> delete multiple lines
- `B` -> delete from the cursor to the end of the line
- `y` -> yank the current line
- `[count]y` -> yank multiple lines
- `Y` -> yank the next word
- `[count]Y` -> yank multiple words
- `p` -> paste before the cursor
- `P` -> paste after the cursor
- `r<char>` -> replace the character under the cursor and return to `NAV`
- `R` -> delete the current word and enter `INSERT`
- `§` -> toggle case for the current character
- `°` -> toggle case for the current word
- `-` -> change to the end of the line and enter `INSERT`
- `_` -> change the whole line and enter `INSERT`
- `%` -> jump to the matching bracket
- `&` -> join the current line with the next line
- `I` -> move to the start of the line and enter `INSERT`
- `k` -> move to the end of the line and enter `INSERT`
- `o` -> open a new line below and enter `INSERT`
- `O` -> open a new line above and enter `INSERT`
- `u` -> undo the previous change
- `.` -> repeat the last repeatable command alias

### Search
- `/text` -> search forward for a literal string
- `\text` -> search backward for a literal string
- `,pattern` -> start a regex search
- `n` -> jump to the next match
- `N` -> jump to the previous match

### Replace
- `=replacement` -> replace all matches for the last search pattern
- `=search replacement` -> replace all matches for `search` with `replacement`
- After a replace rule exists, `.` applies the current rule
- After a replace rule exists, `Enter` in `NAV` applies the current rule to the current match

### Registers
- `p` -> paste from the default register before the cursor
- `P` -> paste from the default register after the cursor
- `1p..9p` -> paste from a specific register
- `1P..9P` -> paste after the cursor from a specific register
- `[count] [register]y` -> yank lines into a register
- `[count] [register]x` -> delete characters into a register
- `v` -> open the register viewer
- `2v` -> store the current clipboard in register `2`

### Text Objects
- `!` -> automatic surrounding object
- `"` -> double quote object
- `'` -> single quote object
- `(` -> parentheses object
- `[` -> bracket object
- `{` -> brace object

Supported forms:

- `!y`
- `!x`
- `!p`
- `" 3y`
- `( 2x`
- `{ 5p`

## VS Code Commands
MIV is meant to work with normal VS Code behavior, not replace all of it.

That means most common VS Code commands still work alongside MIV, for example:

- Find
- editor history navigation
- clipboard copy and paste
- command palette actions

In some cases MIV intentionally replaces or remaps a key so it can use it for modal editing.

MIV-specific helper commands:

- `Alt+z` -> set an anchor
- `Alt+x` -> jump to the anchor, then toggle between anchor and the last jump origin

MIV adds its own command layer on top, but it does not try to replace the rest of VS Code.

## If You Know Vim
MIV is inspired by Vim, but it is not trying to clone Vim exactly.

The main idea is the same:

- one mode for typing
- one mode for navigation and commands
- short composable editing commands

The main differences are:

- keys are chosen around MIV's own layout, not Vim's default `hjkl`
- the UI is meant to work naturally inside VS Code
- command feedback is shown in the status bar command line
- the goal is a lightweight daily workflow, not full Vim compatibility

## Customizing Keybindings
VS Code makes it easy to customize shortcuts.

Open `File -> Preferences -> Keyboard Shortcuts` or press `Ctrl+K Ctrl+S`.
Search for `miv` and change any keybinding to your preferred layout.
You can also edit the keybindings file directly in `Preferences -> Open Keyboard Shortcuts (JSON)`.

Example:

```json
{
  "key": "h",
  "command": "miv.cursorLeft",
  "when": "editorTextFocus && miv.mode == 'NAV' && !miv.searchActive && !miv.replaceRuleInputActive && !miv.replaceCharPending"
}
```

This maps the Vim-style `h` key to MIV's left movement command.

## Command Reference
The full command reference is available in [`doc/KEYMAP.md`](doc/KEYMAP.md).

## Repository

https://github.com/diff3/miv

## Development
When you change keybindings in [`keymaps/default.json`](keymaps/default.json), run:

```bash
npm run generate-keymap
```

## Support Development
If you enjoy using MIV and want to support development you can leave a tip here:

https://ko-fi.com/diff3

Thank you for helping keep the project alive.
