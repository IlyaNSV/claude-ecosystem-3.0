---
description: Minimum-viable drift detection between installed adapter instance and repo reference adapter, used by /integrator:update Stage 3. Three heuristics (D1 semver / D2 schema / D3 body diff). Full schema-aware drift deferred to Phase 7.
---

# Drift Detection — Skill for Integrator

Detect drift between an **installed adapter instance** (in `.claude/integrator/adapters/`) and **two reference points**: the upstream tool version and the repo reference adapter (`adapters/<adapter>.js`).

> **v1 scope (per DEC-DEV-0040 + Phase 5 plan):** three heuristics, no semantic analysis. Catches breaking changes >80% of time per Phase 4 hash-drift experience. Full type-aware diff (e.g., consumer input shape comparison) → Phase 7.

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

### D2 — contract_schema_version mismatch

Compare adapter's `CONTRACT_SCHEMA_VERSION` constant (declared in adapter body) between installed instance and repo reference.

**Inputs:**
- `installed`: integer from `.claude/integrator/adapters/<adapter>.js`
- `repo`: integer from `adapters/<adapter>.js`

**Extraction (vanilla):**
```bash
node -e "const m = require('fs').readFileSync(process.argv[1],'utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m ? m[1] : 'unknown')" <path>
```

**Outcomes:**
- `installed == repo` → ✅ pass
- `installed < repo` → 🔴 reference evolved; consumer input shape may differ; queue for repair
- `installed > repo` → 🟡 installed is ahead (manual edit? local hack?); investigate before continuing
- `installed unknown` (no constant found) → 🔴 metadata corruption; surface

### D3 — Adapter body diff against repo at `source_ref`

Compare current repo `adapters/<adapter>.js` against the commit captured in installed metadata `@source_ref`.

**Inputs:**
- `source_ref`: git commit hash from installed adapter metadata
- repo HEAD = current canonical reference

**Command:**
```bash
git --no-pager diff <source_ref> HEAD -- adapters/<adapter>.js
```

**Classification of diff hunks** (rough heuristic):

- Empty diff → ✅ no body drift
- Changes only in `/* ... */` blocks or `//` comments (no code) → 🟡 cosmetic; bump installed `@source_ref` to HEAD, skip repair
- Changes in `transformTo*Input`, `validateContract`, `parseFrontmatter`, `extractSections`, or any function in the transformation pipeline → 🔴 functional drift; queue for repair
- Changes only in CLI helper (`printHelp`, `parseArgs`) → 🟢 cosmetic; bump `@source_ref`, skip repair

**Function-name classifier:**
```bash
git --no-pager diff <source_ref> HEAD -- adapters/<adapter>.js | grep -E '^\+|^-' | grep -E 'function (transform|validate|parse|extract)'
```
Non-empty → functional drift signal.

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

1. **Treating D3 cosmetic diff as repair-worthy.** Wastes contract-designer subagent invocation budget. Comment-only diffs are bump-only.
2. **Ignoring D1 when D2/D3 are clean.** Major-version bump (^2 → 3) can be silent in code while breaking at runtime due to consumer API change. D1 is independent signal.
3. **Auto-bumping `@source_ref` after repair without verify smoke pass.** Only update source_ref to HEAD after Stage 5 verify is green.
4. **Running drift detection without baseline `--check-only`.** Use `--check-only` mode of /integrator:update to preview before mutating state.
5. **Custom semver range syntax beyond `^X.Y.Z` / `~X.Y.Z` / explicit comparators in v1.** If installed range uses unusual syntax (e.g., `npm:<alias>@<spec>`) → surface as `unsupported`, ask user.
6. **Comparing against wrong baseline.** `source_ref` is the repo commit at install time, NOT the tool version. Don't conflate.

## Limits of v1 detection (deferred to Phase 7)

- **Consumer input shape diff.** v1 compares adapter body; doesn't compare actual JSON output shape against consumer's expected schema. Phase 7 may parse tool docs for declared input shape and assert.
- **Producer artifact format drift.** If `handoff-spec.md` evolves (new required section), v1 won't catch unless reference adapter is also updated and triggers D2 schema bump. Coupling adapter↔producer is implicit.
- **Multi-adapter contracts.** v1 assumes 1 adapter per contract. Multi-adapter (e.g., split pipeline) → defer Phase 7.

## Cross-reference

- `commands/integrator/update.md` — orchestration consumer
- `adapters/handoff-to-ccsdd.js` — reference adapter with metadata header pattern (`@target_tool_version`, `@contract_schema_version`, `@source_ref`)
- `adapters/README.md` — dual-location pattern (DEC-DEV-0040 Q1)
- `docs/integrator-module/SPEC.md` §7.4 — update UX narrative
