# 13. Сводный реестр анти-паттернов

> **Назначение:** **сводный реестр** анти-паттернов из всех разделов 01-11, плюс additional из индустриальной литературы которые не были раскрыты per-section. Используется как чек-лист для **snapshot review**: «не появилось ли красного флага».
>
> **Структура (адаптированная):**
> - Без Industry Reference — паттерны из всех школ.
> - Без Function Inventory — это not function, это failure modes.
> - **AP-* numbering** для cross-reference из других разделов.
> - Per AP: Symptom + Source + Snapshot signal + Cross-reference (если из другого section).

---

## 13.1 Категории анти-паттернов

Группирую по фокусу:

- **A. Sycophancy & confidence** — failures of honest critique
- **B. Discipline erosion** — gates, validation, governance becoming theatre
- **C. Scope** — feature factory, scope creep, MVP misuse
- **D. Specification quality** — bad scenarios, anemic models, vague NFR
- **E. Consistency drift** — terminology, references, hashes failing
- **F. Adversarial review breakdown** — Builder/Critic separation lost, magnitude mis-classified
- **G. AI-native specific** — context drift, memory staleness, skill bloat
- **H. Meta-level** — drift-check itself drifts, self-meta-feedback runaway

---

## 13.2 Каталог анти-паттернов

### A. Sycophancy & confidence

**AP-01. Sycophancy debt at field level.**
- **Symptom:** confidence:high mass-set без артикулированных `confidence_notes`; DA findings dismissed без journal-rationale.
- **Source:** Sharma et al. 2023 (arxiv 2310.13548); Anthropic anti-sycophancy guidance.
- **Snapshot signal:** ratio of confidence:high / total artifacts > 80% sustained; confidence_notes empty rate > 20%.
- **Cross-ref:** Section 01 #1, Section 10 #4.

**AP-02. Verbalized confidence без calibration.**
- **Symptom:** confidence:high used widely; auto-approve invocation rate high; но reality (downstream issues, requires_review conversions) suggests miscalibration.
- **Source:** Kadavath et al. 2022 «Language Models (Mostly) Know What They Know» (arxiv 2207.05221).
- **Snapshot signal:** auto-approve rate high + DA findings on auto-approved artifacts also high.
- **Cross-ref:** Section 01 #6, Section 10 #12.

**AP-03. All findings 🔵 Discussion.**
- **Symptom:** DA never produces 🔴 Critical findings.
- **Source:** Sharma 2023 — sycophancy в critique.
- **Snapshot signal:** distribution skewed; 🔴 critical count = 0 over period.
- **Cross-ref:** Section 08 #2.

**AP-04. All findings 🔴 Critical.**
- **Symptom:** Opposite of AP-03; over-firing.
- **Source:** general critique discipline.
- **Snapshot signal:** distribution skewed to 🔴.
- **Cross-ref:** Section 08 #3.

### B. Discipline erosion

**AP-05. Ceremony escalation.**
- **Symptom:** Approve gates as formality; sequential approves без правок; >5 idle approves в session journal.
- **Source:** критика stage-gate у Cagan; Product Module SPEC §1.4 explicit caveat.
- **Snapshot signal:** journal pattern `approve, approve, approve` без editing rounds.
- **Cross-ref:** Section 01 #4.

**AP-06. Approve overrides accumulating.**
- **Symptom:** `approve_overrides[]` появляются на 3+ артефактах подряд для одного rule; не пересмотр через `validation_overrides`.
- **Source:** ADR practice — overrides as exception, not norm.
- **Snapshot signal:** count of `approve_overrides[]` per rule trending up.
- **Cross-ref:** Section 05 #2.

**AP-07. Validation tier abuse — pilot forever.**
- **Symptom:** validation_tier = pilot через 6+ месяцев активной разработки; нет триггеров для tier upgrade обсуждения.
- **Source:** SRE tier discipline.
- **Snapshot signal:** tier unchanged across multiple snapshots while project clearly maturing.
- **Cross-ref:** Section 02 #1, Section 06 #2, Section 07 #9.

**AP-08. Overrides without rationale.**
- **Symptom:** `validation_overrides[]` или `approve_overrides[]` с empty `reason` field.
- **Source:** Nygard ADR — overrides require rationale.
- **Snapshot signal:** validation-config.yaml entries с rationale = «...» placeholder.

