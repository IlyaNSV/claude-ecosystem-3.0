# 10. AI-native операционные аспекты

> **Назначение:** функциональные требования к **AI-native** операционной механике — context engineering, agentic patterns, evals, memory, hooks, confidence calibration, drift mitigation. Эта зона **самая EMERGING**; здесь ты идёшь по фронтиру.

---

## 10.1 Индустриальный референс

### 10.1.1 Context engineering

**Lance Martin / LangChain blog** — «context engineering > prompt engineering» (2024-2025): дисциплина curation того, что попадает в context window. Includes:
- Retrieval (что загружать)
- Compaction / summarization checkpoints
- Attention dilution awareness («lost in the middle» — Liu et al. Stanford 2023)
- Selective retrieval per task

**Anthropic** publication on long-context — best practices for large context handling.

### 10.1.2 Agentic workflows / multi-agent

**Anthropic «Building effective agents»** (2024) — distinguishes:
- **Workflows** — orchestrated LLM calls с predetermined paths (use when sufficient)
- **Agents** — LLM dynamically directs own tool use (use when warranted)

Patterns documented: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer.

**LangGraph** (LangChain), **OpenAI Agents SDK**, **CrewAI**, **AutoGen** — frameworks operationalizing these.

### 10.1.3 LLM evaluation

**Promptfoo, Anthropic evals, OpenAI evals** — treat prompts as code; regression test с golden dataset. Model-as-judge, rubric-based evaluation.

**Hamel Husain «Your AI product needs evals»** — practical pragma; **Eugene Yan «Evaluating LLMs»** — survey.

### 10.1.4 Anti-sycophancy

Уже covered в Section 01.1 и 08.1.4.

### 10.1.5 Memory / state management

**LangGraph memory**, **Letta (formerly MemGPT)** — short-term (in-context) vs long-term (external store); episodic vs semantic split.

**MEMORY.md pattern** — practitioner convention для LLM agents.

### 10.1.6 Skills (Anthropic)

**Anthropic Skills** (2025) — self-contained capability bundles, lazy-loaded. Composable. **skill-creator** as bootstrap skill.

### 10.1.7 Tool use / function calling

**Anthropic «Writing tools for agents»** (2025) — single-purpose tools, structured errors, idempotency.

### 10.1.8 Confidence calibration

**Tian et al.** «Just Ask for Calibration» (Stanford 2023); **Lin et al.** «Teaching Models to Express Uncertainty in Words» (2022); **Kadavath et al.** «Language Models (Mostly) Know What They Know» (Anthropic 2022).

LLMs systematically overconfident на free-text. Verbalized confidence correlates poorly с actual accuracy на novel tasks. Calibration check via golden set recommended.

### 10.1.9 Hooks / event-driven LLM

**Claude Code hooks** — PreToolUse, PostToolUse, UserPromptSubmit, Stop. Deterministic guardrails вокруг non-deterministic LLM behavior.

### 10.1.10 Drift mitigation

**Anthropic Constitutional AI** (2022); **Anthropic introspection research**. Self-meta-feedback (модель proposes own constitutional revisions) — speculative.

### 10.1.11 Ключевые источники

- Lance Martin — blog.langchain.com/context-engineering-for-agents/
- Anthropic «Building effective agents» (2024)
- Anthropic «How we built our multi-agent research system» (2024)
- Anthropic Skills — docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic «Writing tools for agents» (2025)
- Promptfoo — promptfoo.dev
- Hamel Husain — hamel.dev/blog/posts/evals/
- Sharma et al. — arxiv 2310.13548
- Tian, Lin, Kadavath — arxiv links per Section 01
- LangGraph memory — langchain-ai.github.io
- Letta / MemGPT — docs.letta.com; arxiv 2310.08560
- Liu et al. «Lost in the Middle» — arxiv 2307.03172
- Anthropic Constitutional AI (2022) — arxiv 2212.08073

---

