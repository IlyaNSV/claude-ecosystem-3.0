# D7 audit-smoke workflow — developer ritual

> **Назначение:** инструкция и чеклист по тому, как использовать D7 conformance audit mechanism (Phase 4.1, DEC-DEV-0034) для валидации smoke-тестов фаз экосистемы.
>
> **Когда применять:** после имплементации новой фазы, когда написан `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` и нужно прогнать смоук в пилотном проекте.
>
> **Время выполнения:** ~10 мин setup (one-time) + 5-30 мин на сам аудит после smoke (зависит от количества сессий).

---

## TL;DR

1. **One-time setup** в пилотном проекте: `/ecosystem:enable-d7-audit`
2. **Per-phase smoke**: выполни шаги из smoke plan'а в пилоте → завершай сессии нормально
3. **Per-phase audit**: в репо экосистемы — `/meta:audit-smoke --phase=<N>`
4. **Прочитай** `dev/meta-improvement/audit-reports/phase-<N>-summary.md`
5. **Зафиксируй** findings в DEV_JOURNAL retroactive entry

---

## Связь между репо экосистемы и пилотным проектом

```
<ecosystem-repo>/                                  ← cwd для дев-работы и для аудита
├── dev/meta-improvement/
│   ├── hooks/session-audit.js                     ★ хук (живёт здесь)
│   ├── audit-index.md                             ★ журнал (Pending + Processed)
│   ├── audit-reports/                             ★ отчёты пишутся сюда
│   └── scripts/audit-smoke.js                     ★ CLI
├── dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md               ← план, по которому сверяем
└── .claude/commands/meta/audit-smoke.md           ← слэш-команда

<pilot-project>/                                   ← cwd во время smoke
├── .claude/
│   ├── settings.local.json                        ⚙ регистрирует хук абсолютным путём
│   └── ... (deployed bootstrap'ом продуктовые модули)
└── .product/                                      ← твои живые артефакты пилота

~/.claude/projects/<pilot-slug>/                   ← Claude Code сам пишет транскрипты
├── <session-uuid-1>.jsonl
└── ...
```

Хук живёт в репо экосистемы, но **запускается из пилотного проекта** через абсолютный путь в `settings.local.json`. Отчёты возвращаются в репо экосистемы. Пилот не загрязнён meta-артефактами.

---

## One-time setup (раз на пилотный проект)

### A.1 — Зарегистрируй хук в пилоте

```
cd <pilot-project>
claude
> /ecosystem:enable-d7-audit --ecosystem-root=C:/path/to/claude-ecosystem-3.0
```

Если флаг не передан — команда спросит абсолютный путь интерактивно.

**Что произойдёт:**
- В `.claude/settings.local.json` появится SessionEnd hook entry с `node <abs-path>/dev/meta-improvement/hooks/session-audit.js`
- Идемпотентно — повторный запуск ничего не сломает

### A.2 — Проверь регистрацию

```
cat .claude/settings.local.json
```

Должна быть секция `hooks.SessionEnd` со ссылкой на `session-audit.js`.

### A.3 — Убедись что аналог `node` доступен

```
node --version
```

Должен напечатать версию. Если нет — установи Node.js (хук исполняется через `node`).

---

## Per-phase ritual (на каждой фазе смоук-тестинга)

### B.1 — Подготовка

- [ ] Phase `<N>` имплементация завершена; написан `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` с пронумерованными `### S<N>` scenarios и `**Acceptance:** - [ ]` checklists
- [ ] Пилотный проект имеет registered hook (`/ecosystem:enable-d7-audit` уже выполнялся)
- [ ] Знаешь, какие сценарии S1..Sn хочешь покрыть

### B.2 — Обнови экосистему в пилоте

В пилотном проекте:

```
cd <pilot-project>
claude
> /ecosystem:update
```

Это подтянет последние commands/skills/hooks/agents Phase `<N>` в пилот.

### B.3 — Выполни smoke шаги

Открой `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` в репо экосистемы как референс. Выполняй S1, S2, ... в пилоте, можно за **несколько сессий** (одну часть в одной сессии, другую в другой — аудит соберёт всё вместе).

**Важно:** завершай каждую сессию нормально (`Ctrl+D`, `/exit`, или закрытием Claude Code). На SessionEnd хук запишет marker.

### B.4 — Убедись что markers накопились

В репо экосистемы:

```
cd <ecosystem-repo>
cat dev/meta-improvement/audit-index.md
```

В секции `## Pending` должны быть строки — по одной на каждую завершённую сессию.

Если markers нет → проверь:
- `/ecosystem:enable-d7-audit` действительно выполнялся в пилоте
- `node` в PATH у пилотного проекта
- `.claude/settings.local.json` пилота имеет hook entry

### B.5 — Запусти аудит

В репо экосистемы (cwd там):

```
claude
> /meta:audit-smoke --phase=<N>
```

Альтернативно — напрямую через CLI:

```
node dev/meta-improvement/scripts/audit-smoke.js --phase=<N>
```

**Опции:**
- `--phase=<N>` — обязателен (фаза, по чьему плану сверять)
- `--since=24h` — только markers за последние 24 часа
- `--target-project=<name>` — фильтр по basename target проекта
- `--session-id=<uuid>` — аудит одной конкретной сессии
- `--transcript=<path>` — аудит транскрипта не из индекса
- `--force` — повторно аудитировать уже Processed sessions
- `--dry-run` — показать что будет, без spawn auditor
- `--no-plan` — пропустить smoke plan, catalog-only mode
- `--skip-aggregate` — только per-session, без phase summary

### B.6 — Прочитай результаты

CLI напечатает paths к отчётам. Открой:

- `dev/meta-improvement/audit-reports/phase-<N>-summary.md` — **главный** документ с coverage matrix и recommendations
- `dev/meta-improvement/audit-reports/<session-uuid>.md` — детали per сессии (опционально)

**Coverage statuses:**
- ✅ COVERED — все Acceptance items сценария verified
- 🟡 PARTIAL — часть items verified, остальные неоднозначны
- 🔴 FAIL — explicit противоречие с acceptance
- ⚪ NOT-COVERED — сценарий не запускался в этих сессиях
- ❓ UNCERTAIN — evidence неоднозначно

### B.7 — Зафиксируй findings

Создай retroactive entry в DEV_JOURNAL (paтерн как для DEC-DEV-0023 Phase 3 smoke results):

```markdown
## DEC-DEV-NNNN — Phase <N> smoke audit results

**Date:** YYYY-MM-DD
**Trigger:** /meta:audit-smoke --phase=<N>
**Tag:** #phase-<N>-closure #smoke #audit

### Context
[Скопировать Overview из phase-<N>-summary.md]

### Outcome
[Скопировать Coverage matrix; перечислить FAIL/PARTIAL сценарии]

### Findings
[Из Critical issues + Recurring patterns секций summary]

### Lessons
[Из Recommendations + observations что surprised]

### Next
[Какие сценарии re-run, что defer, что codify как pattern]
```

---

## Pre-flight checklist (sanity перед B.5)

- [ ] `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` существует в репо экосистемы
- [ ] `dev/meta-improvement/audit-index.md` имеет ≥1 строку в Pending для нужной фазы
- [ ] `claude --version` работает в текущем shell (CLI orchestrator вызывает `claude -p`)
- [ ] Pending markers указывают на существующие `.jsonl` файлы (проверь random transcript_path — может ли его прочитать `cat`)
- [ ] Cwd = ecosystem repo (`pwd` показывает `claude-ecosystem-3.0`)

## Post-audit checklist (после B.6)

- [ ] `phase-<N>-summary.md` создан, читаем, имеет canonical frontmatter
- [ ] Coverage matrix покрывает все S<N> из плана (NOT-COVERED тоже строка)
- [ ] Counts в `coverage_summary` + `findings_count` arithmetically consistent (covered+partial+fail+not_covered+uncertain = total_scenarios)
- [ ] audit-index.md обновлён: соответствующие markers переехали Pending → Processed
- [ ] DEV_JOURNAL retroactive entry написан
- [ ] Решено для каждого 🔴/🟡 finding: inline fix / queue к Phase N+1 readiness / defer к v1.1

---

## Cleanup / archive

После Phase `<N>` closure:

- [ ] `phase-<N>-summary.md` — оставить навсегда (canonical record)
- [ ] Per-session `<uuid>.md` reports с `status: clean` старше 30 дней — можно удалить (`rm`)
- [ ] Per-session reports с findings — оставить пока blockers не resolved, потом архивировать в `dev/_archive/audit-reports/`
- [ ] `phase-<N>-aggregate.json` — можно архивировать вместе с `PHASE_<N>_SMOKE_TEST_PLAN.md` в `dev/_archive/phase-<N>/audit/` (per CONVENTIONS §5.1)
- [ ] audit-index Processed entries — оставить (idempotency record); архивировать в `_archive/audit-index-<YYYY>.md` раз в 6 месяцев если становится тяжёлым

## Troubleshooting

| Симптом | Причина | Фикс |
|---|---|---|
| `[session-audit] audit-index.md not found` в stderr пилота | `git pull` в ecosystem repo не выполнялся; нет файла | В ecosystem repo: проверь, что после Phase 4.1 merge `dev/meta-improvement/audit-index.md` действительно есть |
| Markers не появляются в Pending после SessionEnd | Хук не зарегистрирован или path неверный | `/ecosystem:enable-d7-audit` повторно; проверь `.claude/settings.local.json` |
| CLI печатает «Smoke plan not found for Phase N» | Plan не существует или в archive | Создай plan; если фаза в архиве — добавь `dev/_archive/phase-N/PHASE_N_SMOKE_TEST_PLAN.md` |
| Auditor exits non-zero | `claude` CLI не в PATH, или rate-limited, или timeout | `CLAUDE_CLI_PATH=/abs/path/to/claude node ...`; or `AUDIT_SMOKE_TIMEOUT_MS=1200000 node ...` |
| Большой транскрипт «не помещается» в auditor context | Pre-processing уже trims content blocks к 2000 chars; если ещё много — split sessions через `--session-id` по одной | Manually filter relevant scenarios через `--session-id=<uuid>` per-session |
| Report frontmatter «unparseable» | AI auditor нарушил schema (rename'ил field) | Re-run с `--force --session-id=<uuid>`; если повторяется — patch prompt session-audit.md anti-pattern list |
| Aggregator печатает wrong counts | AI пересчитал вместо copy из JSON | Re-run aggregator; если повторяется — усилить «never recount» в prompts/phase-audit-summary.md |

## See also

- [`hooks/session-audit.js`](../hooks/session-audit.js) — SessionEnd marker writer
- [`scripts/audit-smoke.js`](../scripts/audit-smoke.js) — CLI orchestrator
- [`prompts/session-audit.md`](../prompts/session-audit.md) — per-session auditor prompt
- [`prompts/phase-audit-summary.md`](../prompts/phase-audit-summary.md) — phase aggregator prompt
- [`audit-index.md`](../audit-index.md) — Pending + Processed journal
- [`audit-reports/README.md`](../audit-reports/README.md) — output directory schema
- [DEC-DEV-0034](../../../DEV_JOURNAL.md) — Phase 4.1 design rationale
