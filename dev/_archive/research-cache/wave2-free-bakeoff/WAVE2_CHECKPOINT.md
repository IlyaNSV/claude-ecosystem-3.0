# WAVE 2 CHECKPOINT — keyed bake-off (session 2026-07-01, cont.)

> Recovery rule: verify real state before continuing. Don't trust memory of last action.
> Parallel sessions move the shared checkout → for file writes use isolated worktree off origin/main.

## Task
Owner: "Wave 2 запусти — прогони keyed bake-off. Изучи контекст досконально и обширно."

## HARD REALITY (honest scope)
- **No API keys in env** (checked: no PERPLEXITY/TAVILY/EXA/LINKUP/OPENAI/ANTHROPIC key; no .env). Paid
  arms (S1 Perplexity / S2 Tavily / S3 Exa / S4 Linkup) NOT executable here. Will NOT fabricate them.
- **Free stack CONFIRMED working:** WebSearch ✅ (US-index, returns real results), WebFetch ✅ (Perplexity
  pricing extracted exact). Judge = Claude sub-agents (no separate key). Semantic Scholar = 429 (shared pool).
- **Executable Wave 2 here = honest projection onto FREE infra:** blind bake-off
  **B0 (naive-free)** vs **B1 (disciplined-free = Pillar-D anti-hype + Pillar-B gate on same free S0)**.
  Answers §8-Q1's deeper cousin: does the METHODOLOGY beat naive free search, before any paid engine?
  Paid arms stay drop-in (frozen set + harness ready).

## Arms
- **B0 naive-free:** generic agent — WebSearch → fetch top ~3-5 → single-pass synthesis + citations.
- **B1 disciplined-free:** WebSearch(+reformulation) → fetch → Pillar-D (atomize/SIFT/provenance-tier/
  triangulate/faithfulness-recheck, keep-DEMOTE-drop) → Pillar-B-gated synthesis w/ uncertainty-honesty.
- Same FREE infra for both. Isolates methodology value, not engine value.

## Frozen artifacts
- Query-set: scratchpad/WAVE2_QUERYSET.md — 24 queries (6 buckets × 4). **FREEZE sha256 =
  beabbbd600b3fb95418b1de34b45fed2caf854693c9fcf5b2b33526c501c6763** (computed before any live call).
- Rubric: Pillar-B 6 metrics (P1 Topical-Rel · P2 Decision-Util · P3 Faithfulness/grounding [source-checked
  live] · P4 Citation-support [separate col] · P5 Corroboration · P6 Directness), anchors 1/3/5.

## Judge protocol (§6.3)
Blind (System A/B, identity stripped) · pairwise B0-vs-B1 · **order-swap ×2, agreement-gated** (verdict counts
only if both orders agree; else UNSTABLE) · single primary judge (Claude) · faithfulness vs FETCHED source not
vibes · anti-length guard. Neutral-third only on UNSTABLE (can't swap model-family here → flag UNSTABLE as
"needs cross-family re-judge", don't fake it).

## STATE (update each seam)
- [x] Context studied (Wave 0.5 §6-7 full, research-intake Pillar B, blueprint). Free stack probed+confirmed.
- [x] Query-set authored + frozen (hash above).
- [x] Run 1 (all 24) `w0c1gvvat` — **FAILED: session-limit** hit mid-burst (48 retrieval agents @ once, 615k tok → limit). 0 ok.
- [BATCHING] Session-limit fragile → split into batches via `args.pick`. Script edited to support `args.pick=[indices]`.
      Batch plan (buckets ordered B1=0-3,B2=4-7,B3=8-11,B4=12-15,B5=16-19,B6=20-23):
      - **Pilot (6, 1/bucket)** pick=[0,4,8,12,16,20] → task **`wghv110q9`** run `wf_d8be77ef-4dc` (LAUNCHED). Validate harness+cost.
      Each returns envelope → **j.result.{scorecard,per_query,meta}**. I concatenate per_query across batches + re-aggregate myself.
      If notification outside context → TaskOutput on the task-id. Aggregation deterministic in-script.
- [x] **Pilot `wghv110q9` DONE** — but args.pick IGNORED (arrived stringified → ran all 24) + 17/24 incomplete
      (retrieval agents hit `StructuredOutput retry cap 5` — heavy web + strict schema didn't converge; 2.9M tok burned).
      **7 ok, real data. B1 leads 6/7 (80% of decided). Means: B0 overall 3.77 / B1 4.70** (B1 higher every metric;
      biggest gaps P3-faith 3.79→4.93, P5-corrob 2.57→3.86, P4-cite 3.79→4.86). Full data: tasks/wghv110q9.output.
      7 ok rows [id·winner·b0ov·b1ov]: Q04 lean-b1 4.33/4.75 · Q08 b1 3.58/4.50 · Q11 b1 4.42/5.0 ·
      **Q13 b0 4.75/4.17** (B0 won — methodology not universal) · **Q21 b1 1.0/5.0** (B0 degenerate 4-tok, discount) ·
      Q22 lean-b1 4.33/4.67 (B1 caught FALSE PREMISE: Amodei co-founded Anthropic not OpenAI) · Q23 b1 4.0/4.83.
      Covariate confound present: B1 longer (673 vs 399) + more cites (3.4 vs 2.3) — judges instructed to control; faith/corrob gaps not length-explainable.
- [x] **ROBUSTNESS FIX applied to script** (same scriptPath): retrieval agents now **SCHEMALESS (plain text)** →
      StructuredOutput can't fail; judge schemas loosened additionalProperties:true; B1 fetch 6→4; RUN hardcoded (BATCH_IDS).
- [x] **Batch-B LAUNCHED: task `wowa53e4s`** run `wf_3dd03e09-caa` — 8 queries [Q17,Q18,Q19,Q20 (B5×4, was empty), Q01,Q05,Q09,Q14].
      On done: merge its ok rows + pilot's 7 → re-aggregate → target n~15 all-buckets. If robustness good + budget, optional batch-C for rest.
- [ ] Results parsed (envelope: j.result.*), score-card built.
- [ ] Wave 2 results note written → dev/RESEARCH_CAPABILITY_WAVE2_BAKEOFF.md (worktree off origin/main).
- [ ] Autoflow: DEC-DEV entry (next-free — VERIFY via git fetch + grep ^## DEC-DEV across remote branches;
      0138 is mine on main, so ≥0139 but CHECK collisions), CHANGELOG [Unreleased], PR, STOP before merge.

## Next action RIGHT NOW
Launch the Workflow (pipeline over 24 queries: [retrieve-B0 ∥ retrieve-B1] → blind-judge-swap → aggregate).
Use agentType:'general-purpose' for retrieval+judge (need WebSearch+WebFetch). Concurrency auto-capped.
On completion: parse j.result, build score-card, write note, autoflow.
