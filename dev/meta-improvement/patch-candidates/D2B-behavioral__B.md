---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: B
verdict: refuted
instances: 6
sessions: 6
severity: blocking
confidence: high
patch_type: none
risk: low
finding_ids: [594322f47ffd, 6df3e58adcc5, 1eb76ab23bd4, 4ab0c898e4a2, 81113d433b06, e5ea9d1081fe]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — see Verdict); per-finding re-routes in Evidence
---

# Patch candidate — D2B-behavioral / B

## Verdict (adversarial verification)

**Majority verdict: REFUTED как НОВЫЙ патч — already-handled (2/3 решающих линзы).** Проблема **реальна и
системна** (это не misread аудитора), но prompt-scope механизм для неё **уже принят и развёрнут** четыре дня
назад (DEC-DEV-0064, 2026-06-12), а единственный остаток — сознательно отложенный live-harness шаг (R4) плюс
отставание версии пилота (DEC-DEV-0065 шаг 4). Оба имеют owner'а и оба **вне досягаемости этого read-only
синтезатора**. Все цитаты ниже проверены прямым чтением файлов этого репо.

⚠ **Это тот же кластер, что уже прошёл human-gate `[Y]`.** Прежний кандидат
[`dev/_archive/meta-improvement/patch-decisions/D2B-behavioral__B.md`](../../_archive/meta-improvement/patch-decisions/D2B-behavioral__B.md)
с finding_ids `[594322f47ffd, 1eb76ab23bd4, 4ab0c898e4a2, 81113d433b06, e5ea9d1081fe]` был принят
`gate: accepted [Y] 2026-06-12 → DEC-DEV-0064`. Текущий кластер = те же 5 + **одна новая инстанция
`6df3e58adcc5`** (сессия `ebf3cc2c`, 2026-06-16 audit, работа 2026-06-12/13). Вопрос синтеза, следовательно,
не «реальна ли проблема» (доказано прежде), а «оправдывает ли новая инстанция **новый** механизм».

### Lens 1 — Reality (genuine violation?) → REAL (но измерено против ещё-не-доехавшего скилла)

Новая инстанция `6df3e58adcc5` — **genuine, high.** Report
[`audit-reports/ebf3cc2c-…md:125-132`](../../audit-reports/ebf3cc2c-af71-46d5-bc3e-3db2722798a9.md) дословно:
`[289] TOOL Agent: subagent=general-purpose :: Batch DA review IC-033..036`, без STOP и без surfacing
«agent not found» к user. Поведенчески — ровно failure mode кластера. Прежние 5 findings уже разобраны в
архивном кандидате (3 сильных + 1 cosmetic-слабое `1eb76ab23bd4` + 1 дискард `e5ea9d1081fe`).

**Но reality-caveat существенный:** инстанция в пилоте измерена против **экосистемного** скилла, которого у
пилота на момент работы НЕ было. Report сам так и квалифицирует соседнюю находку A (`:143-149`):
«**pre-existing pilot↔ecosystem drift … not as a session defect**», ссылаясь на DEC-DEV-0065. Та же рамка
применима к DA-контракту: anti-patterns #9/#10 — продукт DEC-DEV-0064 (2026-06-12), а пилот на тот момент был
`byte-equal v1.4.0` (DEC-DEV-0065, `DEV_JOURNAL.md:5152` — 0064 числится в «экосистема впереди», *ещё не
пропагировано*). Сессия шла на **pre-0064** скилле. → REAL, но новизны как сигнала о провале механизма нет.

### Lens 2 — Systemic (новый корень или тот же?) → SYSTEMIC, но ТОТ ЖЕ корень

Не совпадение `(zone,check)` — все 6 инстанций один корневой класс: **P-RULE-01 (IC→DA) не обеспечивается
каноническим reviewer'ом; харнесс отвечает «product-devils-advocate not found» → тихий fallback в
`general-purpose`.** Это в точности корень, диагностированный DEC-DEV-0038 → 0043 (E1/E2) и принятый
DEC-DEV-0064. Новая инстанция SYSTEMIC — но это **уже принятая системная проблема**, не новая.

### Lens 3 — Already-handled (существующий механизм закрывает?) → ДА, развёрнут; остаток вне scope

**Решающая линза.** Prompt-scope механизм СУЩЕСТВУЕТ и РАЗВЁРНУТ (DEC-DEV-0064, проверено прямым чтением):

- **Hook-driven путь:** [`skills/product/feature-session.md`](../../../skills/product/feature-session.md) —
  явный канонический сниппет `subagent_type: "product-devils-advocate"` (L355), **anti-pattern #9** (L611,
  запрет `general-purpose`, явно «касается и **batched** F.3 DA … per DEC-DEV-0064») и **#10** (L612,
  «not found» = BLOCKING setup-ошибка → STOP, не тихий fallback; «отдельный live-harness шаг … DEC-DEV-0043 R4»).
- **Manual путь:** [`skills/product/product-da-review.md`](../../../skills/product/product-da-review.md) —
  `subagent_type: "product-devils-advocate"` (L118) + **anti-pattern #5** (L234).
- **D7 pattern:** [`patterns/da-subagent-type-contract.md`](../da-subagent-type-contract.md) (3 clauses;
  clause 3 прямо: «Do not patch bootstrap/registration speculatively from prompt scope»).

