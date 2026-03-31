/**
 * VS Code extension entrypoint for MIV.
 *
 * This module wires editor input events to parser/dispatcher execution, keeps
 * runtime state synchronized with VS Code context, and coordinates UI helpers.
 */
import * as vscode from 'vscode';
import {
  CONFIG,
  MIV_MODES,
  MIV_KEYS,
  NAV_KEY_MAP,
  NAV_INPUT_KEY_SET,
  REPEATABLE_BUILTIN_COMMANDS,
  isDigitKey,
  isManualRegisterKey,
  normalizeKey,
} from './config';
import { dispatchCommand, getCommandUsageStatsSnapshot } from './dispatcher';
import type { ParsedCommand } from './parser';
import { showRegisterViewer } from './registerViewer';
import { createContextSync } from './runtime/contextSync';
import { createInputRouter, type InputRouter } from './runtime/inputRouter';
import { createReplaceController } from './runtime/replaceController';
import { createSearchController } from './runtime/searchController';
import { createUiFeedback } from './uiFeedback';
import { createInitialState, setAnchorFromEditor, setInsertMode, setLastCommand, setNavMode, setRawInputMode, storeRegister, type MivMode, type RegisterType } from './state';

const HANDLE_KEY_FORWARD_COMMANDS = [
  { command: 'miv.cursorLeft', key: 'keya' },
  { command: 'miv.cursorRight', key: 'keyd' },
  { command: 'miv.cursorUp', key: 'keyw' },
  { command: 'miv.pageUp', key: 'shift+keyw' },
  { command: 'miv.cursorDown', key: 'keys' },
  { command: 'miv.pageDown', key: 'shift+keys' },
  { command: 'miv.lineStart', key: 'shift+keya' },
  { command: 'miv.lineEnd', key: 'shift+keyd' },
  { command: 'miv.wordLeft', key: 'keyq' },
  { command: 'miv.wordEndRight', key: 'keye' },
  { command: 'miv.wordEndLeft', key: 'shift+keyq' },
  { command: 'miv.wordStartRight', key: 'shift+keye' },
  { command: 'miv.deleteChar', key: 'keyx' },
  { command: 'miv.deleteLine', key: 'keyb' },
  { command: 'miv.deleteToLineEnd', key: 'shift+keyb' },
  { command: 'miv.deleteWord', key: 'shift+keyx' },
  { command: 'miv.yankWord', key: 'shift+keyy' },
  { command: 'miv.textObjectAuto', key: '!' },
  { command: 'miv.textObjectDoubleQuote', key: '"' },
  { command: 'miv.textObjectSingleQuote', key: "'" },
  { command: 'miv.textObjectParen', key: '(' },
  { command: 'miv.textObjectBracket', key: '[' },
  { command: 'miv.textObjectBrace', key: '{' },
  { command: 'miv.textObjectAngle', key: '<' },
  { command: 'miv.replaceChar', key: 'keyr' },
  { command: 'miv.replaceWord', key: 'shift+keyr' },
  { command: 'miv.toggleCaseChar', key: 'backquote' },
  { command: 'miv.toggleCaseWord', key: 'shift+backquote' },
  { command: 'miv.repeatLastCommandAlias', key: '.' },
  { command: 'miv.enterInsert', key: 'keyi' },
  { command: 'miv.insertAtLineStart', key: 'shift+keyi' },
  { command: 'miv.insertAtLineEnd', key: 'keyk' },
  { command: 'miv.undo', key: 'keyu' },
  { command: 'miv.yankLine', key: 'keyy' },
  { command: 'miv.openLineBelow', key: 'keyo' },
  { command: 'miv.openLineAbove', key: 'shift+keyo' },
  { command: 'miv.paste', key: 'keyp' },
  { command: 'miv.pasteBefore', key: 'shift+keyp' },
  { command: 'miv.jumpBracketMatch', key: '%' },
  { command: 'miv.joinLineWithNext', key: '&' },
  { command: 'miv.changeToLineEnd', key: '-' },
  { command: 'miv.changeLine', key: '_' },
  { command: 'miv.showRegistersKey', key: 'keyv' },
  { command: 'miv.prefixDigit0', key: 'digit0' },
  { command: 'miv.prefixDigit1', key: 'digit1' },
  { command: 'miv.prefixDigit2', key: 'digit2' },
  { command: 'miv.prefixDigit3', key: 'digit3' },
  { command: 'miv.prefixDigit4', key: 'digit4' },
  { command: 'miv.prefixDigit5', key: 'digit5' },
  { command: 'miv.prefixDigit6', key: 'digit6' },
  { command: 'miv.prefixDigit7', key: 'digit7' },
  { command: 'miv.prefixDigit8', key: 'digit8' },
  { command: 'miv.prefixDigit9', key: 'digit9' },
  { command: 'miv.replaceMatches', key: '=' },
  { command: 'miv.searchForward', key: '/' },
  { command: 'miv.searchBackward', key: '\\' },
  { command: 'miv.searchRegex', key: ',' },
  { command: 'miv.searchNext', key: 'keyn' },
  { command: 'miv.searchPrevious', key: 'shift+keyn' },
  { command: 'miv.gotoLine', key: 'keyg' },
  { command: 'miv.documentMiddle', key: 'keym' },
  { command: 'miv.documentBottom', key: 'shift+keyg' }
] as const;

