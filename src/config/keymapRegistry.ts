import * as fs from 'fs';
import * as path from 'path';
import {
  DIGIT_KEYS,
  isDigitKey,
  KeyBindingEntry,
  TOKENS,
  type Token
} from './constants';
import { buildNavKeyMap } from './keyAliases';

export function loadKeymapFile(filePath: string): KeyBindingEntry[] | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) {
      return null;
    }

    const result: KeyBindingEntry[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const key = (entry as { key?: unknown }).key;
      const tokenName = (entry as { token?: unknown }).token;
      if (typeof key !== 'string' || typeof tokenName !== 'string') {
        continue;
      }

      if (Object.hasOwn(TOKENS, tokenName)) {
        result.push({
          key,
          token: TOKENS[tokenName as keyof typeof TOKENS]
        });
        continue;
      }

      if (isDigitKey(tokenName)) {
        result.push({ key, token: tokenName });
        continue;
      }

      console.warn(`Invalid token in keymap: ${tokenName}`);
    }

    return result;
  } catch {
    return null;
  }
}

export function loadKeymapDirectory(dir: string): Record<string, KeyBindingEntry[]> {
  const result: Record<string, KeyBindingEntry[]> = {};
  if (!fs.existsSync(dir)) {
    return result;
  }

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (!file.toLowerCase().endsWith('.json')) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      continue;
    }

    const name = file.replace('.json', '');
    const map = loadKeymapFile(fullPath);
    if (map) {
      result[name] = map;
    }
  }

  return result;
}

function loadKeymapJson(name: string): KeyBindingEntry[] | null {
  return loadKeymapFile(path.join(__dirname, '..', '..', 'keymaps', `${name}.json`));
}

export const NAV_KEY_BINDINGS = loadKeymapJson('default') ?? [];

const DEFAULT_KEYMAP_DIR = path.join(__dirname, '..', '..', 'keymaps');
const DEFAULT_USER_KEYMAP_DIR = path.join(DEFAULT_KEYMAP_DIR, 'user');

export let KEYMAP_PROFILES: Record<string, readonly KeyBindingEntry[]> = {
  ...loadKeymapDirectory(DEFAULT_KEYMAP_DIR),
  ...loadKeymapDirectory(DEFAULT_USER_KEYMAP_DIR),
  default: loadKeymapDirectory(DEFAULT_KEYMAP_DIR).default ?? NAV_KEY_BINDINGS
};

export type KeymapProfileName = keyof typeof KEYMAP_PROFILES;

export let ACTIVE_KEYMAP_NAME = 'default' as KeymapProfileName | string;
export let ACTIVE_KEYMAP: readonly KeyBindingEntry[] = KEYMAP_PROFILES[ACTIVE_KEYMAP_NAME];

export let NAV_KEY_MAP = buildNavKeyMap(ACTIVE_KEYMAP);

export let NAV_INPUT_KEY_SET: ReadonlySet<string> = new Set(
  ACTIVE_KEYMAP.map((entry) => entry.token)
);

export function isKeymapProfileName(value: string): value is KeymapProfileName {
  return Object.hasOwn(KEYMAP_PROFILES, value);
}

export function refreshKeymapProfiles(keymapDir = DEFAULT_KEYMAP_DIR, userKeymapDir = DEFAULT_USER_KEYMAP_DIR): void {
  const builtinKeymaps = loadKeymapDirectory(keymapDir);
  const userKeymaps = loadKeymapDirectory(userKeymapDir);

  KEYMAP_PROFILES = {
    ...builtinKeymaps,
    ...userKeymaps,
    default: builtinKeymaps.default ?? NAV_KEY_BINDINGS
  };

  setActiveKeymapName(ACTIVE_KEYMAP_NAME);
}

export function setActiveKeymapName(profileName: string): void {
  if (!KEYMAP_PROFILES[profileName]) {
    profileName = 'default';
  }

  ACTIVE_KEYMAP_NAME = profileName;
  ACTIVE_KEYMAP = KEYMAP_PROFILES[ACTIVE_KEYMAP_NAME];
  NAV_KEY_MAP = buildNavKeyMap(ACTIVE_KEYMAP);
  NAV_INPUT_KEY_SET = new Set(
    ACTIVE_KEYMAP.map((entry) => entry.token)
  );
}
