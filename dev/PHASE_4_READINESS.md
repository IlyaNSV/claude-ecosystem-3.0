# Phase 4 Readiness Checklist

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 4 (Handoff + NFR + Product DA + Validation full).
>
> **Status (2026-04-29):** Phase 3 smoke-tested + 1.1.1 patch shipped (DEC-DEV-0023). Section A blocker LIFTED. Pre-Phase-4 architectural items C.1-C.5 + new D.5 + A.3 still pending.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждый item имеет severity: 🔴 Blocker, 🟡 Important, 🔵 Nice-to-have.

---

## Status banner

✅ **Phase 3 implementation complete (DEC-DEV-0014, 2026-04-27).**
✅ **Phase 3 smoke test executed + 1.1.1 patch shipped (DEC-DEV-0023, 2026-04-29).**

Pending перед Phase 4 kick-off:
- [x] **Phase 3 real run smoke test** — executed 2026-04-29 на my-first-test (5.5h integrated pipeline run, 12 findings, 1.1.1 fixes shipped)
- [x] Smoke test findings reviewed; regressions fixed (4 hook bugs + 1 validation gap + 5 skill convention codifications + 1 schema deferral)
- [ ] Phase 4 architectural questions answered (Section C below)
- [ ] Phase 4 scope confirmed / discipline applied
- [ ] R2 user-driven follow-up: `/ecosystem:update` on my-first-test (verifies 1.1.1 fixes propagation)
- [ ] R4 user-driven follow-up: re-run smoke after fixes (validates F1-F5 in real workflow)

**Phase 3 gate fully closed. Phase 4 kick-off blocked only on architectural decisions C.1-C.5 + new D.5 + A.3.**

---

## A. Phase 3 smoke test outcome (🟢 RESOLVED — DEC-DEV-0023)

### A.1 Real run на my-first-test

Executed 2026-04-29: integrated pipeline run (bootstrap → Discovery → Planning → enrichment FM-001) вместо isolated scenarios. Functionally satisfies acceptance — entire P1.B + P2.A flow exercised end-to-end.

- [x] `/product:plan` flow ran к completion. Findings: 8 DEC-PLAN entries в test project journal; planning discipline OK.
- [x] `/product:feature FM-001` ran к completion (F.1-F.10). Findings: 23 BR + 7 SC + 7 IC + 7 VC + 3 LC + RPM produced; A1 auto-approve fired correctly for LC/VC/RPM.
- [x] BG candidate extraction — **failed silently**: bg-extractor.js TDZ bug (119 ReferenceError), 0 candidates extracted. Fix: F1 в DEC-DEV-0023.
- [x] `/product:cascade --pending` exercised — 396 entries (most false-positives). Fix: F2/F3 forward-driven + dedup в DEC-DEV-0023.
- [x] D2 overrides — not exercised в smoke (no override scenarios encountered); deferred к next pilot.
- [x] DA orchestration via hooks — fired 55 times correctly, findings collected inline в DEC-PLAN-006 (4 important, 5 discussion).

**Acceptance:** 4+ scenarios functionally exercised; 1.1.1 patch addresses regressions surfaced. Phase 3 ships → Phase 4 unblocked.

### A.2 Retroactive DEV_JOURNAL entry

- [x] **DEC-DEV-0023** — Phase 3 smoke test results populated (2026-04-29). Lessons + 12 findings + Path Z fix package + refinement table recorded.

### A.3 Pre-existing concerns from DEC-DEV-0013 B.1 (still pending)

- [ ] `skills/product/hypothesis-formulation.md` non-canonical fields (per DEC-DEV-0013 B.1 observation) — addressed або explicitly deferred? `success_threshold` vs spec `target_value`; missing `segment` / `value_proposition` в template.
- **Note:** не surfaced в DEC-DEV-0023 smoke test (existing HYPs from prior session — frontmatter не re-validated). Should address before Phase 4 kickoff OR explicit defer note.

---

## B. Phase 4 deliverables alignment (per ROADMAP)

Phase 4 ROADMAP scope (~10 файлов; **состав без изменений** post DEC-DEV-0023, но appear новые inputs/constraints):

**commands/product/:**
- [ ] `handoff.md` — D1 modes (draft/production), D2 overrides
- [ ] `validate.md` — on-demand full validation. **Inherit auto-purge pattern из artifact-validate.js (DEC-DEV-0023 F5).**
- [ ] `cleanup.md` — V-15 orphan detection (`--dry-run`). **Consider integration с `/product:cascade --pending --revalidate` (Q7) + validation-pending stale entries** — see D.5 ниже.
- [ ] `da-review.md` — manual F.9 trigger (Mode: full per refactored devils-advocate.md). **Output schema codified — use structured YAML `da_findings:` block per feature-session.md «Structured DA findings format» (DEC-DEV-0023 F8).**
- [ ] `clarify.md` — receiver questions channel
- [ ] `nfr-review.md` — F.5a Ask/Define. **Input source codified — consume existing `NOTE-NNN` artifacts с `promote_target: NFR` (Q4 NOTE creation guidance в feature-session.md).**
- [ ] `nfr-upgrade-tier.md` — batch review при tier change

