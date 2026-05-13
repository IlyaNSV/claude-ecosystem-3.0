# Phase 4 Smoke Test Plan

> **Назначение:** real run smoke test plan для validation Phase 4 implementation (Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline + HYP frontmatter fix).
>
> **Why this is a separate document:** Phase 4 ships 7 new commands и 4 new skills + refactored DA agent + 1 new hook. Static verification (file structure, frontmatter parseable, references resolve, anti-pattern lists, hooks smoke) — runnable AI-session (статус ниже). Real-run scenarios (`/product:validate`, `/product:handoff`, `/product:da-review`, `/product:nfr:review` interactive flow) требуют user-driven Claude Code session с existing `.product/` data (либо `my-first-test` либо dogfood `.product/` для самой Ecosystem 3.0).
>
> **Когда выполнить:** после Phase 4.J static verification commit (этот файл создан в J) + перед Phase 4.K closure. Findings populate retroactive DEV_JOURNAL entry «DEC-DEV-NNNN — Phase 4 smoke test results».
>
> **Decomposition:** sub-phases A→H shipped через DEC-DEV-0024..0030. Этот plan covers 15 scenarios mapped к those deliverables. Static verification status — в Section A; runtime scenarios — Section B; deferred к user — Section C.

---

## A. Static verification (executed in Phase 4.J AI session)

### A.1 Hook smoke runner — ✅ PASS (8/8)

```
node dev/meta-improvement/scripts/smoke-hooks.js
```

Output (post-rebase на main с merged b8f16bc functional layer extension):
```
PASS  hooks/product/artifact-validate.js
PASS  hooks/product/bg-extractor.js
PASS  hooks/product/cascade-check.js
PASS  hooks/product/br-change-trigger.js
PASS  hooks/product/ic-change-trigger.js
PASS  hooks/product/session-state.js
PASS  hooks/product/product-handoff-gate.js [no-handoff]
PASS  hooks/product/product-handoff-gate.js [drift-on-second-artifact]

Total: 8 hook(s) tested; 0 failure(s).
```

Exit code: `0`. Phase 4.F `product-handoff-gate.js` запущен в двух кейсах: базовый `no-handoff` (PostToolUse non-blocking exit clean) + `drift-on-second-artifact` (functional layer от b8f16bc DEC-DEV-0031 — multi-entry artifact_hashes block с wrong SC-005 stored hash → assert stderr содержит «Handoff drift detected»). 8/8 PASS подтверждает что Phase 4.H rebase preserved Phase 4.F integrity. Phase 3 baseline (6 hooks) extended к 7 в Phase 4.F + functional cases в Phase 4 review fix-up. Соответствует quality gate per DEC-DEV-0023 F6/R3 + DEC-DEV-0031 lesson 1 («smoke `no crash` ≠ correct behavior»).

### A.2 File structure — ✅ PASS

Все Phase 4 deliverables present в expected locations:

**Commands (`commands/product/`):**
- `validate.md` (Phase 4.C)
- `nfr-review.md` (Phase 4.D)
- `nfr-upgrade-tier.md` (Phase 4.D)
- `handoff.md` (Phase 4.E)
- `cleanup.md` (Phase 4.G — new)
- `da-review.md` (Phase 4.H — new)

**Skills (`skills/product/`):**
- `validation-runner.md` (Phase 4.C)
- `nfr-review.md` (Phase 4.D)
- `handoff-generator.md` (Phase 4.E)
- `cleanup-detector.md` (Phase 4.G — new)
- `product-da-review.md` (Phase 4.H — new)
- `hypothesis-formulation.md` (Phase 4.A — drift fix)

**Hooks (`hooks/product/`):**
- `lib/hash.js` (Phase 4.E — shared utility)
- `product-handoff-gate.js` (Phase 4.F)

**Agents:**
- `agents/product/devils-advocate.md` (Phase 4.H — refactored с release sub-mode)

**Templates:**
- `templates/project/CLAUDE.md.template` (Phase 4.B — Language section added)

### A.3 Frontmatter compliance — ✅ PASS

