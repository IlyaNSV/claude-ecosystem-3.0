'use strict';
/**
 * Unit test for the Orchestrator deploy-manifest lib (DEC-DEV-0203 / FIND-A + FIND-B).
 *
 * WHAT IT PINS, and why each pin exists (all three come from the second live E.B run, 2026-07-14):
 *
 *  - DETERMINISM (FIND-A — the whole reason this lib exists). The parse used to be done by a
 *    sonnet subagent, and the SAME unchanged file parsed as a full 4-step list in one run and as
 *    `step-list=MISSING` in another 18 minutes later. So the headline test literally re-runs the
 *    CLI N times on the real manifest form and asserts BYTE-IDENTICAL stdout. A parse behind a
 *    readiness gate that can flip is a coin toss in both directions — a false negative blocks a
 *    good deploy, a false positive would wave a mangled manifest into a real mutation.
 *
 *  - THE RELEASE-PINNED UNIT GUARD (FIND-B, the second defect). E.A parameterizes the systemd
 *    units by {{RELEASE_DIR}} — a concrete releases/<ts>. Such a unit is DEAF TO THE FLIP:
 *    `current` moves, the unit does not, `systemctl restart` restarts the OLD release — and the
 *    healthcheck then PASSES, because the old release is still serving on the same port. The run
 *    reports DEPLOYED having deployed nothing, and that false green is exactly the
 *    `contract_evidence` that would launder a never-verified draft CNT into `active`. Both
 *    template variants are fixtures here: the pilot's real (broken) one must BLOCK.
 *
 *  - THE 0201 DEADLOCK MUST NOT COME BACK. `present` is a question of FACT and must never read
 *    `status`; a `draft` manifest with a step-list is present:true.
 *
 * Fixtures are the REAL pilot manifest form (tests/fixtures/deploy/**). The CRLF twin is
 * GENERATED at run time rather than committed — a committed CRLF file is at the mercy of
 * core.autocrlf/.gitattributes, which is precisely the class of bug being tested.
 *
 * Node stdlib only; run with `node tests/orchestrator/deploy-manifest.test.cjs`.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const LIB = path.join(ROOT, 'orchestrator', 'lib', 'deploy-manifest.cjs');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'deploy');
const PINNED = path.join(FIX, 'release-pinned', 'deploy-manifest.yaml');
const LINKED = path.join(FIX, 'current-linked', 'deploy-manifest.yaml');

const lib = require(LIB);
const { readManifest, parseYamlText, expandHome, normalizeSteps, BLOCKING_DEFECTS } = lib;

const HOME = '/home/cc-dev';   // pin $HOME so the expansion is host-independent in tests

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

function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-manifest-')); }
const read = (m, extra) => readManifest(m, Object.assign({ home: HOME }, extra || {}));

console.log('orchestrator — deploy-manifest.cjs (DEC-DEV-0203: FIND-A determinism + FIND-B scene/units)');

// ---------------------------------------------------------------------------
// The real pilot manifest form — every fact the deploy contracts on
// ---------------------------------------------------------------------------

test('the REAL manifest form parses: present + a 4-step ordered list (the fact the LLM kept losing)', () => {
  const m = read(LINKED);
  assert.strictEqual(m.present, true, 'the pilot manifest IS present (file + parse + step-list)');
  assert.deepStrictEqual(m.steps.map((s) => s.name), ['build', 'migrate', 'flip', 'restart'],
    'the ordered 4-step list — the live sonnet parse returned this once and an EMPTY list 18 min later');
  const build = m.steps[0];
  assert.strictEqual(build.command, 'pnpm -r build');
  assert.strictEqual(build.working_directory, '{{RELEASE_DIR}}', 'the BUILD does run in the concrete release dir — that is correct');
  assert.strictEqual(build.on_failure, 'abort');
  assert.strictEqual(m.steps[1].status, 'verified', 'the migrate step is verified (packages/db/schema.prisma exists in the pilot)');
  assert.strictEqual(m.steps[2].type, 'symlink_atomic');
  assert.deepStrictEqual(m.steps[3].units, ['mft-api', 'mft-web', 'mft-worker']);
  assert.strictEqual(m.steps[3].on_failure, 'rollback');
});

test('healthcheck / migrate / release_layout / contract survive the parse', () => {
  const m = read(LINKED);
  assert.strictEqual(m.healthcheck.per_service.api.url, 'http://localhost:{{PORT}}/health');
  assert.strictEqual(m.healthcheck.per_service.api.boot_window_sec, 30, 'a number stays a number');
  assert.strictEqual(m.healthcheck.per_service.api.expect, '2xx', '`2xx` is a string, not a mangled number');
  assert.strictEqual(m.healthcheck.per_service.worker.method, 'process');
  assert.strictEqual(m.migrate.name, 'migrate');
  assert.strictEqual(m.release_layout.timestamp_format, 'YYYYMMDDTHHmmssZ');
  assert.deepStrictEqual(m.release_layout.shared_contents, ['.env', 'logs/', 'uploads/']);
  assert.strictEqual(m.contract, 'CNT-005', 'the CNT id the manifest NAMES — never invented');
  assert.strictEqual(m.capability, 'deploy-staging');
});

// ---------------------------------------------------------------------------
// FIND-B — the scene. `~` was NEVER expanded and NOTHING was ever created.
// ---------------------------------------------------------------------------

test('FIND-B: deploy_root `~/…` is EXPANDED to a real absolute path (deploy-to-stage had no homedir at all)', () => {
  const m = read(LINKED);
  assert.strictEqual(m.deploy_root.declared, '~/deploy/my-first-test');
  assert.strictEqual(m.deploy_root.expanded, '/home/cc-dev/deploy/my-first-test',
    'the ~ must become $HOME — the live process contained no `deploy_root`, no `homedir`, no `expand`, so ~/deploy was never a directory');
});

test('FIND-B: the SCENE resolves every absolute path the Deploy phase must materialise', () => {
  const m = read(LINKED, { timestamp: '20260714T120000Z' });
  const s = m.scene;
  assert.strictEqual(s.deploy_root, '/home/cc-dev/deploy/my-first-test');
  assert.strictEqual(s.releases_dir, '/home/cc-dev/deploy/my-first-test/releases');
  assert.strictEqual(s.current_link, '/home/cc-dev/deploy/my-first-test/current');
  assert.strictEqual(s.shared_dir, '/home/cc-dev/deploy/my-first-test/shared');
  assert.strictEqual(s.env_file, '/home/cc-dev/deploy/my-first-test/shared/.env',
    'shared/.env is where `migrate` reads DATABASE_URL from — it was never created');
  assert.strictEqual(s.release_dir, '/home/cc-dev/deploy/my-first-test/releases/20260714T120000Z',
    '{{DEPLOY_ROOT}} and {{TIMESTAMP}} are both substituted');
  assert.deepStrictEqual(s.shared_paths.map((p) => p.path), [
    '/home/cc-dev/deploy/my-first-test/shared/.env',
    '/home/cc-dev/deploy/my-first-test/shared/logs',
    '/home/cc-dev/deploy/my-first-test/shared/uploads',
  ]);
  assert.deepStrictEqual(s.shared_paths.map((p) => p.dir), [false, true, true], 'a trailing / means "directory"');
  assert.strictEqual(s.date_fmt, '+%Y%m%dT%H%M%SZ',
    'the DECLARED timestamp_format is rendered as a real `date -u` format — the agent never invents the shape');
});

test('no --timestamp ⇒ release_dir is null (the lib NEVER reads a clock — that is what makes it deterministic)', () => {
  const m = read(LINKED);
  assert.strictEqual(m.scene.release_dir, null);
  assert.ok(!/\d{8}T\d{6}Z/.test(JSON.stringify(m)), 'no timestamp may leak into a clock-free parse');
});

test('expandHome: ~ / $HOME / ${HOME} / absolute — and a ~user form is REFUSED, not guessed', () => {
  assert.strictEqual(expandHome('~/deploy/x', HOME).path, '/home/cc-dev/deploy/x');
  assert.strictEqual(expandHome('~', HOME).path, '/home/cc-dev');
  assert.strictEqual(expandHome('$HOME/deploy/x', HOME).path, '/home/cc-dev/deploy/x');
  assert.strictEqual(expandHome('${HOME}/deploy/x', HOME).path, '/home/cc-dev/deploy/x');
  assert.strictEqual(expandHome('/srv/app', HOME).path, '/srv/app', 'an absolute path is left alone');
  const other = expandHome('~deploy/app', HOME);
  assert.strictEqual(other.path, '', 'another user\'s home is UNKNOWABLE from here — it must not be guessed');
  assert.ok(/will NOT guess/.test(other.why), 'and the refusal must say so');
});

// ---------------------------------------------------------------------------
// FIND-B, second defect — the systemd units must follow `current`, not a release
// ---------------------------------------------------------------------------

test('FIND-B GUARD: {{RELEASE_DIR}}-pinned units are a BLOCKING defect (the flip would be inert ⇒ a false DEPLOYED)', () => {
  const m = read(PINNED);
  assert.strictEqual(m.present, true, 'the equipment IS present — it is just WRONG (a different axis)');
  assert.deepStrictEqual(m.blocking_defects, [BLOCKING_DEFECTS.UNIT_RELEASE_PINNED]);
  assert.deepStrictEqual(m.units.map((u) => u.name), ['mft-api', 'mft-web', 'mft-worker']);
  for (const u of m.units) {
    assert.strictEqual(u.template_found, true, `${u.name}: the .service.template must be read, not assumed`);
    assert.strictEqual(u.release_pinned, true, `${u.name}: pinned to a concrete releases/<ts>`);
  }
  const why = m.disclosures.join(' | ');
  assert.ok(/deaf|would NOT move|OLD release/i.test(why), 'the disclosure must SAY the flip does nothing');
  assert.ok(/\{\{CURRENT_LINK\}\}/.test(why), 'and name the fix (the unit must reference `current`)');
  assert.ok(/integrator:provision/.test(why) && /§8\.3/.test(why),
    'and name WHO fixes it — the Integrator re-equips; the Orchestrator does not rewrite templates');
});

test('…and the FIXED ({{CURRENT_LINK}}) units carry NO blocking defect — flip + restart is the deploy', () => {
  const m = read(LINKED);
  assert.deepStrictEqual(m.blocking_defects, [], 'a current-linked unit follows the flip');
  for (const u of m.units) {
    assert.strictEqual(u.release_pinned, false, `${u.name} must not pin a release`);
    assert.ok(u.placeholders.includes('{{CURRENT_LINK}}'), `${u.name} must reference the current symlink`);
    assert.ok(u.placeholders.includes('{{ENV_FILE}}'), `${u.name} must take its env from shared/.env`);
    assert.ok(!u.placeholders.includes('{{RELEASE_DIR}}'), `${u.name} must NOT carry {{RELEASE_DIR}}`);
  }
  assert.deepStrictEqual(m.units.map((u) => u.template), [
    'app-api.service.template', 'app-web.service.template', 'app-worker.service.template',
  ], 'each unit NAME is paired with its template FILE (unit_templates is an explicit map)');
});

test('a unit hard-wired to a literal releases/<ts> path (no placeholder) is caught too', () => {
  const tmp = mkTmp();
  fs.writeFileSync(path.join(tmp, 'deploy-manifest.yaml'), [
    'deploy_root: "~/deploy/x"',
    'steps:',
    '  - flip:    { type: symlink_atomic }',
    '  - restart: { units: [svc-api] }',
    'unit_templates:',
    '  svc-api: api.service.template',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(tmp, 'api.service.template'),
    '[Service]\nWorkingDirectory=/home/cc-dev/deploy/x/releases/20260714T101010Z/apps/api\n');
  const m = read(path.join(tmp, 'deploy-manifest.yaml'));
  assert.strictEqual(m.units[0].release_pinned, true, 'a literal releases/<ts> is the same defect without the placeholder');
  assert.deepStrictEqual(m.blocking_defects, [BLOCKING_DEFECTS.UNIT_RELEASE_PINNED]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// FIND-A — determinism. The headline.
// ---------------------------------------------------------------------------

test('FIND-A: N=20 CLI runs on the real manifest produce BYTE-IDENTICAL stdout', () => {
  const hashes = new Set();
  for (let i = 0; i < 20; i += 1) {
    const out = execFileSync(process.execPath, [LIB, 'parse', '--manifest', LINKED, '--home', HOME], { encoding: 'utf8' });
    hashes.add(crypto.createHash('sha256').update(out).digest('hex'));
  }
  assert.strictEqual(hashes.size, 1,
    `20 parses of ONE unchanged file produced ${hashes.size} distinct outputs — this is exactly the live defect (a sonnet parse gave a full step-list in S7 and step-list=MISSING in S1)`);
});

test('FIND-A: the same capability with CRLF endings parses IDENTICALLY (a Windows pilot materialises CRLF)', () => {
  // BOTH variants are MATERIALISED HERE from normalized content — we never assert the EOL of the
  // COMMITTED fixture. That is deliberate: `.yaml`/`.template` are not LF-pinned in .gitattributes,
  // so under core.autocrlf=true git hands a Windows checkout CRLF files. A test that asserted
  // `eol === 'LF'` on the fixture would pass in this worktree and RED on a fresh clone — the exact
  // G36 class of bug this very feature exists to survive.
  const FILES = ['deploy-manifest.yaml', 'app-api.service.template', 'app-web.service.template', 'app-worker.service.template'];
  const dirs = {};
  for (const [kind, eol] of [['lf', '\n'], ['crlf', '\r\n']]) {
    const tmp = mkTmp();
    for (const f of FILES) {
      const body = fs.readFileSync(path.join(FIX, 'current-linked', f), 'utf8').replace(/\r\n/g, '\n');
      fs.writeFileSync(path.join(tmp, f), body.replace(/\n/g, eol));
    }
    dirs[kind] = tmp;
  }
  const lf = read(path.join(dirs.lf, 'deploy-manifest.yaml'), { timestamp: 'TS' });
  const crlf = read(path.join(dirs.crlf, 'deploy-manifest.yaml'), { timestamp: 'TS' });
  assert.strictEqual(lf.eol, 'LF');
  assert.strictEqual(crlf.eol, 'CRLF', 'the CRLF must be detected and disclosed');
  for (const k of ['present', 'status', 'contract', 'capability', 'blocking_defects', 'steps', 'healthcheck', 'release_layout']) {
    assert.deepStrictEqual(crlf[k], lf[k], `CRLF changed \`${k}\` — the EOL must not reach the semantics`);
  }
  assert.deepStrictEqual(crlf.units.map((u) => [u.name, u.release_pinned]), lf.units.map((u) => [u.name, u.release_pinned]),
    'a CRLF unit template must be scanned identically (it is normalized before the regex)');
  // …and the committed fixture parses the same way whichever EOL git handed us
  const asChecked = read(LINKED, { timestamp: 'TS' });
  assert.deepStrictEqual(asChecked.steps, lf.steps, 'the checked-out fixture must parse identically regardless of how git materialised it');
  for (const d of Object.values(dirs)) fs.rmSync(d, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fail-loud: a broken manifest is DATA (present:false + why), never a fabrication
// ---------------------------------------------------------------------------

test('absent / empty / step-less manifests ⇒ present:false with a REASON — and never an invented step-list', () => {
  const missing = read(path.join(FIX, 'nope', 'deploy-manifest.yaml'));
  assert.strictEqual(missing.present, false);
  assert.deepStrictEqual(missing.steps, [], 'nothing is fabricated');
  assert.ok(/not readable/.test(missing.disclosures[0]) && /integrator:provision/.test(missing.disclosures[0]),
    'an absent manifest must name the remedy');

  const tmp = mkTmp();
  const empty = path.join(tmp, 'empty.yaml');
  fs.writeFileSync(empty, '');
  const e = read(empty);
  assert.strictEqual(e.present, false);
  assert.ok(/parsed to NOTHING/.test(e.disclosures[0]));

  const noSteps = path.join(tmp, 'nosteps.yaml');
  fs.writeFileSync(noSteps, 'manifest_version: 1\ncapability: deploy-staging\ndeploy_root: "~/d"\n');
  const n = read(noSteps);
  assert.strictEqual(n.present, false, 'a manifest with no executable step-list is not present');
  assert.deepStrictEqual(n.steps, []);
  assert.ok(/NO executable step-list/.test(n.disclosures[0]) && /NOT fabricating/.test(n.disclosures[0]));

  const garbage = path.join(tmp, 'garbage.yaml');
  fs.writeFileSync(garbage, ':::: not yaml at all\n\t\t}}}\n');
  assert.strictEqual(read(garbage).present, false, 'garbage never parses into a deployable manifest');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The DEC-DEV-0201 deadlock must stay dead: present NEVER reads status
// ---------------------------------------------------------------------------

test('0201 REGRESSION: a `draft` manifest with a step-list is present:true (status is a TRUST axis, not readiness)', () => {
  const m = read(LINKED);
  assert.strictEqual(m.status, 'draft', 'the status is reported VERBATIM');
  assert.strictEqual(m.status_source, 'status', 'and the lib says where it read it');
  assert.strictEqual(m.present, true,
    'THE DEADLOCK: draft must never make the equipment "absent" — E.A must ship draft, and only a deploy can verify it');
});

test('an UNDECLARED status is null (never invented) — the consumer reads null conservatively as draft', () => {
  const tmp = mkTmp();
  const f = path.join(tmp, 'm.yaml');
  fs.writeFileSync(f, 'deploy_root: "~/d"\nsteps:\n  - build: { command: "x" }\n');
  const m = read(f);
  assert.strictEqual(m.status, null, 'no status declared ⇒ null, NOT a guessed "active"');
  assert.strictEqual(m.status_source, null);
  assert.strictEqual(m.contract, null, 'and no CNT id is invented from the directory listing');
  assert.strictEqual(m.present, true, 'yet it is present — it has a step-list');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a nested contract block is read too (status: contract.status; id: contract.id) — no field-name drift', () => {
  const tmp = mkTmp();
  const f = path.join(tmp, 'm.yaml');
  fs.writeFileSync(f, [
    'deploy_root: "~/d"',
    'contract:',
    '  id: CNT-009',
    '  status: active',
    'steps:',
    '  - build: { command: "x" }',
    '',
  ].join('\n'));
  const m = read(f);
  assert.strictEqual(m.status, 'active');
  assert.strictEqual(m.status_source, 'contract.status');
  assert.strictEqual(m.contract, 'CNT-009');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The YAML subset itself — the constructs the real manifest actually uses
// ---------------------------------------------------------------------------

test('YAML subset: flow maps/seqs, quoted + bare scalars, typed numbers, comments, `---`, block scalars', () => {
  const doc = parseYamlText([
    '---',
    '# a leading comment',
    'a: 1',
    'b: "two"                 # trailing comment, stripped',
    'c: true',
    'd: null',
    'e: [x, y, z]',
    'f: { g: 1, h: "i j", k: bare }',
    'l:',
    '  m: 2',
    '  n:',
    '    - one',
    '    - two',
    'note: |',
    '  line one',
    '  line two',
    'url: "http://h/#frag"    # a # inside quotes is NOT a comment',
    'cmd: echo #1             # …but after a space it IS',
    '',
  ].join('\n'));
  assert.strictEqual(doc.a, 1);
  assert.strictEqual(doc.b, 'two');
  assert.strictEqual(doc.c, true);
  assert.strictEqual(doc.d, null);
  assert.deepStrictEqual(doc.e, ['x', 'y', 'z']);
  assert.deepStrictEqual(doc.f, { g: 1, h: 'i j', k: 'bare' });
  assert.deepStrictEqual(doc.l, { m: 2, n: ['one', 'two'] });
  assert.strictEqual(doc.note, 'line one\nline two\n');
  assert.strictEqual(doc.url, 'http://h/#frag', 'a # inside a quoted scalar must survive');
  assert.strictEqual(doc.cmd, 'echo', 'an unquoted # after whitespace IS a YAML comment');
});

test('YAML subset: an unquoted {{TEMPLATE}} head is TEXT, not a flow map (the pilot writes them unquoted)', () => {
  const doc = parseYamlText('release_dir: {{DEPLOY_ROOT}}/releases/{{TIMESTAMP}}\n');
  assert.strictEqual(doc.release_dir, '{{DEPLOY_ROOT}}/releases/{{TIMESTAMP}}',
    'strict YAML would reject this; a consumer that dies on the pilot\'s own manifest is useless');
});

test('normalizeSteps flattens every shape a deployer might emit — order is NEVER reordered', () => {
  assert.deepStrictEqual(
    normalizeSteps([{ build: { command: 'b' } }, { flip: { type: 'symlink_atomic' } }, { restart: null }]),
    [{ name: 'build', command: 'b' }, { name: 'flip', type: 'symlink_atomic' }, { name: 'restart' }]);
  assert.deepStrictEqual(normalizeSteps([{ name: 'build', command: 'b' }]), [{ name: 'build', command: 'b' }],
    'an already-flat step is passed through');
  assert.deepStrictEqual(normalizeSteps(['build', 'flip']), [{ name: 'build' }, { name: 'flip' }]);
  assert.deepStrictEqual(normalizeSteps(undefined), [], 'no steps ⇒ [] (⇒ present:false), never a fabrication');
});

// ---------------------------------------------------------------------------
// The CLI seam the harness agent relays
// ---------------------------------------------------------------------------

test('CLI: `parse` exits 0 even for a broken manifest (a defect is DATA), and 2 on a usage error', () => {
  const out = execFileSync(process.execPath, [LIB, 'parse', '--manifest', PINNED, '--home', HOME, '--capability', 'deploy-staging'], { encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.strictEqual(j.present, true);
  assert.deepStrictEqual(j.blocking_defects, [BLOCKING_DEFECTS.UNIT_RELEASE_PINNED],
    'the blocking defect must survive the JSON seam the agent relays');
  assert.strictEqual(j.deploy_manifest_schema_version, 1);

  const gone = execFileSync(process.execPath, [LIB, 'parse', '--manifest', '/nope/x.yaml'], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(gone).present, false, 'a missing manifest is present:false at exit 0, not a crash');

  let code = 0;
  try { execFileSync(process.execPath, [LIB, 'parse'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assert.strictEqual(code, 2, 'a usage error is exit 2 (the env-readiness / autonomy-policy CLI convention)');
});

test('CLI: a capability mismatch is DISCLOSED (you would be deploying a different capability than you think)', () => {
  const out = execFileSync(process.execPath, [LIB, 'parse', '--manifest', LINKED, '--home', HOME, '--capability', 'cc-sdd-deploy'], { encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.ok(j.disclosures.some((d) => /declares capability "deploy-staging" but this deploy was invoked for "cc-sdd-deploy"/.test(d)));
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
