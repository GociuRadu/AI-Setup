# Design records and runbooks

Only for new or changed pipelines and table designs; small changes get none.

## Rules

- One file per table design (`docs/ai/reports/<safe-name>.model.yaml`) or pipeline (`<safe-name>.design.yaml`); the runbook is `<safe-name>.runbook.md`. Safe name: letters, digits, hyphens, underscores, starts with a letter or digit, at most 80 characters.
- Read an existing record before resuming and do not re-ask settled choices; update it after every answered decision; never copy another table's or pipeline's answers.
- Short, no code copies, no customer rows, no secrets.

## Table design record

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

## Pipeline design record

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

## Pipeline runbook (last output of build and adapt)

What it does (case, source -> target, schedule, readers). Decisions and add-ons with reasons. When it fails (what the run log shows, the alert, what the next run does alone). How to rerun. How to undo, from the case. Where to look (run log, freshness or staleness check, pipeline monitor). Measured throughput and limiting resource for medium and large loads. Post-commit recovery limit when no previous copy is retained.
