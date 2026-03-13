import type { KeyBindingEntry } from './constants';

export function normalizeKey(key: string): string {
  if (!key) {
    return key;
  }

  return key.toLowerCase();
}

const CHAR_TO_PHYSICAL_KEY_ALIASES: Readonly<Record<string, string>> = {
  '`': 'backquote',
  '§': 'backquote',
  '-': 'minus',
  '_': 'shift+minus',
  '=': 'equal',
  '+': 'shift+equal',
  '\\': 'backslash',
  '|': 'shift+backslash',
  '[': 'bracketleft',
  '{': 'shift+bracketleft',
  ']': 'bracketright',
  '}': 'shift+bracketright',
  ';': 'semicolon',
  ':': 'shift+semicolon',
  '\'': 'quote',
  '"': 'shift+quote',
  ',': 'comma',
  '<': 'shift+comma',
  '.': 'period',
  '>': 'shift+period',
  '/': 'slash',
  '?': 'shift+slash',
  '!': 'shift+digit1',
  '%': 'shift+digit5',
  '&': 'shift+digit7',
  '(': 'shift+digit9'
};

const PHYSICAL_TO_CHAR_KEY_ALIASES: Readonly<Record<string, string[]>> = {
  backquote: ['`', '§'],
  minus: ['-'],
  equal: ['='],
  backslash: ['\\'],
  bracketleft: ['['],
  bracketright: [']'],
  semicolon: [';'],
  quote: ['\''],
  comma: [','],
  period: ['.'],
  slash: ['/'],
  'shift+minus': ['_'],
  'shift+equal': ['+'],
  'shift+backslash': ['|'],
  'shift+bracketleft': ['{'],
  'shift+bracketright': ['}'],
  'shift+semicolon': [':'],
  'shift+quote': ['"'],
  'shift+comma': ['<'],
  'shift+period': ['>'],
  'shift+slash': ['?'],
  'shift+digit1': ['!'],
  'shift+digit5': ['%'],
  'shift+digit7': ['&'],
  'shift+digit9': ['(']
};

function getKeyAliases(key: string): string[] {
  const normalized = normalizeKey(key);
  if (!normalized) {
    return [];
  }

  const aliases = new Set<string>([normalized]);
  const shiftPrefix = 'shift+';
  const base = normalized.startsWith(shiftPrefix) ? normalized.slice(shiftPrefix.length) : normalized;
  const shifted = normalized.startsWith(shiftPrefix);

  if (/^[a-z]$/.test(base)) {
    aliases.add(`${shifted ? 'shift+' : ''}key${base}`);
  } else if (/^[0-9]$/.test(base)) {
    aliases.add(`${shifted ? 'shift+' : ''}digit${base}`);
  }

  const charAlias = CHAR_TO_PHYSICAL_KEY_ALIASES[normalized];
  if (charAlias) {
    aliases.add(charAlias);
  }

  const physicalAliases = PHYSICAL_TO_CHAR_KEY_ALIASES[normalized];
  if (physicalAliases) {
    for (const alias of physicalAliases) {
      aliases.add(alias);
    }
  }

  return [...aliases];
}

export function buildNavKeyMap(entries: readonly KeyBindingEntry[]): Record<string, string> {
  const pairs: Array<[string, string]> = [];
  for (const entry of entries) {
    for (const alias of getKeyAliases(entry.key)) {
      pairs.push([alias, entry.token]);
    }
  }

  return Object.fromEntries(pairs) as Record<string, string>;
}
