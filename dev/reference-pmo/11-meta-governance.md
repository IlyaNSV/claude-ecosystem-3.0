# 11. Meta-governance и self-improvement

> **Назначение:** функциональные требования к **самоуправлению** экосистемы — decision records, retrospectives, drift detection at meta level, self-improvement proposals. Это D6 в твоей PMO map.

---

## 11.1 Индустриальный референс

### 11.1.1 ADRs (Architecture Decision Records)

**Michael Nygard** «Documenting Architecture Decisions» (2011) — formalized lightweight pattern: каждое significant decision recorded в single file со status (proposed/accepted/deprecated/superseded), context, decision, consequences. Now widely adopted; ADR tooling ecosystem (adr-tools, dotnet-adr, Log4brains).

**MADR (Markdown ADR)** — community-evolved templates с more sections.

### 11.1.2 Retrospectives

**Scrum retrospective** (Schwaber & Sutherland, *Scrum Guide*) — formal team practice at sprint/iteration boundary. Patterns: «start/stop/continue», «4 L's (liked/learned/lacked/longed-for)», «sailboat», «mad/sad/glad».

Для solo: retrospective is **personal reflection at phase boundary**. Less structured but same purpose — codify learning.

### 11.1.3 Phase-gate readiness checks

**Stage-Gate** (Cooper) — formal go/no-go before next phase. Critiqued by Cagan as bureaucracy when applied as feature checklist; valuable when applied as risk reduction check.

### 11.1.4 Decision journals

Distinct from ADRs (которые document specific architectural decisions): broader **decision log** capturing WHY behind operating choices. Originated в investment / decision science (Klein, Kahneman); applied to engineering teams.

### 11.1.5 Evaluator-optimizer (Anthropic)

Уже covered Section 08. Applies at meta-level too: critic agent evaluates outputs/decisions системы и proposes improvements.

### 11.1.6 Self-improvement proposals (constitutional self-revision)

**Anthropic Constitutional AI** (2022) — модель may self-critique against principles. Extension: модель proposes constitutional revisions. **SPECULATIVE** — risk of self-serving simplification.

### 11.1.7 Drift detection at meta-level

Уже covered Section 07.1.5. Нет канонического PMO source; emerging in AI agents.

### 11.1.8 Ключевые источники

- Nygard, «Documenting Architecture Decisions» (2011) — cognitect.com/blog/2011/11/15/documenting-architecture-decisions.
- MADR — adr.github.io/madr/.
- Schwaber & Sutherland, *Scrum Guide* — scrumguides.org.
- Cooper, Stage-Gate — stage-gate.com.
- Klein, *Sources of Power* (1998) — decision-science origins of decision journaling.
- Anthropic Constitutional AI (2022) — arxiv 2212.08073.

---

## 11.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Decision Records (ADR / DEC-*) | Nygard ADR; MADR | Nygard 2011 | MATURE |
| Retrospectives / phase closure | Scrum retro; Lean retrospective | Scrum Guide | MATURE |
| Phase kickoff readiness gates | Stage-Gate; modified for Lean | Cooper; критика Cagan | MATURE-ISH |
| Pattern library / anti-pattern catalog | (composite — Fowler, GoF, etc.) | Fowler *Patterns of Enterprise App Architecture* | MATURE |
| Self-improvement proposals (AI-initiated) | Constitutional AI revisions | Anthropic 2022 | SPECULATIVE |
| Hook-based reminder для governance events | (нет единого канонического; emerging in CI/CD: например, post-deploy hooks) | (industry composite) | EMERGING |
| Decision rationale в journal mandatory | Nygard ADR; ADR Status field | Nygard 2011 | MATURE |
| Cross-session learning (memory of past decisions) | Memory MCP; knowledge graph; ADR ecosystem | Memory MCP docs; Nygard | EMERGING |

---

