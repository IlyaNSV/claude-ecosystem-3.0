# Patch 1.3.3 Smoke Test Plan

> **Goal:** validate end-to-end that patch 1.3.3 deliverables (B-1..B-4) work in a pilot project. Static smoke (Sub-phase D — `node dev/meta-improvement/scripts/smoke-hooks.js`) already green; this plan covers runtime scenarios that static smoke can't catch.
>
> **Context:** patch 1.3.3 was driven by pilot session `636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` (2026-05-27 on `my-first-test/`). Re-running the same pilot context after `/ecosystem:update` should now show all 4 fixes active.

---

## Status banner

🟡 **Ready to run.** Plan drafted as part of Sub-phase G. Execution deferred to user discretion (next pilot session OR explicit runtime smoke session).

| Scenario | Status | Run notes |
|---|---|---|
| S1 — research per-tier + approve gate | ⏳ pending | runs in `my-first-test/` after `/ecosystem:update` |
| S2 — forbidden-path write → hook warn + PA append | ⏳ pending | needs Integrator-context session |
| S3 — `/ecosystem:pending-actions` default filter | ⏳ pending | trivially read-only |
| S4 — `/integrator:add` env_tier preview + prod-only warning | ⏳ pending | reuses cc-sdd or a new tool |
| S5 — scope-guard dedup on repeated violation | ⏳ pending | follows S2 |

---

## Pre-conditions

- Pilot project: `my-first-test/` (or any other freshly bootstrapped pilot).
- Run `/ecosystem:update` first → ensures patch 1.3.3 artifacts deployed:
  - `hooks/integrator/scope-guard.js` + manifest entry (PreToolUse registration in `.claude/settings.json`)
  - `commands/ecosystem/pending-actions.md` + `skills/ecosystem/user-action-tracker.md`
  - `.claude/pending-actions.md` backfilled (Step 5b) with PA-000 sentinel
  - Updated `skills/integrator/*` (research/install/tool-profiling) + `commands/integrator/*` (research hard gate + session markers)
- Verify `.claude/settings.json.hooks` contains a PreToolUse entry referencing `node .claude/hooks/integrator/scope-guard.js`.

---

## S1 — `/integrator:research` per-tier output + hard approve gate

**Goal:** verify (a) research output contains per-environment-tier breakdown for every candidate, and (b) Step 7 hard approve gate triggers and waits for user response.

### Setup
- Session in pilot project. Optionally a clean cc-sdd state.

### Steps
1. Run `/integrator:research "deploy stack для small-traffic SaaS"` (or any non-trivial need).
2. Observe research process (Phase 1-5 per `skills/integrator/research-protocol.md`):
   - Phase 1 should explicitly identify environment tiers (default 3 tiers).
   - Phase 4 should extract `environment_tiers` (or `environment_agnostic: true`) per candidate.
   - Phase 5 Guard A: candidates missing both blocks → STOP / re-extract.
3. Phase 5.1 output must contain:
   - Comparison table with per-tier suitability column OR `environment_agnostic` annotation per tool.
   - Narrative recommendation scoped per tier where applicable.
4. Phase 5.2 must render the hard approve gate (`STOP. Approve research outcome?`).
5. Try **3 distinct responses** in separate sessions:
   - **a.** «defer» → research cached, journal entry `decision: deferred`, **no chain into `/integrator:add`**.
   - **b.** «1» → journal records decision, **no auto-invoke of `/integrator:add`** (user must manually run).
   - **c.** silent ignore → assistant should NOT proceed with caching / install / chaining; should wait.

### Expected
- Output schema: tier-stratified recommendations visible.
- Each candidate either has a 3-tier table OR an explicit `environment_agnostic: true` disclaimer.
- Approve gate is **hard**: no caching/install/chaining without explicit option choice or `defer`.

### Pass criteria
- (1) Per-tier breakdown present in all candidates.
- (2) On `defer` → research cached, no install attempted.
- (3) On silent ignore → assistant waits, no proactive action.

### Fail patterns to watch
- Monolithic PROD-only recommendations (= B-1 deliverable broken).
- Auto-chain into `/integrator:add` after numbered choice without user confirmation (= B-4 broken).
- Consilium fan-out (subagent N>1) without scope declaration AND with auto-cached «pick 1» decision (= SPEC §7.6 broken).

