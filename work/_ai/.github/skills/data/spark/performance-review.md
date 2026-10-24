# Evidence-based Spark performance review

Evidence first: each finding cites a measured number supplied by the user or a log (stage time, shuffle bytes, spill, task skew, `stage_timing` lines, SQL DMV output). Never invent Spark UI metrics. Without evidence, name the exact metric to capture and label the finding "hypothesis".

## Anti-patterns

| Anti-pattern | Why | Instead |
|---|---|---|
| `collect()` / `toPandas()` on large data | driver memory, single thread | aggregate in Spark; `limit(1).first()` for probes |
| Python UDF on a hot path | row serialization to Python | built-in functions; a vectorized pandas UDF if unavoidable |
| RDD round-trips (`df.rdd.map`, `rdd.toDF`) | leaves the optimizer, serializes rows | DataFrame API (`df.rdd.getNumPartitions()` is fine) |
| Same lazy frame acted on repeatedly | recomputes the source read | one pass with aggregates; persist once (DISK_ONLY for very large frames), unpersist after |
| `distinct()` over wide text to dedupe | full-row shuffle | dedupe by key with a window, or `dropDuplicates(keys)` when duplicates are defined by key |
| Broadcast of a table that is not small | executor out-of-memory | broadcast small dimensions only |
| Default shuffle partitions on very large or small jobs | many tiny or few huge tasks | about shuffle bytes / 128 MB; AQE on |
| Unbounded parallel datasets or threads | memory pressure, SQL session explosion | bounded workers sized by the session budget and measured memory |
| Tuning value copied from another job | not measured here | measure one dataset; record before and after |

Output: `| # | Evidence | Finding | Fix | Expected gain (measured or hypothesis) |`.
