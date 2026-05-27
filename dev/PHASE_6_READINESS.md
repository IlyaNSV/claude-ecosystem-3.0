# Чек-лист готовности к Phase 6

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 6 (Design Module — **conditional**, активируется на первой FM с `has_ui=true`).
>
> **Статус (на момент refresh):** 🟡 ready-for-kickoff — refreshed 2026-05-27 post patch 1.3.3 closure ritual (DEC-DEV-0050) + DEC-DEV-0048 pre-Phase-6 addendum. Skeleton изначально создан в Phase 5 sub-phase J; refresh учёл Phase 5 closure (DEC-DEV-0044/0045), patches 1.3.3/1.3.4 (DEC-DEV-0047/0049), Phase D deferral (DEC-DEV-0046).
>
> **Принцип:** Phase 6 — **conditional**. Не запускается «потому что следующая по номеру», а только когда pilot project дойдёт до feature с UI. Может быть отложена бессрочно если first 2-3 FMs — backend-only.

---

## Status banner

🟡 **Ready for kickoff — trigger pending** (refreshed 2026-05-27 post patch 1.3.3 closure ritual DEC-DEV-0050).

Prerequisite chain complete:
- ✅ Phase 5 implementation + runtime smoke + closure (DEC-DEV-0041/0044/0045 — through 1.3.2)
- ✅ Patch 1.3.3 (DEC-DEV-0047) — Integrator scope discipline + env tiers + PA journal; bundled local docs polish (DEC-DEV-0046)
- ✅ Patch 1.3.4 (DEC-DEV-0049) — `/ecosystem:update` Step 6 pattern-preserving merge
- ✅ Pre-Phase-6 architectural addendum (DEC-DEV-0048) — Claude Design co-primary + IR groundwork; SPEC v1.1
- ✅ Patch 1.3.3 closure ritual (DEC-DEV-0050) — readiness archived, smoke plan stays active

Phase 6 trigger всё ещё conditional (первая FM с has_ui=true в pilot). Архитектурные решения по tooling зафиксированы заранее через DEC-DEV-0048 (Variant A) — см. Section C. **Phase D Wiki initiative DEFERRED** (DEC-DEV-0046, phantom-audience guard) — больше не блокирует Phase 6.

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
- [x] **Pre-Phase-6 architectural addendum** (DEC-DEV-0048, 2026-05-27) — Claude Design co-primary + IR groundwork decided ahead of Phase 6 kickoff; SPEC v1.1 + MK frontmatter migration trail shipped. Phase 6 kickoff унаследует эти решения.

### A.1 Ready-to-kickoff assessment

| Item | State | Blocking? |
|---|---|---|
| Phase 5 closure done | ✅ DEC-DEV-0044/0045 | no |
| Patch 1.3.3 + 1.3.4 spec landed | ✅ | no |
| Pre-Phase-6 architectural decisions resolved | ✅ DEC-DEV-0048 | no |
| Phase D (Wiki) gate | ⏸ DEFERRED — не блокирует | no |
| **First FM with `has_ui=true` в pilot** | ❌ trigger pending | **yes — single blocker** |
| `PHASE_6_READINESS` fleshed out | ✅ this refresh | no |
| Runtime smoke S1-S5 1.3.3 в pilot | ⏳ deferred — не блокирует Phase 6 kickoff (orthogonal scope) | no |
| Phase 5 S5 runtime smoke (drift detection) | ⏳ deferred — не блокирует | no |

**Conclusion:** все non-trigger prerequisites закрыты. Единственный gate — появление первой UI-feature в pilot project (или explicit user decision сделать Design Module sandbox с synthetic FM).

---

## B. Phase 6 trigger evaluation

Phase 6 activates when:
- [ ] At least one FM in pilot project has `has_ui=true`
- [ ] User intends to design UI mockups (vs delegating to external designer / using existing system)
- [ ] If no UI features in next 2-3 FMs → defer Phase 6; consider Phase 7 (Integrator maintenance) earlier

Decision: ⏳ TBD when pilot reaches first FM with UI.

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

