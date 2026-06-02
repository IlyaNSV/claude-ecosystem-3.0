# Patch Candidates — Session Audit v2 (Increment 3c)

> Output of the **patch synthesizer** ([`../scripts/patch-synth.js`](../scripts/patch-synth.js)).
> Each `<zone>__<check>.md` = ONE systemic finding cluster (≥3 instances) that was run through
> **adversarial verification** and either survived (→ patch proposal) or was refuted.
> **Surface only — никогда не применяется автоматически** (CONVENTIONS §8). Дизайн: [`../../SESSION_AUDIT_V2_DESIGN.md`](../../SESSION_AUDIT_V2_DESIGN.md) §6.2 · DEC-DEV-0059.

## Поток

```
audit-journal.ndjson → patch-synth.js (кластеры по zone+check, ≥3 = systemic)
  → claude -p: Stage 1 ADVERSARIAL-VERIFY (≥3 скептик-линзы, default-refute)  ← DEC-DEV-0057 Lesson #1
       survived (majority) → Stage 2 draft patch candidate
       refuted → candidate с verdict: refuted, без патча
  → patch-candidates/<zone>__<check>.md  (frontmatter: verdict, patch_type, gate: pending)
  → ЧЕЛОВЕК: [Y/N/E/D] gate
```

## Human gate — [Y / N / E / D]

Просмотри каждый кандидат (особенно секцию **Verdict** — действительно ли скептик-проверка убедительна) и проставь `gate:` во frontmatter:

| Решение | `gate:` | Действие |
|---|---|---|
| **[Y] accept** | `accepted` | Черновик DEC-DEV + (опц.) ветка/PR с патчем; журнал status → `patched`, проставить `dec_dev_ref`. |
| **[N] reject** | `rejected` | Журнал status → `dismissed` + причина (suppress-окно). |
| **[E] edit** | `edited` | Поправить scope/type кандидата, затем accept. |
| **[D] defer** | `deferred` | Вернуться на следующем прогоне. |

Применяет изменения **человек/ассистент вручную** — синтезатор только предлагает. `codify-pattern` вливается в [`../patterns/`](../patterns/) (provisional→validated).

## Запуск

```
node dev/meta-improvement/scripts/patch-synth.js --dry-run                 # кластеры + рендер промпта, без LLM
node dev/meta-improvement/scripts/patch-synth.js --cluster=D2B-behavioral:C  # один кластер
node dev/meta-improvement/scripts/patch-synth.js                            # все systemic open кластеры
```

Файлы кандидатов трекаются в git как артефакты ревью. `verdict: refuted` кандидаты тоже сохраняются — это запись о том, что проверено и отклонено (анти-фантом-память).
