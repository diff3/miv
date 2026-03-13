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

export function isDigitKey(value: string): value is DigitKey {
  return DIGIT_KEY_SET.has(value as DigitKey);
}

export function isManualRegisterKey(value: string): value is ManualRegisterKey {
  return MANUAL_REGISTER_KEY_SET.has(value as ManualRegisterKey);
}

export const MIV_MODES = {
  NAV: 'NAV',
  INSERT: 'INSERT'
} as const;

export type MivMode = (typeof MIV_MODES)[keyof typeof MIV_MODES];

export const TOKENS = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  UP: 'UP',
  DOWN: 'DOWN',
  PAGE_UP: 'PAGE_UP',
  PAGE_DOWN: 'PAGE_DOWN',
  LINE_START: 'LINE_START',
  LINE_END: 'LINE_END',
  WORD_LEFT: 'WORD_LEFT',
  WORD_RIGHT: 'WORD_RIGHT',
  WORD_END_LEFT: 'WORD_END_LEFT',
  WORD_END_RIGHT: 'WORD_END_RIGHT',
  DELETE_CHAR: 'DELETE_CHAR',
  DELETE_WORD: 'DELETE_WORD',
  DELETE_LINE: 'DELETE_LINE',
  DELETE_TO_LINE_END: 'DELETE_TO_LINE_END',
  YANK_LINE: 'YANK_LINE',
  YANK_WORD: 'YANK_WORD',
  PASTE_AFTER: 'PASTE_AFTER',
  PASTE_BEFORE: 'PASTE_BEFORE',
  INSERT: 'INSERT',
  INSERT_LINE_START: 'INSERT_LINE_START',
  INSERT_LINE_END: 'INSERT_LINE_END',
  OPEN_LINE_BELOW: 'OPEN_LINE_BELOW',
  OPEN_LINE_ABOVE: 'OPEN_LINE_ABOVE',
  UNDO: 'UNDO',
  REPEAT: 'REPEAT',
  REPEAT_ALIAS: 'REPEAT_ALIAS',
  SEARCH_FORWARD: 'SEARCH_FORWARD',
  SEARCH_BACKWARD: 'SEARCH_BACKWARD',
  SEARCH_REGEX: 'SEARCH_REGEX',
  SEARCH_NEXT: 'SEARCH_NEXT',
  SEARCH_PREVIOUS: 'SEARCH_PREVIOUS',
  GOTO_LINE: 'GOTO_LINE',
  DOC_BOTTOM: 'DOC_BOTTOM',
  SPACE: 'SPACE',
  REPLACE_CHAR: 'REPLACE_CHAR',
  REPLACE_WORD: 'REPLACE_WORD',
  TOGGLE_CASE_CHAR: 'TOGGLE_CASE_CHAR',
  TOGGLE_CASE_WORD: 'TOGGLE_CASE_WORD',
  CHANGE_TO_LINE_END: 'CHANGE_TO_LINE_END',
  CHANGE_LINE: 'CHANGE_LINE',
  JUMP_BRACKET_MATCH: 'JUMP_BRACKET_MATCH',
  JOIN_LINE_WITH_NEXT: 'JOIN_LINE_WITH_NEXT',
  REPLACE_MATCHES: 'REPLACE_MATCHES',
  SHOW_REGISTERS: 'SHOW_REGISTERS',
  TEXT_OBJECT_AUTO: 'TEXT_OBJECT_AUTO',
  TEXT_OBJECT_DOUBLE_QUOTE: 'TEXT_OBJECT_DOUBLE_QUOTE',
  TEXT_OBJECT_SINGLE_QUOTE: 'TEXT_OBJECT_SINGLE_QUOTE',
  TEXT_OBJECT_PAREN: 'TEXT_OBJECT_PAREN',
  TEXT_OBJECT_BRACKET: 'TEXT_OBJECT_BRACKET',
  TEXT_OBJECT_BRACE: 'TEXT_OBJECT_BRACE',
  TEXT_OBJECT_ANGLE: 'TEXT_OBJECT_ANGLE'
} as const;

export type Token = (typeof TOKENS)[keyof typeof TOKENS];

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
    toggleCaseChar: '§',
    toggleCaseWord: '°',
    changeToLineEnd: '-',
    changeLine: '_',
    jumpBracketMatch: '%',
    joinLineWithNext: '&',
    replaceMatches: '=',
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
    searchRegex: ',',
    searchRegexPrompt: '~',
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
  token: Token | string;
}

