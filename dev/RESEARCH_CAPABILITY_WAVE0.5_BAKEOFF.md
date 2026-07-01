# Wave 0.5 — Tool-selection decision: answer-engine + academic class

> **Guided Research — первый dogfood.** Это решение прогнано через собственный контракт способности: Pillar-B (метрики качества ответа) + Pillar-D (anti-hype фильтр). Использованы **только survived**-находки из adversarially-verified бандлов; killed — исключены; hype_flags несём как caveat'ы.

**HARD REALITY (без иллюзий):** реальный API-level head-to-head на 30–50 запросов **не был прогнан** в этой сессии — Perplexity/Linkup/Exa/Tavily здесь не подключены (repo wires только `github` + `sequential-thinking` MCP, ключей нет). Поэтому нота даёт (i) LIVE-VERIFIED факты, (ii) evidence-based **provisional** рекомендацию, (iii) готовый к запуску bake-off harness, (iv) 🚧 prerequisites для USER. Вердикт answer-engine — максимум **частично**, не «годно», пока keyed bake-off не прогнан.

---

## 1. TL;DR — решение + вердикт

- **Answer-engine (provisional): Perplexity Sonar.** Governance-default из §7.1 (safe default = Perplexity Sonar «unless evidence overturns it») **держится** — verified-факты его НЕ опровергают, а Linkup своими killed-SOTA-претензиями и seed-риском его не перевешивает. Но это **provisional front-runner**, а не доказанный победитель: first-hand данных о качестве — **ноль**. Фактическое подключение/трата денег **гейтится** тем, что Perplexity в bake-off обыграет **бесплатный S0** (built-in WebSearch+WebFetch → reader LLM), а не Exa (Exa здесь не wired, поэтому caveat «redundant with Exa» для этого репо moot).
- **Academic class: Semantic Scholar REST-direct** (api.semanticscholar.org/graph/v1, no-key, free, unmetered, **без MCP**) — как **opportunistic overlay**, НЕ wired-зависимость. Для этого workload academic — **niche, не gap**; проходит только потому, что marginal cost ≈ 0.
- **Verdict: `частично`** (провизорно). **Confidence: medium** — факты high (live-verified по primary-источникам), но сам пик провизорный.

---

## 2. Live-verified facts — Perplexity Sonar vs Linkup

| Ось | **Perplexity Sonar** | **Linkup** |
|---|---|---|
| **Pricing** | Dual-axis: per-token **+** per-1k-request search-context fee. Sonar $1/$1 за 1M tok + $5/$8/$12 за 1k req (low/med/high); Sonar Pro $3/$15 + $6/$10/$14; Deep Research + $5/1k search-queries. ✅ live vs `docs.perplexity.ai/getting-started/pricing` | Standard ~$0.005/query (~$5/1k), sourced $0.006; **Deep = 10×**: $0.05/query (~$50/1k). ⚠ **91% «SOTA» — это deep-mode, не тот «~€5/1k»**. ✅ live vs `docs.linkup.so/pricing` |
| **Free-tier** | **Нет** standalone free API. Tier 0 = new account, $0 spent; API prepaid/credit-metered (Pro «unlimited» = UI, **не API**). ✅ live vs `docs.perplexity.ai/guides/usage-tiers`. Кредит-специфика ($5/mo, $25–50 trial) — ⚠ **unverified** (secondary-only, killed) | **$20** credit для professional-email, **top-up до $20 каждый месяц** (recurring). ✅ live vs `docs.linkup.so/pricing` (перекрывает third-party «€5 one-time») |
| **MCP-maintenance** | `perplexityai/modelcontextprotocol`: 2 358★ / 355 forks / 11 open, TS/MIT, last push **2026-06-17** (~2 нед), 4 инструмента search/ask/research/reason. ✅ live GitHub API — **healthy** | `LinkupPlatform/linkup-mcp-server` **v3.3.0 (2026-06-09)**, npm + `.mcpb` Claude-bundle, employee-maintainers. ✅ live GitHub API — **healthy**; ⚠ но `.mcpb` только **26 downloads** (≠ «widely adopted») |
| **Documented rate-limit** | **Tier-0 floor 50 RPM** (sonar/pro/reasoning-pro) → 150/500/1000/4000 по спенду; deep-research 5→100. ✅ live vs usage-tiers. Blueprint'овые «~50 req/min» = **документированный floor, не ceiling** | ⚠ **Не опубликован** сверх «429 when out of credit». Sustained-throughput unverified |
| **Unique-capability** | One-call **reasoning + deep-research** тиры (auto multi-step web research) + news-attribution edge. Core cited-answer — **не уникален** (перекрывается Exa /answer; но Exa здесь **не wired**) | Short-fact retrieval; **есть открытый** eval-harness (`eval-simpleQA`, runnable со своими ключами) — плюс к чистому маркетингу. ⚠ но stale (last commit **2025-04-15**, ~15 мес) и только Linkup-vs-Tavily |
| **Independent-evidence** | **CJR / Tow Center**: lowest error среди 8 движков, **но всё равно 37% wrong** на news-attribution (⚠ March-2025, news-scope). ✅ `cjr.org` + `niemanlab.org` → harness **обязан** re-verify цитаты у любого движка | ⚠ **Отсутствует.** Ни одного genuinely-independent SimpleQA head-to-head; все числа self-published |

