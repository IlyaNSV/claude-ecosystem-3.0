# Метрики ядра (машинный счёт)

## M3 — токен-томография (кто жжёт токены)

| эпоха | слой | сессий | tok_out основной | tok_out субагентов | tok_out ВСЕГО | ctx_processed | tool-calls |
|---|---|---|---|---|---|---|---|
| pre-conductor | host | 55 | 29 816 437 | 12 261 631 | 42 078 068 | 4 072 431 931 | 20 633 |
| pre-conductor | executor | 86 | 5 983 024 | 2 215 830 | 8 198 854 | 515 047 085 | 5 670 |
| RUN-A | host | 7 | 3 676 197 | 7 838 601 | 11 514 798 | 522 594 697 | 8 212 |
| RUN-A | executor | 18 | 2 329 890 | 4 776 310 | 7 106 200 | 365 409 060 | 8 942 |
| RUN-B | host | 6 | 3 113 971 | 665 954 | 3 779 925 | 654 693 231 | 1 986 |
| RUN-B | executor | 18 | 5 935 111 | 2 163 367 | 8 098 478 | 972 214 615 | 6 087 |

**RUN-A: оверхед пульта** = tok(host) / tok(executor) = 11 514 798 / 7 106 200 = **1.62** (порог PREREG: ≤0.20 спокойно, >0.40 тревога)
**RUN-B: оверхед пульта** = tok(host) / tok(executor) = 3 779 925 / 8 098 478 = **0.47** (порог PREREG: ≤0.20 спокойно, >0.40 тревога)

## M12 — loop-ratio и повторные действия

| эпоха | слой | tool-calls | повторов | loop-ratio | медиана по сессиям |
|---|---|---|---|---|---|
| pre-conductor | host | 7 102 | 199 | **0.028** | 0.000 |
| pre-conductor | executor | 1 882 | 13 | **0.007** | 0.000 |
| RUN-A | host | 786 | 9 | **0.011** | 0.000 |
| RUN-A | executor | 1 071 | 7 | **0.007** | 0.000 |
| RUN-B | host | 873 | 41 | **0.047** | 0.019 |
| RUN-B | executor | 1 889 | 10 | **0.005** | 0.000 |

Топ-8 повторяемых действий в прогонах (инструмент | цель → сколько повторов):
- Bash |  → 50
- Workflow |  → 4
- TaskOutput |  → 2
- Write | C:\Users\pw201\AppData\Local\Temp\claude\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\1d1e99a9-8e12-49c2-a3c0-32a30c1ade4a\scratchpad\poll-s34.sh → 2
- Edit | C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\memory\project_uja_acceptance_findings.md → 2
- Write | /home/cc-dev/projects/my-first-test/apps/web/app/(app)/dashboard.css → 1
- Read | /home/cc-dev/projects/my-first-test/.kiro/specs/glossary/design.md → 1
- Write | C:\Users\pw201\AppData\Local\Temp\claude\C--Users-pw201-WebstormProjects-claude-ecosystem-3-0\a17033b3-42f9-416b-ac84-ea1fd471fd4f\scratchpad\api_err_scan.py → 1

## Throughput процессов экосистемы (машинный run-ledger, 91 запись)

| эпоха | процесс | прогонов | суммарно, мин | медиана, мин | вердикты |
|---|---|---|---|---|---|
| pre-conductor | deploy-to-stage | 14 | 218 | 15.6 | BLOCKED×7, DEPLOY_FAILED×5, DEPLOYED×2 |
| pre-conductor | feature-to-tdd-impl | 5 | 423 | 17.0 | —×5 |
| pre-conductor | runtime-smoke-readiness | 5 | 15 | 2.7 | NOT_STARTABLE×1, READY_TO_SMOKE×4 |
| pre-conductor | validate-feature-impl | 4 | 52 | 14.9 | NO-GO×1, MANUAL_VERIFY_REQUIRED×2, GO×1 |
| pre-conductor | batch-features-to-cc-sdd | 2 | 30 | 15.2 | —×2 |
| pre-conductor | audit-spec-fidelity | 2 | 14 | 6.8 | —×2 |
| pre-conductor | rollback-release | 2 | 6 | 2.9 | NO_PRIOR_RELEASE×1, ROLLED_BACK×1 |
| RUN-A | validate-feature-impl | 17 | 650 | 32.0 | NO-GO×6, GO×3, MANUAL_VERIFY_REQUIRED×8 |
| RUN-A | deploy-to-stage | 2 | 46 | 23.1 | DEPLOY_FAILED×1, DEPLOYED×1 |
| RUN-A | runtime-smoke-readiness | 2 | 5 | 2.3 | READY_TO_SMOKE×2 |
| RUN-A | batch-features-to-cc-sdd | 1 | 30 | 29.7 | —×1 |
| RUN-A | feature-to-tdd-impl | 1 | 444 | 443.8 | MANUAL_VERIFY_REQUIRED×1 |
| RUN-B | deploy-to-stage | 14 | 388 | 27.7 | DEPLOYED×11, DEPLOY_FAILED×3 |
| RUN-B | validate-feature-impl | 7 | 278 | 44.1 | GO×3, MANUAL_VERIFY_REQUIRED×4 |
| RUN-B | runtime-smoke-readiness | 7 | 24 | 3.0 | READY_TO_SMOKE×7 |
| RUN-B | user-journey-acceptance | 5 | 107 | 6.2 | FAIL×2, ENV_NOT_READY×1, PASS×2 |
| RUN-B | audit-spec-fidelity | 1 | 21 | 20.7 | (объект)×1 |

## Релизы (24 всего)

2026-07-14: 3 · 2026-07-15: 1 · 2026-07-19: 2 · 2026-07-22: 9 · 2026-07-23: 9

## M14 — time-to-feedback (коммит → первый машинный сигнал)

| эпоха | коммитов | медиана до сигнала, мин | p25 | p75 | без сигнала в 24 ч |
|---|---|---|---|---|---|
| pre-conductor | 383 | **11.9** | 6.3 | 35.2 | 333 |
| RUN-A | 116 | **197.8** | 27.7 | 703.1 | 4 |
| RUN-B | 100 | **25.0** | 5.0 | 82.9 | 1 |

## M3 — разрез строк по назначению (коммиты пилота, без merge)

| эпоха | коммитов | runtime | test | .product | .kiro spec | .claude install | прочее | markdown:code |
|---|---|---|---|---|---|---|---|---|
| pre-conductor | 383 | 41 446 | 53 096 | 72 562 | 9 032 | 117 925 | 21 476 | **3.38:1** |
| RUN-A | 116 | 11 586 | 10 935 | 722 | 1 680 | 4 280 | 1 542 | **0.21:1** |
| RUN-B | 100 | 7 371 | 4 960 | 995 | 156 | 4 818 | 109 | **0.16:1** |

_«markdown:code» = (.product + .kiro + docs) / runtime. Порог PREREG: ≤1.5:1 спокойно, >3:1 тревога. Класс `.claude install` — вендорённая поставка экосистемы, в отношение НЕ входит._

## Внимание владельца

Заявлено в ledger (поле attention): RUN-A 716 мин · RUN-B 1010 мин — `[UNVERIFIED-CLAIM]`, самооценка автора записей.
RUN-A: **38** содержательных сообщений владельца (DIRECTIVE=9, OTHER=11, QUESTION=16, DECISION=1, FINDING=1), медиана длины 63.5 симв.
RUN-B: **78** содержательных сообщений владельца (DIRECTIVE=18, QUESTION=16, OTHER=22, DECISION=5, FINDING=15, GO=2), медиана длины 75.5 симв.

