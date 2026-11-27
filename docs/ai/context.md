# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md).

## Current state

- Updated: 2026-11-27.
- Git: `main` = `c4dda90` (PR #15: secret scan, GitHub MCP off, guard redesign), CI green. Branch `ci-linux` (pushed): guard `[` crash fix, PATH-proof secret scan (winget folder found, never unset for a missing PATH), `install.mjs --check`, CI on Windows + Linux: open a PR to merge it.
- `node --test`: 44/44 pass on Windows. `node install.mjs --check`: exit 0; secret scan on.
- CI results without `gh`: `https://api.github.com/repos/GociuRadu/AI-Setup/commits/<sha>/check-runs` (public repo); failing tests appear as annotations.
- Home laptop: Claude Code and Kiro only (`.ai-device.json` `tools: { copilot: false }`).
- Reports: [setup review](reports/2026-11-26-review-ai-setup.html), [skill and helper evaluation](reports/2026-11-26-analyze-skill-eval.html).

## Open work

| Item | Status | Next action |
|---|---|---|
| Merge `ci-linux` | pushed, not merged | PR `ci-linux` → `main` on GitHub; local `main` is behind: `git switch main && git pull --ff-only` |
| Secret scan | home laptop on (gitleaks 8.30.1, fake token refused, clean commit passed, 2026-11-27); work laptop off | work laptop: `winget install --id Gitleaks.Gitleaks -e`, restart VS Code, `node AI-Setup/install.mjs` |
| Guard redesign | built 2026-11-27, pushed | set GitHub branch protection on `main` (ruleset: block force pushes, restrict deletions) |
| Smoke prompts | Claude Code 4/4, Kiro passes, Copilot partial | Claude Code: run step 5 (browser); Copilot: on the work laptop ([smoke.md](smoke.md)) |
| Work laptop | installed, audited | 1 `git checkout -- setup.json`, delete untracked `mcp/playwright.json`, `git pull`; 2 `npm install -g @playwright/cli`; 3 `node AI-Setup/install.mjs` twice; 4 remove `github.copilot.chat.cli.customAgents.enabled` from `work/.vscode/settings.json`; 5 back up `~/.kiro/settings/permissions.yaml`, drop the ~110 one-off allow rules and the old `work\code` entry; 6 Copilot: `git reset --hard` must ask, also with `<project>/code` opened |
| Kiro account leftovers | open | delete account skills `confluence` and `confluence-learn` in Kiro (not the cache); sign in to Atlassian from Kiro's MCP panel |
| Kiro browser | skill installed | new Kiro chat: "open https://example.com with playwright and quote the title" |
| Remaining checks | open | Copilot vault writes; Copilot skill discovery with `.claude/skills` off; Obsidian Sync of edits made while closed; `/review` vs `/code-review` in Claude Code |
| Vault notes | open | `Agentic AI Design Patterns` and `Git` fail `vault.mjs check` (length, footnotes) |
| Optional CLI | open | `gh`: no skill needs it |
