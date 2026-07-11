'use strict';
/**
 * Deep Discovery agents wiring test — G36 (DEC-DEV-0186).
 *
 * Static wiring checks over the two Deep-mode D1 research subagents
 * (market-researcher, competitor-analyst) + their spawn wiring in the
 * discovery-session skill and the /product:init command. Mirrors the
 * complete-feature-wiring / validate-feature-impl-wiring style: read the
 * sources, assert the load-bearing contracts are PRESENT IN THE TEXT.
 *
 * The subagents' research *behavior* is validated live (a real /product:init
 * --deep run); this guards against a refactor silently dropping a rail —
 * frontmatter drift, a lost pipeline phase, a broken spawn contract, or the
 * read-only invariant slipping (a Write/Edit tool creeping into the roster).
 *
 * Node stdlib only; run with `node tests/product/deep-discovery-agents-wiring.test.cjs`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MR = path.join(ROOT, 'agents', 'product', 'market-researcher.md');
const CA = path.join(ROOT, 'agents', 'product', 'competitor-analyst.md');
const SKILL = path.join(ROOT, 'skills', 'product', 'discovery-session.md');
const INIT = path.join(ROOT, 'commands', 'product', 'init.md');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  passed += 1;
}

// ---- frontmatter helper (name/description/tools/model + read-only tool roster) ----
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

const mr = fs.readFileSync(MR, 'utf-8');
const ca = fs.readFileSync(CA, 'utf-8');
const skill = fs.readFileSync(SKILL, 'utf-8');
const init = fs.readFileSync(INIT, 'utf-8');

console.log('deep-discovery agents wiring — G36');

// ---------- both files exist with the four canonical frontmatter fields ----------

for (const [label, text, file, expectedName] of [
  ['market-researcher', mr, MR, 'market-researcher'],
  ['competitor-analyst', ca, CA, 'competitor-analyst'],
]) {
  test(`${label}: frontmatter present with name/description/tools/model`, () => {
    const fm = frontmatter(text);
    assert(fm, `${file}: no YAML frontmatter block`);
    for (const key of ['name', 'description', 'tools', 'model']) {
      assert(fm[key] && fm[key].length > 0, `${label}: frontmatter '${key}' missing/empty`);
    }
    assert(fm.name === expectedName, `${label}: name '${fm.name}' does not match filename '${expectedName}'`);
  });

  test(`${label}: model pinned to opus (MDP analysis tier — DEC-DEV-0146 convention)`, () => {
    const fm = frontmatter(text);
    // These agents produce triangulated/credibility-scored synthesis + judgment → opus, not the
    // sonnet recon tier. Assert a concrete opus pin, not merely "some model".
    assert(/^claude-opus-4-8$/.test(fm.model), `${label}: model '${fm.model}' is not the pinned opus tier`);
  });

  test(`${label}: read-only + web tool roster (no Write/Edit/Bash — deliberate)`, () => {
    const fm = frontmatter(text);
    const tools = fm.tools.split(',').map((t) => t.trim());
    assert(tools.includes('Read'), `${label}: Read missing from tools`);
    assert(tools.includes('WebFetch'), `${label}: WebFetch (web access) missing from tools`);
    for (const forbidden of ['Write', 'Edit', 'NotebookEdit', 'Bash']) {
      assert(!tools.includes(forbidden), `${label}: mutating/exec tool '${forbidden}' crept into the read-only roster`);
    }
  });

  test(`${label}: canonical subagent_type contract (loud error, never general-purpose fallback)`, () => {
    assert(text.includes(`subagent_type: "${label}"`), `${label}: canonical subagent_type string missing`);
    assert(/loud blocking setup error/i.test(text), `${label}: loud-setup-error contract missing`);
    assert(/never.*general-purpose|not.*silently.*fall back/i.test(text), `${label}: no-general-purpose-fallback rail missing`);
  });

  test(`${label}: read-only output contract — returns draft, invoking session writes the file`, () => {
    assert(/no Write tool/i.test(text), `${label}: 'no Write tool' read-only note missing`);
    assert(/research-meta/i.test(text), `${label}: research-meta summary contract missing`);
  });
}

// ---------- market-researcher: the 8-phase pipeline is intact ----------

test('market-researcher: all 8 pipeline phases present in order', () => {
  const phases = ['Scope', 'Plan', 'Retrieve', 'Triangulate', 'Synthesize', 'Critique', 'Refine', 'Package'];
  let lastIdx = -1;
  phases.forEach((p, i) => {
    const marker = `### Phase ${i + 1} — ${p}`;
    const idx = mr.indexOf(marker);
    assert(idx !== -1, `market-researcher: phase marker '${marker}' missing`);
    assert(idx > lastIdx, `market-researcher: phase '${p}' out of order`);
    lastIdx = idx;
  });
});

test('market-researcher: output writes to .product/market-research.md with credibility scoring', () => {
  assert(mr.includes('.product/market-research.md'), 'market-researcher: MR artifact path missing');
  assert(/credibility/i.test(mr), 'market-researcher: credibility scoring contract missing');
  assert(/TAM|SAM|SOM/.test(mr), 'market-researcher: market-size (TAM/SAM/SOM) structure missing');
});

// ---------- competitor-analyst: the 6-stage pipeline is intact ----------

test('competitor-analyst: all 6 pipeline stages present in order', () => {
  const stages = ['Discovery', 'Filtering', 'Scraping', 'extraction', 'Synthesis', 'positioning'];
  let lastIdx = -1;
  stages.forEach((s, i) => {
    const marker = `### Stage ${i + 1} —`;
    const idx = ca.indexOf(marker);
    assert(idx !== -1, `competitor-analyst: stage-${i + 1} marker missing`);
    assert(idx > lastIdx, `competitor-analyst: stage ${i + 1} out of order`);
    lastIdx = idx;
    assert(new RegExp(s, 'i').test(ca.slice(idx, idx + 60)), `competitor-analyst: stage ${i + 1} title '${s}' drifted`);
  });
});

test('competitor-analyst: output writes to .product/competitive-analysis.md with matrix + positioning + gaps', () => {
  assert(ca.includes('.product/competitive-analysis.md'), 'competitor-analyst: CA artifact path missing');
  assert(/feature matrix/i.test(ca), 'competitor-analyst: feature matrix contract missing');
  assert(/positioning/i.test(ca), 'competitor-analyst: positioning map contract missing');
  assert(/market gaps/i.test(ca), 'competitor-analyst: market-gaps contract missing');
});

// ---------- wiring: discovery-session skill spawns both in the Deep branch ----------

test('discovery-session: Deep branch spawns both subagents by canonical type', () => {
  assert(skill.includes('subagent_type: "market-researcher"'), 'skill: market-researcher spawn missing');
  assert(skill.includes('subagent_type: "competitor-analyst"'), 'skill: competitor-analyst spawn missing');
});

test('discovery-session: main session writes the returned draft (subagents read-only) + Quick stays 1:1', () => {
  assert(/main session writes/i.test(skill), 'skill: "main session writes" output-handling contract missing');
  assert(/read-only/i.test(skill), 'skill: read-only subagent note missing');
  // Quick path must remain the unchanged inline default (absent==old behavior 1:1).
  assert(skill.includes('market-research-protocol-quick.md'), 'skill: Quick MR protocol reference lost');
  assert(skill.includes('competitive-analysis-protocol-quick.md'), 'skill: Quick CA protocol reference lost');
  assert(/1:1 when no `--deep`|1:1 behavior when no `--deep`/i.test(skill), 'skill: explicit Quick-1:1 invariant note missing');
});

// ---------- wiring: /product:init --deep is the entry point ----------

test('/product:init: --deep activates Deep mode and names both subagents', () => {
  assert(init.includes('--deep'), 'init: --deep flag missing');
  assert(init.includes('market-researcher'), 'init: market-researcher not referenced');
  assert(init.includes('competitor-analyst'), 'init: competitor-analyst not referenced');
});

console.log(`\n${passed} assertions passed.`);
