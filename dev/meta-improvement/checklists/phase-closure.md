# Phase Closure Checklist

> **Назначение:** ≤60 min hygiene run после каждой major phase implementation. Catches что systematically не выполняется без discipline: doc rot, bootstrap regression, doc inconsistency, cleanup, memory sync.
>
> **Когда запускать:** после commits всех Phase N sub-phases, перед Phase N+1 readiness gate.
>
> **Owner:** developer (you). Manual checklist в Stage 2; automation candidate Stage 3+.
>
> **Time budget:** 30-60 min total. Если >60 — flag в Phase N+1 readiness, не upgrade в waterfall.

---

## Pre-flight

- [ ] All Phase N sub-phase commits merged to main
- [ ] CHANGELOG.md updated for Phase N
- [ ] DEV_JOURNAL DEC-DEV-NNNN closure lessons entry exists
- [ ] No uncommitted changes (`git status` clean)

If any unchecked — abort closure, finish phase first.

---

## Step 1 — Documentation health check (≤15 min)

**Цель:** обход core ecosystem docs, поиск doc rot (stale references, outdated status banners, dangling pointers).

### Что делать

1. **Status snapshots** — verify reflect current state:
   - `ROADMAP.md` § «Где мы сейчас» — последний завершённый phase правильный?
   - `README.md` Quick Start / status — references current?
   - `CLAUDE.md` § «Где мы сейчас» (если есть) — current?
   - `dev/PHASE_<N+1>_READINESS.md` status banner — отражает что Phase N completed?

2. **Cross-doc mentions of completed phase** — grep:
   ```bash
   grep -rn "Phase <N>" docs/ dev/ commands/ skills/ agents/ hooks/ CLAUDE.md ROADMAP.md README.md CHANGELOG.md
   ```
   Каждое упоминание должно быть либо «completed/done» либо historical reference. «Pending» / «in progress» / «ready to start» для completed phase = rot.

3. **Phase N-specific instructions в CLAUDE.md / README** — обычно есть текст вроде «Если starting Phase N — пройди dev/PHASE_<N>_READINESS.md». После closure он rot. Generic заменить на «Если starting next phase» или удалить если cleanup.

4. **Root doc snapshots + tree diagrams** (added Phase 3 closure refinement, 2026-04-28):
   - `CLAUDE.md` § «Где мы сейчас» (если есть snapshot block) — отрефреш list
   - Tree diagrams в `CLAUDE.md` / `README.md` / docs/ — содержат ли Phase-N specific entries that drift? Заменить на generic patterns где возможно.
   - Pattern fragility lesson: snapshot phrases вроде «На момент создания этого файла» nominally honest disclaimer, но в практике refresh requires explicit closure step.

### Pass

- All status banners current
- Grep returns no «pending/in-progress» phrases for completed phase (исключение: explicit historical refs в DEV_JOURNAL/CHANGELOG)
- All cross-refs to phase deliverables resolve

### Fail

- Status banner stale → fix inline (≤5 min — это why doc rot caught early)
- Cross-ref points к non-existent file → fix or remove
- >3 stale places → flag в DEV_JOURNAL closure findings + phase-closure refinement (preventive measure?)

---

## Step 2 — Bootstrap install/update verification (≤20 min)

**Цель:** verify `/ecosystem:bootstrap` correctly installs Phase N additions on existing pilot project (`my-first-test/`). Catches «bootstrap auto-registration didn't pick up new files» class regression.

> **User pain origin:** наблюдалось 2026-04-28 в Phase 3 — bootstrap не обновил my-first-test с Phase 2 → Phase 3, добавки попали только в фресные projects. Это primary user rule #2.

### Что делать

1. **Inventory Phase N additions** — что added в этой phase?
   - New `commands/<module>/*.md`
   - New `skills/<module>/*.md`
   - New `agents/<module>/*.md`
   - New `hooks/<module>/*.js` + manifest entries
   - New templates / configs

   Source of truth — CHANGELOG.md `[<version>]` Added section.

2. **Re-bootstrap pilot project** (interactive Claude Code session — нельзя spawn subprocess из этой сессии):
   ```
   cd <pilot-project-path>  # e.g., C:/Users/pw201/WebstormProjects/my-first-test
   claude
   > /ecosystem:bootstrap
   ```
   Expect: idempotent merge, NO data loss to existing `.product/` artifacts.

