import * as vscode from 'vscode';
import { MIV_KEYS } from '../config';
import type { ParsedCommand } from '../parser';
import { COMMAND_INPUT_KINDS, startCommandInput, stopCommandInput, type MivState } from '../state';
import type { UiFeedback } from '../uiFeedback';

export interface SearchController {
  startSearch(direction: 'forward' | 'backward', kind?: 'literal' | 'regex'): Promise<void>;
  appendCharacter(key: string): Promise<void>;
  backspace(): void;
  commitSearch(): Promise<void>;
  cancelSearch(): void;
  nextMatch(): Promise<void>;
  previousMatch(): Promise<void>;
  clearHighlights(editor?: vscode.TextEditor): void;
  renderHighlights(editor?: vscode.TextEditor): void;
  updateCurrentHighlight(editor?: vscode.TextEditor): void;
  executeSearch(query: string, direction: 'forward' | 'backward', kind?: 'literal' | 'regex'): Promise<boolean>;
}

export function createSearchController(options: {
  state: MivState;
  ui: Pick<UiFeedback, 'showCommandPreview' | 'showMessage'>;
  searchDecoration: vscode.TextEditorDecorationType;
  searchCurrentDecoration: vscode.TextEditorDecorationType;
  syncInputs: () => Promise<void>;
  setLastCommand: (command: ParsedCommand) => void;
}): SearchController {
  const getSearchPreviewText = (): string => {
    if (!options.state.search || !options.state.commandInputActive) {
      return undefined as never;
    }

    const prefix = options.state.search.kind === 'regex'
      ? MIV_KEYS.commands.searchRegexPrompt
      : options.state.search.direction === 'forward'
        ? MIV_KEYS.commands.searchForward
        : MIV_KEYS.commands.searchBackward;

    return `${prefix}${options.state.commandBuffer}`;
  };

  const updateSearchPreview = (): void => {
    options.ui.showCommandPreview(options.state.searchActive ? getSearchPreviewText() : undefined);
  };

  const jumpToMatch = (editor: vscode.TextEditor, index: number): void => {
    const offset = options.state.lastMatchList[index];
    if (offset === undefined) {
      return;
    }

    const position = editor.document.positionAt(offset);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(new vscode.Range(position, position));
  };

  const applySearchHighlights = (editor: vscode.TextEditor): void => {
    if (
      !options.state.searchHighlightEnabled
      || !options.state.searchHighlightVisible
      || options.state.lastMatchList.length === 0
      || options.state.lastMatchPattern.length === 0
    ) {
      editor.setDecorations(options.searchDecoration, []);
      editor.setDecorations(options.searchCurrentDecoration, []);
      return;
    }

    const allRanges: vscode.Range[] = [];
    const currentRanges: vscode.Range[] = [];
    for (let index = 0; index < options.state.lastMatchList.length; index += 1) {
      const matchOffset = options.state.lastMatchList[index];
      const start = editor.document.positionAt(matchOffset);
      const matchLength = options.state.lastMatchLengths[index] ?? options.state.lastMatchPattern.length;
      const end = editor.document.positionAt(matchOffset + matchLength);
      const range = new vscode.Range(start, end);
      if (index === options.state.currentMatchIndex) {
        currentRanges.push(range);
      } else {
        allRanges.push(range);
      }
    }

    editor.setDecorations(options.searchDecoration, allRanges);
    editor.setDecorations(options.searchCurrentDecoration, currentRanges);
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

  const executeSearch = async (
    query: string,
    direction: 'forward' | 'backward',
    kind: 'literal' | 'regex' = 'literal'
  ): Promise<boolean> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || query.length === 0) {
      return false;
    }

    const text = editor.document.getText();
    const offset = editor.document.offsetAt(editor.selection.active);
    const matchData = collectMatchData(text, query, kind === 'regex');
    if (!matchData) {
      options.ui.showMessage(`invalid regex: ${query}`);
      return false;
    }

    const { offsets: matches, lengths } = matchData;
    if (matches.length === 0) {
      options.ui.showMessage(`not found: ${query}`);
      return false;
    }

    const matchIndex = direction === 'forward'
      ? (() => {
          const index = matches.findIndex((matchOffset) => matchOffset > offset);
          return index >= 0 ? index : matches.length - 1;
        })()
      : (() => {
          for (let index = matches.length - 1; index >= 0; index -= 1) {
            if (matches[index] < offset) {
              return index;
            }
          }
          return 0;
        })();

    options.state.lastMatchList = matches;
    options.state.lastMatchLengths = lengths.length > 0 ? lengths : matches.map(() => query.length);
    options.state.currentMatchIndex = matchIndex;
    options.state.lastMatchPattern = query;
    options.state.searchHighlightVisible = true;
    jumpToMatch(editor, matchIndex);
    applySearchHighlights(editor);
    return true;
  };

  const rerunLastSearch = async (direction: 'forward' | 'backward'): Promise<boolean> => {
    if (options.state.lastSearchPattern.length === 0) {
      return false;
    }

    const found = await executeSearch(
      options.state.lastSearchPattern,
      direction,
      options.state.lastSearchIsRegex ? 'regex' : 'literal'
    );

    if (!found) {
      return false;
    }

    options.state.lastSearchDirection = direction;
    return true;
  };

  return {
    async startSearch(direction, kind = 'literal'): Promise<void> {
      startCommandInput(
        options.state,
        kind === 'regex'
          ? COMMAND_INPUT_KINDS.SEARCH_REGEX
          : direction === 'forward'
            ? COMMAND_INPUT_KINDS.SEARCH_FORWARD
            : COMMAND_INPUT_KINDS.SEARCH_BACKWARD,
        kind === 'regex'
          ? MIV_KEYS.commands.searchRegexPrompt
          : direction === 'forward'
            ? MIV_KEYS.commands.searchForward
            : MIV_KEYS.commands.searchBackward
      );
      options.state.searchBuffer = '';
      options.state.search = { query: '', direction, kind };
      await options.syncInputs();
      updateSearchPreview();
    },
    async appendCharacter(key: string): Promise<void> {
      if (!options.state.searchActive) {
        return;
      }

      if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
        await this.commitSearch();
        return;
      }

      if (key.length !== 1) {
        return;
      }

      options.state.commandBuffer += key;
      options.state.searchBuffer += key;
      updateSearchPreview();
    },
    backspace(): void {
      if (!options.state.searchActive) {
        return;
      }

      options.state.commandBuffer = options.state.commandBuffer.slice(0, -1);
      options.state.searchBuffer = options.state.searchBuffer.slice(0, -1);
      updateSearchPreview();
    },
    async commitSearch(): Promise<void> {
      if (!options.state.search) {
        this.cancelSearch();
        return;
      }

      const query = options.state.searchBuffer;
      const { direction, kind } = options.state.search;
      stopCommandInput(options.state);
      options.state.search = query.length === 0 ? undefined : { query, direction, kind };
      options.state.searchBuffer = '';
      await options.syncInputs();
      options.ui.showCommandPreview(undefined);

      if (query.length === 0) {
        return;
      }

      const found = await executeSearch(query, direction, kind);
      if (!found) {
        return;
      }

      options.state.lastSearch = query;
      options.state.lastSearchDirection = direction;
      options.state.lastSearchPattern = query;
      options.state.lastSearchIsRegex = kind === 'regex';
      options.setLastCommand({
        sequence: `${kind === 'regex' ? MIV_KEYS.commands.searchRegex : direction === 'forward' ? MIV_KEYS.commands.searchForward : MIV_KEYS.commands.searchBackward}${query}`,
        action: kind === 'regex' ? 'regexSearch' : direction === 'forward' ? 'forwardSearch' : 'backwardSearch',
        args: [query]
      });
    },
    cancelSearch(): void {
      stopCommandInput(options.state);
      options.state.searchBuffer = '';
      options.state.search = undefined;
      void options.syncInputs();
      options.ui.showCommandPreview(undefined);
    },
    async nextMatch(): Promise<void> {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      if (options.state.lastMatchList.length === 0) {
        await rerunLastSearch('forward');
        return;
      }

      options.state.currentMatchIndex += 1;
      if (options.state.currentMatchIndex >= options.state.lastMatchList.length) {
        options.state.currentMatchIndex = options.state.lastMatchList.length - 1;
        options.ui.showMessage('search reached end');
        return;
      }

      jumpToMatch(editor, options.state.currentMatchIndex);
      applySearchHighlights(editor);
    },
    async previousMatch(): Promise<void> {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      if (options.state.lastMatchList.length === 0) {
        await rerunLastSearch('backward');
        return;
      }

      options.state.currentMatchIndex -= 1;
      if (options.state.currentMatchIndex < 0) {
        options.state.currentMatchIndex = 0;
        options.ui.showMessage('search reached start');
        return;
      }

      jumpToMatch(editor, options.state.currentMatchIndex);
      applySearchHighlights(editor);
    },
    clearHighlights(editor?: vscode.TextEditor): void {
      const activeEditor = editor ?? vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }

      activeEditor.setDecorations(options.searchDecoration, []);
      activeEditor.setDecorations(options.searchCurrentDecoration, []);
    },
    renderHighlights(editor?: vscode.TextEditor): void {
      const activeEditor = editor ?? vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }

      applySearchHighlights(activeEditor);
    },
    updateCurrentHighlight(editor?: vscode.TextEditor): void {
      const activeEditor = editor ?? vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }

      applySearchHighlights(activeEditor);
    },
    executeSearch
  };
}
