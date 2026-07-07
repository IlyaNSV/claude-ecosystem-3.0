# F1 — контракт autonomy-policy резолвера (Epic F, skeleton-фаза)

> **Статус:** contract-спека + **первый wiring** (Process Fabric: fabric-engine прогоняет
> disposition каждой prescription через `resolve()`, DEC-DEV-0153; сверка §6 закрыта
> DEC-DEV-0154). **Либа:** [`orchestrator/lib/autonomy-policy.cjs`](../orchestrator/lib/autonomy-policy.cjs)
> (pure fn, юниты `tests/orchestrator/autonomy-policy.test.cjs`; дом — рядом с потребителем,
> см. §6 п.4). **Vision-SSOT:** `dev/ECOSYSTEM_VISION.md`
> §Epic F (enum L0-L3, floor, precedence — locked владельцем 2026-06-23). Построен DEC-DEV-0152.

## 1. Сигнатура и объём F1

```
resolve(operation_class, risk_tier, env_tier, policy, override)
  → { disposition ∈ {auto | human-gate | block}, level_applied, floor_hit, why[] }
```

- **F1 реализует L0/L1.** Запрошенный L2/L3 деградирует к L1-семантике с громкой why-записью
  (safe-fallback: несуществующий уровень не может тихо означать «больше auto»). `consilium-gate`
  есть в vision-enum, но F1 его **не эмитит никогда** — эмитить диспозицию, которую нечем
  исполнить, значит создать тихий провал (консилиум-гейт = F2).
- **`why[]` — replayable-цепочка** (какая ступень precedence сработала, какие инпуты
  скорректированы): это семя audit-trail; персистенция трейла = wiring (F2).
- Pure: same inputs → same disposition (юнит deepStrictEqual).

## 2. Потребляемые контракты (не пере-выводить — жёсткий констрейнт волны #3)

| Вход | Producer (SSOT) | Домен | Absent/foreign → |
|---|---|---|---|
| `risk_tier` | `orchestrator/lib/gate-risk-classifier.cjs` → `classifyTask().tier` | `HIGH \| LOW` | консервативно `HIGH` + why |
| substrate readiness | `orchestrator/lib/env-readiness.cjs` → `readiness` | `READY \| DEGRADED \| ENV_NOT_READY` | консервативно `DEGRADED` + why |
| `env_tier` | вызывающий процесс (target-среда операции; ось orchestrator §7 env_tiers) | `dev \| staging \| prod` | консервативно `prod` + why |

Резолвер **не** инспектирует текст задач, маркеры M1-M3, профили или substrate — это
переизобрело бы producer-логику и дало бы два расходящихся gate-policy механизма.
Readiness потребляется отдельной чистой функцией **`applyReadinessGuard(envelope, readiness)`**,
которая (зеркало собственного рельса env-readiness) **только даунгрейдит**: `READY` — без
изменений; `DEGRADED` — `auto → human-gate`; `ENV_NOT_READY` — `block` (гейт не смог судить —
и auto, и human-gate притворились бы, что смог).

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

## 5. Config-слот (wiring = F2, здесь только форма)

```yaml
autonomy:                      # .claude/product.yaml — absent == L1 1:1 (прецедент product_class)
  default_level: L1
  process_overrides: { deploy-to-stage: L0 }
  # floor / consilium_gate — F2 (floor в F1 залочен built-in'ом)
```

Skeleton принимает этот срез как plain-объект `policy` (парс/валидация YAML — wiring-фаза).

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
      (`init|ingest|tick --autonomy <L0|L1>` → per-invocation `override` в `resolve()`);
      floor непробиваем (юнит). Продуктовые макро-команды (Epic C) — при их F2-wiring.
