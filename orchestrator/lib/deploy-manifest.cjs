#!/usr/bin/env node
'use strict';
/**
 * deploy-manifest.cjs — the DETERMINISTIC reader of the E.A deploy-setup: parse the
 * `deploy-manifest.yaml`, expand `deploy_root` (`~` → $HOME), resolve the on-disk SCENE
 * (releases/ · current · shared/), pair the systemd unit templates with their unit names,
 * and REFUSE equipment that cannot possibly work (DEC-DEV-0203 / FIND-A + FIND-B).
 *
 * ── WHY THIS EXISTS (FIND-A, second live E.B run, 2026-07-14) ────────────────────────────
 * `deploy-to-stage` used to get `present` / `status` / `steps` from a **sonnet subagent**
 * (`label: 'manifest-parse'`). The SAME unchanged file (mtime older than every run) parsed
 * DIFFERENTLY across two runs 18 minutes apart: once as a full 4-step list → READY, once as
 * `step-list=MISSING` → ENV_NOT_READY. The agent even returned a self-contradictory pair
 * (`present: true` + empty `steps`). Ground truth: `steps` is a list of 4, everything on disk.
 *
 * "Does this file contain a step-list" is a DETERMINISTIC FACT ABOUT BYTES. It must be
 * extracted deterministically. A stochastic parse behind a readiness gate is a coin-flip in
 * both directions: a false negative randomly blocks deploys, and a false POSITIVE would wave a
 * mangled manifest through into a real mutation. So the parse moves into code, and the agent
 * becomes what it should always have been — a TRANSPORT: it runs `node deploy-manifest.cjs
 * parse …` via Bash and relays the JSON verbatim. Same CLI-seam shape as autonomy-policy.cjs /
 * env-readiness.cjs / runtime-readiness.cjs (the harness .mjs may not require() a lib —
 * DEC-DEV-0073 §D.1), and the same lesson the §3.2 resolver already learned: **the disposition
 * is code; the agent only carries it.**
 *
 * ── WHY IT ALSO GUARDS THE UNIT TEMPLATES (FIND-B, the same run) ─────────────────────────
 * E.A authors `<svc>.service.template` parameterized by `{{RELEASE_DIR}}` — a CONCRETE
 * `releases/<ts>`. A systemd unit pinned to one release is DEAF TO THE FLIP: `current` moves,
 * the unit still points at the old release, `systemctl restart` restarts the OLD code — and the
 * healthcheck then PASSES (the old release is serving, healthy, on the same port). The run
 * reports DEPLOYED. Nothing was deployed. Worse, that false green is exactly the `contract_evidence`
 * that would launder a never-verified `draft` CNT into `active` (DEC-DEV-0201).
 *
 * A false DEPLOYED is the worst outcome this process can produce, so a release-pinned unit
 * template is a BLOCKING DEFECT here: `blocking_defects: ['unit-template-release-pinned']` →
 * the consumer reads ENV_NOT_READY (the capability is mis-equipped ⇒ the deploy could not be
 * PREPARED) → BLOCKED, flipped=false, remedy = re-provision. NOT circular (unlike the 0201
 * deadlock): the fix is `/integrator:provision`, which needs no deploy. The Capistrano contract
 * is that units reference **`current`** (`{{CURRENT_LINK}}`); then flip + restart IS the deploy,
 * and the same flip backwards IS the rollback (E.C). The skill fix is in
 * `skills/integrator/deployment-provisioning.md` — the Orchestrator does not paper over a
 * broken template (§8.3: we EXECUTE equipment, we do not silently correct it).
 *
 * ── THE YAML SUBSET (honest about what it is) ────────────────────────────────────────────
 * Node stdlib ONLY (this lib is copied into a pilot's `.claude/orchestrator/lib/`, where there
 * is no node_modules), so there is no js-yaml — the parser below is a hand-rolled SUBSET, the
 * same way capability-probe.cjs hand-rolls its frontmatter reader. Supported: block maps, block
 * sequences (incl. `- key: {flow}` items), flow maps/seqs, quoted + bare scalars, `|`/`>` block
 * scalars, comments, `---` markers, CRLF. Deliberately TOLERANT — an unparseable construct is
 * skipped, never thrown; `{{TEMPLATE}}` placeholders at the head of an unquoted value are read as
 * text, not as a flow map (real YAML would reject them; a consumer that dies on the pilot's own
 * file is useless). NOT supported: anchors/aliases, multi-doc, complex keys, tags. If a real
 * manifest ever needs one, the parse degrades LOUDLY (`present: false` + a disclosure naming the
 * line) — it never fabricates a step-list.
 *
 * EOL: CRLF-normalized before anything else — the .yaml materialises CRLF on a Windows pilot
 * (`deployment-provisioning.md` "EOL tolerance"; campaign §8.2 pt 7 / G36).
 *
 * CLOCK-FREE BY CONSTRUCTION: `parse` is a pure function of (file bytes, $HOME). The release
 * timestamp is NOT read from a clock here — it is passed in (`--timestamp`) or left as the
 * `{{TIMESTAMP}}` placeholder. That is what makes the determinism testable (N runs ⇒ byte-identical
 * stdout) and is the same rail as the harness's own "the script may not read a clock".
 *
 * CLI (the seam an agent relays):
 *   node deploy-manifest.cjs parse --manifest <path> [--capability <slug>] [--home <dir>]
 *                                  [--timestamp <ts>] [--no-units]
 *     → JSON { present, status, contract, steps, healthcheck, migrate, release_layout,
 *              unit_templates, units, deploy_root, scene, blocking_defects, disclosures, … }
 *   Exit 0 always for a parse (a missing/broken manifest is DATA: present:false + why), 2 on usage.
 *
 * Tests: tests/orchestrator/deploy-manifest.test.cjs (incl. the real pilot manifest form as a
 * fixture, a CRLF twin, determinism over N runs, and the release-pinned-unit guard).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEPLOY_MANIFEST_SCHEMA_VERSION = 1;

/** Blocking defects — equipment that is present but CANNOT execute a correct deploy. */
const BLOCKING_DEFECTS = {
  UNIT_RELEASE_PINNED: 'unit-template-release-pinned',
};

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Join path segments the way the TARGET sees them (the deploy is local inside a Linux VM). */
function posixJoin(...parts) {
  const joined = parts
    .filter((p) => p !== null && p !== undefined && String(p) !== '')
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .filter((p) => p !== '')
    .join('/');
  return joined || '/';
}

