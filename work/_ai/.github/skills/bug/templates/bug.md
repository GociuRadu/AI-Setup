# BUG <YYYY-MM-DD> - <symptom>

Draft. Counts and masked identifiers only; no customer data or secrets.

| Severity | Status | Found | Fixed | Ticket |
|---|---|---|---|---|
| <S1 / S2 / S3 / S4> | <OPEN / FIXED> | <YYYY-MM-DD> | <date or not fixed> | <id or none> |

Severity: S1 wrong/missing consumed production data or outage without workaround; S2 production degraded/late with workaround; S3 non-production or minor values; S4 cosmetic/documentation.

## Symptom
<Exact error or expected vs observed aggregate result; artifact, window and environment.>

## Impact
<Affected tables/reports/users and aggregate counts; whether wrong data was consumed.>

## Root Cause
<Proven cause, or explicitly unproven.>
- Evidence: <log/query reference and counts; masked identifiers only>

## Fix
- <artifact path and approved change>

## Data Repair
<None, or user-run repair reference, status, before/after counts and rollback. Never claim an unexecuted repair succeeded.>

## Prevention
- <focused regression check or proposed user-run check>

## Timeline
| Time | Event | Evidence |
|---|---|---|
| <time> | <detected / containment proposed / user-reported action / verified> | <reference> |
