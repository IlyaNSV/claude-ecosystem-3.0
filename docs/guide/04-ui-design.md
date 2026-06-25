# Дизайн интерфейса — когда у фичи есть UI

> **Для кого:** твоя фича имеет интерфейс, и ты хочешь спроектировать экраны *внутри* того же потока, прежде чем уходить в handoff. Этот документ — про условный **Design Module** (`/design:*`). Если у фичи нет UI — пропусти его целиком.

---

## 0. Когда он вообще включается

Design Module — **условный sub-модуль** Product Module. Он активируется только когда у фичи `has_ui=true`:

- **Автоматически:** на шаге `F.8` потока `/product:feature` — как только спецификация фичи с `has_ui=true` готова, она сама зовёт `/design:start <FM-id>`.
- **Вручную:** `/design:start FM-NNN` в любой момент после того, как у фичи есть поведенческая спека.

Если `has_ui=false` — модуль **не запускается**, поток идёт прямо к handoff.

---

## 1. Предусловия

Дизайн не рисуется в вакууме — он опирается на готовое поведение:

- Сначала пройди `/product:feature FM-NNN` — нужны активные `SC` (сценарии), `BR` (правила), `RPM` (роли), `BG` (термины).
- Нужен **design-инструмент**: Stitch (default, требует ключ — см. [INSTALL-HUMAN.md](../../INSTALL-HUMAN.md)) или **HTML fallback** (без внешнего ключа). Claude Design — co-primary.

---

## 2. Поток дизайн-сессии

`/design:start FM-NNN` ведёт через 6 шагов (как и Product, по паттерну draft→approve):

```
D.1 Brief        → дизайн-бриф из SC/BR/RPM            🟡 review
D.2 Screens      → первая генерация экранов            🟠 strategic
D.3 Iterate      → итеративная доводка (/design:iterate) 🟠 strategic
D.4 States       → матрица состояний компонентов        🟢 confirmation
D.5 Artifacts    → сборка MK / DS / NM                  🟠 strategic
D.6 Export       → UI-contract для handoff §10
        │
        └──▶ возврат в Product Module, фича идёт к handoff
```

---

## 3. Команды Design Module

| Команда | Когда |
|---|---|
| `/design:start <FM-id>` | Начать дизайн-сессию для фичи с `has_ui` (или зовётся авто из `/product:feature`) |
| `/design:iterate <MK-id>` | Продолжить итерацию на активном макете |
| `/design:system` | Управление Design System: ревью `DS` / ре-экстракт из `MK` |
| `/design:map` | Собрать/обновить App Map (`AM`): модули × кейсы × пути + CJM |
| `/design:export <FM-id>` | Собрать UI-contract из `MK/DS/NM` для handoff §10 |
| `/design:status` | Дашборд: счётчики `MK/DS/NM`, итерации, Stitch-квота |
| `/design:migrate <MK-id> --to <tool>` | Перенести макет между Stitch ↔ HTML ↔ open-design |

---

## 4. Что производит

Три артефакта D2-B04 (+ опц. App Map):

- **`MK`** Mockup Package — пакет макетов на экран/флоу.
- **`DS`** Design System — токены/компоненты/паттерны (сквозной, один на продукт).
- **`NM`** Navigation Map — карта навигации на флоу.
- **`AM`** App Map (+CJM) — обзорная карта приложения (через `/design:map`).

Эти артефакты **сами встраиваются в `handoff.md §10`** — отдельно ничего экспортировать в handoff не нужно (`/design:export` — это sanity-check).

---

## 5. Инструменты и миграция

Stitch (default) · Claude Design (co-primary) · **HTML fallback** (без ключа) · open-design · Figma (future). Переключение — `/design:migrate <MK-id> --to <stitch|html|open-design>` с per-MK approve-гейтом и rollback; регенерация лоссова (бриф + метаданные), open-design — лосслес визуальный импорт.

---

## Куда дальше

- ▶️ Откуда сюда попадаешь — [`01-first-session.md`](01-first-session.md) §6.
- 🗺️ **[Интерактивная карта](ecosystem-map.html)** — Design-панель (фильтр «условно has_ui»).
- 📖 Первоисточник — [`docs/design-module/SPEC.md`](../design-module/SPEC.md), артефакты [`MK`](../pmo/artifacts/MK.md) · [`DS`](../pmo/artifacts/DS.md) · [`NM`](../pmo/artifacts/NM.md).