**Vendor due-diligence (survived, live-verified):** Perplexity — established; **Linkup — seed-stage** (Paris, 2024; $10M seed Feb-2026 → longevity-риск в 18–24 мес). Волатильность рынка: **Tavily куплен Nebius** (Feb-2026, ~$275M+earnout), **Exa поднял** standard search **$5→$7/1k** (Mar-2026) → single-provider lock-in нежелателен, pricing **пере-верифицировать в момент запуска**.

---

## 3. Skeptical read — что hype-filter убил / понизил

**Perplexity — killed:**
- «Exa бьёт Perplexity 64.8% vs 60.1% / <200ms vs 300ms» → **vendor self-benchmark** (`exa.ai/versus`, конкурент судит соперника на своей маркет-странице). Никогда не ранжировать по этому.
- Кредит-специфика **$5/mo · $25–50 trial · $500–5k startup** → absent из official docs, secondary-only, inconsistent → **false precision**.
- «Sonar **dominates** Search Arena» → vendor-блог, self-benchmark.
- Sonar Pro «Pro Search» **$14/$18/$22 за 1k** и **~20-domain cap** → не подтверждены на live primary-доках → held out, в решение не берём.

**Linkup — killed:**
- «**#1 SOTA** on SimpleQA, бьёт Exa/Perplexity/Grok/Tavily» → self-published, **не воспроизводимо** из shipped-harness (там только Linkup-vs-Tavily), прямо **противоречит** Tavily-self-report 93.3%.
- «Дешёвый ~€5/1k даёт 91%» → **tier-conflation**: 91% — это **deep-mode $50/1k (10×)**.
- «SimpleQA independent → значит ранжирование independent» → **category error** (независим датасет, не scoring/judge/model).
- «Лучший для **multi-hop**» → self-designed 600-query бенч (vendor выбрал запросы + судью + метрики → выиграл всё).

**Cross-cutting демоции (несём как caveat):**
- **Aggregator-laundering:** CloudZero/finout/getaiperks/dev.to/pdfvector/glama/juheapi поданы как «independent corroboration» — это SEO-перепечатка vendor-чисел, не измерение.
- **«Everyone wins their own benchmark»:** Linkup 91% **F-score** vs Tavily 93.3% **accuracy** на одном сете + Tavily-таблица сама ставит Perplexity Deep Research 93.9% > своих 93.3% → метрики **non-comparable**, ранжирование недостоверно.
- **Recency-laundering:** CJR-37% — Mar-2025, растянуто на 2026-модели → directional, не current.
- **AIMultiple** (Perplexity near-bottom) — единственный semi-independent SEO-источник + «GPT-5.2 judge» неверифицируем → **числа killed как evidence**; но **инсайт construct-dependence** выживает на чистой логике (retrieval-relevance ≠ answer-preference → единого «best engine» нет).
- **n=42 недомощён:** по собственным данным бандла ранжирование «переворачивается» вплоть до ~200 запросов → **42 = smoke-tier**, gaps < 5pt = шум.
- **«$15–40 all-in»** — false precision на неверифицированных token-счётчиках; защитим только **ordinal**: judge-cost ≫ search-cost.
- **«Perplexity уходит из MCP»** — decision-**irrelevant**: отступление внутреннее/enterprise, а **customer-facing MCP-сервер (тот, что мы бы и wired) — сохраняют**.

