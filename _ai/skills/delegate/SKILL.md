---
name: delegate
description: "Use to split work across the helpers scout, tester, worker, reviewer and challenger: tasks with 3+ steps or files, wide searches (files, logs, web), test suites, coding from a clear spec, a code review or audit, a second opinion on an expensive design choice; also when the user says delegate, orchestrate or use subagents."
argument-hint: "<task>"
---
# Delegate

You decide, design and verify; helpers do the token-heavy work on cheaper models. Everything they return lands in your context, so ask for little.

| Work | Helper |
|---|---|
| Find code, patterns, log lines, web facts | `scout` |
| Run a suite, lint or any long-output command | `tester` |
| Write code and tests from a precise spec; local scripts | `worker` |
| Review a change, an audit or a plan; risky work: data, schema, auth, shared interfaces, 5+ files of logic | `reviewer` |
| Second opinion on a plan with Options and an expensive Choice | `challenger` |
| Design, data model, interfaces, trade-offs, the final check | you |

## Rules

- **No plan file** for a large task (as the `pplan` skill defines it): run `pplan` first.
- **Do it yourself** when one read answers or the edit is under ~20 lines in 1-2 files; a brief, a run and a check cost more.
- **Design first:** settle interfaces, names and data shapes before a `worker` starts; a worker never chooses them.
- **Parallel readers:** `scout`, `tester`, `reviewer` and `challenger` run in parallel in one turn, even across roles (at most 4 at once).
- **Writers:** one `worker` per file set on a shared checkout. In Claude Code, overlapping edits or separate branches use `isolation: "worktree"` (or `claude -w <name>`) only inside a project's git repo (a workspace-root worktree omits gitignored `<project>/code/`), `/subtask` when parallel branches share the session cache, and `/batch` for 5-30 mechanical edits.
- **Failed run:** fix the brief (missing fact, vague spec) and rerun once; after two failures do it yourself, or name the step as open when you have no tool for it.

## Task loop

Run each plan step (or the whole task when there is no plan) through:
1. **Do:** you or `worker` makes the change.
2. **Check:** run the step's Check (`tester` for suites or long output). Red: fix and rerun; each round needs a new fact.
3. **Review:** risky step: `reviewer`. A Must fix goes back to 2 or is named as open; re-review once at most.
4. **Mark:** set the step's Status to done from the real check output and the changed files you read; a helper's summary is not proof.

Repeat until every Done when check passes. Follow **Stuck** in `AGENTS.md` (after 2 failed fixes change the approach; after 3, stop; the same failure twice counts).

## Brief

Helpers see none of this chat. Pass paths, never pasted file content.

```
Goal: <one sentence>
Project: <folder>; files/symbols: <exact paths>
Spec: <worker: what changes, interfaces, names, edge cases, tests to add; tester: the exact commands when not in project.md>
Constraints: <read-only or edit; what not to touch>
Done when: <observable check: a named test passes, a command output>
Return: <format, max N lines, evidence as path:line or command output>
```
