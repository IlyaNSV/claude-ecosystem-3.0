---
description: Ask a question about the product corpus (.product/) — answered by the corpus-qa "retrieval ladder" skill, with a pointer (ID + file path) behind every load-bearing claim. Read-only; no hallucination — if it's not in the corpus, it says so.
argument-hint: "\"<question>\" [--scope <TYPE|ID>] [--deep]"
---

# /product:ask

User invoked: `/product:ask $ARGUMENTS`

Thin command over the **`corpus-qa` retrieval-ladder** methodology. Answers questions about `.product/` — counts, statuses, and content — grounding every load-bearing statement in a concrete artifact (ID + path). Read-only.

## Step 1 — Check initialization

If `.product/` doesn't exist (check via `.claude/product.yaml`):

```
Product Module not initialized.

Use /ecosystem:bootstrap to set up the project, or /product:init to start Discovery.
```

Refuse and stop.

## Step 2 — Parse arguments

- **`"<question>"`** — the question, taken from `$ARGUMENTS` (everything that isn't a recognized flag).
- **`--scope <TYPE|ID>`** — narrow the search to one artifact **type** (e.g. `FM`, `HYP`, `BR`) or a single **ID** (e.g. `FM-003`). The skill restricts its type-router and grep to that scope.
- **`--deep`** — for broad questions that span many artifacts: the skill fans out **recon subagents** (`model=sonnet` — fact-gathering only, per the Model Delegation Policy), then synthesizes their findings **in this main session**. Use for wide "how does the whole product handle X" questions; skip for narrow lookups.

## Step 3 — Run the retrieval ladder

Load the skill **`.claude/skills/product/corpus-qa.md`** and execute its Process on the parsed question, honoring `--scope` and `--deep`.

The skill:
- pulls a deterministic census snapshot from the collector (all counts/statuses come from there — no manual re-counting, DEC-DEV-0217);
- routes the question (countable → answer from JSON; substantive → type-router → frontmatter narrowing → grep → read top-N; out-of-corpus → an honest "not in `.product/`");
- returns a direct answer with a **Pointers** section: an ID + file path behind every load-bearing claim, with facts, inference, and "not found" kept clearly separate.

Surface the skill's answer to the user.

## Error handling

| Error | Action |
|---|---|
| `.product/` missing | Refuse; point to `/ecosystem:bootstrap` (Step 1) |
| Empty question (no text in `$ARGUMENTS`) | Ask what to look up; suggest `/product:browse` for open-ended exploration |
| Collector unavailable | The skill degrades: countable questions get an honest "collector unavailable — no exact numbers"; content questions still answered from artifacts. Never approximate counts by hand |
| Question is outside the corpus | The skill answers honestly ("`.product/` doesn't contain this") — hallucination is not permitted |

## Related

- `/product:browse` — visual, self-contained HTML view of the same corpus (search + cross-links + work panel).
- `/product:status` — textual dashboard (counts, pending, handoffs, sessions).
- Skill: `.claude/skills/product/corpus-qa.md` — the retrieval-ladder methodology this command runs.
