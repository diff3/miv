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

PUBLISHER="$(node -p "require('./package.json').publisher")"
NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"

echo "Förbereder publicering av ${PUBLISHER}.${NAME}@${VERSION}..."
echo "Bygger extension..."
npm run compile

echo "Publicerar till VS Code Marketplace..."
echo "Tips: kör 'npx @vscode/vsce login ${PUBLISHER}' en gång först om du inte redan har loggat in."
npx @vscode/vsce publish

echo "Klart: ${PUBLISHER}.${NAME}@${VERSION} publicerad."
