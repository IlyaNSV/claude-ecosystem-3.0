# Ecosystem 3.0 — карта системы (entry-point map)

> **Роль:** визуальная точка входа для свежей сессии / нового читателя. Это **индекс**, а не источник истины — каждая диаграмма ссылается на канонический документ, который описывает зону детально.
>
> **Канонические авторитеты** (диаграммы их визуализируют, не заменяют):
> - Pipeline D1-D6, кто owns / что delegated → [docs/pmo/pmo-map.md](pmo/pmo-map.md)
> - Артефакты (24 типа) и их зависимости → [docs/pmo/artifacts/README.md](pmo/artifacts/README.md)
> - Процессы P1-P5 → [docs/pmo/processes.md](pmo/processes.md) · Правила валидации → [docs/pmo/validation.md](pmo/validation.md)
> - Модули → [docs/product-module/SPEC.md](product-module/SPEC.md), [docs/design-module/SPEC.md](design-module/SPEC.md), [docs/integrator-module/SPEC.md](integrator-module/SPEC.md)
> - Статус «где мы сейчас» → [ROADMAP.md](../ROADMAP.md#где-мы-сейчас) (единственный источник)
>
> **Freshness-модель:** диаграммы coarse-grained (уровень модулей/доменов, не строк) — дрейфуют медленно. Обновлять только при изменении топологии модулей или набора доменов, не каждую фазу. Mermaid-блоки (текст, git-diffable, рендерятся в GitHub и в Obsidian-vault).

---

## 1. Pipeline D1-D6 — что контролируем, что делегируем

Главный тезис экосистемы: **детальный контроль D1 + D2-Behavioral, делегирование остального через `handoff.md`.** `handoff.md` — boundary object: самодостаточный snapshot, который передаёт всё о фиче в любой инструмент-реализатор.

```mermaid
flowchart LR
    subgraph ECO["🟢 Ecosystem-controlled — детальный контроль"]
        direction TB
        D1["D1 · Discovery & Strategy<br/>Product Module<br/>PS·MR·CA·SEG·VP·HYP·MVP·RM·RL"]
        D2B["D2-Behavioral · Spec<br/>Product Module B01-03, B05<br/>FM·SC·BR·LC·VC·IC·RPM·NFR"]
        D2D["D2-B04 · UI Design<br/>Design Module — conditional has_ui<br/>MK·DS·NM"]
        D1 --> D2B
        D2B -. "если has_ui=true" .-> D2D
    end

    HO{{"handoff.md<br/>boundary object<br/>self-contained snapshot"}}
    D2B --> HO
    D2D -. assets .-> HO

    subgraph EXT["🔵 Delegated via Integrator — tool-agnostic"]
        direction TB
        D2T["D2-Technical<br/>Architecture · Tech stack"]
        D3["D3 · Development & Delivery"]
        D4["D4 · Quality Assurance"]
        D5["D5 · Ops & Feedback<br/>отложено v2+"]
        D2T --> D3 --> D4 -.-> D5
    end
    HO --> D2T

    ORC["Orchestrator Module<br/>планируется — запуск D3-D6"]:::planned
    ORC -. оркеструет .-> EXT
    D6["D6 · Meta: Ecosystem Governance<br/>Integrator Module + человек"]
    EXT --- D6

    classDef planned stroke-dasharray: 5 5;
```

Детально (роли, обязанности D*-NN, статусы): [pmo-map.md](pmo/pmo-map.md).

---

## 2. C4 Container — из чего собрана система при установке

Что физически где живёт: репозиторий (source of truth) → bootstrap/update → зона `.claude/` в проекте + store `.product/`. **D7 (meta-improvement) — dev-only, никогда не deployed** в пользовательские проекты (частая путаница с D6).

```mermaid
flowchart TB
    subgraph REPO["claude-ecosystem-3.0 — этот репозиторий, source of truth"]
        DOCS["docs/ · SPECs + PMO catalogs<br/>декларативная база"]
        ART["commands/ skills/ agents/ hooks/<br/>deployable артефакты"]
        D7["dev/meta-improvement/ · D7<br/>⚠ dev-only — НЕ deployed"]:::devonly
    end

    subgraph PROJ["User project"]
        CLAUDE[".claude/ · deployed ecosystem zone<br/>commands·skills·agents·hooks·docs"]
        PROD[".product/ · артефакт-store<br/>source of truth проекта"]
        PMODS["Модули: Product · Design · Integrator · Orchestrator 🔜"]
    end

    EXTOOLS["Внешние инструменты<br/>cc-sdd / kiro и др."]
    CC["Claude Code — runtime"]

    ART -- "bootstrap / update" --> CLAUDE
    DOCS -- "bootstrap" --> CLAUDE
    CC --> PMODS
    CLAUDE --> PMODS
    PMODS --> PROD
    PMODS -- "handoff.md" --> EXTOOLS
    PMODS -. "Integrator подключает" .-> EXTOOLS

    classDef devonly stroke-dasharray: 4 4;
```

D6 vs D7 disambiguation: [dev/meta-improvement/CONVENTIONS.md §1.3](../dev/meta-improvement/CONVENTIONS.md).

---

## 3. Artifact dependency graph (ERD) — reference-глубина

Граф зависимостей 24 артефактов (PS → HYP → FM → SC/BR/LC/…) намеренно **не дублируется** здесь — он живёт в прозе/таблицах [docs/pmo/artifacts/README.md](pmo/artifacts/README.md) (dependency graph) и в [pmo-map.md](pmo/pmo-map.md) (per-домен). Визуальный ERD — кандидат на добавление сюда, если/когда понадобится (low priority; обновляется только при добавлении типа артефакта).

> _Сознательно НЕ включено:_ таблица artifact→skill→command cross-ref. Она fine-grained (ломается почти каждую фазу при переименовании skill/добавлении команды) — высокий sync-cost, а неверная карта хуже отсутствующей. При необходимости — генерировать из frontmatter, не вести руками.
