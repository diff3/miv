import * as vscode from 'vscode';
import type { MivMode, MivState } from '../state';

export interface ContextSync {
  initialize(state: MivState): void;
  syncMode(mode: MivMode): Promise<void>;
  syncInputs(state: MivState): Promise<void>;
}

export function createContextSync(options: {
  updateCursor: (mode: MivMode) => Promise<void>;
  updateStatusBar: () => void;
}): ContextSync {
  const syncInputs = async (state: MivState): Promise<void> => {
    options.updateStatusBar();
    await vscode.commands.executeCommand('setContext', 'miv.prefixInputActive', state.prefixInputActive);
    await vscode.commands.executeCommand('setContext', 'miv.commandInputActive', state.commandInputActive);
    await vscode.commands.executeCommand('setContext', 'miv.searchActive', state.searchActive);
    await vscode.commands.executeCommand('setContext', 'miv.replaceRuleInputActive', state.replaceRuleInputActive);
    await vscode.commands.executeCommand('setContext', 'miv.replaceCharPending', state.replaceCharPending);
  };

  return {
    initialize(state: MivState): void {
      void syncInputs(state);
    },
    async syncMode(mode: MivMode): Promise<void> {
      options.updateStatusBar();
      await vscode.commands.executeCommand('setContext', 'miv.mode', mode);
      await options.updateCursor(mode);
    },
    syncInputs
  };
}
