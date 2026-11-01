# Review of the AI setup, 2026-11-01

Baseline: commit `5b5f34d` on `main`, fresh clone, `node _ai/setup.mjs home`, `node _ai/check.mjs` passes.
Trigger tests ran in Kiro CLI 2.37 (`--v3`, `claude-sonnet-5.5`, headless, home profile) against a throwaway `Demo` project (Python, 4 unit tests, one real bug: the discount divides by 10, plus 12 handler files). Claude Code is not installed on this machine, and Copilot cannot run headless here, so those two tools were checked against their documentation only.

## One-minute summary

- Every chat loads about **1,900 words** of setup text before the first message. `AGENTS.md` is 70% of it (1,354 words).
- Skills trigger well: `bug`, `review` and `data` fired on the right requests, and the small question used nothing. **V**
- `scout` and `reviewer` started when they should. `worker` was correctly skipped, because one command did the 12-file edit (rule in `_ai/orchestration.md`).
- **Failed:** "run the tests" did not start `tester`. The agent then **fixed the bug without being asked**. Cause: two `AGENTS.md` rules (details in Trigger tests).
- **Broken after a Kiro CLI V3 run:** the CLI rewrites `.kiro/agents/*.json` and adds `.bak` files, and then `check.mjs` fails.
- Helper context: a smaller rule set for helpers is only possible in Claude Code. Copilot and Kiro always add the workspace instructions. So no change is proposed (handoff condition: "real in all three tools").

## 1. Inventory

### Loaded in every chat

| File | Words | Claude Code | Copilot | Kiro |
|---|---:|---|---|---|
| `AGENTS.md` | 1,354 | via `CLAUDE.md` `@AGENTS.md` | native | native (seen as "AGENTS.md rule") |
| Adapter | 76 / 116 / 149 | `CLAUDE.md` | `.github/copilot-instructions.md` | `.kiro/steering/kiro.md` |
| Profile (generated) | 96-100 | `CLAUDE.local.md` | `.github/instructions/profile.instructions.md` | `.kiro/steering/profile.md` |
| Skill descriptions (6) | 205 | native | native | `.kiro/skills` wrappers (same text) |
| Helper descriptions (4) | 138 | native | native | `.kiro/agents/*.json` |
| **Total** | **~1,870-1,950** | | | |

MCP tool lists come on top of this. `setup.mjs` reports 10 servers on this machine (9 Hostinger servers in Claude Code, Atlassian in Kiro).

### Loaded on trigger

| File | Words | When | Seen in test |
|---|---:|---|---|
| `_ai/orchestration.md` | 439 | plan, risky path, 5+ files, before any helper | T4, T5, T6 **V** |
| `review` + `reviewer.md` checklist | 463 + 208 | review request | T3 **V** |
| `bug` + template | 346 + 162 | symptom report | T2 **V** |
| `data` | 1,270 | tables, DDL, loads | T4 **V** |
| `data` sub-files | 287-2,552 each, 17,000 total | per the Resources table | T4 read 2 (`platforms`, `model/cases`) **V** |
| `ponytail` | 527 | before any code write | T4, T6 **V** |
| `analyze` + template | 254 + 241 | explain, document | not tested |
| `confluence-project` + 2 files | 537 + 871 | Confluence link | not tested |
| `.kiro/skills/*` wrapper | 72-99 | Kiro, before the real skill | every skill run (small double load) |

### Never loaded by an agent in normal work

`README.md` (1,077), `_ai/*.mjs`, `_ai/hooks/*`, `_ai/profiles/*` (copied by `setup.mjs`), `_ai/templates/*` (copied by `new-project.mjs`).

### Per-chat text that most chats don't need

| Section of `AGENTS.md` | Words | Needed when |
|---|---:|---|
| `## SQL` | 122 | writing or reviewing SQL |
| `## Python` | 76 | writing or testing Python |
| `## Skills` | 39 | already covered: all three tools load the skill descriptions natively |
| docs/ai upkeep and "handoff" (in Workspace and projects) | ~110 | after a change or on "handoff" |
| `## Output locations` | 50 | when writing a file |

The SQL and Python sections are the clearest case: 198 words (15% of `AGENTS.md`) in every chat, needed only for code in those two languages.

