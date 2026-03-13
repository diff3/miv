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
  isManualRegisterKey
} from './config';
import { dispatchCommand, getCommandUsageStatsSnapshot } from './dispatcher';
import type { ParsedCommand } from './parser';
import { parseInput } from './parser';
import { showRegisterViewer } from './registerViewer';
import { createUiFeedback } from './uiFeedback';
import { createInitialState, setAnchorFromEditor, setInsertMode, setLastCommand, setNavMode, storeRegister, type MivMode } from './state';

const DEFAULT_PARTIAL_FALLBACK_DELAY_MS = CONFIG.timeouts.sequence;

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
  let buffer = '';
  let lastClipboard = '';
  let fallbackTimer: NodeJS.Timeout | undefined;

  const ui = createUiFeedback({
    getMode: () => state.mode,
    yankHighlightDuration: CONFIG.timeouts.yankHighlight
  });

  const clearTimer = (timer: NodeJS.Timeout | undefined): NodeJS.Timeout | undefined => {
    if (timer) {
      clearTimeout(timer);
    }

    return undefined;
  };

  const clearFallbackTimer = (): void => {
    fallbackTimer = clearTimer(fallbackTimer);
  };

  const resetInputState = (): void => {
    // Full reset is used when a command boundary is reached.
    clearFallbackTimer();
    buffer = '';
    ui.showCommandPreview(undefined);
  };

  const getPreviewText = (text: string): string => {
    if (text.length === 2 && isDigitKey(text[0]) && text[0] !== '0' && text[1] === MIV_KEYS.operators.paste) {
      return `paste register ${text[0]}`;
    }

    return text;
  };

  const updateCursor = async (mode: MivMode): Promise<void> => {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const cursorStyle = mode === MIV_MODES.NAV ? 'block' : 'line';
    await editorConfig.update('cursorStyle', cursorStyle, vscode.ConfigurationTarget.Workspace);
  };

  const syncModeFeedback = async (): Promise<void> => {
    await vscode.commands.executeCommand('setContext', 'miv.mode', state.mode);
    await updateCursor(state.mode);
    ui.updateStatusBar();
  };

  const setNav = async (): Promise<void> => {
    resetInputState();
    setNavMode(state);
    await syncModeFeedback();
  };

  const setInsert = async (): Promise<void> => {
    resetInputState();
    setInsertMode(state);
    await syncModeFeedback();
  };

  const syncClipboardMirror = async (): Promise<void> => {
    const clipboardValue = await vscode.env.clipboard.readText();
    if (clipboardValue.length === 0 || clipboardValue === lastClipboard) {
      return;
    }

    storeRegister(state, '9', {
      text: clipboardValue,
      linewise: clipboardValue.endsWith('\n')
    });
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
    if (parsed.action === 'yankLines' || parsed.action === 'paste') {
      return true;
    }

    return parsed.action === 'operatorMotion' && parsed.args?.[0] === MIV_KEYS.operators.yank;
  };

  const toSequenceKey = (inputKey: string): string | undefined => {
    const sequenceKey = NAV_KEY_MAP[inputKey] ?? inputKey;
    if (!NAV_INPUT_KEY_SET.has(sequenceKey)) {
      return undefined;
    }

    return sequenceKey;
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

  void syncModeFeedback();
  void (async () => {
    lastClipboard = await vscode.env.clipboard.readText();
  })();

  const runParsedCommand = async (parsed: ParsedCommand): Promise<void> => {
    await dispatchCommand(parsed, state, {
      onModeChanged: syncModeFeedback,
      onStatusMessage: ui.showMessage,
      onYank: ui.flashYank
    });

    if (shouldSyncClipboardAfterParsedCommand(parsed)) {
      await syncClipboardMirror();
    }
  };

  const isAllowedRegisterViewerKey = (key: string): boolean => {
    return isDigitKey(key);
  };

  const subscriptions = [
    vscode.commands.registerCommand('type', async (args: { text?: string }) => {
      const key = args?.text;
      if (typeof key !== 'string') {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (state.registerViewerActive) {
        if (isAllowedRegisterViewerKey(key)) {
          await vscode.commands.executeCommand('default:type', args);
        }
        return;
      }

      if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (key === MIV_KEYS.mode.enterInsert) {
        if (state.mode === MIV_MODES.NAV && buffer.length === 0) {
          await setInsert();
          return;
        }

        if (state.mode === MIV_MODES.NAV) {
          await vscode.commands.executeCommand('miv.handleKey', key);
          return;
        }

        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (state.mode === MIV_MODES.NAV) {
        const sequenceKey = toSequenceKey(key);
        if (!sequenceKey) {
          return;
        }

        await vscode.commands.executeCommand('miv.handleKey', sequenceKey);
        return;
      }

      await vscode.commands.executeCommand('default:type', args);
    }),
    vscode.commands.registerCommand('miv.handleKey', async (key: string) => {
      if (state.mode !== MIV_MODES.NAV || state.registerViewerActive) {
        return;
      }

      const sequenceKey = toSequenceKey(key);
      if (!sequenceKey) {
        return;
      }

      clearFallbackTimer();
      if (sequenceKey === MIV_KEYS.mode.enterInsert && buffer.length === 0) {
        await setInsert();
        return;
      }

      buffer += sequenceKey;
      ui.showCommandPreview(getPreviewText(buffer));

      const result = parseInput(buffer);

      if (result.status === 'partial') {
        if (!result.fallbackCommand) {
          return;
        }

        fallbackTimer = setTimeout(async () => {
          await runParsedCommand(result.fallbackCommand as ParsedCommand);
          buffer = '';
          ui.showCommandPreview(undefined);
          fallbackTimer = undefined;
        }, result.fallbackDelayMs ?? DEFAULT_PARTIAL_FALLBACK_DELAY_MS);
        return;
      }

      if (result.status === 'invalid' || !result.command) {
        buffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      await runParsedCommand(result.command);
      buffer = '';
      ui.showCommandPreview(undefined);
    }),
    vscode.commands.registerCommand('miv.toggleMode', async () => {
      if (state.mode === MIV_MODES.NAV) {
        await setInsert();
      }
    }),
    vscode.commands.registerCommand('miv.toNavMode', async () => {
      await setNav();
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
      buffer = '';
      ui.showCommandPreview(undefined);
      await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
      const clipboardValue = await vscode.env.clipboard.readText();
      if (clipboardValue.length === 0) {
        ui.showMessage('clipboard empty');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      const linewise = editor ? isLinewiseSelection(editor) : clipboardValue.endsWith('\n');
      storeRegister(state, '9', {
        text: clipboardValue,
        linewise
      });
      lastClipboard = clipboardValue;
      ui.showMessage('stored clipboard in register 9');
    }),
    vscode.commands.registerCommand('miv.pasteFromClipboard', async () => {
      clearFallbackTimer();
      buffer = '';
      ui.showCommandPreview(undefined);
      await runParsedCommand(
        {
          sequence: 'ctrl+v',
          action: 'paste'
        }
      );
    }),
    vscode.commands.registerCommand('miv.storeRegister', async (register: string) => {
      clearFallbackTimer();
      buffer = '';
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

      storeRegister(state, registerKey, {
        text: clipboardValue,
        linewise: clipboardValue.endsWith('\n')
      });
      ui.showMessage(`stored clipboard in register ${registerKey}`);
    }),
    vscode.commands.registerCommand('miv.showRegisters', async () => {
      if (state.mode !== MIV_MODES.NAV) {
        return;
      }

      clearFallbackTimer();
      buffer = '';
      ui.showCommandPreview(undefined);
      await showRegisterViewer({
        state,
        runParsedCommand,
        showMessage: ui.showMessage
      });
    }),
    vscode.commands.registerCommand('miv.setAnchor', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      setAnchorFromEditor(state, editor);
    }),
    vscode.commands.registerCommand('miv.jumpToAnchor', async () => {
      if (!state.anchorPosition) {
        return;
      }

      const uri = vscode.Uri.parse(state.anchorPosition.uri);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      const selection = new vscode.Selection(state.anchorPosition.position, state.anchorPosition.position);
      editor.selection = selection;
      editor.revealRange(selection);
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
  context.subscriptions.push(...subscriptions);
}

/**
 * VS Code deactivation hook.
 *
 * MIV has no explicit shutdown work; resources are disposed via subscriptions.
 */
export function deactivate(): void {}
