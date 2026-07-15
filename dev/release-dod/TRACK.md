# TRACK — Release DoD Loop: релизный Definition of Done как критерий остановки цикла

status: RATIFIED (решения D1-D4 приняты владельцем 2026-07-15 — DEC-DEV-0216; следующий шаг — R0)
track_ssot: этот файл — хартия и решения; **порядок исполнения — единый план `dev/global-loop/PLAN.md`** (слияние с треком Host Console, решение владельца 2026-07-15; живой шов — `dev/global-loop/SEAM.md`)
related: `dev/_archive/campaign-prod/PROD_READINESS_CAMPAIGN.md` (кампания — про готовность САМОЙ экосистемы; этот трек — про DoD релиза ПОЛЬЗОВАТЕЛЬСКОГО продукта, ведомого экосистемой) · `dev/host-console/TRACK.md` (пульт надзирает за DoD-циклами этого трека)

## 0. Хартия — интенция владельца, дословно (2026-07-15; НЕ пересказывать, цитировать)

> «Релизный DoD — полный чеклист (может быть прямым или ссылочным) на подтверждение того,
> что релиз выполнен именно как и ожидалось, все требования соблюдены, протестированы,
> stage контур готов к миграции на prod, т.е. пока этот чек-лист не выполнен — экосистема
> итеративно работает над продуктовым проектом по нашим канонам.»

Уточнение владельца (та же сессия):

> «Первый пункт по сути про loop механизм с критерием остановки, когда релиз выкачен и
> готов к использованию.»

**Семантическое ядро:** DoD — не отчётный документ, а **терминальный предикат релизного
цикла**. Незакрытый DoD ⇒ экосистема продолжает итерации по канонам (очередь доработок
выводится из незакрытых пунктов). Зелёный DoD + санкция владельца — единственный
легитимный выход из цикла («релиз выкачен и готов к использованию»).

## 1. Суть механизма одним абзацем

Релизный цикл: `очередь работ → итерация по канонам (P3→P6, fabric-линии) → DoD-проверка
→ незакрытые пункты → новая очередь → …` — до зелёного предиката. DoD **ссылочный**: он
не пересуживает и не дублирует вердикты, а агрегирует их из SSOT-источников (иначе —
triple-declaration drift, канон Tier-1 doc reform). Прямыми (не ссылочными) остаются
только пункты, у которых нет машинного источника (санкция владельца, prod-миграционный
план).

## 2. Что уже существует (ссылочная карта ног — сверено recon'ом 2026-07-15)

| Нога DoD | Существующий механизм | SSOT |
|---|---|---|
| Фича реализована и проверена | P6 `validate-feature-impl`: `result GO` × `readiness READY` × `conflicts[] = ∅` | `commands/orchestrator/run.md`; человекочитаемо `docs/guide/05-implementation.md` §3 |
| Продукт стартует | P7 runtime-smoke: `READY_TO_SMOKE` × `p7_result STARTS`; PASS роутит линию в `deploy-to-stage`, не в `done` | `commands/orchestrator/run.md` (~:640-653) |
| Stage выкачен | E.B `deploy-to-stage`: `DEPLOYED` = симлинк флипнут **И** healthcheck 2xx; `DEPLOY_FAILED × flipped:true` → авто-rollback | `commands/orchestrator/run.md` (~:654-673); live-валидирован (Epic E смоук S1-S7 PASS, релиз 1.12.0) |
| Откат проверен | E.C `rollback-release`: `ROLLED_BACK`; staging auto на любом уровне, **prod rollback всегда human-gate** | там же |
| Фичи «shipped» честно | `/product:impl-sync`: owner-approve-gated flip FM→shipped по evidence (runs/fabric/external), disposition-решётка | `commands/product/impl-sync.md` |
| Релиз целостен | DA release-scope `/product:da-review RL-NNN`: cross-FM consistency, HYP coverage, rollout deps (DEC-DEV-0026) | `commands/product/da-review.md` |
| Субстрат production-ready | `SUBSTRATE_GRADUATION_GATE`: 4 компонента (CI-evals, трейсы, scoped permissions, security review) + VC-127 «built ≠ validated» | `dev/gates/SUBSTRATE_GRADUATION_GATE.md` |
| Prod непробиваем без владельца | autonomy floor: `{prod_deploy, destructive, spend_money, provision_real_secret}` → всегда human-gate; live-подтверждено (Epic E S3) | `dev/AUTONOMY_POLICY_F1_CONTRACT.md` + `orchestrator/lib/autonomy-policy.cjs` |
| Релиз как артефакт | RL: lifecycle `planned → in-progress → released` («released — все MUST фичи released, релиз выпущен в production»), body-секции Success criteria / Rollout plan / Rollback plan | `docs/pmo/artifacts/RL.md` |
| Образец структуры чеклиста | `patch-cut.md`: шаги с Pass/Fail-блоками (внутренний cut самой экосистемы — образец формы, не содержания) | `dev/meta-improvement/checklists/patch-cut.md` |

## 3. Дыра, которую закрывает трек (recon: раздел «НЕ НАЙДЕНО»)

1. **Термин DoD не существует** ни как артефакт, ни как поле, ни как чеклист — grep по
   `docs/ commands/ skills/ hooks/` пуст.
2. **Нет агрегирующего предиката**: P6/P7, Epic E, graduation, impl-sync, DA-RL — четыре+
   раздельных механизма, нигде не сведённые в один вердикт «релиз готов».
