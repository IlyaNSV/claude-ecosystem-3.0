# NFR-* — Non-Functional Requirement

> **Тип:** non-functional-requirement
> **Домен:** D2-Behavioral (cross-cutting с D2-T05 NFR Technical Translation и D4-07 NFR/Perf/Security Testing)
> **Review:** 🟠 Strategic (с realistic-defaults guardrails)
> **Cardinality:** 0 или больше на фичу — **опционально** (обсуждается per FM)
> **Активация:** opt-in — пользователь явно выбирает, формализовать ли NFR для конкретной фичи
> **Владелец:** Product Module / процесс P2, шаг F.5a (NFR Review, условный)

## Purpose

**Очертания достаточности**, а не enterprise SLA. NFR описывает, **какое качество нефункциональных характеристик считается приемлемым** для данной стадии продукта: производительность, надёжность, масштабируемость, безопасность и т.д.

**Главная функция:** стать baseline для тестирования — что проверяем, чтобы признать фичу готовой.

**НЕ функция:** имитировать enterprise-требования в solo-проекте. NFR ≠ копия Netflix SLA.

## Philosophy: «реалистичные очертания, не идеальность»

### Что это означает

- **Solo-разработчик не строит Google.** Target'ы должны быть достижимыми на текущих ресурсах.
- **Tier-aware.** MVP ≠ MMP ≠ Growth. Таргеты растут со стадией продукта.
- **Adequacy over perfection.** Если 95% uptime достаточно пользователям — 99.99% не нужен.
- **Measurement > aspiration.** Лучше conservative target, который реально измеряем, чем amazing цифра, которую никто не проверит.
- **Opt-in, не навязчиво.** Ассистент спрашивает, нужны ли NFR — не генерирует их автоматически. Многие MVP-фичи могут быть шиппнуты с default implied NFR из sanity ranges.

### Три состояния NFR для FM

Каждая FM в процессе P2 проходит через NFR Review step (F.5a), который определяет её `nfr_status`:

| Состояние | Значение | Когда устанавливается |
|---|---|---|
| **pending** | NFR Review ещё не проводился | Default для новой FM |
| **active** | NFR явно определены | Пользователь выбрал обсудить, approved draft NFR |
| **declined** | NFR осознанно не определены; используются implied defaults | Пользователь выбрал «MVP defaults» в F.5a |

**Важно:** `declined` — это **не** «не сделано». Это **осознанное решение**, зафиксированное с датой и (опционально) причиной. В handoff и validation учитывается как полноценное состояние.

### Антипаттерны, которые мы избегаем

- **«Response time <100ms»** в MVP без нагрузочного тестирования — никто не знает, сколько на самом деле
- **«99.99% uptime»** для solo-сервиса — нереально (requires 24/7 DevOps)
- **«Поддержка 1M concurrent users»** при 10 активных пилотах — преждевременная оптимизация
- **«Compliance with SOC2»** без юр. контекста — галочка не даёт безопасности
- **NFR на каждую мелкую фичу** — избыточно; часто NFR global scope

### Как ассистент защищает от этих антипаттернов

При создании NFR ассистент:
1. Определяет текущий **tier продукта** (через RM → current phase или MVP status)
2. Проверяет target против **sanity-check ranges** для этого tier (см. §5)
3. Если target выше sanity range для tier — **warning** с предложением downgrade до реалистичного
4. Требует **measurement method** — «как измеряем?» (без этого NFR — wish)
5. Триггерит Product DA review при подозрительных значениях

## Frontmatter Schema

