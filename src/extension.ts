/**
 * VS Code extension entrypoint for MIV.
 *
 * This module wires editor input events to parser/dispatcher execution, keeps
 * runtime state synchronized with VS Code context, and coordinates UI helpers.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CONFIG,
  MIV_MODES,
  MIV_KEYS,
  NAV_KEY_MAP,
  NAV_INPUT_KEY_SET,
  REPEATABLE_BUILTIN_COMMANDS,
  TOKENS,
  getSequenceValueForToken,
  isDigitKey,
  isManualRegisterKey,
  refreshKeymapProfiles,
  KEYMAP_PROFILES,
  normalizeKey,
  setActiveKeymapName
} from './config';
import { dispatchCommand, getCommandUsageStatsSnapshot } from './dispatcher';
import type { ParsedCommand } from './parser';
import { parseInput } from './parser';
import { showRegisterViewer } from './registerViewer';
import { createUiFeedback } from './uiFeedback';
import { createInitialState, setAnchorFromEditor, setInsertMode, setLastCommand, setNavMode, storeRegister, type MivMode } from './state';

const DEFAULT_PARTIAL_FALLBACK_DELAY_MS = CONFIG.timeouts.sequence;
const HANDLE_KEY_FORWARD_COMMANDS = [
  { command: 'miv.cursorLeft', key: 'a' },
  { command: 'miv.cursorRight', key: 'd' },
  { command: 'miv.cursorUp', key: 'w' },
  { command: 'miv.pageUp', key: 'W' },
  { command: 'miv.cursorDown', key: 's' },
  { command: 'miv.pageDown', key: 'S' },
  { command: 'miv.lineStart', key: 'A' },
  { command: 'miv.lineEnd', key: 'D' },
  { command: 'miv.wordLeft', key: 'q' },
  { command: 'miv.wordEndRight', key: 'e' },
  { command: 'miv.wordEndLeft', key: 'Q' },
  { command: 'miv.wordStartRight', key: 'E' },
  { command: 'miv.deleteChar', key: 'x' },
  { command: 'miv.deleteLine', key: 'b' },
  { command: 'miv.deleteWord', key: 'X' },
  { command: 'miv.yankWord', key: 'Y' },
  { command: 'miv.spaceInput', key: ' ' },
  { command: 'miv.textObjectAuto', key: '!' },
  { command: 'miv.replaceChar', key: 'r' },
  { command: 'miv.replaceWord', key: 'R' },
  { command: 'miv.toggleCaseChar', key: '§' },
  { command: 'miv.toggleCaseWord', key: '°' },
  { command: 'miv.repeatLastCommand', key: 'c' },
  { command: 'miv.repeatLastCommandAlias', key: '.' },
  { command: 'miv.enterInsert', key: 'i' },
  { command: 'miv.insertAtLineStart', key: 'I' },
  { command: 'miv.insertAtLineEnd', key: 'k' },
  { command: 'miv.undo', key: 'u' },
  { command: 'miv.yankLine', key: 'y' },
  { command: 'miv.openLineBelow', key: 'o' },
  { command: 'miv.openLineAbove', key: 'O' },
  { command: 'miv.paste', key: 'p' },
  { command: 'miv.showRegistersKey', key: 'v' },
  { command: 'miv.replaceMatches', key: '=' },
  { command: 'miv.searchForward', key: '/' },
  { command: 'miv.searchBackward', key: '\\' },
  { command: 'miv.searchRegex', key: ',' },
  { command: 'miv.searchNext', key: 'n' },
  { command: 'miv.searchPrevious', key: 'N' },
  { command: 'miv.gotoLine', key: 'g' },
  { command: 'miv.documentBottom', key: 'G' }
] as const;

/**
 * Activate extension commands and input pipeline.
 *
 * Parameters:
 *   context - VS Code extension context used for command subscriptions.
 *
 * Side effects:
 *   Registers commands, mutates workspace cursor style, and initializes mode UI.
 */
