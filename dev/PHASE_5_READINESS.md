# Чек-лист готовности к Phase 5

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 5 (Integrator Phase 2 — Installation + first adapter).
>
> **Статус (2026-05-13):** ⏳ **Skeleton created в Phase 4.K1 closure**. Architectural questions queued; user-driven kickoff session нужна перед sub-phase A start.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждому пункту присвоен приоритет: 🔴 блокер, 🟡 важный, 🔵 необязательный.

---

## Статус-баннер

✅ **Phase 4 implementation completed (DEC-DEV-0032, 2026-05-13).**
✅ **Phase 4 closure ritual (Unit 2) executed 2026-05-13 — DEC-DEV-0033** — 9 findings, 5 fixed inline (F1/F2/F3/F7/F8), 3 queued ниже (F5/F6/F9), 1 pending user (F4 — interactive `/ecosystem:update`).
⏳ **Phase 4 runtime smoke (S1-S13+S15) pending user-driven Claude Code session.**

**Перед стартом Phase 5 implementation:**
- [x] **Phase 4 closure ritual (Unit 2 — D7 phase-closure.md 6 steps)** — executed 2026-05-13 fresh-session per anti-bias guard. Findings + refinements в DEC-DEV-0033. См. Section A ниже.
- [ ] **Phase 4 runtime smoke** (S1-S13+S15 per `dev/PHASE_4_SMOKE_TEST_PLAN.md` Section B) — user-driven Claude Code session с existing `.product/` data (либо `my-first-test` либо dogfood `.product/` для Ecosystem 3.0). Findings → retroactive `DEC-DEV-NNNN — Phase 4 smoke test results` entry. Precedent: Phase 3 = DEC-DEV-0023.
- [ ] **Closure queued findings (Section A.4)** — F5 SPEC.md §6.6 rewrite, F6 naming consistency sweep, F9 architecture memory refresh — fix перед Phase 5 implementation.
- [ ] **Phase 4 bootstrap regression (F4)** — `/ecosystem:update` в `my-first-test/.claude/` чтобы pilot получил Phase 4 deliverables. Можно скомбинировать с runtime smoke run.
- [ ] **Phase 5 readiness gate** — этот checklist completed; architectural questions resolved (Section C below); scope confirmed (Section D); pilot validation prepared (Section E).

**Гейт Phase 4 implementation closed** (DEC-DEV-0032). Closure ritual closed (DEC-DEV-0033). Runtime smoke + queued findings + Phase 5 readiness — non-blocking для user, recommended последовательность перед Phase 5 implementation start.

---

## A. Результаты Phase 4 closure ritual (Unit 2) — executed 2026-05-13

### A.1 Fresh-session phase-closure.md 6 steps

Per `dev/meta-improvement/checklists/phase-closure.md`. Fresh-session run executed 2026-05-13 (anti-bias guard active). Findings recorded в DEC-DEV-0033.

- [x] Step 1 — Documentation health check (~5 min): 🔴 F1 (README status banner) + 🔴 F2 (CLAUDE.md snapshot) + 🟡 F3 (ROADMAP Phase 2/3 acceptance unchecked) — **все исправлены inline**
- [x] Step 2 — Bootstrap install/update verification (read-only side; interactive `/ecosystem:update` отложен пользователю): ⚠️ F4 (`my-first-test/` в Phase 3 state — missing 6 cmds + 5 skills + 2 hook items; stale hypothesis-formulation.md + devils-advocate.md). `.product/` data intact. Запросное действие: `/ecosystem:update` в pilot session
- [x] Step 3 — Hook runtime smoke (1 min): ✅ 8/8 PASS, incl. `[drift-on-second-artifact]` functional case
- [x] Step 4 — Documentation consistency check (~10 min): 🔴 F5 (SPEC.md §6.6 product-handoff-gate описание устарело — PreToolUse vs реально PostToolUse, body описывает legacy «block external tool» дизайн) + 🔴 F6 (command naming colons vs hyphens drift в SPEC.md/processes.md — `/product:nfr:review` vs filesystem `/product:nfr-review`, Phase 4 добавил 6 новых colon-form refs) + 🔴 F7 (SPEC.md §14.5 phase tracker unchecked + §14.2/14.4 unchecked для completed phases) — **F7 исправлен inline (вместе с §14.2/14.3/14.4); F5/F6 queued ниже**
- [x] Step 5 — Cleanup / archive discipline (~2 min): ✅ PASS — PHASE_4_READINESS + PHASE_4_DECISIONS архивированы; нет dead Phase 4 markers; dev/ count чист
- [x] Step 6 — Memory MCP sync (~5 min): 🟡 F8 (MEMORY.md index устарел — Phase 3 wording) — **исправлен inline**; 🟡 F9 (project_ecosystem_architecture.md устарел на D7 v1.0 state — claim «Stage 2 manual checklists, Stage 3+ deferred», но Stages 3-6 shipped per DEC-DEV-0021) — **queued ниже**

