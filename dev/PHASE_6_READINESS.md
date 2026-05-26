# Чек-лист готовности к Phase 6

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 6 (Design Module — **conditional**, активируется на первой FM с `has_ui=true`).
>
> **Статус (на момент создания skeleton):** ⏳ skeleton создан в sub-phase J Phase 5; заполняется после Phase 5 closure ritual (Unit 2).
>
> **Принцип:** Phase 6 — **conditional**. Не запускается «потому что следующая по номеру», а только когда pilot project дойдёт до feature с UI. Может быть отложена бессрочно если first 2-3 FMs — backend-only.

---

## Status banner

⏳ **Skeleton placeholder.** Заполняется после Phase 5 closure ritual + первой UI-фичи в pilot.

---

## A. Pre-Phase-6 prerequisites

> **Sequence note (per design conversation 2026-05-26):** между Phase 5 closure и Phase 6 trigger evaluation вставлена **Phase D — Wiki initiative** (see [`PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md) + [`wiki-design.md`](wiki-design.md)). Phase 6 trigger evaluation происходит после Phase D closure, не сразу после Phase 5.

Перед стартом Phase 6 implementation:

**Phase 5 chain:**
- [ ] Phase 5 implementation closure (DEC-DEV-NNNN closure entry) — done in sub-phase J
- [ ] Phase 5 closure ritual Unit 2 (D7 phase-closure.md 6 steps) — fresh session
- [ ] Phase 5 runtime smoke (S1-S6 per `dev/PHASE_5_SMOKE_TEST_PLAN.md`) executed; results audited
- [ ] Closure queued findings (if any) addressed or explicitly deferred

**Phase D chain (per design conversation 2026-05-26):**
- [ ] Phase D implementation closure (DW.J — DEC-DEV-NNNN closure entry)
- [ ] Phase D closure ritual Unit 2
- [ ] Phase D E2E pilot (DW.I) — sync action → draft PR → merge → deploy verify
- [ ] Wiki landing page reflects current ecosystem state

**This file:**
- [ ] `dev/PHASE_6_READINESS.md` (this file) fleshed out from skeleton based on Phase 5 + Phase D lessons

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

Известные открытые вопросы из ROADMAP Phase 6 + SPEC Design Module:

- **OQ-DM-01** — Stitch MCP prompt patterns (open). Первый use case даст данные; может потребовать переработки `stitch-workflow.md` после первого pilot.
- **OQ-DM-02** — Tool switching mid-project (Stitch → Figma migration). Deferred v2.
- **Component State Matrix V-MK-02..V-MK-03 automation scope** — некоторые проверки требуют human judgement; решить partial vs full.
- **HTML fallback completeness** — заглушка vs полноценный путь без Stitch.

(Дополняется на kickoff.)

---

## D. Дисциплина scope для Phase 6

ROADMAP оценка 3-4 ч (+ OQ-DM-01 experimentation). Применяя эмпирический множитель ×2-4 (DEC-DEV-0032 lesson 6) — реалистично 8-16 ч.

Cuttable candidates:
- **subagents/design/screen-generator.md** — нужен ли для D.2 множественной генерации, или inline в первой итерации?
- **HTML fallback** — full путь или заглушка (с маркером bring-forward)?
- **`/design:migrate`** (Stitch ↔ HTML fallback conversion) — нужен ли в первом релизе или v1.1?

Decision: ⏳ TBD на kickoff.

---

## E. Гейт пилотной валидации

После Phase 6:
- [ ] `/design:start FM-NNN` (FM с has_ui=true) → P2.5 D.1-D.6 end-to-end
- [ ] MK/DS/NM создаются в active, passed V-MK-* validation
- [ ] HTML fallback работает без Stitch
- [ ] `/design:export FM-NNN` заполняет §10 UI Specification в handoff
- [ ] Handoff §10 consumable внешним implementation tool через adapter

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
