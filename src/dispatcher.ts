/**
 * Command dispatcher for parsed MIV actions.
 *
 * This module translates ParsedCommand objects into VS Code command calls and
 * state/register side effects. It is intentionally data-driven via action maps.
 */
import * as vscode from 'vscode';
import type { ParsedAction, ParsedCommand } from './parser';
import { getMotionVscodeCommand } from './parser';
import { MIV_KEYS } from './config';
import { getRegister, setInsertMode, setLastCommand, storeRegister, type RegisterValue, type MivMode, type MivState } from './state';

const commandUsageCounts: Record<string, number> = Object.create(null) as Record<string, number>;
const sequenceUsageCounts: Record<string, number> = Object.create(null) as Record<string, number>;

// Commands that should become the repeat target for `c` / `.`.
const REPEATABLE_EDIT_ACTIONS = new Set<ParsedAction>([
  'deleteCharRight',
  'deleteWordRight',
  'deleteToLineEnd',
  'operatorMotion',
  'deleteLine',
  'yankWord',
  'replaceWord',
  'toggleCaseChar',
  'toggleCaseWord',
  'replaceChar',
  'openLineBelow',
  'openLineAbove',
  'paste',
  'pasteAfter',
  'pasteBefore',
  'pasteRegister',
  'yankLines',
  'changeToLineEnd',
  'changeLine',
  'joinLineWithNext',
  'builtinEdit',
  'textObjectOperation'
]);

interface DispatchContext {
  command: ParsedCommand;
  state: MivState;
  hooks?: DispatchHooks;
}

type ActionHandler = (context: DispatchContext) => Promise<void>;
type ActionHandlerMap = Partial<Record<ParsedAction, ActionHandler>>;

const INSERT_ACTION_HANDLERS: ActionHandlerMap = {
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

const EDIT_ACTION_HANDLERS: ActionHandlerMap = {
  deleteLine: async ({ command }) => {
    const count = normalizePositiveInt(command.args?.[0], 1);
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('editor.action.deleteLines');
    }
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
  replaceWord: async ({ state, hooks }) => {
    await executeReplaceWord(state, hooks);
  },
  toggleCaseChar: async () => {
    await executeToggleCaseChar();
  },
  toggleCaseWord: async () => {
    await executeToggleCaseWord();
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

const REGISTER_ACTION_HANDLERS: ActionHandlerMap = {
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

    await pasteRegisterValue(value, 'after');
    hooks?.onStatusMessage?.(`pasted register ${registerKey}`);
  },
  paste: async ({ command, state, hooks }) => {
    const count = normalizePositiveInt(command.args?.[0], 1);
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    }
    const clipboardValue = await vscode.env.clipboard.readText();
    if (clipboardValue.length === 0) {
      hooks?.onStatusMessage?.('clipboard empty');
      return;
    }

    storeRegister(state, '9', clipboardValue, getRegisterTypeFromText(clipboardValue));
    hooks?.onStatusMessage?.('stored paste in register 9');
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
  }
};

const ACTION_HANDLERS: ActionHandlerMap = {
  ...INSERT_ACTION_HANDLERS,
  ...EDIT_ACTION_HANDLERS,
  ...REGISTER_ACTION_HANDLERS,
  ...NAVIGATION_ACTION_HANDLERS,
  ...MOTION_ACTION_HANDLERS
};

export interface DispatchHooks {
  onModeChanged?: (mode: MivMode) => Promise<void> | void;
  onStatusMessage?: (message: string) => void;
  onYank?: (editor: vscode.TextEditor, range: vscode.Range) => void;
}

export interface CommandUsageStatsSnapshot {
  actions: Record<string, number>;
  sequences: Record<string, number>;
}

/**
 * Execute one parsed command and update repeat state when applicable.
 *
 * Parameters:
 *   parsed - Command produced by parser.ts.
 *   state - Mutable runtime state.
 *   hooks - Optional UI hooks for mode/status/yank feedback.
 */
export async function dispatchCommand(parsed: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  incrementCounter(commandUsageCounts, parsed.action);
  incrementCounter(sequenceUsageCounts, parsed.sequence);

  if (parsed.action === 'repeatLastCommand') {
    if (!state.lastCommand) {
      return;
    }

    await runVscodeCommand(state.lastCommand, state, hooks);
    return;
  }

  await runVscodeCommand(parsed, state, hooks);

  if (REPEATABLE_EDIT_ACTIONS.has(parsed.action)) {
    setLastCommand(state, parsed);
  }
}

export function getCommandUsageStatsSnapshot(): CommandUsageStatsSnapshot {
  return {
    actions: { ...commandUsageCounts },
    sequences: { ...sequenceUsageCounts }
  };
}

/**
 * Route a ParsedCommand to a dedicated action handler.
 *
 * Side effects:
 *   Executes VS Code commands and may mutate runtime state via handlers.
 */
async function runVscodeCommand(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  const actionHandler = ACTION_HANDLERS[command.action];
  if (actionHandler) {
    await actionHandler({ command, state, hooks });
    return;
  }

  if (!command.vscodeCommand) {
    return;
  }

  await vscode.commands.executeCommand(command.vscodeCommand, ...(command.args ?? []));
}

/**
 * Execute operator+motion behavior by deriving a text range from cursor motion.
 *
 * Side effects:
 *   Moves cursor, edits/yanks selected range, mutates registers, and updates
 *   status/yank UI hooks.
 */
async function executeOperatorMotion(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
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
  }
}

