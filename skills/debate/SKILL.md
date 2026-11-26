---
name: debate
description: "Gets an independent second opinion on a major decision from 2 challenger agents in parallel, each with an opposing framing, then shows one comparison table and a recommendation. Use when the user says debate, second opinion or council, or before a costly, hard-to-reverse choice (architecture, data model, public interface, migration, deleting a feature)."
argument-hint: "<decision or plan file>"
---
# Debate

Two independent critics beat one, and 2 calls cost far less than a full council. The user judges.

1. **Frame:** write the decision down once: Goal, Done when, Context (with paths), Options and your Choice. A plan file from `pplan` already has them; otherwise write `<project>/docs/ai/plans/YYYY-MM-DD-<topic>.md` with just those parts.
2. **Brief 2 `challenger` agents in one turn, in parallel**, same file, opposite framings:
   - **A, for the Choice:** "Make the strongest honest case for the Choice; then name where it fails."
   - **B, against it:** "Assume the Choice is wrong; find the option that wins and the failure case that proves it."
   Each gets: the plan path, its framing, "pick your own option before you read the Choice", and "return at most 15 lines". Both use the `challenger` model set in `setup.json`; in Claude Code you may pass a second model to B for vendor diversity, where that model is available.
3. **Compare:** when both return, check each claimed failure case yourself (open the file, count, doc) before it counts.

| Point | Challenger A | Challenger B | Checked | Verdict |
|---|---|---|---|---|

4. **Reply:** the table, then one recommendation with the deciding evidence, then what would change it. Record the outcome in the plan's Challenge table. The decision stays the user's.
