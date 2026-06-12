# Pilot ↔ Ecosystem Reconciliation Plan

> **Что это:** последовательный план двусторонней реконсиляции канонического репозитория экосистемы
> и экосистемного слоя пилота `my-first-test/.claude/`, которые ~2 недели эволюционировали независимо.
> Источник: research-сессия 2026-06-12 (DEC-DEV-0065). Полный rationale — в DEV_JOURNAL.
>
> **Зачем документ:** Session Audit видит pilot-fork drift, но рефьютит его («не дефект канона») —
> у аудита нет категории «канонизировать пилотную фичу». Этот план — owner дрейфа.
> После выполнения Шага 4 документ архивируется в `dev/_archive/`.

**Статус:** Шаг 1 ✅ (PR #29) | Шаг 2 ✅ (DEC-DEV-0066) | Шаг 3 ✅ (DEC-DEV-0067) | Шаг 4 ⬜
**Последняя сверка дрейфа:** 2026-06-12 (пилот HEAD `f6d91a3`, канон `aba24df`)

---

## Baseline и метод сверки

- Слой пилота = **v1.4.0** (последний полный sync — пилотный коммит `af2b1b8`) + частичный reconcile
  DEC-DEV-0063 (`ad17588`: только `adapters/stitch-to-opendesign.js`).
- Метод: рекурсивный diff деплоируемой зоны + **трёхстороннее сравнение** каждого расходящегося файла
  с блобом `v1.4.0` → направление дрейфа per-file:

```bash
# в чекауте экосистемы; P = путь к пилотному .claude
git show "v1.4.0:$f" > /tmp/base
diff -q --strip-trailing-cr /tmp/base "$P/$f"   # продукт == base → отстал (ECO-ONLY)
git show "HEAD:$f"   | diff -q --strip-trailing-cr - "$P/$f"   # == HEAD → уже синхронен
# != base и != HEAD при HEAD==base → локальная фича пилота (LOCAL-ONLY); иначе конфликт
```

⚠️ Gotcha: `diff -r --exclude=integrator` маскирует и `commands/integrator/`, `skills/integrator/`
(exclude матчит basename на любом уровне). Namespace-папки сверять отдельным проходом.

---

## Поток А: экосистема → пилот (пилот отстал; 28 изменённых + 9 новых файлов)

Пилот в этих файлах byte-equal v1.4.0 — конфликтов нет, закрывается одним `/ecosystem:update` (Шаг 4).

| Кластер | DEC | Ключевые файлы |
|---|---|---|
| LESSON-* самокоррекция | 0062 | `commands/product/lesson.md`, `docs/pmo/artifacts/LESSON.md`, `hooks/product/lesson-{gate,presence-gate}.js`, `skills/product/lesson-capture.md`, `skills/ecosystem/self-correction.md`, правки validate/validation/feature-session/templates |
| Wipe-protection update | 0061 | `commands/ecosystem/update.md` (Step 5.0 safety commit) |
| open-design viewer-остаток | 0063 | `skills/design/open-design-viewer.md`, `commands/design/{migrate,start,status}.md`, BOOTSTRAP daemon-секция, `commands/integrator/add.md` docker-path, `skills/integrator/tool-profiling.md`, canonical header `adapters/mk-to-stitch.js`, SPEC'и |
| V-18 + DA-контракт | 0064 | `hooks/product/artifact-validate.js`, `agents/product/devils-advocate.md`, `validation.md`, `feature-session.md` |
| Harness-audit | 0055 | `commands/ecosystem/{bootstrap,verify}.md`, `settings.json.template` |
| Doc-реформа + счётчики | 0054/PR#27 | `docs/MAP.md` (новый), `docs/orchestrator-module/SPEC.md` (новый), README/ROADMAP/CHANGELOG, pmo-доки |

## Поток Б: пилот → экосистема (локальные фичи; ~1840 строк + 416 instance-адаптеры)

| # | Кластер | Пилотные коммиты | Состав | Статус |
|---|---|---|---|---|
| 1 | **Worktree pre-flight** | `887c52f` | `hooks/product/worktree-{preflight,enter-guard}.js` + manifest-entry | ✅ **этот PR** (DEC-DEV-0065; генерализация: убрана ссылка «bead m5k») |
| 2 | **App Map (AM)** | `019bf5e`, `c561dc1` | `docs/pmo/artifacts/AM.md` (24-й тип, singleton), `commands/design/map.md`, `skills/design/app-map-generate.md`, 6× `hooks/design/app-map-*.js` (в manifest только `app-map-cascade`), V-AM-* в `design-artifact-validate.js`, правки design-manifest и `artifacts/README.md` | ✅ **DEC-DEV-0066** (канонизирован; счётчики 24/44 sweep'нуты; пути унифицированы на корневой `.product/app-map.md`) |
| 3 | **open-design generator (CNT-004)** | `edf7057` (DEC-INT-0012) | `skills/design/open-design-workflow.md`, dispatch-строка в `design-session.md`, instance-адаптеры `od-mcp-call.cjs` / `od-consolidate.cjs` / `od-fidelity-check.js` | ✅ **DEC-DEV-0067** (dual role: generator opt-in + viewer; tri-location закрыт — 3 канонических адаптера; enum-sweep) |

## Конфликты (обе стороны меняли)

| Файл | Канон добавил | Пилот добавил | Merge |
|---|---|---|---|
| `hooks/product/manifest.yaml` | lesson-gate, lesson-presence-gate | worktree-enter-guard | ✅ закрыт этим PR (канон теперь содержит все 3) |
| `docs/pmo/artifacts/README.md` | LESSON → «23 типа» | AM → «23 типа» | ✅ закрыт Шагом 2 (DEC-DEV-0066): канон = 24 типа (LESSON + AM) |
| `adapters/mk-to-stitch.js` | canonical tri-location header (0063 backfill) | держит pre-backfill instance-вариант | тело идентично; закроется Шагом 4 |

## Не дрейф (различия by design — не «чинить»)

- `kiro-*` (17), `using-git-worktrees`, `finishing-a-development-branch` — third-party skills (cc-sdd и
  внешние), preserved namespaces при update.
- `adapters/.sync-metadata.yaml` — instance-штамп DEC-DEV-0044.
- Отсутствие в пилоте `HOME.md`, `INSTALL-HUMAN.md`, `package.json`/`eslint`/`tests/`, `dev/`,
  `DEV_JOURNAL.md`, `.obsidian` — never-copy zone update.md.
- `.claude/.gitignore` пилота — legacy старого bootstrap; update его не управляет.
- `.claude/integrator/` целиком — user zone (но canonical-источники адаптеров обязаны жить в repo
  `adapters/` — см. Поток Б #3).

---

## Последовательность шагов

- [x] **Шаг 1 — worktree pre-flight upstream** (PR #29, DEC-DEV-0065).
- [x] **Шаг 2 — App Map extraction** (DEC-DEV-0066): canonical `AM.md`, `/design:map`, skill,
      6 скриптов, V-AM-* (+каталог §5.3b), merge `artifacts/README.md` (LESSON + AM = 24),
      счётчик-sweep 24/44, +4 smoke-кейса.
- [x] **Шаг 3 — open-design generator** (DEC-DEV-0067): dual role принят; канонизированы
      od-адаптеры в repo `adapters/`, dispatch в `design-session.md`, enum'ы MK.md/SPEC.
- [ ] **Шаг 4 — `/ecosystem:update` в пилоте.** Закрывает Поток А одним прогоном. Затем там же —
      runtime smoke S-LE + Phase 6 S1-S7 (давно deferred).

## ⚠️ Главный риск (зачем порядок именно такой)

`/ecosystem:update` — это **rsync-with-delete** внутри managed namespaces `{product, design,
integrator, ecosystem}` + flat-sync `docs/`. Запуск ДО Шагов 2-3 **удалит из рабочего слоя пилота**
все файлы Потока Б (map.md, app-map-*.js, open-design-workflow.md, AM.md) и перезапишет локальные
правки (`design-session.md` dispatch, V-AM в validate). Восстановимо из git/level-1/level-2 backup'ов,
но слой сломается: `design.yaml` останется с `default_design_tool: open-design` при удалённом skill'е.
**Сначала upstream (Шаги 2-3 или осознанное решение «не канонизировать»), потом update.**
