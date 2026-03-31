import * as vscode from 'vscode';
import { MIV_KEYS } from '../config';
import { getMotionVscodeCommand } from '../parser';
import { getRegister, storeRegister } from '../state';
import type { ActionHandler, ActionHandlerMap, DispatchHooks } from './shared';
import { normalizePositiveInt } from './shared';

const handleCountableMotion: ActionHandler = async ({ command }) => {
  if (!command.vscodeCommand) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  for (let i = 0; i < count; i += 1) {
    await vscode.commands.executeCommand(command.vscodeCommand);
  }
};

const MOTION_ACTION_HANDLERS: ActionHandlerMap = {
  cursorLeft: handleCountableMotion,
  cursorRight: handleCountableMotion,
  cursorUp: handleCountableMotion,
  cursorDown: handleCountableMotion,
  cursorPageUp: handleCountableMotion,
  cursorPageDown: handleCountableMotion,
  cursorWordLeft: handleCountableMotion,
  cursorWordRight: handleCountableMotion,
  cursorWordEndLeft: handleCountableMotion,
  cursorWordEndRight: handleCountableMotion,
  cursorLineStart: handleCountableMotion,
  cursorLineEnd: handleCountableMotion
};

const NAVIGATION_ACTION_HANDLERS: ActionHandlerMap = {
  jumpBracketMatch: async () => {
    await executeJumpBracketMatch();
  },
  gotoLine: async ({ command }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const targetLine = normalizePositiveInt(command.args?.[0], 1);
    const line = Math.min(Math.max(targetLine - 1, 0), editor.document.lineCount - 1);
    const character = Math.min(editor.selection.active.character, editor.document.lineAt(line).text.length);
    const position = new vscode.Position(line, character);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(selection);
  },
  gotoDocumentPercent: async ({ command }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const percent = Math.min(Math.max(normalizePositiveInt(command.args?.[0], 50), 0), 100);
    const lastLineIndex = Math.max(editor.document.lineCount - 1, 0);
    const line = Math.round((lastLineIndex * percent) / 100);
    const position = new vscode.Position(line, 0);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(selection);
  },
  gotoLineFromBottom: async ({ command }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const countFromBottom = normalizePositiveInt(command.args?.[0], 1);
    const line = Math.max(editor.document.lineCount - countFromBottom, 0);
    const character = Math.min(editor.selection.active.character, editor.document.lineAt(line).text.length);
    const position = new vscode.Position(line, character);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(selection);
  }
};

export const MOTION_AND_NAVIGATION_ACTION_HANDLERS: ActionHandlerMap = {
  ...NAVIGATION_ACTION_HANDLERS,
  ...MOTION_ACTION_HANDLERS
};

export async function executeOperatorMotion(command: import('../parser').ParsedCommand, state: import('../state').MivState, hooks?: DispatchHooks): Promise<void> {
  const operator = String(command.args?.[0] ?? '');
  const motionKey = String(command.args?.[1] ?? '');
  const targetRegister = String(command.args?.[2] ?? '0');
  const moveCommand = getMotionVscodeCommand(motionKey);
  const editor = vscode.window.activeTextEditor;
  if (!editor || !moveCommand) {
    return;
  }

  const start = editor.selection.active;
  await vscode.commands.executeCommand(moveCommand);
  const end = editor.selection.active;
  if (start.isEqual(end)) {
    return;
  }

  const range = new vscode.Range(start, end);
  const selectedText = editor.document.getText(range);

  if (operator === MIV_KEYS.operators.yank) {
    await vscode.env.clipboard.writeText(selectedText);
    storeRegister(state, targetRegister, selectedText, 'charwise');
    hooks?.onYank?.(editor, range);
    hooks?.onStatusMessage?.(`stored yank in register ${targetRegister}`);
    editor.selection = new vscode.Selection(start, start);
    return;
  }

  if (operator === MIV_KEYS.operators.paste) {
    const value = getRegister(state, targetRegister);
    await editor.edit((editBuilder) => {
      editBuilder.replace(range, value.text);
    });
    hooks?.onStatusMessage?.(`pasted register ${targetRegister}`);
  }
}

interface DelimiterPair {
  open: string;
  close: string;
}

const BRACKET_OPEN_TO_CLOSE: Record<string, string> = {
  '"': '"',
  '\'': '\'',
  '`': '`',
  '´': '´',
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>'
};

