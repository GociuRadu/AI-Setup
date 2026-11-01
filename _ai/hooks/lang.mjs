// Prompt hook: reminds the model to reply in English, whatever language the user writes in.
// Claude Code and Kiro (UserPromptSubmit) add plain stdout to the context; Copilot (sessionStart) reads JSON additionalContext.
// Never blocks: any error exits 0 with no output.
import { readFileSync } from 'node:fs';

const NOTE = 'Reply in English, even if this message is in Romanian or another language.';
try {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { /* no payload: plain text */ }
  const copilot = input.sessionId !== undefined || input.hook_event_name === 'SessionStart';
  process.stdout.write(copilot ? JSON.stringify({ additionalContext: NOTE }) : NOTE);
} catch { /* never block a prompt */ }
process.exit(0);
