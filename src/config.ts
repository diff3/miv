import * as fs from 'fs';
import * as path from 'path';

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

export function normalizeKey(key: string): string {
  if (!key) {
    return key;
  }

  return key.toLowerCase();
}

const CHAR_TO_PHYSICAL_KEY_ALIASES: Readonly<Record<string, string>> = {
  '`': 'backquote',
  '§': 'backquote',
  '-': 'minus',
  '_': 'shift+minus',
  '=': 'equal',
  '+': 'shift+equal',
  '\\': 'backslash',
  '|': 'shift+backslash',
  '[': 'bracketleft',
  '{': 'shift+bracketleft',
  ']': 'bracketright',
  '}': 'shift+bracketright',
  ';': 'semicolon',
  ':': 'shift+semicolon',
  '\'': 'quote',
  '"': 'shift+quote',
  ',': 'comma',
  '<': 'shift+comma',
  '.': 'period',
  '>': 'shift+period',
  '/': 'slash',
  '?': 'shift+slash',
  '!': 'shift+digit1',
  '%': 'shift+digit5',
  '&': 'shift+digit7',
  '(': 'shift+digit9'
};

const PHYSICAL_TO_CHAR_KEY_ALIASES: Readonly<Record<string, string[]>> = {
  backquote: ['`', '§'],
  minus: ['-'],
  equal: ['='],
  backslash: ['\\'],
  bracketleft: ['['],
  bracketright: [']'],
  semicolon: [';'],
  quote: ['\''],
  comma: [','],
  period: ['.'],
  slash: ['/'],
  'shift+minus': ['_'],
  'shift+equal': ['+'],
  'shift+backslash': ['|'],
  'shift+bracketleft': ['{'],
  'shift+bracketright': ['}'],
  'shift+semicolon': [':'],
  'shift+quote': ['"'],
  'shift+comma': ['<'],
  'shift+period': ['>'],
  'shift+slash': ['?'],
  'shift+digit1': ['!'],
  'shift+digit5': ['%'],
  'shift+digit7': ['&'],
  'shift+digit9': ['(']
};

function getKeyAliases(key: string): string[] {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return [];
  }

  const aliases = new Set<string>([normalized]);
  const shiftPrefix = 'shift+';
  const base = normalized.startsWith(shiftPrefix) ? normalized.slice(shiftPrefix.length) : normalized;
  const shifted = normalized.startsWith(shiftPrefix);

  if (/^[a-z]$/.test(base)) {
    aliases.add(`${shifted ? 'shift+' : ''}key${base}`);
  } else if (/^[0-9]$/.test(base)) {
    aliases.add(`${shifted ? 'shift+' : ''}digit${base}`);
  }

  const charAlias = CHAR_TO_PHYSICAL_KEY_ALIASES[normalized];
  if (charAlias) {
    aliases.add(charAlias);
  }

  const physicalAliases = PHYSICAL_TO_CHAR_KEY_ALIASES[normalized];
  if (physicalAliases) {
    for (const alias of physicalAliases) {
      aliases.add(alias);
    }
  }

  return [...aliases];
}

function buildNavKeyMap(entries: readonly KeyBindingEntry[]): Record<string, string> {
  const pairs: Array<[string, string]> = [];
  for (const entry of entries) {
    for (const alias of getKeyAliases(entry.key)) {
      pairs.push([alias, entry.token]);
    }
  }

  return Object.fromEntries(pairs) as Record<string, string>;
}

export function loadKeymapFile(filePath: string): KeyBindingEntry[] | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) {
      return null;
    }

    const result: KeyBindingEntry[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const key = (entry as { key?: unknown }).key;
      const tokenName = (entry as { token?: unknown }).token;
      if (typeof key !== 'string' || typeof tokenName !== 'string') {
        continue;
      }

      if (Object.hasOwn(TOKENS, tokenName)) {
        result.push({
          key,
          token: TOKENS[tokenName as keyof typeof TOKENS]
        });
        continue;
      }

      if (isDigitKey(tokenName)) {
        result.push({ key, token: tokenName });
        continue;
      }

      console.warn(`Invalid token in keymap: ${tokenName}`);
    }

    return result;
  } catch {
    return null;
  }
}

export function loadKeymapDirectory(dir: string): Record<string, KeyBindingEntry[]> {
  const result: Record<string, KeyBindingEntry[]> = {};
  if (!fs.existsSync(dir)) {
    return result;
  }

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (!file.toLowerCase().endsWith('.json')) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      continue;
    }

    const name = file.replace('.json', '');
    const map = loadKeymapFile(fullPath);
    if (map) {
      result[name] = map;
    }
  }

  return result;
}

function loadKeymapJson(name: string): KeyBindingEntry[] | null {
  return loadKeymapFile(path.join(__dirname, '..', 'keymaps', `${name}.json`));
}

export const NAV_KEY_BINDINGS = loadKeymapJson('default') ?? [];

const DEFAULT_KEYMAP_DIR = path.join(__dirname, '..', 'keymaps');
const DEFAULT_USER_KEYMAP_DIR = path.join(DEFAULT_KEYMAP_DIR, 'user');

export let KEYMAP_PROFILES: Record<string, readonly KeyBindingEntry[]> = {
  ...loadKeymapDirectory(DEFAULT_KEYMAP_DIR),
  ...loadKeymapDirectory(DEFAULT_USER_KEYMAP_DIR),
  default: loadKeymapDirectory(DEFAULT_KEYMAP_DIR).default ?? NAV_KEY_BINDINGS
};

export type KeymapProfileName = keyof typeof KEYMAP_PROFILES;

export let ACTIVE_KEYMAP_NAME = 'default' as KeymapProfileName | string;
export let ACTIVE_KEYMAP: readonly KeyBindingEntry[] = KEYMAP_PROFILES[ACTIVE_KEYMAP_NAME];

export let NAV_KEY_MAP = buildNavKeyMap(ACTIVE_KEYMAP);

export let NAV_INPUT_KEY_SET: ReadonlySet<string> = new Set(
  ACTIVE_KEYMAP.map((entry) => entry.token)
);

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

export function isKeymapProfileName(value: string): value is KeymapProfileName {
  return Object.hasOwn(KEYMAP_PROFILES, value);
}

export function refreshKeymapProfiles(keymapDir = DEFAULT_KEYMAP_DIR, userKeymapDir = DEFAULT_USER_KEYMAP_DIR): void {
  const builtinKeymaps = loadKeymapDirectory(keymapDir);
  const userKeymaps = loadKeymapDirectory(userKeymapDir);

  KEYMAP_PROFILES = {
    ...builtinKeymaps,
    ...userKeymaps,
    default: builtinKeymaps.default ?? NAV_KEY_BINDINGS
  };

  setActiveKeymapName(ACTIVE_KEYMAP_NAME);
}

export function setActiveKeymapName(profileName: string): void {
  if (!KEYMAP_PROFILES[profileName]) {
    profileName = 'default';
  }

  ACTIVE_KEYMAP_NAME = profileName;
  ACTIVE_KEYMAP = KEYMAP_PROFILES[ACTIVE_KEYMAP_NAME];
  NAV_KEY_MAP = buildNavKeyMap(ACTIVE_KEYMAP);
  NAV_INPUT_KEY_SET = new Set(
    ACTIVE_KEYMAP.map((entry) => entry.token)
  );
}
