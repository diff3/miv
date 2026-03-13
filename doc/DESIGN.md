# miv Design

## Core Model

miv is a modal command layer on top of VS Code.

The design is centered on:

- directional movement under the left hand
- immediate edit commands
- a small parser with deterministic sequence handling
- typed registers with linewise versus charwise paste behavior

## Interaction Model

`NAV` is command mode.

In `NAV`:

- single keys execute motions and edits
- counts extend motions and immediate commands
- special input sub-modes are used for search and replace entry

`INSERT` is plain VS Code typing.

## Command Families

### Motion

Movement is built around:

- `a d w s`
- `A D`
- `q e Q E`
- `W S`
- `[count]motion`

### Immediate Edit

Most edits execute immediately:

- delete commands
- yank commands
- paste commands
- line changes
- bracket jump
- line join
- case toggle

### Input-Driven Commands

Some commands open a temporary input flow:

- `/` literal search forward
- `\` literal search backward
- `,` regex search with `~` prompt
- `=` replace input
- `r<char>` replace-character capture

These flows stay in `NAV`, but temporarily treat typed keys as command input rather than editor text.

## Search and Match Model

Search stores a match list for the whole document.

That match list powers:

- current match highlighting
- all-match highlighting
- `n` / `N`
- regex search replay via `c` / `.`

Regex currently acts as a full search mode, not a full regex-substitute language.

## Replace Model

`=` is intentionally simple.

It supports:

- `=replacement`
  - use the last search pattern
- `=replacement search`
  - explicit literal replacement target

After a replace rule exists:

- `c` / `.` reuse it
- `Enter` in `NAV` applies it to the current selected match

This keeps literal replace ergonomic without overloading it with full regex-substitute syntax.

## Text Objects

Text objects use deliberate non-nested delimiter resolution:

- nearest opening delimiter to the left
- first matching closing delimiter to the right

This avoids parser complexity and keeps the feature predictable.

## Register Model

Registers are numbered `0..9`.

Each register stores:

- `text`
- `type`

`type` is either:

- `charwise`
- `linewise`

Paste behavior depends on register type rather than command name alone.
