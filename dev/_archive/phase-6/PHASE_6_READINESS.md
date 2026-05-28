# Чек-лист готовности к Phase 6

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 6 (Design Module — **conditional**, активируется на первой FM с `has_ui=true`).
>
> **Статус (на момент refresh):** 🟡 architectural kickoff complete (DEC-DEV-0052, 2026-05-27); implementation trigger pending real UI FM в pilot. Skeleton изначально создан в Phase 5 sub-phase J; refresh'ы: Phase 5 closure (DEC-DEV-0044/0045), patches 1.3.3/1.3.4/1.3.5 (DEC-DEV-0047/0049/0051), DEC-DEV-0050 closure ritual, DEC-DEV-0048 architectural addendum, **DEC-DEV-0052 kickoff (12 Qs + 13 ambiguities + 5 cuts)**.
>
> **Принцип:** Phase 6 — **conditional**. Не запускается «потому что следующая по номеру», а только когда pilot project дойдёт до feature с UI. Может быть отложена бессрочно если first 2-3 FMs — backend-only.

---

## Status banner

🟡 **Architectural kickoff complete — implementation pending start** (DEC-DEV-0052, 2026-05-27; trigger fired empirically — pilot `my-first-test` has 6 FMs с has_ui=true awaiting design).

Prerequisite chain complete:
- ✅ Phase 5 implementation + runtime smoke + closure (DEC-DEV-0041/0044/0045)
- ✅ Patches 1.3.3/1.3.4/1.3.5 (DEC-DEV-0047/0049/0051) + closure ritual (DEC-DEV-0050)
- ✅ Pre-Phase-6 architectural addendum (DEC-DEV-0048) — Claude Design co-primary + IR groundwork; SPEC v1.1
- ✅ **Phase 6 kickoff (DEC-DEV-0052)** — 12 Qs resolved + 13 ambiguities + 5 scope cuts approved; sub-phase A→I готов

Trigger conditions met (verified empirically 2026-05-27 inline-session — DEC-DEV-0052 Follow-up): pilot `my-first-test/.product/features/` содержит 6 FMs (FM-001..FM-006), **все** с has_ui=true; FM-003 frontmatter context explicit: «has_ui=true (CRUD-интерфейс; **mockups deferred к Phase 6**)» — pilot уже формально awaits Phase 6 deliverables. **Sandbox path остался отвергнут** — теперь по simpler reason: real FMs available, sandbox излишен. Estimated effort post-cuts: **8-12h focused work** (A→H core) + ~1h closure overhead (I). **Phase D Wiki initiative DEFERRED** (DEC-DEV-0046) — не блокирует.

---

## A. Pre-Phase-6 prerequisites

> **Sequence updated 2026-05-27:** Phase D Wiki initiative (между Phase 5 closure и Phase 6) **DEFERRED** к v1.1+ per DEC-DEV-0046 (phantom-audience guard). Phase 6 trigger evaluation теперь идёт сразу после Phase 5 (+ patches) closure, без Phase D gate. Phase D plan/design preserved with DEFERRED banners; bring-forward triggers в `dev/v1_1_backlog.md`.

Перед стартом Phase 6 implementation:

**Phase 5 chain (closed):**
- [x] Phase 5 implementation closure (DEC-DEV-0041, 2026-05-25) — 1.3.0 release
- [x] Phase 5 runtime smoke (4 PASS clean, S5 deferred — DEC-DEV-0044, 2026-05-26)
- [x] Phase 5.1 patch (DEC-DEV-0045) — bug 4 + tri-location pattern adoption — 1.3.2 release
- [x] Phase 5 plan archived `dev/_archive/phase-5/`; closure findings addressed or explicitly deferred

**Patch 1.3.x chain (closed):**
- [x] Patch 1.3.3 (DEC-DEV-0047) — Integrator scope discipline + env tiers + PA journal — 1.3.3 release; runtime smoke S1-S5 deferred (next pilot session, не блокирует Phase 6)
- [x] Patch 1.3.3 closure ritual (DEC-DEV-0050) — D7 phase-closure executed fresh-session; 7 findings (1 major fixed inline, 4 deferred cosmetic)
- [x] Patch 1.3.4 (DEC-DEV-0049) — `/ecosystem:update` Step 6 merge-preserve fix
- [x] Local docs polish (DEC-DEV-0046) — Obsidian baseline + cross-link polish, bundled в 1.3.3

**This file:**
- [x] `dev/PHASE_6_READINESS.md` refreshed против DEC-DEV-0048 + post-closure baseline (2026-05-27)
- [x] **Pre-Phase-6 architectural addendum** (DEC-DEV-0048, 2026-05-27) — Claude Design co-primary + IR groundwork decided ahead of Phase 6 kickoff; SPEC v1.1 + MK frontmatter migration trail shipped
- [x] **Phase 6 kickoff** (DEC-DEV-0052, 2026-05-27) — 12 architectural Qs resolved + 13 ambiguities + 5 scope cuts approved; sandbox path rejected

### A.1 Ready-to-kickoff assessment

