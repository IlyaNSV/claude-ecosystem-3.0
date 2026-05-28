# Phase 6 Smoke Test Plan — placeholder

> **Назначение:** runtime smoke test scenarios для Phase 6 (Design Module v1.0), которые исполняются после implementation на real UI FM в pilot project.
>
> **Статус:** 🟡 **placeholder** — scenarios scoped на kickoff (DEC-DEV-0052, 2026-05-27) + S7 added Follow-up 2 (update-compat gap surfaced 2026-05-27 inline review); runtime execution при post-1.4.0 release pilot session.
>
> **Принцип:** smoke test plan создаётся сейчас (kickoff phase) для substrate continuity — когда trigger fires, fresh-session implementation kickoff inherits эти scenarios и refines per actual FM context.

---

## Pre-requisite state (когда trigger fires)

- [ ] Real UI FM создана в pilot project с `has_ui=true`
- [ ] Связанные SC, BR, LC, BG, RPM в active per Product Module workflow
- [ ] `.claude/design.yaml` сгенерирован при первом `/design:start` (per SPEC §8.2)
- [ ] Stitch MCP установлен (через `/integrator:add stitch-mcp`) ИЛИ explicit fallback к HTML

---

## Scenarios

### S1 — Design Brief generation + 🟡 review approve gate

**Setup:** real UI FM с активными SC; `/design:start FM-NNN`.

**Steps:**
1. Run `/design:start FM-NNN`
2. Observe D.1 brief generation
3. Verify brief saved к `.product/.design-sessions/<FM-id>-brief.md`
4. Verify 🟡 review approve gate fires — silence ≠ continue (gate text должен быть explicit choice)
5. Approve brief → flow moves to D.2

**Pass criteria:**
- Brief файл существует с required sections (feature context, screens list, roles, BR/LC context)
- Approve gate UX: explicit STOP с numbered choices (per DEC-DEV-0047 §7.6 pattern)
- After approve — session state updated к `current_step: D.2`

---

### S2 — Full P2.5 D.1-D.6 end-to-end

**Setup:** S1 completed; Stitch MCP active.

**Steps:**
1. D.2 first iteration → screens generated (count matches Screen Inventory draft)
2. 🟠 strategic approve gate fires (single decision: «направление правильное?»)
3. D.3 iterative refinement (≥1 iteration)
4. D.4 Component State Matrix — `component-states.md` skill runs checklist
5. D.5 Artifact Generation — MK/DS/NM files created
6. D.6 Export ready for handoff

**Pass criteria:**
- MK-NNN, DS, NM-NNN exist в `.product/mockups/` (NM) + `.product/design-system.md` (DS)
- Frontmatter complete (id, type, feature, design_tool, scenarios, confidence per artifact schema)
- V-MK-01..08 pass (V-MK-02 partial mechanical — per DEC-DEV-0052 Q3)
- Cross-refs validated: SC ↔ MK Screen Inventory steps, BR ↔ MK error states (manual via V-MK-03)
- `previous_tools[]` empty (no prior switch)

---

### S3 — Stitch unavailable → HTML fallback auto-trigger

**Setup:** S1 completed; Stitch MCP simulated unavailable (network error / quota exhausted).

**Steps:**
1. `/design:start FM-NNN` (или `--continue` после S1)
2. D.2 attempts Stitch MCP call → fails
3. Fallback chain triggers per `mcp_preferences.fallback_chain` (Stitch → claude-design fallback OR html-artifact)
4. Since claude-design v1.0 = stub (per C1) → degradation к HTML fallback
5. Session continues с HTML output

