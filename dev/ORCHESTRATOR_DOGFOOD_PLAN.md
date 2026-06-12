# Orchestrator Dogfood Plan — снятие регламента `route-handoff-to-cc-sdd`

> **Статус:** active (создан 2026-06-02, DEC-DEV-0058).
> **Pre-flight update:** 2026-06-12 — Шаги 0/1/2 и Preconditions синхронизированы с реальным состоянием `my-first-test`. Исправлено: путь `pmo-mapping.yaml`, адаптер только `--verify-only` (боевого режима нет), cc-sdd = `kiro-*` skills (не `/kiro:` slash-команды).
> **Цель:** эмпирически снять регламент **первого** процесса Оркестратора, вручную сыграв его роль над cc-sdd на `my-first-test`. Выход — обоснованный регламент, который станет первым Workflow-скриптом + дорастит `docs/orchestrator-module/SPEC.md` до v1.0.
> **Почему вручную сначала:** защита от self-referential collapse (CLAUDE.md §3) — не кодировать регламент из головы, а снять с реального прогона.

---

## Где это выполняется

**Среда:** отдельная сессия Claude Code с `cwd = my-first-test` (`C:\Users\pw201\WebstormProjects\my-first-test` — пилот, куда забутстрапена экосистема), **не** в репозитории самой экосистемы. Все пути в командах ниже — относительно корня `my-first-test`.

**Роль:** ты вручную играешь Оркестратора — модуль не построен, `/orchestrator:*` команд нет. Запускаешь уже существующие команды Product/Integrator + cc-sdd `kiro-*` skills + reference-адаптер; наблюдения пишешь в scratch-файл (черновик регламента).

**Чем НЕ является:** это не прогон будущего Workflow-скрипта, а ручная репетиция, с которой снимается его детерминированный скелет.

---

## Что снимаем (harvest targets)

На каждом шаге фиксируем 4 вещи:
1. **Фактическая последовательность** — что за чем, какие команды cc-sdd.
2. **Точки решений** — где нужно суждение (динамический выбор), где — детерминированный шаг.
3. **Capability-запросы Интегратору** — где не хватило «рук» (tool/MCP/доступ) или «головы» (role-агент+skill) под шаг (§6 SPEC, role A / DEC-DEV-0060), какой формат capability-spec был бы нужен. NB: запрос — на оснащение, не на исполнение инфра-шага.
4. **Гейты** — где требуется verification и/или человеческий approve (autonomy tier, §7 SPEC).

---

## Preconditions

> **Verified state (2026-06-12, pre-flight сверка с `my-first-test`):** `.product/` на месте; cc-sdd заведён (`active-tools.yaml`: v3.0.2, Stage 6 PASS); адаптер установлен — `.claude/integrator/adapters/handoff-to-ccsdd.js`; `tool-docs/cc-sdd.md` есть. Готовые handoff'ы: **FM-005** (`status: ready`), FM-001 / FM-002 (`status: partial`). ⚠️ git на ветке `feat-worktree-preflight` (не main, +1 коммит), есть параллельный worktree — реши гигиену ветки до прогона.

- [ ] `my-first-test` доступен; рабочее дерево чистое; ветка выбрана осознанно (не «случайный» feature-branch). `.product/` на месте.
- [ ] cc-sdd заведён (`.claude/integrator/active-tools.yaml`; если нет — `/integrator:add cc-sdd`). Заведён через `--claude-skills` → примитивы = **skills** `kiro-*`, не slash-команды (см. Шаг 2).
- [ ] Выбрана фича с handoff `status: ready` — кандидат по умолчанию **FM-005** (единственный ready на 2026-06-12). Зафиксировать FM-ID. NB: FM-005 = billing → вероятно триггернёт capability-канал (Шаг 3); для «чистого» run без инфра — сначала довести FM-001/FM-002 до ready.
- [ ] Открыт scratch-файл для harvest-заметок (черновик регламента).

---

## Шаги (ручная оркестрация)

### 0. orchestrator-init (§5 SPEC)

**Где/что запускать** (в сессии `cwd = my-first-test`):
```bash
cat .claude/integrator/active-tools.yaml        # инструменты + их команды/skills
cat .claude/integrator/tool-docs/cc-sdd.md      # «Operating Protocols» cc-sdd (важно для Шага 2)
cat .claude/integrator/pmo-mapping.yaml         # ← путь ИСПРАВЛЕН (НЕ .product/): покрытие зон + gaps
/product:status                                 # статусы фич/артефактов
git status && git branch --show-current         # состояние среды/ветки
```

**На что смотреть (harvest):** какие из этих источников реально понадобились для старта; чего не хватило; видно ли из `pmo-mapping` / `gaps`, каких «рук/головы» не достаёт под предстоящие шаги.

### 1. Приём handoff

⚠️ **Адаптер работает ТОЛЬКО в `--verify-only`** — боевой (production) режим он явно отклоняет (`ERROR: production-mode invocation is Orchestrator scope`). Это by design: живой вызов cc-sdd — работа Оркестратора, которую мы здесь снимаем вручную. Поэтому «боевого» прогона адаптером нет; мост из JSON в cc-sdd ты прокидываешь сам на Шаге 2.

**Что запускать:**
```bash
node .claude/integrator/adapters/handoff-to-ccsdd.js \
  --verify-only \
  --fixture .product/handoffs/FM-005-handoff.md \
  --output handoff-ccsdd.json
```
JSON в `handoff-ccsdd.json` — это вход (`cc_sdd_input`), который skill `kiro-spec-init` **должен был бы** получить, либо ошибка валидации контракта.

**На что смотреть (harvest):** прошла ли валидация контракта; где адаптер споткнулся / чего не хватило в handoff; совпадает ли форма `cc_sdd_input` с тем, что реально ждёт cc-sdd 3.0.2 (репо-reference адаптера помечен `^2.1.0`; `contract_schema_version: 1`).

### 2. cc-sdd chain (D2-T01/T06)

⚠️ **cc-sdd установлен как SKILLS, не slash-команды.** В `my-first-test` нет `/kiro:*` команд; примитивы — skills `kiro-*` в `.claude/skills/`. Вход — **не** `kiro-spec-init` напрямую, а skill-router **`kiro-discovery`** («Entry router for new work»), который сам маршрутизирует на spec-init / extend / direct-impl. Skills вызываются по интенту (харнесс подгружает нужный), а не строкой `/kiro:...`.

**Что запускать (вручную, как Оркестратор):** скормить вход из `handoff-ccsdd.json` в цепочку cc-sdd через skills:
1. `kiro-discovery` — router (смотри, куда направит).
2. далее по его маршруту: `kiro-spec-init` → `kiro-spec-requirements` → `kiro-spec-design` → `kiro-spec-tasks`.
   - `kiro-steering` — только если steering не настроен; `.kiro/` уже существует с 2026-05-27, так что, вероятно, **пропустить** (проверь `.kiro/steering/`).
   - альтернативы router'а: `kiro-spec-quick` / `kiro-spec-batch` — зафиксируй, если он выбрал их.

**На что смотреть (harvest):** какой путь выбрал `kiro-discovery`; последовательность и её жёсткость (что нельзя параллелить — «Operating Protocols» в `tool-docs/cc-sdd.md`); точки, где cc-sdd принял арх-решение (стек, БД) — это будущие capability-триггеры Шага 3.

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
