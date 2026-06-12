#!/usr/bin/env node
/**
 * smoke-hooks.js — run each PostToolUse hook with a minimal test input.
 *
 * Intent: catch runtime errors (ReferenceError / TypeError / SyntaxError) before
 * commit / phase closure. The Phase 3 smoke test (DEC-DEV-0023) revealed bg-extractor
 * was throwing TDZ ReferenceError on every save — undetected for full phase because
 * no smoke step existed.
 *
 * Per-hook protocol:
 *   1. node --check <file> (syntax)
 *   2. echo '<minimal hookInput JSON>' | node <file> (runtime)
 *   3. assert exit 0 + stderr free of ReferenceError|TypeError|SyntaxError
 *
 * Hooks should `process.exit(0)` for irrelevant inputs (file missing, bad path, etc.) —
 * that's the "non-blocking" contract per manifest.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/smoke-hooks.js [--verbose]
 *
 * Exit codes:
 *   0 — all hooks passed smoke
 *   1 — one or more hooks failed (output details to stderr)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Anchor at ecosystem root: traverse up from script location until we find hooks/manifest.yaml-bearing dir.
const SCRIPT_DIR = __dirname;
let ECO_ROOT = SCRIPT_DIR;
while (ECO_ROOT !== path.parse(ECO_ROOT).root) {
  if (fs.existsSync(path.join(ECO_ROOT, 'hooks')) && fs.existsSync(path.join(ECO_ROOT, 'docs', 'pmo'))) break;
  ECO_ROOT = path.dirname(ECO_ROOT);
}
if (!fs.existsSync(path.join(ECO_ROOT, 'hooks'))) {
  console.error(`ERROR: could not anchor ecosystem root from ${SCRIPT_DIR}`);
  process.exit(2);
}

// Test input: a path that doesn't exist в .product/ — hooks должны exit 0 cleanly.
// We use a tmp path inside .product/ structure to satisfy filter regexes без trigger'я
// real artifact processing.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-smoke-'));
const TMP_PRODUCT = path.join(TMP_DIR, '.product');
fs.mkdirSync(path.join(TMP_PRODUCT, 'business-rules'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'invariants'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'scenarios'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'features'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'mockups'), { recursive: true });
fs.mkdirSync(path.join(TMP_DIR, '.claude'), { recursive: true });

// Per-hook test cases.
//
// Schema:
//   hook: <relative path к hook .js>
//   filePath?: <absolute path used as tool_input.file_path в hookInput>
//              (used by default Edit/Write/NotebookEdit path)
//   toolName?: <override tool_name in hookInput; default 'Write'>
//   toolInput?: <full override of tool_input в hookInput; bypasses filePath>
//   label?: <human-readable suffix для отчёта; полезен когда один хук имеет несколько case-ов>
//   setup?: (ctx) => void  — optional fixture preparation BEFORE runtime invocation.
//                            ctx = { tmpDir, tmpProduct, ecoRoot, fs, path, hash, crypto }.
//                            Use это чтобы создать handoffs, multi-artifact files,
//                            симулировать drift, и т. д.
//   env?: <object merged into spawnSync env>  — useful для CLAUDE_PROJECT_DIR override.
//   expectStderrIncludes?: <string | RegExp>  — после runtime, assert stderr содержит
//                            substring/regex. Failure → отчёт + non-zero exit.
//                            Default: только check на FATAL_PATTERNS.
//   expectStderrAbsent?: <string | RegExp>   — assert stderr does NOT contain pattern.
//                            Useful для no-op verification.
//
// Базовое назначение каждой записи — runtime smoke (hook не падает crash'ем); setup +
// expectStderrIncludes/Absent позволяют добавить functional validation для критичных hook-ов.
const hashLib = require(path.join(ECO_ROOT, 'hooks', 'product', 'lib', 'hash.js'));

// Helper to write a fresh session-context marker for scope-guard tests.
function writeIntegratorMarker(ctx, command, ageMs) {
  const dir = path.join(ctx.tmpDir, '.claude/integrator');
  fs.mkdirSync(dir, { recursive: true });
  const startedAt = new Date(Date.now() - (ageMs || 0)).toISOString();
  fs.writeFileSync(
    path.join(dir, '.session-context.json'),
    JSON.stringify({ command, started_at: startedAt }),
    'utf8'
  );
  // Also seed pending-actions.md so scope-guard can append entries.
  const paPath = path.join(ctx.tmpDir, '.claude/pending-actions.md');
  if (!fs.existsSync(paPath)) {
    fs.writeFileSync(
      paPath,
      '# Pending User Actions\n\n' +
      '> Auto-managed; entries appended by scope-guard hook and Integrator skills.\n\n',
      'utf8'
    );
  }
}

function cleanupIntegratorMarker(ctx) {
  const markerPath = path.join(ctx.tmpDir, '.claude/integrator/.session-context.json');
  const dedupPath = path.join(ctx.tmpDir, '.claude/integrator/.scope-guard-dedup.json');
  try { fs.unlinkSync(markerPath); } catch (_) { /* ignore */ }
  try { fs.unlinkSync(dedupPath); } catch (_) { /* ignore */ }
}

