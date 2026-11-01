---
name: p
description: "Turn a rough request into a clear prompt (Goal, Scope, Done when, Constraints, Unclear) and wait for approval before doing anything. Only when the user types /p."
argument-hint: "<rough request>"
user-invocable: true
disable-model-invocation: true
---
# Prompt

Rewrite the user's rough request; never start the work in this turn.

1. Read only what the request names (paths, project), enough to name real files. No edits, no commands with side effects, no helpers.
2. Reply in English, nothing else:

```
Goal: <one sentence>
Scope: <files, folders, project; what must not change>
Done when: <observable checks>
Constraints: <limits from the request and the core rules that matter here>
Unclear: <only questions that change the result, each with a recommended answer; omit if none>
-> OK? (yes / correct me)
```

3. Keep the user's intent and words for decisions; add nothing they did not ask for. Several tasks: number them in Goal in the order they must run.
4. On "yes", do the task as written, with the normal rules; on a correction, rewrite and ask again.
5. No request after `/p`: ask only for the text to rewrite.
