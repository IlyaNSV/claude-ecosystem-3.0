# Changelog

All notable changes to Ecosystem 3.0 are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.2.1] — 2026-05-14

Phase 4.1 patch release: **D7 Log Conformance Auditor** — расширение прототипа `session-audit` (8a83562) к production mechanism для валидации smoke-сессий пилотных проектов против `PHASE_<N>_SMOKE_TEST_PLAN.md`. Hook-collects-state + command-consumes-batch composite pattern с журналом идемпотентности. Per [DEC-DEV-0034](DEV_JOURNAL.md).

**No backwards compatibility impact** — D7 internal infrastructure только. Existing pilot installations keep working без изменений; opt-in `/ecosystem:enable-d7-audit` нужен только если developer хочет аудитить smoke в данном пилоте.

### Added — D7 conformance auditor mechanism (DEC-DEV-0034)

- **`dev/meta-improvement/hooks/session-audit.js`** (refactored from prototype) — SessionEnd marker writer. Без spawn. Идемпотентен. Регистрируется в пилотном проекте через absolute path; пишет Pending row в `audit-index.md` репо экосистемы.
- **`dev/meta-improvement/scripts/audit-smoke.js`** — Node CLI orchestrator. Parses `PHASE_<N>_SMOKE_TEST_PLAN.md`, queries Pending markers (фильтры `--since`, `--target-project`, `--session-id`, `--transcript`), pre-processes transcripts (filter `tool_use` blocks, truncate >2k char content), spawns per-session `claude -p` auditor, computes deterministic aggregate JSON (coverage matrix + dedupped findings), spawns AI aggregator. Exit codes: 0/1/2/3. Flags: `--phase`, `--force`, `--dry-run`, `--no-plan`, `--skip-aggregate`.
- **`dev/meta-improvement/scripts/audit-index.js`** — Node helper module: parse/format/append Pending + Processed rows; atomic writes via tmp+rename.
- **`dev/meta-improvement/prompts/session-audit.md`** (extended) — per-session auditor prompt с Step 0 (identify phase), Step 2.5 (smoke plan coverage trace — primary), expanded YAML schema (`mode`, `coverage_summary`, `scenarios`, `findings` machine-readable blocks). Existing 7 checks (A-G frontmatter/P-RULE/V-11/D1/skill/phase) сохранены как secondary process catalog.
- **`dev/meta-improvement/prompts/phase-audit-summary.md`** (new) — aggregator prompt: synthesize narrative из script-computed JSON; explicit «never recount» rule (anti-fabrication on numbers); coverage matrix + conflict resolution + recommendations sections.
- **`dev/meta-improvement/audit-index.md`** (new) — Pending + Processed journal с sentinel-based insertion anchors для hook и CLI. Markdown table format, human-readable, git-diffable.
- **`dev/meta-improvement/audit-reports/`** — output directory: `<session-id>.md` per session, `phase-<N>-summary.md` aggregate, `phase-<N>-aggregate.json` script-computed input.
- **`.claude/commands/meta/audit-smoke.md`** — slash command wrapper для `/meta:audit-smoke`; доступен только из cwd репо экосистемы (D7 mechanisms NOT deployed в user projects).
- **`commands/ecosystem/enable-d7-audit.md`** — opt-in setup command для пилотного проекта; регистрирует SessionEnd hook в `.claude/settings.local.json` с absolute path к репо экосистемы. Идемпотентно.
- **`dev/meta-improvement/checklists/audit-smoke-workflow.md`** — developer ritual: one-time setup → per-phase smoke → audit → DEV_JOURNAL retroactive entry. Включает pre-flight + post-audit checklists, troubleshooting table.

### Modified — D7 conventions

- **`dev/meta-improvement/CONVENTIONS.md`** §3, §4 — added audit mechanism rows; new composite pattern «hook-collects + command-consumes».
- **`.gitignore`** — exception для `.claude/commands/` subtree чтобы D7-internal slash commands могли быть tracked (settings.local.json + worktrees/ остаются ignored).

### Connection ecosystem ↔ pilot

Hook script лежит в репо экосистемы; пилот регистрирует его через absolute path в `.claude/settings.local.json` (one-time setup via `/ecosystem:enable-d7-audit`). Отчёты пишутся в репо экосистемы. Пилот не загрязнён meta-артефактами. См. `dev/meta-improvement/checklists/audit-smoke-workflow.md` для full ритуала.

### Runtime smoke — executed 2026-05-20

Mechanism Phase 4.1 впервые прогнан на real Phase 4 transcript'ах 2026-05-20 (9 пилотных сессий `my-first-test`). Первый dogfood вскрыл 2 бага CLI — исправлены в `DEC-DEV-0037`; smoke results + закрытие Phase 4 — `DEC-DEV-0038`.

---

## [1.2.0] — 2026-05-13

Phase 4 release: **Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline + HYP frontmatter canonical**. 6 new commands + 6 new/refactored skills + 1 new hook + 1 hook utility + 1 agent refactor + 5 skill language reminders + Language section в template. Ships through 10 sub-phase commits (A-H implementation + J static smoke + b8f16bc review fix-up + K1 closure docs). Per [DEC-DEV-0024..0032](DEV_JOURNAL.md).

**Backwards compatibility:** Phase 4 introduces schema extensions для DA findings frontmatter (canonical fields per DEC-DEV-0030 A.1) — existing `.product/.da-findings/*.md` from Phase 3 hook-driven adaptive DA остаются valid (Shape A — cosmetic check; subset of canonical fields). Mode/scope fields добавляются inferred (legacy: `source: hook-driven`, `scope: artifact`). Никакой migration script не требуется. Phase 3 hooks (`br-change-trigger.js`, `ic-change-trigger.js`) поведенчески неизменны.

**Runtime smoke — executed 2026-05-20.** Static verification Section A 8/8 PASS (включая `product-handoff-gate.js` functional layer от b8f16bc). Runtime smoke прогнан (9 пилотных сессий) → **status=fail**; Phase 4 закрыта с принятыми known issues — `DEC-DEV-0038`.

### Added — Validation runner (Phase 4.C / DEC-DEV-0025 C.4)

