// Builds a report: one self-contained HTML file from a Markdown source (format: ../report.md in the review skill).
//   node <review skill>/scripts/report.mjs <file.md>           writes <file>.html with the source embedded and prints scan: warnings;
//                                           deletes the .md once no warning is left
//   node <review skill>/scripts/report.mjs --edit <file.html>  restores <file>.md from the embedded source
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// inline Markdown: `code`, **bold**, *italic*, [text](link). Only http(s), mailto and relative links (no colon) become
// links; anything else stays text, so untrusted Markdown cannot add a javascript: URL.
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\u0000-\u001f]*$|^[\w.\/#-][^:\u0000-\u001f]*$/i;
export function inline(s) {
  const code = [], hrefs = [];
  return esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, href) => SAFE_HREF.test(href) ? `<a href="\u0001${hrefs.push(href) - 1}\u0001">${text}</a>` : text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[i]}</code>`)
    .replace(/\u0001(\d+)\u0001/g, (_, i) => hrefs[i]);
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const ITEM = { ul: /^\s*[-*]\s+(.*)$/, ol: /^\s*\d+\.\s+(.*)$/ };

// Markdown subset -> blocks: h, p, ul, ol, table, code, details, enddetails, warn. HTML comments are dropped.
export function blocks(md) {
  const L = md.replace(/\r\n/g, '\n').split('\n'), out = [];
  const starts = (l) => !l.trim() || /^(```|#{1,4}\s|\||<!--|<\/?details)/.test(l) || ITEM.ul.test(l) || ITEM.ol.test(l);
  for (let i = 0; i < L.length;) {
    const l = L[i];
    let m;
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('<!--')) {
      while (i < L.length && !L[i].includes('-->')) i++;
      if (i++ >= L.length) out.push({ t: 'warn', text: 'unclosed <!-- comment hides the rest of the file' });
      continue;
    }
    if ((m = /^```(\w*)\s*(.*)$/.exec(l))) {
      const body = [];
      for (i++; i < L.length && !L[i].startsWith('```'); i++) body.push(L[i]);
      if (i++ >= L.length) out.push({ t: 'warn', text: `unclosed \`\`\`${m[1]} block` });
      out.push({ t: 'code', lang: m[1], arg: m[2].trim(), text: body.join('\n') });
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { out.push({ t: 'h', n: m[1].length, text: m[2].trim() }); i++; }
    else if (l.startsWith('|')) {
      const rows = [];
      for (; i < L.length && L[i].startsWith('|'); i++) rows.push(cells(L[i]));
      const ruled = rows[1]?.every((c) => /^:?-+:?$/.test(c)); // rows[1] is normally the |---| line
      out.push({ t: 'table', head: rows[0], rows: rows.slice(ruled ? 2 : 1) });
    } else if ((m = /^<details>(?:\s*<summary>(.*?)<\/summary>)?\s*$/.exec(l))) { out.push({ t: 'details', text: m[1] ?? 'Details' }); i++; }
    else if (/^<\/details>\s*$/.test(l)) { out.push({ t: 'enddetails' }); i++; }
    else if (ITEM.ul.test(l) || ITEM.ol.test(l)) {
      const t = ITEM.ul.test(l) ? 'ul' : 'ol', items = [];
      while (i < L.length && (m = ITEM[t].exec(L[i]))) {
        items.push(m[1]);
        for (i++; i < L.length && /^\s{2,}\S/.test(L[i]) && !ITEM.ul.test(L[i]) && !ITEM.ol.test(L[i]); i++) items[items.length - 1] += ` ${L[i].trim()}`;
      }
      out.push({ t, items });
    } else {
      const lines = [l];
      for (i++; i < L.length && !starts(L[i]); i++) lines.push(L[i]);
      out.push({ t: 'p', text: lines.map((x) => x.trim()).join(' ') });
    }
  }
  return out;
}

// ---- diagrams ----

