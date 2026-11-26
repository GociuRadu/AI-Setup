// Kiro PreToolUse hook: a fail-closed loader for ../guard.mjs. Kiro blocks only on exit 2 (any other failure lets the
// tool run), so deny and every failure exit 2 with the reason on stderr; ask is the JSON decision with exit 0.
import { pathToFileURL } from 'node:url';

const guard = process.env.NODE_ENV === 'test' && process.env.AI_GUARD_PATH ? pathToFileURL(process.env.AI_GUARD_PATH) : new URL('../guard.mjs', import.meta.url);
try {
  const { decide, readInput } = await import(guard);
  const input = readInput();
  const { decision, reason } = input ? decide(input) : {};
  if (decision === 'ask') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
  if (decision === 'deny') { process.stderr.write(reason); process.exitCode = 2; }
} catch (e) {
  process.stderr.write(`Blocked: the guard hook failed (${e?.message ?? e}). Fix .ai/hooks/guard.mjs, then retry.`);
  process.exitCode = 2;
}
