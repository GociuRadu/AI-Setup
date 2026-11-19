---
name: learn
description: "Use when the user says learn, teach me, explain this stage, or finishes a project stage (requirements, architecture, stack, data model, testing, security...) and wants to study it: researches what industry uses, what is standard, popular and asked for in jobs, and writes a study report with the vocabulary, approaches, a worked example from the project and interview questions."
argument-hint: "<stage or topic> [project]"
---
# Learn

Turn one stage or topic into a study report the user can scan in 2 minutes, learn in 30, and explain in a meeting or interview. Facts come from research done in this turn, never from memory alone.

## Steps
1. **Context:** read `<project>/docs/ai/project.md`, `context.md`, the active plan, the decisions (ADRs, `memory.md`) for this stage, and earlier `*-learn-*` reports. The worked example and the questions must use this project's real decisions.
2. **Research:** one `scout` per question, in parallel, each asked for primary sources with URL and year, at most 25 lines back:
   - **Standard:** how the body of knowledge and standards define the stage; its inputs, outputs, roles and the named techniques.
   - **Practice:** what teams use today and what is growing or fading (surveys, Technology Radar), with year and sample.
   - **Market:** what job ads, `roadmap.sh` and interview guides ask for at junior-to-mid level; the questions asked in interviews and meetings.
   - **Project:** only when the stage has an open choice, the options for this project's constraints.
   Start from [sources.md](sources.md). Verify each fact you keep in the source itself. Popularity claims need a source at most 2 years old. Mark facts that are opinions or secondary as **U** and name what would confirm them. If sources disagree, show both.
3. **Write** a Markdown file (never HTML) at the path the user gives, else `learn/<project>/<topic>.md` in the workspace root: copy [template.md](template.md) and fill it. Follow the scan limits in `_ai/rules/report.md` by hand: at most 600 visible words outside `<details>`, headings that state a conclusion, a table or diagram in every section, and paragraphs of at most 2 sentences. Diagrams are Mermaid. Same topic again: edit the existing file.
4. **Link:** add the file path to the stage's row in the active plan, if there is one.
5. **Reply:** the bottom line, the 3 terms that matter most, and the report link.

## How the report teaches
Each rule maps to a technique with strong evidence (Dunlosky et al. 2013; Roediger & Karpicke 2006; Mayer):
- **Retrieval practice:** questions are visible, answers stay in a collapsed block, and the reader answers before opening it. This technique has the best evidence of all.
- **Interleaving:** 2 of the questions mix in terms from earlier `learn` reports or earlier stages.
- **Concrete and worked examples:** every abstract term gets one real case. The worked example applies the stage to this project as a before and after.
- **Dual coding:** each section has one diagram or table whose labels match the text.
- **Elaboration:** every approach has a "why" and a trade-off, never only a definition.
- **Low cognitive load:** one idea per section and headings that state the claim. Depth goes into collapsed `Deep dive` blocks, so the first screen stays short.

## Content rules
- **Industry terms:** use the exact words used in meetings, job ads and interviews (for example "acceptance criteria", "NFR", "trade-off"). Explain each term once in plain words. The vocabulary table gives a sentence for each term the way a mid-level engineer would say it.
- **Status words:** label each technique `standard`, `common`, `growing`, `niche` or `legacy`, with a source and year.
- **Interview answers:** use the shape claim, then reason, then example from this project, then trade-off. A senior follow-up question tests depth.
- **Subject only:** no sections on how or when to study (re-test schedules, review dates, study tips).
- **Cut:** history, trivia and options no team uses today. Name what you left out in one line in Evidence.
