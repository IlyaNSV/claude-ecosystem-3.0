---
description: Domain Fit Assessment (D1.0b) — classify the product idea into one of 96 registry subcategories (max granularity), look up the aggregate ecosystem-fit score, apply the gate threshold (default 75) and record the domain_fit block in product.yaml. Two modes — discovery (called by discovery-session after D1.0) and assess (standalone backfill / re-assessment). The ONLY class-based gate in the ecosystem; owner override always legal and recorded.
---

# Domain Fit — assessment & gate skill

Классифицирует идею продукта по домену (реестр 96 подкатегорий) и проводит через гейт
соответствия. Концепт, гейт-семантика и протокол обновления —
[`docs/pmo/domain-expertise.md`](../../docs/pmo/domain-expertise.md) (SSOT). Данные —
[`docs/pmo/domain-expertise-registry.md`](../../docs/pmo/domain-expertise-registry.md).
Этот skill — методология классификации + гейт-диалог + запись.

**Принцип (DEC-DEV-0169):** единственный класс-гейт экосистемы. Балл подкатегории ниже
порога (дефолт **75**) останавливает Discovery до явного решения владельца. Гейт
производит информированное решение, не запрет: override легален и фиксируется.

## Когда загружается

- **Режим `discovery`** — из `discovery-session.md` шаг D1.0b (после D1.0 Product
  Classification, до D1.1 Problem Discovery).
- **Режим `assess`** — standalone: backfill для проекта с уже пройденным Discovery;
  переоценка после обновления реестра или пивота идеи; прямая просьба пользователя
  («насколько экосистема подходит под X?»).

## Канонический блок (НЕ варьировать имена полей)

```yaml
domain_fit:
  subcategory: A1                  # ID из реестра (A1..P4) | `unmapped`
  subcategory_label: "B2B SaaS (vertical/horizontal)"
  score: 92                        # агрегат из реестра — НЕ пересчитывать, только lookup
  threshold: 75                    # действующий порог (дефолт 75; override только владельцем)
  verdict: fit                     # fit | conditional-fit | misfit | unmapped
  decision: proceed                # proceed | proceed-with-risks | adapted | aborted
  limiters: ""                     # ограничитель из реестра + гибрид-примечания
  hybrid_components: []            # (опц.) [{subcategory, score, role: core|supporting}]
  confidence: high                 # high | medium | low — уверенность классификации
  source: discovery                # discovery | manual
  registry_version: "2026-07-10"   # из шапки реестра на момент оценки
  assessed_at: "<ISO date>"
  notes: ""                        # ОБЯЗАТЕЛЕН если unmapped или decision != proceed
```

**Anti-pattern field names — НЕ переименовывать «для естественности»** (B.1 convention,
DEC-DEV-0012 дух):

- ❌ `domain`, `category`, `domain_category`, `product_domain` → canonical = `subcategory`
- ❌ `fit_score`, `rating`, `aggregate`, `points` → canonical = `score`
- ❌ `result`, `status`, `gate_result`, `fit` (bare) → canonical = `verdict`
- ❌ `resolution`, `outcome`, `user_decision`, `override` → canonical = `decision`
- ❌ `limitations`, `constraints`, `weaknesses`, `risks` → canonical = `limiters`
- ❌ `confidence_rationale`, `reasoning`, `rationale` → для пояснения используй `notes`

## Процедура (оба режима)

### Шаг 1: Классификация — по ядру ценности

Из описания идеи (+ `product_class.archetype` из D1.0 как подсказка формы) определи:

1. **Категорию** (A–P, 16 секций реестра) — грубая навигация.
2. **Подкатегорию** (максимальная детализация, 96 позиций) — по правилу ядра:
   **где лежит ядро ценности продукта, а не обвязка**. Дашборд/CRUD/биллинг вокруг
   алгоритмического ядра не делают продукт «своим» (реестр различает: game-backend D6=74
   против самой игры D2=39).
3. **Гибрид?** Если идея расщепляется на компоненты разных подкатегорий — определи
   каждый и его роль: `core` (ядро ценности) / `supporting` (обвязка). Вердикт пойдёт
   по `core`; два равноправных ядра → по слабейшему (консервативно).

### Шаг 2: Подтверждение пользователем (один вопрос)

```
D1.0b Domain Fit (промежуточный этап: соответствует ли домен идеи сильным зонам экосистемы).

Я отношу идею к: [A1] B2B SaaS (vertical/horizontal)
  (ядро ценности: <одно предложение — почему сюда>)
  <если гибрид: + компоненты с ролями>

Верно? [Y / другая подкатегория / это гибрид]
```

Не соглашается — покажи 2–3 ближайших кандидата из реестра с их формулировками, дай
выбрать. `confidence`: high — уверенное совпадение, подтверждено сразу; medium —
выбрали из кандидатов / гибрид со спорными ролями; low — натяжка, ни одна не ложится
хорошо (рассмотри `unmapped`).

### Шаг 3: Lookup и вердикт

1. Возьми строку подкатегории из реестра: агрегат (**не пересчитывай** — колонка
   «Агрегат»), колонку «Ограничитель/сила», при необходимости баллы C1–C10.
