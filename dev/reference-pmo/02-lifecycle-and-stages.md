# 02. Жизненный цикл продукта и stage-aware activation

> **Назначение раздела:** функциональные требования к **модели жизненного цикла продукта** и к тому, как PMO **меняет своё поведение** в зависимости от стадии. На стадии Идеи и Pilot не должны включаться full-blown enterprise гарантии; на стадии Growth не должны висеть pilot-уровневые упрощения.

---

## 02.1 Индустриальный референс

### 02.1.1 Откуда берутся стадии

Канонический источник — Lean Startup (Ries 2011) с тремя «engines of growth» (sticky / viral / paid) и тремя стадиями: **early stage** (validate problem-solution fit), **product-market fit** (validate growth), **scaling** (optimize). Это методологически, не операционально.

Operationally — Cagan (*Inspired*, 2017) формулирует более полезную для PMO модель: **Pre-Product/Market Fit → Post-PMF Growth → Mature**, с разной оптимизацией PMO на каждой стадии (на pre-PMF фокус на Discovery; на growth — на retention metrics; на mature — на operational excellence).

Industry-popular эвристика — **5 стадий ProductPlan / Reforge**: Idea → MVP → Product/Market Fit (≈ MMP) → Growth → Mature/Scale. Не каноническая в литературе, но широко цитируемая практика.

### 02.1.2 Stage-aware activation как идея

«PMO должен делать разное на разных стадиях» — это не отдельная школа, это сводное наблюдение из:
- **Lean Startup innovation accounting** (Ries) — на ранних стадиях измерения per-cohort, не aggregate
- **Empowered teams Cagan'а** — на ранних стадиях команда работает над validating problem; на growth — над retention; на mature — над operational metrics
- **SRE SLO tier** (Google SRE Book) — internal tool 99% vs production 99.9% vs critical 99.99% — sanity ranges зависят от criticality, прокси для зрелости

### 02.1.3 Pivot/Persevere как cadence-driven decision

Ries формулирует это как **regular** check-point: на каждом cohort-cycle команда отвечает «pivot or persevere». Cagan уточняет: pivot — это не «failure», это «we learned, now we redirect»; должна быть formal cadence, не реактивный паник-режим.

10 named pivots у Ries: zoom-in, zoom-out, customer segment, customer need, platform, business architecture, value capture, engine of growth, channel, technology.

### 02.1.4 Ключевые источники

- Ries, *The Lean Startup* (2011) ch. 8 (pivot taxonomy), ch. 7 (innovation accounting). theleanstartup.com.
- Cagan, *Inspired* 2nd ed. (2017) part 2; *Empowered* (2020) ch. 3 «product strategy at every stage».
- Google SRE Book (Beyer et al., 2016), ch. 4 «Service Level Objectives» — tier-based SLO discipline. sre.google/sre-book.
- ProductPlan — «5 stages of product life cycle» — practitioner reference, не canonical.

URL detail → `99-bibliography.md`.

---

## 02.2 Перечень функций

| Функция | Industry-canonical anchor | Source | Maturity |
|---|---|---|---|
| Defined product lifecycle stages | Lean Startup engines; Cagan PMF stages | Ries 2011 ch. 7-8; Cagan *Inspired* | MATURE-ISH |
| Stage-aware activation процессов | (composite — Ries innovation accounting + Cagan empowered teams) | Ries ch. 7; Cagan *Empowered* ch. 3 | MATURE-ISH |
| Stage-aware validation severity | (нет канонического PMO-источника — derived from tiered linting + SRE SLO tier) | Google SRE ch. 4 (идея SLO tier); ESLint config layers (analog) | EMERGING |
| Stage-aware NFR sanity ranges | ISO 25010 + SRE SLO tier discipline | iso25000.com; sre.google/sre-book ch. 4 | MATURE для SRE, EMERGING для spec-bound |
| Transition criteria между стадиями | Ries pivot/persevere; Cagan PMF criteria | Ries ch. 8; Cagan *Inspired* (глава о PMF) | MATURE-ISH |
| Pivot decision protocol с formal cadence | Ries pivot/persevere | Ries ch. 8 | MATURE-ISH |
| Stage-aware ceremony cost | критика stage-gate у Cagan; Lean «no waste» | Cagan *Empowered* (глава о operating model) | MATURE-ISH |

---

## 02.3 Чеклист покрытия