**skills/product/:**
- [ ] `handoff-generator.md` — 13 sections, mode-aware DoR (D1), hash computation
- [ ] `nfr-review.md` — sanity ranges integration, guardrails. **Consume NOTE-NNN promote_target=NFR queue per Q4.**
- [ ] `product-da-review.md` — invokes business DA agent (Mode: full), handles findings. **Output structured per F8 schema.**
- [ ] `validation-runner.md` — tier-aware (B1), quiet-mode-aware (B2), 5 execution points. **Auto-purge pattern (F5) уже в artifact-validate.js — runner extends, не reinvent.**

**hooks/product/:**
- [ ] `product-handoff-gate.js` — PreToolUse блокировка без valid handoff (per SPEC §6.6). **MUST pass `verify-hooks.js` smoke before commit (phase-closure Step 3 + pre-commit gate per DEC-DEV-0023 F6/R3).**

### B.1 Hook quality gate (added DEC-DEV-0023)

Все новые Phase 4 hooks (currently planned: `product-handoff-gate.js`) должны:

1. Pass `node dev/meta-improvement/scripts/verify-hooks.js` (smoke runner) — exit 0 + no fatal stderr patterns.
2. Если pre-commit installed (`bash dev/meta-improvement/scripts/install-pre-commit.sh`) — autoatomatically блокирует commit если verify-hooks fails.
3. Phase-closure ritual Step 3 «Hook runtime smoke (≤5 min)» runs same verify after Phase 4 implementation completes.

Для adding new hook к `smoke-hooks.js` test cases array — see [smoke-hooks.js TEST_CASES](meta-improvement/scripts/smoke-hooks.js).

---

## C. Architectural questions for Phase 4 (🟡 Important)

### C.1 Handoff hash computation на CRLF

**Проблема:** V-H-04 SHA-256 hash drift detection; CRLF auto-conversion на Windows может cause false drift detection.

**Решение перед implementation:**
- [ ] Hash computation normalizes line endings (LF only)? Или hash includes CRLF?
- [ ] Test на Windows + Unix to verify consistent hash

### C.2 NFR sanity ranges enforcement strength

**Проблема:** NFR.md spec §5 includes sanity-check ranges per tier. F.5a workflow proposes defaults; user can override с rationale (sanity_check: overridden).

**Решение перед implementation:**
- [ ] Override workflow strict (require Product DA review per overridden NFR)? Или informational warning sufficient?
- [ ] Tier auto-detection — read RM.current_phase, или ask user explicitly per F.5a invocation?

### C.3 Manual /product:da-review Mode: full integration

**Проблема:** refactored devils-advocate.md supports Mode: full (always 6-lens). `/product:da-review` command (Phase 4) needs to construct brief properly.

**Resolution status (DEC-DEV-0023 F8):** Output schema known — `da_findings:` structured YAML block с `revisit_trigger` mandatory для accepted/deferred resolutions. Documented в [skills/product/feature-session.md](../skills/product/feature-session.md) «Structured DA findings format в decision journal».

**Решение перед implementation:**
- [ ] Brief format для manual mode — symmetric к hook-driven adaptive? Или specific Mode: full template?
- [ ] Output location — same `.product/.da-findings/` or separate (e.g., `.da-findings/manual/`)?

### C.4 Validation runner skill — 5 execution points

**Проблема:** validation.md §3 lists 5 execution points (inline / approve gate / handoff / on-demand / periodic). Phase 4 implements `/product:validate` for on-demand. Other points handled by hooks already.

**Решение перед implementation:**
- [ ] Validation runner skill consumes V-* rules from validation.md catalog programmatically? Или hardcode rule list?
- [ ] Reporting format — JSON + markdown (per validation.md §10.3 example)?

### C.5 Cleanup orphan detection — Phase 6 Design coupling + pending hygiene (extended DEC-DEV-0023)

**Проблема:** V-15 orphan detection includes MK/DS/NM (Phase 6 artifacts). Phase 4 `/product:cleanup` ships without these (Phase 6 conditional).

**DEC-DEV-0023 extension:** cleanup также должен handle stale entries в:
- `.product/.pending/cascade-pending.yaml` — auto-clear obsolete cascade entries (либо invoke `/product:cascade --pending --revalidate` underneath, либо own purge logic).
- `.product/.pending/validation-pending.yaml` — verify auto-purge applied (F5 pattern); flag inconsistencies.
- `.product/.pending/da-pending.yaml` — flag entries для already-active artifacts (DA processed).

