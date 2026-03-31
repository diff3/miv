import * as vscode from 'vscode';
import { MIV_KEYS } from '../config';
import { parseInput, type ParsedCommand } from '../parser';
import {
  COMMAND_INPUT_KINDS,
  RAW_INPUT_MODES,
  setRawInputMode,
  startCommandInput,
  stopCommandInput,
  type MivState,
  type ReplaceRule
} from '../state';
import type { UiFeedback } from '../uiFeedback';

export interface ReplaceController {
  startReplaceChar(): Promise<void>;
  handleReplaceChar(key: string): Promise<void>;
  cancelReplaceChar(): Promise<void>;
  startReplaceRule(): Promise<void>;
  appendReplaceRuleChar(key: string): void;
  backspaceReplaceRule(): void;
  commitReplaceRule(): Promise<void>;
  cancelReplaceRule(): void;
  applyReplaceRule(): Promise<void>;
  replaceAllWithRule(rule: ReplaceRule): Promise<number>;
  canApplyActiveReplaceRule(): boolean;
}

export function createReplaceController(options: {
  state: MivState;
  syncInputs: () => Promise<void>;
  ensureNavMode: () => Promise<void>;
  ui: Pick<UiFeedback, 'showCommandPreview' | 'showMessage'>;
  setLastCommand: (command: ParsedCommand) => void;
  clearBufferedInput: () => void;
  renderSearchHighlights: (editor?: vscode.TextEditor) => void;
  runReplaceCharCommand: (key: string) => Promise<void>;
}): ReplaceController {
  const updateReplaceRulePreview = (): void => {
    const preview = options.state.commandInputActive && options.state.commandInputKind === COMMAND_INPUT_KINDS.REPLACE_RULE
      ? `${options.state.commandPrefix}${options.state.commandBuffer}`
      : undefined;
    options.ui.showCommandPreview(preview);
  };

  const collectLiteralMatchOffsets = (text: string, pattern: string): number[] => {
    if (pattern.length === 0) {
      return [];
    }

    const matches: number[] = [];
    let index = text.indexOf(pattern);
    while (index !== -1) {
      matches.push(index);
      index = text.indexOf(pattern, index + pattern.length);
    }
    return matches;
  };

  const collectRegexMatches = (text: string, pattern: string): { offsets: number[]; lengths: number[] } | undefined => {
    if (pattern.length === 0) {
      return { offsets: [], lengths: [] };
    }

    try {
      const regex = new RegExp(pattern, 'g');
      const offsets: number[] = [];
      const lengths: number[] = [];
      for (const match of text.matchAll(regex)) {
        if (match.index === undefined) {
          continue;
        }

        const matchedText = match[0] ?? '';
        offsets.push(match.index);
        lengths.push(Math.max(matchedText.length, 1));
      }
      return { offsets, lengths };
    } catch {
      return undefined;
    }
  };

  const collectMatchData = (
    text: string,
    pattern: string,
    isRegex: boolean
  ): { offsets: number[]; lengths: number[] } | undefined => {
    return isRegex
      ? collectRegexMatches(text, pattern)
      : {
          offsets: collectLiteralMatchOffsets(text, pattern),
          lengths: []
        };
  };

  return {
    async startReplaceChar(): Promise<void> {
      setRawInputMode(options.state, RAW_INPUT_MODES.REPLACE_CHAR);
      await options.syncInputs();
    },
    async handleReplaceChar(key: string): Promise<void> {
      if (!options.state.replaceCharPending) {
        return;
      }

      if (key === 'escape' || key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn || key.length !== 1) {
        setRawInputMode(options.state, RAW_INPUT_MODES.NONE);
        options.clearBufferedInput();
        await options.syncInputs();
        await options.ensureNavMode();
        return;
      }

      setRawInputMode(options.state, RAW_INPUT_MODES.NONE);
      options.clearBufferedInput();
      await options.syncInputs();
      await options.ensureNavMode();
      await options.runReplaceCharCommand(key);
    },
    async cancelReplaceChar(): Promise<void> {
      setRawInputMode(options.state, RAW_INPUT_MODES.NONE);
      await options.syncInputs();
      options.clearBufferedInput();
      await options.ensureNavMode();
    },
    async startReplaceRule(): Promise<void> {
      startCommandInput(options.state, COMMAND_INPUT_KINDS.REPLACE_RULE, MIV_KEYS.commands.replaceMatches);
      options.state.replaceRuleBuffer = MIV_KEYS.commands.replaceMatches;
      await options.syncInputs();
      updateReplaceRulePreview();
    },
    appendReplaceRuleChar(key: string): void {
      options.state.commandBuffer += key;
      options.state.replaceRuleBuffer += key;
      updateReplaceRulePreview();
    },
    backspaceReplaceRule(): void {
      if (!options.state.replaceRuleInputActive) {
        return;
      }

      options.state.commandBuffer = options.state.commandBuffer.slice(0, -1);
      options.state.replaceRuleBuffer = options.state.replaceRuleBuffer.slice(0, -1);
      if (options.state.replaceRuleBuffer.length === 0) {
        options.state.replaceRuleBuffer = MIV_KEYS.commands.replaceMatches;
      }
      updateReplaceRulePreview();
    },
    async commitReplaceRule(): Promise<void> {
      if (options.state.replaceRuleBuffer === MIV_KEYS.commands.replaceMatches) {
        stopCommandInput(options.state);
        options.state.replaceRuleBuffer = '';
        await options.syncInputs();
        options.ui.showCommandPreview(undefined);
        await this.applyReplaceRule();
        return;
      }

      const result = parseInput(options.state.replaceRuleBuffer);
      if (result.status !== 'complete' || !result.command || result.command.action !== 'setReplaceRule') {
        options.ui.showMessage('invalid replace rule');
        this.cancelReplaceRule();
        return;
      }

      const firstArg = String(result.command.args?.[0] ?? '');
      const secondArg = result.command.args?.[1] !== undefined ? String(result.command.args?.[1]) : undefined;

      let nextRule: ReplaceRule | undefined;
      if (secondArg !== undefined) {
        const editor = vscode.window.activeTextEditor;
        const text = editor?.document.getText() ?? '';
        const searchFirstRule: ReplaceRule = { search: firstArg, replace: secondArg, isRegex: false };
        const legacyRule: ReplaceRule = { search: secondArg, replace: firstArg, isRegex: false };
        const searchFirstMatches = collectMatchData(text, searchFirstRule.search, false)?.offsets.length ?? 0;
        const legacyMatches = collectMatchData(text, legacyRule.search, false)?.offsets.length ?? 0;
        nextRule = legacyMatches > searchFirstMatches ? legacyRule : searchFirstRule;
      } else {
        const search = options.state.lastSearchPattern;
        if (search.length === 0) {
          options.ui.showMessage('no previous search');
          this.cancelReplaceRule();
          return;
        }

        nextRule = {
          search,
          replace: firstArg,
          isRegex: options.state.lastSearchIsRegex
        };
      }

      if (!nextRule || nextRule.search.length === 0) {
        options.ui.showMessage('no previous search');
        this.cancelReplaceRule();
        return;
      }

      options.state.replaceRule = nextRule;
      stopCommandInput(options.state);
      options.state.replaceRuleBuffer = '';
      await options.syncInputs();
      options.ui.showCommandPreview(undefined);
      const replacedCount = await this.replaceAllWithRule(options.state.replaceRule);
      options.ui.showMessage(`replaced ${replacedCount} matches`);
      options.setLastCommand({
        sequence: MIV_KEYS.commands.replaceMatches,
        action: 'applyReplaceRule'
      });
    },
    cancelReplaceRule(): void {
      stopCommandInput(options.state);
      options.state.replaceRuleBuffer = '';
      void options.syncInputs();
      options.ui.showCommandPreview(undefined);
    },
    async applyReplaceRule(): Promise<void> {
      const editor = vscode.window.activeTextEditor;
      const rule = options.state.replaceRule;
      if (!editor || !rule || options.state.lastMatchList.length === 0 || options.state.currentMatchIndex < 0) {
        return;
      }

      const currentOffset = options.state.lastMatchList[options.state.currentMatchIndex];
      if (currentOffset === undefined) {
        return;
      }

      const start = editor.document.positionAt(currentOffset);
      const matchLength = options.state.lastMatchLengths[options.state.currentMatchIndex] ?? rule.search.length;
      const end = editor.document.positionAt(currentOffset + matchLength);
      const range = new vscode.Range(start, end);
      await editor.edit((editBuilder) => {
        editBuilder.replace(range, rule.replace);
      });

      const text = editor.document.getText();
      const matchData = collectMatchData(text, rule.search, rule.isRegex);
      if (!matchData) {
        options.state.lastMatchList = [];
        options.state.lastMatchLengths = [];
        options.state.currentMatchIndex = -1;
        options.state.lastMatchPattern = rule.search;
        options.renderSearchHighlights(editor);
        return;
      }

      const matches = matchData.offsets;
      options.state.lastMatchList = matches;
      options.state.lastMatchLengths = matchData.lengths.length > 0 ? matchData.lengths : matches.map(() => rule.search.length);
      options.state.lastMatchPattern = rule.search;
      options.state.currentMatchIndex = matches.findIndex((matchOffset) => matchOffset > currentOffset);
      if (options.state.currentMatchIndex < 0) {
        options.state.currentMatchIndex = matches.length - 1;
      }

      if (options.state.currentMatchIndex >= 0 && matches.length > 0) {
        const position = editor.document.positionAt(matches[options.state.currentMatchIndex]);
        const selection = new vscode.Selection(position, position);
        editor.selection = selection;
        editor.revealRange(selection);
      }
      options.renderSearchHighlights(editor);
    },
    async replaceAllWithRule(rule: ReplaceRule): Promise<number> {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return 0;
      }

      const document = editor.document;
      const text = document.getText();
      const matchData = collectMatchData(text, rule.search, rule.isRegex);
      if (!matchData) {
        options.ui.showMessage(`invalid regex: ${rule.search}`);
        return 0;
      }

      const replacedCount = matchData.offsets.length;
      if (replacedCount === 0) {
        options.state.lastMatchList = [];
        options.state.lastMatchLengths = [];
        options.state.currentMatchIndex = -1;
        options.state.lastMatchPattern = rule.search;
        options.renderSearchHighlights(editor);
        return 0;
      }

      const nextText = rule.isRegex
        ? text.replace(new RegExp(rule.search, 'g'), rule.replace)
        : text.split(rule.search).join(rule.replace);
      const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, nextText);
      });

      const updatedText = editor.document.getText();
      const updatedMatchData = collectMatchData(updatedText, rule.search, rule.isRegex);
      if (!updatedMatchData) {
        options.state.lastMatchList = [];
        options.state.lastMatchLengths = [];
        options.state.currentMatchIndex = -1;
        options.state.lastMatchPattern = rule.search;
        options.renderSearchHighlights(editor);
        return replacedCount;
      }

      options.state.lastMatchList = updatedMatchData.offsets;
      options.state.lastMatchLengths = updatedMatchData.lengths.length > 0
        ? updatedMatchData.lengths
        : updatedMatchData.offsets.map(() => rule.search.length);
      options.state.currentMatchIndex = updatedMatchData.offsets.length > 0 ? 0 : -1;
      options.state.lastMatchPattern = rule.search;
      options.renderSearchHighlights(editor);
      return replacedCount;
    },
    canApplyActiveReplaceRule(): boolean {
      return Boolean(
        options.state.mode === 'NAV'
        && !options.state.commandInputActive
        && options.state.replaceRule
        && options.state.lastMatchList.length > 0
        && options.state.currentMatchIndex >= 0
      );
    }
  };
}