### Всё ещё открытые вопросы Phase 6

- **OQ-DM-01** — Stitch MCP prompt patterns (open). Первый use case даст данные; может потребовать переработки `stitch-workflow.md` после первого pilot.
- **OQ-DM-08** — Claude Design prompt patterns (NEW open after addendum per DEC-DEV-0048 §13). Параллельно OQ-DM-01 для второго co-primary tool. Первая UI-фича на Claude Design даст данные. MCP/API ещё не выпущены Anthropic — v1.1 workflow = manual export.
- **Component State Matrix V-MK-02..V-MK-03 automation scope** — некоторые проверки требуют human judgement; решить partial vs full на kickoff.
- **HTML fallback completeness** — заглушка vs полноценный путь без Stitch/Claude Design.
- **`/design:migrate` UX в pilot:** approve gate granularity (per MK или batch), regeneration time budget, idempotency при partial failure. **Hard approve gate** pattern per DEC-DEV-0047 §7.6 (silence ≠ consent) — применимо к lossy regeneration (irreversible если source MK не cached).

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

## D. Дисциплина scope для Phase 6

ROADMAP оценка 3-4 ч (+ OQ-DM-01 experimentation). Pre-Phase-6 addendum (DEC-DEV-0048) добавляет ~1-2ч на claude-design-workflow skill + миграционные frontmatter поля + `/design:migrate` Stitch ↔ Claude Design path. Применяя эмпирический множитель ×2-4 (DEC-DEV-0032 lesson 6) — реалистично **10-20 ч**.

Cuttable candidates:
- **subagents/design/screen-generator.md** — нужен ли для D.2 множественной генерации, или inline в первой итерации?
- **HTML fallback** — full путь или заглушка (с маркером bring-forward)?
- **`/design:migrate` matrix coverage v1.0:** Stitch ↔ HTML fallback только (минимум) vs Stitch ↔ Claude Design ↔ HTML (полная матрица из addendum)? Decision-point на kickoff.
- **`claude-design-workflow.md` depth v1.0:** stub (один параграф «manual workflow, MCP TBD») vs full prompt patterns library (требует pilot data из Claude Design)?

Decision: ⏳ TBD на kickoff. Pre-Phase-6 addendum указывает **floor** (Stitch + Claude Design + HTML co-equal в SPEC), но реализация может cut к stage 1 = Stitch only + claude-design stub если время dictates.

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

## F. Зависимости от Phase 5 outcomes (closed)

Phase 5 closure (DEC-DEV-0044/0045) + patches 1.3.3/1.3.4 (DEC-DEV-0047/0049) дали следующий runway для Phase 6:

- **Integrator generic add-flow готов** — `/integrator:add` + `tool-profiler` subagent + `contract-designer` subagent работают (validated 4 PASS S1/S2/S3/S4 в Phase 5 smoke). Phase 6 может использовать `/integrator:add stitch-mcp` напрямую. Stitch-specific adapter (для Stitch MCP screen-gen output → MK markdown format) пишется как reference adapter аналогично `handoff-to-ccsdd.js` (tri-location pattern per DEC-DEV-0044).
- **Tri-location adapter pattern** (DEC-DEV-0044 Q1 refinement) — `adapters/<file>.js` в repo → `.claude/adapters/<file>.js` в pilot reference layer (синкается через bootstrap/update) → `.claude/integrator/adapters/<file>.js` в pilot instance (создаётся при `/integrator:add`). Для Stitch-adapter применима та же pattern.
- **Local-only drift detection model** (DEC-DEV-0045) — D2/D3 checks сравнивают pilot reference vs pilot instance, no cross-repo `git diff`. Применимо к Stitch adapter если будет drift.
- **Subagent structural template закрепился** — `tool-profiler` → `contract-designer` pattern (single-tool deep profile + verify-only smoke). Если Phase 6 нужен `screen-generator` subagent (D.2 множественная генерация) — следовать той же structure.
- **Hook smoke pre-commit gate активен** (DEC-DEV-0023) — `node dev/meta-improvement/scripts/smoke-hooks.js` blocks commits если новый design hook бракован. Phase 6 наследует gate автоматически.
- **Three-tier DA hierarchy** (DEC-DEV-0030 A.1) — artifact / feature / release scope; Design DA в SPEC stub. Phase 6 имплементирует Design DA — likely новый subagent `agents/design/devils-advocate.md` или extension existing `agents/product/devils-advocate.md` с design-scope mode.
- **`product-devils-advocate` registration gap** (Phase 4 DEC-DEV-0038 follow-up R7) — может всплыть при Design DA implementation; flag at kickoff чтобы проверить subagent registration cycle.
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
- `product-devils-advocate` registration gap (Phase 4 DEC-DEV-0038 follow-up R7) — applicable к Design DA implementation. Verify subagent registration cycle на kickoff.
- Cross-platform path normalization (Phase 5 bug 3, journal-hook Windows backslash) — design-artifact-validate.js должен использовать `replace(/\\/g, '/')` для Windows compat.
- Pilot's stitch-mcp profile (если будет) должен carry `environment_tiers` block — иначе Stage 1 `/integrator:add stitch-mcp` будет refuse per DEC-DEV-0047 B-1 mandate.

