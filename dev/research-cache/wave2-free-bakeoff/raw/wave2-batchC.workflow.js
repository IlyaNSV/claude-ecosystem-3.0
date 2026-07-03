export const meta = {
  name: 'wave2-free-bakeoff',
  description: 'Wave 2 keyed bake-off projected onto FREE infra: B0 naive vs B1 disciplined, blind order-swap judge on 24-query set — BATCH C (final 9/24: Q02,Q03,Q06,Q07,Q10,Q12,Q15,Q16,Q24), covers all buckets remaining after pilot(7 ok)+batchB(8 ok); run in a FRESH/low-usage session',
  phases: [
    { title: 'Retrieve', detail: 'B0-naive & B1-disciplined answer each query via WebSearch+WebFetch' },
    { title: 'Judge', detail: 'blind pairwise, order-swapped ×2, Pillar-B 6-metric rubric, faithfulness vs fetched source' },
  ],
}

const FREEZE = 'beabbbd600b3fb95418b1de34b45fed2caf854693c9fcf5b2b33526c501c6763'
const TODAY = '2026-07-01'

const QUERIES = [
  {id:'Q01',bucket:'B1-market',q:"What is the estimated 2026 global market size (USD) for AI coding assistant tools, and what CAGR is projected through 2030?",shape:"a $ figure + CAGR% + named analyst source + base year"},
  {id:'Q02',bucket:'B1-market',q:"How many paying users does GitHub Copilot report as of 2026, and what revenue figures have been disclosed?",shape:"user count + $ ARR/revenue + date of disclosure"},
  {id:'Q03',bucket:'B1-market',q:"What is the 2026 total addressable market for vector-database software, and which analyst firms published estimates?",shape:"$ TAM + named firm(s)"},
  {id:'Q04',bucket:'B1-market',q:"What share of professional developers report using AI coding tools, per the 2025-2026 Stack Overflow and/or JetBrains developer surveys?",shape:"% + which survey + year"},
  {id:'Q05',bucket:'B2-competitor',q:"Who are the leading competitors to Cursor (the AI code editor) as of 2026, and how do they differentiate?",shape:">=3 named products + a differentiator each"},
  {id:'Q06',bucket:'B2-competitor',q:"What are the main actively-maintained open-source alternatives to LangChain for building LLM-agent applications in 2026?",shape:">=3 named frameworks + maintenance signal"},
  {id:'Q07',bucket:'B2-competitor',q:"Who are the primary competitors to Perplexity in the AI answer-engine space as of 2026?",shape:">=3 named + positioning"},
  {id:'Q08',bucket:'B2-competitor',q:"Which vendors offer managed retrieval-augmented-generation (RAG) platforms in 2026, and what are their pricing models?",shape:">=3 vendors + pricing axis"},
  {id:'Q09',bucket:'B3-duediligence',q:"Is the Model Context Protocol (MCP) an open standard, who maintains it, and what license does it use as of 2026?",shape:"open? + maintainer org + SPDX license"},
  {id:'Q10',bucket:'B3-duediligence',q:"What is Chroma (the vector store) using for persistence by default, and what scaling limits are documented?",shape:"storage engine + a documented limit"},
  {id:'Q11',bucket:'B3-duediligence',q:"What is the current maintenance status, license, and approximate star count of the official Perplexity MCP server on GitHub?",shape:"last-push recency + license + stars"},
  {id:'Q12',bucket:'B3-duediligence',q:"Does Playwright support React component testing as of 2026, and what is that feature's stability status?",shape:"yes/no + experimental/stable + source"},
  {id:'Q13',bucket:'B4-nfr',q:"Are there any official published latency (p50/p99) figures for Anthropic's Claude API as of 2026?",shape:"numbers OR an honest 'no official figures published' (a correct answer may be that none exist)"},
  {id:'Q14',bucket:'B4-nfr',q:"What queries-per-second can a single-node Qdrant instance sustain for ~1536-dim vectors, per published benchmarks?",shape:"QPS range + benchmark source + config caveat"},
  {id:'Q15',bucket:'B4-nfr',q:"How does SQLite's write concurrency compare to PostgreSQL under concurrent writers, per documented behavior?",shape:"mechanism (single-writer lock vs MVCC) + implication"},
  {id:'Q16',bucket:'B4-nfr',q:"What is the documented maximum context window (tokens) of the leading frontier LLMs as of mid-2026?",shape:">=3 models + token counts + source"},
  {id:'Q17',bucket:'B5-recency',q:"What major AI model releases happened between May and July 2026?",shape:">=2 named releases + dates within window"},
  {id:'Q18',bucket:'B5-recency',q:"Has OpenAI announced any API pricing changes in the last ~90 days as of July 2026?",shape:"specific change+date, or sourced 'none announced'"},
  {id:'Q19',bucket:'B5-recency',q:"What is the most recent funding round for Anysphere (maker of Cursor) as of July 2026 - amount and valuation?",shape:"$ raised + valuation + date"},
  {id:'Q20',bucket:'B5-recency',q:"Were there notable acquisitions in the AI developer-tools space in Q2 2026?",shape:">=1 acquirer->target + date"},
  {id:'Q21',bucket:'B6-multihop',q:"Which company acquired the maker of the Tavily search API in 2026, and what is that acquirer's primary cloud-compute business?",shape:"hop1 acquirer of Tavily; hop2 acquirer's core business"},
  {id:'Q22',bucket:'B6-multihop',q:"The CEO of the company that makes Claude previously co-founded which organization, and in what year was that organization founded?",shape:"hop1 Anthropic CEO's prior org; hop2 its founding year"},
  {id:'Q23',bucket:'B6-multihop',q:"Among vector databases written primarily in Rust, which had the largest GitHub star count as of 2026, and where is its parent company headquartered?",shape:"hop1 top-star Rust vector DB; hop2 HQ location"},
  {id:'Q24',bucket:'B6-multihop',q:"The AI code editor Cursor is a fork of which open-source editor, and which company originally develops that base editor?",shape:"hop1 base editor; hop2 its originating company"},
]

