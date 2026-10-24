# Anonymized Work Setup

Structure-only copy of a multi-project VS Code workspace and its AI (Copilot) setup. `project1` (data/Synapse project) and `project2` (Python API service) are neutral names. It contains setup files and empty project folders, no application source, customer data, credentials, environment values or private notes.

Refresh with `_ai/scripts/sync-to-vault.ps1` in the real workspace. Files listed below but absent here (workspace file, `_ai/config/`, `_ai/scripts/`, `hooks/command-approval.json`, project code, `project2/docs/DOCUMENTATION.md`) exist only in the real workspace; links to them are expected to break in this copy.

```text
Setup/
├── structure.md
└── work/
    ├── HOW-TO-USE.md
    ├── Work.code-workspace          # folders: _ai, project1, project2
    ├── _ai/
    │   ├── README.md, SOURCES.md
    │   ├── config/ai.config.json
    │   ├── scripts/{new-project,sync-config}.ps1
    │   ├── templates/project/{.github/copilot-instructions.md, docs/ai/{project,context,memory}.md}
    │   └── .github/
    │       ├── copilot-instructions.md
    │       ├── agents/{lead,scout,worker,tester,reviewer}.agent.md
    │       ├── hooks/{command-approval,prod-guard}.json, prod-guard.ps1, prod-markers.txt
    │       ├── instructions/{global,python,sql}.instructions.md
    │       ├── skills/{analyze,bug,confluence,data,ponytail,review}/
    │       └── user/                # user-level setup kept with the repo copy
    │           ├── repo-memory/{ai-setup,testing}.md
    │           └── mcp-config.template.json # MCP servers, values redacted
    ├── project1/                    # data project
    │   ├── README.md
    │   ├── .github/copilot-instructions.md
    │   ├── .vscode/settings.json
    │   ├── local/                   # local Docker test setup
    │   │   ├── docker-compose.yml, README.md, test.ps1
    │   │   └── runner/Dockerfile
    │   ├── docs/ai/{project,context,memory}.md, reports/
    │   └── Data/ Notebooks/ pipelines/ TablesDataBase/ tests/{unit,spark,sql,support,fixtures}/   # empty
    └── project2/                    # API service
        ├── README.md
        ├── .github/copilot-instructions.md
        ├── Dockerfile, Jenkinsfile, Deployment.yaml, Ingress.yaml
        ├── pyproject.toml (no dependencies), renovate.json
        ├── .dockerignore, .gitignore, .pre-commit-config.yaml
        ├── checks/owasp-exclude.xml
        ├── docs/ai/{project,context,memory}.md, reports/
        └── backend_app/{app_functions,config,modules,openapi,service,util}/ tests/{unit,integration}/ environment/   # empty
```

## Setup ownership

- `_ai/` is the single source for shared assistant rules, agents, skills, command approvals and project scaffolding. Response preferences live in `global.instructions.md`.
- Each project owns its `.github/copilot-instructions.md` and `docs/ai/` facts; project docs here are templates.
- Anonymization: company, host, registry, proxy, user and project names are replaced by placeholders (`<organization>`, `<user>`, `project1`, `project2`).

## Restore on another device

1. Copy `work/` to the new workspace root and open `Work.code-workspace`.
2. Put the MCP template into `~/.copilot/mcp-config.json` (fill in the redacted values locally).
3. Rename `project1`/`project2` back if needed and fill in `docs/ai/project.md`.
