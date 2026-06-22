---
description: C4 modification — meta-linter for recurring anti-patterns in .product/. Pattern dictionary expandable. Informational only.
---

# Pattern Linter — C4 Skill

Methodology for `/product:patterns` command. Scans `.product/` for recurring anti-patterns across artifacts.

**Non-blocking informational.** Outputs suggestions, не enforcement.

## Pattern dictionary (v1)

Each pattern has: applicable scope, heuristic, false-positive rate, severity, fix suggestion.

### Pattern 1: `hardcoded-across-BR`

- **Scope:** BR-*
- **Heuristic:** Scan BR.body for numeric values и regex patterns. Flag when same exact value/pattern appears in 2+ different BRs.
- **Heuristic implementation:**
  - Extract all numeric literals, regex patterns, and quoted string constants from BR body
  - Cluster by value
  - Flag clusters with 2+ BRs
- **False-positive rate:** ~15% (semantic equivalents missed; trivial values like `0` or `1` noise)
- **Severity:** ⚠ (structural improvement)
- **Fix suggestion:**
  - Extract shared value as dedicated BR (e.g., `BR-EMAIL-FORMAT`) referenced by others
  - OR externalize to project config with parameter reference

### Pattern 2: `missing-actor-in-SC`

- **Scope:** SC-*
- **Heuristic:** Parse SC body `## Steps` section. For each numbered step, check first word. If not clearly an actor (role from RPM or «System»/«User»/subsystem name) — flag.
- **Heuristic implementation:**
  - Regex: `^(\d+\.)\s+([A-Za-zА-Яа-я]+)` to extract first token per step
  - Compare against RPM roles + canonical actors
  - Flag «it», «the system» (too vague), «validates», etc.
- **False-positive rate:** ~10-15%
- **Severity:** ℹ (consistency)
- **Fix suggestion:** Review SC, explicitly prefix each step with actor

### Pattern 3: `asymmetric-FM-deps`

- **Scope:** FM-*
- **Heuristic:** For each FM.frontmatter.dependencies[], check reverse relationship:
  - If FM-A.dependencies includes FM-B, does FM-B list FM-A as dependent (in «dependents» field or implicit via cross-ref)?
- **Heuristic implementation:**
  - Build directed graph of FM dependencies
  - Find edges without reverse or reciprocal documentation
- **False-positive rate:** ~5% (reliable parsing of frontmatter)
- **Severity:** ⚠ (bi-directional refs invariant)
- **Fix suggestion:** Auto-fixable (V-11 bi-dir engine может patch)

### Pattern 4: `over-parameterized-BR`

- **Scope:** BR-*
- **Heuristic:** Count `parameters:` entries in BR.frontmatter. Flag if >=8.
- **False-positive rate:** ~20% (some BRs genuinely parameterize many related values)
- **Severity:** 🔵 (design review suggestion)
- **Fix suggestion:** Consider splitting BR — parameters may be mixing concerns

### Pattern 5: `stale-draft-accumulation`

- **Scope:** all artifacts
- **Heuristic:** Count artifacts в status=`draft` с `updated:` more than 14 days ago.
  - Threshold configurable via `.claude/product.yaml.stale_draft_days`
- **Severity:** 🟡
- **Fix suggestion:** `/product:cleanup --dry-run` для preview orphan list; archive or resume per draft (V-15 picks up drafts referenced nowhere). Note: V-12 (stale drafts as such) — `/product:validate --rule V-12`; cleanup focuses на orphan refs graph.

### Pattern 6: `synonym-candidates-in-BG`

- **Scope:** BG
- **Heuristic:** For all BG terms, pairwise compare:
  - Levenshtein distance < 3
  - OR shared root (prefix matching)
  - OR translation pairs (english «revision» + «правка» in same BG)
- **False-positive rate:** ~25% (many root-sharing terms are legitimately distinct)
- **Severity:** ℹ
- **Fix suggestion:** Review pairs; either consolidate via `/product:bg-rename` или document в alt_terms

### Pattern 7: `orphan-in-active-FM`

- **Scope:** SC-*, BR-*, LC-*, MK-*, VC-*, IC-*, NFR-*
- **Heuristic:** Artifact status=active, но:
  - No active FM references this artifact AND
  - Artifact не is в `deferred_by_design` list
- **Severity:** 🟡
- **Fix suggestion:** Re-link to FM или archive/deprecate. Complements V-15.