// RUN = subset to execute this launch (batching to stay under session-limit).
// Hardcoded per-batch (args.pick was unreliable — arrived stringified).
// BATCH-C (FINAL, all-remaining 9): 24 total - pilot's 7 ok (Q04,Q08,Q11,Q13,Q21,Q22,Q23)
// - batchB's 8 ok (Q01,Q05,Q09,Q14,Q17,Q18,Q19,Q20) = these 9: Q02,Q03,Q06,Q07,Q10,Q12,Q15,Q16,Q24.
// Cross-checked against the killed batch-C run (raw/batchC-failed-w276rg31o.jsonl) — identical
// composition. That run died from an ALREADY-EXHAUSTED SESSION limit (pilot burned ~2.9M tok +
// batchB burned ~1.4M tok earlier in the SAME session before batch-C even started, per its log:
// every one of its 9 queries errored instantly with "You've hit your session limit"), not from
// this batch's own size (batchB alone processed 8 queries fine on ~1.4M tok). => Launch THIS copy
// first/standalone in a fresh session, not stacked after other heavy agent work.
const BATCH_IDS = ['Q02','Q03','Q06','Q07','Q10','Q12','Q15','Q16','Q24']
const RUN = QUERIES.filter(q => BATCH_IDS.includes(q.id))

const SCORES = {type:'object',additionalProperties:true,required:['P1','P2','P3','P4','P5','P6'],properties:{
  P1:{type:'integer',minimum:1,maximum:5},P2:{type:'integer',minimum:1,maximum:5},P3:{type:'integer',minimum:1,maximum:5},
  P4:{type:'integer',minimum:1,maximum:5},P5:{type:'integer',minimum:1,maximum:5},P6:{type:'integer',minimum:1,maximum:5}}}

const ANSWER_SCHEMA = {type:'object',additionalProperties:false,required:['answer','citations'],properties:{
  answer:{type:'string'},
  citations:{type:'array',items:{type:'object',additionalProperties:false,required:['url'],properties:{url:{type:'string'},claim:{type:'string'}}}},
  audit:{type:'object',additionalProperties:false,properties:{kept:{type:'array',items:{type:'string'}},demoted:{type:'array',items:{type:'string'}},dropped:{type:'array',items:{type:'string'}},uncertainty:{type:'string'}}},
  meta:{type:'object',additionalProperties:false,properties:{searches:{type:'integer'},fetches:{type:'integer'}}}}}

