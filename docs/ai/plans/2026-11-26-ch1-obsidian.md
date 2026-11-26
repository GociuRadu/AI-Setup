# Chapter 1: the Obsidian vault and its bridge

Status: decision set reviewed on 2026-11-26 (1 reviewer, 2 challengers, 1 scout). User, same day: R1 and R2 rejected; R4, R5, R6, R7 accepted; R3 replaced: `Personal` stays open on every device and the user encrypts its content (`.mdenc`). Chapter closed; nothing built. Decisions are recorded in the vault's `AI/memory.md`.

## Decided by the user

1. The GitHub repo is the only source of the setup; each device clones it, then runs the setup.
2. The vault and Obsidian Sync stay as they are; Sync is the only second copy, no Git in the vault.
3. Agents reach the vault as plain files; no Obsidian CLI, MCP server or Local REST API plugin.
4. `/learn` becomes `/obsidian`: same style for every note (study notes in `Learn` about 90%), runs in the main chat, no sources section at the end; web research for a note goes to cheap separate agents once helpers exist.
5. Official skills `obsidian-bases` and `json-canvas` are added; the other 5 are not.
6. `/data` stays as it is.
7. Principle: nothing may cap stronger future models; then best price, context and speed.
8. Vault access: read, write and add anything; reading `.mdenc` is denied; deleting asks.

## Recommended after review (wait for the user)

- R1 Access additions: moving or renaming asks too (agent moves break links); writes to `.obsidian` plugin code (`plugins/**/*.js`, `manifest.json`, `community-plugins.json`) ask (an injected web page could plant code that Sync spreads and every device runs; Meld Encrypt sees passwords); `.mdenc` is denied for writing too (a write destroys the encrypted note).
- R2 Real undo: a scheduled copy of the vault outside Sync (local, no Git). Sync history restores one file at a time and keeps attachments 2 weeks. The delete prompt matches command text only, so `python -c`, `node -e`, `> file` pass it: it is a speed bump, the copy is the undo.
- R3 Work laptop: Copilot only reads the vault (writes outside the workspace not found); `Personal` stays blocked on the work device.
- R4 Rules: `/obsidian` carries the vault rules and loads only on vault work; its description names every vault file type (`.md`, `.base`, `.canvas`) so it fires on plain edits. The vault keeps a short `AGENTS.md` with no `@` imports and a 1-line `CLAUDE.md` (`@AGENTS.md`). A 3-line safety block (no passwords or tokens in notes, `.mdenc`) is always on at user level. The old vault `.claude/` is removed on every device.
- R5 State: vault decisions stay in the vault's `AI/` files; AI setup decisions move to the repo's `docs/ai/`.
- R6 Checker: `vault.mjs check` stays as the sensor, split into rules for every note and rules for `Learn` study notes (picked by `type`); it parses `.canvas` JSON and checks `.base` structure; Obsidian itself is the formula check.
- R7 The 7 rules as the checklist for every decision (goals not steps; only what the model lacks; label skills uplift or preference; load on demand; stable always-on part; checks over instructions; separate agents only for noisy side work).

## Build notes (from the review, for the build)

- `/learn` rules that contradict decisions: footnotes and the `Sources` item (`_ai/skills/learn/notes.md:15,29-31`, `topic.md:32,53`, `vault.mjs:96-99`, `sources.md:3`, `SKILL.md:18,36`): drop them, keep opened sources as the research rule, put a year inline where a fact can age. Picture rule (`notes.md:24-27`, `vault.mjs:147`) contradicts one-file notes with Mermaid: a Mermaid diagram counts.
- The checker sees only `Learn/<name>.md` at depth 1 (`vault.mjs:163`) and forces topic rules (`:134-150`); it flags `Personal/` links (`:79`).
- "Never touch `## In my own words`; add, don't rewrite" becomes a rule for every note (today only `SKILL.md:26`).
- `Books` PDFs are not synced: skip the PDF link check when the file is missing on this device, and never remove such links (`vault.mjs:80,166`). PDFs have no undo in Sync.
- Templates carry `home-*` settings to strip from new notes (vault `AGENTS.md:25`); `reading.css` hides `AGENTS.md`, `AI` and the root lists; Home is custom code in `.obsidian/plugins/home`.
- `Learn.base:19-22` shows `stage`, `project`, `status`, which no template sets.
- Vault `AGENTS.md:23` ("one note per term") contradicts the vault memory (no concept notes).
- Decide where `.canvas` files live and how `Learning map` links them.
- The checker must run from any project: call it by its repo path, read the vault path from the device file, take banned project names from the device, not the workspace (`vault.mjs:159,169`, `SKILL.md:11`).
- The research agents of `/obsidian` get no write tools.

## Not checked

- Whether Sync captures edits made while Obsidian is closed (the app refreshes on outside changes while running: https://obsidian.md/help/Files%20and%20folders/How%20Obsidian%20stores%20data). Test once: edit a throwaway note from a shell, check its version history.
- Copilot writing to a folder of a multi-root workspace; Kiro writes outside the workspace keep their prompt (https://kiro.dev/docs/permissions/).
