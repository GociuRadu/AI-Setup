---
name: retro
description: "Use after a task, bug fix or tricky session when the user says retro, save what we learned, capture rules, or improve the setup: reviews the session for recurring mistakes or non-obvious findings and proposes 1-2 line updates to memory.md, AGENTS.md or skills for approval."
argument-hint: "[project or topic]"
---
# Retro

Capture only lessons that prevent a repeat mistake or save real time later. Propose the smallest diff and wait for approval; never edit rules or prompts silently.

## Steps

1. **Collect:** scan this session (or the named diff or project) for concrete friction: a non-obvious bug cause, a corrected assumption, a tool or command gotcha, or a rule that was missed or bloated. Skip one-off typos and documented facts.
2. **Place** each item in one existing file (at most 3 total):
   - Project bug or decision → `<project>/docs/ai/memory.md` (merge into an existing row; mark replaced decisions `superseded`, never delete).
   - Cross-project rule or agent/skill change → `AGENTS.md` or `_ai/` (prefer tightening or deleting over adding).
   - Personal workflow or tool quirk → user memory (`/memories/`), 1 bullet.
3. **Propose:** flat list with target file, exact 1-2 line diff, and the concrete failure it prevents.
4. **Apply after approval:** edit the approved items; if `AGENTS.md` or `_ai/` changed, run `node _ai/sync.mjs`, `node _ai/sync.mjs --check` and `node --test "_ai/**/*.test.mjs"`.

## Rules

- **Delete over add:** if a rule caused churn or a hook already enforces it, propose removing it.
- **Concrete only:** cite the exact symptom or command from this session; no generic advice ("be careful", "test thoroughly").
