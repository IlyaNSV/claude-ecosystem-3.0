'use strict';
/**
 * Unit test for the agent-roster config + G2 participation-matrix layer
 * (Autonomous Pipeline Vision, Epic G MINIMUM / G1+G2).
 *
 * The roster lib is a pure, dependency-free config layer over the zone router, so this
 * exercises real behavior: parse (merge-over-default), loadRoster sentinel/degrade, the
 * G2 firing layer (incl. the byte-identical null seam against the REAL router output),
 * panel/preset resolution.
 *
 * Node stdlib only; run with `node tests/product/agent-roster.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const roster = require(path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'agent-roster.cjs'));
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

console.log('agent-roster — Epic G G1+G2');

// ---------- parseRoster ----------

test('parses full schema and merges over defaults', () => {
  const text = [
    'version: 1',
    'personas:',
    '  - name: ux-advisor',
    '    enabled: false',
    '    model: sonnet',
    '    depth_threshold: significant',
    '    extra_lenses: [accessibility, i18n]',
    'presets:',
    '  - name: lean',
    '    personas: [architect-advisor, qa-advisor]',
  ].join('\n');
  const r = roster.parseRoster(text);
  assert.strictEqual(r.version, 1, 'version');
  assert.strictEqual(r.personas['ux-advisor'].enabled, false, 'ux disabled');
  assert.strictEqual(r.personas['ux-advisor'].model, 'sonnet', 'ux model');
  assert.strictEqual(r.personas['ux-advisor'].depth_threshold, 'significant', 'ux threshold');
  assert.deepStrictEqual(r.personas['ux-advisor'].extra_lenses, ['accessibility', 'i18n'], 'ux lenses');
  // untouched personas keep their defaults
  assert.deepStrictEqual(
    r.personas['architect-advisor'],
    { enabled: true, model: null, depth_threshold: null, extra_lenses: [] },
    'architect keeps default'
  );
  assert.strictEqual(r.warnings.length, 0, 'no warnings on a clean roster');
});

test('partial persona override merges over defaults (omitted fields keep default)', () => {
  const text = ['personas:', '  - name: qa-advisor', '    model: opus'].join('\n');
  const r = roster.parseRoster(text);
  assert.strictEqual(r.personas['qa-advisor'].model, 'opus', 'model overridden');
  assert.strictEqual(r.personas['qa-advisor'].enabled, true, 'enabled default kept');
  assert.strictEqual(r.personas['qa-advisor'].depth_threshold, null, 'threshold default kept');
  assert.deepStrictEqual(r.personas['qa-advisor'].extra_lenses, [], 'lenses default kept');
});

test('unknown persona name is kept but flagged in warnings[]', () => {
  const text = ['personas:', '  - name: architect-advsor', '    enabled: false'].join('\n');
  const r = roster.parseRoster(text);
  assert.ok(r.personas['architect-advsor'], 'typo persona kept');
  assert.strictEqual(r.warnings.length, 1, 'one warning');
  assert.ok(/architect-advsor/.test(r.warnings[0]), 'warning names the typo');
  // the real persona is untouched (typo did NOT disable it)
  assert.strictEqual(r.personas['architect-advisor'].enabled, true, 'real persona still enabled');
});

test('user preset overrides a built-in of the same name', () => {
  const text = ['presets:', '  - name: full', '    personas: [qa-advisor]'].join('\n');
  const r = roster.parseRoster(text);
  assert.deepStrictEqual(r.presets['full'], ['qa-advisor'], 'full overridden');
  assert.deepStrictEqual(r.presets['lean'], ['architect-advisor', 'qa-advisor'], 'lean built-in intact');
});

test('unrecognized enabled value defaults to true (a typo never disables)', () => {
  const text = ['personas:', '  - name: qa-advisor', '    enabled: maybe'].join('\n');
  const r = roster.parseRoster(text);
  assert.strictEqual(r.personas['qa-advisor'].enabled, true, 'bad enabled → true');
});

// ---------- loadRoster ----------

test('loadRoster: absent file → null (the no-config sentinel)', () => {
  const missing = path.join(os.tmpdir(), 'nope-' + Date.now(), 'agent-roster.yaml');
  assert.strictEqual(roster.loadRoster(missing), null, 'absent → null');
});

test('loadRoster: valid file → parsed roster', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));
  const p = path.join(dir, 'agent-roster.yaml');
  fs.writeFileSync(p, 'personas:\n  - name: ux-advisor\n    enabled: false\n');
  const r = roster.loadRoster(p);
  assert.ok(r && r.personas, 'loaded');
  assert.strictEqual(r.personas['ux-advisor'].enabled, false, 'parsed enabled');
});

test('loadRoster: unreadable path (a directory) → defaults + warning, never throws', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));
  // reading a directory as a file throws EISDIR (not ENOENT) → degrade loud
  const r = roster.loadRoster(dir);
  assert.ok(r && r.personas, 'returns a roster, not null, not a throw');
  assert.strictEqual(r.personas['architect-advisor'].enabled, true, 'defaults intact');
  assert.ok(r.warnings.length >= 1, 'has a warning');
});

// ---------- resolveFiring: the byte-identical null seam ----------

test('resolveFiring(route, null) deepStrictEqual the REAL router output (1:1 seam)', () => {
  const real = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'significant' });
  const out = roster.resolveFiring(real, null);
  assert.deepStrictEqual(out, real, 'null roster returns the routeResult unchanged');
  assert.strictEqual(out, real, 'same reference — no copy, no new fields');
  // and it holds for a non-firing (cosmetic) route too
  const realCosmetic = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'cosmetic' });
  assert.deepStrictEqual(roster.resolveFiring(realCosmetic, null), realCosmetic, 'cosmetic 1:1 too');
});

// ---------- resolveFiring: disabled persona dropped ----------

test('resolveFiring drops a persona disabled in the roster', () => {
  const real = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'significant' });
  assert.deepStrictEqual(real.personas, ['architect-advisor', 'qa-advisor'], 'baseline personas');
  const r = roster.parseRoster('personas:\n  - name: architect-advisor\n    enabled: false\n');
  const out = roster.resolveFiring(real, r);
  assert.deepStrictEqual(out.personas, ['qa-advisor'], 'architect dropped');
  assert.strictEqual(out.fire, true, 'still fires with one persona left');
  assert.strictEqual(out.roster_applied, true, 'roster_applied flag');
  assert.strictEqual(out.dropped.length, 1, 'one dropped');
  assert.strictEqual(out.dropped[0].persona, 'architect-advisor', 'dropped names architect');
  assert.ok(/disabled/.test(out.dropped[0].why), 'why explains disabled');
});

// ---------- resolveFiring: depth_threshold raises but never lowers ----------

test('depth_threshold cosmetic on a significant change still fires (does not lower the bar)', () => {
  const real = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'significant' });
  const r = roster.parseRoster('personas:\n  - name: architect-advisor\n    depth_threshold: cosmetic\n');
  const out = roster.resolveFiring(real, r);
  assert.ok(out.personas.includes('architect-advisor'), 'cosmetic threshold does not drop on significant');
  assert.strictEqual(out.dropped.length, 0, 'nothing dropped');
});

test('depth_threshold significant on a cosmetic change drops the persona (raises the bar)', () => {
  // build a route where the zone still reports personas but magnitude is cosmetic;
  // use a manufactured routeResult that fires, to isolate the roster raise behavior
  const routeResult = { zone: 'business-rules', personas: ['architect-advisor', 'qa-advisor'], magnitude: 'cosmetic', fire: true, reason: 'test' };
  const r = roster.parseRoster('personas:\n  - name: architect-advisor\n    depth_threshold: significant\n');
  const out = roster.resolveFiring(routeResult, r);
  assert.ok(!out.personas.includes('architect-advisor'), 'architect dropped by raised threshold');
  assert.ok(out.personas.includes('qa-advisor'), 'qa still present');
  assert.strictEqual(out.dropped.length, 1, 'one dropped');
  assert.ok(/depth_threshold/.test(out.dropped[0].why), 'why explains threshold');
});

// ---------- resolveFiring: all dropped → fire:false + honest reason ----------

test('all personas dropped → fire:false with an honest roster reason', () => {
  const real = router.route('.product/scenarios/SC-003-x.md', { magnitude: 'significant' });
  assert.deepStrictEqual(real.personas, ['qa-advisor'], 'scenarios → qa only');
  const r = roster.parseRoster('personas:\n  - name: qa-advisor\n    enabled: false\n');
  const out = roster.resolveFiring(real, r);
  assert.strictEqual(out.fire, false, 'no personas → no fire');
  assert.deepStrictEqual(out.personas, [], 'empty personas');
  assert.ok(/roster/i.test(out.reason), 'reason names the roster as the cause');
  assert.strictEqual(out.dropped.length, 1, 'dropped populated');
});

test('roster_applied and dropped are present even when nothing is dropped', () => {
  const real = router.route('.product/business-rules/BR-010-x.md', { magnitude: 'significant' });
  const out = roster.resolveFiring(real, roster.parseRoster('version: 1\n'));
  assert.strictEqual(out.roster_applied, true, 'roster_applied true');
  assert.deepStrictEqual(out.dropped, [], 'dropped empty');
  assert.deepStrictEqual(out.personas, real.personas, 'personas unchanged');
  assert.strictEqual(out.fire, true, 'still fires');
});

// ---------- resolvePanel ----------

test('resolvePanel(names, null) → all names pass with default annotations', () => {
  const out = roster.resolvePanel(['architect-advisor', 'qa-advisor'], null);
  assert.deepStrictEqual(out, [
    { name: 'architect-advisor', model: null, extra_lenses: [] },
    { name: 'qa-advisor', model: null, extra_lenses: [] },
  ], 'null roster → default annotations');
});

test('resolvePanel filters disabled personas and annotates model + lenses', () => {
  const r = roster.parseRoster([
    'personas:',
    '  - name: ux-advisor',
    '    enabled: false',
    '  - name: architect-advisor',
    '    model: opus',
    '    extra_lenses: [security]',
  ].join('\n'));
  const out = roster.resolvePanel(['architect-advisor', 'ux-advisor', 'qa-advisor'], r);
  assert.strictEqual(out.length, 2, 'ux filtered out');
  assert.deepStrictEqual(out[0], { name: 'architect-advisor', model: 'opus', extra_lenses: ['security'] }, 'architect annotated');
  assert.deepStrictEqual(out[1], { name: 'qa-advisor', model: null, extra_lenses: [] }, 'qa default annotated');
});

// ---------- getPreset ----------

test('getPreset returns built-ins for null roster', () => {
  assert.deepStrictEqual(roster.getPreset('lean', null), ['architect-advisor', 'qa-advisor'], 'lean');
  assert.deepStrictEqual(roster.getPreset('full', null), ['architect-advisor', 'qa-advisor', 'ux-advisor'], 'full');
});

test('getPreset honors a user override', () => {
  const r = roster.parseRoster('presets:\n  - name: lean\n    personas: [qa-advisor]\n');
  assert.deepStrictEqual(roster.getPreset('lean', r), ['qa-advisor'], 'user lean override');
  assert.deepStrictEqual(roster.getPreset('full', r), ['architect-advisor', 'qa-advisor', 'ux-advisor'], 'full still built-in');
});

test('getPreset unknown name → null', () => {
  assert.strictEqual(roster.getPreset('nope', null), null, 'unknown → null (null roster)');
  assert.strictEqual(roster.getPreset('nope', roster.parseRoster('version: 1\n')), null, 'unknown → null (with roster)');
});

// ---------- DEFAULT_ROSTER shape ----------

test('DEFAULT_ROSTER exposes the three advisors and lean/full presets', () => {
  assert.deepStrictEqual(Object.keys(roster.DEFAULT_ROSTER.personas).sort(), ['architect-advisor', 'qa-advisor', 'ux-advisor'], 'personas');
  assert.deepStrictEqual(roster.DEFAULT_ROSTER.presets.lean, ['architect-advisor', 'qa-advisor'], 'lean preset');
  assert.deepStrictEqual(roster.DEFAULT_ROSTER.presets.full, ['architect-advisor', 'qa-advisor', 'ux-advisor'], 'full preset');
});

console.log(`\n${passed} assertions passed.`);