**Time actual:** ~35 min (within ≤60 min budget).

### A.2 Closure ritual DEC-DEV entry

- [x] **DEC-DEV-0033 — Phase 4 closure run + checklist refinement** записан с findings ритуала + refinements к checklist (см. Section H ниже)

### A.3 Inline fixes applied (5 findings closed)

| # | Файл | Fix |
|---|---|---|
| F1 | `README.md:5` | v1.1.0 / Phase 0-3 shipped / Phase 4 next → v1.2.0 / Phase 0-4 shipped / Phase 5 next |
| F2 | `CLAUDE.md:22-25` | Snapshot 2026-04-28 → 2026-05-13; добавлен Phase 4 shipped row |
| F3 | `ROADMAP.md` Phase 2 acceptance (5 боксов) + Phase 3 acceptance (9 боксов) | [ ] → [x]; добавлен subtitle с reference DEC-DEV-0008/0023; исправлено наименование `/product:bg-review` / `/product:bg-rename` (часть F6 closure) |
| F7 | `docs/product-module/SPEC.md` §14.2 (Phase 2), §14.3 (Phase 3 Planning часть), §14.4 (Phase 3 P2), §14.5 (Phase 4 без external-tool-adapter acceptance) | Чекбоксы переведены в [x] для shipped, оставлены [ ] для legitimately pending (Deep mode v1.1, adapter consumption Phase 5); section subtitles добавлены с DEC-DEV references; command names corrected `nfr:` → `nfr-`, `bg:` → `bg-` |
| F8 | `~/.claude/projects/<slug>/memory/MEMORY.md` | Project status index entry обновлён к Phase 4 shipped (1.2.0, DEC-DEV-0032); Phase 5 unblocked |

### A.4 Queued к Phase 5 readiness Section A (3 findings — fix перед Phase 5 implementation)

#### A.4.1 — F5 SPEC.md §6.6 product-handoff-gate.js spec drift

**Класс:** critical spec drift (post-design-deviation). Body §6.6 описывает legacy v1.0 / pre-Phase-4.F намерение (PreToolUse hook блокирующий external tool invocation); реальная имплементация (после b8f16bc / DEC-DEV-0031 A3) — PostToolUse non-blocking drift detection между `.product/` source и handoff hashes (через `lib/hash.js`).

**Файл:** `docs/product-module/SPEC.md:498-503`
**Reference:** `docs/product-module/handoff-spec.md:979` корректно описывает actual behavior; SPEC body должен синхронизироваться.

**Действие:** rewrite §6.6:
1. Header: `### 6.6 product-handoff-gate.js (PostToolUse, non-blocking)`
2. Триггер: «save артефакта в `.product/`» (вместо «invocation external tool»)
3. Действия: «recompute hash через `lib/hash.js`; compare against stored `artifact_hashes` в существующих handoff frontmatter»
4. Effect: «stderr warning при mismatch, suggestion `/product:handoff <FM-id> --regenerate`; не блокирует Write/Edit»
5. Reference DEC-DEV-0025 C.1 (hash утилита) + DEC-DEV-0031 A1 (line-based parser fix)
6. Опция «Integrator register external commands» — удалить (legacy design)

**Effort:** ~15-20 мин (careful rewrite + cross-check against handoff-spec.md §6 wording).

#### A.4.2 — F6 Command naming colons-vs-hyphens drift

**Класс:** naming inconsistency, may surface как «command not found» для пользователя который копирует команды из docs.

**Filesystem truth (hyphens):** `commands/product/nfr-review.md`, `nfr-upgrade-tier.md`, `bg-review.md`, `bg-rename.md`.

**Drift files (colons):**
- `docs/product-module/SPEC.md` строки 281, 286, 291, 295, 619, 936, 944
- `docs/pmo/processes.md` строки 360, 693, 914-915, 1027, 1108
- `commands/product/status.md` строки 82, 124 (pre-Phase-4 era; bg refs)

