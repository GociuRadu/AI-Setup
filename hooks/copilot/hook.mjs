// GitHub Copilot (VS Code Copilot harness) preToolUse hook: a fail-closed loader for ../guard.mjs. Copilot reads a top-level
// { permissionDecision, permissionDecisionReason } from stdout; {} lets the call through. A failure prints a deny and exits 2.
// Copilot lets the call run when the hook times out, so the guard stays fast (regex checks first).
import { pathToFileURL } from 'node:url';

const guard = process.env.NODE_ENV === 'test' && process.env.AI_GUARD_PATH ? pathToFileURL(process.env.AI_GUARD_PATH) : new URL('../guard.mjs', import.meta.url);
try {
  const { decide, readInput } = await import(guard);
  const input = readInput();
  const { decision, reason } = input ? decide(input) : {};
  process.stdout.write(JSON.stringify(decision ? { permissionDecision: decision, permissionDecisionReason: reason } : {}));
} catch (e) {
  const reason = `Blocked: the guard hook failed (${e?.message ?? e}). Fix .ai/hooks/guard.mjs, then retry.`;
  process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: reason }));
  process.stderr.write(reason);
  process.exitCode = 2;
}