## 2. Redundancy

| Rule | Places | Keep | Action |
|---|---|---|---|
| Read ponytail before code | `AGENTS.md` Responses, `AGENTS.md` Skills, `data` Defaults, `bug` step 8, `orchestration` step 4, `worker.md` | `AGENTS.md` Responses (main agent), `worker.md` (helper) | drop the copies in `data`, `bug` and the Skills line |
| Risky path definition | `AGENTS.md` Bigger work, `orchestration.md` line 3 | `AGENTS.md` (it is the trigger) | delete the orchestration line, move "shared or persistent database" into `AGENTS.md` |
| Skill list with triggers | `AGENTS.md` Skills, skill descriptions, `README.md` | skill descriptions | Skills section becomes one line with names only (`check.mjs` still checks the names) |
| scout / tester triggers | `AGENTS.md`, `orchestration.md` table, `tester.md` description | both on purpose: `AGENTS.md` for small tasks, the table for details | keep, but align the wording (see T7) |
| reviewer trigger for DDL/loads | `orchestration.md` table, `data` step 5 | `orchestration.md` | keep `data` step 5 as one link; it fired correctly in T4 |
| Model names | `AGENTS.md`, three adapters, `README.md` | `AGENTS.md` tiers, adapters map IDs | drop "(Haiku 5.5, Sonnet 5.5, Opus 5.5)" from `CLAUDE.md` |
| Databases / secrets | `AGENTS.md`, profiles, `data` Safety, `project.md` template, `README.md` | `AGENTS.md` | the others already link; no action |

The rest is links, not copies. The `README.md` tables are for people and are not loaded.

## 3. Trigger tests

| # | Prompt (short) | Expected | Actual | Result |
|---|---|---|---|---|
| T1 | "what does gross() return for an empty invoice?" | no skill, no helper | read 2 files, ran one `python -c`, 2-sentence answer | **pass** |
| T2 | "net(...) returns 0.00 but should be 90.00. Find out why." | `bug`, report, no code change | `bug` loaded, reproduced, report `Demo/docs/ai/reports/2026-11-01-bug-discount.md`, no code change | **pass** |
| T3 | "Review Demo/code/billing/invoice.py." | `review`, findings in chat, no edit | `review` + reviewer checklist, 5 findings, verdict, no edit | **pass** |
| T4 | DDL for `dbo.Invoice` + CSV loader | `data` (+ ponytail), at most 3 sub-files, `reviewer`, no DB execution | `data`, `ponytail`, 2 sub-files, `reviewer` started, nothing executed on a DB | **pass, 2 issues** |
| T5 | web search: decimal changes in Python 3.13/3.14 | `scout` | read `orchestration.md`, started `scout` (8 web calls) | **pass, 1 issue** |
| T6 | 12 handlers: `getLogger(__name__)` | `worker` (handoff) | one PowerShell command, search count, tests run | **pass per the rule**: `orchestration.md` says "one command if one can do it" before `worker` |
| T7 | "Run the tests in Demo." | `tester`, counts only | ran the tests itself, **then fixed `invoice.py`** and updated `context.md` | **fail** |
| T8 | probe: what does a Kiro helper see | | `scout` had `AGENTS.md`, `kiro.md` and the profile in its context | info, see section 4 |

Issues found:

- **T7, tester skipped.** `AGENTS.md` sends to `tester` only "a test or lint run with long output". "Run the tests" appears only in `orchestration.md`, which the agent doesn't read for a 1-file task. 4 tests have short output, so the agent ran them itself.
- **T7, unasked fix.** `AGENTS.md` Responses says "Fix issues instead of only reporting them". The exceptions name the `tester` helper, but not a test-run request handled by the main agent. The agent saw a failing test and fixed it, and then wrote under **Not done** that the fix went beyond the request.
- **T4, reviewer loaded the `review` skill.** In Kiro the helper can load skills, and the skill description matched. The reviewer then followed the skill's output format ("What this change does", 12 findings) instead of `reviewer.md` (`Verdict:` first line, max 10). That is 463 extra words for each review.
- **T5, scout output too long.** The reply was about 25 lines plus a "Not done" list (limit: 15 lines). The main agent then rewrote it as a table. Haiku in Kiro does not hold the line limit. No change is proposed; the cost is small.
- **Not tested:** `analyze`, `confluence-project`, a plan/design request, `ponytail` levels.

