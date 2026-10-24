# Core mechanics

Shared by every case. Read the sections the case needs, not the whole file.

## Recurring frame (02, 05; 03 and 06 reuse its blocks)

START -> CHECK -> SKIP? -> READ -> CLEAN_CAST -> STAGE -> VALIDATE -> PUBLISH -> FINISH. Any failure -> ERROR.

| Block | Does |
|---|---|
| START | Open a run in the run log. If another run of the same target is running, write `skipped` with reason `busy` and end green. Mark a `running` row older than the timeout `failed`. |
| CHECK | Resolve the watermark (last successful window end) and the source upper bound (see Change detection). |
| SKIP | Nothing newer than the watermark, and every overlap row already in the target with the same version: finish `skipped` (healthy). APIs decide after READ. |
| READ | Read once, over the bounded window. Take counts and totals in this pass. APIs: timeout, backoff, Retry-After, follow pages to the last. |
| CLEAN_CAST | Standard cleaning, explicit types, UTC, audit columns. Count failed casts. Keep the newest row per key. |
| STAGE | Write the batch to a side table nobody reads. One staging table per target. |
| VALIDATE | Key unique, no empty key, no failed casts, rows read = staged + duplicates removed + empty dropped (+ set aside). A full file or API read is complete only by its end signal (last page, trailer row, source count). |
| PUBLISH | Atomic, newer wins. See Publish by target. Update only when a value differs. |
| RECONCILE | Totals published = totals of the same rows before publishing (add-on, for amounts). |
| FINISH | Close the run as succeeded. Move the watermark to the upper bound (API: largest updated_at received. Files: the processed list). |
| ERROR | Mark failed, keep the watermark, alert. The next run retries the same window. |

## Change detection

| Source | Changed rows | Upper bound | Notes |
|---|---|---|---|
| DB with CDC or change tracking | keys changed since version X | its current version | sees deletes |
| DB with a version number | rows above the last version | just below the lowest version still being written | no deletes |
| DB with modified_at | rows since watermark minus overlap | the source clock minus a small lag, never MAX(modified_at) | no deletes |
| DB with nothing | read all and compare | none | never skips; deletes by comparison |
| Files | files not in the processed-files list (name + size or full-content hash) | not needed | late file with older time must not be skipped |
| API | updated_since = watermark minus overlap | largest updated_at received | skip decided after READ |
| Lake table | table version or change feed | current version | deletes with the change feed |

- No change marker: later runs take a consistent full snapshot and compare or publish it. Never invent a watermark from run timestamps (case 02, not 05).
- Overlap only for time markers. A source that stores local time needs an overlap of at least 1 hour on the night clocks go back.
- First run of an API or modified_at source: full read, or a start date agreed with the user, never assumed.
- Never decide "nothing changed" with a weak checksum (CRC). A full-content file hash is fine.

## Publish by target

| Target | Mechanism |
|---|---|
| database table | one transaction (MERGE or INSERT/UPDATE from staging), or truncate target + SWITCH staging in one transaction, or swap. Big batches: SWITCH or key-range slices (performance.md section 4). |
| lake table | one commit of the table format (a merge) |
| file export | write under a temp name, then rename. Receivers read final names only. |
| API export | idempotent calls by key (PUT /orders/42 twice = once) |

## Run log (one shared table, one row per run, keyed by target)

Records: pipeline, target, source, run type (normal, initial, backfill, hand-over, deletes), status (running, succeeded, skipped, failed), start and end (UTC), window (from, to), counts (read, written, set aside, empty dropped), inputs (for 03), error.

- Watermark = window end of the last succeeded run of type normal or hand-over. Files: the processed list. `initial`, `backfill` and `deletes` never move it. `initial` chunks run in parallel by design.
- A succeeded normal run needs a window end when the source has a marker. Keep at least one year of history. Never delete a table's last watermark row.
- HAND_OVER after 01 or 04 needs a verified source marker captured just before the initial read, or a complete-file list. No marker or list: design an explicit case-02 full-snapshot follow-on. Never record a fabricated timestamp or last loaded key.
- Existing project audit table (named in `project.md`): reuse it for the sources it fits ([audit reuse](templates/restartable-snapshot.md#audit-table-reuse)). Do not add a second run table.

## Alerts

- Failed run: one alert for every failed run (02, 04, and 03 when daily). Not for 05 or 03 at 5-60 minutes.
- Freshness (02, 03 daily): hourly, fails when no succeeded or skipped run (not `busy`) for about twice the schedule.
- Staleness (05, 06, 03 at 5-60 minutes): every few minutes inside active hours, one alert per outage.
- `skipped` is healthy except `busy`. A source that goes quiet is the job of the SOURCE_SILENCE add-on.

## Cleaning standard (CLEAN_CAST)

Rename to snake_case. Trim. Empty text -> NULL. Drop fully empty rows and count them. Cast with explicit types and count failures (stop on any). Dates from text with an explicit format. Excel serial dates and codes stored as numbers padded back. Local time -> UTC with the source zone. Decimal comma -> dot. Codes with leading zeros stay text. Upper-case only listed columns. Same key twice in a batch: keep the newest by the newer field, and fail if there is no such field.

## Columns and layers

- Names snake_case singular. Time in UTC, millisecond precision. Money and quantities as fixed decimal, never float. Right-sized text, never max by default. Key declared and proven by VALIDATE.
- Audit columns last: `_loaded_at` (UTC), `_source` (`<type>:<object or file>[#sheet]`), `_loaded_by` (`<pipeline>:<run>`). Tracked deletes: `_is_deleted`, `_deleted_at`. Silver never physically deletes.
- Layers: bronze (as received), staging (is this batch usable), silver (one row per business key), gold (what consumers need). Layer and schema names come from the existing asset, never invented.

## Triggers

- Fixed times for daily or a few times a day. Every N minutes for 5-60 minutes, with a start time of now (never in the past, or the scheduler replays missed intervals).
- File lands: read a file only when complete (done marker or stable size). Each run takes every unprocessed file. A scheduled backstop catches missed triggers. Success -> processed/. Bad file (parse, cast, validate) -> failed/. A passing failure (DB down) leaves the file for the next run.

## Prerequisites checklist (draft checks for the user, per case)

All cases: a network path to each source, layers, a service identity with only the needed rights, parameters per environment. Recurring cases: run log, failed-run alert, freshness or staleness check. 04: chunk list in the run log. 05 and 03 at 5-60 minutes: compute that starts in seconds. 06: always-on compute, heartbeat. API sources: secret store. File triggers: trigger, backstop schedule, processed/ and failed/. Privileged operations (truncate, swap, build key) are wrapped once by an admin. The identity only gets the right to run them. Missing items: show the script. The user creates it.

## Add-ons offered to every pipeline

| Add-on | Use when |
|---|---|
| RETRY (whole run, growing waits) | daily or rarer and the source has short outages |
| SOURCE_SILENCE (newest data older than a limit) | the source can stop without failing |
| BUSINESS_RULES (domain checks in VALIDATE) | the business cares about domain rules or amounts |
| SET_ASIDE (bad rows to a side table, loaded + set aside = read) | a few bad rows must not block the load |
| PII (mask or omit, never in logs) | personal data |
| TESTS (Done-when list as a rerunnable script) | others depend on the target |
| OWNER (named owner and alert recipient) | anyone besides you depends on the table |

Offer the top three that match the signals. Declined add-ons are recorded with the reason.