**Действие:** systematic find-replace:
- `/product:bg:review` → `/product:bg-review`
- `/product:bg:rename` → `/product:bg-rename`
- `/product:nfr:review` → `/product:nfr-review`
- `/product:nfr:upgrade-tier` → `/product:nfr-upgrade-tier`
- В SPEC.md §14.4 — `bg:review.md`/`bg:rename.md` → `bg-review.md`/`bg-rename.md`

**Effort:** ~10 мин (sed/IDE find-replace, проверка что не сломано processes.md table formatting).

#### A.4.3 — F9 project_ecosystem_architecture.md memory stale на D7 state

**Класс:** memory drift; status memory знает текущее состояние, architecture memory — нет.

**Файл:** `~/.claude/projects/<slug>/memory/project_ecosystem_architecture.md:14`

**Текущее:** `D7 ... Stage 2 mechanisms = manual checklists (phase-closure, phase-kickoff); Stage 3+ formalization deferred.`

**Должно отражать (per DEC-DEV-0021):** D7 v1.0 final shipped Stages 3-6:
- Stage 3: 5 patterns в `dev/meta-improvement/patterns/` (spec-drift-sweep, readiness-gate, b1-frontmatter-convention validated, cuttable-scope-discipline, smoke-test-plan)
- Stage 4: memory-sync skill + verify-update.sh/.ps1 + phase-closure-reminder.js hook + smoke-hooks.js + verify-hooks.js + pre-commit.sh
- Stage 5: CLAUDE.md D7 ritual collapsed section
- Stage 6: SPEC.md v1.0 final

**Действие:** Edit memory file inline (Read first, then Edit с corrected D7 line).

**Effort:** ~5 мин.

---

## B. Phase 4 runtime smoke test results — pending

### B.1 Real run на `my-first-test` или dogfood

Per `dev/PHASE_4_SMOKE_TEST_PLAN.md` Section B. 15 scenarios:

- [ ] S1 — HYP frontmatter canonical (DEC-DEV-0024 verification)
- [ ] S2 — Language discipline (Russian default + identifiers verbatim)
- [ ] S3 — Full validation `/product:validate --deep`
- [ ] S4 — NFR review F.5a Ask/Define
- [ ] S5 — Handoff `--mode draft`
- [ ] S6 — Handoff `--mode production`
- [ ] S7 — Cross-platform hash invariant (Windows ↔ Unix transfer)
- [ ] S8 — DA review FM-NNN (feature scope)
- [ ] S9 — DA review RL-NNN (release scope)
- [ ] S10 — Handoff `--with-da-review` (real SlashCommand invocation + critical gate)
- [ ] S11 — Cleanup orphan detection (default mode)
- [ ] S12 — Cleanup `--pending-hygiene` (full sweep)
- [ ] S13 — NFR tier upgrade
- [x] S14 — `verify-hooks.js` smoke runner (✅ 8/8 PASS executed в Phase 4.J + post-rebase verification)
- [ ] S15 — Phase 4 closure ritual (overlaps with A.1 above)

### B.2 Retroactive DEC-DEV entry

- [ ] **DEC-DEV-NNNN — Phase 4 smoke test results** populated после real run completion (precedent: DEC-DEV-0023 для Phase 3)

---

## C. Архитектурные вопросы Phase 5 (🟡 важно — kickoff session)

> **NOTE:** эти вопросы — first-pass surface. Pre-implementation kickoff session (per `dev/meta-improvement/checklists/phase-kickoff.md`) должен expand + resolve через DEC-DEV-NNNN entry перед sub-phase A start.

### C.1 Contract design algorithm — manual или generated?

**Контекст:** Phase 5 ships first adapter `handoff-to-ccsdd.js` как **reference implementation**. ROADMAP Phase 5 risk note: «Contract design алгоритм — один из pending gaps. Первый adapter пишется вручную (не generated). OK для v1 — с опыта формализуем generation позже».

**Вопросы для kickoff:**
- Adapter живёт в `adapters/handoff-to-ccsdd.js` или `commands/integrator/adapters/`? Schema location?
- Reference implementation в Phase 5; generation algorithm — Phase 7 или v1.1?
- Contract schema versioning (cc-sdd может обновиться — backwards compat)?