// ---------------------------------------------------------------------------
// YAML subset — scalars
// ---------------------------------------------------------------------------

/**
 * Strip a trailing `# comment` — QUOTE-AWARE, and only where YAML actually starts one
 * (line start, or after whitespace). `command: echo #1` really is a comment in YAML;
 * `url: "http://x/#frag"` is not. Getting this wrong silently truncates a command.
 */
function stripComment(s) {
  let inS = false;
  let inD = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

function unquote(s) {
  const t = String(s == null ? '' : s).trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return t.slice(1, -1);
  }
  return t;
}

/** Typed scalar: null / true / false / int / float — else a string. Quoted ⇒ always a string. */
function scalar(raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (t === '') return '';
  if (t[0] !== '"' && t[0] !== "'") {
    if (t === 'null' || t === '~') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  }
  return unquote(t);
}

// ---------------------------------------------------------------------------
// YAML subset — flow collections ({…} / […]) on one line
// ---------------------------------------------------------------------------

/**
 * Is `rest` a flow collection? `{{DEPLOY_ROOT}}/releases` opens with `{` but is a TEMPLATE
 * PLACEHOLDER, not a flow map — read it as text (real YAML would reject it unquoted; a parser
 * that chokes on the pilot's own manifest is worse than one that is generous here).
 */
function isFlow(rest) {
  if (!rest) return false;
  if (rest[0] === '{' && rest[1] !== '{' && rest[rest.length - 1] === '}') return true;
  if (rest[0] === '[' && rest[rest.length - 1] === ']') return true;
  return false;
}

function parseFlowScalar(src, start) {
  let i = start;
  if (src[i] === '"' || src[i] === "'") {
    const q = src[i];
    i += 1;
    let out = '';
    while (i < src.length && src[i] !== q) { out += src[i]; i += 1; }
    i += 1;
    return { value: out, i };
  }
  let out = '';
  while (i < src.length && src[i] !== ',' && src[i] !== '}' && src[i] !== ']') { out += src[i]; i += 1; }
  return { value: scalar(out), i };
}

