'use strict';
/**
 * completeness-oracle.cjs — deterministic D1-D2B completeness scorer (Epic B / B1 core).
 *
 * The bounded completeness-loop (skills/product/completeness-loop.md) needs an EXTERNAL,
 * deterministic stop-signal — never the generator grading itself (vision §4 cluster 1,
 * Huang et al. 2310.01798). This oracle is that signal: it scores a feature's readiness
 * against the handoff Definition of Ready (handoff-spec.md §7, B1-B8) — the τ anchor the
 * vision picks for "sufficient, not ideal" (B2). It reports a score + gaps + ambiguities,
 * and is HONEST about what it does NOT compute (B5/B6/B8 delegate to the existing
 * validators / bg-extractor — no silent truncation).
 *
 * Dual-use (orchestrator-lib convention): require() exports + a require.main CLI an agent
 * runs via Bash and relays as JSON (the loop's stop-check).
 *
 *   node hooks/product/lib/completeness-oracle.cjs --feature FM-003 --root .
 *
 * τ = 1.0 over the COMPUTED blockers (DoR is all-required); `met` is true only when every
 * computed blocker passes. `delegated_unverified` lists the blockers a human/validator must
 * still confirm, so `met:true` is never read as "fully proven".
 */

const fs = require('fs');
const path = require('path');

// .product/ artifact dir per ref prefix.
const DIR_BY_PREFIX = {
  SC: 'scenarios',
  BR: 'business-rules',
  LC: 'lifecycles',
  VC: 'verification',
  IC: 'invariants',
  NFR: 'nfr',
  MK: 'mockups',
  NM: 'mockups',
};

