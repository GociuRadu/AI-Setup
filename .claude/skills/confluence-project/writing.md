# Writing Confluence pages

The reader finds the answer in 30 seconds, and every claim can be checked. For HTML syntax, `getContentFormatGuide` wins over this file.

## Text

- One topic and one reader question per page; link to other pages instead of copying them.
- Top: the page-info table and a **TL;DR** of 2-3 sentences (what, for whom, the key outcome). Headings are reader questions ("How do I rerun a load?"), at most 3 levels.
- Short sentences, active voice, paragraphs of at most about 5 lines. Real names, paths, commands and example values.
- Unknown: `Unknown, to verify with <role>`. Never invent owners, dates, links, numbers or account IDs; a mention without a real ID is plain text (`[@owner]`).
- Dates as `<time>`, status as a status lozenge, links to pages as inline smart links. Mark what is verified, with the date of the evidence. No secrets or customer data.

## Tables

- 3+ items with the same fields (steps, parameters, options, checks, owners) go in a table; prose is for reasons.
- `<th>` header row, 2-6 columns, first column = what readers look up. One fact per cell, at most about 15 words; units in the header (`Size (GB)`); `N/A` or `Unknown`, never an empty cell; no merged cells.
- Editing: keep every `data-colwidth`, cell color and the column order; add rows instead of reshaping. A panel cannot hold a table.

## Schemas and contracts

Table schema: heading `schema.table`, one line of purpose, the grain ("one row per ..."), then:

| Column | Type | Key | Null | Meaning |
|---|---|---|---|---|
| `order_id` | `INT` | PK | no | One order |
| `customer_id` | `INT` | FK -> `dbo.customer` | no | Who placed it |

Type as in the DDL; Key is PK, FK -> target, UK or empty; Meaning includes the unit or allowed values. After it: indexes, the load (source, schedule, rerun behavior), a link to the DDL file.

API endpoint: heading `METHOD /path`, one line of purpose and the auth scheme (never a token), a `Field | In | Type | Required | Meaning` table (In: path, query, header, body, response), a `Status | When | Body` table, then one short request and response in `language-json` code blocks with fake values.

## Diagrams

Confluence Cloud has no built-in Mermaid or draw.io (both are Marketplace apps), and the MCP cannot upload images.

- Only for a flow, sequence or dependency with 3+ parts: at most about 12 nodes, left to right, nouns on boxes, a one-line caption.
- Default: the page, or another page the user gave, already has a diagram macro: copy its exact extension markup (key, type, parameters) and change only the diagram source.
- Fallback: a `<pre><code class="language-mermaid">` block plus the same flow as numbered steps or a table, so the page reads without an app.
- Never: storage XML (`<ac:structured-macro>` renders as raw text), an image from a public render service (it sends the diagram outside), or "renders" before the re-read shows the macro.

## Macros, sparingly

| Need | Use |
|---|---|
| Warning, prerequisite, risk | info, note or warning panel, at most 2 per page |
| Long optional detail | expand |
| More than about 4 sections | table of contents |
| Code, commands, SQL | code block with its language |

## Page templates

Common top, the block for the page type, common bottom; drop sections that don't apply.

- **Common top:** table `Owner | Status | Last reviewed | System / environment | Related` (Status: Draft, Active or Deprecated), then `## TL;DR`.
- **Overview:** `What is it?` one paragraph. `What are the parts?` table `Part | Does | Owner | Link`. `How do they connect?` diagram and 3-6 lines. `Where do I start?` links.
- **Design:** `What problem does this solve?` context and constraints. `How does it work?` diagram and 3-6 lines. `Data and interfaces:` schemas and contracts, and `Source | Target | Grain | Key | Timing | Rerun behavior`. `How do we know it works?` table `Check | Expected result | Where`. `What does it give up?` bullets.
- **Runbook:** `When do I use this?` the trigger. `Before you start:` access, role, dependencies, never secret values. `Steps:` table `Step | Action | Expected result`. `If it fails:` table `Symptom | Likely cause | Response or escalation`. `Rollback:` how, or "not reversible: <why>".
- **Decision:** `What needs deciding?` context and constraints. `Options:` table `Option | Pros | Cons | Effort`. `Decision:` the option, the main reason, the date, who decided. `Consequences:` what changes, what to watch.
- **Common bottom:** `Open questions:` table `Question | Owner`, or N/A. `References:` code, docs, tickets and run evidence, with the date checked.

Before publishing: the TL;DR answers the question, every section and table earns its place, links are real, nothing is invented, the counts match.