const BRACKET_CLOSE_TO_OPEN: Record<string, string> = {
  '"': '"',
  '\'': '\'',
  '`': '`',
  '´': '´',
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<'
};

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let current = index - 1; current >= 0 && text[current] === '\\'; current -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

async function executeJumpBracketMatch(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const cursorOffset = document.offsetAt(editor.selection.active);
  const targetOffset = findMatchingBracketOffset(text, cursorOffset);
  if (targetOffset === undefined) {
    return;
  }

  const target = document.positionAt(targetOffset);
  const selection = new vscode.Selection(target, target);
  editor.selection = selection;
  editor.revealRange(selection);
}

export function findMatchingBracketOffset(text: string, cursorOffset: number): number | undefined {
  if (cursorOffset < text.length) {
    const current = text[cursorOffset];
    const currentMatch = findMatchWhenOnBracket(text, cursorOffset, current);
    if (currentMatch !== undefined) {
      return currentMatch;
    }
  }

  if (cursorOffset > 0) {
    const left = text[cursorOffset - 1];
    const leftMatch = findMatchWhenOnBracket(text, cursorOffset - 1, left);
    if (leftMatch !== undefined) {
      return leftMatch;
    }
  }

  return findEnclosingBracketClose(text, cursorOffset);
}

function findMatchWhenOnBracket(text: string, offset: number, char: string): number | undefined {
  const forwardClose = BRACKET_OPEN_TO_CLOSE[char];
  if (forwardClose) {
    if (forwardClose === char) {
      return findSymmetricDelimiterPairOffset(text, offset, char);
    }

    return scanForwardForMatch(text, offset, char, forwardClose);
  }

  const backwardOpen = BRACKET_CLOSE_TO_OPEN[char];
  if (backwardOpen) {
    return scanBackwardForMatch(text, offset, backwardOpen, char);
  }

  return undefined;
}

function findSymmetricDelimiterPairOffset(text: string, offset: number, char: string): number | undefined {
  const delimiterOffsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== char || isEscaped(text, index)) {
      continue;
    }

    delimiterOffsets.push(index);
  }

  const pairIndex = delimiterOffsets.indexOf(offset);
  if (pairIndex < 0) {
    return undefined;
  }

  if (pairIndex % 2 === 0) {
    return delimiterOffsets[pairIndex + 1];
  }

  return delimiterOffsets[pairIndex - 1];
}

function scanForwardForMatch(text: string, startOffset: number, open: string, close: string): number | undefined {
  if (open === close) {
    for (let index = startOffset + 1; index < text.length; index += 1) {
      if (text[index] !== close || isEscaped(text, index)) {
        continue;
      }
      return index;
    }
    return undefined;
  }

  let depth = 0;
  for (let index = startOffset; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) {
      depth += 1;
      continue;
    }
    if (char !== close) {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }
  return undefined;
}

function scanBackwardForMatch(text: string, startOffset: number, open: string, close: string): number | undefined {
  if (open === close) {
    for (let index = startOffset - 1; index >= 0; index -= 1) {
      if (text[index] !== open || isEscaped(text, index)) {
        continue;
      }
      return index;
    }
    return undefined;
  }

  let depth = 0;
  for (let index = startOffset; index >= 0; index -= 1) {
    const char = text[index];
    if (char === close) {
      depth += 1;
      continue;
    }
    if (char !== open) {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }
  return undefined;
}

function findEnclosingBracketClose(text: string, cursorOffset: number): number | undefined {
  let bestOpen = -1;
  let bestClose = -1;

  for (const [open, close] of Object.entries(BRACKET_OPEN_TO_CLOSE)) {
    for (let openOffset = cursorOffset - 1; openOffset >= 0; openOffset -= 1) {
      if (text[openOffset] !== open) {
        continue;
      }

      if (open === close && isEscaped(text, openOffset)) {
        continue;
      }

      const closeOffset = scanForwardForMatch(text, openOffset, open, close);
      if (closeOffset === undefined) {
        continue;
      }

      if (!(openOffset < cursorOffset && cursorOffset < closeOffset)) {
        continue;
      }

      if (openOffset > bestOpen) {
        bestOpen = openOffset;
        bestClose = closeOffset;
      }
      break;
    }
  }

  return bestClose >= 0 ? bestClose : undefined;
}
