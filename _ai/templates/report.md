<!-- Report skeleton (rules and scan limits: _ai/rules/report.md).
     Copy to <project>/docs/ai/reports/YYYY-MM-DD-<kind>-<topic>.md, fill it, delete unused blocks,
     then run: node _ai/report.mjs <that.md> (writes .html; fix every scan: warning and run again; a clean build deletes the .md). -->
# Analyze: <topic>
| Date | Scope | Status |
|---|---|---|
| YYYY-MM-DD | <what was looked at, 1 line> | <ready / waiting on X / blocked / fixed> |

**Bottom line:** <the answer in 1-2 short sentences>

| <label> | <label> | <label> |
|---|---|---|
| <number> | <number> | <number> |

**Decide first:** <the one decision or question that unblocks the rest, 1 sentence; omit when none remains>

<!-- Findings: one card each, High then Medium then Low. More than ~6: cards for High/Medium, the rest in one table. -->
### High · <the problem, stated as a fact>
- **Problem:** <one concrete case>
- **Fix:** <one sentence>
- **If skipped:** <what happens, one sentence>
- **Where:** [file.py:42](../../../code/path/file.py#L42)

<!-- Questions for someone else (PO, tech lead): one card each, numbered automatically. -->
## Questions for the PO
### Q · <the question, ready to send as written>
- **Context:** <the example or number that makes it concrete>
- **Proposal:** <our recommended answer>

<!-- Headings state the conclusion, not the topic. Prefer a diagram or table over prose. -->
## <Today X happens; after the change Y>
```compare
Today: <fact>; <fact>; <fact>
After: <fact>; <fact>; <fact>
```

<!-- graph: same text = same node (branches, joins). [x] main, !x risk, +x new, >label> on the arrow. Add "down" for top-down. -->
```graph
User > API > [Orchestrator]
[Orchestrator] >Nexus> Engineering > Search
[Orchestrator] >Nexus> Common > !PIM
```

<!-- flow: independent lanes, one chain per line. -->
```flow
Offline: source > [main step] > !risky step
```

<!-- bars: counts per stage, funnels. `Label: number [unit] # note` per line. -->
```bars
All rows: 15879
Kept: 2203 # after filter
```

<!-- seq: `A > B: message` per line. tree: indented paths; + new, ~ changed, ! risk, # note. -->
```seq
Frontend > API: POST /chats
API > Orchestrator: start workflow
```

```tree
code/
  tools/configuration/
    + generate_terms.py # new
  workflows/.../workflow.py
    ~ _render_answer # changed
```

<!-- A cell that is exactly yes, no, done, open, blocked, ... renders as a colored chip. A numbered list renders as a timeline of steps. -->
| Part | What | Where |
|---|---|---|
| <part> | <one fact> | `path:line` |

## Next steps
<!-- Real work only, smallest first. No meta steps (send this report, read this report). -->
| # | Action | Needs |
|---|---|---|
| 1 | <action> | <dependency> |

<details><summary>Evidence</summary>

<long tables, logs, queries, not-checked list>

</details>
