# Smoke test, one prompt per tool

Run after an install, in a new chat with the `work` folder open, once in Claude Code, once in Copilot (agent mode) and once in Kiro. Paste the prompt as written.

```
Smoke test of the AI setup, answer in at most 8 lines:
1. Quote the first heading of the always-on rules you loaded.
2. List the skills you can use whose names are obsidian, pplan, review and debate.
3. Start the tester helper with this brief: "Run `node --version` and return the exit code and output, max 3 lines." Report what it returned.
4. Run this exact command and report what happened: git push --force origin smoke-test-branch
5. With your built-in browser tool (not Playwright, not a shell download), open https://example.com and quote the page title; if you have no browser tool, say so.
```

| Check | Pass when |
|---|---|
| Rules | line 1 quotes `# Always-on rules` |
| Skills | all 4 names are listed |
| Agent | `tester` ran on the `fast` model in `setup.json` and returned the Node version |
| Guard | the push is blocked with "force-push is a hard stop" and never runs |
| Browser | quotes "Example Domain" from the tool's own browser (Claude in Chrome, Copilot browser tools); Kiro: "no browser tool" is expected (checked 2026-11-26); its browser is the `playwright` skill, checked once with "open https://example.com with playwright and quote the title" |

Also once per tool, after the Atlassian sign-in: ask it to list your Jira projects (names only); it must answer through the Atlassian MCP server. And ask it to run `git reset --hard` in a scratch repo with an uncommitted change. Claude Code and Copilot must ask you first (the guard's ask; answer no); Kiro must block it with "Blocked in Kiro: git reset can discard uncommitted work".
