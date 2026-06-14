# Changelog

All notable changes to Ecosystem 3.0 are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **`V-18` — per-type frontmatter schema conformance** (DEC-DEV-0064; from Session Audit cluster `D2B-behavioral::A`). New warning-level rule in `hooks/product/artifact-validate.js` that checks `.product/` artifacts on save against the canonical per-type schema in `docs/pmo/artifacts/<TYPE>.md`: correct `type` value, required per-type fields, and key enum membership. v1 scope is **IC** (`type: invariant-check`; active ⇒ `severity`/`entity`/`testable_as`; `severity ∈ critical|high|medium`), **BR** (`type: business-rule`; `category` enum), and **IC/BR/SC** (`status ∈ draft|active|deprecated`) — other types deferred to keep false-positives low (LESSON/HYP carry their own status enums). Warning severity, `validation_overrides`-aware, tier-aware (surfaces at mvp/full, queued at pilot). Closes the gap where B.1 inline templates prevent drift only when the creating skill is in context — bulk/inline authoring went unvalidated. Catalog entry + count `39 → 40` in `validation.md`.

- **open-design GENERATOR role canonized (CNT-004-class) — dual role alongside the 1.5.0 viewer** (DEC-DEV-0067; reconciliation step 3; pilot decision DEC-INT-0012). The 1.5.0 extraction (DEC-DEV-0063) shipped open-design as viewer-only (CNT-003, `/design:migrate --to open-design`); the pilot meanwhile evolved it into its **default D.2/D.3 generator**: Claude authors DS-token-bound `SI-*.html` and drives the shared Dockerized daemon via its **`od mcp` stdio server** (Mode A agent-authoring; no external LLM key; Mode B `start_run` deferred — needs an agent CLI inside the container). Both roles now coexist in canon: generator = opt-in `design_tool: open-design` (canon default stays `stitch`; the pilot sets it as project default), viewer = unchanged migrate-target. Ships as: skill `skills/design/open-design-workflow.md` (generalized from pilot — DS-token example de-pilotized, project naming parameterized); `design-session.md` D.2/D.3 dispatch branch; `open-design` added to `design_tool` enums (MK.md, design SPEC, session-state schema); **3 canonical adapters closing the tri-location gap** — `adapters/od-mcp-call.cjs` (stdio driver; keeps stdin open until all async daemon responses arrive — EOF-truncation guard), `adapters/od-fidelity-check.js` (deterministic sha256 round-trip QA for migrations), `adapters/od-consolidate.cjs` (per-screen → per-FM project consolidation; pilot `FEATURES` config replaced with a documented per-project template). Docs: design SPEC §4.4c + §3.6 dual-role note, integrator SPEC §4.1.1 generate-path addendum, `adapters/README.md` rows + explicit verify-mode exception note (daemon-coupled drivers can't dry-run; `od-fidelity-check` carries the verify role).

- **App Map (AM) — 24th artifact type, canonized from the `my-first-test` pilot** (DEC-DEV-0066; reconciliation step 2 per `dev/PILOT_RECONCILIATION_PLAN.md`). The L0 "whole-app view" — modules (FM) × cases (SC) × cross-module paths + an editorial CJM layer (stages/emotions/pains) — layered OVER per-flow NM-* with a strict anti-duplication firewall (AM references NM by id, never re-writes screen transitions; zoom chain L0 AM → L1 NM → L2 MK/Open Design). Mechanical layer (module list, NM coverage, drill-down links) is **generated**; editorial layer (`cross_module_edges`, `primary_journeys`, `cjm_stages`) lives in `.product/app-map.md` frontmatter and is human-confirmed. Ships as: artifact spec `docs/pmo/artifacts/AM.md` (root singleton `.product/app-map.md`); command `/design:map [--write] [--html] [--facet ...]`; skill `skills/design/app-map-generate.md`; deterministic scanner `hooks/design/app-map-scan.js`; drift trigger `hooks/design/app-map-cascade.js` (PostToolUse on FM/NM/SC → own pending queue `.product/.pending/app-map-pending.yaml`, mirrors br-change-trigger pattern); USER FLOW HTML walker pipeline `app-map-{flow,html,thumbs,viewer}.js` (`--html` → self-contained `.product/app-map.html` with PNG thumbnails + step-through player; OD-independent via committed canonical screens). Validation: 4 light V-AM rules in `design-artifact-validate.js` + `validation.md §5.3b` (counts: artifacts `23 → 24`, rules `40 → 44` — full cross-doc sweep, also closing the deferred DEC-DEV-0064 `39 → 40` sweep). Generalizations on upstream: pilot bead refs dropped, hard-coded generation date → dynamic, stale `mockups/app-map.md` path unified to the actual root location. +4 smoke cases (25/25 PASS).

- **Worktree pre-flight advisory — `hooks/product/worktree-enter-guard.js` + `worktree-preflight.js`** (DEC-DEV-0065; upstreamed from the `my-first-test` pilot — reconciliation step 1, see `dev/PILOT_RECONCILIATION_PLAN.md`). New PreToolUse hook (matcher `EnterWorktree`) that auto-runs a pre-flight report from the **main checkout** — while the gitignored per-checkout state is still visible — BEFORE a worktree is entered, surfacing hazards that won't follow into the worktree: dirty tree / unpushed commits / stash, non-empty `.product/.pending/` queues, fresh `.product/.sessions/current.yaml` (possible concurrent session — interim OQ-PM-02 mitigation) + `git_head_sha` drift, beads `in_progress` (the only cross-checkout coordination signal), and shared gitignored resources (`.env`, `.product/.design-sessions/`, `.claude/integrator/secrets/`). Warn-only: stderr report + PreToolUse `additionalContext` with `permissionDecision: allow`; exit 0 always. Helper `worktree-preflight.js` is standalone-runnable (`--strict` exits 1 on warnings; `--json` machine-readable) and is deliberately NOT a manifest entry (spawned by the guard; precedent: `hooks/product/lib/`). +2 smoke-runner cases (21/21 PASS).

### Fixed

- **DA subagent-type contract** in the Product feature flow (DEC-DEV-0064; from Session Audit clusters `D2B-behavioral::C` + `::B`). `skills/product/feature-session.md` «DA orchestration flow» now shows the **explicit canonical `Agent({ subagent_type: "product-devils-advocate", … })`** invocation (mirroring the manual `/product:da-review` path), covers the **batched F.3 BR→DA** cluster path (one multi-artifact brief to the same canonical subagent — not a `general-purpose` hand-roll), and mandates **STOP-on-«Agent type not found»** instead of a silent fallback to `general-purpose` + role-adoption (which loses the model/tools pin, the isolated Builder/Critic separation, and the `.da-findings/` schema — the recurring «S8 P1 regression»). New anti-patterns #9 (no `general-purpose`) and #10 (not-found = blocking setup error). The registration root-cause (why the type sometimes fails to resolve) is deferred to a live-harness step (DEC-DEV-0043 R4), codified as the D7 pattern `dev/meta-improvement/patterns/da-subagent-type-contract.md`.

- **`handoff-to-ccsdd.js` adapter — silent §10 UI sub-doc fidelity loss** (DEC-DEV-0069; upstreamed from the `my-first-test` pilot, found by Orchestrator dogfood RUN 01 / DEC-DEV-0068). `extractSections` keyed top-level sections flat by `## N.` number (last-write-wins): v1.3/v1.4 handoffs embed MK/DS/NM UI sub-documents under §10 whose own `## 1.`–`## 7.` headers **restart numbering**, silently clobbering the real §1/§2/§5/§6 — cc-sdd's `/kiro:spec-init` then received WCAG notes as `scenarios`, UI edge-states as `business_rules`, and a screen mermaid as `description`, all while the contract reported `passed: true` (presence-level `C-04` only checks that a `## N.` header exists). Fix: (1) **monotonic-increase guard** in `extractSections` — a `## N.` header opens a real section only if N exceeds the highest accepted so far, so restarted sub-doc headers fall into §10's body; (2) **`C-03` supported-generator range** extended to `product-module-v1.{0..4}`; (3) new **blocking `C-07` content-fidelity check** — each ID-bearing field must carry its section's canonical identifier family (§5→`SC-`, §6→`BR-`, §9→`IC-`), catching mis-mapping loudly instead of emitting plausible garbage (canonizes dogfood finding **P0-1**: content-level, not presence-level, verification). Regression locked by `tests/fixtures/FM-FIXTURE-002-handoff.md` + `tests/adapters/handoff-ccsdd.contract.test.cjs` (4 cases incl. a negative C-07 proof; `npm run test:adapters`, now part of `npm run verify`). The reference adapter still carried the bug after the pilot fixed only its installed instance — closes that upstream gap (DEC-DEV-0065 drift class). Output `contract_schema_version` unchanged (`cc_sdd_input` shape identical; only a check was added).

---

## [1.5.0] — 2026-06-11

**Minor release — accumulated since 1.4.0:** harness-audit hygiene (DEC-DEV-0055), `/ecosystem:update` level-2 wipe protection (DEC-DEV-0061), `LESSON-*` atomic self-correction (DEC-DEV-0062), and the open-design reusable Dockerized viewer extraction (DEC-DEV-0063). Runtime smoke (`S-LE` LESSON-gate contracts + Phase 6 `S1-S7`) remains deferred to the next pilot session per the Phase 5 precedent — shipped code-complete with static verification only.

### Added

- **`LESSON-*` — atomic self-correction mechanism for product projects** (DEC-DEV-0062; targets `1.5.0`; merged via PR #25). New 23rd artifact type (`.product/lessons/LESSON-<NNN>-<slug>.md`, git-tracked) that captures the **semantic** error class — "a task / artifact / decision was done incorrectly" — which until now had no trigger, journal, or artifact (only *structural* violations were caught, via `.product/.pending/`). The `find → fix → record → ready` sequence is a **single atomic, non-deferrable operation** — the deliberate inverse of the deferred `.pending/` queues. Three layers: **(1) trigger** — a non-deferrable mandate (`templates/project/CLAUDE.md.template` + synced `skills/ecosystem/self-correction.md`, so existing installs that only receive `/ecosystem:update` still get the trigger, not just the teeth) to run `/product:lesson` the instant an error is self-detected, before any other work; **(2) atomicity** — a write-ahead command transaction (`skills/product/lesson-capture.md`): the `open` tripwire file is written *before* the fix touches disk, then the fix is applied, then verified with recorded evidence, then flipped `open → active` in one write — a crash always leaves a loud git-tracked `open` marker, never a silent loss; **(3) non-deferrability** — a two-pronged gate: `hooks/product/lesson-gate.js` (Stop, **strict** — blocks clean session close while any lesson is `open`) + `hooks/product/lesson-presence-gate.js` (PreToolUse + UserPromptSubmit, **warn** — reminds every turn; `deny` path gated behind `LESSON_GATE_MODE=strict` pending the S-LE live smoke). Invariant (V-LE-01..05): `status: active ⇒ fix applied + verified + reusable guard present` — the structural inverse of a quiet `.pending` finding. **First blocking hook in the ecosystem** (scoped to corrective lessons; fail-open on any error; `LESSON_GATE_MODE` opt-out; 8-block auto-override against wedge). New command `/product:lesson` (+ `--resume` / `--withdraw`); 5 new validation rules V-LE-01..05. The `strict Stop / warn PreToolUse` gate mode was chosen after the hook contract was verified against the official docs — correcting a Stop/SessionEnd conflation in the original synthesis (DEC-DEV-0062 Lesson #1). Runtime-contract verification (`S-LE`, `dev/S_LE_LESSON_GATE_SMOKE.md`) is a hard prerequisite before flipping PreToolUse to strict.
- **Level-2 wipe protection for `/ecosystem:update` — git safety commit of the integrator-managed tool footprint** (DEC-DEV-0061). New **Step 5.0** (runs on the confirmed apply path, before any destructive sync; never in `--dry-run`) creates a scoped git commit (`chore(ecosystem): safety snapshot before /ecosystem:update [level-2 wipe protection]`) capturing `.claude/integrator/`, all `active-tools.yaml` `claude_primitives[].path` (internal + external — `.kiro/`, `.beads/`, `.claude/skills/kiro-*/`, …), and `.claude/settings.json`. Complements the existing level-1 filesystem backup (`.claude-backup-<TS>/`), which is fragile as the sole layer (untracked → wiped by `git clean`; `.claude/integrator/backups/` is gitignored). The git snapshot survives `git clean` / backup-dir deletion and enables single-artifact recovery weeks later (`git restore --source=<sha> -- <path>`). Default on; skip with `--no-safety-commit`. Invariants: never `git add -f` (secrets/gitignored excluded), scoped pathspec commit (user's unrelated WIP untouched), skip-not-abort on any git problem (not a repo / detached HEAD / merge in progress). New `--no-safety-commit` flag; new level-2 recovery section in Rollback. **Policy revision:** the prior blanket "DO NOT auto-commit anything to git" is narrowed to allow this one scoped, opt-out safety commit.
- **`gitignore.template`** now ignores `.claude-backup-*/` — transient level-1 update backups should never be committed (also keeps them out of an accidental `git add -A`).
- **open-design extracted into the ecosystem as a reusable Dockerized viewer / migrate-target** (DEC-DEV-0063; targets 1.5.0). Wiring a new project now reduces to `/ecosystem:update` + thin `/integrator:add open-design` + `/design:migrate <MK> --to open-design`, against **one shared Docker daemon per machine** — no re-authoring of adapter/contract.
  - **Integrator (infra):** new reference adapters `adapters/stitch-to-opendesign.js` (lifted from the patched my-first-test instance + reference-blanks + 4-level token precedence: `--token` → `$OD_API_TOKEN` → `~/.claude/integrator/secrets/open-design.token` → `./.claude/...`) and `adapters/mk-to-stitch.js` (CNT-002 backfill — closed the same tri-location gap); `adapters/README.md` rows. New `source: docker` tool type (`skills/integrator/tool-profiling.md` + SPEC §4.1) and a SPEC §4.1.1 "Dockerized external-daemon tool pattern" (shared-daemon-per-machine, Bearer on all `/api/*`, `127.0.0.1` not `localhost`, image-digest pinning, ZERO `.claude` primitives). `/integrator:add` gained a docker shared-daemon path (Stage 1 skip-profiling when cached, Stage 3 connectivity-validate instead of package install, never auto-`docker run`).
  - **Design Module (D2-B04):** `/design:migrate --to open-design` viewer-import target (no regeneration, no metadata migration, no `iteration` bump — canon stays in MK/NM); new `skills/design/open-design-viewer.md`; commented `external_viewers` default block in the `design.yaml` template (`/design:start`); read-only daemon connectivity check in `/design:status`; design-module SPEC §3.6 + §4.4b.
  - **Ops:** `BOOTSTRAP.md` "open-design shared daemon (machine-global)" section — token gen, `docker run` recipe (loopback bind + named volume), supply-chain pin/build-from-source caveat, health check, per-project wiring, operator-owned lifecycle.

### Fixed

- **Model pin bumped `claude-opus-4-7` → `claude-opus-4-8`** across all live harness surfaces (`settings.json.template` main-session + `_model_strategy`, `agents/product/devils-advocate.md`, `commands/ecosystem/bootstrap.md`, `templates/project/CLAUDE.md.template`). Integrator subagent pins (`claude-sonnet-4-6`) left as-is — already current. (harness-audit follow-up; DEC-DEV-0055)
- **Stale `/ecosystem:upgrade` pointers → `/ecosystem:update`** in consumer-facing update guidance: generated `templates/project/CLAUDE.md.template` (command list + regeneration note), `commands/ecosystem/verify.md` (version-drift suggestion + "not an update trigger"), `commands/ecosystem/bootstrap.md` (manifest re-scan note + "update mechanism" section), and root `BOOTSTRAP.md` (no longer recommends a manual `git pull`). Roadmap/history references to the future `/ecosystem:upgrade` superset preserved. (DEC-DEV-0055)
- **GitHub MCP install** (`commands/ecosystem/bootstrap.md` Step 9) switched from the retired `@modelcontextprotocol/server-github` stdio package (unsupported since Apr 2025) to the official HTTP server `https://api.githubcopilot.com/mcp/` (`github/github-mcp-server`) with a self-hosted Docker fallback — aligning with `docs/integrator-module/SPEC.md`. (DEC-DEV-0055)
- **`output-styles/` wired-but-empty capability removed** from `/ecosystem:update` flat-subdir sync (8 references in `commands/ecosystem/update.md`), `README.md` repo structure, and the empty directory itself. SPEC forward-references to planned `product-report.md` / `integrator-report.md` output-styles retained; re-add to the sync allowlist when those ship. (DEC-DEV-0055)

---

## [1.4.0] — 2026-05-28

**Phase 6 — Design Module v1.0** shipped end-to-end per DEC-DEV-0053 (8 sub-phase commits A→I per DEC-DEV-0047 Lesson 7 cadence). All 12 architectural Qs from DEC-DEV-0052 kickoff implemented; 5 scope cuts (C1-C5) respected; 13 ambiguity resolutions applied. Static smoke runner 19/19 PASS. Runtime smoke (`dev/PHASE_6_SMOKE_TEST_PLAN.md` S1-S7) deferred к next pilot session per Phase 5 precedent.

### Added

- **`commands/design/`** (new namespace) — 6 slash commands:
  - **`/design:start <FM-id>`** — P2.5 D.1-D.6 orchestration entry. Auto-init `.claude/design.yaml` on first invocation; Q9 PA trigger #1 (Stitch MCP unavailable); A7 3-choice menu when has_ui=true без active SC; `--continue` / `--abandon` modes.
  - **`/design:status [--fm <FM-id>] [--verbose]`** — read-only design dashboard. MK/NM/DS counts + active sessions + Stitch quota + MCP connectivity + design-source PA entries.
  - **`/design:iterate <MK-id>`** — D.3 continuation on existing active MK. Skip D.1/D.2; iteration counter persistent across invocations; Q7 deadlock guard inherited.
  - **`/design:system [--review | --update-from <MK-id>]`** — DS management. Batch DS pending proposals review; per-MK force re-extraction; manual mass-rename workflow в v1.0 (atomic — v1.1+).
  - **`/design:export <FM-id>`** — D.6 standalone verify preview. Read-only sanity check; `/product:handoff` does NOT invoke этот command (Q10 resolution).
  - **`/design:migrate <MK-id|--all> --to <stitch|html>`** — tool switching v1.0 Stitch↔HTML only (C3 cut: `--to claude-design` rejected). Q1 hard approve gate per-MK (no batch-bypass); A8 atomic sequence (previous_tools[] first, regen second, rollback on failure).

- **`skills/design/`** (new namespace) — 6 methodology skills:
  - **`design-session.md`** — orchestrator skill (Q7 deadlock 4-choice menu at iter ≥7; Q9 PA triggers #2 + #3; A4 archived/ purge; A5 Stitch quota rollover; A6 atomic MK→DS write order; A9 concurrent session detection; fallback chain dispatch).
  - **`component-states.md`** — D.4 mechanical state matrix checklist. Interactive component detection; per-state coverage walk; V-MK-02 partial mechanical (per Q3/C5); V-MK-03 manual checklist.
  - **`design-system-rules.md`** — D.5 DS extraction algorithm. Token detection; synonym checking (hex distance для colors); batch proposal UX; manual mass-rename workflow v1.0.
  - **`stitch-workflow.md`** — Stitch MCP dispatch (v0 best-effort per OQ-DM-01). Prompt patterns A-D; quota guard (A5); DESIGN.md sync; issues[] surfacing.
  - **`claude-design-workflow.md`** — Claude Design manual export workflow stub (~30 lines per Q5/C1). Q9 PA trigger #2 для no-subscription.
  - **`html-fallback.md`** — single HTML page generation per Q4/C4 (no React, no multi-screen). DS tokens via CSS custom properties; accessibility inline checks; cross-platform LF/UTF-8.
  - **`design-validation.md`** — V-MK-* runner partial. V-MK-01..08 implemented (V-MK-02 mechanical partial per Q3/C5; V-MK-03 manual; V-MK-08 token coverage regex). D.5 approve gate + `/design:export` pre-handoff verify modes. D2 overrides mirrored from `hooks/product/artifact-validate.js`.

- **`hooks/design/design-artifact-validate.js`** + **`manifest.yaml`** — PostToolUse hook per Q8. YAML parse + 5 required fields (MK: id, type, feature, design_tool, scenarios) + ref existence (FM/SC/MK via filesystem) + V-MK-08 token regex coverage + cross-platform path norm `replace(/\\/g, '/')` per Phase 5 bug 3. SPEC §B2 quiet-draft mode (status=draft → queue к `.product/.pending/validation-pending.yaml`; status non-draft → stderr surface). Exit 0 always.

- **`.claude/design.yaml`** auto-init on first `/design:start` (per-project Design Module config — `default_design_tool`, `mcp_preferences.fallback_chain`, `brand_hints`, IR groundwork hooks per SPEC §16.4). Preserved verbatim by `/ecosystem:update` (not в Step 5 root-file allowlist — same treatment as `settings.local.json`).

### Modified

- **`skills/product/handoff-generator.md` Step 8c** (new section) — full §10 UI Specification assembly algorithm. Resolves DEC-DEV-0052 Q10 carry-forward: handoff §10 assembled inline reading active MK/DS/NM artifacts directly (no `/design:export` invocation). Load active MK filtered by FM; load NM; compute DS subset (referenced tokens/components only); assemble 10.1 Mockup Packages / 10.2 DS Snapshot / 10.3 Navigation Maps. Phase 4 left §10 as table-only placeholder; этот release closes that gap.

- **`commands/ecosystem/update.md`** Step 4 + Step 8 summary — explicit `.claude/design.yaml` preservation listing в User zone. Documentation-only (no behavior change — design.yaml already preserved by inheritance since not в Step 5 root-file allowlist), но discoverability для future readers.

- **`dev/meta-improvement/scripts/smoke-hooks.js`** — 6 new design-artifact-validate test cases (irrelevant-path / mk-valid-active / mk-missing-design-tool-active / mk-missing-field-draft-quiet / mk-bad-design-tool-enum / ds-singleton-wrong-id). Full suite 19/19 PASS.

- **`DEV_JOURNAL.md`** — DEC-DEV-0053 full entry (Context / Options / Decision / Outcome (all 12 Qs + 5 cuts + 13 ambiguities mapped к code locations) / Lessons / Связь с другими entries).

- **`ROADMAP.md`** — «Где мы сейчас» snapshot bumped к 1.4.0; Phase 6 status `✅ shipped`.

- **`CLAUDE.md`** — «Где мы сейчас» snapshot reflects Phase 6 ship.

### Не затронуто

- `agents/design/` — directory NOT created (Q2/C2: `screen-generator` subagent deferred к v1.1; D.2 inline в `design-session.md`)
- `docs/design-module/SPEC.md` — unchanged (v1.1 шипnut в DEC-DEV-0048 pre-implementation; implementation follows spec)
- `docs/pmo/artifacts/{MK,DS,NM}.md` — unchanged (schemas v1.1 shipped DEC-DEV-0048)
- `docs/pmo/pmo-map.md` — unchanged (D2-B04 status «🟡 SPEC v1.1, impl Phase 6 pending» updated к «✅» — see ROADMAP «Где мы сейчас»)
- Hook runtime для других modules (product / integrator / ecosystem hooks) — без изменений; design hook adds к manifest list но не interacts
- Backward compatibility: Design Module is conditional (activates only when FM.has_ui=true); existing pilots без UI FMs не affected. `/ecosystem:update` сохраняет `.claude/design.yaml` если уже exists.
- Runtime smoke S1-S7 (`dev/PHASE_6_SMOKE_TEST_PLAN.md`) — **deferred к next pilot session** per Phase 5 precedent (DEC-DEV-0044 separate runtime closure after implementation ship)

---

## [1.3.5] — 2026-05-27

Single-patch fix following same architectural family as 1.3.4 (DEC-DEV-0049). Surfaced during static dry-run of 1.3.4 Step 6 spec on real downstream state — `/ecosystem:update` Step 5 (subdir sync) и Step 2 (backup scope) had identical class of bug: ecosystem zone treated as 100% ecosystem-managed when reality is namespace-shared с Integrator-installed tools. Patch 1.3.5 closes both gaps in one shot. См. DEC-DEV-0051.

### Fixed

- **`commands/ecosystem/update.md` Step 5** — `rm -rf .claude/<subdir> && cp -r ...` → namespace-aware sync. Subdirs `commands/`, `skills/`, `agents/`, `hooks/` classified namespace-aware: managed namespaces (`{product, integrator, ecosystem, design}` discovered dynamically from upstream) re-derived; non-managed namespaces (third-party — e.g. `.claude/skills/kiro-*/` от cc-sdd) preserved untouched. Subdirs `docs/`, `templates/`, `adapters/`, `output-styles/` остаются flat full-sync (no third-party expected). Previously, `/ecosystem:update` уничтожал cc-sdd `kiro-*` skills (and any third-party namespace) каждый раз.
- **`commands/ecosystem/update.md` Step 2** — Backup extended: Phase 2a `.claude/` snapshot (as before) + Phase 2b integrator-managed external paths from `active-tools.yaml#tools[*].claude_primitives[].path` (outside `.claude/`). `${BACKUP_DIR}/_external/` + `MANIFEST.yaml` provide rollback orientation. Captures `.kiro/`, `.beads/`, etc. Previously, backup ограничивался `.claude/` — rollback не восстанавливал external workspace dirs.
- **`commands/ecosystem/update.md` Rollback section** — two-phase restoration matching new backup structure. Bash + PowerShell variants.

### Modified

- **`commands/ecosystem/update.md` Step 4** — Changeset preview добавляет namespace classification: per-subdir managed vs preserved namespaces + integrator-managed audit annotation (ownership labels via `active-tools.yaml`).
- **`commands/ecosystem/update.md` Step 8 summary report** — Show T-counts of third-party namespaces preserved per subdir + Phase 2b backup composition + integrator-managed third-party preservation explicit.
- **`docs/integrator-module/SPEC.md` §4.2.2** — Formal invariant: `metadata.claude_primitives[]` MUST enumerate ALL paths the tool creates/modifies during install (inside .claude/ AND outside). Schema fields documented (`type` / `path` / `purpose`). `type: other` reserved для non-canonical locations (workspace dirs, project-root file appends). Tool-profiler subagent responsibility extended. Schema example расширен с external paths (`.kiro/`, `CLAUDE.md`).
- **`DEV_JOURNAL.md`** — DEC-DEV-0051 entry (rationale, options A-D, decision, lessons, related entries).
- **`ROADMAP.md`** — «Где мы сейчас» snapshot bumped к 1.3.5.

### Не затронуто

- `commands/ecosystem/bootstrap.md` — уже использовал `cp -rn` no-clobber (line 254-258); не уничтожал existing third-party namespaces. Update теперь aligned semantically.
- Hook runtime (`hooks/*/manifest.yaml`, JS files) — без изменений.
- `.product/` artifacts — никогда не trotch'ало update'ом, никаких изменений.
- Backward compatibility: для projects без third-party namespaces поведение identical (preserved-counts = 0, `_external/` empty). Migration not required.

---

## [1.3.4] — 2026-05-27

Single-fix patch: `/ecosystem:update` Step 6 hooks REPLACE → pattern-preserving merge. Driven by downstream pilot evidence (DEC-INT-0005 в `my-first-test`, 2026-05-27) — third-party hooks injected by tools like `bd setup claude` (SessionStart/PreCompact для `bd prime`) больше не стираются при ecosystem upgrade. Restores symmetry с Bootstrap Step 6b, который merge-preserve делал с самого начала.

### Fixed

- **`commands/ecosystem/update.md` Step 6** — Re-derive ecosystem-owned hooks from manifests; preserve everything else verbatim. Pattern primary: `^node \.claude/hooks/(product|integrator|ecosystem|design)/` идентифицирует ecosystem-owned entries → re-derived; non-matching entries (third-party tool injections) → preserved verbatim. Optional audit-label via `.claude/integrator/active-tools.yaml` для diagnostics в print confirmation (не блокирует merge). Print confirmation extended «Preserved (non-ecosystem)» block. См. DEC-DEV-0049.

### Modified

- **`DEV_JOURNAL.md`** — DEC-DEV-0049 entry (rationale, options, lessons, related entries).
- **`ROADMAP.md`** — «Где мы сейчас» snapshot bumped к 1.3.4.

### Не затронуто

- `commands/ecosystem/bootstrap.md` Step 6b — уже корректно делал merge-preserve (line 441-446). Symmetry restored, not introduced.
- Hook runtime (`hooks/*/manifest.yaml`, JS files) — без изменений.
- Backward compatibility: для projects без third-party hooks поведение идентично старому REPLACE (preserved-block empty). Migration not required.

---

## [1.3.3] — 2026-05-27

Combined release: (1) Integrator scope discipline + environment tiers + pending-actions journal + research hard approve gate (DEC-DEV-0047); (2) local docs polish + Obsidian vault baseline (DEC-DEV-0046, previously [Unreleased]). Driven by pilot session 2026-05-27 evidence (4 Integrator patterns) + phantom-audience guard from Phase D wiki deferral.

### Added — patch 1.3.3 (DEC-DEV-0047)

- **`hooks/integrator/scope-guard.js`** (new) — PreToolUse hook, marker-gated (only fires when `.claude/integrator/.session-context.json` present; 1h stale TTL); detects writes / Bash commands targeting forbidden paths (`.product/`, `.kiro/`, `docs/pmo/`, `.claude/docs/pmo/`) with whitelist exceptions (`.product/{.sessions,.pending}/`, marker itself, hook's own caches, `.claude/pending-actions.md`); warn-only stderr (⚠️ INTEGRATOR SCOPE GUARD) + PA append to `.claude/pending-actions.md`; dedup by `(action, subject, minute)`. Bash matcher is regex sniffer (not AST) — Edit/Write coverage is the reliable layer.
- **`commands/ecosystem/pending-actions.md`** (new) — read-only listing of `.claude/pending-actions.md` with `--status` / `--source` / `--limit` filters. Default: `--status pending`. PA-000 sentinel excluded from output. `--help` block on unrecognized flags.
- **`skills/ecosystem/user-action-tracker.md`** (new — new directory `skills/ecosystem/`) — schema + append/mutate protocol для `.claude/pending-actions.md`. PA-NNN counter via tail-scan + sentinel. Source values canon (`integrator` / `product` / `design` / `ecosystem`). Anti-patterns enumerated.
- **`docs/integrator-module/SPEC.md` §4.2.1 Environment tiers** — semantics (`full` / `partial` / `none`); `environment_agnostic` shortcut; research + install integration; backward-compat (lazy regen, no migration).
- **`docs/integrator-module/SPEC.md` §7.6 Consilium-pattern** — declared-scope requirement (subject + priors + expected axes); STOP+ask block on subagent fan-out without declared scope; approve gate identical to single-stream.
- **`dev/PATCH_1.3.3_READINESS.md`** + **`dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md`** — D7 phase-kickoff ritual outputs (patch-level readiness pattern).
- **DEC-DEV-0047 DEV_JOURNAL entry** — kickoff stub uplifted to full Outcome+Lessons.

### Added — local docs polish (DEC-DEV-0046)

- **`dev/LOCAL_DOCS_POLISH_PLAN.md`** — active track plan (5 stages, 4-9h estimate; actual ~30-45 min)
- **`docs/README.md`** — entry-point index for docs/ subdirectories (modules + PMO catalogs + common-tasks table)
- **`.obsidian/{app,appearance,core-plugins}.json`** — vault baseline config (committed); per-machine UI state gitignored

### Modified — patch 1.3.3 (DEC-DEV-0047)

- **`docs/integrator-module/SPEC.md`** §3.1 — read-only approve discipline note; §4.1 profile schema gains `environment_tiers` block.
- **`skills/integrator/research-protocol.md`** — Phase 1 env-tier identification + consilium-pattern check; Phase 4 environment_tiers extraction guidance; Phase 5 pre-presentation guards (env_tiers completeness + consilium scope) + hard approve gate; new Phase 8 PA append for «🚧 Требует USER» actions; +4 anti-patterns (PROD-only, silent consilium fan-out, auto-chain, lost USER actions).
- **`skills/integrator/installation-protocol.md`** — Anti-pattern #5 backed by runtime scope-guard hook; Anti-pattern #8 lost USER actions; new Section 10 session-context marker boilerplate spec.
- **`skills/integrator/tool-profiling.md`** — profile schema `environment_tiers` REQUIRED (or `environment_agnostic: true`); new Step 4.5 per-tier extraction guidance; +2 anti-patterns (field-name drift for env_tiers/suitability/agnostic; skipping env_tiers).
- **`commands/integrator/research.md`** Step 7 — hard approve gate (STOP — analog `add.md` Stage 2); silence ≠ consent; defer / details / numbered options; no auto-chain to `/integrator:add`.
- **`commands/integrator/{research,add,remove,update,scan,gaps,status,map,journal}.md`** — session-marker write/cleanup boilerplate в pre-flight + final step (activates `scope-guard.js`).
- **`hooks/integrator/manifest.yaml`** — register `scope-guard` PreToolUse (matcher Bash|Write|Edit|NotebookEdit).
- **`dev/meta-improvement/scripts/smoke-hooks.js`** — extended harness (toolName/toolInput overrides, env merge, expectStderrAbsent); helper `writeIntegratorMarker` / `cleanupIntegratorMarker`; 5 new scope-guard test cases (no-marker-no-op, marker+forbidden-write, marker+whitelisted-exception, stale-marker-no-op, marker+Bash-forbidden). All 13 hook cases PASS.
- **`commands/ecosystem/bootstrap.md`** Step 6c — initialize `.claude/pending-actions.md` with PA-000 sentinel (idempotent).
- **`commands/ecosystem/update.md`** — preserve `.claude/pending-actions.md` in user zone; Step 5b backfill для pre-1.3.3 installs (bash + PowerShell variants).

### Modified — local docs polish (DEC-DEV-0046)

- **`README.md`** — «Где начать» tri-tier navigation table (first-time / install / develop / decisions / API ref / PMO map); status line fix (Phase D DEFERRED)
- **`CLAUDE.md`** — «Где мы сейчас» snapshot reflects pivot
- **`ROADMAP.md`** — Phase D moved to deferred block; local docs polish track added
- **`dev/v1_1_backlog.md`** — Phase D entry с full architectural intent + bring-forward triggers (~17-26h при возврате); + DEC-DEV-0047 deferred items (hard-block, VM-DevOps)
- **3 module SPECs** (`product/`, `integrator/`, `design/`) — «Related» cross-link block in intro
- **`docs/pmo/{pmo-map,validation}.md`** — «Читать вместе с» cross-link block
- **`docs/pmo/artifacts/README.md`** — stale «(в разработке)» refs fixed for validation.md, processes.md, handoff-spec.md, bg-extraction skill, skills/product/
- **`.gitignore`** — Obsidian per-machine state patterns

### Deferred

- **Hard-block scope-guard mode** (vs warn-only) — `dev/v1_1_backlog.md` entry. Bring-forward trigger: repeated violation после warn-only ships. Requires DEC-DEV-level review for ecosystem hook convention exception.
- **S1-S5 runtime smoke** (`dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md`) — execution at user's discretion в next pilot session. Static smoke зелёный (13/13 PASS).
- **VM-based DevOps Integrator** — surfaced in v1.1+ backlog; orthogonal to scope-guard hardening.
- **Phase D Wiki initiative full implementation** (DEC-DEV-0046, phantom-audience guard). Plan + readiness + design preserved в `dev/PHASE_D_*.md` + `dev/wiki-design.md` (DEFERRED banners). Bring-forward triggers documented в `dev/v1_1_backlog.md` (~17-26h optimistic при возврате).
- **MCP for Obsidian bridge** — confirmed unnecessary; Claude already has direct file access. Bring-forward only if Obsidian-specific dynamic data needed.
- **22 artifact files** в `docs/pmo/artifacts/*.md` — stale «(в разработке)» skill refs. Separate doc-maintenance sweep (~1h estimated).

### Rationale

**Patch 1.3.3 (DEC-DEV-0047):** Pilot session `636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` (2026-05-27 on `my-first-test/`) surfaced 4 Integrator patterns: PROD-only recommendations без local-dev breakdown; ad-hoc consilium fan-out bypassing approve gate; direct writes to `.product/` violating SPEC §1.2 / §8.1; «🚧 Требует USER» actions lost в narrative. Patch addresses 2 SPEC gaps (B-1 env_tiers, B-3 PA journal) + 2 enforcement gaps (B-2 scope-guard, B-4 hard approve gate). Hard-block deferred to v1.4.0+ (ecosystem hook convention is warn-only; override needs separate DEC-DEV).

**Local docs polish (DEC-DEV-0046):** Phase D Wiki design frozen 2026-05-26 (DEC-DEV-0044+0045 closure) под предположение 3 audiences: solo dev + end-users + stakeholders. Pre-implementation honest analysis (5 alternatives compared) revealed phantom-audience guard: pre-pilot Ecosystem 3.0 имеет только solo-dev consumer. 80% value через 4-9h Obsidian+README polish vs 32-50h full wiki. Phase D plan preserved для bring-forward when audiences materialize.

---

## [1.3.2] — 2026-05-26

Patch release: Phase 5 runtime smoke closure + Phase 5.1 patch. 3 bugs fixed end-to-end (skill+agent narrow-glob; bootstrap/update deploy gap; journal-hook Windows path regex) + bug 4 fix (local-only drift detection refactor) + C-03 generator regex cosmetic. Architectural refinement: Q1 dual-location → tri-location adapter pattern. Per [DEC-DEV-0044, 0045](DEV_JOURNAL.md).

### Fixed

- **`hooks/integrator/journal-hook.js`** — normalize Windows backslash path separators before regex testing against `INTEGRATOR_PATH_PATTERNS`. Without this, Edit/Write tool events on Windows silently bypassed classification (Phase 5 S6 step 1 FAIL root cause).
- **`skills/integrator/contract-design.md` + `agents/integrator/contract-designer.md`** — Step 4 reference adapter check: Glob-based exhaustive enumeration + slug-tolerant matching (`cc-sdd` / `ccsdd` / `cc_sdd` variants) + mandatory README.md consultation + fail-loud escalation if 0 matches. Replaces narrow single-pattern `ls` that missed `handoff-to-ccsdd.js` for (product-module, cc-sdd) pair → caused regen-from-scratch in Phase 5 initial install.
- **`commands/ecosystem/bootstrap.md` + `commands/ecosystem/update.md`** — deploy/sync `adapters/` directory to `.claude/adapters/` (was missing from `/ecosystem:update` allowlist; absence prevented contract-designer from finding reference adapter in pilot context).
- **`skills/integrator/drift-detection.md` + `commands/integrator/update.md`** Stage 3 — D2/D3 checks refactored to local-only comparison (pilot reference `.claude/adapters/` vs pilot instance `.claude/integrator/adapters/`); replaces cross-repo `git diff <source_ref> HEAD` which assumed pilot's git == ecosystem's git.
- **`adapters/handoff-to-ccsdd.js`** — C-03 generator whitelist: `SUPPORTED_HANDOFF_GENERATORS` array → `SUPPORTED_HANDOFF_GENERATOR_RE` regex (`^product-module-v1\.(0|1|2)(\.\d+)?$`); accepts patch-suffix versions (e.g., `product-module-v1.2.0`).

### Added

- **`adapters/README.md`** — refactored from dual-location → tri-location pattern table (repo canonical → pilot reference layer → pilot instance).
- **`.claude/adapters/.sync-metadata.yaml`** schema — stamped by `/ecosystem:bootstrap` + `/ecosystem:update` with `last_synced_commit` (ecosystem repo HEAD at sync time), `last_synced_at`, `last_synced_from`. Used by `contract-designer` subagent to populate adapter instance `@source_ref` audit field. Replaces broken `git rev-parse HEAD` in pilot context (which captured pilot's HEAD, not ecosystem's).
- **`dev/_archive/phase-5/PHASE_5_SMOKE_TEST_PLAN.md`** + `dev/_archive/phase-5/smoke-evidence/integrator-pre-S4/` — runtime smoke artifacts archived (plan with PASS/PARTIAL marks; broken-install snapshot for forensics).
- **DEC-DEV-0044** (Phase 5 runtime smoke + bugs 1-3 fixed + tri-location adoption) + **DEC-DEV-0045** (Phase 5.1 patch: bug 4 fix + C-03 cosmetic) DEV_JOURNAL entries.

### Modified

- **`skills/integrator/contract-design.md` + `agents/integrator/contract-designer.md` + `commands/integrator/add.md`** — paths from `adapters/<file>.js` → `.claude/adapters/<file>.js` per tri-location refinement.
- **`commands/integrator/update.md` Stage 3** — drift checks rewrite per local-only model; `@source_ref` becomes audit-only.

### Deferred

- **S5 runtime smoke** (drift detection in pilot session via `/integrator:update cc-sdd --check-only`) — code fix landed; end-to-end runtime validation остаётся at user's discretion (next time pilot session runs).

### Rationale

Phase 5 implementation (DEC-DEV-0041, 1.3.0) shipped с sub-phase J static smoke green. Runtime smoke in pilot context (2026-05-26, 3 pilot sub-sessions per audit-index) surfaced cross-platform regressions + bootstrap-deploy gaps + cross-repo assumption errors that static smoke could not catch. Q1 dual-location pattern was unrealizable as originally specified — refined to tri-location в DEC-DEV-0044. Bug 4's 3 facets needed deeper refactor (local-only drift + audit-only source_ref via sync-metadata.yaml stamping) — landed в DEC-DEV-0045 same day per user «Закончи оставленные задачи».

---

## [1.3.1] — 2026-05-26

Patch release: `/ecosystem:update` closed-list cleanup of obsolete contamination from pre-DEC-DEV-0019 bootstraps. Per [DEC-DEV-0042](DEV_JOURNAL.md).

### Modified

- **`commands/ecosystem/update.md`** — added Step 4 «Obsolete contamination detection» (closed list: `.claude/CLAUDE.md`, `.claude/DEV_JOURNAL.md`, `.claude/dev/`, `.claude/INSTALL-HUMAN.md`, `.claude/package.json`, `.claude/package-lock.json`, `.claude/eslint.config.js`, `.claude/node_modules/`) + Step 5a apply block (bash + powershell variants) + summary report row + comparison table row + anti-extension rule in «What NOT to do».

### Rationale

Phase 5 runtime smoke prep вскрыл gap: pilot `my-first-test/.claude/` содержал `INSTALL-HUMAN.md` + `dev/` от старого pre-Path-Y bootstrap-а. Rsync-with-delete в Step 5 работает только внутри 7 allowlisted subdirs — never-copy zone items в `.claude/` root оставались навсегда. Step 5a закрывает gap через закрытый список (8 paths). Backup (Step 2) сохраняет всё ДО cleanup для тривиального rollback.

### Out of scope (invariant)

`.claude/.gitignore`, `.claude/.gitattributes`, `.claude/LICENSE`, и любые non-listed files **никогда** не удаляются — могут быть проектскими. Расширение closed list требует SPEC patch + CHANGELOG entry (not runtime).

---

## [1.3.0] — 2026-05-25

Phase 5 release: **Integrator Installation + first cc-sdd reference adapter** (Phase 2 of Integrator Module). 3 new commands + 4 new/refactored skills + 2 new subagents + 1 new hook + 1 reference adapter + dual-location pattern. Ships through 10 sub-phase commits A-J. Per [DEC-DEV-0040..0041](DEV_JOURNAL.md).

**Backwards compatibility:** Phase 5 introduces `.claude/integrator/` lazy-init schema (per DEC-INT-O08) — created on first `/integrator:add` invocation only; no impact on existing pilot projects that don't add tools yet. PMO IDs in `pmo-mapping.yaml` follow post-DEC-DEV-0040 functional decomposition (D2-T01..T08, D2-B01..B05, D3-01..07, D4-01..07) — Phase 1 read-only commands were already updated in DEC-DEV-0040.

**Runtime smoke pending.** Static smoke зелёный (adapter contract-test exit 0; journal-hook 4 cases pass). Runtime smoke S1-S6 — `dev/PHASE_5_SMOKE_TEST_PLAN.md`; execution в pilot project; closure ritual Unit 2 после.

### Added — Integrator Phase 2 Installation flow (DEC-DEV-0040..0041)

**Commands** (`commands/integrator/`):
- **`add.md`** — 6-stage orchestrator (profile → propose → install → configure → contract → verify) with hard approve gate before Stage 3. Stage 1 spawns `tool-profiler` subagent; Stage 5 spawns `contract-designer` subagent. pmo-mapping per Q5: `D2-T01 + D2-T06` primary, `D2-T04` partial, `D2-B02` boundary. Stage 6 ends at fixture contract-test (Integrator-only scope per Q3 boundary). Idempotency rules + error handling matrix per stage.
- **`remove.md`** — 5-stage destructive flow (locate → impact analysis → confirmation gate → backup+uninstall → state cleanup). Impact analysis surfaces affected contracts, PMO zones (uncovered vs secondary-promoted), `.claude/` primitives with user-customization flag, orphaned handoff references (informational only — NEVER mutates `.product/`). Global tool-catalog profile preserved (`deprecated_in_projects:` list), never deleted.
- **`update.md`** — 5-stage drift-repair flow (backup → install new → drift detection → contract repair → verify) per SPEC §7.4. `--check-only` flag for preview without mutation. Per-contract repair (partial success allowed). Refuses downgrade in v1.

**Skills** (`skills/integrator/`):
- **`installation-protocol.md`** — shared methodology across add/remove/update: lazy-init (DEC-INT-O08), `integrator_owned` vs `user_customizations` heuristic, backup protocol with `--parents`, per-conflict approve gates, pmo-mapping schema with `boundary:` field for consumed-not-owned zones, rollback protocol, journal autolog contract, anti-pattern #6 (phantom PMO IDs).
- **`contract-design.md`** — methodology for designing CNT-*.yaml/.md pairs and instantiating adapter scripts. Mandatory reference-adapter check (Step 4) per dual-location pattern. Canonical CNT YAML template with B.1 frontmatter convention + anti-pattern field-name variants.
- **`drift-detection.md`** — minimum viable v1 with three checks: D1 semver range satisfaction (vanilla impl, no npm dep), D2 `CONTRACT_SCHEMA_VERSION` mismatch (installed vs repo HEAD), D3 adapter body diff against `source_ref` via `git diff` with function-name classifier. Limits explicit; full schema-aware drift → Phase 7.
- **`tool-docs-generator.md`** — methodology for generating `.claude/integrator/tool-docs/<tool>.md` per SPEC §14 (universal English, API reference, project-agnostic). Manual edit preservation via `<!-- manual: do not regenerate -->` blocks. Boundary annotation для consumed-not-owned zones.

**Subagents** (`agents/integrator/`):
- **`tool-profiler.md`** — Stage-1 isolated subagent for `/integrator:add`. Single-tool deep profile (vs `tool-researcher`'s multi-tool comparison). Returns full YAML profile + UX report block with conflict detection against `.claude/integrator/baseline.yaml`.
- **`contract-designer.md`** — Stage-5 isolated subagent for `/integrator:add`. Three-block output: CNT-NNN.yaml + CNT-NNN.md + status report. Mandatory `--verify-only` smoke pass before status=active.

**Hooks** (`hooks/integrator/`):
- **`journal-hook.js`** — PostToolUse on `Bash|Write|Edit|NotebookEdit`. Internal filter to integrator-relevant paths + Bash patterns. Dedup `SHA1(action+subject+minute)` cached in `.journal-dedup.json`. Retention: archives oldest half to `_archive/journal-<YYYY-MM>.md` when > 500 entries. Never blocks tool execution.
- **`manifest.yaml`** — registers journal-hook for auto-pickup by `/ecosystem:bootstrap`.

**Reference adapter** (`adapters/`):
- **`handoff-to-ccsdd.js`** — first reference adapter (Product handoff → cc-sdd `/kiro:spec-init`). Node stdlib only; cross-platform LF-normalized I/O. Line-based frontmatter parser (per DEC-DEV-0031 A1 lesson). 6 contract checks (C-01..C-06). `--verify-only --fixture` mode mandatory (Phase 5 scope; production routing → Orchestrator). Metadata header pattern: `@target_tool / @target_tool_version / @contract_schema_version / @source_ref / @installed_at`.
- **`README.md`** — documents dual-location pattern (DEC-DEV-0040 Q1).

**Test fixtures** (`tests/fixtures/`):
- **`FM-FIXTURE-001-handoff.md`** — minimal realistic handoff (12 sections, full frontmatter) for adapter contract-test in Stage 6.
- **`README.md`** — fixture conventions.

**Planning + closure**:
- `dev/PHASE_5_SMOKE_TEST_PLAN.md` — S1-S6 runtime scenarios (pending execution).
- `dev/PHASE_6_READINESS.md` — skeleton (conditional phase; activates on first FM with `has_ui=true`).

### Modified — pre-existing files

- `skills/integrator/tool-profiling.md` — refreshed: inline-vs-subagent invocation matrix, Step 4 PMO coverage references canonical post-DEC-DEV-0040 IDs (phantom `D2-Tech-02` explicitly forbidden), anti-pattern #6 (field name drift) + #7 (inventing PMO IDs).
- `hooks/integrator/manifest.yaml` — populated with journal-hook registration.
- `dev/PHASE_5_READINESS.md` — status banner updated to ✅ implemented (runtime smoke + closure ritual pending).
- `ROADMAP.md` — «Где мы сейчас» reflects Phase 5 completion; PILOT POINT reframed (depends on Orchestrator Module per DEC-DEV-0040 Q3).
- `DEV_JOURNAL.md` — DEC-DEV-0041 closure entry.

### Architectural decisions (codified)

- **Dual-location adapter (Q1):** repo `adapters/` ships canonical reference; `/integrator:add` copies to `.claude/integrator/adapters/` with metadata header; `/integrator:update` compares installed metadata + adapter body for drift.
- **Integrator/Orchestrator boundary (Q3):** Phase 5 scope ends at Stage 6 fixture contract-test. Production handoff → live `/kiro:spec-init` is Orchestrator runtime orchestration.
- **journal-hook scope (Q6):** every modifying integrator action; dedup + retention prevent bloat.
- **`replace.md` deferred to v1.1** per Q4.

### Lessons (DEC-DEV-0041)

- Kickoff ROI multiplier holds — стronger in Phase 5 (~6-8x). Phase 6/7 kickoff invest mandatory.
- Methodology phases cheaper than code phases. Calibration: methodology-heavy → ×1-2 multiplier; code-heavy → ×3-5.
- Dual-location pattern generalizable to hooks/agents/skills installed by external tools — Phase 7 maintenance extension candidate.
- Subagent structural template закрепился (tool-researcher → tool-profiler → contract-designer) — candidate to codify в `dev/meta-improvement/patterns/`.

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
