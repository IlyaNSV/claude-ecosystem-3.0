---
description: D3 modification — quick capture flow for NOTE-* unstructured artifact. 30-second target idea-to-saved.
---

# Note Capture — D3 Skill

Quick flow для capturing ideas/insights/questions into NOTE-* artifacts.

**Goal:** idea → saved file в ≤30 seconds. Minimal structure, maximum velocity.

## When invoked

User says something like:
- «Запиши заметку что X»
- «Add a note: ...»
- «Save this thought: ...»
- «Let me capture что ...»

Ассистент recognizes capture intent → invokes this skill (не formal command since это lightweight).

Also callable explicitly: `/product:note "<content>"` (future command в v1.1, для now use natural language).

## Process

### Step 1: Extract content

From user message, identify:
- Title (short — first sentence или user-provided)
- Body content (full thought)
- Optional: related artifacts (если mentioned)
- Optional: tags (user says «это деферит» → tag `deferred`; «идея» → `idea`; «вопрос» → `question`)

### Step 2: Infer metadata

**ID:** Next available `NOTE-<NNN>` from `.product/notes/` (3-digit, zero-padded)

**Title:** 
- Если user provided — use as-is, trim to ~60 chars
- Else — first sentence of content, truncated if needed

**Related (optional):**
- Scan content для mentions of artifact IDs (e.g., «для FM-003»)
- Extract them → frontmatter.related

**Tags (optional):**
- Heuristic from content:
  - «если будем делать», «в будущем» → `deferred`
  - «вопрос», «?» в content → `question`
  - «идея», «можно» → `idea`
  - «инсайт», «заметил что» → `insight`
  - User-explicit tags override heuristic

**Confidence:**
- Default `low` (NOTE is usually speculative)
- If user explicit («точно знаю что X») → `medium`
- Rarely `high` для notes (usually speculative format)

**Status:** `active` (not draft — note doesn't need approve gate; it's a captured thought)

### Step 3: Generate minimum frontmatter

```yaml
---
id: NOTE-007
type: note
title: "<extracted title>"
status: active
confidence: low
confidence_notes: "Captured as-is from idea; not yet validated"
related: [<if extracted>]
tags: [<if inferred or provided>]
created: <today>
updated: <today>
version: 1
---
```

### Step 4: Write body

Minimum structure:

```markdown
## Содержание

<user's content, preserved as-is>

## Контекст (optional)

<when/where this came up, if user mentioned>
```

If user gave rich content (several paragraphs), preserve structure.
If terse («идея: Trados integration») — expand minimally:

```markdown
## Содержание

Рассмотреть интеграцию с Trados Studio — возможный USP 
«work alongside, not replace».
```

### Step 5: Save

Path: `.product/notes/NOTE-<NNN>-<slug>.md`

Slug: first 3-4 words of title, lowercased, hyphenated:
- «Возможность интеграции с Trados Studio» → `trados-integration`
- «Question: что делать с batch window edge case?» → `batch-window-edge-case`

Create `.product/notes/` if missing.

### Step 6: Confirm minimal

```
✓ NOTE-007 saved: "<title>"
Tags: [idea, future-feature]
Related: [SEG-001, FM-003]

Продолжаем?
```

Don't overwhelm — human keeps working без pause.

## When to expand (user explicitly asks)

If user says «давай подробнее про эту note» или calls `/product:note NOTE-007 --expand`:

Show full NOTE.md template (Purpose, Context, Содержание, Возможные действия, Конкретные решения) — user fills in as structured document.

Usually capture is minimal — expansion happens later (or never, if idea dies gracefully).

## Promotion flow

When NOTE matures into real artifact — `/product:promote-note <NOTE-id> to <TYPE>` (D3 promote command).

This skill just captures; it's not responsible для conversion.

## Anti-patterns

1. **Over-structuring capture.** If NOTE needs 10 minutes to write, it's not a NOTE — it's a real artifact. Push back: «this feels like it's ready для FM, want /product:feature instead?»
2. **Losing content.** User's exact words matter — don't paraphrase unnecessarily. Only structure slightly.
3. **Auto-promoting.** NOTE should stay NOTE until explicitly promoted. Don't try to guess «this should be an FM» without asking.
4. **Forgetting tags.** Tags make NOTE searchable later. Add at least one heuristic tag when possible.
5. **Missing related.** If user mentioned «по поводу FM-005» — capture в related[]. Critical для cross-reference later.

## Examples

### Example 1: Minimal capture

User: «запиши что надо подумать о pricing model в какой-то момент»

Ассистент:
1. Title: "Pricing model — подумать позже"
2. Tags: [deferred, business-model] (heuristic)
3. Content: user's exact phrase preserved
4. Creates NOTE-012 in ≤5 seconds
5. Confirms briefly

### Example 2: Rich capture

User: «захвати заметку:

Во время Discovery (D1.3 CA) узнал, что 60% профессиональных переводчиков SEG-001 используют Trados Studio. Возможно стоит интегрироваться вместо конкурировать. Trados имеет open API, TM → revisions context. Это могло бы быть USP «work alongside, not replace». Связано с FM-003 Revisions inbox. Рассмотреть после валидации HYP-001»

Ассистент:
1. Title: "Интеграция с Trados Studio — USP hypothesis"
2. Tags: [idea, future-feature] (heuristic from «возможно», «могло бы»)
3. Related: [SEG-001, FM-003, HYP-001] (explicit mentions)
4. Content: preserved with minor formatting
5. Confirms: «✓ NOTE-007 saved. Promote через /product:promote-note когда созреет.»

## Related

- Artifact spec: `.claude/docs/pmo/artifacts/NOTE.md`
- Promotion: `.claude/skills/product/note-promote.md` (for converting NOTE → structured)
- Command D3: `/product:promote-note`
- User-facing invocation: natural language («запиши заметку что…»)