| Item | State | Blocking? |
|---|---|---|
| Phase 5 closure done | ✅ DEC-DEV-0044/0045 | no |
| Patches 1.3.3 + 1.3.4 + 1.3.5 spec landed | ✅ DEC-DEV-0047/0049/0051 | no |
| Pre-Phase-6 architectural decisions resolved | ✅ DEC-DEV-0048 | no |
| **Phase 6 kickoff (12 Qs + 13 ambiguities + 5 cuts)** | ✅ DEC-DEV-0052 | no |
| Phase D (Wiki) gate | ⏸ DEFERRED — не блокирует | no |
| **First FM with `has_ui=true` в pilot** | ✅ FM-001..FM-006 all have has_ui=true; FM-003 explicit «mockups deferred к Phase 6» (verified 2026-05-27) | no |
| Sandbox FM-DESIGN-001 path | ❌ rejected — real FMs available, sandbox излишен | no |
| Runtime smoke S1-S5 1.3.3 в pilot | ⏳ deferred — не блокирует Phase 6 kickoff (orthogonal scope) | no |
| Phase 5 S5 runtime smoke (drift detection) | ⏳ deferred — не блокирует | no |

**Conclusion:** все architectural, spec, и trigger prerequisites закрыты (DEC-DEV-0052 + Follow-up). Phase 6 implementation **ready to start** — sub-phase A per Section F.1; fresh-session implementation prompt в Section I.

---

## B. Phase 6 trigger evaluation

Phase 6 activation conditions — all met as of 2026-05-27 (DEC-DEV-0052 Follow-up, empirical verification):
- [x] At least one FM in pilot project has `has_ui=true` — **confirmed**: `my-first-test/.product/features/` has 6 FMs (FM-001..FM-006), all has_ui=true
- [x] User intends to design UI mockups — **confirmed**: FM-003 frontmatter context explicit «has_ui=true (CRUD-интерфейс; mockups deferred к Phase 6)»
- [x] No deferral conditions apply (≥2-3 UI FMs в immediate scope — все 6 в RL-001 release)

Decision: ✅ **ready to start Phase 6 implementation**. Sub-phase A per Section F.1; fresh-session prompt в Section I (replace `<FM-ID-here>` actual FM target — FM-001/002/003 первоочередные candidates по dependency order).

---

## C. Архитектурные вопросы Phase 6 (заполняются на kickoff)

> Заполняется на dedicated kickoff per `dev/meta-improvement/checklists/phase-kickoff.md` Section 1.
> **Pre-Phase-6 addendum 2026-05-27** (DEC-DEV-0048) уже зафиксировал ряд решений — отмечено ✅.

### Решено в pre-Phase-6 addendum (DEC-DEV-0048, 2026-05-27)

- ✅ **Tooling stack:** Stitch + Claude Design — co-primary (не one-of); HTML fallback — гарантированный путь. Figma / Penpot — future. См. SPEC §9.
- ✅ **Tool selection mechanism:** per-project через `.claude/design.yaml` `default_design_tool` + per-MK override через frontmatter `design_tool`. Fallback chain в `mcp_preferences.fallback_chain`.
- ✅ **Tool switching v1:** `/design:migrate <MK-id> --to <target-tool>` поддерживает Stitch ↔ Claude Design ↔ HTML; lossy regeneration через brief + MK metadata; migration trail в MK frontmatter (`previous_tools[]`, `tool_switched_at`). См. SPEC §3.6 + §16.2.
- ✅ **IR layer (lossless migration):** deferred к v2 через OQ-DM-07; v1.1 ships только frontmatter hooks (`ir_snapshot_path`, `ir_export.enabled` flag — noop в v1.1). См. SPEC §16.
- ✅ **Claude Design integration model в v1.1:** web UI + manual export workflow (claude.ai/design); MCP/API integration — когда Anthropic выпустит (bring-forward trigger в SPEC §9.2).
- ✅ **Claude Design native «Handoff to Claude Code» vs Ecosystem `/product:handoff`:** комплементарны — Ecosystem handoff = product-level behavioral, Claude Design handoff = design-level visual bundle. Возможна ссылка из Ecosystem handoff §10 на Claude Design bundle.

### Решено в Phase 6 kickoff (DEC-DEV-0052, 2026-05-27) — 12 Qs