**Deferred cosmetic fixes (от DEC-DEV-0050)** — не блокируют Phase 6, но можно подобрать вместе с kickoff:
- DEC-DEV-0047 duplicate «Связь с другими entries» heading (lines 3806 + 3816 в DEV_JOURNAL).
- `bootstrap.md` Step 6c добавить PowerShell variant для PA init.
- `PATCH_1.3.3_SMOKE_TEST_PLAN.md` «After closure» footer wording (conditional «archive smoke plan only after runs»).
- D7 refinements R1-R5 в `dev/meta-improvement/checklists/phase-closure.md` (substitutions for patches, numbering verification, 3-way deliverable diff, multi-session protocol).

---

## I. Kickoff invocation prompt template

> **При starting Phase 6 — открыть fresh session с этим prompt в качестве первого сообщения** (per `dev/meta-improvement/checklists/phase-kickoff.md`):

```
Я фрэш-сессия для Phase 6 kickoff на Ecosystem 3.0. Не загружай context из current ongoing work — нужна clean discovery view.

Substrate (минимум):
1. dev/PHASE_6_READINESS.md (this file — refreshed 2026-05-27)
2. docs/design-module/SPEC.md v1.1 (post-DEC-DEV-0048; §9 tooling, §16 IR groundwork)
3. docs/pmo/artifacts/{MK,DS,NM}.md (artifact schemas + migration trail per DEC-DEV-0048)
4. DEV_JOURNAL.md DEC-DEV-0048 (architectural addendum) + DEC-DEV-0047 (Integrator patch precedent для hard approve gate / PA journal patterns)
5. docs/pmo/pmo-map.md D2-B04 (UX/UI Design row; status may need refresh per Section C PMO map note)
6. CLAUDE.md «Где мы сейчас»
7. dev/meta-improvement/checklists/phase-kickoff.md (D7 kickoff ritual)

Trigger conditions (Section B):
- First FM with has_ui=true в pilot project, OR
- Explicit user decision создать sandbox FM-DESIGN-001 для Phase 6 implementation walk-through

Execute phase-kickoff.md Sections 1-5 + fill dev/PHASE_6_READINESS.md Section C still-open questions + Section D scope cuts. Surface refinement candidates для skeleton.

Anti-bias guard: я (fresh AI) free to surface architectural concerns DEC-DEV-0048 might have missed. Если scope не реалистичен или OQ-DM-08 (Claude Design prompt patterns) требует actual experimentation before commitments — surface честно.

После kickoff — propose DEC-DEV-0051 (Phase 6 readiness gate + Q1-QN architectural decisions, аналог DEC-DEV-0040 для Phase 5).
```

(DEC-DEV номер `0051` predicted as next sequential — verify against DEV_JOURNAL tail at actual kickoff time per DEC-DEV-0050 R2.)
