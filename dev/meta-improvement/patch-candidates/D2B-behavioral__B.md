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
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — D2B-behavioral / B

## Verdict (adversarial verification)

**Majority verdict: SURVIVED (3/3 lenses real + systemic + not-mechanically-handled)** — но с двумя
важными оговорками: (а) кластер уже зафиксирован как named tech debt (DEC-DEV-0043 R1+R4), осознанно
deferred пользователем; (б) одно из 5 findings — НЕ нарушение, ещё одно — слабое. Подробно ниже.

### Lens 1 — Reality (genuine violation?) → REAL (с дискардами)

Артефакты `.product/invariants/IC-019..028`, `.product/.da-findings/*` **физически отсутствуют в этом репо**
(`ls .product` → "No such file or directory"; `git ls-files .product` пусто; нет в `.gitignore`). Это
сессии **отдельного пилот-проекта `my-first-test`** (audit-report `0781ad12...md:73` «Сессия в pilot-проекте
`my-first-test`»; transcript в temp-каталоге). Прямо прочитать IC-файлы здесь нельзя — evidence держится
на transcript-line ссылках аудитора **плюс** независимом подтверждении в DEV_JOURNAL. Разбор по findings:

- `4ab0c898` (general-purpose вместо canonical) — **REAL, high.** Не auditor-only: timeline
  `bf7eaea4...md:69-70` показывает, что ассистент СНАЧАЛА вызвал `subagent_type=product-devils-advocate`
  → ошибка **«Agent type 'product-devils-advocate' not found»** → fallback в `general-purpose` с
  «STEP-0 role-adoption» промптом. То же независимо зафиксировано в `DEV_JOURNAL.md:2918` (DEC-DEV-0038
  «системное #2») и `DEV_JOURNAL.md:3318` (E1, сессии 0781ad12 / 31394d98 / e3bfd3a3, **recurring regression**).
- `594322` (7 ICs active без DA) — **REAL, но transcript-inferred.** `0781ad12...md:172` сам хеджирует:
  «Hook `ic-change-trigger.js` не отстрелил (или результат не виден в транскрипте)». Соответствует
  DEC-DEV-0043 E2 (`DEV_JOURNAL.md:3319`).
- `81113` (inline self-DA only) — REAL, same family (canonical reviewer не использован).
- `1eb76ab` (26 IC+VC русифицированы без DA) — **СЛАБОЕ (medium).** Русификация = переформулировка без
  semantic change → по `validation.md:32`/`devils-advocate.md:67-72` это **cosmetic**, а cosmetic IC-правки
  DA по существу не требуют (нужен максимум adaptive quick-check). Возможный false-positive по строгости.
- `e5ea9d` (IC-020/021 как da-review Act-remediation) — **НЕ нарушение.** `bf7eaea4...md:38-41`: severity
  `info`, «P-RULE-01 intent satisfied — edits derive from the DA review itself». **Дискард.**

→ Genuine: 3 сильных (`4ab0c898`, `594322`, `81113`) + 1 слабое + 1 дискард. Этого достаточно для REAL.

### Lens 2 — Systemic (один root cause или совпадение `(zone,check)`?) → SYSTEMIC

Не совпадение. Все genuine instances — один корневой класс: **P-RULE-01 (IC→DA) не обеспечивается надёжно
канонічным reviewer'ом.** Два сцепленных механизм-провала:
1. **Харнесс не регистрирует `product-devils-advocate`** → silent fallback в `general-purpose`
   (`DEV_JOURNAL.md:2918`, `:3318`; `bf7eaea4...md:69`). Доминирующая, journal-подтверждённая причина.
2. **Нет enforcing-гейта**: hook `ic-change-trigger.js:144-149` — **non-blocking, только stderr-сигнал**;
   спавн subagent'а — дискреция оркестратора (`feature-session.md:351-352`). Поэтому DA иногда не
   вызывается вовсе, а в одной сессии da-pending.yaml вообще переписан в пустой без спавна
   (`DEV_JOURNAL.md:2917`). P-RULE-01 — **process rule**, не V-*, поэтому inline-валидатор его не ловит.

Рецидив ≥4 различных сессий за 2+ недели (2026-05-20…2026-06-01) + перекрытие с DEC-DEV-0038/0043.

### Lens 3 — Already-handled (существующий механизм закрывает?) → NOT mechanically handled

Механизм СУЩЕСТВУЕТ (hook `ic-change-trigger.js`, оркестрация `feature-session.md §DA orchestration`),
но он **non-blocking и стоит ниже сломанной регистрации** — поэтому провалы рецидивируют. Ручной путь
`product-da-review.md:118,234` уже передаёт `subagent_type: "product-devils-advocate"` явно — hook-driven
путь (`feature-session.md:352-360`) этого **не делает** (бриф без явного `subagent_type`). Проблема
**известна и уже tracked** (DEC-DEV-0043 R1 «Codify D7 pattern „DA subagent_type contract" + hook-side
validation» — `DEV_JOURNAL.md:3367`, и R4 enforcement hook — `:3370`), но R1/R4 **открыты (`[ ]`)** и
findings из этого кластера (напр. `04649f41`, 2026-06-01) появились **после** их фиксации 2026-05-26 →
значит механически не закрыто.

**Итого 3/3 → SURVIVED.** Оговорка для human gate: это НЕ новая находка, а подтверждение, что
DEC-DEV-0043 R1/R4 всё ещё рецидивируют. Легитимен и `[D] defer` (осознанный долг), и `[Y]` (исполнить R1).

## Problem (if survived)

P-RULE-01 требует Product DA review на любое изменение IC через канонический subagent
`product-devils-advocate`. На практике этот subagent-type **не резолвится харнессом** Claude Code в
пилот-проектах («Agent type not found»), и ассистент **молча** деградирует в `general-purpose` + role-adoption
workaround. Поскольку (а) fallback тихий и (б) hook лишь сигналит, а спавн — дискреция оркестратора без
блокирующего гейта, P-RULE-01 регулярно обходится: то wrong-reviewer, то DA не вызывается вовсе. Корень —
сломанная регистрация subagent'а + отсутствие enforcement-гейта; обе диагностированы ещё в DEC-DEV-0038
и поставлены в долг DEC-DEV-0043 (R1+R4), но рецидив продолжается.

## Evidence

| finding_id | session | артефакт | вердикт по Lens 1 |
|---|---|---|---|
| `4ab0c898` | 31394d98 | `.da-findings/IC-019-021-batch-2026-05-22-1216.md` | **genuine (high)** — harness "not found" → general-purpose fallback (`bf7eaea4...md:69`, `DEV_JOURNAL.md:2918/3318`) |
| `594322` | 0781ad12 | `invariants/IC-022..IC-028` (7 new, active) | **genuine, transcript-inferred** — auditor хеджирует, не виден ли hook (`0781ad12...md:172`); = DEC-DEV-0043 E2 |
| `81113` | e1615a0c | `invariants/IC-019..IC-023` | genuine — inline self-DA вместо canonical subagent |
| `1eb76ab` | 04649f41 | `invariants/*.md` + `verification/*.md` (26 русифицированы) | **слабое (medium)** — cosmetic-правка, DA по существу не обязателен (`validation.md:32`) |
| `e5ea9d` | bf7eaea4 | `invariants/IC-020, IC-021` | **НЕ нарушение** — info, «intent satisfied», edits = da-review remediation (`bf7eaea4...md:38-41`) → дискард |

Базовый каталог проверен: P-RULE-01 = process rule (`validation.md:599-617`); enforcement через
`ic-change-trigger.js` (non-blocking, `:144-149`); канонический агент = `agents/product/devils-advocate.md`
(frontmatter `name: product-devils-advocate`).

## Proposed patch (if survived)

- **Type:** `codify-pattern` (R1's «pattern» half — наименьший механизм, убирающий **silent-bypass** часть корня)
- **Target files:**
  - НОВЫЙ `dev/meta-improvement/patterns/da-subagent-type-contract.md` — кодифицировать контракт.
  - `skills/product/feature-session.md` (§ DA orchestration flow, строки ~345-360) — добавить в hook-driven
    бриф **явный** `subagent_type: "product-devils-advocate"` (зеркало `product-da-review.md:118,234`) +
    правило anti-fallback.
- **Change (описание, НЕ применять):** Pattern «DA subagent_type contract»: (1) DA всегда вызывается с
  `subagent_type: "product-devils-advocate"` — и в ручном, и в hook-driven путях; (2) ответ харнесса
  **«Agent type ... not found» = BLOCKING setup-ошибка** → STOP, surface пользователю «канонический DA-агент
  не зарегистрирован», **запрет молча падать в `general-purpose` + role-adoption**; (3) если DA не вызван
  после IC/BR-сигнала — не переводить артефакт в active. Cross-ref DEC-DEV-0043 R1/R4 и tech-debt/PHASE_4.md.
- **Risk:** low для самого паттерна (это discipline-документ + одна правка skill-брифа, поведенческий контракт
  не ломается). **НО** паттерн делает провал громким, а **не** чинит регистрацию: остаточный дефект
  (почему `product-devils-advocate` «not found» — вложенный путь `agents/product/` vs `name`-поле vs stale
  bootstrap пилота) **не определён из этого репо** и требует live-harness проверки — это часть R4, отдельный
  механизм бóльшего риска. Не предлагать конкретную правку bootstrap без этой верификации (иначе — ровно
  plausible-but-wrong патч, против которого предостерегает DEC-DEV-0057 Lesson #1).
- **Confidence / estimate:** confidence **medium** (паттерн верифицирован и корректен; полное устранение корня
  зависит от непроверенной регистрации). Estimate: ~1-2 ч на pattern + skill-правку; регистрационный фикс
  (R4) — отдельная сессия с harness-проверкой. **Per DEC-DEV-0043 обязателен re-check альтернатив R1/R4
  перед исполнением** (`DEV_JOURNAL.md:3359/3373`).

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

> Рекомендация синтезатора: это уже tracked-долг (DEC-DEV-0043 R1+R4). Разумный выбор — **[Y]** если
> берём R1 в работу сейчас (паттерн + skill-бриф), с обязательным отдельным R4-шагом на регистрацию;
> либо **[D]** если осознанно держим как known debt. Дискард `e5ea9d` (не нарушение) и down-weight
> `1eb76ab` (cosmetic) рекомендуется отметить в journal вне зависимости от выбора.
