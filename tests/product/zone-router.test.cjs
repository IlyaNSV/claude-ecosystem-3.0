'use strict';
/**
 * Unit test for the zone→persona router (Autonomous Pipeline Vision, Epic A / A2).
 *
 * The router is a pure, dependency-free lib, so this exercises real behavior (not a
 * source-regex wiring guard): manifest parse, zone match, magnitude classification,
 * and the fire gate (zone matched AND magnitude >= threshold).
 *
 * Node stdlib only; run with `node tests/product/zone-router.test.cjs`.
 */

const path = require('node:path');
const router = require(path.join(__dirname, '..', '..', 'hooks', 'product', 'zone-router.cjs'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'not equal'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

console.log('zone-router — Epic A A2');

// ---------- manifest parse (real SSOT file) ----------

const manifest = router.loadManifest();

test('parses the real manifest with version + zones', () => {
  eq(manifest.version, 1, 'version');
  assert(manifest.zones.length >= 8, 'expected >= 8 zones, got ' + manifest.zones.length);
});

test('every zone has a path_glob, >=1 persona, and a min_magnitude', () => {
  for (const z of manifest.zones) {
    assert(z.path_glob, `zone ${z.id} missing path_glob`);
    assert(Array.isArray(z.personas) && z.personas.length >= 1, `zone ${z.id} has no personas`);
    assert(['cosmetic', 'significant'].includes(z.min_magnitude), `zone ${z.id} bad min_magnitude`);
  }
});

test('personas are canonical advisor subagent_type names only', () => {
  const allowed = new Set(['architect-advisor', 'qa-advisor', 'ux-advisor']);
  for (const z of manifest.zones) {
    for (const p of z.personas) assert(allowed.has(p), `zone ${z.id} has non-canonical persona ${p}`);
  }
});

test('inline personas array parses to multiple entries', () => {
  const br = manifest.zones.find((z) => z.id === 'business-rules');
  assert(br, 'business-rules zone missing');
  eq(br.personas.length, 2, 'business-rules persona count');
  assert(br.personas.includes('architect-advisor') && br.personas.includes('qa-advisor'), 'br personas');
});

// ---------- zone match ----------

test('matches a business-rule path (absolute, Windows-style separators)', () => {
  const z = router.matchZone('C:\\proj\\.product\\business-rules\\BR-010-x.md', manifest.zones);
  assert(z && z.id === 'business-rules', 'expected business-rules zone');
});

test('matches mockups (covers MK and NM which both live there)', () => {
  const mk = router.matchZone('.product/mockups/MK-003-login.md', manifest.zones);
  const nm = router.matchZone('.product/mockups/NM-002-flow.md', manifest.zones);
  assert(mk && mk.id === 'mockups', 'MK should match mockups');
  assert(nm && nm.id === 'mockups', 'NM should match mockups');
  assert(mk.personas.includes('ux-advisor'), 'mockups → ux-advisor');
});

test('does NOT match a non-.product path or a non-zone .product dir', () => {
  assert(router.matchZone('src/foo.md', manifest.zones) === null, 'src should not match');
  assert(router.matchZone('.product/segments/SEG-001.md', manifest.zones) === null, 'segments is a gate zone, not routed');
});

test('glob * matches one segment only (no path traversal)', () => {
  // a nested path under business-rules must NOT match the single-segment glob
  assert(router.matchZone('.product/business-rules/sub/BR-1.md', manifest.zones) === null, 'nested should not match');
});

// ---------- magnitude classification ----------

test('empty / creation diff → significant', () => {
  eq(router.classifyMagnitude(''), 'significant', 'empty');
  eq(router.classifyMagnitude('# (No git diff available — likely creation or file not in git)'), 'significant', 'creation marker');
});

test('frontmatter-metadata-only diff → cosmetic', () => {
  const diff = [
    'diff --git a/x b/x',
    '--- a/x',
    '+++ b/x',
    '@@ -1,3 +1,3 @@',
    '-version: 1',
    '+version: 2',
    '-updated: 2026-06-01',
    '+updated: 2026-06-24',
  ].join('\n');
  eq(router.classifyMagnitude(diff), 'cosmetic', 'metadata-only should be cosmetic');
});

test('reference-list-only change → cosmetic', () => {
  const diff = ['@@', '+- SC-005', '+scenarios: [SC-005, SC-006]'].join('\n');
  eq(router.classifyMagnitude(diff), 'cosmetic', 'ref-list should be cosmetic');
});

test('a real body change → significant', () => {
  const diff = ['@@', '-The rule applies once.', '+The rule applies to every batch within the 2h window.'].join('\n');
  eq(router.classifyMagnitude(diff), 'significant', 'body change should be significant');
});

test('mixed metadata + body change → significant (conservative)', () => {
  const diff = ['@@', '+version: 2', '+New behavioral clause added here.'].join('\n');
  eq(router.classifyMagnitude(diff), 'significant', 'any substantive line forces significant');
});

// ---------- route + fire gate ----------

test('route fires for a significant change in a routed zone', () => {
  const r = router.route('.product/invariants/IC-003-x.md', { magnitude: 'significant', manifest });
  eq(r.zone, 'invariants', 'zone');
  assert(r.fire === true, 'should fire');
  assert(r.personas.includes('qa-advisor') && r.personas.includes('architect-advisor'), 'invariants personas');
});

test('route does NOT fire for a cosmetic change (below threshold)', () => {
  const r = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'cosmetic', manifest });
  eq(r.zone, 'business-rules', 'zone still reported');
  assert(r.fire === false, 'cosmetic must not fire');
  assert(/below/.test(r.reason), 'reason explains threshold');
});

test('route does NOT fire outside any zone', () => {
  const r = router.route('.product/segments/SEG-001.md', { magnitude: 'significant', manifest });
  eq(r.zone, null, 'no zone');
  assert(r.fire === false, 'no fire without zone');
  assert(r.personas.length === 0, 'no personas');
});

test('route classifies magnitude from a diff when not given explicitly', () => {
  const r = router.route('.product/features/FM-007-admin.md', { diff: '', manifest }); // empty diff → creation → significant
  assert(r.fire === true, 'creation of a feature should fire');
  eq(r.magnitude, 'significant', 'creation magnitude');
});

console.log(`\n${passed} assertions passed.`);
