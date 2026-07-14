# F1+F2 — контракт autonomy-policy резолвера (Epic F)

> **Статус:** **F1 + F2 построены.** F1 (skeleton — L0/L1 + resolver + precedence + audit-trail,
> DEC-DEV-0152) + первый wiring (Process Fabric прогоняет disposition каждой prescription через
> `resolve()`, DEC-DEV-0153/0154). **F2 (DEC-DEV-0193):** L2/L3 больше не деградируют — на
> staging/prod они эмитят `consilium-gate` (жюри Epic D + порог τ + human-fallback, `applyConsiliumVerdict`);
> `applyReadinessGuard`/`resolve` обрели живых caller'ов в P5/P6 (result-файл несёт авторитетную
> диспозицию); `parseAutonomyConfig`/`loadAutonomyPolicy` читают блок `autonomy:` из `.claude/product.yaml`
> (профили default=L1 / autonomous=L3); floor остался залочен. **Либа:**
> [`orchestrator/lib/autonomy-policy.cjs`](../orchestrator/lib/autonomy-policy.cjs) (pure fn + CLI-seam
> `resolve`/`resolve-consilium`; юниты `tests/orchestrator/autonomy-policy.test.cjs`; дом — рядом с
> потребителем, см. §6 п.4). **Vision-SSOT:** `dev/ECOSYSTEM_VISION.md` §Epic F (enum L0-L3, floor,
> precedence, профили — locked владельцем 2026-06-23).

## 1. Сигнатура и объём F1

```
resolve(operation_class, risk_tier, env_tier, policy, override)
  → { disposition ∈ {auto | consilium-gate | human-gate | block}, level_applied, floor_hit, why[] }
```

- **F1+F2 реализуют L0-L3.** L0/L1 — бит-в-бит как раньше. **L2/L3 больше НЕ деградируют** (F2,
  DEC-DEV-0193): на dev ведут себя как L1 (auto), на staging/prod эмитят `consilium-gate` (жюри Epic D
  + порог + human-fallback). **L3 ≡ L2** в матрице до F3 (prod-сегмент, Epic E) — с громкой why-нотой.
  `consilium-gate` эмитится **только** на non-floor L2/L3 × staging/prod.
- **`why[]` — replayable-цепочка** (какая ступень precedence сработала, какие инпуты
  скорректированы): семя audit-trail; на fabric-уровне персистится в `events.ndjson` (DEC-DEV-0154).
- Pure: same inputs → same disposition (юнит deepStrictEqual).

## 2. Потребляемые контракты (не пере-выводить — жёсткий констрейнт волны #3)

| Вход | Producer (SSOT) | Домен | Absent/foreign → |
|---|---|---|---|
| `risk_tier` | `orchestrator/lib/gate-risk-classifier.cjs` → `classifyTask().tier` | `HIGH \| LOW` | консервативно `HIGH` + why |
| substrate readiness | `orchestrator/lib/env-readiness.cjs` → `readiness` | `READY \| DEGRADED \| ENV_NOT_READY` | консервативно `DEGRADED` + why |
| `env_tier` | вызывающий процесс (target-среда операции; ось orchestrator §7 env_tiers) | `dev \| staging \| prod` | консервативно `prod` + why |
| `contract_status` (DEC-DEV-0201) | CNT `contract.status` capability (Integrator, `skills/integrator/deployment-provisioning.md`) | `active \| draft` | **absent → no-op** (байт-в-байт прежнее поведение); неизвестное → консервативно `draft` + why |

Резолвер **не** инспектирует текст задач, маркеры M1-M3, профили или substrate — это
переизобрело бы producer-логику и дало бы два расходящихся gate-policy механизма.

### Два guard'а — два РАЗНЫХ вопроса (не смешивать: смешение = дедлок)

| Guard | Вопрос | Домен | Эффект |
|---|---|---|---|
| **`applyReadinessGuard(envelope, readiness)`** | **МОЖЕМ ли вообще?** (субстрат поднят? оснастка на месте и исполнима?) | `READY` / `DEGRADED` / `ENV_NOT_READY` | `READY` — без изменений; `DEGRADED` — `auto → human-gate`; `ENV_NOT_READY` — **`block`** (гейт не смог судить) |
| **`applyContractGuard(envelope, contract_status, {acceptDraft})`** | **КТО решает?** (верифицировал ли хоть один живой прогон этот контракт capability?) | `active` / `draft` | `active` — без изменений; `draft` — `auto → human-gate` (**НЕ block**); `draft` + `acceptDraft` (явная санкция владельца) — без изменений |