---

## 4. Academic class — yes/no + один пик

**Нужен ли для этого workload (product/tool due-diligence + NFR, НЕ академия)?** — Это **niche, не gap**. Peer-reviewed цитата load-bearing лишь на меньшинстве задач (LLM/multi-agent methodology, LLM-as-judge bias, algorithmic NFR-tradeoffs — ровно Pillar-D anti-hype кейсы). ⚠ Оценка «~5–10% задач» **демонтирована как false precision** (нет методологии) — направление верно, число — нет.

**Один пик — Semantic Scholar Academic Graph API, REST-direct** (`api.semanticscholar.org/graph/v1/paper/search`): **no-key, free, unmetered, без MCP**. ✅ live: `/product/api` — unauthenticated shared pool ~1000 req/s, free key = 1 RPS. Marginal cost ≈ 0 → niche-нужда становится net-positive; заодно закрывает citation-overlay, которого нет у arXiv-only.

**OpenAlex key-gating correction — CONFIRMED** (не refuted): ✅ live vs `blog.openalex.org` — регрессия **2026-02-13 → key-gated + usage-metered** ($1/day free; single lookup $0 / list $0.0001 / **search $0.001** / download $0.01; polite pool и email-param убраны). Практический эффект: **searches ≈ капнуты ~1000/день free** + аккаунт/credential — это **убивает** zero-setup-ценность несмотря на более широкое покрытие. → OpenAlex для этого workload **не берём**.

**Отвергнутые альтернативы:** **arXiv MCP** — preprints only (нет peer-review/citation-графа → всё равно нужен overlay; и добавляет MCP там, где есть native REST). **paper-search-mcp** — single-org аггрегатор, оборачивает те же upstreams + ships Sci-Hub → maturity/legal-риск, не value-add.

**Форма:** документировать REST-endpoint как **available overlay**, НЕ wired MCP-зависимость. Взять free-key **проактивно как hedge** — Semantic Scholar может повторить траекторию OpenAlex.

---

## 5. PROVISIONAL recommendation

1. **Answer-engine: Perplexity Sonar — provisional front-runner, wired behind `deep-research`** как специализированный reasoning/deep-research lane. Основание: §7.1 governance-default + verified-факты его НЕ опровергают (прозрачный dual-axis pricing · healthy официальный MCP с 4 инструментами · документированный rate-ladder 50→4000 RPM · лучший independent citation-record среди answer-as-a-service).
2. **Но подключение/трата гейтится bake-off'ом против бесплатного S0.** Реальный incumbent — не Exa (не wired), а **free built-in WebSearch+WebFetch → reader LLM**. Perplexity-dual-axis оправдан только если он обыгрывает free-S0 по Decision-Utility/Faithfulness. Пока это не показано — **verdict частично**.
3. **Hard gate в дизайн независимо от движка:** harness **пере-верифицирует каждую цитату** против fetched-source (37% news-attribution error даже у лучшего движка).
4. **Linkup сейчас НЕ адоптим** (SOTA killed, seed-longevity-риск) — держим как **challenger в bake-off только для short-fact bucket** (там его harness-backed evidence сильнейшее, и хватает standard-mode).
5. **Academic:** документировать Semantic Scholar REST-endpoint как overlay; **не** wire academic MCP; **не** брать OpenAlex/aggregator.

---

## 6. READY-TO-RUN bake-off harness (авторится offline сейчас; на запуск нужны ключи)

**0. Что меряем (champion-vs-challenger):** каждый SUT возвращает synthesized answer + citations на один запрос.
- **S0 = BASELINE** (incumbent): built-in WebSearch+WebFetch → reader LLM. **FREE.** Его надо обыграть, чтобы оправдать платный движок.
- **S1** Perplexity Sonar Pro · **S2** Tavily (advanced/research) · **S3** Exa (answer → тот же reader LLM для честности) · **S4** Linkup standard (+опц. S4b deep). Каждый challenger сравнивается **pairwise против S0** (4 пары/запрос), round-robin — только если двое бьют S0.

