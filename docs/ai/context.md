# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md); full decision set and build plan: [plan.md](plan.md).

## Current state

- Updated: 2026-11-26
- Built on the home laptop from plan.md section 4, steps 1-10, and pushed to GitHub `main` as one commit on top of the old setup (a normal push, no force). The old setup stays on the branches `old-setup` (`31bf710`) and `ai-setup-port` (`55c4bc8`).
- `node --test`: 40 tests pass (install 6, guard 12, vault 10, report 12).
- Home laptop: installed for Claude Code, Copilot and Kiro; the old setup is gone (step 12 done here before step 11, by the user's choice): `_ai/`, `setup-ui/`, `work/.github/workflows/`, the old repo files and `work/.git` deleted; old generated files and `work/docs/` are in `work/.ai/backup/old-setup-2026-11-26/`; the old Kiro workspace-roots block removed.
- Step 3 check: every rule of the old `work/AGENTS.md` is in `rules/always.md` or a skill, except 3 dropped on purpose: the `home`/`work` profiles (one ask list in the guard), "never a built-in subagent" (built-ins stay on, plan 3.1), "generated from `_ai/`" (the repo replaces it).
- Claude auto-memory preferences moved: replies and the heredoc gotcha to `rules/always.md`; decide before building, deep research, industry-standard and future-proof options to `pplan`; one-file study notes and content-only notes to `obsidian`; no headline numbers to `review`. The old memory files stay on disk, unloaded (`autoMemoryEnabled: false`).

## Open work

| Item | Status | Next action |
|---|---|---|
| Smoke prompts (step 10) | Claude Code done: guard blocked `git push --force`, the new skills loaded, `tester` ran on Haiku 5.5; Copilot and Kiro not run | run the prompts in [smoke.md](smoke.md) in each tool |
| Work laptop (step 11) | not started | clone into `work/`, `node AI-Setup/install.mjs --vault <path>`, Policy Diagnostics; then the step 12 clean-up there (old `_ai/` workspace) |
| Kiro prompts | not checked | the old workspace block allowed everything in `work/`; Kiro now uses only the user-level rules, so it may ask more often |
| `~/.kiro/skills/obsidian` | not checked | listed but unreadable (a broken link?); remove it if it duplicates the `obsidian` skill |
| Remaining checks (plan 5) | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Kiro model IDs, Obsidian Sync of edits made while closed |

## Open questions

- Copilot `claude-*-5.5` model IDs are not in the SDK's static list (2026-11-17): confirm in the model picker at work.
