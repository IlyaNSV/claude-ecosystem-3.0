# Чек-лист готовности к Phase 5

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 5 (Integrator Phase 2 — Installation + first adapter).
>
> **Статус (2026-05-13):** ⏳ **Skeleton created в Phase 4.K1 closure**. Architectural questions queued; user-driven kickoff session нужна перед sub-phase A start.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждому пункту присвоен приоритет: 🔴 блокер, 🟡 важный, 🔵 необязательный.

---

## Статус-баннер

⏳ **Phase 4 implementation completed (DEC-DEV-0032, 2026-05-13).**
⏳ **Phase 4 closure ritual (Unit 2) pending fresh-session run.**
⏳ **Phase 4 runtime smoke (S1-S13+S15) pending user-driven Claude Code session.**

**Перед стартом Phase 5 implementation:**
- [ ] **Phase 4 closure ritual (Unit 2 — D7 phase-closure.md 6 steps)** — fresh-session preferred per anti-bias guard. Produces own `DEC-DEV-NNNN — Phase 4 closure run + checklist refinement` entry. Findings might surface refinements applicable к Phase 5 (e.g., bootstrap regression coverage, doc consistency gap).
- [ ] **Phase 4 runtime smoke** (S1-S13+S15 per `dev/PHASE_4_SMOKE_TEST_PLAN.md` Section B) — user-driven Claude Code session с existing `.product/` data (либо `my-first-test` либо dogfood `.product/` для Ecosystem 3.0). Findings → retroactive `DEC-DEV-NNNN — Phase 4 smoke test results` entry. Precedent: Phase 3 = DEC-DEV-0023.
- [ ] **Phase 5 readiness gate** — этот checklist completed; architectural questions resolved (Section C below); scope confirmed (Section D); pilot validation prepared (Section E).

**Гейт Phase 4 implementation closed** (DEC-DEV-0032). Closure ritual + runtime smoke + Phase 5 readiness — non-blocking pour user, recommended последовательность перед Phase 5 implementation start.

---

## A. Результаты Phase 4 closure ritual (Unit 2) — pending

### A.1 Fresh-session phase-closure.md 6 steps

Per `dev/meta-improvement/checklists/phase-closure.md`. Recommended fresh-session per anti-bias guard. Template invocation message в checklist «Invocation» section.

- [ ] Step 1 — Documentation health check (≤15 min): doc rot sweep; status banners current; cross-doc Phase 4 references resolved
- [ ] Step 2 — Bootstrap install/update verification (≤20 min): re-bootstrap или `/ecosystem:update` на pilot project (`my-first-test` или dogfood); verify Phase 4 additions installed; hook count expected = 7 (including `product-handoff-gate.js`)
- [ ] Step 3 — Hook runtime smoke (≤5 min): `node dev/meta-improvement/scripts/verify-hooks.js`; expect 8/8 PASS (incl. functional [drift-on-second-artifact] case)
- [ ] Step 4 — Documentation consistency check (≤10 min): hook manifest ↔ processes.md ↔ SPEC alignment; CHANGELOG `[1.2.0]` Added entries resolve; B.1 convention compliance в random sample skills
- [ ] Step 5 — Cleanup / archive discipline (≤10 min): verify `PHASE_4_READINESS.md` + `PHASE_4_DECISIONS.md` archived (done in K1); orphan «TODO Phase 4» markers grep; dev/ count reasonable
- [ ] Step 6 — Memory MCP sync (≤10 min): `~/.claude/projects/<slug>/memory/project_ecosystem_status.md` current; architecture file reflects Phase 4 patterns

### A.2 Closure ritual DEC-DEV entry

- [ ] **DEC-DEV-NNNN — Phase 4 closure run + checklist refinement** записан с findings ритуала + refinements к checklist если pain emerged

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

- [ ] `project_ecosystem_status.md` updated в K1 (already done as part of closure docs)
- [ ] `project_ecosystem_architecture.md` — add Phase 4 architectural patterns (three-tier DA hierarchy, canonical DA findings schema, hash utility, V-H-* extension, language discipline section)
- [ ] `MEMORY.md` index updated

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
