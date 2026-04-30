# 09. Handoff и tool-agnostic делегирование (incl. multi-harness)

> **Назначение:** функциональные требования к **передаче** артефактов из Product Module во внешний implementer (через Integrator + adapter). Включает multi-harness extension per overview §1.1 — не только Claude Code.

---

## 09.1 Индустриальный референс

### 09.1.1 Hexagonal Architecture / Ports-and-Adapters

**Alistair Cockburn** (2005) — паттерн «Ports and Adapters». Application core имеет **ports** (abstract interfaces); внешние системы соединяются через **adapters** (concrete implementations). Decouples business logic from infrastructure.

В твоём контексте: handoff = port (universal contract); adapter = adapter (per-tool transform).

### 09.1.2 Anti-Corruption Layer (DDD)

**Eric Evans** (2003) — when integrating with external system using different model, place **Anti-Corruption Layer**, который translates external concepts в internal ubiquitous language. Защищает core от foreign vocabulary.

Твой handoff = internal language; adapter = ACL.

### 09.1.3 Content-addressed snapshots

Уже covered in Section 07.1.4. SLSA framework, Git internals, Nix store.

### 09.1.4 Definition of Ready (DoR) / Definition of Done

Scrum practice. DoR — conditions for handoff acceptance. Mode-aware DoR (different gates for different scenarios) — emerging practice; не canonical.

### 09.1.5 Multi-harness integration

«Harness» here means a system that bundles AI-driven capabilities (Claude Code, Cursor, Cowork class, etc.). Нет единого канонического источника для «integrating multiple harnesses». Ближайшие аналоги:
- **Polyglot programming** — using multiple languages with shared protocols (gRPC, Protobuf)
- **Microservices integration** — bounded contexts with explicit interfaces
- **DDD bounded context map** — relationship patterns между BCs (Shared Kernel, Customer/Supplier, Conformist, ACL, Open Host Service, Published Language, Separate Ways)

### 09.1.6 Ключевые источники

- Cockburn, «Hexagonal architecture» — alistair.cockburn.us/hexagonal-architecture/.
- Evans, *Domain-Driven Design* (2003) ch. 14 — Anti-Corruption Layer.
- Vernon, *Implementing Domain-Driven Design* (2013) ch. 3 — context mapping patterns.
- SLSA framework — slsa.dev — supply-chain attestation.
- Schwaber & Sutherland, *Scrum Guide* — DoR/DoD.

---

## 09.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Self-contained snapshot для делегирования | Document handoff в waterfall; SLSA attestation | Wiegers; SLSA | MATURE |
| Boundary translation (ACL) | DDD ACL; ports-and-adapters | Evans 2003; Cockburn 2005 | MATURE |
| Mode-aware DoR (PoC vs production) | (нет канонического; emerging) | (closest: feature flag staged rollouts) | EMERGING |
| Drift detection on snapshot | Git verify; SLSA attestation | (industry) | MATURE для build artifacts, EMERGING для spec |
| Tool-agnostic principle | DDD bounded context independence | Evans 2003 | MATURE |
| Adapter generation per tool | (нет канонического; emerging) | (closest: gRPC code-gen per service) | EMERGING |
| Multi-harness integration | (нет канонического PMO; DDD bounded contexts closest) | Vernon 2013 ch. 3 | EMERGING |
| Decision criteria «when to push out of CC» | (нет канонического для AI-driven systems) | (emerging) | EMERGING / SPECULATIVE |
| Versioning of handoff snapshots | git versioning; SLSA versioning | (industry) | MATURE |
| Schema validation of handoff | API schema validation; OpenAPI | (industry) | MATURE |
| Receiver guidance section в handoff | API documentation principles | (industry) | MATURE |
| Out-of-scope explicit declaration | критика scope creep у Cagan | Cagan; Cockburn (clear interfaces) | MATURE-ISH |

---

