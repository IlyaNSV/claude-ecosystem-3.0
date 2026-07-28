# Epic E Smoke Test Plan — deploy/rollback/monitoring (E.G)

> **Назначение:** runtime smoke-сценарии для Epic E (deploy-сегмент конвейера). Исполняются на **VM prod-стенде** (staging-инстанс пилота `my-first-test`) после восстановления VM. Это суб-фаза **E.G** (`dev/gates/EPIC_E_READINESS.md:61`).
>
> **Статус:** ✅ **ПРОГНАН ПОЛНОСТЬЮ — раунды 1-3, закрыт 2026-07-15 (кампания до-PROD).** Вердикты: **S1 PASS** (заход 4 `l62yt4`: `DEPLOYED × READY`, первый живой деплой линии) · **S2 PASS** (`l8m24o` fail-после-флипа `flipped:true` + `l9zt0w` rollback `auto @ дефолтный L1` → known-good, health 200; бонус `l7py9k`: статически видимая env-поломка ловится ДО флипа) · **S3 PASS** (E5-A + floor-свипы живьём) · **S4 PASS** (раунд 1) · **S5 PASS** (заход 3 `le56c8` после фиксов 0211/0213: ранний `BLOCKED × ENV_NOT_READY / env-not-ready-preflight` за 43 с, Redis поимённо, build-test не исполнялся, диспетчер субстрат не тронул; заходы 1-2 вскрыли FIND-E1/E2/F — починены) · **S6.2 PASS** (раунд 1) · **S7 PASS** (живьём внутри S1: draft-контракт гейтится, `--accept-draft-contract` = санкция владельца, `contract_evidence` сообщён без флипа CNT). Хроника, находки и фиксы (DEC-DEV-0199..0206, 0211, 0213) — журнал кампании `dev/_archive/campaign-prod/PROD_READINESS_CAMPAIGN.md`. Релиз 1.12.0.
>
> **Дизайн-SSOT:** `dev/gates/EPIC_E_READINESS.md` (решения владельца D-1..D-9). **Что проверяем:** что deploy-брекет чартера v5 ведёт себя ровно так, как доказано юнит-тестами — но на живом субстрате, где реальны `pnpm build` / `prisma migrate` / симлинк-флип / `systemctl` / `/health`.
>
> **Принцип (кампания §3.2):** главный риск — тихий auto-deploy мимо floor. Смоук обязан ЭМПИРИЧЕСКИ показать, что деплой не идёт без прохождения через `autonomy-policy resolve`, и что floor непробиваем на живом прогоне.

---

## Pre-requisite state (когда VM восстановлена)

- [ ] VM жива, ssh поднят (`ssh -p 2222 cc-dev@127.0.0.1`), пилот на HEAD с доставленным Epic E релизом.
- [ ] deploy-capability оснащена: `/integrator:provision deploy-staging` прогнан, CNT-контракт в `.claude/integrator/contracts/` (draft), deploy-manifest + systemd-шаблоны персистированы.
- [ ] Пилот-пакеты собираемы: `pnpm -r build` проходит; `packages/db` schema присутствует ИЛИ migrate-шаг помечен conditional.
- [ ] Postgres 16 + Redis 7 healthy в docker-compose (спайк подтвердил).
- [ ] Изолированная ветка пилота для evidence (прецедент `smoke-batch-1-9-0`).
- [ ] Снапшот VM до прогона (грубая пред-deploy страховка, D-4).

---

## Scenarios

### S1 — Успешный staging-деплой (happy path, L3)

**Setup:** фича с P7 boot PASS; профиль автономии `autonomous` (L3) ИЛИ `--autonomy L3`; субстрат READY.
**⚠ Плюс — ось контракта (DEC-DEV-0201):** CNT capability приезжает из E.A со `status: draft`, и **draft
human-гейтит деплой** (это не блок — см. S7). Поэтому для happy-path нужно ОДНО из двух:
- `acceptDraftContract: true` в args — владелец санкционирует **первый** деплой по непроверенному контракту; **или**
- CNT уже `active` — т.е. этот прогон **не первый** (контракт флипнут по evidence прошлого деплоя).

