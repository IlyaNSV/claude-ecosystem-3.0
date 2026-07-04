# Substrate Graduation Gate — порог «production-ready»

> **Назначение:** явный, проверяемый порог, который надо пройти, **прежде чем**
> объявить процесс / модуль production-ready ИЛИ доставить пилоту фичу класса
> `prod`. Кодифицирует тайминг-принцип «production-substrate до первого
> production-агента»: инструменты наблюдаемости, трассировки, scoped-доступа и
> security-ревью должны стоять **до**, а не после того, как автономный агент
> начнёт производить необратимые эффекты.
>
> **Введён:** DEC-DEV-0144 (2026-07-04) — шаг очереди vibe-coding SDLC-анализа
> (`dev/VIBE_CODING_ANALYSIS.md` §4 VC-133/VC-134, §7 риск 8).
> **Тип:** readiness-гейт (не smoke). Проверяет наличие субстрата, а не поведение.
> **Провенанс идеи:** Google «The new SDLC with Vibe Coding» VC-130/133/134 —
> «прототип, случайно попавший в прод»; 4-компонентный substrate-чеклист.

---

## Status banner

🟡 **3 из 4 компонентов зелёные; 1 частичный.** Гейт как артефакт создан этим PR;
CI-нога (компонент 1) закрывается **тем же PR** минимальным GitHub Action.
Порог ещё **не** «полностью зелёный» — компонент 4 (security review) частичен, и
трейс-нога (компонент 2) построена, но **live-прогоном в пилоте не подтверждена**
(pending доставки `/ecosystem:update`). Смотри графу «остаточный долг» ниже.

---

## Компоненты порога

