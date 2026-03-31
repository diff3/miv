import * as vscode from 'vscode';
import { getRegister, storeRegister } from '../state';
import type { ActionHandlerMap } from './shared';
import {
  commandHasExplicitCount,
  getRegisterTypeFromText,
  normalizePositiveInt,
  pasteRegisterValue
} from './shared';

export const REGISTER_ACTION_HANDLERS: ActionHandlerMap = {
  storeRegister: async ({ command, state, hooks }) => {
    const registerKey = String(command.args?.[0] ?? '');
    const clipboardValue = await vscode.env.clipboard.readText();
    if (clipboardValue.length === 0) {
      hooks?.onStatusMessage?.('clipboard empty');
      return;
    }

    storeRegister(state, registerKey, clipboardValue, getRegisterTypeFromText(clipboardValue));
    hooks?.onStatusMessage?.(`stored clipboard in register ${registerKey}`);
  },
  pasteRegister: async ({ command, state, hooks }) => {
    const registerKey = String(command.args?.[0] ?? '');
    const value = getRegister(state, registerKey);
    if (value.text.length === 0) {
      return;
    }

    await pasteRegisterValue(value, 'before');
    hooks?.onStatusMessage?.(`pasted register ${registerKey}`);
  },
  paste: async ({ command, state, hooks }) => {
    const count = normalizePositiveInt(command.args?.[0], 1);
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    }
  },
  pasteAfter: async ({ command, state, hooks }) => {
    const count = normalizePositiveInt(command.args?.[0], 1);
    const value = getRegister(state, '9');
    if (value.text.length === 0) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      await pasteRegisterValue(value, 'after');
    }
    hooks?.onStatusMessage?.('pasted register 9');
  },
  pasteBefore: async ({ command, state, hooks }) => {
    const count = normalizePositiveInt(command.args?.[0], 1);
    const value = getRegister(state, '9');
    if (value.text.length === 0) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      await pasteRegisterValue(value, 'before');
    }
    hooks?.onStatusMessage?.('pasted register 9');
  },
  yankLines: async ({ command, state, hooks }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    const document = editor.document;
    const startLine = editor.selection.active.line;
    const count = normalizePositiveInt(command.args?.[0], 1);
    const targetRegister = String(command.args?.[1] ?? '0');
    if (!commandHasExplicitCount(command) && !selection.isEmpty) {
      const range = new vscode.Range(selection.start, selection.end);
      const yankedText = document.getText(range);
      await vscode.env.clipboard.writeText(yankedText);
      storeRegister(state, targetRegister, yankedText, 'charwise');
      hooks?.onYank?.(editor, range);
      hooks?.onStatusMessage?.(`stored yank in register ${targetRegister}`);
      return;
    }

    const endLine = Math.min(document.lineCount - 1, startLine + count - 1);
    const range = new vscode.Range(
      document.lineAt(startLine).range.start,
      document.lineAt(endLine).rangeIncludingLineBreak.end
    );
    const yankedText = document.getText(range);
    await vscode.env.clipboard.writeText(yankedText);
    storeRegister(state, targetRegister, yankedText, 'linewise');
    hooks?.onYank?.(editor, range);
    hooks?.onStatusMessage?.(`stored yank in register ${targetRegister}`);
  },
  yankWord: async ({ command, state, hooks }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const count = normalizePositiveInt(command.args?.[0], 1);
    const targetRegister = String(command.args?.[1] ?? '0');
    const start = editor.selection.active;
    editor.selection = new vscode.Selection(start, start);
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('cursorWordEndRightSelect');
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      return;
    }

    const range = new vscode.Range(selection.start, selection.end);
    const yankedText = editor.document.getText(range);
    await vscode.env.clipboard.writeText(yankedText);
    storeRegister(state, targetRegister, yankedText, 'charwise');
    hooks?.onYank?.(editor, range);
    hooks?.onStatusMessage?.(`stored yank in register ${targetRegister}`);
    editor.selection = new vscode.Selection(start, start);
  }
};
