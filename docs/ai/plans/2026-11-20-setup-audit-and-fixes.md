# Plan: AI setup audit and fixes
| Date | Status | Owner |
|---|---|---|
| 2026-11-20 | done | user |

**Goal:** fix the proven Windows PowerShell hook bypass, `.env` search-glob bypass, Copilot `UserPromptSubmit` hook gap, and doc/skill drift across `_ai/` and `README.md`.
**Done when:**
- `_ai/hooks/run-guard.mjs` wraps `guard.mjs` fail-closed (`try { (await import('./guard.mjs')).run(); } catch (e) { ... process.exit(2); }`); `.github/hooks/guard.json` sets `cwd: "."` and `windows: "node _ai/hooks/run-guard.mjs; exit $LASTEXITCODE"` (zero quote characters!). Spawning `powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -Command <windows>` on Windows returns exit code `2` on a blocked payload, `2` when `guard.mjs` is missing, and `0` on an allowed payload (`guard.test.mjs`).
- `checkPaths(args, cwd, root, toolName)` blocks `.env` file globs on `glob` / `includePattern` (and `pattern` only when `toolName` is not a content-grep tool) including `**/*.env`, `**/.env*`, `**/*.env.*`, `{.env,a.txt}` while allowing `{ pattern: 'Load .env file', tool_name: 'Grep' }`, `**/.env.example`, and `**/*.py`; Kiro's `.kiro/hooks/guard.json` and `.kiro/agents/*.json` inline hooks include `grep` and `glob` matchers (`guard.test.mjs`, `sync.test.mjs`).
- `_ai/hooks/lang.mjs` prints JSON `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}` when called with `--json` and plain text otherwise; `.github/hooks/guard.json` registers `UserPromptSubmit` (`command: "node _ai/hooks/lang.mjs --json"`, `cwd: "."`, `timeout: 10`), while Claude Code and Kiro keep plain-stdout `LANG` (`sync.test.mjs`, `README.md:70`).
- `README.md`, `_ai/skills/delegate/SKILL.md`, `_ai/skills/learn/SKILL.md` and `MCDT/docs/ai/context.md` have zero drift (`/pplan`, skill count matches `_ai/skills/*` via test in `sync.test.mjs`, `delegate` fix-round wording matches `AGENTS.md` Stuck, `learn/SKILL.md` reads earlier `learn/<project>/*.md` files, `MCDT/docs/ai/context.md` links `.html`).
- `node _ai/sync.mjs`, `node _ai/sync.mjs --check` (`in sync`), and `node --test "_ai/**/*.test.mjs"` all exit `0`.

## Context
- **Windows PowerShell hook bypass (`_ai/sync.mjs:78`, `.github/hooks/guard.json`):** Verified on this laptop (VS Code 1.147.0 / Copilot Chat 0.75.0): VS Code spawns hook commands on Windows via `powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -Command <cmd>`. PowerShell 5.1 `-Command` converts Node's exit code `2` into `1` unless `; exit $LASTEXITCODE` is appended, and VS Code maps exit `1` to a non-blocking warning (`kind: 3`), ignoring stdout JSON and allowing `.env` and `personal/` reads. Moving the fail-closed loader into `_ai/hooks/run-guard.mjs` removes all nested quotes and lets `.github/hooks/guard.json` set `"windows": "node _ai/hooks/run-guard.mjs; exit $LASTEXITCODE"` with `"cwd": "."`.
- **Secret search-glob bypass (`_ai/hooks/guard.mjs:100-108`, `_ai/hooks/guard.test.mjs:114`, `_ai/sync.mjs:106,136`):** `pathArgs` ignores `includePattern` and `glob` keys, and `guard.test.mjs:114` explicitly allows `{ includePattern: '**/*.env' }`, letting `grep_search` / `Grep` read `.env` contents. Also `.kiro/hooks/guard.json` and `.kiro/agents/*.json` match only `shell`, `read`, `write` — missing Kiro's `grep` and `glob` tools (`_ai/sync.mjs:31`). Note: `Grep` / `grep_search` pass content regex in `pattern` (`query` in Copilot) and file globs in `glob` / `includePattern`, whereas `Glob` / `file_search` pass file globs in `pattern` / `query`.
- **Copilot `UserPromptSubmit` (`_ai/sync.mjs:79,173`, `README.md:70`):** VS Code Copilot supports `UserPromptSubmit` hooks in `.github/hooks/*.json` when stdout is JSON `{"hookSpecificOutput":{"additionalContext":"..."}}` on exit `0`; `_ai/hooks/lang.mjs --json` produces quote-free command wiring on Windows PowerShell.
- **Doc and skill drift:** `README.md:54,83` says `/plan` and `6 skills` (actual: `/pplan`, 7 skills); `_ai/skills/delegate/SKILL.md:38` says "2 fix rounds per step, then Stuck" while `AGENTS.md:37` says "after 2 failed fixes change the approach; after 3, stop"; `_ai/skills/learn/SKILL.md:9` checks `*-learn-*` reports while line 18 writes `learn/<project>/<topic>.md`; `MCDT/docs/ai/context.md:17` links `.md` instead of `.html`.
- **Approval settings (`.vscode/settings.json`):** `_ai/profiles/work.md:8` forbids the agent from changing tool approval settings (`auto-approve, bypass mode, Autopilot`), so `.vscode/settings.json` (`"/.*/": true` and `kiroAgent.agentAutonomy: "Autopilot"`) stays untouched and is flagged to the user.