- ✅ **Q1 — Hard approve gate UX в `/design:migrate`:** per-MK granularity, mirrors DEC-DEV-0047 §7.6 pattern. `--all` flag iterates с individual approve, no batch-bypass. Hard gate text: «STOP. Lossy regeneration via brief — visual tweaks потеряются. Approve migration для MK-NNN? [Y/N/defer]». Silence ≠ consent.
- ✅ **Q2 — `screen-generator` subagent: defer к v1.1** (cut C2). v1.0 D.2 inline в `design-session.md`. Bring-forward trigger: real D.2 >5 экранов hits >50% main context.
- ✅ **Q3 — V-MK-02..03 automation scope:** V-MK-02 partial (mechanical states `default`+`error` для interactive components); V-MK-03 manual via skill checklist. Cut C5.
- ✅ **Q4 — HTML fallback v1.0: minimal** (single HTML page, DS tokens via CSS vars, no React). React + multi-screen → v1.1. Cut C4.
- ✅ **Q5 — `claude-design-workflow.md` v1.0: stub (~30 lines).** Cut C1. OQ-DM-08 open; manual export workflow high-level; refactor after first Claude Design pilot OR Anthropic MCP/API release.
- ✅ **Q6 — `/design:migrate` matrix v1.0: Stitch ↔ HTML only.** Cut C3. Schema полная (Claude Design enum keeps); command logic narrower. Claude Design path → v1.1.
- ✅ **Q7 — `design-session.md` deadlock protection (7 iterations):** structured 4-choice menu — `[pause+save / radical-rethink D.1 / accept-current-as-final / drop-and-archive]`.
- ✅ **Q8 — `design-artifact-validate.js` v1.0:** YAML parse + 5 required-field checks (id, type, feature, design_tool, scenarios) + ref existence (SC/BR/LC via fs.exists) + V-MK-08 token coverage (regex `DS\.\w+\.\w+` scan vs DS body). Cross-platform path norm per Phase 5 bug 3 (`replace(/\\/g, '/')`).
- ✅ **Q9 — PA integration: 3 trigger events** — first `/design:start` без Stitch MCP configured; first Claude Design без Pro/Max/Team subscription; `tool_project_url` 404 при resume.
- ⏳ **Q10 — `/design:export` ↔ `/product:handoff` ordering:** carry-forward к sub-phase G (decision point in implementation, not kickoff).
- ✅ **Q11 — Subagent registration gap (R7 from DEC-DEV-0038):** Q2 defer subagent → irrelevant в v1.0.
- ✅ **Q12 — Stitch MCP `environment_tiers`:** `environment_agnostic: true` (SaaS, не зависит от tier).

### Открытые вопросы pилот-validation (нe блокируют kickoff)

- **OQ-DM-01** — Stitch MCP prompt patterns. `stitch-workflow.md` ships v0 best-effort в Phase 6 v1.0; первый use case даст данные; может потребовать переработки после первого pilot (Phase 3 PS drift precedent).
- **OQ-DM-08** — Claude Design prompt patterns. Skill stub'ом в v1.0 (Q5/C1); full skill только после first Claude Design pilot OR Anthropic MCP/API release. MCP/API ещё не выпущены — v1.1 workflow = manual export.

### Cross-cutting integrations (новое после patches 1.3.3 + 1.3.4)

Решения которые Phase 6 наследует от Integrator patch 1.3.3 / 1.3.4 и должна явно учесть на kickoff:

- **`environment_tiers` schema** (SPEC §4.2.1, DEC-DEV-0047 B-1) — Stitch MCP profile + Claude Design profile должны заполнять per-tier suitability (local-dev / staging / production). Claude Design = `environment_agnostic: true` (web service, не зависит от tier). Stitch MCP = TBD per kickoff research.
- **`.claude/pending-actions.md` journal** (DEC-DEV-0047 B-3) — Design Module skills должны append PA entries для user-only actions: «obtain Stitch MCP API key», «subscribe to Claude Pro/Max/Team», «register Stitch account», «add team workspace в Claude Design». Schema + protocol — `skills/ecosystem/user-action-tracker.md`.
- **scope-guard hook** (DEC-DEV-0047 B-2) — Integrator-only marker-gated, **не активен** в Design Module sessions. Phase 6 не должна полагаться на runtime scope-boundary check для своих writes.
- **Pattern-preserving merge в `/ecosystem:update`** (DEC-DEV-0049) — design hooks (если будут — например `design-artifact-validate.js`) автоматически попадут под pattern `^node \.claude/hooks/(product|integrator|ecosystem|design)/` → re-derived from manifest. **Префикс `design/` уже в pattern** — Phase 6 hooks работают out-of-box без обновления Step 6 pattern.
- **Hard approve gate UX template** (DEC-DEV-0047 B-4, `commands/integrator/research.md` Step 7) — reusable для `/design:start` D.3 iteration approve, `/design:migrate` strategic decision, и `/design:export` handoff bundling.

### PMO map status note

`docs/pmo/pmo-map.md` line 59: D2-B04 (UX/UI Design) — статус **✅** в текущей версии map. SPEC v1.1 shipped (DEC-DEV-0048), но Design Module commands/skills/hooks ещё **не реализованы** (Phase 6 не запущена). На kickoff обсудить: refresh status к «🟡 SPEC v1.1 ready, implementation Phase 6» — sync pmo-map с reality, иначе misleading consumers.

(Дополняется на kickoff.)

---

## D. Дисциплина scope для Phase 6 — решено DEC-DEV-0052

ROADMAP оценка 3-4 ч (+ OQ-DM-01 experimentation) **устарела** post-DEC-DEV-0048. С addendum +1-2ч на claude-design-workflow + migration frontmatter + `/design:migrate` matrix; ×2-4 множитель → **10-20 ч pre-cuts**. После 5 cuts (DEC-DEV-0052) — **8-12 ч focused work**.

