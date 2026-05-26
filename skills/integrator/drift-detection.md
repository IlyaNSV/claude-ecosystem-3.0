---
description: Minimum-viable drift detection between installed adapter instance and pilot-local reference adapter, used by /integrator:update Stage 3. Three heuristics (D1 semver / D2 schema / D3 body diff) — all local-only post DEC-DEV-0044 tri-location refinement. Full schema-aware drift deferred to Phase 7.
---

# Drift Detection — Skill for Integrator

Detect drift between an **installed adapter instance** (in `.claude/integrator/adapters/`) and **two reference points**: the upstream tool version and the **pilot-local reference adapter** (`.claude/adapters/<adapter>.js`, synced from ecosystem repo via `/ecosystem:update`).

> **v1 scope (per DEC-DEV-0040 + Phase 5 plan, refined DEC-DEV-0044):** three heuristics, no semantic analysis. **All comparisons are local-only** — no cross-repo git access needed. Drift comparison subject = pilot reference vs pilot instance (both in `.claude/`). `@source_ref` is audit-only (tracks ecosystem commit at install time via `.sync-metadata.yaml`), not used as drift primary key. Full type-aware diff (e.g., consumer input shape comparison) → Phase 7.

## When invoked

- `/integrator:update <tool>` Stage 3 — primary use
- `/integrator:debug` — when contract failure suspected as version drift
- Future `/integrator:verify --light` (Phase 7) — periodic drift check

## Three checks (D1, D2, D3)

### D1 — Semver range compatibility

Compare adapter's declared `@target_tool_version` range against the (new) tool version actually installed.

**Inputs:**
- `range`: from installed adapter metadata header (e.g., `^2.1.0`, `~1.4.0`, `>=3.0.0 <4.0.0`)
- `actual`: tool version after install (e.g., `2.3.0`, `1.4.5`, `3.5.0`)

**Algorithm:** standard semver range satisfaction (vanilla impl below — no `semver` npm dep needed for v1, range syntax we use is narrow).

```javascript
function satisfiesCaret(range, actual) {
  // ^X.Y.Z matches >=X.Y.Z <(X+1).0.0
  const m = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null; // unsupported syntax — fall back to manual
  const [, X, Y, Z] = m.map(Number);
  const a = actual.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!a) return null;
  const [, ax, ay, az] = a.map(Number);
  if (ax !== X) return false;                       // major must match
  if (ay > Y) return true;
  if (ay === Y && az >= Z) return true;
  return false;
}
```

**Outcomes:**
- `in-range` → ✅ pass (no drift on version axis)
- `out-of-range` → 🔴 likely breaking; queue contract for repair
- `unsupported syntax` (range not parseable) → 🟡 surface to user; manual review

### D2 — contract_schema_version mismatch (local-only)

Compare adapter's `CONTRACT_SCHEMA_VERSION` constant (declared in adapter body) between **pilot-local reference** and **installed instance** — both in `.claude/`. No cross-repo access.

**Inputs:**
- `installed`: integer from `.claude/integrator/adapters/<adapter>.js`
- `reference`: integer from `.claude/adapters/<adapter>.js`

**Extraction (vanilla, cross-platform):**
```bash
node -e "const m = require('fs').readFileSync(process.argv[1],'utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m ? m[1] : 'unknown')" <path>
```

**Outcomes:**
- `installed == reference` → ✅ pass
- `installed < reference` → 🔴 pilot reference evolved (e.g., last `/ecosystem:update` brought a new schema version); consumer input shape may differ; queue for repair
- `installed > reference` → 🟡 installed is ahead (manual hack? out-of-band install?); investigate before continuing
- `installed unknown` (no constant found) → 🔴 metadata corruption; surface

### D3 — Adapter body diff (local-only, header-stripped)

Compare body of **pilot-local reference** against **installed instance** — both files in `.claude/`. Strip the JSDoc metadata header block (which differs by design: reference has placeholders, instance has populated values).

**Inputs:**
- `reference`: `.claude/adapters/<adapter>.js`
- `installed`: `.claude/integrator/adapters/<adapter>.js`

**Header-stripped comparison (Node, cross-platform):**
```bash
node -e "
const fs = require('fs');
function stripHeader(s) {
  s = s.replace(/\r\n/g, '\n');
  const idx = s.indexOf('const CONTRACT_SCHEMA_VERSION');
  return idx >= 0 ? s.slice(idx) : s;
}
const ref = stripHeader(fs.readFileSync(process.argv[1], 'utf8'));
const ins = stripHeader(fs.readFileSync(process.argv[2], 'utf8'));
if (ref === ins) { console.log('EMPTY'); process.exit(0); }
const refLines = ref.split('\n'), insLines = ins.split('\n');
let diff = 0, fnDriftHits = 0;
const fnRe = /function\s+(transformTo\w+Input|validateContract|parseFrontmatter|extractSections|slugify)\b/;
for (let i = 0; i < Math.max(refLines.length, insLines.length); i++) {
  if (refLines[i] !== insLines[i]) {
    diff++;
    if ((refLines[i] && fnRe.test(refLines[i])) || (insLines[i] && fnRe.test(insLines[i]))) fnDriftHits++;
  }
}
console.log('DIFF:' + diff + ' lines; fnDriftHits=' + fnDriftHits);
" .claude/adapters/<adapter>.js .claude/integrator/adapters/<adapter>.js
```

