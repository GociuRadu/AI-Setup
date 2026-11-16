# Plan: refactor the AI setup from zero

| Date | Status | Owner |
|---|---|---|
| 2026-11-16 | done | Claude Code session (Fable), branch `ai-setup-refactor` |

**Goal:** make the setup as short and simple as it can be without losing behavior or safety.
**Done when:** every kept file and rule has a reason in the Inventory below; words per chat and per helper start are below the baseline (1,397; 274 to 574); `node _ai/sync.mjs --check` prints `in sync`; `node --test "_ai/**/*.test.mjs"` passes; the 8 sandbox scenarios pass after the change as they did before it.

## Context

- Baseline, measured before any edit: 1,397 words per chat (`AGENTS.md` 1,214 + `CLAUDE.local.md` 183); helper start 274 (`scout`) to 574 (`reviewer`); 18 of 18 tests; 8 of 8 scenarios, 1.16 USD.
- Two extra probes, baseline: S10 (`/data` table review) passes; S9 (Romanian prompt) is weak: the reply came in Romanian first, then English, with the hook and the rule both active.
- `TodoWrite` is a dead name: the docs say it is "Disabled by default in favor of `TaskCreate`..." and the baseline `orchestrator` session listed the tools `Read, Grep, Glob, Edit, Write, Task, Skill` only.
- `CLAUDE.local.md` names a `**Run:**` label that no rule defines, and repeats what the harness already lists (skills, model names, guards).
- `_ai/rules/report.md` (705 words) repeats the block syntax that `_ai/templates/report.md` shows and the limits that `_ai/report.mjs` prints as `scan:` warnings.
- Docs rule used for every deletion: "Could it find this by reading the code? Would it actually go and look? If both are yes, leave it out" (code.claude.com/docs/en/best-practices).
- Candidate run in the sandbox (bug method moved to the `review` skill, `context.md` rule scoped, tool file cut, report rule cut): S1, S2, S3, S9 pass.

## Options: the `context.md` rule the agent does not follow

Today: "After a change: ... update `context.md`". In S3 the agent leaves the file alone and says so, because a 1-line fix changes no state or open work.

| Option | Pros | Cons | Cost / risk |
|---|---|---|---|
| A. Stop hook that blocks the end of a turn when project code changed and `context.md` did not | enforced | forces an edit after every small fix, so the file fills with noise; new hook code and tests; Kiro needs its own wiring | highest; a second fail-closed hook on every turn end |
| B. Drop the rule | shortest | `context.md` goes stale after real state changes; `plan` and `handoff` read it | low cost, medium risk |
| C. Scope the rule: replace stale lines in the same turn when the change alters the state or open work; never list it as left to do | matches what the file is for; no new code; the agent's S3 judgment becomes the rule | still not enforced; relies on judgment | lowest; proven in the candidate run of S3 |

**Choice:** C, because the baseline behavior is correct for a small fix and the fault is the unscoped wording, not missing enforcement.

## Steps

| # | Step | Files | Check | Status |
|---|---|---|---|---|
| 1 | Core rules: compress wording, move the bug method and review scope to `review`, scope `context.md`, drop the docs list and Mermaid | `AGENTS.md`, `_ai/tools/claude-code.md`, `_ai/profiles/home.md` | sync, tests, S2, S3, S9 | done |
| 2 | Agents: shorter helper core and helper prompts, no `todo` tool | `_ai/agents/*` | sync test, S4, S6, S7, S8 | done |
| 3 | Skills: `review` takes the bug method and scope; shorter `delegate` and `plan`; `data` description and one pointer | `_ai/skills/{review,delegate,plan,data}/` | S1, S5, S8, S10 | done |
| 4 | Report rule: keep what the build cannot check; block syntax stays in the template | `_ai/rules/report.md`, `_ai/templates/report.md` | report tests, S1 | done |
| 5 | Sync and hooks: language reminder as an inline command (delete `lang.mjs`), drop `todo`, fix a stale comment | `_ai/sync.mjs`, `_ai/sync.test.mjs`, `_ai/hooks/` | tests, `reviewer`, S9 | done |
| 6 | Templates follow the new rules; `README.md` needed no change | `_ai/templates/*/docs/ai/project.md` | `--check`, sandbox build | done |
| 7 | All 8 scenarios again, then the report | `docs/ai/reports/` | 0 `scan:` lines | done |

## Risks

| Risk | Effect | Mitigation / rollback |
|---|---|---|
| A compressed rule stops steering | a scenario fails | rerun the covering scenario after each group; `git checkout` the file |
| Rules with no scenario (reply style, Kiro) change behavior unseen | style drift | wording kept, only shortened; named under Not checked in the report |
| `data` and `confluence-project` have no test | a cut loses domain knowledge | no content cut there; only the description, one pointer and broken references |

## Inventory

Loaded: **chat** = every chat, **start** = every helper start, **use** = when the skill, rule or script is used. Words are the baseline. "Fails without it" names the test or scenario; `none` = no automated evidence.

### AGENTS.md rules

