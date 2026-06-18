# Audit Re-routes — genuine signals dismissed from a refuted cluster

> **Что это:** anti-silent-drop реестр. Когда patch-кандидат получает gate **[N] (refuted)**, его
> кластер `dismissed` в `audit-journal.ndjson` — но внутри гетерогенного кластера могли быть
> **реальные одиночные находки**, которые синтезатор рекомендовал «re-route to their own item»
> (не путать с already-handled / non-violation). Класть их обратно в `open` нельзя — это вернёт
> весь refuted-кластер на следующем `patch-synth` (см. DEC-DEV-0080 reconcile). Поэтому они
> **dismissed в журнале + записаны здесь** как actionable-хвосты со своим домом.
>
> Создан 2026-06-17 при reconcile цикла session-audit (DEC-DEV-0080). Источник правды по
> per-finding обоснованию — секции **Evidence** в `patch-candidates/<zone>__<check>.md`.

---

## Open re-routed items (не потерять)

| finding_id | sev | кластер-источник | суть | предлагаемый дом / действие |
|---|---|---|---|---|
| `309cc2cf996a` | 🔴 blocking | D2B-behavioral::F | handoff regen не персистился: worktree/main path-split, `rm`+placeholder stub (сессия `abb35d42`) | **own item:** worktree-aware `/product:handoff` + правило «never `rm` before a verified regenerate» в `skills/product/handoff-generator.md` |
| `1fa0041ac562` | info/high | D2B-behavioral::F | handoff произведён ad-hoc `.gen-handoff-fm005.cjs` (run+`rm` ×2); skill загружен, но не эмитит файл напрямую (сессия `0f2827ea`) | **bundle с `309cc2cf`:** handoff-generator должен писать файл напрямую с каноничными хешами (`lib/hash.js`), без ручного скрипта |
| `679597d354f1` | warning | D2B-behavioral::F | BR semantic edit + `git commit` внутри `/product:cleanup` (сессия `98cb1b97`) | **own narrow candidate (F+G):** anti-pattern «out-of-scope: git/semantic edit» в `skills/product/cleanup-detector.md`; companion = check-G находка в `a2aa99d4` |
| `20b71d58353a` | info/high | D2B-behavioral::F | DA-ledger flipped pending→actioned вручную; нет governing skill (сессия `52fff494`) | extend `/product:cleanup --pending-hygiene`: флип статуса ledger + очистка `da-pending.yaml` под одной схемой |
| `8fc985c97d5f` | warning | D2B-behavioral::C | orchestrator сам классифицировал active-BR pivot-правки как cosmetic и **purged** их `da-pending`, минуя subagent-call (DEC-DEV-0012; сессия `ebf3cc2c`) | **watch:** если рецидив ≥3× — own cluster (target: anti-pattern в `feature-session.md` или guard в `br-change-trigger.js`) |
| `1ff552c0c6b4` | 🔴 blocking | D2B-behavioral::C | DA пропущен полностью (da-pending wiped через `br-change-trigger.js:121-123` dedup-replace) | distinct root cause; **watch** на рецидив, отдельный кандидат если ≥3× |
| `5a2a945b7465` · `613ae7128d66` · `f7039575c7e5` | warning | D2B-behavioral::A | **DA-findings memo schema drift** — `follow_up.revisit_trigger`→`gate_discharged`; markdown-bold вместо YAML; nested `review_metadata`+`findings[]` (3 РАЗНЫЕ сигнатуры) | если schema DA-findings-memo дрейфит ≥3× **с одной** сигнатурой — own candidate vs template в `agents/product/devils-advocate.md` / `skills/product/product-da-review.md` |
| `99030316972c` | info | D2B-behavioral::A | BR-027 **тело** всё ещё «LC-Job» после фикса frontmatter→LC-004 (сессия `98cb1b97`) | body↔frontmatter ref-drift; если рецидив — V-11/body-ref-style item, НЕ check-A |
| `13fafe80a7f8` | info | D2B-behavioral::A | `.da-findings` batch filename slug (`-batch-` infix вместо `<ID>-YYYY-MM-DD-HHMM.md`) | если рецидив — однострочная заметка в DA-findings naming rule |

## Pending un-synthesized cluster (НЕ из этого цикла)

- **`D2B04-design::F`** — 4 `open` находки (`62d693cb4e2d`, `66e22d7ef571`, `92c304bbc070`, `c7ac20ed30d1`),
  systemic (≥3), но **не синтезировался** в этом прогоне (нет кандидата). Следующий `patch-synth`
  предложит его как новый кандидат — это корректное pending-состояние, не трогаем.

---

> **Правило поддержки:** когда re-routed item получает свой механизм/DEC-DEV — вычёркивай строку
> (или помечай `→ DEC-DEV-NNNN`). Когда watch-item рецидивит ≥3× — он сам всплывёт свежей `open`-находкой
> и пройдёт обычный synth-цикл; эта таблица лишь не даёт забыть про одиночные genuine-сигналы между прогонами.