const TOKEN_SEQUENCE_MAP: Readonly<Record<string, string>> = {
  [TOKENS.LEFT]: MIV_KEYS.navigation.left,
  [TOKENS.RIGHT]: MIV_KEYS.navigation.right,
  [TOKENS.UP]: MIV_KEYS.navigation.up,
  [TOKENS.DOWN]: MIV_KEYS.navigation.down,
  [TOKENS.PAGE_UP]: MIV_KEYS.navigation.pageUp,
  [TOKENS.PAGE_DOWN]: MIV_KEYS.navigation.pageDown,
  [TOKENS.LINE_START]: MIV_KEYS.navigation.lineStart,
  [TOKENS.LINE_END]: MIV_KEYS.navigation.lineEnd,
  [TOKENS.WORD_LEFT]: MIV_KEYS.navigation.wordLeft,
  [TOKENS.WORD_RIGHT]: MIV_KEYS.navigation.wordRight,
  [TOKENS.WORD_END_LEFT]: MIV_KEYS.navigation.wordEndLeft,
  [TOKENS.WORD_END_RIGHT]: MIV_KEYS.navigation.wordEndRight,
  [TOKENS.DELETE_CHAR]: MIV_KEYS.operators.delete,
  [TOKENS.DELETE_WORD]: MIV_KEYS.commands.deleteWord,
  [TOKENS.DELETE_LINE]: MIV_KEYS.commands.deleteLine,
  [TOKENS.DELETE_TO_LINE_END]: MIV_KEYS.commands.deleteToLineEnd,
  [TOKENS.YANK_LINE]: MIV_KEYS.operators.yank,
  [TOKENS.YANK_WORD]: MIV_KEYS.commands.yankWord,
  [TOKENS.PASTE_AFTER]: MIV_KEYS.operators.paste,
  [TOKENS.PASTE_BEFORE]: MIV_KEYS.commands.pasteBefore,
  [TOKENS.INSERT]: MIV_KEYS.commands.insert,
  [TOKENS.INSERT_LINE_START]: MIV_KEYS.commands.insertLineStart,
  [TOKENS.INSERT_LINE_END]: MIV_KEYS.commands.insertLineEnd,
  [TOKENS.OPEN_LINE_BELOW]: MIV_KEYS.commands.openLineBelow,
  [TOKENS.OPEN_LINE_ABOVE]: MIV_KEYS.commands.openLineAbove,
  [TOKENS.UNDO]: MIV_KEYS.commands.undo,
  [TOKENS.REPEAT]: MIV_KEYS.commands.repeat,
  [TOKENS.REPEAT_ALIAS]: MIV_KEYS.commands.repeatAlias,
  [TOKENS.SEARCH_FORWARD]: MIV_KEYS.commands.searchForward,
  [TOKENS.SEARCH_BACKWARD]: MIV_KEYS.commands.searchBackward,
  [TOKENS.SEARCH_REGEX]: MIV_KEYS.commands.searchRegex,
  [TOKENS.SEARCH_NEXT]: MIV_KEYS.commands.searchNext,
  [TOKENS.SEARCH_PREVIOUS]: MIV_KEYS.commands.searchPrevious,
  [TOKENS.GOTO_LINE]: MIV_KEYS.commands.gotoLine,
  [TOKENS.DOC_BOTTOM]: MIV_KEYS.commands.docBottom,
  [TOKENS.SPACE]: ' ',
  [TOKENS.REPLACE_CHAR]: MIV_KEYS.operators.replace,
  [TOKENS.REPLACE_WORD]: MIV_KEYS.commands.replaceWord,
  [TOKENS.TOGGLE_CASE_CHAR]: MIV_KEYS.commands.toggleCaseChar,
  [TOKENS.TOGGLE_CASE_WORD]: MIV_KEYS.commands.toggleCaseWord,
  [TOKENS.CHANGE_TO_LINE_END]: MIV_KEYS.commands.changeToLineEnd,
  [TOKENS.CHANGE_LINE]: MIV_KEYS.commands.changeLine,
  [TOKENS.JUMP_BRACKET_MATCH]: MIV_KEYS.commands.jumpBracketMatch,
  [TOKENS.JOIN_LINE_WITH_NEXT]: MIV_KEYS.commands.joinLineWithNext,
  [TOKENS.REPLACE_MATCHES]: MIV_KEYS.commands.replaceMatches,
  [TOKENS.SHOW_REGISTERS]: MIV_KEYS.registers.viewer,
  [TOKENS.TEXT_OBJECT_AUTO]: MIV_KEYS.textObjects.auto,
  [TOKENS.TEXT_OBJECT_DOUBLE_QUOTE]: MIV_KEYS.textObjects.doubleQuote,
  [TOKENS.TEXT_OBJECT_SINGLE_QUOTE]: MIV_KEYS.textObjects.singleQuote,
  [TOKENS.TEXT_OBJECT_PAREN]: MIV_KEYS.textObjects.paren,
  [TOKENS.TEXT_OBJECT_BRACKET]: MIV_KEYS.textObjects.bracket,
  [TOKENS.TEXT_OBJECT_BRACE]: MIV_KEYS.textObjects.brace,
  [TOKENS.TEXT_OBJECT_ANGLE]: MIV_KEYS.textObjects.angle
};

export function isToken(value: string): value is Token {
  return Object.hasOwn(TOKEN_SEQUENCE_MAP, value);
}

export function getSequenceValueForToken(token: string): string {
  return TOKEN_SEQUENCE_MAP[token] ?? token;
}