const JUDGE_SCHEMA = {type:'object',additionalProperties:true,required:['system_A','system_B','winner','faithfulness_check','rationale'],properties:{
  system_A:SCORES,system_B:SCORES,
  winner:{type:'string',enum:['A','B','tie']},
  faithfulness_check:{type:'string'},rationale:{type:'string'},
  covariates:{type:'object',additionalProperties:false,properties:{len_A:{type:'integer'},len_B:{type:'integer'},cites_A:{type:'integer'},cites_B:{type:'integer'}}}}}

const B0_PROMPT = (x) => `You are a GENERIC research assistant (no special methodology). Answer the question using web search the way a competent-but-ordinary assistant would.

QUESTION: ${x.q}
Date context: today is ${TODAY}; treat "recent/current/as of 2026" relative to that date.

Do a quick job: at most 2 WebSearch calls and 4 WebFetch calls. Read the top results, write a concise, well-cited answer. Include the URLs you actually used as citations. Do NOT apply any special verification or anti-hype process — this is the naive baseline. Produce your FINAL answer as PLAIN TEXT (no JSON, no tool schema): lead with the direct answer, then a "Sources:" list of the actual URLs you used. Keep it concise (<=300 words). Your output text IS the data, not a message to a human.`

const B1_PROMPT = (x) => `You are running the GUIDED RESEARCH disciplined pipeline on FREE web infrastructure (WebSearch+WebFetch only). Apply the full Pillar-D anti-hype + Pillar-B usefulness discipline.

QUESTION: ${x.q}
BUCKET: ${x.bucket}   EXPECTED-SHAPE of a decision-useful answer: ${x.shape}
Date context: today is ${TODAY}.

Discipline (do ALL):
1. Reformulate into 1-2 precise searches (<=3 WebSearch total).
2. Fetch the most relevant sources (<=4 WebFetch); PREFER PRIMARY sources (official docs, filings, the vendor's own doc, the actual repo) over aggregators / SEO reprints / listicles.
3. Atomize your answer into load-bearing claims. For each: tag provenance tier (primary/secondary/aggregator); scan for hype signals (self-published benchmark, vendor judging a competitor, tier-conflation, aggregator-laundering, superlatives without method, single-source contested number); TRIANGULATE contested facts across >=2 INDEPENDENT sources.
4. Re-verify each load-bearing claim against the ACTUAL fetched source content (faithfulness). DEMOTE or DROP claims the source does not support. NEVER silently drop — log kept/demoted/dropped.
5. Compose a DECISION-USEFUL answer: lead with the direct answer; give specifics (numbers, named entities, dates) each with a resolvable citation; be explicitly UNCERTAINTY-HONEST (state what is not known / thinly-sourced / contested). Do not pad.
Your extra budget vs the baseline is spent on VERIFICATION, not on padding length.
Produce your FINAL answer as PLAIN TEXT (no JSON, no tool schema): (1) lead with the direct, decision-useful answer with specifics; (2) a "Sources:" list of the actual URLs you used, primary sources first; (3) a short "## Audit" note — what you kept / demoted / dropped and your single most important uncertainty. Keep the main answer <=350 words. Your output text IS the data, not a message to a human.`

const fmt = (a) => {
  if(!a) return '(no answer produced)'
  if(typeof a === 'string') return a   // retrieval agents now return plain text (schemaless, robust)
  const cites = (a.citations||[]).map((c,i)=>`  [${i+1}] ${c.url}${c.claim?' :: '+c.claim:''}`).join('\n')
  return `${a.answer}\n\nCITATIONS:\n${cites||'  (none)'}`
}

