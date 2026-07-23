#!/usr/bin/env node
/**
 * product-browser-html.cjs — generate a self-contained, read-only HTML browser of the
 * Product Module corpus (`.product/`). A "simplified solo Confluence": left tree of artifact
 * types (grouped D1 / D1↔D2 / D2-Behavioral / Design / Cross-cutting), a center list → detail
 * view (frontmatter panel + rendered body + backlinks), a task-proxy "Работа" panel driven by
 * status-collector.cjs, and full-text search (MiniSearch). One file, zero network, zero external
 * deps at view time (marked + minisearch are vendored and inlined/pre-rendered at build time).
 *
 * DETERMINISTIC: no LLM in the loop. Every number in the "Работа" panel comes from
 * status-collector.cjs (DEC-DEV-0217); this script never re-derives counts.
 *
 * SECURITY (carry of lesson M-1, stored-XSS in app-map.html, SECURITY_REVIEW_2026-07-11):
 *   1. DATA blob is a JS object literal; `</script` and `<!--` breakout sequences are escaped
 *      (plus U+2028/U+2029 line terminators) so a prompt-injectable field (title, ref, …) can
 *      never close the <script> and inject markup.
 *   2. Raw HTML tokens in markdown are ESCAPED by a custom marked renderer — no artifact-authored
 *      HTML reaches the page.
 *   3. Links keep only http(s): and #-anchors; every other scheme (javascript:, data:, …) is
 *      dropped to plain text. Images are neutralised to their alt text (no network fetch).
 *   All collector-derived and frontmatter values are rendered client-side via textContent; only
 *   the pre-sanitised body HTML is injected via innerHTML.
 *
 * Usage: node product-browser-html.cjs [--root .] [--out .product/browser.html]
 * Exit:  0 ok, 2 error.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Marked } = require('./vendor/marked.umd.js');
const MiniSearch = require('./vendor/minisearch.umd.js');

// status-collector is OPTIONAL at runtime: it feeds the "Работа" panel only. If it fails to
// load or throws, artifacts still render (graceful degradation — DESIGN §1). Loaded lazily so a
// broken collector can never take the whole generator down.
let collector = null;
let collectorLoadError = null;
try {
  collector = require('./status-collector.cjs');
} catch (e) {
  collector = null;
  collectorLoadError = e && e.message ? e.message : String(e);
}

// ─────────────────────────────────────────────────────────────────────────────
// Root discovery + CLI
// ─────────────────────────────────────────────────────────────────────────────

function findRoot(start) {
  let d = path.resolve(start);
  while (d !== path.parse(d).root) {
    if (fs.existsSync(path.join(d, '.claude')) && fs.existsSync(path.join(d, '.product'))) return d;
    d = path.dirname(d);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification: filename/frontmatter → canonical kind + group
// ─────────────────────────────────────────────────────────────────────────────

// Enumerable subdirs to scan (non-recursive *.md). Dot-dirs (.pending/.sessions/…) are NOT here,
// so they are never scanned as artifacts. mockups/assets/** is skipped (listMd is non-recursive).
const ENUM_DIRS = [
  'segments', 'value-propositions', 'hypotheses', 'releases', 'features', 'scenarios',
  'business-rules', 'lifecycles', 'verification', 'invariants', 'nfr', 'mockups', 'notes',
  'lessons', 'handoffs',
];

const DIR_PREFIX = {
  segments: 'SEG', 'value-propositions': 'VP', hypotheses: 'HYP', releases: 'RL', features: 'FM',
  scenarios: 'SC', 'business-rules': 'BR', lifecycles: 'LC', verification: 'VC', invariants: 'IC',
  nfr: 'NFR', notes: 'NOTE', lessons: 'LESSON',
};

const SINGLETON_FILE_PREFIX = {
  'problem.md': 'PS', 'market-research.md': 'MR', 'competitive-analysis.md': 'CA',
  'mvp-scope.md': 'MVP', 'roadmap.md': 'RM', 'glossary.md': 'BG', 'design-system.md': 'DS',
  'app-map.md': 'AM', 'rpm.md': 'RPM',
};

const PREFIX_GROUP = {
  PS: 'D1', MR: 'D1', CA: 'D1', SEG: 'D1', VP: 'D1', HYP: 'D1', MVP: 'D1', RM: 'D1', RL: 'D1',
  FM: 'D1↔D2',
  SC: 'D2-Behavioral', BR: 'D2-Behavioral', LC: 'D2-Behavioral', RPM: 'D2-Behavioral',
  VC: 'D2-Behavioral', IC: 'D2-Behavioral', NFR: 'D2-Behavioral',
  MK: 'Design', DS: 'Design', NM: 'Design', AM: 'Design',
  BG: 'Cross-cutting', NOTE: 'Cross-cutting', LESSON: 'Cross-cutting',
};

const GROUP_ORDER = ['D1', 'D1↔D2', 'D2-Behavioral', 'Design', 'Cross-cutting', 'Handoffs', 'Untyped'];

// The canonical ID vocabulary (DESIGN §1) — singletons (no number) and enumerable (PREFIX-NNN).
const ID_RE = new RegExp(
  '\\b(?:SEG|VP|HYP|RL|FM|NOTE|LESSON|SC|BR|LC|VC|IC|NFR|MK|NM)-\\d{3}\\b'
  + '|\\b(?:PS|MR|CA|MVP|RM|BG|RPM|DS|AM)\\b',
  'g',
);

/**
 * Classify a file into { kind, group, canonicalId }.
 *   dir === null → root singleton.
 *   handoffs → kind HANDOFF, group Handoffs, canonicalId null (never a cross-link target: a
 *   handoff filename FM-001-handoff.md would otherwise collide with the FM-001 feature id).
 */
