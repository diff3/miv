/**
 * Sequence parser for NAV-mode input.
 *
 * This module converts buffered key sequences into structured commands used by
 * the dispatcher. It also identifies partial sequences that require time-based
 * fallback behavior.
 */
import { MIV_KEYS, getSequenceValueForToken, isDigitKey, isToken } from '../config';
import {
  MOTION_TABLE,
  SINGLE_KEY_COMMANDS,
  TEXT_OBJECT_COMMAND_KEYS,
  TEXT_OBJECT_KEYS
} from './definitions';

export type ParsedAction =
  | 'cursorLeft'
  | 'cursorRight'
  | 'cursorUp'
  | 'cursorDown'
  | 'cursorPageUp'
  | 'cursorPageDown'
  | 'cursorWordLeft'
  | 'cursorWordRight'
  | 'cursorWordEndLeft'
  | 'cursorWordEndRight'
  | 'cursorLineStart'
  | 'cursorLineEnd'
  | 'deleteCharRight'
  | 'deleteWordRight'
  | 'deleteToLineEnd'
  | 'operatorMotion'
  | 'deleteLine'
  | 'pasteBefore'
  | 'changeToLineEnd'
  | 'changeLine'
  | 'jumpBracketMatch'
  | 'joinLineWithNext'
  | 'setReplaceRule'
  | 'applyReplaceRule'
  | 'replaceWord'
  | 'toggleCaseChar'
  | 'toggleCaseWord'
  | 'replaceChar'
  | 'enterInsert'
  | 'insertAtLineStart'
  | 'insertAtLineEnd'
  | 'openLineBelow'
  | 'openLineAbove'
  | 'undo'
  | 'paste'
  | 'pasteAfter'
  | 'pasteRegister'
  | 'yankWord'
  | 'storeRegister'
  | 'showRegisters'
  | 'yankLines'
  | 'repeatLastCommand'
  | 'forwardSearch'
  | 'backwardSearch'
  | 'regexSearch'
  | 'searchNext'
  | 'searchPrevious'
  | 'gotoLine'
  | 'builtinEdit'
  | 'textObjectOperation';

export interface ParsedCommand {
  sequence: string;
  action: ParsedAction;
  vscodeCommand?: string;
  args?: unknown[];
}

export type ParseStatus = 'complete' | 'partial' | 'invalid';

export interface ParseResult {
  status: ParseStatus;
  command?: ParsedCommand;
  fallbackCommand?: ParsedCommand;
  fallbackDelayMs?: number;
}

const PARTIAL_SEQUENCE_RESULTS: Record<string, ParseResult> = {};

const COMPLETE_EXACT_COMMANDS: Record<string, ParsedCommand> = {};

const INVALID_RESULT: ParseResult = { status: 'invalid' };

type SequenceHandler = (buffer: string) => ParseResult;

const PREFIX_SEQUENCE_HANDLERS: Record<string, SequenceHandler> = {
  [MIV_KEYS.operators.replace]: parseReplaceCharSequence,
  [MIV_KEYS.operators.yank]: parseOperatorMotionSequence
};

/**
 * Parse a key sequence produced by the NAV input buffer.
 *
 * Parameters:
 *   buffer - Current accumulated key sequence.
 *
 * Returns:
 *   ParseResult describing whether the sequence is complete, partial, or invalid.
 */
export function parseInput(input: string | readonly string[]): ParseResult {
  const buffer = normalizeInputBuffer(input);
  if (buffer.length === 0) {
    return INVALID_RESULT;
  }

  const replaceRuleResult = parseReplaceRuleSequence(buffer);
  if (replaceRuleResult) {
    return replaceRuleResult;
  }

  const textObjectResult = parseTextObjectCommand(buffer);
  if (textObjectResult) {
    return textObjectResult;
  }

  const registerTargetedPartial = parseSpaceRegisterTargetedPartial(buffer);
  if (registerTargetedPartial) {
    return registerTargetedPartial;
  }

  const registerTargeted = parseSpaceRegisterTargetedCommand(buffer);
  if (registerTargeted) {
    return registerTargeted;
  }

  const registerStoreResult = parseRegisterStoreSequence(buffer);
  if (registerStoreResult) {
    return registerStoreResult;
  }

  const registerPasteResult = parseRegisterPrefixedPaste(buffer);
  if (registerPasteResult) {
    return registerPasteResult;
  }

  const yankCountResult = parseYankCount(buffer);
  if (yankCountResult) {
    return yankCountResult;
  }

  const motionCountResult = parseMotionCount(buffer);
  if (motionCountResult) {
    return motionCountResult;
  }

  return parseCommandSequence(buffer);
}

