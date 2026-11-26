# Report format

A report is one HTML file, `<project>/docs/ai/reports/YYYY-MM-DD-<kind>-<topic>.html` (kind: review, bug, analyze, data, research), built from Markdown. Never write or edit the HTML by hand; never leave a `.md` next to its `.html`.
- New: copy [report-template.md](report-template.md) (it shows every block) to `<same name>.md`, fill it, run `node <skill dir>/scripts/report.mjs <file.md>`. Fix every `scan:` warning it prints and build again; a clean build deletes the `.md`.
- Update (same scope = same file): `node <skill dir>/scripts/report.mjs --edit <file.html>` restores the `.md`; edit it, build again.

Readers scan, they do not read: the first screen must answer the question.
- Order: title, meta table, **Bottom line** (1-2 sentences, at most 40 words), **Decide first** (omit when no real decision remains), finding or question cards, then sections. No table of headline numbers under the Bottom line.
- About 2 screens, 600 visible words. Long tables, logs and "not checked" go into `<details><summary>Evidence</summary>`.
- `##` headings state the conclusion and its first 2 words carry it (`## The index runs on SDK defaults`, not `## Index` or `## Overview`). Every section has a picture: a diagram block, a table or numbered steps. Paragraphs: at most 2 sentences and 50 words.
- Cut restated facts from `context.md`, `memory.md` and plans (link them instead), meta steps, unasked options, and scratch reasoning ("wait: ...").
- Findings: `### High · <statement>` with `**Problem:**`, `**Fix:**`, `**If skipped:**`, `**Where:**`. High = wrong or lost data, security, outage with no workaround; Medium = degraded, workaround exists; Low = minor. More than ~6: cards for High and Medium, the rest in a `| # | Sev | Where | Problem | Fix |` table.
- One fact per table row with evidence (`path:line`, URL, command).
- Diagrams only through the template's blocks (`graph`, `flow`, `bars`, `compare`, `seq`, `tree`), not Mermaid.
- Next steps: `| # | Action | Needs |`, real work only, smallest first.
