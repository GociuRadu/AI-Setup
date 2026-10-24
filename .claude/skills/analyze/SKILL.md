---
name: analyze
description: "Explain or document a file, function, folder, flow, tests or technical question (architecture, tests, CI/CD), or save a finding/decision note. Saves a short evidence-based report in the active project. Use for analyze, explain, document, write up; for a defect hunt or audit use review."
argument-hint: "<file, symbol, folder, question, or note topic>"
user-invocable: true
---

# Analyze

Analysis only: no code changes, no connected systems.

1. Resolve the scope and the active project. Read the parts of `project.md` its entrypoint names.
2. Read the implementation, tests and config in scope. Describe stack, structure and data/control flow only as far as evidence supports.
3. Assess what is relevant: tests (what runs vs commented-out vs mocked, gaps), security and privacy, correctness and reliability (edge cases, retries, duplicates, data loss), CI/CD and operations.
4. Ground each finding in `path:line`. Separate facts from hypotheses; label unverified items with what would confirm them.
5. Run only documented, side-effect-free local checks.
6. Save from the [report template](templates/report.md) to `docs/ai/reports/YYYY-MM-DD-analyze-<topic>.md` (update an existing report on the same scope instead). A plain note or decision ("document this") uses the same template with only the sections that apply.
7. Reply: if the user asked a question, answer it in a few lines first; then the report path and what was not checked.