**1. Query-set — 42 запроса, 6 buckets × 7** (freeze + hash до первого API-call; каждому — pre-written ground-truth answer-key; recency date-stamped «as of 2026-07-01»; без engine-favoring фраз):
B1 Market-size/TAM · B2 Competitor-scan · B3 Tool/tech due-diligence · B4 NFR/perf-benchmarks · B5 Recency-sensitive (30–90 дн) · B6 Multi-hop (FRAMES-style). B1/B3/B4/B5/B6 — **факт-buckets** → судятся против answer-key/источников, не «по впечатлению».
> ⚠ **n=42 — smoke-tier, не stability.** По собственным данным ранжирование флипается вплоть до ~200 запросов; gaps < 5pt = шум. Stability-target ~150–200; 42 детектит только крупные эффекты.

**2. Pillar-B рубрика — 6 метрик, anchors 1/3/5** (score каждый ответ независимо):
- **P1 Topical-Relevance** — 1 off-topic · 3 частично покрывает intent · 5 полный intent+scope.
- **P2 Decision-Utility** — 1 generic · 3 specifics с пробелами · 5 actionable (числа, названные сущности, scoped caveats).
- **P3 Faithfulness/grounding** — 1 хоть один load-bearing claim противоречит/отсутствует в источнике · 3 в основном grounded · 5 каждый load-bearing claim подтверждён **содержимым** цитируемого URL (судья открывает URL на факт-buckets).
- **P4 Citation-support** — 1 нет/не мапятся · 3 крупные claims cited · 5 у каждого load-bearing claim — resolvable-цитата. **Считается ОТДЕЛЬНО от P3.**
- **P5 Corroboration** — 1 single/unsourced · 3 часть multi-sourced · 5 каждый contested-факт ≥2 independent-источника.
- **P6 Directness** — 1 evasive/padded · 3 отвечает но hedging · 5 ведёт прямым ответом, concise.
- **Covariates:** длина (tokens) + citation-count логируются **как контрольные**, чтобы ловить length/citation-count confound.

**3. Judge-protocol (blind, order-swapped, agreement-gated — single-judge per §7.1):**
- (a) **Blinding:** снять identity/branding → «System A»/«System B», рандом A.
- (b) **Pairwise + order-swap:** каждую пару {S0 vs Sk} судить **дважды** (A=S0/B=Sk и A=Sk/B=S0).
- (c) **Agreement-gate:** verdict засчитывается **только если оба порядка согласны** на победителе (position-bias). Расхождение → UNSTABLE.
- (d) **Single primary judge** (Claude- или GPT-class) — **не панель** (стоимость + correlated bias).
- (e) **Neutral third ТОЛЬКО на UNSTABLE** — **другое семейство** модели (если primary=Claude, third=GPT/Gemini).
- (f) **Faithfulness судится против fetched-source, не «по вайбам»** (Pillar-D guard против Search-Arena bias: судьи награждают citation-count и длину и **не отличают** supporting от irrelevant цитат — β_irrelevant 0.27 ≈ β_support 0.29).
- (g) **Anti-length guard** в инструкции судьи: длина и число цитат — НЕ качество.

**4. Aggregation / decision-rule:** primary = pairwise win-rate Sk vs S0 (только agreement-gated). Kandidat **PASSES** ⇔ win-rate > 50% сверх tie-band **И** mean P3 ≥ 4.0 **И** **ноль P3=1** на любом факт-buckete (single faithfulness-fail на факте — disqualifying). Ties → по P2, затем P5 (не по Directness/длине). Отчёт per-bucket (движок может выиграть recency и слить multi-hop → роутить по workload).