function parseFlowValue(src, start) {
  let i = start;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  if (src[i] === '{') return parseFlowMap(src, i);
  if (src[i] === '[') return parseFlowSeq(src, i);
  return parseFlowScalar(src, i);
}

function parseFlowMap(src, start) {
  let i = start + 1;
  const out = {};
  for (;;) {
    while (i < src.length && /[\s,]/.test(src[i])) i += 1;
    if (i >= src.length || src[i] === '}') { i += 1; break; }
    let key = '';
    if (src[i] === '"' || src[i] === "'") {
      const r = parseFlowScalar(src, i);
      key = String(r.value);
      i = r.i;
    } else {
      while (i < src.length && src[i] !== ':' && src[i] !== ',' && src[i] !== '}') { key += src[i]; i += 1; }
      key = key.trim();
    }
    while (i < src.length && /\s/.test(src[i])) i += 1;
    if (src[i] !== ':') { if (key) out[key] = null; continue; }   // tolerate a bare key
    i += 1;
    const v = parseFlowValue(src, i);
    if (key) out[key] = v.value;
    i = v.i;
  }
  return { value: out, i };
}

function parseFlowSeq(src, start) {
  let i = start + 1;
  const out = [];
  for (;;) {
    while (i < src.length && /[\s,]/.test(src[i])) i += 1;
    if (i >= src.length || src[i] === ']') { i += 1; break; }
    const v = parseFlowValue(src, i);
    out.push(v.value);
    i = v.i;
  }
  return { value: out, i };
}

// ---------------------------------------------------------------------------
// YAML subset — block structure
// ---------------------------------------------------------------------------

