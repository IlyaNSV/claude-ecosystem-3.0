# Loop-Readiness Audit — P1 / P2 / P2.5 (Epic B / B4)

> **Что это:** аудит каждого шага продуктовых процессов (P1 Discovery+Planning, P2 Feature Definition, P2.5 Design) на пригодность к **bounded completeness-loop** (Epic B концепта [ECOSYSTEM_VISION.md](ECOSYSTEM_VISION.md)). Для каждого шага: **loop-safe?** (можно ли безопасно перезапускать в волне) · **идемпотентность** (что обязано быть update-in-place, а не append/create-new) · **гейт** (точка человеческого решения, которую loop НЕ исполняет, а эскалирует). Выход информирует стоп-условия и идемпотентный дизайн **B1** (`completeness-oracle` + bounded-loop).
>
> **Источники-факты:** [docs/pmo/processes.md](docs/pmo/processes.md) (§3.1–§3.3, §2 gates, §4 cascade, §5 BG), [docs/pmo/validation.md](docs/pmo/validation.md), DEC-DEV-0089 (PA-dedup idempotency lesson), DEC-DEV-0098 (Increment 1 kickoff).
> **Статус:** `complete` (Increment 1, B4). Дата: 2026-06-24. Не Phase-N — cross-module vision-трек.

---

## 0. Модель: что значит «loop-safe / идемпотентно / гейт»

Completeness-loop (Epic B) прогоняет **волны** доведения артефактов D1-D2B до «достаточной» полноты: каждая волна = (профильные персоны/DA проходят по артефактам) → (gaps классифицируются: разрешимо-авто vs нужен decision) → (разрешимое — авто-фикс с verify-before-act; decision — эскалация). Поэтому каждый шаг процесса попадает в один из трёх классов **по отношению к телу волны**:

| Класс | Значение | Что делает loop |
|---|---|---|
| 🟢 **loop-body** | Дериват/обогащение из upstream; перезапуск даёт тот же результат при чистом входе | **исполняет в волне** (авто-фикс), нужна идемпотентность |
| 🟠 **idempotency-critical** | Имеет сайд-эффект записи (append / new-file / status-transition / commit) | исполняет, но **только** с update-in-place ключом; иначе дубль |
| 🔴 **gate / escalate** | Стратегическое человеческое решение (соответствие реальности, пороги, MoSCoW) | **НЕ исполняет** — эскалирует в очередь decision (vision B3) |
| ⚪ **read-only** | Загрузка контекста, без записи | свободно, идемпотентно тривиально |

**Корневая угроза идемпотентности (orchestrator §2-bis / DEC-DEV-0089):** шаг, который **пишет артефакт, затем отдельно коммитит**, уязвим к крэшу/перезапуску между write и commit — повторный прогон **аппендит дубль** вместо обновления (ровно баг PA-013/014/015: гейт слепо аппендил PA вместо «уже-routed → update»). Для loop это смертельно: волна по определению перезапускает шаги. **Вывод для B1:** каждый write-шаг тела волны обязан матчить по стабильному ключу (artifact-id / signature) и **обновлять на месте**, а стоп-детектор — отличать «новый прогресс» от «повторно записал то же».

**Граница «достаточности» (B2):** loop останавливается не по «идеалу», а по **handoff DoR** (`handoff-spec.md` §7) — что реально потребляют downstream-агенты (cc-sdd/impl). Стоп = `max-waves cap` И (`score ≥ τ` ИЛИ `Δscore < ε` ИЛИ `info-gain открытых вопросов → 0`).

---

## 1. P1.A Discovery Session (D1.1–D1.5z)

