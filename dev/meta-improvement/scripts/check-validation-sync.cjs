#!/usr/bin/env node
/**
 * check-validation-sync.cjs — catalog↔runner drift linter (DEC-DEV-0158; closes audit gap G19).
 *
 * docs/pmo/validation.md (rule catalog, semantic SSOT) and skills/product/validation-runner.md
 * (the on-demand runner's HARDCODED tables, implementation SSOT) were synchronized by hand —
 * «drift manually monitored», linter deferred until «rules >100 or first observed drift»
 * (validation.md §11 / runner §Architecture). First observed drift arrived (V-18 + all four
 * V-AM-* silently absent from the runner), so this pays that debt.
 *
 * Scope: ID-SET comparison only, never rule semantics. The runner's anti-pattern «не парсить
 * validation.md программно» targets runtime rule EXECUTION; heading-level drift detection is
 * exactly the sanctioned v1.1 candidate.
 *
 * A recognized, documented skip is declared IN the runner with a machine-readable marker the
 * linter treats as coverage (reason is mandatory):
 *   <!-- catalog-sync:acknowledged V-MK-01 V-MK-02 ... reason="Design module Phase 6; documented skip" -->
 *
 * Checks:
 *   [1] every catalog rule (#### V-… heading) is in a runner table OR acknowledged
 *   [2] every runner-table rule exists in the catalog (no orphans)
 *   [3] every acknowledged rule exists in the catalog (no stale acks)
 *   [4] no rule is both in a table AND acknowledged (ambiguous coverage)
 *   [5] catalog heading count equals the catalog's own prose total («N активных правил»)
 *   [6] namespace summary table (§0) per-prefix counts match the actual heading counts
 *
 * Exit: 0 = in sync · 1 = drift found · 2 = could not establish ground truth.
 * Wired into `npm run verify` as check:validation-sync.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function repoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (e) {
    return process.cwd();
  }
}

const ROOT = repoRoot();
const CATALOG = path.join(ROOT, 'docs', 'pmo', 'validation.md');
const RUNNER = path.join(ROOT, 'skills', 'product', 'validation-runner.md');

const ID_RE = /^V-[A-Za-z0-9-]+$/;

function die(msg) {
  process.stderr.write(`check-validation-sync: ${msg}\n`);
  process.exit(2);
}

function readOrDie(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return die(`cannot read ${p}: ${e.message}`);
  }
}

// ─── Catalog side ────────────────────────────────────────────────────────────

function catalogIds(text) {
  const ids = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^####\s+(V-[A-Za-z0-9-]+):/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

function catalogProseTotal(text) {
  const m = text.match(/(\d+)\s*активны[а-яё]*\s*правил/i);
  return m ? parseInt(m[1], 10) : null;
}

// Namespace class of a rule id: V-H-04 → "V-H", V-AM-frontmatter → "V-AM", V-01/V-14a → "V".
function nsOf(id) {
  const m = id.match(/^V-([A-Z]+)-/);
  return m ? `V-${m[1]}` : 'V';
}

// §0 summary table rows: | <name> | V-…​ | <coverage> | <count> | — numeric counts only.
function namespaceTable(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|([^|]*)\|([^|]*)\|[^|]*\|([^|]*)\|\s*$/);
    if (!m) continue;
    const prefixSpec = m[2].trim();
    const count = m[3].trim();
    if (!/^V-/.test(prefixSpec) || !/^\d+$/.test(count)) continue; // skip header, P-RULE, "future"
    const first = prefixSpec.split(/[.\s]/)[0]; // "V-01..V-18" → "V-01"; "V-AM-*" → "V-AM-*"
    rows.push({ ns: nsOf(first.replace(/\*$/, 'x')), stated: parseInt(count, 10), spec: prefixSpec });
  }
  return rows;
}

// ─── Runner side ─────────────────────────────────────────────────────────────

function runnerTableIds(text) {
  const ids = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(V-[A-Za-z0-9-]+)\s*\|/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

function acknowledgedIds(text, errors) {
  const ids = [];
  const re = /<!--\s*catalog-sync:acknowledged\s+([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const body = m[1];
    const reason = body.match(/reason="([^"]*)"/);
    if (!reason || !reason[1].trim()) {
      errors.push(`[ack] marker without a non-empty reason="…": ${body.trim().slice(0, 80)}`);
    }
    const idPart = body.replace(/reason="[^"]*"/, '');
    for (const tok of idPart.split(/\s+/).filter(Boolean)) {
      if (!ID_RE.test(tok)) {
        errors.push(`[ack] token "${tok}" is not a V-… rule id`);
        continue;
      }
      ids.push(tok);
    }
  }
  return ids;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const catalogText = readOrDie(CATALOG);
  const runnerText = readOrDie(RUNNER);

  const cat = catalogIds(catalogText);
  const run = runnerTableIds(runnerText);
  const errors = [];
  const ack = acknowledgedIds(runnerText, errors);

  if (cat.length < 30) die(`only ${cat.length} #### V-… headings found in catalog — parse broken?`);
  if (run.length === 0) die('no | V-… | table rows found in runner — parse broken?');

  const catSet = new Set(cat);
  const runSet = new Set(run);
  const ackSet = new Set(ack);

  for (const id of cat) {
    if (!runSet.has(id) && !ackSet.has(id)) {
      errors.push(`[1] ${id} is in the catalog but neither in a runner table nor acknowledged`);
    }
  }
  for (const id of run) {
    if (!catSet.has(id)) errors.push(`[2] ${id} is in a runner table but not in the catalog (orphan)`);
  }
  for (const id of ack) {
    if (!catSet.has(id)) errors.push(`[3] ${id} is acknowledged but not in the catalog (stale ack)`);
    if (runSet.has(id)) errors.push(`[4] ${id} is both in a runner table AND acknowledged (ambiguous)`);
  }

  const prose = catalogProseTotal(catalogText);
  if (prose == null) {
    errors.push('[5] could not find the «N активных правил» prose total in the catalog');
  } else if (prose !== cat.length) {
    errors.push(`[5] catalog prose says ${prose} rules, but ${cat.length} #### V-… headings exist`);
  }

  const actualByNs = {};
  for (const id of cat) actualByNs[nsOf(id)] = (actualByNs[nsOf(id)] || 0) + 1;
  for (const row of namespaceTable(catalogText)) {
    const actual = actualByNs[row.ns];
    if (actual == null) continue; // namespace with no headings yet (e.g. future V-I-*)
    if (actual !== row.stated) {
      errors.push(`[6] §0 namespace table says ${row.stated} for «${row.spec}», but the catalog has ${actual} ${row.ns} headings`);
    }
  }

  if (errors.length === 0) {
    process.stdout.write(
      `check-validation-sync: ✓ in sync — ${cat.length} catalog rules = ` +
      `${run.length} runner rows + ${ack.length} acknowledged (V-MK/V-AM class).\n`
    );
    process.exit(0);
  }

  process.stderr.write('check-validation-sync: ✗ CATALOG↔RUNNER DRIFT\n');
  for (const e of errors) process.stderr.write(`  ${e}\n`);
  process.stderr.write(
    '\nFix: add the rule to the runner table, or declare a documented skip in the runner:\n' +
    '  <!-- catalog-sync:acknowledged V-XX-01 … reason="why the on-demand runner does not execute it" -->\n'
  );
  process.exit(1);
}

main();