- **`commands/product/validate.md`** + **`skills/product/validation-runner.md`** — on-demand `/product:validate` runs V-01..V-16 + V-H-01..V-H-11 (V-MK-* Phase 6 conditional skipped с graceful note). Tier-aware (B1 per `product.yaml.validation_tier`); quiet-mode-aware (B2 — drafts queue findings). `--rule`, `--scope`, `--tier`, `--deep`, `--report-format` filters. JSON + markdown report к `.product/.reports/validate-<YYYYMMDD-HHMM>.{json,md}`. Auto-purge stale `validation-pending.yaml` entries (DEC-DEV-0023 F5 pattern reuse). V-11 inline auto-fix counted separately.
- **V-16 NFR severity matrix** — conditional severity per `nfr_status × product_tier × high_risk` matrix (OQ-03 closed for runtime evaluation).
- **V-H-11 NFR section conformity** (added в b8f16bc review fix-up per DEC-DEV-0031) — NFR section в handoff body соответствует FM.nfr_status three cases (A active / B declined / C pending) с conditional severity (active без embedded NFR → 🔴 Blocking; declined high-risk без rationale → 🔴 Blocking; etc.)

### Added — NFR review F.5a (Phase 4.D / DEC-DEV-0028 D.2 + DEC-DEV-0025 C.2)

- **`commands/product/nfr-review.md`** + **`skills/product/nfr-review.md`** — `/product:nfr-review FM-NNN` запускает F.5a.0 Ask + F.5a.1 Define в одной session. Ask=Y → Define proceeds через categories (latency, availability, throughput, etc.). Tier auto-detected from `RM.current_phase`. Override (`sanity_check: overridden` + rationale) → informational warning, не blocking. Continue via `/product:nfr-review FM-NNN --continue` если много NFR.
- **`commands/product/nfr-upgrade-tier.md`** — batch re-review при `product_tier` upgrade (e.g., mvp → mmp). Все FM с `nfr_status: declined` or `pending` queued; per-FM action [Re-review/Keep/Defer].

### Added — Handoff generator (Phase 4.E / DEC-DEV-0025 C.1 + DEC-DEV-0028 D.1)

- **`commands/product/handoff.md`** + **`skills/product/handoff-generator.md`** — `/product:handoff FM-NNN [--mode draft|production] [--regenerate] [--with-da-review]` generates `.product/handoffs/FM-NNN-handoff.md`. 13-section markdown с embedded artifact excerpts + SHA-256 hashes per artifact (drift detection).
- **`--mode production`** (default): 8-blocker DoR (B1-B8). status: ready если passed; status: blocked если any fails (no file write); status: partial если warnings only. **Never auto-downgrades к draft** (Ambiguity 13).
- **`--mode draft`**: 3-blocker DoR (B1/B2/B5). Always status: partial; «⚠ Draft Mode Warnings» section listed mode markers.
- **`approve_overrides[]` (D2)** — temporary blocker bypass с rationale; expires_at check; logged в handoff frontmatter `dor_overrides`.
- **NFR section three cases** — body §11 conditional на `FM.nfr_status`: A active (embedded NFRs); B declined (rationale + tier defaults); C pending (warning + most-conservative defaults).
- **`--with-da-review`** — invoke pre-handoff DA через SlashCommand `/product:da-review FM-NNN`; critical pending findings refuse handoff (Phase 4.H wiring; safe-guard preserves graceful fallback для incomplete bootstrap).

### Added — Cross-platform hash utility (Phase 4.E)

- **`hooks/product/lib/hash.js`** — shared utility module. `computeArtifactHash(filePath)` returns `sha256:<hex64>`. Content scope: body markdown **без frontmatter** (per DEC-DEV-0025 C.1 + DEC-DEV-0030 user choice 2026-05-12). LF-normalized (CR stripped). Same module imported by Phase 4.F gate hook (single source of truth). Frontmatter mechanical updates (version, updated) НЕ влияют на hash.

### Added — Handoff drift gate hook (Phase 4.F / DEC-DEV-0025)

- **`hooks/product/product-handoff-gate.js`** — PostToolUse non-blocking warning hook. После save артефакта в `.product/`: scans existing handoffs, recomputes hashes через `lib/hash.js`, warns в stderr при mismatch (suggests `/product:handoff <FM-id> --regenerate`). Registered в `manifest.yaml`. Regex bug fixed в b8f16bc review fix-up (line-based parser для multi-entry `artifact_hashes` блоков, DEC-DEV-0031 A1).
- **Smoke runner extension** — `dev/meta-improvement/scripts/smoke-hooks.js` TEST_CASES schema добавил optional `setup(ctx)` + `expectStderrIncludes` для functional assertions. Phase 4.F gate hook теперь тестируется в 2 cases: `[no-handoff]` (exit clean) + `[drift-on-second-artifact]` (multi-entry handoff с wrong SC-005 stored hash → assert stderr содержит «Handoff drift detected»). 8/8 PASS post-rebase (per DEC-DEV-0031 lesson 1 — «smoke `no crash` ≠ correct behavior»).

### Added — Cleanup + pending hygiene (Phase 4.G / DEC-DEV-0027)

- **`commands/product/cleanup.md`** + **`skills/product/cleanup-detector.md`** — `/product:cleanup [--dry-run] [--pending-hygiene | --full]`. Default = V-15 orphan detection only (fast graph analysis). `--pending-hygiene` = full sweep: cascade revalidate (delegates `/product:cascade --pending --revalidate`) + validation-pending purge (re-evaluate per entry, purge currently passing) + da-pending stale flag (artifact.status == active; flag-only, не auto-delete).
- **Design module conditional** — MK/DS/NM orphan checks активны только если `commands/design/` directory exists (file-based) или `product.yaml.modules.design.enabled` (config fallback per Ambiguity 16). NOTE artifacts skipped (root artifact rule).
- **Per-orphan interactive action** — [Y]es archive / [N]o / [R]e-link / [D]elete (с explicit «delete» confirmation + decision journal entry) / [S]kip.

### Added — DA expansion core (Phase 4.H / DEC-DEV-0026 + DEC-DEV-0030 A.1/18/22)

