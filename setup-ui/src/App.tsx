import { useEffect, useState, type KeyboardEvent } from 'react';
import { api, diff, type Device, type Models, type PerTool, type Setup, type SyncResult } from './api';

const TOOL_LABEL: Record<string, string> = { claude: 'Claude Code', kiro: 'Kiro', copilot: 'GitHub Copilot' };
const HOOK_TEXT: Record<string, { title: string; text: string }> = {
  guard: { title: 'Guard', text: 'Blocks hard stops, writing SQL, secret files and personal/; asks on deletes, Git writes, external CLI and mutating MCP.' },
  lang: { title: 'Reply in English', text: 'Adds a one-line reminder to reply in English to every prompt.' },
};
const GUARD_OFF_UNBLOCKS = [
  'Shell reads and writes of .env files and personal/',
  'Writing SQL sent through database CLI clients (sqlcmd, psql, ...)',
  'Hard stops: force-push, deleting Docker volumes, production compose files, release scripts, SSH',
];
const GUARD_OFF_LEFT: Record<string, string> = {
  claude: 'Left: Read/Edit deny rules for .env and personal/ (file tools only, not the shell) and the command deny list.',
  kiro: 'Left: the workspace permissions in ~/.kiro (file deny for .env and personal/, asks on deletes, Git writes, external CLI).',
  copilot: 'Left: the auto-approve exclusions in .vscode/settings.json, which gate only edits.',
};

const clone = <T,>(v: T): T => structuredClone(v);

// The device to edit. A file that failed its check keeps its other keys; a profile, tool or skill name the
// setup no longer has (profile, tool, skill, MCP server) is dropped, and the Apply diff shows the drop.
function editable(s: Setup): Device {
  const d = clone(s.device ?? { profile: '', tools: [] });
  if (!s.profiles.includes(d.profile)) d.profile = '';
  d.tools = Array.isArray(d.tools) ? d.tools.filter((t) => s.tools.includes(t)) : [];
  const known = { skillsOff: s.skills.map((k) => k.name), mcpOff: s.mcp.map((m) => m.name) };
  for (const p of Object.values(d.perTool ?? {})) {
    for (const key of ['skillsOff', 'mcpOff'] as const) if (Array.isArray(p?.[key])) p[key] = p[key].filter((n) => known[key].includes(n));
  }
  return d;
}

// Sets one tool's switches; values back at the default (on, empty) are removed so the file stays minimal.
function withPerTool(device: Device, tool: string, change: (p: PerTool) => void): Device {
  const d = clone(device);
  const p: PerTool = d.perTool?.[tool] ?? {};
  change(p);
  for (const [h, v] of Object.entries(p.hooks ?? {})) if (v) delete p.hooks![h];
  if (p.hooks && !Object.keys(p.hooks).length) delete p.hooks;
  if (p.skillsOff && !p.skillsOff.length) delete p.skillsOff;
  if (p.mcpOff && !p.mcpOff.length) delete p.mcpOff;
  d.perTool = { ...d.perTool, [tool]: p };
  if (!Object.keys(p).length) delete d.perTool[tool];
  if (!Object.keys(d.perTool).length) delete d.perTool;
  return d;
}