### C.2 Environment Scanner scope при `/integrator:add`

**Контекст:** SPEC Integrator §X mentions Environment Scanner для detecting existing tool installations. Phase 5 risk: «Environment Scanner может находить unknown user customizations — UX должен быть graceful при clarification requests».

**Вопросы для kickoff:**
- Какие detectable artifacts в Stage 1 (profile) — bins / configs / running processes?
- Если detect already-installed cc-sdd (different version) — install через `replace` или refuse?
- Conflicts: user has custom `.kiro/` — preserve / archive / refuse?

### C.3 Handoff format validation by real adapter

**Контекст:** Phase 4 produces `handoff.md` с frontmatter + 13 sections + embedded artifact excerpts. Phase 5 adapter consumes handoff. Real adapter может surface field gaps / format mismatches.

**Вопросы для kickoff:**
- Adapter parsing robustness — markdown parser library или regex?
- Missing optional field в frontmatter → graceful degradation или refuse?
- cc-sdd `/kiro:spec-init` expects specific input shape — какие transformations нужны?

### C.4 Decision journal autolog cadence (Integrator)

**Контекст:** Phase 5 hook `journal-hook.js` autologs «every modifying action». Возможны bloat issues (precedent: DEC-DEV-0023 cascade-pending 396 entries).

**Вопросы для kickoff:**
- Что считается «modifying action» — install / remove / update / config changes?
- Dedup strategy (same action twice → single entry)?
- Retention policy / pruning?

### C.5 `/integrator:remove` rollback safety

**Контекст:** Phase 5 ships `remove.md` с «impact analysis + backup + cleanup». Phase 4 precedent для `/ecosystem:update` (DEC-DEV-0020): backup default + never-copy zones documented.

**Вопросы для kickoff:**
- Backup location: `.claude-backup-<timestamp>/` (per /ecosystem:update precedent)?
- Impact analysis — что в `.product/handoffs/` ссылается на cc-sdd? Dependent artifacts?
- User confirmation gate (destructive) — `--confirm` flag или interactive prompt?

---

## D. Дисциплина scope для Phase 5 (🟡 важно — против over-engineering)

### D.1 Adapter — только cc-sdd или multiple?

**Опции:**
- A. Only cc-sdd как reference (per ROADMAP)
- B. cc-sdd + Kiro (если Kiro adapter trivial expansion)
- C. cc-sdd + adapter framework (generalize first)

**Рекомендация (substrate):** A — first adapter manual + reference. Generalization premature без 2-3 adapters experience.

### D.2 Pilot point после Phase 5 — формальный gate?

**Контекст:** ROADMAP Phase 5 + «🎯 PILOT POINT». Real end-to-end pilot — bootstrap → init → plan → feature → handoff → integrator → adapter → cc-sdd.

**Вопросы:**
- Pilot — отдельный «Phase 5.K» activity или integrated в Phase 5 closure?
- Acceptance criteria для pilot point — 1 FM end-to-end? 2-3 FM? Time-boxed (1 week)?
- Findings format — `DEC-DEV-NNNN — Pilot point results` ретроактивный entry?

---

## E. Гейт пилотной валидации (🔴 блокер — самый важный пункт)

### E.1 End-to-end pilot run

**Required before Phase 6 (Design Module conditional) и Phase 7 (Integrator maintenance):**

- [ ] Bootstrap fresh project (greenfield)
- [ ] `/product:init` Discovery (PS → MR → CA → SEG → VP → HYP)
- [ ] `/product:plan` Planning (MVP → RM → RL-001 → FM skeletons)
- [ ] `/product:feature FM-001` Enrichment (F.1-F.10)
- [ ] `/product:handoff FM-001` Handoff generation
- [ ] `/integrator:add cc-sdd` Installation + adapter
- [ ] Adapter invokes cc-sdd `/kiro:spec-init` → `.kiro/specs/FM-001/spec.json` created
- [ ] Human review generated spec

**Acceptance:** 1 FM end-to-end с no critical regressions; findings logged.

### E.2 Решение: продолжать с Phase 6/7 или revisit?

**По результатам pilot:**
- [ ] Если pilot прошёл — переходить к Phase 6 (если FM с has_ui=true) или Phase 7
- [ ] Если pilot выявил architectural regression — fix prior к Phase 6/7
- [ ] Если pilot revealed scope mismatch — revisit Phase 6/7 priorities

