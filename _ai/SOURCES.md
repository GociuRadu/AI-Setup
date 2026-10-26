# Sources

External origins of core content. Update when a source is added or re-synced.

## External

| Skill(s) | Repository | Version / commit | License | Local changes |
|---|---|---|---|---|
| `ponytail`, `review` | https://github.com/DietrichGebert/ponytail | `main` @ `09c434ab73ca43761c5d8b0c5d341926c2fba710` (fetched 2026-10-19) | MIT, Copyright (c) 2026 DietrichGebert | `ponytail`: default level full, `/ponytail <level>` per chat. `review`: merges upstream review and audit; levels Must fix / Should fix / Nice to have; checklist shared with the `reviewer` agent. Not ported: debt, gain, help, hooks, plugins. |

Ideas adopted without copying text:

| Used in | Source | Adopted |
|---|---|---|
| `data` (Spark performance review) | https://github.com/github/awesome-copilot `spark-performance` agent, `main` @ `d85f762` | evidence-first rule; anti-pattern list |
| `sql` instructions (T-SQL rules) | same repository, `sql-code-review` prompt | `THROW` over `RAISERROR`, no `SELECT *`, no `NOLOCK`, safe dynamic SQL |
| `data` (metadata ingestion) | https://github.com/mrpaulandrew/procfwk `master` @ `f51cb45`; https://learn.microsoft.com/en-us/azure/data-factory/copy-data-tool-metadata-driven | control list, enabled flag, priority, ForEach with one concurrency knob |
| `settings.json`, `block-db-writes` hook | https://code.claude.com/docs/en/permissions, https://code.claude.com/docs/en/hooks (read 2026-10-25) | deny-rule semantics, PreToolUse exit 2 |

## Internal

2026-10-25 rebuild from the previous `projects` setup: agents and skills shortened, one global rules file for home and work, permissions split per setup, `work-overrides.json` and `build-work.mjs` replaced by `build.mjs`, templates `app` and `data-eng` (from project1).
