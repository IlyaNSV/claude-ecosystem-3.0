#!/usr/bin/env node
'use strict';
/**
 * rails-build.js — projector for the "work-rails" index (cut-2: L1 + L2).
 *
 * Deterministic projection of `git log` into a compact, reference-based index
 * of work-units. NOT a second source of truth: regenerable any time from git
 * history → cannot drift (same pattern as scripts/check-counts.js).
 *
 * Granularity:
 *   L1  commit × file × area      (numstat pass)
 *   L1+ artifact-IDs              (from file PATHS + commit SUBJECTS + DEV_JOURNAL)
 *   L2  content signatures        (blob-SHA version history + hash.js HEAD clones)
 *
 * Every record stores REFERENCES (SHA, path, artifact-ID, date, content-hash) —
 * never file content — so the index stays compact while remaining maximally
 * sliceable for search ("assortment").
 *
 * Signals produced:
 *   - area facets            : how often / how much each work-area was touched
 *   - artifact-ID facets     : which FM/BR/IC/DEC-DEV… and how often
 *   - DEC-DEV catalog        : full decision assortment (from DEV_JOURNAL)
 *   - skill/template candidates : files with byte-identical BODIES at HEAD
 *                                 (hash.js, frontmatter-insensitive) → "4 одинаково"
 *   - churn loops            : files that returned to a prior byte-state over
 *                              time (blob-SHA revisit) → "делали, откатывали"
 *
 * Outputs (into dev/meta-improvement/rails/):
 *   - rails-rollup.ndjson  — one line per area (machine-readable facets)
 *   - RAILS.md             — human digest
 *
 * Usage:
 *   node dev/meta-improvement/scripts/rails-build.js [--repo <dir>]
 *   node dev/meta-improvement/scripts/rails-build.js --list <area>   # debug: files in an area
 *
 * Windows-safe: execFileSync (no shell) so git --pretty %-placeholders and 0x1f
 * separators pass verbatim, dodging cmd.exe percent-expansion.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const repoIdx = args.indexOf('--repo');
const REPO = repoIdx >= 0 ? path.resolve(args[repoIdx + 1]) : process.cwd();
const listIdx = args.indexOf('--list');
const LIST_AREA = listIdx >= 0 ? args[listIdx + 1] : null;

const RAILS_DIR = path.join(REPO, 'dev', 'meta-improvement', 'rails');
const MAP_PATH = path.join(RAILS_DIR, 'rail-areas.json');

if (!fs.existsSync(MAP_PATH)) {
  console.error(`[rails] area map not found: ${MAP_PATH}`);
  process.exit(1);
}
const areaMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const DEFAULT_AREA = areaMap.default || 'misc';
const ORDERED = areaMap.ordered || [];

const ARTIFACT_RE = /\b(DEC-DEV|FM|BR|IC|SC|HYP|NFR|LC|VC|AM|MK|PS|UJ|RA|PA|FB|NOTE|LESSON)-\d+/g;
const TEXT_EXT = new Set(['.md', '.js', '.cjs', '.mjs', '.json', '.yaml', '.yml', '.sh', '.ps1', '.txt', '.template']);
const US = String.fromCharCode(31); // 0x1f unit-separator — absent from git output

function mapArea(p) {
  const np = p.replace(/\\/g, '/');
  for (const [prefix, area] of ORDERED) {
    if (np === prefix || np.startsWith(prefix)) return area;
  }
  return DEFAULT_AREA;
}

function artifactIds(s) {
  const ids = new Set();
  if (!s) return ids;
  ARTIFACT_RE.lastIndex = 0;
  let m;
  while ((m = ARTIFACT_RE.exec(s)) !== null) ids.add(m[0]);
  return ids;
}

function git(argv) {
  return execFileSync('git', ['-C', REPO, ...argv], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function normRename(fpath) {
  if (fpath.includes('=>')) {
    return fpath.replace(/\{[^}]*=>\s*([^}]*)\}/, '$1').replace(/.*=>\s*/, '').replace(/\/\//g, '/').trim();
  }
  return fpath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1 — numstat: area facets + churn + artifact-IDs (path + subject)
// ─────────────────────────────────────────────────────────────────────────────
const areas = new Map();          // area -> aggregate
const artifactTouch = new Map();  // id   -> { count, areas:Set, last }
let commitCount = 0, fileEvents = 0, firstDate = null, lastDate = null;

function ensureArea(a) {
  if (!areas.has(a)) {
    areas.set(a, {
      area: a, commits: new Set(), files: new Set(), artifactIds: new Set(),
      adds: 0, dels: 0, first: null, last: null, recent: [],
    });
  }
  return areas.get(a);
}

