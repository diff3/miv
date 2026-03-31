/**
 * Baseline VS Code extension tests.
 */
import * as assert from 'assert';

import * as vscode from 'vscode';
import { NAV_KEY_MAP } from '../config';
import { findTextObjectBounds, getTextObjectRegisterMirrors } from '../dispatcher/editActions';
import { findMatchingBracketOffset } from '../dispatcher/motionActions';
import { REPEATABLE_EDIT_ACTIONS } from '../dispatcher/stats';
import { parseInput } from '../parser';
import {
	COMMAND_INPUT_KINDS,
	RAW_INPUT_MODES,
	clearPrefixInput,
	createInitialState,
	setRawInputMode,
	startCommandInput,
	updatePrefixInput
} from '../state';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('maps Space in NAV keymap', () => {
		assert.strictEqual(NAV_KEY_MAP.space, 'SPACE');
	});

	test('does not map typed angle brackets to case toggle', () => {
		assert.strictEqual(NAV_KEY_MAP['<'], undefined);
		assert.strictEqual(NAV_KEY_MAP['>'], undefined);
		assert.strictEqual(NAV_KEY_MAP.backquote, 'TOGGLE_CASE_CHAR');
		assert.strictEqual(NAV_KEY_MAP['shift+backquote'], 'TOGGLE_CASE_WORD');
		assert.strictEqual(NAV_KEY_MAP['§'], 'TOGGLE_CASE_CHAR');
		assert.strictEqual(NAV_KEY_MAP['°'], 'TOGGLE_CASE_WORD');
	});

	test('maps backtick and acute accents to themselves for typed input', () => {
		assert.strictEqual(NAV_KEY_MAP['`'], undefined);
		assert.strictEqual(NAV_KEY_MAP['´'], undefined);
	});

	test('mirrors text object yank and delete into default registers', () => {
		assert.deepStrictEqual(getTextObjectRegisterMirrors('y', '3').sort(), ['0', '3', '9']);
		assert.deepStrictEqual(getTextObjectRegisterMirrors('x', '2').sort(), ['2', '8']);
		assert.deepStrictEqual(getTextObjectRegisterMirrors('p', '5').sort(), ['5']);
	});

	test('auto text object prefers the delimiter under the cursor', () => {
		const text = '{"hello"}';
		assert.deepStrictEqual(findTextObjectBounds(text, 2, '!'), { openOffset: 1, closeOffset: 7 });
		assert.deepStrictEqual(findTextObjectBounds(text, 0, '!'), { openOffset: 0, closeOffset: 8 });
		assert.deepStrictEqual(findTextObjectBounds(text, 8, '!'), { openOffset: 0, closeOffset: 8 });
	});

	test('jump bracket match supports quote-style delimiters', () => {
		const text = '{"hello"}';
		assert.strictEqual(findMatchingBracketOffset(text, 1), 7);
		assert.strictEqual(findMatchingBracketOffset(text, 7), 1);
		assert.strictEqual(findMatchingBracketOffset(text, 3), 7);
	});

	test('jump bracket match toggles both ways for symmetric delimiters', () => {
		const text = '`hello`';
		assert.strictEqual(findMatchingBracketOffset(text, 0), 6);
		assert.strictEqual(findMatchingBracketOffset(text, 6), 0);
		assert.strictEqual(findMatchingBracketOffset(text, 3), 6);
	});

	test('jump bracket match does not jump into the next symmetric pair', () => {
		const text = '"hello" "world"';
		assert.strictEqual(findMatchingBracketOffset(text, 6), 0);
		assert.strictEqual(findMatchingBracketOffset(text, 8), 14);
	});

	test('paste commands do not overwrite repeat history', () => {
		assert.strictEqual(REPEATABLE_EDIT_ACTIONS.has('paste'), false);
		assert.strictEqual(REPEATABLE_EDIT_ACTIONS.has('pasteAfter'), false);
		assert.strictEqual(REPEATABLE_EDIT_ACTIONS.has('pasteBefore'), false);
		assert.strictEqual(REPEATABLE_EDIT_ACTIONS.has('pasteRegister'), false);
	});

	test('parses count space register yank', () => {
		const result = parseInput(['2', 'SPACE', '2', 'YANK_LINE']);
		assert.strictEqual(result.status, 'complete');
		assert.deepStrictEqual(result.command, {
			sequence: '2 2y',
			action: 'yankLines',
			args: [2, '2']
		});
	});

	test('parses specialized text objects with default registers', () => {
		assert.deepStrictEqual(parseInput(['"', 'y']), {
			status: 'complete',
			command: {
				sequence: '"y',
				action: 'textObjectOperation',
				args: ['"', '0', 'y']
			}
		});
		assert.deepStrictEqual(parseInput(['\'', 'y']), {
			status: 'complete',
			command: {
				sequence: '\'y',
				action: 'textObjectOperation',
				args: ['\'', '0', 'y']
			}
		});
		assert.deepStrictEqual(parseInput(['`', 'y']), {
			status: 'complete',
			command: {
				sequence: '`y',
				action: 'textObjectOperation',
				args: ['`', '0', 'y']
			}
		});
		assert.deepStrictEqual(parseInput(['´', 'y']), {
			status: 'complete',
			command: {
				sequence: '´y',
				action: 'textObjectOperation',
				args: ['´', '0', 'y']
			}
		});
		assert.deepStrictEqual(parseInput(['(', 'x']), {
			status: 'complete',
			command: {
				sequence: '(x',
				action: 'textObjectOperation',
				args: ['(', '8', 'x']
			}
		});
		assert.deepStrictEqual(parseInput(['{', 'p']), {
			status: 'complete',
			command: {
				sequence: '{p',
				action: 'textObjectOperation',
				args: ['{', '9', 'p']
			}
		});
	});

	test('parses specialized text objects with explicit registers', () => {
		assert.deepStrictEqual(parseInput(['"', ' ', '3', 'y']), {
			status: 'complete',
			command: {
				sequence: '" 3y',
				action: 'textObjectOperation',
				args: ['"', '3', 'y']
			}
		});
		assert.deepStrictEqual(parseInput(['(', ' ', '2', 'x']), {
			status: 'complete',
			command: {
				sequence: '( 2x',
				action: 'textObjectOperation',
				args: ['(', '2', 'x']
			}
		});
		assert.deepStrictEqual(parseInput(['{', ' ', '5', 'p']), {
			status: 'complete',
			command: {
				sequence: '{ 5p',
				action: 'textObjectOperation',
				args: ['{', '5', 'p']
			}
		});
	});

	test('swaps p and P semantics', () => {
		assert.deepStrictEqual(parseInput(['p']), {
			status: 'complete',
			command: {
				sequence: 'p',
				action: 'pasteBefore',
				vscodeCommand: 'editor.action.clipboardPasteAction'
			}
		});
		assert.deepStrictEqual(parseInput(['P']), {
			status: 'complete',
			command: {
				sequence: 'P',
				action: 'pasteAfter'
			}
		});
	});

	test('starts shared command input mode for search', () => {
		const state = createInitialState();
		startCommandInput(state, COMMAND_INPUT_KINDS.SEARCH_FORWARD, '/');
		assert.strictEqual(state.rawInputMode, RAW_INPUT_MODES.COMMAND);
		assert.strictEqual(state.commandInputActive, true);
		assert.strictEqual(state.commandInputKind, COMMAND_INPUT_KINDS.SEARCH_FORWARD);
		assert.strictEqual(state.commandPrefix, '/');
		assert.strictEqual(state.searchActive, true);
		assert.strictEqual(state.replaceRuleInputActive, false);
	});

	test('starts shared command input mode for replace rule', () => {
		const state = createInitialState();
		startCommandInput(state, COMMAND_INPUT_KINDS.REPLACE_RULE, '=');
		assert.strictEqual(state.commandInputActive, true);
		assert.strictEqual(state.searchActive, false);
		assert.strictEqual(state.replaceRuleInputActive, true);
		setRawInputMode(state, RAW_INPUT_MODES.NONE);
		assert.strictEqual(state.commandInputActive, false);
		assert.strictEqual(state.commandBuffer, '');
	});

	test('tracks prefix state for count register sequences', () => {
		const state = createInitialState();
		updatePrefixInput(state, '2 2');
		assert.strictEqual(state.prefixInputActive, true);
		assert.strictEqual(state.prefixCount, '2');
		assert.strictEqual(state.prefixRegister, '2');
		assert.strictEqual(state.prefixSeparatorSeen, true);
	});

	test('tracks prefix state for pending operator sequences', () => {
		const state = createInitialState();
		updatePrefixInput(state, 'y');
		assert.strictEqual(state.prefixInputActive, true);
		assert.strictEqual(state.prefixOperator, 'y');
		clearPrefixInput(state);
		assert.strictEqual(state.prefixInputActive, false);
	});
});
