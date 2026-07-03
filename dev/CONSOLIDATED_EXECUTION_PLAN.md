# Consolidated Open-Fronts Execution Plan — сводный последовательный план незавершённых работ

> **Назначение:** единый execution-план по ВСЕМ открытым фронтам экосистемы на 2026-07-03 —
> собран форензикой пяти параллельных сессий 2026-06-28..07-01 (транскрипты) + git log + DEV_JOURNAL
> (хвост 0140) + активные work-orders. Сессии закрыты чисто, но каждая оставила «следующий шаг»;
> этот док сшивает их в одну последовательность с чекпоинтами и live-валидациями.
> **Статус:** `proposal / pre-decision` (DEC-DEV назначается на kickoff исполнения этапа, не на этот док).
> **Как читать:** §1 — что было и где остановилось (as-is); §3 — этапы E0–E7 (to-be); §4 — проектировки
> для задач, поставленных без спроектированной реализации; §5 — развилки, ждущие владельца.
> **Источник-иерархия при конфликте:** `git log` + хвост DEV_JOURNAL > этот док > память > ROADMAP-снапшот.

---

## 0. As-is снапшот (верифицированные факты, 2026-07-03)

- `main` = `a8be54e` (merge PR #105), локальный == origin, дерево чистое, **0 открытых PR**.
- DEV_JOURNAL хвост = **DEC-DEV-0140**; next-free = **0141** (verify `git fetch` перед присвоением).
- Все PR #85–#105 смёржены 2026-06-30..07-01. Записей от 2026-07-02 в транскриптах **нет**
  (mtime 07-02 14:35 — перезапись метаданных session-picker, не работа).
- Единственная реально оборванная работа — **Research Wave 2 free-bakeoff** (батч-C убит session-limit);
  её данные жили только в temp сессии `bbf2c10a` → **спасены** в `dev/research-cache/wave2-free-bakeoff/`
  (queryset sha256 `beabbbd6…`, checkpoint, raw пилот n=7 + батч-B n=8 + failed батч-C, workflow-скрипт).
- CHANGELOG `[Unreleased]` копится с релиза **1.6.0 (2026-06-18)** — две недели работ, patch-cut назрел.
- Мусор: локальные ветки `feat/guide-glossary-gen`, `feat/process-map-elk-timeline`, `feat/process-map-bpmn`,
  `worktree-jiggly-sauteeing-narwhal`; remote-ветки `docs/vision-wave-b-kickoff`, `feat/guide-map-shell`,
  `feat/guide-glossary-gen`, `feat/guide-hub-layered`, `fix/process-map-doc-preview`,
  `fix/process-map-tidy-expand`, `feat/process-map-elk-timeline`, `feat/process-map-bpmn` (все merged);
  worktree `.claude/worktrees/jiggly-sauteeing-narwhal` (detached `d7b80f3`, чистый, сессия мертва).
- Память проекта: статус-записи отстают от `a8be54e` (фиксируют «PR #95 OPEN / next 0132»); журнал-факты новее.
- FB-ledger stale: FB-LR-28/29 значатся OPEN (починены 0140/#105); FB-LR-31/32 значатся OPEN
  (закрыты в P2 консилиуме 0135 — Epic D переиспользует, но статус в ledger не флипнут).

## 1. Пять фронтов: что хотели → что сделано → где остановилось

| # | Фронт (сессия) | Изначальный интент владельца | Доведено до main | Оборвано / следующий шаг |
|---|---|---|---|---|
| **1** | **Orchestrator** (`138db56a`, 30.06–01.07) | «Убедимся, что готово к пилотному прогону» → S7-dogfood → достроить последний P2 | S7 detect-leg+OD7 = STRONG PASS (0126/#89); P2 kickoff+BUILT (0127/#90, 0129/#92) — **модуль P1–P7+§6 ПОЛНЫЙ, PILOT POINT снят**; profiling study 3-jury-vs-1-GP (0132/#96); consilium-фиксы raw-source+soft-veto (0135/#99) | Live-dogfood **починенного** консилиума не прогнан (владелец не выбрал вариант 1/2/3; рекомендация — вариант 2); owner-решения пилота PA-039/040/042; судьба зелёной ветки пилота `run/s7-localization` (реальная работа 7.1) |
| **2** | **Vision Wave B** (`065fe176`, 01.07) | «Горизонт 1 пройден — что нужно для старта волны 2 (Autonomous Pipeline Vision)?» | 3 замка сняты; kickoff **0136** (развилки: б=in-harness Workflow, в=conservative→pilot, а=B сразу/F1 отложен, г=снята); work-order `ECOSYSTEM_VISION_BATCH_2.md`; **B-a закрыт** (0140/#105) | **B-b durable wave-runner** (committed, не начат — реализация не спроектирована) → B-c close-out → B-d pilot-калибровка. Урок: строить в отдельном worktree |
| **3** | **Guided Research** (`bbf2c10a`, 01.07) | «Максимально расширить поиск/сбор/обработку информации + со-формирование запроса + метрики полезности + анти-хайп» | Blueprint v2 + Wave 0.5 bake-off-нота + **Wave 1** (2 скилла + `/ecosystem:research`, 0138) — всё в #102 | **Wave 2 free-bakeoff ОБОРВАН**: n=15/24 (B1 бьёт B0 13/15 +1 ничья), батч-C (9 запросов) не досчитан, ре-агрегация+нота+PR не сделаны; keyed bake-off = 7 🚧 requires_user; harness-зеркало скиллов в `~/.claude/skills/` не создано (папки нет) |
| **4** | **Guide / doc-UX** (`99b51f2f`, 30.06–01.07, worktree) | «BPMN-карта реально ВСЕХ процессов» → «спроектируем doc-UX батчем, даю ок по всем 7 развилкам» | BPMN-карта+группировка+self-test (#86–#88, 0121–0125); Волна 0 (#91, 0128); Волна 1 полностью (#93/#95/#97/#98/#101, 0130/0131/0133/0134/0137); Волна 2 E2 (#104, 0139); финал — разрулил гонку вокруг 0140, смёржил #105 | Волна 2 остаток: **C5** «объясни путь» · **B2** анатомия (D-6=b Mermaid) · **C4** «ты здесь» (D-7: только после пилот-валидации); 3 consistency-фикса из E2-аудита (P1–P7 vs P3–P6 в гайде · node-id `P4`/`P4p` · membership NFR/AM) |
| **5** | **Statusline** (`5d7a6082`, 01.07, 7 мин) | «Отключим chatgpt-пересказ в statusline» | Сделано вне репо (ключ закомментирован, разделитель условный) | Микро-хвост: неотвеченный оффер — вернуть ленту этапов/заголовок вкладки без 💬-пересказа (побочно отключились вместе) |

Шестая сессия (`dc55da48`) — пустая оболочка; `36571cb4` (28–30.06, P7 0120/#85) — закрыта чисто ещё до батча.

## 2. Вектор-сверка (изначальные намерения ↔ фактическое направление)

Противоречий не найдено. Все пять фронтов — грани трёх принятых направлений:
1. **Autonomous Pipeline Vision** (`ECOSYSTEM_VISION.md`, accepted; порядок `(A ∥ F1) → B → (C ∥ D) → F2 → E`,
   + Epic G proposal 30.06): фронт 1 достроил субстрат (полный оркестратор), фронт 2 идёт ровно по графу (B после A).
   North-star [[project_autonomy_obedience_balance]] соблюдён: автономия в суждениях, послушание в процессах
   (эмпирика: verify-before-act отказывался фабриковать VC; consilium — «рекомендация, не авто-решение»).
2. **Качество входа как рычаг №1** (ошибки спеки компаундируются вниз) — completeness-loop B; согласовано 0136.
3. **Операторская понятность + информационная capability** — doc-UX батч (все 7 развилок ратифицированы)
   и Guided Research (слоями: скилл сейчас, артефакт за триггером; дефолты ратифицированы «иди по дефолтам»).

Операционные шероховатости (не смысловые): 5 коллизий DEC-DEV-номеров за 2 дня; гонки в общем checkout;
3× session-limit на батчевых прогонах. Лечатся E0 (next-dec-dev скрипт, worktree-дисциплина, батчевание).

## 3. To-be: последовательный план E0–E7

> Легенда: ☐ чек-пункт · **CP** = чекпоинт этапа (критерий перехода) · 🧪 = live-валидация на пилоте ·
> 👤 = требуется владелец. Этапы E1–E4 строго последовательны; E5/E6 частично параллелизуемы после E4;
> E0 — немедленно.

### E0 — Гигиена + якорение *(немедленно; дёшево; всё обратимое)* — ✅ ЗАКРЫТ 2026-07-03
- [x] Спасти данные Wave 2 из temp → `dev/research-cache/wave2-free-bakeoff/` *(сделано 2026-07-03, PR #106)*.
- [x] FB-ledger статус-флипы: FB-LR-28/29 → FIXED (0140/#105); FB-LR-31/32 → FIXED-in-P2 (0135, Epic D наследует);
      FB-LR-30 не тронут (note-only). *(PR #107)*
- [x] Уборка merged-веток (5 local + 9 remote) + `git worktree remove jiggly-sauteeing-narwhal` *(2026-07-03)*.
- [x] **`next-dec-dev` скрипт** (§4.3) — `npm run next-dec-dev`, сканит main + все remote-ветки, `--check NNNN`. *(PR #107)*
- [x] Memory-sync: статус-записи актуализированы; `last memory-sync: 2026-07-03` в CLAUDE.md. *(PR #107)*
- [x] ROADMAP «Последнее обновление» — форвард-свод 2026-07-03. *(PR #107)*
- **CP-0: ✅** `npm run verify` EXIT=0 на смёрженном main `b9e0d16`; ветки без мусора; ledger без stale-OPEN.
  *(Попутная находка PR #107: `process-gate` false-positive на doc-коммитах, упоминающих исторические
  DEC-DEV полной строкой в теле — кандидат в D7-backlog / E7.)*

### E1 — Research Wave 2 close-out *(закрыть единственный обрыв; ~1 сессия)* — ✅ ЗАКРЫТ 2026-07-03
- [x] Досчёт **батча-C**: Workflow `wf_ff6ec361-c3b` — 9/9 ok, 36/36 агентов, 0 ошибок; модель запинена
      `opus` (консистентно с пилотом/B — без пина унаследовалась бы модель сессии = конфаунд судьи).
- [x] Ре-агрегация n=24 — воспроизводимый `dev/research-cache/wave2-free-bakeoff/aggregate.py`;
      конфаунды: цитатный ОПРОВЕРГНУТ, length honest-несведён (смягчён). *(PR #108)*
- [x] Итоговая нота `dev/RESEARCH_CAPABILITY_WAVE2_BAKEOFF.md` — вердикт: **B1-дисциплина бьёт naive
      в 94.4% решённых** (17 clean + 4 lean + 2 tie + 1 B0 из 24; overall 3.91→4.72; топ-рычаг P3 Faithfulness +1.42;
      swap-agreement 83%, 0 unstable). *(PR #108, DEC-DEV-0141)*
- [x] Autoflow: DEC-DEV-0141 (номер выдан+сверен `next-dec-dev`) + PR #108 MERGED; CHANGELOG не тронут (dev-zone).
- [x] Rider: harness-зеркало — `~/.claude/skills/{research-intake,anti-hype-filter}/SKILL.md` (подхватились в сессии).
- **CP-1: ✅** нота с явным вердиктом; 👤 развилка §5.1: рекомендация «keyed bake-off НЕ сейчас,
  вернуться при Wave-2-tooling» зафиксирована в ноте — дефолт принят с merge #108, переоткрыть можно словом.

### E2 — Wave B / B-b durable wave-runner + B-c *(committed-ядро волны B; в отдельном worktree)*
- [ ] Построить runner по проектировке §4.1 (развилка размещения — реши на kickoff, рекомендация дана).
- [ ] `/product:complete <FM>` вызывает runner (session-scope; cross-session НЕ строим — развилка «б» 0136).
- [ ] Идемпотентность шагов по `LOOP_READINESS_AUDIT.md` (🟢 loop-body / 🟠 keyed / 🔴 escalate).
- [ ] **B-c close-out** (stretch, дёшев после B-b): на stop — авто-триггер `delegated_unverified`
      (B5 `/product:bg-review`, B6/B8 `/product:validate`); completion-report показывает их статус явно.
- [ ] Учесть design-входы FB-LR-31/32 в SURFACE (персоны видят сырьё, не lossy-brief; distributed-veto паттерн).
- **CP-2:** фикстурный smoke — oracle<1 → ≤3 волн, резолвимое доведено, decision эскалирован в PA_CANON,
  честный стоп un-met; wiring-тесты + `verify.md` Step 4; `npm run verify` EXIT=0; DEV_JOURNAL (runner-топология).

### E3 — Patch-cut 1.7.0 + доставка в пилот *(по `checklists/patch-cut.md`)*
- [ ] Нарезать `[Unreleased]` (двухнедельный багаж: N+2 close-out, Vision Increment 1 + B-a/B-b, P2, P7, S7,
      doc-UX Волны 0–2, Research W1, BPMN-карта) → версия **1.7.0**, тег.
- [ ] 👤 `/ecosystem:update` в `my-first-test` (wipe-protection + namespace-preserve контракт).
- [ ] Pilot-side `.gitattributes` delivery (FB-LR-27, QUEUED) — вместе с update.
- **CP-3:** `verify-update.sh` зелёный на пилоте; состояние пилота не тронуто (контракт §6 CLAUDE.md).

### E4 — Пилотный live-батч 🧪 *(один заход, несколько прогонов; executor/reviewer separation)*
Дизайн прогонов — по урокам FB-LR-26 (триггер = РЕАЛЬНЫЙ дефицит, не срежиссированный) и
[[feedback_separate_task_from_test]] (чистая задача исполнителю, рубрика у ревьюера, грейд post-hoc).
- [ ] 🧪 **B-d real-resolve калибровка:** `/product:complete` на фиче с реальным oracle<1 gap →
      откалибровать широту авто-RESOLVE (какие 🟢-деривации безопасны с verify-before-act) → обновить skill.
      Грейд: sensitivity (нашёл реальные gaps) + specificity (0 сфабрикованных артефактов).
- [ ] 🧪 **P2-dogfood починенного консилиума** (закрывает хвост фронта 1; вариант 2 подтверждён владельцем
      2026-07-03): прогнать `decide-architecture-foundation` на **живой** развилке. ⚠ Экс-кандидат PA-040
      уже ратифицирован в пилоте (DEC-PLAN-039/040, `68c77ee`) → ждать СЛЕДУЮЩУЮ реальную арх-развилку
      (естественный кандидат — при имплементации Task 5.4 worker-bootstrap); НЕ фабриковать (FB-LR-26).
      Проверить: `source_excerpt` доходит сырым, soft-veto/integration-проход срабатывают.
- [ ] 🧪 **S-LE lesson-gate smoke** (`dev/gates/S_LE_LESSON_GATE_SMOKE.md`) — hard-prereq флипа
      `lesson-presence-gate` warn→strict (DEC-DEV-0062). Плюс, сколько влезет: PATCH_1.3.3 S1–S5, PHASE_6 S1–S7.
- [ ] **[РЕШЕНО ДА 2026-07-03]** merge `run/s7-localization` → `pre-cc-sdd-pilot` (несёт 7.1 OpenAI-провайдер
      + Task 5.4 spec + ратификации DEC-PLAN-039/040) + **READY-ре-гейт `d0299f9`** (orphan-export fix,
      `readiness=ENV_NOT_READY` — re-verify на READY-ране). had_trial канон — ✅ уже закоммичен (DEC-PLAN-038
      в journal.md пилота, факт-чек 2026-07-03). Остаётся 👤 PA-039 (live-verify + flag-flip → Integrator).
- [ ] Уборка пилотных worktree: `run/v2-personas` (⚠ несёт modified worktree-local `.claude/pending-actions.md`
      — перед сносом сверить с каноническим ledger, не потерять PA-контент), `run/g3-glossary`,
      `run/s7-localization` (после merge), `worktree-hashed-dreaming-dolphin`, `worktree-merry-meandering-horizon`.
- **CP-4:** грейды записаны (DEV_JOURNAL + ledger); RESOLVE-широта обоснована живыми данными; N-волна
  Wave B объявляется закрытой (B-a..B-d ✓).

### E5 — Vision следующая волна: `(C ∥ D)` + G-ревью *(kickoff по D7 `phase-kickoff.md`)*
- [ ] **Epic D** (консилиум-примитив как reusable-канал эскалаций): D1 жюри+synthesis — реюз
      `consilium-synth.cjs` (0135 уже внёс soft-veto + integration-pass); D2 политика §7.6; D3 cost-gate
      + именованные пресеты панелей. Вход: эскалации completeness-loop (B) и гейтов (F2 позже).
- [ ] **Epic C** (крупные автономные шаги): C-i `batch-enrich-feature-set` (pipeline по FM) →
      C-ii 5–8 границ-гейтов → C-iii branch-anticipation. Рельсы anti-over-engineering из vision §5.
- [ ] **Epic G** — провести §7-ревью proposal'а (развилки НЕ пред-решены — 👤); G1/G2 строить только
      после/вместе с F1 (общая config-механика) и не раньше реальной потребности >3–4 персон.
- [ ] **F1** (autonomy resolver L0/L1) — координируемый трек: сверка gate-контракта с
      `gate-risk-classifier`/`env-readiness` оркестратора (причина отложки в 0136).
- **CP-5:** kickoff-DEC на волну + по DEC на инкремент; counts-sweep если появятся артефакт-типы/правила.

### E6 — doc-UX Волна 2 остаток *(параллелизуемо с E5; независимый трек)*
- [ ] **C5 «объясни путь»** (дизайн готов: BFS по флоу-рёбрам, подсветка; smoke «P1A→P6o непуст и монотонен»).
- [ ] **B2 анатомия** одной картинкой (развилка D-6 = b: редакторская Mermaid coarse, как docs/MAP; в L0 хаба).
- [ ] 3 consistency-фикса E2-аудита: ① Orchestrator `P1–P7` vs `P3–P6` по гайду; ② node-id `P4`/`P4p`
      в overlay карт (+ реген + смоук); ③ membership NFR=🟠/AM=🟢 в `00-concepts §5`/`06-gates`.
- [ ] **C4 «ты здесь»** — СТРОИТЬ ТОЛЬКО после 🧪 пилот-валидации Волн 0–1 (развилка D-7): спросить
      оператора после E4, реально ли карты помогают; тогда C4 = read-only `state.json` против `.product/`.
- **CP-6:** verify EXIT=0; приёмка §8 DOCS_UX_BATCH_DESIGN по Волне 2.

### E7 — Отложенное по триггерам *(фоновые единицы, без жёсткого порядка)*
- [ ] **D7_DEADWEIGHT_CLEANUP** (`dev/deferred/`) — триггер (0083 merged) давно выполнен; прунинг D7
      до работающего+используемого. Рекомендуемое окно — после E3 (перед новой волной).
- [ ] **env-probe hardening** FB-LR-09 + FB-LR-24 (migration-history integrity в shared env-readiness).
- [ ] 👤 **FB-LR-25** — fold escalations + un-drained queues в один disclosure (или wontfix-подтверждение).
- [ ] **Research Wave 2-tooling — двухступенчато (решение владельца 2026-07-03, §5.1):**
      (i) **tool-agnostic answer-engine коннектор** — контракт интерфейса `query → {answer, citations[],
      provenance-tier}` + слот в fallback-таблице `/ecosystem:research` + конфиг-плейсхолдер ключей;
      строится БЕЗ покупки ключей — «готовность к подключению»; (ii) подключение конкретного engine
      (Perplexity Sonar provisional) + keyed bake-off — при появлении ключей/реальной потребности.
      **Wave 3** (формальный RB-артефакт) — bring-forward триггер: reuse ≥5 И form-drift; **Wave 4** — по спросу.
- [ ] **Epic E + живой P7-boot** — substrate-gated: нужны D3-runtime инструменты Интегратора
      (**Phase 7**, `dev/gates/PHASE_7_READINESS.md` — skeleton); войдёт после (C ∥ D) по vision-графу.
- [x] **Statusline-микро: закрыто 2026-07-03** — владелец: «пересказы сейчас не нужны»; без действий.

## 4. Проектировки (для поставленного без спроектированной реализации)

### 4.1. B-b durable wave-runner (Epic B) — эскиз
**Развилка размещения** (реши на kickoff E2):
- **(a) — рекомендую:** новый top-level `product/processes/complete-feature.mjs` (зеркально `orchestrator/`).
  Чистый zoning (Epic B = Product-owned; границу «orchestrator/ не трогать» не нарушаем). Цена: деплой-wiring
  каталога `product/` в `/ecosystem:{bootstrap,update}` по прецеденту orchestrator (DEC-DEV-0078, namespace-aware).
- (b) положить в `orchestrator/processes/` — деплой бесплатен, но ломает зонирование и границу work-order 0136.

**Топология скрипта** (Workflow, по прецеденту orchestrator `.mjs` + T3 `{scriptPath}`-вызов):
```
meta.phases = [Score, Surface, Resolve, Escalate]   // wave-циклы внутри
for (wave = 1..max_waves):
  score   = agent("node …completeness-oracle.cjs --feature <FM> → верни JSON", {schema: ORACLE})
  if (stop-contract: met∧no-new / Δ<ε / только-decision) break     // КОД, не LLM
  findings = parallel(zonePersonas.map(p => () =>
               agent(brief(p, resolvedRoot), {agentType: p.canonical, schema: GAPS})))   // FB-LR-28: один root
  {resolvable, decisions} = classifyGaps(score.gaps, findings)     // детерминированная либа, см. ниже
  for g of resolvable: agent(resolve+verify-before-act, keyed-idempotent)   // conservative whitelist
  if (decisions.length) agent(escalate → PA_CANON)                 // FB-LR-29 порт уже в skill
return completionReport {score, blockers, escalated, delegated_unverified}  // rail 5
```
- **`classifyGaps` вынести в `hooks/product/lib/gap-classifier.cjs`** (чистая функция по разметке
  `LOOP_READINESS_AUDIT.md`: 🟢 деривации → resolvable, 🔴/connected → decision) — тестируемо как consilium-synth.
- Тесты: юниты классификатора + wiring-тест (`/product:complete` ссылается на scriptPath; verify.md Step 4;
  generic workflow-syntax smoke подхватит `.mjs`). Skill `completeness-loop.md` остаётся контрактом-документом
  (runner = его исполняемая форма; не дублировать прозу — ссылаться).
- Bounded-loop, Δ-конвергенция, info-gain-стоп — **код скрипта**, не суждение модели (rail 1/2 сохранены).

### 4.2. Батч-C досчёт + ре-агрегация (E1) — механика
Вход: `dev/research-cache/wave2-free-bakeoff/` (queryset заморожен sha256 `beabbbd6…`; правленый скрипт
`raw/wave2-free-bakeoff.workflow.js` — батчевание + schemaless-ретривал + ослабленные схемы судей уже внесены).
Шаги: (1) в скрипте хардкод RUN → батч-C (9 оставшихся id); (2) Workflow-ран (бюджет ~уровня батча-B;
не запускать три батча разом — урок трёх session-limit'ов); (3) агрегатор: свести 3 raw-jsonl →
per-bucket win-rate + swap-order agreement + конфаунд-чек (число цитат); (4) нота + DEC-DEV + PR.

### 4.3. `next-dec-dev` (E0) — детерминированный аллокатор номера
`dev/meta-improvement/scripts/next-dec-dev.js`: (1) grep `^## DEC-DEV-(\d+)` в локальном DEV_JOURNAL;
(2) `git fetch origin` + `gh pr list --state open --json headRefName` → `git show origin/<ref>:DEV_JOURNAL.md`
по каждой ветке → те же заголовки; (3) print `max+1` (+ `--check N` = занят/свободен; exit-код для скриптов).
Закрывает паттерн [[feedback_dec_dev_collision_check]] (5 коллизий 30.06–01.07). Warn-режим достаточен —
renumber-at-merge остаётся backstop'ом.

### 4.4. C5 / B2 (E6)
Дизайн уже в `DOCS_UX_BATCH_DESIGN.md` §4: C5 = BFS по `next[]`/crossEdges + edge-highlight реюз + smoke;
B2 = редакторская Mermaid (D-6=b) с coarse-freshness правилом (как docs/MAP.md), встроить в L0 хаба.
Отдельной проектировки не требуют.

### 4.5. Epic G — НЕ проектировать до §7-ревью
Proposal (vision §5 Epic G) явно помечен «развилки не пред-решены»; реализация после owner-ревью
(рекомендуемая точка — kickoff E5) и не раньше реальной потребности в >3–4 персонах.

## 5. Решения владельца — ЗАФИКСИРОВАНЫ 2026-07-03 (ответы получены; 6/8 — дефолт-рекомендация, переиграбельны словом)

1. **Keyed bake-off (Research): ✅ отложен + НОВАЯ задача** — владелец: «сделать коннектор под
   agnostic-tool, быть готовым к подключению в будущем» → в E7 Research-строку добавлен
   **tool-agnostic answer-engine коннектор** (интерфейс без покупки ключей; см. E7). Сам keyed — при подключении engine.
2. **P2-dogfood: ✅ вариант 2 (живой dogfood)** — согласовано. ⚠ Импакт-факт: PA-040/042 **уже
   ратифицированы в пилоте** (DEC-PLAN-039/040, tip `68c77ee` ветки `run/s7-localization`) → субстрат ушёл;
   E4 скорректирован: прогон на СЛЕДУЮЩЕЙ живой арх-развилке (не фабриковать, FB-LR-26).
3. **had_trial канон: ✅ закрыто, коммит НЕ нужен** — факт-чек 2026-07-03: DEC-PLAN-038 уже закоммичен
   в `pre-cc-sdd-pilot` (`.product/.decisions/journal.md`), дерево пилота чистое.
4. **`run/s7-localization`: ✅ ДА** — мержить в `pre-cc-sdd-pilot` + READY-ре-гейт `d0299f9`
   (orphan-export fix помечен `readiness=ENV_NOT_READY`). Действие внесено в E4.
5. **FB-LR-25: ✅ wontfix подтверждён** (моё суждение по «как считаешь нужным»: решение уже было —
   DEC-DEV-0116; stale табличная строка ledger дофлипнута этим PR).
6. **Epic G §7-ревью: 👤 дефолт (a) — E5, скоуп G1+G2** (per-агент конфиг + матрица участия, дефолт =
   текущий zone-routing; панель G3 вторым инкрементом). Альтернативы, если хочешь иначе:
   (b) сначала G3-панель read-model; (c) отложить G за E5 до спроса от консилиум-пресетов Epic D.
7. **Statusline: ✅ закрыто** — «пересказы сейчас не нужны»; ничего не делаем (выключено целиком).
8. **C4 «ты здесь»: 👤 дефолт (a) — решить после E4** по живым пилот-впечатлениям от карт.
   Альтернативы: (b) строить в E6 сразу; (c) не строить (вычеркнуть, дизайн сохраняется).

## 6. Process-обязательства и риски

| Триггер | Обязательство |
|---|---|
| `fix:` / `feat:` consumer-zone | 🔒 DEV_JOURNAL / 🔒 CHANGELOG `[Unreleased]` (process-gate активен) |
| новая команда/скилл/хук (B-b, C5…) | `commands/ecosystem/verify.md` Step 4 + summary + обзорные шаблоны |
| новый артефакт-тип/правило (Wave 3 RB) | 🔒 count-sweep `check-counts.js` (24/44 сейчас) |
| каждый этап | DEC-DEV на kickoff по `next-dec-dev`; ⚠ `git fetch` перед присвоением |

Риски: (1) параллельные сессии в общем checkout — **строить E2+ только в worktree**, `git branch --show-current`
перед каждым коммитом ([[env_parallel_sessions_share_checkout]]); (2) session-limit на батчевых прогонах —
батчевать (урок E1-обрыва), чекпоинт-файлы до запуска; (3) B-d/E4 — только РЕАЛЬНЫЕ дефициты (FB-LR-26);
(4) `orchestrator/` в E2 не трогать (кроме согласованного реюза либ read-only).

## 7. Resume / recovery

После разрыва: `git status` + `git log` на ветке этапа → последний завершённый чек-бокс → продолжать
со следующего. Не доверять памяти о последнем действии — верифицировать шов ([[CLAUDE.md]] Recovery-протокол).
Чек-боксы этого файла обновлять по факту (он же — карта прогресса всего батча).
