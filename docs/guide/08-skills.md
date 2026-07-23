---
doc_type: reference
---
<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source of truth: frontmatter of skills/**/*.md.
     Regenerate: node dev/meta-improvement/scripts/gen-skill-catalog.cjs -->

# Каталог скиллов

> **Сгенерирован** из frontmatter `skills/**/*.md` — не править руками, перегенерировать: `node dev/meta-improvement/scripts/gen-skill-catalog.cjs`. Скиллы — **lazy-loaded методология**: их не вызывают как команды, их подгружает ассистент под задачу (3-5 за раз). Путь на диске — `skills/<скилл>.md`. Команды — [02-commands.md](02-commands.md). Канонический статус — [ROADMAP](../../ROADMAP.md#где-мы-сейчас).

**Всего: 65 скиллов** в 5 модулях.

## skills/ecosystem/ (5)

Установка и обслуживание самой экосистемы

| Скилл | Что делает |
|---|---|
| `ecosystem/anti-hype-filter` | Mechanically filter harvested research claims — SIFT + provenance tiers + hype-signal scan + keep/DEMOTE/drop with an audit-trail — before they enter a synthesis. Pillar D of the Guided Research capability. |
| `ecosystem/meta-feedback` | C3 upstream contour — methodology for capturing SYSTEMIC ecosystem defects (rules/processes that misfire regardless of project) into a committable outbox for delivery to the ecosystem repo. Companion to /ecosystem:meta-feedback. |
| `ecosystem/research-intake` | Co-form a precise Research Brief with the requester (human OR AI) and set an upfront usefulness-metrics contract that gates the final synthesis. Pillars A+B of the Guided Research capability; front-end for /ecosystem:research. |
| `ecosystem/self-correction` | Non-deferrable self-correction mandate — the instant a task/artifact/decision is found to be done INCORRECTLY (and is fixable now), run /product:lesson BEFORE any other work. Synced surface so existing installs receive the trigger via /ecosystem:update. Companion to skills/product/lesson-capture.md. |
| `ecosystem/user-action-tracker` | How to append, mutate, and list pending user-action entries (PA-NNN) in .claude/pending-actions.md. Ecosystem-wide; any module can write. |

## skills/product/ (35)

Ядро ежедневной работы — D1 Discovery + D2-Behavioral

| Скилл | Что делает |
|---|---|
| `product/bg-extraction` | BG (Business Glossary) extraction methodology — 5 phases per processes.md §5. Continuous auto-extraction (Phase 1 hook) + classification (Phase 2 logic) + batched presentation (Phase 3) + human approval (Phase 4). Cross-cutting skill, references Phase 3.E hook + Phase 3.G commands. |
| `product/business-rule-extraction` | F.3 step — extract Business Rules (BR-*) from active SC steps. Atomic, formalizable, parameterized когда возможно. Critical level — auto-triggers DA review via br-change-trigger.js hook. |
| `product/cascade-protocol` | Cascade Consistency methodology — detection + V-11 auto-fix per DEC-DEV-0012 C.4. Reference for orchestrators + cascade-check.js hook + /product:cascade command. Full BFS auto-fix beyond V-11 deferred к v1.1. |
| `product/cleanup-detector` | Phase 4.G skill — V-15 orphan detection + optional pending hygiene sweep (--pending-hygiene flag) для /product:cleanup. Default mode = orphan only (быстро, predictable). Hygiene mode = cascade revalidate + validation-pending purge verify + da-pending stale flag. Design module (MK/DS/NM) проверки активируются conditionally если commands/design/ установлен. |
| `product/competitive-analysis-protocol-quick` | D1.3 Quick mode — lightweight competitive landscape via Exa + Brave + selective Firecrawl. 30-45 min. Deep mode spawns competitor-analyst subagent. |
| `product/completeness-loop` | Bounded completeness-loop for D1-D2B artifacts (Autonomous Pipeline Vision, Epic B / B1). Drives a feature's spec to handoff-DoR-sufficient completeness in bounded waves — runs the deterministic completeness-oracle for the stop-signal, fires the heterogeneous profile personas (architect/qa/ux-advisor) on each zone's gaps, auto-resolves the resolvable and escalates real decisions. Stop is external + bounded (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)), never the generator grading itself. Invoked by /product:complete <FM-id>. v1 core/skeleton. |
| `product/corpus-qa` | Retrieval-ladder Q&A over the .product/ corpus — deterministic counts from the collector, structural (non-vector) routing to artifact types, and a mandatory pointer (ID + path) behind every load-bearing claim. Read-only; creates no artifacts. |
| `product/discovery-session` | P1.A Discovery Session orchestrator. Manages D1.1-D1.5z steps, gates G1/G4/G4a/G5, and Discovery Review Checkpoint (A2 modification). |
| `product/domain-fit` | Domain Fit Assessment (D1.0b) — classify the product idea into one of 96 registry subcategories (max granularity), look up the aggregate ecosystem-fit score, apply the gate threshold (default 75) and record the domain_fit block in product.yaml. Two modes — discovery (called by discovery-session after D1.0) and assess (standalone backfill / re-assessment). The ONLY class-based gate in the ecosystem; owner override always legal and recorded. |
| `product/drift-detector` | C1 modification — structural self-audit methodology. Used by /product:drift-check to compare recent artifacts vs anchor (PS + primary HYP + MVP). |
| `product/feature-session` | P2 Feature Definition orchestrator (F.0-F.10). Manages enrichment mode (FM-id) and creation mode ("idea"). Per-FM session state, A1 auto-approve flow для 🟢 skills, DA orchestration via stderr signals, cascade handling. |
| `product/handoff-generator` | Generate self-contained handoff для FM-NNN — 13-section markdown с embedded artifact excerpts + SHA-256 hashes для drift detection. Mode-aware DoR (--mode production 8 blockers; --mode draft 3 blockers per handoff-spec §7). approve_overrides[] handling (D2). Uses hooks/product/lib/hash.js (body-only, LF-normalized, cross-platform). Phase 4 per DEC-DEV-0025 C.1 + DEC-DEV-0028 D.1. |
| `product/hypothesis-formulation` | D1.5 step — formulate testable hypotheses using H.A.R.M.E.D. framework. 3-5 HYP with explicit thresholds. |
| `product/invariant-discovery` | F.5 step — discover Invariant Checks (IC-*) from BR + LC. Formal predicates always true. Critical level — auto-triggers DA review via ic-change-trigger.js hook (adaptive-depth). |
| `product/lesson-capture` | D7-in-project modification — atomic find→fix→record corrective LESSON-* (fix applied + verified before commit). Called by /product:lesson. The inverse of the deferred .pending queues — a self-detected error is fixed and recorded NOW, never queued or deferred. |
| `product/lifecycle-derivation` | F.4 step — derive Entity Lifecycle (LC-*) from active SC transitions + BR guards. State machine with Mermaid diagram. 🟢 Confirmation level — A1 auto-approve eligible per DEC-DEV-0013. |
| `product/market-research-protocol-quick` | D1.2 Quick mode — lightweight market research via Brave + Firecrawl. 30-45 min. Deep mode spawns market-researcher subagent instead. |
| `product/mvp-scoping` | D1.6 step — define MVP scope using MoSCoW prioritization. Produces .product/mvp-scope.md from HYP + VP + SEG. Called by planning-session. |
| `product/nfr-review` | F.5a NFR Review skill — two-phase (F.5a.0 Ask mandatory, F.5a.1 Define conditional). Sanity ranges from docs/pmo/artifacts/NFR.md §5 as guardrails; tier auto-detected from RM.current_phase fallback to product.yaml.product_tier. Consumes NOTE-NNN с promote_target=NFR queue. Phase 4 per DEC-DEV-0028 D.2 + DEC-DEV-0025 C.2. |
| `product/note-capture` | D3 modification — quick capture flow for NOTE-* unstructured artifact. 30-second target idea-to-saved. |
| `product/note-promote` | D3 modification — convert NOTE-* unstructured note to structured artifact (FM/SC/BR/IC/NFR/HYP). Used by /product:promote-note command. |
| `product/pattern-linter` | C4 modification — meta-linter for recurring anti-patterns in .product/. Pattern dictionary expandable. Informational only. |
| `product/planning-session` | P1.B Planning Session orchestrator. Manages D1.6-D1.8 steps + per-artifact approve gates. Used by /product:plan after Discovery complete. |
| `product/problem-discovery` | D1.1 step — authoring Problem Statement through 5-8 clarifying questions. Called by discovery-session. |
| `product/product-class` | Capture or backfill the product_class block in product.yaml — archetype + auto-derived facets (runtime_locus, interface, distribution, optional data_sensitivity). Two modes — discovery (D1.0, called by discovery-session) and backfill (one-time, for projects installed before DEC-DEV-0079). Open vocabulary, advisory-only, never gates. |
| `product/product-da-review` | Manual Product DA review — invokes product-devils-advocate subagent в Mode=full с двумя scope branches (feature FM-NNN; release RL-NNN per DEC-DEV-0026). Constructs scope-specific brief, surfaces findings, writes к unified .product/.da-findings/<id>-<timestamp>.md per DEC-DEV-0030 A.1 canonical schema. Phase 4.H deliverable. |
| `product/release-planning` | D1.8 step — define RL-001 detailed plan + create FM skeletons for features in RL. Two-phase output (RL plan, then per-FM skeleton). Called by planning-session. |
| `product/roadmap-planning` | D1.7 step — derive Product Roadmap (RM) from MVP + HYP. Defines horizon goals, release sequence, validation cadence. Called by planning-session. |
| `product/rpm-derivation` | F.7 step — update Role & Permission Model (RPM singleton) с new actors из SC.actors + actions из SC steps + conditional permissions из authorization BR. 🟢 Confirmation level — A1 auto-approve eligible per DEC-DEV-0013. |
| `product/scenario-authoring` | F.2 step — author User Scenarios (SC-*) from FM context. Per-FM 2-4 main SC + alternative + error flows. Actor-verb format. Strategic per-SC approve. Called by feature-session. |
| `product/segment-discovery` | D1.4 step — synthesize segments + JTBD from PS + MR + CA drafts. Produces SEG-* artifacts with priority tagging. |
| `product/validation-runner` | On-demand validation runner — executes the artifact (V-01..V-18) + handoff (V-H-01..V-H-11) + lesson (V-LE-01..05) catalog; V-MK-*/V-AM-* — acknowledged skips (см. таблицы). Tier-aware (B1 per product.yaml.validation_tier), quiet-mode-aware (B2 — draft artifacts queue findings), supports --rule/--scope/--tier filtering and --deep severity uplift. JSON + markdown report output. Phase 4 hardcode implementation per DEC-DEV-0025 C.4 (V-H-11 added post-review per R5/B1 fix-up). |
| `product/validation-tune` | C3 modification — pattern analysis for project-local validation tuning. Proposes rule overrides / config tweaks based on observed usage IN THIS PROJECT. Systemic defects escalate via /ecosystem:meta-feedback. |
| `product/vc-derivation` | F.6 step — derive Verification Criteria (VC-*) from active SC + BR + LC. Gherkin-like Given/When/Then format. 🟢 Confirmation level — A1 auto-approve eligible per DEC-DEV-0013. |
| `product/vp-design` | D1.4a step — design Value Proposition per active SEG (1:1). Simplified Strategyzer-style. Produces VP-* artifacts. |

