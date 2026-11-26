# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md); full decision set and build plan: [plan.md](plan.md).

## Current state

- Updated: 2026-11-26
- Built on the home laptop from plan.md section 4, steps 1-10; the repo is local only (`work/AI-Setup`, no GitHub remote yet).
- `node --test`: 40 tests pass (install 6, guard 12, vault 10, report 12).
- Installed on the home laptop for Claude Code, Copilot and Kiro; the old setup's generated files were removed first (regenerable with `node _ai/sync.mjs`).
- Step 3 check: every rule of the old `work/AGENTS.md` is in `rules/always.md` or a skill, except 3 dropped on purpose: the `home`/`work` profiles (one ask list in the guard), "never a built-in subagent" (built-ins stay on, plan 3.1), "generated from `_ai/`" (the repo replaces it).
- Claude auto-memory preferences moved: replies and the heredoc gotcha to `rules/always.md`; decide before building, deep research, industry-standard and future-proof options to `pplan`; one-file study notes and content-only notes to `obsidian`; no headline numbers to `review`. The old memory files stay on disk, unloaded (`autoMemoryEnabled: false`).

## Open work

| Item | Status | Next action |
|---|---|---|
| GitHub repo `GociuRadu/AI-Setup` | waiting on the user | create it private, then `git remote add origin ...` and `git push -u origin main` (`gh` is not installed here) |
| Smoke prompts (step 10) | Claude Code done: guard blocked `git push --force`, the new skills loaded, `tester` ran on Haiku 5.5; Copilot and Kiro not run | run the 3 prompts in docs/ai/smoke.md in each tool |
| Work laptop (step 11) | not started | clone, `node AI-Setup/install.mjs --vault <path>`, Policy Diagnostics, then steps 4, 6, 8, 10 checks there |
| Clean-up (step 12) | blocked by step 11 | retire `_ai/`, `setup-ui/`, `work/.github/workflows/`, `work/.git`, stale generated files, the old Kiro workspace-roots block |
| Remaining checks (plan 5) | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Kiro model IDs, Obsidian Sync of edits made while closed |

## Open questions

- Copilot `claude-*-5.5` model IDs are not in the SDK's static list (2026-11-17): confirm in the model picker at work.