| # | Компонент | Статус | Чем закрыт / что осталось |
|---|---|---|---|
| 1 | **Evals в CI** | ✅ floor (этот PR) | Минимальный GitHub Action [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml) гонит `npm run verify` на push в `main` + каждый PR. Это **пол, не потолок**. |
| 2 | **Трейсы каждого прогона** | ✅ built · 🟡 live pending | Run-ledger (DEC-DEV-0147, PR #120): [`orchestrator/lib/run-ledger.cjs`](../../orchestrator/lib/run-ledger.cjs) + dispatcher-wiring `start`/`finish` в [`commands/orchestrator/run.md`](../../commands/orchestrator/run.md) §«Run ledger». Каждый прогон авто-создаёт `runs/<RUN_ID>/run.json` + строку в `runs/ledger.ndjson`. **Остаток:** live-прогон в пилоте после `/ecosystem:update` (built ≠ validated — см. VC-127 ниже). |
| 3 | **Scoped permissions per agent** | ✅ | Два независимых слоя: (a) `tools:`-frontmatter у всех 7 субагентов ([`agents/**/*.md`](../../agents) — `qa-advisor`/`devils-advocate`/`architect-advisor`/`ux-advisor`/`tool-researcher`/`tool-profiler`/`contract-designer`), сужающий инструментарий персоны до минимума; (b) PreToolUse-guard [`hooks/integrator/scope-guard.js`](../../hooks/integrator/scope-guard.js) — маркер-gated boundary на запись вне зоны Integrator (warn + PA-journal). |
| 4 | **Security review** | 🟡 partial | Есть: `verify-finding-before-act` (P4/P6 — агент подтверждает находку против ground-truth перед действием) + ручной `/security-review`-класс проверок на diff. **Нет:** систематического security-прохода как обязательного шага перед prod-graduation. Критерий закрытия — ниже. |

### Критерий закрытия компонента 4 (security review)

Компонент 4 переходит 🟡→✅, когда для класса `prod` выполнено **хотя бы одно** из:
- security-review запущен на diff доставляемой фичи (skill `/security-review` ИЛИ
  эквивалентный ручной проход по OWASP-классам: injection, secret-leak, authz-обход,
  path-traversal) и находки закрыты/приняты явно;
- фича не имеет security-поверхности (нет внешнего ввода / сети / секретов / записи
  за пределы `.product/`) — зафиксировать это суждение одной строкой в PR/DEV_JOURNAL,
  а не пропускать молча.

Пока по классу `prod` нет ни одного такого прохода — компонент держится 🟡, и это
**осознанный solo-субститут**, а не полноценный CI-security-gate (полный трек —
отдельный, вне floor-порога этого гейта).

---

## Критерий PASS

Гейт **PASS** для конкретного graduation-события (процесс/модуль → production-ready
ИЛИ фича класса `prod` → пилот), когда:

- [ ] Компонент 1 (evals в CI) — зелёный на HEAD доставляемой ветки (Action прошёл).
- [ ] Компонент 2 (трейсы) — run-ledger реально пишет `runs/<RUN_ID>/` для процессов,
      которые графируются (для orchestrator-класса — обязательно; для чисто-doc — N/A).
- [ ] Компонент 3 (scoped permissions) — любой новый субагент имеет `tools:`-frontmatter;
      любая новая write-зона покрыта scope-guard ИЛИ явно признана вне охвата.
- [ ] Компонент 4 (security review) — критерий закрытия выше выполнен для этого diff.
- [ ] **VC-127-привязка:** каждый механизм, объявляемый в этом graduation как «работает»,
      имеет **прогнанный** зелёный runtime-smoke, а не только написанный план (см. ниже).

Любой компонент 🟡/❌ → graduation **не** объявляется production-ready; фиксируется как
`validation_tier` ниже prod (pilot/mvp) с явным остаточным долгом.

---

## Когда прогонять

- **Перед** тем как объявить процесс / модуль production-ready (снять с него
  «pilot/mvp» и назвать prod-надёжным).
- **Перед** доставкой пилоту фичи класса `prod` (`product_class` / `validation_tier=full`).
- **НЕ** для pilot/mvp-класса — там порог намеренно ниже; этот гейт про prod-порог.

Это readiness-гейт (проверяет наличие субстрата), поэтому прогоняется как чтение +
чеклист, а не как исполняемый smoke. Исполняемую сторону («механизм реально
прогнан») держит связка с VC-127 и deferred-smoke-долгом ниже.

---

## Связка с VC-127 «built ≠ validated»

Компонент 2 (и любой механизм в graduation-заявке) считается **built** после
кода+тестов, но **validated** — только когда его runtime-smoke реально **прогнан
зелёным** на живой среде, а не «план написан». Правило кодифицировано врезкой в
[`dev/meta-improvement/checklists/phase-closure.md`](../meta-improvement/checklists/phase-closure.md)
(«Step 3.5 — built vs validated») + строкой в
[`live-run-validation.md`](../meta-improvement/checklists/live-run-validation.md).

**Deferred-smoke долг — сигнал остановиться.** Накопление ≥2 планов в статусе
«next pilot session» = знак, что graduation опережает валидацию. Текущий долг:

| План | Что не прогнано | Статус |
|---|---|---|
| [`PATCH_1.3.3_SMOKE_TEST_PLAN.md`](PATCH_1.3.3_SMOKE_TEST_PLAN.md) | S1–S5 runtime | ⏳ next pilot session |
| [`PHASE_6_SMOKE_TEST_PLAN.md`](PHASE_6_SMOKE_TEST_PLAN.md) | S1–S7 runtime | ⏳ next pilot session |
| [`S_LE_LESSON_GATE_SMOKE.md`](S_LE_LESSON_GATE_SMOKE.md) | S-LE.1 / S-LE.3 exemption ре-прогон (warn→strict флип) | 🟠 частично прогнан (2026-07-04); ре-прогон pending |

Три открытых плана уже превышают порог «>2» — при следующей пилот-сессии их прогон
приоритетен над новыми prod-graduation-заявками.

---

## Cross-references

- [`dev/VIBE_CODING_ANALYSIS.md`](../VIBE_CODING_ANALYSIS.md) §4 (VC-133/134, VC-127), §7 риски 5 и 8 — источник.
- [`DEV_JOURNAL.md` → DEC-DEV-0144](../../DEV_JOURNAL.md) — очередь vibe-coding SDLC-анализа.
- [`DEV_JOURNAL.md` → DEC-DEV-0147](../../DEV_JOURNAL.md) — run-ledger (трейс-нога, PR #120).
- [`commands/orchestrator/run.md`](../../commands/orchestrator/run.md) §«Run ledger» — dispatcher-wiring `start`/`finish`.
- [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml) — CI-нога (floor).
- VC-087 (run-ledger как observability), VC-128 (5-мерный agent-eval scorecard) — соседние треки, расширяющие потолок над этим floor-порогом.
