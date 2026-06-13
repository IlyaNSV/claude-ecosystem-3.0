# Чек-лист готовности к Phase D (Docs Wiki)

> ⏸ **STATUS: DEFERRED to v1.1+ (2026-05-27)** per DEC-DEV-0046.
>
> **Active alternative:** [`dev/plans/LOCAL_DOCS_POLISH_PLAN.md`](../plans/LOCAL_DOCS_POLISH_PLAN.md) (Obsidian + README polish, 4-9h).
>
> **Rationale:** phantom-audience guard fired. Pre-pilot Ecosystem 3.0 не имеет real end-user/stakeholder consumers; single active audience — solo dev. Непропорционально инвестировать 32-50h в 3-audience wiki когда 80% value достижимо через 4-9h light-touch альтернативу.
>
> **Bring-forward triggers** (любого достаточно):
> - First real end-user feedback / ask «where do I start»
> - Stakeholder asks for shareable URL
> - Solo dev обнаруживает Obsidian недостаточным (audience-tagging, cross-tool sharing)
> - Ecosystem 3.0 готовится к public release (>2 weeks horizon)
>
> **Preservation:** все Phase D artifacts сохранены без изменения тела — этот readiness gate, [`dev/deferred/wiki-design.md`](wiki-design.md), [`dev/deferred/PHASE_D_IMPLEMENTATION_PLAN.md`](PHASE_D_IMPLEMENTATION_PLAN.md). Resumption — fresh-session kickoff per Section H instructions.
>
> ---
>
> **Назначение (original):** проверки и решения, которые нужно сделать **до** старта Phase D implementation (интерактивная документация по самой Ecosystem 3.0 в стиле Confluence через MkDocs Material + Charter + auto-sync action).
>
> **Статус (на момент создания, 2026-05-26):** ⏳ дизайн заморожен (см. [`dev/deferred/wiki-design.md`](wiki-design.md)); implementation **заблокирован Phase 5 closure ritual Unit 2**. *(Phase 5 closure completed via DEC-DEV-0044 + 0045; Phase D briefly UNBLOCKED 2026-05-26 → 2026-05-27 before deferral.)*
>
> **Принцип:** Phase D — meta-инфраструктура, не product feature. Аудитория тройная (solo dev memory + end-users + stakeholders). Не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждому пункту присвоен приоритет: 🔴 блокер, 🟡 важный, 🔵 необязательный.

---

## Status banner

⏳ **Design frozen, implementation blocked.** Все архитектурные развилки разрешены через design conversation 2026-05-26 (см. [`dev/deferred/wiki-design.md`](wiki-design.md) §A-K). Implementation стартует **после** Phase 5 closure ritual Unit 2 + runtime smoke S1-S6.

**Перед стартом Phase D implementation:**
- [ ] Phase 5 closure ritual Unit 2 (D7 phase-closure.md 6 steps) — fresh session
- [ ] Phase 5 runtime smoke (S1-S6 per `dev/PHASE_5_SMOKE_TEST_PLAN.md`) executed; results audited
- [ ] DEV_JOURNAL DEC-DEV-NNNN — Phase D scope зафиксирован формально (на момент open Phase D)
- [ ] ROADMAP обновлён: Phase D вставлена между Phase 5 closure и Phase 6 trigger evaluation
- [ ] Phase D kickoff session (per `dev/meta-improvement/checklists/phase-kickoff.md` — **fresh-session recommended** для bias-resistance, т.к. design conversation на момент Phase 5 closure pending)

---

## A. Phase 5 closure prerequisites (🔴 блокер)

### A.1 — Phase 5 closure ritual Unit 2

Per `dev/meta-improvement/checklists/phase-closure.md`. Fresh-session run required (anti-bias guard).

- [ ] Step 1 — Documentation health check
- [ ] Step 2 — Bootstrap install/update verification (`/ecosystem:update` в pilot если F4 ещё pending)
- [ ] Step 3 — Hook runtime smoke (post Phase 5 hooks: `journal-hook.js`)
- [ ] Step 4 — Documentation consistency check
- [ ] Step 5 — Cleanup / archive discipline
- [ ] Step 6 — Memory MCP sync (Phase 5 architecture additions: dual-location adapter, subagent structural template, functional PMO refactor)
- [ ] DEC-DEV-NNNN closure entry с findings + refinements

### A.2 — Phase 5 runtime smoke

- [ ] S1-S6 per `dev/PHASE_5_SMOKE_TEST_PLAN.md` executed в pilot
- [ ] Aggregate audit-report в `dev/meta-improvement/audit-reports/phase-5-summary.md`
- [ ] Status (pass/partial/fail) → если fail, решить blocking vs known-issues (precedent: Phase 4 DEC-DEV-0038)

