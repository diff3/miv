import * as vscode from 'vscode';
import { MIV_KEYS } from '../config';
import { getRegister, setInsertMode, storeRegister } from '../state';
import type { ParsedCommand } from '../parser';
import type { ActionHandlerMap, DispatchHooks } from './shared';
import { commandHasExplicitCount, normalizePositiveInt } from './shared';
import { executeOperatorMotion } from './motionActions';

export const EDIT_ACTION_HANDLERS: ActionHandlerMap = {
  deleteLine: async ({ command, state, hooks }) => {
    await executeDeleteLine(command, state, hooks);
  },
  deleteCharRight: async ({ command, state, hooks }) => {
    await executeDeleteCharRight(command, state, hooks);
  },
  deleteWordRight: async ({ command, state, hooks }) => {
    await executeDeleteWordRight(command, state, hooks);
  },
  deleteToLineEnd: async ({ command, state, hooks }) => {
    await executeDeleteToLineEnd(command, state, hooks);
  },
  replaceWord: async ({ command, state, hooks }) => {
    await executeReplaceWord(command, state, hooks);
  },
  toggleCaseChar: async ({ command, hooks }) => {
    await executeToggleCaseChar(command, hooks);
  },
  toggleCaseWord: async ({ command, hooks }) => {
    await executeToggleCaseWord(command, hooks);
  },
  replaceChar: async ({ command }) => {
    await executeReplaceChar(command);
  },
  operatorMotion: async ({ command, state, hooks }) => {
    await executeOperatorMotion(command, state, hooks);
  },
  changeToLineEnd: async ({ state, hooks }) => {
    await executeChangeToLineEnd(state, hooks);
  },
  changeLine: async ({ state, hooks }) => {
    await executeChangeLine(state, hooks);
  },
  joinLineWithNext: async () => {
    await vscode.commands.executeCommand('editor.action.joinLines');
  },
  textObjectOperation: async ({ command, state, hooks }) => {
    await executeTextObjectOperation(command, state, hooks);
  }
};

async function executeDeleteCharRight(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const targetRegister = String(command.args?.[1] ?? '8');
  if (!commandHasExplicitCount(command) && !editor.selection.isEmpty) {
    const range = new vscode.Range(editor.selection.start, editor.selection.end);
    const deletedText = editor.document.getText(range);
    await editor.edit((editBuilder) => {
      editBuilder.delete(range);
    });
    const caret = range.start;
    editor.selection = new vscode.Selection(caret, caret);
    storeRegister(state, targetRegister, deletedText, 'charwise');
    hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
    return;
  }

  const document = editor.document;
  const start = editor.selection.active;
  const startOffset = document.offsetAt(start);
  const endOffset = Math.min(document.getText().length, startOffset + count);
  const end = document.positionAt(endOffset);
  if (start.isEqual(end)) {
    return;
  }

  const range = new vscode.Range(start, end);
  const deletedText = document.getText(range);
  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });
  editor.selection = new vscode.Selection(start, start);
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
}

async function executeDeleteWordRight(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const count = normalizePositiveInt(command.args?.[0], 1);
  const targetRegister = String(command.args?.[1] ?? '8');

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

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
  const deletedText = editor.document.getText(range);
  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });
  editor.selection = new vscode.Selection(start, start);
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
}

async function executeDeleteToLineEnd(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const targetRegister = String(command.args?.[1] ?? '8');

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const line = editor.selection.active.line;
  const start = editor.selection.active;
  const end = editor.document.lineAt(line).range.end;
  if (start.isEqual(end)) {
    return;
  }

  const range = new vscode.Range(start, end);
  const deletedText = editor.document.getText(range);
  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });
  editor.selection = new vscode.Selection(start, start);
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
}

