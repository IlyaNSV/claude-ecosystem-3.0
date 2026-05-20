---
description: Phase 4.G skill — V-15 orphan detection + optional pending hygiene sweep (--pending-hygiene flag) для /product:cleanup. Default mode = orphan only (быстро, predictable). Hygiene mode = cascade revalidate + validation-pending purge verify + da-pending stale flag. Design module (MK/DS/NM) проверки активируются conditionally если commands/design/ установлен.
---

# Cleanup Detector — Phase 4 skill

Loaded by `/product:cleanup` command. Detects orphan artifacts (V-15) и optionally сметает stale entries в `.product/.pending/` files.

## Architecture (per DEC-DEV-0027)

**Hybrid mode** — default fast path + opt-in deep path:

| Mode | Trigger | Scope | Time |
|---|---|---|---|
| **Default** (orphan-only) | `/product:cleanup` или `/product:cleanup --dry-run` | V-15 graph analysis | <1s typical |
| **Pending hygiene** | `--pending-hygiene` (alias `--full`) | V-15 + 3 pending files sweep | 5-30s (зависит от queue sizes) |

**Rationale:** orphan detection — fast (graph analysis по frontmatter index), predictable, безопасный. Pending hygiene вызывает downstream operations (cascade revalidate, validation re-run) — намного дороже + side-effects. Разделение через флаг — баланс «daily cleanup» (default) vs «periodic deep sweep» (flag).

**Relationship к `validation-runner.md` V-15:** оба skills share conceptual approach (graph analysis для orphan detection). `/product:validate --rule V-15` запускает V-15 как часть full validation; `/product:cleanup` (default) — standalone fast path с focused output (per-orphan recommendations). Не duplicate code — duplicate intent на разных entry points.

## Input

- `--dry-run` — preview mode: показывает что **бы** было сделано, не применяет destructive actions. Включает hygiene actions preview если совмещён с `--pending-hygiene`.
- `--pending-hygiene` (alias `--full`) — opt-in deep sweep: V-15 + 3 pending files (cascade / validation / da).
- Без флагов → V-15 orphan detection (не destructive — listing only) + per-orphan suggestion.

## V-15 Orphan detection

### Algorithm

Per `docs/pmo/validation.md §V-15`:

1. **Build artifact index.** Glob `.product/**/*.md` (исключая `.pending/`, `.reports/`, `.da-findings/`, `.sessions/`, `.decisions/`, `notes/`). Parse frontmatter с Read (limit ~50 lines), collect:
   - `id` (e.g., `BR-010`)
   - `type` (derived from directory: `business-rule`, `scenario`, `lifecycle`, etc.)
   - `status` (`draft | active | shipped | deprecated | declined`)
   - `file` (relative path)

2. **Build reverse-reference graph.** Для each active artifact с frontmatter refs:
   - SC.feature → FM
   - SC.rules[] → BR
   - BR.scenarios[] → SC (forward; cascade-check populated)
   - FM.scenarios[] → SC
   - LC.rules[] → BR
   - VC.scenario → SC
   - IC.rules[] → BR
   - RPM.scenarios_by_role[] → SC
   - MK.feature → FM (если Design module установлен)
   - NM.scenarios[] → SC (если Design module установлен)

3. **Per artifact — check incoming refs:**
   - Если artifact.status ∈ {`deprecated`, `declined`} → skip (intended terminal state, не orphan).
   - Если artifact.type ∈ {`PS`, `MR`, `CA`, `SEG`, `VP`, `HYP`, `MVP`, `RM`, `RL`, `FM`, `BG`, `NOTE`} → skip (root artifacts; нет inbound dependency).
   - Иначе count incoming refs from artifacts со status ∈ {`active`, `shipped`, `in-progress`}.
   - `incoming == 0` → orphan candidate.

