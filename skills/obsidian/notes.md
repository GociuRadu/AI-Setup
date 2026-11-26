# Note format

`node <skill dir>/scripts/vault.mjs check` enforces most of this. Behaviour measured in Obsidian 1.15.

## Every note
- English, short and plain. A note's name is short and title style, unique in the vault, without `: / \ # ^ [ ] |`; `aliases` hold abbreviations.
- Properties `created` and `updated` are `YYYY-MM-DD`; `type` is `topic`, `map`, `book` or `video` where the note has one. A note made from `Templates` drops the `home-folder`, `home-label`, `home-icon` and `home-order` settings.
- Links: `[[Name]]` to notes that exist; in a table a label needs `\|`: `[[NFR\|quality]]`. A page of a book in `Books`: `[[file.pdf#page=12|p. 12]]`, only after reading that page. PDFs are not synced, so a link to one missing on this device stays as it is. A video links to the second: `https://www.youtube.com/watch?v=ID&t=90s`.
- Callouts: `abstract` bottom line, `example` worked case, `warning` mistake, `quote` how to say it, `info` depth. Fold with `-`. No HTML.

## Study notes (`type: topic`, in `Learn`)

### One note per topic
- `Learn/<Topic>.md` holds the whole topic, diagrams included: no concept notes, no loose picture files.
- Generic examples only: no names of the user's projects, repos, branches, tickets, systems or people. Use `feat/login`, `PROJ-123`, "a web app".
- Links go to other topics and to the `Learning map`; say the relation next to the link: `[[Architecture]]: sets the parts a repo ships`. Properties `previous` and `next` are quoted, `"[[Name]]"`, and repeated as a link in the text, because the properties panel is hidden while reading.
- A canvas for the topic is `Learn/<Topic>.canvas`, linked from the note and from `Learning map`.

### Scanning
- At most 1500 visible words (folded callouts and code do not count). Paragraphs: at most 2 sentences, 50 words.
- First block is `> [!abstract]`, at most 40 words. No `#` heading: the file name is the title; Obsidian's outline is the contents list.
- Headings are numbered in reading order and state the point in the first words ("1. A change moves through 3 areas"), never "Overview".
- Order: bottom line, mental model, daily use, approaches, scenarios, mistakes, glossary. No questions section and no sources section: `check` flags `[!question]` callouts and footnotes.
- Commands go inside the steps or table rows that use them, not repeated in a separate block.

### Diagrams
- At least 2 Mermaid diagrams, one idea each; a Mermaid diagram is the note's picture. Pick by the question: steps or a decision `flowchart TD`; who calls whom `sequenceDiagram`; states `stateDiagram-v2`; data `erDiagram`; branches over time `gitGraph`; 2 axes `quadrantChart`; time `timeline`; parts of one thing `mindmap`.
- At most 10 nodes, and `flowchart LR` only up to 4: wider ones are unreadable on a phone. Short labels; `<br>` is allowed inside a label.
- No colours in Mermaid unless the user asks: the theme sets them for dark and read mode.
- An image the user already has may be embedded (`![[name.svg|480]]`, one sentence under it). An SVG has `viewBox="0 0 W H"` with W at most 520, a `<title>`, text at least 16 px, plain shapes and text only.