function normalizeInputBuffer(input: string | readonly string[]): string {
  if (typeof input !== 'string') {
    return input.map((value) => getSequenceValueForToken(value)).join('');
  }

  if (isToken(input)) {
    return getSequenceValueForToken(input);
  }

  return input;
}

function parseReplaceRuleSequence(buffer: string): ParseResult | undefined {
  if (!buffer.startsWith(MIV_KEYS.commands.replaceMatches)) {
    return undefined;
  }

  if (buffer === MIV_KEYS.commands.replaceMatches) {
    return {
      status: 'partial',
      fallbackCommand: {
        sequence: buffer,
        action: 'applyReplaceRule'
      }
    };
  }

  const parts = parseReplaceRuleParts(buffer.slice(1).trim());
  if (!parts) {
    return { status: 'partial' };
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'setReplaceRule',
      args: parts
    }
  };
}

function parseReplaceRuleParts(input: string): [string] | [string, string] | undefined {
  const parts: string[] = [];
  let index = 0;

  while (index < input.length && parts.length < 2) {
    while (index < input.length && /\s/.test(input[index])) {
      index += 1;
    }

    if (index >= input.length) {
      break;
    }

    if (input[index] === '\'') {
      const closingQuote = input.indexOf('\'', index + 1);
      if (closingQuote === -1) {
        return undefined;
      }

      parts.push(input.slice(index + 1, closingQuote));
      index = closingQuote + 1;
      continue;
    }

    const nextWhitespace = input.slice(index).search(/\s/);
    if (nextWhitespace === -1) {
      parts.push(input.slice(index));
      index = input.length;
      continue;
    }

    parts.push(input.slice(index, index + nextWhitespace));
    index += nextWhitespace;
  }

  while (index < input.length && /\s/.test(input[index])) {
    index += 1;
  }

  if ((parts.length !== 1 && parts.length !== 2) || index !== input.length) {
    return undefined;
  }

  return parts.length === 1 ? [parts[0]] : [parts[0], parts[1]];
}

function parseTextObjectCommand(buffer: string): ParseResult | undefined {
  if (!TEXT_OBJECT_KEYS.has(buffer[0])) {
    return undefined;
  }

  if (buffer[0] === MIV_KEYS.textObjects.auto) {
    return parseAutoTextObjectCommand(buffer);
  }

  if (buffer.length === 1) {
    return { status: 'partial' };
  }

  if (buffer[1] !== ' ') {
    return INVALID_RESULT;
  }

  if (buffer.length === 2) {
    return { status: 'partial' };
  }

  const registerKey = buffer[2];
  if (!isDigitKey(registerKey)) {
    return INVALID_RESULT;
  }

  if (buffer.length === 3) {
    return { status: 'partial' };
  }

  if (buffer.length !== 4) {
    return INVALID_RESULT;
  }

  const commandKey = buffer[3];
  if (!TEXT_OBJECT_COMMAND_KEYS.has(commandKey)) {
    return INVALID_RESULT;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'textObjectOperation',
      args: [buffer[0], registerKey, commandKey]
    }
  };
}

function parseAutoTextObjectCommand(buffer: string): ParseResult {
  if (buffer.length === 1) {
    return { status: 'partial' };
  }

  if (buffer.length !== 2) {
    return INVALID_RESULT;
  }

  const commandKey = buffer[1];
  if (!TEXT_OBJECT_COMMAND_KEYS.has(commandKey)) {
    return INVALID_RESULT;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'textObjectOperation',
      args: [MIV_KEYS.textObjects.auto, getDefaultTextObjectRegister(commandKey), commandKey]
    }
  };
}