### A.3 — Закрытые findings, релевантные Phase D

Если в Phase 5 closure surface'нутся:
- Hook registration patterns (precedent: `product-devils-advocate` registration gap из Phase 4 closure) — релевантно для `protect-wiki-charter.js` (PreToolUse + git pre-commit duo)
- Spec drift sweep mechanics — релевантно для wiki source-to-target map design
- Memory sync gaps — релевантно для wiki ↔ memory boundary (decisions/ wiki cross-link to DEV_JOURNAL)

→ зафиксировать в этом readiness Section H перед kickoff.

---

## B. Дизайн-решения Phase D — ✅ ЗАМОРОЖЕНЫ (design conversation 2026-05-26)

> **Status:** все архитектурные развилки разрешены через design conversation. Полный rationale + alternatives в [`dev/deferred/wiki-design.md`](wiki-design.md). Сводка ниже; формальный DEC-DEV-NNNN entry записывается при open Phase D после Phase 5 closure.

**Сводка решений:**

| Параметр | Решение | Source |
|---|---|---|
| Аудитории | solo dev + end-users + stakeholders | wiki-design §1 |
| Истина | narrative-слой со ссылками (не aggregator) | wiki-design §1 |
| SSG | MkDocs Material | wiki-design §1 |
| Versioning | только current (без mike) | wiki-design §1 |
| Deploy | GH Pages с DW.G | wiki-design §1 |
| Charter location | `dev/wiki-charter.md` (вне wiki build) | wiki-design §2 |
| Immutability | Mission/Anti-patterns/Templates/Audience-tags/Versioning **immutable**; Taxonomy/Source-map/Exclusions **append-only** | wiki-design §2 |
| Защита Charter | PreToolUse hook + git pre-commit (anti-Bash-bypass) + `[charter-change]` commit tag | wiki-design §6 |
| Automation | GH Action на каждый push → headless Claude → draft PR | wiki-design §8 |
| Anti-cycle | triple gate: paths-ignore + commit-msg-filter + draft (не auto-merge) | wiki-design §8 |
| Cost control | exclusion list + typo-heuristic + concurrency 1/30min | wiki-design §8 |
| Decisions wiki | таблица-индекс DEC-ID → title → date → ссылка на DEV_JOURNAL | wiki-design §3 |

### B.1 — Открытые вопросы для kickoff (после Phase 5 closure)

> Заполняется при kickoff per `dev/meta-improvement/checklists/phase-kickoff.md` Section 1. Текущий design покрывает principal axes; ниже — вторичные decisions, которые можно legitimately отложить к старту implementation.

- **OQ-DW-01** — Concurrency lock для Action. GitHub Actions `concurrency: docs-sync` уровень group/cancel-in-progress vs queue?
- **OQ-DW-02** — Headless Claude CLI authentication в Action. Нужен ли OAuth flow или достаточно `ANTHROPIC_API_KEY` env? Что с rate limits на large diff'ах?
- **OQ-DW-03** — Charter section markers — какой синтаксис устойчивее к accidental edits? HTML-комментарии (`<!-- charter-section: ... -->`) предлагает design — рассмотреть альтернативы (YAML frontmatter per section, frontmatter-table, etc.).
- **OQ-DW-04** — `wiki-author` skill методология для page templates: per-page-type prompts (concept / reference / guide / decision-index) vs single skill с разветвлениями?
- **OQ-DW-05** — Reference pages auto-generation подход — Claude inline generates каждый раз, или предварительный script extract'ит metadata из frontmatter артефактов, Claude использует extracted manifest?
- **OQ-DW-06** — Cross-link maintenance — relative paths (`../concepts/modules.md`) vs MkDocs `[[wiki-link]]` plugin? Robustness против файловых перемещений?

### B.2 — Guidance по OQ-DW-06 (анализ Karpathy-style wiki concept, 2026-05-26)

> **Source:** design conversation 2026-05-26 (применимость Karpathy-style wiki к Ecosystem 3.0). Анализ покрыл 3 фронта: продуктовый wiki (deferred — Obsidian покрывает 80%), Orchestrator integration (parked — нет SPEC), Phase D enhancement (включено сюда).

**Рекомендуемая резолюция:** склоняться к `[[wiki-link]]` syntax через MkDocs plugin (`mkdocs-roamlinks` / `mkdocs-ezlinks` / similar — конкретный plugin выбирается на kickoff после quick comparison).