function flushCommit(c) {
  if (!c) return;
  const ids = artifactIds(c.subj);        // subject-level IDs (e.g. DEC-DEV-0107)
  const areasTouched = new Set();
  for (const f of c.files) {
    const area = mapArea(f.path);
    areasTouched.add(area);
    const ag = ensureArea(area);
    if (!ag.commits.has(c.sha) && ag.recent.length < 6) ag.recent.push(c.sha.slice(0, 9));
    ag.commits.add(c.sha);
    ag.files.add(f.path);
    ag.adds += f.adds;
    ag.dels += f.dels;
    if (!ag.first || c.date < ag.first) ag.first = c.date;
    if (!ag.last || c.date > ag.last) ag.last = c.date;
    for (const id of artifactIds(f.path)) ids.add(id); // path-level IDs (pilot: BR-064-*.md)
  }
  // Attribute every ID (subject ∪ path) once per commit, to all areas it touched.
  for (const id of ids) {
    const at = artifactTouch.get(id) || { count: 0, areas: new Set(), last: null };
    at.count++;
    for (const a of areasTouched) { at.areas.add(a); ensureArea(a).artifactIds.add(id); }
    if (!at.last || c.date > at.last) at.last = c.date;
    artifactTouch.set(id, at);
  }
}

{
  const raw = git(['log', '--no-merges', '--numstat', '--date=iso-strict', `--pretty=format:@@C@@${US}%H${US}%cI${US}%s`]);
  let cur = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@C@@')) {
      flushCommit(cur);
      const p = line.split(US);
      cur = { sha: p[1] || '', date: (p[2] || '').slice(0, 10), subj: p[3] || '', files: [] };
      commitCount++;
      if (cur.date) {
        if (!firstDate || cur.date < firstDate) firstDate = cur.date;
        if (!lastDate || cur.date > lastDate) lastDate = cur.date;
      }
      continue;
    }
    const mt = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!mt || !cur) continue;
    fileEvents++;
    cur.files.push({
      adds: mt[1] === '-' ? 0 : parseInt(mt[1], 10),
      dels: mt[2] === '-' ? 0 : parseInt(mt[2], 10),
      path: normRename(mt[3]),
    });
  }
  flushCommit(cur);
}

// Debug affordance: list distinct files mapped to an area, then exit.
if (LIST_AREA) {
  const hits = new Set();
  const raw = git(['log', '--no-merges', '--name-only', '--pretty=format:']);
  for (const line of raw.split('\n')) {
    const f = normRename(line.trim());
    if (f && mapArea(f) === LIST_AREA) hits.add(f);
  }
  console.log(`[rails] files in area "${LIST_AREA}" (${hits.size}):`);
  console.log([...hits].sort().join('\n'));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 2 — raw: per-file blob-SHA version history → churn loops (revisited state)
// ─────────────────────────────────────────────────────────────────────────────
const fileVersions = new Map(); // path -> [postimage blob sha, ...] (newest first)
try {
  const raw = git(['log', '--no-merges', '--no-renames', '--raw', '--no-abbrev', '--date=iso-strict', `--pretty=format:@@C@@`]);
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@C@@') || !line.startsWith(':')) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const meta = line.slice(1, tab).split(/\s+/); // [mode1, mode2, sha1, sha2, status]
    const postSha = meta[3];
    const fpath = normRename(line.slice(tab + 1));
    if (!postSha || /^0+$/.test(postSha)) continue; // deletion
    if (!fileVersions.has(fpath)) fileVersions.set(fpath, []);
    fileVersions.get(fpath).push(postSha);
  }
} catch (e) {
  console.error(`[rails] raw pass skipped: ${e.message}`);
}

const churn = [];
for (const [p, vers] of fileVersions) {
  const distinct = new Set(vers).size;
  const revisits = vers.length - distinct; // times the file returned to an identical byte-state
  if (revisits > 0) churn.push({ path: p, area: mapArea(p), changes: vers.length, distinct, revisits });
}
churn.sort((a, b) => b.revisits - a.revisits || b.changes - a.changes);

