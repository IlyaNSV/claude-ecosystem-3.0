# SANITY — санитария корпуса (Фаза 0, план §3.6)

Сгенерировано: `scripts/sanity-report.cjs` из `sessions.csv` + `host_roles.csv`. Дата снимка корпуса: 2026-07-29.

## 1. Полнота executor-корпуса

- Заявлено в ledger: **35** executor-сессий (cond-s1…s35).
- Транскриптов в harvest, размеченных меткой: **34** (включая `cond-s35-partial` и `extra-*`).
- **Не найдено:** cond-s2, cond-s12.

## 2. Executor-сессии в окнах прогонов без cond-метки

| session_id | эпоха | начало | конец | tok_out | tools | ветка |
|---|---|---|---|---|---|---|
| `ba27649e` | RUN-A | 2026-07-17T01:17 | 2026-07-17T01:24 | 57 827 | 25 | main |
| `c46bb722` | RUN-A | 2026-07-17T02:07 | 2026-07-17T03:48 | 26 284 | 19 | main |

## 3. Вес субагентов (санитарная находка S-1)

| срез | сессий | tok_out основной | tok_out субагентов | доля субагентов |
|---|---|---|---|---|
| pre-conductor / executor | 86 | 5 983 024 | 2 215 830 | 27.0% |
| pre-conductor / host | 55 | 29 816 437 | 12 261 631 | 29.1% |
| RUN-A / executor | 18 | 2 329 890 | 4 776 310 | 67.2% |
| RUN-A / host | 7 | 3 676 197 | 7 838 601 | 68.1% |
| RUN-B / executor | 18 | 5 935 111 | 2 163 367 | 26.7% |
| RUN-B / host | 6 | 3 113 971 | 665 954 | 17.6% |
| post-run / host | 11 | 4 155 822 | 687 286 | 14.2% |

> Harvest-копии на хосте субагентских транскриптов **не содержат** — токен-учёт по ним занижен на указанную долю. Все токен-метрики считаются по VM-CORPUS.

## 4. Хост-сессии: классификация по содержанию (не по mtime)

Всего хост-файлов: **81**; `conductor-run`: **8**; `conductor-adjacent`: **12**; `ecosystem-dev`: **61**.

| session | роль | окно (по timestamps) | промптов владельца | cond-маркеров |
|---|---|---|---|---|
| `36571cb4` | conductor-adjacent | 2026-06-28T20:30 → 2026-06-30T03:24 | 33 | 0 |
| `a46b52c5` | conductor-adjacent | 2026-07-06T22:45 → 2026-07-10T11:39 | 69 | 0 |
| `d2168504` | conductor-adjacent | 2026-07-07T18:48 → 2026-07-09T22:12 | 38 | 0 |
| `f42dd043` | conductor-adjacent | 2026-07-10T16:24 → 2026-07-11T12:37 | 59 | 0 |
| `f21f3e78` | conductor-adjacent | 2026-07-15T12:05 → 2026-07-15T15:36 | 13 | 0 |
| `f23719c7` | conductor-run | 2026-07-16T23:24 → 2026-07-19T16:41 | 84 | 427 |
| `aa124204` | conductor-adjacent | 2026-07-18T20:53 → 2026-07-18T23:58 | 5 | 1 |
| `c6113410` | conductor-run | 2026-07-19T16:32 → 2026-07-20T09:24 | 46 | 255 |
| `2e40ba63` | conductor-run | 2026-07-21T22:28 → 2026-07-23T12:10 | 44 | 276 |
| `5a97a31d` | conductor-run | 2026-07-21T22:28 → 2026-07-23T18:24 | 51 | 274 |
| `03189673` | conductor-adjacent | 2026-07-21T23:35 → 2026-07-22T00:52 | 10 | 1 |
| `1d1e99a9` | conductor-run | 2026-07-23T12:32 → 2026-07-23T20:40 | 56 | 292 |
| `f108183d` | conductor-adjacent | 2026-07-23T15:11 → 2026-07-23T20:11 | 13 | 3 |
| `4e698f95` | conductor-run | 2026-07-24T13:20 → 2026-07-28T13:01 | 7 | 9 |
| `85c91100` | conductor-adjacent | 2026-07-28T11:21 → 2026-07-28T23:48 | 20 | 4 |
| `77559986` | conductor-run | 2026-07-28T12:53 → 2026-07-28T20:31 | 17 | 23 |
| `08ba3a82` | conductor-adjacent | 2026-07-28T17:46 → 2026-07-28T23:44 | 34 | 4 |
| `9fd6f4f6` | conductor-adjacent | 2026-07-28T23:20 → 2026-07-29T00:04 | 6 | 6 |
| `02488fa4` | conductor-adjacent | 2026-07-29T01:00 → 2026-07-29T01:28 | 8 | 7 |
| `285615f3` | conductor-run | 2026-07-29T01:25 → 2026-07-29T01:54 | 2 | 16 |

