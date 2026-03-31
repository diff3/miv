import type { ParsedAction } from '../parser';

const commandUsageCounts: Record<string, number> = Object.create(null) as Record<string, number>;
const sequenceUsageCounts: Record<string, number> = Object.create(null) as Record<string, number>;

export interface CommandUsageStatsSnapshot {
  actions: Record<string, number>;
  sequences: Record<string, number>;
}

export const REPEATABLE_EDIT_ACTIONS = new Set<ParsedAction>([
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
  'yankLines',
  'changeToLineEnd',
  'changeLine',
  'joinLineWithNext',
  'builtinEdit',
  'textObjectOperation'
]);

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

export function recordCommandUsage(action: string, sequence: string): void {
  incrementCounter(commandUsageCounts, action);
  incrementCounter(sequenceUsageCounts, sequence);
}

export function getCommandUsageStatsSnapshot(): CommandUsageStatsSnapshot {
  return {
    actions: { ...commandUsageCounts },
    sequences: { ...sequenceUsageCounts }
  };
}
