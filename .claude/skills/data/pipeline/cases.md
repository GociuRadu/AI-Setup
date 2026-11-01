# Pipeline cases

Case = how often + how much. Never the source or the target. Pick in this order (first match wins):

1. Gold table computed from silver and read all the time -> 03
2. Runs once and fits one run (up to ~10M rows or a few GB) -> 01
3. Runs once and bigger -> 04
4. Fresh within ~1 minute, 24/7 -> 06
5. Every 5-60 minutes -> 05
6. Daily, a few times a day, or when a file lands -> 02

A request that spans two cases becomes two linked pipelines, built in order (01/04 then 02/05 via HAND_OVER; 02/05 then 03 via its input check). Not covered, so propose the closest and ask: export-only sources (land files, then 02 with trigger file_lands and BRONZE); tens of millions of rows a day into one table (02 with publish by SWITCH or key-range slices, see performance.md); sub-second latency (an event platform, not a scheduled job).

Signals to collect or infer (record with provenance `user`, `inferred` or `unknown`): source_type, source_rows, source_gb, avg_row_bytes, initial_load_fits_one_run, change_marker_available, complete_file_tracking_available, history_needed, deletes_at_source, source_owner, source_can_redeliver, source_changes_without_warning, source_fed_by_other_job, source_may_go_silent, amounts_matter, personal_data, bad_rows_tolerated, as_of_questions, replays_expected, others_depend_on_target, recurring_follows, target_kind, schedule, window (when it may run), parallelism_limit (source and target). An unknown signal is asked. Never infer measured size from a case threshold.

---

## 01 one-time-load

Data loaded once into a new table nobody reads. A failure means fix and rerun.
- Flow: READ -> CLEAN_CAST -> VALIDATE -> WRITE -> COUNT_CHECK -> RECONCILE -> INDEX(key).
- READ takes the whole source as is (files as text) with counts and totals in the pass. VALIDATE before writing: rows > 0, no failed casts, key unique, no empty key. WRITE empties the target (never drops), writes everything, no indexes. COUNT_CHECK: rows in = rows validated. RECONCILE: totals in target = totals taken during READ. INDEX: the key, once, at the end.
- Gate: does anyone read the target already? Yes -> load into a copy on the side and SWAP as in 03.
- Values: source (object or files; several sheets or files into one table or one each; CSV delimiter, encoding, header), target and key, column map with types, code widths, date formats and source time zone, reconcile columns.
- Traps: type guessing on Excel or CSV (00123 -> 123); Excel codes stored as numbers; several sheets without origin in `_source`; the tool creating the table; drop instead of empty; failed cast becoming NULL; local time loaded as UTC; indexes during the load.
- Done when: load ends without errors; COUNT_CHECK and RECONCILE match; 10 rows checked by eye (a date, an amount, a code with leading zeros).
- Rerun: run again, the target is emptied first. Undo: empty the target.
- Add-ons: HAND_OVER (a recurring load will follow and a verified marker or file list exists); BRONZE (file source or not redeliverable); OTHER_INDEXES; SIGN_OFF; LOAD_NOTE.

## 02 daily-ingestion

A source feeds a silver table on a schedule, unattended. Silver = latest truth, one row per key.
- Flow: the recurring frame in core.md.
- Values: source, target, key, change marker and overlap (default 10 minutes), newer field, column map, source time zone, freshness limit (about 2x the schedule), active hours.
- Decisions (one at a time, with a recommendation): first_load (everything, from an agreed start date, or a one-time 01/04 load then an explicit recurring follow-on when the initial extraction does not fit one run); load_type (changes if the source can say what changed, else full); trigger (fixed times or file lands).
- Volume: for a large daily batch or a full snapshot use performance.md (partitioned read, parallel staging write, SWITCH or key-range publish). One giant MERGE is never the answer.
- Traps: upper bound from the pipeline clock; no overlap on modified_at; 0 rows treated as failure (0 rows from a changes read = skipped); same key twice in a batch; updating unchanged rows (churns `_loaded_at`); full load plus a partial answer marking good rows deleted; file read while still written; two pipelines on one staging table.
- Done when: a second run with no new data ends skipped (API too, despite the overlap); a rerun of the same window changes nothing; a forced failure leaves silver and the watermark unchanged and the alert arrives; a killed run does not block the next; the run log shows every run with window and counts.
- Rerun: start again; overlap is harmless. Failed file: fix it and move it back to the input folder.
- Add-ons: BRONZE (files or APIs that cannot redeliver); DELETES (rows deleted at the source; needs load_type changes); HISTORY (as-of questions); SCHEMA_CHECK (other team owns the source); BACKFILL (replays expected); INPUT_READY (source fed by another job); RECONCILE (amounts matter).