```yaml
---
id: NFR-<NNN>
type: non-functional-requirement
title: "Короткое описание"
category: performance | reliability | scalability | security | privacy | accessibility | compatibility | usability | observability
target_value: "string"               # например ">=95%", "<2s p50", "≤10 concurrent users"
target_tier: mvp | mmp | growth | mature
measurement_method: string           # описание как измеряем
scope: global | per_feature
related_features: [FM-<NNN>, ...]    # пусто если scope=global
status: draft | active | deprecated
sanity_check: passed | overridden    # автопроверка; `failed` — deprecated, см. ниже
override_rationale: string           # если sanity_check=overridden, обязателен
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Legacy-миграция `sanity_check: failed`.** Состояние `failed` — **не каноничное** (DEC-DEV-0025 C.2 + Ambiguity 9): runtime использует только `passed | overridden`. Target вне sanity range — это **не провал валидации**, а осознанный override: он информирует, но не блокирует (см. §Review Level). Legacy-NFR с `sanity_check: failed` трактуются как `overridden` с пустым `override_rationale` + backfill-промпт при первом открытии артефакта. Ровно эту семантику держит [`nfr-review.md`](../../../skills/product/nfr-review.md) (Step 4 + anti-pattern list), и с 2026-07-13 её **машинно сторожит V-18** (`artifact-validate.js`, 🟡 Warning) — раньше расхождение спека и скилла не ловилось ничем (DEF-CTX-1).

## Body Structure

Обязательные секции:

1. **Statement.** Формулировка требования.
2. **Target value.** Числовое значение + единица + tier обоснование.
3. **Rationale.** Почему именно этот target — не выше, не ниже.
4. **Measurement method.** Как мы узнаем, что target достигнут/нарушен. Что измеряем, чем, с какой периодичностью.
5. **Anti-target.** Что мы **осознанно не обеспечиваем** (защита от scope creep: «мы НЕ обеспечиваем sub-second response для batch обработки»).
6. **Test strategy.** Как проверяем в D4 (manual / automated / production monitoring).
7. **Known tradeoffs.** Что мы жертвуем ради этого уровня (деньги, сложность, гибкость).
8. **Related features.** Если scope=per_feature, ссылки на FM-*.
9. **Tier upgrade plan.** Что надо сделать, чтобы перейти на следующий tier (например: «для MMP поднять до <1s — потребуется caching + DB indexes»).

Опциональные:

- **Degradation behavior.** Что происходит, когда NFR нарушен (graceful degradation vs error).
- **Recovery strategy.** Как возвращаемся в норму после нарушения.

## Content Rules

- **Target measurable.** «Быстро» — не target. «<2 seconds p50 response time» — target.
- **Target within tier sanity range.** Если превышает — требует `sanity_check: overridden` + `override_rationale`.
- **Measurement method non-vague.** «Через APM» — недостаточно. «Через Plausible analytics → page load event → check histogram p50/p95 daily» — ок.
- **Anti-target обязателен.** Защищает от gold-plating. Если не можем сформулировать anti — target не конкретен.
- **Rationale ссылается на реальность.** «Пользователи ожидают быстро» — слабое. «Интервью 5 фрилансеров показали, что >3s отклика заставляет их переключаться на другую вкладку» — сильное.
- **No enterprise-copypasta.** NFR не берётся из шаблонов «best practices SaaS» без привязки к реальному продукту.

## Sanity-check Ranges (anti-enterprise guardrails)

Ассистент использует эту таблицу при создании/validation NFR. Значения вне диапазонов → warning.

### Performance

| Метрика | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Response time p50 (обычный endpoint) | <3s | <1.5s | <800ms | <400ms |
| Response time p95 | <8s | <4s | <2s | <1s |
| Page load time (first paint) | <5s | <3s | <2s | <1.5s |
| Batch operations | <30s для 100 items | <15s | <10s | <5s |
| Database query (typical) | <1s | <500ms | <200ms | <100ms |

### Reliability / Uptime

| Метрика | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Uptime (monthly) | 95% (~36h/mo allowed) | 98% (~14h) | 99% (~7h) | 99.5% (~3.5h) |
| Recovery time (manual intervention ok?) | ad-hoc, <24h | <4h | <1h | <15min |
| Data durability | daily backup | daily + weekly offsite | hourly snapshots | near real-time replication |
| Incident response time | «when owner available» | same business day | <4h on-call | 24/7 on-call |

### Scalability

| Метрика | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Concurrent active users | 10–50 | 100–500 | 1k–10k | 10k+ |
| Database size (live data) | <5 GB | <50 GB | <500 GB | 500 GB+ |
| Requests per second (peak) | 5 RPS | 50 RPS | 500 RPS | 5k+ RPS |
| Max items per user | ~1k | ~10k | ~100k | ~1M+ |
| Growth rate accommodated | 2x/month | 5x/quarter | 10x/year | managed |

### Security (baseline expectations)

| Требование | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Auth | Email+password или OAuth | + 2FA optional | + 2FA required для admin | + SSO option |
| Password storage | bcrypt/argon2 | same | + rotation policy | + passwordless option |
| Data encryption at rest | provider default | explicit encryption | + key management | + HSM |
| Data encryption in transit | TLS 1.2+ | TLS 1.3 preferred | TLS 1.3 required | mTLS для sensitive |
| Audit logs | basic login/changes | + access patterns | + SIEM integration | + real-time SIEM |
| Pen testing | ad-hoc self-review | annual external | quarterly external | continuous |

### Privacy

| Требование | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| PII handling | minimise collection | + data export (GDPR-style) | + full GDPR compliance | + regional compliance |
| Cookies / tracking | honest policy | cookie consent | granular consent | + analytics anonymization |
| Data deletion | manual, within weeks | automated within 30 days | within 7 days | near real-time |
| Third-party sharing | no без явного согласия | same + explicit list | + DPA с vendors | + vendor audits |

### Accessibility (beyond MK)

| Требование | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| WCAG compliance | informal check | AA | AA audited | AAA where reasonable |
| Keyboard navigation | basic | full | full + tested | full + regression |
| Screen reader | self-test | validated with real user | periodic audits | continuous |
| Localization | one language ok | + 1-2 если market says so | broader | full i18n pipeline |

### Compatibility

| Требование | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Browsers | Chrome, Firefox (last 2 versions) | + Safari, Edge | + 3 older versions | IE11+ если есть audience |
| Mobile | responsive | responsive tested | + native apps consideration | native apps |
| API versioning | none / breaking ok | semantic versioning | + deprecation policy | + backward compat guarantees |

### Usability

| Метрика | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Onboarding time-to-first-value | <15 min ok | <10 min | <5 min | <2 min |
| Error recovery | user can retry | graceful messages | + undo where sensible | + auto-recovery |
| Help / docs | basic README | + tutorials | + search | + contextual |

### Observability (для будущего D5)

| Требование | MVP | MMP | Growth | Mature |
|---|---|---|---|---|
| Logs | console / file | centralized (ELK, Loki) | + structured | + distributed tracing |
| Metrics | none — manual checks | basic dashboards | + alerting | + SLO/SLI tracking |
| Error tracking | manual | Sentry или аналог | + release integration | + auto-triage |

**Важно:** эти таблицы — **ориентиры**, не законы. Для конкретного продукта может быть обосновано отклонение (например, медицинский MVP может требовать privacy как Growth сразу). Отклонение требует `sanity_check: overridden` + rationale.

## Relationships

**Входящие:**
- ← FM-{NNN} (для scope=per_feature; FM ссылается в frontmatter `nfr: [NFR-NNN]`)
- ← IC-* (некоторые IC подразумевают NFR: IC про data retention → NFR про durability)
- ← MR (realistic targets часто обоснованы данными из MR: «fresh-to-usable <5s» — из user expectations study)
- ← Stage из RM (tier определяется текущей phase)

**Исходящие:**
- → VC-* extensions — NFR порождает дополнительные acceptance criteria для тестов
- → handoff §11 — embedded в пакете фичи (или как global context)
- → D4 testing — NFR становится test case в QA-инструменте (через INT-12 future)
- → D5 monitoring — NFR production values через observability tools (через Integrator)

**Cascade impact при изменении:**
- NFR target меняется → VC, зависящие от этого target, в `requires_review`
- NFR удалён → VC extensions помечаются orphan (V-15)
- Tier upgrade продукта (MVP → MMP) → глобальный review всех NFR, плюс tier upgrade plan каждого NFR

## Review Level: 🟠 Strategic

Target'ы NFR — **стратегические решения** («что нас устраивает»). Ассистент предлагает realistic defaults, human утверждает. Sanity-check ranges — **guardrails**, а не ограничения.

**Специальное поведение при override:**

- Если human выставляет target выше sanity range для текущего tier:
  - Warning: «Вы выставили uptime 99.9% для MVP. Реалистичный MVP range — 95-98%. Причина?»
  - Обязательно заполнение `override_rationale`
  - Product DA review запускается автоматически (линза: реалистичность)
  - Запись в decision journal с пометкой «enterprise-level target override»

## Lifecycle States

```
draft ──(approve + sanity check)──▶ active ──(tier upgrade)──▶ draft ──▶ active v2
                                     │
                                     └──(NFR obsolete)──▶ deprecated