**Classification of diff lines** (rough heuristic):

- `EMPTY` → ✅ no body drift (bodies identical after header strip)
- `DIFF:N lines; fnDriftHits=0` AND N small (<10) → 🟡 cosmetic; metadata refresh sufficient (just bump installed instance metadata via re-cp), no contract repair
- `fnDriftHits>0` (any function-name line differs) → 🔴 functional drift in transform/validate/parse pipeline; queue for repair
- `DIFF:N lines; fnDriftHits=0` AND N large (≥10) → 🟡→🔴 escalate to user (likely structural change in non-named-fn region — strings/constants/data)

### Aggregation

Per affected contract:
- If any check returns 🔴 → contract status `drift_detected` → repair candidate
- If only 🟡 → contract status `drift_minor` → can auto-bump metadata without repair (user notification)
- If all ✅ → contract status unchanged; just refresh `last_verified`

## Producing the drift report

```
DRIFT REPORT for <tool> <installed-version> → <new-version>

CNT-<NNN> (<producer> → <consumer>)
  D1 semver:    <range> vs <new>          → <verdict> [✅/🟡/🔴]
  D2 schema:    installed=<n> repo=<n>    → <verdict>
  D3 body diff: <hunks-summary>           → <verdict>
  Overall:      <repair | bump-only | clean>

Summary:
  X contracts: clean
  Y contracts: bump-only (metadata refresh)
  Z contracts: drift_detected → repair via contract-designer

Next actions:
  - clean: refresh last_verified
  - bump-only: refresh metadata in adapter header (target_tool_version,
    source_ref, installed_at)
  - drift_detected: invoke /integrator:update Stage 4 (contract repair)
```

## Anti-patterns

1. **Treating D3 cosmetic diff as repair-worthy.** Wastes contract-designer subagent invocation budget. Bumps without functional drift are metadata-refresh-only.
2. **Ignoring D1 when D2/D3 are clean.** Major-version bump (^2 → 3) can be silent in code while breaking at runtime due to consumer API change. D1 is independent signal.
3. **Auto-bumping `@source_ref` after repair without verify smoke pass.** Only update source_ref after Stage 5 verify is green; read fresh value from `.claude/adapters/.sync-metadata.yaml`.
4. **Running drift detection without baseline `--check-only`.** Use `--check-only` mode of /integrator:update to preview before mutating state.
5. **Custom semver range syntax beyond `^X.Y.Z` / `~X.Y.Z` / explicit comparators in v1.** If installed range uses unusual syntax (e.g., `npm:<alias>@<spec>`) → surface as `unsupported`, ask user.
6. **Cross-repo git diff for D3 (legacy approach, removed DEC-DEV-0044).** Original spec used `git diff <source_ref> HEAD -- adapters/<adapter>.js` which assumed pilot's git == ecosystem's git. In tri-location pattern this is wrong: `@source_ref` is ecosystem commit (read from `.sync-metadata.yaml`), not pilot's HEAD. D3 now does header-stripped local file comparison instead. `@source_ref` is audit-only.
7. **Comparing pilot-instance against ecosystem-repo directly.** Pilot has no path to ecosystem repo's `adapters/`. Reference layer is `.claude/adapters/`; that's the comparison target.

## Limits of v1 detection (deferred to Phase 7)

- **Consumer input shape diff.** v1 compares adapter body; doesn't compare actual JSON output shape against consumer's expected schema. Phase 7 may parse tool docs for declared input shape and assert.
- **Producer artifact format drift.** If `handoff-spec.md` evolves (new required section), v1 won't catch unless reference adapter is also updated and triggers D2 schema bump. Coupling adapter↔producer is implicit.
- **Multi-adapter contracts.** v1 assumes 1 adapter per contract. Multi-adapter (e.g., split pipeline) → defer Phase 7.

## Cross-reference

- `commands/integrator/update.md` — orchestration consumer
- `.claude/adapters/handoff-to-ccsdd.js` — pilot-local reference adapter with metadata header pattern (`@target_tool_version`, `@contract_schema_version`, `@source_ref` populated from `.sync-metadata.yaml`)
- `.claude/adapters/.sync-metadata.yaml` — last ecosystem repo commit synced; stamped by `/ecosystem:bootstrap` and `/ecosystem:update`
- `.claude/adapters/README.md` — tri-location pattern (DEC-DEV-0040 Q1 refined DEC-DEV-0044)
- `docs/integrator-module/SPEC.md` §7.4 — update UX narrative
