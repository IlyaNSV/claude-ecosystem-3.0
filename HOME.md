# 🏠 HOME — Ecosystem 3.0 vault

> Этот репозиторий открывается как **Obsidian vault** для локальной навигации (DEC-DEV-0046). Эта заметка — точка входа в graph view. `workspace.json`/`graph.json` — per-machine (gitignored); остальной baseline config закоммичен.

## Куда идти

| Зачем | Документ |
|---|---|
| 🗺️ **Визуальная карта системы** (pipeline + C4) | [[docs/MAP]] |
| 🧭 **Где ПРАВДА про класс X / кто authoritative при конфликте** | [dev/INFORMATION-MAP.yaml](dev/INFORMATION-MAP.yaml) |
| 📍 **Где мы сейчас** (статус, единственный источник) | [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) |
| 🤔 Что это и зачем | [[README]] |
| 📖 Разработка самой экосистемы | [[CLAUDE]] → [[DEV_JOURNAL]] (последние entries) |
| 🧩 PMO-карта D1-D6 | [[docs/pmo/pmo-map]] |
| 📚 Module SPECs | [[docs/README]] |

## Как пользоваться vault

- **Graph view** (Ctrl/Cmd+G) — увидеть связи между документами.
- **`[[wikilinks]]`** приветствуются в `dev/`-заметках и DEV_JOURNAL для построения графа decisions. Markdown-ссылки `[text](path)` тоже работают (и рендерятся на GitHub) — используем их в consumer-facing доках.
- Начинай с [[docs/MAP]] — это entry-point map; дальше она ссылается на канонические документы.