## skills/design/ (10)

Дизайн интерфейса — условно, при `has_ui=true`

| Скилл | Что делает |
|---|---|
| `design/app-map-generate` | D2-B04 — compose/refresh the App Map (AM) L0 view. Mechanical layer from app-map-scan.js (FM/NM glob); editorial layer (cross_module_edges, primary_journeys, cjm_stages) woven from app-map.md frontmatter. Loaded by /design:map. |
| `design/claude-design-workflow` | Claude Design (claude.ai/design) manual export workflow stub. v1.0 minimal per DEC-DEV-0052 C1 — full skill deferred к v1.1 после first pilot OR Anthropic MCP/API release. |
| `design/component-states` | D.4 Component State Matrix checklist. Mechanical state coverage verification per interactive component (default / hover / focus / error / disabled / loading / empty / overflow / skeleton). V-MK-02 partial mechanical mode per DEC-DEV-0052 Q3/C5. |
| `design/design-session` | P2.5 Design Session orchestrator (D.1-D.6). Manages design brief generation, screen iteration, component state matrix, MK/DS/NM artifact creation. Per-FM session state, hard approve gates, 7-iteration deadlock protection, Stitch quota tracking, fallback chain dispatch. |
| `design/design-system-rules` | D.5 DS extraction algorithm. Token / component / pattern detection from new MK; synonym checking; deprecation tracking; mass-rename workflow (v1.0 manual; atomic — v1.1+). |
| `design/design-validation` | V-MK-* runner partial (V-MK-01..V-MK-08). V-MK-02 mechanical partial per Q3/C5; V-MK-03 manual; V-MK-08 (token coverage) regex-based. Runs at D.5 finalization + /design:export. |
| `design/html-fallback` | HTML emergency fallback за D.2/D.3 generation когда Stitch unavailable AND Claude Design subscription отсутствует. v1.0 minimal — single HTML page, DS tokens via CSS vars, no React, no multi-screen per DEC-DEV-0052 C4. |
| `design/open-design-viewer` | Import an MK's existing visual HTML into the open-design Dockerized viewer (--to open-design target of /design:migrate, v1.5). Viewer-only — runs the CNT-003 adapter (HTTP import to the shared daemon); NO regeneration, NO metadata migration, NO iteration bump. Canon stays in MK/NM. |
| `design/open-design-workflow` | open-design primary generator for D.2/D.3 — Claude authors DS-token-bound SI-*.html and drives the Dockerized open-design daemon via its `od mcp` stdio server (CNT-004) to create a per-FM OD project + one artifact per screen, with live iframe preview (od-proxy) + multi-format export. Multi-screen, agent-authoring (Mode A). Autonomous start_run (Mode B) deferred per CNT-004. |
| `design/stitch-workflow` | Stitch MCP dispatch для D.2/D.3 screen generation. Prompt patterns v0 best-effort (OQ-DM-01 open); quota tracking integration; fallback chain trigger при unavailability. |