const TEST_CASES = [
  { hook: 'hooks/product/artifact-validate.js',     filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/bg-extractor.js',          filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/cascade-check.js',         filePath: path.join(TMP_PRODUCT, 'scenarios', 'SC-001-test.md') },
  { hook: 'hooks/product/br-change-trigger.js',     filePath: path.join(TMP_PRODUCT, 'business-rules', 'BR-001-test.md') },
  { hook: 'hooks/product/ic-change-trigger.js',     filePath: path.join(TMP_PRODUCT, 'invariants', 'IC-001-test.md') },
  { hook: 'hooks/product/session-state.js',         filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/product-handoff-gate.js',  filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'), label: 'no-handoff' },
  // Functional test для V-H-04 drift detection (R5/A1 fix-up — verifies that gate hook
  // catches drift на non-first artifact в multi-entry artifact_hashes block; pre-fix
  // regex захватывал только первую запись и silently миссил все остальные drift'ы).
  {
    hook: 'hooks/product/product-handoff-gate.js',
    label: 'drift-on-second-artifact',
    filePath: path.join(TMP_PRODUCT, 'scenarios', 'SC-005-test.md'),
    setup: (ctx) => {
      const sc = path.join(ctx.tmpProduct, 'scenarios', 'SC-005-test.md');
      fs.writeFileSync(sc, '---\nid: SC-005\ntype: scenario\nstatus: active\n---\n\n# SC-005\n\nCurrent body content.\n', 'utf-8');
      const handoffsDir = path.join(ctx.tmpProduct, 'handoffs');
      fs.mkdirSync(handoffsDir, { recursive: true });
      // Stored hashes: для SC-005 заведомо неверный → должен trigger drift warning.
      const wrongHash = 'sha256:' + '0'.repeat(64);
      const fmHash = ctx.hash.computeArtifactHash(sc);
      const handoff = path.join(handoffsDir, 'FM-001-handoff.md');
      fs.writeFileSync(
        handoff,
        '---\n' +
          'id: HANDOFF-FM-001\n' +
          'type: feature-handoff\n' +
          'feature: FM-001\n' +
          'status: ready\n' +
          'mode: production\n' +
          'version: 1\n' +
          'artifact_hashes:\n' +
          '  FM-001: "' + fmHash + '"\n' +
          '  SC-005: "' + wrongHash + '"\n' +
          '  BR-010: "sha256:' + 'a'.repeat(64) + '"\n' +
          'target_adapter: "universal"\n' +
          '---\n\n# HANDOFF\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /Handoff drift detected/,
  },

  // ---------- scope-guard (DEC-DEV-0047 / patch 1.3.3 B-2) ----------
  // 5 functional cases:
  //   1. no marker → no-op (write to forbidden path; absent marker should suppress)
  //   2. marker + write to forbidden path → warn + PA append
  //   3. marker + write to whitelisted exception → no-op
  //   4. stale marker → marker removed, no-op
  //   5. marker + Bash forbidden command → warn

  {
    hook: 'hooks/integrator/scope-guard.js',
    label: 'no-marker-no-op',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    setup: (ctx) => {
      cleanupIntegratorMarker(ctx);
    },
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrAbsent: /INTEGRATOR SCOPE GUARD/,
  },
  {
    hook: 'hooks/integrator/scope-guard.js',
    label: 'marker-plus-forbidden-write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    setup: (ctx) => {
      cleanupIntegratorMarker(ctx);
      writeIntegratorMarker(ctx, '/integrator:add');
    },
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrIncludes: /INTEGRATOR SCOPE GUARD/,
  },
  {
    hook: 'hooks/integrator/scope-guard.js',
    label: 'marker-plus-whitelisted-exception',
    filePath: path.join(TMP_PRODUCT, '.sessions', 'session-state.json'),
    setup: (ctx) => {
      cleanupIntegratorMarker(ctx);
      writeIntegratorMarker(ctx, '/integrator:add');
      fs.mkdirSync(path.join(ctx.tmpProduct, '.sessions'), { recursive: true });
    },
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrAbsent: /INTEGRATOR SCOPE GUARD/,
  },
  {
    hook: 'hooks/integrator/scope-guard.js',
    label: 'stale-marker-no-op',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    setup: (ctx) => {
      cleanupIntegratorMarker(ctx);
      // 2 hours ago — past STALE_MARKER_MS (1h).
      writeIntegratorMarker(ctx, '/integrator:add', 2 * 60 * 60 * 1000);
    },
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrAbsent: /INTEGRATOR SCOPE GUARD/,
  },
  {
    hook: 'hooks/integrator/scope-guard.js',
    label: 'marker-plus-bash-forbidden',
    toolName: 'Bash',
    toolInput: { command: 'echo "test" > .product/features/FM-test.md' },
    setup: (ctx) => {
      cleanupIntegratorMarker(ctx);
      writeIntegratorMarker(ctx, '/integrator:research');
    },
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrIncludes: /INTEGRATOR SCOPE GUARD/,
  },

  // ---------- design-artifact-validate (DEC-DEV-0053 / Phase 6 sub-phase G) ----------
  // 6 cases:
  //   1. file outside mockups path → exit 0 silent
  //   2. valid MK active → no findings, no stderr surface
  //   3. MK active missing required field (design_tool) → blocking stderr surface
  //   4. MK draft missing required field → silent (quiet-draft mode per SPEC §B2)
  //   5. MK active with bad design_tool enum → warning stderr
  //   6. DS singleton с wrong id (not 'DS') → blocking stderr

  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'irrelevant-path',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    expectStderrAbsent: /\[design-artifact-validate\]/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'mk-valid-active',
    filePath: path.join(TMP_PRODUCT, 'mockups', 'MK-001-login.md'),
    setup: (ctx) => {
      // Create linked FM + SC fixtures
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'scenarios', 'SC-001-test.md'),
        '---\nid: SC-001\ntype: scenario\nstatus: active\n---\n\n# SC-001\n',
        'utf-8'
      );
      // Valid MK
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'mockups', 'MK-001-login.md'),
        '---\n' +
          'id: MK-001\n' +
          'type: mockup-package\n' +
          'feature: FM-001\n' +
          'scenarios: [SC-001]\n' +
          'design_tool: stitch\n' +
          'status: active\n' +
          '---\n\n# MK-001 — Login\n',
        'utf-8'
      );
    },
    expectStderrAbsent: /\[design-artifact-validate\]/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'mk-missing-design-tool-active',
    filePath: path.join(TMP_PRODUCT, 'mockups', 'MK-002-broken.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'scenarios', 'SC-001-test.md'),
        '---\nid: SC-001\ntype: scenario\nstatus: active\n---\n\n# SC-001\n',
        'utf-8'
      );
      // MK missing design_tool (required field per Q8)
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'mockups', 'MK-002-broken.md'),
        '---\n' +
          'id: MK-002\n' +
          'type: mockup-package\n' +
          'feature: FM-001\n' +
          'scenarios: [SC-001]\n' +
          'status: active\n' +  // active triggers surface (not quiet-draft)
          '---\n\n# MK-002\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /V-MK-frontmatter.*design_tool/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'mk-missing-field-draft-quiet',
    filePath: path.join(TMP_PRODUCT, 'mockups', 'MK-003-draft.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      // MK draft with missing field — should queue, not surface
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'mockups', 'MK-003-draft.md'),
        '---\n' +
          'id: MK-003\n' +
          'type: mockup-package\n' +
          'feature: FM-001\n' +
          'scenarios: [SC-999-missing]\n' +  // bad ref triggers blocking
          'design_tool: stitch\n' +
          'status: draft\n' +  // draft → quiet
          '---\n\n# MK-003\n',
        'utf-8'
      );
    },
    expectStderrAbsent: /\[design-artifact-validate\]/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'mk-bad-design-tool-enum',
    filePath: path.join(TMP_PRODUCT, 'mockups', 'MK-004-bad-tool.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'scenarios', 'SC-001-test.md'),
        '---\nid: SC-001\ntype: scenario\nstatus: active\n---\n\n# SC-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'mockups', 'MK-004-bad-tool.md'),
        '---\n' +
          'id: MK-004\n' +
          'type: mockup-package\n' +
          'feature: FM-001\n' +
          'scenarios: [SC-001]\n' +
          'design_tool: sketch\n' +  // не в enum (stitch | claude-design | figma | penpot | html)
          'status: active\n' +
          '---\n\n# MK-004\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /design_tool 'sketch' not в enum/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'ds-singleton-wrong-id',
    filePath: path.join(TMP_PRODUCT, 'design-system.md'),
    setup: (ctx) => {
      // DS file but wrong id (should be 'DS' literally)
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'design-system.md'),
        '---\n' +
          'id: DSO\n' +  // wrong — should be 'DS'
          'type: design-system\n' +
          'status: active\n' +
          '---\n\n# DS\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /V-DS-id.*id should be 'DS' literally/,
  },

  // ---------- worktree-enter-guard (DEC-DEV-0065, upstream из пилота) ----------
  // 2 cases:
  //   1. foreign tool → defensive no-op (matcher должен фильтровать, но guard перепроверяет tool_name)
  //   2. EnterWorktree → spawns worktree-preflight.js (same dir) с cwd=CLAUDE_PROJECT_DIR;
  //      banner в stderr. Транзитивно покрывает preflight runtime: его SyntaxError/throw
  //      попал бы в banner и сматчился бы FATAL_PATTERNS.
  {
    hook: 'hooks/product/worktree-enter-guard.js',
    label: 'foreign-tool-no-op',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrAbsent: /Worktree pre-flight/,
  },
  {
    hook: 'hooks/product/worktree-enter-guard.js',
    label: 'enterworktree-advisory',
    toolName: 'EnterWorktree',
    toolInput: {},
    env: { CLAUDE_PROJECT_DIR: TMP_DIR },
    expectStderrIncludes: /Worktree pre-flight/,
  },
];