Все new Phase 4 files have valid frontmatter (B.1 convention):
- `skills/product/cleanup-detector.md` — `description:` present
- `skills/product/product-da-review.md` — `description:` present
- `commands/product/cleanup.md` — `description:`, `argument-hint:`, `allowed-tools:` present
- `commands/product/da-review.md` — `description:`, `argument-hint:`, `allowed-tools:` present

### A.4 Canonical schema fields verification — ✅ PASS (DEC-DEV-0030 A.1)

`agents/product/devils-advocate.md` canonical frontmatter schema section (lines 321-329):
```
id: <unique short id — e.g., F1, F2, R1 для release>
severity: critical | important | discussion
artifact_ref: FM-001 | BR-010 | RL-001
source: hook-driven | manual | auto-pre-handoff
scope: artifact | feature | release
affected_artifacts: [FM-001, FM-002]
suggested_drill_down: /product:da-review FM-001
resolution: pending | acted | deferred | dismissed
follow_up:
```

Все 9 canonical fields per DEC-DEV-0030 A.1 contract present.

### A.5 Anti-pattern list verification — ✅ PASS (B.1 convention)

`agents/product/devils-advocate.md` lines 336-341 — 6 forbidden field-name variants explicit:
```
- `findings_severity` → use `severity`
- `referenced_artifact` → use `artifact_ref`
- `invocation_source` → use `source`
- `review_scope` → use `scope`
- `cross_refs` → use `affected_artifacts`
- `drill_down_hint` → use `suggested_drill_down`
```

Соответствует pattern из `problem-discovery.md` Step 3 (DEC-DEV-0011 lesson) + `note-promote.md` Step 3.

### A.6 `--scope` flag collision removed — ✅ PASS (Ambiguity 22)

```
grep -rn "da-review.*--scope" agents/ commands/ skills/ docs/
# → no matches
```

`docs/product-module/SPEC.md:217` и `docs/pmo/processes.md:779` — оба обновлены к ID-prefix routing (FM-NNN / RL-NNN).

### A.7 Cross-references resolve — ✅ PASS

New Phase 4.G/H files referenced from existing skills/commands/docs:
- `skills/product/handoff-generator.md` ссылается на `skills/product/product-da-review.md` (Step 4 wiring)
- `commands/product/handoff.md` ссылается на `/product:da-review FM-<NNN>` (--with-da-review)
- `docs/product-module/SPEC.md` § 3.2 ссылается на новые signatures
- `docs/pmo/processes.md` §6.2 + §8 ссылается на RL-NNN routing

### A.8 SlashCommand tool added к handoff.md allowed-tools — ✅ PASS

`commands/product/handoff.md` line 4:
```
allowed-tools: Read, Glob, Grep, Edit, Write, SlashCommand, Bash(node:*), Bash(mkdir:*), Bash(date:*)
```

`SlashCommand` enables real `/product:da-review` invocation в `--with-da-review` flow (Phase 4.H wiring).

---

## B. Runtime scenarios (require user-driven Claude Code session)

15 scenarios mapped к Phase 4 sub-phases. Test env: project с bootstrapped `.product/` (Phase 2+ data — Discovery / Planning / Feature enrichment artifacts).

### Prerequisites

1. **Re-bootstrap target project** to pick up Phase 4 changes:
   ```bash
   cd <target-project>
   claude
   > /ecosystem:update
   ```
   `/ecosystem:update` (per DEC-DEV-0020) — preferred over re-bootstrap для existing projects; preserves `.product/` + `product.yaml`.

2. **Verify hooks registered (8 hooks expected after Phase 4):**
   ```bash
   cat .claude/settings.json | grep -B 1 hooks
   ```
   Expected: 6 Phase 3 hooks + 1 Phase 4 (`product-handoff-gate.js`).

   *Note: Phase 4 hooks count = 7 same as smoke runner TEST_CASES — `lib/hash.js` shared module loaded by gate hook, не registered как separate hook.*

