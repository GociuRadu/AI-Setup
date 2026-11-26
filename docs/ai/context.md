# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md).

## Current state

- Updated: 2026-11-26. `main` = `review-fixes` on GitHub (skill evaluation, duplicate reviews, per-tool lists, Kiro `playwright`); CI (Windows `node --test` + gitleaks) green on `24bca62`, later pushes not checked (`gh` not installed: see the repo's Actions tab).
- `node --test`: all tests pass. `node install.mjs` twice: "nothing to change".
- Home laptop: installed for Claude Code, Copilot and Kiro; the old setup is gone (backup in `work/.ai/backup/old-setup-2026-11-26/`).
- Reports: [setup review](reports/2026-11-26-review-ai-setup.html), [skill and helper evaluation](reports/2026-11-26-analyze-skill-eval.html).

## Open work

| Item | Status | Next action |
|---|---|---|
| Guard gaps (eval) | open | `echo x > .env` (a write) and Gmail MCP `trash_thread`/`label`/`forward` are allowed; add checks with tests |
| Smoke prompts | Claude Code 4/4 pass, step 5 (browser) not run yet; Kiro (2026-11-26): rules, 8 skills (before `playwright`), 4 agents with their models, `tester` run and push block pass, no built-in browser (expected); Copilot: rules and skills pass, `tester` model and the guard ask not yet confirmed (this laptop has no Copilot account) | run step 5 in Claude Code; Copilot is part of the Work laptop row ([smoke.md](smoke.md)) |
| Kiro account leftovers | open | 2 old skills `confluence` and `confluence-learn` sync from the Kiro account (`~/.kiro/cloud-cache/user/config/skills/`) and overlap `confluence-project`: delete them in Kiro's account skills, not in the cache (it resyncs). Atlassian MCP not connected in Kiro: sign in once from Kiro's MCP panel |
| Work laptop | not started | 1 open Claude Code, VS Code (Copilot signed in) and Kiro once; 2 clone into `work/`; 3 `node AI-Setup/install.mjs --dry-run --vault <path>` (tools: all 3, vault set, no warnings); 4 the same without `--dry-run`, twice (2nd: "nothing to change"); 5 `npm install -g @playwright/cli`; 6 new chat in each tool, approve `.mcp.json` in Claude Code, Atlassian sign-in per tool; 7 Kiro: delete the account skills (row above) if it is the same account; 8 `Developer: Policy Diagnostics` (no server-managed `strictPluginOnlyCustomization`), Claude 5.5 in the Copilot and Kiro pickers; 9 [smoke.md](smoke.md) once per tool |
| Optional CLIs | open | `gh` (CI status from the shell) and `gitleaks` (local secret scan; CI runs it anyway): no skill needs them |
| Kiro browser | `playwright` skill installed in `.kiro/skills` only | in a new Kiro chat: "open https://example.com with playwright and quote the title", then one signed-in site with `--persistent --headed` |
| Remaining checks | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Obsidian Sync of edits made while closed, `/review` vs `/code-review` precedence in Claude Code |
| Vault notes | open | `Agentic AI Design Patterns` (too long, footnotes) and `Git` (footnotes) fail `vault.mjs check`; `My AI Coding Setup` rewritten and clean |
