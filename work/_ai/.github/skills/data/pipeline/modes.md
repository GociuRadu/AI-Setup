# Modes and records

Load only the section for the mode in use.

## Adapt

1. Read what exists: notebook, pipeline JSON, DDL, design record, last runs (as a query the user runs). Trace them as one chain: pipeline activity -> notebook -> target/staging/audit/procedure names in it -> their DDL and validation SQL -> tests -> runbook. Ask for what is missing.
2. Map it to a case. Unclear -> ask.
3. Review (below) and show the report.
4. Agree which findings to fix. Change only those parts and keep existing names and conforming behavior.
5. Before replacing a running pipeline, the user runs old and new on DEV over the same window. Draft compare queries (row count, keys, totals of one measure).
6. Update the design record: case, current values, decisions found, add-ons present.

## Review (changes nothing)

Automatic at the end of build and adapt, or on request.

| Area | Check |
|---|---|
| security | secrets, keys or connection strings in code; dynamic SQL without parameters; rights wider than needed; personal data in logs; public storage or SAS tokens in code |
| vulnerabilities | dependencies with known CVEs, unpinned versions, outdated runtime |
| correctness | identify the case; walk its vanilla flow (a missing block is at least S2); rules R1-R12 in [SKILL.md](../SKILL.md) and the case traps; names and audit columns; decisions made explicitly in the record, not silently defaulted; add-ons whose triggers match and are missing are suggestions, not findings |
| reliability | run log, alert, partial writes, safe rerun, timeouts, token lifetime vs the longest write |
| performance | the [playbook](./performance.md) section 8: unbounded parallelism or transactions, no chunking at volume, SELECT *, collect() on big data, row-by-row loops, repeated counts, tuning without a measured number, constants copied from another job |

Severity uses the reviewer's S1-S4 scale ([reviewer](../../../agents/reviewer.agent.md)); pipeline examples: S1 wrong or missing data in PROD people read, pipeline down with no workaround, a secret in code, an unsafe operation. S2 PROD degraded or late past its limit, a missing vanilla block or check, a load that cannot meet its window. S3 non-PROD broken, minor wrong values in non-critical columns. S4 cosmetic.

Output:

```
Review - <object> - <date>
Verdict: ready | fix first     S1 n - S2 n - S3 n - S4 n
| # | Sev | Area | Where | Problem | Fix |
Suggestions: <add-ons that fit>
<summary line> - <next step line>
```

Any S1 -> fix first. Build: S1 and S2 are fixed before showing. Offer Debug for each S1 and S2.

## Debug

Use the [bug skill](../../bug/SKILL.md) (incident report only when it applies). SQL timeout: separate slow from blocked with DEV reads of `sys.dm_exec_requests` (wait_type, blocking_session_id), `sys.dm_tran_locks` on target and staging, and Query Store top duration; mark which must run during the failing stage. Pipeline-specific causes to rank first: the case traps, rules R1-R12 (partial publish, non-idempotent rerun, clock-based watermark, repeated source reads), and the run log or audit rows for the failing window. A fix is a separate approved adapt step.

## Runbook (last output of build and adapt)

What it does (case, source -> target, schedule, readers). Decisions and add-ons with reasons. When it fails (what the run log shows, the alert, what the next run does alone). How to rerun. How to undo, from the case. Where to look (run log, freshness or staleness check, pipeline monitor). Measured throughput and limiting resource for medium and large loads. Post-commit recovery limit when no previous copy is retained.

## Design record template

One file per pipeline: `docs/ai/reports/<safe-name>.design.yaml`. Safe name: letters, digits, hyphens, underscores, starts with a letter or digit, at most 80 characters. Update after every answered decision. Read first when resuming. Never copy another pipeline's answers. Records written under catalog_version 2.0 stay valid, because the case IDs and add-on IDs are unchanged.

```yaml
pipeline: <PL_name>
catalog_version: 3.0
case: <01-one-time-load | 02-daily-ingestion | 03-serving-table | 04-large-volume | 05-frequent-load | 06-streaming>
status: frame       # frame > case > decide > plan > build > review > test > runbook > done
updated: YYYY-MM-DD
goal: "<source> -> <target>, <how often>, <how much>, read by <who>"
linked: []
signals: {}         # key -> {value, source: user|inferred|unknown, evidence}
size: {tier: "", rows: "", gb: "", avg_row_bytes: "", provenance: ""}
throughput: {chunk_size: "", parallelism: {source: "", writers: "", workers: ""}, batch_size: "", measured_rows_per_sec_per_writer: "", limiting_resource: "", est_wall_time: ""}
values: {}
decisions: []       # - {id, choice, why, recommended, by}
addons: {chosen: [], declined: []}   # - {id, why}
setup: []           # - {item, status: exists|missing|created_by_user}
plan_ok: false
build: {files: [], review: {verdict: "", s1: 0, s2: 0, s3: 0, s4: 0}}
tests: []           # - {done_when, result: passed|failed|not_run, evidence}
open: []
next: ""
```