function getDefaultTextObjectRegister(commandKey: string): string {
  if (commandKey === MIV_KEYS.operators.yank) {
    return '0';
  }

  if (commandKey === MIV_KEYS.operators.paste) {
    return '9';
  }

  return '8';
}

/**
 * Resolve a motion key to the VS Code cursor command used by operator motions.
 *
 * Parameters:
 *   motionKey - Normalized motion token (for example `a`, `D`, `e`).
 *
 * Returns:
 *   VS Code command id, or undefined for unknown motions.
 */
export function getMotionVscodeCommand(motionKey: string): string | undefined {
  return MOTION_TABLE[motionKey]?.vscodeCommand;
}

/**
 * Parse yank-line count forms.
 *
 * Examples:
 *   `10y`.
 */
function parseYankCount(buffer: string): ParseResult | undefined {
  const match = buffer.match(/^([0-9]+)y$/);
  if (!match) {
    return undefined;
  }

  const count = Number.parseInt(match[1], 10);
  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'yankLines',
      args: [count]
    }
  };
}

/**
 * Parse count-prefixed motion forms.
 *
 * This handles sequences like `10w`. Counts apply only when the rest of the
 * sequence is a motion token.
 */
function parseMotionCount(buffer: string): ParseResult | undefined {
  const countPrefixMatch = buffer.match(/^([0-9]+)(.+)?$/);
  if (!countPrefixMatch) {
    return undefined;
  }

  const [, countString, rest] = countPrefixMatch;
  if (!rest) {
    return { status: 'partial' };
  }

  // Reject malformed count chains such as "10 2w" / "102w" style inputs.
  if (isDigitKey(rest[0])) {
    return INVALID_RESULT;
  }

  const motion = MOTION_TABLE[rest];
  if (motion) {
    return {
      status: 'complete',
      command: {
        sequence: buffer,
        action: motion.action,
        vscodeCommand: motion.vscodeCommand,
        args: [Number.parseInt(countString, 10)]
      }
    };
  }

  const count = Number.parseInt(countString, 10);
  const immediateCountCommand = parseImmediateCountCommand(rest, count, buffer);
  if (immediateCountCommand) {
    return immediateCountCommand;
  }

  return parseCommandSequence(rest);
}

/**
 * Parse non-counted command sequences.
 *
 * Resolution order:
 *   1) exact partial/fallback forms
 *   2) exact complete forms
 *   3) single-key motions
 *   4) single-key commands
 *   5) prefix handlers (`x*`, `y*`, `p*`)
 */
function parseCommandSequence(buffer: string): ParseResult {
  const gotoLineResult = parseGotoLine(buffer);
  if (gotoLineResult) {
    return gotoLineResult;
  }

  const partial = PARTIAL_SEQUENCE_RESULTS[buffer];
  if (partial) {
    return partial;
  }

  const exactCommand = COMPLETE_EXACT_COMMANDS[buffer];
  if (exactCommand) {
    return { status: 'complete', command: exactCommand };
  }

  const motion = MOTION_TABLE[buffer];
  if (motion) {
    return { status: 'complete', command: motion };
  }

  const singleCommand = SINGLE_KEY_COMMANDS[buffer];
  if (singleCommand) {
    return { status: 'complete', command: singleCommand };
  }

  const prefixHandler = PREFIX_SEQUENCE_HANDLERS[buffer[0]];
  if (prefixHandler) {
    return prefixHandler(buffer);
  }

  return INVALID_RESULT;
}

function parseGotoLine(buffer: string): ParseResult | undefined {
  if (buffer === MIV_KEYS.commands.gotoLine) {
    return {
      status: 'complete',
      command: {
        sequence: buffer,
        action: 'gotoLine',
        args: [1]
      }
    };
  }

  return undefined;
}

