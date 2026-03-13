/**
 * Mutable editor state for the MIV runtime.
 *
 * This module stores session-level state shared across the extension, parser,
 * dispatcher hooks, and register UI.
 */
import * as vscode from 'vscode';
import { MIV_MODES, type MivMode as ConfigMivMode } from './config';
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

export interface MivState {
  mode: MivMode;
  lastCommand?: ParsedCommand;
  anchorPosition?: AnchorPosition;
  registers: Record<string, RegisterValue>;
  registerViewerActive: boolean;
  replaceCharPending: boolean;
  replaceRule?: ReplaceRule;
  replaceRuleInputActive: boolean;
  replaceRuleBuffer: string;
  search?: SearchState;
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
    registerViewerActive: false,
    replaceCharPending: false,
    replaceRule: undefined,
    replaceRuleInputActive: false,
    replaceRuleBuffer: '',
    search: undefined,
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
