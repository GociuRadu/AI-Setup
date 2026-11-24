// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSetup } from '../server.mjs';
import * as sync from '../../_ai/sync.mjs';
import App from '../src/App';
import { api, diff } from '../src/api';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const md = (d: string) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.md') && f !== '_core.md').length;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function serve(device: object, deviceError?: string) {
  const setup = { ...readSetup(ROOT, sync), device, vaultError: undefined, ...(deviceError && { deviceError }) };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/session' ? { token: 't' } : setup), { status: 200 })));
  return setup;
}

test('the page shows the helper, skill, rule and hook counts of the source folders', async () => {
  serve({ profile: 'home', tools: ['claude', 'kiro'] });
  render(<App />);
  const counts = await screen.findByLabelText('Source counts');
  const count = (k: string) => within(counts).getByText(k).nextElementSibling?.textContent;
  expect(count('Helpers')).toBe(String(md('_ai/agents')));
  expect(count('Skills')).toBe(String(readdirSync(join(ROOT, '_ai/skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).length));
  expect(count('Rules')).toBe(String(md('_ai/rules')));
  expect(count('Hooks')).toBe('2');
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Claude Code', 'Kiro']);
});

test('turning the guard off asks first, then shows the change for .ai-device.json', async () => {
  serve({ profile: 'work', tools: ['kiro'] });
  render(<App />);
  fireEvent.click(await screen.findByRole('switch', { name: 'Guard' }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(screen.getByText('No changes.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Turn guard off' }));
  expect(screen.getByText('perTool: (none) → {"kiro":{"hooks":{"guard":false}}}')).toBeTruthy();
  // back on: the default value is removed again, so nothing is left to save
  fireEvent.click(screen.getByRole('switch', { name: 'Guard' }));
  expect(screen.getByText('No changes.')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'Guard' }));
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Guard' }));
});

test('a skill switched off goes to that tool only', async () => {
  serve({ profile: 'work', tools: ['claude', 'kiro'] });
  render(<App />);
  fireEvent.keyDown(await screen.findByRole('tab', { name: 'Claude Code' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Kiro' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('switch', { name: 'learn' }));
  expect(screen.getByText('perTool: (none) → {"kiro":{"skillsOff":["learn"]}}')).toBeTruthy();
});

test('an MCP server from _ai/mcp.json is switched off for one tool only', async () => {
  serve({ profile: 'work', tools: ['claude', 'kiro'] });
  render(<App />);
  const counts = await screen.findByLabelText('Source counts');
  expect(within(counts).getByText('MCP').nextElementSibling?.textContent).toBe(String(Object.keys(sync.loadMcp()).length));
  fireEvent.click(screen.getByRole('tab', { name: 'Kiro' }));
  fireEvent.click(screen.getByRole('switch', { name: 'atlassian' }));
  expect(screen.getByText('perTool: (none) → {"kiro":{"mcpOff":["atlassian"]}}')).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: 'atlassian' }));
  expect(screen.getByText('No changes.')).toBeTruthy();
});

test('a helper model is free text: shows the tier model, any typed ID overrides it, the tier model or empty resets it', async () => {
  const setup = serve({ profile: 'home', tools: ['claude'] });
  render(<App />);
  const field = (await screen.findByLabelText('Model for scout')) as HTMLInputElement;
  expect(field.value).toBe(setup.models.claude.tiers.fast);
  fireEvent.change(field, { target: { value: 'claude-custom-9' } });
  expect(screen.getByText('claude.agents.scout: (none) → "claude-custom-9"')).toBeTruthy();
  fireEvent.change(field, { target: { value: '' } });
  expect(field.value).toBe('');
  expect(screen.getByText('No changes.')).toBeTruthy();
  fireEvent.change(field, { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset scout to the fast tier model' }));
  expect(field.value).toBe(setup.models.claude.tiers.fast);
  expect(screen.getByText('No changes.')).toBeTruthy();
});

test('the Obsidian vault: a pasted path is cleaned, shown as a change, and emptying it removes the setting', async () => {
  serve({ profile: 'home', tools: ['claude'] });
  render(<App />);
  const field = (await screen.findByLabelText('Vault folder')) as HTMLInputElement;
  expect(field.value).toBe('');
  expect(screen.getByText('No vault set: /learn asks for it.')).toBeTruthy();
  // Windows "Copy as path" adds quotes; a trailing separator is dropped
  fireEvent.change(field, { target: { value: ' "C:\\Users\\me\\vault\\" ' } });
  expect(screen.getByText('obsidian: (none) → {"vault":"C:\\\\Users\\\\me\\\\vault"}')).toBeTruthy();
  fireEvent.change(field, { target: { value: '' } });
  expect(screen.getByText('No changes.')).toBeTruthy();
});

test('a saved vault shows its path, and a problem with it is an alert', async () => {
  const device = { profile: 'home', tools: ['claude'], obsidian: { vault: 'C:\\v' } };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/session' ? { token: 't' }
    : { ...readSetup(ROOT, sync), device, vaultError: 'C:\\v does not exist' }))));
  render(<App />);
  expect(((await screen.findByLabelText('Vault folder')) as HTMLInputElement).value).toBe('C:\\v');
  expect(screen.getByRole('alert').textContent).toBe('C:\\v does not exist');
  cleanup();
  serve(device);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/session' ? { token: 't' } : { ...readSetup(ROOT, sync), device, vaultError: undefined }))));
  render(<App />);
  await screen.findByLabelText('Vault folder');
  expect(screen.getByText('Vault connected.')).toBeTruthy();
  expect(screen.getByText('No changes.')).toBeTruthy();
});

test('first run without a device file: Apply waits for a profile and a tool', async () => {
  serve(null as unknown as object);
  render(<App />);
  expect(await screen.findByText('no device settings', { exact: false })).toBeTruthy();
  expect(screen.queryAllByRole('tab')).toEqual([]);
  const apply = screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
  expect(apply.disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'work' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Kiro' }));
  expect(apply.disabled).toBe(false);
  expect(screen.getByRole('heading', { name: '.ai-device.json' }).nextElementSibling?.textContent).toBe('profile: (none) → "work"\ntools: (none) → ["kiro"]');
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Kiro']);
});

test('a rejected save shows the server error and runs no sync', async () => {
  const setup = { ...readSetup(ROOT, sync), device: { profile: 'home', tools: ['claude'] } };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/session') return new Response(JSON.stringify({ token: 't' }));
    if (url === '/api/models') return new Response(JSON.stringify({ error: 'claude.agents.scout is bad' }), { status: 400 });
    if (url === '/api/setup' && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(setup));
    throw new Error(`unexpected ${init?.method} ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  const field = (await screen.findByLabelText('Model for scout')) as HTMLInputElement;
  fireEvent.change(field, { target: { value: 'claude-custom-9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect((await screen.findByRole('alert')).textContent).toBe('claude.agents.scout is bad');
  expect(fetch.mock.calls.map(([u]) => u)).not.toContain('/api/apply');
  // the edit is kept, so it can be corrected instead of typed again
  await screen.findByRole('button', { name: 'Apply' });
  expect(field.value).toBe('claude-custom-9');
  expect(screen.getByText('claude.agents.scout: (none) → "claude-custom-9"')).toBeTruthy();
});

test('after Apply the page shows the files as sync wrote them, so keys sync adds are not pending changes', async () => {
  const base = readSetup(ROOT, sync);
  let device: object = { profile: 'home', tools: ['claude'] };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/session') return new Response(JSON.stringify({ token: 't' }));
    if (url === '/api/setup') return new Response(JSON.stringify({ ...base, device }));
    if (url === '/api/device' && method === 'PUT') { device = { ...JSON.parse(String(init?.body)), mcpSynced: ['atlassian'] }; return new Response('{}'); }
    if (url === '/api/apply') return new Response(JSON.stringify({ code: 0, stdout: 'synced', stderr: '' }));
    throw new Error(`unexpected ${method} ${url}`);
  }));
  render(<App />);
  fireEvent.click(await screen.findByRole('radio', { name: 'work' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(await screen.findByText('Sync exit code 0')).toBeTruthy();
  expect(await screen.findByText('No changes.')).toBeTruthy();
});

test('a device file with a skill that no longer exists loads with its other keys; Apply drops only that name', async () => {
  const device = { profile: 'work', tools: ['kiro'], models: { kiro: { agents: { scout: 'm1' } } }, perTool: { kiro: { skillsOff: ['gone', 'learn'] } } };
  serve(device, 'perTool.kiro.skillsOff: unknown skill gone');
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toMatch(/unknown skill gone/);
  expect(screen.getByRole('radio', { name: 'work' })).toHaveProperty('checked', true);
  expect(screen.getByRole('switch', { name: 'learn' })).toHaveProperty('checked', false);
  expect(screen.getByRole('heading', { name: '.ai-device.json' }).nextElementSibling?.textContent).toBe('perTool.kiro.skillsOff: ["gone","learn"] → ["learn"]');
});

test('after a server restart (new token) a call fetches the token again once', async () => {
  let current = 'before', sessions = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/session') { sessions++; return new Response(JSON.stringify({ token: current })); }
    const ok = (init?.headers as Record<string, string>)['X-Setup-Token'] === current;
    return new Response(JSON.stringify(ok ? { fine: true } : { error: 'missing or wrong X-Setup-Token' }), { status: ok ? 200 : 401 });
  }));
  await expect(api.setup()).resolves.toEqual({ fine: true });
  current = 'after';
  sessions = 0;
  await expect(api.setup()).resolves.toEqual({ fine: true });
  expect(sessions).toBe(1);
});

test('diff lists changed leaves with old and new values', () => {
  expect(diff({ a: { b: 1, c: [1] } }, { a: { b: 2, c: [1] }, d: true })).toEqual(['a.b: 1 → 2', 'd: (none) → true']);
  expect(diff({ x: 1 }, { x: 1 })).toEqual([]);
});
