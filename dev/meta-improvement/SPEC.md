# D7 — Meta-Improvement Module — Specification (v1.0 final)

> **Статус:** v1.0 final state (2026-04-28). Stage 1-6 shipped per DEC-DEV-0015..0021. Original substrate (preliminary draft 2026-04-27) preserved в этом документе как «historical context»; v1.0 mechanisms = checklists + patterns + skills + scripts + hooks operational.
> **Назначение этого документа:** authoritative spec для D7 — concerns, principles, mechanisms, conventions, refinement protocol. Substrate sections (origin observation, two-layer framing, reference model) preserved для context.
> **Owner:** ecosystem creator (developer side), не end-user продуктового проекта.
> **Местоположение:** `dev/meta-improvement/` — developer territory, не консьюмерская часть экосистемы (не копируется в user projects через `/ecosystem:bootstrap`/`/ecosystem:update`).
> **Mechanisms (v1.0):** [`CONVENTIONS.md`](CONVENTIONS.md) §1-§10 + [`checklists/phase-{kickoff,closure}.md`](checklists/) + [`patterns/`](patterns/) (5) + [`skills/memory-sync.md`](skills/memory-sync.md) + [`scripts/verify-update.sh`](scripts/verify-update.sh) + [`hooks/phase-closure-reminder.js`](hooks/phase-closure-reminder.js).
> **Continued evolution:** через CONVENTIONS §10 refinement protocol per phase closures. Structural growth complete; ongoing changes are refinements, не expansions.

---

## 1. Origin & Purpose

### 1.1 Trigger observation (2026-04-27, Phase 3 closure conversation)

После реализации Phase 3 user surfaced four post-phase hygiene rules that не выполняются systematically:

1. **Documentation health check** — пройтись по всем артефактам Ecosystem 3.0 (ROADMAP, README, SPEC, DEV_JOURNAL, processes, validation, artifacts) после каждой phase, найти doc rot.
2. **Bootstrap install/update verification** — проверять готовность bootstrap mechanism устанавливать/обновлять экосистему до последней версии с готовой phase.
3. **Documentation consistency check** — проверять всю документацию на соответствие актуальному состоянию после изменений.
4. **Cleanup/archive obsolete information discipline** — не бояться подчищать/архивировать; observation: «вносим в экосистему примерно в 10-15 раз больше содержания, чем чистим/меняем» — это alarming ratio для долгосрочного healthy state.

### 1.2 Two-layer system (methodological framing)

**Level A (продуктовый):** Ecosystem 3.0 как инструмент управления **чужими** продуктами. Это то, что описано в SPEC: D1 (Discovery) → D2 (Behavioral spec) → handoff → D3-D6 через внешние инструменты.

**Level B (мета):** **Сама Ecosystem 3.0** как продукт, который мы строим с AI-assist'ом. У этого уровня нет своей формализованной методологии разработки.

**D7 — Meta-Improvement Module addresses Level B exclusively.**

### 1.3 Distinction from D6 (integrator-module) — clarified

**D6 — integrator-module** (existing, designed): governance over **user's PMO** через Integrator Module + human. Tool ecosystem evolution для конкретного продуктового проекта пользователя.

**D7 — meta-improvement** (new, this module): governance over **Ecosystem 3.0 development itself**. Standalone module, owned by ecosystem creator, **не Product Module recursion**, не «.product/ для самой Ecosystem».

Эти связанные но разные уровни управления:
- D6 живёт в user projects, deployed через bootstrap, использует Integrator infrastructure
- D7 живёт в этом репозитории (dev/), не deployed, использует свои собственные conventions

### 1.4 Self-application principle (clarified by user 2026-04-27)

**D7 ≠ ecosystem-as-product managed by Product Module recursively.**

Self-referential collapse risk (warned in [CLAUDE.md §3](../../CLAUDE.md)) avoided by explicit separation:
- D7 has **own conventions** (TBD в design session) — может borrow patterns (DEV_JOURNAL pattern, gates pattern), но не reuse Product Module commands/skills directly
- D7 — **separate module** in spirit of architectural cleanliness
- Не превращаем Ecosystem 3.0 в свой собственный customer

---

## 2. Reference Model Skeleton

Synthesis из общих практик «AI-assisted system construction» + наш собственный опыт через Phase 0-3. **Это не каноническая модель — это substrate для design session**, который может его revise.