Остаток (registration root-cause, **R4**) — **известен, tracked и СОЗНАТЕЛЬНО отложен** в live-harness:
`dev/tech-debt/PHASE_4.md:114-123` (R4 `[OPEN]`) + журнал статусов `:144-149` (единственная запись
2026-05-26, без FIXED); DEC-DEV-0064 решение #2 (`DEV_JOURNAL.md:5118`: «R4 … НЕ трогаем — требует
live-harness … спекулятивный bootstrap-фикс = ровно plausible-but-wrong патч, против которого
DEC-DEV-0057 Lesson #1»). Вторая половина остатка — **отставание пилота**: пропагация 0064 в пилот = шаг 4
плана `dev/PILOT_RECONCILIATION_PLAN.md` (DEC-DEV-0065, `DEV_JOURNAL.md:5182`), ещё не выполнен.

Любой патч, который мог бы предложить синтезатор, уже исчерпан:
1. **Re-codify pattern** → избыточно (сделано 0064).
2. **Чинить registration (R4)** → вне prompt-scope, требует live-harness; спекулятивная правка = именно тот
   plausible-but-wrong патч (DEC-DEV-0057 Lesson #1, pattern clause 3).
3. **Жёсткий enforcement-hook** → уже **отвергнут** в DEC-DEV-0064 решение #4 (`DEV_JOURNAL.md:5120`:
   «PostToolUse не наблюдает `subagent_type` … template-fix = наименьший механизм, CONVENTIONS §3»).
4. **Пропагировать патч в пилот** → это DEC-DEV-0065 шаг 4 (reconciliation), не D7-патч.

→ **Verdict-rule:** кластер выживает только если большинство линз → real ∧ systemic ∧ **not already handled**.
Условие «not already handled» **проваливается** (2/3 решающих линзы). → **REFUTED как новый патч.** «Refuted»
здесь означает «не новый actionable механизм; already-handled и tracked» — НЕ «находки ложны».

## Problem (if survived)

n/a — не survived. (Для полноты: корень — сломанная регистрация `product-devils-advocate` в харнессе пилота
+ тихий `general-purpose` fallback; диагностирован DEC-DEV-0038/0043, prompt-scope mitigation принята
DEC-DEV-0064, registration-фикс = открытый R4 / live-harness.)

## Evidence

| finding_id | session | артефакт | статус | вердикт |
|---|---|---|---|---|
| `6df3e58adcc5` | ebf3cc2c | `IC-033..036` (.product/invariants/, **пилот** my-first-test) | open | **genuine** (`ebf3cc2c-…md:289/125-132`), НО pre-0064 скилл (drift, не дефект канона) — дубликат уже-принятого корня |
| `594322f47ffd` | 0781ad12 | `IC-022..028` (7 new, active) | patched | уже patched под DEC-DEV-0064 |
| `4ab0c898e4a2` | 31394d98 | `.da-findings/IC-019-021-batch…` | patched | уже patched под DEC-DEV-0064 |
| `81113d433b06` | e1615a0c | `IC-019..023` (inline self-DA) | patched | уже patched под DEC-DEV-0064 |
| `1eb76ab23bd4` | 04649f41 | `invariants/*` + `verification/*` (26 русифицированы) | patch-proposed | **слабое (cosmetic)** — рубрика `D2B-behavioral.md:32`: косметика DA не требует |
| `e5ea9d1081fe` | bf7eaea4 | `IC-020/IC-021` (da-review remediation) | dismissed | **НЕ нарушение** (Info, intent satisfied) — дискард |

Проверено прямым чтением: механизм развёрнут — `feature-session.md:355/611/612`, `product-da-review.md:118/234`,
`patterns/da-subagent-type-contract.md`; остаток открыт — `tech-debt/PHASE_4.md:114-123/144-149`; контекст —
`DEV_JOURNAL.md` DEC-DEV-0064 (`:5092-5138`) и DEC-DEV-0065 (`:5142-5183`); пилот-провенанс новой инстанции —
`audit-journal.ndjson` (`target_project: my-first-test`).

## Proposed patch (if survived)

n/a — verdict `refuted`. Никакого нового механизма не предлагается.

- **Type:** `none`
- **Target files:** —
- **Change:** —
- **Risk:** —
- **Confidence / estimate:** —

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

> **Рекомендация синтезатора (refuted → dismiss):** новая инстанция `6df3e58adcc5` (status `open`) →
> **dismissed**, dismiss_reason: «дубликат already-patched кластера DEC-DEV-0064; prompt-scope механизм
> (anti-patterns #9/#10 + pattern) развёрнут; остаток = R4 registration (live-harness, отложен) + отставание
> пилота (DEC-DEV-0065 шаг 4) — оба tracked, оба вне scope синтезатора. Жёсткий hook отвергнут 0064 реш.#4».
> Реальный owner устранения рецидива в пилоте — **DEC-DEV-0065 шаг 4** (`/ecosystem:update` в пилот) для
> доставки патча + **R4 live-harness** для регистрации, а не новый D7-патч. Прочие 5 findings уже
> patched/dismissed — без изменений. Анти-фантом-память (CONVENTIONS §5.4): зафиксировать suppress-window,
> чтобы тот же кластер не всплывал каждым synth-прогоном до закрытия R4.
