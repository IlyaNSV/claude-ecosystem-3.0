---
description: Retrieval-ladder Q&A over the .product/ corpus — deterministic counts from the collector, structural (non-vector) routing to artifact types, and a mandatory pointer (ID + path) behind every load-bearing claim. Read-only; creates no artifacts.
---

# Corpus Q&A — the retrieval ladder

Loaded by `/product:ask`. Answers questions about the product corpus in `.product/` by climbing a fixed **retrieval ladder**: cheap deterministic facts first, structural narrowing next, full reads last. No vectors — the corpus is small and structured (IDs, types, frontmatter), so structural retrieval beats embeddings at this size.

**K0 principle (the invariant):** *a claim without a pointer is not emitted.* Every load-bearing statement in the answer must name the artifact it rests on (ID + file path). If it can't be pointed to, it isn't asserted as fact.

**Read-only.** This skill never modifies `.product/` and creates no artifacts.

## Process

### Step 0 — Deterministic census snapshot (SSOT for every number)

Run the collector once at the start:

```bash
node .claude/hooks/product/lib/status-collector.cjs --root . --json
```

This JSON is the **single source of truth for every count and status**: artifact census per type + per-status breakdown, singletons and their metric fields, handoffs + staleness, pending queues + ghosts, session snapshot, DA-findings inventory, stale drafts, integrations.

**DEC-DEV-0217 — never re-count.** Any countable or status answer ("how many FM?", "which HYP are validated?", "how many handoffs are stale?") comes **only** from this JSON. Re-counting files or globbing to produce a number is exactly the drift this collector removes. Do not do it.

**Fallback (collector missing or throws):** countable questions get an honest answer — *"the collector is unavailable, so I can't give exact numbers"* — **not** an approximate hand count. Content questions (Steps 2–6) still proceed by reading artifacts directly; only the numbers are withheld.

### Step 1 — Route the question

Classify the question and pick the path:

- **Countable / status question** ("how many…", "which are active…", "what's the status of…") → answer **directly from the Step 0 JSON**. Stop here for pure-count questions.
- **Substantive / content question** ("how does feature X behave", "what's the value proposition for segment Y", "why did we decide Z") → climb Steps 2–5.
- **Out of corpus** (the answer isn't a product fact recorded in `.product/`) → **honest refusal**: *"`.product/` doesn't contain this."* Hallucination is not permitted — do not answer product questions from general knowledge (Step 6, anti-patterns).

If `--scope <TYPE|ID>` was passed, restrict every subsequent step (type-router, grep, reads) to that type or that single ID.

### Step 2 — Type router (which artifact types, where they live)

Map the question's subject to artifact types and their locations. All paths are under `.product/`:

| Question is about… | Artifact types | Where they live |
|---|---|---|
| problem / market / competitors | PS · MR · CA | `problem.md` · `market-research.md` · `competitive-analysis.md` (root) |
| segments / value | SEG · VP | `segments/` · `value-propositions/` |
| hypotheses / assumptions | HYP | `hypotheses/` |
| scope / plans / releases | MVP · RM · RL | `mvp-scope.md` · `roadmap.md` · `releases/` |
| feature behavior | FM + SC · BR · LC · VC · IC | `features/` · `scenarios/` · `business-rules/` · `lifecycles/` · `verification/` · `invariants/` |
| non-functional requirements | NFR | `nfr/` |
| terms / definitions | BG | `glossary.md` |
| UI / screens / design | MK · NM · DS · AM | `mockups/` (MK, NM) · `design-system.md` (DS) · `app-map.md` (AM) |
| decision history / notes / lessons | NOTE · LESSON + DA findings | `notes/` · `lessons/` · `.da-findings/` |

A question can hit several rows (e.g. "how does checkout behave" → FM + SC + BR + LC). Include all relevant types; the scope flag can narrow later.

### Step 3 — Narrow by frontmatter

Among candidate artifacts of the routed types, prefer by status and confidence:

- **`status: active` outranks `draft`.** Lead with active artifacts.
- **`deprecated` — only when explicitly asked.** Never surface a deprecated artifact as the current answer; include it only if the question is historical ("what did we used to do") and label it deprecated.
- **`confidence` shapes the wording.** A `low`/`medium`-confidence source means the answer is hedged accordingly (Step 6) — say so rather than presenting a tentative claim as settled.

### Step 4 — Grep by keywords

Grep the question's key terms across `.product/` (including `notes/` and `lessons/`) to find the artifacts that actually mention the subject — this catches cross-references and artifacts the type-router alone would miss. Respect `--scope` if set.

### Step 5 — Read the top candidates in full

Read the top **N ≤ 5** most relevant artifacts **in full** (frontmatter + body) — the ones grep + frontmatter narrowing surfaced as most on-point. Reading the whole artifact (not just the matched line) is what lets you answer with grounded specifics and correct pointers.

### Step 6 — Format the answer (pointers are mandatory)

Structure every substantive answer as:

1. **Direct answer** — the short, plain response to the question first.
2. **Grounds** — the reasoning / specifics, drawn from the artifacts read.
3. **Pointers** — an ID + file path for **every load-bearing claim**. This section is not optional (K0).

Discipline for this section:

- **A claim without a pointer is not emitted.** If you can't cite it, don't assert it as fact.
- **Separate the three registers explicitly:**
  - *from artifacts* — grounded, pointed;
  - *inference* — your reasoning beyond what's written; **label it "(inference)"** and keep it out of the facts;
  - *not found in corpus* — say so plainly rather than filling the gap.
- **Confidence honesty.** If a source is `low`/`medium` confidence, or `draft`, say so in the answer — don't launder a tentative artifact into a confident claim.

Example shape:

```
<direct answer>

Grounds:
  <specifics from the artifacts>

Pointers:
  - FM-003 (.product/features/FM-003-checkout.md) — feature scope
  - BR-010 (.product/business-rules/BR-010-tax.md) — the rounding rule
  - (inference) BR-010 likely also governs FM-004, but no explicit link exists.
  - Not found in corpus: refund window duration — no artifact records it.
```

### Step 7 — `--deep` (fan-out for broad questions)

When the question is broad — spanning many artifacts or several subsystems, where one linear pass through the ladder won't cover it — decompose it into focused sub-questions and fan out:

- Spawn **recon subagents**, one per sub-question, at **`model=sonnet`** (fact-gathering / recon without critical analysis, per the Model Delegation Policy).
- Give each a **precise brief**: *"collect the facts for <sub-question> from `.product/`; return the relevant snippets with their ID + file path; do not analyze or conclude."*
- **Synthesize in this main session.** The subagents gather; the main session composes the answer with pointers (Step 6). Reviewing/analyzing the gathered facts is the main session's job — don't delegate the judgment.

Use `--deep` for wide "how does the whole product handle X" questions; a narrow lookup does not need it.

## Anti-patterns

1. **Do not re-count the census by hand.** Every number comes from the Step 0 collector JSON (DEC-DEV-0217). Globbing/counting files to produce a number reintroduces exactly the drift the collector removes.
2. **Do not answer from general product knowledge.** If `.product/` has no data for the question, say so — do not fill the gap with what products "usually" do. Hallucination is the failure mode this skill exists to prevent.
3. **Do not pass off deprecated artifacts as current.** Deprecated content surfaces only on an explicit historical request, always labeled.
4. **Do not blend inference with corpus facts.** Reasoning beyond the artifacts is labeled "(inference)" and kept separate from the pointed, grounded claims.
5. **Do not emit an unpointed load-bearing claim (K0).** If it can't be tied to an ID + path, it isn't asserted as fact.

## Creates no artifacts

This skill only reads. It does not create or modify any artifact, so the frontmatter-template checklist for artifact-creating skills does not apply. If, while answering, you notice a real gap in the corpus (a fact the owner clearly assumes but no artifact records), you may offer — in **one line**, no automation — that they capture it as a NOTE via the `note-capture` skill (natural-language capture; a dedicated `/product:note` command is a future v1.1 item). Offer only; never write on their behalf.

## Related

- Command: `.claude/commands/product/ask.md` (`/product:ask`) — the front door for this skill.
- Companion view: `/product:browse` — self-contained visual browser over the same corpus.
- Companion dashboard: `/product:status` — textual state (counts, pending, handoffs, sessions).
- Collector (SSOT for counts): `.claude/hooks/product/lib/status-collector.cjs`.
- Capture a discovered gap: skill `.claude/skills/product/note-capture.md` (natural-language NOTE capture; `/product:note` command — future v1.1).
