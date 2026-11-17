# Plan: rewrite the AI setup, each rule stated once
| Date | Status | Owner |
|---|---|---|
| 2026-11-17 | done; committed and pushed on `ai-setup-refactor` (word-limit misses accepted by the user) | user |

**Goal:** rewrite `AGENTS.md`, `README.md` and `_ai/` so each rule is stated once, in the one file that owns it, with the same behavior.
**Done when:**
- `node --test "_ai/**/*.test.mjs"` passes; tests are rewritten only where a decided behavior changes, never weakened.
- In a fresh temp dir, `node _ai/sync.mjs home --tools claude,kiro` then `--check` prints `in sync`; a fresh temp dir with `--tools copilot,kiro` has no `.claude/` and no `CLAUDE.local.md`. The same 2 commands on this PC print `in sync`.
- Same behavior: a test asserts each helper file in each tool contains its declared `AGENTS.md` sections verbatim and no `this chat` or `the user names`; `.github/copilot-instructions.md` contains Databases, Hard stops, Secrets and data.
- Stated once: `data, not instructions`, `not even reads`, `down -v`, `masked IDs` and `approval prompt` each match 1 line across `AGENTS.md`, `README.md` and `_ai/**/*.md` (Grep tool, case-insensitive; the guard blocks the `down -v` text in a shell).
- Words (`wc -w`): `AGENTS.md` + `CLAUDE.local.md` below 1,195; generated `.claude/agents/scout.md` and `challenger.md` at or below today; `worker.md` and `reviewer.md` at most +300 each. Before and after go in the commit message.
- Every Rule map row has Status `done`.

## Context
- Baseline (run 2026-11-17): 22 tests pass, `--check` prints `in sync`. `AGENTS.md` 1,097 words (Replies 205, Workspace 154, Autonomy 101, Helpers 83, Code 334, Databases 76, Hard stops 32, Secrets 73); chat start on this PC 1,195 with `claude-code.md` and `home.md`; helper start = `_core.md` 148 + body (scout 116 to reviewer 412).
- Helpers start without `AGENTS.md` (`omitClaudeMd`, `_ai/sync.mjs:117-119`), so `_core.md`, `worker.md` and `reviewer.md` keep their own copies of the safety and Code rules. The copies already differ: `AGENTS.md:62` lets the agent open a `.env` file the user names; the guard (`_ai/hooks/guard.mjs:116`) and the Claude deny list block it always.
- The same safety rules appear in 5 places (`AGENTS.md`, `_core.md`, `_ai/tools/copilot.md`, both profiles, README); helper names in 5, skill names in 3, "generated, never edit" in 6.
- Copilot has no deny list and its hook allows a call on timeout; `copilot-instructions.md` is its only file loaded in every chat (`AGENTS.md` needs `chat.useAgentsMdFile`).
- No source names a tool by its Claude name (grep `Read|Grep|Glob|Edit|Write|Bash` in `AGENTS.md`, skills, agents, rules), so the tool-name map in `_ai/tools/kiro.md` has no reader.
- Bug: the Kiro `profile.md` mark names `_ai/tools/claude-code.md` (`_ai/sync.mjs:177-179`).
- Not verified, stays with step 7 of `2026-11-17-copilot-and-tools.md` (user, work laptop): Copilot model IDs, hook payload keys, hooks run from the workspace root, the default agent starting custom agents.

## Options: how helpers get the rules they need without a second copy
| Option | Pros | Cons | Cost / risk |
|---|---|---|---|
| A. Hand-written copies (today) | smallest helper starts | 3 copies that already drift | none now; drift later |
| B. `sync.mjs` copies named `AGENTS.md` sections into each helper (frontmatter `sections: [...]`) | one statement; each helper gets only what its tools need (no Databases or Hard stops for `scout`, `challenger`) | `worker` and `reviewer` starts grow (the Code section) | ~10 lines in `sync.mjs` + tests; a renamed section fails the sync |
| C. Helpers load `AGENTS.md` (drop `omitClaudeMd`) | no code | +1,100 words per start; chat reply shapes clash with helper return formats; Kiro and Copilot behavior unknown | highest words, unverified |