Open points from the handoff:

| Point | Result |
|---|---|
| Agent reads `orchestration.md` before a helper | **V** in Kiro (T4, T5, T6) |
| Agent hands web lookups to `scout` | **V** (T5). Large files: not tested |
| `data` "read only what the task needs" table | **V** (T4: 2 sub-files, platforms + model/cases) |
| Copilot reads `model: haiku` | **U**: still unconfirmed. The VS Code docs list `.claude/agents` as a supported "Claude format" location, but don't say how `model` aliases map |
| `setup.mjs` `[off]` for Claude Code MCP | **U** for the key name: no project in `~/.claude.json` has `disabledMcpServers` yet, so nothing confirms what `/mcp` writes. **Bug found:** Claude stores the same folder under several keys (`C:\Users\radug\Desktop\work` and `C:/Users/radug/Desktop/work`), and `setup.mjs` reads only the first match |

### New defect: Kiro CLI V3 rewrites the agent files

On its first run, Kiro CLI V3 upgrades `.kiro/agents/*.json`. It reorders `tools`, adds `allowedTools`, `permissions` and `kiroUpgrade`, and writes `*.json.bak` next to each file. After that, `check.mjs` fails ("out of date", "no matching source"). `--fix` reverts the files, and the next CLI run upgrades them again. The same will happen in the live setup.

## 4. Helper context

