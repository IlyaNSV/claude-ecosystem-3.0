---
description: D1.4 step — synthesize segments + JTBD from PS + MR + CA drafts. Produces SEG-* artifacts with priority tagging.
---

# Segment Discovery — D1.4 Skill

## Input

- PS (active after G1)
- MR draft (queued for DRC)
- CA draft (queued for DRC)

## Goal

Produce 2-4 `.product/segments/SEG-00N-*.md` artifacts, each с 2-4 JTBDs and `priority: primary | secondary | exploratory`. After G4 per-SEG → SEG status=active.

## Process

### Step 1: Synthesis — who's in PS + MR + CA?

From inputs, identify distinct user segments:

**From PS:**
- «Кто страдает» section — primary sufferer profile
- Any secondary mentions («and also agencies», «companies with in-house translators»)

**From MR:**
- User demographics section
- Current behavior patterns — if different segments behave differently, they're likely different SEG

**From CA:**
- Each competitor's stated target → hint at existing known segments в market
- Multiple positionings могут indicate multiple viable segments

### Step 2: Cluster into candidate segments

Cluster users who share:
- Same job-to-be-done context
- Similar economic / size profile
- Similar tooling maturity

Target: 2-4 candidate segments. More = likely over-segmenting в MVP.

Example (для TranslateIT):

```
Candidate SEG-001: Freelance translators
  - solo operators, 3-8 concurrent clients
  - mid-career (3-8 years experience)
  - Uses Trados/memoQ + email
  - Pay per word, ~50-150k/year revenue

Candidate SEG-002: Small translation agencies
  - 5-20 employees
  - Manage 20-100 projects/month
  - Uses agency platforms + direct tools
  - Different economics, different scale pain points

Candidate SEG-003: In-house corporate translators
  - Internal to non-translation companies
  - Part of ops team
  - Completely different workflow, often don't pay for tools
```

### Step 3: Identify JTBDs per segment

Per segment, articulate 2-4 jobs-to-be-done. JTBD format:

```
When <situation>, I want to <motivation>, so I can <expected outcome>.
```

**Strong JTBD:**
> When I receive revision requests from 3+ clients simultaneously across different channels, I want to **centralize them with project context**, so I can process them without losing track or making errors.

**Weak JTBD:**
> I want to use translation tools.  ❌ не situation-specific, no expected outcome

### Step 4: Propose to user

Present candidates:

```
Based on PS + MR + CA, I see 2-4 candidate segments:

🎯 Candidate SEG-001: Freelance translators
   Profile: solo, 3-8 concurrent clients, mid-career (3-8 years)
   Size: ~50-150k/year revenue each, estimated Xk individuals globally
   JTBD-1: When receiving revisions from multiple clients, I want to centralize them...
   JTBD-2: When juggling 5+ projects, I want single-pane overview...
   JTBD-3: When client wants status update, I want quick response without manual searching...
   Confidence: high (evidence from PS + MR section X)

🎯 Candidate SEG-002: Small translation agencies (5-20 employees)
   ...

🎯 Candidate SEG-003: In-house corporate translators
   ...

Suggested priorities:
  🟢 Primary: SEG-001 — closest to PS description, most specific evidence
  🟡 Secondary: SEG-002 — adjacent, may share 70% of features
  🔵 Exploratory: SEG-003 — different enough, likely out of v1 scope

Agree? Adjust?
```

### Step 5: Iterate

Human может:
- Reject a candidate («SEG-003 не наш customer — drop»)
- Add a missing segment («you missed: non-profit translators»)
- Refine JTBDs
- Change priorities

Default iterations: 1-3 rounds. Don't drag out.

### Step 6: Per-SEG approve (G4)

Per approved segment:
- Create `.product/segments/SEG-00N-<slug>.md`
- Frontmatter:
  ```yaml
  id: SEG-00N
  type: segment
  title: "<short name>"
  status: active
  priority: primary | secondary | exploratory
  confidence: high | medium | low
  confidence_notes: "<what's evidence-based vs assumed>"
  ...
  ```
- Body per SEG.md artifact spec

**Confidence articulation (C2):** at approve, state:
```
SEG-001 ready for G4 approve.

Confidence: medium
Rationale: Profile based on PS + MR section 'User demographics' (high).
JTBD-1, JTBD-2 directly from PS pain points (high). JTBD-3 inferred
from related industry reports (medium) — might need user interview
verification later.

Approve? [Y/N/edit]
```

### Step 7: Post-approve

- SEG status → active
- BG extraction runs (new terms from SEG.body → candidates queued)
- Cascade check: downstream artifacts (VP, FM references) will use this SEG

Next steps:
- D1.4a VP design per active SEG (1:1)
- After all SEG approved AND VP-ready → Discovery Review Checkpoint (A2)

## Content rules per SEG (per SEG.md artifact spec)

- **1 segment = 1 clear profile**. «Freelancers and agencies» = 2 segments, not 1.
- **Evidence-based profile**. Age/geography/economics — backed by MR or explicitly marked `[assumption]`.
- **2-4 JTBDs**. Less = undercooked. More = likely covering multiple user types → split.
- **Primary segment** — should be 1 per product. Multiple primaries = focus lost.
- **JTBD specificity.** Situation + motivation + outcome. Not «users want more X».

## Anti-patterns

1. **Over-segmenting.** 8 segments = MVP can't serve all. 2-4 max.
2. **Demographic-only.** «Young millennials» — not a segment. Need behavior/situation context.
3. **Segment = persona with name.** «Sarah the busy translator» — fun but not useful for decisions. Stick to profile.
4. **JTBD conflation.** Don't mix different JTBDs into one sentence. One situation per JTBD.
5. **Primary bias without rationale.** Why is SEG-001 primary? If can't articulate, it's not primary yet.

## Examples of strong JTBDs

- «When onboarding a new client, I want to establish TM inheritance and style guide in <5 minutes, so I can start billable work quickly.»
- «When I have 20+ revisions in an inbox, I want batch-process similar edits, so I don't context-switch per revision.»

## Examples of weak JTBDs

- «I want a good tool.» ❌ not specific
- «Users need to manage their work better.» ❌ not user-centric
- «When using Trados, I want it to be faster.» ❌ tech-solution-focused, not job
