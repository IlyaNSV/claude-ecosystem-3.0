# 08. Adversarial review и anti-sycophancy

> **Назначение:** функциональные требования к **критическому ревью** артефактов: pre-mortem, devil's advocate, magnitude-aware triggers, Builder/Critic separation. Основной защитник от confirmation bias и AI sycophancy.

---

## 08.1 Индустриальный референс

### 08.1.1 Pre-mortem (Klein)

**Gary Klein** (HBR 2007 «Performing a Project Premortem») — техника **prospective hindsight**: представь, что проект провалился, работай назад к причинам. Counteracts overconfidence; surfaces risks that planning sessions hide.

**Daniel Kahneman** (*Thinking, Fast and Slow*) популяризовал — pre-mortem reduces planning fallacy.

### 08.1.2 Red team review

Originated in security and military contexts. Now applied broadly:
- **Cybersecurity red team** — adversarial pen-testing
- **Strategy red team** — challenge plan from competitor's perspective
- **Architecture red team** — adversarial review of design

Key principle: **separation** — red team не делит framing planning team.

### 08.1.3 Constitutional AI

**Anthropic** (2022 paper, arxiv 2212.08073) — модель self-critiques на основе stated principles, затем revises. Foundation for AI-driven adversarial review.

Key concepts:
- **Constitutional principles** — explicit list of «what should be avoided»
- **Self-critique** — модель reviews собственный output против principles
- **Revision** — модель rewrites на основе critique
- **Multi-step refinement** — critique-revise loop

### 08.1.4 Sycophancy mitigation

**Sharma et al.** (Anthropic 2023, arxiv 2310.13548) — sycophancy systematically trained by RLHF; 5 documented patterns:
1. Acquiescing to incorrect challenge
2. Mimicking user errors
3. Preferring user-pleasing over correct
4. Persistent in incorrect after pushback
5. False acquiescence to authority claims

**OpenAI GPT-4o sycophancy rollback** (April 2025) — incident showing how training updates can amplify sycophancy; rollback + structural mitigations.

**Mitigations split:**
- Training-time (debiasing, constitutional AI)
- **Inference-time** (relevant for product systems): forced disagreement prompts, devil's advocate subagent, structured confidence scoring, isolated-context critic

### 08.1.5 Multi-lens review (ATAM and analogues)

**ATAM** (Architecture Tradeoff Analysis Method, SEI) — review architecture against quality attributes (modifiability, performance, security, etc.), each as separate «lens».

**Cynefin sense-making** (Snowden) — different lenses for different decision contexts.

**6 lenses pattern in product DA** — product-side adaptation of multi-lens architectural review. Common practitioner lenses: scalability / reliability / edge cases / security / alternatives / user assumptions.

### 08.1.6 Ключевые источники

- Klein, «Performing a Project Premortem», HBR Sep 2007.
- Kahneman, *Thinking, Fast and Slow* (2011) — pre-mortem в ch. 24.
- Anthropic «Constitutional AI» (2022) — arxiv 2212.08073.
- Sharma et al., «Towards Understanding Sycophancy in Language Models» (2023) — arxiv 2310.13548.
- OpenAI «Sycophancy in GPT-4o» (April 2025) — incident report.
- Bass, Clements, Kazman, *Software Architecture in Practice* — ATAM.
- Anthropic «Building effective agents» (2024) — evaluator-optimizer pattern.
- Shostack, *Threat Modeling* (2014) — STRIDE multi-lens.

---

## 08.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Adversarial review with multiple lenses | ATAM; Klein pre-mortem; STRIDE | Bass; Klein 2007; Shostack | MATURE |
| Builder/Critic context isolation | Anthropic evaluator-optimizer; multi-agent research system | Anthropic «Building effective agents» 2024 | EMERGING |
| Trigger-based vs scheduled adversarial | (composite) | (industry) | MATURE-ISH |
| Magnitude-aware adaptive depth | (нет канонического; emerging in AI agents) | (closest: ATAM scoping for change size) | EMERGING |
| Forced rationale for findings dismissal | ADR-style decision logging applied to dismissals | Nygard 2011 | MATURE-ISH |
| Findings tier system (Critical/Important/Discussion) | Risk register tiers; FMEA RPN buckets | (industry) | MATURE |
| Confidence articulation в critic | Verbalized confidence | Tian 2023; Lin 2022 | EMERGING |
| Anti-sycophancy structural controls | Sharma 2023; Constitutional AI | Sharma 2023; Anthropic 2022 | EMERGING |
| Builder cannot participate в review | Devil's advocate role; isolated context for critic | (general practice; Anthropic Skills) | MATURE для general DA, EMERGING для AI |

