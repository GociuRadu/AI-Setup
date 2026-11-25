# Note format

`node _ai/vault.mjs check "<Topic>"` enforces most of this. Behaviour measured in Obsidian 1.15.

## One note per topic
- `Learn/<Topic>.md` holds the whole topic; the name is short and title style (`Git`, not a sentence), unique in the vault, without `: / \ # ^ [ ] |`. `aliases` hold abbreviations.
- Generic examples only: no names of the user's projects, repos, branches, tickets, systems or people. Use `feat/login`, `PROJ-123`, "a web app".
- Links go to other topics and to the `Learning map`; say the relation next to the link: `[[Architecture]]: sets the parts a repo ships`. Properties `previous` and `next` are quoted, `"[[Name]]"`, and repeated as a link in the text, because the properties panel is hidden while reading.
- In a table a label needs `\|`: `[[NFR\|quality]]`.

## Scanning
- At most 1500 visible words (folded callouts, code and footnotes do not count). Paragraphs: at most 2 sentences, 50 words.
- First block is `> [!abstract]`, at most 40 words. No `#` heading: the file name is the title; Obsidian's outline is the contents list.
- Headings are numbered in reading order and state the point in the first words ("1. A change moves through 3 areas"), never "Overview".
- Order: bottom line, mental model, daily use, approaches, scenarios, mistakes, glossary, sources. No questions section; `check` flags `[!question]` callouts.
- Commands go inside the steps or table rows that use them, not repeated in a separate block.
- Callouts: `abstract` bottom line, `example` worked case, `warning` mistake, `quote` how to say it, `info` depth. Fold with `-`. No HTML.

## Diagrams
- At least 2 Mermaid diagrams, one idea each. Pick by the question: steps or a decision `flowchart TD`; who calls whom `sequenceDiagram`; states `stateDiagram-v2`; data `erDiagram`; branches over time `gitGraph`; 2 axes `quadrantChart`; time `timeline`; parts of one thing `mindmap`.
- At most 10 nodes, and `flowchart LR` only up to 4: wider ones are unreadable on a phone. Short labels; `<br>` is allowed inside a label.
- No colours in Mermaid: the theme sets them for dark and read mode.

## Pictures
- At least 1 per note: a self-drawn `Files/<Topic> - <what>.svg`, or an image under a free licence with its source in the caption. Embed with `![[name.svg|480]]` and put one sentence under it that says what to see.
- SVG: `viewBox="0 0 W H"` with W at most 520, no page background, every text inside a filled box of medium tone (white on `#3f5273`, `#5a6379`, `#3a6b4a` or `#7a5a2c`) so that it reads on black and on paper, text at least 16 px, a `<title>`; plain shapes and text only.
- A page of a book in `Books`: `[[file.pdf#page=12|p. 12]]`, only after reading that page.

## Sources
- Footnotes: `text[^1]` and `[^1]: [Title](https://...), 2026`. One per fact that could be wrong. A fact whose source was not opened in this run is left out, not listed.
