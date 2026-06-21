#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CODEX_EXTENSION_HUB_REPO:-https://github.com/Daviddwt/codex-extension-hub.git}"
INSTALL_DIR="${CODEX_EXTENSION_HUB_HOME:-$HOME/codex-extension-hub}"

command -v git >/dev/null 2>&1 || { echo "git is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required. Install Node.js first."; exit 1; }

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating Codex Extension Hub in $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Installing Codex Extension Hub to $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install
npm run scan

cat <<'MSG'

Codex Extension Hub is ready.

Start it with:
  cd "$HOME/codex-extension-hub"
  npm run dev

Then open:
  http://127.0.0.1:5173

Safety note:
  The scanner reads local metadata only. It does not execute Plugin, Skill,
  Hook, or MCP scripts, and it does not upload local extension data.
MSG