3. **Verify post-state** (read-only checks from outside Claude session — этой сессии):
   ```bash
   # New commands installed?
   ls <pilot>/.claude/commands/<module>/

   # New skills installed?
   ls <pilot>/.claude/skills/<module>/

   # Hook manifest reflected в settings.json?
   cat <pilot>/.claude/settings.json | grep -c '"command"'

   # Phase N artifacts intact (no data loss)?
   ls <pilot>/.product/
   ```

4. **Hook count expected:**
   - Phase 2 only: 2 hooks (artifact-validate, session-state)
   - Phase 3: 6 hooks (+ bg-extractor, cascade-check, br-change-trigger, ic-change-trigger)
   - Phase 4: 7 hooks (+ product-handoff-gate)
   - Phase 6 (conditional): +1 design-artifact-validate

### Pass

- Bootstrap completes без errors
- All Phase N additions reflected в pilot's `.claude/`
- `.product/` data intact (артефакты как до bootstrap)
- Hook count matches expected
- Commands count matches expected (e.g., Phase 3 added 5 new product commands)

### Fail

- Bootstrap errors → diagnose (likely `.claude-ecosystem-tmp` collision, permissions, settings.json malformed)
- Missing additions → bootstrap.md или manifest gap; fix в NEXT commit; document в Phase N+1 readiness as regression source
- `.product/` data damaged → CRITICAL — restore from git, root-cause merge logic; block Phase N+1 until fixed

---

## Step 3 — Documentation consistency check (≤10 min)

**Цель:** distinct from Step 1 — это cross-document semantic alignment (не status banners). Hook manifest ↔ processes.md ↔ SPEC; CHANGELOG additions ↔ actual files; ROADMAP claims ↔ actual deliverable count.

### Что делать

1. **Hook manifest ↔ processes.md ↔ SPEC** — все три должны agree on hook names + events:
   ```bash
   # пример для Phase 3:
   grep -n "br-change-trigger\|ic-change-trigger\|cascade-check\|bg-extractor" \
     hooks/product/manifest.yaml docs/pmo/processes.md docs/product-module/SPEC.md
   ```

2. **CHANGELOG additions vs actual files** — каждый «Added: X» pointer в CHANGELOG резолвит к существующему файлу?
   ```bash
   # spot check 3-5 entries из CHANGELOG [<version>]
   ls commands/product/<new-cmd>.md skills/product/<new-skill>.md hooks/product/<new-hook>.js
   ```

3. **CLAUDE.md skill conventions ↔ skills frontmatter** — pick 2-3 random new skills, verify follow B.1 convention (explicit frontmatter template + anti-pattern list per CLAUDE.md «Skill конвенции»).

4. **ROADMAP Phase N section vs actual** — claimed «X commands + Y skills + Z hooks» — actually shipped?

5. **Count verification** (added Phase 3 closure refinement, 2026-04-28):
   ```bash
   # filesystem truth
   ls commands/<module>/*.md | wc -l
   ls skills/<module>/*.md | wc -l
   ls hooks/<module>/*.js | wc -l
   ```
   Сверить с ROADMAP claims + CHANGELOG `[<version>]` Added section breakdown. Math должна сходиться (e.g., «X cmds + Y skills + Z hooks + N ext = total» — проверь arithmetic). Phase 3 closure caught «14 skills» typo в обоих ROADMAP+CHANGELOG (actual = 13).

### Pass

- Hook names match across manifest / processes / SPEC
- CHANGELOG references resolve
- Random sample skills follow B.1 convention
- ROADMAP estimates match actual

### Fail

- Name mismatch → fix doc that's wrong (usually CHANGELOG/ROADMAP — last to update)
- Convention violation → fix skill (B.1 enforcement)
- ROADMAP off → update with actual numbers (or note discrepancy в DEC-DEV)

---

## Step 4 — Cleanup / archive discipline (≤10 min)

**Цель:** counter the 10-15:1 add:cleanup ratio. Archive obsolete dev/ docs; identify dead refs.

### Что делать

1. **Phase N readiness doc** — archive:
   ```bash
   mkdir -p dev/_archive/phase-<N>/
   git mv dev/PHASE_<N>_READINESS.md dev/_archive/phase-<N>/
   ```

