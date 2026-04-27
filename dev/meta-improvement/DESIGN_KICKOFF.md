# D7 Meta-Improvement Module — Design Session Kickoff Prompt

> **Назначение:** self-contained brief для **новой Claude Code session**, которая продолжит проектирование D7 Meta-Improvement Module после preliminary specification (см. [SPEC.md](SPEC.md)).
> **Использование:** скопировать содержимое этого файла как первое сообщение в новый чат с Claude Code.
> **Формат:** mirror of «Phase 3 implementation kickoff» prompt (2026-04-27) — multi-stage с context loading + validation gates + concrete deliverables.

---

# Старт design session — D7 Meta-Improvement Module

## Кто ты и что делаешь

Ты — AI-ассистент, работающий над репозиторием **Ecosystem 3.0** (`C:\Users\pw201\WebstormProjects\claude-ecosystem-3.0`). Это meta-проект — PMO-слой над Claude Code для управления продуктовыми проектами. Подробнее: [`CLAUDE.md`](../../CLAUDE.md) (auto-loaded), [`README.md`](../../README.md), [`ROADMAP.md`](../../ROADMAP.md).

**Текущая задача:** спроектировать **D7 — Meta-Improvement Module** — новый модуль для governance over Ecosystem 3.0 development itself (Level B per terminology в SPEC). Это НЕ модуль для управления user'овскими продуктовыми проектами (Level A — это Product/Design/Integrator/Orchestrator); это модуль для **нашей собственной разработческой дисциплины** при building Ecosystem 3.0.

**Контекст:** preliminary spec уже создан в `dev/meta-improvement/SPEC.md` в рамках conversation 2026-04-27, в момент Phase 3 closure. User observed что после major phase implementation systematically не выполняются hygiene activities (doc health check, bootstrap regression, cleanup, memory sync). D7 module addresses этот gap.

**Предупреждение:** meta-domain design — высокий risk premature abstraction + scope creep + self-referential collapse. Discipline критична: scope tight, mechanism minimum (checklist before skill before command before hook), real ROI focus.

---

## Этап 1: Загрузка контекста (минимум 5 уровней)

**Не пропускай уровни.** Каждый уровень нужен для grounded design без re-discovery.

### Уровень 1: Orientation (5 мин)

- [`CLAUDE.md`](../../CLAUDE.md) — auto-loaded; перечитать особенно §3 «Meta-проект — высокий risk самореферентного коллапса» + «Принципы работы над экосистемой»
- Memory: verify `project_ecosystem_status.md`, `project_ecosystem_architecture.md`, `feedback_methodology.md`, `reference_dev_journal.md` — auto-loaded; check для Phase 3 completeness
- `git log --oneline -15` — фактическое состояние repo (Phase 3 should be complete)
- `git status` — clean tree expected; uncommitted работы быть не должно

### Уровень 2: D7 substrate (15 мин)

- **`dev/meta-improvement/SPEC.md`** — preliminary spec (CRITICAL — это твой substrate)
- **`dev/meta-improvement/DESIGN_KICKOFF.md`** — этот документ
- [`DEV_JOURNAL.md`](../../DEV_JOURNAL.md) — особенно entries:
  - DEC-DEV-0007 (DEV_JOURNAL framework, methodology agreements)
  - DEC-DEV-0008 (incremental pilot, dogfooding direction)
  - DEC-DEV-0012 (Phase 3 architectural readiness consolidation)
  - DEC-DEV-0013 (ambiguity resolution + spec drift sweep)
  - DEC-DEV-0014 (Phase 3 closure lessons — 12 lessons)
  - DEC-DEV-0015 (D7 module preliminary spec creation — записан в Stage 1)
- [`ROADMAP.md`](../../ROADMAP.md) — full Phase progression context

### Уровень 3: Existing development conventions (15 мин)

D7 borrows patterns из existing capabilities. Чтобы не reinvent — fully understand:

- [`CLAUDE.md`](../../CLAUDE.md) sections «Принципы работы», «Skill конвенции», «Hook конвенции»
- [`hooks/product/manifest.yaml`](../../hooks/product/manifest.yaml) — hook registration pattern
- [`commands/ecosystem/bootstrap.md`](../../commands/ecosystem/bootstrap.md) — bootstrap mechanism (relevant для Bootstrap Regression Test design)
- [`commands/ecosystem/verify.md`](../../commands/ecosystem/verify.md) — existing health check command
- `.claude/product.yaml.template` или `.env.template` — config patterns

### Уровень 4: Phase pattern instances (20 мин)

D7 derives from observed phase patterns. Read для extracting commonalities:

- [`dev/PHASE_3_READINESS.md`](../PHASE_3_READINESS.md) — kickoff readiness pattern instance
- [`dev/PHASE_3_SMOKE_TEST_PLAN.md`](../PHASE_3_SMOKE_TEST_PLAN.md) — validation gate pattern instance
- [`dev/PHASE_4_READINESS.md`](../PHASE_4_READINESS.md) — placeholder pattern (and open questions для Phase 4)
- [`dev/v1_1_backlog.md`](../v1_1_backlog.md) — preserved deferred context pattern (cuttable scope discipline)

### Уровень 5: Methodology references (15 мин)

