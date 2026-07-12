# WS-2 Волна 1 — Телеметрия (что агент РЕАЛЬНО читал)

Источник: 69 транскриптов, 2026-06-15 … 2026-07-12. Всего tool-вызовов: 7675.

## 1. Распределение инструментов

| tool | вызовов |
|---|--:|
| Bash | 2576 |
| Edit | 1792 |
| Read | 1340 |
| PowerShell | 546 |
| Grep | 350 |
| Write | 314 |
| TaskUpdate | 185 |
| Agent | 159 |
| Glob | 121 |
| TaskCreate | 102 |
| AskUserQuestion | 51 |
| ToolSearch | 40 |
| Workflow | 35 |
| ScheduleWakeup | 15 |
| Skill | 14 |
| WebSearch | 7 |
| EnterWorktree | 5 |
| SendMessage | 4 |

## 2. Топ-30 читаемых файлов

| файл | чтений | сессий | целиком | частично | KB |
|---|--:|--:|--:|--:|--:|
| DEV_JOURNAL.md | 81 | 29 | 0 | 81 | 417.3 |
| C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/MEMORY.md | 56 | 30 | 15 | 41 | - |
| CHANGELOG.md | 52 | 21 | 0 | 52 | 210.0 |
| ROADMAP.md | 45 | 20 | 3 | 42 | 66.2 |
| C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/project_ecosystem_status.md | 29 | 15 | 18 | 11 | - |
| commands/orchestrator/run.md | 21 | 11 | 7 | 14 | 36.0 |
| dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md | 17 | 10 | 7 | 10 | 49.2 |
| orchestrator/processes/feature-to-tdd-impl.mjs | 15 | 9 | 4 | 11 | - |
| orchestrator/processes/validate-feature-impl.mjs | 14 | 5 | 3 | 11 | - |
| package.json | 13 | 9 | 10 | 3 | - |
| docs/orchestrator-module/SPEC.md | 13 | 7 | 2 | 11 | 41.9 |
| CLAUDE.md | 12 | 9 | 1 | 11 | 25.1 |
| orchestrator/processes/audit-spec-fidelity.mjs | 12 | 4 | 1 | 11 | - |
| C:/Users/pw201/AppData/Local/Temp/claude/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/e4ff47d3-7a2d-4db4-ae9d-ee2fbee31019/scratchpad/ouroboros/docs/ARCHITECTURE.md | 12 | 3 | 0 | 12 | - |
| C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/project_orchestrator_completion_plan.md | 11 | 2 | 6 | 5 | - |
| C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/project_orchestrator_next_queue.md | 10 | 7 | 7 | 3 | - |
| orchestrator/README.md | 9 | 6 | 5 | 4 | 16.5 |
| commands/ecosystem/verify.md | 9 | 7 | 2 | 7 | 13.1 |
| dev/ECOSYSTEM_VISION.md | 9 | 6 | 1 | 8 | 78.5 |
| dev/CONSOLIDATED_EXECUTION_PLAN.md | 9 | 1 | 0 | 9 | - |
| tests/orchestrator/validate-feature-impl-wiring.test.cjs | 8 | 5 | 3 | 5 | - |
| dev/ORCHESTRATOR_DOGFOOD_RUN_01.md | 8 | 4 | 1 | 7 | 27.7 |
| docs/pmo/processes.md | 8 | 5 | 2 | 6 | 67.0 |
| dev/meta-improvement/scripts/smoke-hooks.js | 8 | 4 | 1 | 7 | - |
| C:/Users/pw201/WebstormProjects/ce3-wt-od7-fixes/orchestrator/lib/fabric-engine.cjs | 8 | 1 | 0 | 8 | - |
| dev/meta-improvement/checklists/phase-kickoff.md | 7 | 7 | 7 | 0 | 14.4 |
| dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md | 7 | 3 | 3 | 4 | - |
| C:/Users/pw201/.claude/CLAUDE.md | 7 | 6 | 5 | 2 | - |
| docs/product-module/SPEC.md | 7 | 3 | 0 | 7 | 77.8 |
| orchestrator/lib/fabric-engine.cjs | 7 | 2 | 1 | 6 | - |