3. **Sample `.product/` content needed:**
   - ≥1 FM в `in-progress` или `shipped` (для handoff smoke S5/S6/S10)
   - ≥1 RL с `RL.features[]` containing ≥2 FM (для release-scope DA S9)
   - ≥1 HYP с canonical frontmatter (Phase 4.A fix S1)
   - Some BR/IC/SC drafts для validation runner S3
   - Optional: `validation-pending.yaml`, `cascade-pending.yaml`, `da-pending.yaml` non-empty (для cleanup S11/S12)

### S1 — HYP frontmatter canonical (Phase 4.A / DEC-DEV-0024)

**Goal:** validate HYP creation uses canonical fields (no `success_threshold` drift).

```
> /product:init  # или existing HYP file open
```

При создании HYP через `discovery-session.md`:

**Verify:**
- HYP frontmatter содержит canonical fields: `target_value`, `segment`, `value_proposition`
- НЕ содержит `success_threshold` (anti-pattern explicit в `hypothesis-formulation.md`)
- ASCII slug filename: `HYP-NNN-<slug>.md` (no Cyrillic)

**Acceptance:**
- [ ] Canonical field names used exactly
- [ ] Anti-pattern `success_threshold` rejected if AI tries to use it
- [ ] B.1 convention compliance — explicit template + warnings visible

### S2 — Language discipline (Phase 4.B / DEC-DEV-0029)

**Goal:** validate user-facing dialogue в Russian (без переводов идентификаторов / paths / commands).

```
> /product:plan
> /product:feature FM-001
> /product:da-review FM-001
```

User interaction в каждом workflow.

**Verify:**
- AI говорит по-русски в conversation messages
- НЕ переводит: `FM-001`, `BR-022`, `/product:handoff`, `--mode draft`, hook names, NFR/DA/JTBD/PMO acronyms, frontmatter field names
- Inline reminder visible в первых строках skill output (planning-session, feature-session, scenario-authoring, business-rule-extraction, release-planning)

**Acceptance:**
- [ ] Russian default для дискуссии
- [ ] Identifiers / paths / commands НЕ склоняются и НЕ переводятся
- [ ] Spec quotes (English) сохранены verbatim где applicable

### S3 — Full validation (Phase 4.C / DEC-DEV-0025 C.4)

**Goal:** validate `/product:validate --deep` runs V-01..V-16 + V-H-01..V-H-10; skips V-MK-* с graceful note; reports correctly.

```
> /product:validate --deep
```

**Verify:**
- `.product/.reports/validate-<YYYYMMDD-HHMM>.{json,md}` written
- Markdown report surfaced inline
- All V-* rules listed; V-H-* applicable если handoffs exist; V-MK-* skipped без false positives
- V-11 auto-fix counted если applicable
- Stale pending purge attempted (per DEC-DEV-0023 F5 pattern)

**Acceptance:**
- [ ] Report files created
- [ ] No V-MK-* false-positive findings (Phase 6 conditional)
- [ ] V-16 (NFR severity matrix) evaluates correctly per `nfr_status × tier × high_risk`
- [ ] Auto-purge cleared stale entries
- [ ] `--rule V-11`, `--scope FM-*`, `--tier blocking` filters work

### S4 — NFR review F.5a Ask/Define (Phase 4.D / DEC-DEV-0028 D.2)

**Goal:** validate F.5a.0 Ask + F.5a.1 Define both ship; sanity ranges informational warning (per DEC-DEV-0025 C.2); tier auto-detection from RM.

```
> /product:nfr-review FM-001
```

**Verify:**
- F.5a.0 Ask prompt: «Есть ли у FM-001 measurable non-functional requirements? [Y/N]»
- If [Y] → F.5a.1 Define: prompt per NFR category (latency, availability, throughput, etc.)
- Tier auto-detected from `RM.current_phase` (no manual entry)
- Override triggers informational warning + log `sanity_check: overridden` в NFR frontmatter
- NFR file created в `.product/nfr/NFR-<NNN>-<slug>.md` с canonical frontmatter
- FM.frontmatter.nfr_status flipped к active

