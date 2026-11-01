---
name: analyze
description: "Use for analyze, explain, document or write up a file, function, folder, flow, tests or technical question (architecture, CI/CD), or to save a finding or decision note. Not for a defect hunt or audit (use review)."
argument-hint: "<file, symbol, folder, question, or note topic>"
user-invocable: true
---

# Analyze

Analysis only: no code changes, no connected systems.

1. Read the implementation, tests and config in scope. Describe stack, structure and data/control flow only as far as evidence supports.
2. Describe what is relevant as facts: tests (what runs vs commented-out vs mocked, gaps), CI/CD and operations. Risks you notice get one line each; no defect hunt, severity or verdict: that is `review`, so end with `/review <scope>` when risks matter.
3. Ground each fact in `path:line`. Separate facts from hypotheses; label unverified items with what would confirm them.
4. Run only side-effect-free local checks, as the profile allows.
5. Save from the [report template](templates/report.md) to `docs/ai/reports/YYYY-MM-DD-analyze-<topic>.md` (update an existing report on the same scope instead). A note, decision or meeting brief ("document this") uses the same template with only the sections that apply. Style: very simple English, a one-minute summary first, tables over prose, a Mermaid diagram only when it clarifies a flow, **V**/**U** marks instead of hedging, short sections. Tests, when in scope, go into sections 2 to 4 (what runs, what is mocked, gaps).
6. Reply: if the user asked a question, answer it in a few lines first; then the report path and what was not checked.
