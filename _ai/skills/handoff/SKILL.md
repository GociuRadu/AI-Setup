---
name: handoff
description: "Use when the user says handoff, continue in a new chat, or pass this work to another agent. Prints one paste-ready brief in chat; writes no files."
argument-hint: "[next goal or target agent]"
---
# Handoff

Print one brief the user copies into a new chat (Claude Code, Kiro or Copilot). Write no files and run nothing new; use only facts from this chat and files already read.

- **Self-contained:** the next agent sees none of this chat. Workspace-relative paths; no pasted file content, only the key error line or command.
- **Facts only:** done means verified, with the command or test that showed it; everything else goes under Not verified.
- **Short:** at most 40 lines, in English, wrapped in a ````markdown fence so inner code blocks survive.

```
# Handoff: <topic>
Project: <folder>; repo <project>/code; branch <name, if known>
Read first: <project>/docs/ai/project.md, <active plan or context.md, if any>
Model: <Opus for design or hard debugging | Sonnet>

## Goal
<one sentence>. Done when: <observable check>

## State
- Done: <change> in <path> (verified: <command> -> <result>)
- Decided: <decision> because <reason>
- Not verified: <item>

## Next steps
1. <step> in <path>; check: <command>

## Watch out
- <trap, blocker, or open question with the recommended answer>
```

Reply with the block and one line: which agent to pick in the new chat.
