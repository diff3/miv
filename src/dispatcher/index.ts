import * as vscode from 'vscode';
import type { ParsedCommand } from '../parser';
import { setLastCommand, type MivState } from '../state';
import { EDIT_ACTION_HANDLERS } from './editActions';
import { INSERT_ACTION_HANDLERS } from './insertActions';
import { MOTION_AND_NAVIGATION_ACTION_HANDLERS } from './motionActions';
import { REGISTER_ACTION_HANDLERS } from './registerActions';
import { getCommandUsageStatsSnapshot, recordCommandUsage, REPEATABLE_EDIT_ACTIONS } from './stats';
import type { ActionHandlerMap, DispatchHooks } from './shared';

const ACTION_HANDLERS: ActionHandlerMap = {
  ...INSERT_ACTION_HANDLERS,
  ...EDIT_ACTION_HANDLERS,
  ...REGISTER_ACTION_HANDLERS,
  ...MOTION_AND_NAVIGATION_ACTION_HANDLERS
};

export type { DispatchHooks } from './shared';
export { getCommandUsageStatsSnapshot } from './stats';

export async function dispatchCommand(parsed: ParsedCommand, state: MivState, hooks?: DispatchHooks): Promise<void> {
  recordCommandUsage(parsed.action, parsed.sequence);

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