**Acceptance:**
- [ ] Both Ask + Define phases work
- [ ] Override NOT blocking (informational only)
- [ ] FM nfr_status updated correctly

### S5 — Handoff mode draft (Phase 4.E / DEC-DEV-0028 D.1)

**Goal:** validate `--mode draft` produces handoff с 3 blockers (B1/B2/B5); status: partial; warnings для missed B3-B4/B6-B8.

```
> /product:handoff FM-001 --mode draft
```

**Verify:**
- `.product/handoffs/FM-001-handoff.md` written
- Frontmatter `mode: draft`, `status: partial`
- Body имеет «⚠ Draft Mode Warnings» section перед §1
- 13 sections present per handoff-spec.md §6
- `artifact_hashes` populated с `sha256:<hex64>` (no truncation)

**Acceptance:**
- [ ] File exists + status: partial
- [ ] Mode: draft не auto-upgrades к ready
- [ ] Warnings explicit

### S6 — Handoff mode production (Phase 4.E)

**Goal:** validate `--mode production` (default) — 8 blockers; refuses если any blocker fails; status: blocked → no file write.

```
> /product:handoff FM-001 --mode production
```

**Verify:**
- If 8 blockers passed → status: ready; file written; success summary
- If any blocker fails → status: blocked; no file written; surface blockers + suggested fixes; NOT auto-downgrade к draft (per Ambiguity 13)
- DoR overrides (approve_overrides[] in FM frontmatter) applied if present
- Warnings (W1-W6) appended к frontmatter если any

**Acceptance:**
- [ ] Production refuses bad inputs (no silent partial)
- [ ] approve_overrides[] honored с rationale check

### S7 — Cross-platform hash invariant (Phase 4.E + 4.F)

**Goal:** validate hash computation cross-platform — same body content → same hash on Windows (CRLF working copy) + Unix (LF working copy).

**Setup:** generate handoff на Windows; transfer к Unix (or vice versa); re-compute hashes.

```bash
node -e "const h=require('.claude/hooks/product/lib/hash.js'); console.log(h.computeArtifactHash('.product/features/FM-001-revisions-inbox.md'));"
```

**Verify:**
- Same hash output regardless of platform line endings (LF normalization)
- Hash format: `sha256:<hex64>` (full 64-char digest)
- Body markdown без frontmatter (per DEC-DEV-0025 C.1 + DEC-DEV-0030 user choice 2026-05-12)

**Acceptance:**
- [ ] Cross-platform invariance
- [ ] Frontmatter mechanical updates (version, updated) НЕ change hash

### S8 — DA review FM-NNN (Phase 4.H / DEC-DEV-0026)

**Goal:** validate `/product:da-review FM-001` spawns subagent в `Mode: full + scope: feature`; findings written к canonical `.product/.da-findings/FM-001-<timestamp>.md`.

```
> /product:da-review FM-001
```

**Verify:**
- Subagent invoked с FM-level brief (см. `product-da-review.md` Step 3 Branch A)
- Findings file created с canonical frontmatter:
  - `id, severity, artifact_ref, source: manual, scope: feature, resolution: pending`
  - NO drift fields (`confidence_rationale`, etc.)
- 3-tier output (🔴 / 🟡 / 🔵) в body
- Per-finding interactive resolution [Act/Defer/Dismiss/Skip]
- Decision journal entry с embedded выжимкой (`id, severity, artifact_ref, statement, resolution, follow_up.revisit_trigger`)

**Acceptance:**
- [ ] Subagent isolated context preserved
- [ ] Findings file schema canonical
- [ ] Per-finding flow functional

### S9 — DA review RL-NNN (Phase 4.H release scope)

**Goal:** validate `/product:da-review RL-001` spawns subagent в `Mode: full + scope: release`; 6 release-level lenses applied; cross-FM findings include `affected_artifacts[]` + `suggested_drill_down`.

```
> /product:da-review RL-001
```

