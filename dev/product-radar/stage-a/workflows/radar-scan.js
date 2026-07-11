export const meta = {
  name: 'product-radar-scan',
  description: 'Product Radar Stage A: скан lanes вертикали → анти-хайп аудит → синтез (дайджест + кандидаты тезисов по стратегиям S1-S7, RU-фокус)',
  whenToUse: 'Еженедельный прогон радара Stage A; args собирает main-сессия из pack.yaml (см. stage-a/README.md)',
  phases: [
    { title: 'Collect', detail: 'sonnet-сборщики по lanes (WebSearch/WebFetch)', model: 'sonnet' },
    { title: 'Verify', detail: 'opus анти-хайп аудит per lane (keep/demote/drop + realism)', model: 'opus' },
    { title: 'Synthesize', detail: 'opus: дайджест-пункты + кандидаты тезисов (стратегии, асимметрии, вопрос-убийца, RU-чек)', model: 'opus' },
  ],
}

// ===== args contract (собирает main-сессия из pack.yaml + inbox, см. README) =====
// {
//   vertical: 'ai-tools',
//   week: '2026-W29',                  // Date.now в workflow недоступен — неделю передаёт вызывающий
//   thresholds: { realism_confirmed_min_corroboration, signal_min_repeats },
//   strategies: { 'S1-geo-lag': {enabled, weight}, ... },
//   lanes: [{ id, tier, feeds, title, sources: [..], hints }],
//   tierP: ['наблюдение владельца 1', ...],   // содержимое inbox/tier-p/ (может быть пустым)
//   priorPatterns: 'выжимка patterns/LIBRARY.md',  // для дедупа против виденного (может быть пустой)
// }

const a = args || {}
const lanes = a.lanes || []
if (!lanes.length) {
  return { error: 'args.lanes пуст: прочитай verticals/<v>/pack.yaml и передай lanes (см. stage-a/README.md)' }
}
const week = a.week || 'unknown-week'
const th = a.thresholds || { realism_confirmed_min_corroboration: 2, signal_min_repeats: 3 }

// ===== Схемы structured output =====
const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings', 'lane_health'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'url', 'source_type', 'signal_class'],
        properties: {
          claim: { type: 'string', description: 'одно проверяемое утверждение, без превосходных степеней' },
          quote: { type: 'string', description: 'дословная цитата-опора, если есть' },
          url: { type: 'string' },
          pub_date: { type: 'string', description: 'дата публикации/события, как указана в источнике' },
          source_type: { enum: ['primary', 'independent-secondary', 'vendor', 'aggregator'] },
          signal_class: { enum: ['complaint', 'existing-spend', 'wtp', 'money-flow', 'catalyst', 'supply', 'frontier', 'ru-presence-check'] },
          repeats_seen: { type: 'number', description: 'сколько НЕЗАВИСИМЫХ повторов этого сигнала видел' },
          note: { type: 'string' },
        },
      },
    },
    lane_health: { type: 'string', description: '"ok" либо описание деградации: какие источники недоступны/пусты и почему' },
  },
}

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdicts', 'summary'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'url', 'verdict', 'provenance_tier', 'realism', 'reason'],
        properties: {
          claim: { type: 'string' },
          url: { type: 'string' },
          verdict: { enum: ['keep', 'demote', 'drop'] },
          provenance_tier: { enum: ['T1', 'T2', 'T3', 'T4'] },
          realism: { enum: ['confirmed', 'plausible', 'speculative'] },
          reason: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
}

