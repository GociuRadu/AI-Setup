# Orchestration

Read by the main agent before it starts a helper. When to start one is in `AGENTS.md` (Plans and helpers). Helpers do not read this file.

## Brief

- One-sentence goal, exact files and symbols, the exact spec, **Done when**, output format, when to stop. Pass paths, never pasted content.
- `worker`: disjoint file sets, each with one spec kind from the [worker agent](../.claude/agents/worker.md) and a search check.
- `scout`: when you need more detail than its output limit, give it a report path (`<project>/docs/ai/reports/YYYY-MM-DD-research-<topic>.md`) and read only the parts you need.
- `tester`: the scope (a file, a test, a tier) when not the whole suite.
- `reviewer` cannot run Git or tests: write the diff to `<project>/docs/ai/review.diff`, pass that path and the `tester` counts, never tell it what not to flag, and delete the file after the review.

## Parallel

Read-only work, disjoint files and independent suites run in parallel: at most 4 helpers, started in one message. Same files, dependent output or a required order (schema before code) run one after another.

## Check

- Read the diff (`git -C <code root> --no-pager diff HEAD`) or compare the files with the intended change; check every helper claim against the files.
- After workers: `diff --stat` and the diff of one file per worker; search counts alone are not enough.
- A failed test or review: fix it or send concrete fixes back, recheck at most 2 times, then report the blocker.
