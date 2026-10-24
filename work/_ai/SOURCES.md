# Sources

External and internal origins of core content. Update when a source is added or re-synced.

## External

| Skill(s) | Repository | Version / commit | License | Local changes |
|---|---|---|---|---|
| `ponytail`, `review` | https://github.com/DietrichGebert/ponytail | `main` @ `09c434ab73ca43761c5d8b0c5d341926c2fba710` (fetched 2026-10-19) | MIT, Copyright (c) 2026 DietrichGebert | `ponytail`: level from `ai.config.json`, `/ponytail <level>` per chat. `review` (2026-10-23) merges upstream `ponytail-review` and `ponytail-audit`: no automatic Git, reads `project.md` Review focus, audits saved to `docs/ai/reports/`. Not ported: `ponytail-debt`, `ponytail-gain`, `ponytail-help`, hooks, plugins. |

Ideas adopted without copying text (2026-10-23):

| Used in | Source | Adopted |
|---|---|---|
| `data` (Spark performance review) | https://github.com/github/awesome-copilot `spark-performance` agent, `main` @ `d85f762` | evidence-first rule; anti-pattern list |
| `data` (publish template) | same repository, `sql-code-review` prompt | `THROW` over `RAISERROR`, no `SELECT *`, no `NOLOCK`, safe dynamic SQL |
| `data` (metadata ingestion) | https://github.com/mrpaulandrew/procfwk `master` @ `f51cb45`; https://learn.microsoft.com/en-us/azure/data-factory/copy-data-tool-metadata-driven | control list, enabled flag, priority, ForEach with one concurrency knob |

## Internal

| Content | Origin |
|---|---|
| `data` | 2026-10-23 merge of `data-model` and `data-pipeline` (project1 skills v3.0, 2026-10-15) and `spark-synapse` (from the project1 dataset/BOM notebooks); shared safety, defaults and rules in one `SKILL.md`, knowledge files under `model/`, `pipeline/`, `spark/` |
| `analyze` | Generalized from the project2 analysis/report workflow; also handles general documentation notes |
| `bug`, `confluence`, agent `tester` (was skill `run-tests`) | project1 and project2 skills (kit 1.4), made generic; project1 test-tier details moved to `.github/skills/data/test-tiers.md` |
| Agents `scout`, `worker`, `reviewer`, `lead` | project1 and project2 agents (kit 1.4), generic; `lead` new (2026-10-24: merged with `lead-opus`, runs on the picked model; `implementer` folded into `lead`; helpers on Haiku or GPT-6 Luna) |
| `python`, `sql` instructions | `project1/.github/instructions`, generic |
| Removed | `start-task`, `end-task` (2026-10-19); the separate `document` workflow (general notes use `analyze`, pipeline docs use runbooks/design records), `graphify`, `ponytail-debt`, `templates/common`, `docs/setup-notes.md` (2026-10-23, merged or unused) |