## 09.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Self-contained snapshot для делегирования | ● 3 | `[C]` | CC | handoff.md с 13 секциями; embedded artifacts (full content, not refs); receiver не нуждается в `.product/` access. **Stronger than typical** благодаря self-contained discipline (анти-паттерн AP-2 forbids «See SC-005»). |
| 2 | Boundary translation (ACL) | ● 3 | `[C]` | HYB | Universal handoff = internal language; adapter scripts в `.claude/integrator/adapters/` = ACL per target tool. CC for handoff; EXT (script logic) для adapter — formally HYB. |
| 3 | Mode-aware DoR | ● 3 | `[F]` | CC | D1 modification: production (8 blockers) vs draft (3 blockers). Status differentiation ready/partial/blocked/stale. Frontier extension. |
| 4 | Drift detection on snapshot | ● 3 | `[C]` | CC | V-H-04 hash mismatch → status:stale + warning + regenerate prompt. Direct port git verify pattern. |
| 5 | Tool-agnostic principle | ● 3 | `[C]` | CC | DEC-A06 explicit; handoff format universal; adapter pattern decouples. |
| 6 | Adapter generation per tool | ◐ 2 | `[F]` | EXT (planned) | Reference adapter `handoff-to-ccsdd.js` planned Phase 5. **Manual для v1**; «contract design алгоритм — один из pending gaps; первый adapter пишется вручную (не generated). OK для v1 — с опыта формализуем generation позже.» (Integrator SPEC, ROADMAP Risks). |
| 7 | Multi-harness integration | ◔ 1 | `[F]` | N/A (acknowledged) | **Пользователь явно спрашивал об этом.** Per overview §1.1, ecosystem может extend beyond Claude Code. Currently: **acknowledged as principle**, не operationalized. Multi-harness scenarios: (a) Cowork-class harness alongside CC, (b) standalone services (dashboards), (c) external SaaS for Discovery (например, Strategyzer Cloud). Coverage = 1. **Отслеживай:** appearance of `harness:` field в tool catalog или separate adapter classes for harness-vs-tool. |
| 8 | Decision criteria «when to push out of CC» | ◔ 1 | `[F]` | CC | Acknowledged в overview §1.1 (5 criteria: non-conversational UI, persistent runtime, multi-user collab, mature external solution, sensitive data). Не yet operationalized as decision skill or hook. Coverage = 1. **Отслеживай:** appearance of `/integrator:assess-locus <function>` или similar. |
| 9 | Versioning of handoff snapshots | ● 3 | `[C]` | CC | `version:` field в frontmatter; `previous_version:` reference; git history. |
| 10 | Schema validation of handoff | ● 3 | `[C]` | CC | V-H-01..V-H-10 (10 named handoff rules); V-H-06 frontmatter YAML valid; V-H-01 mandatory sections; V-H-02 hashes. |
| 11 | Receiver guidance section | ● 3 | `[C]` | CC | Section 11 NFR Receiver guidance per case (active/declined/pending); Section 13 Out of Scope; Section 12 Dependencies & Context. |
| 12 | Out-of-scope explicit declaration | ● 3 | `[C]` | CC | V-H-10 🟡 Warning «Out of Scope section non-empty»; AP-4 в handoff-spec §12 «Нет Out of Scope = scope creep». |

