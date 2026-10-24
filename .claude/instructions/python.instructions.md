---
name: python
description: "Use when authoring or reviewing Python code, loaders or notebook exports in any project."
---

# Python

- Follow the [global rules](global.instructions.md). Project-specific Python rules (runtime, interpreter, test commands, gotchas) are in the active project's `docs/ai/project.md`.
- Detect the selected interpreter before local checks. Never silently create or select a virtual environment.
- Reuse the nearest existing pattern.
- Notebook exports: keep cell banners; `%pip` and `%run` in dedicated cells. Do not execute an export to syntax-check it.
- Large Excel: openpyxl with `read_only=True` and `iter_rows()`; `data_only=True` for cached values (missing caches are not recalculation).
- Loads are rerun-safe; destructive reload or sync-delete is explicit.
- Authored checks validate row counts, non-null keys, uniqueness and expected columns. Assert cardinality after joins that can fan out.
- Keep alphanumeric business keys (for example SAP keys) as strings; do not change matching normalization without evidence.
- No embedded credentials or printed tokens; use approved secret references.
- Tests are side-effect-free. Never import a module with top-level writes, or run against a connected system, as a test. Local test containers are the only database a test may reach.