## 3. Чтение больших файлов ЦЕЛИКОМ (кандидаты в токен-слив)

| файл | KB | раз целиком | ~сожжено KB |
|---|--:|--:|--:|
| ROADMAP.md | 66.2 | 3 | 198.7 |
| docs/pmo/processes.md | 67.0 | 2 | 133.9 |
| dev/ECOSYSTEM_VISION.md | 78.5 | 1 | 78.5 |
| dev/v1_1_backlog.md | 61.0 | 1 | 61.0 |

Суммарно сожжено на полных чтениях файлов >60KB: **472.1 KB**

## 4. Указатели/каноны — используются ли на практике (H6)

| док | чтений | в скольких сессиях (из 69) |
|---|--:|--:|
| docs/MAP.md | 4 | 4 |
| dev/INFORMATION-MAP.yaml | 1 | 1 |
| dev/meta-improvement/rails/RAILS.md | 2 | 1 |
| ROADMAP.md | 45 | 20 |
| DEV_JOURNAL.md | 81 | 29 |
| CHANGELOG.md | 52 | 21 |
| README.md | 5 | 5 |
| CLAUDE.md | 12 | 9 |

## 5. Мёртвый груз репо (H2)

Всего doc-файлов в репо (без .claude/): **378** (6940.6 KB)
Хоть раз открывались: **571**
НИ РАЗУ не открывались: **257** (4217.5 KB, 61% от массы)

20 крупнейших ни разу не прочитанных:

| файл | KB |
|---|--:|
| dev/_archive/journal/DEV_JOURNAL_2026-04..06.md | 906.8 |
| dev/_archive/process-fabric/catalog.yaml | 166.0 |
| dev/_archive/changelog/CHANGELOG_1.0-1.6.md | 107.9 |
| docs/pmo/domain-expertise-registry.md | 42.0 |
| dev/deferred/wiki-design.md | 38.4 |
| dev/_archive/phase-6/PHASE_6_READINESS.md | 36.4 |
| dev/_archive/plans/CONSOLIDATED_EXECUTION_PLAN.md | 35.9 |
| dev/_archive/phase-4/PHASE_4_DECISIONS.md | 35.5 |
| dev/_archive/phase-5/PHASE_5_READINESS.md | 35.1 |
| dev/_archive/process-fabric/audit/APPENDIX-A-process-map.md | 34.9 |
| dev/VIBE_CODING_ANALYSIS.md | 33.8 |
| dev/_archive/roadmap/ROADMAP_phases-0-7.md | 33.4 |
| dev/_archive/process-fabric/audit/APPENDIX-B-gap-analysis.md | 31.5 |
| dev/_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md | 30.6 |
| dev/_archive/phase-4/PHASE_4_READINESS.md | 30.1 |
| dev/_archive/process-fabric/audit/APPENDIX-C-determinism-profile.md | 29.0 |
| dev/_archive/process-fabric/FABRIC_PHASE3_LIVE_RUN_BRIEF.md | 28.6 |
| dev/_archive/patch-1.3.3/PATCH_1.3.3_READINESS.md | 28.1 |
| dev/deferred/CONTEXT_SEAM_PROTOCOL.md | 27.3 |
| skills/design/design-session.md | 24.8 |

## 6. Загрязнение архивом

Обращений к путям с `_archive`/`deferred`: **6** из 1690 path-обращений (0.4%)

## 7. Память — в скольких сессиях слаг вообще всплывал (приблизительно)

