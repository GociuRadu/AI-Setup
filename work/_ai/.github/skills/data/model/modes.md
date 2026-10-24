# Modes

One mode per request. Review and debug never authorize fixes: propose the change and get approval first.

## decide

One question, no full model. Give: what it means in this task with a concrete example, options and the trade-off, one recommendation grounded in evidence, and what would change it. Use [decisions](./decisions.md) and [scale](./scale.md). Save nothing unless a design record exists.

## review

Read the DDL or design with the approved scope. Check, in order:
1. Grain: header grain equals the key. One row per what is stated and true.
2. Keys and constraints: natural key unique, no NULL grain parts, FKs where required and indexed, history intervals consistent.
3. Case fit and traps from [cases](./cases.md).
4. Types and names: smallest correct, no MAX in keys, DECIMAL for money.
5. Indexes: each has a named query, no duplicates, none missing for FKs.
6. Load fit and scale: size tier, staging compatible, clustered key for appends, deferred indexes, columnstore batch note, SWITCH alignment, long keys bounded or hashed ([scale](./scale.md) checklist).
7. Change safety: keep tables guarded, migrations idempotent with rollback.
8. Workspace defaults: one main plus one staging table per dataset unless justified, no speculative tables or columns.

Severity uses the reviewer's S1-S4 scale ([reviewer](../../../agents/reviewer.agent.md)); table-design examples:

| Severity | Meaning |
|---|---|
| S1 | wrong or lost data, or a destructive script: duplicates allowed, the grain contradicts the key, a keep table can be dropped, an overlapping history |
| S2 | will fail or be slow at expected volume: unbounded key, no unknown member, MAX type in an index, many indexes on a bulk target, partition without a reason |
| S3 | maintainability: naming, missing `serves:` comment, unused column |
| S4 | style or optional |

Output: verdict, then findings as severity, file or object, problem, fix (one line each), then open checks the user must run. Answer first. Do not list passed checks.

## debug

Use the [bug skill](../../bug/SKILL.md). Model-specific hypotheses to test first: grain vs key mismatch, duplicate or NULL key parts, join fan-out, overlapping history intervals, wrong types or truncation.

## Query drafts (all modes)

Every query uses the SQL request format of the [global rules](../../../instructions/global.instructions.md): DEV only, sent to the user, never executed by the agent. PROD is never queried or drafted. Bound large reads by key or date; a write draft also states ROLLBACK.

## Design record

`docs/ai/reports/<safe-name>.model.yaml` (pipelines use `.design.yaml`). Safe name: letters, digits, hyphen, underscore, up to 80 characters, starts with a letter or digit. Read an existing record before resuming and do not re-ask settled choices. Short, no code copies, no customer rows, no secrets. For small table changes, do not create one.

```yaml
catalog_version: 3.0
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

Existing 2.0 records stay valid: case IDs and add-on names are unchanged.
