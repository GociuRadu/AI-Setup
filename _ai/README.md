# AI core

User guide: [HOW-TO-USE.md](../HOW-TO-USE.md).

## Layout

| Path | Purpose |
|---|---|
| `CLAUDE.md`, `AGENTS.md` | Entrypoints; `CLAUDE.md` imports the global rules and permissions |
| `dot-claude/instructions/` | `global` (same everywhere), `permissions` (home), `python`, `sql` |
| `dot-claude/rules/` | Load the `python`/`sql` rules for `.py`/`.sql` files |
| `dot-claude/agents/` | `scout`, `worker`, `tester`, `reviewer` |
| `dot-claude/skills/` | `review`, `bug`, `analyze`, `data`, `confluence`, `ponytail`, `p` |
| `dot-claude/hooks/` | `block-db-writes.mjs` + its self-test |
| `dot-claude/settings.json` | Home permissions and the hook |
| `_ai/work/permissions.instructions.md` | Work permissions (the only work-only file) |
| `_ai/templates/` | Project skeletons `app` and `data-eng`; placeholders `{{PROJECT}}`, `{{project}}` (lowercase), `{{DATE}}` |
| `_ai/scripts/build.mjs` | Builds the home (`.claude`) and work (`.github`) workspaces |
| `_ai/scripts/new-project.mjs` | Creates a project from a template; never overwrites |

## Build

`build.mjs --home <dir>` copies everything with `dot-claude` renamed to `.claude`. `build.mjs --work <dir>` writes `.github/` for Copilot: agent headers converted (tools, models: Haiku 5.5 + GPT-6 Luna, Sonnet 5.5 for `reviewer`), `applyTo` on the rules, the work permissions, the hook in Copilot format, `.claude/` paths renamed. It clears and rewrites only the generated folders (home: `.claude/{agents,skills,instructions,rules,hooks}`; work: `.github/{agents,skills,instructions}`), so a removed skill or agent disappears; everything else is only added or overwritten. Run it from this source repo; `new-project.mjs` is copied into each workspace and runs there.

## Maintenance

- Behaviour is never per setup: a difference goes only into the two permissions files.
- Add a skill: `dot-claude/skills/<name>/SKILL.md`; record external sources in `SOURCES.md`.
- Change a model: `model:` in the agent header, and the mapping in `build.mjs` for Copilot.
- Hook change: run `node dot-claude/hooks/block-db-writes.test.mjs`.
- After any change: run `build.mjs`, start a new session, commit.
