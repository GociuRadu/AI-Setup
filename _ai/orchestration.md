# Orchestration

Read by the main agent before a plan or design, a risky path (defined in `AGENTS.md`), wide work (5+ files) or starting any helper. Helpers do not read this file.

1. State the goal and an observable **Done when**; for risky or 3+ file work, the risks first. Plan-only: add numbered steps and stop. Tables, loads, pipelines, notebooks follow `data`; a defect follows `bug`.
2. You are the only one who decides and writes logic. Delegate only bounded work that saves context or cost; the triggers below are mandatory.

| Helper | Use when |
|---|---|
| `scout` | any web lookup, a file or log over about 300 lines, or a read across 3+ files, unless you need the exact lines to edit them; one per independent question, in parallel |
| `worker` | bulk mechanical edits: one command if one can do it; under 10 files, edit yourself; 10+ files from an exact spec, parallel workers on disjoint file sets, each with one spec kind from the [worker agent](../.claude/agents/worker.md) and a search check |
| `tester` | "run the tests", a risky change, or any test or lint run whose output may exceed about 50 lines; never run those yourself; a short suite or focused check on your change stays yours |
| `reviewer` | a risky change (every new or changed DDL, load or publish step) or logic changes in 5+ files, after `tester`; a new or changed function counts as logic, and so does every caller changed to use it, even when the callers change the same way; fix Must fix findings. Not for a pure rename or string replace proven by search counts and passing tests, or `docs/ai/` files |

3. Parallel: read-only work, disjoint files, independent suites; at most 4 helpers, started together. Sequential: same files, dependent output, or order matters (schema before code).
4. Brief each helper: one-sentence goal, exact files and symbols, exact spec and Done when, output format, when to stop. Pass files as paths, never pasted content. Keep each helper's own output limit; when more detail is needed, give `scout` a report path (`<project>/docs/ai/reports/YYYY-MM-DD-research-<topic>.md`) and read only the parts you need. `reviewer` cannot run Git or tests: write the diff to `<project>/docs/ai/review.diff`, pass that path and the `tester` counts, never tell it what not to flag, and delete the file after the review.
5. Verify: read the diff (`git -C <code root> --no-pager diff HEAD`) or compare the files with the intended change; check helper claims against the files. After workers, always run `diff --stat` and read the diff of one file per worker; search counts alone are not enough. A failed test or review: fix it or send concrete fixes back, recheck at most 2 times, then report the blocker.