## 10.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Skill-based lazy-loading capability extension | Anthropic Skills | docs.claude.com Skills | EMERGING |
| Subagent isolated context | Anthropic «Building effective agents» evaluator-optimizer / orchestrator-workers | Anthropic 2024 | EMERGING |
| Event-driven automation (hooks) | Claude Code hooks | docs.claude.com hooks | EMERGING |
| Verbalized confidence as structured field | Tian, Lin verbalized confidence | Tian 2023; Lin 2022 | EMERGING |
| Memory persistence across sessions | MEMORY.md; Letta; LangGraph memory | Letta docs; LangGraph | EMERGING |
| Context engineering (compaction) | Lance Martin; Anthropic long-context guidance | LangChain blog; Anthropic | EMERGING |
| LLM evaluation / golden set | promptfoo; Anthropic/OpenAI evals; model-as-judge | Husain; Yan | EMERGING (mature для classification) |
| Self-meta-feedback (модель proposes revisions) | Constitutional AI; introspection research | Anthropic 2022; introspection research | SPECULATIVE |
| Constitutional self-revision | Anthropic Constitutional AI | Anthropic 2022 | SPECULATIVE |
| Workflow vs agent discipline | Anthropic «Building effective agents» | Anthropic 2024 | EMERGING |
| Tool design для agents | Anthropic «Writing tools for agents» | Anthropic 2025 | EMERGING |
| Calibrated verbalized confidence | Kadavath et al. | Anthropic 2022 | SPECULATIVE для open-ended |

---

## 10.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Skill-based lazy-loading | ● 3 | `[C]` | CC | ~20 skills для Product Module + ~5 для Design + ~4 для Integrator + 4 D7 meta-improvement skills. Lazy-load (~3-5 одновременно). Direct Anthropic Skills practice. |
| 2 | Subagent isolated context | ● 3 | `[C]` | CC | 3 subagents (market-researcher, competitor-analyst, product-devils-advocate) + screen-generator (Design). All via Agent tool с isolated context. Direct evaluator-optimizer / orchestrator-workers patterns. |
| 3 | Event-driven automation (hooks) | ● 3 | `[C]` | CC | 6+ hooks: artifact-validate (PostToolUse, tier-aware, quiet-draft), bg-extractor, session-state, ic-change-trigger, br-change-trigger, cascade-check, handoff-gate (PreToolUse). Direct Claude Code hooks practice. |
| 4 | Verbalized confidence as structured field | ● 3 | `[F]` | CC | C2 modification: `confidence: high/medium/low` + `confidence_notes` mandatory in all 22 artifact types. Direct Tian/Lin/Kadavath operationalization. **Frontier work** для living spec. |
| 5 | Memory persistence across sessions | ● 3 | `[C]` | HYB | MEMORY.md + Memory MCP (knowledge graph) + decision journal (per-project + global) + session state recovery. HYB locus because Memory MCP — external service. |
| 6 | Context engineering (compaction) | ◐ 2 | `[C]` | CC | Skills lazy-load reduces context bloat; subagent isolation prevents cross-context pollution. **Partially:** explicit compaction checkpoints (rolling summary, etc.) yet не codified. Most context discipline is architectural, not operational. |
| 7 | LLM evaluation / golden set | ◔ 1 | `[C]` | CC (planned) | Test coverage acknowledged в `validation.md` §10.5 «fixture-based tests per rule», «regression на реальных проектах», «mutation testing». **Acknowledged not operationalized.** Нет actual golden set or eval suite. **Important gap** для confidence calibration validation. |
| 8 | Self-meta-feedback | ◐ 2 | `[F]` | CC | C3 modification: `/product:meta-feedback` command + skill `meta-feedback.md`. AI proposes ecosystem-level changes (rule overrides, threshold refinement); human approves; logged in journal. **SPECULATIVE.** Operationalized but inherent risk: model proposing self-serving simplifications. Human approval gate is correct mitigation. |
| 9 | Constitutional self-revision | ◐ 2 | `[F]` | CC | То же что #8 + `/product:drift-check` (C1) для direction alignment. **SPECULATIVE** класс. Frontier work. |
| 10 | Workflow vs agent discipline | ● 3 | `[C]` | CC | Most P1-P2 are skill-driven workflows; subagents only для isolated context (research, DA, screen-gen). Direct Anthropic guidance. |
| 11 | Tool design для agents | ● 3 | `[C]` | CC | Custom commands + hooks designed с single-purpose principle, structured outputs. Tool docs generated в `.claude/integrator/tool-docs/` (Integrator §13). |
| 12 | Calibrated verbalized confidence | ◔ 1 | `[F]` | CC (planned) | **Тот же gap что #7.** Confidence field operationalized (#4); calibration check on golden set absent. Caveat noted в Section 01 #8. **Risk:** auto-approve gated на confidence:high without calibration = false high rate possible. |