**Решение перед implementation:**
- [ ] Phase 4 cleanup excludes MK/DS/NM check; Phase 6 extends? Or conditional flag в command?
- [ ] Cleanup invokes `/product:cascade --pending --revalidate` as sub-step? Или own purge?
- [ ] Cleanup pending hygiene = mandatory (default behavior) или opt-in (`--pending-hygiene` flag)?

### C.6 Bootstrap update mechanism architecture — ✅ RESOLVED (DEC-DEV-0020, 2026-04-28)

**Проблема (DEC-DEV-0019):** stock `/ecosystem:bootstrap` на existing pilot project имел 4 architectural issues — dev-only files contamination, cp -rn additive only, manifest.yaml preservation breaks hook auto-registration, re-install UX gap.

**Resolution: Path Y implemented upfront** (per user request «закрыть сейчас, не подмешивать в Phase 4»).

`/ecosystem:update` standalone command shipped (commit `<TBD>`):
- Allowlist-only sync (subdirs: commands/, skills/, agents/, hooks/, docs/, templates/, output-styles/; root files: README, BOOTSTRAP, CHANGELOG, ROADMAP, install.sh/.ps1, .env.template, gitignore.template)
- rsync-style sync (delete obsolete + copy fresh)
- Manifest.yaml overwrite + hooks section re-derivation в settings.json (preserve permissions section verbatim)
- Backup-by-default `.claude/` → `.claude-backup-<timestamp>/`
- Never-copy zone explicit (CLAUDE.md root, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md) — addresses Finding A contamination
- `--dry-run` flag для preview перед apply
- Bootstrap.md edited to recommend `/ecosystem:update` для re-install (closes Finding D UX gap; legacy (b) Merge marked DEPRECATED)

**Phase 4 кickoff status:** UNBLOCKED. Phase 4 deliverables (handoff.md, NFR commands, validation runner, etc.) reach existing pilots via `/ecosystem:update`. C.6 no longer blocker.

**Pending:** test execution на my-first-test (user-driven interactive session per DEC-DEV-0020 Step 5 instructions). After successful test, this item fully closed.

---

## D. Scope discipline для Phase 4 (🟡 Important — против over-engineering)

### D.1 Handoff modes (D1) — both modes ship?

ROADMAP says both `--mode draft` (3 blockers) и `--mode production` (8 blockers). Both must work for D1 modification to be complete.

- [ ] Both modes implemented + tested? Or production-only first, draft в minor follow-up?

### D.2 NFR Review — F.5a.0 Ask + F.5a.1 Define split

Per processes.md §3.2 F.5a — two phases:
- F.5a.0 Ask (mandatory)
- F.5a.1 Define (conditional on user choice [Y])

- [ ] Both phases ship Phase 4? Or Ask only first, Define через separate command?

### D.3 Product DA Review F.9 — separate /product:da-review command

Existing per-BR/per-IC DA happens automatically (Phase 3 hooks). F.9 = explicit FM-level pre-handoff review (Mode: full).

- [ ] F.9 manual trigger via `/product:da-review FM-<NNN>` command в Phase 4? Or auto-triggered before /product:handoff?

### D.4 Validation full — 33 V-* + 10 V-H-* + 8 V-MK-*?

Phase 4 `/product:validate --deep` ships «all V-*». Phase 6 handles V-MK-* (Design module conditional).

- [ ] Phase 4 ships V-* + V-H-*; V-MK-* skipped с graceful note?

### D.5 Cleanup integration с pending hygiene (added DEC-DEV-0023)

`/product:cleanup` (Phase 4) и `/product:cascade --pending --revalidate` (1.1.1, DEC-DEV-0023 Q7) overlap в hygiene domain. Decision needed:

- [ ] **Option A — single sweep:** `/product:cleanup` invokes cascade revalidate underneath + handles validation-pending purge + orphan detection в одном вызове. User runs cleanup periodically.
- [ ] **Option B — separate concerns:** `/product:cleanup` = orphan detection only; cascade hygiene остаётся в `/product:cascade --pending --revalidate`. User runs обе команды per discipline.
- [ ] **Option C — hybrid:** cleanup has `--pending-hygiene` flag; default = orphan-only (fast); flag enables full sweep.

Recommendation на момент 2026-04-29: **Option C** — flexibility без forced bundle. Choose explicitly в Phase 4 kickoff.

### D.6 v1.1+ deferrals — Phase 4 не constraint'нут (added DEC-DEV-0023)

Following items deferred к v1.1+; Phase 4 should NOT attempt to resolve:

- **BR.feature schema** (DEC-DEV-0023 Q2) — current scalar `feature: FM-NNN` works для Phase 4. v1.1 evaluates global/array/extends options (bring-forward trigger: second FM enrichment с shared rule reuse pain).
- **Reverse-driven cascade additional review rules** (e.g., BR change → LC.rules contains BR → V-06 review) — v1.2. Phase 4 cascade-check.js stays forward-driven only; manual `/product:cascade --pending --revalidate` остаётся workaround если user explicitly wants reverse cases.
- **Hook smoke runner extension** для new hooks — adds entry в `dev/meta-improvement/scripts/smoke-hooks.js` TEST_CASES array (low effort, do при adding hook).

---

## E. Pilot validation gate (🔴 Blocker — самый важный пункт)

### E.1 Real /product:plan + /product:feature на my-first-test

Per Phase 3.I plan — see Section A above.

### E.2 Decision: продолжать с Phase 4 как есть, или revise?

**После smoke test results:**
- [ ] If 4+ scenarios pass — proceed Phase 4 with checklist below
- [ ] If 3 or fewer pass — review findings, fix Phase 3 regressions, re-smoke before Phase 4
- [ ] If smoke test reveals architectural rethink needed — escalate; possibly Phase 4 scope changes

---

## F. Meta (🔵 Nice-to-have)

### F.1 Memory entries actualization

Update memory after Phase 3 + smoke test:
- [x] `project_ecosystem_status.md` — refreshed 2026-04-29 (DEC-DEV-0023 P3) reflects Phase 3 smoke-tested + 1.1.1 + Phase 4 unblocked
- [x] `feedback_methodology.md` — added pt 4 (hook smoke runner mandatory pre-commit per DEC-DEV-0023)
- [x] `MEMORY.md` — index refreshed
- [ ] `project_ecosystem_architecture.md` — add Phase 3 architectural patterns (A1 auto-approve, DA orchestration через stderr, cascade scope V-11 only forward-driven post DEC-DEV-0023, decision journal location, structured DA findings schema)

### F.2 CHANGELOG vs DEV_JOURNAL discipline (continued)

- [ ] Each significant Phase 4 fix/decision → DEV_JOURNAL entry (per CLAUDE.md guidelines)
- [ ] CHANGELOG updated only при release-worthy changes (e.g., 1.2.0 после Phase 4)

### F.3 Dogfood check

- [ ] Reconsider — should Ecosystem 3.0 itself have `.product/` setup? Phase 3 was huge; might benefit from explicit FM-* для commands/skills/hooks. Out-of-scope для Phase 4 work; flag для future consideration.

### F.4 v1.1 backlog priorities review

After 2-3 real Discoveries / Features:
- [ ] Atomic mass-rename — frequency check (5+ renames/month?)
- [ ] Deep mode subagents — Quick mode limits hit?
- [ ] Full BFS cascade auto-fix — pattern emerges from cascade-pending resolutions?
- [ ] Bundle approve UX — high enough volume для UX investment?

---

## G. Definition of Done для Phase 4

Phase 4 считается «done», когда:
- [ ] `/product:handoff FM-<NNN> --mode draft` → status: partial handoff for PoC (3 blockers)
- [ ] `/product:handoff FM-<NNN> --mode production` → all 8 blockers enforced
- [ ] SHA-hash drift detection works between `.product/` and handoff (CRLF safe)
- [ ] `/product:validate --deep` covers V-01..V-16 + V-H-01..V-H-10 (V-MK-* deferred Phase 6)
- [ ] `/product:da-review FM-<NNN>` invokes business DA с Mode: full
- [ ] DA findings recorded в `.product/.da-findings/`
- [ ] NFR F.5a.0 Ask + F.5a.1 Define split works; sanity ranges enforced
- [ ] `approve_overrides` (D2) works — temporary blocker pass с rationale
- [ ] **Phase 4 smoke test:** прогнать `/product:handoff` + `/product:da-review` + `/product:validate` на my-first-test FM-001 (если smoke test 3.I prerequisite met)
- [ ] DEV_JOURNAL обновлён with Phase 4 findings + key decisions
- [ ] CHANGELOG обновлён ([1.2.0] или similar)

---

## Совет: как использовать этот checklist

1. **Сначала Section A** (Phase 3 smoke test). Без results — Phase 4 не unblocked.
2. **Потом Section C** (architectural questions) — каждый пункт = решение, которое нужно принять и записать в DEV_JOURNAL DEC-DEV-NNNN.
3. **Потом Section D** (scope discipline) — отрезать всё, что не must-have для Phase 4 done.
4. **Section E.2** — explicit decision based on smoke test outcome.
5. **B и F** — параллельно, по мере необходимости.

**Когда всё ☑ → начинать Phase 4 implementation.**

**Если в процессе Phase 4 вскроется что-то, что должно было быть здесь** — добавь сюда сейчас (для Phase 5 readiness) + запиши в DEV_JOURNAL.