**Шкала** (см. overview §2.2): ✗ 0 / ◔ 1 / ◐ 2 / ● 3 / N/A. **Locus:** CC / EXT / HYB / N/A.

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Defined product lifecycle stages | ● 3 | `[C]` | CC | 5 стадий явно: ИДЕЯ → MVP → MMP → GROWTH → MATURE (`pmo-map.md` §«Модель жизненного цикла»). Соответствует ProductPlan 5-stage; gestалт-эквивалент Cagan PMF stages. |
| 2 | Stage-aware activation процессов | ● 3 | `[C]` | CC | Activation Matrix в `pmo-map.md` явно: per-process per-stage с ★/○ маркерами. D1-01..06 ★ только ИДЕЯ→MVP; D5/D6 разворачиваются на MMP+. Чистая operationalization Lean innovation accounting principle. |
| 3 | Stage-aware validation severity (validation_tier) | ● 3 | `[F]` | CC | B1 modification: `validation_tier: pilot \| mvp \| full` в `.claude/product.yaml`; tier-aware activation V-* правил inline vs queued. Сильный fitness; индустрия не имеет canonical analog для living spec validation. |
| 4 | Stage-aware NFR sanity ranges | ◐ 2 | `[C]` | CC | NFR.md §5 содержит sanity ranges per tier (MVP/MMP/Growth/Mature). Команда `/product:nfr-upgrade-tier` **acknowledged** (упомянута в Product Module SPEC §3.3), но **не реализована** (отложена в Phase 4). Когда tier upgrade происходит вручную — batch review **не automated**. |
| 5 | Transition criteria между стадиями | ◔ 1 | `[C]` | CC | Косвенно: HYP `validated` → MVP `achieved`; `invalidated` → MVP `evolved`. Но **формальные критерии перехода MVP → MMP, MMP → Growth, Growth → Mature не определены**. Implicit, не codified. Acknowledged, не operationalized. |
| 6 | Pivot decision protocol с formal cadence | ◔ 1 | `[C]` | CC | `/product:init --pivot` упомянута как future (Q-11 «out-of-scope v1»). Pivot taxonomy не codified. Acknowledged через placeholder, не operational. |
| 7 | Stage-aware ceremony cost | ● 3 | `[F/C]` | CC | Composite: validation_tier (#3); magnitude classification для DA review (cosmetic skip vs significant full); auto-approve 🟢 на confidence:high; quiet-draft hooks. Stage transitions могут включать tier upgrade → re-review всех declined NFR. Сильное fitness-расширение. |

**Итог:** 4 × ● 3, 1 × ◐ 2, 2 × ◔ 1, 0 × ✗ 0. Всё CC. Слабые места: #5 (transition criteria) и #6 (pivot protocol) — оба только acknowledged, не operationalized. Это сознательные cut'ы (Q-11 «out-of-scope v1»), но **повышают приоритет** после PILOT POINT.

---

## 02.4 Нарративный анализ соответствия

### 02.4.1 Lifecycle stages → Activation Matrix → tier system

**Должно быть:** PMO ведёт себя по-разному на разных стадиях; ceremony cost растёт с зрелостью продукта; NFR ужесточаются; тестовое покрытие расширяется. Индустрия: Lean innovation accounting (per-stage measurement); SRE SLO tiers; Cagan PMF stages.

**У тебя:** 5 стадий + Activation Matrix + validation_tier + NFR sanity ranges per tier. Это **direct port + extension** Lean-style stage-aware operations.

**Match с конкретным усилением.** Индустрия оперирует stages на уровне idea-product strategy; ты переносишь это на validation severity (B1) и magnitude-driven adversarial review. Усиление: индустрия не имеет conceptual analog «validation_tier» для living spec — это твой вклад.

### 02.4.2 Transition criteria — известная слабая зона

**Должно быть:** Формальные критерии «когда MVP → MMP», «когда MMP → Growth». Индустрия: Cagan PMF heuristics (Sean Ellis test 40%+ «very disappointed»; retention curves flatten); Lean Startup cohort retention plateau.

**У тебя:** Только HYP-driven transitions для MVP (validated/invalidated/deferred). Дальнейшие stage transitions — implicit, manual decisions.

**Conscious gap до PILOT POINT.** Это разумно: solo-разработчик на pre-pilot не имеет реальных пользовательских когорт, ergo нет данных для retention curves. **После PILOT POINT** — это станет первой задачей upgrade'а: добавить formal criteria, хуки для tier-upgrade prompts, batch review pending items.

**Отслеживай в снапшоте:** при первом снапшоте после реальных deployment'ов — должны появиться draft criteria для MVP → MMP в `pmo-map.md` или `product.yaml`. Если их не появилось через 1-2 месяца после первой реальной фичи — это эрозия принципа validated learning.

### 02.4.3 Pivot protocol — отложен сознательно

**Должно быть:** При pivot происходит cascade re-derivation downstream артефактов; pivot taxonomy (zoom-in / zoom-out / segment / etc.) применима, и фиксируется тип pivot'а. Индустрия: 10 pivots Ries; pivot не как failure у Cagan.

**У тебя:** `/product:init --pivot` — placeholder; Q-11 явно «out-of-scope v1».

**Conscious gap.** Rationale: pivot реалистично может произойти только после реального data accumulation; до PILOT POINT pivot — academic exercise. Это согласуется с Lean: pivot — на основе cohort data, не на основе «передумали».

**Отслеживай в снапшоте:** появление команды `/product:init --pivot` — significant event. Должна включать: PS rewrite path, cascade re-derivation flag, pivot type taxonomy, decision journal entry.

### 02.4.4 Stage-aware NFR — partial gap closing

**Должно быть:** При tier upgrade — все NFR с status=declined / pending попадают в batch re-review. Индустрия: SRE tier discipline; ISO 25010 quality models per criticality.

**У тебя:** sanity ranges есть; tier upgrade команда **acknowledged** (упомянута), не реализована.

**Closing in Phase 4.** ROADMAP явно фиксирует `/product:nfr-upgrade-tier` в Phase 4 deliverables. После Phase 4 этот пункт перейдёт ◐ 2 → ● 3.

---

## 02.5 Анти-паттерны для отслеживания

1. **Stage stuck at pilot forever.** Симптомы: validation_tier = pilot через 6+ месяцев активной работы; нет триггеров для обсуждения tier upgrade. **Источник:** SRE tier discipline — staying in dev forever means never facing real-world quality bar.

2. **Activation Matrix ignored in practice.** Симптомы: D5 (Operations) обсуждается на стадии ИДЕЯ/MVP (premature optimization); или D1 Discovery skipped после pilot (premature scaling). **Источник:** критика premature optimization у Cagan; Ries о appropriate stage focus.

3. **NFR sanity ranges ignored, copy-paste enterprise.** Симптомы: NFR на MVP стадии устанавливают p99 < 50ms / 99.99% uptime (нереалистично для pre-pilot, copy-paste из FAANG-style spec). **Источник:** SRE SLO discipline — error budgets must match team capacity; Cagan об over-engineering.

4. **Pivot pretended as «small change».** Симптомы: PS существенно меняется (например, target SEG другой) без явного pivot acknowledgment, без cascade, без journal entry. **Источник:** Ries — pivot taxonomy specifically meant to label what's happening.

5. **Transition by date instead of evidence.** Симптомы: «через 3 месяца переходим на MMP tier», без HYP validation evidence. **Источник:** Lean innovation accounting; Cagan PMF heuristics.

6. **Ceremony cost monotonically rising.** Симптомы: tier upgrade добавляет правила, но никогда не пересматривает что осталось из старого tier'а. Validation rules аккумулируются. **Источник:** Lean «no waste»; ESLint rule set entropy анти-паттерн.

---

## 02.6 Сигналы для сравнения снапшотов

1. **Активный validation_tier в `.claude/product.yaml`.** pilot / mvp / full?
2. **Дата последнего tier upgrade event.** Если никогда — почему? Если давно — нужен ли next?
3. **Activation Matrix unchanged.** Сами ★/○ маркеры стабильны?
4. **NFR sanity ranges — actual values vs documented.** Проверить, что в реальных NFR-* targets применяются ranges из NFR.md §5.
5. **HYP status distribution.** testing / validated / invalidated / deferred. Как развивается между снапшотами?
6. **MVP status.** draft → active → achieved → evolved. Какой текущий?
7. **Команда `/product:init --pivot`.** Появилась ли реализация?
8. **Появление **MVP→MMP transition criteria** в `pmo-map.md` или `.claude/product.yaml`.** Признак learning от реального pilot.
9. **Stage-aware NFR re-review events.** Журнал содержит batch tier-upgrade reviews?
10. **Backwards transitions** (например, MMP → MVP при invalidation). Явно codified или ad-hoc?

---

**Конец раздела 02.**