2. Порог: `threshold` из существующего блока `domain_fit` в `product.yaml`, иначе
   дефолт **75**.
3. Вердикт: `score >= threshold` → `fit`; `50 <= score < threshold` → `conditional-fit`;
   `score < 50` → `misfit`; не классифицируется → `unmapped`.

### Шаг 4: Гейт-диалог

**`fit`** — одна строка, без паузы:

```
✓ Domain Fit: A1 B2B SaaS — 92/100 (порог 75). Сильная зона: <сила из реестра>. Продолжаем.
```

**`conditional-fit` / `misfit`** — СТОП. Покажи:

```
⚠ Domain Fit: <ID> <label> — <score>/100, ниже порога <threshold>.
Разбивка: C1 Discovery <..> | C2 Поведение <..> | C4 Handoff <..> | C9 Delegated <..>  (остальные по запросу)
Ограничитель: <колонка «Ограничитель/сила» дословно>
<для misfit добавь прямо: ядро продукта — вне парадигмы экосистемы; она не выразит: <что именно>>

Варианты:
  [1] Адаптировать идею — перекроить под выразимую половину (<конкретное предложение
      гибрид-паттерна: какой компонент оставить/выделить>) → повторная оценка
  [2] Продолжить с рисками — экосистема ведёт выразимую часть, ядро <X> за скобками
      handoff (фиксируется письменно в limiters/notes)
  [3] Остановиться
```

Для `misfit` рекомендация по умолчанию — [1] или [3], скажи это явно. Выбор → `decision`:
`adapted` (после адаптации вернись к Шагу 1 заново) | `proceed-with-risks` (`limiters` +
обязательный `notes`) | `aborted` (Discovery не продолжается, блок остаётся следом решения).

**`unmapped`** — advisory, НЕ блокирует (открытый мир, зеркало `archetype: other`):

```
Domain Fit: домен идеи не покрыт реестром (96 подкатегорий, версия <дата>).
Ближайшие якоря: <2-3 подкатегории с баллами> — ориентир, не вердикт.
Продолжаем по твоему решению; фиксирую unmapped + notes (кандидат на добавление в реестр
по протоколу обновления).
```

### Шаг 5: Запись в product.yaml

1. `Read` `.claude/product.yaml`.
2. Блок `domain_fit:` отсутствует — добавь (рекомендуемое место: сразу после блока
   `product_class`). Присутствует — `Edit` значения.
3. Сохрани канонический порядок полей; `registry_version` — из шапки реестра;
   `source: discovery` (режим discovery) | `manual` (режим assess).
4. **Идемпотентность:** повторный запуск читает существующий блок; в режиме `assess`
   при заполненном блоке — покажи текущее и спроси, переоценивать ли (не молча overwrite).

## Режим assess — отличия

1. Идея берётся не из аргумента `/product:init`, а из существующих артефактов: PS, MVP
   scope, FM-заголовки (+`product_class`). Сформулируй одним предложением «что за продукт»
   и подтверди у пользователя перед классификацией.
2. Гейт-диалог тот же, но «Остановиться» означает «зафиксировать misfit в блоке» —
   прервать уже идущий проект skill не предлагает, это решение владельца вне гейта.
3. После записи: если вердикт ухудшился/улучшился против прежнего — покажи diff прежнего
   и нового блока.

## Anti-patterns

1. **Классифицировать по обвязке.** «У продукта есть дашборд» ≠ web-app. Ядро ценности
   решает. Если ловишь себя на выборе подкатегории по вторичному компоненту — вернись
   к правилу ядра.
2. **Подкручивать баллы под желаемый вердикт.** Только lookup. Балл кажется устаревшим →
   скажи это пользователю + протокол обновления (`domain-expertise.md §6`); в блок всё
   равно пиши текущий балл реестра.
3. **Молча продолжать при conditional-fit/misfit.** Гейт обязан остановиться и получить
   явное решение. Пропуск гейт-диалога = баг.
4. **Блокировать без выхода.** Owner-override (`proceed-with-risks`) легален всегда;
   `unmapped` не блокирует вовсе. Жёсткий отказ «нельзя, домен не тот» — баг дизайна.
5. **Оценивать качество идеи.** Гейт меряет соответствие домена инструменту, не
   перспективность продукта. Формулировки «идея слабая» запрещены; «экосистема здесь
   слаба» — корректно.
6. **Контаминация PS.** Вердикт/домен не пишутся в PS (tech-free). Только `product.yaml`.
7. **Раздувание диалога.** Fit-случай = одна строка. Один вопрос подтверждения
   классификации; не допрашивай по каждому критерию.

## Related

- Концепт (SSOT): `docs/pmo/domain-expertise.md`
- Данные: `docs/pmo/domain-expertise-registry.md`
- Discovery-интеграция: `skills/product/discovery-session.md` (D1.0b)
- Соседний шаг формы: `skills/product/product-class.md` (D1.0)
- SSOT-локация блока: `commands/ecosystem/bootstrap.md` Step 7 (`product.yaml`)
- Решение: `DEV_JOURNAL.md` DEC-DEV-0169