const JUDGE_PROMPT = (x, ansA, ansB) => `You are a STRICT, IMPARTIAL evaluator. Two anonymized systems (A, B) each answered the same question. Score EACH on 6 metrics (integers 1-5) and pick a pairwise winner.

QUESTION: ${x.q}
BUCKET: ${x.bucket}   EXPECTED-SHAPE of a decision-useful answer: ${x.shape}
Date context: today is ${TODAY}.

===== System A =====
${fmt(ansA)}

===== System B =====
${fmt(ansB)}

METRICS (anchors 1 / 3 / 5), score A and B independently:
P1 Topical-Relevance: 1 off-topic / 3 partial intent / 5 full intent+scope.
P2 Decision-Utility: 1 generic / 3 specifics-with-gaps / 5 actionable (numbers, named entities, scoped caveats).
P3 Faithfulness/grounding: 1 a load-bearing claim contradicts OR is absent from its cited source / 3 mostly grounded / 5 every load-bearing claim confirmed by the CITED URL's CONTENT. You MUST open at least 2 cited URLs (WebFetch) across the two answers and check the claim is actually supported. Report which URLs you opened and what you found in faithfulness_check.
P4 Citation-support (score SEPARATELY from P3): 1 none/unmappable / 3 major claims cited / 5 every load-bearing claim has a resolvable citation.
P5 Corroboration: 1 single/unsourced / 3 some multi-sourced / 5 each contested fact backed by >=2 independent sources.
P6 Directness: 1 evasive/padded / 3 answers but hedged / 5 leads with the direct answer, concise.

CRITICAL anti-bias guards (violating these corrupts the study):
(a) LENGTH and CITATION-COUNT are NOT quality. Do not reward an answer for being longer or having more citations per se. Log lengths/counts in covariates but do not let them drive scores.
(b) An answer that HONESTLY says "no official figure exists" / states its uncertainty, WHEN THAT IS TRUE, must score HIGH on P2 and P3 — honesty about absence is decision-useful, not a weakness. A confidently-specific but WRONG or unsupported answer must score LOW on P3.
(c) Judge faithfulness by OPENING sources, not by vibes.
(d) You do NOT know which system used which method. Judge only the text.

Then pick winner: 'A', 'B', or 'tie' (tie = within ~1 total point / no meaningful difference). Base the winner PRIMARILY on P2 (Decision-Utility) and P3 (Faithfulness) — not on length or citation count.
Return the schema object. rationale = 2-4 sentences citing the decisive metrics.`

// ---- run ----
log(`Wave 2 free bake-off: ${RUN.length} queries (of ${QUERIES.length} total), B0-naive vs B1-disciplined, order-swapped blind judge. freeze=${FREEZE.slice(0,12)}`)

const results = await pipeline(
  RUN,
  // stage 1: both arms answer, in parallel
  (x) => parallel([
    () => agent(B0_PROMPT(x), {label:`B0:${x.id}`, phase:'Retrieve', agentType:'general-purpose', model:'opus', effort:'medium'}),
    () => agent(B1_PROMPT(x), {label:`B1:${x.id}`, phase:'Retrieve', agentType:'general-purpose', model:'opus', effort:'medium'}),
  ]).then(([b0,b1]) => ({x, b0, b1})),
  // stage 2: blind judge, order-swapped ×2
  (prev) => {
    const {x, b0, b1} = prev
    if(!b0 || !b1) return {x, b0, b1, j1:null, j2:null, incomplete:true}
    return parallel([
      () => agent(JUDGE_PROMPT(x, b0, b1), {label:`J1:${x.id}`, phase:'Judge', schema:JUDGE_SCHEMA, agentType:'general-purpose', model:'opus', effort:'high'}), // A=b0 B=b1
      () => agent(JUDGE_PROMPT(x, b1, b0), {label:`J2:${x.id}`, phase:'Judge', schema:JUDGE_SCHEMA, agentType:'general-purpose', model:'opus', effort:'high'}), // A=b1 B=b0
    ]).then(([j1,j2]) => ({x, b0, b1, j1, j2}))
  }
)

// ---- deterministic aggregation ----
const METRICS = ['P1','P2','P3','P4','P5','P6']
const avg2 = (u,v) => { const o={}; for(const k of METRICS) o[k]=(u[k]+v[k])/2; return o }
const overall = (s) => METRICS.reduce((a,k)=>a+s[k],0)/METRICS.length