**Steps:**
1. Прогнать линию до `runtime_gate` (P7 boot PASS → `evt:runtime.ready_or_started`).
2. Линия входит в `deploying_staging` → процесс `deploy-to-stage`.
3. Наблюдать фазу `Gate`: вызов `autonomy-policy resolve --operation-class deploy_staging --env-tier staging --readiness READY --contract-status <draft|active> [--accept-draft-contract] --override L3` → `disposition: auto`.
4. Фаза `Deploy`: `releases/<ts>` собран, `current`-симлинк флипнут, `systemctl` рестарт.
5. Healthcheck `GET /health` → 2xx.

**Pass:** `result: DEPLOYED`, `flipped: true`, `evt:deploy.succeeded` → состояние `done`; `current` указывает на новый релиз; сервисы живы. Ledger + fabric-ingest записали брекет.
**Плюс (если контракт был `draft`):** в результате есть `contract_evidence` (CNT id + `run_id` + `verdict: live-verified`) и дисклоз «CNT может быть флипнут в `active`». **Проверить, что Orchestrator НИЧЕГО не записал в `.claude/integrator/**`** (`git status` — §8.3: он только СООБЩАЕТ; флип — акт Интегратора).

---

### S2 — Индуцированный провал healthcheck → авто-rollback (СЕРДЦЕ Epic E)

**Setup:** как S1, но специально сломать сервис так, чтобы он задеплоился, но не прошёл healthcheck (напр. битый `.env`-ключ, или порт занят).

**Steps:**
1. Деплой проходит §3.2-гейт (auto), симлинк флипнут (`flipped: true`).
2. Healthcheck `GET /health` → НЕ 2xx (500/timeout).
3. `result: DEPLOY_FAILED` → `evt:deploy.failed` → состояние `rolling_back`.
4. `rollback-release` резолвится: `operation_class: rollback × staging` → `auto` (БЕЗ человека — это суть auto-rollback).
5. Симлинк-swap на предыдущий `releases/<ts>`, `systemctl` рестарт.

**Pass:** `evt:rollback.done` → `rolled_back`; `current` указывает на ПРЕДЫДУЩИЙ известный-хороший релиз; сервисы снова живы; PA-запись владельцу (`queue_owner`) с диагнозом по P7 failure-таксономии. **Ключ:** rollback сработал автоматически на дефолтном/L3 уровне — человек не требовался для отката, но уведомлён.

---

### S3 — Floor непробиваем на prod (live-подтверждение §3.2)

**Setup:** попытка prod-деплоя на L3 (максимальная автономия).

**Steps:**
1. Триггернуть операцию с `operation_class: prod_deploy` на `--override L3`.
2. Наблюдать `autonomy-policy resolve`.

**Pass:** `disposition: human-gate`, `floor_hit: true` — деплой НЕ идёт, PA владельцу. **На живом прогоне подтверждается, что floor непробиваем даже на L3** (детерминированно уже доказано E5-A, здесь — на фабричном пути). prod остаётся stub под floor.

---

### S4 — §3.2-гейт на дефолтном L1 (деплой не идёт без владельца)

**Setup:** фича с P7 PASS, профиль автономии по умолчанию (L1, без `autonomous`).

**Steps:**
1. Линия входит в `deploying_staging`.
2. fabric-prescription для `deploy_staging × staging × L1` → `human-gate` (первый слой).

**Pass:** процесс `deploy-to-stage` НЕ запускается авто — линия паркуется на owner-gate с PA. Владелец либо `--autonomy L2/L3` (продолжить), либо `evt:owner.close` (закрыть фичу без деплоя → `closed_without_runtime`). **Подтверждает:** дефолт консервативен, деплой требует явной автономии ИЛИ владельца.

---

### S5 — Просадка субстрата (readiness-ось)

**Setup:** деплой на L3, но субстрат DEGRADED (напр. Redis down) ИЛИ ENV_NOT_READY.