## 03 serving-table

A gold table computed from silver and read all the time. Built on the side, checked, swapped in at once.
- Flow: START -> CHECK_INPUTS -> SKIP? -> BUILD -> VALIDATE -> SWAP -> FINISH.
- CHECK_INPUTS: every input is OK (daily inputs: last run not failed; frequent: not stale; streams: heartbeat inside the limit) and something changed since the last build (a newer succeeded run that wrote rows, or a moved stream position). Input not OK ends the run failed, reason "input X not OK". Nothing changed ends skipped.
- BUILD computes the whole table into a side copy. VALIDATE: rows > 0, key unique, no empty key, and the reconcile total of the copy equals silver with the same filters, read at the same moment as BUILD. SWAP: one step, copy becomes live, live becomes the previous version (the previous version is kept only when the design approves a retained copy; otherwise state the recovery limit). FINISH records the input runs it was built from.
- Gate: do all inputs log their runs in the run log? No -> bring them onto it, or rebuild on every trigger (simpler, no SKIP).
- Values: gold tables, grain, key, inputs, what it computes, reconcile measure and filters, frequency (an input whose change must show within gold's interval must refresh at least that often), active hours, freshness or staleness limit, how reports read it.
- Decisions: trigger (own schedule with input check, or after the silver loads when you own them all); swap_together for several gold tables (a fact with its dimensions: together).
- Volume: a full rebuild that no longer fits the schedule -> INCREMENTAL_BUILD (changed slice only) or parallel build by partition. The swap stays metadata-only.
- Traps: fan-out join multiplying totals; reconciling against all of silver when gold filters; building into the live table; swapping related tables one by one; building on a failed input; reconciling later than the build; a swap that waits for long reports (wait with a limit, give up, retry next run); copy and live differing in structure (create both from one definition); statistics not refreshed after the swap.
- Done when: second run with no input change ends skipped; a forced validation failure leaves the live table untouched; a report running during the swap finishes; the swap back was tested once (if a previous version is kept).
- Add-ons: UNKNOWN_MEMBER or ORPHAN_CHECK (pick one); DOWNSTREAM_REFRESH; INCREMENTAL_BUILD; AS_OF_SNAPSHOT; CONTRACT.

## 04 large-volume

A table too big for one run (hundreds of millions to billions of rows, 10 GB to 1 TB), loaded once into a new table nobody reads, in chunks. Read [performance.md](./performance.md) in full before planning.
- Flow: SIZE_CHECK -> PLAN_CHUNKS -> each chunk in parallel: READ -> CLEAN_CAST -> WRITE -> COUNT_CHECK -> after all: VALIDATE -> RECONCILE -> INDEX(key).
- SIZE_CHECK first (read on local/DEV), then propose chunk size, chunk count, parallelism and the estimated wall time from the measured numbers. READ one chunk through an index at the source with counts and totals in the pass. CLEAN_CAST while the data moves (cleaning afterwards is a second full pass). WRITE removes the chunk's range, then writes it, no indexes. COUNT_CHECK: read = written + empty dropped (+ set aside), chunk logged done. VALIDATE after all chunks: key unique, no empty key, total rows = sum of chunk counts. RECONCILE: target totals = sum of chunk totals (no second read). INDEX once on the full data (lake: compaction).
- Gate: is the target a new table nobody reads? No -> load into a copy on the side and SWAP (03).
- Values: source and owner, target, chunk column (indexed at the source?), window (nights, weekend), parallelism the source owner accepts (default 4, raise only with measured scaling).
- Decision source_changes (a fact, always asked): no change (resume only missing chunks); changes with a verified marker (CATCH_UP, includes HAND_OVER); changes without a marker (restart from a consistent copy on a rerun, never resume mixed snapshots).
- Traps: unindexed chunk column; OFFSET paging; chunks sized by rows; chunk size changed between reruns; retried chunk written without removing its range; RECONCILE by re-reading the source; too many parallel chunks; 100 GB and more into a database (consider the lake); indexes built during the load; more writers than the log rate allows.
- Done when: SIZE_CHECK numbers shown and chunk size, parallelism and estimate set from them; every chunk done in the run log with counts and totals adding up; a stopped load reruns only missing chunks (unchanged source); key unique and built; the measured throughput is recorded (performance.md section 7).
- Rerun: resume chunks not done. Undo: empty the target and remove its chunk rows from the run log.
- Add-ons: CATCH_UP or HAND_OVER; BRONZE (production source read once, or lake target); LAYOUT (lake split by a date at about 1 GB or more per part); OTHER_INDEXES; SCALE_UP (estimate exceeds the window); SIGN_OFF; CUTOVER.

## 05 frequent-load

Load what changed every 5-60 minutes, all day. The 02 frame tuned for frequent runs: fast when nothing changed, never overlapping, alerting on stale data instead of every failed run.
- Flow: the recurring frame plus STALENESS_CHECK. A refused `busy` start is green. The next run catches up from the watermark. A cheap marker lets CHECK skip before READ. APIs confirm a skip after a bounded READ.
- Gate: does the source provide reliable change tracking (CDC or version, a valid time or cursor contract, complete-file identities, a lake version)? No -> stop before build, agree tracking or a case-02 full-snapshot design. Never relax the frequency silently or fabricate a watermark.
- Values: source, target, key, change marker and overlap, newer field, column map, time zone, interval (default 15 minutes), staleness limit (default 3 missed intervals), active hours.
- Decision: first_load, as in 02.
- Traps: compute that takes minutes to start; a run longer than the interval (big sources belong in 02); a start time in the past; alerting on every failed run; skipped counted as unhealthy; no overlap on modified_at; an unindexed change marker (full scan of production every 15 minutes).
- Done when: a no-change window is proven skipped (seconds for cheap markers, bounded API READ otherwise); a source change reaches the target by the next run; a rerun changes nothing; a forced failure sends no alert and the next run catches up; a source stopped longer than the limit gives exactly one alert; a normal run takes a few minutes at most.
- Add-ons: BRONZE; DELETES; SCHEMA_CHECK; BACKFILL; 02:HISTORY; 02:INPUT_READY; 02:RECONCILE; SOURCE_SILENCE.

## 06 streaming

A job running 24/7 keeping a table fresh within about a minute.
- Flow: START -> loop: READ new -> CLEAN_CAST -> VALIDATE -> PUBLISH -> SAVE_POSITION -> HEARTBEAT. Any failure -> ERROR. Position is saved only after PUBLISH, so a crash replays the last batch. PUBLISH is by key, newer wins by event version or time, and tolerates replays and disorder. The heartbeat is every minute, also with no data. The platform restarts from the saved position, and the alert fires when restarts are used up.
- Gate: must it really be fresh within a minute, 24/7? No -> 05 (much cheaper).
- Values: source, target, key, newer field, how new data arrives (change feed, new events, changed rows), where the position is saved (one place per stream, never shared), staleness limit (default 15 minutes).
- Traps: position deleted or shared; changing what the stream reads or writes (new position plus replay); source history shorter than an outage (full reload); heartbeat only when data arrives; reading only new rows from a source that also updates or deletes (read the change feed); small files from the micro-batch (COMPACTION).
- Done when: heartbeat every minute even when quiet; a killed job restarts by itself with no gaps or duplicates; the same batch twice and an older event after a newer one change nothing; a forced validation failure stops the stream and alerts.
- Poison message: fix at the source, or move it to a side table (SET_ASIDE) and restart.
- Add-ons: SET_ASIDE (dead letter); LATE_DATA; DELETES; DAILY_RESTART; COMPACTION (lake target); SCHEMA_CHECK.

---

## Cross-case add-on notes

`02:HISTORY` means case 02's HISTORY add-on, not a new case. Validate that referenced IDs resolve and that requires/excludes hold before recommending.
- BRONZE: keep each batch as received, append-only, deleted after N days. For sources that cannot redeliver (files, APIs) or to prove what arrived.
- DELETES: deletes visible as `_is_deleted`. From change tracking if available, else a key compare every N runs as its own run type `deletes` that never moves the watermark.
- HISTORY: every version kept (valid_from, valid_to, is_current). For as-of questions.
- SCHEMA_CHECK: compare source columns with the column map before READ. Missing or retyped stops the run with a clear message. New columns are reported.
- BACKFILL: reload a past window on request without moving the watermark. Newer wins keeps later changes.
- INPUT_READY: wait until the source system says its own load is finished.
- RECONCILE: totals of the rows written = totals of the same rows in staging.
- CATCH_UP: freeze the source change marker before a multi-day load. The recurring load then brings everything changed during it.
- SCALE_UP: raise the target's power for the load and lower it after.