const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['digest_items', 'thesis_candidates', 'coverage_gaps'],
  properties: {
    digest_items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'sources', 'realism', 'decision_relevance'],
        properties: {
          claim: { type: 'string' },
          sources: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['url', 'provenance_tier'], properties: { url: { type: 'string' }, provenance_tier: { enum: ['T1', 'T2', 'T3', 'T4'] } } } },
          corroboration: { type: 'number' },
          freshness: { type: 'string' },
          realism: { enum: ['confirmed', 'plausible', 'speculative'] },
          decision_relevance: { type: 'string', description: 'что это меняет для владельца; пункт без этого не существует' },
          strategy_tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    thesis_candidates: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['strategy', 'segment', 'problem', 'asymmetry', 'catalyst', 'why_not_done', 'realism', 'red_team'],
        properties: {
          strategy: { type: 'array', items: { enum: ['geo-lag', 'pay-and-complain', 'catalyst-window', 'under-radar', 'import-substitution', 'unbundling', 'picks-and-shovels'] } },
          segment: { type: 'string' },
          problem: { type: 'string' },
          asymmetry: { enum: ['timing-window', 'under-radar-niche', 'execution-gap', 'proprietary-edge', 'geo-window'] },
          geo: {
            type: 'object', additionalProperties: false,
            required: ['origin_market', 'ru_status', 'lag_estimate', 'localization_barriers'],
            properties: {
              origin_market: { type: 'string' },
              ru_status: { enum: ['empty', 'weak-analogs', 'strong-analogs'] },
              lag_estimate: { type: 'string' },
              localization_barriers: { type: 'array', items: { type: 'string' } },
            },
            description: 'обязателен для geo-lag / import-substitution',
          },
          evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['url', 'provenance_tier'], properties: { url: { type: 'string' }, provenance_tier: { enum: ['T1', 'T2', 'T3', 'T4'] }, note: { type: 'string' } } } },
          catalyst: { type: 'string' },
          channel: { type: 'string' },
          edge_hypothesis: { type: 'string' },
          why_not_done: { enum: ['newly-possible', 'overlooked', 'done-and-missed', 'bad-business'] },
          realism: { enum: ['confirmed', 'plausible', 'speculative'] },
          red_team: { type: 'string', description: 'сильнейший аргумент ПРОТИВ и почему тезис его переживает' },
        },
      },
    },
    coverage_gaps: { type: 'array', items: { type: 'string' } },
  },
}

// ===== Промпты =====
const antiHypeRules = `Правила анти-хайпа (обязательны):
- provenance: T1 первичка (документ/данные/автор события) | T2 независимая вторичка | T3 vendor | T4 агрегатор/листикл;
- vendor-only claim -> максимум realism=plausible с пометкой vendor;
- цифры без методологии -> demote; превосходные степени/футурология без базы -> drop;
- confirmed требует >=${th.realism_confirmed_min_corroboration} НЕЗАВИСИМЫХ источников;
- противоречия источников НЕ сглаживать — фиксировать как отдельный факт "источники расходятся";
- при сомнении — понижай (default-refute).`

function collectPrompt(lane) {
  return `Ты сборщик сигналов Product Radar (Stage A), вертикаль "${a.vertical}", неделя ${week}, lane "${lane.id}" (tier ${lane.tier}; кормит стратегии: ${(lane.feeds || []).join(', ')}).

ЗАДАЧА: через WebSearch/WebFetch собрать СВЕЖИЕ (приоритет — последние 2-4 недели; для revenue-фактов и категорий допустимо до 12 мес) сигналы по источникам lane:
${(lane.sources || []).map((s) => '- ' + s).join('\n')}

Подсказки lane: ${lane.hints || '—'}

ГЕО-ФОКУС: целевой рынок продуктов — Россия. EN-находки ценны как сырьё для переноса (гео-лаг/импортозамещение) — если lane предполагает RU-присутствие-чек, выполняй его как отдельные findings с signal_class=ru-presence-check.

Правила сбора: только проверяемые утверждения с URL; дословные цитаты где возможно; считай НЕЗАВИСИМЫЕ повторы сигнала (repeats_seen); НЕ интерпретируй и НЕ ранжируй — это работа следующих стадий; если источник недоступен/пуст — честно опиши это в lane_health (никаких молчаливых срезов). До ~15 сильнейших findings, не добивай количеством.`
}

function auditPrompt(lane, found) {
  return `Ты адверсариальный анти-хайп аудитор Product Radar. Lane "${lane.id}" (${lane.title}).

${antiHypeRules}

Проаудируй каждый finding: вердикт keep/demote/drop + provenance_tier + realism + причина. Твоя задача — РЕЗАТЬ: хайп, vendor-нарративы, одиночные анекдоты (repeats < ${th.signal_min_repeats} для жалоб), устаревшее, неконкретное ("хочу удобнее"). Сомневаешься — demote.

FINDINGS:
${JSON.stringify(found.findings)}

lane_health от сборщика: ${found.lane_health}`
}