**Verify:**
- Subagent brief includes RL-level context (FM bodies, decision journal range, prior FM-level findings)
- 6 release lenses applied: Cross-FM consistency, HYP coverage, Rollout deps, Bundle readiness, Scope creep, Steelmanning
- Cross-FM findings include `affected_artifacts: [FM-001, FM-002]` + `suggested_drill_down: /product:da-review FM-NNN`
- Text parsing confidence flag в findings if FM body §12 informal (per Ambiguity 2)
- Drill-down recommendations surfaced к user — NOT auto-fired (aspirational v1.1)

**Acceptance:**
- [ ] Release scope brief includes all FMs
- [ ] Cross-FM findings structurally correct
- [ ] Drill-down hints surfaced

### S10 — Handoff `--with-da-review` (Phase 4.H wiring)

**Goal:** validate `/product:handoff FM-001 --with-da-review` invokes DA pre-generation; critical pending findings block handoff.

**Setup:** scenario producing 🔴 Critical finding (e.g., known BR-IC conflict).

```
> /product:handoff FM-001 --with-da-review
```

**Verify:**
- SlashCommand `/product:da-review FM-001` invoked first
- DA findings written с `source: auto-pre-handoff`
- If 🔴 Critical AND `resolution: pending` → handoff refuses continue, surfaces blockers + recommended fix
- If 0 critical pending → handoff proceeds; warnings appended к handoff frontmatter
- Handoff frontmatter `da_review_reference: FM-001-<timestamp>.md` set если DA successful

**Acceptance:**
- [ ] Real SlashCommand invocation (не placeholder)
- [ ] Critical gate non-bypassable
- [ ] DA reference preserved в handoff frontmatter

### S11 — Cleanup orphan detection (Phase 4.G / DEC-DEV-0027)

**Goal:** validate `/product:cleanup` (default mode) — V-15 orphan detection only; fast graph analysis.

```
> /product:cleanup --dry-run
> /product:cleanup
```

**Verify:**
- `--dry-run` previews orphans + suggested actions (archive / re-link / delete) без apply
- Default mode prompts per orphan: `[Y/N/Re-link/Delete/Skip]`
- Design module conditional: если `commands/design/` not present → skip MK/DS/NM checks silently
- NOTE artifacts skipped (per V-15 root artifact rule)
- Decision journal entry created post-resolution

**Acceptance:**
- [ ] No MK/DS/NM false positives без Design module
- [ ] Per-orphan prompts work
- [ ] `--dry-run` apply nothing

### S12 — Cleanup `--pending-hygiene` (Phase 4.G)

**Goal:** validate `--pending-hygiene` (alias `--full`) — 3-pending-file sweep + orphan detection.

```
> /product:cleanup --pending-hygiene --dry-run
> /product:cleanup --pending-hygiene
```

**Verify:**
- Cascade pending: delegates `/product:cascade --pending --revalidate` (existing command)
- Validation pending: re-evaluates per entry; purges currently-passing
- DA pending: flag stale entries (artifact.status == active); NOT auto-delete
- `--dry-run` shows hygiene actions preview («would invoke», «would purge N», «would flag M»)

**Acceptance:**
- [ ] Cascade revalidate delegated correctly
- [ ] Validation purge re-uses F5 pattern (DEC-DEV-0023)
- [ ] DA pending flag-only (no destruction)

### S13 — NFR tier upgrade (Phase 4.D)

**Goal:** validate `/product:nfr:upgrade-tier` — batch re-review при tier upgrade (MVP → MMP).

**Setup:** `.claude/product.yaml.product_tier: mvp` с existing NFR-active FMs.

```
> /product:nfr-upgrade-tier mmp
```

**Verify:**
- Bumps `product.yaml.product_tier: mmp`
- All FMs со `nfr_status: declined` or `pending` queued для batch re-review
- Per FM: surface decision per V-16 severity matrix new tier
- User per-FM action [Re-review / Keep / Defer]

**Acceptance:**
- [ ] Batch enumeration works
- [ ] Per-FM action surfaced
- [ ] Tier persisted к product.yaml

### S14 — `verify-hooks.js` smoke runner — ✅ PASS (executed in A.1)

