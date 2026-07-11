---
doc_type: reference
---
<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source of truth: frontmatter of commands/**/*.md.
     Regenerate: node dev/meta-improvement/scripts/gen-command-catalog.cjs -->

# Каталог команд

> **Сгенерирован** из frontmatter `commands/**/*.md` — не править руками, перегенерировать: `node dev/meta-improvement/scripts/gen-command-catalog.cjs`. Интерактивная версия — [ecosystem-map.html](ecosystem-map.html). Канонический статус — [ROADMAP](../../ROADMAP.md#где-мы-сейчас).

**Всего: 50 команд** в 5 модулях.

## /ecosystem:* (7)

Установка и обслуживание самой экосистемы

| Команда | Что делает | Аргументы |
|---|---|---|
| `/ecosystem:bootstrap` | Install Ecosystem 3.0 into the current project. Clones ecosystem to .claude/, initializes .product/, generates CLAUDE.md, configures env + settings, sets up MCP stack. | `[--offline] [--no-mcp] [--force]` |
| `/ecosystem:enable-d7-audit` | One-time opt-in setup — register the D7 session-audit SessionEnd hook in this project's .claude/settings.local.json (uses absolute path to the ecosystem repo). | `--ecosystem-root=<absolute-path>` |
| `/ecosystem:meta-feedback` | Capture SYSTEMIC feedback about the ecosystem itself (defective rules/processes) into a committable upstream outbox for delivery to the ecosystem repo. Hybrid delivery — local pickup (co-located) or git/issue (remote). C3 upstream contour. | `[--review] [--push] [--issue] [--from <validation-tune\|feedback-journal\|manual>]` |
| `/ecosystem:pending-actions` | List pending user-action entries (PA-NNN) from .claude/pending-actions.md. Read-only with --status and --source filters. | `[--status <pending\|done\|dismissed\|all>] [--source <module>] [--limit <N>]` |
| `/ecosystem:research` | Guided Research — co-form a precise brief + usefulness-metrics contract, run a skeptical research loop over the existing stack, filter hype, and synthesize a cited answer scored against the contract. Read-only. | `<what you want to find out>` |
| `/ecosystem:update` | Sync Ecosystem 3.0 to latest upstream version в existing project. Overwrites ecosystem zone (commands/skills/agents/hooks/orchestrator/product/docs/templates), preserves user zone (settings.local.json, product.yaml, .env, .product/, Orchestrator project-state). Two-level wipe protection — filesystem backup (level-1) + git safety commit of the integrator-managed tool footprint (level-2). For greenfield install — use /ecosystem:bootstrap instead. | `[--offline] [--dry-run] [--force] [--no-backup] [--no-safety-commit]` |
| `/ecosystem:verify` | Verify Ecosystem 3.0 installation in current project. Non-destructive health check. | — |

## /product:* (23)

Ядро ежедневной работы — D1 Discovery + D2-Behavioral

| Команда | Что делает | Аргументы |
|---|---|---|
| `/product:batch-enrich` | Batch-enrich a SET of FMs (a release's worth) — drive each through enrichment (F.2→F.7 of P2.A) + the bounded completeness-loop, with the human approve-gate moved from per-item to PHASE BOUNDARIES realized as L1 PA-escalations (the owner ratifies from the ledger). THIN ORCHESTRATION over the existing /product:feature + /product:complete machinery — no F.2-F.10 authoring is re-implemented. CHECKPOINT-FIRST + resume (a mid-run session limit resumes cleanly). PREPARE-ONLY — the runner never transitions FM status; F.10/handoff stays the owner's. Epic C-i macro step (DEC-DEV-0145 decisions г/д). | `<FM-NNN> [<FM-NNN> ...] \| --all-planned` |
| `/product:bg-rename` | Mass-rename BG term across all artifacts. v1 manual preview workflow (sed-suggest + IDE find-replace). Atomic apply deferred к v1.1 per DEC-DEV-0012 D.2. | `<old> <new> \| --commit <old> <new>` |
| `/product:bg-review` | Batch review of pending BG candidates from .pending/bg-candidates.yaml. Phases 2-4 of BG extraction algorithm — classification, presentation, approval. Orchestrated by bg-extraction skill. | `[--all \| --new-terms-only \| --synonyms-only]` |
| `/product:cascade` | Manual cascade navigation. Show pending cascade entries from .pending/cascade-pending.yaml and resolve per-entry. Detection-only (V-11 auto-fix happens automatically via cascade-check.js hook). | `<artifact-id> \| --pending \| --pending --triggered-by <id> \| --pending --revalidate \| --pending --reset` |
| `/product:cleanup` | V-15 orphan detection (default) с opt-in pending hygiene sweep (--pending-hygiene). Default = fast graph analysis listing orphan artifacts. Hygiene mode = cascade revalidate + validation-pending purge + da-pending stale flag. Use --dry-run для preview без apply. | `[--dry-run] [--pending-hygiene \| --full]` |
| `/product:complete` | Run the bounded completeness-loop on a feature's D1-D2B spec (Autonomous Pipeline Vision, Epic B). Drives FM + SC/BR/LC/VC/IC/NFR (and MK/NM if has_ui) to handoff-DoR-sufficient completeness in bounded waves — deterministic completeness-oracle for the stop-signal, heterogeneous profile personas (architect/qa/ux-advisor) on each zone's gaps, auto-resolve the resolvable + escalate real decisions. Stop is external + bounded (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)). v1 core/skeleton (DEC-DEV-0098). | `<FM-NNN> [--max-waves N] [--dry-run]` |
| `/product:config` | Read or modify Product Module configuration (.claude/product.yaml). | `[--show \| --edit <key> <value>]` |
| `/product:consilium` | Prepare a decision on an already-escalated, FORK-SHAPED decision pending-action (>=2 mutually-exclusive options) by running a heterogeneous jury of Epic-A profile personas (architect/qa + ux when the decision touches UI). Each juror scores the options INDEPENDENTLY from the raw artifacts; their verdicts aggregate DETERMINISTICALLY through the shared consilium-synth (matrix + rank + hard/soft-veto); a recommendation package is written back into the SAME PA in place. PREPARE-ONLY — the jury recommends, the owner ratifies. Epic D generalization of the Orchestrator P2 primitive (DEC-DEV-0145). | `<PA-NNN> [--feature FM-NNN]` |
| `/product:da-review` | Manual Product DA review. ID-prefix routing — FM-NNN spawns feature-scope DA; RL-NNN spawns release-scope DA (cross-FM consistency, HYP coverage, rollout deps per DEC-DEV-0026). Findings → .product/.da-findings/<ID>-<timestamp>.md unified schema (DEC-DEV-0030 A.1). Other prefixes (BR/IC/SC/LC/VC/RPM/MK) refused — те реализованы через hooks или approve gates. | `<FM-NNN \| RL-NNN>` |
| `/product:drift-check` | Structural self-audit — check that recent artifacts still align with PS, primary HYP, MVP scope. C1 modification. | `[--scope <last-N-artifacts> \| --since <date>]` |
| `/product:feature` | Start P2 Feature Definition. Enrichment mode (FM-id) или creation mode ("idea"). Produces SC, BR, LC, VC, IC + RPM update. Triggers adaptive-depth DA via hooks. | `<FM-id> \| "<idea description>" \| --continue [<FM-id>]` |
| `/product:handoff` | Generate universal handoff для FM-NNN — 13-section markdown с embedded artifact excerpts + SHA-256 hashes для drift detection. Two modes — --mode draft (3-blocker DoR, status partial) и --mode production (8-blocker DoR, status ready). --regenerate force version++. --with-da-review invokes pre-gen DA. Output: .product/handoffs/FM-NNN-handoff.md. | `<FM-id> [--mode draft\|production] [--regenerate] [--with-da-review]` |
| `/product:impl-sync` | Ingest implementation results back into .product/ — reconcile FM status against orchestrator run verdicts / completed fabric lines / external spec dirs, then (owner-approve-gated) flip verified features to shipped and stamp an impl_sync block. Reverse-flow of handoff (external tool → .product/). --dry-run reports only. | `[FM-NNN] [--all] [--dry-run]` |
| `/product:init` | Start P1.A Discovery Session for a new product. Creates PS, MR, CA, SEG, VP, HYP artifacts. | `<idea description> OR --continue OR --deep OR --pivot` |
| `/product:lesson` | Atomic find→fix→record corrective LESSON-* (fix applied + verified before commit). Use the instant an error is self-detected — the inverse of the deferred .pending queue. | `"<what went wrong>"  \|  --resume <LESSON-id>  \|  --withdraw <LESSON-id> "<reason>"` |
| `/product:nfr-review` | F.5a NFR Review для FM. Two phases — Ask (mandatory) + Define (conditional on [Y]). Sanity range warnings (per NFR.md §5). Consumes NOTE-NNN с promote_target=NFR queue. Updates FM.nfr_status atomically с FM version++. | `<FM-id> \| --continue [<FM-id>]` |
| `/product:nfr-upgrade-tier` | Batch NFR review при product tier change (MVP→MMP / MMP→Growth / etc). Re-evaluates active NFRs per new tier sanity ranges; surfaces declined + pending FMs для re-Ask. Updates product.yaml.product_tier OR RM.current_phase + version bumps. | `<new-tier> [--dry-run]` |
| `/product:patterns` | Meta-linter — scan .product/ for recurring anti-patterns across artifacts. C4 modification. Informational only. | `[--scope <artifact-type> \| --pattern <pattern-name>]` |
| `/product:plan` | Start P1.B Planning Session. Creates MVP scope, Roadmap, RL-001, and FM skeletons. Requires Discovery complete. | `[--continue]` |
| `/product:promote-note` | Convert NOTE-* unstructured note to structured artifact (FM/SC/BR/IC/NFR/HYP). D3 modification. | `<NOTE-id> to <TYPE>   (e.g., /product:promote-note NOTE-007 to FM)` |
| `/product:status` | Dashboard of .product/ state — artifact counts, pending items, handoff status, recent sessions. | — |
| `/product:validate` | On-demand validation of .product/ artifacts. Runs V-01..V-16 + V-H-01..V-H-11 catalog per tier in product.yaml. Filtering --rule, --scope, --tier. --deep for severity uplift. Output: markdown report inline + JSON file. | `[--rule V-NN] [--scope <glob>] [--tier blocking\|warning\|info] [--deep] [--report-format json\|markdown\|both]` |
| `/product:validation-tune` | AI proposes PROJECT-LOCAL validation tuning (rule severity / config tweaks) based on observed patterns in THIS project. Systemic defects escalate upstream via /ecosystem:meta-feedback. C3 modification. | `[--review-suggestions]` |

## /design:* (7)

Дизайн интерфейса — условно, при `has_ui=true`

| Команда | Что делает | Аргументы |
|---|---|---|
| `/design:export` | D.6 export verify — assemble UI-contract block from MK/DS/NM ready для handoff §10. Standalone sanity check; /product:handoff fills §10 directly from artifacts (no command call from handoff per Q10 carry-forward). | `<FM-id>` |
| `/design:iterate` | D.3 continuation на existing active MK. Iteration counter ++; tool dispatch per MK.design_tool; deadlock guard (Q7) inherited from design-session.md. | `<MK-id> [--from-feedback "<text>"]` |
| `/design:map` | Compose/refresh the App Map (AM) — L0 карта всего приложения (модули × кейсы × пути + CJM-слой) поверх per-flow NM. Mechanical layer derived from FM/NM; editorial layer из app-map.md frontmatter. | `[--write] [--html] [--facet module\|case\|role\|path] [--role R-xxx]` |
| `/design:migrate` | Migrate MK design_tool between Stitch ↔ HTML (v1.0 per DEC-DEV-0052 C3 cut; Claude Design path → v1.1), or import an MK's visual HTML into the open-design viewer (--to open-design, v1.5). Hard approve gate per-MK (Q1). Regeneration targets are lossy (brief + MK metadata + DS snapshot); open-design is a lossless visual import (no metadata, no regeneration). previous_tools[] audit trail; rollback on failure. | `<MK-id\|--all> --to <stitch\|html\|open-design> [--reason "<text>"]` |
| `/design:start` | Start P2.5 Design Session для FM-NNN с has_ui=true. Workflow D.1 Brief → D.2 Screens → D.3 Iterate → D.4 States → D.5 Artifacts → D.6 Export. Produces MK/DS/NM. Conditional sub-module — Phase 6. | `<FM-id> [--continue] [--abandon]` |
| `/design:status` | Design Module dashboard. MK/DS/NM counts per status, active iterations, DS pending items, design tool connectivity, Stitch quota tracking. | `[--fm <FM-id>] [--verbose]` |
| `/design:system` | Design System management — review pending DS proposals OR force re-extract from specific MK. Mass-rename workflow surfaces preview + IDE find-replace guidance (atomic — v1.1+). | `[--review] [--update-from <MK-id>]` |

## /integrator:* (12)

Подключение внешних инструментов под PMO («сисадмин»)

| Команда | Что делает | Аргументы |
|---|---|---|
| `/integrator:add` | Add an external tool (npm package, MCP server, git repo, or Dockerized shared daemon) under Integrator management. 6-stage flow with approve gate before install. Idempotent re-run after partial failure. | `<tool-name>[@version] [--source npm\|mcp\|git\|binary\|docker]` |
| `/integrator:debug` | Diagnose an Integrator-zone failure — journal lookup → contract check → root-cause hypothesis → approve-gated fix → regression → journal. One-shot, not a REPL. | `<error-description> [--tool <name>]` |
| `/integrator:docs` | Generate the Orchestrator-facing operating manual for installed tools at .claude/integrator/tool-docs/<tool>.md. Wraps the tool-docs-generator skill; preserves manual blocks on regeneration. | `[--tool <name> \| --tool=all]` |
| `/integrator:gaps` | Show uncovered PMO zones with criticality assessment. Read-only. | — |
| `/integrator:journal` | View Integrator decision journal with optional filtering. | `[--filter <tag>] [--limit <N>] [--scope global\|project]` |
| `/integrator:map` | Show current PMO coverage by active tools. Read-only. | — |
| `/integrator:remove` | Remove a tool from Integrator management. Impact analysis + backup + uninstall + cleanup contracts + update pmo-mapping. Destructive; requires explicit user confirmation. | `<tool-name> [--confirm]` |
| `/integrator:research` | Research tools for a PMO need; presents 2-5 options with comparison, doesn't install. | `<need-description>` |
| `/integrator:scan` | Scan project environment to detect existing customizations and conflicts before any modifying action. | — |
| `/integrator:status` | Full Integrator state overview. Read-only. | — |
| `/integrator:update` | Update an installed tool to a new version. Backup → install new → drift detection → contract repair → verify. Per SPEC §7.4 + DEC-DEV-0040 Q2 (kept in Phase 5, not Maintenance). | `<tool-name> [<target-version>] [--check-only] [--repair]` |
| `/integrator:verify` | Health check of the Integrator zone — tools installed, contracts valid, pmo-mapping consistent, adapters drift-free. Read-only; reports, does not repair. | — |

## /orchestrator:* (1)

Прогон PMO-процессов end-to-end (D2-Tech + D3+)

| Команда | Что делает | Аргументы |
|---|---|---|
| `/orchestrator:run` | Run an Orchestrator PMO process end-to-end as an in-harness Workflow. First increment ships P3 batch-features-to-cc-sdd (route Product handoffs into cc-sdd specs). Reads handoffs + tool-docs; delegates spec generation to cc-sdd's kiro-spec-batch; gates with a content-fidelity preflight and an independent coverage oracle. | `<process> [--feature FM-NNN ...] [--all] [--no-stack-gate] [--fabric] [--autonomy L0\|L1\|L2\|L3]` |