/**
 * Activate extension commands and input pipeline.
 *
 * Parameters:
 *   context - VS Code extension context used for command subscriptions.
 *
 * Side effects:
 *   Registers commands, mutates workspace cursor style, and initializes mode UI.
 */
export function activate(context: vscode.ExtensionContext): void {
  const state = createInitialState();
  const statsOutput = vscode.window.createOutputChannel('MIV Stats');
  const searchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255,255,0,0.25)'
  });
  const searchCurrentDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255,180,0,0.45)'
  });
  let inputBuffer: string[] = [];
  let previewBuffer = '';
  let lastClipboard = '';
  let fallbackTimer: NodeJS.Timeout | undefined;
  let inputRouter: InputRouter | undefined;

  const ui = createUiFeedback({
    getState: () => state,
    yankHighlightDuration: CONFIG.timeouts.yankHighlight
  });

  const clearTimer = (timer: NodeJS.Timeout | undefined): NodeJS.Timeout | undefined => {
    if (timer) {
      clearTimeout(timer);
    }

    return undefined;
  };

  const getActiveAnchorPosition = (editor: vscode.TextEditor): { uri: string; position: vscode.Position } => ({
    uri: editor.document.uri.toString(),
    position: editor.selection.active
  });

  const isSameAnchorPosition = (
    left: { uri: string; position: vscode.Position } | undefined,
    right: { uri: string; position: vscode.Position } | undefined
  ): boolean => {
    return Boolean(
      left
      && right
      && left.uri === right.uri
      && left.position.line === right.position.line
      && left.position.character === right.position.character
    );
  };

  const clearFallbackTimer = (): void => {
    fallbackTimer = clearTimer(fallbackTimer);
  };

  const resetInputState = (): void => {
    // Reset local command-preview plumbing without touching session history.
    clearFallbackTimer();
    inputBuffer = [];
    previewBuffer = '';
    ui.showCommandPreview(undefined);
  };

  const resetInteractiveState = (): void => {
    resetInputState();
    state.registerViewerActive = false;
    setRawInputMode(state, 'NONE');
    state.search = undefined;
    state.searchBuffer = '';
    state.replaceRuleBuffer = '';
    inputRouter?.clear();
  };

  const updateCursor = async (mode: MivMode): Promise<void> => {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const cursorStyle = mode === MIV_MODES.NAV ? 'block' : 'line';
    await editorConfig.update('cursorStyle', cursorStyle, vscode.ConfigurationTarget.Workspace);
  };

  const syncModeFeedback = async (): Promise<void> => {
    await contextSync.syncMode(state.mode);
  };

  const syncInputContexts = async (): Promise<void> => contextSync.syncInputs(state);

  const setNav = async (): Promise<void> => {
    setNavMode(state);
    resetInteractiveState();
    ui.updateStatusBar();
    await syncModeFeedback();
  };

  const setInsert = async (): Promise<void> => {
    setInsertMode(state);
    resetInteractiveState();
    ui.updateStatusBar();
    await syncModeFeedback();
  };

  const contextSync = createContextSync({
    updateCursor,
    updateStatusBar: ui.updateStatusBar
  });
  contextSync.initialize(state);

  const syncClipboardMirror = async (typeOverride?: RegisterType): Promise<void> => {
    const clipboardValue = await vscode.env.clipboard.readText();
    if (clipboardValue.length === 0 || clipboardValue === lastClipboard) {
      return;
    }

    storeRegister(state, '9', clipboardValue, typeOverride ?? (clipboardValue.endsWith('\n') ? 'linewise' : 'charwise'));
    lastClipboard = clipboardValue;
  };

  const isLinewiseSelection = (editor: vscode.TextEditor): boolean => {
    const selection = editor.selection;
    if (selection.isEmpty) {
      return false;
    }

    const startsAtLineStart = selection.start.character === 0;
    const endLine = editor.document.lineAt(selection.end.line);
    const endsAtLineEnd = selection.end.character === endLine.text.length;
    return startsAtLineStart && endsAtLineEnd;
  };

  const shouldSyncClipboardAfterParsedCommand = (parsed: ParsedCommand): boolean => {
    // Reads clipboard only after commands that are expected to touch it.
    if (parsed.action === 'yankLines' || parsed.action === 'yankWord' || parsed.action === 'paste') {
      return true;
    }

    return parsed.action === 'operatorMotion' && parsed.args?.[0] === MIV_KEYS.operators.yank;
  };

  const toInputToken = (inputKey: string): string | undefined => {
    if (NAV_INPUT_KEY_SET.has(inputKey)) {
      return inputKey;
    }

    const normalizedKey = normalizeKey(inputKey);
    const token = NAV_KEY_MAP[normalizedKey] ?? normalizedKey;
    if (!NAV_INPUT_KEY_SET.has(token)) {
      return undefined;
    }

    return token;
  };

  const formatStatsSection = (title: string, counts: Record<string, number>): string[] => {
    const entries = Object.entries(counts).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    });
    const lines = [`=== ${title} ===`, ''];
    if (entries.length === 0) {
      lines.push('(no data)');
      return lines;
    }

    const width = entries.reduce((max, [key]) => Math.max(max, key.length), 0);
    for (const [key, count] of entries) {
      lines.push(`${key.padEnd(width + 2)}${count}`);
    }
    return lines;
  };

  const isBlankDocumentLine = (editor: vscode.TextEditor, line: number): boolean => {
    return editor.document.lineAt(line).text.trim().length === 0;
  };

  const jumpParagraph = async (direction: 'backward' | 'forward'): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const lastLine = editor.document.lineCount - 1;
    if (lastLine < 0) {
      return;
    }

    let line = editor.selection.active.line;

    if (direction === 'forward') {
      if (isBlankDocumentLine(editor, line)) {
        while (line <= lastLine && isBlankDocumentLine(editor, line)) {
          line += 1;
        }
      } else {
        while (line <= lastLine && !isBlankDocumentLine(editor, line)) {
          line += 1;
        }
        while (line <= lastLine && isBlankDocumentLine(editor, line)) {
          line += 1;
        }
      }

      if (line > lastLine) {
        return;
      }
    } else {
      if (isBlankDocumentLine(editor, line)) {
        while (line >= 0 && isBlankDocumentLine(editor, line)) {
          line -= 1;
        }
      } else {
        while (line >= 0 && !isBlankDocumentLine(editor, line)) {
          line -= 1;
        }
        while (line >= 0 && isBlankDocumentLine(editor, line)) {
          line -= 1;
        }
      }

      if (line < 0) {
        line = 0;
      } else {
        while (line > 0 && !isBlankDocumentLine(editor, line - 1)) {
          line -= 1;
        }
      }
    }

    const target = new vscode.Position(line, 0);
    const selection = new vscode.Selection(target, target);
    editor.selection = selection;
    editor.revealRange(selection);
  };

  void syncModeFeedback();
  void (async () => {
    lastClipboard = await vscode.env.clipboard.readText();
  })();

  const runExtensionCommand = async (parsed: ParsedCommand): Promise<boolean> => {
    if (parsed.action === 'forwardSearch' || parsed.action === 'backwardSearch' || parsed.action === 'regexSearch') {
      const query = String(parsed.args?.[0] ?? '');
      if (query.length === 0) {
        return true;
      }

      const direction = parsed.action === 'backwardSearch' ? 'backward' : 'forward';
      const kind = parsed.action === 'regexSearch' ? 'regex' : 'literal';
      const found = await searchController.executeSearch(query, direction, kind);
      if (found) {
        state.lastSearch = query;
        state.lastSearchDirection = direction;
        state.lastSearchPattern = query;
        state.lastSearchIsRegex = kind === 'regex';
      }
      return true;
    }

    if (parsed.action === 'applyReplaceRule') {
      await replaceController.applyReplaceRule();
      return true;
    }

    return false;
  };

  const shouldStoreExtensionRepeat = (parsed: ParsedCommand): boolean => {
    return (
      parsed.action === 'forwardSearch' ||
      parsed.action === 'backwardSearch' ||
      parsed.action === 'regexSearch' ||
      parsed.action === 'applyReplaceRule'
    );
  };

  const runParsedCommand = async (parsed: ParsedCommand): Promise<void> => {
    if (parsed.action === 'repeatLastCommand') {
      if (!state.lastCommand || state.lastCommand.action === 'repeatLastCommand') {
        return;
      }

      await runParsedCommand(state.lastCommand);
      return;
    }

    if (await runExtensionCommand(parsed)) {
      if (shouldStoreExtensionRepeat(parsed)) {
        setLastCommand(state, parsed);
      }
      return;
    }

    await dispatchCommand(parsed, state, {
      onModeChanged: syncModeFeedback,
      onStatusMessage: ui.showMessage,
      onYank: ui.flashYank
    });

    if (shouldSyncClipboardAfterParsedCommand(parsed)) {
      void syncClipboardMirror();
    }
  };

  const searchController = createSearchController({
    state,
    ui,
    searchDecoration,
    searchCurrentDecoration,
    syncInputs: syncInputContexts,
    setLastCommand: (command) => setLastCommand(state, command)
  });

  const replaceController = createReplaceController({
    state,
    syncInputs: syncInputContexts,
    ensureNavMode: async () => {
      setNavMode(state);
      await syncModeFeedback();
    },
    ui,
    setLastCommand: (command) => setLastCommand(state, command),
    clearBufferedInput: () => {
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
    },
    renderSearchHighlights: (editor?: vscode.TextEditor) => searchController.renderHighlights(editor),
    runReplaceCharCommand: async (key: string) => {
      await runParsedCommand({
        sequence: `${MIV_KEYS.operators.replace}${key}`,
        action: 'replaceChar',
        args: [key]
      });
    }
  });

  inputRouter = createInputRouter({
    state,
    ui,
    searchController,
    replaceController,
    defaultType: async (args) => vscode.commands.executeCommand('default:type', args),
    toInputToken,
    setInsert,
    runParsedCommand,
    syncInputs: syncInputContexts,
    setLastCommand: (command) => setLastCommand(state, command),
    isAllowedRegisterViewerKey: (key) => isDigitKey(key)
  });

  const hardResetToNav = async (): Promise<void> => {
    state.searchHighlightVisible = false;
    searchController.clearHighlights();
    await vscode.commands.executeCommand('closeFindWidget');
    resetInteractiveState();
    await setNav();
  };

  const isAllowedRegisterViewerKey = (key: string): boolean => {
    return isDigitKey(key);
  };

  const subscriptions = [
    ...HANDLE_KEY_FORWARD_COMMANDS.map(({ command, key }) => vscode.commands.registerCommand(command, async () => {
      await vscode.commands.executeCommand('miv.handleKey', key);
    })),
    vscode.commands.registerCommand('type', async (args: { text?: string }) => {
      await inputRouter.handleTypeInput(args);
    }),
    vscode.commands.registerCommand('miv.handleKey', async (key: string) => {
      await inputRouter.handleKeyInput(key);
    }),
    vscode.commands.registerCommand('miv.toggleMode', async () => {
      if (state.mode === MIV_MODES.NAV) {
        await setInsert();
      }
    }),
    vscode.commands.registerCommand('miv.toggleSearchHighlight', async () => {
      state.searchHighlightEnabled = !state.searchHighlightEnabled;
      if (!state.searchHighlightEnabled) {
        state.searchHighlightVisible = false;
        searchController.clearHighlights();
        ui.showMessage('search highlight disabled');
        return;
      }

      state.searchHighlightVisible = true;
      searchController.renderHighlights();
      ui.showMessage('search highlight enabled');
    }),
    vscode.commands.registerCommand('miv.toNavMode', async () => {
      await hardResetToNav();
    }),
    vscode.commands.registerCommand('miv.searchBackspace', async () => {
      if (state.replaceRuleInputActive) {
        replaceController.backspaceReplaceRule();
        return;
      }

      if (!state.searchActive) {
        return;
      }

      searchController.backspace();
    }),
    vscode.commands.registerCommand('miv.executeBuiltin', async (command: string, args?: unknown[]) => {
      resetInputState();

      const isRepositionCommand =
        command === 'editor.action.moveLinesUpAction' ||
        command === 'editor.action.moveLinesDownAction' ||
        command === 'editor.action.outdentLines' ||
        command === 'editor.action.indentLines';

      if (isRepositionCommand) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        await vscode.commands.executeCommand('editor.action.focusActiveEditorGroup');
      }

      try {
        await vscode.commands.executeCommand(command, ...(args ?? []));
      } catch {
        ui.showMessage(`command failed: ${command}`);
        return;
      }

      if (REPEATABLE_BUILTIN_COMMANDS.has(command)) {
        setLastCommand(state, {
          sequence: command,
          action: 'builtinEdit',
          vscodeCommand: command,
          args
        });
      }
    }),
    vscode.commands.registerCommand('miv.copyToClipboard', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      const editor = vscode.window.activeTextEditor;
      const registerType = editor && isLinewiseSelection(editor) ? 'linewise' : 'charwise';
      await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
      void syncClipboardMirror(registerType);
    }),
    vscode.commands.registerCommand('miv.pasteFromClipboard', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
      void syncClipboardMirror();
    }),
    vscode.commands.registerCommand('miv.storeRegister', async (register: string) => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      const registerKey = String(register);
      if (!isManualRegisterKey(registerKey)) {
        return;
      }

      const clipboardValue = await vscode.env.clipboard.readText();
      if (clipboardValue.length === 0) {
        ui.showMessage('clipboard empty');
        return;
      }

      storeRegister(state, registerKey, clipboardValue, clipboardValue.endsWith('\n') ? 'linewise' : 'charwise');
      ui.showMessage(`stored clipboard in register ${registerKey}`);
    }),
    vscode.commands.registerCommand('miv.showRegisters', async () => {
      if (state.mode !== MIV_MODES.NAV) {
        return;
      }

      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      await showRegisterViewer({
        state,
        runParsedCommand,
        showMessage: ui.showMessage
      });
    }),
    vscode.commands.registerCommand('miv.openKeymap', async () => {
      const extensionUri = vscode.extensions.getExtension('diff3.miv')?.extensionUri ?? context.extensionUri;
      const uri = vscode.Uri.joinPath(extensionUri, 'doc', 'KEYMAP.md');
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      await vscode.commands.executeCommand('markdown.showPreviewToSide', editor.document.uri);
    }),
    vscode.commands.registerCommand('miv.openKeybindings', async () => {
      await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', 'miv');
    }),
    vscode.commands.registerCommand('miv.openMenu', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);

      const items = [
        { label: '$(graph) Command Stats', action: async () => vscode.commands.executeCommand('miv.showCommandStats') },
        { label: '$(files) Registers', action: async () => vscode.commands.executeCommand('miv.showRegisters') },
        { label: '$(search) Toggle Search Highlight', action: async () => vscode.commands.executeCommand('miv.toggleSearchHighlight') },
        { label: '$(keyboard) Change Keybindings', action: async () => vscode.commands.executeCommand('miv.openKeybindings') },
        { label: '$(book) Open KEYMAP', action: async () => vscode.commands.executeCommand('miv.openKeymap') }
      ];

      const choice = await vscode.window.showQuickPick(items, {
        placeHolder: 'MIV menu'
      });
      if (!choice) {
        return;
      }

      await choice.action();
    }),
    vscode.commands.registerCommand('miv.setAnchor', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      setAnchorFromEditor(state, editor);
      state.anchorTogglePosition = undefined;
    }),
    vscode.commands.registerCommand('miv.jumpToAnchor', async () => {
      if (!state.anchorPosition) {
        return;
      }

      const activeEditor = vscode.window.activeTextEditor;
      const currentPosition = activeEditor ? getActiveAnchorPosition(activeEditor) : undefined;
      const jumpingFromAnchor = isSameAnchorPosition(currentPosition, state.anchorPosition);
      const targetPosition = jumpingFromAnchor && state.anchorTogglePosition
        ? state.anchorTogglePosition
        : state.anchorPosition;

      if (!jumpingFromAnchor && currentPosition) {
        state.anchorTogglePosition = currentPosition;
      }

      const uri = vscode.Uri.parse(targetPosition.uri);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      const selection = new vscode.Selection(targetPosition.position, targetPosition.position);
      editor.selection = selection;
      editor.revealRange(selection);
    }),
    vscode.commands.registerCommand('miv.paragraphBackward', async () => {
      resetInputState();
      await jumpParagraph('backward');
    }),
    vscode.commands.registerCommand('miv.paragraphForward', async () => {
      resetInputState();
      await jumpParagraph('forward');
    }),
    vscode.commands.registerCommand('miv.showCommandStats', async () => {
      const stats = getCommandUsageStatsSnapshot();
      const lines = [
        ...formatStatsSection('MIV Command Usage', stats.actions),
        '',
        ...formatStatsSection('Key Sequences', stats.sequences)
      ];
      statsOutput.clear();
      statsOutput.appendLine(lines.join('\n'));
      statsOutput.show(true);
    })
  ];

  context.subscriptions.push(...ui.disposables);
  context.subscriptions.push(statsOutput);
  context.subscriptions.push(searchDecoration);
  context.subscriptions.push(searchCurrentDecoration);
  context.subscriptions.push(...subscriptions);
}

/**
 * VS Code deactivation hook.
 *
 * MIV has no explicit shutdown work; resources are disposed via subscriptions.
 */
export function deactivate(): void {}
