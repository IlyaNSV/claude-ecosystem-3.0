---
description: D1.1 step — authoring Problem Statement through 5-8 clarifying questions. Called by discovery-session.
---

# Problem Discovery — D1.1 Skill

Guide the dialogue to extract a clear Problem Statement (PS) from user's initial idea.

## Input

User has invoked `/product:init "<idea description>"`. You have:
- Raw idea text (possibly vague)
- Project context (if any) from `.claude/product.yaml`

## Goal

Produce `.product/problem.md` в draft → active after G1 gate. Target: 200-500 words, clear, without tech details.

## Process

### Step 1: Restate what you heard

Acknowledge the idea. Paraphrase to check understanding:

```
Let me restate what I heard:

You want to build <X> for <Y> to solve <Z>. The core problem seems to be:
«<paraphrase of problem>»

Is that right, or should I reframe?
```

### Step 2: 5-8 clarifying questions

Ask in 2-3 batches (не все 8 сразу — overwhelming). Focus on:

**Batch 1: Who & What**
- Кто основной страдающий? (profile — occupation, situation, context)
- В чём главная боль (pain) — organizational, time, money, quality, emotional?
- Насколько острая проблема — вечно актуальна или ситуативна?

**Batch 2: Scope & Frequency**
- Как часто сталкиваются с этой проблемой?
- Сколько человек приблизительно страдают (region / global / niche)?
- Что они сейчас делают, чтобы справляться (workarounds, альтернативы)?

**Batch 3: Context & Evidence**
- Видел ли эту проблему лично, или это hypothesis?
- Какие у тебя есть доказательства (интервью, посты на форумах, статистика)?
- Что думают existing решения не решают правильно?

Stop at 5-8 questions total. Don't overexplore in D1.1 — more research comes в D1.2 MR.

### Step 3: Draft PS

**Frontmatter** (canonical field names — per [PS.md artifact spec](../../docs/pmo/artifacts/PS.md)):

```yaml
---
id: PS
type: problem-statement
title: "<short problem formulation, 5-10 слов>"
status: draft                             # active after G1 approve
confidence: high | medium | low           # C2 modification — required
confidence_notes: |                       # REQUIRED if confidence != high; recommended всегда
  <what's solid — evidence, direct signal>
  <what's assumed — gaps, unverified claims>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Canonical field names (НЕ варьировать — consistency с остальными 21 типами артефактов и C2 modification):**
- `confidence` — **не** `confidence_level`, **не** `conf`
- `confidence_notes` — **не** `confidence_rationale`, **не** `rationale`, **не** `confidence_reasoning`

Проверка перед write: если ассистент склонен переназвать поле (например, «`confidence_rationale` звучит естественнее») — **нет, не переназывать.** Схема в PS.md зафиксирована; drift на уровне field names ломает tier-aware validation и будущие cross-artifact checks.

**Body structure** (per PS.md artifact spec):

```markdown
# Problem Statement

## Кто страдает
<Profile of primary sufferer — role, situation, context. Не абстрактное «users», а specific: «Freelance translators working 3-8 клиентов параллельно»>

## В чём боль
<Concrete pain description. Не «it's hard to X», а «takes 2-3 hours per week because Y, causing Z consequence»>

## Масштаб и частота
<How many, how often. Use concrete numbers from user's input or explicitly mark [оценочно] if guessed>

## Как справляются сейчас
<Workarounds, existing alternatives, their pros/cons>

## Почему это важно
<Consequence of unsolved problem: time, money, emotional, opportunity cost>

## Что мы хотим изменить
<Brief statement of desired future state — not solution yet, just «what problem goes away»>
```

### Step 4: Content rules (per PS.md)

- **Без технологий.** «Мы построим PostgreSQL database» — нет. «Мы решим X» — да.
- **Без solution bias.** PS не говорит КАК, только ЧТО.
- **200-500 words.** Shorter — недостаточно; longer — probably включает solution detail.
- **Specific > generic.** «Users want better UX» — generic. «Freelance translators lose 2-3 hours/week manually collecting revisions from 3-8 client emails» — specific.

### Step 5: Present draft to user

```
Draft Problem Statement ready:

[shows PS draft с structure above]

Iteration 1 — что поправить?
```

### Step 6: Iterate

Normal: 2-3 rounds. Human corrects:
- Numbers («not 2-3 hours, more like 4-6»)
- Profile («not just freelancers — also agencies»)
- Framing («don't call it 'collecting revisions', it's 'managing client feedback'»)

Assistant updates PS with each round. Don't resist — human knows their domain.

### Step 7: Confidence statement & approve

When human готов:

```
PS ready for G1 approve.

Confidence: <high | medium | low>
Rationale: <what's solid, what's assumed>

Approve? [Y/N/edit]
```

On approve:
- PS status = active
- BG extraction queued (bold terms become candidates)
- Version++
- Journal entry (🟠 Strategic level)

## Common mistakes to avoid

1. **Jumping to solutions в questions.** «Should we use AI or rules-based?» — that's D2 territory.
2. **Tech stack questions в D1.1.** «What framework?» — out of scope PS.
3. **Assuming personas без evidence.** Don't put «Millennials» в PS unless user confirmed it.
4. **Over-research.** D1.1 is 15-30 мин maximum. MR в D1.2 does the deep dive.
5. **Under-specificity.** Don't approve PS that reads like «we want to help users». Push for specificity.

## Anti-patterns в PS

- **Solution сказанное как problem.** «Users need a dashboard» — it's presumed solution. Real problem: «users can't get quick overview of their current state».
- **Tech detail.** «Database users need faster queries» — implementation. Real: «users frustrated by slow response times».
- **Too broad.** «Translation industry is inefficient» — not actionable. Focus on one slice.
- **Too narrow for MVP.** «Freelance translators working on medical documents in German-English pairs using Trados Studio 2024 version specifically» — over-constrained.

## Examples

**Good PS fragment:**
> Freelance translators (primary user) working с 3-8 clients параллельно спends 2-3 hours/week manually collecting revisions from email threads, Google Docs comments, and direct messages. Lost context between revision requests causes errors (wrong document version, missed items). Current workarounds (spreadsheet tracking, email folders) break down beyond 5 concurrent projects.

**Anti-example:**
> Users have problem. We will solve. Market is big. Competition exists but we can be better. We think AI helps.  ❌ vague, no specificity, no evidence