## Steps
| # | Step | Files | Check | Status |
|---|---|---|---|---|
| 1 | Add `_ai/hooks/run-guard.mjs` (fail-closed dynamic `import('./guard.mjs')`, exit `2` on load error) and `_ai/hooks/lang.mjs` (`--json` for Copilot `additionalContext`, plain text otherwise); update `guard.mjs` (`checkPaths(args, cwd, root, toolName)` checks `glob`/`includePattern`, plus `pattern` when `toolName` is not `Grep`/`grep`, expanding brace groups and normalizing wildcards so `**/*.env`, `**/.env*`, `**/*.env.*`, `{.env,a.txt}` are blocked while `**/.env.example` and Grep content `pattern: '.env'` are allowed) and `guard.test.mjs` (glob cases + Windows `powershell.exe -Command` exit-code `2`/`0`/missing-guard tests) | `_ai/hooks/run-guard.mjs`, `_ai/hooks/lang.mjs`, `_ai/hooks/guard.mjs`, `_ai/hooks/guard.test.mjs` | `node --test _ai/hooks/guard.test.mjs` | done |
| 2 | Update `sync.mjs` and `sync.test.mjs`: wire Copilot `.github/hooks/guard.json` via `_ai/hooks/run-guard.mjs` (`cwd: "."`, `windows: "node _ai/hooks/run-guard.mjs; exit $LASTEXITCODE"`) and `UserPromptSubmit` (`node _ai/hooks/lang.mjs --json`), keep `GUARD` fail-closed for Claude Code and Kiro (`CLAUDE_PROJECT_DIR`), add `grep` and `glob` matchers to `kiroHooks` and `.kiro/agents/*.json`, and add unit tests for Copilot hooks, Kiro matchers, and README skill count / slash names | `_ai/sync.mjs`, `_ai/sync.test.mjs` | `node --test _ai/sync.test.mjs` | done |
| 3 | Fix doc, skill, and link drift: `README.md` (`/pplan`, `7 skills`, Copilot `UserPromptSubmit` hook row), `_ai/skills/delegate/SKILL.md` (align fix rounds with `AGENTS.md` Stuck), `_ai/skills/learn/SKILL.md` (`learn/<project>/*.md`), `MCDT/docs/ai/context.md` (`.html` report link) | `README.md`, `_ai/skills/delegate/SKILL.md`, `_ai/skills/learn/SKILL.md`, `MCDT/docs/ai/context.md` | `node _ai/sync.mjs` then `node _ai/sync.mjs --check` | done |
| 4 | Run `tester` on `node _ai/sync.mjs --check` and `node --test "_ai/**/*.test.mjs"`, then run `reviewer` on all changed files | generated `.github/`, `.kiro/` | `in sync` + all tests green | done |

## Risks
| Risk | Effect | Mitigation / rollback |
|---|---|---|
| `Grep` content regex containing `.env` is mistaken for a file path | Blocks legitimate text search for `.env` mentions in docs/code | Only treat `pattern` as a file glob when `toolName` is not `Grep`/`grep`; `glob` and `includePattern` are always file globs |
| Blocking `.env` globs blocks `.env.example` searches | False-positive deny | Test `**/.env.example` and `**/*.py` in `pathsAllowed` (`EXAMPLE` regex excludes `.example/.sample/.template/.dist`) |

## Open questions
| Question | Recommended answer |
|---|---|
| — | none |
