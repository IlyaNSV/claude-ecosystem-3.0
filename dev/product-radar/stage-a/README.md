# Product Radar — Stage A (radar-as-workflows, dogfood)

> Проверка ценности воронки **до** стройки продукта, на машинерии Claude Code.
> Контракты и rationale — в [../CONCEPT.md](../CONCEPT.md). Гео-фокус — **Россия**
> (EN-источники = сырьё для стратегий S1 гео-лаг / S5 импортозамещение, §3.6 концепта).

## Структура

```
stage-a/
├── README.md                      # этот runbook
├── verticals/ai-tools/pack.yaml   # источники (lanes), стратегии+веса, пороги
├── workflows/radar-scan.js        # workflow-скрипт скана (Collect → Verify → Synthesize)
├── inbox/tier-p/                  # ручные наблюдения владельца (проприетарный вход)
├── digests/                       # выходы: RADAR-<week>.md (создаётся прогоном)
├── theses/                        # выходы: TH-*.md по шаблону CONCEPT.md §5.4
└── patterns/LIBRARY.md            # append-only: мёртвые тезисы + вердикты владельца
```

## Как запустить скан (еженедельный ритуал)

Автоматизация расписанием — **после 2 успешных ручных прогонов** (incremental pilot).
Пока — вручную: открой сессию Claude Code в этом репо и дай промпт (verbatim):

```
Прогони Product Radar Stage A скан за текущую ISO-неделю:
1. Прочитай dev/product-radar/stage-a/verticals/ai-tools/pack.yaml (lanes, strategies,
   thresholds), содержимое dev/product-radar/stage-a/inbox/tier-p/*.md (tierP) и
   выжимку dev/product-radar/stage-a/patterns/LIBRARY.md (priorPatterns).
2. Запусти workflow dev/product-radar/stage-a/workflows/radar-scan.js через
   Workflow(scriptPath, args={vertical, week, thresholds, strategies, lanes, tierP, priorPatterns}).
3. Из результата собери и запиши:
   - dev/product-radar/stage-a/digests/RADAR-<week>.md — по формату дайджеста ниже;
   - dev/product-radar/stage-a/theses/TH-<yyyy>-<nnn>.md — по шаблону CONCEPT.md §5.4
     (только для кандидатов, переживших red_team; нумерация продолжает существующие).
4. Покажи мне дайджест + список кандидатов тезисов; в конец дайджеста включи блок
   вердиктов (см. ниже) и coverage_gaps БЕЗ сокращений.
Ветку/PR — по autoflow.
```

## Формат дайджеста `digests/RADAR-<week>.md`

```markdown
# RADAR ai-tools — <week>
## Пункты (decision-feed)
### <claim>
- realism: confirmed|plausible|speculative · corroboration: N · freshness: <дата>
- sources: <url (T1)>, <url (T2)>, ...
- strategy: S1|S2|...
- **Что это меняет:** <decision_relevance>
- вердикт владельца: [ ] полезно / [ ] шум        ← заполняет владелец
## Кандидаты тезисов
- TH-...: <segment> / <problem> / <strategy> / red_team выжил: <кратко>
## Деградации и пробелы покрытия (полностью, без сокращений)
- ...
```

## Петля обратной связи (обязательная)

1. Владелец проставляет вердикты `полезно/шум` в дайджесте (≤10 мин чтения).
2. Следующий скан начинается с переноса вердиктов и умерших тезисов в
   `patterns/LIBRARY.md` (append-only: дата, что, вердикт/причина смерти, слой).
3. `priorPatterns` следующего прогона включает выжимку LIBRARY — радар не предлагает
   умершее заново и учится на вердиктах.

## Tier-P inbox

Наблюдения владельца (домен, приватные разговоры, «у знакомого боль X») — markdown-файлы
в `inbox/tier-p/`, свободная форма, 1 наблюдение = 1 абзац с датой. Подмешиваются в
Synthesize с высоким приоритетом, но той же дисциплиной улик.

## Гейт A→B (из CONCEPT.md §8/§10 — метрик-контракт заморожен)

| Метрика | Порог | Факт по неделям |
|---|---|---|
| Precision дайджеста (вердикты владельца) | ≥60% | W1: · W2: · W3: · W4: |
| Handoff-ready тезисов за 4 недели | ≥1 | |
| Бюджет чтения weekly | ≤10 мин | |
| False-hype (confirmed, опровергнутые ≤90д) | 0 | |

**GO на Stage B** = 4 недели подряд полезных дайджестов И ≥1 тезис дошёл до handoff
(`/product:init`). **NO-GO** = пересмотр концепта, стройка не начинается.
Оценка гейта — по жанру live-run-validation (пре-регистрированный контракт выше;
executor = скан-сессия, reviewer = владелец).
