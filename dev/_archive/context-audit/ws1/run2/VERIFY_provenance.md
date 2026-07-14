# Provenance Verification — WS1 Run2

> Роль: агент верификации провенанса. Проверено существование + venue + статус рецензирования.
> НЕ читал работы глубоко, НЕ синтезировал содержание — только существование/venue/review status.
> Дата проверки: 2026-07-12. Метод: WebFetch на первичный источник (arXiv abstract page) +
> независимая кросс-проверка через WebSearch (title/ID/URL сходятся в обоих каналах).

## Сводная таблица

| # | Referenced as | Verdict | Venue | Reviewed? |
|---|---|---|---|---|
| 1 | arXiv 2606.22528 "Governance Decay" | **CONFIRMED** (exists) | arXiv only | No — preprint, no accepted-venue note |
| 2 | arXiv 2605.12978 "Useful Memories Become Faulty" | **CONFIRMED** (exists) | arXiv only | No — preprint, no accepted-venue note |
| 3 | arXiv 2604.20911 "Omission-vs-Commission" | **CONFIRMED** (exists, title paraphrased) | arXiv only | No — preprint, no accepted-venue note |
| 4 | arXiv 2606.16364 "Looking-Is-Not-Picking" | **CONFIRMED** (exists) | arXiv only | No — preprint, no accepted-venue note |
| 5 | ManyIFEval | **CONFIRMED** | Findings of ACL: EMNLP 2025 (aclanthology.org/2025.findings-emnlp.896) | **Yes** — peer-reviewed, accepted |
| 6a | RAND harness | **CONFIRMED** | Workshop @ ICLR 2026 ("Agents in the Wild: Safety, Security, and Beyond", Rio de Janeiro, Apr 26 2026) | **Yes** — workshop-accepted (lighter-weight review than main track) |
| 6b | Kohli | **CONFIRMED** — but is a *third, separate* paper, not co-author of 6a or 6c | arXiv only (2605.29800) | No — preprint, no accepted-venue note |
| 6c | "Reliability without Validity" | **CONFIRMED** | arXiv only (2606.19544) | No — preprint, no accepted-venue note |

---

## 1. arXiv 2606.22528 — "Governance Decay"

**Verdict: CONFIRMED — PREPRINT_ONLY**

- Exact title: *"Governance Decay: How Context Compaction Silently Erases Safety Constraints in Long-Horizon LLM Agents"*
- Author: Shiyang Chen
- Submitted: 21 June 2026
- Subjects: cs.AI
- Comments field: **absent**. Journal-ref: **absent**. No mention of conference/journal/workshop acceptance anywhere on the abstract page.
- Confirmed independently via WebFetch of `arxiv.org/abs/2606.22528` (resolves to a real, populated abstract page, not a 404) and via WebSearch, which independently returned the same title/ID/URL (plus `arxiv.org/pdf/2606.22528` and `arxiv.org/html/2606.22528`).
- **Status: exists, arXiv preprint, not (yet) peer-reviewed at any identifiable venue.**

Note on priority claim in the audit brief: the claim that context compaction can silently drop system-prompt/policy content is the paper's stated thesis (per its own abstract) — but I have not evaluated whether that claim is *correct*, only that the paper exists and makes that claim. That's a content judgment outside this task's scope.

## 2. arXiv 2605.12978 — "Useful Memories Become Faulty"

**Verdict: CONFIRMED — PREPRINT_ONLY**

- Exact title: *"Useful Memories Become Faulty When Continuously Updated by LLMs"*
- Authors: Dylan Zhang, Yanshan Lin, Zhengkun Wu, Yihang Sun, Bingxuan Li, Dianqi Li, Hao Peng (UIUC / Tsinghua per secondary sources — not verified on the abstract page itself)
- Submitted: 13 May 2026
- Subjects: cs.AI
- Comments field: **absent**. Journal-ref: **absent**.
- Cross-confirmed via WebSearch: GitHub paper-notes issue tracker, Papers-with-Code mirror, and an author project page (`dylanzsz.github.io/faulty-memory/`) all independently reference the same arXiv ID and title.
- **Status: exists, arXiv preprint, not peer-reviewed at any identifiable venue.**

## 3. arXiv 2604.20911 — referenced as "Omission-vs-Commission"

**Verdict: CONFIRMED — PREPRINT_ONLY (title in audit brief is a paraphrase, not the literal title)**

