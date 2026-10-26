---
name: p
description: "Turn a rough request into a clear prompt (Goal, Scope, Done when, Constraints, Unclear) and wait for approval before doing anything. Only when the user types /p."
argument-hint: "<rough request>"
user-invocable: true
disable-model-invocation: true
model: claude-haiku-5-5
---

# Prompt

Rewrite the user's rough request; never start the work.

1. Read only what the request names (paths, project), enough to name real files. No edits, no commands with side effects.
2. Reply in English, nothing else:

```
Goal: <one sentence>
Scope: <files, folders, project; what must not change>
Done when: <observable checks>
Constraints: <limits from the request and the global rules that matter here>
Unclear: <only questions that change the result, each with a recommended answer; omit if none>
→ OK? (yes / correct me)
```

3. Keep the user's intent and words for decisions; add nothing they did not ask for. Several tasks: number them in Goal in the order they must run.
4. On "yes", do the task as written; on a correction, rewrite and ask again.