**Итог:** 7 × ● 3, 3 × ◐ 2, 2 × ◔ 1. Два ◔ 1 (#7 evals/golden set, #12 calibration) — **the most important gap** в этой зоне — без них, all the verbalized confidence mechanisms run on faith.

---

## 10.4 Нарративный анализ соответствия

### 10.4.1 Skills + subagents + hooks — solid Anthropic-aligned

**Match.** Direct Anthropic ecosystem practice. Skills lazy-loaded; subagents для isolation; hooks для deterministic guardrails. Всё by-the-book.

### 10.4.2 Verbalized confidence — frontier fitness

**Match с frontier extension.** Индустрия: verbalized confidence as research recommendation. **Ты operationalized это as mandatory frontmatter field across 22 artifact types** + auto-approve gating + decision journal coupling. **Stronger** than industry norm.

**Big asterisk (Section 01 #8 caveat):** verbalized confidence systematically miscalibrated на open-ended generation (Kadavath et al.). Without calibration check, the field is **decorative under stress**. Auto-approve gate at confidence:high is false comfort if confidence:high doesn't actually mean «accurate».

**This is the most important gap closer to add post-pilot:** golden-set calibration suite. Не в current roadmap; should be.

### 10.4.3 Memory persistence — HYB locus

**Match с hybrid locus honesty.** MEMORY.md (CC) + Memory MCP (external service via MCP — EXT). Hybrid locus correctly captures the architecture.

**Risk:** Memory MCP staleness. Из AI-native research: «Memory staleness is the deep problem — memory drifts from current state.» Твой CLAUDE.md addresses: «Memory может устаревать. Всегда верифицируй по git log / DEV_JOURNAL / CHANGELOG перед actionом.» — good fitness mitigation.

### 10.4.4 Context engineering — partial operationalization

**Conscious gap?** Индустрия: explicit compaction checkpoints (rolling summary every N turns, periodic state snapshot). У тебя: lazy-load skills + subagent isolation handle most context discipline architecturally. Operational compaction (например, session resume from snapshot, auto-summary after threshold) — implicit through `.product/.sessions/`.

**Likely fine для v1.** More explicit context engineering becomes valuable когда sessions get long enough to hit context limits frequently. Не yet a felt pain.

**Отслеживай:** appearance of explicit summarization hooks или session-checkpoint skills.

### 10.4.5 Self-meta-feedback и constitutional self-revision — frontier with risk

**Match с frontier acknowledgment.** Both are SPECULATIVE класс. У тебя:
- `/product:meta-feedback` (C3) — AI proposes rule overrides
- `/product:drift-check` (C1) — direction alignment check
- `/product:patterns` (C4) — anti-pattern linter

These are operationalized, не just guidelines. **Frontier work.**

**Risks (from agent research):**
- Self-meta-feedback might propose **self-serving simplifications** (downgrade rules that catch its own mistakes).
- Drift-check might **drift itself** (tune to ignore actual drift).
- Patterns linter might **overfit** или **underfit** based on training data biases.

**Mitigation в твоём дизайне:**
- Human approval gate on every meta-revision (correct).
- Decision journal entry required.
- Drift-check is non-blocking informational.

**Что отсутствует (potential future):**
- Audit of meta-feedback proposals: ratio approved/rejected; pattern of proposals (does it always propose downgrades?).
- Drift-check accuracy validation: artificial drift cases — does it detect?
- Patterns linter false-positive/false-negative rate tracking.

**Отслеживай:** appearance of meta-monitoring skills/hooks.

### 10.4.6 Evaluation / calibration — the critical gap

**Acknowledged gap closure required.** Из `validation.md` §10.5: «Test coverage: Fixture-based; Regression на реальных проектах; Mutation testing.» All listed as **future work**, none operational.

Это matters because:
- Auto-approve relies on validation rules + confidence:high. Without rule-level fixtures, refactor of rule logic could silently break detection.
- Confidence:high relies on subjective AI assessment without calibration anchor. Model could systematically over-confident on certain artifact types.
- Adaptive-depth DA classifier might mis-classify without calibration на examples.

**Recommendation:** post-pilot, before validation_tier upgrade pilot → mvp, build minimal golden set:
- 10-20 artifact examples per type with known correct validation outcomes
- Run validation suite в regression mode
- Compare verbalized confidence with actual outcome quality
- Calibrate

---

## 10.5 Анти-паттерны для отслеживания

1. **Skill bloat.** Симптомы: skills count grows monotonically; loading 8-10 simultaneously; context dilution. **Source:** Anthropic Skills design — lazy-load efficiency.
2. **Subagent overuse.** Симптомы: subagent invoked для tasks workflow could handle. Multiplies cost/latency. **Source:** Anthropic «Building effective agents» — workflow-first.
3. **Hook proliferation without retirement.** Симптомы: hook count grows; some never trigger; failures silent. **Source:** general automation discipline.
4. **Confidence:high without notes (sycophancy at field level).** Симптомы: confidence_notes empty pattern; high rate of auto-approve. **Source:** Sharma 2023.
5. **Memory drift.** Симптомы: MEMORY.md outdated relative to actual state; CLAUDE.md guidance ignored. **Source:** memory staleness research.
6. **Context window overrun.** Симптомы: sessions terminate at limits; recovery fails. **Source:** Liu «Lost in the Middle».
7. **Evals as theater.** Симптомы: golden set built but never run; or run but failing tests ignored. **Source:** Husain.
8. **Self-meta-feedback runaway.** Симптомы: large number of rule overrides accumulating from `/product:meta-feedback`; pattern shows AI consistently proposes loosening. **Source:** Sharma 2023; constitutional self-revision risk.
9. **Drift-check that never drifts.** Симптомы: всегда 🟢. Suspect calibration. **Source:** sycophancy at meta-level.
10. **Drift-check that always drifts.** Симптомы: всегда 🟡/🔴. Suspect overfit. **Source:** general calibration discipline.
11. **Hook quietly disabled.** Симптомы: `.claude/settings.json` имеет hook disabled; нет journal entry. **Source:** hook design intent.
12. **Tool docs out of sync.** Симптомы: `.claude/integrator/tool-docs/<tool>.md` не updated после `/integrator:update`. **Source:** Integrator SPEC §13.

---

## 10.6 Сигналы для сравнения снапшотов

### Skills / subagents / hooks

1. **Skill count and total size.** Trending?
2. **Skill load distribution.** Which skills load most? Are some never used?
3. **Subagent invocation rate.** Per type. Trending?
4. **Hook firing rate.** Per hook. Failures rate?
5. **New hooks added.** Why? Removed any?

### Confidence and calibration

6. **`confidence:` field distribution per artifact type.** high vs medium vs low.
7. **`confidence_notes` non-empty rate when confidence != high.**
8. **Golden set / eval suite.** Built? Run frequency?
9. **Auto-approve invocation count.**
10. **Auto-approve → requires_review conversion.** (mis-calibration signal).

### Memory and context

11. **MEMORY.md update frequency.**
12. **Decision journal entry rate.**
13. **Session recovery invocation rate.** Sessions abandoned vs resumed.
14. **Context-related session failures.** (limit-hit, recovery fail).

### Meta-feedback и drift

15. **Предложения `/product:meta-feedback` count.** Per period. Approval rate. Pattern of proposals (always loosening?).
16. **Запуски `/product:drift-check`.** Verdict distribution.
17. **Запуски `/product:patterns`.** Anti-patterns reported.
18. **Drift-check artificial validation.** (does it correctly detect injected drift?).

### Multi-harness

19. **EXT harness usage.** (См. Section 09).

---

**Конец раздела 10.**