2. **Phase N smoke test plan** — archive **only after smoke test ran**. Если pending — leave active.

3. **Stale dev/ candidates** — list:
   ```bash
   ls dev/
   ```
   Anything pre-Phase-N living? `v1_1_backlog.md` is living (deferral context); `PHASE_<N-1>_*` historical (already archived past closure).

4. **Dead «coming soon» markers** — grep для placeholders что shipped phase должна была заполнить:
   ```bash
   grep -rn "TODO Phase <N>\|coming soon Phase <N>\|defer Phase <N>" \
     docs/ commands/ skills/ agents/ hooks/
   ```
   Каждое попадание — либо implement (если действительно missed), либо update reference (если scope перенёсся в другую phase).

5. **NEVER archive** (per CONVENTIONS.md §5.2):
   - `DEV_JOURNAL.md` (cross-session memory)
   - `CHANGELOG.md`, `ROADMAP.md`, `README.md`, `CLAUDE.md`
   - `dev/v1_1_backlog.md`, `dev/PHASE_<N+1>_READINESS.md`
   - `dev/meta-improvement/SPEC.md`, `CONVENTIONS.md`, `checklists/*`

### Pass

- PHASE_<N>_READINESS archived (если smoke test уже completed — also smoke test plan)
- No orphan «TODO Phase <N>» markers в shipped artifacts
- dev/ count reasonable (~5-10 active files; growing slowly)

### Fail

- Archive blocked → check `git mv` (uncommitted modifications), .gitignore rules
- Orphan markers → fix inline (remove или replace с proper deferral reference в v1_1_backlog.md)
- dev/ count >15 active — review what's still living

---

## Step 5 — Memory MCP sync (≤10 min)

**Цель:** memory может drift away от DEV_JOURNAL/CLAUDE.md across phases. Live discovered gap (Phase 3 closure 2026-04-28 — memory said «Phase 3 ready», actually closed 8 days prior).

> **Status:** discovered late Phase 3. Refine criteria after Phase 4 closure (1 instance is too few — pattern emerge before formalize).

### Что делать

1. **List memory entries:**
   ```bash
   ls ~/.claude/projects/<project-slug>/memory/
   ```
   Project slug = `<absolute-path-with-dashes-instead-of-slashes>`.

2. **Per entry — verify against current state:**
   - `project_<X>_status.md` — claims align с `git log -10` + DEV_JOURNAL latest entries?
   - `project_<X>_architecture.md` — module count / artifact count / process count match docs?
   - `feedback_*.md` — methodology agreements still apply?
   - `reference_*.md` — pointers resolve?

3. **Update what's stale** — direct file edit (Read first, then Edit). Update `description:` field if scope changed.

4. **MEMORY.md index** — confirm все memory entries listed; lines fit под 200 (truncation risk).

### Pass

- All memory files current within 1 phase (max age = 1 phase since update)
- Status memory reflects «Phase N closed, Phase N+1 next»
- No claims contradict latest DEV_JOURNAL

### Fail

- Stale memory → update inline; if extensive (>2 files >1 phase old) → flag в DEV_JOURNAL closure findings; sync mechanism warrant Stage 3 promotion

---

## Closing

After all 5 steps:

1. **Document findings** в `DEC-DEV-NNNN — Phase <N> closure run + checklist refinement`:
   - Steps passed / failed
   - Inline fixes applied
   - Issues queued to PHASE_<N+1>_READINESS.md
   - Refinements к checklist (если pain points emerged)

2. **Commit** — `chore(meta-improvement): apply phase-closure to Phase <N> — findings (DEC-DEV-NNNN)`

3. **Time check** — actual time vs ≤60 min budget. Track для tuning.

If закрытие revealed что-то that should've been в Phase N implementation (e.g., process drift) — that goes в DEC-DEV-NNNN с lesson. Phase closure не excuse to dump fixes from previous phase.

---

## Refinement tracker

| Phase | Closure date | Findings count | Time | Refinements |
|---|---|---|---|---|
| Phase 3 | 2026-04-28 | 9 (5 doc rot + 1 consistency + 1 archive + 3 memory + 1 bootstrap pending user) | ~45 min | Step 1.4 (root doc snapshots), Step 3.5 (count verification) |
| Phase 4 | TBD | | | |
| Phase 5 | TBD | | | |