const KEY_RE = /^((?:"[^"]*")|(?:'[^']*')|(?:[^:]+?))\s*:\s*(.*)$/;
const BLOCK_SCALAR_RE = /^[|>][-+]?$/;

/** Normalize one raw line into { indent, text, blank }. Tabs → 2 spaces; comments stripped. */
function lineInfo(raw) {
  const noTab = String(raw).replace(/\t/g, '  ');
  const stripped = stripComment(noTab).replace(/\s+$/, '');
  const body = stripped.replace(/^ +/, '');
  return { indent: stripped.length - body.length, text: body, blank: body === '' };
}

function parseBlockScalar(L, start, minIndent, style) {
  let i = start;
  const buf = [];
  let base = null;
  while (i < L.length) {
    if (L[i].blank) { buf.push(''); i += 1; continue; }
    if (L[i].indent < minIndent) break;
    if (base === null) base = L[i].indent;
    buf.push(' '.repeat(Math.max(0, L[i].indent - base)) + L[i].text);
    i += 1;
  }
  while (buf.length && buf[buf.length - 1] === '') buf.pop();
  const joined = style[0] === '>' ? buf.join(' ') : buf.join('\n');
  const keep = style.length > 1 && style[1] === '-' ? '' : (buf.length ? '\n' : '');
  return { value: joined + keep, next: i };
}

function parseNode(L, start, minIndent) {
  let i = start;
  while (i < L.length && L[i].blank) i += 1;
  if (i >= L.length || L[i].indent < minIndent) return { value: null, next: i };
  if (L[i].text === '-' || L[i].text.startsWith('- ')) return parseSeq(L, i, L[i].indent);
  return parseMap(L, i, L[i].indent);
}

function parseMap(L, start, indent) {
  let i = start;
  const out = {};
  while (i < L.length) {
    if (L[i].blank) { i += 1; continue; }
    if (L[i].indent < indent) break;
    if (L[i].indent > indent) { i += 1; continue; }          // stray deeper line — tolerate, skip
    const t = L[i].text;
    if (t === '-' || t.startsWith('- ')) break;              // a sequence at this level ends the map
    if (t === '---' || t === '...') { i += 1; continue; }    // document markers
    const m = t.match(KEY_RE);
    if (!m) { i += 1; continue; }                            // not a key line — tolerate, skip
    const key = unquote(m[1]);
    const rest = m[2];
    if (rest === '') {
      const r = parseNode(L, i + 1, indent + 1);
      out[key] = r.value;
      i = r.next;
    } else if (BLOCK_SCALAR_RE.test(rest)) {
      const r = parseBlockScalar(L, i + 1, indent + 1, rest);
      out[key] = r.value;
      i = r.next;
    } else if (isFlow(rest)) {
      out[key] = parseFlowValue(rest, 0).value;
      i += 1;
    } else {
      out[key] = scalar(rest);
      i += 1;
    }
  }
  return { value: out, next: i };
}

function parseSeq(L, start, indent) {
  let i = start;
  const out = [];
  while (i < L.length) {
    if (L[i].blank) { i += 1; continue; }
    if (L[i].indent < indent) break;
    const t = L[i].text;
    if (t !== '-' && !t.startsWith('- ')) break;
    const rest = t === '-' ? '' : t.slice(2).trim();
    if (rest === '') {                                       // `-` then a nested block on the next lines
      const r = parseNode(L, i + 1, indent + 1);
      out.push(r.value);
      i = r.next;
      continue;
    }
    if (isFlow(rest)) { out.push(parseFlowValue(rest, 0).value); i += 1; continue; }
    if (KEY_RE.test(rest)) {
      // `- key: value` — a MAP item whose remaining keys sit at the column after the dash.
      const itemIndent = L[i].indent + 2;
      const sub = L.slice();
      sub[i] = { indent: itemIndent, text: rest, blank: false };
      const r = parseMap(sub, i, itemIndent);
      out.push(r.value);
      i = r.next;
      continue;
    }
    out.push(scalar(rest));
    i += 1;
  }
  return { value: out, next: i };
}

/** Parse a YAML-subset document. CRLF-tolerant. Returns a plain object (possibly empty). */
function parseYamlText(text) {
  const L = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n').map(lineInfo);
  let i = 0;
  while (i < L.length && (L[i].blank || L[i].text === '---')) i += 1;
  if (i >= L.length) return {};
  const r = parseNode(L, i, 0);
  return isPlainObject(r.value) ? r.value : {};
}

// ---------------------------------------------------------------------------
// Projection — the deploy-setup facts the consumer contracts on
// ---------------------------------------------------------------------------

/**
 * `~` / `$HOME` → the real home. THIS is the expansion nothing did before (FIND-B): the manifest
 * says `deploy_root: "~/deploy/my-first-test"` and `deploy-to-stage.mjs` contained no `homedir`,
 * no `expand`, no `deploy_root` — so `~` was never a directory, and the scene was never built.
 * `~otheruser/…` is NOT guessed (we cannot know another user's home) — it is disclosed instead.
 */
function expandHome(p, home) {
  const s = String(p == null ? '' : p).trim();
  if (!s) return { path: '', why: null };
  const h = String(home || os.homedir() || '').replace(/[\\/]+$/, '');
  if (s === '~' || s === '$HOME' || s === '${HOME}') return { path: h, why: null };
  if (s.startsWith('~/')) return { path: posixJoin(h, s.slice(2)), why: null };
  if (s.startsWith('$HOME/')) return { path: posixJoin(h, s.slice(6)), why: null };
  if (s.startsWith('${HOME}/')) return { path: posixJoin(h, s.slice(8)), why: null };
  if (s[0] === '~') {
    return { path: '', why: `deploy_root "${s}" uses a ~user form this lib will NOT guess (another user's home is unknowable from here) — declare an absolute path` };
  }
  return { path: s.replace(/\\/g, '/'), why: null };
}

/** Flatten the `- <name>: {…}` step wrappers into ordered `{ name, … }` records. */
function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  const out = [];
  for (const s of rawSteps) {
    if (typeof s === 'string' && s) { out.push({ name: s }); continue; }
    if (!isPlainObject(s)) continue;
    const keys = Object.keys(s);
    if (keys.length === 1 && !Object.prototype.hasOwnProperty.call(s, 'name')) {
      const v = s[keys[0]];
      if (isPlainObject(v)) { out.push(Object.assign({ name: keys[0] }, v)); continue; }
      out.push(v == null ? { name: keys[0] } : { name: keys[0], value: v });
      continue;
    }
    out.push(Object.assign({}, s));
  }
  return out;
}

/** The declared `timestamp_format` → the `date -u` format that renders it. Never improvised. */
const TS_FORMATS = {
  'YYYYMMDDTHHmmssZ': '+%Y%m%dT%H%M%SZ',
  'YYYYMMDDHHmmss': '+%Y%m%d%H%M%S',
  'YYYY-MM-DDTHH:mm:ssZ': '+%Y-%m-%dT%H:%M:%SZ',
};