**Pass criteria:**
- Warning surfaces «Stitch unavailable, switching to <next-fallback>»
- HTML page generated single-page (per Q4/C4 — no React, no multi-screen в v1.0)
- MK ships с `design_tool: html`; `previous_tools[]` empty (no prior switch)
- PA entry appended (per Q9 trigger #1): «obtain Stitch MCP key OR confirm html-fallback mode»

---

### S4 — `/design:migrate MK-NNN --to html` from active Stitch MK

**Setup:** S2 completed (MK-NNN active с `design_tool: stitch`).

**Steps:**
1. Run `/design:migrate MK-NNN --to html`
2. Hard approve gate fires (per Q1): «STOP. Lossy regeneration via brief — visual tweaks потеряются. Approve migration для MK-NNN? [Y/N/defer]»
3. Approve → `previous_tools[]` entry written first (per A8) с {tool: stitch, url, switched_at, reason, iterations_at_switch}
4. Regen via brief + MK metadata + DS snapshot в HTML mode
5. MK frontmatter updated: `design_tool: html`, `tool_project_url: <new>`, `tool_switched_at: <now>`

**Pass criteria:**
- `previous_tools[]` audit trail correct
- Если regen fails — rollback (delete last `previous_tools[]` element), `design_tool` stays old (per A8)
- Idempotency: повторный `/design:migrate MK-NNN --to html` без approve gate-pass = no-op
- Reject `/design:migrate MK-NNN --to claude-design` с message «Claude Design migration: v1.1+ (см. v1_1_backlog.md)» (per Q6/C3)

---

### S5 — `/design:export FM-NNN` → handoff §10 UI Specification

**Setup:** S2 completed (MK/DS/NM в active for FM-NNN).

**Steps:**
1. Run `/design:export FM-NNN`
2. Assistant assembles MK full content + DS snapshot (only relevant subset) + NM full content
3. Output block ready для embed в handoff §10 UI Specification
4. Subsequent `/product:handoff` consumes correctly

**Pass criteria:**
- Export output format matches handoff-spec §10 (см. `docs/product-module/handoff-spec.md`)
- DS subset = только tokens/components used в exported MK (not full DS)
- NM full content embeddable
- **Q10 carry-forward decided:** либо `/product:handoff` invokes `/design:export` automatically, либо documented «handoff §10 ассистент заполняет из MK/DS/NM без separate command call» (см. PHASE_6_READINESS Section H)

---

### S7 — `/ecosystem:update` compatibility post 1.4.0

**Trigger:** added Follow-up 2 (DEC-DEV-0052, 2026-05-27). Verifies что Phase 6 deliverables не collide с `/ecosystem:update` Step 5 namespace-aware sync (1.3.5) + Step 6 hooks pattern-preserving merge (1.3.4).

**Setup:** S1+S2 completed (pilot has shipped MK/DS/NM + `.claude/design.yaml` configured + design hooks registered + at least one third-party hook entry like `bd setup claude` для preservation test). Simulate small ecosystem upgrade (e.g. 1.4.0.1 patch с design skill text refresh) by pointing pilot's `ECOSYSTEM_ROOT` к updated repo OR manually checkout newer ref.

**Capture before-state:**
1. `.claude/design.yaml` content (or sha256)
2. `.product/mockups/*` file list + checksums
3. `.product/design-system.md` checksum
4. `.product/.design-sessions/*` file list
5. `.claude/settings.local.json` content (especially hooks array)
6. `.claude/skills/kiro-*/` and любые third-party namespaces в managed parent dirs (for preservation test)

**Steps:**
1. Run `/ecosystem:update` end-to-end (accept approve gates)
2. Verify after-state против capture

**Pass criteria:**
- ✅ `.claude/design.yaml` content **identical** (user preferences preserved; treated as per-project config like `settings.local.json`)
- ✅ `.product/mockups/*`, `.product/design-system.md`, `.product/.design-sessions/*` **untouched** (scope-guard `.product/` invariant)
- ✅ `.claude/{commands,skills,hooks,agents}/design/` updated from new ecosystem state (namespace-aware sync managed namespaces)
- ✅ `.claude/skills/kiro-*` and любые third-party namespaces in design's parent dirs **preserved** (namespace-aware sync 1.3.5)
- ✅ `.claude/settings.local.json` design hook entries (matching `^node \.claude/hooks/design/`) re-derived from new manifest; third-party hook entries (e.g. `bd setup claude` SessionStart/PreCompact) **preserved** (pattern-preserving merge Step 6 1.3.4)
- ✅ `_external/` backup directory создаётся с design-relevant external paths если они listed в `active-tools.yaml` (Phase 6 v1.0 likely none unless Stitch session-state external)
- ✅ Pre-update backup (Step 2) catches current state; rollback two-phase works если запустить
- ❌ ANY of: `.claude/design.yaml` overwritten к template defaults; `.product/mockups/*` deleted; `kiro-*` skills wiped; design hook registration lost OR third-party hook entries lost — FAIL → blocking issue для 1.4.0 release

**Edge cases to verify:**
- E1: User had `.claude/design.yaml` с non-default `default_design_tool: html` (preserved через update; не reverted к `stitch` default)
- E2: pre-existing MK with `previous_tools[]` migration history (post-`/design:migrate`) — frontmatter не corrupted
- E3: bootstrap re-run (`/ecosystem:bootstrap` again) on already-installed pilot — `.claude/design.yaml` not overwritten if user edited it; idempotent

**v1.0 status:** required для post-1.4.0 release validation. Если FAIL surface'ится — gating issue, hot-patch 1.4.0.1 needed перед широким usage.

---

### S6 (deferred) — Claude Design path full pilot

**Trigger:** C1 unlock (когда `claude-design-workflow.md` full skill ships в v1.1+).

**Scope (для v1.1+ smoke plan):**
- Manual export workflow validated (paste brief → claude.ai/design → export ZIP к `.product/.design-sessions/<MK-id>-export/`)
- DS export к brand-package для Claude Design import
- `/design:migrate MK-NNN --to claude-design` end-to-end
- `previous_tools[]` audit включает claude-design transitions
- Native «Handoff to Claude Code» bundle linked в Ecosystem handoff §10

**v1.0 status:** N/A. Tracker — `dev/v1_1_backlog.md` (Design Module — `claude-design-workflow.md` full skill entry).

---

## Execution protocol

Per `dev/meta-improvement/CONVENTIONS.md` §5.1 и DEC-DEV-0023 hook smoke runner pattern:

1. Static smoke (sub-phase H в Phase 6 implementation): fixture-based hook contract test
2. Runtime smoke (these scenarios): real pilot session in `my-first-test` OR другой active pilot с real UI FM
3. Findings logged в `dev/_archive/phase-6/smoke-evidence/` per Phase 5 precedent (DEC-DEV-0044)
4. Closure entry в DEV_JOURNAL после runtime smoke pass — typically same entry as Phase 6 implementation closure (sub-phase I)

---

## References

- `dev/PHASE_6_READINESS.md` — readiness gate (banner 🟡 architectural ready, implementation trigger pending)
- DEV_JOURNAL.md DEC-DEV-0052 — kickoff decisions (12 Qs + 13 ambiguities + 5 cuts)
- DEV_JOURNAL.md DEC-DEV-0048 — pre-Phase-6 architectural addendum (SPEC v1.1)
- `docs/design-module/SPEC.md` v1.1 — module specification
- `dev/meta-improvement/CONVENTIONS.md` — D7 smoke test conventions
- `dev/_archive/phase-5/PHASE_5_SMOKE_TEST_PLAN.md` (archived) — structural template
