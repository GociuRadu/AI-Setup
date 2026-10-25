# AI Setup

Claude Code setup for a multi-project workspace (`projects`): global rules, an orchestrator skill (`lead`), four Haiku helper agents and domain skills. Real project folders are not versioned here; `work/` holds anonymized copies of the work setup.

| Read | For |
|---|---|
| [HOW-TO-USE.md](HOW-TO-USE.md) | Daily use: start, which skill/agent, where results go, troubleshooting |
| [_ai/README.md](_ai/README.md) | Layout, how the pieces connect, maintenance |
| [_ai/SOURCES.md](_ai/SOURCES.md) | External sources and licenses |
| [work/HOW-TO-USE.md](work/HOW-TO-USE.md), [work/STRUCTURE.md](work/STRUCTURE.md) | Work setup (GitHub Copilot, strict permissions, anonymized) |
| [AGENTS.md](AGENTS.md) | Entrypoint for Copilot, Codex and other agents |
| `_ai/templates/` | Project templates `basic` and `data-eng`; create one with `node _ai/scripts/new-project.mjs` |

Git is the source. `build-work.mjs` writes the Obsidian vault (`Me/Code/Setup`): the same layout as this repo (`.` names as `dot-`), with the generated Copilot files in `work/`; restore either with `work/apply-from-vault.ps1 -Setup personal|work`.

```mermaid
flowchart LR
  U[Request] --> M[Main session<br/>CLAUDE.md + global rules]
  M -->|small task| D[Do it directly]
  M -->|plan, risky path, 5+ files| L[lead skill]
  M -->|workflow| S[analyze / review / bug / data / confluence]
  L --> SC[scout] & W[worker] & T[tester] & R[reviewer]
  S & L --> P[project docs/ai: context, memory, reports]
```