function synthPrompt(audited) {
  const strategiesDesc = `Стратегии (CONCEPT.md §3.6; веса из конфига: ${JSON.stringify(a.strategies || {})}):
S1 geo-lag: тренд с ДОКАЗАННЫМИ деньгами в US/EN -> РФ через 1-3 года; обязателен geo-блок (ru_status из ru-presence-check findings; strong-analogs = drop кандидата);
S5 import-substitution: западный вендор ушёл/недоступен в РФ -> замещающий спрос обученного рынка; обязателен geo-блок;
S2 pay-and-complain: existing spend + плохое обслуживание (RU-прямой или переносимый);
S3 catalyst-window: катализатор открыл зазор (особенно RU-регуляторика);
S7 picks-and-shovels: обслуживать едущих на ИИ-волне (RU-команды с ограниченным доступом к западным сервисам);
S4 under-radar: micro-SaaS ниша (юнит-экономику считать по RU, не по US-бенчмаркам);
S6 unbundling: вертикализация горизонтального продукта под RU-отраслевую специфику.`

  return `Ты синтезатор Product Radar (Stage A), вертикаль "${a.vertical}", неделя ${week}. Целевой рынок продуктов — РОССИЯ.

${strategiesDesc}

${antiHypeRules}

ВХОД 1 — проаудированные lanes (используй только verdict keep/demote; drop не существует):
${JSON.stringify(audited)}

ВХОД 2 — Tier-P наблюдения владельца (проприетарный вход, высокий приоритет, но та же дисциплина улик):
${JSON.stringify(a.tierP || [])}

ВХОД 3 — pattern library (НЕ предлагать заново уже умершие тезисы; повторы виденного — отметить):
${a.priorPatterns || '(пусто — первый прогон)'}

ЗАДАЧИ:
1. digest_items: decision-feed пункты. Жёсткий гейт: пункт без внятного decision_relevance ("что это меняет для владельца") НЕ включается. Кросс-источниковая корроборация: считай corroboration по НЕЗАВИСИМЫМ источникам из разных lanes. Помечай strategy_tags. Бюджет чтения дайджеста ~${th.digest_reading_budget_minutes} мин — отбирай, а не сжимай.
2. thesis_candidates: кандидаты тезисов по стратегиям. Каждый обязан пройти: (а) фильтр асимметрии (одна из 5, иначе это консенсус — не кандидат); (б) вопрос-убийца why_not_done (для geo/import — "почему ещё не перенесли в РФ?"); только newly-possible и overlooked = зелёный; (в) red_team: сформулируй сильнейший аргумент ПРОТИВ ("почему это плохой бизнес в РФ?") и почему кандидат его переживает — не переживает = не включай; (г) для S1/S5 — обязательный geo-блок из ru-presence-check улик. 0 кандидатов — валидный результат (не выдумывай).
3. coverage_gaps: что не покрыто (упавшие lanes из lane_health, непроверенные RU-чеки, окна без данных) — раскрыть ВСЁ, ничего молча.`
}

// ===== Конвейер =====
// pipeline: каждая lane независимо Collect -> Verify (без барьера между lanes)
const audited = await pipeline(
  lanes,
  (lane) => agent(collectPrompt(lane), { label: `collect:${lane.id}`, phase: 'Collect', model: 'sonnet', schema: FINDINGS_SCHEMA }),
  (found, lane) => {
    if (!found) return { lane: lane.id, tier: lane.tier, feeds: lane.feeds, audit: { verdicts: [], summary: 'сборщик не вернул результат' }, lane_health: 'collector-failed' }
    if (!found.findings || !found.findings.length) return { lane: lane.id, tier: lane.tier, feeds: lane.feeds, audit: { verdicts: [], summary: 'находок нет' }, lane_health: found.lane_health }
    return agent(auditPrompt(lane, found), { label: `audit:${lane.id}`, phase: 'Verify', model: 'opus', schema: AUDIT_SCHEMA })
      .then((audit) => ({ lane: lane.id, tier: lane.tier, feeds: lane.feeds, audit: audit || { verdicts: [], summary: 'аудитор не вернул результат' }, lane_health: found.lane_health }))
  }
)

const survived = audited.filter(Boolean)
log(`Lanes проаудированы: ${survived.length}/${lanes.length}; деградации: ${survived.filter((l) => l.lane_health && l.lane_health !== 'ok').length}`)

// Барьер оправдан: синтез требует ВСЕ lanes сразу (кросс-источниковая корроборация,
// пары "EN-тренд x RU-чек", дедуп против pattern library).
const synth = await agent(synthPrompt(survived), { label: 'synthesize', phase: 'Synthesize', model: 'opus', schema: SYNTH_SCHEMA, effort: 'high' })

return {
  vertical: a.vertical,
  week,
  lane_health: survived.map((l) => ({ lane: l.lane, health: l.lane_health })),
  lanes: survived,
  digest_items: (synth && synth.digest_items) || [],
  thesis_candidates: (synth && synth.thesis_candidates) || [],
  coverage_gaps: (synth && synth.coverage_gaps) || ['synthesize вернул пусто — разобрать journal.jsonl'],
}
