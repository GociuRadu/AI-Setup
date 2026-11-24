# Note format

`node _ai/vault.mjs check "<Topic>"` enforces most of this. Behaviour measured in Obsidian 1.15.

## Links and graph
- The graph is built from `[[links]]` in text, properties, tables, callouts and footnotes. Links inside Mermaid are clickable but **not** in the graph: list each one in the text too.
- Say the relation next to the link: `[[NFR]]: sets the target the style must meet`. A bare list of links teaches nothing.
- Properties carry the structure: topic notes `previous` and `next`; concept notes `topic` (a list, so a term can belong to several topics). Quote them: `"[[Name]]"`, and repeat each one as a link in the text, because the properties panel is hidden while reading.
- In a table a label needs `\|`: `[[NFR\|quality]]`. `aliases` hold abbreviations and plurals.
- Names are unique in the vault, title style, without `: / \ # ^ [ ] |`. Links and properties replace folders; notes stay flat in `Learn`.

## Scanning
- Topic note: at most 600 visible words (folded callouts, code and footnotes do not count); concept note: at most 200 before `## In my own words`. Paragraphs: at most 2 sentences, 50 words.
- First block is `> [!abstract]`, at most 40 words. No `#` heading: the file name is the title.
- Headings state the point in the first words ("Architecture drivers come before styles"), never "Overview".
- Order: bottom line, where it sits, terms, approaches, example, mistakes, questions, concept map, sources.
- Callouts: `abstract` bottom line, `example` project case, `warning` mistake, `question` retrieval, `quote` how to say it, `info` depth. Fold with `-`. No HTML.

## Diagrams
- At least 2 Mermaid diagrams in a topic note, one idea each. Pick by the question: steps or a decision `flowchart TD`; who calls whom `sequenceDiagram`; states `stateDiagram-v2`; data `erDiagram`; 2 axes `quadrantChart`; time `timeline`; parts of one thing `mindmap`.
- At most 10 nodes, and `flowchart LR` only up to 4: wider ones are unreadable on a phone. At most 2 branches side by side where possible. Short labels; `<br>` is allowed inside a label. Edges in a concept map carry a verb.
- Clickable nodes: `class a,b internal-link`, the label is the exact note name.
- No colours in Mermaid: the theme sets them for dark and read mode.

## Pictures
- At least 1 per topic note: a self-drawn `Files/<topic> - <what>.svg`, or an image under a free licence with its source in the caption. Embed with `![[name.svg|480]]` and put one sentence under it that says what to see.
- SVG: `viewBox="0 0 W H"` with W at most 520, no page background, every text inside a filled box of medium tone (white on `#3f5273`, `#5a6379`, `#3a6b4a` or `#7a5a2c`) so that it reads on black and on paper, text at least 16 px, a `<title>`; plain shapes and text only.
- A page of a book in `Books`: `[[file.pdf#page=12|p. 12]]`, only after reading that page.

## Sources
- Footnotes: `text[^1]` and `[^1]: [Title](https://...), 2026`. One per fact that could be wrong. Not opened in this run: `> [!warning]- Not verified`, with what would confirm it.
