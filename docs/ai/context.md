# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md); full decision set and build plan: [plan.md](plan.md).

## Current state

- Updated: 2026-11-26
- Built on the home laptop from plan.md section 4, steps 1-10, and pushed to GitHub `main` as one commit on top of the old setup (a normal push, no force). The old setup stays on the branches `old-setup` (`31bf710`) and `ai-setup-port` (`55c4bc8`).
- `node --test`: 44 tests pass (2026-11-26, after the grade improvements).
- Home laptop: installed for Claude Code, Copilot and Kiro; the old setup is gone (step 12 done here before step 11, by the user's choice): `_ai/`, `setup-ui/`, `work/.github/workflows/`, the old repo files and `work/.git` deleted; old generated files and `work/docs/` are in `work/.ai/backup/old-setup-2026-11-26/`; the old Kiro workspace-roots block removed.
- Step 3 check: every rule of the old `work/AGENTS.md` is in `rules/always.md` or a skill, except 3 dropped on purpose: the `home`/`work` profiles (one ask list in the guard), "never a built-in subagent" (built-ins stay on, plan 3.1), "generated from `_ai/`" (the repo replaces it).
- Claude auto-memory preferences moved: replies and the heredoc gotcha to `rules/always.md`; decide before building, deep research, industry-standard and future-proof options to `pplan`; one-file study notes and content-only notes to `obsidian`; no headline numbers to `review`. The old memory files stay on disk, unloaded (`autoMemoryEnabled: false`).

## Open work

| Item | Status | Next action |
|---|---|---|
| Review fixes | done 2026-11-26: guard blocks input that is not JSON (BOM dropped first) and sees `env`, `NAME=value`, `git -P`/`--flag` and `-uf`; Kiro asks are blocks (memory.md); `install.mjs` backs up user files and writes them via a temp file, writes `rules: []` when empty, reads every valid `rules:` shape, drops the old Kiro block in `~/.kiro/workspace-roots/<hash>/permissions.yaml`, removes broken `~/.kiro/skills` links into `work/`. [Report](reports/2026-11-26-review-ai-setup.html) | done: low findings 6-8 and 11 fixed too; then the reviewer's grade (7.5/10) improvements: guard checks strings in `python -c`/`node -e` code and inline git aliases, gitleaks job in CI, Claude model set only if the user has not picked one, VS Code settings with comments merged in place, superseded decisions moved to `memory-archive.md`, skill format test. All on branch `review-fixes`, not merged | merge the pull request; check the first CI run (gitleaks scans the whole history) |
| Smoke prompts (step 10) | Claude Code: 4/4 pass; the `git push` ask prompt not confirmed by the user. Kiro: rules, 4 skills and `tester` pass (model ID not reported); `git push` ran unprompted before the fix (guard asked, Kiro approved it itself); after the fix a Kiro chat got "Blocked in Kiro: git push requires approval" and the push did not run (2026-11-26): pass. Copilot not run | Copilot smoke test |
| `~/.kiro/skills` | done 2026-11-26: 3 broken junctions removed by hand; the install now does it | none |
| Work laptop (step 11) | not started | clone into `work/`, `node AI-Setup/install.mjs --vault <path>` (now also clears the old Kiro workspace block and broken skill links), Policy Diagnostics; then the step 12 clean-up there (old `_ai/` workspace) |
| Kiro prompts | not checked | the old workspace block allowed everything in `work/`; Kiro now uses only the user-level rules, so it may ask more often |
| Remaining checks (plan 5) | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Kiro model IDs, Obsidian Sync of edits made while closed |

## Open questions

- Copilot `claude-*-5.5` model IDs are not in the SDK's static list (2026-11-17): confirm in the model picker at work.
