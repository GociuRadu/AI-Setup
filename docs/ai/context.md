# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md).

## Current state

- Updated: 2026-11-27. `main` = `review-fixes` on GitHub (skill evaluation, duplicate reviews, per-tool lists, Kiro `playwright`); CI (Windows `node --test` + gitleaks) green on `24bca62`, later pushes not checked (`gh` not installed: see the repo's Actions tab).
- `node --test`: all tests pass. `node install.mjs` twice: "nothing to change".
- Home laptop (2026-11-27): reinstalled for Claude Code and Kiro only (`.ai-device.json` `tools: { copilot: false }`, new and uncommitted, 41/41 tests); old backups, resume and Hostinger skills, Hostinger MCPs and the Hostinger VS Code extension deleted. Uncommitted: `off.claude-agents` / `off.claude-settings` in `setup.json` turn off duplicate Claude built-ins; `.mcp.json` gets `tools: ["*"]` only with Copilot (Claude Code skipped Atlassian because of it). 42/42 tests.
- Work laptop audits (Copilot, Kiro; 2026-11-27) applied here, uncommitted: guard denies redirect writes into secret files and asks before MCP trash/send/forward; Copilot guard now user-level (`~/.copilot/hooks/guard.json`); our MCP servers removed from `.vscode/mcp.json` and `~/.kiro/settings/mcp.json`; Kiro `agent://` helper line; `obsidian`/`review` descriptions cut. What was not applied and why: memory.md, 2026-11-27.
- Reports: [setup review](reports/2026-11-26-review-ai-setup.html), [skill and helper evaluation](reports/2026-11-26-analyze-skill-eval.html).

## Open work

| Item | Status | Next action |
|---|---|---|
| Smoke prompts | Claude Code 4/4 pass, step 5 (browser) not run yet; Kiro (2026-11-26): rules, 8 skills (before `playwright`), 4 agents with their models, `tester` run and push block pass, no built-in browser (expected); Copilot: rules and skills pass, `tester` model and the guard ask not yet confirmed (this laptop has no Copilot account) | run step 5 in Claude Code; Copilot is part of the Work laptop row ([smoke.md](smoke.md)) |
| Kiro account leftovers | open | 2 old skills `confluence` and `confluence-learn` sync from the Kiro account (`~/.kiro/cloud-cache/user/config/skills/`) and overlap `confluence-project`: delete them in Kiro's account skills, not in the cache (it resyncs). Atlassian MCP not connected in Kiro: sign in once from Kiro's MCP panel |
| Work laptop | installed, audited 2026-11-27 | 1 in `work/AI-Setup`: `git checkout -- setup.json` and delete an untracked `mcp/playwright.json` (Playwright MCP stays off), then `git pull`; 2 `npm install -g @playwright/cli`; 3 `node AI-Setup/install.mjs` twice (2nd: "nothing to change"); 4 delete `github.copilot.chat.cli.customAgents.enabled` from `work/.vscode/settings.json` (no such setting); 5 back up `~/.kiro/settings/permissions.yaml`, then remove the ~110 one-off "always allow" rules and the old `work\code` entry, keeping the install's JSON one-liners; 6 Copilot: `git push` must ask (guard from `~/.copilot/hooks`), also with `<project>/code` opened; then [smoke.md](smoke.md) per tool |
| Optional CLIs | open | `gh` (CI status from the shell) and `gitleaks` (local secret scan; CI runs it anyway): no skill needs them |
| Kiro browser | `playwright` skill installed in `.kiro/skills` only | in a new Kiro chat: "open https://example.com with playwright and quote the title", then one signed-in site with `--persistent --headed` |
| Remaining checks | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Obsidian Sync of edits made while closed, `/review` vs `/code-review` precedence in Claude Code |
| Vault notes | open | `Agentic AI Design Patterns` (too long, footnotes) and `Git` (footnotes) fail `vault.mjs check`; `My AI Coding Setup` rewritten and clean |
