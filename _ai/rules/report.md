---
applyTo: "**/docs/ai/reports/**"
---
# Report format

A report is **one HTML file**: `<project>/docs/ai/reports/YYYY-MM-DD-<kind>-<topic>.html` (kind: review, bug, analyze, data, research).
- New: copy `_ai/templates/report.md` to `<same name>.md`, fill it, run `node _ai/report.mjs <file.md>`. It writes the `.html` (with the Markdown source embedded) and deletes the `.md`.
- Update (same scope = same file): `node _ai/report.mjs --edit <file.html>` restores the `.md`; edit it, build again.
- Never write or edit report HTML by hand. Never leave a `.md` next to its `.html`.

Readers scan, they do not read: the first screen must answer the question.
- Order: title, meta table, **Bottom line** (1-2 sentences), headline numbers (2-5, one row), **Decide first**, then finding or question cards, then sections.
- Whole report about 2 screens. Long tables, logs and "not checked" go into `<details><summary>Evidence</summary>`.
- Keep sections unframed; reserve cards for individual findings and questions. Use color for severity, result and the decision, not decoration.
- Headline numbers measure the answer, not the writing process. Keep 2-3 short labels when mobile scanning matters; omit Decide first when no real decision remains.
- Check desktop and mobile in the browser: bottom line, numbers and decision visible first; no page overflow or clipped text. Wide diagrams scroll at readable size.
- Cut restated facts, meta steps ("send this report"), empty sections, options nobody asked about. Every section has a picture: a diagram, a comparison or a table. Paragraphs at most 2 sentences and 50 words.
- `##` headings state the conclusion and its first 2 words carry it (`## The index runs on SDK defaults`, not `## Index` or `## Overview`).
- Limits: bottom line at most 40 words; visible text about 600 words; bold under 20% of the words; tables key column first, at most 5 columns; lists at most 7 items of at most 25 words.
- The build prints `scan:` warnings for these limits (the collapsed Evidence is not counted). Fix every warning before handing off.

Blocks (the renderer keys on these exact shapes; the template shows each one):

| Block | Markdown | Renders as |
|---|---|---|
| Finding | `### High · <statement>` + `- **Problem:**`, `- **Fix:**`, `- **Where:**` | colored card; more than ~6: cards for High/Medium, rest in `\| # \| Sev \| Where \| Problem \| Fix \|` |
| Question | `### Q · <question as sent>` + `- **Context:**`, `- **Proposal:**` | numbered card |
| Graph | ` ```graph ` (or ` ```graph down `), chains `a > [main] > !risk > +new >label> b`; the same text = the same node, so fan-out and joins work | SVG diagram; too wide turns top-down by itself |
| Flow | ` ```flow `, one independent `Label: a > b > c` chain per line | one SVG lane per line |
| Bars | ` ```bars `, `Label: 123` per line, optional `# note` | horizontal bar chart (funnels, counts per stage) |
| Before / after | ` ```compare `, `Today: x; y` and `After: x; y` | side-by-side columns |
| Calls | ` ```seq `, `A > B: message` per line | interaction rows |
| Files | ` ```tree `, indented paths, `+` new, `~` changed, `!` risk, `# note` | file tree |
| Steps | `1. ...` numbered list | numbered timeline |
| Status cell | a cell that is exactly `yes`, `no`, `done`, `open`, `in scope`, `struck out`, `blocked`, ... | colored chip |

Rules:
- Severity: High = wrong or lost data, security, outage with no workaround; Medium = degraded, workaround exists; Low = minor.
- One fact per table row with evidence (`path:line`, URL, command). Unverified: `**U**` and what would confirm it.
- Finding tables label the severity column `Sev` or `Severity`; words such as high and medium in other columns are ordinary values.
- Diagrams only through the blocks above, not Mermaid.
- Sentence case, digits for numbers.
- Next steps: `| # | Action | Needs |`, real work only, smallest first.