```

Особый case: **tier upgrade**. Когда продукт переходит MVP → MMP (и т.д.):
- Все active NFR попадают в batch review
- Ассистент предлагает новые target'ы согласно таблицам
- Human approves per NFR (или bundle)
- version++ per NFR, предыдущие в git history

## Examples

**Good (MVP uptime):**
```yaml
---
id: NFR-001
type: non-functional-requirement
title: "Доступность сервиса для фрилансеров"
category: reliability
target_value: ">=95% monthly uptime"
target_tier: mvp
measurement_method: "Uptime Robot ping раз в 5 минут, monthly report"
scope: global
related_features: []
status: active
sanity_check: passed
confidence: high
created: 2026-06-01
updated: 2026-06-01
version: 1
---

## Statement
Сервис TranslateIT должен быть доступен минимум 95% времени в месяц
(≈36 часов простоя в месяц допустимо).

## Target value
**>=95% monthly uptime (MVP tier)**. 

Это соответствует sanity range для MVP (95-98%). 
Не стремимся к Growth/Mature (99%+), потому что:
- Нет 24/7 on-call (solo owner)
- Нет automated failover infrastructure
- Пилотная аудитория ≤50 фрилансеров, редкая активность ночью

## Rationale
Из интервью SEG-001: фрилансеры заходят 3-5 раз в день, короткие сессии.
Downtime в нерабочие часы (ночью) приемлем. Главное — дневной доступ.
95% даёт запас на ночные обновления + непредвиденные.