**Steps:**
1. Линия входит в `deploying_staging`, процесс запускается (fabric-prescription на L3 = auto).
2. Внутри-процессный §3.2-вызов передаёт `--readiness DEGRADED`.
3. `applyReadinessGuard` понижает `auto → human-gate` (DEGRADED) ИЛИ `→ block` (ENV_NOT_READY).

**Pass:** DEGRADED → `evt:deploy.gated` → `runtime_gate_retry` (владелец решает); ENV_NOT_READY → `result: BLOCKED` (НЕ `DEPLOY_FAILED` — двухосный контракт: «не смог подготовить» ≠ «провалил деплой») → `runtime_gate_retry`, resume на `evt:env.up`. **Ключ:** просадка субстрата не читается как провал кода; деплой не мутирует на нездоровом субстрате.

---

### S6 — Rollback без предыдущего релиза (edge)

**Setup:** первый деплой фичи проваливает healthcheck (нет предыдущего `releases/<ts>` для отката).

**Pass:** `rollback-release` → `evt:rollback.no_prior` → `escalated` + PA владельцу (нечего откатывать — человек решает). Система не пытается флипнуть на несуществующий релиз.

---

### S7 — Draft-контракт: ГЕЙТ, а не БЛОК (регрессия дедлока первого деплоя, DEC-DEV-0201)

> **Зачем сценарий.** Первый живой прогон E.B (2026-07-14) вернул `BLOCKED / ENV_NOT_READY / disposition: null`
> на **полностью исправной** оснастке (манифест 254 строки, парсится, step-list полный). Причина — категориальная
> ошибка: `draft` читался как факт **готовности**. E.A **обязан** отдать CNT `draft`, E.B отказывался деплоить
> не-`active`, а верификация возможна **только через деплой** ⇒ **первый деплой невозможен в принципе**. Ни один
> repo-side тест этого не ловил: обе стороны по отдельности корректны, дефект жил **в стыке**.

**Setup:** capability оснащена E.A, CNT в статусе **`draft`** (как и должно быть после `/integrator:provision`);
субстрат **READY**; уровень **L3** (максимальная автономия — чтобы доказать, что гейтит именно контракт, а не уровень).

**Steps:**
1. Запустить `deploy-to-stage` **без** `acceptDraftContract`.
2. Наблюдать фазу `Preflight`: `readiness` **НЕ** понижается до ENV_NOT_READY; в `readiness_reasons` — строка-объяснение про ось доверия.
3. Наблюдать фазу `Gate`: резолвер **ВЫЗВАН** (`disposition` ≠ `null`!) с `--contract-status draft`.
4. Повторить прогон с `acceptDraftContract: true`.

**Pass:**
- **(1)** Прогон №1: `disposition: human-gate` (**НЕ** `block`), `result: BLOCKED`, `flipped: false`, `readiness: READY` — **не** `ENV_NOT_READY`. **Ключ:** `disposition` заполнена — резолвер реально вызван, мутирующая ветка гейта достижима. PA владельцу с внятным «первый деплой по непроверенному контракту — твоё решение».
- **(2)** Прогон №2 (санкция владельца): `disposition: auto` → деплой идёт → `DEPLOYED` + `contract_evidence`.
- **(3)** **Floor не сдвинулся:** `prod_deploy` × L3 × `draft` × `acceptDraftContract` = `human-gate` + `floor_hit: true` (детерминированно доказано юнитами; на живом пути — S3).
- **(4)** **§8.3:** после обоих прогонов `git status` в пилоте показывает **ноль** изменений под `.claude/integrator/**` — Orchestrator контракт не флипал, только сообщил evidence.

---

## После прогона

1. Вердикты per-сценарий (PASS/PARTIAL/FAIL/N/A) + evidence (ledger, run.json, fabric events.ndjson, PA-записи).
2. Обновить статус-баннер этого файла + `EPIC_E_READINESS.md` (E.G done).
3. Findings → DEV_JOURNAL; дефекты → follow-up фиксы (executor/reviewer separation, как batch-смоук 0177).
4. При PASS S1-S3 — Epic E graduation: deploy-контур live-валидирован, prod-сегмент готов (в рамках stub-под-floor v1).
