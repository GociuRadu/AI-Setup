---
sections: [Databases, Hard stops, Secrets and data]
---
# GitHub Copilot

The core rules are in `AGENTS.md`, which Copilot loads when `chat.useAgentsMdFile` is on; if it is not in your context, read it now. Its safety sections follow below, because this file loads in every chat.

- Start a helper as a subagent by its exact name, or pick it from the agent list.
