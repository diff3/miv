import * as vscode from 'vscode';
import { setInsertMode } from '../state';
import type { ActionHandlerMap } from './shared';

export const INSERT_ACTION_HANDLERS: ActionHandlerMap = {
  enterInsert: async ({ state, hooks }) => {
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
  },
  insertAtLineStart: async ({ state, hooks }) => {
    await vscode.commands.executeCommand('cursorHome');
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
  },
  insertAtLineEnd: async ({ state, hooks }) => {
    await vscode.commands.executeCommand('cursorEnd');
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
  },
  openLineBelow: async ({ state, hooks }) => {
    await vscode.commands.executeCommand('editor.action.insertLineAfter');
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
  },
  openLineAbove: async ({ state, hooks }) => {
    await vscode.commands.executeCommand('editor.action.insertLineBefore');
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
  }
};