const nodeOf = (raw) => {
  const s = raw.trim();
  let m;
  if ((m = /^\[(.+)\]$/.exec(s))) return { id: m[1].trim(), kind: 'main' };
  if ((m = /^([!+])\s*(.+)$/.exec(s))) return { id: m[2].trim(), kind: m[1] === '!' ? 'risk' : 'new' };
  return { id: s, kind: '' };
};
// `a > [b] >label> !c` -> [{id, kind, label}]; label is the text on the arrow into the node
export function chain(line) {
  const parts = line.trim().split(/\s+>(?:(\S[^>]*)>)?\s+/);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ ...nodeOf(parts[i]), label: i ? parts[i - 1] ?? '' : '' });
  return out;
}

const CH = 7.3, LINE = 17, MAXW = 880;
const wrap = (s, max = 22) => s.split(/\s+/).reduce((ls, w) => {
  if (ls.length && `${ls[ls.length - 1]} ${w}`.length <= max) ls[ls.length - 1] += ` ${w}`; else ls.push(w);
  return ls;
}, []);

// Layered graph as inline SVG. Layers run left to right, or top-down with `down` or when too wide.
// shortcut: edges are single curves that may cross a node on dense graphs; split the graph or use `flow` when that happens.
export function graph(text, down = false) {
  const nodes = new Map(), edges = [];
  for (const line of text.split('\n').filter((l) => l.trim())) {
    let prev;
    for (const n of chain(line)) {
      const cur = nodes.get(n.id) ?? { id: n.id, kind: '', layer: 0, order: nodes.size };
      if (n.kind) cur.kind = n.kind;
      nodes.set(n.id, cur);
      if (prev) edges.push({ from: prev, to: cur, label: n.label });
      prev = cur;
    }
  }
  const N = [...nodes.values()];
  // an edge that closes a cycle is drawn dashed and does not push its target to a later layer
  const state = new Map();
  const visit = (n) => {
    state.set(n, 1);
    for (const e of edges.filter((x) => x.from === n)) { if (state.get(e.to) === 1) e.back = true; else if (!state.get(e.to)) visit(e.to); }
    state.set(n, 2);
  };
  for (const n of N) if (!state.get(n)) visit(n);
  for (let pass = 0; pass < N.length; pass++) for (const e of edges) if (!e.back && e.to.layer <= e.from.layer) e.to.layer = e.from.layer + 1;

  for (const n of N) {
    n.lines = wrap(n.id);
    n.w = Math.max(72, Math.round(Math.max(...n.lines.map((l) => l.length)) * CH + 26));
    n.h = n.lines.length * LINE + 16;
  }
  const layers = [];
  for (const n of N) (layers[n.layer] ??= []).push(n);
  // order each layer by the average position of its predecessors, to cut crossings
  layers.forEach((layer, li) => {
    if (li) {
      const bary = (n) => { const p = edges.filter((e) => e.to === n && !e.back && e.from.layer < li).map((e) => e.from.pos); return p.length ? p.reduce((a, b) => a + b, 0) / p.length : n.order; };
      layer.sort((a, b) => bary(a) - bary(b) || a.order - b.order);
    }
    layer.forEach((n, i) => { n.pos = i; });
  });
  const label = Math.max(0, ...edges.map((e) => e.label.length));
  const hasBack = edges.some((e) => e.back || e.to.layer === e.from.layer);

  const layout = (vertical) => {
    const gapMain = vertical ? (label ? 54 : 40) : Math.max(46, Math.round(label * 6.6 + 30));
    const gapCross = vertical ? 22 : 14;
    let main = 0, cross = 0;
    const spans = layers.map((layer) => {
      const thick = Math.max(...layer.map((n) => (vertical ? n.h : n.w)));
      const len = layer.reduce((s, n) => s + (vertical ? n.w : n.h), 0) + gapCross * (layer.length - 1);
      for (const n of layer) { if (vertical) n.h = thick; else n.w = thick; }
      cross = Math.max(cross, len);
      const at = main;
      main += thick + gapMain;
      return { at, len };
    });
    main -= gapMain;
    layers.forEach((layer, li) => {
      let c = (cross - spans[li].len) / 2;
      for (const n of layer) {
        if (vertical) { n.x = Math.round(c); n.y = spans[li].at; c += n.w + gapCross; }
        else { n.x = spans[li].at; n.y = Math.round(c); c += n.h + gapCross; }
      }
    });
    const pad = hasBack ? 44 : 0;
    return vertical ? { W: cross + pad, H: main } : { W: main, H: cross + pad };
  };
  let size = layout(down);
  if (!down && size.W > MAXW) { down = true; size = layout(true); }

  const P = 6; // padding around the drawing
  const path = (e) => {
    const a = e.from, b = e.to, r = Math.round;
    if (e.back || a.layer === b.layer) { // loops outside the layers: below them (left to right) or beside them (top-down)
      if (down) { const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x + b.w, y2 = b.y + b.h / 2, o = Math.max(x1, x2) + 38; return { d: `M${r(x1)} ${r(y1)}C${r(o)} ${r(y1)} ${r(o)} ${r(y2)} ${r(x2)} ${r(y2)}`, lx: o - 12, ly: (y1 + y2) / 2 }; }
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h, o = Math.max(y1, y2) + 38;
      return { d: `M${r(x1)} ${r(y1)}C${r(x1)} ${r(o)} ${r(x2)} ${r(o)} ${r(x2)} ${r(y2)}`, lx: (x1 + x2) / 2, ly: o - 12 };
    }
    if (down) { const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y, m = (y1 + y2) / 2; return { d: `M${r(x1)} ${r(y1)}C${r(x1)} ${r(m)} ${r(x2)} ${r(m)} ${r(x2)} ${r(y2)}`, lx: (x1 + x2) / 2, ly: m + 4 }; }
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, m = (x1 + x2) / 2;
    return { d: `M${r(x1)} ${r(y1)}C${r(m)} ${r(y1)} ${r(m)} ${r(y2)} ${r(x2)} ${r(y2)}`, lx: m, ly: (y1 + y2) / 2 - 5 };
  };
  const W = Math.round(size.W + 2 * P), H = Math.round(size.H + 2 * P);
  const svg = [`<svg class="graph" viewBox="${-P} ${-P} ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Diagram: ${N.map((n) => n.id).join(', ')}`)}">`,
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>'];
  const labels = [];
  for (const e of edges) {
    const p = path(e);
    svg.push(`<path class="e${e.back ? ' back' : ''}" d="${p.d}" marker-end="url(#ah)"/>`);
    if (e.label) labels.push(`<text class="el" x="${Math.round(p.lx)}" y="${Math.round(p.ly)}" text-anchor="middle">${esc(e.label)}</text>`);
  }
  for (const n of N) {
    const cx = n.x + n.w / 2, top = n.y + (n.h - n.lines.length * LINE) / 2 + 12.5;
    svg.push(`<g class="n${n.kind ? ` ${n.kind}` : ''}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>`
      + `<text text-anchor="middle">${n.lines.map((l, i) => `<tspan x="${cx}" y="${top + i * LINE}">${esc(l)}</tspan>`).join('')}</text></g>`);
  }
  return `<div class="fig">${svg.join('')}${labels.join('')}</svg></div>`;
}