/**
 * Convert a potentially invalid numeric argument into a safe positive integer.
 *
 * Parameters:
 *   value - Candidate numeric value from ParsedCommand args.
 *   fallback - Value used when conversion fails.
 *
 * Returns:
 *   A positive integer suitable for motion/repetition loops.
 */
function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function commandHasExplicitCount(command: ParsedCommand): boolean {
  return /^[0-9]/.test(command.sequence);
}

type PasteDirection = 'after' | 'before';

function getRegisterTypeFromText(value: string): 'charwise' | 'linewise' {
  return value.endsWith('\n') ? 'linewise' : 'charwise';
}

async function pasteRegisterValue(value: RegisterValue, direction: PasteDirection): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || value.text.length === 0) {
    return;
  }

  if (value.type === 'linewise') {
    await pasteLinewise(editor, value.text, direction);
    return;
  }

  if (direction === 'after') {
    await vscode.commands.executeCommand('cursorRight');
  }

  const insertAt = editor.selection.active;
  await editor.edit((editBuilder) => {
    editBuilder.insert(insertAt, value.text);
  });
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

interface DelimiterPair {
  open: string;
  close: string;
}

const BRACKET_OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>'
};

const BRACKET_CLOSE_TO_OPEN: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<'
};

const TEXT_OBJECT_PAIRS: Record<string, DelimiterPair> = {
  '"': { open: '"', close: '"' },
  "'": { open: "'", close: "'" },
  '(': { open: '(', close: ')' },
  '[': { open: '[', close: ']' },
  '{': { open: '{', close: '}' },
  '<': { open: '<', close: '>' }
};

async function executeDeleteCharRight(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const count = normalizePositiveInt(command.args?.[0], 1);
  const targetRegister = command.args?.[1] !== undefined ? String(command.args?.[1]) : undefined;
  if (!commandHasExplicitCount(command) && !editor.selection.isEmpty) {
    const range = new vscode.Range(editor.selection.start, editor.selection.end);
    const deletedText = editor.document.getText(range);
    await editor.edit((editBuilder) => {
      editBuilder.delete(range);
    });
    const caret = range.start;
    editor.selection = new vscode.Selection(caret, caret);
    if (targetRegister) {
      storeRegister(state, targetRegister, deletedText, 'charwise');
      hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
    }
    return;
  }

  if (!targetRegister) {
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('deleteRight');
    }
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
  editor.selection = new vscode.Selection(start, end);
  await vscode.commands.executeCommand('editor.action.clipboardCutAction');
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
}

async function executeDeleteWordRight(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  const count = normalizePositiveInt(command.args?.[0], 1);
  const targetRegister = command.args?.[1] !== undefined ? String(command.args?.[1]) : undefined;
  if (!targetRegister) {
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('deleteWordRight');
    }
    return;
  }

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
  await vscode.commands.executeCommand('editor.action.clipboardCutAction');
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
}

