# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md).

## Current state

- Updated: 2026-11-26. Branch `review-fixes`; CI (Windows `node --test` + gitleaks) green on `24bca62`, later pushes not checked (`gh` not installed).
- `node --test`: all tests pass. `node install.mjs` twice: "nothing to change".
- Home laptop: installed for Claude Code, Copilot and Kiro; the old setup is gone (backup in `work/.ai/backup/old-setup-2026-11-26/`).
- Reports: [setup review](reports/2026-11-26-review-ai-setup.html), [skill and helper evaluation](reports/2026-11-26-analyze-skill-eval.html).

## Open work

| Item | Status | Next action |
|---|---|---|
| Guard gaps (eval) | open | `echo x > .env` (a write) and Gmail MCP `trash_thread`/`label`/`forward` are allowed; add checks with tests |
| Smoke prompts | Claude Code 4/4 pass; Kiro pass; Copilot: rules and skills pass, `tester` model and the guard ask not yet confirmed (this laptop has no Copilot account) | rerun [smoke.md](smoke.md) in Copilot on the work laptop |
| Work laptop | not started | clone into `work/`, `node AI-Setup/install.mjs --vault <path>`, Copilot smoke prompt, run `Developer: Policy Diagnostics` (no server-managed `strictPluginOnlyCustomization`), check Claude 5.5 in the Copilot and Kiro model pickers |
| Missing CLIs | open | install `gh`, `gitleaks` on both laptops |
| Remaining checks | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Obsidian Sync of edits made while closed, `/review` vs `/code-review` precedence in Claude Code |
| Vault notes | open | `Agentic AI Design Patterns` (too long, footnotes) and `Git` (footnotes) fail `vault.mjs check`; `My AI Coding Setup` rewritten and clean |
