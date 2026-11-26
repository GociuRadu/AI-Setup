---
name: obsidian
description: "Writes and edits anything in the user's Obsidian vault: Markdown notes (.md), Bases (.base), Canvas files (.canvas) and Obsidian settings, above all study notes in Learn. Use when the user says learn, teach me or explain this stage or topic, finishes a project stage and wants to study it, or asks to create, edit, rename, link or organise vault notes, bases or canvases. For study notes it researches what industry uses, what is standard and what interviews ask, then writes one ordered, illustrated note per topic."
argument-hint: "<topic, stage, note or change> [project]"
---
# Obsidian

The vault is plain files. Obsidian Sync is its only second copy and its only undo, so edit with care.

## Every vault file
1. **Find the vault:** `node <skill dir>/scripts/vault.mjs` prints the vault path, the notes (path and type) and the PDFs in `Books`. No vault: stop and tell the user to rerun the install, which records the vault path. Read the vault's `AGENTS.md` and the notes the change touches.
2. **The user's words stay:** add and correct, don't rewrite or delete the user's text; `## In my own words` is the user's alone.
3. **Links:** renaming or moving a note keeps every `[[link]]` to it working: search the vault for the old name and update the links in the same change.
4. **Check:** `node <skill dir>/scripts/vault.mjs check "<note>"` until it prints `clean`; `check` alone checks every note, base and canvas. A rule that does not fit is named in the reply, never worked around.

`<skill dir>` is the folder holding this file: `.claude/skills/obsidian`, `.github/skills/obsidian` or `.kiro/skills/obsidian` in the workspace.

| File | Read first |
|---|---|
| Note (`.md`) | [notes.md](notes.md) |
| Study note in `Learn` (`type: topic`) | the steps below, [notes.md](notes.md), [topic.md](topic.md) |
| Base (`.base`) | [bases.md](bases.md); every function in [bases-functions.md](bases-functions.md) |
| Canvas (`.canvas`) | [canvas.md](canvas.md); full examples in [canvas-examples.md](canvas-examples.md). |
| `.obsidian/` settings, snippets, plugins | the vault's `AGENTS.md`; no new plugin without a problem the user named |

## Study notes
Turn one stage or topic into **one** note, `Learn/<Topic>.md`, read top to bottom: the mental model first, then daily use, then depth, scenarios and mistakes. Facts come from research done in this session, never from memory alone. Write in the main chat: only it sees the conversation the note comes from.

1. **Context:** when a project is named, read its `docs/ai/project.md` and `context.md` only to choose what matters; the note stays generic ([notes.md](notes.md)).
2. **Research:** one `researcher` per question, in parallel, each asked for primary sources it opened, with URL and year, at most 35 lines back. Start from [sources.md](sources.md).
   - **Standard:** how the body of knowledge and the standards define the topic; its inputs, outputs, roles and named techniques.
   - **Practice:** what teams use today, what grows or fades (surveys, Technology Radar), with year and sample.
   - **Market:** what job ads, `roadmap.sh` and interview guides ask at junior-to-mid level.

   Open a source yourself before its fact goes into the note; popularity needs a source at most 2 years old; sources that disagree are both shown. Not opened: leave it out. A fact that can age carries its year inline ("standard since 2024").
3. **Order:** sections in learning order; each term explained where first used; the glossary holds only terms no section explains. An existing note on a term is linked, not repeated.
4. **Write** with [notes.md](notes.md) from [topic.md](topic.md). Link the topic from `Learn/Learning map.md` and from the previous topic's `next`.
5. **Cut** every line the reader would not miss (**Useful only** below), **check**, then **reply:** the bottom line, the 3 terms that matter most, the path of the note.

**Same topic again:** edit in place and set `updated`.

## How a study note teaches
- **Dual coding:** every section has a diagram, table or steps whose labels match the text.
- **Low load:** one idea per section, at most 2 levels (seen, folded); depth lives in folded callouts.
- **Examples:** only where a table or command alone does not make the point.
- **Useful only:** every line is something the reader will do, say or be asked. Cut a point said twice, links forced to unrelated topics, an example or trade-off that says nothing, options few teams use, history and trivia.
- **Industry terms:** the exact words of meetings, job ads and interviews, each explained once in plain words. Status words (`standard`, `common`, `growing`, `niche`, `legacy`) only in an approach table, with a year.
- **Subject only:** what interviews ask is covered as content (a comparison table, a command), never as a question list; nothing on how or when to study (no re-test schedules, no study methods).
