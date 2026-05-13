# План smoke-тестирования Phase 4

> **Назначение:** real-run smoke test plan для валидации имплементации Phase 4 (Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline + HYP frontmatter fix).
>
> **Почему отдельный документ:** Phase 4 поставляет 6 новых commands и 6 новых/refactored skills + refactored DA agent + 1 новый hook. Static verification (file structure, frontmatter parseable, references resolve, anti-pattern lists, hooks smoke) — runnable AI-session (статус ниже). Real-run scenarios (`/product:validate`, `/product:handoff`, `/product:da-review`, `/product:nfr-review` interactive flow) требуют user-driven Claude Code session с existing `.product/` data (либо `my-first-test` либо dogfood `.product/` для самой Ecosystem 3.0).
>
> **Когда выполнить:** после Phase 4.J static verification commit (этот файл создан в J) + перед Phase 4.K closure. Findings populate retroactive DEV_JOURNAL entry «DEC-DEV-NNNN — Phase 4 smoke test results».
>
> **Decomposition:** sub-phases A→H shipped через DEC-DEV-0024..0030. Этот plan покрывает 15 scenarios mapped к those deliverables. Static verification status — в Section A; runtime scenarios — Section B; deferred к user — Section C.
>
> **Статус 2026-05-13 (post-DEC-DEV-0033):** Section A — ✅ 8/8 PASS. S14 (verify-hooks) + S15 (closure ritual) — ✅ PASS (executed в DEC-DEV-0032 J + DEC-DEV-0033 closure run). S1-S13 — ⏳ pending user-driven session.

---

## A. Статическая верификация (выполнена в Phase 4.J AI-сессии)

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

Exit code: `0`. Phase 4.F `product-handoff-gate.js` запущен в двух кейсах: базовый `no-handoff` (PostToolUse non-blocking exit clean) + `drift-on-second-artifact` (functional layer от b8f16bc DEC-DEV-0031 — multi-entry `artifact_hashes` block с заведомо неверным stored hash для SC-005 → assert stderr содержит «Handoff drift detected»). 8/8 PASS подтверждает что Phase 4.H rebase preserved Phase 4.F integrity. Phase 3 baseline (6 hooks) extended к 7 в Phase 4.F + functional cases в Phase 4 review fix-up. Соответствует quality gate per DEC-DEV-0023 F6/R3 + DEC-DEV-0031 lesson 1 («smoke `no crash` ≠ correct behavior»). Повторный запуск в DEC-DEV-0033 closure (Step 3) подтвердил статус.

### A.2 File structure — ✅ PASS

Все Phase 4 deliverables present в expected locations:

**Commands (`commands/product/`):**
- `validate.md` (Phase 4.C)
- `nfr-review.md` (Phase 4.D)
- `nfr-upgrade-tier.md` (Phase 4.D)
- `handoff.md` (Phase 4.E)
- `cleanup.md` (Phase 4.G — новый)
- `da-review.md` (Phase 4.H — новый)

**Skills (`skills/product/`):**
- `validation-runner.md` (Phase 4.C)
- `nfr-review.md` (Phase 4.D)
- `handoff-generator.md` (Phase 4.E)
- `cleanup-detector.md` (Phase 4.G — новый)
- `product-da-review.md` (Phase 4.H — новый)
- `hypothesis-formulation.md` (Phase 4.A — drift fix)

**Hooks (`hooks/product/`):**
- `lib/hash.js` (Phase 4.E — shared utility)
- `product-handoff-gate.js` (Phase 4.F)

**Agents:**
- `agents/product/devils-advocate.md` (Phase 4.H — refactored с release sub-mode)

**Templates:**
- `templates/project/CLAUDE.md.template` (Phase 4.B — добавлена секция Language)

### A.3 Frontmatter compliance — ✅ PASS

Все новые Phase 4 файлы имеют valid frontmatter (B.1 convention):
- `skills/product/cleanup-detector.md` — `description:` present
- `skills/product/product-da-review.md` — `description:` present
- `commands/product/cleanup.md` — `description:`, `argument-hint:`, `allowed-tools:` present
- `commands/product/da-review.md` — `description:`, `argument-hint:`, `allowed-tools:` present

### A.4 Canonical schema fields verification — ✅ PASS (DEC-DEV-0030 A.1)

