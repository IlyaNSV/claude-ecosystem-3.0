# Чек-лист готовности к Phase 6

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 6 (Design Module — **conditional**, активируется на первой FM с `has_ui=true`).
>
> **Статус (на момент создания skeleton):** ⏳ skeleton создан в sub-phase J Phase 5; заполняется после Phase 5 closure ritual (Unit 2).
>
> **Принцип:** Phase 6 — **conditional**. Не запускается «потому что следующая по номеру», а только когда pilot project дойдёт до feature с UI. Может быть отложена бессрочно если first 2-3 FMs — backend-only.

---

## Status banner

⏳ **Skeleton + pre-Phase-6 architectural addendum (2026-05-27).** Phase 6 trigger всё ещё conditional (первая FM с has_ui=true в pilot). Архитектурные решения по tooling зафиксированы заранее через DEC-DEV-0048 (Variant A — Claude Design co-primary + IR groundwork) — см. Section C.

---

## A. Pre-Phase-6 prerequisites

> **Sequence note (per design conversation 2026-05-26):** между Phase 5 closure и Phase 6 trigger evaluation вставлена **Phase D — Wiki initiative** (see [`PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md) + [`wiki-design.md`](wiki-design.md)). Phase 6 trigger evaluation происходит после Phase D closure, не сразу после Phase 5.

Перед стартом Phase 6 implementation:

**Phase 5 chain:**
- [ ] Phase 5 implementation closure (DEC-DEV-0048 closure entry) — done in sub-phase J
- [ ] Phase 5 closure ritual Unit 2 (D7 phase-closure.md 6 steps) — fresh session
- [ ] Phase 5 runtime smoke (S1-S6 per `dev/PHASE_5_SMOKE_TEST_PLAN.md`) executed; results audited
- [ ] Closure queued findings (if any) addressed or explicitly deferred

**Phase D chain (per design conversation 2026-05-26):**
- [ ] Phase D implementation closure (DW.J — DEC-DEV-0048 closure entry)
- [ ] Phase D closure ritual Unit 2
- [ ] Phase D E2E pilot (DW.I) — sync action → draft PR → merge → deploy verify
- [ ] Wiki landing page reflects current ecosystem state

**This file:**
- [ ] `dev/PHASE_6_READINESS.md` (this file) fleshed out from skeleton based on Phase 5 + Phase D lessons
- [x] **Pre-Phase-6 architectural addendum** (DEC-DEV-0048, 2026-05-27) — Claude Design co-primary + IR groundwork decided ahead of Phase 6 kickoff; SPEC v1.1 + MK frontmatter migration trail shipped. Phase 6 kickoff унаследует эти решения.

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
- **OQ-DM-04 / DM-08** — Claude Design prompt patterns (NEW open after addendum). Параллельно OQ-DM-01 для второго co-primary tool. Первая UI-фича на Claude Design даст данные.
- **Component State Matrix V-MK-02..V-MK-03 automation scope** — некоторые проверки требуют human judgement; решить partial vs full на kickoff.
- **HTML fallback completeness** — заглушка vs полноценный путь без Stitch/Claude Design.
- **`/design:migrate` UX в pilot:** approve gate granularity (per MK или batch), regeneration time budget, idempotency при partial failure.

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

## F. Зависимости от Phase 5 outcomes

Заполняется после Phase 5 closure ritual:

- **Integrator setup для `stitch-mcp`** — нужен `/integrator:add stitch-mcp` flow. Phase 5 ships generic add-flow; stitch-specific adapter (для Stitch MCP screen-gen output → MK markdown format) может быть нужен. Если так — это либо в Phase 6 scope, либо новый sub-phase Phase 6.
- **Design DA** — three-tier DA hierarchy (Phase 4 DEC-DEV-0030 A.1) включает Design DA stub; реальная имплементация Design DA → Phase 6.

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

## H. Что добавить в этот skeleton после Phase 5

Из lessons и findings Phase 5:
- (placeholder — заполняется по результатам Phase 5 closure ritual)

Из known issues, которые могут проявиться в Phase 6:
- `product-devils-advocate` registration gap — может всплыть при Design DA implementation
- (другие пункты — заполняется)
