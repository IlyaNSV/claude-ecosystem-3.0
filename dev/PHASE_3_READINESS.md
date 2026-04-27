# Phase 3 Readiness Checklist

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 3 (Planning + Feature Enrichment).
>
> **Зачем:** Phase 3 строится поверх Phase 2 assumptions. Если Phase 2 не валидирована end-to-end и архитектурные неопределённости не закрыты, Phase 3 будет накапливать ошибки.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждый item имеет severity: 🔴 Blocker, 🟡 Important, 🔵 Nice-to-have.
>
> **Когда отметить done:** запустить smoke test (Раздел A), записать observation в DEV_JOURNAL, ответить на архитектурные вопросы (Раздел C). Только после этого начинать Phase 3 implementation.

---

## 🟢 Status banner (2026-04-20 — final readiness)

**Pilot complete on `my-first-test/`** — Phase 2 Discovery валидирована end-to-end. См. [DEC-DEV-0008](../DEV_JOURNAL.md) с деталями output.

**Применены 3 pre-Phase-3 fixes (DEC-DEV-0009..0011)** + **architectural consolidation (DEC-DEV-0012)** — все 12 архитектурных decisions для Phase 3 закрыты:
- [DEC-DEV-0009](../DEV_JOURNAL.md) — session-state orchestrator integration
- [DEC-DEV-0010](../DEV_JOURNAL.md) — atomicity in session-state.js
- [DEC-DEV-0011](../DEV_JOURNAL.md) — `confidence_notes` canonicalization (PS skill)
- [DEC-DEV-0012](../DEV_JOURNAL.md) — Phase 3 architectural decisions consolidation (C.1-C.5, B.1-B.5, D.1-D.5)

**Status:**
- Раздел A (Smoke tests) — **✓ mostly done via pilot**; A.7 (`/product:init --continue` re-test) deferred (low priority, не blocking)
- Раздел B (Spec/implementation alignment) — **✓ done**:
  - B.1: convention added в CLAUDE.md; NOTE skills audit done; `note-promote.md` skill created (Phase 2 gap fix)
  - B.2: `artifact-validate.js` reads `validation_tier` + `draft_mode_quiet_hooks` confirmed; other product.yaml fields для Phase 3 skills (auto_approve_*) per C.3
  - B.3, B.4: confirmed no gap (Phase 3 extends, не fixes Phase 2)
  - B.5: pilot uses ASCII slugs (`solo-creators`, `edu-centers`); rule codified в `docs/pmo/artifacts/README.md`
- Раздел C (Архитектурные неопределённости) — **✓ all 5 closed**:
  - C.1: Trigger-DA-on-every-change + adaptive depth (single subagent invocation)
  - C.2: DA debt mechanism dropped (logical consequence of C.1)
  - C.3: Skill writes status:active directly + decision journal + conversational notification
  - C.4: Detection + V-11 auto-fix only (full BFS → v1.1)
  - C.5: Hook reads `validation_overrides`/`approve_overrides` inline + expires_at check + audit log
- Раздел D (Scope discipline) — **✓ done**:
  - D.1: Deep mode subagents → v1.1 (full context preserved в `dev/v1_1_backlog.md`)
  - D.2: Atomic mass-rename → v1.1; v1 ships manual preview workflow
  - D.3: NFR Review F.5a confirmed Phase 4
  - D.4+D.5: Final must-have / deferred lists in [ROADMAP.md Phase 3 section](../ROADMAP.md)
- Раздел E (Pilot validation gate) — **✓ done** (E.1, E.2 resolved per DEC-DEV-0008)
- Раздел F (Meta) — **✓ done** (DEV_JOURNAL + memory + CLAUDE.md активны)

**Spec docs обновлены per DEC-DEV-0012:**
- `docs/pmo/processes.md §6.2` — adaptive-depth replaces magnitude-gated DA + DA debt
- `docs/pmo/validation.md §7 P-RULE-01/02` — same refactor
- `docs/pmo/artifacts/README.md` — ASCII slug rule codified
- `ROADMAP.md` — Phase 3 deliverables refined; Post-MVP v1.1 section expanded

