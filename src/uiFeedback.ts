/**
 * UI feedback helpers for mode/status/yank visualization.
 *
 * This module isolates lightweight presentation concerns used by extension.ts
 * so command and parser logic stay focused on behavior.
 */
import * as vscode from 'vscode';
import { CONFIG, MIV_MODES } from './config';
import type { MivMode } from './state';

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
  getMode: () => MivMode;
  yankHighlightDuration: number;
}): UiFeedback {
  let previewText: string | undefined;
  let messageText: string | undefined;
  let messageTimer: NodeJS.Timeout | undefined;

  const modeStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  const yankDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(180,200,255,0.3)'
  });

  const renderStatus = (): void => {
    const mode = options.getMode();
    const base = `MIV ${mode}`;
    const suffix = messageText ?? previewText;
    modeStatusBar.text = suffix ? `${base} | ${suffix}` : base;
    modeStatusBar.backgroundColor = mode === MIV_MODES.NAV
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : new vscode.ThemeColor('statusBarItem.remoteBackground');
    modeStatusBar.show();
  };

  const showCommandPreview = (text?: string): void => {
    previewText = text && text.length > 0 ? text : undefined;
    renderStatus();
  };

  const showMessage = (text: string): void => {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = undefined;
    }
    messageText = text;
    renderStatus();
    messageTimer = setTimeout(() => {
      messageText = undefined;
      messageTimer = undefined;
      renderStatus();
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
    updateStatusBar: renderStatus,
    disposables: [modeStatusBar, yankDecoration]
  };
}