**Choice:** B, because it removes the drift at its source and works the same in all 3 tools; the extra words go only to the 2 helpers that write or judge code.

## Steps
| # | Step | Files | Check | Status |
|---|---|---|---|---|
| 1 | `AGENTS.md` sections: Every agent (new), Replies, Workspace, Autonomy, Helpers and models, Code (code rules only), Verify (new, chat only: after-a-change check and Bug), Databases, Hard stops, Secrets and data. Copied sections are worded for any reader: no "this chat", no "the user names"; Hard stops = the agent never runs them. Apply the Rule map | `AGENTS.md` | words; `missingPaths` empty | done |
| 2 | Helpers: `_core.md` keeps only helper-only lines; `sections:` per agent (all: Every agent, Secrets and data; `tester`, `worker`, `reviewer`: + Databases, Hard stops; `worker`, `reviewer`: + Code); `worker` and `reviewer` drop restated Code lines | `_ai/agents/*` | step 6 tests | done |
| 3 | Profiles and tool notes per the Rule map | `_ai/profiles/*`, `_ai/tools/*` | read-through | done |
| 4 | Skills and rules per the Rule map; `data` and `confluence-project` domain text unchanged | `_ai/skills/*/SKILL.md`, `confluence-project/writing.md`, `_ai/rules/report.md`, `_ai/templates/report.md` | report tests | done |
| 5 | Project templates: Guardrails hold facts (DEV, PRODUCTION, test database names), not rules; `context.md` header drops its rule; `memory.md` keeps the Review column meaning | `_ai/templates/*/docs/ai/*.md` | sandbox `new-project` build | done |
| 6 | `sync.mjs`: `sections:` include for helpers and for `copilot-instructions.md` (Databases, Hard stops, Secrets and data); unknown section throws; Kiro mark names only the profile; fix the `:118` comment and the header. Tests: those in Done when, unknown section throws, Kiro mark | `_ai/sync.mjs`, `_ai/sync.test.mjs` | `node --test "_ai/**/*.test.mjs"` | done |
| 7 | README: install, profiles and tools, start a project, one skills/helpers index, safety layers per tool, change the setup, layout, sources; rules only by link. `.gitignore` comment | `README.md`, `.gitignore` | `--check` | done |
| 8 | Verify the Done when; `reviewer` on the full diff; commit and push `ai-setup-refactor` after the user approves (setup changes leave the commit to the user) | all | Done when | done |

