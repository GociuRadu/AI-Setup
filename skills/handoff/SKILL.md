---
name: handoff
description: "Hands the current work to a new chat or another agent: updates the project's context.md first, then prints a short paste-ready brief that points to it and adds only the mid-task details. Use when the user says handoff, continue in a new chat, or pass this work to another agent or tool."
argument-hint: "[next goal or target tool]"
---
# Handoff

1. **Update `context.md`** of the active project: replace its stale lines with the current state, open work and decisions from this session, so the next agent starts from the file, not the chat. Decisions with a reason also go into `memory.md`.
2. **Print one brief**, at most 25 lines, in a ````markdown fence so inner code blocks survive. Use only facts from this chat and files already read; done means verified, with the command that showed it.

```
# Handoff: <topic>
Project: <folder>; repo <project>/code; branch <name, if known>
Read first: <project>/docs/ai/context.md, <active plan, if any>

Goal: <one sentence>. Done when: <observable check>
Files in play: <paths>
Just tried: <command or change> -> <result, key error line>
Next step: <exact step> in <path>; check: <command>
Not verified: <items>
```

Reply with the block and one line naming the tool to use in the new chat (Claude Code, Copilot or Kiro).