**AP-09. Phase closure skipped.**
- **Symptom:** Phase ends, next starts; checklist не run; lessons not captured.
- **Source:** Scrum retro discipline.
- **Snapshot signal:** dev/PHASE_<N>_READINESS.md exists для Phase N+1, но нет phase-closure entry для Phase N.
- **Cross-ref:** Section 11 #2.

**AP-10. DEV_JOURNAL silent on significant changes.**
- **Symptom:** Scope cut, root cause fix, architectural choice — нет journal entry.
- **Source:** Nygard ADR — silent significant decisions = future archaeology.
- **Snapshot signal:** large code/spec change в git log без corresponding DEV_JOURNAL entry.
- **Cross-ref:** Section 11 #1.

### C. Scope

**AP-11. Feature-factory drift.**
- **Symptom:** FM created без D1-alignment (нет SEG/JTBD/HYP); rising count «exploratory» FM без converted-to-tested HYP.
- **Source:** Cagan *Empowered* — feature factory critique.
- **Snapshot signal:** FM count growing but HYP count stable; SEG.frontmatter.linked_features grows, но `linked_hyp` doesn't.
- **Cross-ref:** Section 01 #2, Section 04 (FM coverage).

**AP-12. MVP-as-v1-with-cut-scope.**
- **Symptom:** MVP scope сокращается «до достижимости», но primary HYP не имеет thresholds или они подгоняются под наблюдаемое.
- **Source:** Ries — MVP misuse critique; pre-registered thresholds discipline.
- **Snapshot signal:** MVP.scope shrinks; HYP thresholds shift after testing-status без journal entry.
- **Cross-ref:** Section 01 #3, Section 02 анти-паттерн #4.

**AP-13. Out-of-Scope erosion.**
- **Symptom:** `out_of_scope` section в FM/handoff пустеет; scope creep over time.
- **Source:** Cagan; handoff-spec §12 AP-4.
- **Snapshot signal:** FM bodies с пустым `out_of_scope`; handoffs Section 13 placeholder «ничего не excluded».
- **Cross-ref:** Section 01 #8, Section 09 анти-паттерн #4.

**AP-14. Discovery-as-one-off.**
- **Symptom:** Discovery провели один раз, дальше только feature work. PS/MR/CA не обновлялись > 3 месяцев несмотря на active feature work.
- **Source:** Torres *Continuous Discovery Habits* — discovery-as-habit.
- **Snapshot signal:** PS.updated date stale relative to high FM activity rate.
- **Cross-ref:** Section 01 #5, Section 02 анти-паттерн #5.

**AP-15. Activation Matrix ignored in practice.**
- **Symptom:** D5 (Operations) обсуждается на Идея/MVP (premature optimization); или D1 Discovery skipped после pilot (premature scaling).
- **Source:** критика premature optimization у Cagan.
- **Snapshot signal:** processes/skills firing not aligned with stage per Activation Matrix.
- **Cross-ref:** Section 02 анти-паттерн #2.

### D. Specification quality

**AP-16. Imperative scenarios (BDD анти-паттерн).**
- **Symptom:** SC steps describe UI clicks not business behavior («user clicks X», not «user submits Y»).
- **Source:** Cucumber docs; North «Introducing BDD».
- **Snapshot signal:** SC step text patterns: «click», «type», «press» dominate; «submit», «receive», «process» absent.
- **Cross-ref:** Section 04 анти-паттерн #1.

**AP-17. Anemic domain model (Fowler).**
- **Symptom:** LC = states list без transitions / guards; entity decisions live в BR без LC reference.
- **Source:** Fowler bliki; Evans 2003.
- **Snapshot signal:** LC files с empty transitions table; BR.frontmatter без lifecycle reference.
- **Cross-ref:** Section 04 анти-паттерн #2.

**AP-18. NFR as adjectives without metrics.**
- **Symptom:** NFR.target = «fast», «secure» без numeric threshold.
- **Source:** ISO 25010; SRE SLO discipline.
- **Snapshot signal:** NFR-* files с `target:` containing non-numeric strings.
- **Cross-ref:** Section 04 анти-паттерн #3.