Оба **только даунгрейдят** — ни один не может поднять диспозицию и ни один не трогает floor
(floor early-return'ится в `resolve()` **до** любого guard'а: floor-класс остаётся `human-gate` +
`floor_hit: true` при любых флагах, включая `--accept-draft-contract`).

**Почему `draft` — это gate, а не block (урок DEC-DEV-0201, живой прогон E.B).** Раньше `draft`
читался как факт **готовности** («деплой не удалось подготовить» → `ENV_NOT_READY` → `BLOCKED`).
Это категориальная ошибка, и она **дедлочила первый деплой в принципе**: E.A **обязан** отдать CNT
`draft` (не вправе объявить `active` до живой верификации) → E.B отказывался деплоить не-`active` →
а живая верификация возможна **только через деплой**. Замкнутый круг, из которого нет выхода.
**Отсутствующая capability — это block. Отсутствующий человек — это gate.** Блок на оси доверия
недостижим по построению: единственное, что могло бы его снять (живой прогон), он же и запрещает.

`--accept-draft-contract` — **явный акт человека**: владелец санкционирует первый деплой по
непроверенному контракту. Без этого акта `auto` по `draft` не бывает; с ним — guard не понижает
(но и не повышает: floor как стоял, так и стоит).

## 3. Precedence (vision, дословно) и floor

```
floor (non-crossable) > per-invocation override (--autonomy=…)
  > per-process pin (policy.process_overrides — ТОЛЬКО потолок, никогда не поднимает)
  > project default_level > ecosystem built-in (L1)
```

- **Floor** = `{prod_deploy, destructive, spend_money, provision_real_secret}` → всегда
  `human-gate`, `floor_hit: true`, проверяется ДО всего.
- **F1 hard rail — floor LOCKED:** `policy.floor` в обычном конфиге игнорируется (с why).
  Сужение floor — отдельный явный opt-in механизм (дизайн F2+), он не должен приехать
  обычным конфиг-ключом.
- **Pin — потолок:** `process_overrides: {deploy-to-stage: L0}` капит L1/L3-сессию до L0
  для этого процесса; pin никогда не повышает.

## 4. Матрица диспозиций F1 (L0/L1)

| | dev | staging | prod |
|---|---|---|---|
| **L0** | `auto` iff `LOW`; `HIGH → human-gate` | human-gate | human-gate |
| **L1** *(дефолт)* | `auto` (LOW и HIGH — необратимость несут floor-классы) | human-gate | human-gate |

Рационал строк: L0 = «человек на всех 🟠+🔴, auto только 🟢» — на входной оси классификатора
🟢-аналог = `LOW × dev`. L1 = «человек на необратимом/staging+; auto на обратимом/dev» —
необратимые operation-классы уже отсечены floor'ом, поэтому non-floor dev-операция = обратимый
случай. staging+ human-гейтится на обоих уровнях: в F1 нет консилиума, которым vision закрывает
эти клетки на L2/L3.

## 5. Config-слот — **ПОСТРОЕН** (F2, DEC-DEV-0193)

```yaml
autonomy:                      # .claude/product.yaml — absent == L1 1:1 (прецедент product_class)
  profile: autonomous          # именованный профиль: default=L1 | autonomous=L3 (Vision Locked)
  default_level: L2            # явный уровень ПЕРЕКРЫВАЕТ профиль (with a why-note)
  process_overrides: { deploy-to-stage: L0 }   # пин = потолок, никогда не поднимает
  consilium_gate: { confidence_threshold: 0.8, panel: architecture }   # τ + состав жюри
  # floor: — ИГНОРИРУЕТСЯ ГРОМКО (FLOOR_LOCKED): сужение floor — отдельный явный opt-in, не обычный ключ
```

`parseAutonomyConfig(yamlText)` (line-state-machine, БЕЗ js-yaml — прецедент `agent-roster.cjs`)
парсит блок в plain-объект `policy`; `loadAutonomyPolicy(root)` читает `<root>/.claude/product.yaml`
(нет файла → `{}`, absent == L1 1:1). Инвалидные уровни / мусор — tolerant-ignore с why; `floor:` —
громкий ignore; inline `{...}` и block-форма обе поддержаны. **SSOT приоритета:** product.yaml =
проектный дефолт, `fabric/limits.json → policy` = fabric-локальный override (`shellEnv` мержит
`Object.assign({}, product, fabric)`).

## 6. Сверка с оркестратор-треком (checklist перед F2-wiring) — ЗАКРЫТ DEC-DEV-0154

