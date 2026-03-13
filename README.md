# MIV – Modern Improved Vi

[![Repository](https://img.shields.io/badge/GitHub-diff3%2Fmiv-24292f?logo=github)](https://github.com/diff3/miv)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Support](https://img.shields.io/badge/Ko--fi-Support-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/diff3)

MIV is a lightweight modal editing extension for VS Code inspired by Vim but designed for modern IDE workflows.

It focuses on:

- simple modal editing
- fast navigation
- predictable commands
- minimal configuration

## Quick Start
Press `ESC` to enter **NAV mode**.

Basic navigation: `a` left, `d` right, `w` up, `s` down.

Insert mode: `i` insert, `Space` insert, `ESC` return to NAV mode.

Search: `/text` search forward, `\text` search backward.

Registers: `2p` paste from register `2`, `v` show register contents.

## Keyboard Layout
The default MIV keymap is optimized for a **Swedish keyboard layout**.

Many commands are positioned to be easy to reach on that layout.
If you use another keyboard layout you may want to adjust the keybindings.

## Customizing Keybindings
VS Code makes it easy to customize shortcuts.

Open `File -> Preferences -> Keyboard Shortcuts` or press `Ctrl+K Ctrl+S`.
Search for `miv` and change any keybinding to your preferred layout.
You can also edit the keybindings file directly in `Preferences -> Open Keyboard Shortcuts (JSON)`.

Example:

```json
{
  "key": "h",
  "command": "miv.handleKey",
  "args": "a",
  "when": "editorTextFocus && miv.mode == 'NAV'"
}
```

This maps the Vim-style `h` key to MIV's left movement command.

## Command Reference
The full command reference is available in [`doc/KEYMAP.md`](doc/KEYMAP.md).

## Repository

https://github.com/diff3/miv

## Support Development
If you enjoy using MIV and want to support development you can leave a tip here:

https://ko-fi.com/diff3

Thank you for helping keep the project alive.
