---
name: learn
description: "Use when the user says learn, teach me, explain this stage, or finishes a project stage (requirements, architecture, stack, data model, testing, security...) and wants to study it: researches what industry uses, what is standard, popular and asked for in jobs, and writes one ordered, illustrated study note per topic in the Obsidian vault with the vocabulary, approaches, generic examples, scenarios and mistakes; no quiz questions."
argument-hint: "<stage or topic> [project]"
---
# Learn

Turn one stage or topic into **one** Obsidian note, `Learn/<Topic>.md`, read top to bottom: the mental model first, then what you do daily, then depth, scenarios and mistakes. No questions or quiz section: what interviews ask goes into the sections as content. Facts come from research done in this turn, never from memory alone.

## Steps
1. **Vault:** run `node _ai/vault.mjs` in the workspace root. It prints the vault path, the notes in `Learn` (name, type, topics, aliases) and the PDFs in `Books`. No vault: stop and tell the user to paste its path in the setup page (Obsidian section). Read the vault's `AGENTS.md` and the notes this topic touches. Never open `Personal` or `.mdenc` files.
2. **Context:** when a project is named, read its `docs/ai/project.md` and `context.md` only to choose what matters. The note stays generic: no names of the user's projects, repos, branches, tickets, systems or people; `check` flags workspace project names.
3. **Research:** one `scout` per question, in parallel, each asked for primary sources it opened, with URL and year, at most 35 lines back. Start from [sources.md](sources.md).
   - **Standard:** how the body of knowledge and the standards define the stage; its inputs, outputs, roles and named techniques.
   - **Practice:** what teams use today, what grows or fades (surveys, Technology Radar), with year and sample.
   - **Market:** what job ads, `roadmap.sh` and interview guides ask for at junior-to-mid level.

   Open a source yourself before its fact goes into a note; popularity needs a source at most 2 years old; sources that disagree are both shown. Not opened: leave it out.
4. **Order the note:** only what the user will do, say or be asked. Sections in learning order; each term explained where it is first used; the glossary holds only terms no section explains. An existing note on a term is linked, not repeated.
5. **Write** with [notes.md](notes.md) from [topic.md](topic.md): `Learn/<Topic>.md`, pictures in `Files/`. Link the topic from `Learn/Learning map.md` and from the previous stage's `next`.
6. **Cut:** reread every line and delete it if the reader would not miss it (see Content rules).
7. **Check:** `node _ai/vault.mjs check "<Topic>"` until it prints `clean`. A rule that does not fit a topic is named in the reply, never worked around.
8. **Link:** add the note's path to the stage's row in the active plan, if there is one.
9. **Reply:** the bottom line, the 3 terms that matter most, the path of the note.

**Same topic again:** edit in place and set `updated`. Add and correct; never delete or rewrite the user's text, and never touch `## In my own words`. A renamed note breaks links: renaming is the user's, in Obsidian.

## How the note teaches
- **Dual coding:** every section has a diagram, table, picture or steps whose labels match the text.
- **Low load:** one idea per section, at most 2 levels (seen, folded); depth lives in folded callouts.
- **Examples:** generic and concrete (a `feat/login` branch, ticket `PROJ-123`), only where a table or command alone does not make the point.

## Content rules
- **Useful only:** every line is something the reader will do, say or be asked. Cut: a point said twice (a scenario that repeats a table, a glossary entry a section already explains), links forced to unrelated topics, an example or trade-off that says nothing ("one extra step"), options and settings few teams use.
- **Industry terms:** the exact words of meetings, job ads and interviews, each explained once in plain words.
- **Status words:** `standard`, `common`, `growing`, `niche` or `legacy`, only in an approach table, with a source and year.
- **Interview topics:** what interview guides ask (opened in step 3) is covered in the sections as plain content (a comparison table, a command), never as a question list.
- **Subject only:** nothing on how or when to study. **Cut** history, trivia and options no team uses today.