### Pattern 8: `BR-without-rationale`

- **Scope:** BR-*
- **Heuristic:** BR.body parsed; if no `## Rationale` section OR rationale <20 characters → flag
- **False-positive rate:** ~5%
- **Severity:** 🟡
- **Fix suggestion:** Add rationale explaining business reason («Interview SEG-001 showed…»)

### Pattern 9: `SC-without-verification`

- **Scope:** SC-*
- **Heuristic:** SC status=active, but SC.frontmatter.verification[] is empty OR no VC references this SC
- **False-positive rate:** ~0% (reliable parsing)
- **Severity:** ⚠ (complements V-07)
- **Fix suggestion:** Derive VC via `/product:feature` F.6 step

### Pattern 10: `LC-unreachable-states`

- **Scope:** LC-*
- **Heuristic:** Graph analysis: for each state в LC.states[], check if any transition terminates at this state.
  - Complements V-05 but goes further — V-05 checks reachability from initial; this checks if state is ever entered at all
- **False-positive rate:** ~0%
- **Severity:** ⚠
- **Fix suggestion:** Remove unused state OR add transition into it

### Pattern 11: `inconsistent-BR-categories`

- **Scope:** BR-*
- **Heuristic:** For pairs of BRs с similar titles / entity scope, check if category differs
- **False-positive rate:** ~40% (genuine distinctions common)
- **Severity:** 🔵 (review suggestion, not error)
- **Fix suggestion:** Review pair — if actually same logic, align categories. Otherwise clarify naming.

## Process

### Step 1: Parse arguments

- No args → scan all patterns, all applicable artifacts
- `--scope <type>` → limit to one artifact type
- `--pattern <name>` → limit to one pattern (focused scan)

### Step 2: Scan

Per pattern, apply heuristic. Collect matches.

Parallelize: patterns are independent, can run concurrently.

### Step 3: Aggregate findings

Group by severity:
- ⚠ Structural issues (patterns 1, 3, 9, 10)
- ℹ Consistency issues (patterns 2, 6, 11)
- 🟡 Hygiene (patterns 5, 7, 8)
- 🔵 Optional improvements (patterns 4)

### Step 4: Format report

Per `/product:patterns` Step 4 output template. Include:
- Findings per severity category
- Confidence statement (C2) — per-pattern FP rate summary
- Suggested actions (high-value, review, optional)

### Step 5: Journal (conditional)

If 5+ total findings OR any ⚠ asymmetries — journal summary. Otherwise don't noise journal.

## Pattern dictionary evolution

**v1 covers baseline 11 patterns.** Expected additions in v1.1 based на pilot findings.

**How patterns are added:**
- Manual edit of this skill file (common anti-patterns observed)
- OR via `/product:validation-tune` proposal — «I notice pattern X — add to dictionary?»

**Removal:**
- If pattern generates >70% false positives — deprecate или refine heuristic
- Document in CHANGELOG

## Heuristic quality considerations

Always include **confidence per pattern** in report:

```
Pattern hardcoded-across-BR: 3 findings
  Confidence: medium (exact match only; semantic equivalents missed)
  
Pattern asymmetric-FM-deps: 2 findings
  Confidence: high (reliable frontmatter parsing)
```

User can weight findings based on pattern reliability.

## Auto-fix limitations

Safe to auto-fix:
- `asymmetric-FM-deps` — via bi-dir engine (V-11)

Should NOT auto-fix:
- `hardcoded-across-BR` — architectural decision (how to refactor)
- `inconsistent-BR-categories` — semantic judgment
- `over-parameterized-BR` — design split

Auto-fix only после explicit user approve, per finding.

## Anti-patterns внутри pattern-linter itself

1. **Over-flagging.** Better to miss than false-flag. Tune towards precision над recall.
2. **Abstract reporting.** Bad: «3 BRs have category issues». Good: «BR-010 (workflow) and BR-015 (calculation) have semantically similar logic».
3. **Auto-action.** Никогда не fix без approve — even безопасные changes need confirmation.
4. **Scope creep.** Adding patterns that cross into design/architecture review — out of scope. Keep focused на artifact structural consistency.

## Related

- Command: `/product:patterns`
- Pattern dictionary is expandable here (this file)
- Complementary: `/product:drift-check` (direction) vs patterns (consistency)
- Validation rules: see `.claude/docs/pmo/validation.md` — some patterns overlap с V-* (clarify relationships case-by-case)
