/**
 * UI feedback helpers for mode/status/yank visualization.
 *
 * This module isolates lightweight presentation concerns used by extension.ts
 * so command and parser logic stay focused on behavior.
 */
import * as vscode from 'vscode';
import { CONFIG, MIV_MODES } from './config';
import type { MivMode, MivState } from './state';

export interface UiFeedback {
  showCommandPreview: (text?: string) => void;
  showMessage: (text: string) => void;
  flashYank: (editor: vscode.TextEditor, range: vscode.Range) => void;
  updateStatusBar: () => void;
  disposables: vscode.Disposable[];
}

/**
 * Create UI feedback helpers bound to current runtime mode.
 *
 * Parameters:
 *   options.getMode - Callback that returns current mode for status rendering.
 *   options.yankHighlightDuration - Highlight lifetime in milliseconds.
 *
 * Returns:
 *   UiFeedback facade used by extension.ts command wiring.
 */
export function createUiFeedback(options: {
  getState: () => Pick<MivState, 'mode' | 'prefixInputActive' | 'commandInputActive' | 'replaceCharPending'>;
  yankHighlightDuration: number;
}): UiFeedback {
  let previewText: string | undefined;
  let messageText: string | undefined;
  let messageTimer: NodeJS.Timeout | undefined;

  const modeStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  const commandStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
  const yankDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(180,200,255,0.3)'
  });

  const getStatusLabel = (): string => {
    const state = options.getState();

    if (state.commandInputActive) {
      return 'MIN SUFIX';
    }

    if (state.prefixInputActive || state.replaceCharPending) {
      return 'MIN MOD';
    }

    if (state.mode === MIV_MODES.INSERT) {
      return 'MIN INSERT';
    }

    return 'MIN NAV';
  };

  const renderModeStatus = (): void => {
    const state = options.getState();

    modeStatusBar.text = getStatusLabel();
    modeStatusBar.command = 'miv.openMenu';
    modeStatusBar.tooltip = 'Open MIV menu';
    modeStatusBar.backgroundColor = state.mode === MIV_MODES.NAV && !state.prefixInputActive && !state.commandInputActive && !state.replaceCharPending
      ? undefined
      : new vscode.ThemeColor('statusBarItem.warningBackground');
    modeStatusBar.color = undefined;
    modeStatusBar.show();
  };

  const renderCommandStatus = (): void => {
    const activeText = previewText ?? messageText;

    if (!activeText) {
      commandStatusBar.hide();
      return;
    }

    commandStatusBar.text = activeText;
    commandStatusBar.tooltip = 'MIV command line';
    commandStatusBar.backgroundColor = undefined;
    commandStatusBar.color = undefined;
    commandStatusBar.show();
  };

  const showCommandPreview = (text?: string): void => {
    previewText = text && text.length > 0 ? text : undefined;
    renderCommandStatus();
  };

  const showMessage = (text: string): void => {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = undefined;
    }
    messageText = text;
    renderCommandStatus();
    messageTimer = setTimeout(() => {
      messageText = undefined;
      messageTimer = undefined;
      renderCommandStatus();
    }, CONFIG.timeouts.statusMessage);
  };

  const flashYank = (editor: vscode.TextEditor, range: vscode.Range): void => {
    // Decoration-based flash keeps yank feedback mode-independent.
    editor.setDecorations(yankDecoration, [range]);
    setTimeout(() => {
      editor.setDecorations(yankDecoration, []);
    }, options.yankHighlightDuration);
  };

  return {
    showCommandPreview,
    showMessage,
    flashYank,
    updateStatusBar: renderModeStatus,
    disposables: [modeStatusBar, commandStatusBar, yankDecoration]
  };
}
