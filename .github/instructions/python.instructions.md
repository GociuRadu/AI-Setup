---
applyTo: "**/*.py"
---
<!-- Generated from .claude/rules/python.md by node _ai/check.mjs --fix; edit the source. -->
# Python rules

- Runtime, interpreter and test commands are in `project.md`. Detect the selected interpreter before checks; never silently create or select a virtual environment.
- Large Excel: openpyxl `read_only=True` with `iter_rows()`; `data_only=True` for cached values (missing caches are not recalculation).
- Keep alphanumeric business keys (SAP keys) as strings; change matching normalization only with evidence.
- Tests are side-effect-free: never import a module with top-level writes or run against a connected system as a test.