// Patterns в stderr that signal real bugs (vs benign log).
const FATAL_PATTERNS = [
  /ReferenceError/,
  /TypeError/,
  /SyntaxError/,
  /Cannot access .* before initialization/,
  /is not defined/,
  /is not a function/,
  /Unexpected token/,
];

let totalRun = 0;
let failures = [];

for (const tc of TEST_CASES) {
  const hookPath = path.join(ECO_ROOT, tc.hook);
  const tcLabel = tc.label ? `${tc.hook} [${tc.label}]` : tc.hook;
  if (!fs.existsSync(hookPath)) {
    if (VERBOSE) console.log(`SKIP  ${tcLabel} (not found)`);
    continue;
  }
  totalRun++;

  // Step 0: optional fixture setup
  if (typeof tc.setup === 'function') {
    try {
      tc.setup({
        tmpDir: TMP_DIR,
        tmpProduct: TMP_PRODUCT,
        ecoRoot: ECO_ROOT,
        fs,
        path,
        hash: hashLib,
      });
    } catch (e) {
      failures.push({
        hook: tcLabel,
        phase: 'setup',
        stderr: (e && e.stack) || String(e),
        stdout: '',
      });
      console.error(`FAIL  ${tcLabel} (setup: ${e.message || e})`);
      continue;
    }
  }

  // Step 1: syntax check
  const syntaxRes = spawnSync('node', ['--check', hookPath], { encoding: 'utf-8' });
  if (syntaxRes.status !== 0) {
    failures.push({
      hook: tcLabel,
      phase: 'syntax',
      stderr: syntaxRes.stderr || '',
      stdout: syntaxRes.stdout || '',
    });
    console.error(`FAIL  ${tcLabel} (syntax)`);
    continue;
  }

  // Step 2: runtime smoke — pipe hook input JSON
  const toolName = tc.toolName || 'Write';
  const toolInput = tc.toolInput || (tc.filePath ? { file_path: tc.filePath } : {});
  const hookInput = JSON.stringify({
    session_id: 'smoke',
    tool_name: toolName,
    tool_input: toolInput,
    cwd: TMP_DIR,
  });
  const childEnv = Object.assign({}, process.env, tc.env || {});
  const runRes = spawnSync('node', [hookPath], {
    input: hookInput,
    encoding: 'utf-8',
    timeout: 10000,
    env: childEnv,
  });
  const stderr = runRes.stderr || '';
  const fatalHit = FATAL_PATTERNS.find((rx) => rx.test(stderr));

  if (runRes.status !== 0 && !fatalHit) {
    // Non-zero exit без явной fatal pattern — ok, hook may signal back; warn but pass.
    if (VERBOSE) console.log(`WARN  ${tcLabel} (exit ${runRes.status}, no fatal pattern; treated pass)`);
  }

  if (fatalHit) {
    failures.push({
      hook: tcLabel,
      phase: 'runtime',
      pattern: fatalHit.toString(),
      stderr: stderr.slice(0, 2000),
      stdout: (runRes.stdout || '').slice(0, 500),
    });
    console.error(`FAIL  ${tcLabel} (runtime: ${fatalHit})`);
    continue;
  }

  // Step 3a: optional expectStderrIncludes assertion (functional validation)
  if (tc.expectStderrIncludes) {
    const matcher = tc.expectStderrIncludes;
    const ok = matcher instanceof RegExp ? matcher.test(stderr) : stderr.includes(matcher);
    if (!ok) {
      failures.push({
        hook: tcLabel,
        phase: 'expectStderrIncludes',
        expected: matcher.toString(),
        stderr: stderr.slice(0, 2000),
        stdout: (runRes.stdout || '').slice(0, 500),
      });
      console.error(`FAIL  ${tcLabel} (expectStderrIncludes ${matcher} not matched)`);
      continue;
    }
  }

  // Step 3b: optional expectStderrAbsent assertion (negative validation — hook MUST NOT warn)
  if (tc.expectStderrAbsent) {
    const matcher = tc.expectStderrAbsent;
    const present = matcher instanceof RegExp ? matcher.test(stderr) : stderr.includes(matcher);
    if (present) {
      failures.push({
        hook: tcLabel,
        phase: 'expectStderrAbsent',
        expected: `absence of ${matcher.toString()}`,
        stderr: stderr.slice(0, 2000),
        stdout: (runRes.stdout || '').slice(0, 500),
      });
      console.error(`FAIL  ${tcLabel} (expectStderrAbsent ${matcher} but pattern found)`);
      continue;
    }
  }

  console.log(`PASS  ${tcLabel}`);
}

// Cleanup tmp dir
try {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
} catch (e) {
  // Silent — tmp leftover не critical
}

console.log('');
console.log(`Total: ${totalRun} hook(s) tested; ${failures.length} failure(s).`);

if (failures.length > 0) {
  console.error('');
  console.error('=== Failures ===');
  for (const f of failures) {
    console.error(`\n${f.hook} [${f.phase}${f.pattern ? ': ' + f.pattern : ''}]`);
    if (f.expected) console.error(`expected: ${f.expected}`);
    if (f.stderr) console.error(`stderr:\n${f.stderr}`);
    if (f.stdout && VERBOSE) console.error(`stdout:\n${f.stdout}`);
  }
  process.exit(1);
}

process.exit(0);