**Аномалия A-1 (машинное подтверждение коллизии RUN-B.44):** сессии `2e40ba63` и `5a97a31d` стартовали в одну минуту `2026-07-21T22:28` и обе несут ~275 cond-маркеров — две хост-сессии вели прогон параллельно, как и зафиксировано в ledger. Ledger-версия события подтверждается независимо.

**Аномалия A-2:** окно поиска хост-сессий из плана (mtime 07-17..25) неверно по построению — файлы живут неделями из-за `--resume`; `f23719c7` начата 07-16T23:24 и закрыта 07-19, `2e40ba63`/`5a97a31d` покрывают 07-21…07-23. Классификация выполнена по timestamps и содержанию.

## 5. Аномалии отдельных сессий

Найдено записей: 46

| объект | аномалия |
|---|---|
| `~\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\bd6bd166-2802-4255-9fc8-87a25415d584.jsonl` | нет timestamp-записей (пустой/служебный файл) |
| `~\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\c739e1ed-c966-4b5a-af42-c88480e6a6e2.orphaned-1783739539374-aa5d158a.jsonl` | нет timestamp-записей (пустой/служебный файл) |
| `36571cb4` | максимальный разрыв 538.9 мин (pre-conductor/host) |
| `~\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\215ecbd3-9deb-4218-bc2a-b1faa4b6bbff.jsonl` | нет assistant-сообщений |
| `138db56a` | максимальный разрыв 362.1 мин (pre-conductor/host) |
| `065fe176` | максимальный разрыв 163.5 мин (pre-conductor/host) |
| `dc55da48` | максимальный разрыв 462.7 мин (pre-conductor/host) |
| `bbf2c10a` | максимальный разрыв 164.6 мин (pre-conductor/host) |
| `330610b6` | максимальный разрыв 3012.2 мин (pre-conductor/host) |
| `8bebcd01` | максимальный разрыв 3011.5 мин (pre-conductor/host) |
| `a46b52c5` | максимальный разрыв 1565.5 мин (pre-conductor/host) |
| `d2168504` | максимальный разрыв 2045.9 мин (pre-conductor/host) |
| `00f40362` | максимальный разрыв 198.7 мин (pre-conductor/executor) |
| `f42dd043` | максимальный разрыв 244.3 мин (pre-conductor/host) |
| `988cef5e` | максимальный разрыв 127 мин (pre-conductor/host) |
| `411ea0f4` | максимальный разрыв 470.1 мин (pre-conductor/host) |
| `8f4ae018` | максимальный разрыв 353.2 мин (pre-conductor/host) |
| `46a6f513` | максимальный разрыв 222.5 мин (pre-conductor/host) |
| `dec63bf5` | максимальный разрыв 462.3 мин (pre-conductor/host) |
| `e59c7463` | максимальный разрыв 468.9 мин (pre-conductor/host) |
| `c72365f7` | максимальный разрыв 188.9 мин (pre-conductor/host) |
| `275a1f52` | максимальный разрыв 542.6 мин (pre-conductor/host) |
| `d3741cbb` | максимальный разрыв 400.4 мин (pre-conductor/host) |
| `~\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\7c494eb0-a201-4eff-b9ad-cbd1e89a51be.jsonl` | нет assistant-сообщений |
| `9a5fc7c6` | максимальный разрыв 578.3 мин (pre-conductor/host) |
| `43982c0f` | максимальный разрыв 166.1 мин (pre-conductor/host) |
| `51d7fdc5` | максимальный разрыв 508.6 мин (pre-conductor/host) |
| `f21f3e78` | максимальный разрыв 86.2 мин (pre-conductor/host) |
| `~\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\8df9460a-ff51-4a31-8cb4-36b2664fa10c.jsonl` | нет assistant-сообщений |
| `f23719c7` | максимальный разрыв 642.9 мин (pre-conductor/host) |
| `c46bb722` | максимальный разрыв 88.7 мин (RUN-A/executor) |
| `cc6705e1` | максимальный разрыв 881.9 мин (RUN-A/host) |
| `dc5b4fc8` | максимальный разрыв 1542.7 мин (RUN-A/host) |
| `0c4c37c3` | максимальный разрыв 415 мин (RUN-A/executor, cond-s11) |
| `aa124204` | максимальный разрыв 96.1 мин (RUN-A/host) |
| `b6c658ff` | максимальный разрыв 4540.3 мин (RUN-A/host) |
| `3199d4d7` | максимальный разрыв 62.8 мин (RUN-A/executor, cond-s13) |
| `c6113410` | максимальный разрыв 532.4 мин (RUN-A/host) |
| `4072bd48` | максимальный разрыв 74 мин (RUN-A/executor, cond-s14) |
| `2e40ba63` | максимальный разрыв 390.9 мин (RUN-B/host) |

