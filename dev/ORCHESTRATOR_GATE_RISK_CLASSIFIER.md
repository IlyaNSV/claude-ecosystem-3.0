# Orchestrator `gate-risk-classifier` — design (P0-2)

> **Статус:** `design draft` (2026-06-14, DEC-DEV-0068 follow-up #2 / RUN 01 finding **P0-2**). **Не** wired — это регламент для процесса **P5 `feature-to-tdd-impl`** (зона E4/D3), которая по рекомендации **OD10** отложена за пределы первого инкремента (E2-only). Проектируется сейчас, потому что это P0-находка прогона; материализуется в `skills/orchestrator/gate-risk-classifier.md` + предикат при сборке P5 (шаг S5).
> **Что решает:** самое частое **недокодифицированное человеческое суждение** прогона — «нужен ли независимый adversarial-reviewer для этой задачи, или хватит inline-verify». В RUN 01 главный агент квалифицировал «несущесть» глазом на каждой из ~26 итераций (#1342, #1592, #1644, #1799, #1847). Цель — заменить этот глаз **детерминированным предикатом**.
> **Грунтовка:** рубрика выведена из фактических gate-решений прогона (out-dim-2 §B.5/§B.6), не из головы. Валидация — §6.
> **Связь:** SPEC §2 (слой-3 гейт), §3.2 (P5), VC-3/VC-4 (out-dim-2 §D). Реестр инвариантов — §5.

---

## 1. Зачем (gap из RUN 01)

Слой-3 (verification-гейт) прогона имел **две формы**:
- **independent adversarial-reviewer** (RA-7, отдельный субагент, «Do Not Trust the Report») — дорого, но поймал единственный REJECT прогона (4.6 timing-oracle, #1434: self-report «всё ок», reviewer нашёл security-дефект);
- **inline-verify** (скелет сам: fresh test-run + boundary + property-check) — дёшево.

Выбор между ними принимался **человеческим суждением** каждую итерацию. Это и есть `[ROUTER]`-gap VC-3: суждение «несущая ли задача» кодируемо в правило; сам reviewer (слой 3) — неустраним, но **выбор тяжести гейта** — нет.

«Всё inline» → риск пропустить timing-oracle класса 4.6. «Всё adversarial» → дорого (×2 субагента на каждую из 26 задач). Классификатор — недостающее звено между ними.

---

## 2. Контракт классификатора

```
gate-risk-classifier(task) → { tier: HIGH | LOW, profile: <verify-profile>, why: [markers], confidence }
```

**Вход** (всё машинно-читаемо из tasks.md + spec, без суждения):
- `task._Requirements_` — список AC (`12.4`, `5.2`, …) → резолвятся в текст requirements.md;
- `task._Boundary_` — заявленная зона записи (`apps/api/src/modules/auth`, `packages/db`, …);
- `task._Depends_`;
- `task` заголовок/описание + `## Implementation Notes` (forward-deps);
- **load-bearing invariant registry** (§5) — какие IC-*/BR- несущие;
- `pmo-mapping.yaml` — owner зоны (для cross-FM детекции).

**Выход:**
- `tier=HIGH` → обязательный **independent adversarial-reviewer** (RA-7);
- `tier=LOW` → **inline-verify** скелетом по `profile` (§7);
- `why` — какие маркеры сработали (для аудита/объяснимости);
- `confidence` — `high` (явный маркер) / `low` (эвристика) → low эскалирует к дефолту (§8).

---

## 3. Предикат (детерминированный)

```
HIGH-tier  ⟺  задача ВНОСИТ/МЕНЯЕТ ИМПЕРАТИВНУЮ логику, несущую хотя бы один маркер:

  M1 security-AC      : anti-enumeration | constant-time / timing-parity | default-deny /
                        fails-closed | CSRF / state-verify | open-redirect / safe-redirect |
                        token/secret handling (issue/consume/rotate)
  M2 concurrency/idem : FOR UPDATE row-lock ordering | atomic multi-step transaction |
                        LRU / eviction | idempotent domain signal | webhook / outbox dedup
  M3 shared primitive : меняет общий мутируемый примитив, используемый cross-task
                        (consume(), invalidateAllForUser(), session create, …)
  M4 cross-FM seam    : _Boundary_ или контракт выходит за owned-зону (pmo-mapping owner ≠ this FM)

LOW-tier  ⟺  ничего из M1–M4, и задача попадает в один из профилей §7:
  declarative-invariant (schema/migration/DB-constraint) | pure-module | test-only |
  UI (server-side security уже покрыта) | infra/mechanical

DEFAULT  : если предикат не уверен (confidence=low / неоднозначно) → HIGH (безопасный дефолт).
OVERRIDE : человек может форсировать tier (autonomy §7); фиксируется в Notes-ledger.
```

**Критично — почему «трогает инвариант» НЕ равно HIGH (грунтовка §6):** наличие IC-*/BR- в `_Requirements_` **само по себе не делает задачу HIGH**. Решает **способ enforcement'а**:
- инвариант enforced **декларативно** (UNIQUE/CHECK-constraint, schema) → **LOW** + обязательная **DB-интроспекция** (constraint *и есть* гарантия; reviewer не нужен — нужна интроспекция, что constraint на месте);
- инвариант enforced **императивно** (порядок транзакции, timing, race, ordering двух row-lock'ов) → **HIGH** (именно тут прячутся subtle-баги класса 4.6).

Это прямой урок прогона: 1.3/2.1/4.2 трогают IC-001/004, но прошли inline+pg-интроспекцию; 4.6 (IC-006, atomic reset) — императив → independent reviewer → REJECT.

---

## 4. Маркер-детекция (как считать M1–M4 машинно)

Не по «смыслу», а по сигнатурам в resolved-тексте `_Requirements_` + diff-намерении задачи:

| Маркер | Сигнатуры (regex / keyword, case-insensitive) |
|---|---|
| M1 security-AC | `anti.?enum`, `constant.?time`, `timing`, `generic (error\|success)`, `fail.?closed`, `default.?deny`, `CSRF`, `state` (oauth), `open.?redirect`, `safe.?redirect`, `bcrypt\|argon`, `token` + (`issue\|consume\|rotate\|supersede`) |
| M2 concurrency/idem | `FOR UPDATE`, `row.?lock`, `atomic`, `\$transaction`, `idempoten`, `LRU`, `evict`, `outbox`, `dedup`, `webhook` |
| M3 shared primitive | `_Boundary_` файл ∈ shared-primitive-set (из Notes-ledger forward-deps) ИЛИ задача меняет сигнатуру функции, помеченной `@shared` в реестре |
| M4 cross-FM seam | `pmo-mapping.lookup(_Boundary_.zone).owner ≠ this_FM` ИЛИ `_Requirements_` ссылается на AC чужого FM |
| declarative-invariant | `_Boundary_` ⊆ `packages/db` ∧ задача = schema/migration ∧ нет M1–M3 |
| test-only | `_Boundary_` ⊆ `**/test/**` ∧ нет prod-src в diff |
| UI | `_Boundary_` ⊆ `apps/web` ∧ нет server-side-auth логики |
| infra/mechanical | `_Boundary_` ⊆ {docker, worker-wiring, config} ∧ нет M1–M3 |

> Реализация: чистая функция над распарсенным tasks.md + requirements.md + registry. Тестируется фикстурой (как C-07 в S2) — это шаг материализации (S5), не дизайна.

---

## 5. Реестр load-bearing инвариантов

Классификатору нужен машинный ответ «является ли IC-NNN / BR-NNN несущим». **Не хардкод-список** (он дрейфует и непереносим между проектами), а **деривация по маркерам** из самого спека + опциональный override-файл.

### 5.1. Правило деривации (per-project, авто)

```
load_bearing(IC|BR) ⟺ его formulation/category в spec несёт маркер из {M1, M2} §4
                       ИЛИ помечен вручную в registry-override
```

Т.е. реестр **генерируется** сканом `requirements.md` / `.product/` инвариантов на те же M1/M2-сигнатуры — единый источник истины с предикатом. Это снимает риск «забыли внести инвариант в список».

### 5.2. Формат (machine-readable)

```yaml
# orchestrator/registries/load-bearing.<feature>.yaml  (генерируется + ручной override)
feature: FM-001
derived_at: <stamp>            # стампится после генерации (не в скрипте — §SPEC 2)
invariants:
  - id: IC-006
    enforcement: imperative    # imperative → HIGH; declarative → LOW+introspection
    markers: [M2-atomic, M1-timing]
    note: "atomic reset: single $transaction, FOR UPDATE on token AND user"
  - id: IC-001
    enforcement: declarative    # UNIQUE index → LOW + pg-introspection
    markers: [M2-uniqueness]
overrides: []                   # человек может добавить/снять несущесть
```

### 5.3. Seed из auth (FM-001) — **иллюстративный**, derive-per-project

> ⚠ Ниже — пример, восстановленный из транскрипта RUN 01 (#2061 coverage-report + B.5/B.6). Точные `enforcement`/markers **сверять с живым спеком** при материализации (честность: BR-номера ниже — те, что наблюдались в прогоне; полнота не гарантирована).

| ID | Что | enforcement | tier-вклад |
|---|---|---|---|
| IC-001 | email-uniqueness (case-insensitive) | **declarative** (UNIQUE index) | LOW + pg-introspection |
| IC-002 | token row-lock на consume (FOR UPDATE) | **imperative** | HIGH (M2) |
| IC-003 | ≤5 активных сессий, LRU-eviction | **imperative** | HIGH (M2) |
| IC-004 | поле-constraint (CHECK / VARCHAR(60)) | **declarative** | LOW + pg-introspection |
| IC-006 | атомарный reset (single $transaction) | **imperative** | HIGH (M2+M1) ← REJECT 4.6 |
| IC-007 | TLS/HSTS / audit-запись | mixed | по задаче |
| BR-003 | email collision (3-CTA) | imperative | HIGH (M3 общий signup-путь) |
| BR-010 | sensitive-op gate (per-request re-check) | imperative | HIGH (M1 default-deny) |
| BR-012 | constant-time login (dummy-bcrypt) | imperative | HIGH (M1 timing) |
| BR-017/018/019 | anti-enum counter / captcha gate / reset | imperative | HIGH (M1) |
| BR-020 | reset timing-jitter (padTo 600ms) | imperative | HIGH (M1 timing) ← класс 4.6 |

---

## 6. Валидация против RUN 01

Прогоняю предикат §3 «на бумаге» против фактических gate-решений прогона (out-dim-2 §B.5 = реально получили independent reviewer; §B.6 = реально inline). **Совпадение = рубрика воспроизводит человека.**

| Задача | Факт (RUN 01) | Маркеры предиката | Предикат | Совпало? |
|---|---|---|---|---|
| 4.3 consume() shared | HIGH (reviewer) | M3 (shared consume) + M2 (IC-002 FOR UPDATE) | **HIGH** | ✅ |
| 4.4 SessionService+redirect | HIGH | M3 + M1 (open-redirect) + M2 (IC-003 LRU) | **HIGH** | ✅ |
| 4.5 CAPTCHA/timing | HIGH | M1 (timing, anti-enum) | **HIGH** | ✅ |
| **4.6 atomic reset** | **HIGH → REJECTED** | M2 (atomic $transaction) + M1 (timing BR-020) | **HIGH** | ✅ (поймал бы) |
| 4.7 distrust-reset/OAuth | HIGH | M1 (CSRF state) + M4 (OAuth seam) | **HIGH** | ✅ |
| 5.1 HTTP cookie/CSRF | HIGH | M1 (CSRF, cookie) + integration seam | **HIGH** | ✅ |
| 5.4 trial-signal idempotent | HIGH | M2 (idempotent) + M4 (FM-005 seam) | **HIGH** | ✅ |
| 1.2 Docker | LOW (inline) | infra/mechanical | **LOW** | ✅ |
| 1.3 Prisma schema | LOW (inline+introspect) | declarative-invariant (IC-001 UNIQUE) | **LOW**+introspect | ✅ |
| 2.1 DB models IC-001/004 | LOW (inline+pg_constraint) | declarative-invariant | **LOW**+introspect | ✅ |
| 4.2 scenario race IC-001 | LOW (inline+suite) | declarative (enforced by index из 2.1) | **LOW** | ✅ |
| 5.2 web UI | LOW | UI (server-security elsewhere) | **LOW** | ✅ |
| 5.3 worker | LOW | infra/mechanical | **LOW** | ✅ |
| 6.1/6.2/6.3 tests | LOW (would-fail-if-broken) | test-only | **LOW** | ✅ |
| **1.1 scaffold** | **HIGH (reviewer)** | нет M1–M4 (scaffold) | **LOW** | ❌ **расхождение** |

**Результат: 16/17 совпадений.** Единственное расхождение — **1.1 (первый scaffold-таск)**: человек прогнал reviewer из foundational-осторожности (первая задача задаёт паттерны всей фичи), хотя по маркерам она LOW. Это честный edge-case, а не дефект рубрики:

- **Вариант A (рекомендую):** добавить мягкий маркер **M5 `first-task-of-feature → HIGH (once)`** — однократный foundational-review на старте фичи. Дёшево (1 задача), ловит «паттерн-долг» рано.
- **Вариант B:** принять 1.1 как LOW — scaffold механичен, reviewer на нём был факультативным (APPROVED без находок).

Расхождение **в безопасную сторону** (предикат недо-проверил бы 1.1, а не пропустил несущую). Все 8 реально-несущих задач (включая REJECTED 4.6) предикат пометил HIGH — **ни одного false-LOW на несущей**. Это и есть главный критерий.

---

## 7. Verify-профили (LOW-tier) — что именно делает inline-скелет (VC-4)

| profile | RED-доказательство | property-check |
|---|---|---|
| `declarative-invariant` | classic RED (missing-module) | **живая БД-интроспекция** (`pg_constraint`/`pg_indexes`) — constraint на месте |
| `pure-module` | classic RED | property-assert (напр. identical-response для anti-enum) |
| `test-only` | **would-fail-if-broken** (инверсия ожидания) | mutation-доказательство (синтетический дефект → тест падает → revert) |
| `UI` | — | boundary + CTA/route-hrefs + proxy-relay |
| `infra/mechanical` | — | boundary + `git check-ignore` нового артефакта + secrets-scan |

Все LOW-профили **полностью детерминированы** (фиксированный набор команд) — это слой-3, исполняемый скелетом, а не отдельным role-агентом.

---

## 8. Эскалация, дефолты, override

- **Неуверенность** (`confidence=low`, ни один профиль чётко не подошёл) → **дефолт HIGH** (дешевле прогнать лишний reviewer, чем пропустить timing-oracle).
- **Human override** — autonomy §7: человек форсирует tier; решение пишется в Notes-ledger с обоснованием (для будущей калибровки рубрики).
- **REJECT → remediation** → редуцированный re-gate (VC-9): targeted-fix меняет ⊆ finding-scope, ядро не тронуто → узкая self-verify, не полный re-review.

---

## 9. Интеграция в P5 + следующий шаг

В скелете P5 (`feature-to-tdd-impl`, SPEC §3.2) классификатор — детерминированный `[S]`-шаг **между** implementer'ом и гейтом:

```
[S]    impl   = agent( tdd-implementer(brief) )
[S]    { tier, profile } = gate-risk-classifier(task, registry)     # ← этот документ
IF tier == HIGH:
  [GATE] verdict = agent( adversarial-task-reviewer(impl) )         # RA-7, structured-verdict VC-7
         IF REJECTED: targeted-fix → reduced re-gate (VC-9)
ELSE:
  [GATE] inline-verify(impl, profile)                               # §7, скелет, без субагента
```

**Материализация (шаг S5, вместе с прототипом P5):**
1. `skills/orchestrator/gate-risk-classifier.md` — регламент (этот дизайн → skill-форма).
2. Чистая функция-предикат + фикстура tasks.md + тест (паттерн C-07 из S2): прогнать против таблицы §6 как regression — рубрика обязана воспроизвести 16/17 (+1.1 по выбранному варианту M5).
3. Генератор реестра §5.1 (скан spec на M1/M2) + override-файл.

---

## 10. Открытые вопросы (нужен прогон №2)

1. **Одна фича, один стек.** Рубрика валидирована на auth (security-тяжёлая, TS/NestJS). Нужен прогон на фиче иного класса (media-pipeline FM-002, billing FM-005 — «money, строже») — там маркеры M1/M2 другие (платёжная идемпотентность, outbox FM-005→FM-006). Подтвердить, что M1–M4 покрывают и их.
2. **M5 (first-task) — вариант A или B** не решён; зависит от того, повторится ли foundational-review на старте других фич.
3. **Declarative vs imperative** — граница ясна на DB-constraint, но размывается на «schema + триггер» / «materialized view с логикой». Калибровать на FM с БД-логикой.
4. **Порог registry-деривации** (§5.1): скан по M1/M2 может дать false-negative на инварианте, сформулированном без keyword'а. Override-файл — страховка, но требует ревью человека один раз на фичу.
