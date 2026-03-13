/**
 * MIV configuration and key vocabulary.
 *
 * This module is the central source of truth for runtime constants used by
 * input handling, parsing, dispatching, and UI feedback.
 */
export const CONFIG = {
  timeouts: {
    sequence: 200,
    operator: 200,
    paste: 350,
    statusMessage: 1000,
    yankHighlight: 200,
    registerViewer: 2000
  },
  registers: {
    previewLength: 20
  }
} as const;

export const DIGIT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type DigitKey = (typeof DIGIT_KEYS)[number];
export const DIGIT_KEY_SET = new Set<DigitKey>(DIGIT_KEYS);

export const MANUAL_REGISTER_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
export type ManualRegisterKey = (typeof MANUAL_REGISTER_KEYS)[number];
export const MANUAL_REGISTER_KEY_SET = new Set<ManualRegisterKey>(MANUAL_REGISTER_KEYS);

/**
 * Check whether a value is one of the supported digit register keys.
 *
 * Parameters:
 *   value - Candidate key string.
 *
 * Returns:
 *   True when the value is in DIGIT_KEYS.
 */
export function isDigitKey(value: string): value is DigitKey {
  return DIGIT_KEY_SET.has(value as DigitKey);
}

/**
 * Check whether a value is one of the manually writable registers.
 *
 * Parameters:
 *   value - Candidate key string.
 *
 * Returns:
 *   True when the value is in MANUAL_REGISTER_KEYS.
 */
export function isManualRegisterKey(value: string): value is ManualRegisterKey {
  return MANUAL_REGISTER_KEY_SET.has(value as ManualRegisterKey);
}

export const MIV_MODES = {
  NAV: 'NAV',
  INSERT: 'INSERT'
} as const;

export type MivMode = (typeof MIV_MODES)[keyof typeof MIV_MODES];

export const MIV_KEYS = {
  mode: {
    enterInsert: ' ',
    enter: '\n',
    carriageReturn: '\r'
  },
  navigation: {
    left: 'a',
    right: 'd',
    up: 'w',
    down: 's',
    pageUp: 'W',
    pageDown: 'S',
    lineStart: 'A',
    lineEnd: 'D',
    wordLeft: 'q',
    wordRight: 'e',
    wordEndLeft: 'Q',
    wordEndRight: 'E'
  },
  operators: {
    delete: 'x',
    replace: 'r',
    yank: 'y',
    paste: 'p'
  },
  commands: {
    deleteLine: 'b',
    deleteToLineEnd: 'B',
    gotoLine: 'g',
    deleteWord: 'X',
    yankWord: 'Y',
    pasteBefore: 'P',
    replaceWord: 'R',
    changeToLineEnd: '-',
    changeLine: '_',
    jumpBracketMatch: '%',
    joinLineWithNext: '&',
    repeat: 'c',
    repeatAlias: '.',
    insert: 'i',
    insertLineStart: 'I',
    insertLineEnd: 'k',
    openLineBelow: 'o',
    openLineAbove: 'O',
    undo: 'u',
    searchForward: '/',
    searchBackward: '\\',
    searchNext: 'n',
    searchPrevious: 'N',
    docBottom: 'G'
  },
  registers: {
    viewer: 'v'
  },
  textObjects: {
    auto: '!',
    doubleQuote: '"',
    singleQuote: "'",
    paren: '(',
    bracket: '[',
    brace: '{',
    angle: '<'
  }
} as const;

export const REPEATABLE_BUILTIN_COMMANDS = new Set([
  'editor.action.moveLinesUpAction',
  'editor.action.moveLinesDownAction',
  'editor.action.outdentLines',
  'editor.action.indentLines'
]);

export interface KeyBindingEntry {
  key: string;
  sequenceValue: string;
}

/**
 * NAV-mode keys accepted by the MIV input engine.
 *
 * The `key` value reflects VS Code keybinding syntax, while `sequenceValue`
 * is the normalized token consumed by the parser.
 */
