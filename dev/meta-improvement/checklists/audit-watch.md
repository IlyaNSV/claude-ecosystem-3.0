# Audit Watch — полу-авто триггер Session Audit v2 (G1)

> **Назначение:** держать универсальный аудит сессий «почти на автомате», пока Claude открыт.
> Drop-in поверх Инкр.1 (`--classify`) + Инкр.2 (effect-probe). Решение: [DEC-DEV-0057](../../DEV_JOURNAL.md).
> **Принадлежность:** D7 meta-improvement, dev-only (CONVENTIONS §2/§9). НЕ деплоится в пользовательские проекты.
> **Owner:** developer. **Запуск:** из корня репо экосистемы (`cwd=claude-ecosystem-3.0`).

---

## Как это работает (замкнутый полу-авто цикл)

```
[Сессия в пилоте завершается]
  → SessionEnd hook (capture) пишет маркер в audit-index.md Pending   (уже есть, идемпотентно)
  → /loop периодически зовёт audit-watch.js
  → audit-watch → audit-smoke.js --classify --since=<interval>
       classify → effect-probe → claude -p аудитор → per-session отчёт   (skip уже-Processed)
```

Драйвер **идемпотентен**: пропускает сессии из Processed и батчит по `--since`. Повторные срабатывания
дёшевы — `claude -p` тратится только на новые сессии.

---

## Запуск (выбор по ситуации)

### 1. Полу-авто через `/loop` (рекомендуемый режим)

В открытой Claude-сессии в корне репо экосистемы:

```
/loop 45m node dev/meta-improvement/scripts/audit-watch.js
```

- Работает, пока сессия открыта; крутится на заданном интервале.
- **Интервал ↔ `--since`:** держи `--since` ≥ интервала, чтобы сессии не проскакивали между срабатываниями.
  Дефолт обёртки `--since=1h` рассчитан на интервал 30–60 мин. Чаще 30 мин обычно не нужно — пилотные
  сессии редки, а каждый аудит стоит `claude -p`.
- Прервать — обычная остановка `/loop`.

### 2. Durable `CronCreate` (альтернатива)

Если нужен таймер, переживающий смену темы внутри одной сессии (auto-expire 7 дней) — durable
`CronCreate` с той же командой. Тоже требует открытой Claude-сессии. Прыжок к этому механизму обоснуй
в DEC-DEV (CONVENTIONS §3 mechanism-ratio), если станет дефолтом.

### 3. Ручной «прямо сейчас»

```
node dev/meta-improvement/scripts/audit-watch.js --since=24h      # за сутки
node dev/meta-improvement/scripts/audit-smoke.js --classify       # весь Pending (catch-up)
node dev/meta-improvement/scripts/audit-smoke.js --classify --session-id=<uuid> --force   # одну, повторно
```

`--dry-run`, `--force`, `--target-project=<name>`, `--skip-aggregate` пробрасываются через обёртку.

---

## Что НЕ годится (проверено эмпирически)

- **routines / `RemoteTrigger`** исполняются в облаке claude.ai → **не видят** локальные транскрипты
  `~/.claude/projects/` и локальный git. Дисквалифицированы для локального аудита.
- **Windows Task Scheduler → `audit-watch.js`** — единственный по-настоящему автономный путь (когда Claude
  закрыт). Записан как **upgrade-path**, не подключён сейчас (см. [SESSION_AUDIT_V2_DESIGN §5.1](../../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md)).

---

## После прогона

1. Новые per-session отчёты — `dev/meta-improvement/audit-reports/<uuid>.md` (с `session_zones`,
   `session_mode`, `effect_summary`, секцией «Effect on product»). В Processed: `phase = —`, `mode = zones:<z1+z2>|<mode>`.
2. Просмотри findings и эффект на `.product/`; реши: inline-fix / queue / defer (NO auto-fix — CONVENTIONS §8).
3. Накопление отчётов across сессий — вход для синтезатора патчей (Инкр.3, ещё не реализован).

---

## См. также

- [`scripts/audit-watch.js`](../scripts/audit-watch.js) — обёртка · [`scripts/audit-smoke.js`](../scripts/audit-smoke.js) — драйвер
- [`scripts/classify.js`](../scripts/classify.js) · [`scripts/effect-probe.js`](../scripts/effect-probe.js) · [`rubrics/`](../rubrics/)
- [`checklists/audit-smoke-workflow.md`](audit-smoke-workflow.md) — ручной smoke-then-audit ритуал (phase-режим)
- [`SESSION_AUDIT_V2_DESIGN.md`](../../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md) §5 (триггер + effect-probe) · DEC-DEV-0056/0057