// ─────────────────────────────────────────────────────────────────────────────
// Pass 3 — HEAD behavioral clones via hash.js (frontmatter-insensitive bodies)
// ─────────────────────────────────────────────────────────────────────────────
let behavioralClones = [];
try {
  const hashlib = require(path.join(REPO, 'hooks', 'product', 'lib', 'hash.js'));
  const byBody = new Map(); // bodyHash -> [path,...]
  const tracked = git(['ls-files']).split('\n').filter(Boolean);
  for (const rel of tracked) {
    if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) continue;
    const abs = path.join(REPO, rel);
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isFile() || st.size > 512 * 1024 || st.size < 40) continue;
    let content;
    try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const h = hashlib.computeContentHash(content);
    if (!byBody.has(h)) byBody.set(h, []);
    byBody.get(h).push(rel);
  }
  behavioralClones = [...byBody.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([h, g]) => ({ hash: h, files: g.sort() }))
    .sort((a, b) => b.files.length - a.files.length);
} catch (e) {
  console.error(`[rails] hash.js clone pass skipped: ${e.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEC-DEV catalog (assortment) — from DEV_JOURNAL.md
// ─────────────────────────────────────────────────────────────────────────────
let journalIds = [];
try {
  const j = fs.readFileSync(path.join(REPO, 'DEV_JOURNAL.md'), 'utf8');
  const set = new Set();
  let m; const re = /DEC-DEV-(\d+)/g;
  while ((m = re.exec(j)) !== null) set.add(parseInt(m[1], 10));
  journalIds = [...set].sort((a, b) => a - b);
} catch { /* no journal */ }
const decId = (n) => `DEC-DEV-${String(n).padStart(4, '0')}`;
const decReferencedInCommits = journalIds.filter((n) => artifactTouch.has(decId(n))).length;

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────
fs.mkdirSync(RAILS_DIR, { recursive: true });

const areaList = [...areas.values()].sort(
  (a, b) => (b.last || '').localeCompare(a.last || '') || b.commits.size - a.commits.size
);

const ndjson = areaList.map((a) => JSON.stringify({
  area: a.area, commits: a.commits.size, files: a.files.size,
  artifact_ids: [...a.artifactIds].sort(), adds: a.adds, dels: a.dels,
  first_seen: a.first, last_seen: a.last, recent: a.recent,
})).join('\n') + '\n';
fs.writeFileSync(path.join(RAILS_DIR, 'rails-rollup.ndjson'), ndjson);

const now = new Date().toISOString().slice(0, 10);
const topIds = [...artifactTouch.entries()]
  .sort((a, b) => b[1].count - a[1].count || (b[1].last || '').localeCompare(a[1].last || ''))
  .slice(0, 25);

let md = '';
md += `# RAILS — work-unit digest\n\n`;
md += `> Projected from \`git log\` by [\`scripts/rails-build.js\`](../scripts/rails-build.js) on ${now}. **Regenerable — do not hand-edit.**\n`;
md += `> Granularity: commit × file × artifact-ID × content-signature. Records hold references (SHA / path / ID / date / hash), never content.\n\n`;
md += `**Summary:** ${commitCount} commits · ${areas.size} areas · ${artifactTouch.size} artifact-IDs seen · ${fileEvents} file-events · ${firstDate || '?'} → ${lastDate || '?'}\n\n`;

md += `## Areas — by last touched\n\n`;
md += `| area | commits | files | artifact-IDs | +/− | first | last |\n|---|--:|--:|--:|--:|---|---|\n`;
for (const a of areaList) {
  md += `| ${a.area} | ${a.commits.size} | ${a.files.size} | ${a.artifactIds.size} | +${a.adds}/−${a.dels} | ${a.first || '—'} | ${a.last || '—'} |\n`;
}

md += `\n## Top artifact-IDs — by commits referencing them\n\n`;
if (topIds.length) {
  md += `| ID | × | areas | last |\n|---|--:|---|---|\n`;
  for (const [id, t] of topIds) md += `| ${id} | ${t.count} | ${[...t.areas].join(', ')} | ${t.last || '—'} |\n`;
} else {
  md += `_(none detected)_\n`;
}

md += `\n## DEC-DEV catalog (decision assortment)\n\n`;
if (journalIds.length) {
  md += `${journalIds.length} decisions in DEV_JOURNAL · range ${decId(journalIds[0])} → ${decId(journalIds[journalIds.length - 1])} · ${decReferencedInCommits} referenced in commit subjects.\n`;
} else {
  md += `_(DEV_JOURNAL.md not found / no DEC-DEV IDs)_\n`;
}

md += `\n## 🎓 Skill / template candidates — identical bodies at HEAD\n\n`;
md += `<sub>hash.js body-hash (frontmatter-insensitive). ≥2 files sharing a body = duplication worth a template/skill.</sub>\n\n`;
if (behavioralClones.length) {
  md += `| × | files (shared body) |\n|--:|---|\n`;
  for (const c of behavioralClones.slice(0, 15)) md += `| ${c.files.length} | ${c.files.join('<br>')} |\n`;
  if (behavioralClones.length > 15) md += `\n_(+${behavioralClones.length - 15} more clusters)_\n`;
} else {
  md += `_(no byte-identical bodies at HEAD)_\n`;
}

md += `\n## Churn loops — files that returned to a prior state\n\n`;
md += `<sub>blob-SHA revisited = the file was edited back to an identical byte-state ≥1× → candidate "делали, откатывали / не помогло".</sub>\n\n`;
if (churn.length) {
  md += `| revisits | changes | distinct | area | file |\n|--:|--:|--:|---|---|\n`;
  for (const c of churn.slice(0, 15)) md += `| ${c.revisits} | ${c.changes} | ${c.distinct} | ${c.area} | ${c.path} |\n`;
  if (churn.length > 15) md += `\n_(+${churn.length - 15} more files with revisits)_\n`;
} else {
  md += `_(no revisited byte-states detected)_\n`;
}

fs.writeFileSync(path.join(RAILS_DIR, 'RAILS.md'), md);

console.log(
  `[rails] ${commitCount} commits · ${areas.size} areas · ${artifactTouch.size} artifact-IDs · ${fileEvents} file-events · ` +
  `${behavioralClones.length} clone-clusters · ${churn.length} churn-files → ${path.relative(REPO, path.join(RAILS_DIR, 'RAILS.md'))}`
);
