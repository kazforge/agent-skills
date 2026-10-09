#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILLS_SRC="$SCRIPT_DIR/skills"
COMMANDS_SRC="$SCRIPT_DIR/commands"

OPENCODE_DEST="$HOME/.config/opencode/skills"
OPENCODE_COMMAND_DEST="$HOME/.config/opencode/command"
CURSOR_DEST="$HOME/.cursor/skills"
CODEX_DEST="$HOME/.agents/skills"

mkdir -p "$OPENCODE_DEST" "$OPENCODE_COMMAND_DEST" "$CURSOR_DEST" "$CODEX_DEST"

echo "Linking agent skills from $SKILLS_SRC..."

for skill_dir in "$SKILLS_SRC"/*; do
  if [ -d "$skill_dir" ]; then
    skill_name=$(basename "$skill_dir")

    # -n prevents nesting inside existing symlinks.
    ln -sfn "$skill_dir" "$OPENCODE_DEST/$skill_name"
    ln -sfn "$skill_dir" "$CURSOR_DEST/$skill_name"
    ln -sfn "$skill_dir" "$CODEX_DEST/$skill_name"

    echo "  [linked] $skill_name -> OpenCode, Cursor & Codex"
  fi
done

# Slash commands only for OpenCode; Cursor invokes skills via slash command natively
echo "Linking slash commands from $COMMANDS_SRC..."

for cmd_file in "$COMMANDS_SRC"/*.md; do
  [ -f "$cmd_file" ] || continue

  ln -sfn "$cmd_file" "$OPENCODE_COMMAND_DEST/$(basename "$cmd_file")"

  echo "  [linked] $(basename "$cmd_file") -> OpenCode"
done

echo "Done."