## 6. API-инциденты (машинный след)

Сессий с записями `isApiErrorMessage`: **24**; всего таких записей: **53**.

| сессия | слой/эпоха | метка | api-error записей | разрывов >5 мин | макс. разрыв, мин |
|---|---|---|---|---|---|
| `bbf2c10a` | host/pre-conductor | — | 7 | 9 | 164.6 |
| `f23719c7` | host/pre-conductor | — | 6 | 56 | 642.9 |
| `85c91100` | host/post-run | — | 6 | 8 | 259.5 |
| `065fe176` | host/pre-conductor | — | 4 | 7 | 163.5 |
| `a46b52c5` | host/pre-conductor | — | 3 | 43 | 1565.5 |
| `138db56a` | host/pre-conductor | — | 2 | 24 | 362.1 |
| `330610b6` | host/pre-conductor | — | 2 | 28 | 3012.2 |
| `0ea881af` | host/pre-conductor | — | 2 | 4 | 13.8 |
| `b6c658ff` | host/RUN-A | — | 2 | 19 | 4540.3 |
| `5a97a31d` | host/RUN-B | — | 2 | 37 | 390.9 |
| `1d1e99a9` | host/RUN-B | — | 2 | 35 | 20.6 |
| `838e8a5e` | executor/RUN-B | cond-s34 | 2 | 3 | 34.6 |
| `77559986` | host/post-run | — | 2 | 13 | 198.5 |
| `36571cb4` | host/pre-conductor | — | 1 | 23 | 538.9 |
| `3e01f5c4` | host/pre-conductor | — | 1 | 0 | 0.7 |
| `17c52a56` | host/pre-conductor | — | 1 | 8 | 32.6 |
| `ebc5e403` | host/pre-conductor | — | 1 | 2 | 13.8 |
| `33b46082` | host/pre-conductor | — | 1 | 4 | 21.8 |
| `7468fe8d` | executor/pre-conductor | — | 1 | 1 | 5.3 |
| `cc6705e1` | host/RUN-A | — | 1 | 33 | 881.9 |
| `3199d4d7` | executor/RUN-A | cond-s13 | 1 | 7 | 62.8 |
| `f108183d` | host/RUN-B | — | 1 | 8 | 77.3 |
| `08ba3a82` | host/post-run | — | 1 | 9 | 34.7 |
| `2d22e0e6` | host/post-run | — | 1 | 2 | 18.1 |

> Осторожно: `isApiErrorMessage` ловит только *видимые* ошибки. Известный случай s31 (31-минутный молчаливый ретрай) в этом столбце не виден — он ловится столбцом «макс. разрыв».