async function executeDeleteLine(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const document = editor.document;
  const startLine = editor.selection.active.line;
  const endLine = Math.min(document.lineCount - 1, startLine + count - 1);
  const isDeletingToDocumentEnd = endLine === document.lineCount - 1;
  const rangeStart = isDeletingToDocumentEnd && startLine > 0
    ? document.lineAt(startLine - 1).range.end
    : document.lineAt(startLine).range.start;
  const rangeEnd = isDeletingToDocumentEnd
    ? document.lineAt(endLine).range.end
    : document.lineAt(endLine).rangeIncludingLineBreak.end;
  const range = new vscode.Range(
    rangeStart,
    rangeEnd
  );
  const deletedText = document.getText(range);
  if (deletedText.length === 0) {
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });
  const caretLine = Math.min(startLine, editor.document.lineCount - 1);
  const caret = new vscode.Position(Math.max(caretLine, 0), 0);
  editor.selection = new vscode.Selection(caret, caret);
  storeRegister(state, '8', deletedText, 'linewise');
  hooks?.onStatusMessage?.('stored delete in register 8');
}

async function executeReplaceChar(command: ParsedCommand): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const replacement = String(command.args?.[0] ?? '');
  if (replacement.length !== 1) {
    return;
  }

  const position = editor.selection.active;
  editor.selection = new vscode.Selection(position, position);
  const line = editor.document.lineAt(position.line);
  if (position.character >= line.text.length) {
    return;
  }

  const range = new vscode.Range(position, position.translate(0, 1));
  await editor.edit((editBuilder) => {
    editBuilder.replace(range, replacement);
  });

  editor.selection = new vscode.Selection(position, position);
}

async function executeReplaceWord(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const range = await getWordOperationRange(editor, count);
  if (!range) {
    return;
  }

  if (range.isEmpty) {
    editor.selection = new vscode.Selection(range.start, range.start);
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });

  editor.selection = new vscode.Selection(range.start, range.start);
  setInsertMode(state);
  hooks?.onStatusMessage?.(`changed ${count} word${count === 1 ? '' : 's'}`);
  await hooks?.onModeChanged?.(state.mode);
}

async function executeToggleCaseChar(command: ParsedCommand, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const position = editor.selection.active;
  const document = editor.document;
  const startOffset = document.offsetAt(position);
  const endOffset = Math.min(document.getText().length, startOffset + count);
  if (startOffset >= endOffset) {
    return;
  }

  const range = new vscode.Range(position, document.positionAt(endOffset));
  const original = document.getText(range);
  const toggled = [...original].map(toggleCharacterCase).join('');
  if (toggled === original) {
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.replace(range, toggled);
  });
  editor.selection = new vscode.Selection(position, position);
  hooks?.onStatusMessage?.(`toggled ${count} character${count === 1 ? '' : 's'}`);
}

async function executeToggleCaseWord(command: ParsedCommand, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const originalSelection = editor.selection;
  const range = await getWordOperationRange(editor, count);
  editor.selection = originalSelection;
  if (!range || range.isEmpty) {
    return;
  }

  const original = editor.document.getText(range);
  const toggled = [...original].map(toggleCharacterCase).join('');
  if (toggled === original) {
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.replace(range, toggled);
  });
  editor.selection = originalSelection;
  hooks?.onStatusMessage?.(`toggled ${count} word${count === 1 ? '' : 's'}`);
}

function toggleCharacterCase(char: string): string {
  const lower = char.toLowerCase();
  const upper = char.toUpperCase();
  if (lower === upper) {
    return char;
  }

  return char === lower ? upper : lower;
}

async function getWordOperationRange(editor: vscode.TextEditor, count: number): Promise<vscode.Range | undefined> {
  const document = editor.document;
  const originalSelection = editor.selection;
  const originalPosition = originalSelection.active;
  const currentWordRange = document.getWordRangeAtPosition(originalPosition);

  if (currentWordRange) {
    editor.selection = new vscode.Selection(currentWordRange.start, currentWordRange.start);
  } else {
    editor.selection = new vscode.Selection(originalPosition, originalPosition);
    await vscode.commands.executeCommand('cursorWordStartRight');
    if (editor.selection.active.isEqual(originalPosition)) {
      editor.selection = originalSelection;
      return undefined;
    }
  }

  const start = editor.selection.active;
  for (let i = 0; i < count; i += 1) {
    await vscode.commands.executeCommand('cursorWordEndRightSelect');
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    editor.selection = originalSelection;
    return undefined;
  }

  const range = new vscode.Range(selection.start, selection.end);
  editor.selection = originalSelection;
  return range;
}

