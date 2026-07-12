# WS-2 Волна 2 — Аудит дрейфа (v2, с исправленным инструментом)

**Методологическая заметка.** Первая версия аудитора дала 30% STALE — и была НЕВЕРНА. Она считала «ложью» (а) коммиты и PR *других* репозиториев (meta-system, product-radar, пилот, VM), (б) ссылки памяти-на-память, резолвя их против репо, (в) DEC-DEV, уехавшие в архив журнала при компактации. Инструмент переписан. Ниже — честные цифры.

Проверено **1092** фактических утверждений против: git (638 коммитов, 11 тегов), GitHub (183 PR), файловой системы, живого + архивного DEV_JOURNAL.

| вердикт | шт | % | смысл |
|---|--:|--:|---|
| TRUE | 894 | 81.9% | сходится с реальностью |
| **STALE** | **117** | **10.7%** | **противоречит реальности этого репо — дрейф** |
| CROSS | 81 | 7.4% | про другой репо/пилот/VM — **отсюда непроверяемо** |

## По слою

| слой | всего | TRUE | STALE | CROSS | дрейф % |
|---|--:|--:|--:|--:|--:|
| L0 (резидент) | 159 | 138 | **4** | 17 | **2.5%** |
| L1 (память, триггерная) | 933 | 756 | **113** | 64 | **12.1%** |

## По типу

| тип | всего | TRUE | STALE | CROSS |
|---|--:|--:|--:|--:|
| commit | 266 | 173 | 46 | 47 |
| PR | 336 | 331 | 5 | 0 |
| version | 10 | 6 | 4 | 0 |
| DEC-DEV | 212 | 212 | 0 | 0 |
| path | 268 | 172 | 62 | 34 |

## Носители с дрейфом

| носитель | утв. | STALE | CROSS |
|---|--:|--:|--:|
| memory/project_ecosystem_status_archive.md | 155 | **32** | 11 |
| memory/project_orchestrator_next_queue.md | 65 | **12** | 3 |
| memory/project_ecosystem_status.md | 123 | **10** | 7 |
| memory/project_orchestrator_completion_plan.md | 59 | **9** | 7 |
| memory/project_ecosystem_architecture.md | 29 | **7** | 3 |
| memory/project_orchestrator_live_run_p4p6.md | 28 | **6** | 1 |
| memory/index_archive_2026-07-04.md | 105 | **5** | 2 |
| CLAUDE.md проекта [РЕЗИДЕНТ] | 41 | **4** | 4 |
| memory/project_ecosystem_vision_proposal.md | 57 | **4** | 1 |
| memory/project_meta_system_track.md | 7 | **3** | 3 |
| memory/project_orchestrator_s6_rootcause.md | 32 | **3** | 3 |
| memory/project_session_audit_checkpoint.md | 15 | **3** | 0 |
| memory/project_fabric_phase3_live_run.md | 22 | **2** | 7 |
| memory/project_feedback_contour_split_0090.md | 12 | **2** | 1 |
| memory/project_weekly_slice_2026-06-18.md | 19 | **2** | 2 |
| memory/env_parallel_sessions_share_checkout.md | 1 | **1** | 0 |
| memory/env_vm_claude_factory.md | 2 | **1** | 1 |
| memory/feedback_blind_comparison.md | 3 | **1** | 0 |
| memory/feedback_session_analysis_holistic.md | 3 | **1** | 0 |
| memory/feedback_stacked_pr_merge_order.md | 3 | **1** | 0 |
| memory/project_autonomy_obedience_balance.md | 2 | **1** | 0 |
| memory/project_campaign_prod_2026-07-11.md | 25 | **1** | 1 |
| memory/project_guided_research.md | 9 | **1** | 0 |
| memory/project_process_fabric_track.md | 37 | **1** | 2 |
| memory/project_repo_deadweight_sweep.md | 14 | **1** | 0 |
| memory/project_work_rails_track.md | 9 | **1** | 0 |
| memory/reference_dev_journal.md | 1 | **1** | 0 |
| memory/reference_pmo_canonical_counts.md | 5 | **1** | 0 |

## ВСЕ STALE (пофактно)

