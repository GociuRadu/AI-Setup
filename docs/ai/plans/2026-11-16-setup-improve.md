# Plan: improve the AI setup

| Date | Status | Owner |
|---|---|---|
| 2026-11-16 | done, not committed | Claude Code session, branch `ai-setup-port` |

**Goal:** fix what is broken in the setup, integrate Ponytail 5 properly, make replies and reports easier to scan, and keep the words loaded per chat flat or lower.
**Done when:** `node _ai/sync.mjs --check` prints `in sync`; `node --test "_ai/**/*.test.mjs"` passes; a report builds from `_ai/templates/report.md` with 0 `scan:` warnings; each helper returns its documented format on a real brief; words loaded per chat (Claude Code: `AGENTS.md` + `CLAUDE.local.md`) are at most 1,400.

## Context

- Reports cannot be built: [_ai/rules/report.md](../../../_ai/rules/report.md) and the `review` skill call `node _ai/report.mjs`, and `README.md` names `_ai/templates/report.html`; neither file exists and Git history never had them.
- Ponytail was a vendored skill until commit `405c781`; the port dropped it and kept a paraphrase in the Code section of `AGENTS.md`. Upstream is now 5.3.3 (`96608e0`, 2026-10-29) with a new prompt, review and audit.
- `_ai/sync.mjs` sets `CLAUDE_CODE_SUBAGENT_MODEL: haiku` for every chat; helpers `worker`, `reviewer` and `challenger` declare `sonnet`. Verified later: the helper's own model wins (docs order; `reviewer` ran on Sonnet).
- At the start of this plan, helpers did not set `omitClaudeMd` (the 2026-11-02 report measured about 1,290 fewer words per helper start with it).
- `challenger` says "another model family" but runs on Sonnet in Claude Code.
- Words loaded per chat today: Claude Code 1,280 (`AGENTS.md` 1,097 + `CLAUDE.local.md` 183); Kiro 1,355.

## Options: how Ponytail is integrated

| Option | Pros | Cons | Cost / risk |
|---|---|---|---|
| A. Install the upstream plugin (hooks inject its prompt, 6 skills, the band) | Always current, no upkeep | Repeats the Code section of `AGENTS.md` in every chat (about +600 words); Claude Code and Kiro get it by different paths outside `sync.mjs`; third-party hook code runs on every prompt, next to the guard | Higher cost per chat; two sources for the same rules |
| B. Vendor `skills/ponytail` again as a skill in `_ai/skills/` | Upstream text unchanged; loads on demand | Not always on: active only when the skill triggers; still duplicates the Code section | Rules differ between chats with and without the skill |
| C. Merge the Ponytail 5 rules into the Code section of `AGENTS.md`, its review format into `reviewer` and the `review` skill, its debt ledger as a `review` mode; record the source commit in `README.md` | Always on in both tools from one source; about +80 words per chat; no new skill or hook | A manual re-sync when upstream changes | Low; one file to diff against upstream |

**Choice:** C, because the rules must apply to every coding turn in both tools, and one source is the design of this setup.

## Steps

| # | Step | Files | Check | Status |
|---|---|---|---|---|
| 1 | Report renderer with tests | `_ai/report.mjs`, `_ai/report.test.mjs`, `_ai/templates/report.md` | template builds, 0 `scan:` warnings, tests pass | done |
| 2 | Ponytail 5 into core rules; reply rules | `AGENTS.md` | at most 1,400 words per chat | done |
| 3 | Helpers and orchestrator | `_ai/agents/*`, `_ai/sync.mjs` | sync test asserts the generated frontmatter | done |
| 4 | Skills: review (format, debt), delegate loop, plan | `_ai/skills/{review,delegate,plan}/SKILL.md` | `--check` in sync, no broken links | done |
| 5 | Sync also fails on a missing `_ai/...` path named in a source | `_ai/sync.mjs`, `_ai/sync.test.mjs` | test with a missing path fails | done |
| 6 | Retest: unit tests, helper runs, headless scenarios in a sandbox | none | results table in the report | done |
| 7 | Report | `docs/ai/reports/2026-11-16-review-setup.html` | 0 `scan:` warnings | done |

## Challenge

| Objection | Answer | Status |
|---|---|---|
| The +80 words figure is unmeasured and the cap is tight | measured: 1,280 to 1,397 words per chat, under the 1,400 cap | accepted |
| The debt ledger is empty without the `shortcut:` rule | the rule is in the Code section of `AGENTS.md` and in `worker` | accepted |
| The long upstream review format breaks the short-reply rules | chat shows the top 3 numbered findings; the 4-part form lives in report cards | accepted |

## Risks

| Risk | Effect | Mitigation / rollback |
|---|---|---|
| A frontmatter key Claude Code does not know | helper ignores it or fails to load | verify against the docs and a real helper start; `git checkout` the file |
| Rule text changes helper behavior | a helper stops following its format | rerun each helper on a real brief after the change |
