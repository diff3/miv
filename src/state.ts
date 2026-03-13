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

export interface MivState {
  mode: MivMode;
  lastCommand?: ParsedCommand;
  anchorPosition?: AnchorPosition;
  registers: Record<string, Register>;
  registerViewerActive: boolean;
}

export interface Register {
  text: string;
  linewise: boolean;
}

/**
 * Create the initial in-memory state for one extension session.
 *
 * Returns:
 *   Fully initialized state with empty registers 0..9.
 */
export function createInitialState(): MivState {
  const emptyRegister = (): Register => ({ text: '', linewise: false });
  return {
    mode: MIV_MODES.NAV,
    lastCommand: undefined,
    anchorPosition: undefined,
    registerViewerActive: false,
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
 *   value - Register payload.
 *
 * Side effects:
 *   Mutates `state.registers`.
 */
export function storeRegister(state: MivState, registerId: string | number, value: Register | string, linewise = false): void {
  const key = String(registerId);
  if (typeof value === 'string') {
    state.registers[key] = { text: value, linewise };
    return;
  }

  state.registers[key] = { text: value.text, linewise: value.linewise };
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
export function getRegister(state: MivState, registerId: string | number): Register {
  const key = String(registerId);
  return state.registers[key] ?? { text: '', linewise: false };
}