function Switch({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export default function App() {
  const [setup, setSetup] = useState<Setup>();
  const [models, setModels] = useState<Models>();
  const [device, setDevice] = useState<Device>({ profile: '', tools: [] });
  const [tab, setTab] = useState('');
  const [guardAsk, setGuardAsk] = useState<string>();
  // model text as typed, per tool:helper, so the field can be emptied and retyped
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.setup().then((s) => {
      setSetup(s);
      setModels(clone(s.models));
      setDevice(editable(s));
    }).catch((e: Error) => setError(e.message));
  }, []);

  if (error && !setup) return <main className="page"><p role="alert" className="error">Could not load the setup: {error}</p></main>;
  if (!setup || !models) return <main className="page"><p aria-busy="true">Loading…</p></main>;

  const modelChanges = diff(setup.models, models);
  const deviceChanges = diff(setup.device ?? {}, device);
  const valid = setup.profiles.includes(device.profile) && device.tools.length > 0;
  const activeTab = device.tools.includes(tab) ? tab : device.tools[0] ?? '';
  const per = device.perTool?.[activeTab] ?? {};
  const hookOn = (h: string) => per.hooks?.[h] !== false;

  const toggleTool = (t: string, on: boolean) => setDevice((d) => ({ ...d, tools: setup.tools.filter((x) => (x === t ? on : d.tools.includes(x))) }));
  const setHook = (h: string, on: boolean) => {
    if (h === 'guard' && !on) { setGuardAsk(activeTab); return; }
    setDevice((d) => withPerTool(d, activeTab, (p) => { p.hooks = { ...p.hooks, [h]: on }; }));
  };
  const setOff = (key: 'skillsOff' | 'mcpOff', name: string, on: boolean) => setDevice((d) => withPerTool(d, activeTab, (p) => {
    p[key] = on ? (p[key] ?? []).filter((s) => s !== name) : [...(p[key] ?? []), name].sort();
  }));
  // any text is an override; empty or the tier's own model means no override
  const setAgentModel = (agent: string, tier: string, text: string) => {
    setDrafts((d) => ({ ...d, [`${activeTab}:${agent}`]: text }));
    setModels((m) => {
      const next = clone(m!);
      const v = text.trim();
      if (v && v !== next[activeTab].tiers[tier]) next[activeTab].agents[agent] = v; else delete next[activeTab].agents[agent];
      return next;
    });
  };
  const resetAgentModel = (agent: string, tier: string) => setAgentModel(agent, tier, models![activeTab].tiers[tier]);

  const closeGuardAsk = () => { setGuardAsk(undefined); document.getElementById('hook-guard')?.focus(); };
  const showTab = (t: string) => { setTab(t); setGuardAsk(undefined); };
  // tab pattern: arrows, Home and End move between tools
  const onTabKey = (e: KeyboardEvent) => {
    const i = device.tools.indexOf(activeTab), n = device.tools.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    showTab(device.tools[next]);
    document.getElementById(`tab-${device.tools[next]}`)?.focus();
  };

  async function apply() {
    setBusy(true); setError(undefined); setResult(undefined);
    try {
      // device first: it is checked against the saved models, and a rejected device then leaves both files as they were
      if (deviceChanges.length) await api.saveDevice(device);
      if (modelChanges.length) await api.saveModels(models!);
      setResult(await api.apply());
      setDrafts({});
    } catch (e) { setError((e as Error).message); }
    // only the saved state is reloaded: edits stay, and the diff then shows what is still unsaved
    finally { await api.setup().then(setSetup).catch((e: Error) => setError(e.message)); setBusy(false); }
  }

  const tm = models[activeTab];
  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>AI Setup</h1>
          <p className="status"><span className="dot" aria-hidden="true" /> {valid ? `online · ${device.profile} · ${device.tools.join(' + ')}` : 'no device settings'}</p>
        </div>
        <dl className="counts" aria-label="Source counts">
          {([['Helpers', setup.agents.length], ['Skills', setup.skills.length], ['Rules', setup.rules.length], ['Hooks', setup.hooks.length], ['MCP', setup.mcp.length]] as const).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </header>
      {setup.deviceError && <p role="alert" className="error">.ai-device.json failed its check: {setup.deviceError}. Names the setup no longer has are dropped below; Apply saves what this page shows.</p>}

      <section className="card" aria-labelledby="device-h">
        <h2 id="device-h">Device</h2>
        <div className="row">
          <fieldset>
            <legend>Tools</legend>
            {setup.tools.map((t) => (
              <label key={t} className="check"><input type="checkbox" checked={device.tools.includes(t)} onChange={(e) => toggleTool(t, e.target.checked)} /> {TOOL_LABEL[t] ?? t}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Profile</legend>
            {setup.profiles.map((p) => (
              <label key={p} className="check"><input type="radio" name="profile" checked={device.profile === p} onChange={() => setDevice((d) => ({ ...d, profile: p }))} /> {p}</label>
            ))}
          </fieldset>
        </div>
        {device.tools.includes('claude') && device.tools.includes('copilot') && (
          <p className="warn" role="status">Claude Code and Copilot are both on: Copilot also reads .claude/ hooks and agents, which can double-fire hooks.</p>
        )}
        <details>
          <summary>Rules ({setup.rules.length})</summary>
          <ul className="plain">
            {setup.rules.map((r) => <li key={r.name}><a href={r.link}>{r.name}</a> <code>{r.applyTo}</code></li>)}
          </ul>
        </details>
      </section>

      {activeTab && tm && (
        <section className="card" aria-label="Per-tool settings">
          <div role="tablist" aria-label="Tools" className="tabs" onKeyDown={onTabKey}>
            {device.tools.map((t) => (
              <button key={t} role="tab" id={`tab-${t}`} aria-selected={t === activeTab} tabIndex={t === activeTab ? 0 : -1} aria-controls="tool-panel" onClick={() => showTab(t)}>{TOOL_LABEL[t] ?? t}</button>
            ))}
          </div>
          <div role="tabpanel" id="tool-panel" tabIndex={0} aria-labelledby={`tab-${activeTab}`}>
            <h3>Models</h3>
            {device.models?.[activeTab] && <p className="note">This device also overrides models for {TOOL_LABEL[activeTab]} in .ai-device.json; those win.</p>}
            <table>
              <thead><tr><th scope="col">Helper</th><th scope="col">Tier</th><th scope="col">Model</th></tr></thead>
              <tbody>
                {setup.agents.map((a) => (
                  <tr key={a.name}>
                    <th scope="row"><a href={a.link}>{a.name}</a></th>
                    <td><code>{a.tier}</code></td>
                    <td>
                      <div className="model">
                        <input aria-label={`Model for ${a.name}`} list={`models-${activeTab}`} spellCheck={false} autoComplete="off"
                          value={drafts[`${activeTab}:${a.name}`] ?? tm.agents[a.name] ?? tm.tiers[a.tier]}
                          placeholder={tm.tiers[a.tier]}
                          onChange={(e) => setAgentModel(a.name, a.tier, e.target.value)} />
                        {tm.agents[a.name]
                          ? <button type="button" className="ghost" onClick={() => resetAgentModel(a.name, a.tier)} aria-label={`Reset ${a.name} to the ${a.tier} tier model`}>Reset</button>
                          : <span className="tag">default</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id={`models-${activeTab}`}>
              {[...new Set([...(tm.available ?? []), ...Object.values(tm.tiers), ...Object.values(tm.agents)])].map((m) => <option key={m} value={m} />)}
            </datalist>
            <p className="note">Type any model ID, or pick a suggestion. Empty or the tier model means the tier default.</p>

            <h3>Hooks</h3>
            {setup.hooks.map((h) => (
              <div key={h} className="hook">
                <Switch id={`hook-${h}`} label={HOOK_TEXT[h]?.title ?? h} checked={hookOn(h)} onChange={(v) => setHook(h, v)} />
                <p className="note">{HOOK_TEXT[h]?.text}</p>
              </div>
            ))}
            {guardAsk === activeTab && (
              <div className="danger" role="alertdialog" aria-labelledby="guard-h" aria-describedby="guard-list" onKeyDown={(e) => e.key === 'Escape' && closeGuardAsk()}>
                <h4 id="guard-h">Turn the guard off for {TOOL_LABEL[activeTab]}?</h4>
                <p>These are no longer blocked:</p>
                <ul id="guard-list">{GUARD_OFF_UNBLOCKS.map((x) => <li key={x}>{x}</li>)}</ul>
                <p>{GUARD_OFF_LEFT[activeTab]}</p>
                <div className="row">
                  <button type="button" className="destructive" onClick={() => { setDevice((d) => withPerTool(d, activeTab, (p) => { p.hooks = { ...p.hooks, guard: false }; })); closeGuardAsk(); }}>Turn guard off</button>
                  <button type="button" autoFocus onClick={closeGuardAsk}>Keep it on</button>
                </div>
              </div>
            )}
            {!hookOn('guard') && <p className="error" role="status">Guard is off for {TOOL_LABEL[activeTab]}.</p>}

            <h3>Skills</h3>
            <ul className="skills">
              {setup.skills.map((s) => (
                <li key={s.name} className="skill">
                  <Switch id={`skill-${s.name}`} label={s.name} checked={!per.skillsOff?.includes(s.name)} onChange={(v) => setOff('skillsOff', s.name, v)} />
                  <p className="note">{s.description}</p>
                  <a href={s.link}>Open in VS Code</a>
                </li>
              ))}
            </ul>

            <h3>MCP servers</h3>
            {setup.mcp.length ? (
              <ul className="servers">
                {setup.mcp.map((m) => (
                  <li key={m.name} className="server">
                    <div className="server-head">
                      <Switch id={`mcp-${m.name}`} label={m.name} checked={!per.mcpOff?.includes(m.name)} onChange={(v) => setOff('mcpOff', m.name, v)} />
                      <code className="target">{m.target}</code>
                    </div>
                    {m.description && <p className="note">{m.description}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="note">No servers in _ai/mcp.json.</p>}
            <p className="note">Servers are defined in _ai/mcp.json, without secrets; sign-in happens in each tool.</p>
          </div>
        </section>
      )}

      <section className="card apply" aria-labelledby="apply-h">
        <h2 id="apply-h">Apply</h2>
        {!modelChanges.length && !deviceChanges.length ? <p className="note">No changes.</p> : (
          <>
            {modelChanges.length > 0 && <><h3>_ai/models.json</h3><pre>{modelChanges.join('\n')}</pre></>}
            {deviceChanges.length > 0 && <><h3>.ai-device.json</h3><pre>{deviceChanges.join('\n')}</pre></>}
          </>
        )}
        <p className="note">
          Apply saves these files and runs <code>node _ai/sync.mjs</code>, which regenerates the tool folders
          {device.tools.includes('kiro') && <> and also writes the Kiro rule block in <code>~/.kiro</code></>}. Start a new chat afterwards.
        </p>
        <button type="button" className="primary" disabled={!valid || busy} onClick={apply}>{busy ? 'Applying…' : 'Apply'}</button>
        {!valid && <p className="note">Pick a profile and at least one tool.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {result && (
          <div role="status">
            <p className={result.code === 0 ? 'ok' : 'error'}>Sync exit code {result.code}</p>
            {result.stdout && <pre>{result.stdout}</pre>}
            {result.stderr && <pre className="stderr">{result.stderr}</pre>}
          </div>
        )}
      </section>
    </main>
  );
}
