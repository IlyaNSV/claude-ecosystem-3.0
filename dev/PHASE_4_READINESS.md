# Phase 4 Readiness Checklist

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 4 (Handoff + NFR + Product DA + Validation full).
>
> **Status (2026-04-27):** placeholder. Populated incrementally as Phase 3 smoke test completes + Phase 4 architectural questions surface.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждый item имеет severity: 🔴 Blocker, 🟡 Important, 🔵 Nice-to-have.

---

## Status banner

⏳ **Phase 3 implementation complete (DEC-DEV-0014, 2026-04-27).**

Pending перед Phase 4 kick-off:
- [ ] **Phase 3 real run smoke test** (per `dev/PHASE_3_SMOKE_TEST_PLAN.md`) — required before Phase 4
- [ ] Smoke test findings reviewed; regressions fixed if any
- [ ] Phase 4 architectural questions answered (Section C below)
- [ ] Phase 4 scope confirmed / discipline applied

**Once smoke test passes без regressions, can proceed к Phase 4 kick-off.**

---

## A. Phase 3 smoke test outcome (🔴 Blocker)

### A.1 Real run на my-first-test

- [ ] Test scenario 1 (`/product:plan`) ran к completion. Findings: <TBD>
- [ ] Test scenario 2 (`/product:feature FM-001`) ran к completion. Findings: <TBD>
- [ ] Test scenario 3 (`/product:bg-review`) ran. Findings: <TBD>
- [ ] Test scenario 4 (`/product:cascade --pending`) ran. Findings: <TBD>
- [ ] Test scenario 5 (D2 overrides) verified. Findings: <TBD>

**Per smoke test plan acceptance:** 4+ scenarios pass → Phase 3 ships → Phase 4 unblocked.

### A.2 Retroactive DEV_JOURNAL entry

- [ ] DEC-DEV-NNNN — Phase 3 smoke test results populated. Lessons + findings recorded.

### A.3 Pre-existing concerns from DEC-DEV-0013 B.1

- [ ] `skills/product/hypothesis-formulation.md` non-canonical fields (per DEC-DEV-0013 B.1 observation) — addressed або explicitly deferred? `success_threshold` vs spec `target_value`; missing `segment` / `value_proposition` в template.

---

## B. Phase 4 deliverables alignment (per ROADMAP)

Phase 4 ROADMAP scope (~10 файлов):

**commands/product/:**
- [ ] `handoff.md` — D1 modes (draft/production), D2 overrides
- [ ] `validate.md` — on-demand full validation
- [ ] `cleanup.md` — V-15 orphan detection (`--dry-run`)
- [ ] `da-review.md` — manual F.9 trigger (Mode: full per refactored devils-advocate.md)
- [ ] `clarify.md` — receiver questions channel
- [ ] `nfr-review.md` — F.5a Ask/Define
- [ ] `nfr-upgrade-tier.md` — batch review при tier change

**skills/product/:**
- [ ] `handoff-generator.md` — 13 sections, mode-aware DoR (D1), hash computation
- [ ] `nfr-review.md` — sanity ranges integration, guardrails
- [ ] `product-da-review.md` — invokes business DA agent (Mode: full), handles findings
- [ ] `validation-runner.md` — tier-aware (B1), quiet-mode-aware (B2), 5 execution points

**hooks/product/:**
- [ ] `product-handoff-gate.js` — PreToolUse блокировка без valid handoff (per SPEC §6.6)

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

**Решение перед implementation:**
- [ ] Brief format для manual mode — symmetric к hook-driven adaptive? Или specific Mode: full template?
- [ ] Output location — same `.product/.da-findings/` or separate (e.g., `.da-findings/manual/`)?

### C.4 Validation runner skill — 5 execution points

**Проблема:** validation.md §3 lists 5 execution points (inline / approve gate / handoff / on-demand / periodic). Phase 4 implements `/product:validate` for on-demand. Other points handled by hooks already.

**Решение перед implementation:**
- [ ] Validation runner skill consumes V-* rules from validation.md catalog programmatically? Или hardcode rule list?
- [ ] Reporting format — JSON + markdown (per validation.md §10.3 example)?

### C.5 Cleanup orphan detection — Phase 6 Design coupling

**Проблема:** V-15 orphan detection includes MK/DS/NM (Phase 6 artifacts). Phase 4 `/product:cleanup` ships without these (Phase 6 conditional).

**Решение перед implementation:**
- [ ] Phase 4 cleanup excludes MK/DS/NM check; Phase 6 extends? Or conditional flag в command?

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
- [ ] `project_ecosystem_status.md` — reflect Phase 3 complete + Phase 4 next
- [ ] `project_ecosystem_architecture.md` — add Phase 3 architectural patterns (A1 auto-approve, DA orchestration через stderr, cascade scope V-11 only, decision journal location)

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