**AP-19. NFR copy-pasted enterprise SLA.**
- **Symptom:** NFR на MVP стадии устанавливают p99 < 50ms / 99.99% uptime — нереалистично для pre-pilot.
- **Source:** SRE SLO discipline — error budgets must match team capacity; Cagan об over-engineering.
- **Snapshot signal:** NFR.target outside `sanity_check` ranges per tier; `sanity_check: overridden` без robust rationale.
- **Cross-ref:** Section 02 анти-паттерн #3.

**AP-20. Job statement smuggling solution.**
- **Symptom:** SEG.JTBD reads «hire app to search...» — solution name в job statement.
- **Source:** Klement *When Coffee and Kale Compete*.
- **Snapshot signal:** JTBD text contains app/product/feature names.
- **Cross-ref:** Section 04 анти-паттерн #5.

**AP-21. Verification scripts vs key examples.**
- **Symptom:** VC enumerates dozens of step-by-step assertions instead of representative examples.
- **Source:** Adzic 2011 — key examples principle.
- **Snapshot signal:** VC files с 20+ assertions for single SC; high duplication of similar paths.
- **Cross-ref:** Section 04 анти-паттерн #6.

**AP-22. UI design without business context.**
- **Symptom:** MK created без SC/BR/LC reference; visual designed in vacuum.
- **Source:** Frost *Atomic Design* — design with content, not in vacuum.
- **Snapshot signal:** MK.frontmatter без scenario refs или с empty refs.
- **Cross-ref:** Section 04 анти-паттерн #7.

**AP-23. Persona without job-anchor.**
- **Symptom:** SEG.body = demographic profile без JTBD.
- **Source:** Christensen 2016 — job > persona.
- **Snapshot signal:** SEG.body contains demographics без JTBD section.
- **Cross-ref:** Section 04 анти-паттерн #8.

**AP-24. HYP without invalidation threshold.**
- **Symptom:** HYP has success threshold but no invalidation; can't be falsified.
- **Source:** Ries; Strategyzer Test Card.
- **Snapshot signal:** HYP frontmatter `invalidation_threshold:` empty.
- **Cross-ref:** Section 04 анти-паттерн #9.

**AP-25. Roles defined but not used in scenarios.**
- **Symptom:** RPM lists roles; SC.actors uses different role names.
- **Source:** RBAC discipline.
- **Snapshot signal:** SC.actors values not in RPM roles list.
- **Cross-ref:** Section 04 анти-паттерн #11.

**AP-26. Design tokens hard-coded в MK.**
- **Symptom:** MK component states use hex colors directly, не DS token references; V-MK-08 ignored.
- **Source:** Salesforce design tokens; Adobe Spectrum.
- **Snapshot signal:** MK.body contains hex color literals (`#3B82F6` etc.); DS.tokens not referenced.
- **Cross-ref:** Section 04 анти-паттерн #12.

### E. Consistency drift

**AP-27. Glossary без mass-rename → terminology drift.**
- **Symptom:** BG растёт, но old + new названия одной сущности существуют параллельно. Synonym detection не cleanup'ится.
- **Source:** Evans 2003 ch. 14 «Maintaining Model Integrity».
- **Snapshot signal:** synonym warnings count high; mass-rename invocations low.
- **Cross-ref:** Section 07 #1.

**AP-28. Bi-directional refs только в одну сторону → orphans.**
- **Symptom:** Artifacts переезжают в `.product/.pending/`, но never resurface. V-15 orphan check disabled or quietly ignored.
- **Source:** Wiegers ch. 30; Gotel & Finkelstein 1994.
- **Snapshot signal:** V-15 finding count growing; resolutions count low.
- **Cross-ref:** Section 07 #2.

**AP-29. Hashes без verify → false security.**
- **Symptom:** Handoff has hashes; receiver never verifies drift. V-H-04 disabled or auto-acknowledged.
- **Source:** SLSA framework — hash without provenance check is theatre.
- **Snapshot signal:** handoff status:stale rate high; regenerate rate low.
- **Cross-ref:** Section 07 #3.

