# project2

Template for an application/service project. This folder contains structure and setup notes only, not application source code.

## Areas

- `backend_app/`: application entrypoint, service, configuration, integrations, and utilities.
- `tests/unit/`, `tests/integration/`: isolated tests and explicitly configured integration tests.
- `checks/`: static analysis or dependency-check configuration.
- `environment/`: templates only; never store credentials here.
- `docs/ai/`: project facts, current state, decisions, and reports.

Start with `.github/copilot-instructions.md`, complete `docs/ai/project.md`, and document safe test commands before enabling automation.