## skills/integrator/ (7)

Подключение внешних инструментов под PMO («сисадмин»)

| Скилл | Что делает |
|---|---|
| `integrator/contract-design` | How to design a contract (CNT-*.yaml/.md) between two tools and instantiate the adapter script. Used at /integrator:add Stage 5 and /integrator:update Stage 4 (contract repair). Authoritative schema in docs/integrator-module/SPEC.md §5. |
| `integrator/deployment-provisioning` | How the Integrator EQUIPS a deploy-capability (D3-05/06) for a fabric pilot — authors systemd unit templates (@app/api\|web\|worker running node dist/main.js under WORKER_AUTOSTART; ExecStart only via absolute paths / {{NODE_BIN}}/{{PNPM_BIN}}), a releases/<ts>+current symlink layout, prisma codegen (generate) + migrate deploy steps, and a healthcheck spec (reusing the P7 failure taxonomy) plus a CNT deploy-capability contract. Equips only; the Orchestrator deploy-to-stage process EXECUTES (§8.3). Used by the deployer subagent. |
| `integrator/drift-detection` | Minimum-viable drift detection between installed adapter instance and pilot-local reference adapter, used by /integrator:update Stage 3. Three heuristics (D1 semver / D2 schema / D3 body diff) — all local-only post DEC-DEV-0044 tri-location refinement. Full schema-aware drift deferred to v1.1+ (Phase-7 cut, DEC-DEV-0176). |
| `integrator/installation-protocol` | Installation flow methodology — 6-stage add-flow shared logic (lazy-init, backup, conflict resolution, rollback). Used by /integrator:add, /integrator:remove (backup paths), /integrator:update (drift repair flow). |
| `integrator/research-protocol` | Multi-step methodology for researching tools to fill PMO needs. Used by /integrator:research and tool-researcher subagent. |
| `integrator/tool-docs-generator` | Generate .claude/integrator/tool-docs/<tool>.md per SPEC §14 style guide (API reference, universal English, project-agnostic). Used at /integrator:add Stage 6 (initial) and /integrator:update Stage 5 (refresh after version bump). |
| `integrator/tool-profiling` | How to extract structured tool metadata into YAML profile per docs/integrator-module/SPEC.md §4. Used during /integrator:research and /integrator:add. |