4. **Per orphan — generate recommendation:**
   - **Archive** (preferred default): set `status: deprecated` + add `deprecation_reason` к frontmatter; preserves history, no data loss.
   - **Delete** (destructive; rare): rm file. Только если artifact genuine mistake (e.g., test artifact created during exploration). Requires user explicit confirmation.
   - **Re-link** (rescue): user identifies which FM/SC should reference orphan; user updates parent's frontmatter.

### Design module conditional (per Ambiguity 16, DEC-DEV-0030)

V-15 включает MK/DS/NM проверки **только если Design module установлен**. Detection:

1. **File-based check** (primary): `commands/design/` directory exists в `.claude/`.
2. **Config fallback** (secondary): `.claude/product.yaml.modules.design.enabled == true` (если поле присутствует — schema extension Phase 6).
3. Default (нет ни директории, ни флага в config): Design **отсутствует**.

**Если Design отсутствует:**
- MK/DS/NM артефакты в `.product/` не expected → если найдены, skip (не treat как orphan, surface как «unexpected Design artifacts без Design module» note).
- Reverse-ref map не включает MK.feature / NM.scenarios edges.

**Если Design присутствует:**
- MK/DS/NM включены в graph как dependent artifacts.
- MK без incoming FM.has_ui ref → orphan candidate.
- NM без incoming SC ref → orphan candidate.

## Pending hygiene mode (`--pending-hygiene` / `--full`)

После V-15 orphan detection — sweep 3 pending files. Per Ambiguity 15 (DEC-DEV-0030):

### 1. `cascade-pending.yaml` → invoke `/product:cascade --pending --revalidate`

**Action:** delegate к existing command (already shipped в 1.1.1 per DEC-DEV-0023 Q7). Этот skill **не** знает и не должен знать как `/product:cascade --pending --revalidate` устроен внутри — это орchestration через published interface, не reimplementation. См. anti-pattern #5.

**Implementation:** surface к user message «Invoking /product:cascade --pending --revalidate to refresh cascade-pending entries...» + execute (или, в `--dry-run` mode, surface «Would invoke /product:cascade --pending --revalidate (N entries currently queued)»).

### 2. `validation-pending.yaml` → re-run inline validation per entry's artifact

**Action:** для each entry в `validation-pending.yaml`:
- Read referenced artifact (`entry.file`)
- Re-evaluate rule (`entry.rule`) per current artifact-validate.js logic
- Если **currently passes** → mark entry для purge
- Если **still fails** → keep entry (no change)

После prosessing — write filtered queue back (DEC-DEV-0023 F5 pattern, re-uses `purgeValidationPendingFor` semantics).

**`--dry-run`:** surface «Would re-validate N entries; M would be purged (currently passing)», но не write changes.

**Implementation note:** не reinvent — re-use logic из `artifact-validate.js` (skill provides high-level orchestration; actual rule evaluation остаётся в hook source-of-truth).

### 3. `da-pending.yaml` → flag stale entries для already-active artifacts

**Hard constraint — read-only.** Этот skill **никогда не пишет** в `.product/.pending/da-pending.yaml` (ни overwrite, ни partial edit, ни через Write, ни через Edit). DA-pending hygiene — exclusively surfacing к user, не destruction. Запись discharge'ется только через canonical paths: hook'и (`br-change-trigger.js`, `ic-change-trigger.js` — owner of the file), либо explicit user action на следующем session step. См. anti-pattern #2.

