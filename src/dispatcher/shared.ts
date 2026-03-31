import * as vscode from 'vscode';
import type { ParsedAction, ParsedCommand } from '../parser';
import type { RegisterValue, MivMode, MivState } from '../state';

export interface DispatchHooks {
  onModeChanged?: (mode: MivMode) => Promise<void> | void;
  onStatusMessage?: (message: string) => void;
  onYank?: (editor: vscode.TextEditor, range: vscode.Range) => void;
}

export interface DispatchContext {
  command: ParsedCommand;
  state: MivState;
  hooks?: DispatchHooks;
}

export type ActionHandler = (context: DispatchContext) => Promise<void>;
export type ActionHandlerMap = Partial<Record<ParsedAction, ActionHandler>>;

export function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function commandHasExplicitCount(command: ParsedCommand): boolean {
  return /^[0-9]/.test(command.sequence);
}

export type PasteDirection = 'after' | 'before';

export function getRegisterTypeFromText(value: string): 'charwise' | 'linewise' {
  return value.endsWith('\n') ? 'linewise' : 'charwise';
}

export async function pasteRegisterValue(value: RegisterValue, direction: PasteDirection): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || value.text.length === 0) {
    return;
  }

  if (value.type === 'linewise') {
    await pasteLinewise(editor, value.text, direction);
    return;
  }

  const active = editor.selection.active;
  const line = editor.document.lineAt(active.line);
  const insertAt = direction === 'after'
    ? new vscode.Position(active.line, Math.min(line.text.length, active.character + 1))
    : active;

  await editor.edit((editBuilder) => {
    editBuilder.insert(insertAt, value.text);
  });

  const selection = new vscode.Selection(insertAt, insertAt);
  editor.selection = selection;
  editor.revealRange(selection);
}

async function pasteLinewise(editor: vscode.TextEditor, value: string, direction: PasteDirection): Promise<void> {
  const activeLine = editor.selection.active.line;
  const lineStart = editor.document.lineAt(activeLine).range.start;
  const lineEndWithBreak = editor.document.lineAt(activeLine).rangeIncludingLineBreak.end;
  const insertAt = direction === 'after' ? lineEndWithBreak : lineStart;

  const lineText = value.endsWith('\n') ? value.slice(0, -1) : value;
  const insertText = `${lineText}\n`;
  await editor.edit((editBuilder) => {
    editBuilder.insert(insertAt, insertText);
  });

  const firstPastedLine = direction === 'after' ? activeLine + 1 : activeLine;
  const nextPosition = new vscode.Position(firstPastedLine, 0);
  const selection = new vscode.Selection(nextPosition, nextPosition);
  editor.selection = selection;
  editor.revealRange(selection);
}
