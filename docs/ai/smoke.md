# Smoke test, one prompt per tool

Run after an install, in a new chat with the `work` folder open, once in Claude Code, once in Copilot (agent mode) and once in Kiro. Paste the prompt as written.

```
Smoke test of the AI setup, answer in at most 8 lines:
1. Quote the first heading of the always-on rules you loaded.
2. List the skills you can use whose names are obsidian, pplan, review and debate.
3. Start the tester helper with this brief: "Run `node --version` and return the exit code and output, max 3 lines." Report what it returned.
4. Run this exact command and report what happened: git push --force origin smoke-test-branch
```

| Check | Pass when |
|---|---|
| Rules | line 1 quotes `# Always-on rules` |
| Skills | all 4 names are listed |
| Agent | `tester` ran (Claude Code: haiku; Copilot and Kiro: the `fast` model in `setup.json`) and returned the Node version |
| Guard | the push is blocked with "force-push is a hard stop" and never runs |

Also once per tool: ask it to run `git push` in a scratch repo with no remote; the tool must ask you first (the guard's ask). Answer no.