### 5 cuts approved (DEC-DEV-0052) → entries в `dev/v1_1_backlog.md`

| # | Cut | Bring-forward trigger | Saves |
|---|---|---|---|
| **C1** | `claude-design-workflow.md` full → stub (~30 lines) | First Claude Design pilot OR Anthropic MCP/API release | 1-2h |
| **C2** | `screen-generator` subagent → v1.1 | Real D.2 >5 экранов hits >50% main context | 1-2h |
| **C3** | `/design:migrate` Stitch↔Claude Design path → v1.1 | Real Claude Design adoption в pilot | 1-2h |
| **C4** | `html-fallback.md` React + multi-screen → v1.1 | User explicit React-quality fallback demand | 1-2h |
| **C5** | V-MK-02..03 automation full → V-MK-02 partial only | 10+ MK created → safe auto-check patterns emerge | 1-2h |

### Don't cut (critical path для P2.5 minimum viable)

- 6 commands (`start/iterate/system/export/status/migrate`) — все на critical path
- `design-session.md` orchestrator — irreplaceable
- `component-states.md` — mechanical D.4 checklist
- `design-system-rules.md` — DS extraction для cross-MK consistency
- `stitch-workflow.md` — primary tool; keep v0 best-effort + refactor после first pilot (Phase 3 PS drift lesson)
- `design-validation.md` partial — skill critical
- `design-artifact-validate.js` hook — gating mechanism
- MK/DS/NM frontmatter schemas + migration trail — fixed в DEC-DEV-0048

---

## E. Гейт пилотной валидации

После Phase 6:
- [ ] `/design:start FM-NNN` (FM с has_ui=true) → P2.5 D.1-D.6 end-to-end
- [ ] MK/DS/NM создаются в active, passed V-MK-* validation
- [ ] HTML fallback работает без Stitch
- [ ] `/design:export FM-NNN` заполняет §10 UI Specification в handoff
- [ ] Handoff §10 consumable внешним implementation tool через adapter
- [ ] **(v1.1 addendum)** `/design:migrate MK-NNN --to <target>` работает для как минимум одной пары (Stitch ↔ HTML), migration trail записан в frontmatter, regeneration в target tool через brief sufficient
- [ ] **(v1.1 addendum)** Claude Design workflow tested as fallback (manual export → `.product/.design-sessions/`) — если pilot user имеет Pro/Max/Team subscription

---

## F. Зависимости от Phase 5 outcomes + sub-phase implementation plan

### F.1 Sub-phase decomposition A→I (DEC-DEV-0052)

| Sub-phase | Deliverable | Est |
|---|---|---|
| **A** | DEC-DEV-NNNN implementation entry + дальнейший drift fix (если найдётся) | 30-45min |
| **B** | `commands/design/{start, status}.md` + `.claude/design.yaml` template (initial deploy при первом `/design:start`; NOT synced by `/ecosystem:update` Step 5 — per-project config like `settings.local.json`; см. Section H update-compat carry-forward) | 1-1.25h |
| **C** | `skills/design/design-session.md` (orchestrator с Q7 deadlock UX + A7 menu) | 1.5-2h |
| **D** | `skills/design/{component-states, design-system-rules}.md` | 1.5h |
| **E** | `skills/design/{stitch-workflow (v0 best-effort), claude-design-workflow (stub C1), html-fallback (minimal C4), design-validation}.md` | 1.5-2h |
| **F** | `commands/design/{iterate, system, export, migrate (Stitch↔HTML only C3)}.md` | 1.5h |
| **G** | `hooks/design/design-artifact-validate.js` + manifest.yaml + Q10 carry-forward resolution (handoff §10 invocation contract) | 1.5h |
| **H** | Smoke fixture (5 static cases per `smoke-hooks.js` template) + run | 1h |
| **I** | DEV_JOURNAL closure entry + CHANGELOG `[1.4.0]` + ROADMAP «Где мы сейчас» + tag `v1.4.0` + `dev/_archive/phase-6/` для plan + `dev/PHASE_7_READINESS.md` skeleton | 1h |

**Total estimate:** 9-13h end-to-end (= 8-12h focused implementation A→H per DEC-DEV-0052 outcome + ~1h closure overhead I). Lower bound assumes Q10/Q8 carry-forwards resolve quickly + no новых ambiguities surfaced at sub-phase G.

### F.2 Phase 5 + patches runway

Phase 5 closure (DEC-DEV-0044/0045) + patches 1.3.3/1.3.4/1.3.5 (DEC-DEV-0047/0049/0051) дали следующий runway для Phase 6:

- **Integrator generic add-flow готов** — `/integrator:add` + `tool-profiler` subagent + `contract-designer` subagent работают (validated 4 PASS S1/S2/S3/S4 в Phase 5 smoke). Phase 6 может использовать `/integrator:add stitch-mcp` напрямую. Stitch-specific adapter (для Stitch MCP screen-gen output → MK markdown format) пишется как reference adapter аналогично `handoff-to-ccsdd.js` (tri-location pattern per DEC-DEV-0044).
- **Tri-location adapter pattern** (DEC-DEV-0044 Q1 refinement) — `adapters/<file>.js` в repo → `.claude/adapters/<file>.js` в pilot reference layer (синкается через bootstrap/update) → `.claude/integrator/adapters/<file>.js` в pilot instance (создаётся при `/integrator:add`). Для Stitch-adapter применима та же pattern.
- **Local-only drift detection model** (DEC-DEV-0045) — D2/D3 checks сравнивают pilot reference vs pilot instance, no cross-repo `git diff`. Применимо к Stitch adapter если будет drift.
- **Subagent structural template закрепился** — `tool-profiler` → `contract-designer` pattern (single-tool deep profile + verify-only smoke). Если Phase 6 нужен `screen-generator` subagent (D.2 множественная генерация) — следовать той же structure.
- **Hook smoke pre-commit gate активен** (DEC-DEV-0023) — `node dev/meta-improvement/scripts/smoke-hooks.js` blocks commits если новый design hook бракован. Phase 6 наследует gate автоматически.
- **Three-tier DA hierarchy** (DEC-DEV-0030 A.1) — artifact / feature / release scope. **Design DA не в Phase 6 v1.0 scope** per Q2/Q11 closure (DEC-DEV-0052): screen-generator subagent deferred к v1.1 (C2) → `agents/design/` directory остаётся пустой в v1.0. D.3 iteration review handled через Q1 hard approve gate + Q7 deadlock 4-choice menu — sufficient для v1.0. SPEC `docs/design-module/SPEC.md` не упоминает Design DA explicitly; full Design DA subagent — v1.1+ candidate если evidence dictates (D.3 iterations показывают consistent quality gaps that approve-gate не catches).
- **`product-devils-advocate` registration gap** (Phase 4 DEC-DEV-0038 follow-up R7) — moot в Phase 6 v1.0 (no design DA subagent создаётся); concern reverts к unrelated Phase 7 maintenance scope.
- **Methodology-heavy vs code-heavy calibration** (DEC-DEV-0041 lesson): Phase 6 — methodology-heavy если manual workflow для Claude Design (no MCP yet); code-heavy для Stitch MCP integration + screen-generator subagent. **Mixed:** ожидать ×2-3 multiplier против base estimate 3-4ч → realistic **10-20ч**.

---

## G. Definition of Done для Phase 6

Phase 6 done when:
- [ ] `/design:start`, `/design:iterate`, `/design:system`, `/design:export`, `/design:status` работают
- [ ] V-MK-01..V-MK-08 валидация active
- [ ] Stitch MCP интегрирован через `/integrator:add` OR HTML fallback документирован как primary
- [ ] Handoff §10 UI Specification consumable
- [ ] Pilot тест на real FM с UI прошёл
- [ ] DEV_JOURNAL closure entry
- [ ] CHANGELOG `[1.4.0]` или аналог
- [ ] Phase 6 closure ritual (Unit 2 D7)
- [ ] `dev/PHASE_7_READINESS.md` skeleton создан

---

## H. Lessons inherited (post Phase 5 + patches closure)

**Из Phase 5 + 5.1 closure** (DEC-DEV-0041/0044/0045):
- **Kickoff ROI multiplier ~6-8x в Phase 5** — каждый час pre-implementation kickoff экономит 6-8ч на mid-implementation stalls. Phase 6 kickoff обязателен (uplift skeleton → full readiness через `dev/meta-improvement/checklists/phase-kickoff.md`).
- **Tri-location adapter pattern** работает (validated в Phase 5 S4). Если Stitch-adapter будет — следовать той же structure.
- **Static smoke ≠ runtime smoke** (Phase 5 lesson) — Stage 6 fixture contract-test недостаточно; реальный pilot reveals cross-platform regressions. Phase 6 закладывать runtime smoke план с самого начала (по образцу `PATCH_1.3.3_SMOKE_TEST_PLAN.md`).
- **Local-only drift model** (DEC-DEV-0045) — pilot's git ≠ ecosystem's git; comparisons должны быть local-only. Если Phase 6 добавляет design-adapter с version detection — применять local model.

**Из Patch 1.3.3 + 1.3.4 closure** (DEC-DEV-0047/0049/0050):
- **Hard approve gate works против AI-склонности auto-chain** (DEC-DEV-0047 Lesson 5: «silence ≠ consent»). Применимо к `/design:migrate` (lossy regen — irreversible), `/design:export` (handoff bundle finalization).
- **Marker-gated PreToolUse hook pattern** (DEC-DEV-0047 Lesson 4) — если Phase 6 нужен design scope-guard (e.g., предотвратить design hooks от записи в `.product/` outside MK/DS/NM zone), та же pattern: `.claude/design/.session-context.json` marker + stale TTL.
- **Sub-phase commit cadence pays off** (DEC-DEV-0047 Lesson 7) — apply A→I structure for Phase 6 substantial sub-phases.
- **Whitelist exceptions load-bearing** (DEC-DEV-0047 Lesson 8) — если Phase 6 hook читает + пишет, проверить «would hook fire on own writes?» до shipping.
- **DEC-DEV numbering verification** (DEC-DEV-0050 R2) — перед constructing closure entry, `git log` + `grep "^## DEC-DEV"` tail чтобы избежать numbering collisions (occurred 2x в Phase 5/patches lineage).
- **Pattern-preserving merge для third-party hooks** (DEC-DEV-0049) — если Phase 6 ships design-related MCP injections, automatic preservation via update Step 6 pattern.

