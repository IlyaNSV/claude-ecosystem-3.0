#!/usr/bin/env node
/**
 * sensors-panel.cjs — штатная панель 8 датчиков H0/H1 (ENFORCEMENT_PLAN пакет 5).
 *
 * WHY THIS EXISTS:
 *   Волна 0 посчитала свои метрики ОДИН раз, вручную, одиннадцатью субагентами за ~1.9M
 *   токенов — и вывод «экосистема недо-принуждает» держится ровно до тех пор, пока кто-то
 *   помнит числа. Разовый замер не датчик: он не скажет, стало ли хуже. Панель превращает
 *   восемь уже выведенных формул в повторяемый детерминированный прогон, который можно
 *   гонять на каждом чекпоинте и сравнивать с прошлым — без LLM, без суждения, без веры.
 *
 * ПОРОГИ И ИХ ПРОИСХОЖДЕНИЕ — НЕ ЗДЕСЬ.
 *   Единственный источник — `dev/global-loop/analysis/REPORT.md §7.3` (таблица «штатные
 *   датчики H0/H1»); обоснование каждого числа — в теле REPORT и в PREREG §5. Копия таблицы
 *   в этом файле разошлась бы с источником молча, поэтому в коде лежат только сами числа
 *   (константа THRESHOLDS) с полем `source`, а «зачем такой порог» читается в REPORT.
 *   Меняешь порог — это изменение политики, ему место в DEV_JOURNAL, а не в рефакторинге.
 *
 * ЧТО ПАНЕЛЬ НИКОГДА НЕ ДЕЛАЕТ — ФАБРИКУЕТ ЧИСЛО.
 *   Отсутствующий вход даёт `NO-DATA` с ПРИЧИНОЙ, а не ноль. Ноль — это утверждение
 *   («дефектов без гейта нет»), и оно неотличимо от «файл не прочитан», если не разделить
 *   их статусом. Поэтому статусная машина из четырёх состояний:
 *     NO-DATA  вход отсутствует / 0 строк в окне / знаменатель нулевой → value = null
 *     STALE    вход есть, но самая свежая его дата старше (--at − freshness_max_days.<вход>);
 *              значение ПЕЧАТАЕТСЯ, но с пометкой — устаревший датчик хуже молчащего, когда
 *              его показание принимают за текущее
 *     ALARM    строго по порогу (op `>` / `<` — СТРОГИЕ неравенства: значение РАВНОЕ порогу
 *              НЕ тревога; порог — граница, а не сама аномалия)
 *     OK       иначе
 *   Приоритет статусов: NO-DATA > STALE > ALARM > OK. Поле `alarm` при этом считается
 *   независимо, поэтому «протухший датчик, который к тому же пробил порог» всё равно даёт
 *   exit 1: недо-сообщить о тревоге дороже, чем пере-сообщить.
 *
 * ЕДИНСТВЕННОЕ ОТСТУПЛЕНИЕ ОТ «value = null при NO-DATA» — S1 с историей < 3 точек.
 *   У S1 тревога — не порог, а ТРЕНД (рост два прогона подряд), и на первом-втором прогоне
 *   сравнивать не с чем: alarm = null, статус NO-DATA. Но само значение при этом ПОСЧИТАНО
 *   и остаётся в отчёте — обнулить его значило бы стереть ровно ту точку, ради накопления
 *   которой прогон и делается. NO-DATA здесь про отсутствие БАЗЫ СРАВНЕНИЯ, не про вход.
 *
 * ДЕТЕРМИНИЗМ (жёсткое ограничение, как в orchestrator/lib/run-ledger.cjs):
 *   часы (`new Date()` без аргумента) читаются РОВНО в одном месте — CLI-обёртке, для
 *   дефолтного `--at`. Все compute-функции получают `atIso` аргументом и потому проверяемы
 *   инлайн-фикстурами: один и тот же вход всегда даёт один и тот же отчёт. Это то, что
 *   делает `--selftest` возможным без внешних данных.
 *
 * ДОНОРЫ ФОРМУЛ (лифт, не переписывание — код-родитель указан у каждой функции):
 *   analysis/scripts/metrics-core.cjs   — оверхед пульта (S2), сигналы 24 ч (S5)
 *   analysis/scripts/defect-metrics.cjs — доля «нет такого гейта» (S3), defect-escape (S4)
 *   analysis/scripts/churn-survival.cjs — выживаемость строк / self-churn (S6)
 *   analysis/scripts/parse-ledger.cjs   — нарезка записей на claims + правило якоря (S8)
 *   scripts/ledger-anchor-check.cjs     — parseEntries (S8) + вердикт гейта справочно
 *   orchestrator/lib/transcript-usage.cjs — токены сессий (S1, S2), грузится ЛЕНИВО:
 *     модуль может отсутствовать, тогда S1/S2 честно дают NO-DATA, а не крэш.
 *
 * EXIT CODES:
 *   0  ни одного ALARM
 *   1  есть ALARM (со --strict — также любой NO-DATA / STALE)
 *   2  конфиг/IO-авария (панель не смогла собраться вообще)
 *
 * Dual-use: `require()` ради чистых compute-функций, либо запуск как CLI. Node stdlib only.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SENSORS_PANEL_SCHEMA_VERSION = 1;

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_CONFIG = path.join(REPO_ROOT, 'dev', 'global-loop', 'panel', 'panel-config.json');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'dev', 'global-loop', 'panel');

const DAY_MS = 24 * 60 * 60 * 1000;
const THRESHOLD_SOURCE = 'REPORT.md §7.3';

/**
 * Числа — из REPORT.md §7.3. `op`:
 *   '>'  тревога, когда значение СТРОГО больше порога
 *   '<'  тревога, когда значение СТРОГО меньше порога
 *   'trend-up-2' тревога, когда три последних прогона строго растут (v3 > v2 > v1)
 */
const THRESHOLDS = {
  S1: { op: 'trend-up-2', value: null, source: THRESHOLD_SOURCE },
  S2: { op: '>', value: 0.40, source: THRESHOLD_SOURCE },
  S3: { op: '>', value: 0.40, source: THRESHOLD_SOURCE },
  S4: { op: '>', value: 0.20, source: THRESHOLD_SOURCE },
  S5: { op: '<', value: 0.80, source: THRESHOLD_SOURCE },
  S6: { op: '>', value: 0.10, source: THRESHOLD_SOURCE },
  S7: { op: '<', value: 14, source: THRESHOLD_SOURCE },
  S8: { op: '<', value: 0.60, source: THRESHOLD_SOURCE },
};

const SENSOR_IDS = {
  S1: 'S1_cost_per_resolved_intent',
  S2: 'S2_console_overhead',
  S3: 'S3_defects_no_gate',
  S4: 'S4_defect_escape',
  S5: 'S5_signal_coverage_24h',
  S6: 'S6_self_churn_14d',
  S7: 'S7_spec_drift_velocity',
  S8: 'S8_claim_anchor_rate',
};

const SELF_CHURN_WINDOW_DAYS = 14;   // «строки, не дожившие 14 дней» — REPORT §7.3
const SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1000; // «покрытие сигналом за 24 ч»

// ---------------------------------------------------------------------------
// Мелкие чистые утилиты
// ---------------------------------------------------------------------------

/** `~` → домашний каталог; относительное — от корня репо. */
function expandHome(p) {
  const s = String(p == null ? '' : p);
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (s === '~') return home;
  if (s.startsWith('~/') || s.startsWith('~\\')) return path.join(home, s.slice(2));
  return s;
}

function resolvePath(p, root) {
  const e = expandHome(p);
  if (!e) return e;
  return path.isAbsolute(e) ? e : path.resolve(root || REPO_ROOT, e);
}

