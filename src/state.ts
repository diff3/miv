/**
 * Mutable editor state for the MIV runtime.
 *
 * This module stores session-level state shared across the extension, parser,
 * dispatcher hooks, and register UI.
 */
import * as vscode from 'vscode';
import { MIV_KEYS, MIV_MODES, isDigitKey, type MivMode as ConfigMivMode } from './config';
import type { ParsedCommand } from './parser';

export type MivMode = ConfigMivMode;

export interface AnchorPosition {
  uri: string;
  position: vscode.Position;
}

export interface SearchState {
  query: string;
  direction: 'forward' | 'backward';
  kind: 'literal' | 'regex';
}

export interface ReplaceRule {
  search: string;
  replace: string;
  isRegex: boolean;
}

export const COMMAND_INPUT_KINDS = {
  SEARCH_FORWARD: 'SEARCH_FORWARD',
  SEARCH_BACKWARD: 'SEARCH_BACKWARD',
  SEARCH_REGEX: 'SEARCH_REGEX',
  REPLACE_RULE: 'REPLACE_RULE'
} as const;

export type CommandInputKind = (typeof COMMAND_INPUT_KINDS)[keyof typeof COMMAND_INPUT_KINDS];

export const RAW_INPUT_MODES = {
  NONE: 'NONE',
  COMMAND: 'COMMAND',
  REPLACE_CHAR: 'REPLACE_CHAR'
} as const;

export type RawInputMode = (typeof RAW_INPUT_MODES)[keyof typeof RAW_INPUT_MODES];

export interface MivState {
  mode: MivMode;
  lastCommand?: ParsedCommand;
  anchorPosition?: AnchorPosition;
  anchorTogglePosition?: AnchorPosition;
  registers: Record<string, RegisterValue>;
  registerViewerActive: boolean;
  rawInputMode: RawInputMode;
  prefixInputActive: boolean;
  prefixCount: string;
  prefixRegister?: string;
  prefixOperator?: string;
  prefixSeparatorSeen: boolean;
  commandInputActive: boolean;
  commandInputKind?: CommandInputKind;
  commandPrefix: string;
  commandBuffer: string;
  replaceCharPending: boolean;
  replaceRule?: ReplaceRule;
  replaceRuleInputActive: boolean;
  replaceRuleBuffer: string;
  search?: SearchState;
  searchActive: boolean;
  searchBuffer: string;
  searchInputActive: boolean;
  searchHighlightEnabled: boolean;
  searchHighlightVisible: boolean;
  lastSearch?: string;
  lastSearchDirection?: 'forward' | 'backward';
  lastSearchPattern: string;
  lastSearchIsRegex: boolean;
  lastMatchList: number[];
  lastMatchLengths: number[];
  currentMatchIndex: number;
  lastMatchPattern: string;
}

export type RegisterType = 'charwise' | 'linewise';

export interface RegisterValue {
  text: string;
  type: RegisterType;
}

/**
 * Create the initial in-memory state for one extension session.
 *
 * Returns:
 *   Fully initialized state with empty registers 0..9.
 */
export function createInitialState(): MivState {
  const emptyRegister = (): RegisterValue => ({ text: '', type: 'charwise' });
  return {
    mode: MIV_MODES.NAV,
    lastCommand: undefined,
    anchorPosition: undefined,
    anchorTogglePosition: undefined,
    registerViewerActive: false,
    rawInputMode: RAW_INPUT_MODES.NONE,
    prefixInputActive: false,
    prefixCount: '',
    prefixRegister: undefined,
    prefixOperator: undefined,
    prefixSeparatorSeen: false,
    commandInputActive: false,
    commandInputKind: undefined,
    commandPrefix: '',
    commandBuffer: '',
    replaceCharPending: false,
    replaceRule: undefined,
    replaceRuleInputActive: false,
    replaceRuleBuffer: '',
    search: undefined,
    searchActive: false,
    searchBuffer: '',
    searchInputActive: false,
    searchHighlightEnabled: true,
    searchHighlightVisible: true,
    lastSearch: undefined,
    lastSearchDirection: undefined,
    lastSearchPattern: '',
    lastSearchIsRegex: false,
    lastMatchList: [],
    lastMatchLengths: [],
    currentMatchIndex: -1,
    lastMatchPattern: '',
    registers: {
      '0': emptyRegister(),
      '1': emptyRegister(),
      '2': emptyRegister(),
      '3': emptyRegister(),
      '4': emptyRegister(),
      '5': emptyRegister(),
      '6': emptyRegister(),
      '7': emptyRegister(),
      '8': emptyRegister(),
      '9': emptyRegister()
    }
  };
}

/**
 * Set the active editor mode.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   mode - Target mode.
 */
export function setMode(state: MivState, mode: MivMode): void {
  state.mode = mode;
}

/**
 * Switch to NAV mode.
 *
 * Side effects:
 *   Mutates `state.mode`.
 */
export function setNavMode(state: MivState): void {
  setMode(state, MIV_MODES.NAV);
}

/**
 * Switch to INSERT mode.
 *
 * Side effects:
 *   Mutates `state.mode`.
 */
export function setInsertMode(state: MivState): void {
  setMode(state, MIV_MODES.INSERT);
}

/**
 * Switch the active raw-input submode while keeping legacy booleans in sync.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   mode - Raw input mode to activate.
 */
