import { CONFIG, MIV_KEYS, MIV_MODES, TOKENS, getSequenceValueForToken, isDigitKey } from '../config';
import { parseInput, type ParsedCommand } from '../parser';
import { RAW_INPUT_MODES, type MivState } from '../state';
import type { UiFeedback } from '../uiFeedback';
import type { ReplaceController } from './replaceController';
import type { SearchController } from './searchController';

export interface InputRouter {
  handleTypeInput(args: { text?: string }): Promise<void>;
  handleKeyInput(key: string): Promise<void>;
  clear(): void;
}

export function createInputRouter(options: {
  state: MivState;
  ui: Pick<UiFeedback, 'showCommandPreview'>;
  searchController: SearchController;
  replaceController: ReplaceController;
  defaultType: (args: { text?: string }) => Promise<void>;
  toInputToken: (inputKey: string) => string | undefined;
  setInsert: () => Promise<void>;
  runParsedCommand: (parsed: ParsedCommand) => Promise<void>;
  setLastCommand: (command: ParsedCommand) => void;
  isAllowedRegisterViewerKey: (key: string) => boolean;
}): InputRouter {
  let inputBuffer: string[] = [];
  let previewBuffer = '';
  let fallbackTimer: NodeJS.Timeout | undefined;

  const clearFallbackTimer = (): void => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
  };

  const clear = (): void => {
    clearFallbackTimer();
    inputBuffer = [];
    previewBuffer = '';
    options.ui.showCommandPreview(undefined);
  };

  const getPreviewText = (text: string): string => {
    if (text.length === 2 && isDigitKey(text[0]) && text[0] !== '0' && text[1] === MIV_KEYS.operators.paste) {
      return `paste register ${text[0]}`;
    }

    return text;
  };

  const hasBufferedTokens = (...expectedTokens: string[]): boolean => {
    return inputBuffer.length === expectedTokens.length && expectedTokens.every((token, index) => inputBuffer[index] === token);
  };

  const getRawInputMode = (): string => options.state.rawInputMode;

  return {
    clear,
    async handleTypeInput(args: { text?: string }): Promise<void> {
      const key = args?.text;
      if (typeof key !== 'string') {
        await options.defaultType(args);
        return;
      }

      if (options.state.registerViewerActive) {
        if (options.isAllowedRegisterViewerKey(key)) {
          await options.defaultType(args);
        }
        return;
      }

      switch (getRawInputMode()) {
        case RAW_INPUT_MODES.REPLACE_RULE:
          if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
            await options.replaceController.commitReplaceRule();
            return;
          }

          options.replaceController.appendReplaceRuleChar(key);
          return;
        case RAW_INPUT_MODES.SEARCH:
          await options.searchController.appendCharacter(key);
          return;
        case RAW_INPUT_MODES.REPLACE_CHAR:
          await options.replaceController.handleReplaceChar(key);
          return;
        default:
          break;
      }

      if (options.state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchForward) {
        await options.searchController.startSearch('forward');
        return;
      }

      if (options.state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchBackward) {
        await options.searchController.startSearch('backward');
        return;
      }

      if (options.state.mode === MIV_MODES.NAV && key === MIV_KEYS.commands.searchRegex) {
        await options.searchController.startSearch('forward', 'regex');
        return;
      }

      if (key === MIV_KEYS.mode.enter || key === MIV_KEYS.mode.carriageReturn) {
        if (options.replaceController.canApplyActiveReplaceRule()) {
          await options.replaceController.applyReplaceRule();
          options.setLastCommand({
            sequence: MIV_KEYS.commands.replaceMatches,
            action: 'applyReplaceRule'
          });
          return;
        }

        await options.defaultType(args);
        return;
      }

      if (key === MIV_KEYS.mode.enterInsert) {
        if (options.state.mode === MIV_MODES.NAV && inputBuffer.length === 0) {
          await options.setInsert();
          return;
        }

        if (options.state.mode === MIV_MODES.NAV) {
          await this.handleKeyInput(key);
          return;
        }

        await options.defaultType(args);
        return;
      }

      if (options.state.mode === MIV_MODES.NAV) {
        const inputToken = options.toInputToken(key);
        if (!inputToken) {
          return;
        }

        await this.handleKeyInput(inputToken);
        return;
      }

      await options.defaultType(args);
    },
    async handleKeyInput(key: string): Promise<void> {
      if (options.state.mode !== MIV_MODES.NAV || options.state.registerViewerActive) {
        return;
      }

      switch (getRawInputMode()) {
        case RAW_INPUT_MODES.SEARCH:
          await options.searchController.appendCharacter(key);
          return;
        case RAW_INPUT_MODES.REPLACE_RULE:
          return;
        case RAW_INPUT_MODES.REPLACE_CHAR:
          await options.replaceController.handleReplaceChar(key);
          return;
        default:
          break;
      }

      const inputToken = options.toInputToken(key);
      if (!inputToken) {
        return;
      }

      clearFallbackTimer();
      if (inputToken === TOKENS.SPACE && inputBuffer.length === 0) {
        await options.setInsert();
        return;
      }

      if (inputToken === TOKENS.SEARCH_FORWARD && inputBuffer.length === 0) {
        await options.searchController.startSearch('forward');
        return;
      }

      if (inputToken === TOKENS.SEARCH_BACKWARD && inputBuffer.length === 0) {
        await options.searchController.startSearch('backward');
        return;
      }

      if (inputToken === TOKENS.SEARCH_REGEX && inputBuffer.length === 0) {
        await options.searchController.startSearch('forward', 'regex');
        return;
      }

      if (inputToken === TOKENS.REPLACE_MATCHES && inputBuffer.length === 0) {
        await options.replaceController.startReplaceRule();
        return;
      }

      inputBuffer.push(inputToken);
      previewBuffer += getSequenceValueForToken(inputToken);
      options.ui.showCommandPreview(getPreviewText(previewBuffer));

      const result = parseInput(inputBuffer);
      if (result.status === 'partial') {
        if (!result.fallbackCommand) {
          if (hasBufferedTokens(TOKENS.REPLACE_CHAR)) {
            await options.replaceController.startReplaceChar();
          }
          return;
        }

        if (hasBufferedTokens(TOKENS.REPLACE_MATCHES)) {
          await options.replaceController.startReplaceRule();
        }

        fallbackTimer = setTimeout(async () => {
          if (result.fallbackCommand?.action === 'applyReplaceRule') {
            await options.replaceController.applyReplaceRule();
          } else {
            await options.runParsedCommand(result.fallbackCommand as ParsedCommand);
          }
          clear();
        }, result.fallbackDelayMs ?? CONFIG.timeouts.sequence);
        return;
      }

      if (result.status === 'invalid' || !result.command) {
        clear();
        return;
      }

      if (result.command.action === 'forwardSearch') {
        await options.searchController.startSearch('forward');
        return;
      }

      if (result.command.action === 'backwardSearch') {
        await options.searchController.startSearch('backward');
        return;
      }

      if (result.command.action === 'regexSearch') {
        await options.searchController.startSearch('forward', 'regex');
        return;
      }

      if (result.command.action === 'searchNext') {
        await options.searchController.nextMatch();
        clear();
        return;
      }

      if (result.command.action === 'searchPrevious') {
        await options.searchController.previousMatch();
        clear();
        return;
      }

      if (result.command.action === 'setReplaceRule') {
        await options.replaceController.commitReplaceRule();
        clear();
        return;
      }

      if (result.command.action === 'applyReplaceRule') {
        await options.replaceController.applyReplaceRule();
        clear();
        return;
      }

      await options.runParsedCommand(result.command);
      clear();
    }
  };
}
