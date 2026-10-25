---
name: lead
description: "Invoke first, before reading code, for: a plan-only or design request; a risky path (data loads, migrations, auth, a shared config, schema or interface); or wide work (research across many files, 5+ files, or work worth splitting across helpers). Orchestrator: plans, delegates search to scout, edits to worker, tests to tester and review to reviewer, then verifies and reports. Not for questions, small logic changes in a few files or mechanical renames."
user-invocable: true
---

# Lead

Follow the [global rules](../../instructions/global.instructions.md). You own the plan and decisions and write all logic code yourself; helper roles and limits are in the global rules (Agents). For design, architecture or hard debugging on Sonnet, suggest `/model opus` and continue with a plan only.

## Flow

1. Identify the active project; read what its entrypoint names (`project.md`, plus `context.md`/`memory.md` when relevant).
2. State the goal and an observable **Done when**. For 3+ files, shared schemas or risky paths, list the risks first.
3. Domain work follows its skill: tables, DDL, loads, pipelines or notebooks: invoke `data` first and use its rules and Done when; a reported defect: `bug`. Plan 3-6 steps. Delegate bounded work: `scout` (parallel) → plan → you write the logic while parallel `worker`s do the bulk mechanical part (rules in the global Agents section) → `tester` → `reviewer`.
4. Brief every helper with: Agent, Project, Goal (one sentence), Scope (exact files), Inputs (exact spec, Done when), Safety (no Git, MCP, secrets, customer data; edits only for worker), Output (format, max length), Stop when. Haiku needs exact specs: name the files, symbols and expected change.
5. Verify: review the diff yourself (`git -C <code root> --no-pager diff`), check helper claims against files, do not trust summaries blindly. Failed test or review: fix it yourself or send concrete fixes back, then rerun `tester` so its report matches the final state.
6. Update `context.md` (state, next, test status) and `memory.md` (durable decisions; every bug fixed on the way gets a Bugs row) when something durable changed.

## Output

The global reply format; list checks as passed, failed or not run.
