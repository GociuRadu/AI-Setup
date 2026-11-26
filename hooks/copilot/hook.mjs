// GitHub Copilot preToolUse hook: a fail-closed loader for ../guard.mjs. The decision goes out in both shapes Copilot reads:
// VS Code agent mode reads hookSpecificOutput.permissionDecision (Claude's shape; a top-level field alone is ignored,
// seen in VS Code 1.147, 2026-11-26), the Copilot CLI harness reads the top-level { permissionDecision,
// permissionDecisionReason }. {} lets the call through. A failure prints a deny and exits 2, which both treat as a block.
// Copilot lets the call run when the hook times out, so the guard stays fast (regex checks first).
import { pathToFileURL } from 'node:url';

const guard = process.env.NODE_ENV === 'test' && process.env.AI_GUARD_PATH ? pathToFileURL(process.env.AI_GUARD_PATH) : new URL('../guard.mjs', import.meta.url);
const out = (decision, reason) => ({
  permissionDecision: decision, permissionDecisionReason: reason,
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
});
try {
  const { decide, readInput } = await import(guard);
  const input = readInput();
  const { decision, reason } = input ? decide(input) : {};
  process.stdout.write(JSON.stringify(decision ? out(decision, reason) : {}));
} catch (e) {
  const reason = `Blocked: the guard hook failed (${e?.message ?? e}). Fix .ai/hooks/guard.mjs, then retry.`;
  process.stdout.write(JSON.stringify(out('deny', reason)));
  process.stderr.write(reason);
  process.exitCode = 2;
}