export function setRawInputMode(state: MivState, mode: RawInputMode): void {
  state.rawInputMode = mode;
  if (mode !== RAW_INPUT_MODES.COMMAND) {
    state.commandInputActive = false;
    state.commandInputKind = undefined;
    state.commandPrefix = '';
    state.commandBuffer = '';
  }
  state.searchActive = false;
  state.searchInputActive = false;
  state.replaceRuleInputActive = false;
  state.replaceCharPending = mode === RAW_INPUT_MODES.REPLACE_CHAR;
}

export function clearPrefixInput(state: MivState): void {
  state.prefixInputActive = false;
  state.prefixCount = '';
  state.prefixRegister = undefined;
  state.prefixOperator = undefined;
  state.prefixSeparatorSeen = false;
}

export function updatePrefixInput(state: MivState, buffer: string): void {
  clearPrefixInput(state);

  if (buffer.length === 0) {
    return;
  }

  const countOnlyMatch = buffer.match(/^([1-9][0-9]*)$/);
  if (countOnlyMatch) {
    state.prefixInputActive = true;
    state.prefixCount = countOnlyMatch[1];
    return;
  }

  const countSeparatorMatch = buffer.match(/^([1-9][0-9]*)\s$/);
  if (countSeparatorMatch) {
    state.prefixInputActive = true;
    state.prefixCount = countSeparatorMatch[1];
    state.prefixSeparatorSeen = true;
    return;
  }

  const countRegisterMatch = buffer.match(/^([1-9][0-9]*)\s([1-9])$/);
  if (countRegisterMatch) {
    state.prefixInputActive = true;
    state.prefixCount = countRegisterMatch[1];
    state.prefixRegister = countRegisterMatch[2];
    state.prefixSeparatorSeen = true;
    return;
  }

  if (buffer.length === 1 && buffer === MIV_KEYS.operators.yank) {
    state.prefixInputActive = true;
    state.prefixOperator = buffer;
    return;
  }

  if (buffer.length === 1 && buffer === MIV_KEYS.operators.delete) {
    state.prefixInputActive = true;
    state.prefixOperator = buffer;
    return;
  }

  if (buffer.length >= 2 && isDigitKey(buffer[0]) && buffer[0] !== '0' && buffer[buffer.length - 1] === ' ') {
    state.prefixInputActive = true;
    state.prefixCount = buffer.slice(0, -1);
    state.prefixSeparatorSeen = true;
  }
}

export function startCommandInput(state: MivState, kind: CommandInputKind, prefix: string): void {
  clearPrefixInput(state);
  state.rawInputMode = RAW_INPUT_MODES.COMMAND;
  state.commandInputActive = true;
  state.commandInputKind = kind;
  state.commandPrefix = prefix;
  state.commandBuffer = '';
  state.searchActive = kind === COMMAND_INPUT_KINDS.SEARCH_FORWARD
    || kind === COMMAND_INPUT_KINDS.SEARCH_BACKWARD
    || kind === COMMAND_INPUT_KINDS.SEARCH_REGEX;
  state.searchInputActive = state.searchActive;
  state.replaceRuleInputActive = kind === COMMAND_INPUT_KINDS.REPLACE_RULE;
  state.replaceCharPending = false;
}

export function stopCommandInput(state: MivState): void {
  setRawInputMode(state, RAW_INPUT_MODES.NONE);
}

/**
 * Reset transient interactive state while preserving long-lived session data.
 *
 * Preserved:
 *   registers, anchor position, repeat/search history, and highlight enablement.
 *
 * Cleared:
 *   active raw-input modes, previews, replace/search working state, and
 *   current match tracking.
 */
export function resetTransientState(state: MivState): void {
  state.registerViewerActive = false;
  clearPrefixInput(state);
  setRawInputMode(state, RAW_INPUT_MODES.NONE);
  state.replaceRule = undefined;
  state.replaceRuleBuffer = '';
  state.search = undefined;
  state.searchBuffer = '';
  state.searchHighlightVisible = false;
  state.lastMatchList = [];
  state.lastMatchLengths = [];
  state.currentMatchIndex = -1;
  state.lastMatchPattern = '';
}

/**
 * Persist the most recent repeatable command.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   command - Parsed command to store for repeat.
 */
export function setLastCommand(state: MivState, command: ParsedCommand): void {
  state.lastCommand = command;
}

/**
 * Clear the stored repeatable command.
 */
export function clearLastCommand(state: MivState): void {
  state.lastCommand = undefined;
}

/**
 * Store the current cursor position as an anchor.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   editor - Active text editor used to capture URI and cursor position.
 */
export function setAnchorFromEditor(state: MivState, editor: vscode.TextEditor): void {
  state.anchorPosition = {
    uri: editor.document.uri.toString(),
    position: editor.selection.active
  };
}

/**
 * Write text into a numbered register.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   registerId - Register key or number.
 *   text - Register text payload.
 *   type - Storage mode for later paste behavior.
 *
 * Side effects:
 *   Mutates `state.registers`.
 */
export function storeRegister(
  state: MivState,
  registerId: string | number,
  text: string,
  type: RegisterType
): void {
  const key = String(registerId);
  state.registers[key] = { text, type };
}

/**
 * Read text from a numbered register.
 *
 * Parameters:
 *   state - Mutable MIV state object.
 *   registerId - Register key or number.
 *
 * Returns:
 *   Register content, or empty register when unset.
 */
export function getRegister(state: MivState, registerId: string | number): RegisterValue {
  const key = String(registerId);
  return state.registers[key] ?? { text: '', type: 'charwise' };
}