3. **Нет loop-контракта**: ничто не выводит очередь следующей итерации из незакрытых
   пунктов; RL может застрять `in-progress` без машинного «что осталось».
4. **Prod-нога — заглушка by design**: v1 деплоит только staging; `prod_deploy` —
   human-gated stub до появления реального prod-хоста (решение владельца в
   `EPIC_E_READINESS.md`). D5 Operations отложен v2 (DEC-P08).
5. Попутная находка (кандидат на фикс при построении): `pmo-map.md` D3-06 «Deployment»
   числится «delegated через Integrator», фактический владелец — Orchestrator (Epic E).

## 4. Дизайн-эскиз v1 (пред-решения — на ратификацию владельцу, см. §7)

- **Артефакт:** DoD-блок в RL-артефакте (**soft-миграция**: поле опционально, absent ==
  старое поведение — канон DEC-DEV-0079) + генерируемый отчёт-чеклист
  `.product/releases/RL-NNN-dod.md` при проверке.
- **Команда:** `/product:release-dod <RL-NNN>` (имя рабочее) — две ноги:
  1. **детерминированная**: скрипт-агрегатор читает вердикты по SSOT (run-ledger / fabric
     state / FM frontmatter / deploy-результаты) и красит пункты ✅/🟠/❌ — по образцу
     `impl-sync` (read-first sensor);
  2. **судейская**: переиспользует DA release-scope (не новый субагент).
- **Loop-контракт:** каждый ❌/🟠 пункт порождает запись очереди (PA / fabric owner-queue /
  список в отчёте) → следующая итерация. Линия релиза в fabric не паркуется в `done`,
  пока DoD ≠ зелёный.
- **Терминатор:** DoD зелёный **+ owner ratify** (assistant-led, human-approved — DEC-P13)
  → `RL.status: released`. Флип статуса — только через существующий approve-паттерн
  impl-sync, не auto.
- **Prod-нога v1:** пункт «stage готов к миграции на prod» = graduation 4/4 + rollback
  проверён + capabilities/secrets реальные (не Mock: `concerns[]` из P6 пуст или явно
  принят владельцем — «зелёный boot на Mock ≠ prod-ready», `run.md:649`) + миграционный
  план в RL Rollout plan. Сам prod-деплой остаётся за floor'ом (human-gate) — это закон,
  не пункт чеклиста.

## 5. Скелет DoD v0 (6 категорий; каждая — ссылка на SSOT из §2)

1. **Требования:** все `RL.features[]` shipped через impl-sync (disposition =
   `ready-to-ship`→applied; ни одного `no-evidence`/`gate-not-passed`/`validation-blocked`).
2. **Тесты:** по каждому FM — P6 `GO × READY`, `conflicts[] = ∅`; NFR-статусы зелёные.
3. **Stage:** `DEPLOYED × READY` (healthcheck 2xx) на текущем составе релиза; rollback
   этого релиза проверен (E.C `ROLLED_BACK` хотя бы раз / на предыдущем).
4. **Целостность релиза:** DA release-scope прогнан, findings разрешены (Act/Defer с
   решением, не молча); HYP coverage подтверждён; rollout deps закрыты.
5. **Prod-готовность:** graduation gate 4/4; Mock-оговорки (`concerns[]`) отсутствуют или
   приняты; Rollout/Rollback plan в RL заполнены не «просто задеплоить» (анти-паттерн из
   `RL.md` Common Mistakes).
6. **Санкция:** owner ratify → `released` + `released_on`.

## 6. Фазировка (cuttable scope — default)

| Фаза | Содержание | Cut-линия |
|---|---|---|
| **R0** | Термин в канон (glossary/artifacts) + DoD-скелет как чеклист в RL body + ручная проверка | минимум, уже даёт критерий остановки |
| **R1** | Детерминированный агрегатор (`/product:release-dod`, read-first) + отчёт ✅/🟠/❌ | автоматизация красок |
| **R2** | Loop-wiring: незакрытые пункты → PA/owner-queue; fabric-ячейка «release-dod» перед `done` | цикл замыкается машинно |
| **R3** | Prod-миграционная нога | gated на появление реального prod-хоста (сейчас stub под floor) |

## 7. Решения владельца (2026-07-15 — DEC-DEV-0216; все по рекомендациям)

1. **Форма:** ✅ DoD-блок внутри RL (soft-миграция) + генерируемый отчёт. Новый
   артефакт-тип отвергнут (цена count-sweep/каталога без выгоды при «один DoD на RL»).
2. **Владелец проверки:** ✅ `/product:release-dod` в Product-модуле на R0/R1;
   fabric-ячейка — в R2 (DoD обязан работать и вне fabric-линий).
3. **Состав v0:** ✅ 6 категорий §5 утверждены целиком.
4. **Prod-нога:** ✅ ждать реального prod-хоста (R3 event-gated); спека сейчас отвергнута
   (spec-first риск, built ≠ validated).

Rationale и отвергнутые альтернативы — журнал DEC-DEV-0216.

## 8. Очередь трека

R0 — **разблокирован** → smoke на пилоте `my-first-test` (живой RL) → R1 → R2 → R3
(event-gated). Перед R0 — `readiness-gate.md` паттерн; перед постройкой скилла/команды —
`b1-frontmatter-convention.md` (если появится frontmatter-схема отчёта). Интерфейс с
пультом: отчёт R1 читается sweep'ом Кондуктора (`dev/host-console/TRACK.md` §2).