**Из DEC-DEV-0048 addendum:**
- **Front-loaded design discipline для conditional phases** — pre-Phase-6 addendum 2026-05-27 показал ROI (закрыли 6 архитектурных решений до kickoff с свежим контекстом, не через 5-15h при первой UI-фиче). *Apply:* Phase 7 (Integrator maintenance) — рассмотреть аналогичный pre-Phase addendum при наличии architectural questions.
- **Lossy regeneration — приемлемый v1 для tool switching** (DEC-DEV-0048 Lesson 4) — Phase 6 не должна over-engineer IR в первой итерации; v1.1 hooks (`previous_tools[]`, `ir_snapshot_path`) + noop поведение sufficient до bring-forward trigger.

**Known issues которые могут проявиться в Phase 6:**
- ~~`product-devils-advocate` registration gap~~ — Q11 DEC-DEV-0052: irrelevant в v1.0 (Q2 defer subagent → no design DA subagent в Phase 6 v1.0).
- Cross-platform path normalization (Phase 5 bug 3, journal-hook Windows backslash) — `design-artifact-validate.js` должен использовать `replace(/\\/g, '/')` для Windows compat (Q8 DEC-DEV-0052).
- Pilot's stitch-mcp profile (если будет) должен carry `environment_tiers` block — `environment_agnostic: true` per Q12 DEC-DEV-0052 (Stitch SaaS).

**Carry-forward decisions (открыты до implementation):**
- **Q10 (DEC-DEV-0052) — `/design:export` ↔ `/product:handoff` ordering:** при sub-phase G implementation grep `commands/product/handoff.md` для FM has_ui=true branch — добавить explicit `/design:export <FM>` invocation шаг ИЛИ задокументировать «handoff §10 ассистент заполняет из MK/DS/NM без separate command call». Decision point in implementation.
- **Q8 carry-forward — `design-artifact-validate.js` exit code policy:** Q8 DEC-DEV-0052 specified validation logic (YAML parse, 5 required fields, ref existence, V-MK-08 regex, cross-platform path norm) но не severity policy explicit. **SPEC §B2 уже отвечает:** quiet-draft mode — `status: draft` → queue findings (silent log, exit 0); `status: final` (или non-draft) → block (exit 1). Sub-phase G implementation просто следует SPEC §B2 — no architectural decision required.
- **Update-compat carry-forward (DEC-DEV-0052 Follow-up 2, 2026-05-27) — `/ecosystem:update` interaction.** Phase 6 ships новые artifacts that touch multiple paths user может uvedомить через `/ecosystem:update`. Existing protections inherited:
  - `commands/design/`, `skills/design/`, `agents/design/` (empty в v1.0), `hooks/design/` → namespace-aware sync per 1.3.5 Step 5 — covered automatically (managed namespaces discovered dynamically; third-party `kiro-*` style preserved)
  - design hook registration в `.claude/settings.local.json` → covered by pattern в Step 6 (DEC-DEV-0049) — `design/` префикс уже в pattern `^node \.claude/hooks/(product|integrator|ecosystem|design)/`
  - `.product/mockups/`, `.product/design-system.md`, `.product/.design-sessions/` → covered by `.product/` invariant (scope-guard B-2 forbidden paths + backup Step 2 external paths if listed)
  - **GAP: `.claude/design.yaml` per-project config** — singleton file в `.claude/` root, как `settings.local.json`. Sub-phase B MUST verify Step 5 sync algorithm не nuclear sync'aет singleton files в root `.claude/`. Если есть risk — explicitly exclude `design.yaml` from sync (same treatment как `settings.local.json`).
  - **Verification:** scenario S7 в `dev/PHASE_6_SMOKE_TEST_PLAN.md` (added Follow-up 2) — runtime compat smoke after 1.4.0 release.
  - **Cleanup story:** `.product/.design-sessions/archived/` per A4 (D.6 complete OR `--abandon`) + opportunistic >30d purge — handled inline by `design-session.md` skill (sub-phase C). Orphan MK/NM cleanup (FM deleted via `/product:promote-note --delete`) — **NOT covered v1.0**; deferred к v1.1 backlog as candidate `/design:cleanup` или integration с `/product:purge`.