### 2.1 Seven components (initial enumeration)

| # | Component | What it does | What we have | Gap |
|---|---|---|---|---|
| 1 | **Theory externalization** (Naur 1985) | AI не несёт «теорию» через сессии — она должна быть в файлах | DEV_JOURNAL ✓, CLAUDE.md ✓, Memory MCP ✓ | Pattern library (named patterns) отсутствует — DEC-DEV entries сырые, не distilled |
| 2 | **Phase kickoff hygiene** | Перед implementation: readiness gate, ambiguity sweep, spec drift sweep | Делалось ad-hoc в DEC-DEV-0012/0013 — отлично сработало (3-5x ROI) | Не формализовано как **повторяемый pattern** — каждый раз изобретается |
| 3 | **Phase closure hygiene** | После implementation: doc health, bootstrap regression, cleanup, memory sync | **Полностью отсутствует** — primary user observation | Чек-лист и/или skill/command |
| 4 | **Drift management** | Spec drift sweep, frontmatter convention, doc rot detection | B.1 convention ✓, ad-hoc grep sweeps ✓ | Регулярная проверка doc rot не делается; doc rot обнаруживается reactive (как DEC-DEV-0013 §14.2 stale) |
| 5 | **Memory & continuity** | Cross-session decision memory + bootstrap для AI каждой сессии | DEV_JOURNAL + CLAUDE.md + Memory MCP — three layers | Memory MCP не синхронизируется автоматически с DEV_JOURNAL — drift возможен |
| 6 | **Validation gates** | Smoke tests, acceptance criteria, pilot validation | Делали в DEC-DEV-0008 + Phase 3.I plan ✓ | Bootstrap regression test отсутствует |
| 7 | **Self-application discipline** | Использовать собственные методы для собственной работы (без recursion) | DEC-DEV-0007 проговорил dogfooding direction | TBD — design session определит meaning без recursion |

### 2.2 Existing capabilities (don't reinvent)

D7 design must **leverage существующие capabilities**, not duplicate:

- **DEV_JOURNAL.md** (root) — cross-session decision memory; DEC-DEV-NNNN entries (currently 0001-0014). Pattern proven через 3 phases.
- **CLAUDE.md** (root) — context loader для AI sessions, principles, conventions. Auto-loaded by Claude Code.
- **Memory MCP** — persistent memory entries в `~/.claude/projects/<project>/memory/`. Notes user role, project status, architecture summary, methodology agreements.
- **`dev/` folder convention** — developer-only documents (PHASE_3_READINESS, PHASE_4_READINESS, v1_1_backlog, smoke test plans). Not in user projects.
- **Conventional commits** + per-sub-phase commit cadence (10 commits для Phase 3) — discipline pattern.
- **B.1 frontmatter convention** (CLAUDE.md «Skill конвенции») — explicit templates с anti-pattern field name lists.

### 2.3 Identified gaps (what D7 must address)

Из observation user + retrospective Phase 3:

1. **Phase closure formal checklist** — primary gap; user's main concern.
2. **Bootstrap regression test** — no automated verification что Phase N changes installable cleanly.
3. **Doc rot detection** — happens ad-hoc only (DEC-DEV-0013 каскад grep'ов после-фактум; не proactive).
4. **Cleanup discipline** — 10-15:1 add:cleanup ratio, не sustainable long-term. Без cleanup discipline file count + complexity exponentially растёт.
5. **Memory sync automation** — Memory MCP entries могут устаревать relative к DEV_JOURNAL/CLAUDE.md. CLAUDE.md явно warning'ует «Memory может устаревать».
6. **Pattern library** — DEC-DEV entries сырые. Нет «named patterns» которые можно reference (вроде «применить Spec Drift Sweep pattern перед закрытием refactor»).
7. **Phase kickoff template** — каждый раз изобретается. DEC-DEV-0012 + 0013 + Phase 3 kickoff prompt этого conversation — три повторения одного pattern, не codified.

---

## 3. Stage 1 (this document) — Capture only

User clarified scope (ответ #4):

> stage 1 scope - давай вынесем все наши наработки и информацию по этой теме из этого чата в предварительную спецификацию этого модуля и напишем заранее промпт для продолжения проектирования механизмов + процессов для этого модуля в другой сессии.

**Stage 1 deliverables (этот commit):**
- `dev/meta-improvement/SPEC.md` (этот документ) — preliminary spec, capture только
- `dev/_archive/meta-improvement/DESIGN_KICKOFF.md` — kickoff prompt для следующей сессии (архивирован после завершения Stage 1-6)
- DEV_JOURNAL DEC-DEV-0015 — decision entry о создании D7 module preliminary

**Stage 1 НЕ включает:**
- Retroactive Phase 3 closure hygiene (откладывается на design session или после неё)
- Final mechanism design (skills, commands, hooks)
- CLAUDE.md updates с D7 references (defer to design session)
- Naming conventions для D7 entries (DEC-META vs DEC-D7 — open question)

**Stage 2+ (subsequent sessions):** см. `dev/_archive/meta-improvement/DESIGN_KICKOFF.md` (архивирован).

---

## 4. Initial principles (extracted from this conversation)

Эти принципы нужно validate в design session — могут быть refined.

### 4.1 Cuttable scope

Premature abstraction risk: D7 не должен пытаться cover все 7 reference model components сразу. Сделать **только phase closure hygiene** в первую итерацию (это primary user pain), затем emerge other components organically. Принцип «cuttable scope» из CLAUDE.md применяется к D7 design самой.

### 4.2 Pattern emerge before formalize

DEC-DEV entries — raw material для patterns. **Не formalize до 2-3 phases используют методологию** — иначе паттерн закрепляется как abstraction без real-world validation.

DEC-DEV-0012 + 0013 + сегодняшний kickoff prompt — три повторения «readiness/kickoff» pattern. Уже достаточно для extraction.

DEC-DEV-0014 — first phase closure pattern instance. Слишком ранний для generalization. Нужны Phase 4 + 5 closure для emergence.

### 4.3 Separate from product modules

Per user clarification #3:
- D7 не использует Product/Design/Integrator namespaces (commands, skills, agents, hooks)
- D7 имеет свои conventions (TBD)
- Может **borrow patterns** (DEV_JOURNAL pattern, frontmatter discipline) но **не reuse implementation**
- Это поддерживает architectural cleanliness — нет recursion

### 4.4 dev/ location, not docs/

`dev/meta-improvement/` — developer territory:
- Не deployed через `/ecosystem:bootstrap` (не нужен в user projects)
- Не часть consumer documentation
- Эволюционирует с development pace, не release cadence

### 4.5 Real ROI focus

Phase closure hygiene = primary user need (10-15:1 ratio observation). Всё остальное (pattern library, kickoff template formalization, etc.) — downstream value. Design session должна prioritize closure hygiene.

### 4.6 Self-application without self-recursion

D7 governs ecosystem development practices. Не делает Ecosystem 3.0 «product managed by Product Module». Конкретные mechanisms TBD — но architectural separation обязательна.

---

## 5. Anti-patterns to avoid (in D7 design)

Следующие failure modes специфичны для meta-domain design. Design session должна explicitly guard against:

1. **Self-referential collapse** — Ecosystem 3.0 governing its own development по своим product rules → infinite recursion of complexity. Mitigation: D7 как отдельный module с собственными конвенциями.

2. **Premature abstraction** — generalize patterns до 2-3 instances proves emergence. Mitigation: phase closure pattern имеет 1 instance (DEC-DEV-0014); extract что есть, defer abstraction до 3rd phase closure.

3. **Documentation rot of D7 itself** — meta-doc о doc rot risk is ironic if it itself rots. Mitigation: D7 docs тоже подвержены Phase closure hygiene (но владелец — D7 itself; recursion contained).

4. **Tooling over discipline** — формализовать всё как automation (skills/commands/hooks) когда manual checklist + memory sufficient. Mitigation: первая итерация — checklist, не skill/command. Skill только когда checklist выполняется regularly + manually + достаточно сложен.

5. **Scope creep via «wouldn't it be nice»** — meta-domain attractor для feature ideas («wouldn't be cool if cleanup auto-archived?»). Mitigation: scope discipline section в design session output, явный «Out of Scope» list.

6. **Disregarding user's actual pain** — user observed 4 specific rules. D7 design должен address them explicitly, не replace с «better» abstractions. Mitigation: design session validates каждый из user's 4 rules как explicit requirement.

7. **Premature dogfooding** — DEC-DEV-0008 said dogfooding is premature. D7 should not «manage Ecosystem 3.0 development through Ecosystem 3.0 own machinery». Mitigation: D7 own machinery (TBD), не Product Module reuse.

8. **Heavy ceremony in dev workflow** — D7 should reduce cognitive load для developer (us), не add. Mitigation: D7 mechanisms должны быть **net-positive on developer time** — measured by «как быстро Phase 4 closure run vs Phase 3 без D7».

---

## 6. Open questions for design session

Каждый — TBD по design session, не сейчас.

### 6.1 Naming convention

- **Entries**: `DEC-META-NNNN` или `DEC-D7-NNNN` или продолжать sequence `DEC-DEV-NNNN`? Argument для продолжения: meta-domain decisions are dev decisions; argument for separate: distinct concern, distinct sequence aids navigation.
- **Documents**: какой prefix внутри `dev/meta-improvement/`? `D7_*.md` или просто `*.md`? 
- **Mechanisms** (если будут): `commands/meta-improvement/*.md`? `skills/meta-improvement/*.md`? Или НЕ deploy, а only `dev/meta-improvement/checklists/`?

### 6.2 Mechanism ratio (skill/command/hook/checklist)

Куда живёт каждая capability:
- Phase closure hygiene → checklist в dev/? skill для AI? command (`/ecosystem:phase-closure`)? hook (на commit «Phase X done» trigger reminder)?
- Bootstrap regression test → script? skill? command (`/ecosystem:verify --regression`)? CI?
- Doc rot detection → manual sweep? skill? scheduled task?
- Cleanup discipline → checklist? skill? command?
- Memory sync → manual? skill? automated по DEV_JOURNAL update?

Принцип scope discipline — start с минимума (checklist), elevate когда pattern proves emergence.

### 6.3 Activation triggers

Когда D7 mechanisms активируются:
- Phase closure: trigger manually (developer remembers)? Automatic detection (commit message pattern)? Hook на specific files?
- Doc rot detection: per-phase? Periodically? On-demand only?
- Bootstrap regression test: per-phase mandatory? Periodic? Optional?

### 6.4 Cleanup criteria

Когда archive vs delete vs keep:
- DEV_JOURNAL entries — ever archive? (Argument no: cross-session memory.)
- Stale dev/ docs (PHASE_N_READINESS после Phase N+2) — archive в dev/_archive/?
- Old SPEC versions — git history sufficient или separate archive folder?

### 6.5 Memory sync

Как Memory MCP остаётся синхронизирован с DEV_JOURNAL/CLAUDE.md:
- Manual periodic review (когда?)
- Skill «memory-sync» что reads DEV_JOURNAL latest entries → updates Memory entries
- Hook на DEV_JOURNAL.md write что surfaces «consider updating Memory MCP»

### 6.6 Pattern library extraction

DEC-DEV entries → named patterns:
- Extraction effort: who does it (human vs AI vs hybrid)?
- Where lives: `dev/meta-improvement/patterns/<pattern-name>.md`?
- Discoverability: index? CLAUDE.md reference?
- Examples to extract first: «Spec Drift Sweep» (DEC-DEV-0013), «Readiness Gate» (DEC-DEV-0012), «B.1 Frontmatter Convention» (DEC-DEV-0011), «Smoke Test Plan» (Phase 3.I), «Cuttable Scope Discipline» (cross-cutting)

### 6.7 Bootstrap regression test design

Как verify bootstrap correctly installs ecosystem:
- Test on temp directory? On dedicated test project?
- Integration с pilot project (`my-first-test`)?
- Automated (CI?) или manual ad-hoc?
- What's «pass» — files installed + hooks registered + commands working?

### 6.8 Failure mode handling

Что если D7 mechanism finds issue:
- Doc rot detected — auto-fix where safe? Surface к developer always?
- Bootstrap regression failed — block release? Surface only?
- Memory drift detected — sync attempt? Surface for review?
- Cleanup recommendation — auto-apply? Always manual approve?

### 6.9 Scope для first iteration

Что **обязательно** в Stage 2 (design session output):
- [ ] Phase closure checklist (manual, человек-checks-off)
- [ ] Documented (in dev/meta-improvement/) для reuse

Что **может быть** в Stage 2:
- [ ] Phase kickoff template (extracted из DEC-DEV-0012 + 0013 + Phase 3 kickoff prompt)
- [ ] Pattern library starter (3-5 named patterns)
- [ ] Bootstrap regression test plan (not implementation)

Что **defer** к Stage 3+:
- [ ] Skill/command formalization
- [ ] Hooks (если any)
- [ ] CLAUDE.md updates с D7 conventions
- [ ] Memory sync automation
- [ ] Pattern library full enumeration

### 6.10 Self-application timing

DEC-DEV-0008 said dogfooding (creating .product/ для Ecosystem 3.0 itself) premature 7 days ago. After 3 phases work — re-evaluate?

User clarification #3 says: D7 не есть «.product/ для Ecosystem». Но open question — будут ли некоторые artifacts D7 семантически похожи на Product Module artifacts (HYP, FM, etc.)? Если да — нужны separate naming, или borrow + namespace?

Возможные D7 entities (TBD design session):
- Ecosystem-level «features» (e.g., «D7 Phase Closure Mechanism» — сродни FM-NNN но не FM)
- Ecosystem-level «hypotheses» (e.g., «We hypothesize that auto bootstrap regression test reduces release defects by X%»)
- Ecosystem-level «metrics» (cleanup rate, doc rot incidents, time to phase closure)

Design session должна ответить: borrow product semantic (с D7 namespace) или disjoint vocabulary?

---

## 7. References

### Internal (this repo)

- [DEV_JOURNAL.md](../../DEV_JOURNAL.md) — для свежего контекста читай последние ~5 entries (tail, не весь журнал); эти foundational — especially:
  - DEC-DEV-0007 (DEV_JOURNAL framework establishment)
  - DEC-DEV-0008 (incremental pilot, dogfooding direction)
  - DEC-DEV-0011 (B.1 frontmatter convention)
  - DEC-DEV-0012 (architectural readiness gate)
  - DEC-DEV-0013 (ambiguity resolution + spec drift sweep)
  - DEC-DEV-0014 (Phase 3 closure lessons — 12 lessons)
- [CLAUDE.md](../../CLAUDE.md) — особенно §3 «Meta-проект — высокий risk самореферентного коллапса»
- [ROADMAP.md](../../ROADMAP.md) — Phase progression
- [dev/PHASE_3_SMOKE_TEST_PLAN.md](../PHASE_3_SMOKE_TEST_PLAN.md) — validation pattern
- [dev/PHASE_4_READINESS.md](../PHASE_4_READINESS.md) — kickoff pattern
- [dev/v1_1_backlog.md](../v1_1_backlog.md) — preserved deferred context pattern
- [docs/pmo/pmo-map.md](../../docs/pmo/pmo-map.md) — PMO domains D1-D6 (D6 here = integrator-module)

### External / methodological

- Naur (1985) «Programming as Theory Building» — code is artifact, theory must be externalized
- Brooks «Mythical Man-Month» — essential vs accidental complexity
- Lean Startup — incremental + validated learning (already implicit в Ecosystem)
- Anthropic engineering culture — post-mortems, decision docs, dogfooding patterns

### Conversation source

This SPEC extracted из conversation 2026-04-27, в рамках Phase 3 closure / Phase 4 prep methodology discussion. Original observation by user; reference model skeleton synthesized в response. Design session должна revise both based on research + discussion.

---

## 8. Status update protocol

Этот документ — **snapshot 2026-04-27**. После design session (Stage 2):
- Этот документ может быть refactored к full SPEC (similar к docs/product-module/SPEC.md style)
- Или stay preliminary if Stage 2 reveals scope further reduction
- Или archive если D7 cancelled (architectural reconsideration)

Decisions из design session записываются в DEV_JOURNAL DEC-DEV-NNNN sequence (или DEC-META-NNNN если такая convention selected — open question 6.1).

---

## 9. Distillation of one principle (если только один — этот)

**«D7 — это не «нашему развитию нужна та же дисциплина что мы даём пользователям». D7 — это «нашему развитию нужна **своя** дисциплина, которая позволяет пользователям получать качественные инструменты». Это два разных уровня; их смешение — источник самореферентного коллапса.»**

Этот принцип guards против over-borrowing Product Module patterns. D7 borrows patterns когда они полезны (cuttable scope, B.1 convention discipline), но строит **own machinery** для unique meta-domain concerns (phase closure, bootstrap regression, doc rot, cleanup).
