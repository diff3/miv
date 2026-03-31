#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm hittades inte. Installera Node.js och npm först."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node hittades inte. Installera Node.js först."
  exit 1
fi

if command -v code >/dev/null 2>&1; then
  VS_CODE_CLI="code"
elif command -v code-insiders >/dev/null 2>&1; then
  VS_CODE_CLI="code-insiders"
else
  echo "VS Code CLI hittades inte."
  echo "I VS Code: Command Palette -> Shell Command: Install 'code' command in PATH"
  exit 1
fi

EXTENSION_NAME="$(node -p "require('./package.json').name")"
EXTENSION_VERSION="$(node -p "require('./package.json').version")"
VSIX_FILE="${EXTENSION_NAME}-${EXTENSION_VERSION}.vsix"

echo "Installerar dependencies..."
npm install

echo "Bygger extension..."
npm run compile

echo "Packar VSIX..."
npx @vscode/vsce package

if [[ ! -f "$VSIX_FILE" ]]; then
  echo "Kunde inte hitta paketfilen: $VSIX_FILE"
  exit 1
fi

echo "Installerar $VSIX_FILE i VS Code..."
"$VS_CODE_CLI" --install-extension "$VSIX_FILE" --force

echo "Klart: $VSIX_FILE installerad."