- **`agents/product/devils-advocate.md`** refactored — third sub-mode `Mode: full + scope: release`. 6 release-level lenses: Cross-FM consistency, Release scope vs HYP coverage, Rollout dependencies, Bundle handoff readiness, Scope creep release-level, Steelmanning release scope. Cross-FM findings include `affected_artifacts[]` + `suggested_drill_down`. Best-effort text parsing FM body §12 «Dependencies on other features» с explicit low-confidence flag (Ambiguity 2).
- **`skills/product/product-da-review.md`** — FM-level (Branch A) + RL-level (Branch B) orchestration. Brief construction с scope-specific context (FM linked artifacts vs RL.features[] + cross-FM dependency graph + decision journal entries за период RL.created..now + prior FM-level findings). Agent invocation; canonical schema verification post-write.
- **`commands/product/da-review.md`** — ID-prefix routing per Ambiguity 18. FM-NNN/RL-NNN accepted; BR/IC/SC/LC/VC/RPM/MK refused с structured guidance pointing к correct invocation path. Interactive [Act/Defer/Dismiss/Skip] flow; dismissal requires rationale (anti-sycophancy).
- **Canonical DA findings schema (DEC-DEV-0030 A.1)** — unified `.product/.da-findings/<id>-<YYYY-MM-DD>-<HHMM>.md` frontmatter: `id, severity, artifact_ref, source, scope, affected_artifacts, suggested_drill_down, resolution, follow_up`. Decision journal entries embed выжимку (`id, severity, artifact_ref, statement, resolution, follow_up.revisit_trigger`). B.1 anti-pattern list: 6 forbidden field-name variants explicit (`findings_severity`, `referenced_artifact`, `invocation_source`, `review_scope`, `cross_refs`, `drill_down_hint`).
- **`--with-da-review` wiring в handoff-generator** — real SlashCommand invocation, source: auto-pre-handoff passed-through. Critical pending findings refuse handoff (non-bypassable gate). B3 safe-guard preserved для incomplete bootstrap fallback.

### Added — HYP frontmatter canonical fix (Phase 4.A / DEC-DEV-0024)

- **`skills/product/hypothesis-formulation.md`** — drift fix: canonical fields `target_value`, `segment`, `value_proposition` (per `docs/pmo/artifacts/HYP.md` schema). Anti-pattern warning explicit для `success_threshold` (forbidden alternative). B.1 convention pattern from `problem-discovery.md` + `note-promote.md`.

### Added — Language discipline (Phase 4.B / DEC-DEV-0029)

- **`templates/project/CLAUDE.md.template`** — new «Language and tone» section: Russian default для user dialogue; identifiers / paths / commands / flags / technical terms / abbreviations (NFR, DA, JTBD, PMO, MVP, BG, RPM) / code fragments / English spec quotes — verbatim, не переводить/склонять. Good/bad examples.
- **Inline language reminders** добавлены в 5 user-facing skills: `planning-session.md`, `feature-session.md`, `scenario-authoring.md`, `business-rule-extraction.md`, `release-planning.md`. Point-of-use enforcement против AI mirroring effect от mixed-language prompts.
- Full skill rewrite (Option B в DEC-DEV-0029) deferred к v1.1 — ROI лучше после real pilot с fixed CLAUDE.md.template.

### Added — Phase 4 smoke test plan (Phase 4.J)

- **`dev/PHASE_4_SMOKE_TEST_PLAN.md`** — 15 scenarios mapping к sub-phases A→H deliverables. Section A static verification executed AI session (8/8 PASS): hook smoke runner, file structure, frontmatter compliance, canonical schema fields, anti-pattern list, `--scope` flag collision removed, cross-references resolve, SlashCommand added к handoff allowed-tools. Section B runtime scenarios S1-S13 + S15 deferred к user-driven Claude Code session с `.product/` data.

### Added — Phase 5 readiness skeleton

- **`dev/PHASE_5_READINESS.md`** — kickoff substrate для Phase 5 (Integrator Phase 2 + first cc-sdd adapter). Pre-kickoff items: handoff format validated by real run; Integrator read-only baseline working; cc-sdd evaluated as first adapter target. Architectural questions queued для kickoff session (DEC-DEV-NNNN gate before sub-phase A start).

### Fixed (b8f16bc review fix-up / DEC-DEV-0031, merged между Phase 4.F и Phase 4.G)

- **`hooks/product/product-handoff-gate.js` extractArtifactHashFromHandoff regex** — ловил только первую запись `artifact_hashes`. Drift detection silently не работал для embedded SC/BR/IC/LC/VC/NFR/MK/NM (non-FM artifacts). Заменён на line-based parser robust к multi-entry blocks + CRLF + edge cases. 5 unit cases verified. Smoke runner functional test [drift-on-second-artifact] guards против regression.
- **PreToolUse → PostToolUse non-blocking** drift doc cleanup — handoff-generator.md, handoff.md, handoff-spec.md updated к accurate semantics (Phase 4.F design deviation properly documented).

### Modified — Drift sweeps inline

- **`docs/product-module/SPEC.md`** §3.2 — `/product:cleanup` signature expanded (3 modes), `/product:da-review` signature replaced (FM-NNN/RL-NNN ID-prefix routing; `--scope` removed per Ambiguity 22).
- **`docs/pmo/processes.md`** §6.2 + §8 — manual DA invocation routing rephrased; command table row added для RL-NNN release scope.
- **`docs/pmo/validation.md`** §10.1 + §11 — `/product:cleanup` mode documented; V-15 status flip к [x]; V-H-11 added (B1 expansion в b8f16bc).
- **`docs/product-module/handoff-spec.md`** §15-16 — implementation status: Phase 4.E/F/H entries flipped к [x] с accurate wording.
- **`skills/product/bg-extraction.md`** + **`pattern-linter.md`** — cosmetic refs к `/product:cleanup` updated к new mode signature.

### Notes

- **DEC-DEV-0030 cuts:** `/product:clarify` channel deferred к v1.1 (no Phase 5 adapter receiver); D.7 aspirational layer (recursive auto drill-down + `FM.depends_on` graph) deferred (core shipped, evidence-gated bring-forward).
- **Effort actual: 12-15h** vs ROADMAP base 3-4h (3-4x multiplier — pattern stable Phase 2/3/4; ROADMAP «How this roadmap evolves» refinement candidate).
- **Closure ritual (Unit 2)** — D7 phase-closure.md 6 steps executed 2026-05-13 fresh-session (`DEC-DEV-0033`). Runtime smoke прогнан 2026-05-20 → fail → Phase 4 закрыта с принятыми known issues (`DEC-DEV-0038`).

---

## [1.1.1] — 2026-04-29

Patch release: Phase 3 smoke test executed on `my-first-test` (5.5h real run) revealed 4 critical hook bugs (silent regressions) + 1 validation lifecycle gap + 5 skill convention gaps. Comprehensive fix package + lint pipeline infrastructure to prevent recurrence. Per [DEC-DEV-0023](DEV_JOURNAL.md).

**Backwards compatibility:** all hook behavior changes are **bug fixes** — no schema changes. Existing `.product/.pending/*` files с accumulated bloat: clear via new `/product:cascade --pending --reset` (DEC-DEV-0023 Q7) or `--revalidate` (re-run cascade-check fresh).

### Fixed — Hook code

