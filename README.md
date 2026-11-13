# vidcladeo

- `cartoon-short/` – Remotion project (pinned packages in package-lock.json, Kenney CC0 models in public/bridge/kenney/).
- `skill/` – my edited copy of the MIT `cartoon-3d-short` skill (mromidev/claude-animated-shorts @ e3b817b),
  without references/frames and references/sheets (another creator's images, kept out on purpose).

Restore in a new session:
    cp -r skill ~/.claude/skills/cartoon-3d-short
    cp -r cartoon-short ~/cartoon-short && cd ~/cartoon-short && npm ci