async function executeChangeToLineEnd(state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  await vscode.commands.executeCommand('deleteAllRight');
  setInsertMode(state);
  hooks?.onStatusMessage?.('changed to line end');
  await hooks?.onModeChanged?.(state.mode);
}

async function executeChangeLine(state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  await vscode.commands.executeCommand('editor.action.deleteLines');
  await vscode.commands.executeCommand('editor.action.insertLineBefore');
  setInsertMode(state);
  hooks?.onStatusMessage?.('changed line');
  await hooks?.onModeChanged?.(state.mode);
}

interface DelimiterPair {
  open: string;
  close: string;
}

const TEXT_OBJECT_PAIRS: Record<string, DelimiterPair> = {
  '"': { open: '"', close: '"' },
  "'": { open: "'", close: "'" },
  '`': { open: '`', close: '`' },
  '´': { open: '´', close: '´' },
  '(': { open: '(', close: ')' },
  '[': { open: '[', close: ']' },
  '{': { open: '{', close: '}' },
  '<': { open: '<', close: '>' }
};

const TEXT_OBJECT_CLOSE_PAIRS: Record<string, DelimiterPair> = {
  ')': TEXT_OBJECT_PAIRS['('],
  ']': TEXT_OBJECT_PAIRS['['],
  '}': TEXT_OBJECT_PAIRS['{'],
  '>': TEXT_OBJECT_PAIRS['<']
};

export function getTextObjectRegisterMirrors(operationKey: string, registerKey: string): string[] {
  const mirrors = new Set<string>([registerKey]);

  if (operationKey === MIV_KEYS.operators.yank) {
    mirrors.add('0');
    mirrors.add('9');
  }

  if (operationKey === MIV_KEYS.operators.delete) {
    mirrors.add('8');
  }

  return [...mirrors];
}

async function executeTextObjectOperation(command: ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const objectKey = String(command.args?.[0] ?? '');
  const registerKey = String(command.args?.[1] ?? '');
  const operationKey = String(command.args?.[2] ?? '');
  if (objectKey !== MIV_KEYS.textObjects.auto && !TEXT_OBJECT_PAIRS[objectKey]) {
    return;
  }

  const range = findTextObjectRange(editor, objectKey);
  if (!range) {
    return;
  }

  const selectedText = editor.document.getText(range);

  if (operationKey === MIV_KEYS.operators.yank) {
    await vscode.env.clipboard.writeText(selectedText);
    for (const key of getTextObjectRegisterMirrors(operationKey, registerKey)) {
      storeRegister(state, key, selectedText, 'charwise');
    }
    hooks?.onYank?.(editor, range);
    hooks?.onStatusMessage?.(`stored yank in register ${registerKey}`);
    return;
  }

  if (operationKey === MIV_KEYS.operators.delete) {
    await editor.edit((editBuilder) => {
      editBuilder.delete(range);
    });
    for (const key of getTextObjectRegisterMirrors(operationKey, registerKey)) {
      storeRegister(state, key, selectedText, 'charwise');
    }
    hooks?.onStatusMessage?.(`stored delete in register ${registerKey}`);
    return;
  }

  if (operationKey === MIV_KEYS.operators.paste) {
    const value = getRegister(state, registerKey);
    await editor.edit((editBuilder) => {
      editBuilder.replace(range, value.text);
    });
    hooks?.onStatusMessage?.(`pasted register ${registerKey}`);
  }
}

