# Чек-лист готовности к Phase 7

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 7 (Integrator maintenance — verify/debug/docs; full drift-detection algorithm).
>
> **Статус (на момент refresh):** 🟡 **skeleton** — created post-Phase-6 (DEC-DEV-0053, 2026-05-28). Substantive content populated на kickoff session per D7 ritual.
>
> **Принцип:** kickoff fresh-session preferred (per DEC-DEV-0040 / DEC-DEV-0052 precedent); inline kickoff допустим если scope simple. Phase 5/6 lesson: ~6-8x ROI multiplier для front-loaded design discipline.

---

## Status banner

🟢 **READY — kickoff executed inline 2026-07-11 (DEC-DEV-0176).** SSOT решений/cuts/плана — запись DEC-DEV-0176 в DEV_JOURNAL (10 решений, 6 ambiguity-резолюций, 6 cuts, sub-phases A-G). Ниже — только дельты к skeleton; проза решений здесь НЕ дублируется (pointer-collapse).

Kickoff-итог (сводка):
- **Committed:** `commands/integrator/{verify,debug,docs}.md` + `hooks/integrator/drift-check.js` (SessionStart, detect-only, warn-only) + либа `hooks/integrator/lib/drift-checks.cjs` (D1/D2/D3 по local-only модели DEC-DEV-0045) + wiring (overlay ×3, manifest, `tests/integrator/`, каталог/карта regen).
- **CUT → v1.1+:** `/integrator:replace` (trigger: 2-й D2-Tech инструмент) · `contract-validate.js` (trigger: живой битый контракт мимо drift-check/verify) · `verify --light`/periodic · profile-drift + cross-tool drift · `debug-protocol` skill (инлайн в debug.md) · рефактор update.md на либу.
- **Уже построено соседними фазами (НЕ deliverables Phase 7):** скиллы `drift-detection.md` + `tool-docs-generator.md` (Phase 5), механика D1/D2/D3 (update.md Stage 3, DEC-DEV-0045), UX-транскрипт debug (SPEC §7.3).
- G14 → закрывается на 3/4 (replace аннотирован честно); G15 → закрывается (debug = точка входа confidence-downgrade); G16 → частично (drift-check да, contract-validate cut).

Prerequisite chain status:
- ✅ Phase 5 implementation + runtime smoke + closure (DEC-DEV-0041/0044/0045) — 1.3.0/1.3.1/1.3.2
- ✅ Patches 1.3.3-1.3.5 (DEC-DEV-0047/0049/0051) + closure ritual (DEC-DEV-0050)
- ✅ Phase 6 — Design Module v1.0 (DEC-DEV-0053, 2026-05-28) — 1.4.0 release
- ⏸ Phase 7 — kickoff pending

Open prerequisite work blocks (non-blocking для kickoff itself, но context inputs):
- ⏳ Runtime smoke S1-S5 Patch 1.3.3 (`dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md`) — deferred к next pilot session
- ⏳ Runtime smoke S1-S7 Phase 6 (`dev/gates/PHASE_6_SMOKE_TEST_PLAN.md`) — deferred к next pilot session
- Both runtime smokes могут surface Phase 7 findings (e.g., scope-guard interactions с design Module activation; design hook quiet-draft mode edge cases)

---

## A. Pre-Phase-7 prerequisites

Перед стартом Phase 7 implementation:

**Phase 6 chain (closed):**
- [x] Phase 6 implementation closure (DEC-DEV-0053, 2026-05-28) — 1.4.0 release
- [x] Phase 6 implementation static smoke 19/19 PASS (sub-phase H)
- [ ] Phase 6 runtime smoke S1-S7 (`dev/gates/PHASE_6_SMOKE_TEST_PLAN.md`) — deferred; **non-blocking для Phase 7 kickoff** (orthogonal scope)
- [x] Phase 6 plan archived `dev/_archive/phase-6/`; closure findings addressed or explicitly deferred

**Patch 1.3.x chain (closed):**
- [x] Patches 1.3.3-1.3.5 (DEC-DEV-0047/0049/0051) — spec shipped
- [ ] Patch 1.3.3 runtime smoke S1-S5 deferred — non-blocking
- [x] Closure ritual (DEC-DEV-0050) executed

**This file:**
- [x] `dev/gates/PHASE_7_READINESS.md` skeleton created (this commit)
- [ ] Phase 7 architectural kickoff session — to be scheduled

### A.1 Ready-to-kickoff assessment

| Item | State | Blocking? |
|---|---|---|
| Phase 6 closure done | ✅ DEC-DEV-0053 (2026-05-28) | no |
| Phase 6 runtime smoke | ⏳ deferred — orthogonal scope | no |
| Patch 1.3.x runtime smoke | ⏳ deferred — orthogonal scope | no |
| Phase 7 architectural questions enumerated | ✅ DEC-DEV-0176 (10 решений + 6 ambiguity) | no |
| Phase 7 scope cuts identified | ✅ DEC-DEV-0176 (6 cuts, >50% поверхности) | no |

**Conclusion:** все prerequisites закрыты; kickoff выполнен inline 2026-07-11 → implementation по sub-phases A-G (DEC-DEV-0176 Plan).

---

## B. Phase 7 expected scope (per ROADMAP — provisional до kickoff)

Provisional from ROADMAP «Phase 7 — Integrator maintenance»:

- **Verify command** — `/integrator:verify` health check (currently absent; partial in `/ecosystem:verify` which covers ecosystem-wide install integrity)
- **Debug command** — `/integrator:debug <tool-name>` — surface tool-specific state, MCP connectivity, contract validity, drift presence
- **Docs command** — `/integrator:docs <tool>` — quick reference (Cabin reference adapter spec, version notes, profile excerpt)
- **Full drift-detection algorithm** — currently local-only model (DEC-DEV-0045 Phase 5.1) handles pilot reference vs pilot instance comparison. Full algorithm includes:
  - Adapter version detection (semantic version от source ecosystem repo)
  - Profile drift (active-tools.yaml vs current `/integrator:research` re-run)
  - Cross-tool dependency drift (e.g., target tool API changed since adapter generated)
