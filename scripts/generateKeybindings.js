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

function loadNavKeyBindings() {
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

  const { NAV_KEY_BINDINGS } = module.exports;
  if (!Array.isArray(NAV_KEY_BINDINGS)) {
    fail('src/config.ts does not export NAV_KEY_BINDINGS as an array.');
  }

  for (const entry of NAV_KEY_BINDINGS) {
    if (!entry || typeof entry.key !== 'string' || typeof entry.sequenceValue !== 'string') {
      fail('NAV_KEY_BINDINGS contains an invalid entry. Expected { key: string, sequenceValue: string }.');
    }
  }

  return NAV_KEY_BINDINGS;
}

function buildGeneratedKeybindings(navKeyBindings) {
  return navKeyBindings.map(({ key, sequenceValue }) => ({
    key,
    command: 'miv.handleKey',
    args: sequenceValue,
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
        (typeof binding.key === 'string' && generatedKeys.has(binding.key))
        || (typeof binding.command === 'string' && LEGACY_NAV_COMMANDS.has(binding.command))
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
  const navKeyBindings = loadNavKeyBindings();
  const generatedKeybindings = buildGeneratedKeybindings(navKeyBindings);
  updatePackageJson(generatedKeybindings);
  console.log('MIV keybindings regenerated');
}

main();