function findTextObjectRange(editor: vscode.TextEditor, objectKey: string): vscode.Range | undefined {
  const document = editor.document;
  const text = document.getText();
  const cursorOffset = document.offsetAt(editor.selection.active);
  const match = findTextObjectBounds(text, cursorOffset, objectKey);
  if (!match) {
    return undefined;
  }

  const start = document.positionAt(match.openOffset + 1);
  const end = document.positionAt(match.closeOffset);
  return new vscode.Range(start, end);
}

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let current = index - 1; current >= 0 && text[current] === '\\'; current -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

export function findTextObjectBounds(
  text: string,
  cursorOffset: number,
  objectKey: string
): { openOffset: number; closeOffset: number } | undefined {
  if (objectKey === MIV_KEYS.textObjects.auto) {
    const directMatch = findAutoTextObjectBoundsAtCursor(text, cursorOffset);
    if (directMatch) {
      return directMatch;
    }
  }

  for (let openOffset = cursorOffset - 1; openOffset >= 0; openOffset -= 1) {
    const pair = getTextObjectPairAtOffset(text, openOffset, objectKey);
    if (!pair) {
      continue;
    }

    const closeOffset = findFirstCloseOffset(text, cursorOffset, pair);
    if (closeOffset === undefined) {
      continue;
    }

    return { openOffset, closeOffset };
  }

  return undefined;
}

function findAutoTextObjectBoundsAtCursor(
  text: string,
  cursorOffset: number
): { openOffset: number; closeOffset: number } | undefined {
  if (cursorOffset < 0 || cursorOffset >= text.length) {
    return undefined;
  }

  const char = text[cursorOffset];
  const pair = TEXT_OBJECT_PAIRS[char] ?? TEXT_OBJECT_CLOSE_PAIRS[char];
  if (!pair) {
    return undefined;
  }

  if (pair.open === pair.close) {
    if (isEscaped(text, cursorOffset)) {
      return undefined;
    }

    const rightClose = findFirstCloseOffset(text, cursorOffset + 1, pair);
    if (rightClose !== undefined) {
      return { openOffset: cursorOffset, closeOffset: rightClose };
    }

    const leftOpen = findLastOpenOffset(text, cursorOffset - 1, pair);
    if (leftOpen !== undefined) {
      return { openOffset: leftOpen, closeOffset: cursorOffset };
    }

    return undefined;
  }

  if (char === pair.open) {
    const closeOffset = findFirstCloseOffset(text, cursorOffset + 1, pair);
    if (closeOffset !== undefined) {
      return { openOffset: cursorOffset, closeOffset };
    }
  }

  if (char === pair.close) {
    const openOffset = findLastOpenOffset(text, cursorOffset - 1, pair);
    if (openOffset !== undefined) {
      return { openOffset, closeOffset: cursorOffset };
    }
  }

  return undefined;
}

function getTextObjectPairAtOffset(text: string, offset: number, objectKey: string): DelimiterPair | undefined {
  if (objectKey === MIV_KEYS.textObjects.auto) {
    const pair = TEXT_OBJECT_PAIRS[text[offset]];
    if (!pair) {
      return undefined;
    }
    if (pair.open === pair.close && isEscaped(text, offset)) {
      return undefined;
    }
    return pair;
  }

  const pair = TEXT_OBJECT_PAIRS[objectKey];
  if (!pair || text[offset] !== pair.open) {
    return undefined;
  }

  if (pair.open === pair.close && isEscaped(text, offset)) {
    return undefined;
  }

  return pair;
}

function findFirstCloseOffset(text: string, startOffset: number, pair: DelimiterPair): number | undefined {
  for (let index = startOffset; index < text.length; index += 1) {
    if (text[index] !== pair.close) {
      continue;
    }

    if (pair.open === pair.close && isEscaped(text, index)) {
      continue;
    }

    return index;
  }

  return undefined;
}

function findLastOpenOffset(text: string, startOffset: number, pair: DelimiterPair): number | undefined {
  for (let index = startOffset; index >= 0; index -= 1) {
    if (text[index] !== pair.open) {
      continue;
    }

    if (pair.open === pair.close && isEscaped(text, index)) {
      continue;
    }

    return index;
  }

  return undefined;
}