**AP-30. Cascade без auto-fix → manual burnout.**
- **Symptom:** cascade-pending.yaml накапливается, не resolved; user перестаёт открывать `/product:cascade --pending`.
- **Source:** Aurum & Wohlin 2005 — manual RTM always drifts.
- **Snapshot signal:** cascade-pending.yaml size growing; resolution rate stagnant.
- **Cross-ref:** Section 07 #4.

**AP-31. Living documentation, которая не living.**
- **Symptom:** V-08 terminology check downgrades to Info; SC меняются, VC под ними не пересматриваются.
- **Source:** Adzic 2011 ch. 10-11.
- **Snapshot signal:** V-08 severity downgrade в `validation-config.yaml`; V-07 false positive accepted rate.
- **Cross-ref:** Section 07 #6.

**AP-32. Adapter, который не is ACL.**
- **Symptom:** Adapter mutates `.product/`; adapter passes external tool concepts back into Product Module artifacts.
- **Source:** Vernon 2013 ch. 3 — ACL as one-way translation.
- **Snapshot signal:** Adapter scripts contain write operations to `.product/*`.
- **Cross-ref:** Section 07 #8.

**AP-33. Synonym detection как noise, а не signal.**
- **Symptom:** Synonym warnings dismissed массово; synonym candidates never merge.
- **Source:** аналог DDD model integrity.
- **Snapshot signal:** synonym detection event count high; merge actions low.
- **Cross-ref:** Section 07 #10.

### F. Adversarial review breakdown

**AP-34. Builder-critic merger.**
- **Symptom:** DA subagent runs в same context as creating session; subagent sees draft history.
- **Source:** Sharma 2023; Builder/Critic separation principle.
- **Snapshot signal:** DA findings tone matches creator-side; нет «push-back» tier 🔴 findings.
- **Cross-ref:** Section 01 #7, Section 08 #2-3.

**AP-35. DA invocation moves inline (architectural erosion).**
- **Symptom:** Refactor to skip subagent for «speed».
- **Source:** Anthropic «Building effective agents» — isolated context principle.
- **Snapshot signal:** skill `product-da-review.md` no longer uses Agent tool invocation.
- **Cross-ref:** Section 08 #4.

**AP-36. Adaptive-depth always classifies cosmetic.**
- **Symptom:** 95%+ DA invocations classify «cosmetic, light check, no findings».
- **Source:** Section 08 design intent — magnitude classifier accuracy.
- **Snapshot signal:** classification distribution skewed cosmetic.
- **Cross-ref:** Section 08 #5.

**AP-37. DA after build, not before.**
- **Symptom:** F.9 DA review consistently happens after handoff generation; loses pre-build risk reduction.
- **Source:** Klein pre-mortem timing.
- **Snapshot signal:** DA findings dates post-handoff dates.
- **Cross-ref:** Section 08 #6.

**AP-38. DA findings file accumulates without action.**
- **Symptom:** `.product/.da-findings/` grows; few findings show in resolved state.
- **Source:** критика stage-gate у Cagan (gates as bureaucracy).
- **Snapshot signal:** unique findings files count >> resolved findings count.
- **Cross-ref:** Section 08 #8.

### G. AI-native specific

**AP-39. Skill bloat.**
- **Symptom:** Skill count grows monotonically; loading 8-10 simultaneously; context dilution.
- **Source:** Anthropic Skills design — lazy-load efficiency.
- **Snapshot signal:** total skills count > 30, average skills loaded per task > 5.
- **Cross-ref:** Section 10 #1.

**AP-40. Subagent overuse.**
- **Symptom:** Subagent invoked for tasks workflow could handle.
- **Source:** Anthropic «Building effective agents» — workflow-first.
- **Snapshot signal:** subagent invocation rate high; tasks invoked are simple sequential operations.
- **Cross-ref:** Section 10 #2.

**AP-41. Memory drift.**
- **Symptom:** MEMORY.md outdated relative to state; CLAUDE.md guidance ignored.
- **Source:** memory staleness research; Letta/MemGPT findings.
- **Snapshot signal:** MEMORY.md updated date stale relative to project changes; AI references outdated facts.
- **Cross-ref:** Section 10 #5, Section 11 #8.

**AP-42. Hook proliferation without retirement.**
- **Symptom:** Hook count grows; some never trigger; failures silent.
- **Source:** general automation discipline.
- **Snapshot signal:** total hooks count > 10; per-hook fire rate distribution showing many at zero.
- **Cross-ref:** Section 10 #3.