/**
 * The SCENE — every absolute path the deploy needs, resolved from the layout, with
 * `{{DEPLOY_ROOT}}` / `{{TIMESTAMP}}` substituted. Defaults are the Capistrano shape, so a
 * layout that omits a key still resolves (and says it did).
 */
function resolveScene(layout, deployRoot, timestamp) {
  const lay = isPlainObject(layout) ? layout : {};
  const sub = (v) => (typeof v === 'string'
    ? v.replace(/\{\{\s*DEPLOY_ROOT\s*\}\}/g, deployRoot)
      .replace(/\{\{\s*TIMESTAMP\s*\}\}/g, timestamp || '{{TIMESTAMP}}')
    : null);
  const releasesDir = sub(lay.releases_dir) || posixJoin(deployRoot, 'releases');
  const currentLink = sub(lay.current_link) || posixJoin(deployRoot, 'current');
  const sharedDir = sub(lay.shared_dir) || posixJoin(deployRoot, 'shared');
  const contents = Array.isArray(lay.shared_contents) && lay.shared_contents.length
    ? lay.shared_contents.map((c) => String(c))
    : ['.env', 'logs/', 'uploads/'];
  const tsFormat = lay.timestamp_format ? String(lay.timestamp_format) : 'YYYYMMDDTHHmmssZ';
  return {
    deploy_root: deployRoot,
    releases_dir: releasesDir,
    current_link: currentLink,
    shared_dir: sharedDir,
    shared_contents: contents,
    // Every shared path, absolute. A trailing `/` in the declaration means "a directory".
    shared_paths: contents.map((c) => ({
      name: String(c).replace(/\/+$/, ''),
      dir: /\/$/.test(String(c)),
      path: posixJoin(sharedDir, String(c).replace(/\/+$/, '')),
    })),
    env_file: posixJoin(sharedDir, '.env'),
    release_dir: timestamp
      ? (sub(lay.release_dir) || posixJoin(releasesDir, timestamp))
      : null,
    timestamp_format: tsFormat,
    // The shell rendering of the DECLARED format — so the deploy agent stamps the release dir
    // with `date -u <date_fmt>` instead of inventing a timestamp shape.
    date_fmt: TS_FORMATS[tsFormat] || null,
  };
}

/**
 * Pair the systemd unit NAMES (authoritative: the `restart` step's `units:`) with their
 * `.service.template` FILES, and read each template to answer the one question that decides
 * whether a flip does anything at all: does it pin a CONCRETE release?
 */
