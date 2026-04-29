# Changelog

All notable changes to Ecosystem 3.0 are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
