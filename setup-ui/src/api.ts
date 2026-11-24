export interface ToolModels {
  tiers: Record<string, string>;
  agents: Record<string, string>;
  available?: string[];
  default?: string;
  subagentDefault?: string;
}
export type Models = Record<string, ToolModels>;
export interface PerTool { hooks?: Record<string, boolean>; skillsOff?: string[]; mcpOff?: string[] }
export interface Device { profile: string; tools: string[]; models?: Partial<Models>; perTool?: Record<string, PerTool>; obsidian?: { vault: string }; [key: string]: unknown }
interface Item { name: string; description?: string; link: string }
export interface Setup {
  tools: string[];
  profiles: string[];
  hooks: string[];
  agents: (Item & { tier: string })[];
  skills: Item[];
  rules: (Item & { applyTo: string })[];
  mcp: { name: string; description?: string; target: string }[];
  models: Models;
  device: Device | null;
  deviceError?: string;
  vaultError?: string;
}
export interface SyncResult { code: number; stdout: string; stderr: string }

let token: Promise<string> | undefined;

async function call<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  // a failed token fetch is not kept, so the next call tries again
  token ??= fetch('/api/session').then((r) => r.json()).then((d: { token: string }) => d.token).catch((e) => { token = undefined; throw e; });
  const res = await fetch(path, {
    method,
    headers: { 'X-Setup-Token': await token, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // the server makes a new token on each start: after a restart, fetch it once more
  if (res.status === 401 && retry) { token = undefined; return call<T>(method, path, body, false); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

export const api = {
  setup: () => call<Setup>('GET', '/api/setup'),
  saveModels: (m: Models) => call('PUT', '/api/models', m),
  saveDevice: (d: Device) => call('PUT', '/api/device', d),
  apply: () => call<SyncResult>('POST', '/api/apply', {}),
};

// Changed leaves between two JSON values as `a.b.c: old → new`; lists compare whole.
export function diff(before: unknown, after: unknown, path = ''): string[] {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((k) => diff(before[k], after[k], path ? `${path}.${k}` : k));
  }
  const show = (v: unknown) => (v === undefined ? '(none)' : JSON.stringify(v));
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [`${path}: ${show(before)} → ${show(after)}`];
}