export const NAV_KEY_BINDINGS = [
  { key: MIV_KEYS.navigation.left, sequenceValue: MIV_KEYS.navigation.left },
  { key: MIV_KEYS.navigation.right, sequenceValue: MIV_KEYS.navigation.right },
  { key: MIV_KEYS.navigation.up, sequenceValue: MIV_KEYS.navigation.up },
  { key: MIV_KEYS.navigation.down, sequenceValue: MIV_KEYS.navigation.down },
  { key: 'shift+w', sequenceValue: MIV_KEYS.navigation.pageUp },
  { key: 'shift+s', sequenceValue: MIV_KEYS.navigation.pageDown },
  { key: 'shift+a', sequenceValue: MIV_KEYS.navigation.lineStart },
  { key: 'shift+d', sequenceValue: MIV_KEYS.navigation.lineEnd },
  { key: MIV_KEYS.navigation.wordLeft, sequenceValue: MIV_KEYS.navigation.wordLeft },
  { key: MIV_KEYS.navigation.wordRight, sequenceValue: MIV_KEYS.navigation.wordRight },
  { key: 'shift+q', sequenceValue: MIV_KEYS.navigation.wordEndLeft },
  { key: 'shift+e', sequenceValue: MIV_KEYS.navigation.wordEndRight },
  { key: MIV_KEYS.operators.delete, sequenceValue: MIV_KEYS.operators.delete },
  { key: MIV_KEYS.commands.deleteLine, sequenceValue: MIV_KEYS.commands.deleteLine },
  { key: 'shift+b', sequenceValue: MIV_KEYS.commands.deleteToLineEnd },
  { key: 'shift+x', sequenceValue: MIV_KEYS.commands.deleteWord },
  { key: 'shift+y', sequenceValue: MIV_KEYS.commands.yankWord },
  { key: 'space', sequenceValue: ' ' },
  { key: MIV_KEYS.operators.replace, sequenceValue: MIV_KEYS.operators.replace },
  { key: 'shift+r', sequenceValue: MIV_KEYS.commands.replaceWord },
  { key: MIV_KEYS.commands.repeat, sequenceValue: MIV_KEYS.commands.repeat },
  { key: MIV_KEYS.commands.repeatAlias, sequenceValue: MIV_KEYS.commands.repeatAlias },
  { key: MIV_KEYS.commands.insert, sequenceValue: MIV_KEYS.commands.insert },
  { key: 'shift+i', sequenceValue: MIV_KEYS.commands.insertLineStart },
  { key: MIV_KEYS.commands.insertLineEnd, sequenceValue: MIV_KEYS.commands.insertLineEnd },
  { key: MIV_KEYS.commands.openLineBelow, sequenceValue: MIV_KEYS.commands.openLineBelow },
  { key: 'shift+o', sequenceValue: MIV_KEYS.commands.openLineAbove },
  { key: MIV_KEYS.commands.undo, sequenceValue: MIV_KEYS.commands.undo },
  { key: MIV_KEYS.operators.yank, sequenceValue: MIV_KEYS.operators.yank },
  { key: MIV_KEYS.operators.paste, sequenceValue: MIV_KEYS.operators.paste },
  { key: 'shift+p', sequenceValue: MIV_KEYS.commands.pasteBefore },
  { key: 'shift+5', sequenceValue: MIV_KEYS.commands.jumpBracketMatch },
  { key: 'shift+7', sequenceValue: MIV_KEYS.commands.joinLineWithNext },
  { key: '-', sequenceValue: MIV_KEYS.commands.changeToLineEnd },
  { key: 'shift+-', sequenceValue: MIV_KEYS.commands.changeLine },
  { key: MIV_KEYS.textObjects.doubleQuote, sequenceValue: MIV_KEYS.textObjects.doubleQuote },
  { key: MIV_KEYS.textObjects.singleQuote, sequenceValue: MIV_KEYS.textObjects.singleQuote },
  { key: MIV_KEYS.textObjects.paren, sequenceValue: MIV_KEYS.textObjects.paren },
  { key: MIV_KEYS.textObjects.bracket, sequenceValue: MIV_KEYS.textObjects.bracket },
  { key: MIV_KEYS.textObjects.brace, sequenceValue: MIV_KEYS.textObjects.brace },
  { key: MIV_KEYS.textObjects.angle, sequenceValue: MIV_KEYS.textObjects.angle },
  { key: MIV_KEYS.textObjects.auto, sequenceValue: MIV_KEYS.textObjects.auto },
  { key: MIV_KEYS.registers.viewer, sequenceValue: MIV_KEYS.registers.viewer },
  { key: MIV_KEYS.commands.gotoLine, sequenceValue: MIV_KEYS.commands.gotoLine },
  { key: 'shift+g', sequenceValue: MIV_KEYS.commands.docBottom },
  ...DIGIT_KEYS.map((digit) => ({ key: digit, sequenceValue: digit })),
  { key: MIV_KEYS.commands.searchForward, sequenceValue: MIV_KEYS.commands.searchForward },
  { key: MIV_KEYS.commands.searchBackward, sequenceValue: MIV_KEYS.commands.searchBackward },
  { key: MIV_KEYS.commands.searchNext, sequenceValue: MIV_KEYS.commands.searchNext },
  { key: 'shift+n', sequenceValue: MIV_KEYS.commands.searchPrevious }
 ] as const satisfies readonly KeyBindingEntry[];

export const NAV_KEY_MAP = Object.fromEntries(
  NAV_KEY_BINDINGS.map((entry) => [entry.key, entry.sequenceValue])
) as Record<string, string>;

export const NAV_INPUT_KEY_SET: ReadonlySet<string> = new Set(
  NAV_KEY_BINDINGS.map((entry) => entry.sequenceValue)
);