- [`docs/pmo/pmo-map.md`](../../docs/pmo/pmo-map.md) — D6 (integrator-module) definition; understand distinction D6 vs D7
- [`docs/pmo/processes.md`](../../docs/pmo/processes.md) §1 Philosophy & Principles — methodology foundations (some may apply к D7)
- (Optional) `C:\Users\pw201\Claude Desktop projects\PMO Ecosystem\Ecosystem 3.0\` source — original D1-D6 design rationale если нужен

---

## Этап 2: Validation context — 4 проверки

После загрузки контекста — **до начала design** провалидировать substrate coherence.

### 2.1 SPEC consistency check

Read `dev/meta-improvement/SPEC.md` thoroughly. Verify:

- [ ] All 7 reference model components clear in scope?
- [ ] Distinction D7 vs D6 vs Product Module recursion explicit?
- [ ] User's 4 original rules (doc health / bootstrap regression / consistency / cleanup) all addressed in identified gaps section §2.3?
- [ ] Anti-patterns section §5 sufficient?
- [ ] 10 open questions section §6 covers expected design decisions?

If gaps в substrate — surface before design.

### 2.2 Pattern instances availability

For each reference model component, identify какие existing instances в repo дают material для extraction:

| Component | Instances available | Sufficient для extraction? |
|---|---|---|
| Theory externalization | DEV_JOURNAL (14 entries), CLAUDE.md, Memory MCP | TBD |
| Phase kickoff hygiene | DEC-DEV-0012, DEC-DEV-0013, conversation 2026-04-27 kickoff prompt | TBD |
| Phase closure hygiene | DEC-DEV-0014 (1 instance) | Likely insufficient — only 1 phase done |
| Drift management | DEC-DEV-0011, DEC-DEV-0013 spec drift sweep | TBD |
| Memory & continuity | DEV_JOURNAL + CLAUDE.md + Memory MCP existing | Sufficient но automation gap |
| Validation gates | Phase 3.I smoke test plan, DEC-DEV-0008 pilot | Sufficient |
| Self-application | DEC-DEV-0007 + DEC-DEV-0008 (deferred dogfooding) | Open — TBD design session |

If Phase closure hygiene имеет только 1 instance (DEC-DEV-0014) — **abstract carefully**, expect Stage 3+ refinement after Phase 4 + 5 closures.

### 2.3 User clarifications respect

User explicitly clarified в conversation 2026-04-27 (responses #1-#4):
- (#1) Naming: D6 = integrator-module, D7 = meta-improvement
- (#2) Location: dev/ folder
- (#3) Distinction: D7 ≠ ecosystem-as-product managed by Product Module recursion. **Standalone module, separate conventions.**
- (#4) Stage 1 scope: SPEC + KICKOFF only; defer mechanism design to next session (this one)

Ensure design respects all four. If you propose deviation — surface explicitly.

### 2.4 Profanation patterns to refuse (specific to meta-domain)

Watch yourself for:

1. **Recursive Product Module application** — «давайте сделаем .product/ для самой Ecosystem»; refused by user clarification #3.
2. **Premature mechanism formalization** — «давайте сразу skill + command + hook для каждого reference model component»; violates SPEC §4.1 cuttable scope, §4.2 pattern emerge before formalize.
3. **Bloat documentation** — meta-domain attractor for verbose abstraction; remember 10-15:1 add:cleanup ratio is the very pain D7 solves.
4. **Generalize from 1 instance** — Phase closure has 1 instance (DEC-DEV-0014). Extract pattern carefully; mark explicitly «provisional, refine after Phase 4+5 closures».
5. **Tooling over discipline** — automation как default mode; SPEC §5 anti-pattern #4 explicit «manual checklist sufficient before automation».
6. **Disregarding user's specific 4 rules** — design must address each explicitly, not replace с «better» abstraction.
7. **Skill/command/hook namespace pollution** — using product/design/integrator namespaces для D7 mechanisms; SPEC §4.3 separate.
8. **CLAUDE.md update creep** — adding D7 references everywhere в CLAUDE.md before D7 mechanisms even exist; defer CLAUDE.md updates до final mechanism placement decided.

---

## Этап 3: Decision gate

После Этапов 1-2:

**Если substrate coherent + clarifications clear + no profanation risks:**
- Запиши в DEV_JOURNAL `DEC-DEV-NNNN — D7 design session kickoff verified` (next available number after 0015)
- Proceed к Этапу 4 (design tasks)

**Если найдены spec inconsistencies или unresolvable ambiguities в substrate:**
- STOP. Surface findings к user в structured form.
- Discuss + refine SPEC.md (NOT mechanism design directly).
- Только после resolution — proceed.

**Если user не доступен (autonomous mode), но есть critical ambiguity:**
- Document в DEV_JOURNAL.
- Apply default per substrate guidance — но flag как «to be confirmed».
- Proceed selectively.

---

## Этап 4: Design tasks (concrete deliverables)

Этап 4 разделён на **mandatory** (must produce в этой session) и **stretch** (если время позволяет).

### 4.A Mandatory deliverables

#### 4.A.1 Phase Closure Checklist (primary user need)

`dev/meta-improvement/checklists/phase-closure.md` — manual checklist для running после каждой major phase. Must include explicit handling of all 4 user rules:

1. **Documentation health check** — конкретные documents to review per phase (ROADMAP, SPEC, README, CHANGELOG, etc.); how to detect doc rot (grep stale terms, cross-ref check); action protocol (fix inline / queue / archive).
2. **Bootstrap install/update verification** — explicit test scenarios; success criteria («`/ecosystem:bootstrap` on temp dir installs new artifacts cleanly»); failure mode handling.
3. **Documentation consistency check** — distinct from #1; cross-document consistency (e.g., processes.md trigger matrix matches actual hooks; pmo-map.md row labels match SPEC sections).
4. **Cleanup/archive discipline** — criteria for archive vs delete vs keep; archive location (likely `dev/_archive/<phase-N>/`); decision journal trail per archive action.

Each step: «what to do», «what's pass», «what's fail», «what to do on failure». Aim for 30-60 min total run for closure on a phase.

#### 4.A.2 Phase Kickoff Template (extract pattern)

`dev/meta-improvement/checklists/phase-kickoff.md` — template extracted from DEC-DEV-0012 (Phase 3 readiness gate) + DEC-DEV-0013 (ambiguity resolution gate) + conversation 2026-04-27 kickoff prompt structure.

Sections:
- Architectural readiness (decisions resolved? alternatives considered?)
- Ambiguity sweep (10 ambiguities pattern from DEC-DEV-0013)
- Spec drift sweep (grep stale terms — Pattern from DEC-DEV-0013)
- Scope discipline (cuttable scope check, defer to v1.1+ list)
- Plan refinement based on findings

#### 4.A.3 D7 Conventions Document

`dev/meta-improvement/CONVENTIONS.md` — D7-specific conventions:
- Entry numbering: which sequence для D7 entries (proposal: continue DEC-DEV-NNNN per consistency, OR distinct DEC-META-NNNN — design session decides + records rationale)
- File naming within `dev/meta-improvement/`
- Activation triggers (manual checklist run vs automation)
- Self-application principle clarified (with concrete examples)

#### 4.A.4 DEV_JOURNAL DEC-DEV-NNNN entry

Document design decisions из этой session:
- Rationale для conventions selected
- Reference model components addressed in first iteration
- Components deferred к Stage 3+
- Open questions resolved + still open

### 4.B Stretch deliverables

If 4.A complete + time remains:

#### 4.B.1 Pattern Library Starter

`dev/meta-improvement/patterns/<pattern-name>.md` per pattern. Initial 3-5 named patterns:
- **Spec Drift Sweep** (extracted from DEC-DEV-0013) — when refactor architectural model, grep for stale terms across docs/dev/agents/skills/commands/hooks
- **Readiness Gate** (DEC-DEV-0012) — pre-implementation architectural decision consolidation
- **B.1 Frontmatter Convention** (DEC-DEV-0011) — explicit templates with anti-pattern field name lists
- **Cuttable Scope Discipline** (cross-cutting throughout DEV_JOURNAL) — defer with preserved context
- **Smoke Test Plan** (Phase 3.I) — split static + real run; document plan для user-driven execution

Each pattern: «name», «when applicable», «steps», «outputs», «examples (DEC-DEV references)», «anti-patterns when over-applied».

#### 4.B.2 Bootstrap Regression Test Plan

`dev/meta-improvement/checklists/bootstrap-regression.md` — manual test plan, не implementation:
- Test environments (temp dir, dedicated test project, my-first-test)
- Test scenarios (fresh install, re-install, upgrade after Phase N changes)
- Success criteria
- Failure mode handling

Implementation (script / CI / skill / command) — defer further, или make it design session decision.

#### 4.B.3 Memory Sync Protocol

`dev/meta-improvement/checklists/memory-sync.md` — manual review protocol:
- When to review Memory MCP entries (per phase closure? per major commit? quarterly?)
- What to review (compare с DEV_JOURNAL latest, CLAUDE.md, Memory file recency)
- How to update (manual edit Memory files; surface к user if architectural drift)
- Automation potential (defer, but note triggers)

### 4.C Deferred (Stage 3+)

Не делай в этой session:
- Skill/command/hook implementation для D7 mechanisms
- CLAUDE.md updates с D7 references
- Bootstrap regression test implementation (только plan в 4.B.2)
- Pattern library full enumeration (только starter в 4.B.1)
- D7 self-application via Product Module recursion (refused per user clarification #3)
- Premature .product/ creation для Ecosystem 3.0

---

## Этап 5: Per-deliverable discipline

**Каждый checklist (4.A.1, 4.A.2, потенциально 4.B.2, 4.B.3):**
- [ ] Step-by-step actionable, не abstract guidance
- [ ] «What's pass / what's fail» explicit per step
- [ ] Time budget realistic (closure ≤60 min, kickoff ≤90 min)
- [ ] Reference к existing artifacts (no reinvention)
- [ ] Example invocation included

**Каждый pattern document (4.B.1):**
- [ ] Named clearly («Spec Drift Sweep», not abstract)
- [ ] When applicable explicit (not «always»)
- [ ] Steps reproducible
- [ ] DEC-DEV references for instances
- [ ] Anti-patterns when over-applied

**CONVENTIONS.md (4.A.3):**
- [ ] Each convention с rationale (not arbitrary)
- [ ] Examples
- [ ] Out-of-scope statements (что НЕ convention covers)

**DEV_JOURNAL entry (4.A.4):**
- [ ] Per template format (Date, Trigger, Tag, Context, Options, Decision, Outcome, Lessons)
- [ ] References specific commits / files / decisions
- [ ] Lessons accumulated for future meta-domain work

---

## Этап 6: Validation + commit

После 4.A produced:

1. **Cross-check artifacts** — checklists reference each other consistently (kickoff → closure → next kickoff)
2. **Anti-pattern self-check** — re-read profanation patterns Этап 2.4; refuse anything fitting them
3. **Real ROI sanity check** — would this checklist actually save time для developer (us) running closure? Or add ceremony? If add — slim it.
4. **Single commit** — `feat(meta-improvement): D7 first iteration — checklists + conventions + DEV_JOURNAL` (или similar). Following CLAUDE.md commit conventions (HEREDOC, Co-Authored-By).
5. **Working tree clean** at end.

If 4.B stretch produced — separate commit или append к main.

---

## Anti-patterns specific к этой session (re-emphasis)

1. **Don't formalize for sake of formalization.** Each artifact must answer «would I actually use this when next phase closes?» If unsure — keep simpler.

2. **Don't replace user's 4 rules с «better» abstractions.** User pain is concrete; design must address concretely. Generalizations come после concrete works.

3. **Don't recurse Product Module application.** D7 ≠ Product Module для Ecosystem. Refuse «давайте сделаем FM-* для D7 features».

4. **Don't bloat checklists.** 100-line checklist no one runs > 30-line checklist run regularly. Aim для smallest viable.

5. **Don't extrapolate from 1 instance.** Phase closure has 1 instance (DEC-DEV-0014); extract carefully, mark provisional, refine after Phase 4-5 closures.

6. **Don't skip validation Этап 2.** Substrate coherence first; design second.

7. **Don't start mechanism design без substrate clarification.** If SPEC has gap, fix SPEC first.

8. **Don't add CLAUDE.md references prematurely.** D7 mechanisms must exist + prove value before CLAUDE.md broadcasting them.

---

## Финальная проверка перед kick-off

Прежде чем write первую строку D7 design — ответь себе на:

1. Прочитал ли я все Уровни 1-5 substrate? (минимум: SPEC.md + last 4 DEV_JOURNAL entries + CLAUDE.md §3 + dev/PHASE_3_*.md instances)
2. Понимаю ли я различие D7 vs D6 vs Product Module recursion?
3. Понимаю ли я user's 4 original rules (Этап 2.4 + SPEC §1.1)?
4. Готов ли отказаться from premature mechanism formalization?
5. Готов ли отказаться from Product Module recursion?
6. Понимаю что 4.A — mandatory, 4.B — stretch, 4.C — refused?

**Если все 6 — да** — proceed Этап 4.

**Если хоть одно — нет** — назад к Этапам 1-3 или surface к user.

---

## Принципы работы (re-emphasis from CLAUDE.md)

- **DEV_JOURNAL обязателен** для significant design decisions
- **Cuttable scope** default — 4.A mandatory, 4.B stretch, 4.C refused
- **Pattern emerge before formalize** — Phase closure 1 instance ≠ enough for solid abstraction
- **Real ROI focus** — would I run this checklist when Phase 4 closes?
- **Spec drift discipline** — после design session, grep для stale references к D7 (preliminary spec evolves; old wording стейл)

---

**Implementation discipline > velocity. D7 design ships minimal viable, evolves через actual phase closures. Это цель.**

---

# End of kickoff prompt

> **Подготовил:** AI agent в conversation 2026-04-27 (Phase 3 closure / D7 module preliminary spec extraction).
> **Готов к использованию:** скопировать всё содержимое выше в новый Claude Code chat в `cwd=C:\Users\pw201\WebstormProjects\claude-ecosystem-3.0`.
> **Ожидаемая длительность design session:** 4-8 часов focused work (sub-divide if needed).