## 11.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Decision Records (DEC-*) | ● 3 | `[C]` | CC | DEV_JOURNAL.md (этот repo); decision-journal per project + global; конвенция нумерации DEC-* (DEC-P-*, DEC-DEV-*, DEC-INT-*, DEC-NFR-*). Direct Nygard ADR practice + extension (numbering scheme per domain). |
| 2 | Retrospectives / phase closure | ● 3 | `[F/C]` | CC | D7 module: `dev/meta-improvement/checklists/phase-closure.md` + verification script + hook reminder (PostToolUse Bash). Per-phase reflection codified. **Stronger** чем Scrum retro because phase boundary is well-defined event with checklist. |
| 3 | Phase kickoff readiness gates | ● 3 | `[F/C]` | CC | `dev/PHASE_<N>_READINESS.md` per phase + checklist `phase-kickoff.md`. Modified Stage-Gate под Lean discipline (criteria are risk reduction questions, not feature checkboxes). |
| 4 | Pattern library / anti-pattern catalog | ◐ 2 | `[F/C]` | CC | `/product:patterns` skill (anti-pattern linter); `dev/meta-improvement/patterns/` (5 patterns); some anti-patterns в SPEC §«AP-*» sections. **Section 13 этого референса** consolidates. **Partially** because library is fragmented across files; нет single index. |
| 5 | Self-improvement proposals | ◐ 2 | `[F]` | CC | C3 modification: `/product:meta-feedback` + skill `meta-feedback.md`. AI proposes ecosystem-level changes; human approves; journaled. **SPECULATIVE** класс. Operationalized but inherent risks (см. Section 10 #8). |
| 6 | Hook-based reminder для governance events | ◐ 2 | `[F]` | CC | PostToolUse Bash hook fires on phase-completion commits (упомянут в CLAUDE.md). **Partially** because narrowly scoped: only phase commits trigger reminders; broader governance events (decision threshold, validation overrides accumulating, etc.) — нет. |
| 7 | Decision rationale mandatory | ● 3 | `[C]` | CC | DEV_JOURNAL conventions в CLAUDE.md mandate rationale for: arch decisions с альтернативами, root causes, scope cuts, spec adjustments. Triggers explicit. Direct Nygard ADR Status+Context+Decision+Consequences format adapted. |
| 8 | Cross-session learning | ● 3 | `[F/C]` | HYB | Memory MCP (knowledge graph) + decision-journal per project + global + `~/.claude/memory/product/` (MEMORY.md pattern). HYB locus because Memory MCP is external service. |

**Итог:** 5 × ● 3, 3 × ◐ 2.

---

## 11.4 Нарративный анализ соответствия

### 11.4.1 Decision Records — strong fitness extension

**Match.** DEV_JOURNAL + decision-journal + DEC-* numbering scheme — direct port of Nygard ADR с thoughtful extension (per-domain prefixes для traceability: DEC-P для product, DEC-DEV для dev, DEC-INT для integrator, DEC-NFR для NFR).

**Strong fitness:** explicit triggers в CLAUDE.md «когда писать в DEV_JOURNAL» — captures дисциплину «why this is in journal», которой ADR practice часто lacks.

### 11.4.2 Phase closure / kickoff — solid Stage-Gate adaptation

**Match.** D7 module operationalizes phase boundaries as governance events. Индустрия: Stage-Gate с критикой Cagan baked in (criteria are risk-reduction questions, not feature checklists).

### 11.4.3 Pattern library — fragmented

**Conscious gap closing in this reference.** Patterns + anti-patterns currently live in:
- `dev/meta-improvement/patterns/` (5 patterns)
- SPEC §«AP-*» sections (handoff-spec AP-1..AP-9)
- Skill `pattern-linter.md` operationalization
- `/product:patterns` command output

Нет single index. **Section 13 этого референса is the consolidation** — но он lives in `dev/reference-pmo/`, not `dev/meta-improvement/`. Possible reorganization: cross-link from meta-improvement to reference-pmo, или move consolidation туда.

**Отслеживай:** appearance of `dev/meta-improvement/anti-patterns/INDEX.md` или similar.

### 11.4.4 Self-improvement proposals — SPECULATIVE frontier

**Match с frontier acknowledgment.** Section 10 #8 covered.

### 11.4.5 Hook-based reminder — partial gap

**Acknowledged limitation.** Phase commit hook works. Broader governance events не hooked:
- Validation override accumulation (Section 06 #4)
- Confidence calibration drift (Section 10 #12)
- DA findings unactioned for >X days (Section 08 анти-паттерн #8)
- Discovery refresh cadence (Section 02 анти-паттерн #5)

**Отслеживай:** appearance of hooks для these events. Each provides specific governance signal.

### 11.4.6 Decision rationale mandatory — strong discipline

**Match с explicit operationalization.** CLAUDE.md captures «триггеры для записи» exhaustively. **Stronger** чем typical ADR practice, которая часто relies on team discipline без explicit triggers.

### 11.4.7 Cross-session learning — HYB locus is honest

**Match.** Memory MCP + decision journal + MEMORY.md — multi-tier persistence. HYB locus correctly captures, что Memory MCP — external infrastructure.

**Risk (уже covered Section 10):** memory staleness. CLAUDE.md addresses через «verify by git log / DEV_JOURNAL / CHANGELOG before action».

---

## 11.5 Анти-паттерны для отслеживания

1. **DEV_JOURNAL silence on significant changes.** Симптомы: scope cut, root cause fix, architectural choice — нет journal entry. **Source:** Nygard ADR — silent significant decisions = future archaeology.
2. **Phase closure skipped.** Симптомы: phase ends, next phase starts; нет checklist run; lessons not captured. **Source:** Scrum retro discipline.
3. **Phase kickoff readiness ignored.** Симптомы: PHASE_<N>_READINESS.md created но not actually checked. **Source:** Stage-Gate (с критикой Cagan).
4. **Self-meta-feedback runaway.** Уже в Section 10 #8.
5. **Pattern library decay.** Симптомы: patterns/anti-patterns documented but never consulted in practice; new anti-patterns emerge but не get added. **Source:** general knowledge management.
6. **Hook reminder ignored repeatedly.** Симптомы: phase-completion hook fires; user dismisses reminder; pattern repeats. **Source:** general automation discipline.
7. **Decision journal entries rubber-stamped.** Симптомы: entries created but rationale section is generic («added because needed»). **Source:** Nygard ADR — Context+Decision+Consequences must be substantive.
8. **Memory MCP stale.** Симптомы: agent-stored facts inconsistent с current `.product/` state. **Source:** memory staleness research.
9. **DEC-* numbering inconsistent.** Симптомы: numbering gaps; same number used twice; per-domain prefixes mixed. **Source:** ADR numbering convention.

---

## 11.6 Сигналы для сравнения снапшотов

1. **DEV_JOURNAL entry rate.** Per period.
2. **DEC-* numbering integrity.** Gaps? Duplicates?
3. **Phase closure checklist runs.** Per phase boundary, did it run?
4. **Phase kickoff readiness checklist runs.** Per phase start, did it run?
5. **Pattern library size.** Patterns count + anti-patterns count.
6. **Предложения `/product:meta-feedback`.** Count + approval rate + pattern of proposals.
7. **Запуски `/product:drift-check`.** Verdict distribution.
8. **Запуски `/product:patterns`.** Findings actioned?
9. **Hook reminder engagements.** Hook fires; user response (action vs dismiss vs ignore).
10. **Memory MCP staleness incidents.** Did agent reference outdated facts; did user notice?
11. **Cross-references между DEV_JOURNAL и реальными SPEC changes.** Every significant SPEC change should reference DEC-*; if many changes lack reference, journal discipline weakening.

---

**Конец раздела 11.**