**Pro:**
- Rename-safe (refactor-friendly при moves в Charter §2 taxonomy — критично для evolving wiki)
- Поддержка backlinks pane (atomic networked notes pattern — отвечает на «кто ссылается на эту страницу»)
- Machine-parseable для возможного future LLM-snapshot layer (если pilot покажет need)
- Single source of truth для cross-link (vs дублирующиеся relative paths между несколькими файлами)

**Con:**
- +1 plugin dependency (не часть MkDocs Material core; учесть при build env)
- Convention учить (`[[file]]` vs `[[file|alias]]` syntax)
- `mkdocs build --strict` должен plugin-validation поддерживать (проверить на DW.G при настройке)

**Scope ограничение:** только cross-link **внутри** `docs/wiki/**`. Links на source-of-truth **вне** wiki (`../../docs/product-module/SPEC.md`, `../../../DEV_JOURNAL.md`, etc.) остаются relative paths — plugin-coverage обычно ограничен wiki tree, и cross-tree links должны выживать без plugin.

**Karpathy concept — где этот выбор стоит:** реализует один из 4 элементов (atomic + networked + LLM-friendly + living-sync). Остальные три:
- **Living-sync** — уже в Phase D design (Charter §3 source-to-target map + `/ecosystem:docs-update` + GH Action)
- **Atomic decomposition** — deferred к pilot iteration после DW.D (per design §14 «Pause for manual review»; решение на DW.D pilot pause основано на конкретной боли, не upfront)
- **LLM-snapshot layer** (aggregate `wiki-llm-snapshot.md` для AI consumption) — deferred к v1.1 candidate; bring-forward trigger: external AI consumer объявится с конкретным need

**Phantom-audience guard:** не расширять scope для несуществующих consumers. `[[wiki-link]]` решает конкретную refactor-safety боль; atomic decomposition + LLM-snapshot — нет конкретной боли сейчас.

Формальное закрепление при kickoff per `dev/meta-improvement/checklists/phase-kickoff.md` Section 1 (Ambiguity resolutions) через DEC-DEV-NNNN open-Phase-D entry. Если на kickoff появится контр-аргумент — guidance можно опрокинуть (это не frozen решение, это recommended starting position).

---

## C. Дисциплина scope для Phase D (🟡 важно — против over-engineering)

ROADMAP-стиль оценка (для записи в Phase D section ROADMAP): **16-25 ч**. Применяя эмпирический множитель ×2-4 (DEC-DEV-0032 lesson 6) — реалистично **32-50 ч**. Cuttable candidates ниже **обязательны** к рассмотрению на kickoff.

### C.1 Cuttable candidates

| Кандидат | Default | Cut-альтернатива | Bring-forward trigger |
|---|---|---|---|
| `wiki-drift-detector` skill (DW.C) | ship в Phase D | inline detection в `/docs-verify` command | first drift incident missed |
| `/ecosystem:docs-verify` command (DW.F) | ship в Phase D | manual `grep` + `find` invocation | drift surfaced 2+ раз в run between syncs |
| Nightly `docs-verify.yml` schedule | ship в Phase D | manual run раз в неделю | wiki drift unnoticed > 1 неделя |
| GH Pages deploy (DW.G) | ship в Phase D (per design) | local `mkdocs serve` only | stakeholders запрашивают URL |
| Per-page audience admonitions | ship в Charter templates | single tone (internal), audience-aware → v1.1 | stakeholders complaints about jargon |
| Headless Claude в Action (DW.H) | ship в Phase D | Action только detects drift → issue, я запускаю `/docs-update` локально | API credits drain unsustainable |

### C.2 Не-cuttable (критический путь)

- **Charter (DW.A)** — без него Phase D не существует
- **`protect-wiki-charter.js` hook (DW.B)** — immutability без enforcement = convention only, AI обойдёт
- **`/ecosystem:docs-init` (DW.D)** — bootstrap initial wiki
- **`/ecosystem:docs-update` (DW.E)** — incremental sync
- **MkDocs config (DW.G partial)** — wiki без render не Confluence-like

### C.3 Anti-pattern предупреждение

Не плодить третью копию docs/. Wiki — **narrative со ссылками**, не дублирующий слой. Если в Phase D появляется feature «копировать body SPEC.md в wiki/concepts/modules.md» — это red flag, ремап на «cross-link с краткой sentence-summary».

---

## D. Sub-phase decomposition (план implementation)

Pattern from Phase 5 (10 sub-phases A→J, per-sub-phase commits). Для Phase D:

| # | Sub-phase | Описание | Deliverables | Estimate |
|---|---|---|---|---|
| DW.A | Charter draft | Написать `dev/wiki-charter.md` (все 8 секций со маркерами) | 1 file | 2-3 ч |
| DW.B | Hook + git-precommit | `hooks/ecosystem/protect-wiki-charter.js` + manifest entry + `.githooks/pre-commit-charter.sh` + install instruction | 3 files + 1 manifest update | 1-2 ч |
| DW.C | Skills | `skills/ecosystem/wiki-author.md`, `wiki-source-mapper.md`, `wiki-drift-detector.md` (с frontmatter templates per skill convention DEC-DEV-0012) | 3 files | 2-3 ч |
| DW.D | `/docs-init` + initial wiki | `commands/ecosystem/docs-init.md` + первый `docs/wiki/**` tree + `mkdocs.yml` + `.last-sync` | ~25 files (wiki pages + config) | 3-4 ч |
| DW.E | `/docs-update` | `commands/ecosystem/docs-update.md` + dry-run mode + exclusion filter | 1 file | 2-3 ч |
| DW.F | `/docs-verify` | `commands/ecosystem/docs-verify.md` + drift detection logic | 1 file | 1-2 ч |
| DW.G | MkDocs config + deploy workflow | `.github/workflows/docs-deploy.yml` + GH Pages settings docs | 1-2 files | 1-2 ч |
| DW.H | `docs-sync.yml` workflow + headless test | `.github/workflows/docs-sync.yml` + dummy-commit test в branch | 1 file + test branch | 2-3 ч |
| DW.I | E2E pilot | dummy commit → sync action → draft PR → review → merge → deploy verify | nothing committable; findings doc | 1-2 ч |
| DW.J | Closure | DEV_JOURNAL DEC-DEV-NNNN closure entry + CHANGELOG `[1.4.0]` + smoke plan + Phase 6 readiness re-baseline | 3 doc updates | 1 ч |

**Total estimate:** 16-25 ч. Per multiplier — **32-50 ч** realistic.

**Per-sub-phase commit discipline** (per DEC-DEV-0014 lesson): каждая sub-phase = 1 commit с conventional message + mental smoke test в body. Никаких WIP коммитов.

---

## E. Гейт пилотной валидации (🔴 блокер)

### E.1 Static smoke (после DW.D)

- [ ] `docs/wiki/**` рендерится через `mkdocs build` без ошибок
- [ ] Все cross-links резолвятся (MkDocs strict mode)
- [ ] `dev/wiki-charter.md` парсится hook'ом (все секции находятся по маркерам)
- [ ] `protect-wiki-charter.js` test: попытка AI-edit immutable секции → blocked
- [ ] `protect-wiki-charter.js` test: попытка AI-edit append-only секции с modification existing entry → blocked
- [ ] `protect-wiki-charter.js` test: попытка AI-edit append-only секции с pure addition → allowed
- [ ] Git pre-commit hook test: commit с правкой Charter без `[charter-change]` tag → rejected

### E.2 Dry-run smoke (после DW.E)

- [ ] `/ecosystem:docs-update --dry-run --since=<sha 5 commits назад>` → proposes wiki changes
- [ ] Exclusion list работает: коммит, затрагивающий только `dev/**`, → 0 proposed changes
- [ ] Heuristic filter работает: typo-only commit (< 10 lines, no new files) → 0 proposed changes

### E.3 End-to-end pilot (DW.I)

- [ ] Dummy non-trivial commit в `commands/ecosystem/verify.md` (или similar) на main
- [ ] Action триггерится в течение 5 минут
- [ ] Action завершает headless `/docs-update` без error
- [ ] Draft PR создан с label `docs-auto-sync`
- [ ] PR содержит wiki diff — human review показывает: правки осмысленные, не мусор
- [ ] Merge PR → GH Pages deploy триггерится
- [ ] Deployed URL открывается, изменённая страница reflects update

### E.4 Decision: continue или revisit?

По результатам pilot:
- [ ] Если pilot прошёл — Phase D closure ritual → решить Phase 6 (Design conditional) vs Phase 7 vs другое
- [ ] Если pilot revealed что Action создаёт мусор системно → cut DW.H, оставить только manual `/docs-update`, re-evaluate
- [ ] Если pilot revealed Charter spec drift (e.g., source-to-target map не покрывает реальные patterns) → fix Charter (через `[charter-change]` commit), повторить DW.I

---

## F. Мета (🔵 необязательно)

### F.1 Memory sync after Phase D

- [ ] `project_ecosystem_status.md` — Phase D shipped (1.4.0)
- [ ] `project_ecosystem_architecture.md` — добавить wiki layer (Charter + commands + hook + action)
- [ ] `MEMORY.md` index — Phase D entry

### F.2 CHANGELOG vs DEV_JOURNAL discipline