- **`product-devils-advocate` registration gap finalization** (Phase 4 DEC-DEV-0038 R7 follow-up) — if subagent ecosystem stabilizes по итогам Phase 5+

Potential additional scope (TBD at kickoff):
- Integrator hard-block scope-guard escalation (v1_1_backlog «Integrator hard-block scope-guard») — if Phase 6 pilot evidence shows warn-only insufficient
- `/integrator:upgrade <tool>` — single-tool version upgrade (vs full `/ecosystem:update`)
- Multi-tool zones (e.g., `kiro` + `beads` coexistence verification beyond passive preservation)

(Заполняется на kickoff per `dev/meta-improvement/checklists/phase-kickoff.md` Section 1.)

---

## C. Архитектурные вопросы Phase 7 (заполняются на kickoff)

(Skeleton — kickoff populates per phase-kickoff.md checklist Section 1.)

Expected questions to surface:
- Verify vs `/ecosystem:verify` boundary — split semantics or extend existing?
- Debug command scope — interactive REPL OR one-shot diagnostic dump?
- Drift detection: full re-research OR delta-only (compare `active-tools.yaml` snapshot)?
- Cross-cutting: Phase 7 hooks needed? (e.g., post-`/integrator:add` health probe?)
- Backward compat: adapter version migration story (e.g., adapter generated с v1.3.0 spec, current 1.5.0 — migrate or refuse)

---

## D. Дисциплина scope для Phase 7 — TBD на kickoff

Cuttable scope default (CLAUDE.md §4). Aggressive cuts per Phase 5/6 lesson — preserve >50% scope для v1.1+ if evidence отсутствует.

(Заполняется на kickoff. Per Phase 6 precedent: 5/12 deliverable surfaces cut к v1.1+.)

---

## E. Гейт пилотной валидации (после Phase 7)

Provisional acceptance criteria:
- [ ] `/integrator:verify` (или равивалент) — works на real pilot project
- [ ] `/integrator:debug <tool>` — surfaces actionable diagnostic
- [ ] Full drift-detection — detects real drift case (manual trigger OR scheduled)
- [ ] Runtime smoke в pilot session (analog `PHASE_6_SMOKE_TEST_PLAN.md`)

---

## F. Зависимости от Phase 5+6 outcomes

**Phase 5 runway** (still applicable per DEC-DEV-0041/0044/0045):
- Integrator generic add-flow готов
- Tri-location adapter pattern validated
- Local-only drift detection model
- Subagent structural template (`tool-profiler` → `contract-designer`)

**Phase 6 runway** (DEC-DEV-0053):
- Design Module v1.0 shipped — Phase 7 maintenance scope не includes Design specifics (separate module)
- However: design-artifact-validate.js + manifest pattern может inform any new Integrator hooks
- Hard approve gate UX pattern (DEC-DEV-0047 §7.6) reusable

**Patch 1.3.3-1.3.5 runway:**
- `environment_tiers` schema (SPEC §4.2.1) — Phase 7 verify may include tier completeness check
- PA journal (`.claude/pending-actions.md`) — Phase 7 surface design — should reuse скилл `user-action-tracker.md`
- scope-guard PreToolUse hook (marker-gated) — pattern reusable
- Namespace-aware sync (`/ecosystem:update` Step 5) — Phase 7 verify должен respect namespace boundaries

---

## G. Definition of Done для Phase 7

Phase 7 done when (provisional — refined на kickoff):
- [ ] Verify / debug / docs commands work end-to-end
- [ ] Full drift-detection algorithm operational
- [ ] Hook smoke 100% PASS (analog Phase 6 sub-phase H pattern)
- [ ] Pilot тест на real Integrator-installed project (drift surfaced + resolved)
- [ ] DEV_JOURNAL closure entry
- [ ] CHANGELOG `[1.5.0]` or аналог
- [ ] Phase 7 closure ritual (Unit 2 D7)
- [ ] `dev/PHASE_8_READINESS.md` skeleton (если applicable) — OR Orchestrator Module concept skeleton (если ROADMAP suggests)

---

## H. Lessons inherited (post Phase 5-6 + patches closure)

Updated при kickoff. Pre-population of known carryforwards:

- **DEC-DEV-0053 Lesson 1** — JSDoc comment regex literal trap (`*/g` closes comment); apply: manual `node --check` для hook files containing regex prose
- **DEC-DEV-0053 Lesson 2** — Front-loaded design discipline ROI (~6-8x); apply: full architectural kickoff session для Phase 7 even if scope appears small
- **DEC-DEV-0053 Lesson 3** — Sub-phase commit cadence; apply: per-substantial-deliverable commits
- **DEC-DEV-0053 Lesson 4** — Cross-cutting integration enumeration (Lesson 7 from DEC-DEV-0052); apply: enumerate cross-cutting commands that touch new Phase 7 artifacts
- **DEC-DEV-0053 Lesson 5** — Aggressive cut discipline; apply: 5/12+ cut ratio precedent
- **DEC-DEV-0053 Lesson 6** — «Carry-forward» вопросы = explicit license для refinement during implementation
- **DEC-DEV-0053 Lesson 7** — Kickoff estimate accuracy с aggressive cuts; pre-cut estimates ×1.5-2 multiplier

---

## I. Implementation kickoff invocation prompt

> Skeleton. Populated при kickoff session per `dev/meta-improvement/checklists/phase-kickoff.md`.
