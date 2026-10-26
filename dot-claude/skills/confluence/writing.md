# Writing Confluence pages

Write like a senior engineer: the reader finds the answer in 30 seconds, and every claim can be checked.

## Before writing

- Name the reader and the one question the page answers. One topic per page; link to other pages instead of copying them.
- Pick the page type; the [template](templates/confluence-page.md) has the sections for each.

| Type | Reader wants | Example |
|---|---|---|
| How-to / Runbook | to do a task safely | rerun a failed load |
| Reference | to look up a fact | parameters, table fields, endpoints |
| Explanation / Design | to understand how and why | data flow of a pipeline |
| Decision | to know what was chosen and why | staging vs direct write |

## Text

- Top of page: the header table (owner, status, last reviewed) and a **TL;DR** of 2-3 sentences: what, for whom, the key outcome.
- Headings are the questions readers ask ("How do I rerun a load?"), not "Overview" or "Misc".
- Short sentences, active voice, one idea per paragraph, at most about 5 lines.
- Concrete: real names, paths, commands, example values. Unknown: `Unknown, to verify with <role>`. Never invent owners, dates, links or numbers.
- Procedures: numbered steps, each with its expected result or check.
- Mark verified vs unverified and the date of the evidence. No secrets or customer data; masked IDs only.

## Tables

- For comparisons, parameters, field contracts, checks, symptom → fix, ownership. Not for prose.
- A header row, 2-6 columns, one fact per cell, units in the header; sort by what readers look up.

## Diagrams

- One diagram when a flow, sequence or dependency has 3+ parts; otherwise none. At most about 12 nodes, left to right, nouns on boxes, verbs on arrows where unclear, one caption line saying what it shows.
- Rendering: reuse the diagram macro the page (or another page the user gave) already uses, such as Mermaid, draw.io or PlantUML, copying its markup exactly. None found: put the Mermaid source in a code block (language `mermaid`) and keep a numbered-steps or table version next to it, so the page reads without the app. Never claim a diagram renders unless the re-read shows the macro.

## Macros (sparingly)

| Need | Macro |
|---|---|
| Status of the page or an item | Status lozenge |
| Warning, prerequisite, risk | Info / Note / Warning panel, at most 1-2 per page |
| Long optional detail (logs, full config) | Expand |
| More than about 4 sections | Table of contents |
| Code, commands, SQL | Code block with its language |

## Before publishing

TL;DR answers the question; every section is needed; each table or diagram earns its place; links point to real pages; nothing is invented; the Write step's counts match.