- [ ] CHANGELOG `[1.4.0]` — Added: wiki + 3 commands + 3 skills + 1 hook + 1 action; Modified: ROADMAP с Phase D
- [ ] DEV_JOURNAL DEC-DEV-NNNN — open Phase D (scope decision); DEC-DEV-NNNN — close Phase D (findings)

### F.3 ROADMAP обновление

- [ ] Phase D вставлена между Phase 5 closure и Phase 6 trigger evaluation
- [ ] «Где мы сейчас» reflects Phase D state
- [ ] `dev/PHASE_6_READINESS.md` Section A пререкизиты обновлены (Phase D в списке)

### F.4 v1.1+ backlog

- [ ] mike versioning (если Phase D pilot выявит need)
- [ ] Per-decision wiki pages (если index-only окажется недостаточным)
- [ ] Algolia search (если MkDocs built-in search недостаточен)
- [ ] i18n (RU/EN parallel) — premature до first end-user feedback

---

## G. Definition of Done для Phase D

> Scope — **wiki + automation infrastructure**. Wiki content saturation (написать все 25 страниц с full content) — отдельный track в pilot, не Phase D DoD.

Phase D считается «done», когда:
- [ ] `dev/wiki-charter.md` существует, все 8 секций маркированы, протестирован hook
- [ ] `hooks/ecosystem/protect-wiki-charter.js` + manifest entry + git pre-commit installed
- [ ] 3 skills (`wiki-author`, `wiki-source-mapper`, `wiki-drift-detector`) с frontmatter templates per DEC-DEV-0012
- [ ] `/ecosystem:docs-init` запускается successfully на свежем репо clone — wiki tree создаётся
- [ ] `/ecosystem:docs-update` запускается с `--dry-run` и без — diff корректный
- [ ] `/ecosystem:docs-verify` запускается, drift report корректен
- [ ] `mkdocs.yml` корректен, `mkdocs build` без ошибок
- [ ] `.github/workflows/docs-sync.yml` triggered на test commit, draft PR создан
- [ ] `.github/workflows/docs-deploy.yml` deploy'ит на GH Pages
- [ ] E2E pilot pass (Section E.3)
- [ ] DEV_JOURNAL closure entry с findings + lessons
- [ ] CHANGELOG `[1.4.0]`
- [ ] Phase D closure ritual (Unit 2 D7)
- [ ] `dev/PHASE_6_READINESS.md` Section A обновлён (Phase D в prerequisites done)

---

## H. Что добавить в этот readiness после Phase 5 closure

Из lessons и findings Phase 5 (заполняется при open Phase D):

- (placeholder — заполняется по результатам Phase 5 closure ritual Unit 2)

Из known issues, которые могут проявиться в Phase D:

- `product-devils-advocate` registration gap — может всплыть при wiki skills registration (если skill loading mechanism shared)
- Phase 5 dual-location adapter pattern — релевантно для возможной аналогии: должны ли wiki commands быть generic (доступны всегда) или conditional (только если wiki initialized)?
- (другие пункты — заполняется)

---

## Совет: как пользоваться этим чек-листом

**Состояние на 2026-05-26:** Design conversation проведена; все principal axes решены; implementation **blocked** Phase 5 closure ritual. Этот readiness — placeholder для work resumption после Phase 5 closure.

### 🔴 Обязательное чтение перед Phase D implementation

1. **`dev/deferred/wiki-design.md`** — полный design doc; rationale + alternatives. Primary reference на весь implementation цикл.
2. **`CLAUDE.md`** «Hook конвенции» + «Skill конвенции» (DEC-DEV-0012) — для DW.B и DW.C compliance.
3. **`dev/meta-improvement/checklists/phase-kickoff.md`** — fresh-session kickoff mandatory перед DW.A старт.

### Phase D implementation start sequence:

1. ✅ Design conversation — done 2026-05-26 (this readiness + wiki-design.md)
2. ⏳ Phase 5 closure ritual Unit 2 — pending
3. ⏳ Phase 5 runtime smoke S1-S6 — pending
4. ⏳ Kickoff session per phase-kickoff.md (fresh-session) — после Phase 5 closure
5. ⏳ DEV_JOURNAL DEC-DEV-NNNN — Phase D open + ROADMAP insertion
6. ⏳ Sub-phases DW.A → DW.J
7. ⏳ Section E pilot validation gate
8. ⏳ Closure ritual Unit 2 + DEV_JOURNAL DEC-DEV-NNNN closure

**Если в процессе Phase D вскроется что-то, что должно было быть здесь** — добавь сюда новой секцией (для готовности Phase D+1) + запиши в DEV_JOURNAL.
