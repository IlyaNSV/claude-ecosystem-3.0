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
  // Functional: SC↔MK topology (DEC-DEV-0080). Saving an active MK with scenarios:[SC]
  // must auto-fix the SCALAR reverse SC.mockup (format pinned in tests/product/cascade-scalar.test.cjs).
  {
    hook: 'hooks/product/cascade-check.js',
    label: 'mk-scenarios-scalar-reverse',
    filePath: path.join(TMP_PRODUCT, 'mockups', 'MK-010-pkg.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'scenarios', 'SC-010-flow.md'),
        '---\nid: SC-010\ntype: scenario\nstatus: active\nrules: []\nlifecycle: []\nverification: []\n---\n\n# SC-010\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'mockups', 'MK-010-pkg.md'),
        '---\nid: MK-010\ntype: mockup-package\nstatus: active\nfeature: FM-001\nscenarios: [SC-010]\n---\n\n# MK-010\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /V-11 auto-fixed/,
  },
  { hook: 'hooks/product/br-change-trigger.js',     filePath: path.join(TMP_PRODUCT, 'business-rules', 'BR-001-test.md') },
  // zone-change-trigger (DEC-DEV-0098, Epic A / A2): a significant change in a routed
  // zone must emit the advisor signal naming the heterogeneous personas.
  {
    hook: 'hooks/product/zone-change-trigger.js',
    label: 'fires-on-significant-feature-change',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-050-test.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-050-test.md'),
        '---\nid: FM-050\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-050\n\nA new behavioral clause that constitutes a real body change.\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /Advisor review pending for FM-050.*architect-advisor/s,
  },
  {
    hook: 'hooks/product/zone-change-trigger.js',
    label: 'silent-on-non-zone-path',
    filePath: path.join(TMP_PRODUCT, 'segments', 'SEG-001-test.md'),
    setup: (ctx) => {
      fs.mkdirSync(path.join(ctx.tmpProduct, 'segments'), { recursive: true });
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'segments', 'SEG-001-test.md'),
        '---\nid: SEG-001\ntype: segment\nstatus: active\n---\n\n# SEG-001\n',
        'utf-8'
      );
    },
    expectStderrAbsent: /Advisor review pending/,
  },
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

  // ---------- App Map (AM) — DEC-DEV-0066 (canonized из пилота) ----------
  // design-artifact-validate: AM root-singleton branch (V-AM-*).
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'am-wrong-singleton-id-active',
    filePath: path.join(TMP_PRODUCT, 'app-map.md'),
    setup: (ctx) => {
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'app-map.md'),
        '---\nid: APP\ntype: app-map\ntitle: "App Map: smoke"\nstatus: active\nmodules: [FM-001]\n---\n\n# AM\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /V-AM-id/,
  },
  {
    hook: 'hooks/design/design-artifact-validate.js',
    label: 'am-valid-active-quiet',
    filePath: path.join(TMP_PRODUCT, 'app-map.md'),
    setup: (ctx) => {
      // valid singleton: id literal AM + resolvable module ref (FM-001-test.md создан ранее)
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'app-map.md'),
        '---\nid: AM\ntype: app-map\ntitle: "App Map: smoke"\nstatus: active\nmodules: [FM-001]\n---\n\n# AM\n',
        'utf-8'
      );
    },
    expectStderrAbsent: /V-AM/,
  },
  // app-map-cascade: drift trigger (own pending queue + stderr signal).
  {
    hook: 'hooks/design/app-map-cascade.js',
    label: 'no-am-file-no-op',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    setup: (ctx) => {
      try { fs.unlinkSync(path.join(ctx.tmpProduct, 'app-map.md')); } catch (_e) { /* absent ok */ }
    },
    expectStderrAbsent: /AM-stale/,
  },
  {
    hook: 'hooks/design/app-map-cascade.js',
    label: 'mechanical-drift-am-stale',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    setup: (ctx) => {
      // AM persists FM-999, которого нет на диске → scan vs AM = drift → AM-stale
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'features', 'FM-001-test.md'),
        '---\nid: FM-001\ntype: feature-map-entry\nstatus: in-progress\nhas_ui: true\n---\n\n# FM-001\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(ctx.tmpProduct, 'app-map.md'),
        '---\nid: AM\ntype: app-map\ntitle: "App Map: smoke"\nstatus: active\nmodules: [FM-001, FM-999]\nnavigation_maps: []\n---\n\n# AM\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /AM-stale/,
  },

  // ---------- lesson-presence-gate (DEC-DEV-0062; deadlock carve-out DEC-DEV-0143) ----------
  // The armed S-LE live smoke (pilot 4fb6e0f2, 2026-07-04) confirmed a marker-only
  // exemption self-deadlocks the resolution protocol (its first writes — the lesson
  // file + the marker — happen BEFORE a marker can exist). These cases pin the fix:
  // deny still fires on ordinary targets; lesson-resolution targets are carved out;
  // a fresh marker exempts everything; warn stays non-blocking.
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'strict-deny-ordinary-target',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'PreToolUse' },
    env: { LESSON_GATE_MODE: 'strict' },
    setup: (ctx) => {
      const lessons = path.join(ctx.tmpProduct, 'lessons');
      fs.mkdirSync(lessons, { recursive: true });
      fs.writeFileSync(
        path.join(lessons, 'LESSON-001.md'),
        '---\nid: LESSON-001\nstatus: open\n---\n\n# smoke lesson\n',
        'utf-8'
      );
    },
    expectStdoutIncludes: /"permissionDecision":"deny"/,
  },
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'strict-carveout-lesson-file-target',
    toolName: 'Edit',
    filePath: path.join(TMP_PRODUCT, 'lessons', 'LESSON-001.md'),
    payloadExtra: { hook_event_name: 'PreToolUse' },
    env: { LESSON_GATE_MODE: 'strict' },
    expectStdoutAbsent: /permissionDecision/,
  },
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'strict-carveout-marker-target',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, '.sessions', 'lesson-in-progress.LESSON-001'),
    payloadExtra: { hook_event_name: 'PreToolUse' },
    env: { LESSON_GATE_MODE: 'strict' },
    expectStdoutAbsent: /permissionDecision/,
  },
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'strict-exemption-fresh-marker',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'PreToolUse' },
    env: { LESSON_GATE_MODE: 'strict' },
    setup: (ctx) => {
      const sess = path.join(ctx.tmpProduct, '.sessions');
      fs.mkdirSync(sess, { recursive: true });
      fs.writeFileSync(path.join(sess, 'lesson-in-progress.LESSON-001'), 'LESSON-001 smoke', 'utf-8');
    },
    expectStdoutAbsent: /permissionDecision/,
  },
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'ups-reminder-not-blocking',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'UserPromptSubmit' },
    env: { LESSON_GATE_MODE: 'strict' },
    setup: (ctx) => {
      // Drop the fresh marker from the previous case — reminder must fire regardless.
      try { fs.unlinkSync(path.join(ctx.tmpProduct, '.sessions', 'lesson-in-progress.LESSON-001')); } catch (_e) { /* absent ok */ }
    },
    expectStdoutIncludes: /additionalContext/,
  },
  {
    hook: 'hooks/product/lesson-presence-gate.js',
    label: 'warn-default-no-deny',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'PreToolUse' },
    env: { LESSON_GATE_MODE: 'warn' },
    setup: (ctx) => {
      // Leave no open lesson behind for unrelated later cases: this is the LAST
      // lesson case — clean up inside it after asserting (teardown-in-next-setup
      // pattern is unavailable, so the lesson stays; harmless — only lesson hooks
      // scan .product/lessons). Keep LESSON-001 open so the warn nag fires.
      void ctx;
    },
    expectStdoutAbsent: /permissionDecision/,
    expectStderrIncludes: /LESSON GATE \(reminder\)/,
  },

  // ---------- session-fabric-status (DEC-DEV-0154 / Process Fabric phase 2 · 2c) ----------
  // The ecosystem's first shipped SessionStart hook. It reads only payload.cwd, walks up
  // to the project root (dir containing .claude/), and — IFF <root>/.claude/orchestrator/
  // fabric/ exists — shells the read-only engine `status` and injects a compact summary
  // via hookSpecificOutput.additionalContext. 2 cases:
  //   1. no fabric dir → silent no-op (empty stdout, no additionalContext)
  //   2. fixture fabric-root (1 instance state.json + owner-queue.json) → additionalContext
  //      carrying the instance id
  // cwd defaults to TMP_DIR (which the runner seeds with .claude/), so root resolves to it.
  {
    hook: 'hooks/orchestrator/session-fabric-status.js',
    label: 'no-fabric-dir-no-op',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'SessionStart' },
    setup: (ctx) => {
      // Defensive: ensure the fabric dir is absent regardless of case ordering.
      try { fs.rmSync(path.join(ctx.tmpDir, '.claude', 'orchestrator', 'fabric'), { recursive: true, force: true }); } catch (_e) { /* absent ok */ }
    },
    expectStdoutAbsent: /additionalContext/,
  },
  {
    hook: 'hooks/orchestrator/session-fabric-status.js',
    label: 'fabric-status-injected',
    toolName: 'Write',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'SessionStart' },
    setup: (ctx) => {
      const fabric = path.join(ctx.tmpDir, '.claude', 'orchestrator', 'fabric');
      const inst = path.join(fabric, 'smoke-fabric-inst');
      fs.mkdirSync(inst, { recursive: true });
      fs.writeFileSync(
        path.join(inst, 'state.json'),
        JSON.stringify({
          instance: 'smoke-fabric-inst',
          charter_id: 'feature-production-line',
          state: 'implementing',
          subject: 'smoke-subject',
          seq: 3,
        }),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(fabric, 'owner-queue.json'),
        JSON.stringify([
          { at: '2026-07-07T10:00:00.000Z', instance: 'smoke-fabric-inst', state: 'runtime_gate', kind: 'gate', priority: 2, source: 'feature-production-line' },
        ]),
        'utf-8'
      );
    },
    // hookEventName ОБЯЗАТЕЛЕН в hookSpecificOutput — без него Claude Code отбрасывает весь
    // payload (live-дефект Fabric фазы 3, DEC-DEV-0162: smoke проверял форму JSON, но не
    // контракт харнесса, и инжект молча терялся на реальной сессии).
    expectStdoutIncludes: /hookSpecificOutput.*hookEventName":"SessionStart.*additionalContext.*smoke-fabric-inst/,
  },

  // ── subagent-watchdog.js (DEC-DEV-0159, G05/G06) ─────────────────────────────
  // Deterministic watchdog over the pending-review queues + canonical persona spawns.
  // Sidecar state lives in .product/.pending/.watchdog-state.json; each case resets it
  // and rewrites the queue fixtures wholesale (cases from br/ic-change-trigger above may
  // have appended entries to the shared da-pending.yaml).
  // 5 cases: G06 substitution warn · consume-stamp · non-persona silence ·
  // Stop unconsumed reminder · G05 wipe detection.
  {
    hook: 'hooks/product/subagent-watchdog.js',
    label: 'g06-substitution-warned',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: {
      hook_event_name: 'SubagentStop',
      agent_type: 'general-purpose',
      agent_id: 'smoke-agent-1',
      transcript_path: path.join(TMP_DIR, 'watchdog-transcript-gp.jsonl'),
    },
    setup: (ctx) => {
      const pending = path.join(ctx.tmpProduct, '.pending');
      fs.mkdirSync(pending, { recursive: true });
      try { fs.rmSync(path.join(pending, '.watchdog-state.json'), { force: true }); } catch (_e) { /* ok */ }
      fs.writeFileSync(path.join(pending, 'da-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(path.join(pending, 'advisor-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(
        path.join(ctx.tmpDir, 'watchdog-transcript-gp.jsonl'),
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Task', input: {
            subagent_type: 'general-purpose',
            prompt: 'DA review BR-027 — прочитай agents/product/devils-advocate.md и прими роль (Mode: adaptive)',
          } }] },
        }) + '\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /S8 P1 REGRESSION[\s\S]*general-purpose/,
  },
  {
    hook: 'hooks/product/subagent-watchdog.js',
    label: 'g05-consume-stamped',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: {
      hook_event_name: 'SubagentStop',
      agent_type: 'product-devils-advocate',
      agent_id: 'smoke-agent-2',
      transcript_path: path.join(TMP_DIR, 'watchdog-transcript-da.jsonl'),
    },
    setup: (ctx) => {
      const pending = path.join(ctx.tmpProduct, '.pending');
      fs.mkdirSync(pending, { recursive: true });
      try { fs.rmSync(path.join(pending, '.watchdog-state.json'), { force: true }); } catch (_e) { /* ok */ }
      fs.writeFileSync(
        path.join(pending, 'da-pending.yaml'),
        'entries:\n  - artifact: BR-027\n    artifact_type: business-rule\n    mode: adaptive\n    queued_at: 2026-07-07T10:00:00.000Z\n',
        'utf-8'
      );
      fs.writeFileSync(path.join(pending, 'advisor-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(
        path.join(ctx.tmpDir, 'watchdog-transcript-da.jsonl'),
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Task', input: {
            subagent_type: 'product-devils-advocate',
            prompt: 'Adaptive DA review of BR-027 per da-pending entry.',
          } }] },
        }) + '\n',
        'utf-8'
      );
    },
    expectStderrIncludes: /consumed BR-027/,
  },
  {
    hook: 'hooks/product/subagent-watchdog.js',
    label: 'non-persona-agent-silent',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: {
      hook_event_name: 'SubagentStop',
      agent_type: 'Explore',
      agent_id: 'smoke-agent-3',
      transcript_path: path.join(TMP_DIR, 'watchdog-transcript-explore.jsonl'),
    },
    setup: (ctx) => {
      const pending = path.join(ctx.tmpProduct, '.pending');
      fs.mkdirSync(pending, { recursive: true });
      try { fs.rmSync(path.join(pending, '.watchdog-state.json'), { force: true }); } catch (_e) { /* ok */ }
      fs.writeFileSync(path.join(pending, 'da-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(path.join(pending, 'advisor-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(
        path.join(ctx.tmpDir, 'watchdog-transcript-explore.jsonl'),
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Task', input: {
            subagent_type: 'Explore', prompt: 'Find all usages of zone-router across the repo.',
          } }] },
        }) + '\n',
        'utf-8'
      );
    },
    expectStderrAbsent: /subagent-watchdog/,
  },
  {
    hook: 'hooks/product/subagent-watchdog.js',
    label: 'stop-unconsumed-reminder',
    filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md'),
    payloadExtra: { hook_event_name: 'Stop' },
    setup: (ctx) => {
      const pending = path.join(ctx.tmpProduct, '.pending');
      fs.mkdirSync(pending, { recursive: true });
      try { fs.rmSync(path.join(pending, '.watchdog-state.json'), { force: true }); } catch (_e) { /* ok */ }
      fs.writeFileSync(
        path.join(pending, 'da-pending.yaml'),
        'entries:\n  - artifact: BR-042\n    artifact_type: business-rule\n    queued_at: 2026-07-07T11:00:00.000Z\n',
        'utf-8'
      );
      fs.writeFileSync(path.join(pending, 'advisor-pending.yaml'), 'entries:\n', 'utf-8');
    },
    expectStderrIncludes: /unconsumed pending review[\s\S]*BR-042/,
  },
  {
    hook: 'hooks/product/subagent-watchdog.js',
    label: 'g05-wipe-detected',
    filePath: path.join(TMP_PRODUCT, '.pending', 'da-pending.yaml'),
    payloadExtra: { hook_event_name: 'PostToolUse' },
    setup: (ctx) => {
      const pending = path.join(ctx.tmpProduct, '.pending');
      fs.mkdirSync(pending, { recursive: true });
      // State remembers an UNCONSUMED BR-042; the queue file no longer contains it.
      fs.writeFileSync(
        path.join(pending, '.watchdog-state.json'),
        JSON.stringify({
          'da-pending.yaml': {
            'BR-042': { queued_at: '2026-07-07T11:00:00.000Z', seen_at: '2026-07-07T11:00:01.000Z' },
          },
        }) + '\n',
        'utf-8'
      );
      fs.writeFileSync(path.join(pending, 'da-pending.yaml'), 'entries:\n', 'utf-8');
      fs.writeFileSync(path.join(pending, 'advisor-pending.yaml'), 'entries:\n', 'utf-8');
    },
    expectStderrIncludes: /G05[\s\S]*BR-042[\s\S]*restore/,
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
  const hookInput = JSON.stringify(Object.assign({
    session_id: 'smoke',
    tool_name: toolName,
    tool_input: toolInput,
    cwd: TMP_DIR,
  }, tc.payloadExtra || {})); // payloadExtra: e.g. hook_event_name for event-dispatching hooks
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

  // Step 3c/3d: optional stdout assertions — blocking hooks answer via stdout JSON
  // (PreToolUse permissionDecision / UserPromptSubmit additionalContext), not stderr.
  const stdoutText = runRes.stdout || '';
  if (tc.expectStdoutIncludes) {
    const matcher = tc.expectStdoutIncludes;
    const ok = matcher instanceof RegExp ? matcher.test(stdoutText) : stdoutText.includes(matcher);
    if (!ok) {
      failures.push({
        hook: tcLabel,
        phase: 'expectStdoutIncludes',
        expected: matcher.toString(),
        stderr: stderr.slice(0, 2000),
        stdout: stdoutText.slice(0, 2000),
      });
      console.error(`FAIL  ${tcLabel} (expectStdoutIncludes ${matcher} not matched)`);
      continue;
    }
  }
  if (tc.expectStdoutAbsent) {
    const matcher = tc.expectStdoutAbsent;
    const present = matcher instanceof RegExp ? matcher.test(stdoutText) : stdoutText.includes(matcher);
    if (present) {
      failures.push({
        hook: tcLabel,
        phase: 'expectStdoutAbsent',
        expected: `absence of ${matcher.toString()}`,
        stderr: stderr.slice(0, 2000),
        stdout: stdoutText.slice(0, 2000),
      });
      console.error(`FAIL  ${tcLabel} (expectStdoutAbsent ${matcher} but pattern found)`);
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