| Шаг | Выход | Gate (processes §2.2) | Класс | Идемпотентность | Предохранитель для B1 |
|---|---|---|---|---|---|
| **D1.1** Problem Discovery | PS | **G1** 🟠 Strategic per-item | 🔴 gate | — | PS = корень; «соответствие реальности» — человек. Loop НЕ переписывает PS, только флагует gaps (нет SEG-привязки и т.п.) → escalate |
| **D1.2** Market Research | MR draft | queued → DRC | 🟠 idem-critical | MR — singleton-файл; **update-in-place** (regen перезаписывает, не плодит MR-2) | Re-research безопасен при перезаписи; loop может дозаполнить пробелы покрытия (TAM/SAM/SOM), но `[оценочно]`-метки сохранять |
| **D1.3** Competitive Analysis | CA draft | queued → DRC | 🟠 idem-critical | CA — singleton; update-in-place; feature-matrix merge по конкуренту-ключу, не append-дубль | То же, что MR; дедуп конкурентов по имени |
| **D1.4** Segment & JTBD | SEG-* (2-4) | **G4** 🟠 Strategic per-SEG | 🔴 gate | new-file per SEG — **create keyed on SEG-id** | «Для кого делаем» — человек. Loop предлагает кандидатов-сегментов как gap, не утверждает |
| **D1.4.5** Discovery Review Checkpoint | MR, CA → active | 🟡 batch approve | 🔴 gate | status-transition | Batch human approve — естественная ratchet-точка; loop не авто-аппрувит 🟡 |
| **D1.4a** Value Proposition | VP-* (1:1 к SEG) | **G4a** 🟠 per-VP | 🟠 idem-critical | VP 1:1 SEG → **key = SEG-id**; re-derive обновляет VP того же SEG | Дериват из SEG+CA; loop-body-кандидат, НО strategic-gate на approve → loop готовит draft, эскалирует approve |
| **D1.5** Hypothesis Formulation | HYP-* (3-5), status=testing | **G5** 🟠 per-HYP | 🔴 gate | new-file keyed on HYP-id | **Пороги success/invalidation = человек** (vision: связанное решение). Loop флагует «HYP без метрики/порога» как gap → escalate, не выдумывает порог |
| **D1.5z** BG extraction финал | BG batch (~15-30) | human approve batch | 🟠 **idem-critical (высокий риск)** | **append-семантика** `.product/.pending/bg-candidates.yaml` + glossary entries → **дедуп по term** (Levenshtein/shared-root, §5 Phase 2 уже есть `existing-term`/`possible-synonym`) | Канонический случай DEC-DEV-0089: повторный прогон обязан **не плодить** дубль-кандидатов. B1 переиспользует существующую классификацию Phase 2 как dedup-ключ |

**Вывод P1.A:** ядро Discovery — 🔴 **strategic gates** (PS/SEG/HYP/DRC): «соответствие реальности» и пороги — это ровно «связанные/необратимые» решения, которые vision §4 запрещает авто-решать. Loop здесь = **детектор пробелов + подготовщик черновиков**, исполняет только дериваты (VP) и research-refresh (MR/CA) при строгой перезаписи-на-месте. BG — главная idempotency-ловушка.

---

## 2. P1.B Planning Session (D1.6–D1.8)

| Шаг | Выход | Gate | Класс | Идемпотентность | Предохранитель для B1 |
|---|---|---|---|---|---|
| **D1.6** MVP Scope | MVP | per-artifact approve | 🔴 gate | MVP — singleton; update-in-place | **MoSCoW priorities = человек.** Loop флагует «фича без MoSCoW / без HYP-привязки» → escalate |
| **D1.7** Product Roadmap | RM | per-artifact approve | 🟠 idem-critical | RM — singleton; update-in-place | Дериват из MVP+HYP; loop может дозаполнить, approve strategic → эскалация |
| **D1.8** Release Planning | RL-001 + FM skeletons | per-FM + RL approve | 🔴 gate | new-file keyed on RL-id / FM-id | Состав релиза + has_ui/priority per FM = человек. **FM skeleton create обязан быть keyed on FM-id** (повтор не плодит FM-007-bis) |

**Вывод P1.B:** планирование — почти целиком 🔴 gate (scope = человеческое суждение, эмпирика RUN 01: все гейты были в scope-фазе). Loop-вклад минимален: дозаполнение RM + структурные gap-флаги (FM без HYP, RL без target_date).

---

## 3. P2 Feature Definition (F.1–F.10) — ОСНОВНАЯ ЗОНА LOOP

> Это primary-зона completeness-loop (обогащение FM до handoff-ready). Здесь больше всего 🟢 loop-body и 🟠 idem-critical.