// ---------- frontmatter ----------

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const obj = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    let val = kv[2].trim().replace(/\s+#.*$/, '');
    if (/^\[.*\]$/.test(val)) {
      obj[kv[1]] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["'](.*)["']$/, '$1'))
        .filter(Boolean);
    } else {
      obj[kv[1]] = val.replace(/^["'](.*)["']$/, '$1');
    }
  });
  return obj;
}

// ---------- index ----------

/** Scan .product/ artifact dirs → Map(id → {id, status, type, file, fm}). */
function indexProduct(productRoot) {
  const index = new Map();
  const dirs = new Set(Object.values(DIR_BY_PREFIX).concat(['features']));
  for (const dir of dirs) {
    const abs = path.join(productRoot, dir);
    let files = [];
    try {
      files = fs.readdirSync(abs).filter((f) => f.endsWith('.md') && !f.startsWith('.'));
    } catch (e) {
      continue;
    }
    for (const f of files) {
      let fm;
      try {
        fm = parseFrontmatter(fs.readFileSync(path.join(abs, f), 'utf-8'));
      } catch (e) {
        continue;
      }
      if (!fm.id) continue;
      index.set(fm.id, {
        id: fm.id,
        status: fm.status || '<unknown>',
        type: fm.type || dir,
        file: path.join(dir, f).replace(/\\/g, '/'),
        fm,
      });
    }
  }
  return index;
}

function isActive(entry) {
  return entry && (entry.status === 'active' || entry.status === 'shipped');
}

// ---------- score ----------

/**
 * Score a feature against the DoR blockers.
 * @returns {object} structured verdict (see fields below)
 */
function scoreFeature(fmId, productRoot) {
  const index = indexProduct(productRoot);
  const fmEntry = index.get(fmId);
  if (!fmEntry) {
    return {
      feature: fmId,
      error: `feature ${fmId} not found under ${productRoot}/features`,
      score: 0,
      tau: 1,
      met: false,
      blockers: [],
      gaps: [`feature ${fmId} does not exist`],
      ambiguities: [],
      delegated_unverified: [],
    };
  }
  const fm = fmEntry.fm;
  const hasUi = String(fm.has_ui) === 'true';
  const refs = (key) => (Array.isArray(fm[key]) ? fm[key] : []);
  const blockers = [];
  const gaps = [];
  const ambiguities = [];

  const add = (id, name, status, detail) => blockers.push({ id, name, status, detail });

  // B1 — FM.status in-progress (or shipped)
  if (fmEntry.status === 'in-progress' || fmEntry.status === 'shipped') {
    add('B1', 'FM status in-progress', 'pass', `status=${fmEntry.status}`);
  } else {
    add('B1', 'FM status in-progress', 'fail', `status=${fmEntry.status}`);
    gaps.push(`B1: FM ${fmId} is '${fmEntry.status}', not in-progress`);
  }

  // B2 — at least one active SC
  const scs = refs('scenarios').map((id) => index.get(id)).filter(Boolean);
  const activeScs = scs.filter(isActive);
  if (activeScs.length >= 1) {
    add('B2', '>=1 active scenario', 'pass', `${activeScs.length}/${refs('scenarios').length} SC active`);
  } else {
    add('B2', '>=1 active scenario', 'fail', `${refs('scenarios').length} SC referenced, 0 active`);
    gaps.push(`B2: no active SC for ${fmId}`);
  }
  // ambiguity: SC referenced but missing or draft
  for (const id of refs('scenarios')) {
    const e = index.get(id);
    if (!e) ambiguities.push(`SC ${id} referenced by ${fmId} but file not found`);
    else if (!isActive(e)) ambiguities.push(`SC ${id} is '${e.status}', not active`);
  }

  // B3 (frontmatter-ref approximation) — referenced BR all exist & active
  const brRefs = refs('rules');
  const brMissing = brRefs.filter((id) => !index.get(id));
  const brInactive = brRefs.filter((id) => index.get(id) && !isActive(index.get(id)));
  if (brRefs.length === 0) {
    add('B3', 'referenced BR active', 'n/a', 'no BR referenced');
  } else if (brMissing.length === 0 && brInactive.length === 0) {
    add('B3', 'referenced BR active', 'pass', `${brRefs.length} BR active`);
  } else {
    add('B3', 'referenced BR active', 'fail', `missing=[${brMissing}] inactive=[${brInactive}]`);
    if (brMissing.length) gaps.push(`B3: BR not found: ${brMissing.join(', ')}`);
    if (brInactive.length) gaps.push(`B3: BR not active: ${brInactive.join(', ')}`);
  }

  // B4 — every active SC has >=1 active VC (VC.scenario reverse-ref).
  // VC.scenario is EITHER a scalar (`scenario: SC-001`, per the catalog) OR a list
  // (`scenario: [SC-001, SC-001a, ...]`, as real pilot VCs use — one VC covering an SC
  // family). Handle both (dogfood finding: array form was the live reality). DEC-DEV-0099.
  // The link field name itself varies in real data: `scenario:` (catalog) AND `scenarios:`
  // (some pilot VCs) both occur — accept either (dogfood finding #2; DEC-DEV-0099). The
  // field-name inconsistency in the pilot is a separate data-quality finding, not fixed here.
  const vcScenarioField = (fm) => (fm.scenario != null ? fm.scenario : fm.scenarios);
  const vcs = [];
  for (const [, e] of index) {
    if (e.type && /verification|VC/i.test(e.type) && e.fm && vcScenarioField(e.fm) != null) vcs.push(e);
  }
  const vcCoversScenario = (vc, scId) => {
    const field = vcScenarioField(vc.fm);
    return Array.isArray(field) ? field.includes(scId) : field === scId;
  };
  const uncoveredScs = activeScs.filter((sc) => {
    const cover = vcs.filter((vc) => vcCoversScenario(vc, sc.id) && isActive(vc));
    return cover.length === 0;
  });
  if (activeScs.length === 0) {
    add('B4', 'VC coverage per SC', 'n/a', 'no active SC to cover');
  } else if (uncoveredScs.length === 0) {
    add('B4', 'VC coverage per SC', 'pass', `all ${activeScs.length} active SC covered`);
  } else {
    add('B4', 'VC coverage per SC', 'fail', `uncovered: ${uncoveredScs.map((s) => s.id).join(', ')}`);
    gaps.push(`B4: ${uncoveredScs.length} active SC have no active VC: ${uncoveredScs.map((s) => s.id).join(', ')}`);
  }

  // B7 — if has_ui, >=1 active MK
  if (hasUi) {
    const mks = refs('mockups').map((id) => index.get(id)).filter(Boolean);
    const activeMks = mks.filter(isActive);
    if (activeMks.length >= 1) {
      add('B7', 'has_ui: >=1 active MK', 'pass', `${activeMks.length} MK active`);
    } else {
      add('B7', 'has_ui: >=1 active MK', 'fail', `has_ui=true but ${refs('mockups').length} MK referenced, 0 active`);
      gaps.push(`B7: has_ui feature ${fmId} has no active MK`);
    }
  } else {
    add('B7', 'has_ui: >=1 active MK', 'n/a', 'has_ui=false');
  }

  // NFR status hygiene (W-class, surfaced as ambiguity not a hard blocker)
  if (fm.nfr_status === 'pending') {
    ambiguities.push(`NFR review pending for ${fmId} (nfr_status=pending) — decide [Y]/[D]/[L] before handoff`);
  }

  // ---- delegated (NOT computed here — no silent truncation) ----
  const delegated = [
    { id: 'B5', name: 'BG covers bold terms', via: '/product:bg-review + bg-extractor.js' },
    { id: 'B6', name: 'V-01..V-11 passed', via: '/product:validate' },
    { id: 'B8', name: 'RPM covers SC.actors', via: '/product:validate (RPM check)' },
  ];

  // ---- score over COMPUTED, applicable (non-n/a) blockers ----
  const applicable = blockers.filter((b) => b.status !== 'n/a');
  const passed = applicable.filter((b) => b.status === 'pass').length;
  const score = applicable.length === 0 ? 0 : passed / applicable.length;
  const tau = 1.0;
  const met = applicable.length > 0 && applicable.every((b) => b.status === 'pass');

  return {
    feature: fmId,
    fm_status: fmEntry.status,
    has_ui: hasUi,
    blockers,
    score: Number(score.toFixed(4)),
    tau,
    met,
    gaps,
    ambiguities,
    delegated_unverified: delegated,
    note: met
      ? 'All computed DoR blockers pass; confirm delegated_unverified (B5/B6/B8) via the named validators before declaring done.'
      : 'Open DoR gaps remain — see gaps[]. Loop should resolve auto-fixable ones and escalate decisions.',
  };
}

module.exports = { parseFrontmatter, indexProduct, scoreFeature, isActive };

// ---------- CLI ----------

if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const feature = get('--feature');
  const root = get('--root') || '.';
  if (!feature) {
    console.error('usage: node completeness-oracle.cjs --feature FM-NNN [--root <project-root>]');
    process.exit(2);
  }
  const productRoot = path.join(root, '.product');
  const result = scoreFeature(feature, productRoot);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