---

## F. Мета (🔵 необязательно)

### F.1 Memory sync after Phase 4

- [x] `project_ecosystem_status.md` updated в K1 (already done as part of closure docs)
- [ ] `project_ecosystem_architecture.md` — refresh D7 state per F9 (Stages 3-6 shipped, не Stage 2 only) + add Phase 4 architectural patterns (three-tier DA hierarchy, canonical DA findings schema, hash utility, V-H-* extension, language discipline section). См. Section A.4.3 above.
- [x] `MEMORY.md` index updated (closure F8 inline fix)

### F.2 Дисциплина CHANGELOG vs DEV_JOURNAL (продолжение)

- [ ] Каждое значимое исправление/решение в Phase 5 → запись в DEV_JOURNAL
- [ ] CHANGELOG обновляется только при release-worthy (например, 1.3.0 после Phase 5)

### F.3 ROADMAP «How this roadmap evolves» refinement

**Pattern observed (DEC-DEV-0032 lesson 6):** 2-3x multiplier ROADMAP estimate стабильно после kickoff revision (Phase 2: 4-6h → 10h; Phase 3: 4-6h → 12h; Phase 4: 3-4h → 12-15h).

- [ ] Update ROADMAP § «How this roadmap evolves» с empirical multiplier note для future phase planning

### F.4 Ревью приоритетов backlog'а v1.1

После Phase 5 + pilot:
- [ ] D.7 aspirational layer — bring-forward triggers met?
- [ ] `/product:clarify` channel — Phase 5 adapter revealed receiver needs?
- [ ] Subagents в Deep mode — упёрлись в лимиты Quick mode?

---

## H. Refinement кандидаты для phase-closure.md (per DEC-DEV-0033)

**Контекст:** closure run обнаружил повторяющиеся patterns:
- F1, F2 — recurring rot, который Step 1.4 (root doc snapshot refresh, добавлен Phase 3 closure DEC-DEV-0018) должен был ловить, но не поймал
- F5 — DEC-DEV-0031 lesson 2 («git grep `<old wording>` после design deviation = mandatory pre-commit check») провалился внутри того же DEC-DEV cycle
- F3, F7 — phase tracker checkbox flip от [ ] к [x] не происходит автоматически; checklist это не enforces
- F6 — naming consistency между filesystem paths и doc references не sweep target

Checklist-as-text недостаточно для recurring class issues. **Кандидаты на promotion (checklist → automated script):**

### H.1 — Step 1 root-doc snapshot diff check (high ROI)

**Закрывает:** F1, F2 класс (recurring 3 instances: DEC-DEV-0018 + DEC-DEV-0033).

**Идея:** node script (~30-40 строк) который:
1. Читает `ROADMAP.md` секцию «Где мы сейчас»
2. Читает `README.md` line 5 status banner
3. Читает `CLAUDE.md` секцию «Где мы сейчас» snapshot
4. Сравнивает Phase X completion claims между трёх документов
5. Flag если desync: «README claims Phase 0-3 shipped; ROADMAP claims Phase 0-4 shipped — drift»

**Location:** `dev/meta-improvement/scripts/check-root-doc-snapshots.js`
**Integration:** add к `verify-hooks.js` chain (or separate `verify:docs` script в package.json)
**Phase 4 closure proof:** F1+F2 fixes — точно такой diff каждый раз; ROI confirmed.

**Effort:** ~30 мин implementation + ~10 мин integration к phase-closure.md Step 1.

### H.2 — Step 4 phase tracker [ ] → [x] sweep (medium ROI)

**Закрывает:** F3, F7 класс (recurring: Phase 3 acceptance не закрыто к Phase 3 closure; same pattern surfaced Phase 4 closure).

**Идея:** node script который parses ROADMAP.md + SPEC.md §14 для секций «### N — Phase M …» где статус-баннер начинается с ✅ или COMPLETED, и проверяет всех `[ ]` checkbox'ов в following acceptance list — flag если их > 0.

**Edge cases:**
- Phase 4 acceptance `[ ]` для legitimately pending (runtime smoke deferred) — нужно white-list через subtitle marker «pending» / «→ Phase N+1»
- Phase 3 Planning shipped, Deep deferred — partial completion needs nuance

**Effort:** ~45-60 мин (parsing is straightforward; edge case handling нужен).

### H.3 — SPEC.md hook section sync check (medium ROI)