---

## S2 — Forbidden-path write from Integrator-context → hook warning + PA append

**Goal:** verify `scope-guard.js` fires PreToolUse warn-only on a write to `.product/` during an active Integrator session, and the violation is logged to `.claude/pending-actions.md`.

### Setup
- Session in pilot project. No Integrator command currently in flight.
- Pre-condition checks:
  - `.claude/settings.json` has scope-guard registered for PreToolUse.
  - `.claude/pending-actions.md` exists with PA-000 sentinel.

### Steps
1. **Stage 1 — confirm no-op outside Integrator session.** Without invoking any `/integrator:*` command, attempt to Edit a file in `.product/features/` (e.g., create `.product/features/FM-SG-TEST.md`).
   - Expected: no `scope-guard` stderr (marker absent → hook is no-op).
2. **Stage 2 — active Integrator session.** Run `/integrator:scan` (or any other Integrator command) — pre-flight should write `.claude/integrator/.session-context.json`.
3. While the Integrator session is active, attempt to Edit / Write a file under `.product/` (e.g., `.product/features/FM-SG-TEST.md`). This must be done within the same Claude Code session window so the marker is still fresh (<1h).
4. Observe stderr in the tool call result.
5. Inspect `.claude/pending-actions.md` — check that a new `## PA-NNN — Integrator scope-guard violation (write)` entry was appended.
6. Finish Integrator session normally so the Final cleanup removes the marker. Verify `.claude/integrator/.session-context.json` is gone.

### Expected
- Stage 1: no stderr warning, no PA entry.
- Stage 2 Step 3: stderr contains `⚠️ INTEGRATOR SCOPE GUARD` with subject path and active-command label.
- Stage 2 Step 5: `.claude/pending-actions.md` has new PA entry with:
  - `Status: pending`
  - `Source: integrator`
  - `Trigger:` references active command (e.g., `/integrator:scan`)
  - `Subject:` shows the forbidden path
- Stage 2 Step 6: marker file removed on session exit.

### Pass criteria
- (1) No-op without marker.
- (2) Warning + PA append with marker.
- (3) Marker cleanup on exit.
- (4) Tool execution still proceeded (warn-only — Edit/Write completed despite warning).

### Fail patterns
- Warning fires without marker → hook not marker-gated correctly.
- No warning with marker + forbidden path → regex / classification bug.
- PA entry missing → `appendPAEntry` bug (or pending-actions.md not initialized → re-run `/ecosystem:update` for backfill).
- Tool execution blocked → hook violating warn-only convention.

---

## S3 — `/ecosystem:pending-actions` default filter

**Goal:** verify the new command surfaces pending entries, hides PA-000 sentinel, supports filters.

### Setup
- After S2, there's at least one `pending` PA entry.

### Steps
1. Run `/ecosystem:pending-actions` (no args).
2. Verify output:
   - Header «PENDING USER ACTIONS» with filter line `status=pending, source=any`.
   - Lists the PA entry from S2 (or any other pending entry).
   - Does **not** list PA-000 sentinel.
3. Run `/ecosystem:pending-actions --status all`.
4. Verify PA-000 still excluded; dismissed/done entries also visible (if any).
5. Run `/ecosystem:pending-actions --source integrator`.
6. Verify only `Source: integrator` entries listed (which after S2 should include the scope-guard violation).
7. Run `/ecosystem:pending-actions --help` (if not recognized → unrecognized-flag help block).
8. Verify help text rendered.

### Expected
- Default view: only pending, no sentinel.
- Filters work (`--status all`, `--source integrator`).
- Help text shown on `--help` / unknown flag.

### Pass criteria
- Filter logic correct, sentinel excluded, empty state copy if no matches.

### Fail patterns
- PA-000 sentinel surfacing → parser bug.
- Source filter not matching → field-extraction bug.

---

## S4 — `/integrator:add` env_tier preview + prod-only warning

**Goal:** verify Stage 2 propose includes per-tier preview for the tool; if tool's `local_dev.suitability: none`, includes the warning (per SPEC §4.2.1 install integration).