/** ms или null — «непарсибельная дата» это ДАННЫЕ (в датасетах живёт «не указано»), не ошибка. */
function parseTs(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

function inWindow(ts, fromMs, toMs) {
  const t = parseTs(ts);
  if (t === null) return false;
  if (fromMs !== null && fromMs !== undefined && t < fromMs) return false;
  if (toMs !== null && toMs !== undefined && t > toMs) return false;
  return true;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Самая свежая (max) из ISO-подобных строк; null если ни одной валидной. */
function newestOf(values) {
  let best = null;
  let bestMs = null;
  for (const v of values) {
    const ms = parseTs(v);
    if (ms === null) continue;
    if (bestMs === null || ms > bestMs) { bestMs = ms; best = String(v).trim(); }
  }
  return best;
}

/**
 * CSV-парсер (лифт: analysis/scripts/metrics-core.cjs:16-30 — тот же, что породил датасет,
 * чтобы панель не разошлась с ним в трактовке кавычек/переводов строк).
 * Чистая функция от ТЕКСТА: файловый ввод — забота вызывающего.
 */
function parseCsv(text) {
  const txt = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!txt) return [];
  const rows = [];
  let cur = [];
  let field = '';
  let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const hdr = rows.shift();
  if (!hdr) return [];
  return rows.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}

// ---------------------------------------------------------------------------
// Статусная машина
// ---------------------------------------------------------------------------

function baseSensor(key, title, unit, provenance) {
  return {
    id: SENSOR_IDS[key],
    title,
    value: null,
    unit,
    threshold: THRESHOLDS[key],
    alarm: null,
    status: 'NO-DATA',
    provenance,
    input_freshness: [],
    reason: null,
    detail: {},
  };
}

/** Строгие неравенства: значение, РАВНОЕ порогу, тревогой не является. */
function evalThreshold(op, value, threshold) {
  if (value === null || value === undefined || threshold === null || threshold === undefined) return null;
  if (op === '>') return value > threshold;
  if (op === '<') return value < threshold;
  return null;
}

/** Отметить датчик как NO-DATA с обязательной причиной. */
function noData(sensor, reason, detail) {
  sensor.value = null;
  sensor.alarm = null;
  sensor.status = 'NO-DATA';
  sensor.reason = reason;
  if (detail) sensor.detail = Object.assign(sensor.detail, detail);
  return sensor;
}

/**
 * Проставить значение и вывести статус. `stale` — уже посчитанный вердикт по свежести
 * (см. buildFreshness): панель не читает часы внутри, atIso пришёл сверху.
 */
function settle(sensor, value, staleReason, detail) {
  sensor.value = value;
  if (detail) sensor.detail = Object.assign(sensor.detail, detail);
  sensor.alarm = evalThreshold(sensor.threshold.op, value, sensor.threshold.value);
  if (staleReason) {
    sensor.status = 'STALE';
    sensor.reason = sensor.alarm === true
      ? `${staleReason}; при этом порог пробит — тревога засчитана`
      : staleReason;
  } else if (sensor.alarm === true) {
    sensor.status = 'ALARM';
    sensor.reason = describeBreach(sensor);
  } else {
    sensor.status = 'OK';
  }
  return sensor;
}

function describeBreach(sensor) {
  const t = sensor.threshold;
  const v = fmtValue(sensor.value, sensor.unit);
  const thr = fmtValue(t.value, sensor.unit);
  return `значение ${v} ${t.op} порога ${thr} (${t.source})`;
}

/**
 * Свежесть входов. `inputs` — [{input, newest}]; `maxDays` — карта из конфига.
 * Вход без настроенного лимита считается свежим (политики нет — нечего нарушать).
 * @returns {{freshness: Array, staleReason: string|null}}
 */
function buildFreshness(inputs, maxDays, atIso) {
  const atMs = parseTs(atIso);
  const freshness = [];
  const stale = [];
  for (const inp of inputs) {
    const limit = maxDays && Object.prototype.hasOwnProperty.call(maxDays, inp.input)
      ? Number(maxDays[inp.input]) : null;
    let fresh = true;
    if (limit !== null && !Number.isNaN(limit)) {
      const ms = parseTs(inp.newest);
      if (ms === null) fresh = false;
      else if (atMs !== null && (atMs - ms) > limit * DAY_MS) fresh = false;
    }
    freshness.push({ input: inp.input, newest: inp.newest || null, fresh });
    if (!fresh) {
      const days = parseTs(inp.newest) !== null && atMs !== null
        ? Math.floor((atMs - parseTs(inp.newest)) / DAY_MS) : null;
      stale.push(`${inp.input}: самая свежая дата ${inp.newest || '—'}` +
        (days === null ? '' : ` (${days} дн. назад, лимит ${limit})`));
    }
  }
  return {
    freshness,
    staleReason: stale.length ? `вход устарел — ${stale.join('; ')}` : null,
  };
}

// ---------------------------------------------------------------------------
// ЧИСТЫЕ COMPUTE-ФУНКЦИИ. Ни FS, ни часов, ни process.argv — только аргументы.
// ---------------------------------------------------------------------------

/**
 * S1 — cost per resolved intent (mixed: числитель raw-logs, знаменатель курируемый).
 * Тревога — ТРЕНД: три последних прогона с РАЗНЫМИ label строго растут.
 *
 * @param {{sessions:Array|null, sessionsError:?string,
 *          verdicts:Array|null, verdictsNewest:?string,
 *          history:Array, label:string, atIso:string, fromMs:?number, toMs:?number,
 *          freshnessMaxDays:Object}} input
 *   sessions  [{layer, first_ts, output_tokens}] — null, если модуль токенов недоступен
 *   verdicts  [{ts, verdict}] из intents_verdicts.csv — null, если файла нет
 *   history   [{label, generated_at, value}] — прошлые точки S1, хронологически
 */
function computeS1(input) {
  const s = baseSensor('S1', 'Цена решённой интенции', 'tokens/intent', 'mixed');
  const { freshness, staleReason } = buildFreshness([
    { input: 'transcripts', newest: input.sessions ? newestOf(input.sessions.map((x) => x.first_ts)) : null },
    { input: 'intents_verdicts', newest: input.verdictsNewest || null },
  ], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!input.sessions) {
    return noData(s, `числитель недоступен — ${input.sessionsError || 'источник токенов не прочитан'}`);
  }
  if (!input.verdicts) {
    return noData(s, 'знаменатель недоступен — intents_verdicts.csv не прочитан');
  }

  const inWin = input.sessions.filter((x) => inWindow(x.first_ts, input.fromMs, input.toMs));
  const tokensTotal = inWin.reduce((a, x) => a + (Number(x.output_tokens) || 0), 0);

  const resolved = input.verdicts.filter((v) =>
    ['RESOLVED_1', 'RESOLVED_N'].includes(String(v.verdict || '').trim()) &&
    inWindow(v.ts, input.fromMs, input.toMs));

  if (!resolved.length) {
    return noData(s,
      'знаменатель курируемый, судейство для окна не проведено — 0 интенций с вердиктом RESOLVED_1/RESOLVED_N',
      { tokens_total: tokensTotal, resolved_n: 0, history_points: 0 });
  }
  if (!inWin.length) {
    return noData(s, 'числитель пуст — 0 сессий с first_ts в окне',
      { tokens_total: 0, resolved_n: resolved.length, history_points: 0 });
  }

  const value = +(tokensTotal / resolved.length).toFixed(1);

  // Тренд: прошлые точки + текущая, по одной на label (побеждает последняя), последние 3.
  const byLabel = new Map();
  for (const h of (input.history || [])) {
    if (h && h.value !== null && h.value !== undefined) byLabel.set(h.label, Number(h.value));
  }
  byLabel.set(input.label, value);
  const points = [...byLabel.entries()].slice(-3);
  const detail = {
    tokens_total: tokensTotal,
    resolved_n: resolved.length,
    history_points: byLabel.size,
    trend: points.map(([l, v]) => ({ label: l, value: v })),
  };

  s.value = value;
  s.detail = Object.assign(s.detail, detail);
  s.input_freshness = freshness;

  if (points.length < 3) {
    // ОТСТУПЛЕНИЕ (см. шапку): значение сохраняем — оно и есть накапливаемая точка.
    s.alarm = null;
    s.status = 'NO-DATA';
    s.reason = `история <3 прогонов (${points.length}) — тренд не оценивается; значение ` +
      `${value} tokens/intent записано как точка для будущих сравнений`;
    return s;
  }

  const [a, b, c] = points.map(([, v]) => v);
  const rising = c > b && b > a;
  s.alarm = rising;
  if (staleReason) {
    s.status = 'STALE';
    s.reason = rising ? `${staleReason}; при этом рост 2 прогона подряд — тревога засчитана` : staleReason;
  } else if (rising) {
    s.status = 'ALARM';
    s.reason = `рост 2 прогона подряд: ${a} → ${b} → ${c} tokens/intent (${s.threshold.source})`;
  } else {
    s.status = 'OK';
  }
  return s;
}

/**
 * S2 — оверхед пульта = tok_out(host) / tok_out(executor).
 * Донор формулы: analysis/scripts/metrics-core.cjs:66-69 (там же порог 0.40).
 * @param {{sessions:Array|null, sessionsError:?string, fromMs:?number, toMs:?number,
 *          atIso:string, freshnessMaxDays:Object}} input
 */
function computeS2(input) {
  const s = baseSensor('S2', 'Оверхед пульта', 'ratio', 'raw-logs');
  const sessions = input.sessions;
  const { freshness } = buildFreshness([
    { input: 'transcripts_host', newest: sessions ? newestOf(sessions.filter((x) => x.layer === 'host').map((x) => x.first_ts)) : null },
    { input: 'transcripts_executor', newest: sessions ? newestOf(sessions.filter((x) => x.layer === 'executor').map((x) => x.first_ts)) : null },
  ], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!sessions) {
    return noData(s, `источник токенов не прочитан — ${input.sessionsError || 'нет данных'}`);
  }

  const host = sessions.filter((x) => x.layer === 'host' && inWindow(x.first_ts, input.fromMs, input.toMs));
  const exec = sessions.filter((x) => x.layer === 'executor' && inWindow(x.first_ts, input.fromMs, input.toMs));
  const hostTok = host.reduce((a, x) => a + (Number(x.output_tokens) || 0), 0);
  const execTok = exec.reduce((a, x) => a + (Number(x.output_tokens) || 0), 0);
  const detail = { host_tokens: hostTok, executor_tokens: execTok, sessions_host: host.length, sessions_executor: exec.length };

  if (!host.length) return noData(s, 'слой host пуст — 0 сессий с first_ts в окне', detail);
  if (!exec.length) return noData(s, 'слой executor пуст — 0 сессий с first_ts в окне', detail);
  if (!execTok) return noData(s, 'слой executor дал 0 output-токенов — знаменатель нулевой', detail);

  return settle(s, +(hostTok / execTok).toFixed(3), null, detail);
}

/**
 * S3 — доля дефектов, для которых гейта НЕ СУЩЕСТВУЕТ.
 * Донор: analysis/scripts/defect-metrics.cjs:77 (регекс `нет такого гейта`).
 * @param {{rows:Array|null, atIso:string, fromMs:?number, toMs:?number, freshnessMaxDays:Object}} input
 */
function computeS3(input) {
  const s = baseSensor('S3', 'Доля дефектов без гейта', 'ratio', 'curated');
  const rows = input.rows;
  const newest = rows ? newestOf(rows.map((r) => r.caught_when)) : null;
  const { freshness, staleReason } = buildFreshness(
    [{ input: 'defects', newest }], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!rows) return noData(s, 'defects.csv не прочитан');
  const win = rows.filter((r) => inWindow(r.caught_when, input.fromMs, input.toMs));
  const undated = rows.filter((r) => parseTs(r.caught_when) === null).length;
  if (!win.length) {
    return noData(s, `0 строк defects.csv с caught_when в окне (всего строк ${rows.length}, без разбираемой даты ${undated})`,
      { rows_total: rows.length, rows_in_window: 0, rows_undated: undated });
  }
  const noGate = win.filter((r) => /нет такого гейта/i.test(r.gate_expected || '')).length;
  return settle(s, +(noGate / win.length).toFixed(3), staleReason, {
    rows_total: rows.length, rows_in_window: win.length, rows_undated: undated, no_gate: noGate,
  });
}

/**
 * S4 — defect-escape: доля дефектов, до которых машина не добралась и поймал владелец.
 * Донор: analysis/scripts/defect-metrics.cjs:65-67.
 */
function computeS4(input) {
  const s = baseSensor('S4', 'Defect-escape (поймал владелец)', 'ratio', 'curated');
  const rows = input.rows;
  const newest = rows ? newestOf(rows.map((r) => r.caught_when)) : null;
  const { freshness, staleReason } = buildFreshness(
    [{ input: 'defects', newest }], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!rows) return noData(s, 'defects.csv не прочитан');
  const win = rows.filter((r) => inWindow(r.caught_when, input.fromMs, input.toMs));
  if (!win.length) {
    return noData(s, `0 строк defects.csv с caught_when в окне (всего строк ${rows.length})`,
      { rows_total: rows.length, rows_in_window: 0 });
  }
  const by = {};
  for (const r of win) { const k = (r.caught_by || '—').trim() || '—'; by[k] = (by[k] || 0) + 1; }
  const owner = by.owner || 0;
  return settle(s, +(owner / win.length).toFixed(3), staleReason, {
    rows_in_window: win.length, owner, by_caught_by: by,
  });
}

/**
 * S5 — покрытие коммита машинным сигналом за 24 ч.
 * Донор: analysis/scripts/metrics-core.cjs:135-152 (список сигналов + окно 24 ч).
 * Коммиты моложе 24 ч на момент --at из ЗНАМЕНАТЕЛЯ исключены: у них окно ещё не истекло,
 * и считать их непокрытыми значило бы штрафовать панель за собственную поспешность.
 *
 * @param {{commits:Array|null, signals:Array, signalSources:Array,
 *          atIso:string, fromMs:?number, toMs:?number, freshnessMaxDays:Object}} input
 *   commits [{sha, ts}] · signals [{ts, what}] (порядок не важен, сортируется внутри)
 */
function computeS5(input) {
  const s = baseSensor('S5', 'Покрытие сигналом за 24 ч', 'ratio', 'raw-logs');
  const commits = input.commits;
  const signals = [...(input.signals || [])]
    .map((x) => ({ ms: parseTs(x.ts), what: x.what }))
    .filter((x) => x.ms !== null)
    .sort((a, b) => a.ms - b.ms);
  const { freshness } = buildFreshness([
    { input: 'pilot_git', newest: commits ? newestOf(commits.map((c) => c.ts)) : null },
    ...(input.signalSources || []),
  ], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!commits) return noData(s, 'репозиторий пилота недоступен — git-лог не прочитан');
  const win = commits.filter((c) => inWindow(c.ts, input.fromMs, input.toMs));
  if (!win.length) return noData(s, '0 коммитов пилота в окне', { commits_in_window: 0 });

  const atMs = parseTs(input.atIso);
  let covered = 0;
  let notYet = 0;
  let evaluable = 0;
  for (const c of win) {
    const t = parseTs(c.ts);
    if (t === null) continue;
    if (atMs !== null && (atMs - t) < SIGNAL_WINDOW_MS) { notYet += 1; continue; }
    evaluable += 1;
    const sig = signals.find((x) => x.ms >= t);
    if (sig && (sig.ms - t) <= SIGNAL_WINDOW_MS) covered += 1;
  }
  const detail = {
    commits_in_window: win.length, evaluable, covered,
    not_yet_evaluable: notYet, signals_total: signals.length,
  };
  if (!evaluable) {
    return noData(s, `все ${win.length} коммит(ов) окна моложе 24 ч на момент --at — оценивать нечего`, detail);
  }
  if (!signals.length) {
    // Сигналов нет вообще — это НЕ «покрытие 0», это отсутствующий вход.
    return noData(s, 'ни одного машинного сигнала не прочитано (run_ledgers пуст И releases_file не дал записей)', detail);
  }
  return settle(s, +(covered / evaluable).toFixed(3), null, detail);
}

/**
 * S6 — self-churn: доля строк, не доживших 14 дней.
 * Донор: analysis/scripts/churn-survival.cjs (blame HEAD → живые строки, log --numstat →
 * добавленные). Оценивается только по коммитам, которым на момент --at исполнилось ≥14 дней.
 *
 * МЕТОД — ВЕРХНЯЯ ОЦЕНКА, и это надо знать, читая число: «живо» меряется относительно
 * ТЕКУЩЕГО HEAD, а не среза «коммит + 14 дней». Строка, прожившая 20 дней и удалённая
 * вчера, здесь считается не дожившей. Поэтому detail.method = head-approx (upper bound):
 * датчик годится для ДИНАМИКИ между прогонами, а абсолют завышен by construction.
 *
 * @param {{commits:Array|null, atIso:string, fromMs:?number, toMs:?number, freshnessMaxDays:Object}} input
 *   commits [{sha, ts, added, alive}]
 */
function computeS6(input) {
  const s = baseSensor('S6', 'Self-churn (14 дней)', 'ratio', 'raw-logs');
  const commits = input.commits;
  const { freshness } = buildFreshness(
    [{ input: 'pilot_git', newest: commits ? newestOf(commits.map((c) => c.ts)) : null }],
    input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;
  s.detail.method = 'head-approx (upper bound)';
  s.detail.method_note = '«живо» = живо в HEAD сейчас, не на срезе «коммит + 14 дней»; ' +
    'законно удалённая позже строка тоже попадает в churn — читать динамику, не абсолют';

  if (!commits) return noData(s, 'репозиторий пилота недоступен — blame/numstat не прочитаны');
  const atMs = parseTs(input.atIso);
  const evaluable = commits.filter((c) => {
    if (!inWindow(c.ts, input.fromMs, input.toMs)) return false;
    const t = parseTs(c.ts);
    if (t === null || atMs === null) return false;
    return (atMs - t) >= SELF_CHURN_WINDOW_DAYS * DAY_MS;
  });
  if (!evaluable.length) {
    return noData(s, `0 коммитов окна старше ${SELF_CHURN_WINDOW_DAYS} дней на момент --at — выживаемость ещё не определена`,
      { commits_in_window: commits.filter((c) => inWindow(c.ts, input.fromMs, input.toMs)).length, evaluable: 0 });
  }
  const added = evaluable.reduce((a, c) => a + (Number(c.added) || 0), 0);
  const alive = evaluable.reduce((a, c) => a + (Number(c.alive) || 0), 0);
  if (!added) return noData(s, 'у оцениваемых коммитов 0 добавленных строк — знаменатель нулевой', { evaluable: evaluable.length });
  return settle(s, +(1 - Math.min(1, alive / added)).toFixed(3), null, {
    evaluable: evaluable.length, added_lines: added, alive_lines: alive,
  });
}

/**
 * S7 — spec-drift velocity: медиана дней от последнего обновления артефакта до расхождения.
 * Тревога — медиана НИЖЕ порога (документы разъезжаются быстрее, чем их чинят).
 * @param {{rows:Array|null, atIso:string, fromMs:?number, toMs:?number, freshnessMaxDays:Object}} input
 */
function computeS7(input) {
  const s = baseSensor('S7', 'Spec-drift velocity', 'days', 'curated');
  const rows = input.rows;
  const newest = rows ? newestOf(rows.map((r) => r.artifact_last_update)) : null;
  const { freshness, staleReason } = buildFreshness(
    [{ input: 'spec_drift', newest }], input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;

  if (!rows) return noData(s, 'spec_drift.csv не прочитан');
  const withDrift = rows.filter((r) => String(r.drift_detected_at || '').trim() !== '');
  const win = withDrift.filter((r) => inWindow(r.drift_detected_at, input.fromMs, input.toMs));
  if (!win.length) {
    return noData(s, `0 строк spec_drift.csv с непустым drift_detected_at в окне (всего строк ${rows.length}, с дрейфом ${withDrift.length})`,
      { rows_total: rows.length, rows_with_drift: withDrift.length });
  }
  const days = win.map((r) => Number(r.drift_days)).filter((x) => Number.isFinite(x));
  if (!days.length) {
    return noData(s, 'ни у одной строки окна нет числового drift_days',
      { rows_total: rows.length, rows_with_drift: win.length });
  }
  return settle(s, +Number(median(days)).toFixed(1), staleReason, {
    rows_total: rows.length, rows_with_drift: win.length,
  });
}

/**
 * Маркеры claim'а — ЛИФТ analysis/scripts/parse-ledger.cjs:50-55. Строка журнала становится
 * УТВЕРЖДЕНИЕМ (а не прозой), если заявляет одно из четырёх: выкатили · прошло проверку ·
 * починили/построили · записали/синхронизировали.
 */
const CLAIM_MARKERS = [
  { type: 'deploy', re: /DEPLOYED\s*×\s*READY|релиз\s+20\d{6}T\d{6}Z|deploy(?:ed)?\b/i },
  { type: 'test-pass', re: /PASS\s*\d+\/\d+|UJA\s*(?:PASS|GREEN)|\b\d+\/\d+\b(?=[^\n]*(?:тест|test|ассерт|PASS))|зелён|GO\s*×\s*READY|STARTS\b/i },
  { type: 'code-fix', re: /фикс|починен|исправлен|устранён|закрыт|реализован|построен|добавлен|регенерирован/i },
  { type: 'doc-sync', re: /синк|док-синк|обновлён (?:артефакт|док|спека)|записан|зафиксирован|journaled|NOTE-\d+/i },
];

// Правило якоря НА УРОВНЕ СТРОКИ — лифт parse-ledger.cjs:93-100. /g-регексы читаются только
// через .match(): .test() у глобального регекса тащит lastIndex между вызовами.
const CLAIM_SHA_G = /\b[0-9a-f]{7,40}\b/g;
const CLAIM_RELEASE_G = /\b20\d{6}T\d{6}Z\b/g;
const CLAIM_COUNT_RE = /\d+\/\d+/;
const CLAIM_ARTIFACT_RE = /NOTE-\d+|PA-\d+|DEC-[A-Z]+-\d+|Req-\d+|SC-\d+|FM-\d+/;
const CLAIM_RUNID_RE = /\brun [a-z0-9]{5,12}\b/i;

/**
 * Якоря ОДНОЙ claim-строки. Сигнатура совместима с `findAnchors` соседа — это дефолтная
 * инъекция в computeS8, и её можно подменить.
 *
 * ПОЧЕМУ НЕ `ledger-anchor-check.findAnchors` ПО УМОЛЧАНИЮ (замерено, не предположено):
 *   на живом ASSIST_LOG обе разметки дают 283 claim-кандидата, но findAnchors насчитывает
 *   131 с якорем (0.463) против 109 (0.385) здесь. Разница НЕ односторонняя — пересчёт
 *   2026-07-31: 25 строк шире у гейта (все через паттерн `artifact-id`: 17 — из-за
 *   `RUN-[A-Z]+\d+`, где строка про «RUN-B.58» заякоривает сама себя; 8 — из-за более
 *   широкого словаря идентификаторов: RL/CNT/…), ПЛЮС 3 строки в обратную сторону
 *   (`run-id` ловит здешняя разметка, а гейт — нет). Симметричная разница = 28 строк,
 *   netto 131 − 109 = 22. Гейт от самозаякоривания защищён тем, что смотрит ТОЛЬКО тело
 *   записи (его DESIGN NOTE 1) — но когда единица измерения становится СТРОКОЙ, дыра
 *   открывается снова. 109/283 = 0.385 воспроизводит эталон M7 бит-в-бит, а порог <0.60
 *   калиброван именно по нему. Более широкий счёт остаётся в detail.claims_anchored_wide.
 */
function claimAnchors(line) {
  const l = String(line == null ? '' : line);
  const ids = [];
  const shas = (l.match(CLAIM_SHA_G) || []).filter((x) => /[0-9]/.test(x) && /[a-f]/.test(x) && x.length >= 7);
  if (shas.length) ids.push('sha');
  if ((l.match(CLAIM_RELEASE_G) || []).length) ids.push('release-id');
  if (CLAIM_COUNT_RE.test(l)) ids.push('count');
  if (CLAIM_ARTIFACT_RE.test(l)) ids.push('artifact-id');
  if (CLAIM_RUNID_RE.test(l)) ids.push('run-id');
  return ids;
}

/**
 * Нарезать ОДНУ запись журнала на claim-строки — лифт parse-ledger.cjs:89-96.
 * Отсев ровно тот же: короче 25 символов (не утверждение, а обрывок) · заголовок ·
 * ни одного claim-маркера (проза, а не заявка о сделанном).
 * @param {{heading?:string, body?:string}} entry
 */
function extractClaims(entry) {
  const lines = [entry && entry.heading ? entry.heading : '', ...String((entry && entry.body) || '').split('\n')];
  const out = [];
  for (const raw of lines) {
    const l = String(raw || '').trim();
    if (l.length < 25) continue;
    if (/^#{1,4}\s/.test(l)) continue;
    if (!CLAIM_MARKERS.some((m) => m.re.test(l))) continue;
    out.push(l);
  }
  return out;
}

/**
 * S8 — claim-anchor rate: доля УТВЕРЖДЕНИЙ журнала с машинно-проверяемым якорем.
 * Формула REPORT §7.3 — «утверждения журнала с якорем / все» (эталон M7: 109/283 = 38.5%).
 *
 * ЕДИНИЦА ИЗМЕРЕНИЯ — CLAIM-СТРОКА, НЕ ЗАПИСЬ. Разница не косметическая: почти в каждой
 * записи журнала где-то есть sha или id артефакта, поэтому по записям датчик показывал бы
 * ~0.96 и не срабатывал бы НИКОГДА при пороге 0.60. Мерить надо ровно то, что мерил M7:
 * сколько отдельных заявлений «сделано / выкачено / прошло» несут при себе проверяемую
 * ссылку — потому что непроверяемое утверждение это память, а не запись.
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ ГЕЙТА: гейт `checkLedgerAnchors` судит только записи ПОСЛЕ watermark
 * (бэкфилл старых был бы фабрикацией доказательств) и на уровне ЗАПИСИ. Датчик меряет все
 * claims окна. Вердикт гейта кладётся в detail.gate справочно, значением датчика не является.
 *
 * @param {{entries:Array|null, gate:Object|null, atIso:string, fromMs:?number, toMs:?number,
 *          anchorsOf:Function, anchorsWideOf?:Function, freshnessMaxDays:Object}} input
 *   entries        результат parseEntries: [{id, date, heading, body}]
 *   anchorsOf(claimLine) → массив id якорей (инъекция ради selftest без диска)
 *   anchorsWideOf  необязательная вторая разметка для сверки (detail.claims_anchored_wide)
 */
function computeS8(input) {
  const s = baseSensor('S8', 'Claim-anchor rate', 'ratio', 'raw-logs');
  const entries = input.entries;
  const { freshness } = buildFreshness(
    [{ input: 'assist_log', newest: entries ? newestOf(entries.map((e) => e.date)) : null }],
    input.freshnessMaxDays, input.atIso);
  s.input_freshness = freshness;
  if (input.gate) s.detail.gate = input.gate;

  if (!entries) return noData(s, 'ASSIST_LOG.md не прочитан');
  const win = entries.filter((e) => inWindow(e.date, input.fromMs, input.toMs));
  if (!win.length) {
    return noData(s, `0 записей журнала с датой в окне (всего записей ${entries.length})`,
      { entries_total: entries.length, entries_in_window: 0, claims_total: 0 });
  }
  const claims = win.reduce((acc, e) => acc.concat(extractClaims(e)), []);
  if (!claims.length) {
    return noData(s, `в ${win.length} записи(ях) окна нет ни одной claim-строки (заявлений «сделано/выкачено/проверено» не найдено)`,
      { entries_total: entries.length, entries_in_window: win.length, claims_total: 0 });
  }
  const anchored = claims.filter((c) => (input.anchorsOf(c) || []).length > 0).length;
  const detail = {
    entries_in_window: win.length,
    claims_total: claims.length,
    claims_anchored: anchored,
  };
  if (typeof input.anchorsWideOf === 'function') {
    detail.claims_anchored_wide = claims.filter((c) => (input.anchorsWideOf(c) || []).length > 0).length;
  }
  return settle(s, +(anchored / claims.length).toFixed(3), null, detail);
}

// ---------------------------------------------------------------------------
// Слой ввода-вывода. Всё, что трогает диск/git, живёт ЗДЕСЬ и только здесь.
// ---------------------------------------------------------------------------

function readTextOrNull(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
}

function loadConfig(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const cfg = JSON.parse(raw);
  if (!cfg || typeof cfg !== 'object') throw new Error('конфиг не объект');
  return cfg;
}

/**
 * Токены сессий по всем transcript_roots. Модуль строится отдельно и может ОТСУТСТВОВАТЬ —
 * тогда возвращаем ошибку данными, а не исключением: S1/S2 обязаны дать NO-DATA с причиной.
 * @returns {{sessions:Array|null, error:?string, roots:Array}}
 */
function loadTranscriptSessions(cfg) {
  let mod;
  try {
    mod = require(path.join(REPO_ROOT, 'orchestrator', 'lib', 'transcript-usage.cjs'));
  } catch (e) {
    return { sessions: null, error: `transcript-usage module not found (${e.code || e.message})`, roots: [] };
  }
  if (!mod || typeof mod.listSessionFiles !== 'function' || typeof mod.readSessionUsage !== 'function') {
    return { sessions: null, error: 'transcript-usage module not found (нет экспортов listSessionFiles/readSessionUsage)', roots: [] };
  }

  const sessions = [];
  const roots = [];
  for (const r of (cfg.transcript_roots || [])) {
    const dir = resolvePath(r.path, REPO_ROOT);
    const exists = fs.existsSync(dir);
    const files = exists ? mod.listSessionFiles(dir) : [];
    let failed = 0;
    for (const f of files) {
      let u;
      try { u = mod.readSessionUsage(f, {}); } catch (_e) { failed += 1; continue; }
      // totals уже = main + subagents (transcript-usage.cjs: addLayer(main, subagents));
      // byLayer читаем как подстраховку, если контракт totals изменится.
      const byLayer = u && u.byLayer ? u.byLayer : null;
      const viaLayers = byLayer && byLayer.main && byLayer.subagents
        ? (Number(byLayer.main.output_tokens) || 0) + (Number(byLayer.subagents.output_tokens) || 0)
        : null;
      const out = viaLayers !== null ? viaLayers : (Number(u && u.totals && u.totals.output_tokens) || 0);
      sessions.push({ layer: r.layer, first_ts: u ? u.first_ts : null, output_tokens: out, file: f });
    }
    roots.push({ path: dir, layer: r.layer, exists, sessions: files.length, unreadable: failed });
  }
  if (!roots.length) return { sessions: null, error: 'в конфиге нет transcript_roots', roots };
  if (!sessions.length) {
    return { sessions: null, error: `ни один transcript_root не дал сессий (${roots.map((x) => `${x.layer}:${x.exists ? '0 файлов' : 'путь отсутствует'}`).join('; ')})`, roots };
  }
  return { sessions, error: null, roots };
}

function loadCsvRows(file) {
  const txt = readTextOrNull(file);
  return txt === null ? null : parseCsv(txt);
}

/** Коммиты пилота: sha + committer-date ISO. null, если репозиторий недоступен. */
function loadPilotCommits(repoDir) {
  if (!repoDir || !fs.existsSync(repoDir)) return null;
  let out;
  try {
    out = execFileSync('git', ['-C', repoDir, 'log', '--no-merges', '--format=%H|%cI'],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_e) { return null; }
  return out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf('|');
    return { sha: l.slice(0, i), ts: l.slice(i + 1) };
  }).filter((c) => c.sha && c.ts);
}

/**
 * Машинные сигналы для S5: started_at из run-ledger'ов + release-id из releases_file.
 * Парс release-id `\d{8}T\d{6}Z` — донор: metrics-core.cjs:124,137.
 *
 * ДЕДУП по ключу `ts|what` обязателен: один и тот же машинный run лежит в ДВУХ файлах
 * (`PILOT-DOCS/run_ledger.ndjson` — harvest-копия, `PILOT-CLONE/.claude/orchestrator/runs/
 * ledger.ndjson` — оригинал в репо; проверено 2026-07-31: одинаковые 91 run_id, одинаковый
 * диапазон дат, разный sha256). На само ПОКРЫТИЕ дубли не влияют (S5 ищет ПЕРВЫЙ сигнал
 * после коммита), но `signals_total` без дедупа врал бы вдвое — а это число читает человек.
 */
function loadSignals(cfg) {
  const seen = new Set();
  const raw = [];
  const signals = {
    push(sig) {
      const k = `${sig.ts}|${sig.what}`;
      if (seen.has(k)) return;
      seen.add(k);
      raw.push(sig);
    },
  };
  const sources = [];
  for (const lp of (cfg.run_ledgers || [])) {
    const file = resolvePath(lp, REPO_ROOT);
    const txt = readTextOrNull(file);
    const name = `run_ledger:${path.basename(file)}`;
    if (txt === null) { sources.push({ input: name, newest: null, missing: true }); continue; }
    const tss = [];
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let obj;
      try { obj = JSON.parse(t); } catch (_e) { continue; }
      if (obj && obj.started_at) { signals.push({ ts: obj.started_at, what: `run:${obj.process || '?'}` }); tss.push(obj.started_at); }
    }
    sources.push({ input: name, newest: newestOf(tss) });
  }
  const relFile = cfg.releases_file ? resolvePath(cfg.releases_file, REPO_ROOT) : null;
  if (relFile) {
    const txt = readTextOrNull(relFile);
    if (txt === null) sources.push({ input: 'releases', newest: null, missing: true });
    else {
      const ids = txt.match(/\d{8}T\d{6}Z/g) || [];
      const tss = ids.map((r) =>
        `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}T${r.slice(9, 11)}:${r.slice(11, 13)}:${r.slice(13, 15)}Z`);
      for (const ts of tss) signals.push({ ts, what: 'release' });
      sources.push({ input: 'releases', newest: newestOf(tss) });
    }
  }
  return { signals: raw, sources };
}

/**
 * Дорогой вход S6: живые строки HEAD (blame по всем текстовым файлам) + добавленные строки
 * (log --numstat). Лифт analysis/scripts/churn-survival.cjs:25-82 — фильтры файлов те же.
 */
const CODE_RE = /\.(ts|tsx|js|jsx|cjs|mjs|css|scss|sql|prisma)$/i;   // churn-survival.cjs:25
const DOC_RE = /\.(md|mdx|yaml|yml|json)$/i;                          // churn-survival.cjs:26

function loadChurnCommits(repoDir, log) {
  if (!repoDir || !fs.existsSync(repoDir)) return null;
  const git = (args) => execFileSync('git', ['-C', repoDir, ...args],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  let files;
  try {
    files = git(['ls-files']).split('\n').map((s) => s.trim())
      .filter(Boolean).filter((f) => CODE_RE.test(f) || DOC_RE.test(f));
  } catch (_e) { return null; }

  const aliveByCommit = new Map();
  let done = 0;
  for (const f of files) {
    let out;
    try { out = git(['blame', '--line-porcelain', '-w', 'HEAD', '--', f]); } catch (_e) { continue; }
    for (const line of out.split('\n')) {
      const m = line.match(/^([0-9a-f]{40}) \d+ \d+/);
      if (!m) continue;
      aliveByCommit.set(m[1], (aliveByCommit.get(m[1]) || 0) + 1);
    }
    if (log && ++done % 200 === 0) log(`  S6 blame ${done}/${files.length}`);
  }

  let logOut;
  try { logOut = git(['log', '--no-merges', '--date=iso-strict', '--format=C|%H|%ad', '--numstat']); }
  catch (_e) { return null; }
  const commits = [];
  let cur = null;
  for (const line of logOut.split('\n')) {
    if (line.startsWith('C|')) {
      const [, sha, ad] = line.split('|');
      cur = { sha, ts: ad, added: 0, alive: aliveByCommit.get(sha) || 0 };
      commits.push(cur);
      continue;
    }
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m || !cur) continue;
    let p = m[3];
    if (p.includes('=>')) p = p.replace(/\{[^}]*=>\s*([^}]*)\}/, '$1').replace(/^.*=>\s*/, '').trim();
    if (!(CODE_RE.test(p) || DOC_RE.test(p))) continue;
    cur.added += m[1] === '-' ? 0 : Number(m[1]);
  }
  return commits.filter((c) => c.added > 0);
}