`agents/product/devils-advocate.md` canonical frontmatter schema section (lines 321-329):
```
id: <unique short id — например, F1, F2, R1 для release>
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

`agents/product/devils-advocate.md` строки 336-341 — 6 forbidden field-name variants explicit:
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

Новые Phase 4.G/H файлы referenced из existing skills/commands/docs:
- `skills/product/handoff-generator.md` ссылается на `skills/product/product-da-review.md` (Step 4 wiring)
- `commands/product/handoff.md` ссылается на `/product:da-review FM-<NNN>` (`--with-da-review`)
- `docs/product-module/SPEC.md` §3.2 ссылается на новые signatures
- `docs/pmo/processes.md` §6.2 + §8 ссылается на RL-NNN routing

### A.8 SlashCommand tool добавлен к handoff.md allowed-tools — ✅ PASS

`commands/product/handoff.md` строка 4:
```
allowed-tools: Read, Glob, Grep, Edit, Write, SlashCommand, Bash(node:*), Bash(mkdir:*), Bash(date:*)
```

`SlashCommand` enables real `/product:da-review` invocation в `--with-da-review` flow (Phase 4.H wiring).

---

## B. Runtime scenarios (require user-driven Claude Code session)

15 scenarios, mapped к Phase 4 sub-phases. Тестовая среда: project с bootstrapped `.product/` (Phase 2+ data — Discovery / Planning / Feature enrichment artifacts).

### Prerequisites

1. **Re-bootstrap target project** для подхвата Phase 4 changes:
   ```bash
   cd <target-project>
   claude
   > /ecosystem:update
   ```
   `/ecosystem:update` (per DEC-DEV-0020) — preferred над re-bootstrap для existing projects; preserves `.product/` + `product.yaml`.

2. **Verify hooks registered (7 hooks expected после Phase 4):**
   ```bash
   cat .claude/hooks/product/manifest.yaml | grep -c "^  - id:"
   ```
   Expected: 7 entries (6 Phase 3 hooks + 1 Phase 4 `product-handoff-gate.js`).

   *Note: hooks count в `hooks/product/` = 7 .js файлов; `lib/hash.js` — shared module loaded by gate hook, не registered как separate hook.*

3. **Sample `.product/` content needed:**
   - ≥1 FM в `in-progress` или `shipped` (для handoff smoke S5/S6/S10)
   - ≥1 RL с `RL.features[]` containing ≥2 FM (для release-scope DA S9)
   - ≥1 HYP с canonical frontmatter (Phase 4.A fix S1)
   - Несколько BR/IC/SC drafts для validation runner S3
   - Optional: `validation-pending.yaml`, `cascade-pending.yaml`, `da-pending.yaml` non-empty (для cleanup S11/S12)

### S1 — HYP frontmatter canonical (Phase 4.A / DEC-DEV-0024)

**Цель:** validate, что HYP creation использует canonical fields (без `success_threshold` drift).

```
> /product:init  # или открыть существующий HYP файл
```

При создании HYP через `discovery-session.md`:

**Verify:**
- HYP frontmatter содержит canonical fields: `target_value`, `segment`, `value_proposition`
- НЕ содержит `success_threshold` (anti-pattern explicit в `hypothesis-formulation.md`)
- ASCII slug в filename: `HYP-NNN-<slug>.md` (без кириллицы)

**Acceptance:**
- [ ] Canonical field names использованы точно
- [ ] Anti-pattern `success_threshold` отвергнут, если AI пытается его использовать
- [ ] B.1 convention compliance — explicit template + warnings visible

### S2 — Language discipline (Phase 4.B / DEC-DEV-0029)

**Цель:** validate, что user-facing dialogue идёт на русском (без переводов идентификаторов / paths / commands).

```
> /product:plan
> /product:feature FM-001
> /product:da-review FM-001
```

User interaction в каждом workflow.

**Verify:**
- AI говорит по-русски в conversation messages
- НЕ переводит: `FM-001`, `BR-022`, `/product:handoff`, `--mode draft`, имена hooks, аббревиатуры NFR/DA/JTBD/PMO, frontmatter field names
- Inline reminder visible в первых строках skill output (planning-session, feature-session, scenario-authoring, business-rule-extraction, release-planning)

**Acceptance:**
- [ ] Russian default для диалога
- [ ] Identifiers / paths / commands НЕ склоняются и НЕ переводятся
- [ ] Spec quotes (English) сохранены verbatim где applicable

### S3 — Full validation (Phase 4.C / DEC-DEV-0025 C.4)

**Цель:** validate, что `/product:validate --deep` запускает V-01..V-16 + V-H-01..V-H-11; skip'ает V-MK-* с graceful note; reports correctly.

```
> /product:validate --deep
```

**Verify:**
- `.product/.reports/validate-<YYYYMMDD-HHMM>.{json,md}` written
- Markdown report surfaced inline
- Все V-* rules listed; V-H-* applicable если handoffs exist; V-MK-* skipped без false positives
- V-11 auto-fix counted если applicable
- Stale pending purge attempted (per DEC-DEV-0023 F5 pattern)

**Acceptance:**
- [ ] Report files создаются
- [ ] Нет V-MK-* false-positive findings (Phase 6 conditional)
- [ ] V-16 (NFR severity matrix) evaluates correctly per `nfr_status × tier × high_risk`
- [ ] Auto-purge cleared stale entries
- [ ] Фильтры `--rule V-11`, `--scope FM-*`, `--tier blocking` работают

### S4 — NFR review F.5a Ask/Define (Phase 4.D / DEC-DEV-0028 D.2)

**Цель:** validate, что F.5a.0 Ask + F.5a.1 Define обе фазы shipped; sanity ranges informational warning (per DEC-DEV-0025 C.2); tier auto-detection from RM.

```
> /product:nfr-review FM-001
```

**Verify:**
- F.5a.0 Ask prompt: «Есть ли у FM-001 measurable non-functional requirements? [Y/N]»
- Если [Y] → F.5a.1 Define: prompt per NFR category (latency, availability, throughput и т.д.)
- Tier auto-detected из `RM.current_phase` (без manual entry)
- Override триггерит informational warning + log `sanity_check: overridden` в NFR frontmatter
- NFR файл создан в `.product/nfr/NFR-<NNN>-<slug>.md` с canonical frontmatter
- FM.frontmatter.nfr_status flipped к `active`

**Acceptance:**
- [ ] Обе фазы Ask + Define работают
- [ ] Override НЕ blocking (informational only)
- [ ] FM nfr_status updated корректно

### S5 — Handoff mode draft (Phase 4.E / DEC-DEV-0028 D.1)

**Цель:** validate, что `--mode draft` производит handoff с 3 blockers (B1/B2/B5); status: partial; warnings для пропущенных B3-B4/B6-B8.

```
> /product:handoff FM-001 --mode draft
```

**Verify:**
- `.product/handoffs/FM-001-handoff.md` written
- Frontmatter `mode: draft`, `status: partial`
- Body имеет секцию «⚠ Draft Mode Warnings» перед §1
- 13 sections present per `handoff-spec.md` §6
- `artifact_hashes` populated с `sha256:<hex64>` (без truncation)

**Acceptance:**
- [ ] Файл существует + status: partial
- [ ] Mode: draft не auto-upgrades к ready
- [ ] Warnings explicit

### S6 — Handoff mode production (Phase 4.E)

**Цель:** validate, что `--mode production` (default) — 8 blockers; refuses если any blocker fails; status: blocked → файл не пишется.

```
> /product:handoff FM-001 --mode production
```

**Verify:**
- Если 8 blockers passed → status: ready; файл написан; success summary
- Если any blocker fails → status: blocked; файл не написан; surface blockers + suggested fixes; НЕ auto-downgrade к draft (per Ambiguity 13)
- DoR overrides (`approve_overrides[]` в FM frontmatter) applied если present
- Warnings (W1-W6) appended к frontmatter если any

**Acceptance:**
- [ ] Production refuses bad inputs (нет silent partial)
- [ ] `approve_overrides[]` honored с rationale check

### S7 — Cross-platform hash invariant (Phase 4.E + 4.F)

**Цель:** validate, что hash computation cross-platform — same body content → same hash на Windows (CRLF working copy) + Unix (LF working copy).

**Setup:** сгенерировать handoff на Windows; transfer к Unix (or vice versa); re-compute hashes.

```bash
node -e "const h=require('.claude/hooks/product/lib/hash.js'); console.log(h.computeArtifactHash('.product/features/FM-001-revisions-inbox.md'));"
```

**Verify:**
- Same hash output независимо от platform line endings (LF normalization)
- Hash format: `sha256:<hex64>` (full 64-char digest)
- Body markdown без frontmatter (per DEC-DEV-0025 C.1 + DEC-DEV-0030 user choice 2026-05-12)

**Acceptance:**
- [ ] Cross-platform invariance
- [ ] Frontmatter mechanical updates (version, updated) НЕ меняют hash

### S8 — DA review FM-NNN (Phase 4.H / DEC-DEV-0026)

**Цель:** validate, что `/product:da-review FM-001` спавнит subagent в `Mode: full + scope: feature`; findings записаны к canonical `.product/.da-findings/FM-001-<timestamp>.md`.

```
> /product:da-review FM-001
```

**Verify:**
- Subagent invoked с FM-level brief (см. `product-da-review.md` Step 3 Branch A)
- Findings file создан с canonical frontmatter:
  - `id, severity, artifact_ref, source: manual, scope: feature, resolution: pending`
  - НЕТ drift fields (`confidence_rationale` и т.п.)
- 3-tier output (🔴 / 🟡 / 🔵) в body
- Per-finding interactive resolution [Act/Defer/Dismiss/Skip]
- Decision journal entry с embedded выжимкой (`id, severity, artifact_ref, statement, resolution, follow_up.revisit_trigger`)

**Acceptance:**
- [ ] Subagent isolated context preserved
- [ ] Findings file schema canonical
- [ ] Per-finding flow функционален

### S9 — DA review RL-NNN (Phase 4.H release scope)

**Цель:** validate, что `/product:da-review RL-001` спавнит subagent в `Mode: full + scope: release`; применяются 6 release-level lenses; cross-FM findings include `affected_artifacts[]` + `suggested_drill_down`.

```
> /product:da-review RL-001
```

**Verify:**
- Subagent brief включает RL-level context (FM bodies, decision journal range, prior FM-level findings)
- 6 release lenses applied: Cross-FM consistency, HYP coverage, Rollout deps, Bundle readiness, Scope creep, Steelmanning
- Cross-FM findings include `affected_artifacts: [FM-001, FM-002]` + `suggested_drill_down: /product:da-review FM-NNN`
- Text parsing confidence flag в findings если FM body §12 informal (per Ambiguity 2)
- Drill-down recommendations surfaced к user — НЕ auto-fired (aspirational v1.1)

**Acceptance:**
- [ ] Release scope brief включает все FMs
- [ ] Cross-FM findings структурно корректны
- [ ] Drill-down hints surfaced

### S10 — Handoff `--with-da-review` (Phase 4.H wiring)

**Цель:** validate, что `/product:handoff FM-001 --with-da-review` invokes DA pre-generation; critical pending findings блокируют handoff.

**Setup:** сценарий, производящий 🔴 Critical finding (например, известный BR-IC конфликт).

```
> /product:handoff FM-001 --with-da-review
```

**Verify:**
- SlashCommand `/product:da-review FM-001` invoked first
- DA findings written с `source: auto-pre-handoff`
- Если 🔴 Critical AND `resolution: pending` → handoff refuses continue, surfaces blockers + recommended fix
- Если 0 critical pending → handoff proceeds; warnings appended к handoff frontmatter
- Handoff frontmatter `da_review_reference: FM-001-<timestamp>.md` set если DA successful

**Acceptance:**
- [ ] Real SlashCommand invocation (не placeholder)
- [ ] Critical gate non-bypassable
- [ ] DA reference preserved в handoff frontmatter

### S11 — Cleanup orphan detection (Phase 4.G / DEC-DEV-0027)

**Цель:** validate, что `/product:cleanup` (default mode) — V-15 orphan detection only; fast graph analysis.

```
> /product:cleanup --dry-run
> /product:cleanup
```

**Verify:**
- `--dry-run` показывает preview orphans + suggested actions (archive / re-link / delete) без apply
- Default mode prompts per orphan: `[Y/N/Re-link/Delete/Skip]`
- Design module conditional: если `commands/design/` not present → skip MK/DS/NM checks silently
- NOTE artifacts skipped (per V-15 root artifact rule)
- Decision journal entry создан post-resolution

**Acceptance:**
- [ ] Нет MK/DS/NM false positives без Design module
- [ ] Per-orphan prompts работают
- [ ] `--dry-run` ничего не применяет

### S12 — Cleanup `--pending-hygiene` (Phase 4.G)

**Цель:** validate, что `--pending-hygiene` (alias `--full`) — 3-pending-file sweep + orphan detection.

```
> /product:cleanup --pending-hygiene --dry-run
> /product:cleanup --pending-hygiene
```

**Verify:**
- Cascade pending: делегирует `/product:cascade --pending --revalidate` (existing command)
- Validation pending: re-evaluates per entry; purges currently-passing
- DA pending: flag stale entries (artifact.status == active); НЕ auto-delete
- `--dry-run` показывает hygiene actions preview («would invoke», «would purge N», «would flag M»)

**Acceptance:**
- [ ] Cascade revalidate delegated корректно
- [ ] Validation purge re-uses F5 pattern (DEC-DEV-0023)
- [ ] DA pending flag-only (no destruction)

### S13 — NFR tier upgrade (Phase 4.D)

**Цель:** validate, что `/product:nfr-upgrade-tier` — batch re-review при tier upgrade (MVP → MMP).

**Setup:** `.claude/product.yaml.product_tier: mvp` с existing NFR-active FMs.

```
> /product:nfr-upgrade-tier mmp
```

**Verify:**
- Bumps `product.yaml.product_tier: mmp`
- Все FMs со `nfr_status: declined` или `pending` queued для batch re-review
- Per FM: surface decision per V-16 severity matrix new tier
- User per-FM action [Re-review / Keep / Defer]

**Acceptance:**
- [ ] Batch enumeration работает
- [ ] Per-FM action surfaced
- [ ] Tier persisted к `product.yaml`

### S14 — `verify-hooks.js` smoke runner — ✅ PASS (executed в A.1)

```
node dev/meta-improvement/scripts/verify-hooks.js
```

Output: `Total: 8 hook(s) tested; 0 failure(s).` Exit code 0.

Phase 4.F `product-handoff-gate.js` smoke entry подтверждён working в двух functional cases (no-handoff + drift-on-second-artifact от b8f16bc / DEC-DEV-0031 review fix-up). Phase 3 baseline preserved. Re-confirmed в DEC-DEV-0033 closure run (Step 3).

### S15 — Phase 4 closure ritual (Phase 4.K) — ✅ PASS (DEC-DEV-0033)

**Цель:** validate, что D7 phase-closure ritual completes successfully.

Steps per `dev/meta-improvement/checklists/phase-closure.md`:

1. **Final smoke run** — verify-hooks: ✅ PASS (S14)
2. **DEV_JOURNAL closure entry** — DEC-DEV-0032 summarizes Phase 4 implementation outcomes (Unit 1); DEC-DEV-0033 — closure ritual run (Unit 2)
3. **CHANGELOG entry** — `[1.2.0]` release-worthy — ✅ shipped в ee9bbca
4. **Archive `dev/PHASE_4_*`** — `git mv` к `dev/_archive/phase-4/` — ✅ done в K1
5. **Phase 5 readiness skeleton** — `dev/PHASE_5_READINESS.md` created — ✅
6. **Memory sync** — `project_ecosystem_status.md` updated — ✅ (F8 + F9 закрытие в DEC-DEV-0033 + queued; F9 architecture refresh pending)
7. **ROADMAP update** — «Где мы сейчас» Phase 4 ✅ / Phase 5 next — ✅

**Acceptance:**
- [x] Все closure ritual items checked
- [x] Нет working-tree leftover artifacts
- [x] Findings recorded — 9 findings в DEC-DEV-0033 (5 fixed inline, 3 queued, 1 user action F4)

---

## C. Deferred to user execution

Scenarios S1-S13 требуют interactive Claude Code session с existing `.product/` data. AI implementation session (которая produced Phase 4 code) не может напрямую:
- Invoke slash commands (`/product:plan`, `/product:feature`, `/product:nfr-review` и т.д.) — это требует Claude Code runtime
- Test cross-platform hash (Windows ↔ Unix transfer)
- Verify interactive prompts (per-orphan, per-finding [Y/N/...])

**User action recommended:**
1. Execute S1-S13 на `my-first-test` или dogfood `.product/` для Ecosystem 3.0
2. Document findings (specific evidence: «S5 produced handoff с status: blocked due to V-H-08 — expected behavior; B7 has_ui=true без active MK») в DEV_JOURNAL DEC-DEV-NNNN closure entry
3. Если any S* surfaces regression — fix inline (если в Phase 4 scope) или defer к v1.1 + document в `dev/v1_1_backlog.md`

**Static verification (Section A) — passed; runtime verification (Section B) — pending user execution для S1-S13.**

---

## D. Reporting findings

После real-run completion populate retroactive DEV_JOURNAL entry по образцу Phase 4.K (closure):

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
- S14 (verify-hooks): ✅ PASS (Phase 4.J + DEC-DEV-0033 Step 3)
- S15 (Closure ritual): ✅ PASS (DEC-DEV-0033)

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

Smoke test passes когда:
- [x] Все static checks (Section A) — ✅ PASS (8/8)
- [x] S14 + S15 — ✅ PASS (DEC-DEV-0033)
- [ ] User executes runtime scenarios S1-S13 (Section B)
- [ ] ≥10 из 13 runtime scenarios PASS
- [ ] Нет B.1 frontmatter convention violations
- [ ] Нет `--scope` flag resurrection
- [ ] Findings → Phase 5 readiness checklist или v1.1 backlog

Если ≥10 scenarios pass — Phase 4 ships. Findings → Phase 5 readiness + retroactive DEV_JOURNAL.