function resolveUnits(doc, steps, manifestDir, readFile) {
  const disclosures = [];
  const restart = steps.find((s) => s.name === 'restart') || {};
  const names = Array.isArray(restart.units) ? restart.units.map((u) => String(u)) : [];

  // Declared template files: a map (unit → file), a list of files, or a list of {unit, template}.
  const declared = [];              // [{ unit|null, file }]
  const ut = doc.unit_templates;
  if (Array.isArray(ut)) {
    for (const it of ut) {
      if (typeof it === 'string') declared.push({ unit: null, file: it });
      else if (isPlainObject(it)) {
        const file = it.file || it.template || it.path || null;
        const unit = it.unit || it.name || it.service || null;
        if (file) declared.push({ unit: unit ? String(unit) : null, file: String(file) });
      }
    }
  } else if (isPlainObject(ut)) {
    for (const [k, v] of Object.entries(ut)) {
      if (typeof v === 'string') declared.push({ unit: String(k), file: v });
      else if (isPlainObject(v) && (v.file || v.template || v.path)) {
        declared.push({ unit: String(k), file: String(v.file || v.template || v.path) });
      }
    }
  } else if (typeof ut === 'string' && ut) {
    declared.push({ unit: null, file: ut });
  }

  // Nothing declared → scan the capability dir (the deployer writes the templates beside the manifest).
  if (!declared.length && manifestDir) {
    let entries = [];
    try { entries = fs.readdirSync(manifestDir); } catch (_e) { entries = []; }
    for (const f of entries.filter((f) => f.endsWith('.service.template')).sort()) {
      declared.push({ unit: null, file: f });
    }
    if (declared.length) disclosures.push(`unit_templates not declared in the manifest — ${declared.length} *.service.template file(s) discovered beside it (${declared.map((d) => d.file).join(', ')})`);
  }

  // Pair a file with a unit name by the service token (mft-api ↔ app-api.service.template → "api").
  const pairFor = (unit) => {
    const explicit = declared.find((d) => d.unit === unit);
    if (explicit) return explicit.file;
    const token = String(unit).split(/[-_.]/).filter(Boolean).slice(-1)[0] || String(unit);
    const hits = declared.filter((d) => {
      const base = path.basename(String(d.file)).toLowerCase();
      return base.includes(String(unit).toLowerCase()) || base.includes(token.toLowerCase());
    });
    if (hits.length === 1) return hits[0].file;
    if (hits.length > 1) disclosures.push(`unit "${unit}" matches ${hits.length} templates (${hits.map((h) => h.file).join(', ')}) — cannot pair deterministically; declare unit_templates as a { unit: file } map`);
    return null;
  };

  const units = [];
  const blocking = [];
  const roster = names.length ? names : declared.map((d) => path.basename(String(d.file)).replace(/\.service\.template$/, ''));
  for (const unit of roster) {
    const file = names.length ? pairFor(unit) : (declared.find((d) => path.basename(String(d.file)).replace(/\.service\.template$/, '') === unit) || {}).file || null;
    const abs = file ? (path.isAbsolute(file) ? file : path.join(manifestDir || '.', file)) : null;
    let body = null;
    if (abs) {
      try { body = String(readFile(abs)).replace(/\r\n/g, '\n'); } catch (_e) { body = null; }
    }
    // Scan the EFFECTIVE unit only. systemd treats a leading `#`/`;` line as a comment, so a
    // template that merely *warns* about {{RELEASE_DIR}} in a comment is not pinned by it — and a
    // guard that cannot tell a directive from a comment is a guard that cries wolf (it flagged the
    // corrected template on its first run, precisely because that template says "NEVER
    // {{RELEASE_DIR}}"). What binds a systemd service is its directives, and only those.
    const effective = body === null ? null
      : body.split('\n').filter((l) => !/^\s*[#;]/.test(l)).join('\n');
    const rec = {
      name: unit,
      template: file,
      template_found: body !== null,
      // THE FIND-B GUARD. A unit parameterized by {{RELEASE_DIR}} (or hard-wired to a literal
      // releases/<ts> path) is pinned to ONE release: the flip moves `current`, the unit does not
      // move with it, and `systemctl restart` restarts the OLD code — while the healthcheck passes.
      release_pinned: effective === null ? null
        : (/\{\{\s*RELEASE_DIR\s*\}\}/.test(effective) || /\/releases\/[^\s/]+/.test(effective)),
      placeholders: effective === null ? [] : Array.from(new Set((effective.match(/\{\{\s*[A-Z_]+\s*\}\}/g) || []).map((s) => s.replace(/\s+/g, '')))).sort(),
    };
    if (rec.release_pinned) {
      blocking.push(BLOCKING_DEFECTS.UNIT_RELEASE_PINNED);
      disclosures.push(
        `unit "${unit}" (${file}) is pinned to a CONCRETE release ({{RELEASE_DIR}} / a literal releases/<ts> path). `
        + 'A flip of `current` would NOT move this service — systemctl restart would restart the OLD release while the healthcheck passes, '
        + 'reporting a DEPLOYED that never happened (and laundering an unverified draft contract into `active`). '
        + 'The unit MUST reference the `current` symlink ({{CURRENT_LINK}}), per the Capistrano contract. '
        + 'Fix the EQUIPMENT: re-run /integrator:provision (skills/integrator/deployment-provisioning.md §1) — the Orchestrator does not rewrite Integrator templates (§8.3).');
    }
    if (!rec.template_found && file) disclosures.push(`unit "${unit}": template ${file} not readable beside the manifest`);
    if (!file) disclosures.push(`unit "${unit}": no .service.template could be paired with it`);
    units.push(rec);
  }
  return { units, disclosures, blocking: Array.from(new Set(blocking)) };
}

/**
 * The full deploy-setup read. `present` is a QUESTION OF FACT (is the equipment here and
 * executable?) and NEVER reads `status` — collapsing the two made the first deploy impossible in
 * principle (DEC-DEV-0201). `status` is a QUESTION OF TRUST and rides to the §3.2 resolver.
 */
function readManifest(file, opts) {
  const o = opts || {};
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  const empty = {
    deploy_manifest_schema_version: DEPLOY_MANIFEST_SCHEMA_VERSION,
    manifest: file || null,
    present: false,
    status: null,
    status_source: null,
    contract: null,
    capability: null,
    steps: [],
    healthcheck: null,
    migrate: null,
    release_layout: null,
    unit_templates: null,
    units: [],
    deploy_root: null,
    scene: null,
    eol: null,
    blocking_defects: [],
    disclosures: [],
  };

  let raw;
  try { raw = String(readFile(file)); } catch (e) {
    return Object.assign(empty, {
      disclosures: [`deploy-manifest not readable at ${file}: ${e.code || e.message} — the capability is not provisioned (present:false ⇒ ENV_NOT_READY); provision it via /integrator:provision`],
    });
  }

  const eol = /\r\n/.test(raw) ? 'CRLF' : 'LF';
  const doc = parseYamlText(raw);
  const disclosures = [];

  if (!Object.keys(doc).length) {
    return Object.assign(empty, {
      eol,
      disclosures: [`deploy-manifest at ${file} parsed to NOTHING (${raw.length} bytes, ${eol}) — empty, or a YAML construct outside this parser's subset. present:false; NOT fabricating a step-list.`],
    });
  }

  const steps = normalizeSteps(doc.steps);
  // present = FACT: the file is here, it parsed, and it carries an executable step-list.
  const present = steps.length > 0;
  if (!present) {
    disclosures.push(`deploy-manifest at ${file} parsed (${Object.keys(doc).length} top-level keys) but carries NO executable step-list (steps: ${JSON.stringify(doc.steps === undefined ? '<absent>' : doc.steps)}) — present:false; NOT fabricating one.`);
  }

  // ── TRUST axis (never touches `present`) ──────────────────────────────────
  // Read the declared status from a small, ordered set of places; NEVER invent one. An absent
  // status is null here — the consumer conservatively reads null as `draft` (an undeclared
  // contract must never WIDEN autonomy).
  let status = null;
  let statusSource = null;
  const statusCandidates = [
    ['status', doc.status],
    ['contract.status', isPlainObject(doc.contract) ? doc.contract.status : undefined],
    ['capability_contract.status', isPlainObject(doc.capability_contract) ? doc.capability_contract.status : undefined],
  ];
  for (const [src, v] of statusCandidates) {
    if (typeof v === 'string' && v.trim()) { status = v.trim(); statusSource = src; break; }
  }

  // The CNT id the manifest NAMES — never guessed from a directory listing.
  let contract = null;
  const contractCandidates = [
    doc.contract,
    isPlainObject(doc.contract) ? doc.contract.id : undefined,
    doc.cnt,
    isPlainObject(doc.capability_contract) ? doc.capability_contract.id : undefined,
    doc.capability_contract,
  ];
  for (const c of contractCandidates) {
    if (typeof c === 'string' && /^CNT-\S+/i.test(c.trim())) { contract = c.trim(); break; }
  }

  // ── SCENE ────────────────────────────────────────────────────────────────
  const layout = isPlainObject(doc.layout) ? doc.layout : (isPlainObject(doc.release_layout) ? doc.release_layout : null);
  const rootDecl = doc.deploy_root != null ? String(doc.deploy_root) : '';
  const expanded = expandHome(rootDecl, o.home);
  if (expanded.why) disclosures.push(expanded.why);
  if (!rootDecl) disclosures.push('manifest declares no `deploy_root` — the scene cannot be located; nothing will be created');
  const scene = expanded.path ? resolveScene(layout, expanded.path, o.timestamp || null) : null;
  if (scene && !scene.date_fmt) {
    disclosures.push(`layout.timestamp_format "${scene.timestamp_format}" is not one this lib can render as a \`date -u\` format — the deploy agent must be told the exact format, not left to invent one`);
  }

  // ── UNITS (+ the release-pinning guard) ──────────────────────────────────
  const manifestDir = file ? path.dirname(file) : null;
  const unitInfo = o.units === false
    ? { units: [], disclosures: [], blocking: [] }
    : resolveUnits(doc, steps, manifestDir, readFile);
  disclosures.push(...unitInfo.disclosures);

  // The manifest's own capability slug vs. the one we were invoked for — a mismatch means the
  // caller is about to deploy a DIFFERENT capability than it thinks it is.
  const capability = doc.capability != null ? String(doc.capability) : null;
  if (o.capability && capability && capability !== o.capability) {
    disclosures.push(`manifest declares capability "${capability}" but this deploy was invoked for "${o.capability}" — confirm the manifest path is the right one`);
  }

  const migrateStep = steps.find((s) => s.name === 'migrate') || null;

  return {
    deploy_manifest_schema_version: DEPLOY_MANIFEST_SCHEMA_VERSION,
    manifest: file,
    present,                                     // FACT — file + parse + step-list. Never reads `status`.
    status,                                      // TRUST — verbatim or null. Never invented.
    status_source: statusSource,
    contract,                                    // the CNT id the manifest names, or null
    capability,
    steps,                                       // ordered, flattened: [{ name, … }]
    healthcheck: isPlainObject(doc.healthcheck) ? doc.healthcheck : null,
    migrate: migrateStep || (isPlainObject(doc.migrate) ? doc.migrate : null),
    release_layout: layout,
    unit_templates: doc.unit_templates != null ? doc.unit_templates : null,
    units: unitInfo.units,                       // [{ name, template, template_found, release_pinned, placeholders }]
    deploy_root: rootDecl ? { declared: rootDecl, expanded: expanded.path || null } : null,
    scene,                                       // every absolute path the Deploy phase needs
    eol,
    blocking_defects: unitInfo.blocking,         // equipment that CANNOT execute a correct deploy
    disclosures,
  };
}

// ---------------------------------------------------------------------------
// CLI (FS + argv live here only)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = { units: true };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') a.help = true;
    else if (t === '--no-units') a.units = false;
    else if (t.startsWith('--')) {
      const key = t.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { a[key] = next; i += 1; } else a[key] = true;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'deploy-manifest.cjs — deterministic reader of the E.A deploy-setup (DEC-DEV-0203).',
    '',
    'PARSE:  node deploy-manifest.cjs parse --manifest <path> [--capability <slug>]',
    '                                        [--home <dir>] [--timestamp <ts>] [--no-units]',
    '  → JSON { present, status, contract, steps, healthcheck, migrate, release_layout,',
    '           unit_templates, units, deploy_root, scene, blocking_defects, disclosures }',
    '',
    '  present          FACT  — the file exists, parses, and carries an executable step-list.',
    '                          NEVER reads `status` (collapsing the two deadlocked the first',
    '                          deploy — DEC-DEV-0201). A step-list is never fabricated.',
    '  status           TRUST — draft | active | stub, verbatim, or null (⇒ the consumer reads',
    '                          null conservatively as draft). Rides to the §3.2 resolver.',
    '  scene            every absolute path the Deploy phase materialises (deploy_root with `~`',
    '                          expanded, releases/, current, shared/{.env,logs,uploads}).',
    '  blocking_defects equipment that is present but CANNOT execute a correct deploy —',
    '                          `unit-template-release-pinned`: a systemd unit wired to a concrete',
    '                          releases/<ts> is deaf to the flip (restart brings back the OLD',
    '                          release while the healthcheck passes ⇒ a false DEPLOYED).',
    '',
    'Clock-free: the release timestamp is passed in (--timestamp), never read from a clock —',
    'so N parses of one file are byte-identical. Exit 0 for any parse (a broken manifest is DATA:',
    'present:false + disclosures); exit 2 on a usage error.',
  ].join('\n') + '\n');
}

function main() {
  const sub = process.argv[2];
  const a = parseArgs(process.argv.slice(3));
  if (a.help || sub === '--help' || sub === '-h' || sub === 'help' || !sub) { printHelp(); process.exit(sub ? 0 : 2); }

  if (sub === 'parse') {
    if (!a.manifest || a.manifest === true) {
      process.stderr.write('deploy-manifest: parse needs --manifest <path>\n');
      process.exit(2);
    }
    const out = readManifest(String(a.manifest), {
      home: typeof a.home === 'string' ? a.home : undefined,
      timestamp: typeof a.timestamp === 'string' ? a.timestamp : null,
      capability: typeof a.capability === 'string' ? a.capability : null,
      units: a.units !== false,
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(0);
  }

  printHelp();
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEPLOY_MANIFEST_SCHEMA_VERSION,
  BLOCKING_DEFECTS,
  stripComment,
  scalar,
  parseYamlText,
  normalizeSteps,
  expandHome,
  resolveScene,
  resolveUnits,
  readManifest,
  posixJoin,
};