function classify(fm, filename, dir) {
  if (dir === 'handoffs') {
    return { kind: 'HANDOFF', group: 'Handoffs', canonicalId: null };
  }
  let prefix = null;
  let canonicalId = null;

  if (dir === null) {
    // Root singleton.
    prefix = SINGLETON_FILE_PREFIX[filename] || null;
    if (!prefix && fm.id && /^[A-Z]{2,4}$/.test(String(fm.id).trim())) prefix = String(fm.id).trim();
    if (prefix) canonicalId = prefix;
  } else if (dir === 'mockups') {
    prefix = /^NM/i.test(filename) ? 'NM' : 'MK';
    const m = filename.match(/^([A-Za-z]+)-(\d{1,4})/);
    if (m) canonicalId = prefix + '-' + m[2].padStart(3, '0');
    else if (fm.id) canonicalId = String(fm.id).trim().toUpperCase();
  } else {
    prefix = DIR_PREFIX[dir] || null;
    const m = filename.match(/^([A-Za-z]+)-(\d{1,4})/);
    if (m) {
      const p = m[1].toUpperCase();
      prefix = prefix || p;
      canonicalId = p + '-' + m[2].padStart(3, '0');
    } else if (fm.id) {
      canonicalId = String(fm.id).trim().toUpperCase();
    }
  }

  const kind = prefix || 'FILE';
  const group = PREFIX_GROUP[kind] || (dir === 'handoffs' ? 'Handoffs' : 'Untyped');
  return { kind, group, canonicalId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter parsing — SAME tolerant, hand-rolled approach as status-collector.cjs
// (NOTE: the brief called this "js-yaml с fallback"; the collector actually uses NO npm deps —
//  hand-rolled flat-scalar parsing. We mirror that real approach for a single source of truth.)
// ─────────────────────────────────────────────────────────────────────────────

function splitFrontmatter(content) {
  const norm = String(content == null ? '' : content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: norm };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const km = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (km) fm[km[1]] = km[2].replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML escaping + safe markdown renderer
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

function makeMarked() {
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    renderer: {
      // Raw HTML tokens (block + inline) → escaped text. No artifact HTML reaches the page.
      html(token) { return escHtml(token.text); },
      // Links: keep only http(s): (new tab) and #-anchors; drop every other scheme to plain text.
      link(token) {
        const href = String(token.href == null ? '' : token.href);
        const inner = this.parser.parseInline(token.tokens);
        if (/^https?:/i.test(href)) {
          return '<a href="' + escAttr(href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
        }
        if (href.charAt(0) === '#') return '<a href="' + escAttr(href) + '">' + inner + '</a>';
        return inner;
      },
      // Images neutralised to alt text — no external fetch (offline, no tracking).
      image(token) {
        const alt = token.text || token.title || 'image';
        return '<span class="img-ph">[' + escHtml(alt) + ']</span>';
      },
    },
  });
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Directory helpers
// ─────────────────────────────────────────────────────────────────────────────

function readdirSafe(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return null; }
}
function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}
function listMd(dir) {
  const ents = readdirSafe(dir);
  if (!ents) return [];
  return ents.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan `.product/` → artifact records
// ─────────────────────────────────────────────────────────────────────────────

function scanArtifacts(root) {
  const productDir = path.join(root, '.product');
  const marked = makeMarked();
  const artifacts = [];
  const idIndex = {}; // canonicalId (UPPER) → artifact key
  let n = 0;

  function push(fullPath, filename, dir) {
    const content = readFileSafe(fullPath);
    const { fm, body } = splitFrontmatter(content);
    const { kind, group, canonicalId } = classify(fm, filename, dir);
    const key = 'art-' + (n++);
    let bodyHtml;
    try { bodyHtml = marked.parse(body || ''); } catch (_) { bodyHtml = '<pre>' + escHtml(body || '') + '</pre>'; }

    const displayId = canonicalId || (fm.id ? String(fm.id).trim() : path.basename(filename, '.md'));
    const rec = {
      key,
      id: displayId,
      canonicalId,
      kind,
      group,
      type: fm.type || null,
      title: fm.title || path.basename(filename, '.md'),
      status: fm.status || null,
      confidence: fm.confidence || null,
      created: fm.created || null,
      updated: fm.updated || fm.last_updated || null,
      version: fm.version != null ? String(fm.version) : null,
      file: path.relative(root, fullPath).replace(/\\/g, '/'),
      bodyHtml,
      searchBody: body || '',
      backlinks: [],
    };
    artifacts.push(rec);

    // Index only canonical, linkable ids (not handoffs / untyped). First writer wins.
    if (canonicalId && PREFIX_GROUP[kind]) {
      const cu = canonicalId.toUpperCase();
      if (!(cu in idIndex)) idIndex[cu] = key;
      if (fm.id) {
        const fu = String(fm.id).trim().toUpperCase();
        if (fu && !(fu in idIndex)) idIndex[fu] = key;
      }
    }
  }

  // Root singletons — every top-level *.md in .product/.
  for (const filename of listMd(productDir)) {
    push(path.join(productDir, filename), filename, null);
  }
  // Enumerable subdirs (features scanned before handoffs so FM-NNN resolves to the feature).
  for (const dir of ENUM_DIRS) {
    const dirPath = path.join(productDir, dir);
    for (const filename of listMd(dirPath)) {
      push(path.join(dirPath, filename), filename, dir);
    }
  }

  return { artifacts, idIndex };
}

// ─────────────────────────────────────────────────────────────────────────────
// ID cross-linking (post-render, outside tags) + backlink reverse-index
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linkify canonical IDs in a rendered HTML fragment, matching ONLY in text segments — never
 * inside a tag/attribute (`<…>`), nor inside <a>/<code>/<pre>. Records each created link via
 * onLink(targetKey). Self-references are skipped.
 */
function crosslink(html, idIndex, selfKey, onLink) {
  const parts = String(html).split(/(<[^>]*>)/);
  let aDepth = 0, codeDepth = 0, preDepth = 0;
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 1) {
      const t = parts[i].toLowerCase();
      if (/^<a[\s>]/.test(t)) aDepth += 1;
      else if (/^<\/a>/.test(t)) aDepth = Math.max(0, aDepth - 1);
      else if (/^<code[\s>]/.test(t)) codeDepth += 1;
      else if (/^<\/code>/.test(t)) codeDepth = Math.max(0, codeDepth - 1);
      else if (/^<pre[\s>]/.test(t)) preDepth += 1;
      else if (/^<\/pre>/.test(t)) preDepth = Math.max(0, preDepth - 1);
      continue;
    }
    if (aDepth > 0 || codeDepth > 0 || preDepth > 0) continue;
    parts[i] = parts[i].replace(ID_RE, (matchStr) => {
      const cid = matchStr.toUpperCase();
      const key = idIndex[cid];
      if (!key || key === selfKey) return matchStr;
      onLink(key);
      return '<a class="xref" href="#' + key + '" data-key="' + key + '">' + matchStr + '</a>';
    });
  }
  return parts.join('');
}

