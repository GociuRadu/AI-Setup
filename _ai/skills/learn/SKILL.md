---
name: learn
description: "Use when the user says learn, teach me, explain this stage, or finishes a project stage (requirements, architecture, stack, data model, testing, security...) and wants to study it: researches what industry uses, what is standard, popular and asked for in jobs, and writes linked, illustrated study notes in the Obsidian vault with the vocabulary, approaches, a worked example from the project and interview questions."
argument-hint: "<stage or topic> [project]"
---
# Learn

Turn one stage or topic into linked Obsidian notes: a topic note the user scans in 2 minutes, and one short note per key term for the 30-minute read. Facts come from research done in this turn, never from memory alone.

## Steps
1. **Vault:** run `node _ai/vault.mjs` in the workspace root. It prints the vault path, the notes in `Learn` (name, type, topics, aliases) and the PDFs in `Books`. No vault: stop and tell the user to paste its path in the setup page (Obsidian section). Read the vault's `AGENTS.md` and the notes this topic touches. Never open `Personal` or `.mdenc` files.
2. **Context:** read `<project>/docs/ai/project.md`, `context.md`, the active plan and the decisions (ADRs, `memory.md`) for this stage. The worked example and the questions use this project's real decisions.
3. **Research:** one `scout` per question, in parallel, each asked for primary sources it opened, with URL and year, at most 35 lines back. Start from [sources.md](sources.md).
   - **Standard:** how the body of knowledge and the standards define the stage; its inputs, outputs, roles and named techniques.
   - **Practice:** what teams use today, what grows or fades (surveys, Technology Radar), with year and sample; one real case.
   - **Market:** what job ads, `roadmap.sh` and interview guides ask for at junior-to-mid level.
   - **Project:** only when the stage has an open choice, the options for this project's constraints.

   Open a source yourself before its fact goes into a note; popularity needs a source at most 2 years old; sources that disagree are both shown. Not opened: it goes in the `Not verified` callout or out.
4. **Choose the notes:** one topic note, 5 to 9 concept notes. A term gets its own note when a meeting or interview uses it and it needs an example; the rest stays in a table. A term that already has a note (by name or alias) is **reused**: add the new topic to its `topic` list.
5. **Write** with [notes.md](notes.md) from [topic.md](topic.md) and [concept.md](concept.md): `Learn/<Topic>.md`, `Learn/<Term>.md`, pictures in `Files/`. Link the topic from `Learn/Learning map.md` and from the previous stage's `next`.
6. **Check:** `node _ai/vault.mjs check "<Topic>"` until it prints `clean`. A rule that does not fit a topic is named in the reply, never worked around.
7. **Link:** add the note's path to the stage's row in the active plan, if there is one.
8. **Reply:** the bottom line, the 3 terms that matter most, the path of the topic note.

**Same topic again:** edit in place and set `updated`. Add and correct; never delete or rewrite the user's text, and never touch `## In my own words`. A renamed note breaks links: renaming is the user's, in Obsidian.

## How the notes teach
- **Retrieval practice:** each question is visible, its answer is folded; the reader answers before opening it.
- **Interleaving:** 2 of the questions mix in terms from earlier topics, as links.
- **Worked example:** the stage applied to this project, as before and after.
- **Dual coding:** every section has a diagram, table, picture or steps whose labels match the text.
- **Elaboration:** every term and approach has a why, a trade-off and links that say how it relates.
- **Low load:** one idea per section, at most 2 levels (seen, folded); depth lives in concept notes.

## Content rules
- **Industry terms:** the exact words of meetings, job ads and interviews, each explained once in plain words.
- **Status words:** `standard`, `common`, `growing`, `niche` or `legacy`, with a source and year.
- **Interview answers:** claim, why, example from this project, trade-off. One question is a senior follow-up.
- **Subject only:** nothing on how or when to study. **Cut** history, trivia and options no team uses today.