- **`hooks/product/bg-extractor.js`** — TDZ bug: `const STOPWORDS` referenced inside `termPasses(term)` (called from line ~88) before declaration (line ~195). Threw `ReferenceError: Cannot access 'STOPWORDS' before initialization` 119 times in pilot smoke test → 0 BG candidates extracted entire session. Fix: hoisted STOPWORDS к module top after requires. Catchable by `eslint --rule no-use-before-define`.
- **`hooks/product/cascade-check.js`** — over-eager dependents: `addDeps()` iterated all candidate files of dependent type без forward-ref check. Each SC save → V-11 missing-reverse-ref entry для all 6 FMs (50 false positives per unrelated FM). Fix: forward-driven `getForwardSpecs(type)` map + `findArtifactFileById()` lookup; only candidates that saved actually forward-references queued. Reverse-driven additional review rules (BR change → LC re-validate) deferred к v1.2.
- **`hooks/product/cascade-check.js`** — no dedup on append: `existing.push(...pendingEntries)` unconditionally appended. 396 entries from ~70 saves. Fix: composite-key Set dedup (`artifact|rule|triggered_by`).
- **`hooks/product/br-change-trigger.js`** + **`hooks/product/ic-change-trigger.js`** — parser-formatter mismatch: formatter emit `      ` (6 spaces); parser strip `^\s{4}` (4 spaces). Each round-trip added +2 leading whitespace per diff line; after 23 BR writes, BR-001 diff field had ~44 spaces leading per line. `da-pending.yaml` = 143 KB. Fix: parser strip `/^\s{6}/` aligned с emit.
- **`hooks/product/artifact-validate.js`** — no auto-purge of resolved entries: stale `validation-pending.yaml` entries never cleared when rule passed on subsequent save. Fix: `purgeValidationPendingFor(projectRoot, fm.id)` at start of each hook run; new findings re-queued via existing flow.

### Added — Hook lint pipeline

- **`dev/meta-improvement/scripts/smoke-hooks.js`** — self-contained Node script: per hook does `node --check` + minimal `hookInput` JSON pipe + assert exit 0 + stderr free of `ReferenceError|TypeError|SyntaxError|Cannot access .* before initialization|is not defined|is not a function|Unexpected token`. No npm deps required.
- **`dev/meta-improvement/scripts/verify-hooks.js`** — wrapper combining smoke + optional eslint (eslint runs only if `node_modules/eslint` installed, после `npm install`).
- **`dev/meta-improvement/scripts/pre-commit.sh`** — git pre-commit hook: blocks commits touching `hooks/` if verify-hooks fails. Bypassable с `--no-verify`.
- **`dev/meta-improvement/scripts/install-pre-commit.sh`** — idempotent installer (backs up existing hook).
- **`package.json`** (root, ecosystem-dev only) — scripts `smoke:hooks`, `verify:hooks`, `verify`; eslint as devDep (optional install).
- **`eslint.config.js`** (flat config v9) — rules: `no-use-before-define` (catches TDZ class), `no-undef`, `prefer-const`, `no-var`, `eqeqeq`.

### Added — Phase-closure ritual step (D7)

- **`dev/meta-improvement/checklists/phase-closure.md`** — new Step 3 «Hook runtime smoke (≤5 min)»; existing Steps 3/4/5 renumbered to 4/5/6. Time budget 35-65 min. Pre-commit installer documented. Pain-origin reference к DEC-DEV-0023 (Phase 3 closure missed 119 hook failures).

### Added — Skill / command refinements

- **`commands/product/cascade.md`** — new sub-actions:
  - `/product:cascade --pending --revalidate` — re-detect cascade across active artifacts (clear stale entries safely after ecosystem upgrade)
  - `/product:cascade --pending --reset` — destructive cleanup с explicit confirmation (logged как DEC-CASCADE-NNN)
- **`skills/product/release-planning.md`** — «JTBD mapping decision tree» section: 3 options (empty array / supporting / demote priority) + decision criteria + required `confidence_notes` text для option B (foundational/measurement features). Pain origin: ad-hoc application к FM-001/005/006 в pilot.
- **`skills/product/vc-derivation.md`** — «Complexity threshold» heuristic: split VC if covers >2 distinct rule clusters / >12 cases / `covers_rules` array > ~6 BRs. Naming convention `VC-NNN` / `VC-NNNa` / `VC-NNNs`. Non-blocking для A1.
- **`skills/product/feature-session.md`** — two new sections:
  - «Deferral capture — NOTE creation guidance»: `promote_target` decision tree (FM / BR / NFR / HYP); explicit NFR-vs-FM placement heuristic для security territory.
  - «Structured DA findings format в decision journal»: YAML schema с mandatory `revisit_trigger` для accepted/deferred resolutions.
- **`skills/product/business-rule-extraction.md`** — `## Telemetry plan` body section (mandatory если confidence: medium|low + numeric parameter); Step 4a trigger.

### Added — Schema decision deferred к v1.1+

- **`dev/v1_1_backlog.md`** — «BR.feature schema — single vs array vs global directory» entry: 3 options (global rules dir / array schema / extends mechanism) + bring-forward trigger (second FM enrichment reveals shared rule reuse pain) + estimated effort.

### Modified — Bootstrap / update never-copy zone

- **`commands/ecosystem/bootstrap.md`** Step 2b/2c — extended filter: `package.json`, `package-lock.json`, `eslint.config.js`, `node_modules/` excluded from greenfield install.
- **`commands/ecosystem/update.md`** — same exclusions added to never-copy zone table.
- **`dev/meta-improvement/scripts/verify-update.sh`** Check 7 — extended `CONTAMINATION_FILES` array + `node_modules/` directory check. Lint files arriving в user `.claude/` would be flagged.

### Test project cleanup (`my-first-test/`)

- `.product/.pending/cascade-pending.yaml` — reset 4317 lines / 396 entries → ~10 lines (clean template + DEC-DEV-0023 rationale comment). 51 KB → 800 bytes.
- `.product/.pending/da-pending.yaml` — reset 2397 lines / ~30 entries → ~10 lines. 143 KB → 850 bytes.
- `.product/.pending/validation-pending.yaml` — stale FM-006 missing-jtbd entry cleared.
- Core artifacts (FM/SC/BR/IC/LC/VC/NOTE) untouched — quality verified clean during analysis.

### Notes