| Шаг | Выход | Gate (processes §2.4) | Класс | Идемпотентность | Предохранитель для B1 |
|---|---|---|---|---|---|
| **F.1** Load FM context | — | — | ⚪ read-only | тривиально | Свободно перезапускается каждой волной |
| **F.2** Scenario Authoring | SC-* | per-SC approve 🟠 Strategic | 🔴 gate (на approve) / 🟢 на draft | new-file keyed on SC-id; alt/error flows = отдельные SC keyed on suffix (SC-005a) | Loop предлагает недостающие alt/error-flows как gap (vision: usability/flows — ux-advisor), но approve SC = человек/strategic |
| **F.3** Business Rule Extraction | BR-* | per-BR approve **🔴 Critical** + **P-RULE-02 DA** | 🔴 gate | keyed on BR-id; `scenarios[]` bi-dir = **update-in-place** | 🔴 Critical — никогда не auto. DA-review (adaptive-depth) — уже субагент; loop эскалирует на approve |
| **F.4** Entity Lifecycle | LC-* | 🟢 Confirmation (**auto-approve**) | 🟢 **loop-body** | keyed on entity → LC-id; states/transitions merge, не дубль | **Идеальный loop-body**: дериват из SC+BR, auto-approve при `confidence:high` + чистая валидация (§2.5.2). B1 re-derive обновляет LC того же entity |
| **F.5** Invariant Check | IC-* | per-IC approve **🔴 Critical** + **P-RULE-01 DA** | 🔴 gate | keyed on IC-id | 🔴 Critical — никогда не auto. Loop предлагает IC-кандидатов как gap (qa-advisor: edge-cases/инварианты) → escalate + DA |
| **F.5a** NFR Review | NFR-* + `nfr_status` | 🟠 (opt-in: [Y]/[D]/[L]) | 🟠 idem-critical | `FM.nfr_status` write + NFR-* keyed on id | **Ask-фаза [Y/D/L] = человек.** Но «pending» NFR — это явный loop-gap (qa/architect-advisor дают realistic defaults как предложение). status write обязан быть idempotent (re-ask не сбрасывает declined→pending) |
| **F.6** Verification Criteria | VC-* | 🟢 Confirmation (**auto-approve**) | 🟢 **loop-body** | keyed on VC-id; coverage main+alt+error | **loop-body**: дериват из SC+BR+LC+NFR, V-07 coverage-check = естественный sub-oracle для completeness score |
| **F.7** Role & Permission Model | RPM update | 🟢 Confirmation | 🟢 **loop-body** | RPM — singleton matrix; **merge by role+action**, не дубль строк | loop-body: добавление ролей/actions из SC.actors; матрица — классическая idempotency-ловушка (append строки vs merge) |
| **F.8** Design Module → P2.5 | MK/DS/NM/AM | (см. §4) | 🔗 delegate | см. P2.5 | Параллельная ветка; loop координирует через has_ui, не дублирует P2.5 |
| **F.9** Product DA Review | DA findings | optional | 🟠 idem-critical | **append-файлы** `.da-findings/<id>-<timestamp>.md` → timestamp плодит дубли при повторе! | ⚠ **idempotency-риск**: timestamp-в-имени = каждый прогон новый файл. B1: дедуп по (FM, finding-signature) или один файл per (FM, дата), не per-прогон |
| **F.10** FM status transition | FM → in-progress + DoR | DoR-gate (§7 handoff) | 🟠 idem-critical / 🔴 на финал | status write idempotent (повтор planned→in-progress = no-op если уже in-progress) | **Это естественный стоп-детектор loop**: DoR-check (V-H-01..11 + V-16) = «достаточность достигнута?». τ привязывается СЮДА (vision B2). Финальный transition — после стоп |

**Вывод P2:** F.4 (LC), F.6 (VC), F.7 (RPM) — чистые **loop-body** деривативы (уже спроектированы под auto-approve 🟢 — готовая опора для волны). F.3 (BR) / F.5 (IC) — 🔴 Critical-гейты с DA, всегда эскалируются. **F.10 DoR-check = встроенный стоп-оракул** (граница достаточности B2). **F.9 DA findings (timestamp-файлы) = idempotency-риск №2** после BG.

---

## 4. P2.5 Design Module (D.1–D.6, conditional has_ui)

| Шаг | Выход | Gate (processes §3.3) | Класс | Идемпотентность | Предохранитель для B1 |
|---|---|---|---|---|---|
| **D.1** Design Brief | brief (editable) | 🟡 Review | 🟢 loop-body | brief — регенерируемый, не финальный артефакт | Дериват из SC+BR+LC+BG+RPM; loop-safe (перезапись) |
| **D.2** Screen Generation | screens (variant 1) | 🟠 Strategic | 🔴 gate | внешний (Stitch/HTML) сайд-эффект | Визуальное решение = человек; внешний MCP-вызов **не** идемпотентен (rate-limit 350/мес) → loop **не** перегенерирует вслепую |
| **D.3** Iterative Refinement | MK iterations | 🟠 at final | 🔴 gate | MK version++ | Сам по себе ручной цикл; **не** автоматизировать поверх completeness-loop (двойной loop) |
| **D.4** Component State Matrix | states | 🟢 Confirmation | 🟢 loop-body | keyed on component → states merge | **loop-body**: checklist-покрытие состояний (default/hover/focus/error/disabled/loading/empty/overflow) = под-оракул completeness (ux-advisor зона) |
| **D.5** Artifact Generation | MK/DS/NM | 🟠 Strategic | 🟠 idem-critical | MK keyed on id; DS token-extract **merge by token**; NM keyed; AM singleton | DS/AM — idempotency-ловушки (merge vs append токенов/строк) |
| **D.6** Export for handoff | §10 handoff | — | 🟠 idem-critical | §10 — перезапись секции | Перезапись секции, не append |

