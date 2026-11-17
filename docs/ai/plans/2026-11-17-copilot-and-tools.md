# Plan: Copilot target, tool choice per device, no orchestrator
| Date | Status | Owner |
|---|---|---|
| 2026-11-17 | steps 1-6 done; step 7 open (user, work laptop) | user |

**Goal:** the setup works on the work laptop (Copilot + Kiro) and the personal PC (Claude Code + Kiro) from one `_ai/` source, without the `orchestrator` agent.
**Done when:** `node --test "_ai/**/*.test.mjs"` passes with new tests for the Copilot output, tool choice and a Copilot-shaped guard payload; on this PC `node _ai/sync.mjs home --tools claude,kiro` then `--check` prints `in sync` and no `.github/` generated file exists; a test build with `--tools copilot,kiro` has no `.claude/` file and no `CLAUDE.local.md`; on the work laptop Copilot lists the 5 helpers and the guard blocks reading `.env`, reading `personal/` and `git push -f`.

## Context
- `sync.mjs` always builds `.claude/` and `.kiro/` (`_ai/sync.mjs:18`, `:89-153`) and always writes `.claude/settings.local.json` (`:229`); the profile is remembered in `CLAUDE.local.md` (`:181-184`), which a Copilot device does not have.
- Agent sources already use Copilot-style fields (`tools: [read, search, ...]`, `reasoning-effort`). Only `orchestrator.md` uses the `agent` and `skill` tools.
- Copilot (VS Code docs, researched 2026-11-17): `.github/agents/*.agent.md`, `.github/skills/<name>/SKILL.md`, `.github/instructions/*.instructions.md` (`applyTo`), `.github/hooks/*.json` (Preview; PascalCase `PreToolUse` takes the Claude-style payload; deny = exit 2 or `permissionDecision`; timeout = allow), `AGENTS.md` read natively. Copilot also reads `.claude/` (skills, settings hooks): never generate both on one device.
- Claude-side protection = deny rules (`sync.mjs:66-73`) + guard hook + approval mode (`:194-199`). Copilot gets only the guard hook and the rules as text: a weaker layer, stated in `copilot.md` and README.
- Tested 2026-11-17: a Sonnet chat started `orchestrator`, which started `scout`; it is ≈ Opus + `/delegate`, so it goes.
- `.gitignore` `/*` already ignores `.github/` and `.ai-device.json`.

## Decisions (taken with the user)
| # | Decision | Choice |
|---|---|---|
| 1 | Opus for design | Remove `orchestrator`; switch the chat to Opus and use `/plan` or `/delegate` |
| 2 | Copilot support | `sync.mjs` generates Copilot's native files |
| 3 | Tools per device | `--tools <list>`, remembered; `home`/`work` keep deciding approvals only |

## Steps
| # | Step | Files | Check | Status |
|---|---|---|---|---|
| 1 | Remove the orchestrator and its dead code: delete the agent; `helper` flag gone, every agent gets `_core.md` and `omitClaudeMd`; drop the `agent`/`skill` tool mappings; `AGENTS.md:32` becomes "Opus: switch the chat model for design, data models, migrations, interfaces, hard debugging" | `_ai/agents/orchestrator.md`, `sync.mjs:21-24,95-106`, `sync.test.mjs:18-32` (rewrite), `AGENTS.md`, `_ai/tools/claude-code.md`, `_ai/tools/kiro.md`, `handoff/SKILL.md:18`, `README.md` | tests pass; `grep -ri orchestrator AGENTS.md README.md _ai` hits only `templates/report.md` || done: 22 tests pass; grep hits only `templates/report.md` |
| 2 | Device state: `node _ai/sync.mjs [home\|work] [--tools claude,kiro,copilot] [--check]`, stored in `.ai-device.json`; missing file: read the old `CLAUDE.local.md` mark first (tools default `claude,kiro`), else first run needs both; bad JSON fails with a clear message. `MANAGED` becomes per tool; `CLAUDE.local.md`, `.claude/settings.local.json` and `claudeSettings` only when `claude` is selected; switching off a tool removes its generated paths (`settings.local.json` too); `--check` flags them as extra | `sync.mjs`, `sync.test.mjs` | tests: tools filter the output; a deselected tool's files are flagged; old mark migrates || done: tests for tool filter, dropped-tool `extra:`, mark migration, bad JSON |
| 3 | Copilot target, `MANAGED` = `.github/agents`, `.github/skills`, `.github/instructions`, `.github/hooks/guard.json`, `.github/copilot-instructions.md` only (never all of `.github/`): agents → `<name>.agent.md` (name, description, mapped tools, model, `reasoning-effort`, `_core.md` + body); skills; rules → `<name>.instructions.md` with `applyTo`; guard → `hooks/guard.json`; `_ai/tools/copilot.md` + profile → `copilot-instructions.md`. `relink`/`brokenLinks` get a `copilot` → `.github/` mapping | `sync.mjs`, new `_ai/tools/copilot.md`, `sync.test.mjs` | tests: every agent, skill and rule has a Copilot file; no broken links; existing user files under `.github/` survive a sync || done: temp build `copilot,kiro` has only `.ai-device.json`, `.github/`, `.kiro/`; `workflows/` survives (test) |
| 4 | Copilot safety text in `copilot.md`: the guard is the only hard block; ask before any MCP `execute` tool and Hostinger/Atlassian write; `work` = keep Copilot's approvals on (no auto-approve) | `_ai/tools/copilot.md`, README | read-through || done: read-through |
| 5 | Guard: capture one real Copilot `PreToolUse` payload on the laptop (step 7) before trusting the key names; add a test with the Claude-shaped payload Copilot documents; update the `guard.mjs:1` header | `guard.mjs`, `guard.test.mjs` | test: `.env` read denied, exit 2 || done with the 2 documented shapes (`tool_input`, `toolArgs`); real payload: step 7 |
| 6 | Docs: `AGENTS.md:1,16` name `.github/`; README per device (`--tools`, Opus for design, Copilot's weaker safety layer); `.gitignore:9` comment; language reminder on Copilot = `AGENTS.md` only (hook event not documented) | `AGENTS.md`, `README.md`, `.gitignore` | `sync --check` clean || done: `--check` -> in sync |
| 7 | On the work laptop (user): `git pull`, `node _ai/sync.mjs work --tools copilot,kiro`; in Copilot: 5 helpers listed, `/plan` visible, guard blocks `.env`, `personal/` and `git push -f`; paste a hook payload if a block fails | — | user reports | |

## Risks
| Risk | Effect | Mitigation / rollback |
|---|---|---|
| Copilot model IDs unknown (docs show none) | Helpers run on the default model | Map to display names (`Claude Haiku 5.5`, ...), check in step 7, fix the map |
| Copilot hooks are Preview; timeout = allow; payload keys unverified | Guard may not block | Step 7 tests 3 blocks; `copilot.md` states the rules as text |
| Copilot's default agent may not start custom agents as subagents | `/delegate` cannot start helpers | Step 7 checks; fallback: pick the helper from the agent list |
| Switching tools removes generated paths | Lost hand edits | Only generated paths are removed; never all of `.github/` or `.claude/` |

## Open questions
| Question | Recommended answer |
|---|---|
| — | none; all 3 decisions taken |
