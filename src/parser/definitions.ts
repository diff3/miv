import { MIV_KEYS } from '../config';
import type { ParsedCommand } from '../parser';

// Motion definitions are intentionally centralized here so parsing and
// operator+motion resolution share one lookup table.
export const MOTION_TABLE: Record<string, ParsedCommand> = {
  [MIV_KEYS.navigation.left]: {
    sequence: MIV_KEYS.navigation.left,
    action: 'cursorLeft',
    vscodeCommand: 'cursorLeft'
  },
  [MIV_KEYS.navigation.right]: {
    sequence: MIV_KEYS.navigation.right,
    action: 'cursorRight',
    vscodeCommand: 'cursorRight'
  },
  [MIV_KEYS.navigation.up]: {
    sequence: MIV_KEYS.navigation.up,
    action: 'cursorUp',
    vscodeCommand: 'cursorUp'
  },
  [MIV_KEYS.navigation.down]: {
    sequence: MIV_KEYS.navigation.down,
    action: 'cursorDown',
    vscodeCommand: 'cursorDown'
  },
  [MIV_KEYS.navigation.pageUp]: {
    sequence: MIV_KEYS.navigation.pageUp,
    action: 'cursorPageUp',
    vscodeCommand: 'cursorPageUp'
  },
  [MIV_KEYS.navigation.pageDown]: {
    sequence: MIV_KEYS.navigation.pageDown,
    action: 'cursorPageDown',
    vscodeCommand: 'cursorPageDown'
  },
  [MIV_KEYS.navigation.lineStart]: {
    sequence: MIV_KEYS.navigation.lineStart,
    action: 'cursorLineStart',
    vscodeCommand: 'cursorHome'
  },
  [MIV_KEYS.navigation.lineEnd]: {
    sequence: MIV_KEYS.navigation.lineEnd,
    action: 'cursorLineEnd',
    vscodeCommand: 'cursorEnd'
  },
  [MIV_KEYS.navigation.wordLeft]: {
    sequence: MIV_KEYS.navigation.wordLeft,
    action: 'cursorWordLeft',
    vscodeCommand: 'cursorWordLeft'
  },
  [MIV_KEYS.navigation.wordRight]: {
    sequence: MIV_KEYS.navigation.wordRight,
    action: 'cursorWordEndRight',
    vscodeCommand: 'cursorWordEndRight'
  },
  [MIV_KEYS.navigation.wordEndLeft]: {
    sequence: MIV_KEYS.navigation.wordEndLeft,
    action: 'cursorWordEndLeft',
    vscodeCommand: 'cursorWordEndLeft'
  },
  [MIV_KEYS.navigation.wordEndRight]: {
    sequence: MIV_KEYS.navigation.wordEndRight,
    action: 'cursorWordRight',
    vscodeCommand: 'cursorWordStartRight'
  }
};

