# Modes

One mode per request; load only the section in use. Tables and pipelines share the rules below; their own parts follow.

## Shared rules

- **Changes:** review changes nothing. Fixes from a review or debug are code changes made after the user agrees which findings to fix; database changes stay drafts (SKILL.md Safety). A change to a table that keeps data goes through a migration ([decisions](model/decisions.md#change_with_data)).
- **Levels:** **Must fix**, **Should fix**, **Nice to have**:

| Level | Tables | Pipelines |
|---|---|---|
| Must fix | wrong or lost data, or a destructive script: duplicates allowed, the grain contradicts the key, a keep table can be dropped, an overlapping history; will fail or be slow at expected volume: unbounded key, no unknown member, MAX type in an index, many indexes on a bulk target, partition without a reason | wrong or missing data in PROD people read, pipeline down with no workaround, a secret in code, an unsafe operation; PROD degraded or late past its limit, a missing vanilla block or check, a load that cannot meet its window |
| Should fix | maintainability: naming, missing `serves:` comment, unused column | non-PROD broken, minor wrong values in non-critical columns |
| Nice to have | style or optional | cosmetic |

- **Review output** (answer first; do not list passed checks; when run by `reviewer`, its return format wins and Nice to have is for chat reviews only):

```
Review - <object> - <date>
Verdict: ready | fix first     Must fix n - Should fix n - Nice to have n
| # | Level | Area | Where | Problem | Fix |
Open checks: <checks not run, and who runs them>
<summary line> - <next step line>
```

Any Must fix -> fix first. Offer Debug for each Must fix.

- **Debug:** prove the cause first, per **Bug** in `AGENTS.md` (red check, ranked hypotheses, **unproven** when it cannot run); the fix is a separate approved adapt or build step. Save the result on request with the [review skill](../review/SKILL.md) in `bug` mode. Hypotheses to test first are in [Debug hypotheses](#debug-hypotheses) below. SQL timeout: separate slow from blocked with DEV reads of `sys.dm_exec_requests` (wait_type, blocking_session_id), `sys.dm_tran_locks` on target and staging, and Query Store top duration; mark which must run during the failing stage.
- **Decisions and runbooks:** record settled choices in `plans/` and `memory.md`; pipeline runbooks live in `docs/ai/runbooks/<safe-name>.md` ([SKILL.md](SKILL.md#workflow)).

## Tables

### Decide

One question, no full model. Give: what it means in this task with a concrete example, options and the trade-off, one recommendation grounded in evidence, and what would change it. Use [decisions](model/decisions.md) and [scale](model/scale.md). Save settled choices in `memory.md`.

### Review

Read the DDL or design with the approved scope. Check, in order:
1. Grain: header grain equals the key. One row per what is stated and true.
2. Keys and constraints: natural key unique, no NULL grain parts, FKs where required and indexed, history intervals consistent.
3. Case fit and traps from [cases](model/cases.md).
4. Types, names and indexes: [R11](SKILL.md#rules) and [decisions](model/decisions.md#types_naming).
5. Load fit and scale: size tier, staging compatible, clustered key for appends, deferred indexes, columnstore batch note, SWITCH alignment, long keys bounded or hashed ([scale](model/scale.md) checklist).
6. Change safety: [R11](SKILL.md#rules) and [decisions](model/decisions.md#change_with_data).
7. Workspace defaults: one main plus one staging table per dataset unless justified, no speculative tables or columns.

## Pipelines

### Adapt

1. Read what exists: notebook, pipeline JSON, DDL, `memory.md`, runbook, last runs (read the run rows on DEV). Trace them as one chain: pipeline activity -> notebook -> target/staging/audit/procedure names in it -> their DDL and validation SQL -> tests -> runbook. Ask for what is missing.
2. Map it to a case. Unclear -> ask.
3. Review (below) and show the report.
4. Agree which findings to fix. Change only those parts and keep existing names and conforming behavior.
5. Before replacing a running pipeline, the user runs old and new on DEV over the same window; you compare them with read queries (row count, keys, totals of one measure).
6. Update `docs/ai/runbooks/<safe-name>.md` and `memory.md`: case, current values, decisions found, add-ons present.

### Review

Automatic at the end of build and adapt, or on request.

| Area | Check |
|---|---|
| security | secrets, keys or connection strings in code; dynamic SQL without parameters; rights wider than needed; personal data in logs; public storage or SAS tokens in code |
| vulnerabilities | dependencies with known CVEs, unpinned versions, outdated runtime |
| correctness | identify the case; walk its vanilla flow (a missing block is Must fix); rules R1-R12 in [SKILL.md](SKILL.md) and the case traps; names and audit columns; decisions made explicitly in the record, not silently defaulted; add-ons whose triggers match and are missing are suggestions, not findings |
| reliability | run log, alert, partial writes, safe rerun, timeouts, token lifetime vs the longest write |
| performance | the [playbook](pipeline/performance.md) sections 2-6 |

## Debug hypotheses

- Tables: grain vs key mismatch, duplicate or NULL key parts, join fan-out, overlapping history intervals, wrong types or truncation.
- Pipelines: rank first the case traps, rules R1-R12 (partial publish, non-idempotent rerun, clock-based watermark, repeated source reads), and the run log or audit rows for the failing window.