- **CHANGELOG 1.1.0 «Real-world smoke test pending» now resolved.** Smoke ran 2026-04-29; findings captured DEC-DEV-0023; fixes shipped 1.1.1.
- **Pilot evidence > preemptive design.** Q1 (JTBD), Q3 (VC complexity), Q4 (NFR placement), Q5 (telemetry plan) — все codified из real ad-hoc choices in pilot. Without pilot, hypothetical only.
- **D7 closure-driven improvement self-validating.** 3 instances now (DEC-DEV-0014 closure, DEC-DEV-0018 closure run, DEC-DEV-0023 smoke test). Pattern graduates provisional → established.
- **Phase 4 readiness unaffected.** Items C.1-C.5 independent; C.6 already resolved (DEC-DEV-0020).

---

## [1.1.0] — 2026-04-27

Phase 3 release: Planning Module (P1.B) + Feature Definition Module (P2.A enrichment + P2.B creation) + adaptive-depth DA orchestration + cascade detection + BG extraction Phase 1. 23 new/modified files; ships 5 new slash commands, 13 new skills, 4 new hooks, 1 hook extension.

Real-world smoke test pending — see `dev/PHASE_3_SMOKE_TEST_PLAN.md` (run by user в interactive Claude Code session с `cwd=my-first-test`).

### Added — Planning Module (P1.B)

- **`/product:plan`** — orchestrates D1.6 MVP Scope → D1.7 Product Roadmap → D1.8 Release Planning + FM skeletons. Per-artifact Strategic approve gates (per-MVP, per-RM, per-RL, per-FM). Singleton `planning-progress.yaml` session state per DEC-DEV-0013 #1.
- **`skills/product/planning-session.md`** — orchestrator (D1.6-D1.8 sequence, gate management, decision journal entries).
- **`skills/product/mvp-scoping.md`** — D1.6 MoSCoW prioritization. Discipline rules: MUST ≤8 items, WON'T mandatory, success copies primary HYP threshold exactly. Explicit MVP frontmatter template + anti-pattern field name list.
- **`skills/product/roadmap-planning.md`** — D1.7 horizon goals + release sequence + validation cadence. 3-6 month horizon limit; goals must be measurable; each RL validates ≥1 HYP.
- **`skills/product/release-planning.md`** — D1.8 two-phase output: RL-001 plan (Standard approve) → per-FM skeleton (Strategic per-FM approve). FM skeletons populate full canonical schema with empty arrays для D2 fields.

### Added — Feature Definition Module (P2)

