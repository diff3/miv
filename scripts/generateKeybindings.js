#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_KEYMAP_PATH = path.join(ROOT_DIR, 'keymaps', 'default.json');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const NAV_WHEN_CLAUSE = "editorTextFocus && miv.mode == 'NAV' && !miv.searchActive && !miv.replaceRuleInputActive && !miv.replaceCharPending";
const LEGACY_NAV_COMMANDS = new Set([
  'miv.cursorLeft',
  'miv.cursorRight',
  'miv.cursorUp',
  'miv.pageUp',
  'miv.cursorDown',
  'miv.pageDown',
  'miv.lineStart',
  'miv.lineEnd',
  'miv.wordLeft',
  'miv.wordEndRight',
  'miv.wordEndLeft',
  'miv.wordStartRight',
  'miv.deleteChar',
  'miv.deleteLine',
  'miv.deleteWord',
  'miv.yankWord',
  'miv.spaceInput',
  'miv.textObjectAuto',
  'miv.replaceChar',
  'miv.replaceWord',
  'miv.toggleCaseChar',
  'miv.toggleCaseWord',
  'miv.repeatLastCommand',
  'miv.repeatLastCommandAlias',
  'miv.enterInsert',
  'miv.insertAtLineStart',
  'miv.insertAtLineEnd',
  'miv.undo',
  'miv.yankLine',
  'miv.openLineBelow',
  'miv.openLineAbove',
  'miv.paste',
  'miv.showRegistersKey',
  'miv.replaceMatches',
  'miv.searchForward',
  'miv.searchBackward',
  'miv.searchRegex',
  'miv.searchNext',
  'miv.searchPrevious',
  'miv.gotoLine',
  'miv.documentBottom'
]);
const TOKEN_COMMAND_MAP = {
  LEFT: 'miv.cursorLeft',
  RIGHT: 'miv.cursorRight',
  UP: 'miv.cursorUp',
  PAGE_UP: 'miv.pageUp',
  DOWN: 'miv.cursorDown',
  PAGE_DOWN: 'miv.pageDown',
  LINE_START: 'miv.lineStart',
  LINE_END: 'miv.lineEnd',
  WORD_LEFT: 'miv.wordLeft',
  WORD_RIGHT: 'miv.wordEndRight',
  WORD_END_LEFT: 'miv.wordEndLeft',
  WORD_END_RIGHT: 'miv.wordStartRight',
  DELETE_CHAR: 'miv.deleteChar',
  DELETE_LINE: 'miv.deleteLine',
  DELETE_TO_LINE_END: 'miv.deleteToLineEnd',
  DELETE_WORD: 'miv.deleteWord',
  YANK_WORD: 'miv.yankWord',
  SPACE: 'miv.spaceInput',
  TEXT_OBJECT_AUTO: 'miv.textObjectAuto',
  TEXT_OBJECT_DOUBLE_QUOTE: 'miv.textObjectDoubleQuote',
  TEXT_OBJECT_SINGLE_QUOTE: 'miv.textObjectSingleQuote',
  TEXT_OBJECT_PAREN: 'miv.textObjectParen',
  TEXT_OBJECT_BRACKET: 'miv.textObjectBracket',
  TEXT_OBJECT_BRACE: 'miv.textObjectBrace',
  TEXT_OBJECT_ANGLE: 'miv.textObjectAngle',
  REPLACE_CHAR: 'miv.replaceChar',
  REPLACE_WORD: 'miv.replaceWord',
  TOGGLE_CASE_CHAR: 'miv.toggleCaseChar',
  TOGGLE_CASE_WORD: 'miv.toggleCaseWord',
  REPEAT: 'miv.repeatLastCommand',
  REPEAT_ALIAS: 'miv.repeatLastCommandAlias',
  INSERT: 'miv.enterInsert',
  INSERT_LINE_START: 'miv.insertAtLineStart',
  INSERT_LINE_END: 'miv.insertAtLineEnd',
  UNDO: 'miv.undo',
  YANK_LINE: 'miv.yankLine',
  OPEN_LINE_BELOW: 'miv.openLineBelow',
  OPEN_LINE_ABOVE: 'miv.openLineAbove',
  PASTE_AFTER: 'miv.paste',
  PASTE_BEFORE: 'miv.pasteBefore',
  JUMP_BRACKET_MATCH: 'miv.jumpBracketMatch',
  JOIN_LINE_WITH_NEXT: 'miv.joinLineWithNext',
  CHANGE_TO_LINE_END: 'miv.changeToLineEnd',
  CHANGE_LINE: 'miv.changeLine',
  SHOW_REGISTERS: 'miv.showRegistersKey',
  REPLACE_MATCHES: 'miv.replaceMatches',
  SEARCH_FORWARD: 'miv.searchForward',
  SEARCH_BACKWARD: 'miv.searchBackward',
  SEARCH_REGEX: 'miv.searchRegex',
  SEARCH_NEXT: 'miv.searchNext',
  SEARCH_PREVIOUS: 'miv.searchPrevious',
  GOTO_LINE: 'miv.gotoLine',
  DOC_BOTTOM: 'miv.documentBottom',
  '0': 'miv.prefixDigit0',
  '1': 'miv.prefixDigit1',
  '2': 'miv.prefixDigit2',
  '3': 'miv.prefixDigit3',
  '4': 'miv.prefixDigit4',
  '5': 'miv.prefixDigit5',
  '6': 'miv.prefixDigit6',
  '7': 'miv.prefixDigit7',
  '8': 'miv.prefixDigit8',
  '9': 'miv.prefixDigit9'
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

const SCAN_CODE_MAP = {
  backquote: 'Backquote',
  minus: 'Minus',
  equal: 'Equal',
  backslash: 'Backslash',
  intlbackslash: 'IntlBackslash',
  bracketleft: 'BracketLeft',
  bracketright: 'BracketRight',
  semicolon: 'Semicolon',
  quote: 'Quote',
  comma: 'Comma',
  period: 'Period',
  slash: 'Slash'
};

function toVscodeKeybindingKey(key) {
  const normalized = key.toLowerCase();
  const parts = normalized.split('+');
  const main = parts.pop();

  if (!main) {
    return key;
  }

  let scanCode = null;
  if (/^key[a-z]$/.test(main)) {
    scanCode = `Key${main.slice(3).toUpperCase()}`;
  } else if (/^digit[0-9]$/.test(main)) {
    scanCode = `Digit${main.slice(5)}`;
  } else if (SCAN_CODE_MAP[main]) {
    scanCode = SCAN_CODE_MAP[main];
  }

  if (!scanCode) {
    return normalized;
  }

  const modifiers = parts.map((part) => part.toLowerCase());
  return [...modifiers, `[${scanCode}]`].join('+');
}

function loadActiveKeymap() {
  const ACTIVE_KEYMAP = JSON.parse(fs.readFileSync(DEFAULT_KEYMAP_PATH, 'utf8'));
  if (!Array.isArray(ACTIVE_KEYMAP)) {
    fail('keymaps/default.json must contain an array.');
  }

  for (const entry of ACTIVE_KEYMAP) {
    if (!entry || typeof entry.key !== 'string' || typeof entry.token !== 'string') {
      fail('keymaps/default.json contains an invalid entry. Expected { key: string, token: string }.');
    }
  }

  return ACTIVE_KEYMAP;
}

function buildGeneratedKeybindings(navKeyBindings) {
  return [
    ...navKeyBindings.map(({ key, token }) => {
      const binding = {
        key: toVscodeKeybindingKey(key),
        command: TOKEN_COMMAND_MAP[token] ?? 'miv.handleKey',
        when: NAV_WHEN_CLAUSE
      };

      if (binding.command === 'miv.handleKey') {
        binding.args = key.toLowerCase();
      }

      return binding;
    }),
    {
      key: 'backspace',
      command: 'miv.searchBackspace',
      when: "editorTextFocus && (miv.searchActive || miv.replaceRuleInputActive)"
    }
  ];
}

function updatePackageJson(generatedKeybindings) {
  const source = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const packageJson = JSON.parse(source);
  const keybindings = packageJson?.contributes?.keybindings;

  if (!Array.isArray(keybindings)) {
    fail('package.json is missing contributes.keybindings.');
  }

  const generatedKeys = new Set(generatedKeybindings.map((binding) => binding.key));
  const preservedKeybindings = keybindings.filter((binding) => {
    if (!binding || typeof binding !== 'object') {
      return true;
    }

    const isNavHandleKeybinding =
      binding.command === 'miv.handleKey'
      && typeof binding.when === 'string'
      && binding.when.includes("editorTextFocus && miv.mode == 'NAV'");

    return !(
      (
        isNavHandleKeybinding
        || binding.command === 'miv.searchBackspace'
        || (
          typeof binding.key === 'string'
          && generatedKeys.has(binding.key)
        )
        || (
          typeof binding.command === 'string'
          && LEGACY_NAV_COMMANDS.has(binding.command)
        )
      )
    );
  });

  packageJson.contributes.keybindings = [
    ...generatedKeybindings,
    ...preservedKeybindings
  ];

  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function main() {
  const navKeyBindings = loadActiveKeymap();
  const generatedKeybindings = buildGeneratedKeybindings(navKeyBindings);
  updatePackageJson(generatedKeybindings);
  console.log('MIV keybindings regenerated');
}

main();
