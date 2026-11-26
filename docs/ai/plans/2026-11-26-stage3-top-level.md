# Stage 3: top-level shape of the setup

Status: 2026-11-26. Decisions 1-9 taken and recorded in vault `AI/memory.md` (shape, patterns, helpers, tools, browser, council, skill tests, improvement, models); summary in the study note `Learn/AI-Setup/AI Coding Setup.md`, section 8. Waiting for the user to close the stage. Current setup read in full; 6 scouts researched best practice (MCP vs CLI, browser, agents and debate, testing and improvement, popular complete setups, vendor guidance). Decision 1 (the shape) is waiting on the user. Nothing has been built.

## 1. Today vs best practice, part by part

| Part | Today (read 2026-11-26) | Best-proven practice | Gap |
|---|---|---|---|
| Always-on rules | `AGENTS.md` 69 lines + profile 8 + tool file 3 = ~95 lines, 8.4 KB; SQL, Python, report rules load by path | Anthropic: under 200 lines; HumanLayer: under 60 in their own repo; universal content only | within the limit |
| Skills | 10: workflow `pplan`, `delegate`, `review` (4 modes), `retro`, `handoff`, `clean`; domain `data`, `learn`, `confluence-project`, `ui-ux-pro-max` (third party) | superpowers 15 skills, compound-engineering 38; SKILL.md under 500 lines; description = what + when | missing: council, skill tests, failure-driven improve, browser |
| Workflow | `pplan` (plan file, challenger, reviewer) → `delegate` task loop (do, check, review, mark) → `retro` | every top setup: plan → work → fresh-context review → learn (superpowers, compound-engineering, gstack, ECC) | matches |
| Helpers | 5: `scout`, `tester` (fast), `worker`, `reviewer`, `challenger` (balanced); built-in agents denied; at most 4 readers in parallel, 1 writer per file set, worktrees | superpowers: no named agents; practitioners: few or none; ECC 72, wshobson 199; vendors: subagents for context isolation | matches the lean side; layer 1 already decided built-ins stay on |
| Second opinion | `challenger`: picks blind, 1 round, at most 3 objections, same vendor | gstack `/codex` (other vendor), Karpathy `llm-council` (~24k stars); studies: independent picks + vote match or beat debate | one critic, same vendor, no council |
| Tools | 3 MCP servers in `_ai/mcp.json`: Atlassian (OAuth), GitHub remote (PAT, read-only), Playwright | CLI + skill where a CLI exists; MCP for OAuth services | GitHub and browser could move to a CLI |
| Browser | Playwright MCP in Edge with its own profile; Claude in Chrome built in | own apps: CLI + skill; signed-in sites: each tool's built-in browser | MCP where a CLI is cheaper |
| Safety | 1 guard hook, `_ai/hooks/guard.mjs` 438 lines + 354 test lines, on every tool call including Read, Grep, Glob; deny lists | hooks for zero-exception rules (Anthropic best practices); match shell and writes only | runs on every read |
| Testing skills | none; unit tests for the scripts + CI (`.github/workflows/test.yml`) | superpowers-evals, bmad-eval, `claude plugin eval`, skill-creator, Copilot Evals (preview) | missing |
| Improvement | `retro` proposes 1-2 line diffs for approval; `memory.md`; Claude auto memory on | compound-engineering: lessons to `docs/solutions`, read by the next plan; ECC: automatic "instincts"; Fowler and Thoughtworks: human approval, prune as well as add | no failure capture, no test decides keep or delete |
| Install | `_ai/sync.mjs` 670 lines + `setup-ui` web app, workspace level | decided in stage 2: `install.mjs`, user level | decided |

## 2. Decision 1: the shape (recommended: A)

| Option | Used by (stars as shown, undated) | Gains | Loses | Caps future models? |
|---|---|---|---|---|
| A. Lean skills-first workflow: few workflow skills, plan → work → review → learn, few helpers, CLI first, skill tests, learning loop with approval | superpowers 327k, gstack 143k, compound-engineering 26k; the current setup | what the top setups and vendors share; little loads per session; each skill testable | you keep and test your own skills | no: skills load on demand, goals over steps |
| B. Big library: hundreds of skills, dozens of role agents, automatic learning | ECC 311k (328 skills, 72 agents), wshobson 43k (185 skills, 199 agents) | everything ready | more loads each session (Claude warns above 15k tokens of agent descriptions); hard to test; automatic rules lowered success in a 2026 study | partly: many fixed roles |
| C. Spec phases per feature: requirements → design → tasks | spec-kit 152k, Kiro specs, BMAD 56k | strong on large features; Kiro native | slow on small tasks | yes: fixed phases even when one pass would do |
| D. Minimal: 4 tools, `AGENTS.md` only, no helpers, no MCP | pi (Zechner, Ronacher) | cheapest, fastest per task | no parallel work, review, council or tests (all asked for) | no |

Why A: it is the shape the 2 most-starred workflow setups and all 3 vendors share; the current setup already works this way, so the rebuild keeps the shape and fills 4 gaps: skill tests, failure capture with an improve loop, a council for big decisions, CLI over MCP for GitHub and the browser.

Open after decision 1 (no order; the user picks): own workflow skills vs adopting superpowers or compound-engineering skills; browser CLI; test runner; council design; helper list and model tiers; which failures are captured and how.

## 3. Evidence