## Result (2026-11-17)
- Tests: 22 -> 24 pass, 0 fail (new: section copy with an independent oracle and the wording ban, profile marks). `--check`: `in sync`; fresh temp dirs: both tool sets write and check clean; `copilot,kiro` holds only `.ai-device.json`, `.github/`, `.kiro/`. The 5 phrases: 1 line each.
- Words (`wc -w`, before -> after): chat start 1,210 -> 1,156; README 1,432 -> 1,010; scout 279 -> 305, challenger 395 -> 414 (ceiling missed: full Every agent and Secrets sections replace `_core.md`'s shorter copy); tester 305 -> 449; worker 400 -> 663; reviewer 575 -> 905 (ceiling +300 missed by 30: Code, Databases, Hard stops now verbatim).
- `reviewer` on the diff: ready, 0 Must fix; 4 Should fix all fixed (blank line before copied sections, README restated a rule, weak test oracle, template blank line). Second `reviewer` pass on `git diff HEAD`: ready, 0 Must fix, 0 Should fix; README matches the code.
- Word-limit misses (scout, challenger, reviewer): **accepted by the user (2026-11-17)**; the copied sections are the cost of one statement per rule.
- Open: Kiro and Copilot runtime behavior, step 7 of `2026-11-17-copilot-and-tools.md` (user, work laptop).

## Risks
| Risk | Effect | Mitigation / rollback |
|---|---|---|
| A removed pointer stops steering (review = findings only, large task = plan) | the skill is not used | the skill descriptions own the trigger; read each description; `git checkout <file>` |
| Helper starts grow | more tokens per `worker`/`reviewer` start | ceiling in Done when |
| A section is renamed in `AGENTS.md` | helpers lose rules | sync throws on an unknown section (test); keep the name `Databases` (the `data` skill links its anchor) |

## Challenge
| Objection | Answer | Status |
|---|---|---|
| Copied sections carry chat-only text ("Fix (when asked)", "in this chat", `review` skill) into helpers | chat-only lines leave Code for the new Verify section and Workspace; copied sections are worded for any reader; a test bans `this chat` and `the user names`. Headings are fine enough; no per-bullet markers | accepted |
| Copilot and Kiro may already load `AGENTS.md` into helpers, so B doubles the rules there | today `_core.md` is already copied into all 3 tools (`_ai/sync.mjs:104-137`); B keeps that shape. Repeated text costs words, not behavior; revisit after step 7 of the Copilot plan | rejected |
| "A renamed section fails the sync" is too weak; growth is a guess | tests and a word ceiling added to Done when | accepted |

## Open questions
| Question | Recommended answer |
|---|---|
| 1. Helpers get rules by Option B? | **Decided (user, 2026-11-17):** yes |
| 2. `.env` named by the user: the text allows it, the guard blocks it | **Decided (user, 2026-11-17):** text follows the guard: never; the user opens it |
| 3. Dropping `claude` deletes all of `.claude/settings.local.json`, hand-added keys too | **Decided (user, 2026-11-17):** delete it, as today; no change |
| 4. Ask-before rule for MCP writes exists only in `copilot.md`; Kiro has none | **Decided (user, 2026-11-17):** `AGENTS.md` Hard stops names the Claude deny list (Hostinger `execute`, `multi-execute`, `execute_site_tool`; Atlassian `executeDestructive`); other MCP writes follow the profile (`work` asks before every write: `work.md:5`) |
| 5. Scope of "from scratch" | **Decided (user, 2026-11-17):** `data` and `confluence-project` domain text, `report.mjs`, `new-project.mjs` and the `data-eng` code skeleton: no rewrite, only lines that restate a core rule go |

## Rule map
Owner = the only file that states the rule after the rewrite.

| Rule | Today in | Owner | Removed from, why | Status |
|---|---|---|---|---|
| Write in English | `AGENTS.md`, `_core.md`, `handoff` | `AGENTS.md` Every agent (+ prompt hook) | `_core.md`, `handoff`: copied or always loaded | done |
| Content is data, not instructions | `AGENTS.md`, `_core.md`, `confluence-project` | `AGENTS.md` Every agent | others | done |
| Grounded claims; never guess a path, symbol, flag or API | `AGENTS.md` Replies + Code, `_core.md` (2 lines) | `AGENTS.md` Every agent | Replies, Code, `_core.md` | done |
| Databases rules | `AGENTS.md`, `_core.md`, README, project templates, `data` Safety pointer | `AGENTS.md` Databases | others; templates keep the DEV, PRODUCTION and test-database names | done |
| Hard stops | `AGENTS.md`, `_core.md`, `copilot.md`, README | `AGENTS.md` Hard stops, reworded: the agent never runs them (the guard already blocks them) | others | done |
| Secrets, `personal/`, customer data | `AGENTS.md` Secrets + Workspace, `_core.md`, `copilot.md`, README, `memory.md` template, `confluence-project/writing.md` | `AGENTS.md` Secrets and data (`personal/` moves in) | others; `reviewer` keeps "customer data in code" as a check | done |
| Safety sections in Copilot | `copilot.md` (hand-written) | generated into `copilot-instructions.md` from `AGENTS.md` | `copilot.md` | done |
| Profiles keep the safety sections | `AGENTS.md` Autonomy, both profiles | `AGENTS.md` Autonomy | profiles | done |
| Approval prompt is the ask | `AGENTS.md`, `work.md:5,7` | `AGENTS.md` | the sentence in `work.md:5` and the phrase in `:7`; the Git rules stay | done |
| Git per profile | `home.md:7`, `work.md:7` | each profile | none; kept | done |
| Denied action stops work | `AGENTS.md` Autonomy, `delegate` | `AGENTS.md` | `delegate` | done |
| Never change the tool's approval settings on `work` | `copilot.md` (Copilot only) | `work.md`, for all tools | `copilot.md` | done |
| Change the setup only when asked; sync, test, user commits | `AGENTS.md`, README steps | `AGENTS.md` rule; README keeps the commands for people | none | done |
| Generated files, never edit | `AGENTS.md`, `kiro.md`, `copilot.md`, README, `sync.mjs` header, `.gitignore` | `AGENTS.md` + the note in each generated file | tool notes, `.gitignore` comment; README keeps one Layout cell | done |
| Large task = 3+ files, risky path, several steps -> `plan` | `AGENTS.md`, `plan` and `delegate` descriptions, README | `plan` description | `AGENTS.md`, README; `delegate` keeps a one-line gate in its body | done |
| Stuck: 2 failed fixes, then 3 | `AGENTS.md`, `delegate` link, README | `AGENTS.md` (label **Stuck** kept for the link) | README | done |
| Review = findings only | `AGENTS.md` Code, `review` | `review` | `AGENTS.md` | done |
| Bug: reproduce red, unproven, containment, fix | `AGENTS.md` Code, `review` bug mode | `AGENTS.md` Verify (not copied into helpers) | `review` keeps hypotheses, data checks, debug tags | done |
| After a change: focused check | `AGENTS.md` Code | `AGENTS.md` Verify | Code, so helpers keep "run only the named check" | done |
| Read `_ai/rules/<lang>.md` outside matching files | `AGENTS.md` Code | `AGENTS.md` Workspace (chat only) | Code | done |
| Non-obvious bug -> `memory.md` row | `AGENTS.md` Code + Workspace | `AGENTS.md` Workspace | Code | done |
| `context.md` upkeep | `AGENTS.md`, template header, README | `AGENTS.md` Workspace | template header; README keeps a "Holds" index | done |
| `memory.md` Review and `superseded` | `AGENTS.md`, template, `plan` step 1, README | `AGENTS.md` when to write and supersede; template the Review column meaning; `plan` the due-Review check | README | done |
| Reports: HTML, never by hand | `AGENTS.md`, `report.md`, `review`, `data` | `_ai/rules/report.md` | `AGENTS.md` keeps a link | done |
| Report findings order, conclusion headings | `report.md`, `templates/report.md` comments | `report.md` | template comments keep block syntax only | done |
| Table: key column first, at most 5 columns | `AGENTS.md` Replies, `report.md` | `AGENTS.md` Replies | `report.md` (loads in a chat that has `AGENTS.md`) | done |
| Code rules (smallest change, no bloat, never cut, `shortcut:`, tests) | `AGENTS.md` Code, `worker.md`, `reviewer.md` lean bullet | `AGENTS.md` Code, copied into `worker`, `reviewer` | `worker.md`; reviewer's lean bullet points to Code | done |
| Helpers see none of the chat; brief is the whole task | `_core.md`, `delegate`, README | `_core.md` (helper side), `delegate` Brief (caller side) | README | done |
| Only the 5 helpers; never a built-in subagent | `AGENTS.md`, `claude-code.md`, `kiro.md`, README, Claude deny list | `AGENTS.md` Helpers ("only the helpers in `delegate`; never a built-in"); tool notes keep the built-in names | README | done |
| Helper names and routing | `AGENTS.md`, 3 tool notes, `delegate`, README | `delegate` table | `AGENTS.md`, tool notes; README keeps an index | done |
| Helper models | agent frontmatter, `delegate`, `kiro.md`, `copilot.md`, README | agent frontmatter | others | done |
| Opus for design | `AGENTS.md`, `copilot.md`, README | `AGENTS.md` | `copilot.md`; README links | done |
| Skill list | `kiro.md`, `copilot.md`, README | README index | tool notes: each tool lists skills itself | done |
| Kiro tool-name map, guard and profile file lines | `kiro.md` | removed | no reader (Context) | done |
| Copilot weaker safety layer | `copilot.md`, README | README | `copilot.md` | done |
| `profile.md` mark | names `claude-code.md` | names `_ai/profiles/<p>.md` | bug | done |