const node = (n) => `<span class="nd${n.kind ? ` ${n.kind}` : ''}">${inline(n.id)}</span>`;
const lines = (text) => text.split('\n').filter((l) => l.trim());

const DIAGRAMS = {
  graph: (text, arg) => graph(text, arg === 'down'),
  // `Label: a > b > c` per line
  flow: (text) => `<div class="flow">${lines(text).map((l) => {
    const m = /^([^>]*?):\s+(.*)$/.exec(l);
    return `<div class="lane">${m ? `<b>${inline(m[1].trim())}</b>` : ''}${chain(m ? m[2] : l).map((n, i) => (i ? `<i>${esc(n.label)}</i>` : '') + node(n)).join('')}</div>`;
  }).join('')}</div>`,
  // `Label: 123 unit # note` per line
  bars: (text, arg, warn) => {
    const rows = lines(text).map((l) => /^(.*):\s*(-?\d[\d.,]*)\s*([^#]*?)\s*(?:#\s*(.*))?$/.exec(l) ?? (warn(`bars line without "Label: number": ${l.trim()}`), null)).filter(Boolean)
      .map(([, name, num, unit, note]) => ({ name, shown: `${num}${unit ? ` ${unit}` : ''}`, value: Number(num.replace(/,/g, '')), note }))
      .filter((r) => !Number.isNaN(r.value) || warn(`bars value is not a number: ${r.shown}`));
    const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
    return `<div class="bars">${rows.map((r) => `<span>${inline(r.name.trim())}</span><span class="t"><span style="width:${Math.round(Math.abs(r.value) / max * 1000) / 10}%"></span></span>`
      + `<span class="v">${esc(r.shown)}${r.note ? `<small>${inline(r.note)}</small>` : ''}</span>`).join('')}</div>`;
  },
  // `Today: x; y` and `After: x; y`
  compare: (text) => `<div class="compare">${lines(text).map((l) => {
    const m = /^([^:]+):\s*(.*)$/.exec(l) ?? [, '', l];
    return `<div><span class="lbl">${inline(m[1].trim())}</span><ul>${m[2].split(/;\s+|;$/).filter((x) => x.trim()).map((x) => `<li>${inline(x.trim())}</li>`).join('')}</ul></div>`;
  }).join('')}</div>`,
  // `A > B: message` per line
  seq: (text) => `<div class="seq">${lines(text).map((l) => {
    const m = /^(.+?)\s+>\s+(.+?):\s+(.*)$/.exec(l) ?? [, l.trim(), '', ''];
    return `${node(nodeOf(m[1]))}<i></i>${node(nodeOf(m[2]))}<span>${inline(m[3])}</span>`;
  }).join('')}</div>`,
  // indented paths; + new, ~ changed, ! risk, # note
  tree: (text) => `<div class="tree">${lines(text).map((l) => {
    const [, ind, mk, name, note] = /^(\s*)(?:([+~!])\s+)?(.*?)(?:\s+#\s+(.*))?$/.exec(l);
    const cls = { '+': 'new', '~': 'chg', '!': 'risk' }[mk] ?? '';
    return `<div${cls ? ` class="${cls}"` : ''} style="--d:${Math.floor(ind.length / 2)}"><span class="mk">${mk ?? ''}</span>${name.endsWith('/') ? `<b>${esc(name)}</b>` : esc(name)}${note ? `<small>${inline(note)}</small>` : ''}</div>`;
  }).join('')}</div>`,
};

// ---- scan limits (visible text only: the collapsed Evidence, code and diagrams are not counted) ----

const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`_#|]/g, ' ');
const words = (s) => (plain(s).match(/\S+/g) ?? []).length;
// labels such as **Bottom line:** and **Problem:** are structure, not emphasis
const boldWords = (s) => [...s.matchAll(/\*\*([^*]+)\*\*/g)].reduce((n, m) => n + (m[1].endsWith(':') ? 0 : words(m[1])), 0);
const sentences = (s) => (plain(s).match(/[.!?]["')\]]*(?=\s+[A-Z0-9]|\s*$)/g) ?? []).length;
const GENERIC = /^(overview|introduction|summary|details|background|analysis|findings|index|conclusion|notes|context)$/i;
const CHIPS = {
  ok: ['yes', 'done', 'pass', 'passed', 'ok', 'ready', 'fixed', 'in scope', 'proven', 'kept', 'green'],
  wa: ['open', 'weak', 'partial', 'unproven', 'waiting', 'u', 'in progress', 'not run', 'skipped', 'medium'],
  no: ['no', 'fail', 'failed', 'blocked', 'struck out', 'missing', 'broken', 'red', 'high'],
};
const chip = (text, sev) => {
  const key = text.replace(/\*\*/g, '').trim().toLowerCase();
  const tone = Object.keys(CHIPS).find((t) => CHIPS[t].includes(key)) ?? (sev && key === 'low' ? '' : null);
  if (tone === null || (!sev && ['high', 'medium'].includes(key))) return null;
  return `<span class="chip${tone ? ` ${tone}` : ''}">${esc(text.replace(/\*\*/g, '').trim())}</span>`;
};

// Markdown -> { html, warnings }
export function render(md) {
  const B = blocks(md), warnings = [], out = [];
  const warn = (w) => warnings.push(w);
  let title = 'Report', bottom = false, stats = false, heading = false, hidden = false, section = null, total = 0, bold = 0, questions = 0;
  const count = (text) => { if (hidden) return 0; bold += boldWords(text); const n = words(text); total += n; return n; };
  const picture = () => { if (section) section.pic = true; };
  const close = () => { if (section && !section.pic) warn(`section "${section.text}" has no picture (diagram, compare, table or steps)`); section = null; };
  const table = (b) => {
    const sev = b.head.findIndex((h) => /^sev(erity)?$/i.test(h));
    if (!hidden && b.head.length > 5) warn(`table "${b.head[0]}" has ${b.head.length} columns (max 5)`);
    [b.head, ...b.rows].forEach((r) => r.forEach(count));
    return `<div class="tw"><table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) =>
      `<tr>${r.map((c, i) => `<td>${chip(c, i === sev) ?? inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  for (let i = 0; i < B.length; i++) {
    const b = B[i], next = B[i + 1];
    let m;
    if (b.t === 'h' && b.n === 1) {
      title = plain(b.text).trim();
      count(b.text);
      out.push(`<h1>${inline(b.text)}</h1>`);
      if (next?.t === 'table' && next.rows.length === 1) { // meta table: one row of facts under the title
        out.push(`<div class="meta">${next.head.map((h, k) => `<span><b>${inline(h)}</b>${chip(next.rows[0][k] ?? '') ?? inline(next.rows[0][k] ?? '')}</span>`).join('')}</div>`);
        i++;
      }
    } else if (b.t === 'h') {
      heading = true;
      count(b.text);
      if (b.n === 2) {
        close();
        if (!hidden) { section = { text: b.text, pic: false }; if (GENERIC.test(b.text)) warn(`heading "${b.text}" names a topic; state the conclusion`); }
        out.push(`<h2>${inline(b.text)}</h2>`);
      } else if ((m = /^(High|Medium|Low|Q) · (.+)$/.exec(b.text))) { // finding or question card
        picture();
        const q = m[1] === 'Q';
        const rows = next?.t === 'ul' ? (i++, next.items) : [];
        rows.forEach(count);
        out.push(`<section class="card ${q ? 'q' : m[1].toLowerCase()}"><h3>${q ? `<span class="chip">Q${++questions}</span>` : chip(m[1], true)} ${inline(m[2])}</h3><dl>${rows.map((r) => {
          const kv = /^\*\*(.+?):\*\*\s*(.*)$/.exec(r);
          return kv ? `<dt>${esc(kv[1])}</dt><dd>${inline(kv[2])}</dd>` : `<dt></dt><dd>${inline(r)}</dd>`;
        }).join('')}</dl></section>`);
      } else out.push(`<h${b.n}>${inline(b.text)}</h${b.n}>`);
    } else if (b.t === 'p') {
      const n = count(b.text);
      if ((m = /^\*\*Bottom line:\*\*\s*(.*)$/.exec(b.text))) {
        bottom = true;
        if (n > 42) warn(`bottom line has ${n - 2} words (max 40)`);
        out.push(`<p class="bottom"><span class="lbl">Bottom line</span>${inline(m[1])}</p>`);
      } else if ((m = /^\*\*Decide first:\*\*\s*(.*)$/.exec(b.text))) out.push(`<p class="decide"><span class="lbl">Decide first</span>${inline(m[1])}</p>`);
      else {
        if (!hidden && (n > 50 || sentences(b.text) > 2)) warn(`paragraph "${plain(b.text).trim().slice(0, 40)}..." has ${n} words, ${sentences(b.text)} sentences (max 50 words, 2 sentences)`);
        out.push(`<p>${inline(b.text)}</p>`);
      }
    } else if (b.t === 'table') {
      if (bottom && !stats && !heading && b.rows.length === 1) { // headline numbers: the one-row table after the bottom line
        stats = true;
        if (b.head.length < 2 || b.head.length > 5) warn(`${b.head.length} headline numbers (use 2-5)`);
        [b.head, b.rows[0]].forEach((r) => r.forEach(count));
        out.push(`<div class="stats">${b.head.map((h, k) => `<div class="stat"><b>${inline(b.rows[0][k] ?? '')}</b><span>${inline(h)}</span></div>`).join('')}</div>`);
      } else { picture(); out.push(table(b)); }
    } else if (b.t === 'ul' || b.t === 'ol') {
      if (b.t === 'ol') picture();
      const long = b.items.map(count).filter((n) => n > 25).length;
      if (!hidden && b.items.length > 7) warn(`list "${plain(b.items[0]).trim().slice(0, 30)}..." has ${b.items.length} items (max 7)`);
      if (!hidden && long) warn(`list "${plain(b.items[0]).trim().slice(0, 30)}..." has ${long} items over 25 words`);
      out.push(`<${b.t}${b.t === 'ol' ? ' class="steps"' : ''}>${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${b.t}>`);
    } else if (b.t === 'code') {
      if (DIAGRAMS[b.lang] && !b.text.trim()) warn(`empty ${b.lang} block`);
      else if (DIAGRAMS[b.lang]) { picture(); out.push(DIAGRAMS[b.lang](b.text, b.arg, warn)); }
      else {
        if (b.lang === 'mermaid') warn('Mermaid block: use graph, flow, bars, compare, seq or tree');
        out.push(`<pre><code>${esc(b.text)}</code></pre>`);
      }
    } else if (b.t === 'details') { hidden = true; out.push(`<details><summary>${inline(b.text)}</summary>`); }
    else if (b.t === 'enddetails') { hidden = false; out.push('</details>'); }
    else if (b.t === 'warn') warn(b.text);
  }
  close();
  if (hidden) out.push('</details>');
  if (!bottom) warn('no **Bottom line:** paragraph');
  if (total > 600) warn(`${total} visible words (about 600 max); move detail into <details><summary>Evidence</summary>`);
  if (total && bold / total > 0.2) warn(`${Math.round(bold / total * 100)}% of the words are bold (max 20%)`);

  const html = `<!doctype html>
<!-- Built by node <review skill>/scripts/report.mjs. Do not edit by hand: node <review skill>/scripts/report.mjs --edit <this file>, edit the .md, build again. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body><main>
${out.join('\n')}
</main>
<script type="text/plain" id="md-source">${Buffer.from(md).toString('base64')}</script>
</body></html>
`;
  return { html, warnings };
}

// the Markdown source embedded in a built report, or null
export function source(html) {
  const m = /<script type="text\/plain" id="md-source">([A-Za-z0-9+/=]*)<\/script>/.exec(html);
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : null;
}

const CSS = `
:root{--bg:#fff;--fg:#1c2127;--mu:#5d6772;--ln:#e2e5e9;--sf:#f4f6f8;--ac:#2456d3;--ok:#18794e;--wa:#9a5b00;--no:#c4342b}
@media(prefers-color-scheme:dark){:root{--bg:#15181c;--fg:#e7e9ec;--mu:#9ba5af;--ln:#2c323a;--sf:#1d2228;--ac:#82a8ff;--ok:#4cc38a;--wa:#e2a43c;--no:#ff7b72}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 16px 64px}
h1{font-size:1.7rem;line-height:1.2;margin:0 0 10px}
h2{font-size:1.25rem;line-height:1.3;margin:36px 0 10px}
h3{font-size:1.02rem;margin:22px 0 6px}
p{margin:10px 0}a{color:var(--ac)}ul{padding-left:20px}
code{font:.88em ui-monospace,Consolas,monospace;background:var(--sf);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
pre{background:var(--sf);padding:12px;border-radius:8px;overflow-x:auto}pre code{background:none;padding:0;overflow-wrap:normal}
.lbl{display:block;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);margin-bottom:2px}
.meta{display:flex;flex-wrap:wrap;gap:4px 18px;margin:0 0 18px;color:var(--mu);font-size:.9rem}.meta b{font-weight:600;margin-right:6px}
.bottom{font-size:1.15rem;line-height:1.45;margin:0 0 16px;padding:14px 16px;border-left:4px solid var(--ac);background:var(--sf);border-radius:0 8px 8px 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:0 0 16px}
.stat{border:1px solid var(--ln);border-radius:8px;padding:10px 12px}.stat b{display:block;font-size:1.6rem;line-height:1.15}.stat span{font-size:.82rem;color:var(--mu)}
.decide{margin:0 0 16px;padding:12px 16px;border:1px solid var(--wa);border-radius:8px;background:color-mix(in srgb,var(--wa) 9%,var(--bg))}
.card{margin:12px 0;padding:12px 16px;border:1px solid var(--ln);border-left:4px solid var(--mu);border-radius:8px}
.card h3{margin:0 0 6px}.card.high{border-left-color:var(--no)}.card.medium{border-left-color:var(--wa)}.card.q{border-left-color:var(--ac)}
.card dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;margin:0}.card dt{color:var(--mu);font-size:.85rem;padding-top:2px}.card dd{margin:0;min-width:0}
.chip{display:inline-block;padding:0 8px;border-radius:99px;font-size:.78rem;font-weight:600;line-height:1.6;white-space:nowrap;border:1px solid var(--ln);color:var(--mu)}
.chip.ok{color:var(--ok);border-color:currentColor;background:color-mix(in srgb,var(--ok) 10%,var(--bg))}
.chip.wa{color:var(--wa);border-color:currentColor;background:color-mix(in srgb,var(--wa) 10%,var(--bg))}
.chip.no{color:var(--no);border-color:currentColor;background:color-mix(in srgb,var(--no) 10%,var(--bg))}
.tw{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:.93rem}
th{text-align:left;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:var(--mu);border-bottom:2px solid var(--ln);padding:6px 10px 6px 0}
td{border-bottom:1px solid var(--ln);padding:7px 10px 7px 0;vertical-align:top}td:first-child{font-weight:600}
.fig{overflow-x:auto;margin:14px 0;padding:4px 0}svg.graph{display:block;font:13px system-ui,-apple-system,"Segoe UI",sans-serif}
.graph .n rect{fill:var(--sf);stroke:var(--mu);stroke-width:1.2}.graph .n text{fill:var(--fg)}
.graph .main rect{fill:var(--ac);stroke:var(--ac)}.graph .main text{fill:var(--bg);font-weight:600}
.graph .risk rect{fill:color-mix(in srgb,var(--no) 12%,var(--bg));stroke:var(--no);stroke-width:1.8}
.graph .new rect{fill:color-mix(in srgb,var(--ok) 12%,var(--bg));stroke:var(--ok);stroke-dasharray:5 3}
.graph .e{fill:none;stroke:var(--mu);stroke-width:1.3}.graph .back{stroke-dasharray:4 3}.graph marker path{fill:var(--mu)}
.graph .el{fill:var(--mu);font-size:11.5px;paint-order:stroke;stroke:var(--bg);stroke-width:4px}
.nd{display:inline-block;border:1px solid var(--mu);border-radius:7px;padding:3px 10px;background:var(--sf);font-size:.9rem}
.nd.main{background:var(--ac);border-color:var(--ac);color:var(--bg);font-weight:600}
.nd.risk{border-color:var(--no);border-width:2px;background:color-mix(in srgb,var(--no) 12%,var(--bg))}
.nd.new{border-color:var(--ok);border-style:dashed;background:color-mix(in srgb,var(--ok) 12%,var(--bg))}
.flow{display:grid;gap:8px;margin:14px 0}.lane{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.lane>b{min-width:96px;font-size:.85rem;color:var(--mu)}
.lane i,.seq i{font-style:normal;color:var(--mu);font-size:.78rem}.lane i::after,.seq i::after{content:"→";font-size:1rem;margin-left:3px}
.bars{display:grid;grid-template-columns:fit-content(42%) 1fr max-content;gap:6px 10px;align-items:center;margin:14px 0;font-size:.92rem}
.bars .t{height:14px;background:var(--sf);border-radius:4px;overflow:hidden}.bars .t span{display:block;height:100%;background:var(--ac);border-radius:4px}
.bars .v{font-variant-numeric:tabular-nums;font-weight:600}.bars small{display:block;color:var(--mu);font-weight:400}
.compare{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:14px 0}
.compare>div{border:1px solid var(--ln);border-radius:8px;padding:10px 14px}.compare>div:last-child{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 6%,var(--bg))}
.compare ul{margin:4px 0 0;padding-left:18px}
.seq{display:grid;grid-template-columns:auto auto auto 1fr;gap:6px 8px;align-items:center;justify-items:start;margin:14px 0;font-size:.92rem}
.tree{font:.88rem/1.7 ui-monospace,Consolas,monospace;background:var(--sf);border-radius:8px;padding:10px 14px;margin:14px 0;overflow-x:auto;white-space:nowrap}
.tree div{padding-left:calc(var(--d)*1.3em)}.tree .mk{display:inline-block;width:1.1em;font-weight:700}
.tree .new{color:var(--ok)}.tree .chg{color:var(--wa)}.tree .risk{color:var(--no)}.tree small{color:var(--mu);margin-left:10px;font-family:system-ui,sans-serif}
ol.steps{list-style:none;counter-reset:s;margin:14px 0;padding:0}ol.steps li{counter-increment:s;position:relative;padding:1px 0 12px 38px}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--ac);color:var(--bg);font-weight:700;font-size:.82rem;display:grid;place-items:center}
ol.steps li:not(:last-child)::after{content:"";position:absolute;left:12.5px;top:28px;bottom:2px;width:1px;background:var(--ln)}
details{margin:28px 0 0;border-top:1px solid var(--ln);padding-top:10px}summary{cursor:pointer;color:var(--mu);font-weight:600}
`;

function main(args) {
  const edit = args[0] === '--edit', file = args[edit ? 1 : 0];
  if (args.length !== (edit ? 2 : 1) || !file.endsWith(edit ? '.html' : '.md')) { console.error('usage: node <review skill>/scripts/report.mjs <file.md> | --edit <file.html>'); return 1; }
  const text = readFileSync(file, 'utf8');
  if (edit) {
    const md = source(text);
    if (md === null) { console.error(`${file} has no embedded Markdown source`); return 1; }
    writeFileSync(file.replace(/\.html$/, '.md'), md);
    console.log(`restored ${file.replace(/\.html$/, '.md')}`);
    return 0;
  }
  const { html, warnings } = render(text);
  const out = file.replace(/\.md$/, '.html');
  writeFileSync(out, html);
  for (const w of warnings) console.log(`scan: ${w}`);
  if (!warnings.length) rmSync(file);
  console.log(warnings.length ? `built ${out} with ${warnings.length} scan warnings; fix them in ${file} and build again` : `built ${out}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