- **[path]** `patterns/spec-drift-sweep.md` — файла НЕТ в репо (битая ссылка)  *(в CLAUDE.md проекта [РЕЗИДЕНТ])*
- **[path]** `rails/RAILS.md` — файла НЕТ в репо (битая ссылка)  *(в CLAUDE.md проекта [РЕЗИДЕНТ])*
- **[path]** `skills/memory-sync.md` — файла НЕТ в репо (битая ссылка)  *(в CLAUDE.md проекта [РЕЗИДЕНТ])*
- **[path]** `scripts/verify-update.sh` — файла НЕТ в репо (битая ссылка)  *(в CLAUDE.md проекта [РЕЗИДЕНТ])*
- **[commit]** `4caa1b0` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/env_parallel_sessions_share_checkout.md)*
- **[path]** `dev/plans/UBUNTU_PILOT_DEPLOYMENT_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/env_vm_claude_factory.md)*
- **[path]** `dev/ORCHESTRATOR_P2_PROFILING_STUDY.md` — файла НЕТ в репо (битая ссылка)  *(в memory/feedback_blind_comparison.md)*
- **[commit]** `a2aaf44a` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/feedback_session_analysis_holistic.md)*
- **[PR]** `#100` — заявлен merged, фактически CLOSED  *(в memory/feedback_stacked_pr_merge_order.md)*
- **[commit]** `1ff7e2d8` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/index_archive_2026-07-04.md)*
- **[commit]** `336a2973` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/index_archive_2026-07-04.md)*
- **[commit]** `b6c18e4` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/index_archive_2026-07-04.md)*
- **[path]** `dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md` — файла НЕТ в репо (битая ссылка)  *(в memory/index_archive_2026-07-04.md)*
- **[path]** `dev/ECOSYSTEM_VISION_BATCH_2.md` — файла НЕТ в репо (битая ссылка)  *(в memory/index_archive_2026-07-04.md)*
- **[commit]** `a2aaf44a` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_autonomy_obedience_balance.md)*
- **[PR]** `#171` — заявлен merged, фактически CLOSED  *(в memory/project_campaign_prod_2026-07-11.md)*
- **[path]** `.product/.decisions/journal.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `.product/.pending/da-pending.yaml` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `_archive/journal-YYYY-MM.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `dev/wiki-design.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `dev/PHASE_D_DOCS_WIKI_READINESS.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `dev/wiki-charter.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[path]** `hooks/ecosystem/protect-wiki-charter.js` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_architecture.md)*
- **[commit]** `a3eabb0` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status.md)*
- **[commit]** `510ce24` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status.md)*
- **[commit]** `d0299f9` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status.md)*
- **[commit]** `3d14586` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status.md)*
- **[commit]** `cda97111` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status.md)*
- **[PR]** `#100` — заявлен merged, фактически CLOSED  *(в memory/project_ecosystem_status.md)*
- **[path]** `dev/ORCHESTRATOR_P2_KICKOFF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status.md)*
- **[path]** `dev/CONSOLIDATED_EXECUTION_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status.md)*
- **[path]** `lib/autonomy-policy.cjs` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status.md)*
- **[path]** `dev/ECOSYSTEM_VISION_BATCH_3.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status.md)*
- **[commit]** `d48c113` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `6dc62bc8` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `019bf5e` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `c561dc1` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `edf7057` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `306c196c` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `74d1d4b8` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[commit]** `a3dd65f9` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_ecosystem_status_archive.md)*
- **[version]** `1.3.2` — тега v1.3.2 нет в этом репо  *(в memory/project_ecosystem_status_archive.md)*
- **[version]** `1.3.4` — тега v1.3.4 нет в этом репо  *(в memory/project_ecosystem_status_archive.md)*
- **[version]** `1.3.5` — тега v1.3.5 нет в этом репо  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/meta-improvement/DESIGN_KICKOFF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/SESSION_AUDIT_V2_DESIGN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/ORCHESTRATOR_DOGFOOD_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `prompts/session-audit.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `scripts/audit-watch.js` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `checklists/audit-watch.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `scripts/audit-journal.js` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `scripts/patch-synth.js` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `prompts/patch-synth.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PHASE_6_SMOKE_TEST_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/TIER_2_DOC_REFORM_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PHASE_5_READINESS.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/wiki-design.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PHASE_D_IMPLEMENTATION_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PHASE_D_DOCS_WIKI_READINESS.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/PHASE_6_READINESS.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `dev/wiki-charter.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `hooks/ecosystem/protect-wiki-charter.js` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[path]** `hooks/ecosystem/git-precommit-charter.sh` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_status_archive.md)*
- **[PR]** `#100` — заявлен merged, фактически CLOSED  *(в memory/project_ecosystem_vision_proposal.md)*
- **[path]** `lib/autonomy-policy.cjs` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_vision_proposal.md)*
- **[path]** `dev/ECOSYSTEM_VISION_BATCH_1.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_vision_proposal.md)*
- **[path]** `dev/ECOSYSTEM_VISION_BATCH_2.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_ecosystem_vision_proposal.md)*
- **[commit]** `a0e4e27` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_fabric_phase3_live_run.md)*
- **[path]** `AppData/Local/pending-actions.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_fabric_phase3_live_run.md)*
- **[commit]** `4d1fc5b` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_feedback_contour_split_0090.md)*
- **[path]** `.product/.upstream/feedback-outbox.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_feedback_contour_split_0090.md)*
- **[path]** `dev/RESEARCH_CAPABILITY_WAVE0.5_BAKEOFF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_guided_research.md)*
- **[commit]** `c8e4009` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_meta_system_track.md)*
- **[commit]** `608ad54` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_meta_system_track.md)*
- **[version]** `0.8.1` — тега v0.8.1 нет в этом репо  *(в memory/project_meta_system_track.md)*
- **[commit]** `4af995d1` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_completion_plan.md)*
- **[commit]** `37a34323` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_completion_plan.md)*
- **[commit]** `6f53ec2` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_completion_plan.md)*
- **[commit]** `d86bab7` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_completion_plan.md)*
- **[path]** `processes/runtime-smoke-readiness.mjs` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_completion_plan.md)*
- **[path]** `dev/ORCHESTRATOR_P2_KICKOFF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_completion_plan.md)*
- **[path]** `dev/ORCHESTRATOR_P2_PROFILING_STUDY.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_completion_plan.md)*
- **[path]** `dev/ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_completion_plan.md)*
- **[path]** `dev/ORCHESTRATOR_S7_BRIEF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_completion_plan.md)*
- **[commit]** `14b2e918` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[commit]** `6c9e49d6` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[commit]** `ccc40e1d` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[commit]** `395404ba` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[commit]** `1ff7e2d8` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[path]** `dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_live_run_p4p6.md)*
- **[commit]** `bcf29996` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `d898ab5` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `ec875aa` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `336a2973` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `1ff7e2d8` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `5a7412d` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `6ada7ef9` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_next_queue.md)*
- **[PR]** `#60` — заявлен merged, фактически CLOSED  *(в memory/project_orchestrator_next_queue.md)*
- **[path]** `dev/ORCHESTRATOR_N2_RESUME.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_next_queue.md)*
- **[path]** `dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_next_queue.md)*
- **[path]** `dev/ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_next_queue.md)*
- **[path]** `dev/UNIFIED_PILOT_VALIDATION_PLAN.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_next_queue.md)*
- **[commit]** `c87ad02` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_s6_rootcause.md)*
- **[commit]** `d48c113` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_orchestrator_s6_rootcause.md)*
- **[path]** `dev/ORCHESTRATOR_S7_BRIEF.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_orchestrator_s6_rootcause.md)*
- **[path]** `audit/GAPS-RECONCILIATION-2026-07-10.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_process_fabric_track.md)*
- **[path]** `_archive/audit-index-2026.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_repo_deadweight_sweep.md)*
- **[commit]** `309cc2cf` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_session_audit_checkpoint.md)*
- **[commit]** `1ff552c0` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_session_audit_checkpoint.md)*
- **[path]** `dev/SESSION_AUDIT_RESUME.md` — файла НЕТ в репо (битая ссылка)  *(в memory/project_session_audit_checkpoint.md)*
- **[commit]** `bee01557` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_weekly_slice_2026-06-18.md)*
- **[commit]** `7d3c3dd` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/project_weekly_slice_2026-06-18.md)*
- **[path]** `rails/rail-areas.json` — файла НЕТ в репо (битая ссылка)  *(в memory/project_work_rails_track.md)*
- **[path]** `.product/.decisions/journal.md` — файла НЕТ в репо (битая ссылка)  *(в memory/reference_dev_journal.md)*
- **[commit]** `d48c113` — нет ни в одной ветке этого репо, и контекст не указывает на другой репо  *(в memory/reference_pmo_canonical_counts.md)*

## CROSS — непроверяемое отсюда (класс риска: влияет на поведение, но фальсифицировать нельзя)

- MEMORY.md (индекс) [РЕЗИДЕНТ] — 13 непроверяемых утверждений
- memory/project_ecosystem_status_archive.md — 11 непроверяемых утверждений
- memory/project_ecosystem_status.md — 7 непроверяемых утверждений
- memory/project_fabric_phase3_live_run.md — 7 непроверяемых утверждений
- memory/project_orchestrator_completion_plan.md — 7 непроверяемых утверждений
- CLAUDE.md проекта [РЕЗИДЕНТ] — 4 непроверяемых утверждений
- memory/project_ecosystem_architecture.md — 3 непроверяемых утверждений
- memory/project_meta_system_track.md — 3 непроверяемых утверждений
- memory/project_orchestrator_next_queue.md — 3 непроверяемых утверждений
- memory/project_orchestrator_s6_rootcause.md — 3 непроверяемых утверждений
- memory/feedback_drift_verify_timeline_first.md — 2 непроверяемых утверждений
- memory/index_archive_2026-07-04.md — 2 непроверяемых утверждений