export const SINGLE_KEY_COMMANDS: Record<string, ParsedCommand> = {
  [MIV_KEYS.operators.delete]: {
    sequence: MIV_KEYS.operators.delete,
    action: 'deleteCharRight',
    vscodeCommand: 'deleteRight'
  },
  [MIV_KEYS.commands.deleteWord]: {
    sequence: MIV_KEYS.commands.deleteWord,
    action: 'deleteWordRight',
    vscodeCommand: 'deleteWordRight'
  },
  [MIV_KEYS.commands.deleteToLineEnd]: {
    sequence: MIV_KEYS.commands.deleteToLineEnd,
    action: 'deleteToLineEnd'
  },
  [MIV_KEYS.commands.replaceWord]: {
    sequence: MIV_KEYS.commands.replaceWord,
    action: 'replaceWord'
  },
  [MIV_KEYS.commands.toggleCaseChar]: {
    sequence: MIV_KEYS.commands.toggleCaseChar,
    action: 'toggleCaseChar'
  },
  [MIV_KEYS.commands.toggleCaseWord]: {
    sequence: MIV_KEYS.commands.toggleCaseWord,
    action: 'toggleCaseWord'
  },
  [MIV_KEYS.commands.pasteBefore]: {
    sequence: MIV_KEYS.commands.pasteBefore,
    action: 'pasteBefore'
  },
  [MIV_KEYS.commands.changeToLineEnd]: {
    sequence: MIV_KEYS.commands.changeToLineEnd,
    action: 'changeToLineEnd'
  },
  [MIV_KEYS.commands.changeLine]: {
    sequence: MIV_KEYS.commands.changeLine,
    action: 'changeLine'
  },
  [MIV_KEYS.commands.jumpBracketMatch]: {
    sequence: MIV_KEYS.commands.jumpBracketMatch,
    action: 'jumpBracketMatch'
  },
  [MIV_KEYS.commands.joinLineWithNext]: {
    sequence: MIV_KEYS.commands.joinLineWithNext,
    action: 'joinLineWithNext'
  },
  [MIV_KEYS.commands.replaceMatches]: {
    sequence: MIV_KEYS.commands.replaceMatches,
    action: 'applyReplaceRule'
  },
  [MIV_KEYS.commands.repeat]: { sequence: MIV_KEYS.commands.repeat, action: 'repeatLastCommand' },
  [MIV_KEYS.commands.repeatAlias]: { sequence: MIV_KEYS.commands.repeatAlias, action: 'repeatLastCommand' },
  [MIV_KEYS.commands.insert]: { sequence: MIV_KEYS.commands.insert, action: 'enterInsert' },
  [MIV_KEYS.commands.insertLineStart]: { sequence: MIV_KEYS.commands.insertLineStart, action: 'insertAtLineStart' },
  [MIV_KEYS.commands.insertLineEnd]: { sequence: MIV_KEYS.commands.insertLineEnd, action: 'insertAtLineEnd' },
  [MIV_KEYS.commands.openLineBelow]: { sequence: MIV_KEYS.commands.openLineBelow, action: 'openLineBelow' },
  [MIV_KEYS.commands.openLineAbove]: { sequence: MIV_KEYS.commands.openLineAbove, action: 'openLineAbove' },
  [MIV_KEYS.commands.undo]: { sequence: MIV_KEYS.commands.undo, action: 'undo', vscodeCommand: 'undo' },
  [MIV_KEYS.commands.deleteLine]: {
    sequence: MIV_KEYS.commands.deleteLine,
    action: 'deleteLine',
    vscodeCommand: 'editor.action.deleteLines',
    args: [1]
  },
  [MIV_KEYS.commands.gotoLine]: {
    sequence: MIV_KEYS.commands.gotoLine,
    action: 'gotoLine',
    args: [1]
  },
  [MIV_KEYS.operators.yank]: { sequence: MIV_KEYS.operators.yank, action: 'yankLines', args: [1] },
  [MIV_KEYS.commands.yankWord]: { sequence: MIV_KEYS.commands.yankWord, action: 'yankWord', args: [1] },
  [MIV_KEYS.operators.paste]: {
    sequence: MIV_KEYS.operators.paste,
    action: 'pasteAfter',
    vscodeCommand: 'editor.action.clipboardPasteAction'
  },
  [MIV_KEYS.registers.viewer]: {
    sequence: MIV_KEYS.registers.viewer,
    action: 'showRegisters',
    vscodeCommand: 'miv.showRegisters'
  },
  [MIV_KEYS.commands.searchForward]: {
    sequence: MIV_KEYS.commands.searchForward,
    action: 'forwardSearch'
  },
  [MIV_KEYS.commands.searchBackward]: {
    sequence: MIV_KEYS.commands.searchBackward,
    action: 'backwardSearch'
  },
  [MIV_KEYS.commands.searchRegex]: {
    sequence: MIV_KEYS.commands.searchRegex,
    action: 'regexSearch'
  },
  [MIV_KEYS.commands.searchNext]: {
    sequence: MIV_KEYS.commands.searchNext,
    action: 'searchNext'
  },
  [MIV_KEYS.commands.searchPrevious]: {
    sequence: MIV_KEYS.commands.searchPrevious,
    action: 'searchPrevious'
  },
  [MIV_KEYS.commands.docBottom]: {
    sequence: MIV_KEYS.commands.docBottom,
    action: 'cursorLineEnd',
    vscodeCommand: 'cursorBottom'
  }
};

export const TEXT_OBJECT_KEYS = new Set<string>([
  MIV_KEYS.textObjects.auto,
  MIV_KEYS.textObjects.doubleQuote,
  MIV_KEYS.textObjects.singleQuote,
  MIV_KEYS.textObjects.paren,
  MIV_KEYS.textObjects.bracket,
  MIV_KEYS.textObjects.brace,
  MIV_KEYS.textObjects.angle
]);

export const TEXT_OBJECT_COMMAND_KEYS = new Set<string>([
  MIV_KEYS.operators.delete,
  MIV_KEYS.operators.yank,
  MIV_KEYS.operators.paste
]);