### Setup
- Choose a tool whose profile would have `local_dev.suitability: none` if such a tool's profile exists. Otherwise, manually construct a tool-catalog entry with this constraint or pick a clearly cloud-only tool (e.g., Vercel Production Deploy if we have a profile for it).
- Alternative: re-run `/integrator:add cc-sdd@latest` in idempotent mode — even though cc-sdd is environment-agnostic, the propose should still surface the env block (either tiers or agnostic disclaimer).

### Steps
1. Run `/integrator:add <tool>@<version>`.
2. Stage 1 profile completes (subagent extracts environment_tiers OR environment_agnostic).
3. Observe Stage 2 propose section. Should include either:
   - Per-tier table (local_dev / staging / production × suitability + notes), OR
   - Explicit `environment_agnostic: true` line.
4. If tool has `local_dev.suitability: none`: warning «Этот tool не подходит для local dev — обсудить parallel/separate dev решение» visible BEFORE the approve gate.
5. Decline (`n`) at approve gate (we're not actually installing in this smoke).

### Expected
- Stage 2 propose has env section (tiers or agnostic).
- Prod-only tool warning visible.
- Cancellation recorded in journal `#tool-add-cancelled`.

### Pass criteria
- Profile always carries env block; propose always renders it; warning fires for `local_dev: none`.

### Fail patterns
- Stage 2 missing env block → tool-profiling skill bug.
- Warning suppressed for prod-only tool → SPEC §4.2.1 install integration not wired in `commands/integrator/add.md`.

---

## S5 — scope-guard dedup on repeated violation

**Goal:** verify the dedup mechanism prevents PA spam from cascade writes.

### Setup
- After S2 (one PA entry exists from scope-guard).
- Active Integrator session marker still fresh (or write a new one).

### Steps
1. Within the same minute, repeat the forbidden-path write (same file_path, same action) several times.
2. Inspect `.claude/pending-actions.md` — count entries since S2's first violation.
3. Wait > 1 minute. Repeat the same write once more.
4. Inspect `.claude/pending-actions.md` again — should now have one additional PA entry.

### Expected
- Multiple writes within same minute → single PA entry (dedup hit on the rest).
- Write in next minute → new PA entry (different `isoMinute` → different dedup key).
- `.claude/integrator/.scope-guard-dedup.json` cache has the corresponding keys.

### Pass criteria
- Dedup window = 1 minute as designed.
- Cache file rolls over correctly when N>100 keys (out of scope for v1.3.3 smoke — covered by static smoke).

### Fail patterns
- Every write logs a separate PA → dedup logic broken.
- No PA entries at all on repeat → cache becoming permanent (would need `.scope-guard-dedup.json` inspection to debug).

---

## Out of scope (smoke-test)

- Long-running marker (>1h stale TTL) end-to-end — covered by static smoke fixture `stale-marker-no-op`.
- Cross-session marker (marker created in session A, observed in session B) — solo-dev context; trust file persistence.
- Concurrent scope-guard writes from two parallel Integrator sessions — not realistic in solo-dev pilot; documented as v1 limitation in `skills/integrator/installation-protocol.md §10`.
- Bash regex sniffer edge cases (subshells, here-docs) — Edit/Write coverage is the reliable layer; Bash matcher is best-effort.

---

## Closure checklist

- [ ] All 5 scenarios PASS in pilot project.
- [ ] OR: failed scenarios documented as known issues in DEC-DEV-0047 Outcome.
- [ ] DEC-DEV-0047 Outcome + Lessons sections filled.
- [ ] `dev/PATCH_1.3.3_READINESS.md` banner → 🟢.
- [ ] CHANGELOG `[1.3.3]` section finalized.
- [ ] Release tag `v1.3.3` created.
- [ ] Memory entry refreshed (project status snapshot).

---

## After closure

- Archive plan: `mv dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md dev/_archive/patch-1.3.3/`.
- Archive readiness: `mv dev/PATCH_1.3.3_READINESS.md dev/_archive/patch-1.3.3/`.
- Consider phase-closure ritual per `dev/meta-improvement/checklists/phase-closure.md` for cross-cutting lessons.