**Закрывает:** F5 класс (post-design-deviation drift в SPEC). Lesson 2 of DEC-DEV-0031 уже codified, но мануально не enforced.

**Идея:** для каждого `hooks/<module>/*.js`:
1. Extract `// @event` JSDoc tag (или first comment block с event type info)
2. Find corresponding section в `docs/<module>/SPEC.md` (heuristic: section header containing the hook filename)
3. Verify event type wording matches («PreToolUse» / «PostToolUse» / «UserPromptSubmit» / etc.)
4. Flag если mismatch

**Caveat:** SPEC body может быть outdated independently of header; full body validation сложнее. Header check — first iteration.

**Effort:** ~45 мин (~75 мин если body validation добавляется).

### H.4 — Command path filesystem vs docs consistency check (medium ROI, low effort)

**Закрывает:** F6 класс.

**Идея:** one-liner script:
```bash
for f in commands/<module>/*.md; do
  cmd_name=$(basename "$f" .md)
  # Find references that use ':' where filesystem uses '-'
  grep -rE "/<module>:${cmd_name//-/[:-]}" docs/ skills/ commands/ \
    | grep -v "/<module>:${cmd_name}"
done
```

Catches `/product:nfr:review` references когда file = `/product:nfr-review`.

**Effort:** ~15 мин (script + integration к Step 4).

### H.5 — Promote Step 1.4 (root doc snapshot refresh) from text-only к automated

**Текущий статус:** [phase-closure.md:89-93](dev/meta-improvement/checklists/phase-closure.md:89) — text instructions only. Phase 3 closure introduced this; Phase 4 closure showed text не enforces.

**Действие:** integrate H.1 script в Step 1; pass = exit 0; fail = surface diff inline + offer one-shot edit.

---

**Recommendation для Phase 5 closure (DEC-DEV-NNNN):** implement H.1 + H.4 (highest ROI, lowest effort, closes 2 recurring classes). H.2 + H.3 — candidates если H.1/H.4 surface ещё recurring patterns. Don't promote prematurely (CONVENTIONS §3 hierarchy: checklist → script only когда manual proves repeatable + heavy).

**Anti-pattern предупреждение:** не превращать D7 в полностью автоматизированный inspector. Manual closure ritual важен для surfacing судебных findings (e.g., F5 spec drift) которые automation не поймает. Scripts — для recurring mechanical class issues, не для semantic analysis.

---

## G. Definition of Done для Phase 5

Phase 5 считается «done», когда:
- [ ] `/integrator:add cc-sdd` проходит 6 stages без manual intervention
- [ ] `pmo-mapping.yaml` обновляется с cc-sdd coverage
- [ ] Adapter берёт `.product/handoffs/FM-001-handoff.md` и invokes `/kiro:spec-init`
- [ ] `.kiro/specs/FM-001/spec.json` создаётся с корректным content
- [ ] `/integrator:remove cc-sdd` безопасно rollback с backup
- [ ] `/integrator:update cc-sdd` detects drift при version upgrade
- [ ] Decision journal logs каждое modifying action
- [ ] **Pilot point** (Section E.1) — 1 FM end-to-end completed
- [ ] DEV_JOURNAL: findings + ключевые решения Phase 5
- [ ] CHANGELOG: `[1.3.0]` или аналог
- [ ] Phase 5 closure ritual (Unit 2 D7) — own DEC-DEV refinement entry

---

## Совет: как пользоваться этим чек-листом

**Состояние на 2026-05-13:** skeleton from Phase 4.K1 closure. Sections A (Phase 4 closure ritual) и B (Phase 4 runtime smoke) — outstanding actions BEFORE Phase 5 kickoff session. Sections C-G — substrate для kickoff session (per `dev/meta-improvement/checklists/phase-kickoff.md`).

**Phase 5 implementation start sequence:**
1. Complete Section A (Phase 4 closure ritual) — fresh-session run
2. Complete Section B (Phase 4 runtime smoke) — user-driven Claude Code session
3. Kickoff session per phase-kickoff.md — resolve Section C architectural questions через DEC-DEV-NNNN entry
4. Implementation sub-phases A→J→K
5. Section E pilot validation gate
6. Closure ritual Unit 2

**Если в процессе Phase 5 вскроется что-то, что должно было быть здесь** — добавь сюда новой секцией (для готовности Phase 6) + запиши в DEV_JOURNAL.
