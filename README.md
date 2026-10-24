# AI Setup

Claude Code setup for a multi-project workspace (`projects`): global rules, an orchestrator skill (`lead`), four Haiku helper agents and domain skills. Project folders are not versioned here.

| Read | For |
|---|---|
| [HOW-TO-USE.md](HOW-TO-USE.md) | Daily use: start, which skill/agent, where results go, troubleshooting |
| [_ai/README.md](_ai/README.md) | Layout, how the pieces connect, maintenance |
| [_ai/SOURCES.md](_ai/SOURCES.md) | External sources and licenses |
| [work/HOW-TO-USE.md](work/HOW-TO-USE.md), [work/STRUCTURE.md](work/STRUCTURE.md) | Work setup (GitHub Copilot, strict permissions, anonymized) |

```mermaid
flowchart LR
  U[Request] --> M[Main session<br/>CLAUDE.md + global rules]
  M -->|small task| D[Do it directly]
  M -->|3+ files, schema, risky path| L[lead skill]
  M -->|workflow| S[analyze / review / bug / data / confluence]
  L --> SC[scout] & W[worker] & T[tester] & R[reviewer]
  S & L --> P[project docs/ai: context, memory, reports]
```
