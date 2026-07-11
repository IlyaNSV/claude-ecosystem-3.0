# Wave 2 — FROZEN query-set (v1, as-of 2026-07-01)

> Freeze rule (§6.1): set finalized BEFORE first live retrieval call. No engine-favoring
> phrasing. Fact-oriented → faithfulness source-checkable. Date-stamped. 6 buckets × 4 = 24.
> (Full-spec target = 42 (7/bucket); this v1=24 is the live-run set. Extra 18 = keyed-run backlog.)
>
> Answer-keys: NOT pre-authored as authoritative truth (would risk contaminating scoring with
> my own possibly-hyped priors). P3-Faithfulness is judged LIVE against fetched source per §6.3(f).
> "expected shape" = what a decision-useful answer must contain, not a graded truth-string.

## B1 — Market-size / TAM
- Q01: What is the estimated 2026 global market size (USD) for AI coding assistant tools, and what CAGR is projected through 2030? [shape: a $ figure + CAGR% + named analyst source + base year]
- Q02: How many paying users does GitHub Copilot report as of 2026, and what revenue figures have been disclosed? [shape: user count + $ ARR/revenue + date of disclosure]
- Q03: What is the 2026 total addressable market for vector-database software, and which analyst firms published estimates? [shape: $ TAM + named firm(s)]
- Q04: What share of professional developers report using AI coding tools, per the 2025–2026 Stack Overflow and/or JetBrains developer surveys? [shape: % + which survey + year]

## B2 — Competitor-scan
- Q05: Who are the leading competitors to Cursor (the AI code editor) as of 2026, and how do they differentiate? [shape: ≥3 named products + a differentiator each]
- Q06: What are the main actively-maintained open-source alternatives to LangChain for building LLM-agent applications in 2026? [shape: ≥3 named frameworks + maintenance signal]
- Q07: Who are the primary competitors to Perplexity in the AI answer-engine space as of 2026? [shape: ≥3 named + positioning]
- Q08: Which vendors offer managed retrieval-augmented-generation (RAG) platforms in 2026, and what are their pricing models? [shape: ≥3 vendors + pricing axis]

## B3 — Tool / tech due-diligence
- Q09: Is the Model Context Protocol (MCP) an open standard, who maintains it, and what license does it use as of 2026? [shape: open? + maintainer org + SPDX license]
- Q10: What is Chroma (the vector store) using for persistence by default, and what scaling limits are documented? [shape: storage engine + a documented limit]
- Q11: What is the current maintenance status, license, and approximate star count of the official Perplexity MCP server on GitHub? [shape: last-push recency + license + ★]
- Q12: Does Playwright support React component testing as of 2026, and what is that feature's stability status? [shape: yes/no + experimental/stable + source]

## B4 — NFR / perf-benchmarks
- Q13: Are there any official published latency (p50/p99) figures for Anthropic's Claude API as of 2026? [shape: numbers-or-honest-"no official figures published" — a good answer may correctly say none exist]
- Q14: What queries-per-second can a single-node Qdrant instance sustain for ~1536-dim vectors, per published benchmarks? [shape: QPS range + benchmark source + config caveat]
- Q15: How does SQLite's write concurrency compare to PostgreSQL under concurrent writers, per documented behavior? [shape: mechanism (single-writer lock vs MVCC) + implication]
- Q16: What is the documented maximum context window (tokens) of the leading frontier LLMs as of mid-2026? [shape: ≥3 models + token counts + source]

## B5 — Recency-sensitive (30–90 days: ~Apr–Jul 2026)
- Q17: What major AI model releases happened between May and July 2026? [shape: ≥2 named releases + dates within window]
- Q18: Has OpenAI announced any API pricing changes in the last ~90 days as of July 2026? [shape: specific change+date, or sourced "none announced"]
- Q19: What is the most recent funding round for Anysphere (maker of Cursor) as of July 2026 — amount and valuation? [shape: $ raised + valuation + date]
- Q20: Were there notable acquisitions in the AI developer-tools space in Q2 2026? [shape: ≥1 acquirer→target + date]

## B6 — Multi-hop (FRAMES-style: chain ≥2 facts)
- Q21: Which company acquired the maker of the Tavily search API in 2026, and what is that acquirer's primary cloud-compute business? [hop1: acquirer of Tavily; hop2: acquirer's core business]
- Q22: The CEO of the company that makes Claude previously co-founded which organization, and in what year was that organization founded? [hop1: Anthropic CEO's prior org; hop2: its founding year]
- Q23: Among vector databases written primarily in Rust, which had the largest GitHub star count as of 2026, and where is its parent company headquartered? [hop1: top-★ Rust vector DB; hop2: HQ location]
- Q24: The AI code editor Cursor is a fork of which open-source editor, and which company originally develops that base editor? [hop1: base editor; hop2: its originating company]

---
FREEZE: hash computed over this file at launch (see WAVE2_CHECKPOINT.md). Any edit after launch = new version.
