---
name: python
description: "Use when authoring or reviewing Python code, loaders or notebook exports in any project."
---

# Python

- Follow the [global rules](global.instructions.md). Project-specific Python rules (runtime, interpreter, test commands, gotchas) are in the active project's `docs/ai/project.md`.
- Detect the selected interpreter before local checks. Never silently create or select a virtual environment.
- Large Excel: openpyxl with `read_only=True` and `iter_rows()`; `data_only=True` for cached values (missing caches are not recalculation).
- Keep alphanumeric business keys (for example SAP keys) as strings; do not change matching normalization without evidence.
- Tests are side-effect-free. Never import a module with top-level writes, or run against a connected system, as a test.