export function activate(context: vscode.ExtensionContext): void {
  const builtinKeymapDir = path.join(context.extensionPath, 'keymaps');
  const userKeymapDir = path.join(path.dirname(context.extensionPath), 'miv');
  if (!fs.existsSync(userKeymapDir)) {
    fs.mkdirSync(userKeymapDir, { recursive: true });
  }
  refreshKeymapProfiles(builtinKeymapDir, userKeymapDir);

  const syncKeymapProfile = (): void => {
    const config = vscode.workspace.getConfiguration('miv');
    const savedKeymap = config.get<string>('keymap');
    if (savedKeymap) {
      setActiveKeymapName(savedKeymap);
      return;
    }

    setActiveKeymapName('default');
  };

  syncKeymapProfile();

  const state = createInitialState();
  const statsOutput = vscode.window.createOutputChannel('MIV Stats');
  const searchDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255,255,0,0.25)'
  });
  const searchCurrentDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255,180,0,0.45)'
  });
  let inputBuffer: string[] = [];
  let previewBuffer = '';
  let lastClipboard = '';
  let fallbackTimer: NodeJS.Timeout | undefined;

  const ui = createUiFeedback({
    getMode: () => state.mode,
    yankHighlightDuration: CONFIG.timeouts.yankHighlight
  });

  const clearTimer = (timer: NodeJS.Timeout | undefined): NodeJS.Timeout | undefined => {
    if (timer) {
      clearTimeout(timer);
    }

    return undefined;
  };

  const clearFallbackTimer = (): void => {
    fallbackTimer = clearTimer(fallbackTimer);
  };

  const resetInputState = (): void => {
    // Full reset is used when a command boundary is reached.
    clearFallbackTimer();
    inputBuffer = [];
    previewBuffer = '';
    state.replaceRuleInputActive = false;
    state.replaceRuleBuffer = '';
    ui.showCommandPreview(undefined);
  };

  const getPreviewText = (text: string): string => {
    if (text.length === 2 && isDigitKey(text[0]) && text[0] !== '0' && text[1] === MIV_KEYS.operators.paste) {
      return `paste register ${text[0]}`;
    }

    return text;
  };

  const updateCursor = async (mode: MivMode): Promise<void> => {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const cursorStyle = mode === MIV_MODES.NAV ? 'block' : 'line';
    await editorConfig.update('cursorStyle', cursorStyle, vscode.ConfigurationTarget.Workspace);
  };

  const syncModeFeedback = async (): Promise<void> => {
    await vscode.commands.executeCommand('setContext', 'miv.mode', state.mode);
    await updateCursor(state.mode);
    ui.updateStatusBar();
  };

  const setNav = async (): Promise<void> => {
    resetInputState();
    setNavMode(state);
    await syncModeFeedback();
  };

  const setInsert = async (): Promise<void> => {
    resetInputState();
    setInsertMode(state);
    await syncModeFeedback();
  };

  const getSearchPreviewText = (): string => {
    if (!state.search) {
      return undefined as never;
    }

    const prefix = state.search.kind === 'regex'
      ? MIV_KEYS.commands.searchRegexPrompt
      : state.search.direction === 'forward'
        ? MIV_KEYS.commands.searchForward
        : MIV_KEYS.commands.searchBackward;
    return `${prefix}${state.search.query}`;
  };

  const startSearchInput = (direction: 'forward' | 'backward', kind: 'literal' | 'regex' = 'literal'): void => {
    resetInputState();
    state.searchInputActive = true;
    state.search = { query: '', direction, kind };
    ui.showCommandPreview(getSearchPreviewText());
  };

  const cancelSearchInput = (): void => {
    state.searchInputActive = false;
    state.search = undefined;
    ui.showCommandPreview(undefined);
  };

  const updateSearchPreview = (): void => {
    ui.showCommandPreview(state.searchInputActive ? getSearchPreviewText() : undefined);
  };

  const isSearchInputPrefixKey = (key: string): boolean => {
    if (!state.search) {
      return false;
    }

    if (state.search.kind === 'regex') {
      return key === MIV_KEYS.commands.searchRegex;
    }

    return key === (
      state.search.direction === 'forward'
        ? MIV_KEYS.commands.searchForward
        : MIV_KEYS.commands.searchBackward
    );
  };

  const updateReplaceRulePreview = (): void => {
    ui.showCommandPreview(state.replaceRuleInputActive ? state.replaceRuleBuffer : undefined);
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

  const jumpToMatch = (editor: vscode.TextEditor, index: number): void => {
    const offset = state.lastMatchList[index];
    if (offset === undefined) {
      return;
    }

    const position = editor.document.positionAt(offset);
    const selection = new vscode.Selection(position, position);
    editor.selection = selection;
    editor.revealRange(new vscode.Range(position, position));
  };

  const clearSearchHighlights = (editor?: vscode.TextEditor): void => {
    const activeEditor = editor ?? vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    activeEditor.setDecorations(searchDecoration, []);
    activeEditor.setDecorations(searchCurrentDecoration, []);
  };

  const applySearchHighlights = (editor: vscode.TextEditor): void => {
    if (!state.searchHighlightEnabled || !state.searchHighlightVisible || state.lastMatchList.length === 0 || state.lastMatchPattern.length === 0) {
      clearSearchHighlights(editor);
      return;
    }

    const allRanges: vscode.Range[] = [];
    const currentRanges: vscode.Range[] = [];
    for (let index = 0; index < state.lastMatchList.length; index += 1) {
      const matchOffset = state.lastMatchList[index];
      const start = editor.document.positionAt(matchOffset);
      const matchLength = state.lastMatchLengths[index] ?? state.lastMatchPattern.length;
      const end = editor.document.positionAt(matchOffset + matchLength);
      const range = new vscode.Range(start, end);
      if (index === state.currentMatchIndex) {
        currentRanges.push(range);
      } else {
        allRanges.push(range);
      }
    }

    editor.setDecorations(searchDecoration, allRanges);
    editor.setDecorations(searchCurrentDecoration, currentRanges);
  };

  const renderSearchHighlights = (editor?: vscode.TextEditor): void => {
    const activeEditor = editor ?? vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    applySearchHighlights(activeEditor);
  };

  const updateCurrentSearchHighlight = (editor?: vscode.TextEditor): void => {
    const activeEditor = editor ?? vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    applySearchHighlights(activeEditor);
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

  const executeNativeSearch = async (
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
      ui.showMessage(`invalid regex: ${query}`);
      return false;
    }

    const { offsets: matches, lengths } = matchData;
    if (matches.length === 0) {
      ui.showMessage(`not found: ${query}`);
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

    state.lastMatchList = matches;
    state.lastMatchLengths = lengths.length > 0 ? lengths : matches.map(() => query.length);
    state.currentMatchIndex = matchIndex;
    state.lastMatchPattern = query;
    state.searchHighlightVisible = true;
    jumpToMatch(editor, matchIndex);
    renderSearchHighlights(editor);
    return true;
  };

  const commitSearchInput = async (): Promise<void> => {
    if (!state.search) {
      cancelSearchInput();
      return;
    }

    const { query, direction, kind } = state.search;
    state.searchInputActive = false;
    ui.showCommandPreview(undefined);
    const found = await executeNativeSearch(query, direction, kind);
    if (found) {
      state.lastSearch = query;
      state.lastSearchDirection = direction;
      state.lastSearchPattern = query;
      state.lastSearchIsRegex = kind === 'regex';
      setLastCommand(state, {
        sequence: `${kind === 'regex' ? MIV_KEYS.commands.searchRegex : direction === 'forward' ? MIV_KEYS.commands.searchForward : MIV_KEYS.commands.searchBackward}${query}`,
        action: kind === 'regex' ? 'regexSearch' : direction === 'forward' ? 'forwardSearch' : 'backwardSearch',
        args: [query]
      });
    }
  };

  const jumpToNextMatch = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || state.lastMatchList.length === 0) {
      return;
    }

    state.currentMatchIndex += 1;
    if (state.currentMatchIndex >= state.lastMatchList.length) {
      state.currentMatchIndex = state.lastMatchList.length - 1;
      ui.showMessage('search reached end');
      return;
    }

    jumpToMatch(editor, state.currentMatchIndex);
    updateCurrentSearchHighlight(editor);
  };

  const jumpToPreviousMatch = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || state.lastMatchList.length === 0) {
      return;
    }

    state.currentMatchIndex -= 1;
    if (state.currentMatchIndex < 0) {
      state.currentMatchIndex = 0;
      ui.showMessage('search reached start');
      return;
    }

    jumpToMatch(editor, state.currentMatchIndex);
    updateCurrentSearchHighlight(editor);
  };

  const appendSearchInput = (key: string): void => {
    state.search = {
      query: `${state.search?.query ?? ''}${key}`,
      direction: state.search?.direction ?? 'forward',
      kind: state.search?.kind ?? 'literal'
    };
    updateSearchPreview();
  };

  const startReplaceRuleInput = (): void => {
    resetInputState();
    state.replaceRuleInputActive = true;
    state.replaceRuleBuffer = MIV_KEYS.commands.replaceMatches;
    updateReplaceRulePreview();
  };

  const appendReplaceRuleInput = (key: string): void => {
    state.replaceRuleBuffer += key;
    updateReplaceRulePreview();
  };

  const cancelReplaceRuleInput = (): void => {
    state.replaceRuleInputActive = false;
    state.replaceRuleBuffer = '';
    ui.showCommandPreview(undefined);
  };

  const commitReplaceRuleInput = async (): Promise<void> => {
    if (state.replaceRuleBuffer === MIV_KEYS.commands.replaceMatches) {
      state.replaceRuleInputActive = false;
      state.replaceRuleBuffer = '';
      ui.showCommandPreview(undefined);
      await applyReplaceRule();
      return;
    }

    const result = parseInput(state.replaceRuleBuffer);
    if (result.status !== 'complete' || !result.command || result.command.action !== 'setReplaceRule') {
      ui.showMessage('invalid replace rule');
      cancelReplaceRuleInput();
      return;
    }

    const replace = String(result.command.args?.[0] ?? '');
    const explicitSearch = result.command.args?.[1] !== undefined ? String(result.command.args?.[1]) : undefined;
    const search = explicitSearch ?? state.lastSearchPattern;
    const isRegex = explicitSearch === undefined ? state.lastSearchIsRegex : false;
    if (search.length === 0) {
      ui.showMessage('no previous search');
      cancelReplaceRuleInput();
      return;
    }

    state.replaceRule = { replace, search, isRegex };
    state.replaceRuleInputActive = false;
    state.replaceRuleBuffer = '';
    ui.showCommandPreview(undefined);
    const replacedCount = await replaceAllWithRule(state.replaceRule);
    ui.showMessage(`replaced ${replacedCount} matches`);
    setLastCommand(state, {
      sequence: MIV_KEYS.commands.replaceMatches,
      action: 'applyReplaceRule'
    });
  };

  const replaceAllWithRule = async (rule: NonNullable<typeof state.replaceRule>): Promise<number> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return 0;
    }

    const document = editor.document;
    const text = document.getText();
    const matchData = collectMatchData(text, rule.search, rule.isRegex);
    if (!matchData) {
      ui.showMessage(`invalid regex: ${rule.search}`);
      return 0;
    }

    const replacedCount = matchData.offsets.length;
    if (replacedCount === 0) {
      state.lastMatchList = [];
      state.lastMatchLengths = [];
      state.currentMatchIndex = -1;
      state.lastMatchPattern = rule.search;
      renderSearchHighlights(editor);
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
      state.lastMatchList = [];
      state.lastMatchLengths = [];
      state.currentMatchIndex = -1;
      state.lastMatchPattern = rule.search;
      renderSearchHighlights(editor);
      return replacedCount;
    }

    state.lastMatchList = updatedMatchData.offsets;
    state.lastMatchLengths = updatedMatchData.lengths.length > 0
      ? updatedMatchData.lengths
      : updatedMatchData.offsets.map(() => rule.search.length);
    state.currentMatchIndex = updatedMatchData.offsets.length > 0 ? 0 : -1;
    state.lastMatchPattern = rule.search;
    renderSearchHighlights(editor);
    return replacedCount;
  };

  const applyReplaceRule = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    const rule = state.replaceRule;
    if (!editor || !rule || state.lastMatchList.length === 0 || state.currentMatchIndex < 0) {
      return;
    }

    const currentOffset = state.lastMatchList[state.currentMatchIndex];
    if (currentOffset === undefined) {
      return;
    }

    const start = editor.document.positionAt(currentOffset);
    const matchLength = state.lastMatchLengths[state.currentMatchIndex] ?? rule.search.length;
    const end = editor.document.positionAt(currentOffset + matchLength);
    const range = new vscode.Range(start, end);
    await editor.edit((editBuilder) => {
      editBuilder.replace(range, rule.replace);
    });

    const text = editor.document.getText();
    const matchData = collectMatchData(text, rule.search, rule.isRegex);
    if (!matchData) {
      state.lastMatchList = [];
      state.lastMatchLengths = [];
      state.currentMatchIndex = -1;
      state.lastMatchPattern = rule.search;
      renderSearchHighlights(editor);
      return;
    }

    const matches = matchData.offsets;
    state.lastMatchList = matches;
    state.lastMatchLengths = matchData.lengths.length > 0 ? matchData.lengths : matches.map(() => rule.search.length);
    state.lastMatchPattern = rule.search;
    state.currentMatchIndex = matches.findIndex((matchOffset) => matchOffset > currentOffset);
    if (state.currentMatchIndex < 0) {
      state.currentMatchIndex = matches.length - 1;
    }

    if (state.currentMatchIndex >= 0 && matches.length > 0) {
      jumpToMatch(editor, state.currentMatchIndex);
    }
    renderSearchHighlights(editor);
  };

  const canApplyActiveReplaceRule = (): boolean => {
    return Boolean(
      state.mode === MIV_MODES.NAV &&
      !state.searchInputActive &&
      !state.replaceRuleInputActive &&
      state.replaceRule &&
      state.lastMatchList.length > 0 &&
      state.currentMatchIndex >= 0
    );
  };

  const runReplaceChar = async (key: string): Promise<void> => {
    state.replaceCharPending = false;
    await runParsedCommand({
      sequence: `${MIV_KEYS.operators.replace}${key}`,
      action: 'replaceChar',
      args: [key]
    });
    inputBuffer = [];
    previewBuffer = '';
    ui.showCommandPreview(undefined);
  };

  const syncClipboardMirror = async (): Promise<void> => {
    const clipboardValue = await vscode.env.clipboard.readText();
    if (clipboardValue.length === 0 || clipboardValue === lastClipboard) {
      return;
    }

    storeRegister(state, '9', clipboardValue, clipboardValue.endsWith('\n') ? 'linewise' : 'charwise');
    lastClipboard = clipboardValue;
  };

  const isLinewiseSelection = (editor: vscode.TextEditor): boolean => {
    const selection = editor.selection;
    if (selection.isEmpty) {
      return false;
    }

    const startsAtLineStart = selection.start.character === 0;
    const endLine = editor.document.lineAt(selection.end.line);
    const endsAtLineEnd = selection.end.character === endLine.text.length;
    return startsAtLineStart && endsAtLineEnd;
  };

  const shouldSyncClipboardAfterParsedCommand = (parsed: ParsedCommand): boolean => {
    // Reads clipboard only after commands that are expected to touch it.
    if (parsed.action === 'yankLines' || parsed.action === 'yankWord' || parsed.action === 'paste') {
      return true;
    }

    return parsed.action === 'operatorMotion' && parsed.args?.[0] === MIV_KEYS.operators.yank;
  };

  const toInputToken = (inputKey: string): string | undefined => {
    if (NAV_INPUT_KEY_SET.has(inputKey)) {
      return inputKey;
    }

    const normalizedKey = normalizeKey(inputKey);
    const token = NAV_KEY_MAP[normalizedKey] ?? normalizedKey;
    if (!NAV_INPUT_KEY_SET.has(token)) {
      return undefined;
    }

    return token;
  };

  const hasBufferedTokens = (...expectedTokens: string[]): boolean => {
    return inputBuffer.length === expectedTokens.length && expectedTokens.every((token, index) => inputBuffer[index] === token);
  };

  const formatStatsSection = (title: string, counts: Record<string, number>): string[] => {
    const entries = Object.entries(counts).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    });
    const lines = [`=== ${title} ===`, ''];
    if (entries.length === 0) {
      lines.push('(no data)');
      return lines;
    }

    const width = entries.reduce((max, [key]) => Math.max(max, key.length), 0);
    for (const [key, count] of entries) {
      lines.push(`${key.padEnd(width + 2)}${count}`);
    }
    return lines;
  };

  void syncModeFeedback();
  void (async () => {
    lastClipboard = await vscode.env.clipboard.readText();
  })();

  const runExtensionCommand = async (parsed: ParsedCommand): Promise<boolean> => {
    if (parsed.action === 'forwardSearch' || parsed.action === 'backwardSearch' || parsed.action === 'regexSearch') {
      const query = String(parsed.args?.[0] ?? '');
      if (query.length === 0) {
        return true;
      }

      const direction = parsed.action === 'backwardSearch' ? 'backward' : 'forward';
      const kind = parsed.action === 'regexSearch' ? 'regex' : 'literal';
      const found = await executeNativeSearch(query, direction, kind);
      if (found) {
        state.lastSearch = query;
        state.lastSearchDirection = direction;
        state.lastSearchPattern = query;
        state.lastSearchIsRegex = kind === 'regex';
      }
      return true;
    }

    if (parsed.action === 'applyReplaceRule') {
      await applyReplaceRule();
      return true;
    }

    return false;
  };

  const shouldStoreExtensionRepeat = (parsed: ParsedCommand): boolean => {
    return (
      parsed.action === 'forwardSearch' ||
      parsed.action === 'backwardSearch' ||
      parsed.action === 'regexSearch' ||
      parsed.action === 'applyReplaceRule'
    );
  };

  const runParsedCommand = async (parsed: ParsedCommand): Promise<void> => {
    if (parsed.action === 'repeatLastCommand') {
      if (!state.lastCommand || state.lastCommand.action === 'repeatLastCommand') {
        return;
      }

      await runParsedCommand(state.lastCommand);
      return;
    }

    if (await runExtensionCommand(parsed)) {
      if (shouldStoreExtensionRepeat(parsed)) {
        setLastCommand(state, parsed);
      }
      return;
    }

    await dispatchCommand(parsed, state, {
      onModeChanged: syncModeFeedback,
      onStatusMessage: ui.showMessage,
      onYank: ui.flashYank
    });

    if (shouldSyncClipboardAfterParsedCommand(parsed)) {
      await syncClipboardMirror();
    }
  };

  const isAllowedRegisterViewerKey = (key: string): boolean => {
    return isDigitKey(key);
  };

  const subscriptions = [
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('miv.keymap')) {
        syncKeymapProfile();
      }
    }),
    ...HANDLE_KEY_FORWARD_COMMANDS.map(({ command, key }) => vscode.commands.registerCommand(command, async () => {
      await vscode.commands.executeCommand('miv.handleKey', key);
    })),
    vscode.commands.registerCommand('type', async (args: { text?: string }) => {
      const key = args?.text;
      if (typeof key !== 'string') {
        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (state.registerViewerActive) {
        if (isAllowedRegisterViewerKey(key)) {
          await vscode.commands.executeCommand('default:type', args);
        }
        return;
      }

      if (state.replaceRuleInputActive) {
        if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
          await commitReplaceRuleInput();
          return;
        }

        appendReplaceRuleInput(key);
        return;
      }

      if (state.searchInputActive) {
        if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
          await commitSearchInput();
          return;
        }

        appendSearchInput(key);
        return;
      }

      if (state.replaceCharPending) {
        await runReplaceChar(key);
        return;
      }

      if (state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchForward) {
        startSearchInput('forward');
        return;
      }

      if (state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchBackward) {
        startSearchInput('backward');
        return;
      }

      if (state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchRegex) {
        startSearchInput('forward', 'regex');
        return;
      }

      if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
        if (canApplyActiveReplaceRule()) {
          await applyReplaceRule();
          setLastCommand(state, {
            sequence: MIV_KEYS.commands.replaceMatches,
            action: 'applyReplaceRule'
          });
          return;
        }

        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (key === MIV_KEYS.mode.enterInsert) {
        if (state.mode === MIV_MODES.NAV && inputBuffer.length === 0) {
          await setInsert();
          return;
        }

        if (state.mode === MIV_MODES.NAV) {
          await vscode.commands.executeCommand('miv.handleKey', key);
          return;
        }

        await vscode.commands.executeCommand('default:type', args);
        return;
      }

      if (state.mode === MIV_MODES.NAV) {
        const inputToken = toInputToken(key);
        if (!inputToken) {
          return;
        }

        await vscode.commands.executeCommand('miv.handleKey', inputToken);
        return;
      }

      await vscode.commands.executeCommand('default:type', args);
    }),
    vscode.commands.registerCommand('miv.handleKey', async (key: string) => {
      if (state.mode !== MIV_MODES.NAV || state.registerViewerActive) {
        return;
      }

      if (state.searchInputActive) {
        if ((state.search?.query ?? '').length === 0 && isSearchInputPrefixKey(key)) {
          return;
        }

        appendSearchInput(key);
        return;
      }

      if (state.replaceRuleInputActive) {
        appendReplaceRuleInput(key);
        return;
      }

      if (state.replaceCharPending) {
        await runReplaceChar(key);
        return;
      }

      const inputToken = toInputToken(key);
      if (!inputToken) {
        return;
      }

      clearFallbackTimer();
      if (inputToken === TOKENS.SPACE && inputBuffer.length === 0) {
        await setInsert();
        return;
      }

      if (inputToken === TOKENS.SEARCH_FORWARD && inputBuffer.length === 0) {
        startSearchInput('forward');
        return;
      }

      if (inputToken === TOKENS.SEARCH_BACKWARD && inputBuffer.length === 0) {
        startSearchInput('backward');
        return;
      }

      if (inputToken === TOKENS.SEARCH_REGEX && inputBuffer.length === 0) {
        startSearchInput('forward', 'regex');
        return;
      }

      if (inputToken === TOKENS.REPLACE_MATCHES && inputBuffer.length === 0) {
        startReplaceRuleInput();
        return;
      }

      inputBuffer.push(inputToken);
      previewBuffer += getSequenceValueForToken(inputToken);
      ui.showCommandPreview(getPreviewText(previewBuffer));

      const result = parseInput(inputBuffer);

      if (result.status === 'partial') {
        if (!result.fallbackCommand) {
          if (hasBufferedTokens(TOKENS.REPLACE_CHAR)) {
            state.replaceCharPending = true;
          }
          return;
        }

        if (hasBufferedTokens(TOKENS.REPLACE_MATCHES)) {
          state.replaceRuleInputActive = true;
          state.replaceRuleBuffer = previewBuffer;
          updateReplaceRulePreview();
        }

        fallbackTimer = setTimeout(async () => {
          if (result.fallbackCommand?.action === 'applyReplaceRule') {
            state.replaceRuleInputActive = false;
            state.replaceRuleBuffer = '';
            await applyReplaceRule();
          } else {
            await runParsedCommand(result.fallbackCommand as ParsedCommand);
          }
          inputBuffer = [];
          previewBuffer = '';
          ui.showCommandPreview(undefined);
          fallbackTimer = undefined;
        }, result.fallbackDelayMs ?? DEFAULT_PARTIAL_FALLBACK_DELAY_MS);
        return;
      }

      if (result.status === 'invalid' || !result.command) {
        inputBuffer = [];
        previewBuffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      if (result.command.action === 'forwardSearch') {
        startSearchInput('forward');
        return;
      }

      if (result.command.action === 'backwardSearch') {
        startSearchInput('backward');
        return;
      }

      if (result.command.action === 'regexSearch') {
        startSearchInput('forward', 'regex');
        return;
      }

      if (result.command.action === 'searchNext') {
        await jumpToNextMatch();
        inputBuffer = [];
        previewBuffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      if (result.command.action === 'searchPrevious') {
        await jumpToPreviousMatch();
        inputBuffer = [];
        previewBuffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      if (result.command.action === 'setReplaceRule') {
        const replace = String(result.command.args?.[0] ?? '');
        const explicitSearch = result.command.args?.[1] !== undefined ? String(result.command.args?.[1]) : undefined;
        const search = explicitSearch ?? state.lastSearchPattern;
        const isRegex = explicitSearch === undefined ? state.lastSearchIsRegex : false;
        if (search.length === 0) {
          ui.showMessage('no previous search');
          inputBuffer = [];
          previewBuffer = '';
          ui.showCommandPreview(undefined);
          return;
        }

        state.replaceRule = { replace, search, isRegex };
        const replacedCount = await replaceAllWithRule(state.replaceRule);
        ui.showMessage(`replaced ${replacedCount} matches`);
        setLastCommand(state, {
          sequence: MIV_KEYS.commands.replaceMatches,
          action: 'applyReplaceRule'
        });
        inputBuffer = [];
        previewBuffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      if (result.command.action === 'applyReplaceRule') {
        await applyReplaceRule();
        inputBuffer = [];
        previewBuffer = '';
        ui.showCommandPreview(undefined);
        return;
      }

      await runParsedCommand(result.command);
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
    }),
    vscode.commands.registerCommand('miv.toggleMode', async () => {
      if (state.mode === MIV_MODES.NAV) {
        await setInsert();
      }
    }),
    vscode.commands.registerCommand('miv.toggleSearchHighlight', async () => {
      state.searchHighlightEnabled = !state.searchHighlightEnabled;
      if (!state.searchHighlightEnabled) {
        state.searchHighlightVisible = false;
        clearSearchHighlights();
        ui.showMessage('search highlight disabled');
        return;
      }

      state.searchHighlightVisible = true;
      renderSearchHighlights();
      ui.showMessage('search highlight enabled');
    }),
    vscode.commands.registerCommand('miv.toNavMode', async () => {
      if (state.searchInputActive) {
        state.searchHighlightVisible = false;
        clearSearchHighlights();
        cancelSearchInput();
        return;
      }

      if (state.replaceRuleInputActive) {
        cancelReplaceRuleInput();
        return;
      }

      if (state.replaceCharPending) {
        state.replaceCharPending = false;
        resetInputState();
        return;
      }

      state.searchHighlightVisible = false;
      clearSearchHighlights();
      await setNav();
    }),
    vscode.commands.registerCommand('miv.searchBackspace', async () => {
      if (state.replaceRuleInputActive) {
        state.replaceRuleBuffer = state.replaceRuleBuffer.slice(0, -1);
        if (state.replaceRuleBuffer.length === 0) {
          state.replaceRuleBuffer = MIV_KEYS.commands.replaceMatches;
        }
        updateReplaceRulePreview();
        return;
      }

      if (!state.searchInputActive || !state.search) {
        return;
      }

      state.search = {
        ...state.search,
        query: state.search.query.slice(0, -1)
      };
      updateSearchPreview();
    }),
    vscode.commands.registerCommand('miv.executeBuiltin', async (command: string, args?: unknown[]) => {
      resetInputState();

      const isRepositionCommand =
        command === 'editor.action.moveLinesUpAction' ||
        command === 'editor.action.moveLinesDownAction' ||
        command === 'editor.action.outdentLines' ||
        command === 'editor.action.indentLines';

      if (isRepositionCommand) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        await vscode.commands.executeCommand('editor.action.focusActiveEditorGroup');
      }

      try {
        await vscode.commands.executeCommand(command, ...(args ?? []));
      } catch {
        ui.showMessage(`command failed: ${command}`);
        return;
      }

      if (REPEATABLE_BUILTIN_COMMANDS.has(command)) {
        setLastCommand(state, {
          sequence: command,
          action: 'builtinEdit',
          vscodeCommand: command,
          args
        });
      }
    }),
    vscode.commands.registerCommand('miv.copyToClipboard', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
      const clipboardValue = await vscode.env.clipboard.readText();
      if (clipboardValue.length === 0) {
        ui.showMessage('clipboard empty');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      const type = editor && isLinewiseSelection(editor) ? 'linewise' : clipboardValue.endsWith('\n') ? 'linewise' : 'charwise';
      storeRegister(state, '9', clipboardValue, type);
      lastClipboard = clipboardValue;
      ui.showMessage('stored clipboard in register 9');
    }),
    vscode.commands.registerCommand('miv.pasteFromClipboard', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      await runParsedCommand(
        {
          sequence: 'ctrl+v',
          action: 'paste'
        }
      );
    }),
    vscode.commands.registerCommand('miv.storeRegister', async (register: string) => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      const registerKey = String(register);
      if (!isManualRegisterKey(registerKey)) {
        return;
      }

      const clipboardValue = await vscode.env.clipboard.readText();
      if (clipboardValue.length === 0) {
        ui.showMessage('clipboard empty');
        return;
      }

      storeRegister(state, registerKey, clipboardValue, clipboardValue.endsWith('\n') ? 'linewise' : 'charwise');
      ui.showMessage(`stored clipboard in register ${registerKey}`);
    }),
    vscode.commands.registerCommand('miv.showRegisters', async () => {
      if (state.mode !== MIV_MODES.NAV) {
        return;
      }

      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);
      await showRegisterViewer({
        state,
        runParsedCommand,
        showMessage: ui.showMessage
      });
    }),
    vscode.commands.registerCommand('miv.openKeymap', async () => {
      const extensionUri = vscode.extensions.getExtension('diff3.miv')?.extensionUri ?? context.extensionUri;
      const uri = vscode.Uri.joinPath(extensionUri, 'doc', 'KEYMAP.md');
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      await vscode.commands.executeCommand('markdown.showPreviewToSide', editor.document.uri);
    }),
    vscode.commands.registerCommand('miv.openKeybindings', async () => {
      await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', 'miv');
    }),
    vscode.commands.registerCommand('miv.switchKeymap', async () => {
      refreshKeymapProfiles(builtinKeymapDir, userKeymapDir);
      const options = Object.keys(KEYMAP_PROFILES);
      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select MIV keymap'
      });
      if (!selected) {
        return;
      }

      setActiveKeymapName(selected);
      await vscode.workspace
        .getConfiguration('miv')
        .update('keymap', selected, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(`MIV keymap switched to: ${selected}`);
    }),
    vscode.commands.registerCommand('miv.openMenu', async () => {
      clearFallbackTimer();
      inputBuffer = [];
      previewBuffer = '';
      ui.showCommandPreview(undefined);

      const items = [
        { label: '$(graph) Command Stats', action: async () => vscode.commands.executeCommand('miv.showCommandStats') },
        { label: '$(files) Registers', action: async () => vscode.commands.executeCommand('miv.showRegisters') },
        { label: '$(search) Toggle Search Highlight', action: async () => vscode.commands.executeCommand('miv.toggleSearchHighlight') },
        { label: '$(keyboard) Switch Keymap', action: async () => vscode.commands.executeCommand('miv.switchKeymap') },
        { label: '$(keyboard) Change Keybindings', action: async () => vscode.commands.executeCommand('miv.openKeybindings') },
        { label: '$(book) Open KEYMAP', action: async () => vscode.commands.executeCommand('miv.openKeymap') }
      ];

      const choice = await vscode.window.showQuickPick(items, {
        placeHolder: 'MIV menu'
      });
      if (!choice) {
        return;
      }

      await choice.action();
    }),
    vscode.commands.registerCommand('miv.setAnchor', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      setAnchorFromEditor(state, editor);
    }),
    vscode.commands.registerCommand('miv.jumpToAnchor', async () => {
      if (!state.anchorPosition) {
        return;
      }

      const uri = vscode.Uri.parse(state.anchorPosition.uri);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      const selection = new vscode.Selection(state.anchorPosition.position, state.anchorPosition.position);
      editor.selection = selection;
      editor.revealRange(selection);
    }),
    vscode.commands.registerCommand('miv.showCommandStats', async () => {
      const stats = getCommandUsageStatsSnapshot();
      const lines = [
        ...formatStatsSection('MIV Command Usage', stats.actions),
        '',
        ...formatStatsSection('Key Sequences', stats.sequences)
      ];
      statsOutput.clear();
      statsOutput.appendLine(lines.join('\n'));
      statsOutput.show(true);
    })
  ];

  context.subscriptions.push(...ui.disposables);
  context.subscriptions.push(statsOutput);
  context.subscriptions.push(searchDecoration);
  context.subscriptions.push(searchCurrentDecoration);
  context.subscriptions.push(...subscriptions);
}

/**
 * VS Code deactivation hook.
 *
 * MIV has no explicit shutdown work; resources are disposed via subscriptions.
 */
export function deactivate(): void {}