/** Прошлые точки S1 из history.ndjson (хронологически по generated_at). */
function readHistory(historyFile, sensorId) {
  const txt = readTextOrNull(historyFile);
  if (txt === null) return [];
  const pts = [];
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch (_e) { continue; }
    const sen = (obj.sensors || []).find((x) => x.id === sensorId);
    if (!sen) continue;
    pts.push({ label: obj.label, generated_at: obj.generated_at, value: sen.value });
  }
  return pts.sort((a, b) => String(a.generated_at).localeCompare(String(b.generated_at)));
}

/** Идемпотентный append по ключу `label|generated_at` (контракт как у run-ledger). */
function appendHistory(historyFile, record) {
  const key = `${record.label}|${record.generated_at}`;
  const txt = readTextOrNull(historyFile);
  if (txt !== null) {
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let obj;
      try { obj = JSON.parse(t); } catch (_e) { continue; }
      if (`${obj.label}|${obj.generated_at}` === key) return false;
    }
  }
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.appendFileSync(historyFile, JSON.stringify(record) + '\n', 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// Сборка панели
// ---------------------------------------------------------------------------

function selectedKeys(only, skip) {
  const all = Object.keys(SENSOR_IDS);
  const norm = (s) => String(s).trim().toUpperCase().split('_')[0];
  let keys = all;
  if (only && only.length) {
    const want = new Set(only.map(norm));
    keys = all.filter((k) => want.has(k));
  }
  if (skip && skip.length) {
    const drop = new Set(skip.map(norm));
    keys = keys.filter((k) => !drop.has(k));
  }
  return keys;
}

/**
 * Собрать отчёт. Часов внутри НЕТ: `atIso` пришёл аргументом (см. шапку, ДЕТЕРМИНИЗМ).
 * @returns {{report:Object, ioErrors:Array<string>}}
 */
function buildPanel(opts) {
  const cfg = opts.config;
  const atIso = opts.atIso;
  const fromMs = opts.fromIso ? parseTs(opts.fromIso) : null;
  const toMs = parseTs(opts.toIso || atIso);
  const maxDays = cfg.freshness_max_days || {};
  const keys = selectedKeys(opts.only, opts.skip);
  const active = new Set(keys);
  const dataset = cfg.dataset_dir ? resolvePath(cfg.dataset_dir, REPO_ROOT) : null;
  const log = opts.log || (() => {});

  const common = { atIso, fromMs, toMs, freshnessMaxDays: maxDays };
  const sensors = [];

  // Ленивая загрузка: дорогие входы читаются, только если их датчик активен.
  let tokens = null;
  if (active.has('S1') || active.has('S2')) {
    log('· читаю транскрипты (S1/S2)…');
    tokens = loadTranscriptSessions(cfg);
  }
  let defects = null;
  if (active.has('S3') || active.has('S4')) {
    defects = dataset ? loadCsvRows(path.join(dataset, 'defects.csv')) : null;
  }

  if (active.has('S1')) {
    const verdicts = dataset ? loadCsvRows(path.join(dataset, 'intents_verdicts.csv')) : null;
    sensors.push(computeS1(Object.assign({}, common, {
      sessions: tokens.sessions,
      sessionsError: tokens.error,
      verdicts,
      verdictsNewest: verdicts ? newestOf(verdicts.map((v) => v.ts)) : null,
      history: readHistory(path.join(opts.outDir, 'history.ndjson'), SENSOR_IDS.S1),
      label: opts.label,
    })));
  }
  if (active.has('S2')) {
    sensors.push(computeS2(Object.assign({}, common, { sessions: tokens.sessions, sessionsError: tokens.error })));
  }
  if (active.has('S3')) sensors.push(computeS3(Object.assign({}, common, { rows: defects })));
  if (active.has('S4')) sensors.push(computeS4(Object.assign({}, common, { rows: defects })));
  if (active.has('S5')) {
    const { signals, sources } = loadSignals(cfg);
    sensors.push(computeS5(Object.assign({}, common, {
      commits: loadPilotCommits(cfg.pilot_repo ? resolvePath(cfg.pilot_repo, REPO_ROOT) : null),
      signals,
      signalSources: sources.map((x) => ({ input: x.input, newest: x.newest })),
    })));
  }
  if (active.has('S6')) {
    log('· S6: blame по HEAD пилота (дорого)…');
    sensors.push(computeS6(Object.assign({}, common, {
      commits: loadChurnCommits(cfg.pilot_repo ? resolvePath(cfg.pilot_repo, REPO_ROOT) : null, log),
    })));
  }
  if (active.has('S7')) {
    sensors.push(computeS7(Object.assign({}, common, {
      rows: dataset ? loadCsvRows(path.join(dataset, 'spec_drift.csv')) : null,
    })));
  }
  if (active.has('S8')) {
    let anchorMod = null;
    try { anchorMod = require('./ledger-anchor-check.cjs'); } catch (_e) { anchorMod = null; }
    const logFile = cfg.assist_log ? resolvePath(cfg.assist_log, REPO_ROOT) : null;
    const raw = logFile ? readTextOrNull(logFile) : null;
    if (!anchorMod) {
      const s = baseSensor('S8', 'Claim-anchor rate', 'ratio', 'raw-logs');
      sensors.push(noData(s, 'ledger-anchor-check.cjs недоступен — якоря не распознать'));
    } else {
      sensors.push(computeS8(Object.assign({}, common, {
        entries: raw === null ? null : anchorMod.parseEntries(raw),
        gate: raw === null ? null : (() => {
          const g = anchorMod.checkLedgerAnchors(raw);
          return { gate_since: g.gate_since, entries_checked: g.entries_checked, violations: g.violations.length, passed: g.passed };
        })(),
        anchorsOf: claimAnchors,              // см. claimAnchors: почему не findAnchors
        anchorsWideOf: anchorMod.findAnchors, // сверочный счёт по словарю гейта
      })));
    }
  }

  const report = {
    schema_version: SENSORS_PANEL_SCHEMA_VERSION,
    generated_at: atIso,
    label: opts.label,
    window: { from: opts.fromIso || null, to: opts.toIso || atIso },
    sensors,
    // ОТСТУПЛЕНИЕ (объявлено): поле сверх контракта. Без него пропущенный по --skip датчик
    // неотличим от несуществующего, и отчёт молча врёт о полноте замера.
    skipped: Object.keys(SENSOR_IDS).filter((k) => !active.has(k)).map((k) => SENSOR_IDS[k]),
    history_appended: false,
  };
  return report;
}

// ---------------------------------------------------------------------------
// Рендер
// ---------------------------------------------------------------------------

function fmtValue(v, unit) {
  if (v === null || v === undefined) return '—';
  if (unit === 'days') return `${Number(v).toFixed(1)} дн.`;
  if (unit === 'tokens/intent') return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  return Number(v).toFixed(3);
}

function fmtThreshold(sensor) {
  const t = sensor.threshold;
  if (t.op === 'trend-up-2') return 'рост 2 прогона подряд';
  return `${t.op} ${fmtValue(t.value, sensor.unit)}`;
}

function fmtFreshness(sensor) {
  const fr = sensor.input_freshness || [];
  if (!fr.length) return '—';
  const bad = fr.filter((x) => !x.fresh);
  const oldest = fr.map((x) => x.newest).filter(Boolean).sort()[0] || '—';
  const head = String(oldest).slice(0, 10);
  const tail = fr.length > 1 ? ` (+${fr.length - 1})` : '';
  return (bad.length ? '⚠ ' : '') + head + tail;
}

const STATUS_MARK = { OK: '✅ OK', ALARM: '🔴 ALARM', 'NO-DATA': '⚪ NO-DATA', STALE: '🟡 STALE' };

function cell(s) {
  return String(s === null || s === undefined ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

function renderMarkdown(report) {
  const L = [];
  L.push('# Панель датчиков H0/H1');
  L.push('');
  L.push(`_label:_ **${report.label}** · _на момент:_ ${report.generated_at} · ` +
    `_окно:_ ${report.window.from || 'вся история'} … ${report.window.to} · ` +
    `_schema_ ${report.schema_version}`);
  L.push('');
  L.push('| № | датчик | значение | порог | статус | провенанс | свежесть | примечание |');
  L.push('|---|---|---|---|---|---|---|---|');
  report.sensors.forEach((s, i) => {
    const note = s.status === 'OK' ? '' : (s.reason || '');
    L.push(`| ${i + 1} | ${cell(s.title)} \`${cell(s.id)}\` | ${fmtValue(s.value, s.unit)} | ` +
      `${cell(fmtThreshold(s))} | ${STATUS_MARK[s.status] || s.status} | ${s.provenance} | ` +
      `${cell(fmtFreshness(s))} | ${cell(note).slice(0, 220)} |`);
  });
  L.push('');

  const bad = report.sensors.filter((s) => s.status !== 'OK');
  L.push('## Причины не-OK');
  L.push('');
  if (!bad.length) L.push('_нет — все замеренные датчики в норме._');
  for (const s of bad) {
    L.push(`- **${s.id}** — ${STATUS_MARK[s.status] || s.status}: ${s.reason || '(причина не заполнена — это баг)'}`);
  }
  L.push('');
  if (report.skipped && report.skipped.length) {
    L.push(`_Не замерялись (--only/--skip):_ ${report.skipped.join(', ')}.`);
    L.push('');
  }
  L.push(`_Пороги и их обоснование — \`dev/global-loop/analysis/REPORT.md §7.3\`. ` +
    `NO-DATA ≠ ноль: отсутствующий вход не превращается в благополучное значение._`);
  L.push('');
  return L.join('\n');
}

function historyRecord(report) {
  return {
    label: report.label,
    generated_at: report.generated_at,
    window: report.window,
    schema_version: report.schema_version,
    sensors: report.sensors.map((s) => ({ id: s.id, value: s.value, unit: s.unit, status: s.status, alarm: s.alarm })),
  };
}

// ---------------------------------------------------------------------------
// SELFTEST — инлайн-фикстуры, ни одного внешнего файла.
// ---------------------------------------------------------------------------

function selftest() {
  let n = 0;
  const fails = [];
  const ok = (cond, msg) => { n += 1; if (!cond) fails.push(msg); };
  const eq = (a, b, msg) => { n += 1; if (a !== b) fails.push(`${msg} — получено ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); };

  const AT = '2026-08-01T00:00:00Z';
  const base = { atIso: AT, fromMs: null, toMs: parseTs(AT), freshnessMaxDays: { defects: 14, intents_verdicts: 14, spec_drift: 14 } };

  // ---- утилиты
  eq(evalThreshold('>', 0.40, 0.40), false, 'порог: значение РАВНОЕ порогу (op >) не тревога');
  eq(evalThreshold('>', 0.401, 0.40), true, 'порог: значение выше порога (op >) — тревога');
  eq(evalThreshold('<', 0.80, 0.80), false, 'порог: значение РАВНОЕ порогу (op <) не тревога');
  eq(evalThreshold('<', 0.799, 0.80), true, 'порог: значение ниже порога (op <) — тревога');
  eq(parseTs('не указано'), null, 'parseTs: мусорная дата → null, не исключение');
  eq(median([1, 3, 2]), 2, 'median нечётной длины');
  eq(median([1, 2, 3, 4]), 2.5, 'median чётной длины');
  eq(parseCsv('a,b\n1,2\n').length, 1, 'parseCsv: одна строка данных');
  eq(parseCsv('a,b\n"x,y",2\n')[0].a, 'x,y', 'parseCsv: запятая внутри кавычек');

  // ---- S1: тренд
  const sess = [
    { layer: 'host', first_ts: '2026-07-20T10:00:00Z', output_tokens: 600 },
    { layer: 'executor', first_ts: '2026-07-20T11:00:00Z', output_tokens: 400 },
  ];
  const verd = [
    { ts: '2026-07-20T12:00:00Z', verdict: 'RESOLVED_1' },
    { ts: '2026-07-20T13:00:00Z', verdict: 'RESOLVED_N' },
    { ts: '2026-07-20T14:00:00Z', verdict: 'REOPENED' },
  ];
  const s1rise = computeS1(Object.assign({}, base, {
    sessions: sess, sessionsError: null, verdicts: verd, verdictsNewest: '2026-07-28',
    history: [{ label: 'r1', value: 100 }, { label: 'r2', value: 300 }], label: 'r3',
  }));
  eq(s1rise.value, 500, 'S1: 1000 токенов / 2 решённые интенции');
  eq(s1rise.alarm, true, 'S1: 100 → 300 → 500 = рост 2 прогона подряд → ALARM');
  eq(s1rise.status, 'ALARM', 'S1: статус ALARM при растущем тренде');
  ok(/рост 2 прогона/.test(s1rise.reason || ''), 'S1: причина называет тренд');
  eq(s1rise.detail.resolved_n, 2, 'S1 detail.resolved_n считает только RESOLVED_*');

  const s1flat = computeS1(Object.assign({}, base, {
    sessions: sess, sessionsError: null, verdicts: verd, verdictsNewest: '2026-07-28',
    history: [{ label: 'r1', value: 900 }, { label: 'r2', value: 300 }], label: 'r3',
  }));
  eq(s1flat.alarm, false, 'S1: 900 → 300 → 500 — не монотонный рост');
  eq(s1flat.status, 'OK', 'S1: статус OK без роста');

  const s1short = computeS1(Object.assign({}, base, {
    sessions: sess, sessionsError: null, verdicts: verd, verdictsNewest: '2026-07-28',
    history: [{ label: 'r1', value: 100 }], label: 'r2',
  }));
  eq(s1short.alarm, null, 'S1: <3 точек → alarm null');
  eq(s1short.status, 'NO-DATA', 'S1: <3 точек → статус NO-DATA');
  ok(/история <3 прогонов/.test(s1short.reason || ''), 'S1: причина про историю <3 прогонов');
  eq(s1short.value, 500, 'S1: при <3 точках значение СОХРАНЯЕТСЯ (объявленное отступление)');

  const s1dupLabel = computeS1(Object.assign({}, base, {
    sessions: sess, sessionsError: null, verdicts: verd, verdictsNewest: '2026-07-28',
    history: [{ label: 'r1', value: 100 }, { label: 'r1', value: 200 }], label: 'r2',
  }));
  eq(s1dupLabel.status, 'NO-DATA', 'S1: одинаковые label схлопываются — точек всё ещё 2');

  eq(computeS1(Object.assign({}, base, {
    sessions: null, sessionsError: 'transcript-usage module not found', verdicts: verd,
    verdictsNewest: '2026-07-28', history: [], label: 'x',
  })).status, 'NO-DATA', 'S1: нет модуля токенов → NO-DATA');
  ok(/transcript-usage module not found/.test(computeS1(Object.assign({}, base, {
    sessions: null, sessionsError: 'transcript-usage module not found', verdicts: verd,
    verdictsNewest: '2026-07-28', history: [], label: 'x',
  })).reason || ''), 'S1: причина называет отсутствующий модуль');
  const s1noVerd = computeS1(Object.assign({}, base, {
    sessions: sess, sessionsError: null, verdicts: [], verdictsNewest: null, history: [], label: 'x',
  }));
  eq(s1noVerd.status, 'NO-DATA', 'S1: нет вердиктов в окне → NO-DATA');
  eq(s1noVerd.value, null, 'S1: NO-DATA по входу → value null (не ноль)');
  ok(/судейство для окна не проведено/.test(s1noVerd.reason || ''), 'S1: причина про непроведённое судейство');

  // ---- S2: оверхед пульта
  const s2 = computeS2(Object.assign({}, base, { sessions: sess, sessionsError: null }));
  eq(s2.value, 1.5, 'S2: 600 host / 400 executor = 1.5');
  eq(s2.alarm, true, 'S2: 1.5 > 0.40 → ALARM');
  const s2edge = computeS2(Object.assign({}, base, {
    sessions: [
      { layer: 'host', first_ts: '2026-07-20T10:00:00Z', output_tokens: 400 },
      { layer: 'executor', first_ts: '2026-07-20T10:00:00Z', output_tokens: 1000 },
    ], sessionsError: null,
  }));
  eq(s2edge.value, 0.4, 'S2: 400/1000 = 0.400 ровно порог');
  eq(s2edge.status, 'OK', 'S2: значение РАВНОЕ порогу → OK, не ALARM');
  const s2noExec = computeS2(Object.assign({}, base, {
    sessions: [{ layer: 'host', first_ts: '2026-07-20T10:00:00Z', output_tokens: 400 }], sessionsError: null,
  }));
  eq(s2noExec.status, 'NO-DATA', 'S2: пустой слой executor → NO-DATA');
  ok(/executor/.test(s2noExec.reason || ''), 'S2: причина называет пустой слой');
  eq(computeS2(Object.assign({}, base, {
    sessions: [
      { layer: 'host', first_ts: '2026-06-01T10:00:00Z', output_tokens: 400 },
      { layer: 'executor', first_ts: '2026-07-20T10:00:00Z', output_tokens: 400 },
    ], sessionsError: null, fromMs: parseTs('2026-07-01T00:00:00Z'),
  })).status, 'NO-DATA', 'S2: окно отсекает сессии по first_ts');

  // ---- S3: доля дефектов без гейта
  const defRows = [
    { caught_when: '2026-07-25', gate_expected: 'нет такого гейта', caught_by: 'owner' },
    { caught_when: '2026-07-26', gate_expected: 'НЕТ ТАКОГО ГЕЙТА', caught_by: 'machine' },
    { caught_when: '2026-07-27', gate_expected: 'npm run verify', caught_by: 'machine' },
    { caught_when: '2026-07-28', gate_expected: 'process-gate', caught_by: 'assistant' },
    { caught_when: 'не указано', gate_expected: 'нет такого гейта', caught_by: 'owner' },
  ];
  const s3 = computeS3(Object.assign({}, base, { rows: defRows }));
  eq(s3.value, 0.5, 'S3: 2 из 4 датированных строк без гейта');
  eq(s3.alarm, true, 'S3: 0.5 > 0.40 → ALARM');
  eq(s3.detail.rows_undated, 1, 'S3: строка с «не указано» учтена как недатированная, а не как 0');
  eq(computeS3(Object.assign({}, base, { rows: null })).status, 'NO-DATA', 'S3: нет файла → NO-DATA');
  eq(computeS3(Object.assign({}, base, { rows: null })).value, null, 'S3: NO-DATA → value null');
  eq(computeS3(Object.assign({}, base, { rows: [], })).status, 'NO-DATA', 'S3: 0 строк → NO-DATA');
  const s3edge = computeS3(Object.assign({}, base, {
    rows: [
      { caught_when: '2026-07-25', gate_expected: 'нет такого гейта' },
      { caught_when: '2026-07-25', gate_expected: 'нет такого гейта' },
      { caught_when: '2026-07-25', gate_expected: 'verify' },
      { caught_when: '2026-07-25', gate_expected: 'verify' },
      { caught_when: '2026-07-25', gate_expected: 'verify' },
    ],
  }));
  eq(s3edge.value, 0.4, 'S3: 2/5 = 0.400 ровно порог');
  eq(s3edge.status, 'OK', 'S3: значение РАВНОЕ порогу → OK');
  // STALE: те же строки, но окно смотрит из далёкого будущего
  const s3stale = computeS3({
    rows: defRows, atIso: '2026-09-01T00:00:00Z', fromMs: null, toMs: parseTs('2026-09-01T00:00:00Z'),
    freshnessMaxDays: { defects: 14 },
  });
  eq(s3stale.status, 'STALE', 'S3: max(caught_when) старше 14 дней → STALE');
  eq(s3stale.value, 0.5, 'S3: STALE — значение всё равно печатается');
  ok(/вход устарел/.test(s3stale.reason || ''), 'S3: причина STALE называет устаревший вход');
  eq(s3stale.input_freshness[0].fresh, false, 'S3: input_freshness помечает вход несвежим');

  // ---- S4: defect-escape
  const s4 = computeS4(Object.assign({}, base, { rows: defRows }));
  eq(s4.value, 0.25, 'S4: 1 owner из 4 датированных');
  eq(s4.alarm, true, 'S4: 0.25 > 0.20 → ALARM');
  eq(s4.detail.by_caught_by.machine, 2, 'S4 detail: разбивка caught_by');
  const s4edge = computeS4(Object.assign({}, base, {
    rows: [
      { caught_when: '2026-07-25', caught_by: 'owner' },
      { caught_when: '2026-07-25', caught_by: 'machine' },
      { caught_when: '2026-07-25', caught_by: 'machine' },
      { caught_when: '2026-07-25', caught_by: 'machine' },
      { caught_when: '2026-07-25', caught_by: 'machine' },
    ],
  }));
  eq(s4edge.value, 0.2, 'S4: 1/5 = 0.200 ровно порог');
  eq(s4edge.status, 'OK', 'S4: значение РАВНОЕ порогу → OK');

  // ---- S5: покрытие сигналом
  const s5 = computeS5(Object.assign({}, base, {
    commits: [
      { sha: 'a', ts: '2026-07-20T10:00:00Z' },   // сигнал через 1 ч → покрыт
      { sha: 'b', ts: '2026-07-21T10:00:00Z' },   // ближайший сигнал через 48 ч → нет
      { sha: 'c', ts: '2026-07-31T23:00:00Z' },   // моложе 24 ч на --at → не оценивается
    ],
    signals: [{ ts: '2026-07-20T11:00:00Z', what: 'release' }, { ts: '2026-07-23T10:00:00Z', what: 'run:x' }],
    signalSources: [{ input: 'releases', newest: '2026-07-23T10:00:00Z' }],
  }));
  eq(s5.detail.not_yet_evaluable, 1, 'S5: коммит моложе 24 ч исключён из знаменателя');
  eq(s5.detail.evaluable, 2, 'S5: оцениваемых коммитов 2');
  eq(s5.value, 0.5, 'S5: покрыт 1 из 2');
  eq(s5.alarm, true, 'S5: 0.5 < 0.80 → ALARM');
  const s5edge = computeS5(Object.assign({}, base, {
    commits: [
      { sha: 'a', ts: '2026-07-20T10:00:00Z' }, { sha: 'b', ts: '2026-07-20T10:00:00Z' },
      { sha: 'c', ts: '2026-07-20T10:00:00Z' }, { sha: 'd', ts: '2026-07-20T10:00:00Z' },
      { sha: 'e', ts: '2026-07-25T10:00:00Z' },
    ],
    signals: [{ ts: '2026-07-20T11:00:00Z', what: 'release' }],
    signalSources: [],
  }));
  eq(s5edge.value, 0.8, 'S5: 4/5 = 0.800 ровно порог');
  eq(s5edge.status, 'OK', 'S5: значение РАВНОЕ порогу → OK');
  eq(computeS5(Object.assign({}, base, { commits: null, signals: [], signalSources: [] })).status, 'NO-DATA', 'S5: нет репо → NO-DATA');
  const s5nosig = computeS5(Object.assign({}, base, {
    commits: [{ sha: 'a', ts: '2026-07-20T10:00:00Z' }], signals: [], signalSources: [],
  }));
  eq(s5nosig.status, 'NO-DATA', 'S5: ни одного сигнала → NO-DATA, а не покрытие 0');
  eq(s5nosig.value, null, 'S5: отсутствие сигналов не фабрикуется в ноль');

  // ---- S6: self-churn
  const s6 = computeS6(Object.assign({}, base, {
    commits: [
      { sha: 'a', ts: '2026-07-01T00:00:00Z', added: 100, alive: 80 },  // старше 14 дней
      { sha: 'b', ts: '2026-07-02T00:00:00Z', added: 100, alive: 70 },  // старше 14 дней
      { sha: 'c', ts: '2026-07-30T00:00:00Z', added: 500, alive: 0 },   // моложе 14 дней — не в счёт
    ],
  }));
  eq(s6.detail.evaluable, 2, 'S6: только коммиты старше 14 дней оцениваются');
  eq(s6.value, 0.25, 'S6: 1 − 150/200 = 0.25');
  eq(s6.alarm, true, 'S6: 0.25 > 0.10 → ALARM');
  eq(s6.detail.method, 'head-approx (upper bound)', 'S6: метод объявлен верхней оценкой');
  const s6edge = computeS6(Object.assign({}, base, {
    commits: [{ sha: 'a', ts: '2026-07-01T00:00:00Z', added: 100, alive: 90 }],
  }));
  eq(s6edge.value, 0.1, 'S6: 1 − 90/100 = 0.100 ровно порог');
  eq(s6edge.status, 'OK', 'S6: значение РАВНОЕ порогу → OK');
  const s6young = computeS6(Object.assign({}, base, {
    commits: [{ sha: 'c', ts: '2026-07-30T00:00:00Z', added: 500, alive: 0 }],
  }));
  eq(s6young.status, 'NO-DATA', 'S6: все коммиты моложе 14 дней → NO-DATA');
  eq(s6young.value, null, 'S6: NO-DATA → value null');

  // ---- S7: spec-drift velocity
  const drift = [
    { artifact_last_update: '2026-07-25', drift_detected_at: '2026-07-20', drift_days: '16' },
    { artifact_last_update: '2026-07-26', drift_detected_at: '2026-07-21', drift_days: '10' },
    { artifact_last_update: '2026-07-27', drift_detected_at: '', drift_days: '0' },
  ];
  const s7 = computeS7(Object.assign({}, base, { rows: drift }));
  eq(s7.value, 13, 'S7: медиана (16, 10) = 13');
  eq(s7.alarm, true, 'S7: 13 < 14 → ALARM (медиана НИЖЕ порога = тревога)');
  eq(s7.detail.rows_with_drift, 2, 'S7: строки без drift_detected_at не считаются');
  const s7edge = computeS7(Object.assign({}, base, {
    rows: [
      { artifact_last_update: '2026-07-25', drift_detected_at: '2026-07-20', drift_days: '14' },
      { artifact_last_update: '2026-07-25', drift_detected_at: '2026-07-20', drift_days: '14' },
    ],
  }));
  eq(s7edge.value, 14, 'S7: медиана ровно 14');
  eq(s7edge.status, 'OK', 'S7: значение РАВНОЕ порогу → OK');
  eq(computeS7(Object.assign({}, base, { rows: null })).status, 'NO-DATA', 'S7: нет файла → NO-DATA');
  const s7stale = computeS7({
    rows: drift, atIso: '2026-09-01T00:00:00Z', fromMs: null, toMs: parseTs('2026-09-01T00:00:00Z'),
    freshnessMaxDays: { spec_drift: 14 },
  });
  eq(s7stale.status, 'STALE', 'S7: max(artifact_last_update) старше 14 дней → STALE');

  // ---- S8: claim-anchor rate. ЕДИНИЦА — CLAIM-СТРОКА, не запись (эталон M7: 109/283).
  // claimAnchors — правило якоря на уровне строки
  eq(claimAnchors('релиз 20260723T193232Z выкачен на стенд').join(','), 'release-id', 'claimAnchors: id релиза');
  eq(claimAnchors('фикс доведён коммитом 1a2b3c4 до конца').join(','), 'sha', 'claimAnchors: sha коммита');
  eq(claimAnchors('UJA PASS 7/7 на обновлённом журнее').join(','), 'count', 'claimAnchors: счёт N/N');
  eq(claimAnchors('закрыт DEC-DEV-0231 по всем пунктам').join(','), 'artifact-id', 'claimAnchors: id артефакта');
  eq(claimAnchors('всё построено, поверьте на слово').length, 0, 'claimAnchors: проза без якоря → пусто');
  eq(claimAnchors('дата 20260723 сама по себе якорем не является').includes('sha'), false,
    'claimAnchors: чистые цифры не считаются sha (нужны и буква, и цифра)');
  eq(claimAnchors('коммит 1a2b3c4 и коммит 9f8e7d6').filter((x) => x === 'sha').length, 1,
    'claimAnchors: /g-регекс не тащит lastIndex между вызовами');
  eq(claimAnchors('релиз 20260723T193232Z выкачен').join(','),
    claimAnchors('релиз 20260723T193232Z выкачен').join(','), 'claimAnchors: повторный вызов даёт то же (нет состояния)');

  // extractClaims — отсев по донору parse-ledger.cjs:89-96
  const oneEntry = {
    heading: 'RUN-Z.1 — 2026-07-25 12:00 — admin',
    body: [
      'релиз 20260723T193232Z выкачен на стенд и проверен',   // claim + якорь
      'фикс проверки прав доступа доведён до конца сегодня',   // claim, якоря нет
      'зафиксирован результат обхода в журнале этой сессии',   // claim, якоря нет
      'коротко',                                               // <25 символов — не claim
      '#### подзаголовок раздела с достаточной длиной строки',  // заголовок — не claim
      'погода за окном была сегодня довольно приятная штука',   // нет claim-маркера — не claim
    ].join('\n'),
  };
  const claims = extractClaims(oneEntry);
  eq(claims.length, 3, 'extractClaims: 3 claim-строки из 6 (отсев <25 / заголовок / без маркера)');
  ok(!claims.some((c) => c.startsWith('####')), 'extractClaims: заголовок отсеян');
  ok(!claims.some((c) => c === 'коротко'), 'extractClaims: строка короче 25 символов отсеяна');
  ok(!claims.some((c) => /погода/.test(c)), 'extractClaims: проза без claim-маркера отсеяна');
  eq(extractClaims({ heading: 'релиз 20260723T193232Z выкачен на стенд', body: '' }).length, 1,
    'extractClaims: заголовок записи тоже кандидат в claims (как у донора)');

  const s8 = computeS8(Object.assign({}, base, {
    entries: [{ date: '2026-07-25', heading: oneEntry.heading, body: oneEntry.body }],
    gate: null, anchorsOf: claimAnchors,
  }));
  eq(s8.detail.claims_total, 3, 'S8: 3 claim-строки в окне');
  eq(s8.detail.claims_anchored, 1, 'S8: якорь ровно у одной claim-строки');
  eq(s8.value, 0.333, 'S8: 1 из 3 claim-строк с якорем → 0.333');
  eq(s8.alarm, true, 'S8: 0.333 < 0.60 → ALARM');
  eq(s8.detail.entries_in_window, 1, 'S8 detail: записей в окне 1, claims 3 — гранулярности разведены');

  const mkClaim = (anchored) => (anchored
    ? 'фикс доведён коммитом 1a2b3c4 до самого конца'
    : 'фикс доведён до самого конца без всяких ссылок');
  const s8edge = computeS8(Object.assign({}, base, {
    entries: [{
      date: '2026-07-25', heading: 'запись без claim-маркеров вообще никаких',
      body: [mkClaim(1), mkClaim(1), mkClaim(1), mkClaim(0), mkClaim(0)].join('\n'),
    }],
    gate: null, anchorsOf: claimAnchors,
  }));
  eq(s8edge.detail.claims_total, 5, 'S8: 5 claim-строк для граничной пробы');
  eq(s8edge.value, 0.6, 'S8: 3/5 = 0.600 ровно порог');
  eq(s8edge.status, 'OK', 'S8: значение РАВНОЕ порогу → OK, не ALARM');

  const s8wide = computeS8(Object.assign({}, base, {
    entries: [{ date: '2026-07-25', heading: 'h', body: [mkClaim(1), mkClaim(0)].join('\n') }],
    gate: null, anchorsOf: claimAnchors, anchorsWideOf: () => ['artifact-id'],
  }));
  eq(s8wide.detail.claims_anchored_wide, 2, 'S8: сверочная разметка считается отдельно, значение не меняет');
  eq(s8wide.value, 0.5, 'S8: значение берётся из anchorsOf, не из сверочной разметки');

  const s8win = computeS8(Object.assign({}, base, {
    entries: [{ date: '2026-07-25', heading: oneEntry.heading, body: oneEntry.body }],
    gate: null, anchorsOf: claimAnchors, fromMs: parseTs('2026-08-01T00:00:00Z'),
  }));
  eq(s8win.status, 'NO-DATA', 'S8: 0 записей в окне → NO-DATA');
  eq(s8win.value, null, 'S8: пустое окно не фабрикуется в 0');
  const s8noclaims = computeS8(Object.assign({}, base, {
    entries: [{ date: '2026-07-25', heading: 'просто заголовок', body: 'проза без единой заявки о сделанном' }],
    gate: null, anchorsOf: claimAnchors,
  }));
  eq(s8noclaims.status, 'NO-DATA', 'S8: записи есть, а claim-строк нет → NO-DATA (отдельная причина)');
  ok(/нет ни одной claim-строки/.test(s8noclaims.reason || ''), 'S8: причина различает «нет записей» и «нет claims»');
  eq(computeS8(Object.assign({}, base, { entries: null, gate: null, anchorsOf: claimAnchors })).status,
    'NO-DATA', 'S8: журнал не прочитан → NO-DATA');

  // сосед всё ещё нужен — parseEntries и вердикт гейта
  let anchorMod = null;
  try { anchorMod = require('./ledger-anchor-check.cjs'); } catch (_e) { anchorMod = null; }
  ok(anchorMod !== null, 'S8: сосед ledger-anchor-check.cjs подгружается (parseEntries + гейт)');
  if (anchorMod) {
    const parsed = anchorMod.parseEntries([
      '### RUN-Z.1 — 2026-07-25 12:00 — admin', oneEntry.body, '',
    ].join('\n'));
    eq(parsed.length, 1, 'S8: parseEntries соседа режет журнал на записи');
    eq(extractClaims(parsed[0]).length, 3, 'S8: extractClaims работает на выходе parseEntries as-is');
  }

  // ---- выбор датчиков и рендер
  eq(selectedKeys(['S1', 'S2'], null).join(','), 'S1,S2', '--only оставляет только названные');
  eq(selectedKeys(null, ['S6']).includes('S6'), false, '--skip убирает названный датчик');
  eq(selectedKeys(['S6_self_churn_14d'], null).join(','), 'S6', '--only понимает полный id датчика');
  eq(selectedKeys(null, null).length, 8, 'по умолчанию активны все 8 датчиков');

  const fakeReport = {
    schema_version: 1, generated_at: AT, label: 't', window: { from: null, to: AT },
    sensors: [s2, s3stale, s5nosig], skipped: [SENSOR_IDS.S6], history_appended: false,
  };
  const md = renderMarkdown(fakeReport);
  ok(/\| № \| датчик \| значение \| порог \| статус \| провенанс \| свежесть \| примечание \|/.test(md),
    'рендер: шапка таблицы по контракту');
  ok(/## Причины не-OK/.test(md), 'рендер: блок причин не-OK присутствует');
  ok(md.split('\n').filter((l) => l.startsWith('| ') && /S\d_/.test(l)).length === 3, 'рендер: строка на каждый датчик');
  ok(/S6_self_churn_14d/.test(md), 'рендер: пропущенные датчики названы явно');

  // ---- панель целиком на пустом конфиге: всё NO-DATA, но не крэш
  const emptyCfg = { schema_version: 1, transcript_roots: [], run_ledgers: [], releases_file: null, dataset_dir: null, assist_log: null, freshness_max_days: {} };
  const rep = buildPanel({ config: emptyCfg, atIso: AT, fromIso: null, toIso: null, label: 'empty', outDir: path.join(__dirname, '__nonexistent__'), only: null, skip: ['S6'] });
  eq(rep.sensors.length, 7, 'пустой конфиг: 7 датчиков собраны (S6 пропущен)');
  eq(rep.sensors.every((s) => s.status === 'NO-DATA'), true, 'пустой конфиг: всё NO-DATA');
  eq(rep.sensors.every((s) => s.reason), true, 'пустой конфиг: у каждого NO-DATA есть причина');
  eq(rep.sensors.every((s) => s.value === null), true, 'пустой конфиг: ни одного сфабрикованного значения');
  eq(rep.sensors.some((s) => s.alarm === true), false, 'пустой конфиг: ни одной тревоги → exit 0');
  ok(JSON.parse(JSON.stringify(rep)).sensors.length === 7, 'отчёт сериализуется в JSON без потерь');

  if (fails.length) {
    console.error(`sensors-panel --selftest: ✗ ПРОВАЛ — ${fails.length} из ${n} assert(ов):`);
    for (const f of fails) console.error(`  - ${f}`);
    return 1;
  }
  console.log(`sensors-panel --selftest: ✓ пройден — ${n} assert(ов) (8 датчиков · границы порогов · NO-DATA/STALE · тренд S1 · рендер · панель на пустом конфиге)`);
  return 0;
}

// ---------------------------------------------------------------------------
// CLI — ЕДИНСТВЕННОЕ место, где читаются часы и process.argv
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`sensors-panel.cjs — панель 8 датчиков H0/H1 (пороги: dev/global-loop/analysis/REPORT.md §7.3)

Usage:
  node dev/global-loop/scripts/sensors-panel.cjs run
    [--at <ISO>]            момент замера (default: сейчас — единственное чтение часов)
    [--label <id>]          метка прогона (default: adhoc); ключ идемпотентности истории
    [--from <ISO>] [--to <ISO>]   окно (default: вся история … --at)
    [--config <path>]       default dev/global-loop/panel/panel-config.json
    [--only S1,S2]          считать только названные датчики
    [--skip S6]             пропустить названные (S6 дорогой: blame по всему HEAD пилота)
    [--json]                чистый JSON в stdout вместо markdown
    [--out <dir>]           куда писать panel-<label>.json / PANEL.md / history.ndjson
                            (default dev/global-loop/panel)
    [--no-history]          не дописывать history.ndjson
    [--strict]              exit 1 также при NO-DATA / STALE
  node dev/global-loop/scripts/sensors-panel.cjs --selftest

Датчики: S1 цена решённой интенции · S2 оверхед пульта · S3 дефекты без гейта ·
S4 defect-escape · S5 покрытие сигналом 24 ч · S6 self-churn · S7 spec-drift velocity ·
S8 claim-anchor rate.

Exit: 0 нет тревог · 1 есть ALARM (со --strict — и NO-DATA/STALE) · 2 конфиг/IO-авария.
`);
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { a._.push(t); continue; }
    const key = t.slice(2);
    if (['json', 'no-history', 'strict', 'selftest', 'help'].includes(key)) { a[key] = true; continue; }
    a[key] = argv[++i];
  }
  return a;
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.help || argv.includes('-h')) { printHelp(); process.exit(0); }
  if (args.selftest) { process.exit(selftest()); }
  if (args._.length && args._[0] !== 'run') {
    console.error(`ERROR: неизвестная команда «${args._[0]}» (ожидалась «run» или --selftest)`);
    process.exit(2);
  }

  // ЕДИНСТВЕННОЕ чтение часов во всём файле.
  const atIso = args.at || new Date().toISOString();
  if (parseTs(atIso) === null) { console.error(`ERROR: --at не парсится как дата: ${atIso}`); process.exit(2); }
  for (const k of ['from', 'to']) {
    if (args[k] && parseTs(args[k]) === null) { console.error(`ERROR: --${k} не парсится как дата: ${args[k]}`); process.exit(2); }
  }

  const configPath = args.config ? resolvePath(args.config, process.cwd()) : DEFAULT_CONFIG;
  let cfg;
  try { cfg = loadConfig(configPath); }
  catch (e) { console.error(`ERROR: конфиг не прочитан (${configPath}): ${e.message}`); process.exit(2); }

  const outDir = args.out ? resolvePath(args.out, process.cwd()) : DEFAULT_OUT_DIR;
  const label = args.label || 'adhoc';
  const quiet = !!args.json;
  const log = (m) => { if (!quiet) console.error(m); };

  let report;
  try {
    report = buildPanel({
      config: cfg, atIso, fromIso: args.from || null, toIso: args.to || null, label, outDir,
      only: args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null,
      skip: args.skip ? String(args.skip).split(',').map((s) => s.trim()).filter(Boolean) : null,
      log,
    });
  } catch (e) {
    console.error(`ERROR: панель не собралась: ${e.stack || e.message}`);
    process.exit(2);
  }

  try {
    fs.mkdirSync(outDir, { recursive: true });
    if (!args['no-history']) {
      report.history_appended = appendHistory(path.join(outDir, 'history.ndjson'), historyRecord(report));
    }
    const safeLabel = String(label).replace(/[^A-Za-z0-9._-]+/g, '-');
    fs.writeFileSync(path.join(outDir, `panel-${safeLabel}.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, 'PANEL.md'), renderMarkdown(report), 'utf8');
  } catch (e) {
    console.error(`ERROR: выходные файлы не записаны (${outDir}): ${e.message}`);
    process.exit(2);
  }

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderMarkdown(report));

  const hasAlarm = report.sensors.some((s) => s.alarm === true);
  const hasGap = report.sensors.some((s) => s.status === 'NO-DATA' || s.status === 'STALE');
  process.exit(hasAlarm || (args.strict && hasGap) ? 1 : 0);
}

if (require.main === module) main();

module.exports = {
  SENSORS_PANEL_SCHEMA_VERSION,
  THRESHOLDS,
  SENSOR_IDS,
  // чистые утилиты
  parseCsv, parseTs, inWindow, median, newestOf, expandHome, resolvePath,
  evalThreshold, buildFreshness, selectedKeys,
  // разметка утверждений журнала (S8)
  CLAIM_MARKERS, claimAnchors, extractClaims,
  // чистые датчики
  computeS1, computeS2, computeS3, computeS4, computeS5, computeS6, computeS7, computeS8,
  // сборка и рендер
  buildPanel, renderMarkdown, historyRecord, appendHistory, readHistory,
  // загрузчики (IO)
  loadConfig, loadTranscriptSessions, loadCsvRows, loadPilotCommits, loadSignals, loadChurnCommits,
  selftest,
};