function applyCrosslinks(artifacts, idIndex) {
  const back = {}; // targetKey → { sourceKey → {key,id,title} }
  artifacts.forEach((a) => { back[a.key] = {}; });
  artifacts.forEach((src) => {
    src.bodyHtml = crosslink(src.bodyHtml, idIndex, src.key, (targetKey) => {
      if (!back[targetKey]) return;
      back[targetKey][src.key] = { key: src.key, id: src.id, title: src.title };
    });
  });
  artifacts.forEach((a) => { a.backlinks = Object.keys(back[a.key]).map((k) => back[a.key][k]); });
}

// ─────────────────────────────────────────────────────────────────────────────
// Search index (MiniSearch, built + serialized at generation time)
// ─────────────────────────────────────────────────────────────────────────────

const MS_OPTIONS = {
  idField: 'key',
  fields: ['artId', 'title', 'body'],
  storeFields: ['title', 'artId', 'kind', 'status'],
  searchOptions: { boost: { artId: 3, title: 2 }, fuzzy: 0.2, prefix: true },
};

function buildSearch(artifacts) {
  const ms = new MiniSearch(MS_OPTIONS);
  ms.addAll(artifacts.map((a) => ({
    key: a.key,
    artId: a.id || '',
    title: a.title || '',
    body: a.searchBody || '',
    kind: a.kind || '',
    status: a.status || '',
  })));
  return { serialized: JSON.stringify(ms), options: MS_OPTIONS };
}

// ─────────────────────────────────────────────────────────────────────────────
// "Работа" panel data — deterministic, from status-collector.cjs
// ─────────────────────────────────────────────────────────────────────────────