function parseRegisterPrefixedPaste(buffer: string): ParseResult | undefined {
  if (buffer.length !== 2 || !isDigitKey(buffer[0]) || buffer[0] === '0' || buffer[1] !== MIV_KEYS.operators.paste) {
    return undefined;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'pasteRegister',
      args: [buffer[0]]
    }
  };
}

function parseRegisterStoreSequence(buffer: string): ParseResult | undefined {
  if (!buffer.endsWith(MIV_KEYS.registers.viewer) || !isDigitsOnly(buffer.slice(0, -1))) {
    return undefined;
  }

  if (buffer.length !== 2 || buffer[0] === '0') {
    return INVALID_RESULT;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'storeRegister',
      args: [buffer[0]]
    }
  };
}

function parseSpaceRegisterTargetedCommand(buffer: string): ParseResult | undefined {
  const match = buffer.match(/^([0-9]+)\s([0-9])([xy])$/);
  if (!match) {
    return undefined;
  }

  const [, countRaw, register, command] = match;
  const parsedCount = Number.parseInt(countRaw, 10);
  const count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;

  if (command === MIV_KEYS.operators.delete) {
    return {
      status: 'complete',
      command: {
        sequence: buffer,
        action: 'deleteCharRight',
        args: [count, register]
      }
    };
  }

  if (command === MIV_KEYS.operators.yank) {
    return {
      status: 'complete',
      command: {
        sequence: buffer,
        action: 'yankLines',
        args: [count, register]
      }
    };
  }

  return INVALID_RESULT;
}

function parseSpaceRegisterTargetedPartial(buffer: string): ParseResult | undefined {
  if (/^([0-9]+)\s$/.test(buffer) || /^([0-9]+)\s[0-9]$/.test(buffer)) {
    return { status: 'partial' };
  }

  return undefined;
}

function parseImmediateCountCommand(commandKey: string, count: number, sequence: string): ParseResult | undefined {
  if (commandKey === MIV_KEYS.operators.delete) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'deleteCharRight',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.operators.yank) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'yankLines',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.deleteLine) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'deleteLine',
        vscodeCommand: 'editor.action.deleteLines',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.deleteWord) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'deleteWordRight',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.deleteToLineEnd) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'deleteToLineEnd',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.yankWord) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'yankWord',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.replaceWord) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'replaceWord',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.toggleCaseChar) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'toggleCaseChar',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.toggleCaseWord) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'toggleCaseWord',
        args: [count]
      }
    };
  }

  if (commandKey === MIV_KEYS.commands.gotoLine) {
    return {
      status: 'complete',
      command: {
        sequence,
        action: 'gotoLine',
        args: [count]
      }
    };
  }

  return undefined;
}

/**
 * Check whether a string contains only decimal digits.
 */
function isDigitsOnly(value: string): boolean {
  return value.length > 0 && /^[0-9]+$/.test(value);
}

/**
 * Parse operator+motion grammar.
 *
 * Parameters:
 *   buffer - Two-character sequence where first key is an operator.
 *
 * Returns:
 *   Complete operatorMotion command when the second key is a known motion.
 */
function parseOperatorMotionSequence(buffer: string): ParseResult {
  if (buffer.length !== 2) {
    return INVALID_RESULT;
  }

  const operator = buffer[0];
  if (operator !== MIV_KEYS.operators.yank) {
    return INVALID_RESULT;
  }
  const motionKey = buffer[1];
  if (motionKey === MIV_KEYS.navigation.up) {
    return INVALID_RESULT;
  }
  if (!MOTION_TABLE[motionKey]) {
    return INVALID_RESULT;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'operatorMotion',
      args: [operator, motionKey]
    }
  };
}

function parseReplaceCharSequence(buffer: string): ParseResult {
  if (buffer.length === 1) {
    return { status: 'partial' };
  }

  if (buffer.length !== 2) {
    return INVALID_RESULT;
  }

  return {
    status: 'complete',
    command: {
      sequence: buffer,
      action: 'replaceChar',
      args: [buffer[1]]
    }
  };
}