- **`/product:feature`** — orchestrates F.0-F.10. Two modes:
  - **Enrichment (`<FM-id>`)**: F.1-F.10 against planned FM skeleton
  - **Creation (`"<idea>"`)**: F.0 idea parsing → F.0a D1-alignment check (top-2 SEG proposal per DEC-DEV-0013 #5) → F.0b skeleton creation → F.1-F.10
  - **`--continue [<FM-id>]`**: resume per-FM session
- **`skills/product/feature-session.md`** — orchestrator (F.0-F.10). Per-FM session state `feature-<FM-id>-progress.yaml` per DEC-DEV-0013 #1. Includes Phase 4/6 placeholders для F.5a (NFR), F.8 (Design), F.9 (FM-level DA).
- **`skills/product/scenario-authoring.md`** — F.2 SC creation. Actor-verb format, BG term consistency, numbering convention (SC-NNN main + SC-NNNa alt + SC-NNNeN error).
- **`skills/product/business-rule-extraction.md`** — F.3 BR formalization. Atomic rules с parameterization, categories (validation/calculation/authorization/workflow/constraint/state-transition). 🔴 Critical с auto-DA via br-change-trigger.js hook.
- **`skills/product/lifecycle-derivation.md`** — F.4 LC derivation. Mermaid state diagrams. **A1 auto-approve eligible** per DEC-DEV-0013 #2: confidence: high + V-05 (states reachable) + V-06 (transitions trigger/guard) → auto-write status:active + journal entry + revert notification.
- **`skills/product/invariant-discovery.md`** — F.5 IC formalization. Formal predicates с supporting BR refs, severity classification (critical/high/medium), recovery strategy. 🔴 Critical с auto-DA via ic-change-trigger.js hook.
- **`skills/product/vc-derivation.md`** — F.6 VC Gherkin Given/When/Then. **A1 auto-approve eligible**: confidence: high + V-07 coverage check (main + alt + error flows covered).
- **`skills/product/rpm-derivation.md`** — F.7 RPM incremental update. Preserves existing roles/actions/cells; adds new actors from SC.actors + actions from SC steps + conditional permissions from authorization BR. **A1 auto-approve eligible**: confidence: high + V-11 bi-dir refs valid.

### Added — Cross-cutting skills

- **`skills/product/bg-extraction.md`** — 5 phases of BG extraction algorithm methodology. Phase 1 (extraction) is hook-side; Phases 2-4 (classification/presentation/approval) handled via skill + `/product:bg-review` command. Mass-rename workflow (v1: manual preview; v1.1 atomic).
- **`skills/product/cascade-protocol.md`** — cascade consistency methodology per DEC-DEV-0012 C.4. Detection + V-11 auto-fix only в v1; full BFS auto-fix beyond V-11 deferred v1.1. Cascade vs DA orchestration distinction (separate concerns, separate pending files).

### Added — Phase 3 hooks

- **`hooks/product/bg-extractor.js`** — Phase 1 of BG extraction. Bold term scanning with stoplist filtering, dedup against existing BG + rejected list, candidates appended to `.product/.pending/bg-candidates.yaml`.
- **`hooks/product/cascade-check.js`** — cascade detection + V-11 (bi-dir refs) auto-fix. Skips auto-fix on draft target per DEC-DEV-0013 #3 quiet-draft consistency. Other rules queued к `.product/.pending/cascade-pending.yaml`.
- **`hooks/product/br-change-trigger.js`** — P-RULE-02 enforcement. Captures git diff against HEAD, queues entry к `.product/.pending/da-pending.yaml` with `Mode: adaptive`, stderr signal для orchestrator (which spawns devils-advocate subagent через Agent tool).
- **`hooks/product/ic-change-trigger.js`** — P-RULE-01 enforcement. Symmetric к br-change-trigger.js (different artifact directory, includes severity field).

### Added — Auxiliary commands

- **`/product:cascade`** — manual cascade navigation. Args: `<artifact-id>` для filter or `--pending` для full overview. Per-entry actions (re-validate / re-approve / dismiss с rationale / skip).
- **`/product:bg-review`** — batch BG candidates review. Phases 2-4 of extraction algorithm (Phase 1 hook-side). Per-term actions (Y/edit/reject/M merge/K keep/R mass-rename).
- **`/product:bg-rename`** — mass-rename BG term. v1 manual preview workflow (sed-suggest + IDE find-replace) + `--commit` finalize after manual apply. Atomic apply deferred v1.1 per DEC-DEV-0012 D.2.

### Modified — D2 overrides runtime

- **`hooks/product/artifact-validate.js`** extended per DEC-DEV-0012 C.5. New helpers `parseOverridesSection()` + `buildOverrideMap()` parse `validation_overrides[]` + `approve_overrides[]` from artifact frontmatter. Overridden findings logged со status: overridden в `.product/.pending/validation-pending.yaml` для audit trail. `expires_at` check для approve overrides (expired → re-applies rule).

### Modified — Adaptive-depth DA refactor (cross-cutting)

Per DEC-DEV-0013 spec drift fixes (A.1-A.4) — propagated DEC-DEV-0012 C.1 adaptive-depth model к остальным docs that DEC-DEV-0012 didn't sweep:

- **`agents/product/devils-advocate.md`** refactored: `Mode: adaptive | full` brief field; new «Adaptive-depth mode» section (Step 1 classify cosmetic/significant + Step 2 adapt depth); dual output shapes (Shape A abbreviated for cosmetic; Shape B 3-tier for significant/full); anti-rationalization guard.
- **`docs/product-module/SPEC.md`** §6.4-§6.5 refactored to adaptive-depth model + superseded blocks referencing DEC-DEV-0012; v1 modifications header + adversarial consciousness updated; §6.7 cascade-check.js documented (was missing).
- **`docs/pmo/processes.md`** §14.2 hooks list updated (old names + magnitude-gated → new names + adaptive-depth).
- **`docs/pmo/validation.md`** header + v1 modifications updated.
- **`docs/pmo/pmo-map.md`** D2-08 row label.
- **`README.md`** principle #5 (Adversarial validation) updated.
- **`CHANGELOG.md`** earlier forward-compat note hook names corrected (1.0.0 section).

### Added — Decision journal convention

- **`.product/.decisions/journal.md`** — new convention per DEC-DEV-0013 #9. Created automatically by skills при first auto-approve / Strategic approve. Entry formats:
  - `DEC-PLAN-NNN` — Strategic approve (manual gate)
  - `DEC-AUTO-NNN` — A1 auto-approve (для 🟢 LC/VC/RPM)
  - `DEC-CASCADE-NNN` — cascade entry resolution (especially dismissals с rationale)
  - `DEC-PROMOTE-NNN` — NOTE → structured artifact (existing convention from Phase 2 D3 modification)

### Added — Manifest registration (4 new hooks)

- **`hooks/product/manifest.yaml`** — 4 new entries: bg-extractor, cascade-check, br-change-trigger, ic-change-trigger. All PostToolUse matcher `Write|Edit`; file-path filtering internal в JS per DEC-DEV-0013 #6. After bootstrap re-runs, all 6 hooks (2 Phase 2 + 4 Phase 3) registered automatically.

### Notes

- **Phase 3 estimate held:** 6-10 hours (revised from 4-6 после DEC-DEV-0012 scope analysis); actual implementation completed в один день focused work, including prerequisite spec drift fixes.
- **B.1 frontmatter convention discipline pays off:** all Phase 3 skills include explicit frontmatter templates с anti-pattern field name lists (per CLAUDE.md + DEC-DEV-0011 lesson). No PS-style drift expected в Phase 3 outputs.
- **Smoke test discipline:** static verification suite ran during Phase 3.I; real run requires interactive Claude Code session (deferred к user-driven execution per `dev/PHASE_3_SMOKE_TEST_PLAN.md`).

---

## [1.0.0] — 2026-04-18

Initial release. Includes 12 architectural modifications applied to baseline design (10 iterations of design from 2026-04-17).

### Added — Ceremony reduction

- **A1: Confidence-gated auto-approve for 🟢 Confirmation artifacts**
  Derived artifacts (LC, VC, RPM, NM) auto-transition to active when AI marks `confidence: high` AND all V-* validations pass. Human gets notification, can revert. Reduces approve-clicks by ~40% per feature.
- **A2: Batch approve in Discovery for 🟡 Standard artifacts**
  G2 (MR), G3 (CA) replaced with "Discovery Review Checkpoint" after D1.4. G1 (PS), G4 (SEG), G4a (VP), G5 (HYP) remain per-item.
- **A3: Magnitude-gated DA review (P-RULE-01/02 modified)**
  DA required only for: creation, severity change, semantic statement change, parameter type change, category change. Cosmetic edits skip. Skipped DAs accumulate as "DA debt" — batched at next FM-level approve gate.

### Added — Validation tiering

- **B1: Project validation tier (`pilot | mvp | full`)**
  Configured in `.claude/product.yaml`. Pilot tier runs only 🔴 Blocking inline; 🟡 Warning queued in `/product:status`. Reduces noise during early iterations.
- **B2: Quiet draft hooks**
  Hooks (BG extraction, cascade check, validation) execute on draft saves but queue results without surfacing. Results shown at draft→active transition or `/product:status`.

### Added — Drift detection

- **C1: `/product:drift-check` command**
  On-demand structural self-audit. Reads PS + active HYP primary + MVP scope + last 10 changed artifacts. Returns direction alignment report (green/yellow/red).
- **C2: `confidence:` field in all artifact frontmatter**
  Required field: `confidence: high | medium | low` + optional `confidence_notes:`. Forces AI self-assessment at approve. Ties into A1 auto-approve.
- **C3: `/product:meta-feedback` command**
  AI can propose ecosystem-level changes (e.g., "rule V-07 generates false positives — propose downgrade"). Logged in decision journal with rationale.
- **C4: `/product:patterns` meta-linter**
  On-demand analysis of `.product/` for recurring anti-patterns (hard-coded values across BR, missing actors in SC, asymmetric FM dependencies, etc.). Informational, not blocking.

### Added — Flexibility

- **D1: Handoff tiers (`draft | production`)**
  `--mode draft` flag relaxes DoR to 3 minimum blockers (FM in-progress, ≥1 SC active, BG covers terms). Generates with `status: partial` + warnings. `--mode production` (default) retains full 8-blocker DoR.
- **D2: `approve_overrides` per artifact with mandatory rationale**
  Human can override blocking V-* rule per artifact via frontmatter. Rationale required, logged in decision journal. Visible in `/product:validate` as known overrides (not failures).
- **D3: NOTE-* unstructured artifact type (22nd type)**
  Catch-all for idea-capture, insights, "think later". Minimal frontmatter (id, title, status, related). Not in dependency graph, not validated by V-*. Convertible to other types via `/product:promote-note <NOTE-id> to <TYPE>`.

### Modified

- **Total artifact types: 21 → 22** (added NOTE-*).
- **Validation rules count remains 33** (33 V-*) + 2 process rules. Behavior changed via tiering (B1) and quiet mode (B2), not rule additions.
- **`approve_overrides` field added to common frontmatter schema** (in `pmo/artifacts/README.md`).

### Documentation structure

- Migrated from previous design location (`PMO Ecosystem/Ecosystem 3.0/`) to clean repo `claude-ecosystem-3.0/`.
- Moved SPECs into `docs/` subdirectory to reflect clean separation: SPECs (reference) vs runtime artifacts (commands, skills, agents, hooks).
- Removed design history files (`_decisions/`, audit reports, chat artifacts) — they belong to design archive, not operational ecosystem.

### Added — Integrator PMO coverage foundation (pre-pilot gap fix)

Closed foundational gap in how Integrator measures PMO coverage:

- **Formal `pmo-mapping.yaml` schema** — `.claude/integrator/pmo-mapping.yaml` is the project-local aggregated view of "who covers what". Full schema in `docs/integrator-module/SPEC.md §4.3` with invariants and update rules. Required fields: `coverage[]` (with tool, confidence, evidence, contracts), `uncovered[]`, `deferred_by_design[]`, `meta`.
- **Confidence lifecycle** — `SPEC §4.4` documents when/how confidence changes (tool add/update/remove/debug/verify, `/product:meta-feedback` propose). All changes require explicit human action with journal entry — no automatic tracking.
- **`/integrator:map` and `/integrator:status` enhanced** to display declared confidence with evidence from pmo-mapping.yaml, surfacing journal-derived issues (recent debug entries as audit signal).

### Scoped out (considered, rejected)

- **Smoke-verified confidence layer** (per-category smoke tests at `/integrator:add`) — considered but rejected as overhead for v1. Integrator's role is "sysadmin, not observer" per DEC-INT-F01. Verification of tool behavior is human-driven через normal usage.
- **Empirical confidence layer** (autoinstrumented usage tracking from adapter invocations) — considered but rejected. Autoinstrumentation only captures invocations через Integrator adapters, missing direct slash-command invocations (e.g., `/kiro:spec-init`). Partial data worse than no data. Empirical feedback flows instead through human-noticed issues → `/integrator:debug` → journal entries → optional `/product:meta-feedback` propose downgrade.

### Added — Bypass permissions mode + expanded allowlist

Pilot bootstrap run revealed that compound commands like `rm -rf A && cp -rn B C && rm -rf D` don't match narrow permission patterns like `Bash(rm -rf .claude-ecosystem-tmp:*)` because Claude Code's permission matcher evaluates the full command string, not individual `&&`-separated parts. User hit ~10+ prompts even with Step 1d pre-staging.

Two improvements:

- **Broader allowlist patterns** in Step 1d — replaces narrow `Bash(git config:*)`, `Bash(git status:*)`, etc. with single broad `Bash(git:*)`. Similar for `Bash(node:*)`, `Bash(npm:*)`, `Bash(npx:*)`, `Bash(claude:*)` — all CLI invocations. Plus shell tools (`find`, `grep`, `sed`, `awk`, `head`, `tail`, `xargs`, etc.). Dangerous patterns kept scoped: `Bash(rm -rf .claude-ecosystem-tmp*)` only, never general `rm`. No `Bash(*)` wildcard used.

- **`--dangerously-skip-permissions` mode documented** as Mode A (primary option for first-time bootstrap). Claude Code CLI flag that bypasses ALL permission prompts for the session. Safe for one-time install; user relaunches without flag for daily work. Documented in:
  - `commands/ecosystem/bootstrap.md` top — new "⚡ Quick install" section with Mode A (bypass) + Mode B (interactive with pre-stage)
  - `INSTALL-HUMAN.md` Block B.3 — two modes with exit/relaunch instructions
  - `install.sh` and `install.ps1` — Next steps output shows both options with 2a/2b

Either mode achieves zero-to-one-prompt bootstrap experience.

### Added — Hook auto-registration (Gap 4 closed)

Previously, bootstrap copied hook JS files into `.claude/hooks/<module>/` but left `.claude/settings.json` hook array empty. This meant Phase 2 hooks (`artifact-validate.js`, `session-state.js`) were installed but **never fired** — Claude Code didn't know to invoke them.

Fix — manifest-based auto-registration:

- **New convention:** each `hooks/<module>/` directory has a `manifest.yaml` declaring event registrations per hook file. Schema documented in manifest headers (fields: `version`, `module`, `hooks[]` with `id`, `file`, `events[]` of `{type, matcher}`, `description`).

- **`hooks/product/manifest.yaml`** — ships with Phase 2 hooks registered:
  - `artifact-validate.js` → PostToolUse on `Write|Edit`
  - `session-state.js` → PostToolUse on `Write|Edit`

- **Bootstrap Step 6b** — new sub-step scans `hooks/*/manifest.yaml`, builds merged hook entries per `(event, matcher)` pair, merges with existing `.claude/settings.json` (preserves user-added hooks), writes back. Idempotent — re-running safe (dedupes by command string).

- **Forward compatibility:** when future phases (Phase 3 adds bg-extractor, cascade-check, ic-change-trigger, br-change-trigger; Phase 4 adds handoff-gate; Design Phase 6 adds design-artifact-validate) ship new hooks — they just drop `.js` files + update `manifest.yaml`. Bootstrap picks up automatically.

- **Existing projects:** bootstrapped before this fix can re-run `/ecosystem:bootstrap` to get hooks registered without losing data (idempotent merge with existing settings).

### Added — Bootstrap UX improvements (pilot-run feedback)

Based on first real bootstrap run (2026-04-19):

- **Step 1c: Tooling prerequisites check** — verify `git`, `node`, `npm`, `npx`, `claude` upfront before heavy operations. Previously, broken node env (common on Windows nvm4w with incomplete installs) wasn't caught until Step 9 — bootstrap would run for minutes, then fail mid-MCP-install. Now it's caught in the first 10 seconds with graceful handling:
  - `git` missing → abort with install link
  - `node`/`npm`/`npx` missing → warn, offer `(skip-mcp)` / `(abort)` / `(force)`. Bootstrap can still complete Steps 1-8, 10-12 without node toolchain.
  - Concrete fix suggestions for nvm4w scenario (`nvm list` → `nvm use <version>` → fresh shell).

- **Step 1d: Pre-stage permissions** — optional (asked interactively, default Yes). Writes merged allowlist to `.claude/settings.local.json` (gitignored) early in bootstrap. Reduces subsequent Claude Code permission prompts from ~15 to 1 (the Write itself). Allowlist design:
  - Broad tool-level: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebSearch`
  - **Scoped** `Bash(...)` patterns: `Bash(rm -rf .claude-ecosystem-tmp:*)` NOT general `rm -rf`; `Bash(git clone --depth 1 https://github.com/IlyaNSV/claude-ecosystem-3.0.git:*)` NOT general git clone
  - Whitelisted `WebFetch(domain:...)` for known service domains (Brave, Firecrawl, Exa, GitHub, npmjs)
  - **Merge logic**: existing `settings.local.json` (Claude Code auto-created with user's approved permissions) is READ, merged with ecosystem allowlist, written back. Never overwrites user's existing entries.
  - User reviewed and can tighten post-bootstrap (file is gitignored, safe to edit).

- **Step 9 MCP install — explicit `claude mcp add` fallback + scope guidance** (Gap 2 closed):
  - Documented explicitly: `/integrator:add` is Phase 5 (Installation) of Integrator, not v1.0. Until then, `claude mcp add` CLI is the correct invocation pattern.
  - **Scope recommendation matrix** added — `local` for pilot/solo (default), `project` for team-shared no-key MCPs, `user` for cross-project installs.
  - **Security rule**: API keys (Firecrawl, Brave, Exa, GitHub) NEVER go in `--scope project` (commits to git). Always `--scope local` for keys-required MCPs.
  - Explicit install commands documented per-MCP with exact package names and env-var patterns.
  - Pre-check on `npx` availability (uses Step 1c result) — graceful skip with actionable message if tooling broken.

### Fixed — Bootstrap first-run usability

Two issues discovered during first real bootstrap attempt (2026-04-19):

- **`.claude/settings.local.json` blocker:** Claude Code auto-creates this file on first launch (user's permission approvals). Previous bootstrap design treated any non-empty `.claude/` as requiring user confirmation — meaning bootstrap would **always** prompt, even on genuinely fresh projects. Fixed by teaching bootstrap about known Claude Code auto-generated files/directories (`settings.local.json`, `projects/`, `todos/`, `statsig/`, `shell-snapshots/`, `ide/`, `plugins/`) and treating them as expected/preserve-worthy. Only truly unknown content triggers user prompt now.

- **`git clone <url> .claude` failure:** git refuses to clone into non-empty directory, so the direct-clone strategy failed whenever `.claude/settings.local.json` was present (essentially always). Replaced with clone-to-temp + merge pattern: clone to `.claude-ecosystem-tmp/`, remove temp `.git/` to avoid nested repo, `cp -rn` (no-clobber) into `.claude/` to preserve existing Claude Code files.

- **Ecosystem signature detection:** bootstrap now recognizes prior ecosystem installs (via `.claude/docs/pmo/pmo-map.md` presence) and offers explicit re-install options (backup + fresh / merge / abort) instead of silently overwriting or failing.

### Fixed — install.ps1 encoding

PowerShell 5.1 (default on Windows 10/11) outputs Windows-1252 by default, mangling Unicode box-drawing characters (`━━━` → `????`). Fixed in two ways:

- Force `[Console]::OutputEncoding = UTF8` and `$OutputEncoding = UTF8` at installer start (preserves UTF-8 for any subsequent user commands in same session).
- Replaced Unicode box chars (`━`, `→`, `✓`, `⚠`, `✗`) with ASCII equivalents (`=`, `->`, `[ok]`, `[warn]`, `[fail]`) in installer output for bulletproof rendering regardless of console encoding.

### Added — Installation infrastructure (pre-Phase 2 enabler)

Solved the chicken-and-egg problem of `/ecosystem:bootstrap` discoverability: until something installs slash commands into `~/.claude/commands/` or `<project>/.claude/commands/`, Claude Code cannot autocomplete them. The prior design relied on a natural-language trigger ("Установи Ecosystem 3.0..."), which worked but had zero discoverability.

**Solution:** two-phase install.

- **Phase 1 — Global install (one-time per machine):** `install.sh` (Unix/macOS/WSL) and `install.ps1` (Windows PowerShell) at repo root. One-liners via `curl | bash` / `iwr | iex`. Clones ecosystem to `~/.claude/ecosystem/` (global cache) and copies `commands/ecosystem/*.md` to `~/.claude/commands/ecosystem/`. Idempotent — re-running pulls latest `main`.

- **Phase 2 — Per-project bootstrap:** `/ecosystem:bootstrap` slash command (file: `commands/ecosystem/bootstrap.md`). 12-step executable flow with flags `--offline`, `--no-mcp`, `--force`. Clones ecosystem into `<project>/.claude/`, initializes `.product/` skeleton, sets up `.env` + `.gitignore` + `settings.json` + `product.yaml`, generates `CLAUDE.md` at project root from template, installs Core MCP stack (per user approve), initializes git (if greenfield), runs `/integrator:status` verification, prints ready prompt.

- **`/ecosystem:verify`** — non-destructive post-install / periodic health check. Verifies core directories, critical files, artifact catalog completeness, commands per namespace, config consistency, `.env` key presence (never prints values), Integrator state, git state. Reports `✓ / 🟡 / ❌` per checkpoint.

- **`templates/project/CLAUDE.md.template`** — generated at new project's root during bootstrap. Provides Claude Code with immediate context about project structure, ecosystem principles, available commands, model preferences, conventions. Read on every session start. Preserves human-added sections on upgrade.

- **Updated root `BOOTSTRAP.md`** — simplified to human-readable overview of the two-phase install design. Executable instructions moved to slash command file.

- **Updated `README.md`** — new Quick Start with two-phase install. References installer one-liners + `/ecosystem:bootstrap`.

- **Updated `INSTALL-HUMAN.md`** — split into Блок A (one-time per machine: Claude Code, git, global install, API keys) and Блок B (per new project: Stitch decision, bootstrap invocation, optional keys).

User flow:
```bash
# Phase 1 (one-time)
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash

# Phase 2 (per new project)
mkdir my-product && cd my-product
claude
> /ecosystem:bootstrap           # autocomplete works
```

---

## Future versions (planned)

- **v1.1** — Orchestrator Module concept + `/product:patterns` pattern dictionary expansion based on real usage data.
- **v1.2** — `P3 Feedback Integration` activation when D5 tooling is available via Integrator.
- **v2.0** — Multi-product workspace support; `P5 Actuality Refresh` automation when usage data shows real refresh patterns.

---

## Reference: Design history (NOT in this repo)

Full design history (10 iterations from audit through 4 modules) is preserved in author's design archive. This repo contains only the operational ecosystem.