**AP-43. Hook quietly disabled.**
- **Symptom:** `.claude/settings.json` имеет hook disabled; нет journal entry.
- **Source:** hook design intent.
- **Snapshot signal:** comparison of `manifest.yaml` (declared) vs `settings.json` (active).
- **Cross-ref:** Section 10 #11.

**AP-44. Tool docs out of sync.**
- **Symptom:** `.claude/integrator/tool-docs/<tool>.md` not updated после `/integrator:update`.
- **Source:** Integrator SPEC §13.
- **Snapshot signal:** tool-docs date older than profile date.
- **Cross-ref:** Section 10 #12.

### H. Meta-level

**AP-45. Self-meta-feedback runaway.**
- **Symptom:** Large number of rule overrides accumulating from `/product:meta-feedback`; pattern shows AI consistently proposes loosening.
- **Source:** Sharma 2023; constitutional self-revision risk; AI research on self-serving simplification.
- **Snapshot signal:** override count growing; proposals trend toward downgrade severity / disable rules.
- **Cross-ref:** Section 10 #8, Section 11 #4.

**AP-46. Drift-check that never drifts.**
- **Symptom:** Always 🟢. Suspect calibration.
- **Source:** sycophancy at meta-level.
- **Snapshot signal:** drift-check verdict distribution = 100% 🟢 across many invocations.
- **Cross-ref:** Section 07 #7, Section 10 #16.

**AP-47. Drift-check that always drifts.**
- **Symptom:** Always 🟡/🔴. Suspect overfit.
- **Source:** general calibration discipline.
- **Snapshot signal:** drift-check verdict distribution skewed toward 🟡/🔴.
- **Cross-ref:** Section 10 #16.

**AP-48. Pattern library decay.**
- **Symptom:** Patterns / anti-patterns documented but never consulted; new anti-patterns emerge but не get added.
- **Source:** general knowledge management.
- **Snapshot signal:** `dev/meta-improvement/patterns/` count stagnant; этот раздел (Section 13) not updated даже когда DEV_JOURNAL describes new failure modes.
- **Cross-ref:** Section 11 #5.

**AP-49. Hook reminder ignored repeatedly.**
- **Symptom:** Phase-completion hook fires; user dismisses; pattern repeats.
- **Source:** general automation discipline.
- **Snapshot signal:** hook fires count >> action count for hook outcome.
- **Cross-ref:** Section 11 #6.

**AP-50. Decision journal entries rubber-stamped.**
- **Symptom:** Entries created but rationale section is generic («added because needed»).
- **Source:** Nygard ADR — Context+Decision+Consequences must be substantive.
- **Snapshot signal:** average entry length declining; phrases like «as needed», «to support» dominate.
- **Cross-ref:** Section 11 #7.

---

## 13.3 Использование compendium для snapshot review

Workflow:

1. **Per snapshot pair (N → N+1):** проходим compendium и для каждого AP-* проверяем «появился ли symptom?».
2. Если **yes** — значит drift в этой зоне. Проверяем cross-ref в раздел и применяем full snapshot signal sequence из соответствующего раздела N.6.
3. Если **multiple AP-* в одной категории** — это **systemic drift**, не individual issue. Заслуживает phase-closure-level attention.
4. **Resolution actions** — DEV_JOURNAL entry minimum; potentially trigger phase kickoff readiness re-check; potentially propose ecosystem-level change через `/product:meta-feedback`.

---

## 13.4 Эволюция этого compendium

Реестр **обновляется по мере появления новых failure modes** в реальной практике. Triggers для добавления:

1. **DEV_JOURNAL entry** describes a failure mode не в compendium → добавить.
2. **`/product:patterns`** detection of pattern не в compendium → review, добавить если general.
3. **External literature update** (новая статья от Cagan / Torres / Anthropic) с новыми анти-паттернами → review, добавить релевантные.
4. **Snapshot review reveals** silent drift not captured by current AP-* → root cause + add new AP-*.

При добавлении: maintain numbering; group by category; cross-reference из соответствующего sections; specify source; provide snapshot signal.

---

**Конец раздела 13.**
