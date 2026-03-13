#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'src', 'config.ts');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const NAV_WHEN_CLAUSE = "editorTextFocus && miv.mode == 'NAV'";
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
  const source = fs.readFileSync(CONFIG_PATH, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  });

  if (diagnostics && diagnostics.length > 0) {
    const messages = diagnostics
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n');
    fail(`Failed to transpile src/config.ts:\n${messages}`);
  }

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(CONFIG_PATH),
    __filename: CONFIG_PATH
  });

  try {
    vm.runInContext(outputText, context, { filename: CONFIG_PATH });
  } catch (error) {
    fail(`Failed to evaluate src/config.ts: ${error instanceof Error ? error.message : String(error)}`);
  }

  const { ACTIVE_KEYMAP } = module.exports;
  if (!Array.isArray(ACTIVE_KEYMAP)) {
    fail('src/config.ts does not export ACTIVE_KEYMAP as an array.');
  }

  for (const entry of ACTIVE_KEYMAP) {
    if (!entry || typeof entry.key !== 'string' || typeof entry.token !== 'string') {
      fail('ACTIVE_KEYMAP contains an invalid entry. Expected { key: string, token: string }.');
    }
  }

  return ACTIVE_KEYMAP;
}

function buildGeneratedKeybindings(navKeyBindings) {
  return navKeyBindings.map(({ key, token }) => ({
    key: toVscodeKeybindingKey(key),
    command: 'miv.handleKey',
    args: key.toLowerCase(),
    when: NAV_WHEN_CLAUSE
  }));
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

    return !(
      binding.when === NAV_WHEN_CLAUSE
      && (
        binding.command === 'miv.handleKey'
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
