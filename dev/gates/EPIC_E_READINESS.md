# Epic E Readiness — сегмент конвейера до прода

> **Статус:** 🟢 KICKOFF ВЫПОЛНЕН 2026-07-11 (DEC-DEV-0194) — решения владельца сняты, суб-фазы нарезаны.
> **Следующий шаг:** **build E.A** (Integrator D3-runtime capability). Спайк VM-реальности — ✅ **ВЫПОЛНЕН 2026-07-11** (DEC-DEV-0195, `31a935e`); его факт-лист — в §Суб-фазы ниже, он и есть вход в E.A.
> **Vision-SSOT намерения:** `dev/ECOSYSTEM_VISION.md` §Epic E (+§Epic F инкремент F3). Kickoff-ритуал: `dev/meta-improvement/checklists/phase-kickoff.md`, fresh-session mode (анти-якорение).
> **Журнал kickoff-решений:** DEV_JOURNAL DEC-DEV-0194.

---

## Скоуп (формула владельца + Vision)

**CI/build → deploy/rollback → monitoring + D3-runtime Интегратора.** Субстрат назначен владельцем: **VM-фабрика = прод-стенд** (Ubuntu VM, пилот my-first-test живёт внутри; ssh — операторский канал владельца, НЕ транспорт деплоя). F3 (autonomy prod-сегмент) едет с Epic E.

**Предусловия Vision:** П.1 (§6 capability-канал) — ✅ выполнено (0117 detect-leg + OD7 await→resume live-валидирован 0171/0175). П.2 (первые D3/D4/D5-инструменты) — это и есть скоуп Epic E (суб-фаза E.A).

## Решения владельца (2026-07-11, AskUserQuestion батч)

| Ось | Решение |
|---|---|
| **Prod-топология на одном VM** | **Prod = stub под floor**: v1 деплоит только staging-инстанс на VM; `prod_deploy` остаётся human-gated заглушкой до появления реального prod-хоста |
| **Monitoring v1 (D5)** | **Healthcheck + liveness → PA/owner-queue** (реюз Fabric PA-моста + P7 failure-таксономии); observability-стек — v1.1+ по триггеру |
| **Авто-rollback** | **Staging auto** (провал healthcheck → авто-rollback симлинк-swap + PA-нотификация), **prod — всегда human-confirm** |
| **Порядок работ** | **Спайк VM-реальности → E1 → E2** (сплит; owner-гейт после E.A) |

## Архитектурные развилки (D-1..D-9, резолюции — журнал 0194)

Конденсат; полные резолюции + отвергнутые альтернативы — kickoff-отчёт в DEC-DEV-0194:

1. **D-1 Deploy** = локальная операция ВНУТРИ VM (build → `releases/<ts>/` → флип `current`-симлинка → (re)start сервиса); НЕ remote-ssh-push, НЕ k8s, НЕ облачный CI. Менеджер процесса — уточняет спайк (что уже есть на VM/в package.json пилота).
2. **D-2 Граница §8.3**: Integrator оснащает связку (deploy-skill + контракт CNT-* + role-агент `deployer`); Orchestrator `deploy-to-stage` исполняет. Запрос capability — через построенный §6 OD7 await→resume.
3. **D-3 Tier-топология**: dev = dev-checkout пилота; staging = развёрнутый инстанс на VM (dir+port+service); prod = stub под floor (решение владельца).
4. **D-4 Rollback** = git-tag + release-dir симлинк-swap (Capistrano-style); VM-снапшот — только грубая операторская пред-deploy страховка, не app-примитив.
5. **D-5 Monitoring** = пост-deploy healthcheck + периодический liveness → PA-эскалация; диагностика по P7 failure-таксономии, capture-don't-fix.
6. **D-6 CI/build** = детерминированный clean-build + тесты внутри `deploy-to-stage` перед флипом (реюз P6 GO + P7); отдельный CI-сервер не строится.
7. **D-7 P7 живой boot** (`bootSmoke:true`) = последний ПРЕ-deploy гейт; healthcheck D-5 = ПОСТ-deploy нога. Дубля нет.
8. **D-8 F3 wiring**: operation-классы `deploy_staging` (∉ floor), `prod_deploy` (∈ floor), `rollback` (реверс → автономнее: staging auto, prod confirm) в `autonomy-policy.cjs`; снимается затычка «L3 ≡ L2».
9. **D-9 Fabric**: deploy-брекет расширяет charter `feature-production-line` (P7 boot PASS → deploy-to-stage → healthcheck → `deployed` | `deploy_failed` → auto-rollback → `rolled_back`); реюз bracket-guard/run-ledger/PA-моста.

## Амбигуитиз (A-1..A-9 — сняты kickoff'ом)

