// Fail-closed loader: blocks (exit 2) when guard.mjs cannot be loaded.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const url = process.env.NODE_ENV === 'test' && process.env.AI_GUARD_PATH
  ? pathToFileURL(resolve(process.env.AI_GUARD_PATH)).href
  : new URL('./guard.mjs', import.meta.url).href;
try {
  const m = await import(url);
  m.run({ allow: process.argv.includes('--allow') });
} catch (e) {
  process.stderr.write(`Blocked: the guard hook could not load (${e?.message ?? e}). Fix _ai/hooks/guard.mjs.\n`);
  process.exit(2);
}