function collectWork(root) {
  if (!collector || typeof collector.collect !== 'function') {
    return { work: null, warning: 'status-collector не загружен' + (collectorLoadError ? ' (' + collectorLoadError + ')' : '') };
  }
  let c;
  try {
    c = collector.collect(root);
  } catch (e) {
    return { work: null, warning: 'status-collector упал (' + (e && e.message ? e.message : String(e)) + ')' };
  }
  if (!c || c.initialized === false) {
    return { work: null, warning: null }; // uninitialized/empty — no panel, but not an error banner
  }
  const feats = c.artifacts && c.artifacts.byType && c.artifacts.byType.features;
  const rels = c.artifacts && c.artifacts.byType && c.artifacts.byType.releases;
  const work = {
    handoffs: c.handoffs
      ? {
        total: c.handoffs.total || 0,
        items: c.handoffs.items || [],
        staleness: c.handoffs.staleness || { available: false, verdicts: [] },
      }
      : null,
    pending: c.pending
      ? { queues: c.pending.queues || [], total_entries: c.pending.total_entries || 0, total_ghosts: c.pending.total_ghosts || 0 }
      : null,
    fm_board: feats ? (feats.byStatus || {}) : {},
    rl_board: rels ? (rels.byStatus || {}) : {},
    stale_drafts: c.stale_drafts_over_14d || { count: 0, items: [] },
    config: c.config || null,
  };
  return { work, warning: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA-blob serialization: JS object literal escaping (M-1 carry)
// ─────────────────────────────────────────────────────────────────────────────

// Escape EVERY '<' (to <) plus the two JS line terminators. JSON.stringify does not escape
// '<', so any artifact-derived string that contains a '</script' (a title, a body token, or \u2014 the
// case that bit us here \u2014 a MiniSearch index term like '<script>alert') would either break out of
// the <script> element or, at minimum, sit in the file as an alarming raw '<script>' literal.
// Escaping all '<' kills BOTH breakout sequences at once ('</script' and '<!--' each need a '<')
// and leaves no raw '<...' in the blob. In JSON a '<' only ever occurs inside a string literal
// (JSON's structural chars are {}[]:," ), so the blanket replace cannot corrupt the grammar; and
// '<' is a valid JSON escape that decodes back to '<', so DATA round-trips byte-for-byte \u2014
// bodyHtml tags render identically after the JS engine parses the literal. U+2028/U+2029 are line
// terminators to a pre-ES2019 JS parser (legal inside JSON strings), so escape them too. This is
// the exact hardening app-map-html.js applied for lesson M-1 (SECURITY_REVIEW_2026-07-11); the
// brief's narrower '</script'+'<!--' pair is a strict subset of it.
function scriptSafeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Trusted vendor JS inlined verbatim; still neutralise any accidental `</script` in its source.
function scriptSafeInline(src) {
  return String(src).replace(/<\/script/gi, '<\\/script');
}

// ─────────────────────────────────────────────────────────────────────────────
// Client viewer — authored as a real function; embedded via .toString() so its
// regexes/escapes survive intact (a template literal would eat backslashes). Never executed in
// Node — it only references browser globals (DATA, document, MiniSearch).
// ─────────────────────────────────────────────────────────────────────────────

function clientMain() {
  'use strict';
  var D = DATA;
  var byKey = {};
  D.artifacts.forEach(function (a) { byKey[a.key] = a; });

  var ms = null;
  if (D.search && D.search.serialized && typeof MiniSearch !== 'undefined') {
    try { ms = MiniSearch.loadJSON(D.search.serialized, D.search.options); } catch (e) { ms = null; }
  }

  var state = { group: null, kind: null, status: '', confidence: '', query: '' };
  var mode = 'list';
  var curKey = null;

  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out.sort();
  }
  function sum(obj) { var s = 0; Object.keys(obj).forEach(function (k) { s += obj[k]; }); return s; }
  function dash(v) { return v == null || v === '' ? '—' : String(v); }

  var app = document.getElementById('app');

  // ---- header ----
  var header = h('header', 'app-header');
  var hTop = h('div', 'h-top');
  hTop.appendChild(h('h1', 'h-title', D.project ? ('Product Browser — ' + D.project) : 'Product Browser'));
  hTop.appendChild(h('div', 'h-meta', D.census.artifacts + ' артефактов · сгенерировано ' + D.generated));
  header.appendChild(hTop);
  if (D.collectorWarning) {
    header.appendChild(h('div', 'banner-warn', '⚠ ' + D.collectorWarning + ' — панель «Работа» скрыта.'));
  }
  app.appendChild(header);

  // ---- toolbar / search ----
  var tb = h('div', 'toolbar');
  var search = h('input', 'search');
  search.type = 'search';
  search.placeholder = 'Поиск по id / заголовку / тексту…';
  tb.appendChild(search);
  app.appendChild(tb);
  search.addEventListener('input', function () {
    state.query = search.value.trim();
    mode = state.query === '' ? 'list' : 'search';
    renderCenter();
  });

  // ---- layout ----
  var layout = h('div', 'layout');
  var nav = h('nav', 'col-nav');
  var center = h('section', 'col-center');
  var work = h('aside', 'col-work');
  layout.appendChild(nav);
  layout.appendChild(center);
  layout.appendChild(work);
  app.appendChild(layout);

  function filtered() {
    return D.artifacts.filter(function (a) {
      if (state.group && a.group !== state.group) return false;
      if (state.kind && a.kind !== state.kind) return false;
      if (state.status && a.status !== state.status) return false;
      if (state.confidence && a.confidence !== state.confidence) return false;
      return true;
    });
  }

  function selectRow(field, label, values) {
    var wrap = h('label', 'sel');
    wrap.appendChild(h('span', 'sel-l', label));
    var sel = h('select');
    var opt0 = h('option', null, 'все');
    opt0.value = '';
    sel.appendChild(opt0);
    values.forEach(function (v) { var o = h('option', null, v); o.value = v; sel.appendChild(o); });
    sel.value = state[field];
    sel.addEventListener('change', function () { state[field] = sel.value; renderCenter(); });
    wrap.appendChild(sel);
    return wrap;
  }

  function renderNav() {
    nav.innerHTML = '';
    // filters
    var f = h('div', 'filters');
    f.appendChild(h('div', 'nav-h', 'Фильтры'));
    f.appendChild(selectRow('status', 'Статус', uniq(D.artifacts.map(function (a) { return a.status; }))));
    f.appendChild(selectRow('confidence', 'Confidence', uniq(D.artifacts.map(function (a) { return a.confidence; }))));
    var clr = h('button', 'btn-clear', 'Сбросить');
    clr.addEventListener('click', function () {
      state.group = null; state.kind = null; state.status = ''; state.confidence = ''; state.query = '';
      search.value = ''; mode = 'list'; render();
    });
    f.appendChild(clr);
    nav.appendChild(f);

    // type tree
    nav.appendChild(h('div', 'nav-h', 'Типы'));
    var groups = {};
    D.artifacts.forEach(function (a) {
      groups[a.group] = groups[a.group] || {};
      groups[a.group][a.kind] = (groups[a.group][a.kind] || 0) + 1;
    });
    D.groups.forEach(function (g) {
      if (!groups[g]) return;
      var gd = h('div', 'grp');
      var gt = h('div', 'grp-t' + (state.group === g && !state.kind ? ' on' : ''), g + ' (' + sum(groups[g]) + ')');
      gt.addEventListener('click', function () {
        state.group = state.group === g && !state.kind ? null : g; state.kind = null;
        mode = 'list'; render();
      });
      gd.appendChild(gt);
      Object.keys(groups[g]).sort().forEach(function (k) {
        var kd = h('div', 'kind' + (state.kind === k ? ' on' : ''), k + ' (' + groups[g][k] + ')');
        kd.addEventListener('click', function () {
          if (state.kind === k) { state.kind = null; } else { state.kind = k; state.group = g; }
          mode = 'list'; render();
        });
        gd.appendChild(kd);
      });
      nav.appendChild(gd);
    });
  }

  function statusChip(txt) {
    var s = String(txt || '').toLowerCase();
    var cls = 'chip';
    if (s === 'active' || s === 'released' || s === 'validated' || s === 'shipped' || s === 'achieved') cls += ' ok';
    else if (s === 'draft' || s === 'planned' || s === 'testing' || s === 'in-progress') cls += ' warn';
    else if (s === 'deprecated' || s === 'invalidated' || s === 'cancelled') cls += ' off';
    return h('span', cls, txt || '—');
  }

  function renderList() {
    center.innerHTML = '';
    var rows = filtered();
    var caption = h('div', 'list-head');
    var scope = [];
    if (state.group) scope.push(state.group);
    if (state.kind) scope.push(state.kind);
    if (state.status) scope.push('status:' + state.status);
    if (state.confidence) scope.push('conf:' + state.confidence);
    caption.textContent = rows.length + ' артефактов' + (scope.length ? ' — ' + scope.join(' · ') : '');
    center.appendChild(caption);

    if (rows.length === 0) {
      center.appendChild(h('div', 'empty-hint', D.empty
        ? 'Корпус пуст — начни с /product:init.'
        : 'Нет артефактов по текущему фильтру.'));
      return;
    }
    var table = h('table', 'list');
    var thead = h('thead');
    var htr = h('tr');
    ['ID', 'Заголовок', 'Статус', 'Conf', 'Обновлён'].forEach(function (t) { htr.appendChild(h('th', null, t)); });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tb2 = h('tbody');
    rows.sort(function (a, b) { return (a.id || '').localeCompare(b.id || ''); });
    rows.forEach(function (a) {
      var tr = h('tr', 'row');
      tr.appendChild(h('td', 'c-id', a.id || '—'));
      tr.appendChild(h('td', 'c-title', a.title || '—'));
      var st = h('td', 'c-st'); st.appendChild(statusChip(a.status)); tr.appendChild(st);
      tr.appendChild(h('td', 'c-conf', dash(a.confidence)));
      tr.appendChild(h('td', 'c-upd', dash(a.updated)));
      tr.addEventListener('click', function () { openArtifact(a.key); });
      tb2.appendChild(tr);
    });
    table.appendChild(tb2);
    center.appendChild(table);
  }

  function fmRow(dl, k, v) {
    if (v == null || v === '') return;
    dl.appendChild(h('dt', null, k));
    dl.appendChild(h('dd', null, String(v)));
  }

  function openArtifact(key) { mode = 'detail'; curKey = key; renderCenter(); center.scrollTop = 0; window.scrollTo(0, 0); }

  function renderDetail(key) {
    center.innerHTML = '';
    var a = byKey[key];
    if (!a) { renderList(); return; }
    var back = h('button', 'btn-back', '← К списку');
    back.addEventListener('click', function () { mode = 'list'; renderCenter(); });
    center.appendChild(back);

    var head = h('div', 'detail-head');
    head.appendChild(h('div', 'd-id', a.id || '—'));
    head.appendChild(h('h2', 'd-title', a.title || '—'));
    center.appendChild(head);

    var dl = h('dl', 'fm');
    fmRow(dl, 'type', a.type);
    var stWrap = h('dd'); stWrap.appendChild(statusChip(a.status));
    dl.appendChild(h('dt', null, 'status')); dl.appendChild(stWrap);
    fmRow(dl, 'confidence', a.confidence);
    fmRow(dl, 'version', a.version);
    fmRow(dl, 'created', a.created);
    fmRow(dl, 'updated', a.updated);
    fmRow(dl, 'file', a.file);
    center.appendChild(dl);

    var body = h('article', 'body');
    body.innerHTML = a.bodyHtml || '';
    body.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== body && !(t.classList && t.classList.contains('xref'))) t = t.parentNode;
      if (t && t.classList && t.classList.contains('xref')) {
        ev.preventDefault();
        var k = t.getAttribute('data-key');
        if (k && byKey[k]) openArtifact(k);
      }
    });
    center.appendChild(body);

    if (a.backlinks && a.backlinks.length) {
      var bl = h('div', 'backlinks');
      bl.appendChild(h('div', 'bl-h', 'Ссылаются сюда (' + a.backlinks.length + ')'));
      a.backlinks.forEach(function (b) {
        var li = h('div', 'bl-item');
        li.appendChild(h('span', 'bl-id', b.id || '—'));
        li.appendChild(h('span', 'bl-title', b.title || ''));
        li.addEventListener('click', function () { openArtifact(b.key); });
        bl.appendChild(li);
      });
      center.appendChild(bl);
    }
  }

  function renderSearch(q) {
    center.innerHTML = '';
    center.appendChild(h('div', 'list-head', 'Поиск: «' + q + '»'));
    if (!ms) { center.appendChild(h('div', 'empty-hint', 'Поиск недоступен.')); return; }
    var res = ms.search(q).slice(0, 50);
    if (res.length === 0) { center.appendChild(h('div', 'empty-hint', 'Ничего не найдено.')); return; }
    var table = h('table', 'list');
    var tb2 = h('tbody');
    res.forEach(function (r) {
      var a = byKey[r.id];
      var tr = h('tr', 'row');
      tr.appendChild(h('td', 'c-id', (a && a.id) || r.artId || '—'));
      tr.appendChild(h('td', 'c-title', (a && a.title) || r.title || '—'));
      var st = h('td', 'c-st'); st.appendChild(statusChip(a ? a.status : r.status)); tr.appendChild(st);
      tr.appendChild(h('td', 'c-conf', a ? dash(a.confidence) : '—'));
      tr.appendChild(h('td', 'c-upd', a ? dash(a.updated) : '—'));
      tr.addEventListener('click', function () { if (a) openArtifact(a.key); });
      tb2.appendChild(tr);
    });
    table.appendChild(tb2);
    center.appendChild(table);
  }

  function chipRow(map) {
    var row = h('div', 'chips');
    var keys = Object.keys(map);
    if (keys.length === 0) { row.appendChild(h('span', 'muted', '—')); return row; }
    keys.sort().forEach(function (k) {
      var c = statusChip(k);
      c.appendChild(document.createTextNode(' ' + map[k]));
      row.appendChild(c);
    });
    return row;
  }

  function renderWork() {
    work.innerHTML = '';
    if (!D.work) return;
    var w = D.work;
    work.appendChild(h('div', 'work-h', 'Работа'));

    // Feature / Release statusboard
    var sb = h('div', 'work-sec');
    sb.appendChild(h('div', 'ws-t', 'Статусборд'));
    sb.appendChild(h('div', 'ws-sub', 'FM'));
    sb.appendChild(chipRow(w.fm_board || {}));
    sb.appendChild(h('div', 'ws-sub', 'RL'));
    sb.appendChild(chipRow(w.rl_board || {}));
    work.appendChild(sb);

    // Handoffs + staleness
    if (w.handoffs && w.handoffs.total > 0) {
      var hs = h('div', 'work-sec');
      hs.appendChild(h('div', 'ws-t', 'Handoffs (' + w.handoffs.total + ')'));
      var verdicts = {};
      if (w.handoffs.staleness && w.handoffs.staleness.available) {
        (w.handoffs.staleness.verdicts || []).forEach(function (v) { verdicts[v.handoff] = v; });
      }
      w.handoffs.items.forEach(function (it) {
        var row = h('div', 'ws-row');
        row.appendChild(h('span', 'ws-id', it.feature || it.file || '—'));
        row.appendChild(statusChip(it.status));
        var v = verdicts[it.file];
        if (v) {
          var stale = (v.stale_artifacts || []).length;
          var miss = (v.missing_artifacts || []).length;
          if (stale || miss) row.appendChild(h('span', 'ws-warn', 'устар. ' + stale + ' / нет ' + miss));
          else row.appendChild(h('span', 'ws-ok', 'fresh'));
        }
        hs.appendChild(row);
      });
      work.appendChild(hs);
    }

    // Pending queues + ghosts
    if (w.pending && w.pending.queues && w.pending.queues.length) {
      var pq = h('div', 'work-sec');
      pq.appendChild(h('div', 'ws-t', 'Pending (' + w.pending.total_entries + ' / ghosts ' + w.pending.total_ghosts + ')'));
      w.pending.queues.forEach(function (q) {
        if (!q.entries) return;
        var row = h('div', 'ws-row');
        row.appendChild(h('span', 'ws-id', q.file));
        row.appendChild(h('span', 'ws-num', String(q.entries)));
        if (q.ghosts) row.appendChild(h('span', 'ws-warn', 'ghosts ' + q.ghosts));
        pq.appendChild(row);
        (q.items || []).forEach(function (it) {
          if (!it.ghost) return;
          pq.appendChild(h('div', 'ws-ghost', '☠ ' + (it.ref || '—')));
        });
      });
      work.appendChild(pq);
    }

    // Stale drafts > 14d
    if (w.stale_drafts && w.stale_drafts.count > 0) {
      var sd = h('div', 'work-sec');
      sd.appendChild(h('div', 'ws-t', 'Stale drafts >14д (' + w.stale_drafts.count + ')'));
      (w.stale_drafts.items || []).forEach(function (it) {
        var row = h('div', 'ws-row');
        row.appendChild(h('span', 'ws-id', it.id || it.file || '—'));
        row.appendChild(h('span', 'ws-num', it.updated || ''));
        sd.appendChild(row);
      });
      work.appendChild(sd);
    }
  }

  function renderCenter() {
    if (mode === 'detail' && curKey) renderDetail(curKey);
    else if (mode === 'search') renderSearch(state.query);
    else renderList();
  }

  function render() { renderNav(); renderCenter(); }

  renderWork();
  render();
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const CSS = [
  ':root{--bg:#f5f7fb;--fg:#1c2433;--muted:#6b7488;--line:#e3e8f2;--card:#ffffff;--accent:#0b3aa6;--accent2:#2f59c6;--chip:#eef1f7;--ok:#1f8a4d;--warn:#b5730b;--off:#8a93a8}',
  '@media (prefers-color-scheme:dark){:root{--bg:#0f141c;--fg:#dce3ef;--muted:#8b94a6;--line:#242c39;--card:#161d27;--accent:#8ab0ff;--accent2:#6f93e0;--chip:#1d2530;--ok:#4cc47f;--warn:#e0a94c;--off:#6b7488}}',
  ':root[data-theme="dark"]{--bg:#0f141c;--fg:#dce3ef;--muted:#8b94a6;--line:#242c39;--card:#161d27;--accent:#8ab0ff;--accent2:#6f93e0;--chip:#1d2530;--ok:#4cc47f;--warn:#e0a94c;--off:#6b7488}',
  ':root[data-theme="light"]{--bg:#f5f7fb;--fg:#1c2433;--muted:#6b7488;--line:#e3e8f2;--card:#ffffff;--accent:#0b3aa6;--accent2:#2f59c6;--chip:#eef1f7;--ok:#1f8a4d;--warn:#b5730b;--off:#8a93a8}',
  '*{box-sizing:border-box}html,body{margin:0}body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--fg);background:var(--bg)}',
  '.app-header{padding:16px 22px 8px;border-bottom:1px solid var(--line)}.h-top{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px}',
  '.h-title{margin:0;font-size:20px;color:var(--accent)}.h-meta{color:var(--muted);font-size:12px}',
  '.banner-warn{margin-top:10px;padding:8px 12px;background:rgba(181,115,11,.12);border:1px solid var(--warn);border-radius:8px;color:var(--warn);font-size:13px}',
  '.toolbar{padding:12px 22px;border-bottom:1px solid var(--line)}.search{width:100%;max-width:640px;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--fg);font:inherit}',
  '.search:focus{outline:none;border-color:var(--accent2)}',
  '.layout{display:flex;align-items:flex-start;gap:0}.col-nav{width:250px;flex:0 0 250px;padding:14px 16px;border-right:1px solid var(--line);min-height:70vh}',
  '.col-center{flex:1 1 auto;padding:16px 22px;min-width:0}.col-work{width:290px;flex:0 0 290px;padding:14px 16px;border-left:1px solid var(--line)}',
  '@media (max-width:1100px){.layout{flex-wrap:wrap}.col-nav,.col-work{width:100%;flex-basis:100%;border:none;border-bottom:1px solid var(--line)}}',
  '.nav-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:14px 0 8px}',
  '.filters .sel{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.sel-l{color:var(--muted);font-size:12px}.filters select{flex:1;max-width:150px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--fg);font:inherit}',
  '.btn-clear{margin-top:4px;width:100%;padding:6px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--fg);font:inherit;cursor:pointer}.btn-clear:hover{border-color:var(--accent2)}',
  '.grp{margin-bottom:6px}.grp-t{cursor:pointer;font-weight:600;padding:5px 8px;border-radius:7px;color:var(--accent)}.grp-t:hover{background:var(--chip)}.grp-t.on{background:var(--chip)}',
  '.kind{cursor:pointer;padding:3px 8px 3px 20px;border-radius:6px;font-size:13px;color:var(--fg)}.kind:hover{background:var(--chip)}.kind.on{background:var(--accent2);color:#fff}',
  '.list-head{color:var(--muted);font-size:13px;margin-bottom:10px}',
  'table.list{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}',
  'table.list th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--line)}',
  'table.list td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}table.list tr:last-child td{border-bottom:none}',
  '.row{cursor:pointer}.row:hover td{background:var(--chip)}.c-id{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--accent);white-space:nowrap}.c-conf,.c-upd{color:var(--muted);white-space:nowrap;font-size:12px}',
  '.chip{display:inline-block;background:var(--chip);color:var(--fg);border-radius:5px;padding:1px 7px;font-size:11px}.chip.ok{background:rgba(31,138,77,.16);color:var(--ok)}.chip.warn{background:rgba(181,115,11,.16);color:var(--warn)}.chip.off{background:rgba(138,147,168,.16);color:var(--off)}',
  '.empty-hint{padding:30px 10px;color:var(--muted);font-style:italic}',
  '.btn-back{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:7px;padding:6px 12px;font:inherit;cursor:pointer;margin-bottom:12px}.btn-back:hover{border-color:var(--accent2)}',
  '.detail-head{margin-bottom:10px}.d-id{font-family:ui-monospace,Consolas,monospace;color:var(--accent);font-size:13px}.d-title{margin:2px 0 0;font-size:20px}',
  'dl.fm{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 16px}dl.fm dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}dl.fm dd{margin:0;word-break:break-word}',
  '.body{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 18px 18px;overflow-x:auto}',
  '.body h1,.body h2,.body h3,.body h4{color:var(--accent);line-height:1.3}.body h1{font-size:22px}.body h2{font-size:18px}.body h3{font-size:15px}',
  '.body a{color:var(--accent2)}.body a.xref{color:var(--accent);text-decoration:none;background:var(--chip);border-radius:4px;padding:0 4px;font-family:ui-monospace,Consolas,monospace;font-size:.92em}.body a.xref:hover{background:var(--accent2);color:#fff}',
  '.body code{font-family:ui-monospace,Consolas,monospace;background:var(--chip);border-radius:4px;padding:1px 5px;font-size:.9em}.body pre{background:var(--chip);border-radius:8px;padding:12px;overflow-x:auto}.body pre code{background:none;padding:0}',
  '.body table{border-collapse:collapse;margin:8px 0}.body th,.body td{border:1px solid var(--line);padding:5px 9px}.body img,.body .img-ph{color:var(--muted);font-style:italic}.body blockquote{margin:8px 0;padding:2px 14px;border-left:3px solid var(--line);color:var(--muted)}',
  '.backlinks{margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.bl-h{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px}',
  '.bl-item{display:flex;gap:10px;align-items:baseline;padding:4px 6px;border-radius:6px;cursor:pointer}.bl-item:hover{background:var(--chip)}.bl-id{font-family:ui-monospace,Consolas,monospace;color:var(--accent);white-space:nowrap}.bl-title{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.work-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px}',
  '.work-sec{margin-bottom:16px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.ws-t{font-weight:600;font-size:13px;margin-bottom:8px;color:var(--fg)}.ws-sub{font-size:11px;color:var(--muted);margin:6px 0 3px}',
  '.chips{display:flex;flex-wrap:wrap;gap:5px}.ws-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;border-top:1px solid var(--line)}.ws-row:first-of-type{border-top:none}.ws-id{flex:1;font-family:ui-monospace,Consolas,monospace;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ws-num{color:var(--muted)}',
  '.ws-warn{color:var(--warn)}.ws-ok{color:var(--ok)}.ws-ghost{font-size:12px;color:var(--warn);padding:1px 0 1px 10px}.muted{color:var(--muted);font-style:italic}',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// HTML assembly
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(DATA, minisearchSrc) {
  const dataBlob = scriptSafeJson(DATA);
  const viewer = scriptSafeInline('(' + clientMain.toString() + ')();');
  const title = 'Product Browser' + (DATA.project ? ' — ' + DATA.project : '');
  return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
    + '<title>' + escHtml(title) + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<div id="app"></div>'
    + '<script>' + scriptSafeInline(minisearchSrc) + '</script>'
    + '<script>var DATA=' + dataBlob + ';</script>'
    + '<script>' + viewer + '</script>'
    + '</body></html>';
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv;
  let root = null;
  let out = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--out') out = argv[++i];
  }
  root = root ? path.resolve(root) : findRoot(process.cwd());
  if (!root) { process.stderr.write('ERROR: no project root (need .claude + .product)\n'); process.exit(2); }
  if (!fs.existsSync(path.join(root, '.product'))) {
    process.stderr.write('ERROR: .product/ not found under ' + root + '\n'); process.exit(2);
  }
  const outPath = out ? path.resolve(out) : path.join(root, '.product', 'browser.html');

  const { artifacts, idIndex } = scanArtifacts(root);
  applyCrosslinks(artifacts, idIndex);
  const search = buildSearch(artifacts);
  const { work, warning } = collectWork(root);

  const byGroup = {};
  artifacts.forEach((a) => { byGroup[a.group] = (byGroup[a.group] || 0) + 1; });
  const projectName = (work && work.config && work.config.project_name) || path.basename(root);

  const DATA = {
    project: projectName || null,
    generated: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
    census: { artifacts: artifacts.length, byGroup },
    groups: GROUP_ORDER,
    empty: artifacts.length === 0,
    collectorWarning: warning,
    work,
    artifacts: artifacts.map((a) => ({
      key: a.key, id: a.id, kind: a.kind, group: a.group, type: a.type, title: a.title,
      status: a.status, confidence: a.confidence, created: a.created, updated: a.updated,
      version: a.version, file: a.file, bodyHtml: a.bodyHtml, backlinks: a.backlinks,
    })),
    search,
  };

  const minisearchSrc = fs.readFileSync(path.join(__dirname, 'vendor', 'minisearch.umd.js'), 'utf8');
  const html = buildHtml(DATA, minisearchSrc);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);

  process.stdout.write(JSON.stringify({
    out: outPath.replace(/\\/g, '/'),
    bytes: fs.statSync(outPath).size,
    artifacts: artifacts.length,
    byGroup,
    cross_link_targets: Object.keys(idIndex).length,
    work_panel: work ? true : false,
    collector_warning: warning || null,
  }, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('[product-browser-html] error: ' + ((e && e.stack) || e) + '\n');
    process.exit(2);
  }
}

module.exports = {
  findRoot, classify, splitFrontmatter, crosslink, scanArtifacts, buildSearch, scriptSafeJson, ID_RE,
};
