#!/usr/bin/env bash
# Installs the VSL Dashboard skill into Claude Code (~/.claude/skills/vsl-dashboard).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/skill"
DEST="$HOME/.claude/skills/vsl-dashboard"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
echo "Installed the VSL Dashboard skill to $DEST"
echo "Open Claude Code and say: set up the VSL dashboard"