---

## 08.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Adversarial review with multiple lenses | ● 3 | `[C]` | CC | Product DA с 6 lenses (scalability / reliability / edge cases / security / alternatives / user assumptions). Direct match с ATAM-style multi-lens review adapted to product spec. |
| 2 | Builder/Critic context isolation | ● 3 | `[F/C]` | CC | `product-devils-advocate` subagent с isolated context (через Agent tool); explicit motivation в Product Module SPEC §5.3 «DA не должен видеть contextный энтузиазм; fresh critical lens». Direct evaluator-optimizer pattern. |
| 3 | Trigger-based adversarial | ● 3 | `[F/C]` | CC | P-RULE-01 (IC change → DA), P-RULE-02 (BR change → DA + impact). F.9 optional pre-handoff. Trigger-driven, not scheduled. |
| 4 | Magnitude-aware adaptive depth | ● 3 | `[F]` | CC | DEC-DEV-0012 refactor: single subagent invocation classifies cosmetic vs significant + adapts depth (quick consistency check vs full 6-lens). Single LLM call. **Fitness frontier** — индустрия не имеет этого паттерна yet. |
| 5 | Forced rationale for dismissal | ● 3 | `[C]` | CC | DA findings dismissal **must** be journaled with rationale (anti-sycophancy mechanism per Product Module SPEC §6.5). Direct ADR pattern applied to DA findings. |
| 6 | Findings tier system | ● 3 | `[C]` | CC | 🔴 CRITICAL / 🟡 IMPORTANT / 🔵 DISCUSSION (3 tiers) per `processes.md` §6.4. Direct port of risk register tier discipline. |
| 7 | Confidence articulation в critic | ◐ 2 | `[F]` | CC | Subagent output includes findings; whether subagent itself articulates confidence in its own findings — **не explicit** в current skill spec. Acknowledged but not fully operationalized. |
| 8 | Anti-sycophancy structural controls | ● 3 | `[F]` | CC | (См. Section 01 #7.) Multi-layer: confidence:* mandatory; ceremony escalation; persona avoid-list; isolated DA subagent; forced dismissal rationale. |
| 9 | Builder cannot participate в review | ● 3 | `[F/C]` | CC | Subagent invocation via Agent tool with `Mode: adaptive` brief — fresh context, no draft history visible. Honored architecturally. |

**Итог:** 8 × ● 3, 1 × ◐ 2 (#7 critic confidence articulation), 0 × ✗.

---

## 08.4 Нарративный анализ соответствия

### 08.4.1 6 lenses ↔ ATAM/multi-lens — direct port

**Match.** ATAM имеет lenses for architecture qualities; ты адаптировал 6 lenses to product spec qualities. Индустрия: ATAM, STRIDE, Cynefin all use multi-lens framing.

Твои 6 specifically: scalability / reliability / edge cases / security / alternatives / user assumptions.

**Отслеживай в снапшоте:** if lenses change (added / removed) — что motivated? Adding «failure modes» as separate from «reliability» — could be useful enrichment. Removing «alternatives» — would be regression (essential for opportunity assessment).

### 08.4.2 Adaptive-depth — frontier work

**Match с frontier extension.** DEC-DEV-0012 refactor: instead of two-stage (classifier → executor), single subagent classifies + executes adaptively. **Frontier work** — индустрия pattern is two-stage; ты сжал для cost/latency reasons.

**Риски (Section 01 #6):**
- **Mis-classification** — cosmetic, который actually significant; sub-agent классифицирует «cosmetic», does light review, misses real issue.
- **Verifying classification** — currently no calibration check on classifier accuracy. Recommended: occasional audit «out of last 20 cosmetic-classified, sample 5 and verify they truly were cosmetic».

**Snapshot track:** if classifications start to skew towards «cosmetic» (trending up), suspect cost/effort optimization at cost of safety. If towards «significant», suspect over-firing.

### 08.4.3 Forced dismissal rationale — strong anti-sycophancy

**Match.** «DA findings can be dismissed, but **dismissal requires rationale in journal**» — direct anti-sycophancy mechanism. Индустрия: ADR practice for design decisions; applying to DA dismissal is fitness extension.

**Why this matters:** without forced rationale, sycophancy creep at meta-level — «AI agreed with my dismissal because I sound confident». Journal entry forces externalization, reduces silent suppression.

### 08.4.4 Critic confidence — partial gap

**Должно быть:** Subagent's own findings should articulate confidence («I'm 80% sure this is a real issue, 20% it's contextual nuance I'm missing»). Индустрия: verbalized confidence applied to critic outputs.

**У тебя:** 6 lenses output; tier (🔴/🟡/🔵) implies severity but not critic's confidence in their own assessment.

**Gap (◐ 2):** acknowledged in spec spirit but not operationalized in DA finding output. **Отслеживай:** if DA findings file frontmatter gains `confidence: ...` per finding, this closes.

### 08.4.5 Builder/Critic separation — architectural integrity

**Match.** Subagent invocation via Agent tool with isolated context is architectural enforcement of Builder/Critic separation. **Stronger** than typical implementations because the subagent literally cannot see creator-side draft history.

**Риск:** if for «efficiency» someone refactors DA invocation to inline call (skipping subagent isolation), this principle quietly erodes. **Отслеживай:** confirm `Agent` tool invocation в skill `product-da-review.md`; not inline call.

### 08.4.6 Что отсутствует относительно индустрии (по приоритету)

1. **Pre-mortem as separate exercise.** 6 lenses cover most pre-mortem ground, but classical pre-mortem is goal-oriented («imagine project failed → why»), not artifact-oriented («review this artifact for risks»). Could be useful at strategic moments (start of phase, before major release). Currently absent.
2. **External adversarial review.** All adversarial in Ecosystem 3.0 is AI-internal (subagent). Индустрия: external red team (different person/team). For solo, this is N/A by definition; but could be enriched by «invite a friend to look at this artifact pack» workflow.
3. **Critic feedback loop on classifier.** As noted в 08.4.2, no audit of classifier accuracy. Acknowledged but not yet addressed.
4. **Anti-sycophancy structural calibration.** Confidence calibration on golden set — not in roadmap. Important especially because critic uses verbalized confidence.

---

## 08.5 Анти-паттерны для отслеживания

1. **DA findings dismissed without rationale.** Симптомы: DA findings file shows dismissals; corresponding journal entries absent. **Source:** Sharma 2023 — sycophancy at meta-level.
2. **All findings 🔵 Discussion.** Симптомы: DA never produces 🔴 Critical findings. Suggests classifier mis-firing OR sycophancy в critic. **Source:** Sharma 2023.
3. **All findings 🔴 Critical.** Opposite — over-firing, theatre. **Source:** general critique discipline.
4. **DA invocation moves inline.** Симптомы: refactor to skip subagent for «speed». Erodes Builder/Critic separation. **Source:** Anthropic «Building effective agents» — isolated context principle.
5. **Adaptive-depth always classifies cosmetic.** Симптомы: 95%+ DA invocations come back «cosmetic, light check, no findings». Suspect cost optimization gone too far. **Source:** Section 08 design intent.
6. **DA after build, not before.** Симптомы: F.9 (DA review) consistently happens after handoff generation. Loses pre-build risk reduction. **Source:** Klein pre-mortem timing.
7. **Lenses never updated.** Симптомы: 6 lenses unchanged for 1+ year despite project evolution. May miss new threat surfaces (например, AI safety concerns for AI-driven products). **Source:** ATAM evolution practice.
8. **Findings file accumulates without action.** Симптомы: `.product/.da-findings/` grows; few findings show in resolved state. **Source:** критика stage-gate у Cagan (gates as bureaucracy).

---

## 08.6 Сигналы для сравнения снапшотов

1. **DA invocation count.** Per artifact type. Per period.
2. **Findings tier distribution.** 🔴 / 🟡 / 🔵 ratio. Healthy ratio? Unhealthy skew?
3. **Findings dismissal rate.** With or without rationale?
4. **Adaptive-depth classification distribution.** cosmetic vs significant. Stable? Drifting?
5. **DA subagent isolation maintained.** Skill `product-da-review.md` still uses Agent tool invocation? No inline refactor?
6. **6 lenses unchanged.** Or modified? What was added / removed?
7. **F.9 (Product DA) frequency.** Per FM count. Pre-handoff vs ad-hoc?
8. **DA findings frontmatter** — did `confidence:` field appear per finding? (closing 08.3 #7).
9. **Pre-mortem as separate exercise** — appears? Skill `pre-mortem.md`?
10. **External adversarial review hooks** — anything? (likely N/A pre-pilot).
11. **Sycophancy red flags** in DA outputs? (например, findings rarely contradict creator-side rationale).

---

**Конец раздела 08.**