| memory | сессий (из 69) |
|---|--:|
| MEMORY | 44 |
| project_ecosystem_status | 38 |
| reference_pmo_canonical_counts | 34 |
| user_role | 33 |
| env_git_network_needs_sandbox_off | 29 |
| feedback_separate_task_from_test | 29 |
| project_session_audit_checkpoint | 29 |
| feedback_orchestrate_not_duplicate | 28 |
| feedback_substrate_premise_verification | 28 |
| feedback_methodology | 27 |
| project_ecosystem_architecture | 27 |
| project_weekly_slice_2026-06-18 | 27 |
| project_orchestrator_live_run_p4p6 | 26 |
| project_orchestrator_s6_rootcause | 26 |
| project_ecosystem_status_archive | 25 |
| project_orchestrator_next_queue | 25 |
| reference_dev_journal | 25 |
| feedback_drift_verify_timeline_first | 24 |
| feedback_intent_triage_protocol | 24 |
| project_feedback_contour_split_0090 | 23 |
| project_ecosystem_vision_proposal | 22 |
| reference_statusline_tool | 22 |
| env_parallel_sessions_share_checkout | 20 |
| project_pilot_spec_traceability | 20 |
| feedback_audit_evidence_layers | 18 |
| feedback_dec_dev_collision_check | 18 |
| feedback_pr_cadence_fold_companions | 17 |
| index_archive_2026-07-04 | 17 |
| project_autonomy_obedience_balance | 16 |
| project_guided_research | 16 |
| feedback_blind_comparison | 15 |
| project_quickwins_parallel_track | 15 |
| project_work_rails_track | 15 |
| project_vibe_coding_adoption | 14 |
| env_vm_claude_factory | 13 |
| feedback_model_delegation_policy | 13 |
| feedback_self_create_pilot_test_env | 13 |
| project_fabric_phase3_live_run | 13 |
| project_orchestrator_completion_plan | 13 |
| project_process_fabric_track | 13 |
| feedback_session_analysis_holistic | 12 |
| feedback_stacked_pr_merge_order | 12 |
| project_product_radar_track | 9 |
| project_factory_conductor_initiative | 8 |
| project_meta_system_track | 8 |
| project_repo_deadweight_sweep | 7 |
| project_campaign_prod_2026-07-11 | 6 |
| feedback_propose_data_access_extensions | 3 |
| feedback_research_minimal_verification | 3 |

## 8. Скиллы и субагенты

Skill: {"deep-research":3,"research-intake":3,"claude-api":2,"vm-factory-ops":1,"update-config":1,"loop":2,"dataviz":1,"schedule":1}
Agent subagent_type: {"Explore":31,"general-purpose":111,"claude-code-guide":12,"?":5}

## 9. Grep — топ-25 паттернов

Всего grep-вызовов: 350, уникальных паттернов: 310

- `Где мы сейчас` — 7
- `SDLC` — 4
- `DEC-DEV-00\d\d` — 3
- `C4.*(Профессиональный|медиаредактор)|медиаредактор` — 3
- `порог|threshold` — 3
- `^#{2,3} ` — 3
- `evolution` — 3
- `OD7` — 3
- `ORCHESTRATOR_BUILD_KICKOFF|ORCHESTRATOR_GATE_RISK_CLASSIFIER|ORCHESTRATOR_N2_RESUME|ORCHES` — 3
- `119` — 2
- `302` — 2
- `^#{1,4}\s.*DEC-DEV-01[89][0-9]` — 2
- `Epic E|EPIC_E|epic-e` — 2
- `OPENAI_API_KEY|sk-proj-|sk-[A-Za-z0-9]{20,}` — 2
- `^#{1,3} ` — 2
- `hookSpecificOutput` — 2
- `agent\(` — 2
- `FB-LR-25` — 2
- `Последнее обновление` — 2
- `scan` — 2
- `install-pre-commit` — 2
- `^<<<<<<<|^=======|^>>>>>>>` — 2
- `advisor-pending` — 2
- `blast` — 2
- `D1\.0` — 2