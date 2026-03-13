/**
 * Register viewer QuickPick UI.
 *
 * This module handles register browsing, register paste selection, and manual
 * clipboard-to-register storage flow while preserving extension state flags.
 */
import * as vscode from 'vscode';
import { CONFIG, isDigitKey } from './config';
import type { ParsedCommand } from './parser';
import type { MivState } from './state';

/**
 * Return non-empty register entries for display.
 *
 * Parameters:
 *   state - Mutable runtime state containing register contents.
 *
 * Returns:
 *   Array of [registerKey, value] pairs with non-empty values.
 */
function getRegisterEntries(state: MivState): Array<[string, string]> {
  return Object.entries(state.registers)
    .filter(([, value]) => value.text.length > 0)
    .map(([key, value]) => [key, value.text]);
}

/**
 * Open the register QuickPick and handle paste/store flows.
 *
 * Parameters:
 *   options.state - Mutable runtime state.
 *   options.runParsedCommand - Command executor used for register paste.
 *   options.showMessage - UI status message callback.
 *
 * Side effects:
 *   Mutates state flags, may mutate registers, and executes parsed commands.
 */
export async function showRegisterViewer(options: {
  state: MivState;
  runParsedCommand: (parsed: ParsedCommand) => Promise<void>;
  showMessage: (text: string) => void;
}): Promise<void> {
  const { state, runParsedCommand } = options;
  const toPreview = (value: string): string => {
    const max = CONFIG.registers.previewLength;
    const singleLine = value.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= max) {
      return singleLine;
    }

    return `${singleLine.slice(0, max)}...`;
  };

  const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
  state.registerViewerActive = true;
  quickPick.title = 'Registers';
  quickPick.matchOnDescription = true;
  quickPick.ignoreFocusOut = true;
  const registerEntries = getRegisterEntries(state);
  if (registerEntries.length === 0) {
    void vscode.window.showInformationMessage('No registers yet');
    quickPick.dispose();
    return;
  }

  const setPasteItems = (): void => {
    quickPick.title = 'Registers';
    quickPick.items = getRegisterEntries(state).map(([key, value]) => ({
      label: key,
      description: toPreview(value)
    }));
  };

  setPasteItems();

  const pasteRegister = async (register: string): Promise<void> => {
    await runParsedCommand(
      {
        sequence: `p${register}`,
        action: 'pasteRegister',
        args: [register]
      }
    );
  };

  const handleRegisterSelection = (register: string): boolean => {
    if (!isDigitKey(register)) {
      return false;
    }
    void pasteRegister(register);
    return true;
  };

  const timeout = setTimeout(() => {
    quickPick.hide();
  }, CONFIG.timeouts.registerViewer);

  quickPick.onDidChangeValue((value) => {
    const digit = value.trim();
    if (!handleRegisterSelection(digit)) {
      return;
    }
    quickPick.hide();
  });

  quickPick.onDidAccept(() => {
    const item = quickPick.selectedItems[0];
    if (!item) {
      quickPick.hide();
      return;
    }

    const register = item.label.trim();
    if (!handleRegisterSelection(register)) {
      quickPick.hide();
      return;
    }
    quickPick.hide();
  });

  quickPick.onDidHide(() => {
    state.registerViewerActive = false;
    clearTimeout(timeout);
    quickPick.dispose();
  });

  quickPick.show();
}