**Session-window guard.** Skip entries с `queued_at >= session_start_timestamp` — entries созданные в текущей session нельзя классифицировать как stale (DA review ещё не имел шанса run'нуть). Особенно применимо если `--pending-hygiene` запущен после hook-emitting actions в той же session (semantic BR/IC edit → hook queue → pending-hygiene wipe бы пропустил required DA spawn).

**Per-entry flow:**

- Read referenced artifact (`entry.file`)
- Check `queued_at`: если ≥ session start → skip (not stale; just-created)
- Check artifact's current `status`:
  - Если **artifact.status == active** → DA review был completed (orchestrator pattern: DA runs → user resolves findings → artifact transitions к active). Entry стала stale.
  - **Flag** (surface к user в output): «Stale DA-pending entry: <artifact> already active. Review `.product/.da-findings/<artifact>-*.md` или manually remove entry.»
  - Если **artifact.status == draft** → DA review still relevant; keep entry untouched.

**Rationale за read-only:** DA findings содержат критическое содержание (диффы, rationale, severity assessment). Авто-удаление stale entries:
- **теряет контекст** если orchestrator workflow был interrupted (DA findings file ещё может ждать user resolution).
- **разрывает audit chain** — DA-pending entry это claim на work owed; wipe без resolution оставляет hook contract нарушенным.
- **invalidates downstream** — если entry queued в той же session (например, после BR semantic edit), wipe пропускает required DA spawn (P-RULE-02 violation).

Surface к user — позволяет manual cleanup с осознанным выбором (read finding file, decide accept/reject, потом manual `entries:` edit если applicable).

**`--dry-run`:** surface «Would flag N stale DA-pending entries для review» (output identical к non-dry — это flag-only action, no destructive side-effect).

**AskUserQuestion framing.** Если flow решает спросить user о purge, `Recommended` метка **только** на «Keep + open finding file для manual review»; destructive option separate, **без endorsement framing**. Default-recommended всегда conservative.

## Execution flow

1. **Parse args.** Defaults: no flags = orphan-only + apply.
2. **Check prerequisites:** `.product/` exists, `.claude/product.yaml` exists.
3. **Detect Design module:** `commands/design/` directory check + `product.yaml.modules.design.enabled` fallback.
4. **Run V-15 orphan detection:**
   - Build artifact index
   - Build reverse-ref graph (conditional на Design module)
   - Identify orphans per algorithm
   - Generate per-orphan recommendation
5. **If `--pending-hygiene` (или `--full`):**
   - 5a. Cascade pending hygiene: invoke `/product:cascade --pending --revalidate`
   - 5b. Validation pending hygiene: re-evaluate per entry, purge passing ones
   - 5c. DA pending hygiene: **read-only flag** stale entries (artifact.status == active AND queued_at < session_start). НЕ writes к da-pending.yaml. См. section 3 + anti-pattern #2.
6. **Compose report:** orphan list + (если flag) hygiene actions summary.
7. **If `--dry-run`:** surface preview only, не apply any destructive changes (archive / purge / cascade revalidate).
8. **Если NOT `--dry-run`:** apply approved actions:
   - V-15 orphans — present к user per orphan для action (archive / delete / re-link / skip).
   - Pending hygiene — applied as described above (per-file логика).

## Output format

### Default mode (orphan-only, no flags)

```
=== CLEANUP REPORT (V-15 orphan detection) ===
Project: <name>
Time: 2026-05-13 14:30
Mode: orphan-only (use --pending-hygiene для full sweep)

Orphan artifacts (3):
  SC-012 (.product/scenarios/SC-012-old-import.md, status: active)
    No incoming refs from active FM
    → Suggested: archive (set status: deprecated) | re-link к FM-005

  BR-018 (.product/business-rules/BR-018-legacy-validation.md, status: active)
    Not referenced by any active SC
    → Suggested: archive | re-link

  LC-007 (.product/lifecycles/LC-007-archived-flow.md, status: active)
    No SC.feature points к parent FM-002 (which references this LC)
    → Note: FM-002.status == deprecated; LC-007 inherits orphan
    → Suggested: archive (consistent с parent deprecation)

SUMMARY: 3 orphan candidates

Per-orphan action:
  > Archive SC-012? [Y/N/skip]
  ...

Next actions:
  /product:cleanup --pending-hygiene   # also sweep pending files (cascade/validation/da)
  /product:cleanup --dry-run           # preview без apply
```

### `--pending-hygiene` mode

```
=== CLEANUP REPORT (V-15 + pending hygiene) ===
Project: <name>
Time: 2026-05-13 14:30
Mode: full sweep

Orphan artifacts (3):
  ... (same as above)

Pending hygiene:

  cascade-pending.yaml:
    Invoking /product:cascade --pending --revalidate...
    Before: 47 entries; after: 12 entries (35 stale cleared).

  validation-pending.yaml:
    Re-evaluating 8 entries...
    ✓ 3 entries now pass — purged
    ⚠ 5 entries still fail — kept
    Top still-failing: V-08 BG term «Revision batch» (SC-005, SC-006, SC-008)

  da-pending.yaml:
    Flagging stale entries (artifact.status == active)...
    Stale (2):
      BR-001 (status: active) — DA findings already в .product/.da-findings/
      IC-003 (status: active) — DA findings already в .product/.da-findings/
    → Manual review/delete recommended. Не auto-removed.

SUMMARY:
  Orphans: 3 candidates
  Cascade pending: 35 stale cleared
  Validation pending: 3 purged, 5 retained
  DA pending: 2 flagged stale

Next actions:
  /product:validate --rule V-08         # focus retained validation failures
  /product:cascade --pending            # review remaining cascade entries
```

### `--dry-run` mode

Identical format, но prefix sections с «WOULD»:

```
=== CLEANUP REPORT (DRY RUN — no changes applied) ===
...

Orphan artifacts (3):
  SC-012 ... → Would suggest archive (skip apply in dry-run)
  ...

Pending hygiene:
  cascade-pending.yaml:
    Would invoke /product:cascade --pending --revalidate (47 entries currently)

  validation-pending.yaml:
    Would re-evaluate 8 entries; estimated 3 would pass + be purged.

  da-pending.yaml:
    Would flag 2 stale entries (artifact already active).

SUMMARY (dry-run):
  Would suggest archive для 3 orphans
  Would refresh cascade-pending (47 → ~12 estimated)
  Would purge 3 validation-pending entries
  Would flag 2 da-pending entries
```

## Anti-patterns

1. **Не запускать `--pending-hygiene` после каждой active session.** Default `/product:cleanup` (orphan-only) — daily / per-session. Hygiene mode — weekly / per-release / при visible pending bloat (>50 entries в any pending file). Излишний deep sweep — wasteful + risk false positives (cascade revalidate touches every active artifact).

2. **Не auto-delete da-pending entries даже если flag stale — Write к da-pending.yaml в pending-hygiene flow запрещён.** Flag-only — DA findings содержат критический контекст; авто-удаление = lost data risk. Pattern symmetric к cascade-pending: `/product:cascade --pending --reset` тоже требует explicit user confirmation.

   **Запрещены вне зависимости от rationale:**
   - `Write .product/.pending/da-pending.yaml → entries: []` (any form, including partial wipe)
   - `Edit .product/.pending/da-pending.yaml` к removed entries
   - Implicit purge после user `Recommended` choice, если choice сам framed misleading
   - Любая mutation `da-pending.yaml` из cleanup-flow (даже «исправление шага раньше» в той же session)

   **Почему flag-only non-negotiable:**
   - **Hook contract integrity.** `.product/.pending/da-pending.yaml` owned by `br-change-trigger.js` / `ic-change-trigger.js`. Skill — orchestrator, не owner. Write от skill ломает single-writer invariant.
   - **DA review unblock.** Pending entry == «work owed». Wipe == «pretend work was done». P-RULE-02 / P-RULE-01 require Devil's Advocate run на BR/IC changes — без entry hook не может re-trigger.
   - **Audit chain.** DA findings file (`.product/.da-findings/<artifact>-<ts>.md`) + journal `DEC-DA-*` + da-pending entry — three-record trail. Wipe одного breaks navigation.
   - **Session-window safety.** Entries queued during current session (queued_at ≥ session start) — by definition not stale; cleanup-flow видит только pre-existing queue, не результат собственных side-effects.

   **«Recommended» framing — guard.** Если flow требует AskUserQuestion с destructive option (manual purge of stale entries) — `Recommended` метка только на «Keep + open finding file для manual review»; destructive option separate, без endorsement. Default-recommended всегда conservative.

   **Performance / brevity — не valid reason.** Если listing «(N) stale entries» громоздкий — fix output formatter, не bypass flag-only. Precedent: anti-pattern #2 violation в Phase 4 smoke зарегистрирована дважды — `5345f116` (user-authorized purge через misleading `Recommended` framing) и `98cb1b97` (silent Write `entries: []` для session-fresh entry, blocking P-RULE-02) — обе как 🔴 FAIL.

3. **Не treat MK/DS/NM as orphan если Design module disabled.** Surface как «unexpected Design artifacts» note, не blocking finding. Conditional detection per Ambiguity 16 — Design module file-based check.

4. **Не reinvent validation rule evaluation в этом skill.** `validation-pending.yaml` purge re-uses `artifact-validate.js` patterns (same rule definitions). Если этот skill encodes отдельную rule semantics — drift risk. High-level orchestration only.

5. **Не purge cascade-pending entries directly — даже если это быстрее.** Delegate к `/product:cascade --pending --revalidate` (existing command, well-tested per DEC-DEV-0023 Q7). Этот skill orchestrates через published slash-command interface, не через internal hooks.

   **Запрещены вне зависимости от rationale:**
   - Direct `Write .product/.pending/cascade-pending.yaml → entries: []`
   - Direct invoke `node .claude/hooks/product/cascade-check.js` (включая synthetic hook input subprocess loop)
   - Любой custom loop, перевычисляющий cascade state в обход `/product:cascade`

   **Почему делегация non-negotiable:**
   - **Semantic stability.** Если `cascade-check.js` меняется (новые edges, batch logic, output format) — delegated path inherits automatically; direct invoke ломается тихо.
   - **Audit trail.** `/product:cascade --pending --revalidate` пишет user-visible output + decision journal entry; raw subprocess loop оставляет немой transcript.
   - **Contract integrity.** Skills orchestrate через slash commands (public API), не через `.claude/hooks/` (internal). Invariant Phase 3+ design (DEC-DEV-0023).

   **Performance — не valid reason для deviation.** Если delegation медленна на large queue — это bug в `/product:cascade`, surface к user / open issue, не bypass. Precedent: anti-pattern #5 violation в Phase 4 smoke (S12, session `5345f116`) с rationale «на порядок быстрее» зарегистрирована как 🔴 FAIL.

6. **Не promote orphan детекцию из 🟡 Warning к 🔴 Blocking.** V-15 — informational by design (per `validation.md §V-15`). Orphan artifacts не блокируют handoff / approve gates; они signal cleanup opportunity. Severity uplift через `/product:validate --deep` остаётся в validation runner scope, не в cleanup.

7. **Не запускать `/product:cleanup` без `--dry-run` первый раз на pilot project.** Pilot artifacts могут иметь intentional orphan-looking structures (sandboxed experimental SC, legacy BR pending refactor). Preview сначала → apply осознанно.

## Related

- Companion command: `.claude/commands/product/cleanup.md`
- Catalog rule: `.claude/docs/pmo/validation.md §V-15`
- Validation runner (shares V-15 conceptually): `.claude/skills/product/validation-runner.md`
- Inline hook (auto-purge pattern source): `.claude/hooks/product/artifact-validate.js` (`purgeValidationPendingFor`)
- Cascade revalidate (delegated): `.claude/commands/product/cascade.md` (`--pending --revalidate`)
- Pending state files:
  - `.product/.pending/cascade-pending.yaml` — owned by `cascade-check.js`
  - `.product/.pending/validation-pending.yaml` — owned by `artifact-validate.js`
  - `.product/.pending/da-pending.yaml` — owned by `br-change-trigger.js` / `ic-change-trigger.js`
- Phase 4 dependencies:
  - DEC-DEV-0027 (hybrid `--pending-hygiene` flag decision)
  - DEC-DEV-0030 Ambiguities 15, 16, 17 (per-file hygiene actions, Design module detection, `--dry-run` scope)
