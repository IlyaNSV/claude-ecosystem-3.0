---
description: D1.4a step — design Value Proposition per active SEG (1:1). Simplified Strategyzer-style. Produces VP-* artifacts.
---

# Value Proposition Design — D1.4a Skill

## Input

- Active SEG-* (one-by-one processing)
- MR (queued for DRC)
- CA (queued for DRC)

## Goal

Per active SEG create `.product/value-propositions/VP-00N-*.md` — 1:1 with SEG per DEC-ART03. After G4a per-VP → VP status=active.

## Simplified Strategyzer model

We're not doing full Business Model Canvas. Just the VP side:

**Customer profile** (left side):
- **Jobs** (from SEG.JTBD)
- **Pains** (frustrations, obstacles — from PS)
- **Gains** (benefits they want, outcomes they crave)

**Value map** (right side):
- **Products & Services** (what we offer — high-level, not features yet)
- **Pain relievers** (how we reduce pains)
- **Gain creators** (how we deliver gains)

**Fit** happens when Products/Pain relievers/Gain creators align with Jobs/Pains/Gains.

## Process

### Step 1: Extract customer profile from SEG

From SEG's JTBDs, pain points, and related PS / MR:

**Jobs:**
- Functional jobs (the actual work)
- Emotional jobs (how they want to feel)
- Social jobs (how they want to be perceived)

For translator SEG-001:
- Functional: «deliver quality translations on time», «manage revisions from clients»
- Emotional: «feel in control of my workflow», «not anxious about missing things»
- Social: «appear professional to clients», «be seen as reliable»

**Pains:**
- Concrete pains (evidence-based from PS)
- Obstacles (что блокирует)
- Risks (что может пойти плохо)

**Gains:**
- Required gains (must-have outcomes)
- Expected gains (normal outcomes)
- Desired gains (nice-to-have)
- Unexpected gains (wow factor)

### Step 2: Design value map

Given profile, answer:

**Products & Services** (высокий уровень — не SC/BR yet):
- What do we offer? (обычно 2-4 core offerings)
- For translator SEG-001: «Centralized revisions inbox», «Cross-client project view», «Email-to-project linking»

**Pain relievers:**
- Per pain, explicit relief mechanism
- «Lost revisions between 3 clients» → «Automatic email linking to projects»
- «Manual spreadsheet tracking» → «Auto-populated dashboard»

**Gain creators:**
- Per gain, how we deliver
- «Appear professional to clients» → «Structured revision workflow»
- «Save 2-3 hrs/week» → «Single inbox, batch processing»

### Step 3: Articulate the VP statement

One-sentence format (Strategyzer-style):

```
For <SEG>, who <JTBD summary>, our product is a <category>
that <key value>, unlike <alternative>, we <differentiator>.
```

Example:
```
For freelance translators working 3-8 concurrent clients, who need to
collect and process revision requests without losing context, our product
is a workflow tool that centralizes revisions across email/messaging
channels, auto-linked to projects. Unlike general-purpose project tools
(Notion, Trello) or TM-focused platforms (Trados, memoQ), we integrate
with the actual email flow where revisions arrive today.
```

### Step 4: Present draft

```
Draft VP-001 (for SEG-001: Freelance translators):

Customer profile:
  Jobs (top 3 from SEG JTBDs): ...
  Pains: ...
  Gains: ...

Value map:
  Products: Revisions inbox, Cross-client view, Email-to-project linking
  Pain relievers: ...
  Gain creators: ...

Statement:
  «For <SEG-001>, who... our product is a... unlike... we...»

Differentiator from CA:
  Competitors (Trados, memoQ, Smartcat) focus on TM quality, not
  revision workflow. Smartcat has some multi-client, but not email-native.

Iterate? Approve? [Y/N/edit]
```

### Step 5: Iterate

Usual rounds 1-3. Typical corrections:
- «Products too features — make higher-level»
- «Differentiator too weak — sharper»
- «Added pain we missed»

### Step 6: Approve (G4a)

At approve:
- VP status = active
- Frontmatter populated
- confidence stated
- BG extraction (new terms)
- **Backfill SEG:** в frontmatter родительского SEG заполнить `value_proposition: VP-<NNN>` (+ обновить `updated:`). SEG создаётся на G4 с `value_proposition: null` — здесь, на выходе D1.4a, пара SEG↔VP впервые полна, и V-09 проверяется именно в этот момент (DEC-DEV-0220-e)