```
node dev/meta-improvement/scripts/verify-hooks.js
```

Output: `Total: 8 hook(s) tested; 0 failure(s).` Exit code 0.

Phase 4.F `product-handoff-gate.js` smoke entry confirmed working в двух functional cases (no-handoff + drift-on-second-artifact от b8f16bc/DEC-DEV-0031 review fix-up). Phase 3 baseline preserved.

### S15 — Phase 4 closure ritual (Phase 4.K)

**Goal:** validate D7 phase-closure ritual completes successfully.

Steps per `dev/meta-improvement/checklists/phase-closure.md`:

1. **Final smoke run** — verify-hooks: ✅ PASS (S14)
2. **DEV_JOURNAL closure entry** — DEC-DEV-NNNN summarizes Phase 4 outcomes
3. **CHANGELOG entry** — [1.2.0] release-worthy
4. **Archive `dev/PHASE_4_*`** — `git mv` к `dev/_archive/phase-4/`
5. **Phase 5 readiness skeleton** — `dev/PHASE_5_READINESS.md` created
6. **Memory sync** — `project_ecosystem_status.md` updated
7. **ROADMAP update** — «Где мы сейчас» Phase 4 ✅ / Phase 5 next

**Acceptance:**
- [ ] All closure ritual items checked
- [ ] No working-tree leftover artifacts

---

## C. Deferred to user execution

Scenarios S1-S13 require interactive Claude Code session с existing `.product/` data. AI implementation session (which produced Phase 4 code) cannot directly:
- Invoke slash commands (`/product:plan`, `/product:feature`, `/product:nfr-review` etc.) — these require Claude Code runtime
- Test cross-platform hash (Windows ↔ Unix transfer)
- Verify interactive prompts (per-orphan, per-finding [Y/N/...])

**User action recommended:**
1. Execute S1-S13 on `my-first-test` или dogfood `.product/` для Ecosystem 3.0
2. Document findings (specific evidence: «S5 produced handoff с status: blocked due to V-H-08 — expected behavior; B7 has_ui=true без active MK») в DEV_JOURNAL DEC-DEV-NNNN closure entry
3. If any S* surfaces regression — fix inline (если в Phase 4 scope) или defer к v1.1 + document в `dev/v1_1_backlog.md`

**Static verification (Section A) — passed; runtime verification (Section B) — pending user execution.**

---

## D. Reporting findings

After real-run completion, populate retroactive DEV_JOURNAL entry per Phase 4.K (closure):

```markdown
## DEC-DEV-NNNN — Phase 4 smoke test results

Date: <ISO>
Trigger: Per Phase 4.J plan (dev/PHASE_4_SMOKE_TEST_PLAN.md)
Tag: #pilot-finding #validation #phase-4-closure

### Context
[Per Phase 4.J static verification + user runtime execution]

### Outcome
- A.1-A.8 static checks: ✅ PASS (Phase 4.J AI session)
- S1 (HYP frontmatter): <pass | partial | fail>
- S2 (Language discipline): <pass | partial | fail>
- S3 (Full validation): <pass | partial | fail>
- ...
- S14 (verify-hooks): ✅ PASS (Phase 4.J)
- S15 (Closure ritual): <pass | partial | fail>

### Findings
1. [Specific finding с evidence]
2. ...

### Lessons
- [Generalized takeaway для Phase 5 readiness или v1.1 backlog]
- ...

### Next
- [Phase 5 readiness updates / v1.1 backlog entries / fixes для post-pilot]
```

---

## E. Done criteria

Smoke test passes when:
- [x] All static checks (Section A) — ✅ PASS (8/8)
- [ ] User executes runtime scenarios (Section B S1-S13 + S15)
- [ ] ≥10 of 15 runtime scenarios PASS
- [ ] No B.1 frontmatter convention violations
- [ ] No --scope flag resurrection
- [ ] Findings → Phase 5 readiness checklist или v1.1 backlog

If ≥10 scenarios pass — Phase 4 ships. Findings → Phase 5 readiness + retroactive DEV_JOURNAL.
