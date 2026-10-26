# BUG <YYYY-MM-DD> - <symptom>

Counts and masked identifiers only; no customer data or secrets.

| Severity | Status | Environment | Ticket |
|---|---|---|---|
| <High / Medium / Low> | OPEN | <PRODUCTION / DEV / local> | <id or none> |

Severity: High = wrong or missing data people use, or an outage with no workaround; Medium = degraded or late with a workaround; Low = non-production, minor values or cosmetic.

## Symptom
<Exact error or expected vs observed result; artifact, window.>

## Impact
<Affected tables/reports/users and counts; whether wrong data was consumed.>

## Root cause
<Proven cause, or explicitly unproven.>
- Evidence: <log/query reference and counts; masked identifiers only>

## Proposed fix
- <path: the minimal change>

## Regression test
- <test file and case that fails without the fix>

## Data repair
<None, or the scoping read, narrow write, expected count and rollback. Never claim an unexecuted repair succeeded.>

## Risk
- <what the fix could break>