**🟢 READY for Phase 3 kick-off.** Все blocking items resolved. См. [ROADMAP.md Phase 3 section](../ROADMAP.md#phase-3) для finalized deliverables list.

---

## A. Smoke tests Phase 2 (🔴 Blockers — без них Phase 3 — слепой полёт)

**Updated 2026-04-20** — большинство items validated на pilot `my-first-test/` (см. [DEC-DEV-0008](../DEV_JOURNAL.md)).

### A.1 Bootstrap end-to-end на чистой папке ✓
- [x] bootstrap прошёл до конца в `my-first-test/`
- [x] `.claude/`, `.product/`, `CLAUDE.md`, `product.yaml`, `.env` созданы
- [x] `settings.json.hooks` содержит entries `artifact-validate.js` + `session-state.js` (manifest auto-registration работает)

### A.2 Bootstrap с pre-existing `.claude/settings.local.json` ⏳
- [ ] Specifically re-tested — нужен второй тест на **уже bootstrapped** проекте для idempotency merge. **Low priority** — edge case covered в DEC-DEV-0004.

### A.3 `/ecosystem:verify` post-bootstrap ⏳
- [ ] Не прогонялось specifically. Не блокер (pilot косвенно подтвердил core files present). Прогнать при удобной возможности.

### A.4 `/product:init` Quick mode ✓ (с оговорками)
- [x] End-to-end Discovery — 14 артефактов created, все в active
- [x] PS, MR (22 sources), CA (7 competitors), 3 SEG, 3 VP, 4 HYP, BG (18 terms) — **больше чем minimum expected**
- [x] C2 confidence field везде с нюансированной калибровкой
- [x] A2 Discovery Review Checkpoint (MR+CA batch approve) — работает корректно
- [x] H.A.R.M.E.D. полный с deferred zones
- **⚠ Quick mode ≠ 30-60 мин:** реальное processing ~3h из-за user AFK (не bug экосистемы)
- **⚠ Finding:** `confidence_rationale` drift в PS → fixed в DEC-DEV-0011

### A.5 Hook `artifact-validate.js` реально срабатывает ✓ (косвенно)
- [x] `edits_since_start: 16` в current.yaml подтверждает PostToolUse invocations
- [ ] **Не verified specifically:** queueing в `.pending/validation-pending.yaml` при draft state. На pilot не было длительных drafts. Прогнать на artificial draft в Phase 3 testing.
- [ ] Tier-aware behavior (`validation_tier: pilot` → только 🔴 inline) — не validated specifically (не было findings для surfacing)

### A.6 Hook `session-state.js` создаёт snapshot ✓ (с bug-fixes)
- [x] `current.yaml` создаётся и обновляется (16 edits tracked)
- [x] Содержит last_artifact_*, edits_since_start, recent_artifacts, git_head_sha
- **⚠ Finding 1:** last_artifact_id/type/status рассинхронны → fixed в DEC-DEV-0010 (atomicity)
- **⚠ Finding 2:** `type: 'unknown'` вместо `'discovery-session'` → fixed в DEC-DEV-0009

### A.7 Session recovery работает ⏳
- [ ] **Not validated specifically.** Discovery был complete в один пробег (с AFK — отличается от «прерывание + --continue»).
- [ ] Валидность восстановления blocked by discovery-progress.yaml bug → fixed в DEC-DEV-0009. **Retest до Phase 3 kick-off:** прервать свежий `/product:init` на D1.3, `--continue`, проверить resume point.

---

## B. Spec/Implementation alignment (🟡 Important — иначе Phase 3 spec drift)

Skills, commands, hooks ссылаются на пути, поля, конвенции. Реальные артефакты, которые они создадут — соответствуют ли spec?

### B.1 Frontmatter conventions consistency ⏳ (partially addressed)
- [x] Все 22 типа артефактов в `docs/pmo/artifacts/*.md` используют canonical fields (verified в spec review)
- [x] SEG/VP/HYP skills — проверено на pilot, generate с canonical `confidence_notes` ✓
- [x] PS skill — **fixed** в DEC-DEV-0011 (добавлен explicit frontmatter template + anti-pattern warnings)
- [ ] **Audit остальных skills** (не использовались на pilot): bg-extraction (если вынесут), note-capture, note-promote, pattern-linter, drift-detector — проверить что где создают артефакты, имеют explicit frontmatter templates с canonical fields
- [ ] Phase 3 additions: все новые skills (`scenario-authoring`, `business-rule-extraction`, `lifecycle-derivation`, etc.) должны иметь explicit frontmatter templates **с первого написания**. Добавить review checklist в CLAUDE.md для PR review.
- [x] Hook `artifact-validate.js` парсит правильные fields (checked in source review)

### B.2 product.yaml fields реально читаются
- [ ] `validation_tier`, `draft_mode_quiet_hooks`, `auto_approve_confirmation_artifacts.*` — реально читаются hooks или skills?
- [ ] Если только в spec, не в коде — этой phase или next?

### B.3 BG extraction stub
- [ ] `bg-extractor.js` запланирован в Phase 3, но Phase 2 commands (`/product:init`, etc.) ссылаются на «BG extraction queued»
- [ ] **Решение:** Phase 2 manual placeholder ОК (пользователь добавляет BG terms сам через `/product:bg:review` который тоже Phase 3)? Или нужен mvp BG capture сейчас?

### B.4 Cascade protocol stub
- [ ] `cascade-check.js` запланирован Phase 3
- [ ] Phase 2 `/product:drift-check` упоминает cascade
- [ ] **Решение:** работает ли drift-check без cascade-check? (Должен — это разные mechanisms.) Verify.

### B.5 Path conventions
- [ ] `.product/segments/SEG-001-<slug>.md` vs `.product/segments/SEG-001.md` — какая? Skills и hooks должны agree.
- [ ] Slug derivation algorithm — определён ли где-то?

---

## C. Архитектурные неопределённости (🔴 Blockers — без решения Phase 3 implementation будет блокировать каждые 30 мин)

Это critical thinking work, не просто «прочитать spec». Каждый пункт требует explicit decision до начала implementation.

### C.1 Magnitude classifier algorithm для P-RULE-01/02 (A3 modification)

**Проблема:** Phase 3 включает `ic-change-da-trigger.js` и `br-change-review-trigger.js`. Они должны решать «significant change» vs «cosmetic». SPEC даёт enumeration критериев («severity change», «statement change»), но не algorithm.

**Что нужно решить ДО implementation:**
- [ ] Как detect «semantic statement change» vs «typo fix» в JS? Diff на token level? AST? Heuristics на word count + key terms?
- [ ] Как classify «parameter type change» vs «value tune»? Parse YAML, compare types?
- [ ] False-positive vs false-negative tradeoff: лучше over-trigger DA или under-trigger?

**Suggested approach:** простой v1 — diff-based heuristics (changed line count в Statement section + presence of key tokens). Document в DEV_JOURNAL что v1 — heuristic, может trigger false positives. Refinement через `/product:meta-feedback`.

### C.2 DA debt mechanism

**Проблема:** SPEC §6.2 описывает `.product/.pending/da-debt.yaml` для skipped DA reviews. На каком approve gate FM-level batch DA срабатывает? Кто owns этот код?

**Что нужно решить:**
- [ ] Который exact event triggers batch processing — FM transition planned → in-progress? Или only при handoff?
- [ ] Если batch surfaces 5+ accumulated changes — это блокирует или warning?

### C.3 A1 auto-approve trigger (где живёт логика?)

**Проблема:** A1 modification — confidence-gated auto-approve для 🟢 Confirmation artifacts. Phase 2 commands не реализуют эту логику. Где она должна жить — в hook? В skill? В command?

**Что нужно решить:**
- [ ] Skill (`vc-derivation.md`, etc.) перед записью артефакта проверяет conditions и auto-sets `status: active` без approve gate?
- [ ] Или hook на PostToolUse детектит condition и flips status?
- [ ] Notification flow — если auto-approve срабатывает, как user узнаёт (для возможного revert)?

### C.4 Cascade protocol implementation

**Проблема:** SPEC §6 описывает cascade BFS algorithm. Phase 3 ROADMAP включает `cascade-check.js` hook. Сложность — graph traversal на JS.

**Что нужно решить:**
- [ ] Manual через `/product:cascade <artifact-id>` достаточно для v1, или auto-trigger на approve обязателен?
- [ ] V-11 auto-fix (bi-dir refs) — Phase 3 или Phase 4?
- [ ] При cascade conflict — atomic rollback (все или ничего) или per-item с journal?

**Suggested approach:** для v1 — manual command + hook что only **detects** dependents и записывает в `.product/.pending/cascade-pending.yaml`. Actual fixes — manual через user approve. Auto-fix откладывается на v1.1.

### C.5 D2 approve_overrides runtime processing

**Проблема:** `validation_overrides` и `approve_overrides` — D2 modification. Schema задокументирована, но кто их обрабатывает в runtime?

**Что нужно решить:**
- [ ] Hook `artifact-validate.js` skip findings для overridden rules? Или skill at approve gate?
- [ ] `expires_at` field — кто проверяет expiry? Periodic check (нет infra)? Inline (heavy)?

---

## D. Scope discipline для Phase 3 (🟡 Important — против over-engineering)

ROADMAP оценивает Phase 3 в ~18 файлов и 4-6 часов focused. Реалистично только если режем агрессивно.

### D.1 Deep mode subagents — отложить
- [ ] `market-researcher.md` и `competitor-analyst.md` (8-фазный pipeline) запланированы Phase 3
- [ ] **Suggested:** отложить на v1.1 после pilot. Quick mode из Phase 2 — единственный mode для первого pilot. Если pilot покажет что Quick mode достаточен — Deep mode может не понадобиться вовсе.

### D.2 Mass-rename `/product:bg:rename` — manual в v1
- [ ] Atomic multi-file commit с consistency cascade — нетривиально
- [ ] **Suggested:** v1 предлагает sed-like preview, user применяет вручную. Atomic implementation в v1.1.

### D.3 NFR Review F.5a — НЕ в Phase 3
- [ ] ROADMAP помещает NFR в Phase 4 — verify
- [ ] Phase 3 should НЕ touch NFR

### D.4 Что в Phase 3 точно must-have
- `/product:plan` (P1.B Planning Session) — без него нельзя добраться до /product:feature
- `/product:feature` (P2.A enrichment) — core Phase 3 value
- Skills для F.1-F.7 (scenario-authoring, business-rule-extraction, lifecycle-derivation, vc-derivation, ic-discovery)
- `bg-extractor.js` hook (без него BG не наполняется)
- Cascade-check hook **detecting only** (без auto-fix)

### D.5 Что можно отложить из Phase 3 в v1.1
- Deep mode subagents (Quick first)
- Atomic mass-rename (manual placeholder)
- ic-change-da-trigger / br-change-review-trigger с full magnitude classifier (v1: trigger on every change, refine threshold post-pilot)
- vc-derivation polish (v1: derive draft, human heavily edits)

---

## E. Pilot validation gate (🔴 Blocker — самый важный пункт) ✓ DONE

### E.1 Реальный pilot Phase 2 на твоей собственной идее ✓
- [x] Real idea — AI video localization platform для длинного educational контента
- [x] `/product:init` end-to-end Quick mode
- [x] Получено: PS, MR, CA, 3 SEG, 3 VP, 4 HYP, BG в my-first-test/.product/
- [x] **Зафиксировано в DEV_JOURNAL DEC-DEV-0008:**
  - Что работает отлично (C2 calibration, H.A.R.M.E.D., A2 DRC, critical thinking AI)
  - Что turned out wrong (4 findings → DEC-DEV-0009/0010/0011)
  - Quality observations: AI orchestration качественнее expected; skill prompts работают
  - Время: Quick mode processing-time normal; calendar time растянут user's AFK (не bug)

### E.2 Решение: продолжать с Phase 3 как есть, или revise? ✓
- [x] Pilot findings не требуют revise ROADMAP Phase 3 scope — 4 fixes применены до старта
- [x] Decision: **продолжать с Phase 3 как запланировано**, но с pre-flight audit spec/skill alignment (раздел B.1 extension)
- [x] Записано в DEC-DEV-0008, DEC-DEV-0009/0010/0011
- [x] ROADMAP.md не требует update (estimates не изменились)

---

## F. Meta (🔵 Nice-to-have — foundation для долгой работы)

### F.1 Dogfood: `.product/` для самой Ecosystem 3.0
- [ ] Обсудить (не сейчас, а после E.1) — создать `.product/problem.md` (PS) для самой экосистемы
- [ ] Минимум: PS («что за проблема»), 2-3 HYP («solo developer выиграет от такой структуры»), MVP scope
- [ ] Это форсит честное столкновение с собственным spec
- [ ] **Откладывается** до после Phase 2 pilot — иначе premature

### F.2 Memory entries актуальны
- [ ] User role, project status, architecture summary, methodology, dev journal reference — записаны
- [ ] При major изменениях в проекте — обновлять (особенно project_ecosystem_status.md)

### F.3 Settings.local.json для разработки
- [ ] Текущий [.claude/settings.local.json](../.claude/settings.local.json) минимальный
- [ ] Опционально расширить через `less-permission-prompts` skill после accumulation типичных tool calls

### F.4 CHANGELOG vs DEV_JOURNAL discipline
- [ ] Каждый significant fix/decision в эту фазу — DEV_JOURNAL entry
- [ ] CHANGELOG обновляется только при release-worthy changes

---

## G. Definition of Done для Phase 3

Phase 3 считается «done», когда:
- [ ] `/product:plan` после Discovery → MVP, RM, RL-001, FM skeletons (соответствие ROADMAP A.C.)
- [ ] `/product:feature FM-001` → полный P2.A: F.1 → F.10 FM in-progress
- [ ] BG extraction ловит bold terms, batched presentation работает
- [ ] Cascade detection работает (auto-fix откладывается v1.1 если решено в C.4)
- [ ] A1 auto-approve срабатывает для 🟢 артефактов с confidence: high (если решено в C.3)
- [ ] **Phase 3 smoke-test:** прогнать `/product:plan` + `/product:feature` на pilot проекте из E.1
- [ ] DEV_JOURNAL обновлён с findings + key decisions
- [ ] CHANGELOG обновлён (consumer-facing changes)

---

## Совет: как использовать этот checklist

1. **Сначала Раздел E** (pilot Phase 2). Это даёт самый важный signal — что реально работает.
2. **Потом A** (smoke tests) — параллельно с E, поскольку pilot E это и есть smoke test, по сути.
3. **Потом C** (архитектурные неопределённости) — каждый пункт = решение, которое нужно принять и записать в DEV_JOURNAL.
4. **Потом D** (scope discipline) — отрезать всё, что не must-have для pilot end-to-end.
5. **B и F** — параллельно, по мере необходимости.

**Когда всё ☑ → начинать Phase 3 implementation.**

**Если в процессе Phase 3 вскроется что-то, что должно было быть здесь** — добавь сюда сейчас (для Phase 4 readiness) + запиши в DEV_JOURNAL.
