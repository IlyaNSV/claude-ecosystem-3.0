# Orchestrator Dogfood Plan — снятие регламента `route-handoff-to-cc-sdd`

> **Статус:** active (создан 2026-06-02, DEC-DEV-0058).
> **Цель:** эмпирически снять регламент **первого** процесса Оркестратора, вручную сыграв его роль над cc-sdd на `my-first-test`. Выход — обоснованный регламент, который станет первым Workflow-скриптом + дорастит `docs/orchestrator-module/SPEC.md` до v1.0.
> **Почему вручную сначала:** защита от self-referential collapse (CLAUDE.md §3) — не кодировать регламент из головы, а снять с реального прогона.

---

## Что снимаем (harvest targets)

На каждом шаге фиксируем 4 вещи:
1. **Фактическая последовательность** — что за чем, какие команды cc-sdd.
2. **Точки решений** — где нужно суждение (динамический выбор), где — детерминированный шаг.
3. **Capability-запросы Интегратору** — где не хватило «рук» (tool/MCP/доступ) или «головы» (role-агент+skill) под шаг (§6 SPEC, role A / DEC-DEV-0060), какой формат capability-spec был бы нужен. NB: запрос — на оснащение, не на исполнение инфра-шага.
4. **Гейты** — где требуется verification и/или человеческий approve (autonomy tier, §7 SPEC).

---

## Preconditions

- [ ] `my-first-test` доступен, git-репо чистое, `.product/` на месте.
- [ ] cc-sdd заведён в пилоте (проверить `active-tools.yaml`; если нет — `/integrator:add cc-sdd`).
- [ ] Выбрана одна фича с готовым `handoff.md` (D2-Behavioral завершён). Зафиксировать FM-ID.
- [ ] Окно для записи наблюдений (черновик регламента) открыто.

---

## Шаги (ручная оркестрация)

### 0. orchestrator-init (§5 SPEC)
- [ ] Собрать контекст вручную: `active-tools.yaml`, `tool-docs/cc-sdd.md`, `pmo-mapping.yaml`, `/product:status`, карта `.product/`, git/env.
- [ ] **Harvest:** какие из этих источников реально понадобились для старта? Чего не хватило?

### 1. Приём handoff
- [ ] Прочитать `handoff.md` фичи; прогнать через адаптер `handoff-to-ccsdd.js` (`--verify-only --fixture` сначала, затем боевой).
- [ ] **Harvest:** где адаптер споткнулся / чего не хватило в handoff.

### 2. cc-sdd chain (D2-T01/T06)
- [ ] `/kiro:steering` (если fresh) → `/kiro:spec-init` → `spec-requirements` → `spec-design` → `spec-tasks`.
- [ ] **Harvest:** последовательность и её жёсткость (что нельзя параллелить — ср. tool-docs «Operating Protocols»); точки, где cc-sdd принял арх-решение (стек, БД).

### 3. Capability self-check → запрос Интегратору (§6 SPEC) — если возникла
- [ ] Перед инфра-шагом — **capability self-check**: есть ли «руки» (docker MCP / доступ / env) и «голова» (role-агент+skill, напр. `db-admin`)?
- [ ] Если чего-то нет — сформулировать **capability-spec** Интегратору: «обеспечь {tool|mcp|role-agent|skill} X vY, зона=D3-05, tier=dev». **НЕ** «разверни БД» — deploy Оркестратор исполняет сам после оснащения (role A / DEC-DEV-0060).
- [ ] **Harvest:** какие поля capability-spec реально нужны (OD5); чего не хватило в self-check; сработал бы auto-approve (dev-tier whitelist) или нужен hard-approve gate (OD1).

### 4. Verification-гейт (§2 SPEC)
- [ ] Сверить выход cc-sdd (`tasks.md` / spec) с контрактом handoff (acceptance из SC/BR).
- [ ] **Harvest:** что именно проверяем детерминированно; где нужен LLM-суждение vs правило.

---

## Выход (deliverables)

- [ ] Черновик регламента `route-handoff-to-cc-sdd` (последовательность + точки решений + гейты + Integrator-команды).
- [ ] Уточнения к `docs/orchestrator-module/SPEC.md`: OD5 (формат Integrator-запроса), autonomy-tier раскладка для этого процесса, реальные verification-правила.
- [ ] Решение: достаточно ли 1 прогона или нужен 2-й (другая фича / с инфраструктурой).
- [ ] DEV_JOURNAL entry с findings (если non-trivial).

---

## После dogfood

Регламент → первый Workflow-скрипт (`orchestrator/processes/route-handoff-to-cc-sdd`) → концепт-SPEC дорастает до v1.0 → kickoff implementation-инкремента по D7-ритуалу.