## skills/orchestrator/ (8)

Прогон PMO-процессов end-to-end (D2-Tech + D3+)

| Скилл | Что делает |
|---|---|
| `orchestrator/architecture-consilium` | Orchestrator P2 methodology — run an undecided architecture fork through a heterogeneous JURY of 3 priors (velocity/fidelity/integrity), synthesise their structured verdicts DETERMINISTICALLY (matrix + rank + veto-by-blocking, à la remediation-guard) and surface the real trade-off, then hand the OWNER a scored recommendation + a DRAFT DEC — never an auto-decision. Backed by orchestrator/lib/consilium-synth.cjs. Load during /orchestrator:run decide-architecture-foundation. |
| `orchestrator/audit-spec-fidelity` | Orchestrator P4 regimen — audit generated cc-sdd specs against the .product source for FIDELITY drift before impl. Deterministic trace-integrity (fidelity-oracle) + an LLM fidelity-auditor; each drift is triaged to spec-fix (Orchestrator's zone) or product-feedback (→Product, OD8); auto-re-audit after a spec-fix. Load during /orchestrator:run audit-spec-fidelity. |
| `orchestrator/build-briefs-from-handoff` | Orchestrator P3 bridge — turn Product handoffs into the inputs cc-sdd's kiro-spec-batch consumes (per-feature brief.md + roadmap.md "## Specs (dependency order)"), gated by a blocking content-fidelity preflight (C-07). This is the programmatic substitute for kiro-discovery (which is disable-model-invocation + interactive and cannot run headless). Load during /orchestrator:run batch-features-to-cc-sdd before invoking kiro-spec-batch. |
| `orchestrator/build-steering` | Orchestrator P3 step — ensure cc-sdd steering (.kiro/steering/{product,tech,structure}.md) exists and is stack-pinned before the batch, by DELEGATING to cc-sdd's own kiro-steering skill rather than re-authoring steering. Load during /orchestrator:run batch-features-to-cc-sdd before invoking kiro-spec-batch. |
| `orchestrator/coverage-oracle` | Orchestrator P3/P6 gate — verify a generated cc-sdd spec covers every source requirement by re-deriving the canonical IDs from ground truth (the handoff), never from the spec-author's self-report. Backed by the deterministic orchestrator/lib/coverage-oracle.cjs helper. Load when closing the spec-author wave. |
| `orchestrator/gate-risk-classifier` | Orchestrator P5 gate — deterministically decide each task's verify-gate severity (HIGH → independent adversarial reviewer / LOW → profiled inline-verify) instead of eyeballing it. Backed by orchestrator/lib/gate-risk-classifier.cjs. The key rule: enforcement decides, not "touches an invariant" — declarative (UNIQUE/CHECK) is LOW, imperative (transaction/timing/row-lock) is HIGH. Load during /orchestrator:run feature-to-tdd-impl planning. |
| `orchestrator/orchestrator-init` | Orchestrator P1 — startup/resume context gathering before any process runs. Reads active-tools/pmo-mapping/.product, runs the env-readiness-probe, confirms the target tool is wired, and identifies the handoff batch. Also the re-orientation protocol after /compact. Load at the start of /orchestrator:run. |
| `orchestrator/tdd-impl-loop` | Orchestrator P5 regimen — drive a feature spec to implemented code via a native per-task TDD loop that LIFTS cc-sdd kiro-impl's prompts and gates (because kiro-impl is disable-model-invocation) and adds the gate-risk-classifier. Load during /orchestrator:run feature-to-tdd-impl. |