**5. Anti-hype / validity checklist:** [ ] set+rubric+keys pre-registered+hashed до первого call · [ ] identity blinded, A/B swap · [ ] Faithfulness против fetched-source · [ ] P3 и P4 отдельными колонками, длина+citation-count как covariates · [ ] neutral-third — иное семейство · [ ] gaps < 5pt = ties · [ ] **в writeup не цитировать ни одно vendor-SimpleQA/complex-query число** — только собственные blind-результаты.

---

## 7. 🚧 Требует USER (без этого harness не запускается)

**API-ключи (env vars):**
- `PERPLEXITY_API_KEY` (Sonar Pro) — https://docs.perplexity.ai
- `TAVILY_API_KEY` — https://docs.tavily.com · `EXA_API_KEY` — https://exa.ai/pricing · `LINKUP_API_KEY` — https://docs.linkup.so
- **Judge:** `ANTHROPIC_API_KEY` (primary) — **model-id/pricing сверить через `claude-api` skill, не хардкодить из памяти**; neutral-third — **другое семейство** (`OPENAI_API_KEY` или `GOOGLE_API_KEY`), только на disagreements.
- S0-baseline ключа не требует (использует встроенный WebSearch/WebFetch).

**Стоимость одного прогона (42 запроса × 4 кандидата, order-swapped) — order-of-magnitude, НЕ точная (пере-верифицировать в момент запуска: Exa $5→$7/1k, Tavily post-Nebius):**
- **Retrieval ≈ $0–5** (в основном внутри free-tier: Tavily 84 credits free; Exa ~$0.29 внутри $10; Linkup standard ~€0.21 внутри €5; Perplexity ~$1–2).
- **LLM-judge = центр стоимости:** 4×42×2 = **336 pairwise-calls** + ~25% neutral-third на disagreements. Достоверно только **ordinal: judge ≫ retrieval**. Прежние «$15–40 all-in» — false precision; **заложить бюджет ~$50** и сперва прогнать **S0 + один challenger** как ~$5–10 smoke.

**Ручные шаги USER:** (1) выдать ключи; (2) подтвердить answer-mode endpoint каждого движка (vs raw-chunk) — apples-to-apples; (3) утвердить + заморозить 42-query set + answer-keys; (4) выбрать primary + neutral-third judge-модели; (5) **решить: wired Perplexity сейчас vs гейтить на bake-off «бьёт ли free-S0»**.

---

## 8. Open questions

1. **Главный, неотвечаемый без keyed-прогона:** бьёт ли Perplexity Sonar **бесплатный S0** (built-in WebSearch+WebFetch) достаточно, чтобы оправдать dual-axis-стоимость?
2. **End-to-end answer-engine vs retrieval-layer в собственный reader** — что хочет способность? Меняет SUT-список и что именно меряем.
3. **n=42** приемлемо как smoke, или нужен ~150–200 для стабильности ранжирования?
4. **Bucket-weighting** по реальной частоте workload (competitor-scan/due-diligence чаще multi-hop) или поровну?
5. **Semantic Scholar overlay** — документировать как standing-tool или звать чисто ad-hoc? Зависит от того, как часто реально всплывают Pillar-D methodology-claims — трекать несколько deep-research-прогонов.
6. **Cadence пере-прогона** при vendor-churn (Tavily→Nebius, Exa-хайк, OpenAlex-регрессия) — quarterly?
7. **Owner-rule fork:** «academic only if a real gap» строго запрещает даже **документировать** zero-cost overlay (→ `none`), или допускает (→ Semantic Scholar)? Я взял второе (marginal cost ≈ 0), но это развилка владельца.

---

## Короткий ответ

Провизорно берём **Perplexity Sonar** как единственный answer-engine (governance-default §7.1 держится, verified-факты его не опровергают), но это **front-runner, а не победитель** — реального keyed head-to-head не было, поэтому вердикт **частично**, а фактическое подключение гейтится тем, обыграет ли он **бесплатный S0** в приложенном blind bake-off (42 запроса, Pillar-B рубрика, single-judge + swap-order-agree). Academic — **niche, не gap**; единственный пик — **Semantic Scholar REST-direct** (no-key/free/без MCP) как opportunistic overlay; **OpenAlex key-gating подтверждён** (регрессия Feb-2026) → отпадает. Дальше нужны USER-ключи и ~$50 бюджета на прогон.