- Exact title: *"Omission Constraints Decay While Commission Constraints Persist in Long-Context LLM Agents"* — NOT literally "Omission-vs-Commission"; that's a shorthand. Same arXiv ID, so this is unambiguously the intended paper.
- Author: Yeran Gamage
- Submitted: 22 April 2026
- Subjects: cs.CR, cs.AI
- Comments field: `"19 pages, 5 figures. Includes evaluation framework for replication and 4,416-trial dataset"` — describes the paper's own contents, does **not** mention any venue/acceptance.
- Journal-ref: **absent**.
- **Status: exists, arXiv preprint, not peer-reviewed at any identifiable venue.**

## 4. arXiv 2606.16364 — "Looking-Is-Not-Picking"

**Verdict: CONFIRMED — PREPRINT_ONLY**

- Exact title: *"Looking Is Not Picking: An Attention-Segment Account of Tool-Selection Failures in LLM Agents"*
- Author: Shiyang Chen (same sole author as item #1, "Governance Decay" — noted as a provenance fact, not further investigated)
- Submitted: 15 June 2026 (v1), revised 27 June 2026 (v2)
- Subjects: cs.AI, cs.CR, cs.SE
- Comments field: `"13 pages, 1 figure, 15 tables"` — no venue/acceptance mentioned.
- Journal-ref: **absent**.
- **Status: exists, arXiv preprint, not peer-reviewed at any identifiable venue.**

## 5. ManyIFEval

**Verdict: CONFIRMED — peer-reviewed**

- ManyIFEval ("Many Instruction-Following Eval") is not a standalone paper but a benchmark introduced inside: *"When Instructions Multiply: Measuring and Estimating LLM Capabilities of Multiple Instructions Following"* (arXiv 2509.21051), by Keno Harada et al.
- Verbatim intro sentence (confirmed on the abstract page): *"we introduce two specialized benchmarks ... Many Instruction-Following Eval (ManyIFEval) for text generation with up to ten instructions, and Style-aware Mostly Basic Programming Problems (StyleMBPP) for code generation with up to six instructions."*
- arXiv Comments field (verbatim): **"Accepted to EMNLP2025"**
- Published, peer-reviewed version confirmed at ACL Anthology: `aclanthology.org/2025.findings-emnlp.896.pdf`, listed under **Findings of the Association for Computational Linguistics: EMNLP 2025** (`aclanthology.org/volumes/2025.findings-emnlp/`).
- **Venue: Findings of EMNLP 2025 (ACL Anthology). This is a peer-reviewed venue** (Findings track — reviewed but not main-conference-oral tier; still goes through ACL peer review).

## 6. "RAND harness / Kohli / «Reliability without Validity»"

This bundled reference resolves to **three distinct papers by three non-overlapping author sets**, not one paper with three names. Flagging this decomposition itself as a provenance finding.

### 6a. RAND harness

**Verdict: CONFIRMED — workshop-accepted (peer-reviewed, lighter tier)**

- Exact title: *"Judge Reliability Harness: Stress Testing the Reliability of LLM Judges"* (arXiv 2603.05399)
- Authors: Sunishchal Dev, Andrew Sloan, Joshua Kavner, Nicholas Kong, Morgan Sandler
- Code repository confirmed at `github.com/RANDCorporation/judge-reliability-harness` (referenced from the paper itself) — this is the basis for the "RAND" attribution.
- A RAND Corporation publication/tool page exists at `rand.org/pubs/tools/TLA4547-1.html` (title "Judge Reliability Harness" confirmed via WebSearch snippet), but that page returned **HTTP 403** on direct WebFetch — could not independently read its author list from that page; RAND affiliation is established instead via the GitHub org link on the arXiv paper itself and independent WebSearch snippets naming "RAND Corporation" + "Morgan Sandler."
- arXiv Comments field (verbatim): **"Accepted at Agents in the Wild: Safety, Security, and Beyond Workshop at ICLR 2026 - April 26, 2026, Rio de Janeiro, Brazil"**
- **No author named "Kohli" appears on this paper.**
- **Status: exists; venue = ICLR 2026 workshop ("Agents in the Wild: Safety, Security, and Beyond"). Workshop acceptance = peer-reviewed but a lighter-weight review tier than a main-track conference paper — worth flagging that distinction if this is cited as equivalent-strength evidence to a full conference paper.**

### 6b. "Kohli"

**Verdict: CONFIRMED as existing — but NOT the same paper as 6a or 6c**

- "Kohli" does not appear as an author on the RAND harness paper (6a) or on "Reliability without Validity" (6c, see below). A distinct paper by an author named Kohli does exist:
- Exact title: *"Nine Judges, Two Effective Votes: Correlated Errors Undermine LLM Evaluation Panels"* (arXiv 2605.29800)
- Author: **Guneet Kohli** (sole author)
- Submitted: 28 May 2026
- Comments field (verbatim): `"14 pages, 5 figures, 12 tables"` — no venue/acceptance mentioned.
- **Status: exists, arXiv preprint, not peer-reviewed at any identifiable venue.** This is thematically adjacent (also about LLM-judge-panel reliability) but is a **separate, third paper** — not a co-author or alternate name for either the RAND harness or "Reliability without Validity" paper. If the audit brief's tiering treated "RAND harness / Kohli / Reliability without Validity" as one reference, that conflation is itself a provenance defect worth surfacing upstream.

### 6c. "Reliability without Validity"

**Verdict: CONFIRMED — PREPRINT_ONLY**

- Exact title: *"Reliability without Validity: A Systematic, Large-Scale Evaluation of LLM-as-a-Judge Models Across Agreement, Consistency, and Bias"* (arXiv 2606.19544)
- Authors: Justin D. Norman, Michael U. Rivera, D. Alex Hughes
- No mention of RAND Corporation or "Kohli" found on the abstract page.
- Comments field: **absent**. Journal-ref: **absent**.
- **Status: exists, arXiv preprint, not peer-reviewed at any identifiable venue. Not affiliated with RAND per available page content.**

---

## Overall notes for the tiering/synthesis step

- **All six audit-brief line items resolve to real, existing arXiv-indexed papers** — none is NOT_FOUND. The "zero/dubious provenance" framing in the brief is about *review status*, not existence: existence is confirmed for all.
- Of the 4 "priority" 2026 arXiv papers (items 1-4): **all four are unreviewed preprints** (no Comments-field acceptance notice, no journal-ref). None should be treated as peer-reviewed evidence; each should carry a PREPRINT_ONLY caveat if cited.
- Two of those four priority papers (items 1 and 4) share the **same sole author (Shiyang Chen)** — a plain provenance fact, not independently investigated further here (out of scope: no deep-read, no cross-paper content comparison performed).
- **ManyIFEval (item 5) is the one clearly peer-reviewed item** in this batch — Findings of EMNLP 2025, ACL Anthology-indexed.
- **Item 6 was a bundled reference that actually decomposes into three separate papers** with disjoint author sets:
  - RAND harness (2603.05399) — workshop-accepted at ICLR 2026 (peer-reviewed, workshop tier)
  - Kohli / "Nine Judges, Two Effective Votes" (2605.29800) — preprint only
  - "Reliability without Validity" (2606.19544, Norman/Rivera/Hughes) — preprint only, no RAND link found
  - If the upstream synthesis cites "RAND harness / Kohli / Reliability without Validity" as if it were a single corroborating source, that's a provenance error to correct — it's three independent (if topically adjacent) preprints/workshop-paper, not one triangulated source.
- rand.org direct fetch returned HTTP 403 (blocked); RAND-affiliation for 6a is established via the paper's own GitHub-org link and secondary WebSearch snippets, not a first-party RAND.org page read. Flagging this as a minor confidence gap, not a doubt about the paper's existence (arXiv page + GitHub org + multiple independent WebSearch snippets all agree).

## Sources consulted

- https://arxiv.org/abs/2606.22528 (+ /pdf, /html mirrors)
- https://arxiv.org/abs/2605.12978
- https://arxiv.org/abs/2604.20911
- https://arxiv.org/abs/2606.16364
- https://arxiv.org/abs/2603.05399
- https://arxiv.org/abs/2606.19544
- https://arxiv.org/abs/2605.29800
- https://arxiv.org/abs/2509.21051
- https://aclanthology.org/2025.findings-emnlp.896.pdf
- https://aclanthology.org/volumes/2025.findings-emnlp/
- https://www.rand.org/pubs/tools/TLA4547-1.html (403 — could not read directly)
- github.com/RANDCorporation/judge-reliability-harness (referenced, not fetched)
- WebSearch cross-checks for each of the above (independent second retrieval channel)