**Итог:** 10 × ● 3, 1 × ◐ 2 (#6 adapter generation), 2 × ◔ 1 (#7 multi-harness, #8 decision criteria).

---

## 09.4 Нарративный анализ соответствия

### 09.4.1 Self-contained handoff — strong fitness

**Match с explicit operationalization.** AP-2 в handoff-spec §12: «References вместо embedded → нарушает self-contained принцип» — explicitly forbids the lazy approach. Most spec systems allow «See section X» references; ты forbid them at the boundary. **Stronger discipline.**

### 09.4.2 Mode-aware DoR — frontier extension

Уже covered в Section 05 #7. Match с frontier; `--mode draft` is fitness contribution.

### 09.4.3 ACL via adapter pattern — direct DDD port

**Match.** Adapter scripts в `.claude/integrator/adapters/` perform translation, который описывает DDD ACL. Code structure (one adapter per target tool) follows naturally.

### 09.4.4 Multi-harness — acknowledged principle, not operational

**Специфический фидбэк пользователя.** Overview §1.1 добавлено: «Ecosystem 3.0 != only Claude Code; может выходить за пределы если оправдано» с 5 trigger criteria.

**Operationalization gap:**
- Нет concrete examples в tool-catalog of EXT harness (vs EXT tool).
- Нет skill для assessing «should this stay in CC, or move to harness X?».
- Нет journal pattern для documenting harness migration decisions.

**Это intentional pre-pilot.** Multi-harness становится релевантным когда:
- Real solo workflow shows CC inadequacy в specific zone (например, visual dashboard для monitoring)
- Tool catalog accumulates such that splitting becomes obvious
- External tool offers capabilities, которые CC genuinely can't provide

**Отслеживай:**
- Appearance of `harness:` field в `tool-catalog.yaml` profiles
- Decision journal entry «migrated function X from CC to harness Y»
- New section в Integrator SPEC about harness lifecycle

### 09.4.5 Adapter generation — partial gap with bring-forward

**Conscious cut.** First adapter manual, generation algorithm formalized later. Bring-forward trigger: 3+ adapters written manually with similar transformation logic — pattern emerges, codify generation.

### 09.4.6 Что индустрия знает, что ты можешь упускать

1. **OpenAPI / Schema-first contracts.** Индустрия: API contracts as first-class artifacts; consumer-driven contract testing. Твой handoff has implicit schema (V-H-* rules), не formal OpenAPI-style declaration. **Likely fine для v1.** If multiple tools start consuming handoff, formalizing schema becomes valuable.
2. **Versioned handoff schema.** Когда handoff schema sama evolves (новые секции, новые поля), как receivers know what version to expect? Currently: implicit through `generator: product-module-v1.0`. Индустрия: API versioning (semver, deprecation policy).
3. **Backward compatibility.** Когда handoff schema changes, что about existing handoffs in stale state? Currently: regeneration assumed. Индустрия: migration scripts, compatibility layers.

These are not pressing pre-pilot but become relevant as Integrator activates more tools.

---

## 09.5 Анти-паттерны для отслеживания

(Some shared with handoff-spec.md §12 AP-1..AP-9.)

1. **Handoff as FM-copy (AP-1).** Симптомы: handoff body is just FM frontmatter restatement; no embedded SC/BR/LC/VC. **Source:** handoff-spec.
2. **References instead of embedded (AP-2).** Симптомы: «See SC-005 in `.product/scenarios/`» в handoff body. **Source:** handoff-spec.
3. **Нет BG excerpt (AP-3).** Симптомы: Section 3 of handoff empty or skipped. **Source:** Evans 2003 — ubiquitous language at boundary critical.
4. **Out of Scope erosion (AP-4).** Уже в Section 01 #8. Recurring.
5. **UI Spec forgotten при has_ui (AP-5).** Симптомы: V-H-08 fail, but override applied. **Source:** handoff-spec.
6. **Handoff without hashes (AP-6).** Симптомы: `artifact_hashes: {}` empty or missing. V-H-02 should block; if not, regression. **Source:** SLSA principle.
7. **Generated despite blocked DoR (AP-7).** Симптомы: status:blocked, but file exists. **Source:** handoff-spec.
8. **Section order custom (AP-8).** Симптомы: handoff body sections в non-canonical order. Breaks adapter parsing. **Source:** handoff-spec.
9. **Inline configuration (AP-9).** Симптомы: handoff specifies stack/library/framework. Не его зона. **Source:** handoff-spec.
10. **Adapter as data mutation (NEW).** Симптомы: adapter writes back to `.product/` (не just transform). Violates ACL one-way principle. **Source:** Vernon 2013 — ACL one-way.
11. **Multi-harness without journal entry.** Симптомы: function quietly migrates CC → external harness без DEV_JOURNAL rationale. **Source:** overview §2.4.

---

## 09.6 Сигналы для сравнения снапшотов

1. **handoff status distribution.** ready / partial / blocked / stale.
2. **Stale rate over time.** Growing = drift not addressed; shrinking = regenerate cadence healthy.
3. **DoR overrides count.** Per blocker.
4. **Mode usage.** production-dominant? draft mostly for PoC?
5. **Adapter count.** в `.claude/integrator/adapters/`.
6. **Adapter changes** related to handoff schema changes? (sign of co-evolution).
7. **Multi-harness fields appear?** `harness:` в tool catalog; harness-specific adapter classes.
8. **Tool catalog harness-vs-tool distribution.**
9. **`/integrator:assess-locus` или similar skill** appears?
10. **Decision journal entries on locus migration.**
11. **OpenAPI/schema formalization.** handoff schema yaml/json schema artifact appears?
12. **Versioned handoff schema** with deprecation policy?

---

**Конец раздела 09.**