## Measurement method
- Uptime Robot (free tier) — HTTP ping главной страницы каждые 5 минут
- Monthly report автоматически → email
- Incident log в decision journal при >5 мин downtime

## Anti-target
**НЕ стремимся к:**
- 99.9%+ uptime (потребует managed hosting + redundancy → $$$)
- <5 min recovery (требует 24/7 реагирования)
- Geo-redundancy (нет users в разных регионах пока)

## Test strategy
- **Development:** smoke test после каждого deploy (URL returns 200)
- **Production:** automated uptime monitoring (Uptime Robot)
- **Review cadence:** monthly report

## Known tradeoffs
- Мы сознательно не мигрируем в managed Kubernetes (оверхед для MVP)
- Ночные обновления — планируется maintenance window 2-4 AM
- При сбое Heroku — может быть 1-2h downtime пока owner проснётся

## Tier upgrade plan (MVP → MMP, target 98%)
- Добавить health check endpoint с auto-alerting (уведомление в Telegram)
- Мigrate на managed DB с auto-backups (вместо manual)
- Рассмотреть second region для hot standby (если аудитория географически разнообразна)
- Target: <4h incident response (planned время для MMP)

## Degradation behavior
При недоступности main service — статическая страница с сообщением
«Сервис недоступен, попробуйте через 5 минут» + contact email.
```

**Good (MVP performance, per feature):**
```yaml
---
id: NFR-004
type: non-functional-requirement
title: "Revisions inbox load time"
category: performance
target_value: "<3s p50 на 100 revisions в inbox"
target_tier: mvp
measurement_method: "Plausible pageview → histogram daily"
scope: per_feature
related_features: [FM-003]
status: active
sanity_check: passed
confidence: medium
confidence_notes: |
  Solid: порог 3s — прямая цитата из интервью SEG-001; measurement method
  (Plausible histogram) уже настроен и снимает данные.
  Assumed: объём «до 100 revisions в inbox» — оценка по пилоту, не замер.
  При >200 revisions target не проверялся (см. Known tradeoffs).
