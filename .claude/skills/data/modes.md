# Modes and records

One mode per request; load only the section in use. Tables and pipelines share the rules below; their own parts follow.

## Shared rules

- **Changes:** review changes nothing. Fixes from a review or debug are code changes made after the user agrees which findings to fix; database changes stay drafts (SKILL.md Safety). A change to a table that keeps data goes through a migration ([decisions](model/decisions.md#change_with_data)).
- **Levels:** the same as the `review` skill: **Must fix**, **Should fix**, **Nice to have**. Examples:

| Level | Tables | Pipelines |
|---|---|---|
| Must fix | wrong or lost data, or a destructive script: duplicates allowed, the grain contradicts the key, a keep table can be dropped, an overlapping history; will fail or be slow at expected volume: unbounded key, no unknown member, MAX type in an index, many indexes on a bulk target, partition without a reason | wrong or missing data in PROD people read, pipeline down with no workaround, a secret in code, an unsafe operation; PROD degraded or late past its limit, a missing vanilla block or check, a load that cannot meet its window |
| Should fix | maintainability: naming, missing `serves:` comment, unused column | non-PROD broken, minor wrong values in non-critical columns |
| Nice to have | style or optional | cosmetic |

- **Review output** (answer first; do not list passed checks):

```
Review - <object> - <date>
Verdict: ready | fix first     Must fix n - Should fix n - Nice to have n
| # | Level | Area | Where | Problem | Fix |
Suggestions: <add-ons that fit>
Open checks: <checks not run, and who runs them>
<summary line> - <next step line>
```

Any Must fix -> fix first. Build: Must fix findings are fixed before showing. Offer Debug for each Must fix.

- **Debug:** use the [bug skill](../bug/SKILL.md) (it proves the cause and writes the report; the fix is a separate approved adapt or build step). Hypotheses to test first are in the table and pipeline sections below. SQL timeout: separate slow from blocked with DEV reads of `sys.dm_exec_requests` (wait_type, blocking_session_id), `sys.dm_tran_locks` on target and staging, and Query Store top duration; mark which must run during the failing stage.
- **Design records:** one file per table design (`docs/ai/reports/<safe-name>.model.yaml`) or pipeline (`<safe-name>.design.yaml`). Safe name: letters, digits, hyphens, underscores, starts with a letter or digit, at most 80 characters. Read an existing record before resuming and do not re-ask settled choices; update it after every answered decision; never copy another table's or pipeline's answers. Short, no code copies, no customer rows, no secrets. Small changes get none.

## Tables

### Decide

One question, no full model. Give: what it means in this task with a concrete example, options and the trade-off, one recommendation grounded in evidence, and what would change it. Use [decisions](model/decisions.md) and [scale](model/scale.md). Save nothing unless a design record exists.

### Review

Read the DDL or design with the approved scope. Check, in order:
1. Grain: header grain equals the key. One row per what is stated and true.
2. Keys and constraints: natural key unique, no NULL grain parts, FKs where required and indexed, history intervals consistent.
3. Case fit and traps from [cases](model/cases.md).
4. Types and names: smallest correct, no MAX in keys, DECIMAL for money.
5. Indexes: each has a named query, no duplicates, none missing for FKs.
6. Load fit and scale: size tier, staging compatible, clustered key for appends, deferred indexes, columnstore batch note, SWITCH alignment, long keys bounded or hashed ([scale](model/scale.md) checklist).
7. Change safety: keep tables guarded, migrations idempotent with rollback.
8. Workspace defaults: one main plus one staging table per dataset unless justified, no speculative tables or columns.

### Debug hypotheses

Grain vs key mismatch, duplicate or NULL key parts, join fan-out, overlapping history intervals, wrong types or truncation.

### Design record

```yaml
name: <safe-name>
status: goal            # goal > store > profile > grain > entities > cases > addons > physical > plan > files > review > done
next: <exact next action>
goal: {data: "", readers: "", access: "", volume: "", change_rate: ""}
size: {rows_now: "", rows_2y: "", bytes_per_row: "", tier: small|medium|large}
store: {choice: "", reason: ""}
tables:
  - name: <schema.table>
    grain: "one row per ..."
    case: 02-entity          # 01-staging ... 09-flexible
    key: ""
    data: keep|rebuild
    addons: []
    declined: []
    physical: {clustered_key: "", partitioning: none, columnstore: false, indexes: []}
    load: {staging: "", publish: insert|switch|merge, batch_hint: ""}
relationships: []
run_order: []
profile: {status: pending, evidence: ""}
decisions: []            # each: question, choice, by, date
assumptions: []
review: {verdict: "", open: []}
artifacts: []
```

## Pipelines

### Adapt

1. Read what exists: notebook, pipeline JSON, DDL, design record, last runs (read the run rows on DEV). Trace them as one chain: pipeline activity -> notebook -> target/staging/audit/procedure names in it -> their DDL and validation SQL -> tests -> runbook. Ask for what is missing.
2. Map it to a case. Unclear -> ask.
3. Review (below) and show the report.
4. Agree which findings to fix. Change only those parts and keep existing names and conforming behavior.
5. Before replacing a running pipeline, the user runs old and new on DEV over the same window; you compare them with read queries (row count, keys, totals of one measure).
6. Update the design record: case, current values, decisions found, add-ons present.

### Review

Automatic at the end of build and adapt, or on request.

| Area | Check |
|---|---|
| security | secrets, keys or connection strings in code; dynamic SQL without parameters; rights wider than needed; personal data in logs; public storage or SAS tokens in code |
| vulnerabilities | dependencies with known CVEs, unpinned versions, outdated runtime |
| correctness | identify the case; walk its vanilla flow (a missing block is Must fix); rules R1-R12 in [SKILL.md](SKILL.md) and the case traps; names and audit columns; decisions made explicitly in the record, not silently defaulted; add-ons whose triggers match and are missing are suggestions, not findings |
| reliability | run log, alert, partial writes, safe rerun, timeouts, token lifetime vs the longest write |
| performance | the [playbook](pipeline/performance.md) section 8: unbounded parallelism or transactions, no chunking at volume, SELECT *, collect() on big data, row-by-row loops, repeated counts, tuning without a measured number, constants copied from another job |

### Debug hypotheses

Rank first: the case traps, rules R1-R12 (partial publish, non-idempotent rerun, clock-based watermark, repeated source reads), and the run log or audit rows for the failing window.

### Runbook (last output of build and adapt)

What it does (case, source -> target, schedule, readers). Decisions and add-ons with reasons. When it fails (what the run log shows, the alert, what the next run does alone). How to rerun. How to undo, from the case. Where to look (run log, freshness or staleness check, pipeline monitor). Measured throughput and limiting resource for medium and large loads. Post-commit recovery limit when no previous copy is retained.

### Design record

```yaml
pipeline: <PL_name>
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
build: {files: [], review: {verdict: "", must_fix: 0, should_fix: 0, nice_to_have: 0}}
tests: []           # - {done_when, result: passed|failed|not_run, evidence}
open: []
next: ""
```