| Rule | Words | Fails without it | Decision and reason |
|---|---|---|---|
| Reply in English | 38 | S9 (weak) | keep: user writes Romanian |
| Answer first, short | 34 | none | shorten: standing user preference |
| Reply shapes (Answer, Task) | 55 | S3, S4 show the labels | keep |
| Write for scanning; Lists; Smallest visual | 78 | none | merge into 1 line; drop "Mermaid in chat" (rendering unverified) |
| Plain wording, banned words | 40 | none | shorten the word list |
| Grounded claims | 26 | none | keep: guards against invented counts |
| One folder per project, generated folders, `personal/` | 32 | S2, sync tests | keep |
| Active project, read `project.md` | 45 | S3, S4 | keep |
| Project docs list | 60 | none | merge: `context.md` and `memory.md` in 1 line; plans, runbooks, reports live in their skills |
| Device profile | 42 | none | keep: says which profile applies when none loads |
| Approval prompts are the ask | 14 | none | keep: stops double asking on `work` |
| Finish in one turn | 33 | S3 | keep |
| Change the AI setup only when asked | 31 | none | keep |
| Models (Opus only for expensive choices) | 46 | S8 | shorten |
| Delegate; only the 5 helpers | 40 | S4, S8, deny rules | shorten: triggers already in the skill description |
| Large task: plan first | 22 | none | merge into the helpers line |
| Stuck | 19 | none | keep: the stop condition of the task loop |
| Before writing | 52 | none | shorten |
| Smallest complete change | 62 | S3 | keep (Ponytail ladder) |
| No bloat | 48 | S3 | shorten |
| Never cut | 29 | none | keep: safety floor |
| Keep surrounding code; `shortcut:` | 40 | S5 | keep |
| Bug | 112 | S3 | split: red-first fix rule stays, method moves to `review` |
| Review or audit | 45 | S1 | move scope and `reviewer` rule to `review`; 1 line stays |
| Report pointer | 16 | S1 | merge into the two lines above |
| Test rule | 33 | S3 | keep |
| Language rules outside matching files | 15 | none | keep: path rules do not load for SQL in chat |
| After a change | 26 | S3 (not followed) | scope `context.md` (Choice C) |
| Databases (5 rules) | 78 | guard tests, S10 | keep verbatim |
| Hard stops | 35 | S2, guard tests | keep verbatim |
| Secrets and data (4 rules) | 77 | S2, guard tests | keep verbatim |

### Files

| File | Loaded | Words | Fails without it | Decision and reason |
|---|---|---|---|---|
| `_ai/tools/claude-code.md` | chat | 85 | none | shorten to 2 lines: skills, models and guards are listed by the harness |
| `_ai/profiles/home.md`, `work.md` | chat | 83, 142 | none | keep; drop the undefined `**Run:**` label |
| `_ai/tools/kiro.md` | Kiro chat | 142 | none | keep as is: Kiro runtime is not testable here |
| `_ai/agents/_core.md` | start | 158 | S6 | shorten: helpers start without `AGENTS.md`, so safety rules live here |
| `_ai/agents/scout.md`, `tester.md` | start | 116, 142 | S6, S4 | keep |
| `_ai/agents/worker.md` | start | 238 | none | shorten |
| `_ai/agents/reviewer.md` | start | 416 | S7 | shorten |
| `_ai/agents/challenger.md` | start | 237 | this plan | shorten |
| `_ai/agents/orchestrator.md` | session | 134 | S8, sync test | keep; drop the dead `todo` tool |
| `_ai/skills/delegate/SKILL.md` | use | 542 | S8 | shorten: model column folds into the helper column |
| `_ai/skills/plan/SKILL.md` | use | 363 | this plan | shorten: drop the step that repeats the Models rule |
| `_ai/skills/review/SKILL.md` | use | 592 | S1, S5 | keep; takes the bug method and review scope |
| `_ai/skills/handoff/SKILL.md` | use | 231 | S8 | keep |
| `_ai/skills/data/` (14 files) | use, at most 3 sub-files | 16,476 | S10 | keep: domain reference read by need; shorter description; 1 pointer fixed |
| `_ai/skills/confluence-project/` (2 files) | use | 1,389 | none | keep as is: needs a real page to test |
| `_ai/rules/python.md`, `sql.md` | use (matching file) | 81, 127 | none | keep: project conventions the code cannot show |
| `_ai/rules/report.md` | use | 705 | S1 | shorten to what the build cannot check |
| `_ai/templates/report.md` | use | 394 | report test, S1 | keep: the one place that shows every block |
| `_ai/report.mjs`, `report.test.mjs` | use | 3,081, 657 | 12 tests, S1 | keep |
| `_ai/hooks/guard.mjs`, `guard.test.mjs` | every tool call | 1,109, 995 | guard test, S2 | keep; fix 1 stale comment |
| `_ai/hooks/lang.mjs` | every prompt | 42 | S9 | delete the file: the reminder becomes an inline command |
| `_ai/sync.mjs`, `sync.test.mjs` | setup change | 1,579, 208 | 5 tests | keep; drop `todo`, 1 hook form |
| `_ai/new-project.mjs` | new project | 296 | sandbox build | keep |
| `_ai/templates/common/`, `app/` | new project | 390 | sandbox build | keep; `context.md` line follows Choice C |
| `_ai/templates/data-eng/` (24 files) | new project | 3,705 | none (needs Docker in WSL) | keep as is |
| `README.md` | people | 520 | `--check` (paths) | keep: still accurate |

## Challenge

| Objection | Answer | Status |
|---|---|---|
| "Alters the state" is a judgment call with no cue; only the no-update case (S3) is proven | wording now names the triggers (a task starts, finishes or blocks, a decision changes the state); new scenario S11 tests the positive case | accepted |
| Two owners: the Code bullet and `plan` step 6 both write `context.md` | the rule lives once, in the Workspace section; `plan` only links the active plan, which is such a state change | accepted |
| A soft reminder from `_ai/report.mjs` was not weighed | only worth it if S11 fails | rejected: S11 passed |

## Open questions

| Question | Recommended answer |
|---|---|
| Run the scenarios in Kiro (`kiro-cli` 2.37.1 is installed)? | Yes, as a separate task: it spends Kiro credits |
