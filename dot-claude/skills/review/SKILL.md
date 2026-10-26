---
name: review
description: "Senior-dev quality review: bugs, security, data loss, load, missing tests, speed, bloat. Scope = a change/named files (findings in chat) or a whole project/folder audit (saved report). Changes no code. Use for review this, code review, review my PR, audit, find bloat; to explain or document code use analyze."
argument-hint: "[files, folder, or 'audit' for the whole active project]"
user-invocable: true
license: MIT
---

Adapted from [ponytail](https://github.com/DietrichGebert/ponytail) (MIT, DietrichGebert); see `_ai/SOURCES.md`.

Review like the senior developer who will be paged when it breaks. Order: correct, safe, holds under load, tested, fast, lean.

## 1. Scope

- **Change review:** files or a diff the user names. Nothing named: if `project.md` names a Git root, read `git -C <root> --no-pager diff HEAD`, and on a branch also `git -C <root> diff <main>...HEAD` (as the permissions allow); ask only if both are empty.
- **Audit:** a folder or the whole active project (the AI setup only on request). Big repo: go deep where a mistake costs most and list what you did not read.
- Read the change, then connected code: callers of every changed function, what it calls, tests, and the project's **Review focus** in `project.md`. Skip `.venv`, data files, secrets and the project's never-open list.
- Find the expected load (one user running a script vs many processes) and say which you assumed.

## 2. Look for

- The checklist of the [reviewer agent](../../agents/reviewer.md) (bug, data loss, security, missing test, scope).
- **Scale:** check-then-write races, same work in every process, unbounded growth, a query per item, O(n^2) on big input.
- **Speed:** big slowdowns are problems; small wins are suggestions.
- **Lean:** dead code, unused options, abstraction with one implementation, an existing helper or stdlib feature not reused, near-copies. Before calling code unused, search the whole project including tests, config and string references.

## 3. Check before reporting

Every finding needs a concrete case ("this input leads to this wrong result"); re-read the lines to confirm. A `shortcut:` comment that names its limit is a decision, not a finding, unless the load already crosses it. Propose the smallest fix; prefer deletion. No style taste, no "consider".

## 4. Output

Very simple English. Start with `What this change does:` (or `What this repo does:` for an audit) in 2-3 sentences. Then numbered findings in the [reviewer agent](../../agents/reviewer.md)'s levels (Must fix also covers code that breaks at load), plus **Nice to have** (small cleanups, minor speed or lean wins). Skip empty groups; audit max 20 findings.

Each finding: `path:Lx-Ly`, the problem with a concrete example, the fix.

End with `Verdict: ready | fix first: 1, 3`, `Lean: -<N> lines possible.` if relevant, `Not checked:` if something mattered.

- Change review: findings in chat.
- Audit: save to `<project>/docs/ai/reports/YYYY-MM-DD-review-<topic>.md` (update an existing report on the same scope instead of duplicating); in chat give only path, verdict, counts per group and what was not checked.