const rows = (results||[]).filter(Boolean).map(r => {
  const base = {id:r.x.id, bucket:r.x.bucket}
  if(!r.b0 || !r.b1 || !r.j1 || !r.j2) return {...base, status:'incomplete'}
  // j1 presented A=b0,B=b1 ; j2 presented A=b1,B=b0
  const w1 = r.j1.winner==='A' ? 'b0' : r.j1.winner==='B' ? 'b1' : 'tie'
  const w2 = r.j2.winner==='A' ? 'b1' : r.j2.winner==='B' ? 'b0' : 'tie'
  let winner
  if(w1==='tie' && w2==='tie') winner='tie'
  else if(w1===w2) winner=w1                                   // clean agreement
  else if(w1==='tie' || w2==='tie') winner='lean-'+(w1==='tie'?w2:w1) // one tie, one decisive
  else winner='UNSTABLE'                                        // opposite decisive => position-bias
  const b0s = avg2(r.j1.system_A, r.j2.system_B)
  const b1s = avg2(r.j1.system_B, r.j2.system_A)
  const cov = { len_b0:((r.j1.covariates?.len_A)||0), len_b1:((r.j1.covariates?.len_B)||0), cites_b0:((r.j1.covariates?.cites_A)||0), cites_b1:((r.j1.covariates?.cites_B)||0) }
  return {...base, status:'ok', winner, w1, w2, b0:b0s, b1:b1s, b0_overall:+overall(b0s).toFixed(3), b1_overall:+overall(b1s).toFixed(3), cov,
          b1_uncertainty:(r.b1.audit?.uncertainty||''), b1_dropped:(r.b1.audit?.dropped||[]).length, b1_demoted:(r.b1.audit?.demoted||[]).length }
})

const ok = rows.filter(r=>r.status==='ok')
const tally = (arr,pred)=>arr.filter(pred).length
const meanOf = (arr,sel)=> arr.length ? +(arr.reduce((a,r)=>a+sel(r),0)/arr.length).toFixed(3) : null
const metricMeans = (arr,sys)=>{ const o={}; for(const k of METRICS) o[k]=meanOf(arr,r=>r[sys][k]); o.overall=meanOf(arr,r=>r[sys+'_overall']); return o }

const buckets = [...new Set(RUN.map(q=>q.bucket))]
const per_bucket = {}
for(const b of buckets){
  const g = ok.filter(r=>r.bucket===b)
  per_bucket[b] = {
    n:g.length,
    b1_wins:tally(g,r=>r.winner==='b1'), b0_wins:tally(g,r=>r.winner==='b0'), ties:tally(g,r=>r.winner==='tie'),
    lean_b1:tally(g,r=>r.winner==='lean-b1'), lean_b0:tally(g,r=>r.winner==='lean-b0'), unstable:tally(g,r=>r.winner==='UNSTABLE'),
    b0_overall:meanOf(g,r=>r.b0_overall), b1_overall:meanOf(g,r=>r.b1_overall),
  }
}

const decided = tally(ok,r=>r.winner==='b1'||r.winner==='b0')
const scorecard = {
  n_total:RUN.length, n_ok:ok.length, n_incomplete:tally(rows,r=>r.status==='incomplete'),
  winrate:{ b1_clean:tally(ok,r=>r.winner==='b1'), b0_clean:tally(ok,r=>r.winner==='b0'), ties:tally(ok,r=>r.winner==='tie'),
    lean_b1:tally(ok,r=>r.winner==='lean-b1'), lean_b0:tally(ok,r=>r.winner==='lean-b0'), unstable:tally(ok,r=>r.winner==='UNSTABLE'),
    decided_clean:decided, b1_pct_of_decided: decided? +(100*tally(ok,r=>r.winner==='b1')/decided).toFixed(1):null },
  means:{ b0:metricMeans(ok,'b0'), b1:metricMeans(ok,'b1') },
  per_bucket,
  covariates:{ mean_len_b0:meanOf(ok,r=>r.cov.len_b0), mean_len_b1:meanOf(ok,r=>r.cov.len_b1), mean_cites_b0:meanOf(ok,r=>r.cov.cites_b0), mean_cites_b1:meanOf(ok,r=>r.cov.cites_b1) },
}

log(`Done. ok=${ok.length}/${RUN.length}  B1-clean-wins=${scorecard.winrate.b1_clean} B0-clean-wins=${scorecard.winrate.b0_clean} ties=${scorecard.winrate.ties} unstable=${scorecard.winrate.unstable}`)

return { meta:{ freeze_hash:FREEZE, date:TODAY, arms:{B0:'naive-free (WebSearch+WebFetch, single-pass)', B1:'disciplined-free (Pillar-D+B on same free infra)'}, protocol:'blind pairwise, order-swap x2, agreement-gated; faithfulness vs fetched source' }, scorecard, per_query:rows }