async function executeDeleteToLineEnd(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  const count = normalizePositiveInt(command.args?.[0], 1);
  const targetRegister = command.args?.[1] !== undefined ? String(command.args?.[1]) : undefined;
  if (!targetRegister) {
    for (let i = 0; i < count; i += 1) {
      await vscode.commands.executeCommand('deleteAllRight');
    }
    return;
  }

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
  storeRegister(state, targetRegister, deletedText, 'charwise');
  hooks?.onStatusMessage?.(`stored delete in register ${targetRegister}`);
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

async function executeReplaceWord(state: MivState, hooks?: DispatchHooks): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const position = editor.selection.active;
  const { start, end } = findWordBounds(editor.document.lineAt(position.line).text, position.character);

  const startPosition = new vscode.Position(position.line, start);
  if (start === end) {
    editor.selection = new vscode.Selection(startPosition, startPosition);
    setInsertMode(state);
    await hooks?.onModeChanged?.(state.mode);
    return;
  }

  const endPosition = new vscode.Position(position.line, end);
  const range = new vscode.Range(startPosition, endPosition);
  await editor.edit((editBuilder) => {
    editBuilder.delete(range);
  });

  editor.selection = new vscode.Selection(startPosition, startPosition);
  setInsertMode(state);
  await hooks?.onModeChanged?.(state.mode);
}

async function executeToggleCaseChar(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;
  if (position.character >= line.length) {
    return;
  }

  const original = line[position.character];
  const toggled = toggleCharacterCase(original);
  if (toggled === original) {
    return;
  }

  const range = new vscode.Range(position, position.translate(0, 1));
  await editor.edit((editBuilder) => {
    editBuilder.replace(range, toggled);
  });
  editor.selection = new vscode.Selection(position, position);
}

async function executeToggleCaseWord(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line).text;
  const { start, end } = findWordBounds(line, position.character);
  if (start === end) {
    return;
  }

  const startPosition = new vscode.Position(position.line, start);
  const endPosition = new vscode.Position(position.line, end);
  const range = new vscode.Range(startPosition, endPosition);
  const original = editor.document.getText(range);
  const toggled = [...original].map(toggleCharacterCase).join('');
  if (toggled === original) {
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.replace(range, toggled);
  });
  editor.selection = new vscode.Selection(position, position);
}

function findWordBounds(line: string, character: number): { start: number; end: number } {
  let start = character;
  let end = character;

  while (start < line.length && isReplaceWordDelimiter(line[start])) {
    start += 1;
  }
  end = start;

  while (start > 0 && !isReplaceWordDelimiter(line[start - 1])) {
    start -= 1;
  }

  while (end < line.length && !isReplaceWordDelimiter(line[end])) {
    end += 1;
  }

  return { start, end };
}

function toggleCharacterCase(char: string): string {
  const lower = char.toLowerCase();
  const upper = char.toUpperCase();
  if (lower === upper) {
    return char;
  }

  return char === lower ? upper : lower;
}

function isReplaceWordDelimiter(char: string): boolean {
  return /[\s,.;:()[\]{}]/.test(char);
}

async function executeChangeToLineEnd(state: MivState, hooks?: DispatchHooks): Promise<void> {
  await vscode.commands.executeCommand('deleteAllRight');
  setInsertMode(state);
  hooks?.onStatusMessage?.('changed to line end');
  await hooks?.onModeChanged?.(state.mode);
}

async function executeChangeLine(state: MivState, hooks?: DispatchHooks): Promise<void> {
  await vscode.commands.executeCommand('editor.action.deleteLines');
  await vscode.commands.executeCommand('editor.action.insertLineBefore');
  setInsertMode(state);
  hooks?.onStatusMessage?.('changed line');
  await hooks?.onModeChanged?.(state.mode);
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

async function executeTextObjectOperation(command: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
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
    storeRegister(state, registerKey, selectedText, 'charwise');
    hooks?.onYank?.(editor, range);
    hooks?.onStatusMessage?.(`stored yank in register ${registerKey}`);
    return;
  }

  if (operationKey === MIV_KEYS.operators.delete) {
    await editor.edit((editBuilder) => {
      editBuilder.delete(range);
    });
    storeRegister(state, registerKey, selectedText, 'charwise');
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

function findTextObjectBounds(
  text: string,
  cursorOffset: number,
  objectKey: string
): { openOffset: number; closeOffset: number } | undefined {
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

function findMatchingBracketOffset(text: string, cursorOffset: number): number | undefined {
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
    return scanForwardForMatch(text, offset, char, forwardClose);
  }

  const backwardOpen = BRACKET_CLOSE_TO_OPEN[char];
  if (backwardOpen) {
    return scanBackwardForMatch(text, offset, backwardOpen, char);
  }

  return undefined;
}

function scanForwardForMatch(text: string, startOffset: number, open: string, close: string): number | undefined {
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