| Tool | What a helper loads | Can it be cut? |
|---|---|---|
| Claude Code | all `CLAUDE.md` levels, so `AGENTS.md` + `CLAUDE.local.md` ([docs](https://code.claude.com/docs/en/sub-agents)) | yes: `omitClaudeMd: true` in the agent file (Claude Code 2.1.271+) |
| Copilot (VS Code) | the agent's instructions are added to the custom instructions ([docs](https://code.visualstudio.com/docs/copilot/customization/custom-agents)) | no documented switch |
| Kiro | `AGENTS.md`, `kiro.md` and the profile (T8, observed) | no known switch |

Cost per helper start: about 1,600 words of rules, of which a helper needs about 300 (Databases, Hard stops, Secrets, Changes). The saving is real only in Claude Code. Doing it there alone would make helper behavior differ per tool, which breaks the "behavior is never per tool" decision. **No change.** Cutting `AGENTS.md` itself (proposal C) lowers the cost for main agents and helpers in all three tools.

## 5. Clone experience

A fresh clone was working in 3 commands (`git clone`, `cd`, `node _ai/setup.mjs home`), and `check.mjs` passed.

- `README.md` names the Node.js 18 requirement only after the install block. Move it above.
- `README.md` doesn't name `node _ai/check.mjs` as the way to confirm the install. Add one line.
- `setup.mjs` output is clear: profile files, MCP list with how to turn servers off, and the Kiro mode.
- The repository's `.gitignore` (`/*` plus exceptions) ignores `docs/`, so this report cannot be committed without an exception.

## 6. Proposed changes (all approved; see section 7)

Words are per chat (always loaded) unless marked.

| # | Change | Files | Per chat |
|---|---|---|---:|
| A | **Fix T7:** `tester` trigger names "run the tests" and full suites; add "a test run" to the no-fix exceptions | `AGENTS.md` | +8 |
| B | Skills section: one line, names only | `AGENTS.md` | -20 |
| C | Move `## SQL` and `## Python` into path-scoped rules: one source `_ai/rules/sql.md` and `python.md`, and `check.mjs --fix` generates `.claude/rules/` (`paths`), `.github/instructions/*.instructions.md` (`applyTo`) and `.kiro/steering/*.md` (`fileMatch`). `data` links the SQL file directly | `AGENTS.md`, `_ai/check.mjs`, `data`, `.gitignore` | **-198** |
| D | `reviewer.md`: "don't load skills; this file is your checklist and format" | `reviewer.md` | 0 (-463 per review) |
| E | `check.mjs`: compare only the keys it owns in `.kiro/agents/*.json`, ignore tool order and keys added by Kiro, ignore `*.bak`; gitignore `.kiro/agents/*.bak` | `_ai/check.mjs`, `.gitignore` | 0 |
| F | `setup.mjs`: merge every `~/.claude.json` project entry that matches the root (case and slash variants) | `_ai/setup.mjs` | 0 |
| G | Redundancy cuts: risky-path line in `orchestration.md`, ponytail copies in `data` and `bug`, model names in `CLAUDE.md` | 4 files | -6 (-35 on trigger) |
| H | README: Node requirement first, `check.mjs` as the last install step | `README.md` | 0 |
| I | `.gitignore`: allow `/docs/` so setup reports can be committed | `.gitignore` | 0 |

A + B + C + G: `AGENTS.md` goes from 1,354 to about 1,150 words, which leaves about 250 words of room under the 1,400 limit.

Risk of C: SQL drafted in chat without a `.sql` or `.py` file in context would not load the rules. The `data` skill covers most SQL work and links the file directly. A plain chat answer with an SQL snippet would lose them.

## Not checked

- Claude Code and Copilot trigger behavior: these tools are not runnable here.
- `analyze`, `confluence-project`, plan or design requests, the `ponytail` levels, the `work` profile.
- Copilot `model: haiku` mapping, and the key that Claude Code `/mcp` writes.
- One run per prompt. Results can vary between runs.

## 7. Applied (all of A-I approved)

| # | What changed | Result |
|---|---|---|
| A | `AGENTS.md`: `tester` trigger names "run the tests" and a full suite; "a test run" added to the no-fix exceptions | re-test T9 **pass**: `tester` started, counts only, no fix |
| B | `AGENTS.md` Skills: one line, names only | `check.mjs` still checks the names |
| C | `## SQL` and `## Python` moved to `.claude/rules/sql.md` and `python.md` (`paths`, read by Claude Code and VS Code). `check.mjs --fix` generates `.kiro/steering/<name>.md` (`fileMatch`) and `.github/instructions/<name>.instructions.md` (`applyTo`, for the Copilot harness). `AGENTS.md` keeps a 35-word `## Code rules` pointer; `data` links the SQL file directly | re-test T10 **pass**: the agent had the SQL rules before writing a `.sql` file. It read the file through the pointer, so this run does not prove that Kiro's `fileMatch` loaded it on its own (**U**) |
| D | `reviewer.md`: "Don't load skills: this file is your checklist and output format" | re-test T11 **pass**: no skill loaded, `Verdict:` first line, 3 findings |
| E | `check.mjs` compares only the keys it writes in `.kiro/agents/*.json` (tool order ignored) and accepts Kiro's `*.json.bak` and `*.json.bak.N`; `.gitignore` ignores them | `check.mjs` passes after Kiro CLI V3 rewrote all four files; a wrong `model` still fails |
| F | `setup.mjs` merges every `~/.claude.json` project entry for the root and removes duplicate rows | output unchanged on this machine (no server is turned off yet) |
| G | removed: the risky-path line and the ponytail note in `orchestration.md`, the ponytail copies in `bug` and `data`, the model names in `CLAUDE.md` | |
| H | `README.md`: Git and Node.js 18 listed before the install block; `node _ai/check.mjs` is the last install step; Layout and Change-the-setup mention `.claude/rules/` | |
| I | `.gitignore`: `!/docs/` so setup reports are versioned | this report is committed |

Words loaded in every chat: `AGENTS.md` 1,354 -> 1,189 (-165), `CLAUDE.md` 76 -> 70. Per chat: -171 in Claude Code, -165 in Copilot and Kiro. The SQL rules (128 words) and Python rules (82 words) now load only with matching files. `_ai/orchestration.md` 439 -> 415.

The four `.kiro/agents/*.json` files are committed in the form Kiro CLI V3 writes. That stops the files from changing on every machine after the first run. `--fix` rewrites a file only when a key it owns differs.

Possible double load: the VS Code Local harness can read both `.claude/rules/` and `.github/instructions/`. In that case the SQL or Python rules appear twice in a chat that touches a matching file. This was chosen over the risk of the Copilot harness getting no rules. Not verified in VS Code.