created: 2026-06-01
updated: 2026-06-01
version: 1
---

## Statement
Inbox-страница (SI-1 из MK-003) должна загружаться в <3 секунды 
(p50) для пользователя с до 100 active revisions в inbox.

## Target value
**<3s p50 (MVP tier)**.

В sanity range MVP (Page load: <5s ok, <3s good).

## Rationale
Из интервью SEG-001: 3 сек — порог, после которого freelancer 
переключается на другую вкладку. «При 5 сек я уже забыл, что хотел».

## Measurement method
- Plausible analytics: pageview event + duration
- Daily histogram export → review в /product:status

## Anti-target
НЕ стремимся к:
- <500ms (требует CDN + server-side caching — overkill для 50 пилотных)
- <1s consistently — нужна оптимизация DB queries и lazy loading 
  (planned для MMP)

## Test strategy
- Manual smoke test после каждого release: load inbox с 50 revisions
- Plausible daily monitoring
- When >10% sessions >3s → add to roadmap priority

## Known tradeoffs
- Нет server-side caching — каждый request hits DB
- Вероятная деградация при >200 revisions в inbox (не в scope MVP)

## Tier upgrade plan (MMP → <1s)
- Add Redis caching для revisions list
- Implement virtual scrolling для >50 items
- DB indexes на (project_id, status, received_at)
```

**Anti-example (enterprise-copypasta):**
```yaml
---
id: NFR-X
type: non-functional-requirement
title: "Enterprise-grade availability"
target_value: "99.99% uptime, <100ms response, support 1M concurrent users"
target_tier: mvp
status: active
sanity_check: overridden       # ❌ target вне MVP range, а override_rationale не заполнен → V-18
measurement_method: "TBD"      # ❌ vague — target без measurement method = wish
confidence: high               # ❌ «high» при полном отсутствии обоснования — ложная уверенность
---

## Statement
Система должна соответствовать enterprise SLA.      ❌ не про наш продукт

## Rationale
Стандартная best practice SaaS.                       ❌ без привязки к реальности
```

> **Почему anti-example больше не пишет `sanity_check: failed`:** такого состояния в каноне нет (см. §Frontmatter Schema). Out-of-range target выражается как `overridden` — и тогда **обязателен** `override_rationale`. Ровно его отсутствие здесь и ловит V-18.

## Common Mistakes

1. **Enterprise copypasta.** Копирование SLA из чужих контекстов без обоснования.
2. **Vague targets.** «Fast enough», «reasonable», «secure» — не target.
3. **No measurement method.** Target без way to verify = wish.
4. **NFR на каждую мелкую фичу.** Большинство NFR — global scope. Per-feature только когда значимо отличается (например, performance inbox с 100 items).
5. **Ignoring tier.** Писать как будто мы Mature продукт.
6. **No anti-target.** Без явного «чего не обеспечиваем» — scope creep в test criteria.
7. **No tier upgrade plan.** NFR statичен — нет plan evolution.

## Related Skills

- [`nfr-review.md`](../../../skills/product/nfr-review.md) — covers proposal (F.5a step) + sanity-check guardrails
- `nfr-tier-upgrade.md` (planned, при stage change)