### Popular complete setups (scout, pages read 2026-11-26, star counts undated)
| Setup | Tools | Parts | Workflow | Skill tests | Learning loop |
|---|---|---|---|---|---|
| obra/superpowers 327.1k | 16 harnesses incl. Claude Code, Copilot CLI | 15 skills, SessionStart hook, no MCP | brainstorm > worktrees > plan > subagents > TDD > review > finish | yes (superpowers-evals) | no |
| affaan-m/ECC 311k | Claude Code; Copilot CLI beta | 328 skills, 72 agents, 99 commands, hooks, 1 MCP | plan > test > implement > review > verify > remember > improve | eval-harness skill | yes, automatic |
| github/spec-kit 151.5k | agent-agnostic | ~17 commands, templates | constitution > specify > plan > tasks > implement | not shown | not stated |
| garrytan/gstack 142.7k | Claude Code; Kiro, Copilot CLI experimental | ~23-37 skills, `/codex` second opinion | think > plan > build > review > test > ship > reflect | self-reported benchmark: no fix-rate gain | yes (`/learn`) |
| BMAD-METHOD 55.8k | skills-capable tools | role agents (product, architect, dev, test) | clarify > plan > build > learn | yes (bmad-eval) | diagram only |
| wshobson/agents 42.9k | 7 harnesses | 185 skills, 199 agents | library, no workflow | experimental | no |
| compound-engineering 26.2k | ~14 hosts incl. Copilot | 38 skills | brainstorm > plan > work > review > compound | no | yes (`docs/solutions`) |

Sources: https://github.com/obra/superpowers , https://github.com/affaan-m/everything-claude-code , https://github.com/github/spec-kit , https://github.com/garrytan/gstack , https://github.com/bmad-code-org/BMAD-METHOD , https://github.com/wshobson/agents , https://github.com/EveryInc/compound-engineering-plugin
- Practitioners keep it small: Ronacher (2026-01-31) hand-made, pruned skills, no MCP https://lucumr.pocoo.org/2026/1/31/pi/ ; Zechner (2025-11-30) prompt + tools under 1,000 tokens, no subagents https://www.mariozechner.at/posts/2025-11-30-pi-coding-agent/

### Vendor guidance
- Anthropic: CLAUDE.md under 200 lines; repeated emphasis means the rule belongs in a hook https://code.claude.com/docs/en/memory , https://code.claude.com/docs/en/best-practices ; SKILL.md under 500 lines, description what + when https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices ; subagent descriptions over 15,000 tokens warn https://code.claude.com/docs/en/sub-agents
- GitHub: personal and repo instructions go with every message, keep them broad; skills load when relevant https://docs.github.com/en/copilot/concepts/prompting/response-customization , https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- Kiro: steering always / fileMatch / manual / auto; steering is not loaded into custom agents unless listed (updated 2026-10-21) https://kiro.dev/docs/steering/ ; specs requirements → design → tasks (2026-11-15) https://kiro.dev/docs/specs/
- Böckeler (2026-04-02): guides (rules, skills) plus sensors (tests, linters); guides alone never learn if they worked https://martinfowler.com/articles/harness-engineering.html

### Tools: MCP is changing shape, not dying
- Anthropic code execution with MCP (2025-11-04): 150,000 to 2,000 tokens in one example https://www.anthropic.com/engineering/code-execution-with-mcp ; Claude Code tool search on by default https://code.claude.com/docs/en/agent-sdk/tool-search
- Thoughtworks Radar Vol. 34 (2026-04-15): "We caution against using MCP by default" https://www.thoughtworks.com/radar/techniques/mcp-by-default
- MCP stays right for OAuth kept outside the agent's context, audit, and services with no CLI: https://simonwillison.net/2026/jun/19/sean-lynch , https://simonwillison.net/2026/Jul/31/stateless-mcp/ , https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/

### Browser (npm per week, Nov 2026)
| Option | Tools | Logged-in Chrome | Stars / npm |
|---|---|---|---|
| Playwright MCP | all 3 (Kiro unverified) | with extension | 40.2k / 10.73M |
| Playwright CLI + skill | shell agents | `--profile` | 15.5k / 1.82M |
| agent-browser (Vercel) | shell agents | `--cdp` | 54.1k / 2.88M |
| Chrome DevTools MCP + CLI | Claude Code named | auto-connect | 59.4k / 2.84M |
| Built-ins | Claude in Chrome; Copilot browser tools (GA 2026-07-01); Kiro "Your Chrome" | yes | n/a |

### Agents and parallel work
- Anthropic research system (2025-06-13): multi-agent ~15x chat tokens; coding has "fewer truly parallelizable tasks" https://www.anthropic.com/engineering/multi-agent-research-system
- Agent teams: sequential or same-file work is better in one session or subagents https://code.claude.com/docs/en/agent-teams ; Copilot `/fleet`: "last one to finish wins—silently" https://github.blog/2026/04/01/run-multiple-agents-at-once-with-fleet-in-copilot-cli/
- Cognition (2025-06-12): rule out multi-agent by default unless full context is shared https://cognition.com/blog/dont-build-multi-agents

### Second opinion
- Self-consistency beats debate at equal cost (arXiv 2310.01798); debate often fails to beat it (2502.08788); a weaker agent drags answers down (2509.05396).

### Testing and improvement
- `claude plugin eval` https://code.claude.com/docs/en/plugin-evals.md ; skill-creator (2026-03-03) https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills ; promptfoo (2026-11-21) https://www.promptfoo.dev/docs/guides/test-agent-skills/ ; Copilot Evals preview (2026-11-17) https://github.blog/changelog/2026-11-17-github-copilot-evals-is-now-in-public-preview
- Feedback flywheel, human approval, prune https://www.martinfowler.com/articles/reduce-friction-ai/feedback-flywheel.html ; LLM-written context files lowered success, cost +20% (arXiv 2602.11988)

## Not checked
- Star count dates; superpowers and compound-engineering skill contents and Kiro support; `claude plugin eval` on skills outside a plugin; Kiro per-agent model values; Copilot CLI honouring custom agents; Boris Cherny's setup (secondary only).
