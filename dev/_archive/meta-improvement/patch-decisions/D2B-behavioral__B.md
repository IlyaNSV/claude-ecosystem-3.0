---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: B
verdict: survived
instances: 5
sessions: 5
severity: blocking
confidence: medium
patch_type: codify-pattern
risk: low
finding_ids: [594322f47ffd, 1eb76ab23bd4, 4ab0c898e4a2, 81113d433b06, e5ea9d1081fe]
gate: accepted          # [Y] 2026-06-12 — D1 (R1 codify-pattern half, with C); R4 registration deferred to live-harness
dec_dev_ref: DEC-DEV-0064
---

# Patch candidate — D2B-behavioral / B

## Verdict (adversarial verification)

**Majority verdict: SURVIVED (3/3 линз независимо → real + systemic + not-mechanically-handled).** Две
оговорки для human gate: (а) это НЕ новая находка — кластер уже зафиксирован как named tech debt
(DEC-DEV-0043 E1+E2, R1+R4); (б) из 5 findings одно — НЕ нарушение (дискард), ещё одно — слабое
(cosmetic). Все цитаты ниже проверены прямым чтением файлов этого репо, не из summary кластера.

### Lens 1 — Reality (genuine violation?) → REAL (с дискардами)

`.product/` **физически отсутствует в этом репо** (`ls .product/` → "No such file or directory"; нет в
рабочем дереве). Findings — из отдельного пилот-проекта `my-first-test` (DEC-DEV-0043 «накопилось 8
SessionEnd-перехваченных сессий `my-first-test`», `DEV_JOURNAL.md:3308`). Прямо прочитать IC-файлы здесь
нельзя → evidence держится на transcript-ссылках аудитора, **но независимо подтверждена** двумя
источниками в этом репо (DEC-DEV-0043 + `dev/tech-debt/PHASE_4.md`). Разбор по findings:

- `4ab0c898` (general-purpose вместо canonical) — **REAL, high.** Не auditor-only: audit-report
  `bf7eaea4...md:69-70` показывает дословно — ассистент СНАЧАЛА вызвал `subagent_type=product-devils-advocate`
  → **ERROR "Agent type 'product-devils-advocate' not found"** → fallback в `subagent_type=general-purpose`
  с «STEP-0 role-adoption». Сам report квалифицирует это (`:132`) как «harness limitation (project agent
  types not registerable), not an assistant methodology error». То же = E1 в `dev/tech-debt/PHASE_4.md:21`
  («`[OPEN]` DA subagent_type drift, 3 сессии») и `DEV_JOURNAL.md:3318`.
- `594322` (7 ICs active без DA) — **REAL, transcript-inferred.** Дословно = E2 (`tech-debt/PHASE_4.md:33`
  «`IC-022..IC-028` со `status: active` без обязательного `product-devils-advocate` review (P-RULE-01)»;
  `DEV_JOURNAL.md:3319`).
- `81113` (inline self-DA only) — **REAL, та же E1-семья** (canonical reviewer не использован).
- `1eb76ab` (26 IC+VC русифицированы без DA) — **СЛАБОЕ (medium).** Русификация = переформулировка без
  semantic change. По рубрике `dev/meta-improvement/rubrics/D2B-behavioral.md:32` косметические правки
  IC (опечатка, doc-only) **НЕ требуют** Devil's Advocate (P-RULE применяется к семантическим изменениям).
  Возможный false-positive по строгости → down-weight.
- `e5ea9d` (IC-020/021 как da-review Act-remediation) — **НЕ нарушение.** `bf7eaea4...md:167-170`: severity
  Info, «treat as informational», edits derive from the DA review itself. **Дискард.**

→ Genuine: 3 сильных (`4ab0c898`, `594322`, `81113`) + 1 слабое + 1 дискард. Достаточно для REAL.

### Lens 2 — Systemic (один root cause или совпадение `(zone,check)`?) → SYSTEMIC

Не совпадение. Все genuine instances — один корневой класс: **P-RULE-01 (IC→DA) не обеспечивается надёжно
каноническим reviewer'ом.** Два сцепленных механизм-провала:

1. **Харнесс не регистрирует `product-devils-advocate`** → silent fallback в `general-purpose`. Доминирующая,
   journal-подтверждённая причина: `DEV_JOURNAL.md:3324` («харнесс не регистрирует `product-devils-advocate`
   — DA падает в `general-purpose` fallback»); прямой transcript `bf7eaea4...md:69`; это «R7 from DEC-DEV-0038»
   subagent registration gap (`DEV_JOURNAL.md:4228`, и подтверждённый recurring E1).
2. **Нет enforcing-гейта.** Hook `ic-change-trigger.js` — **non-blocking, только stderr-сигнал** (header
   `:15-20` «Hook не блокирует write и не вызывает subagent сам — только signals», «Exit 0 always»;
   сигнал `:144-149`). Спавн subagent'а — дискреция оркестратора (`feature-session.md:352` «Orchestrator
   immediately spawns»). P-RULE-01 — **process rule** (`validation.md:651-655`: «Правила, которые не могут
   быть автоматизированы, но обязательны как явные шаги процесса»), не V-*, поэтому inline-валидатор его
   не ловит.

Рецидив ≥3 различных сессий + цепочка DEC-DEV-0036 → 0038 → 0043 (E1 — третье подтверждение одного класса,
`DEV_JOURNAL.md:3355` Lesson #1). → SYSTEMIC.

### Lens 3 — Already-handled (существующий механизм закрывает?) → NOT mechanically handled

Механизм СУЩЕСТВУЕТ (hook `ic-change-trigger.js`, оркестрация `feature-session.md §DA orchestration flow`),
но **non-blocking и стоит ниже сломанной регистрации** — поэтому провалы рецидивируют. Асимметрия путей:
ручной `product-da-review.md:118,234` передаёт `subagent_type: "product-devils-advocate"` **явно**;
hook-driven бриф `feature-session.md:352-360` этого **не делает** (в файле строка `subagent_type` вообще
отсутствует — grep пуст). *Caveat:* в `bf7eaea4` ошибка «not found» случилась и на ручном (явном) пути —
значит регистрация доминирует, а явный-`subagent_type` в hook-пути — вторичный, но реальный gap.

Проблема **известна и tracked**: DEC-DEV-0043 R1 («Codify D7 pattern „DA subagent_type contract" + hook-side
validation», `DEV_JOURNAL.md:3367`) и R4 («P-RULE-01/P-RULE-02 enforcement hook», `:3370`). Оба **открыты
`[OPEN]`** — `dev/tech-debt/PHASE_4.md:75-84` (R1), `:114-123` (R4), и журнал статусов `:144-149` содержит
**единственную** запись (создание 2026-05-26), без FIXED. Позднее не закрыто: Q11 (`DEV_JOURNAL.md:4228`)
касается Design-module subagent (`screen-generator`), не `product-devils-advocate`. → NOT mechanically
handled: gap, который R1/R4 предлагают закрыть, остаётся открыт.

**Итого 3/3 → SURVIVED.** Честная оговорка: R1/R4 никогда не имплементировались, поэтому корректная рамка —
не «рецидив после фикса», а «named debt всё ещё открыт». Сессии кластера (2026-05-20…05-26) — в основном сама
доказательная база DEC-DEV-0043 (2026-05-26); единственная поздняя инстанция (`1eb76ab`, 2026-06-01) —
именно слабая cosmetic.

## Problem (if survived)

P-RULE-01 требует Product DA review на любое изменение IC через канонический subagent
`product-devils-advocate` (`validation.md:653`). На практике этот subagent-type **не резолвится харнессом**
Claude Code в пилот-проектах («Agent type not found»), и ассистент **молча** деградирует в `general-purpose`
+ role-adoption workaround. Поскольку (а) fallback тихий и (б) hook лишь сигналит, а спавн — дискреция
оркестратора без блокирующего гейта, P-RULE-01 регулярно обходится: то wrong-reviewer, то DA не вызывается
вовсе, а IC переводятся в `active`. Корень — сломанная регистрация subagent'а + отсутствие enforcement-гейта;
обе диагностированы в DEC-DEV-0038 и поставлены в долг DEC-DEV-0043 (R1+R4), но остаются открытыми.

## Evidence

| finding_id | session | артефакт | вердикт по Lens 1 |
|---|---|---|---|
| `4ab0c898` | 31394d98 | `.da-findings/IC-019-021-batch-2026-05-22-1216.md` | **genuine (high)** — harness "not found" → general-purpose fallback (`bf7eaea4...md:69-70/132`); = E1 (`tech-debt/PHASE_4.md:21`) |
| `594322` | 0781ad12 | `invariants/IC-022..IC-028` (7 new, active) | **genuine, transcript-inferred** — = E2 (`tech-debt/PHASE_4.md:33`; `DEV_JOURNAL.md:3319`) |
| `81113` | e1615a0c | `invariants/IC-019..IC-023` | **genuine** — inline self-DA вместо canonical subagent (E1-семья) |
| `1eb76ab` | 04649f41 | `invariants/*.md` + `verification/*.md` (26 русифицированы) | **слабое (medium)** — cosmetic-правка, DA по существу не обязателен (рубрика `D2B-behavioral.md:32`) |
| `e5ea9d` | bf7eaea4 | `invariants/IC-020, IC-021` | **НЕ нарушение** — Info, «intent satisfied», edits = da-review remediation (`bf7eaea4...md:167-170`) → дискард |

Базовый каталог проверен прямым чтением: P-RULE-01 = process rule (`validation.md:651-655`); enforcement
через `ic-change-trigger.js` (non-blocking, header `:15-20`, сигнал `:144-149`); канонический агент =
`agents/product/devils-advocate.md:2` (`name: product-devils-advocate`); долг — `dev/tech-debt/PHASE_4.md`
(E1/E2 `[OPEN]`, R1/R4 `[OPEN]`).

## Proposed patch (if survived)

- **Type:** `codify-pattern` (R1's «pattern» половина — наименьший механизм, убирающий **silent-bypass** часть корня)
- **Target files:**
  - НОВЫЙ `dev/meta-improvement/patterns/da-subagent-type-contract.md` — кодифицировать контракт.
  - `skills/product/feature-session.md` (§ DA orchestration flow, строки ~352-360) — добавить в hook-driven
    бриф **явный** `subagent_type: "product-devils-advocate"` (зеркало `product-da-review.md:118,234`) +
    правило anti-fallback.
- **Change (описание, НЕ применять):** Pattern «DA subagent_type contract»: (1) DA всегда вызывается с
  `subagent_type: "product-devils-advocate"` — и в ручном, и в hook-driven путях; (2) ответ харнесса
  **«Agent type ... not found» = BLOCKING setup-ошибка** → STOP, surface пользователю «канонический DA-агент
  не зарегистрирован», **запрет молча падать в `general-purpose` + role-adoption**; (3) если DA не вызван
  после IC/BR-сигнала — не переводить артефакт в `active`. Cross-ref DEC-DEV-0043 R1/R4 и `tech-debt/PHASE_4.md`.
- **Risk:** low для самого паттерна (discipline-документ + одна правка skill-брифа; поведенческий контракт
  не ломается). **НО** паттерн делает провал громким, а **не** чинит регистрацию: остаточный дефект
  (почему `product-devils-advocate` «not found» — вложенный путь `agents/product/` vs поле `name` vs stale
  bootstrap пилота) **не определим из этого репо** и требует live-harness проверки — это часть R4, отдельный
  механизм бóльшего риска. Не предлагать конкретную правку bootstrap без этой верификации (иначе — ровно
  plausible-but-wrong патч, против которого предостерегает DEC-DEV-0057 Lesson #1).
- **Confidence / estimate:** confidence **medium** (паттерн верифицирован и корректен; полное устранение корня
  зависит от непроверенной регистрации). Estimate: ~1-2 ч на pattern + skill-правку; регистрационный фикс
  (R4) — отдельная сессия с harness-проверкой. **Per DEC-DEV-0043 обязателен re-check альтернатив R1/R4
  перед исполнением** (`DEV_JOURNAL.md:3359/3373`; список альтернатив — `tech-debt/PHASE_4.md:81-84,120-123`).

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

> Рекомендация синтезатора: это уже tracked-долг (DEC-DEV-0043 R1+R4, оба `[OPEN]`). Разумно — **[Y]** если
> берём R1 в работу сейчас (паттерн + skill-бриф), с обязательным отдельным R4-шагом на регистрацию;
> либо **[D]** если осознанно держим как known debt. Дискард `e5ea9d` (не нарушение) и down-weight
> `1eb76ab` (cosmetic) рекомендуется отметить в journal вне зависимости от выбора.