Имена — `deploy-to-stage`/`rollback-release` из SPEC §8 буквально, role-агент `deployer`, layout `releases/<ts>/`+`current`. Состояние деплоя — run-ledger + charter-state (durable); idempotency-токен = release-dir timestamp. Edge cases зафиксированы: deploy-lock от параллельного запуска, retry-политика healthcheck, rollback без предыдущего релиза, частичный деплой, отсутствующий `.env`. Три канала эскалации разведены: §6 BLOCK = «нет capability» (парковка), healthcheck-fail = «задеплоили, не живёт» (PA + auto-rollback), floor = «prod, ждём человека». Консилиум на deploy (L2/L3 staging): жюри оценивает «готов ли релиз/риски», не «как деплоить» — явная нота, чтобы не жечь жюри на каждый deploy. Секреты staging v1 = dev-tier; real-secret provisioning — под floor. P7 `bootSmoke` остаётся per-invocation флагом (глобальный дефолт не трогаем).

## Суб-фазы

**Спайк — ✅ ВЫПОЛНЕН 2026-07-11 (VM-визит, read-only ssh; DEC-DEV-0195).** Факт-лист:
- Деплойбл = **pnpm monorepo**, 3 сервиса: `@app/api` (NestJS: `nest build` → `node dist/main.js`), `@app/web` (Next.js: `next build` → `next start`), `@app/worker` (tsc → `node dist/main.js`; BullMQ, гейт `WORKER_AUTOSTART=1`). Корневой `pnpm -r build`; Node v22.23.1, pnpm-workspace.
- Инфраструктура **уже живёт**: PostgreSQL 16 (`mft-postgres`) + Redis 7 (`mft-redis`) в docker-compose, оба healthy (healthcheck'и уже определены в compose — pg_isready / redis-cli ping); `.env` присутствует (DATABASE_URL/REDIS_URL/POSTGRES_*/BCRYPT_COST + внешние API-ключи).
- **App-сервисы compose — inert-заглушки** под профилем `app` («require Dockerfiles + Prisma schema owned by tasks 1.3+») — контейнеризация app = скоуп самого пилота, НЕ блокер Epic E.
- На VM: docker + systemd 255 есть, **pm2 НЕТ**. Порты 5432/6379 заняты инфрой; app-порты свободны.
- **Вывод для E.A:** менеджер процесса = **systemd-юниты** на `node dist/main.js` поверх `releases/<ts>`+`current`-симлинка (кратчайший путь, D-1 подтверждён: deploy локален внутри VM); docker-профиль — альтернатива после Dockerfiles пилота (не v1). Prisma-миграции — учесть шагом deploy (`migrate deploy`) — наличие схемы проверить в `packages/db` при сборке E.A.

**E1 — deploy/rollback ядро** (owner-гейт после E.A):
- **E.A** — Integrator D3-runtime capability: deploy-skill + контракт CNT-* + role-агент `deployer` (D3-05/06).
- **E.B** — Orchestrator `deploy-to-stage` (build+test → P7 boot-гейт → deploy staging-инстанса → healthcheck) как fabric-брекет charter'а.
- **E.C** — `rollback-release` (симлинк-swap; staging auto по решению владельца).
- **E.D** — P7 живой boot (`bootSmoke:true`) на реальном dev-env пилота.

**E2 — monitoring + F3 + смоук:**
- **E.E** — минимальный D5: healthcheck + liveness → PA/owner-queue.
- **E.F** — F3 wiring: operation-классы deploy/rollback в резолвер; floor реально упирается в deploy; снятие «L3≡L2».
- **E.G** — live-смоук на VM: deploy → healthcheck PASS → индуцированный провал → auto-rollback → floor-гейт на prod-таргете. (= smoke-план Epic E; отдельный план-док нарезать при старте E2.)

## Cuts (v1.1+; полные записи — `dev/v1_1_backlog.md` §Epic E)

C-E1 observability-стек · C-E2 внешний prod-хост/multi-host · C-E3 standalone CI-сервер · C-E4 полная auto-rollback policy-матрица · C-E5 provisioning реальных секретов/аккаунтов (floor) · C-E6 D4 создание новой QA-инфры · C-E7 VM-Integrator-as-DevOps (computer-use).

## Дрейф-свип (Section 3 — исполнено kickoff-коммитом)

Починено: `ECOSYSTEM_VISION.md` строки «S6 = FAIL» (§2.1 таблица + §Epic E предусловия) → ре-статус ✅; `ecosystem-map.overlay.json` roadmap-блок (orch-6ch/orch-s7 выполнены — удалены из «что дальше», vision-ef актуализирован) + реген карты. «substrate-gated»-метки в orchestrator runtime/SPEC — НЕ дефекты (точная карта разрыва, снимается самой сборкой E по мере появления D3-tool). Архивные снапшоты (`dev/_archive/process-fabric/**`) не редактируются по конвенции.

## Static-context budget (Section 3b)

Kickoff не добавляет always-on контента (readiness-док и backlog — reference, читаются по нужде). Инвентарь без изменений относительно 1.10.0-состояния; замер при следующем полнофазном kickoff.