**Explicit frontmatter template** (canonical field names по канону [`docs/pmo/artifacts/VP.md`](../../docs/pmo/artifacts/VP.md) § Frontmatter Schema — НЕ переименовывать «для естественности»; урок DEC-DEV-0011: AI склонен renam'ить поля, что вызывает schema drift). Пишется в `.product/value-propositions/VP-<NNN>-<slug>.md`:

```yaml
---
id: VP-<NNN>                        # VP-001, VP-002, ... (три знака, ведущие нули)
type: value-proposition
title: "Короткая формулировка VP"
segment: SEG-<NNN>                   # обязательная 1:1 связь (DEC-ART03)
status: draft | active | deprecated  # draft при первом создании; active после G4a approve
confidence: high | medium | low      # C2 modification — обязательно
confidence_notes: "string"           # required если confidence != high; рекомендован всегда
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1                           # инкремент при каждом draft→active переходе
---
```

**Anti-pattern warnings (НЕ использовать эти соседние имена полей — AI подставляет их «для естественности»):**
- ❌ `confidence_rationale`, `confidence_reasoning`, `rationale`, `reasoning`, `notes` — caused PS drift (DEC-DEV-0011); canonical = `confidence_notes`
- ❌ `seg`, `segment_id`, `related_segment`, `for_segment` — canonical = `segment`
- ❌ `type: vp` / `type: value-prop` — canonical = `type: value-proposition`
- ❌ `id: VP-1` (без ведущих нулей) — canonical = трёхзначный `VP-001`
- ❌ skip frontmatter, полагаясь что VP.md spec покрывает — explicit inline template обязателен (convention B.1, DEC-DEV-0012)

**Filename slug rule:** ASCII-only, первые 3-5 значимых слов title, lowercased + hyphenated, max 50 chars; кириллица транслитерируется per ГОСТ 7.79-2000 System B. Полное правило — [`docs/pmo/artifacts/README.md`](../../docs/pmo/artifacts/README.md) § «Naming conventions» → «Slug derivation rule».

## Content rules per VP artifact

- **1:1 with SEG** (DEC-ART03). Don't merge VPs across segments even if similar.
- **High-level products**, not feature list. Specific features come в D2.
- **Evidence-based differentiator.** Reference CA for «unlike <competitors>».
- **Measurable value claims.** «Save time» weak. «Reduce revision processing from 2-3h/week to <30min» stronger.
- **Emotional + functional.** Don't skip emotional jobs/gains — they drive adoption.

## Confidence articulation (C2)

At approve:

```
VP-001 ready for G4a approve.

Confidence: medium
Rationale: 
- Customer profile directly derived from SEG-001 JTBDs + PS (high)
- Value map is hypothesis — pain relievers claim causal relationship
  (e.g., «email linking reduces revision loss») that's not yet validated (medium)
- Differentiator from CA — based on competitor feature matrix (medium-high)
- Statement claims «centralize across channels» — scope question for MVP
  (only email в v1? or also Telegram, etc.?)

Approve as-is or refine scope?
```

## Anti-patterns

1. **Feature list disguised as VP.** «Our product has X, Y, Z» — that's not VP, that's product description.
2. **Too broad.** «For everyone who needs productivity» — не actionable.
3. **Unproven value.** «Save 80% of time» without evidence. Use «targeting 50% reduction (validated by HYP-001)» — ties to validation.
4. **Ignoring alternatives.** No «unlike X» clause → no differentiation articulated.
5. **Weak emotional dimension.** Only functional jobs → VP feels transactional.
6. **VP for multiple SEGs in one document.** 1 SEG = 1 VP. Merge пытается hide differences.

## Examples

**Strong VP statement:**
> For freelance medical translators (SEG-001) handling 5+ regulatory docs simultaneously, who need terminology consistency across fragmented projects, our product is a domain-aware terminology engine that auto-suggests from prior translations в real-time. Unlike generic TMs (Trados, memoQ) which require manual TM management, we auto-learn from your own prior work and flag inconsistencies on the fly.

**Weak VP:**
> Our product helps translators be more productive. We have AI and modern UX.  ❌ no customer, no differentiation, no specificity

## Handoff to D1.5

After G4a, VP is active. D1.5 HYP formulation uses VP as grounding — hypotheses validate WHETHER VP claims hold in reality.