- [x] `classifyTask().tier` — enum `HIGH/LOW` стабилен; **fabric-уровень risk НЕ берёт runtime-classifyTask**:
      charter-автор задаёт `meta.risk` per-state (absent → консервативно `HIGH`); per-task
      classifyTask остаётся внутри P5 (два уровня не смешиваются — конверт vs шаг).
- [x] `env-readiness` probe: на fabric-уровне readiness входит **событиями** charter-ingest
      (`evt:runtime.env_not_ready` и т.п., из полей результатов), НЕ disposition-guard'ом;
      `applyReadinessGuard` остаётся для будущих гейтов-потребителей уровня процесса.
- [x] Ось `env_tier`: `fabric/limits.json → env_tier` (дефолт `dev`), маппинг на orchestrator §7;
      floor-классы (`prod_deploy`, `provision_real_secret`) держат human-gate независимо от env_tier.
- [x] Дом либы: **`orchestrator/lib/` рядом с потребителем** (DEC-DEV-0154). Repo-`lib/` не имел
      деплой-маппинга (bootstrap bulk-copy — да, но `/ecosystem:update` синкает только
      orchestrator `{processes,lib,charters}` namespaces) — require из fabric-engine ломался бы
      в user-проекте после первого update.
- [x] Audit-trail: transition-level `why[]` (включая guard-цепочку) персистится в
      `fabric/<instance>/events.ndjson`; prescription-`why[]` детерминированно перевычислим из
      state+charter (не дублируется на диск).
- [x] `--autonomy=` флаг: есть на `/orchestrator:run` (frontmatter) и на fabric CLI
      (`init|ingest|tick --autonomy <L0|L1|L2|L3>` → per-invocation `override` в `resolve()`);
      floor непробиваем (юнит). Продуктовые макро-команды (Epic C) — при их F2-wiring.

## 7. F2 wiring (DEC-DEV-0193)

- **Consilium-gate семантика.** L2/L3 × staging/prod → `consilium-gate`. Диспетчер (`run.md`)
  актуирует: собирает жюри Epic D (`skills/orchestrator/architecture-consilium.md`, subject =
  предписанный процесс + контекст линии) → `consilium-synth.cjs` → **fold** через
  `applyConsiliumVerdict(envelope, synth, gateCfg)`. **Единственное LLM-суждение** — содержание
  вердикта жюри; решение о диспозиции — код.
- **Confidence-мэппинг (детерминированный):** `strength` жюри → confidence: `strong→1.0`, `split→0.5`,
  `none→0.0`, мусор→`0.0` (`confidenceFromSynth`). `confidence ≥ τ` И `recommended != null` → `auto`;
  иначе → **`human-gate`** (safe-fallback: слабый/расходящийся вердикт = человек, не слепой auto).
  `τ` = `policy.consilium_gate.confidence_threshold` или дефолт **0.8**.
- **CLI-seam** (для диспетчера + тестов): `node autonomy-policy.cjs resolve-consilium --envelope-file …
  --synth-file … [--threshold τ]` и `node autonomy-policy.cjs resolve --operation-class … --risk … [--env-tier …]
  [--policy …] [--override …] [--readiness …]` (P5/P6 live-caller seam).
- **Врезки P5/P6 (аддитивные).** `feature-to-tdd-impl` (P5) и `validate-feature-impl` (P6) кладут в
  result-файл поле `autonomy` = `applyReadinessGuard(resolve(<op>, riskTier, envTier, policy, override), readiness)`.
  Harness `.mjs` **не может** `require()` либу (DEC-DEV-0073 §D.1) → диспозиция вычисляется через
  `node <lib> resolve`-seam внутри agent()-промпта (тот же relay-паттерн, что env-readiness/capability-probe).
  riskTier — консервативное честное правило (чистый GO без конфликтов = LOW, иначе HIGH).
- **Границы скоупа (сознательно НЕ на этом контуре):** Integrator **approve-gate** (`/integrator:debug`
  y/n) и **DA per-finding review** захардкожены на человека как анти-sycophancy рельса — F2 их не
  трогает. **Floor залочен** (`FLOOR_LOCKED`): `prod_deploy` / `destructive` / `spend_money` /
  `provision_real_secret` → всегда human-gate + floor_hit ПЕРВЫМ приоритетом, `consilium-gate` на floor
  не эмитится никогда. Live-грейд L2/L3-петли — **pilot-gated** (жюри работает, сквозной dogfood не прогонялся).
