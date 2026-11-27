# AI Setup

One repo that sets up **Claude Code**, **GitHub Copilot** (VS Code) and **Kiro** to work the same way: the same rules, skills, helper agents and safety guard, installed by one script from one list.

```mermaid
flowchart LR
  S["setup.json<br/>+ rules, skills, agents,<br/>hooks, mcp"] -->|node install.mjs| W["work folder"]
  W --> C["Claude Code"]
  W --> G["Copilot"]
  W --> K["Kiro"]
```

- **One source:** edit this repo, never the generated files. Rerun the install after every `git pull`.
- **One list:** [setup.json](setup.json) names every part, all on; set one to `false` and the next run removes it.
- **Safe by default:** a guard runs before every tool call in all 3 tools; hard stops are blocked, risky actions ask first.

## Contents

[Quick start](#quick-start) · [What you get](#what-you-get) · [Where files go](#where-files-go) · [Configure](#configure) · [Safety](#safety) · [Projects](#projects) · [Maintain](#maintain) · [Credits](#credits)

## Quick start

Needs Git, Node.js 22 or newer, and each tool opened once on the device: the install skips a tool it cannot find, so check the `tools:` line it prints. The install itself uses no npm packages; Kiro's `/playwright` skill needs `npm install -g @playwright/cli`.

```powershell
cd C:\Users\<you>\Desktop\work                       # the folder you open in VS Code and Kiro
git clone https://github.com/GociuRadu/AI-Setup.git
node AI-Setup/install.mjs --vault "C:\path\to\vault"  # first run; later runs need no flags
```

Then open the `work` folder (not a project inside it) and start a new chat in each tool. Claude Code asks once to approve the servers in `.mcp.json`; sign in to Atlassian once per tool when it asks (Kiro: its MCP panel).

| Flag | Does |
|---|---|
| `--dry-run` | Lists every change without making it |
| `--vault <folder>` | The Obsidian vault the `obsidian` skill writes to (an existing vault with its `.obsidian` folder, outside the work folder; else it is left out with a warning); saved for later runs |
| `--work <folder>` | Installs into another folder than the repo's parent |

The install skips tools the device lacks, deletes only files it wrote itself (listed in `work/.ai-device.json`), and moves any other file at a path it needs to `work/.ai/backup/`. A second run changes nothing.

## What you get

### Skills

Type `/<name>`, or describe the task and the matching skill starts.

| Skill | Use it to |
|---|---|
| `/pplan` | Plan before building: it asks the questions that change the design, researches the options, writes one plan file |
| `/review` | Review a change, find a bug's cause, explain code, or list shortcuts (`review`, `bug`, `analyze`, `debt`) |
| `/debate` | Get 2 opposing second opinions on a major decision, then one comparison table |
| `/data` | Design or review data models, DDL, migrations, loads and Spark notebooks |
| `/obsidian` | Write or edit vault notes, bases and canvases; researched study notes in `Learn` |
| `/confluence-project` | Read or update a project's Confluence page |
| `/handoff` | Update `context.md` and print a short brief for a new chat |
| `/improve` | Turn repeated failures into the smallest change to this setup |
| `/playwright` | Kiro only: open, check, search or automate web pages from the shell (needs `playwright-cli`); Claude Code and Copilot use their built-in browser |

### Helpers

The main agent is the only one that writes. Helpers are read-only and run in their own context, several in parallel; they return a short report.

| Helper | Does |
|---|---|
| `tester` | Runs suites, lints and builds; returns counts and the failing lines word for word |
| `researcher` | Searches many files, long logs or the web; returns evidence with paths or URLs |
| `reviewer` | Fresh-eyes review of a risky change against its goal |
| `challenger` | Second opinion on a costly choice; also the 2 voices of `/debate` |

Each helper's model tier and effort are in [setup.json](setup.json).

### Always-on rules

[rules/always.md](rules/always.md), loaded in every chat: replies (answer first, short, plain), honesty (claim only what was read or run), code (smallest complete change), project state, helpers and safety. SQL and Python rules load only for `.sql` and `.py` files.

## Where files go

| Part | Source | Claude Code | Copilot | Kiro |
|---|---|---|---|---|
| Always-on rules | `rules/always.md` | `CLAUDE.md` → `AGENTS.md` | `AGENTS.md` | `AGENTS.md` |
| SQL, Python rules | `rules/sql.md`, `python.md` | `.claude/rules/` | `.github/instructions/` | `.kiro/steering/` |
| Skills | `skills/<name>/` | `.claude/skills/` | `.github/skills/` | `.kiro/skills/` |
| Helpers | `agents/<name>.md` | `.claude/agents/` | `.github/agents/` | `.kiro/agents/` |
| Guard | `hooks/` | `~/.claude/settings.json` | `~/.copilot/hooks/guard.json` | `.kiro/hooks/guard.json` |
| MCP | `mcp/atlassian.json` | `.mcp.json` | `.mcp.json` | `.kiro/settings/mcp.json` |

All paths except `~/` are inside the work folder; the guard and the project templates are copied to `work/.ai/`, and `work/.ignore` keeps `AI-Setup/` and `.playwright-cli/` out of file searches. Outside it, the install changes only its own keys in 3 files the tools require:

| File | Keys |
|---|---|
| `~/.claude/settings.json` | auto mode, the guard hook, deny rules, auto memory off, no Concise output style; the main model (`main` in `setup.json`) and the model of built-in agents (`CLAUDE_CODE_SUBAGENT_MODEL`, `builtins`), each only while you have not set your own |
| VS Code User `settings.json` | hooks on, Copilot ignores `.claude/` files and hooks, local memory off, never-auto-approve rules |
| `~/.kiro/settings/permissions.yaml` | deny rules for secrets, `personal/`, encrypted notes and hard stops |

## Configure

Everything is in [setup.json](setup.json). After a change, rerun `node install.mjs`.

```json
{
  "skills": { "debate": false, "playwright": ["kiro"] }
}
```

`false` removes a part, `true` installs it for all 3 tools, and a list such as `["kiro"]` installs it only there; this works for skills, helpers (`on`) and MCP servers. Claude Code and Copilot share `.mcp.json`, so an MCP server on for one is seen by both; a server of ours that is off for a file is removed from it on every run, even if you add it there by hand.

- **Models:** each helper names a tier; `models` maps the tier to a model ID per tool. A per-device model for one helper: see the `$comment` in `setup.json`.
- **One device without a tool:** add `"tools": { "copilot": false }` to `work/.ai-device.json`; the next run removes that tool's files there only.
- **Built-ins turned off** (`off`), because this setup replaces them: Claude auto memory, Claude's Concise output style, Claude's built-in agents and skills that duplicate ours (`claude-agents`, `claude-settings`: Explore, Plan, simplify, code-review…), claude.ai connectors and synced plugins, Copilot local memory, Copilot reading `.claude/` files, and the retired GitHub and Playwright MCP servers. Kiro's memory is off by default; Copilot's cloud memory is a GitHub account setting. Review the list after vendor updates.

## Safety

| Layer | What it does |
|---|---|
| Guard ([hooks/guard.mjs](hooks/guard.mjs)), all 3 tools | **Blocks** writing SQL, anything on PRODUCTION or staging, force-push, `docker compose down -v`, SSH, Hostinger `execute`, Atlassian `executeDestructive`, `.env` files, the `personal/` folder and encrypted `.mdenc` notes. **Asks** before `git push`, Git that loses uncommitted work, deletes outside the workspace (the vault included) or of a whole project, the vault's `Personal/`, publishing, data loaders, `az`, `kubectl`, `helm`, `terraform`, `gh` merges, deletes and releases, HTTP calls that send data to a host other than localhost, deleting MCP tools and Hostinger changes; in Kiro these are blocked instead, and you run them, because a Kiro allow rule can approve the ask without showing it. If it fails, or its input is not JSON, it blocks. |
| Tool settings | Claude Code auto mode and deny rules; Copilot never-auto-approve rules (Copilot runs a call when a hook times out); Kiro deny rules |
| Rules | The safety section of [rules/always.md](rules/always.md): databases are read-only, every write is a draft with a rollback |

Known limit: the guard reads the command text and file paths, so code that opens its own database connection is not seen.

## Projects

Each project lives in `work/<project>/`, with its Git repo in `<project>/code/` and the AI's notes in `<project>/docs/ai/`:

| File | Holds |
|---|---|
| `project.md` | Stack, commands, DEV and PRODUCTION names; written once |
| `context.md` | Current state and open work, kept up to date by the AI |
| `memory.md` | Decisions and non-obvious bugs |
| `plans/`, `reports/` | Plans from `/pplan`, reports from `/review` |

Missing files are created from [templates/](templates/) (`app` or `data-eng`).

## Maintain

```powershell
node --test           # tests: install, guard, vault checker, report builder
node install.mjs      # apply the change, then start a new chat in each tool
```

- **Rules for changing this repo** (new skill, new guard check): [AGENTS.md](AGENTS.md).
- **Decisions and state:** [docs/ai/memory.md](docs/ai/memory.md), [docs/ai/context.md](docs/ai/context.md); the design record of the rebuild: [docs/ai/plans/2026-11-26-ai-setup-rebuild.md](docs/ai/plans/2026-11-26-ai-setup-rebuild.md); smoke test per tool: [docs/ai/smoke.md](docs/ai/smoke.md).

CI runs `node --test` on Windows and a gitleaks secret scan on every push ([.github/workflows/test.yml](.github/workflows/test.yml)).

## Credits

- The reply rules in `rules/always.md` adapt [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) (MIT): next action first, numbered steps, state each turn, lists of 5 at most.
- Code rules follow [Ponytail](https://github.com/DietrichGebert/ponytail) (MIT); the version last compared is in `docs/ai/memory.md`.
- `skills/obsidian/bases*.md` and `canvas*.md`: [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) `9c9560a` (MIT, Copyright (c) 2026 Steph Ango).
- `skills/playwright/`: [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) `dc5f4d5` (Apache-2.0, see its LICENSE).
- The decision Review column in the `memory.md` template is adapted from [chief-of-staff](https://github.com/alirezarezvani/claude-skills/tree/main/c-level-advisor/skills/chief-of-staff) (MIT).