**Вывод P2.5:** внешне-зависимые шаги (D.2/D.3 через Stitch MCP) — **жёсткие гейты + не-идемпотентный внешний эффект** (rate-limit) → loop их не крутит. D.1 (brief) и D.4 (state-matrix) — loop-body; D.4 даёт под-оракул полноты UI.

---

## 5. Синтез для B1 (что переносится в completeness-oracle + bounded-loop)

### 5.1. Тело волны (что loop исполняет авто)
Только 🟢 **loop-body** деривативы с auto-approve-семантикой: **LC (F.4), VC (F.6), RPM (F.7)** в P2; **design brief (D.1), state-matrix (D.4)** в P2.5; **research-refresh (MR/MD.2-3)** с перезаписью. Все — at-confidence-high + чистая валидация (§2.5.2), иначе → стандартный путь (= эскалация).

### 5.2. Точки эскалации (loop НЕ решает, кладёт в decision-очередь — vision B3)
Все 🔴 **gate**: PS (G1), SEG (G4), HYP пороги (G5), MVP MoSCoW (D1.6), RL/FM состав (D1.8), **BR (F.3, 🔴 Critical + DA)**, **IC (F.5, 🔴 Critical + DA)**, NFR Ask-фаза (F.5a), Design screen-решения (D.2/D.3). Это «связанные/необратимые» решения из vision §4 кластер 2/3.

### 5.3. Идемпотентность — обязательные ключи (иначе дубли при перезапуске волны)
| Зона | Опасность | Ключ update-in-place |
|---|---|---|
| **BG candidates** (D1.5z) | append дублей (DEC-DEV-0089 класс) | `term` + Phase-2 классификация (existing/synonym) |
| **DA findings** (F.9) | timestamp-в-имени → файл-на-прогон | `(FM, finding-signature)` или один файл per (FM, дата) |
| **RPM / DS / AM** matrices | append строк/токенов vs merge | `role+action` / `token` / `NM-ref` |
| **bi-dir refs** (`scenarios[]`, `rules[]`) | дубль-ссылки | set-семантика (V-11 уже гарантирует) |
| **`.pending/*.yaml`** (validation/cascade) | повторный append | signature-дедуп (как PA-dedup 0089) |
| **status transitions** | повторный transition | no-op если целевой статус уже стоит |

**Правило B1:** любой write-шаг тела волны = «scan-and-update-in-place, append только при no-match по стабильному ключу» (прямой перенос фикса DEC-DEV-0089 в дизайн loop с первого дня).

### 5.4. Стоп-оракул (граница достаточности B2)
**Якорь = F.10 DoR-check** (`handoff-spec.md` §7: V-H-01..11 + V-16 NFR coverage + embedded V-01..15). `completeness-oracle` считает покрытие против этого набора, НЕ против «идеала». Стоп волны:
`stop = (wave ≥ max_waves) OR (score ≥ τ_DoR) OR (Δscore < ε) OR (open-decisions info-gain → 0)`.
Никогда не само-оценка генератора как единственный стоп (vision §4 кластер 1, Huang et al.) — score считает **детерминированный oracle** (покрытие validation/DoR), не сам автор артефакта.

### 5.5. Учёт crash-семантики (orchestrator §2-bis)
Волна должна быть **возобновляемой**: перед действием — проверка «уже применено?» (по ключу 5.3), чтобы крэш между write и commit не вызвал двойной аппенд при рестарте. Это тот же verify-finding-before-act / order-aware-baseline паттерн, что оркестратор уже выработал (DEC-DEV-0087/0093) — переиспользовать концепт, не изобретать.

---

## 6. Связь с остальным Increment 1
- **A (персоны)** дают «голоса» волны: `architect-advisor` (feasibility-gaps), `qa-advisor` (IC/VC/edge-case-gaps, NFR realistic defaults), `ux-advisor` (SC alt/error-flows, D.4 state-coverage). Их зоны ровно мапятся на loop-body/gap-классы выше.
- **A2 (zone-routing)** решает, какую персону звать на затронутую зону — детерминированно, по той же зональной разметке, что в этом аудите.
- **B1** реализует §5: oracle (5.4) + bounded-loop (5.1/5.2) + идемпотентные write (5.3/5.5).

**Конец LOOP_READINESS_AUDIT.md.**