**Deferred cosmetic fixes (от DEC-DEV-0050)** — не блокируют Phase 6, но можно подобрать вместе с kickoff:
- DEC-DEV-0047 duplicate «Связь с другими entries» heading (lines 3806 + 3816 в DEV_JOURNAL).
- `bootstrap.md` Step 6c добавить PowerShell variant для PA init.
- `PATCH_1.3.3_SMOKE_TEST_PLAN.md` «After closure» footer wording (conditional «archive smoke plan only after runs»).
- D7 refinements R1-R5 в `dev/meta-improvement/checklists/phase-closure.md` (substitutions for patches, numbering verification, 3-way deliverable diff, multi-session protocol).

---

## I. Implementation kickoff invocation prompt — **authoritative version (post Follow-up 2)**

> Architectural kickoff выполнен fresh-session 2026-05-27 (DEC-DEV-0052, commit `bceacbd`) + Follow-up 1 (closeout + trigger correction, `5299c7e`) + Follow-up 2 (update-compat gap + S7 + Lesson 7, this commit). Этот prompt — authoritative source-of-truth для fresh-session implementation kickoff. Target FM-001 предзаписан.

```
Я фрэш-сессия для Phase 6 implementation на Ecosystem 3.0. Architectural kickoff уже выполнен (DEC-DEV-0052, 2026-05-27, commit bceacbd) + 2 inline-session Follow-ups (5299c7e closeout + trigger correction; current commit update-compat gap + S7). Этот run = implementation execution sub-phase A→I.

## Empirical state check (mandatory per Lesson 6, DEC-DEV-0052 Follow-up 1)

Lesson 6: fresh-session inherits user signals из substrate as facts without empirical verification. Перед architectural deliberation verify pilot state эмпирически:
- `Grep has_ui=true C:/Users/pw201/WebstormProjects/my-first-test/.product/features/` должен показать ≥1 FM
- Verified inline-session 2026-05-27: 6 FMs all has_ui=true (FM-001..FM-006); FM-003 explicit «mockups deferred к Phase 6»

## Real UI FM target: FM-001 (authentication-accounts)

Reason: base feature, simplest UI scope (login/signup forms, ~3-4 экрана), handoff уже существует (FM-001-handoff.md), lowest risk для validating end-to-end P2.5 D.1-D.6 без edge cases. FM-003 (CRUD), FM-002 (multi-flow) — кандидаты на iteration 2-3.

## Substrate

1. `dev/PHASE_6_READINESS.md` (banner 🟡 architectural ready — implementation pending start; sub-phase A→I в Section F.1; Section H carry-forwards Q10/Q8/update-compat)
2. `docs/design-module/SPEC.md` v1.1 (Claude Design co-primary + IR groundwork; §9 tooling, §16 IR, §6.1 hook, §B2 quiet-draft mode для Q8)
3. `docs/pmo/artifacts/{MK,DS,NM}.md` (artifact schemas + migration trail)
4. `DEV_JOURNAL.md` DEC-DEV-0052 + Follow-up 1 + Follow-up 2 (12 Qs / 13 ambiguities / 5 cuts / Lessons 6-7) + DEC-DEV-0048 (SPEC v1.1 addendum) + DEC-DEV-0047 (PA journal + hard approve gate templates) + DEC-DEV-0023 (hook smoke runner pre-commit gate) + DEC-DEV-0049/0051 (`/ecosystem:update` patch-1.3.4/1.3.5 patterns — IMPORTANT для sub-phase B update-compat handling)
5. `dev/PHASE_6_SMOKE_TEST_PLAN.md` (S1-S5 design workflow scenarios + S7 update-compat — for post-implementation runtime smoke)
6. `dev/v1_1_backlog.md` (C1-C5 cuts — **НЕ** implementing в v1.0)
7. Pilot project state: `C:/Users/pw201/WebstormProjects/my-first-test/.product/features/FM-001-authentication-accounts.md` + handoff `FM-001-handoff.md` + связанные SC/BR/LC через grep
8. `CLAUDE.md` «Где мы сейчас»
9. `commands/ecosystem/update.md` (1.3.5 spec — для sub-phase B verify Step 5 не nuclear sync'aет `.claude/design.yaml`; для sub-phase G verify Step 6 pattern includes `design/`)
10. `commands/ecosystem/bootstrap.md` (для sub-phase B verify auto-deploy `.claude/design.yaml` initial template only on first run)

## Sub-phase plan A→I (per PHASE_6_READINESS Section F.1, ~9-13h total)

- **A** (30-45min): DEC-DEV-0053 implementation entry skeleton + drift fixes (если найдутся при substrate load)
- **B** (1-1.25h): `commands/design/{start, status}.md` + `.claude/design.yaml` template + bootstrap auto-deploy integration. **Update-compat verification:** sub-phase B MUST verify что `/ecosystem:update` Step 5 namespace-aware sync (1.3.5 spec) НЕ затирает user's `.claude/design.yaml` per-project content при upgrade. If sync algorithm treats singleton root-level files like `settings.local.json` (preserved) — leverage existing behavior. If NOT — explicitly add `design.yaml` to preserved list.
- **C** (1.5-2h): `skills/design/design-session.md` (orchestrator с Q7 deadlock 4-choice menu + A7 has_ui=true без SC 3-choice menu; A4 `archived/` cleanup logic for `.product/.design-sessions/`)
- **D** (1.5h): `skills/design/{component-states, design-system-rules}.md`
- **E** (1.5-2h): `skills/design/{stitch-workflow (v0 best-effort), claude-design-workflow (stub C1 ~30 lines), html-fallback (minimal C4, single page no React), design-validation (partial)}.md`
- **F** (1.5h): `commands/design/{iterate, system, export, migrate (Stitch↔HTML only per C3)}.md` — hard approve gate per-MK (Q1)
- **G** (1.5h): `hooks/design/design-artifact-validate.js` + `manifest.yaml` + Q10 carry-forward resolution (grep `commands/product/handoff.md` для FM has_ui=true branch; decide explicit `/design:export <FM>` invocation OR documented inline fill) + Q8 SPEC §B2 quiet-draft mode (status: draft → queue exit 0; status: final → block exit 1)
- **H** (1h): smoke fixture (static cases per `dev/meta-improvement/scripts/smoke-hooks.js` template) + run; verify exit 0
- **I** (1h): closure entry DEC-DEV-0053 + CHANGELOG `[1.4.0]` + ROADMAP/CLAUDE.md «Где мы сейчас» refresh + tag `v1.4.0` + `dev/_archive/phase-6/` для plan + `dev/PHASE_7_READINESS.md` skeleton

## Architectural decisions reference

Все 12 Qs from DEC-DEV-0052 — implementation follows. Особенно note:
- **Q1** (hard approve gate `/design:migrate`): per-MK granularity, text «STOP. Lossy regeneration via brief — visual tweaks потеряются. Approve migration для MK-NNN? [Y/N/defer]»
- **Q7** (deadlock 7 iterations): `[pause+save / radical-rethink D.1 / accept-current-as-final / drop-and-archive]`
- **Q8** (validate hook): YAML parse + 5 required fields (id, type, feature, design_tool, scenarios) + ref existence (SC/BR/LC via fs.exists) + V-MK-08 regex `DS\.\w+\.\w+` token coverage; cross-platform path norm `replace(/\\/g, '/')` per Phase 5 bug 3; SPEC §B2 quiet-draft mode
- **Q9** (PA integration): 3 trigger events — first `/design:start` без Stitch MCP; first Claude Design без subscription; `tool_project_url` 404 на resume
- **A8** (migration interruption): `previous_tools[]` entry written FIRST (before regen), regen second; rollback (delete last element) if regen fails

5 cuts (C1-C5) — НЕ implement: `claude-design-workflow` stub only, no screen-generator subagent, no `/design:migrate` Stitch↔Claude Design path, no React/multi-screen HTML fallback, V-MK-02 partial only (mechanical states) + V-MK-03 manual.

## Anti-bias guard

Implementation возможно surface'ит missed details (Phase 5 lesson — fresh-session ≠ rubber-stamp). Free to refine sub-phase scope если evidence dictates. Particularly:
- FM-001 real SC content может surface Q1/Q7/Q9 UX edge case
- Design Brief D.1 generation на FM-001 SCs может revealed что existing SCs не enough для UI (per A7) — surface честно через 3-choice menu
- Sub-phase B `/ecosystem:update` Step 5 reading может surface что namespace-aware sync уже корректно treats singleton root files как preserved — если так, no explicit exclusion code, just document это в DEC-DEV-0053
- Phase plan = hypothesis, not contract — Phase 5 sub-phase J added late per emergence

## Cross-cutting integrations to verify (per Lesson 7, DEC-DEV-0052 Follow-up 2)

Sub-phase B + G read upstream/downstream commands перед implementation:
- `commands/ecosystem/update.md` Step 5 namespace-aware sync + Step 6 hooks pattern
- `commands/ecosystem/bootstrap.md` Step 6c (auto-deploy templates)
- `commands/product/handoff.md` FM has_ui=true branch (for Q10 carry-forward resolution)
- `commands/integrator/research.md` Step 7 hard approve gate template (mirror для `/design:migrate`)

## Verification rules

- DEC-DEV номер: verify `grep "^## DEC-DEV" DEV_JOURNAL.md | tail` перед constructing entry. Last = 0052, next predicted = 0053 (verify before write).
- Sub-phase commit cadence: commits A→I individual per DEC-DEV-0047 Lesson 7
- Pre-commit hook smoke runner active (DEC-DEV-0023) — blocks commits если новый design hook бракован; run `node dev/meta-improvement/scripts/smoke-hooks.js` manually для verify до stage
- Cross-platform path norm для все hooks per Phase 5 bug 3 (Windows)

## После implementation

DEV_JOURNAL closure entry в DEC-DEV-0053 (sub-phase I). Runtime smoke `dev/PHASE_6_SMOKE_TEST_PLAN.md` S1-S7 на pilot — отдельная session с user supervision (не bundle в implementation kickoff, per Phase 5 precedent DEC-DEV-0044). S7 особенно важно для validating что `/ecosystem:update` после 1.4.0 не ломает design state.
```
