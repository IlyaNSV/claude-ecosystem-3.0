# 07. Механизмы согласованности

> **Назначение раздела:** определить функциональные требования к **механизмам согласованности** между артефактами PMO — терминология, перекрёстные ссылки, cascade при изменениях, immutable снимки, drift detection. Это **операциональный слой**, который позволяет системе из 22 типов артефактов оставаться **связной** на протяжении долгой эволюции, а не превращаться в кладбище slightly-mismatched документов.
>
> **Почему это «large showcase»:** у тебя в этой зоне сильное вложение (BG continuous extraction, mass-rename, cascade BFS, V-08 terminology, V-11 bi-dir, V-H-04 hash drift, `/product:drift-check`, `/product:patterns`), и индустриальные источники здесь хорошо проработаны (40 лет DDD, 30 лет RTM, 15 лет content-addressed storage). Хороший test-case для функционального покрытия mapping'а.

---

## 07.1 Индустриальный референс

Согласованность артефактов — одна из самых разработанных областей в инженерной литературе. Для PMO с 22 типами артефактов и сложным графом зависимостей можно опираться на четыре традиции:

### 07.1.1 Ubiquitous Language (Domain-Driven Design)

**Eric Evans, *Domain-Driven Design* (2003)** — Blue Book — формулирует central принцип: «Use the model as the backbone of a language. Commit the team to exercising that language relentlessly in all communication within the team and in the code. Use the same language in diagrams, writing, and especially speech.» (DDD Reference §«Ubiquitous Language».)

Канонический failure case: бизнес говорит «Order», код пишет «Purchase», документация пишет «Customer transaction». Каждый раз на границе требуется ментальная трансляция, которая теряет информацию и накапливает баги.

**Vaughn Vernon, *Implementing Domain-Driven Design* (2013)** — Red Book — расширяет: ubiquitous language **не глобальна**; она живёт внутри **bounded context**. На стыке двух bounded contexts работает один из паттернов: Shared Kernel, Customer/Supplier, Conformist, или **Anti-Corruption Layer** (ACL) — translating shim, который защищает внутренний язык от чужого вокабуляра.

Для PMO — ubiquitous language = глоссарий, **с которым обязаны соответствовать** все артефакты. Bounded context для solo + одного продукта = весь `.product/`. На границе с внешними инструментами (cc-sdd, beads) работает ACL — твои adapter'ы.

### 07.1.2 Specification by Example & Living Documentation

**Gojko Adzic, *Specification by Example* (Manning, 2011)** — спецификация существует **в виде примеров**, и эти примеры **исполняются**. Если реальность дрейфует от спецификации — тесты падают. Документация не может тихо устареть.

Применение к PMO: артефакты SC + VC + IC должны быть связаны так, чтобы изменение одного автоматически провоцировало re-validation остальных. Если SC изменился, а VC под него не пересмотрен — это living documentation failure.

### 07.1.3 Bi-directional Traceability & Change Impact Analysis

**Wiegers & Beatty, *Software Requirements*, 3rd ed. (Microsoft Press, 2013)** — глава о **Requirements Traceability Matrix (RTM)** — каноническая в индустрии. Принципы:

- **Forward trace:** для каждого требования — есть ли test? есть ли code? есть ли design element?
- **Backward trace:** для каждого test/code — какое требование оправдывает его существование?
- **Bi-directional:** обе ссылки явные, синхронизированные.
- **Semantic link types:** «verifies», «derives from», «depends on», «conflicts with» — не просто «relates to».

**ISO/IEC/IEEE 29148** (Requirements Engineering standard) — формализует RTM как обязательный артефакт для safety-critical продуктов (DO-178C aerospace, IEC 62304 medical, ISO 26262 automotive). Не «правильная практика» — **прямое требование стандарта**.

**Change impact analysis** (CIA) — практика, привязанная к RTM: при изменении одного artifact'а через RTM находим все downstream-зависимости, помечаем для re-review. **Cascade** в твоей терминологии = CIA через bi-dir refs.

**Foundational paper:** Gotel & Finkelstein (1994) «An Analysis of the Requirements Traceability Problem» — первое систематическое описание проблемы и почему manual RTM всегда дрейфует.

### 07.1.4 Content-addressed Immutable Snapshots

Эта традиция моложе и собрана из соседних областей:

- **Git internals** — каждый commit, tree, blob адресуется sha-1/sha-256. Verify = recompute hash, compare. Drift = recomputed != stored.
- **Nix store** (NixOS, 2003+) — каждый build addressed хешем входов; reproducibility через hash-locking.
- **SLSA framework** (Supply-chain Levels for Software Artifacts, slsa.dev, 2022+) — content-addressed attestations + provenance tracking. Industry-emerging стандарт supply chain integrity.

Канонической single-source книги для «hash-pinned spec snapshots» в PMO-домене **нет**. Это паттерн, перенесённый из soft-engineering supply-chain в spec-engineering — у тебя в `handoff-spec.md` это сделано (V-H-02, V-H-04, drift detection, regeneration trigger).

### 07.1.5 Drift Detection

Также не имеет канонического PMO-источника. Ближайшие аналоги:

- **Infrastructure-as-Code drift detection** (Terraform plan, AWS Config, Pulumi) — сравнение declared state с actual state, при расхождении — alert.
- **Schema migration drift** в БД — Alembic, Flyway имеют команды детекта расхождений.
- **In LLM agents:** «alignment check», «goal re-anchor» — emerging практика; ничего устоявшегося.

Для AI-driven PMO drift detection — двойная задача: (a) статический drift (artifact A изменился, B не пересмотрен), (b) **семантический drift** (артефакты технически согласованы, но direction общего движения отошла от исходного PS/HYP). Твой `/product:drift-check` адресует именно (b) — это **frontier** работа, у индустрии нет согласованного аналога.

---

## 07.2 Перечень функций

| # | Функция | Industry-canonical anchor | Authoritative source | Maturity |
|---|---|---|---|---|
| 1 | Single shared vocabulary across all artifacts | DDD Ubiquitous Language | Evans 2003 ch.2, ch.14; Vernon 2013 ch.1 | MATURE |
| 2 | Vocabulary applied identically in spec and downstream code | DDD Ubiquitous Language extended to code | Evans 2003 ch.4; Cucumber Gherkin docs (BDD) | MATURE |
| 3 | Atomic mass-rename of vocabulary terms with downstream propagation | (нет единого канонического источника — IDE refactoring + DDD principle) | IDE refactoring (Fowler *Refactoring* 1999); DDD «evolving model» principle | MATURE для code, EMERGING для living spec |
| 4 | Synonym detection / consolidation in vocabulary | DDD model evolution; ML in NER (для авто-detect) | Evans 2003 ch.14 «Maintaining Model Integrity»; (нет канонического PMO source) | EMERGING |
| 5 | Bi-directional cross-references with semantic types | RTM (Requirements Traceability Matrix) | Wiegers & Beatty 2013 ch.30; ISO/IEC/IEEE 29148; Gotel & Finkelstein 1994 | MATURE |
| 6 | Auto-fix of one-sided references | (нет единого канонического — RTM tools partially automate) | (Wiegers describes manual; modern tools — Jama, Polarion — automate) | MATURE-ISH |
| 7 | Forward + backward change impact analysis | RTM + CIA | Wiegers ch.30; Aurum & Wohlin *Engineering and Managing Software Requirements* 2005 | MATURE |
| 8 | Cascade with priority ordering (Critical → Strategic → Standard → Confirmation) | CIA practice; safety-critical analysis | DO-178C; ISO 26262 (impact analysis priority) | MATURE для safety-critical |
| 9 | Bundle approve / per-item approve UX | (нет единого канонического — git rebase + interactive staging — closest analogs) | Git interactive staging; Mercurial histedit | MATURE для VCS, EMERGING для living spec |
| 10 | Immutable snapshot with content hashes | Git, Nix, SLSA | git-scm.com; nixos.org; slsa.dev | MATURE для code/build, EMERGING для spec |
| 11 | Drift detection (snapshot hash vs current) | Git verify; Terraform drift detection | git-scm.com (verify-pack, fsck); HashiCorp Terraform docs | MATURE для IaC, EMERGING для spec |
| 12 | Status state for stale snapshots («handoff: stale») | (composite — IaC drift + workflow state machines) | Terraform docs; (нет канонического spec-eng source) | EMERGING |
| 13 | Orphan detection (артефакт без активных consumers) | RTM forward-trace zero hits; dead code detection in IDEs | Wiegers ch.30; LSP tooling | MATURE-ISH |
| 14 | Anti-corruption layer at integration boundary | DDD ACL pattern | Evans 2003 ch.14; Vernon 2013 ch.3 | MATURE |
| 15 | Living documentation (spec that fails when reality diverges) | Specification by Example; living docs | Adzic 2011 ch.10-11; Cucumber docs | MATURE-ISH |
| 16 | Drift detection at semantic level (direction-of-movement) | (нет канонического anchor; emerging in AI agents) | (closest: alignment check in agentic patterns; Anthropic introspection research) | EMERGING / SPECULATIVE |
| 17 | Quiet-mode validation during draft state | (нет канонического — emerging UX pattern in AI tools) | (closest analog: lint deferral until commit; eslint --fix vs CI eslint) | EMERGING |
| 18 | Validation tier system (pilot/mvp/full activation) | (нет единого канонического — composite) | (closest: tiered linting like ruff strict/standard; ESLint config layers) | EMERGING |

**Замечание о maturity:** функции 1-15 — устоявшиеся, опираются на 20-40-летнюю традицию. 16-18 — bleeding edge, твоя реализация во многом — новая работа. Это естественное место для divergence от индустрии и для **более частого review**.

---

## 07.3 Чеклист покрытия

**Шкала покрытия** (см. overview §2.2): **✗ 0** / **◔ 1** / **◐ 2** / **● 3** / **N/A**.

**Маркеры:** `[C]` Conformance / `[F]` Fitness / `[F/C]` гибрид.

**Locus:** **CC** Claude Code primitive / **EXT** External tool / **HYB** Hybrid / **N/A**.

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Single shared vocabulary across all artifacts | ● 3 | `[C]` | CC | BG singleton, cross-cutting, continuous extraction. DDD ubiquitous language **operationalized** через hook-driven candidate detection + V-08 check. |
| 2 | Vocabulary applied identically in spec and downstream code | ◐ 2 | `[C]` | HYB | BG → handoff §3 Terminology с «use these exact names in code/UI/API» guidance. Spec-side coverage full; code-side compliance depends on receiver. Locus HYB because actual code-side enforcement требует EXT tool. |
| 3 | Atomic mass-rename | ◐ 2 | `[F/C]` | CC | `/product:bg:rename` — manual preview workflow в v1; atomic перенесён v1.1 (DEC-DEV-0012). Manual preview covers ~80% function; missing 20% = atomicity при partial failure. Bring-forward trigger: 5+ renames/month. |
| 4 | Synonym detection / consolidation | ● 3 | `[F]` | CC | BG extraction Phase 2 — possible-synonym category (Levenshtein < 3 или shared root → suggest merge). Индустрия не имеет canonical analog для living spec — **fitness contribution**. |
| 5 | Bi-directional cross-references with semantic types | ● 3 | `[C]` | CC | Frontmatter cross-refs (`scenarios[]`, `rules[]`, `lifecycles[]`); semantic types implied via field names. **Caveat:** Wiegers рекомендует explicit «verifies/derives/conflicts/depends» link types. У тебя — на уровне cascade priority. Если расширяется новыми типами связей — стоит вводить explicit `link_type:` поле. |
| 6 | Auto-fix of one-sided references | ● 3 | `[F/C]` | CC | V-11 hook auto-fix: добавить reverse ref если target в active; quiet draft mode skips auto-fix. Industry RTM tools (Jama, Polarion) автоматизируют для commercial; для living markdown spec ты **самостоятельно operationalized**. |
| 7 | Forward + backward change impact analysis | ◐ 2 | `[C]` | CC | `cascade-check.js` PostToolUse hook — detection через bi-dir refs; **full BFS auto-fix отложен v1.1**. Покрытие = 2 (identification полная; resolution beyond V-11 — manual через `/product:cascade --pending`). Сознательный cut DEC-DEV-0012. |
| 8 | Cascade with priority ordering | ● 3 | `[C]` | CC | validation.md §6.2: Critical (BR, IC) → Strategic → Standard → Confirmation. Соответствует safety-critical impact analysis pattern (DO-178C). |
| 9 | Bundle approve / per-item approve UX | ◐ 2 | `[F]` | CC | Discovery Review Checkpoint работает (bundle MR+CA); cascade bundle approve упомянут validation.md §6.3 — full UX отложен v1.1. Manual approve через `/product:cascade --pending` существует. |
| 10 | Immutable snapshot with content hashes | ● 3 | `[C]` | CC | handoff.md frontmatter `artifact_hashes:` (SHA-256 per embedded artifact); V-H-02 🔴 Blocking. Pattern перенесён из git/SLSA в PMO — **fitness contribution в operationalization** (canonical PMO source отсутствует). |
| 11 | Drift detection (snapshot vs current) | ● 3 | `[C]` | CC | V-H-04 🟡 Warning → status=stale; regenerate trigger через `/product:handoff --regenerate`. Direct port Terraform / git verify pattern. |
| 12 | Status state for stale snapshots | ● 3 | `[F/C]` | CC | handoff.status: ready / partial / blocked / stale — first-class field. Composite pattern; fitness в operationalization. |
| 13 | Orphan detection | ● 3 | `[C]` | CC | V-15 🟡 + `/product:cleanup --dry-run`. Direct RTM forward-trace zero hits pattern. |
| 14 | Anti-corruption layer at integration boundary | ● 3 | `[C]` | HYB | Adapter pattern в Integrator (`handoff-to-ccsdd.js` etc.); Universal handoff = внутренний язык Product Module; adapter = ACL. CC for handoff format; EXT for adapter logic — formally HYB. Direct DDD ACL применённый к tool-agnostic архитектуре. |
| 15 | Living documentation (spec fails when reality diverges) | ◐ 2 | `[C]` | CC | V-08 terminology check (bold terms must be in BG); cascade при artifact changes; quiet-draft hooks. **Partially:** spec не падает автоматически когда implementation drifts (только когда другие spec artifacts рассинхронизированы). Полное living documentation требует Integrator + executable verification — Phase 5+. |
| 16 | Drift detection at semantic level | ● 3 | `[F]` | CC | `/product:drift-check` — reads PS + active HYP primary + MVP scope + recent artifacts; produces 🟢/🟡/🔴 direction alignment report. **Frontier work.** SPECULATIVE класс — повышенный review необходим. |
| 17 | Quiet-mode validation during draft state | ● 3 | `[F]` | CC | B2 modification: hooks в quiet mode при status:draft; findings queued в `.product/.pending/`. **Frontier UX pattern**; emerging в AI-driven tooling. |
| 18 | Validation tier system | ● 3 | `[F]` | CC | B1 modification: `validation_tier: pilot \| mvp \| full` в .claude/product.yaml; tier-aware activation V-* правил inline vs queued. Связана с lifecycle stages — fitness extension классической tiered linting practice. |

**Итог по разделу 07:** 13 × ● 3, 5 × ◐ 2, 0 × ◔ 1 / ✗ 0. Locus: 16 × CC, 2 × HYB (#2 vocabulary in code, #14 ACL), 0 × EXT, 0 × N/A.

Из 5 partial:
- **#2 (vocabulary in code)** — locus HYB; полное покрытие требует executable spec validation в external tool, planned Phase 5+
- **#3 (atomic mass-rename)** — сознательный cut с bring-forward trigger v1.1
- **#7 (full cascade impact analysis beyond V-11)** — сознательный cut с bring-forward trigger v1.1
- **#9 (bundle approve UX)** — tied to #7
- **#15 (living docs full)** — depends on Phase 5+ executable verification

**Это самое сильное функциональное покрытие из всех разделов.** Не случайно — ты вкладывался именно сюда. Все partial closing through planned phases (5+ или v1.1), не через рефакторинги архитектуры.

---

## 07.4 Нарративный анализ соответствия

### 07.4.1 BG (Business Glossary) ↔ DDD Ubiquitous Language

> *Что должно быть:* Один словарь, который **обязан** использоваться во всех артефактах identically. Изменение термина в словаре → каскадное обновление всех артефактов. Защита от **terminology drift** (одна и та же сущность называется по-разному в разных артефактах). DDD: ubiquitous language как первоклассный артефакт, актуализируемый постоянно.
>
> *У тебя:* BG (singleton, cross-cutting), continuous extraction через `bg-extractor.js` hook (Phase 1 Candidate Extraction), V-08 (Warning) проверяет, что bold-выделенные термины в SC/BR/LC/IC присутствуют в BG. Mass-rename через `/product:bg:rename` (manual preview). Synonym detection (Levenshtein, shared root) — Phase 2 BG extraction. Per-term `used_in[]` field позволяет mass-rename знать, какие файлы затрагиваются.
>
> *Match с дополнениями.* Это **operationalized** ubiquitous language с тремя fitness-расширениями, которых нет в DDD-каноне:
>
> 1. **Continuous extraction** (auto на каждый save артефакта) — DDD предполагает manual updates глоссария через team conversation; ты автоматизируешь candidate detection.
> 2. **Synonym detection (Levenshtein)** — Evans описывает ad-hoc «found these are the same thing during conversation»; ты автоматизируешь pre-detection.
> 3. **`used_in[]` field per term** — превращает mass-rename из IDE-style refactoring в живой spec refactor.
>
> **Conscious gap (acknowledged):** atomic mass-rename — manual preview в v1, atomic в v1.1. До v1.1 риск: half-migrated state при partial failure. **Mitigation:** single git commit от human после approve preview. Это работает, пока scale небольшой.
>
> **Drift signal в снапшоте:** если в snapshot N+1 V-08 деградирует от Warning до Info («слишком много false positives»), и rate использования `/product:bg:review` снижается — это сигнал terminology drift. Индустрия не имеет precedent'а как с этим работать в living spec; рекомендую при появлении такого сигнала **не** просто downgrade, а понять root cause (extraction чрезмерно chatty? bold-emphasis convention неоднозначна?).

### 07.4.2 Cascade Protocol ↔ RTM + CIA

> *Что должно быть:* При изменении upstream artifact'а — автоматический поиск всех downstream-зависимостей, re-validation, identification of artifacts requiring re-approve. Индустрия: RTM bi-directional traces + CIA priority-ordered processing. ISO/IEC/IEEE 29148 формализует это для safety-critical продуктов.
>
> *У тебя:* `cascade-check.js` (PostToolUse hook) — detection через bi-dir refs; `validation.md §6.2` — priority ordering (Critical → Strategic → Standard → Confirmation); manual navigation `/product:cascade <id>` или `/product:cascade --pending`. Full BFS auto-fix beyond V-11 — **detection-only в v1, full в v1.1**. V-11 (bi-dir consistency) — auto-fix.
>
> *Match с conscious cut.* Покрытие функции **identification** полное и priority-aware. **Resolution** для не-V-11 — manual через navigation. Это **сознательный** cut с rationale в DEC-DEV-0012:
>
> > «Cascade protocol implementation на JS — графовая операция; mitigation: detection-only scope для v1, V-11 auto-fix только.»
>
> Bring-forward trigger в v1.1 — pattern emerges из `cascade-pending.yaml` resolutions: если ты замечаешь, что 5+ раз делал одинаковую manual fix — это сигнал, что auto-fix logic сформировался.
>
> **Что по индустрии должно быть, но у тебя нет:**
>
> - **Semantic link types** (verifies / derives_from / conflicts_with / depends_on) — Wiegers рекомендует. У тебя — implied через field name. Не критично пока, но если граф связей расширяется (новые типы артефактов или новые связи) — стоит вводить.
> - **Visual RTM** — таблица forward × backward. Industry tools (Jama, Polarion) предоставляют. У тебя — нет; есть pmo-mapping.yaml, но это про tool coverage, не artifact-level traces. Manual: при snapshot review можно смотреть `frontmatter.scenarios[]`/`rules[]`/etc. Не критично.
>
> **Drift signal в снапшоте:** если в snapshot N+1 cascade-pending.yaml накапливается без resolution неделями — это сигнал burnout от manual cascade. Это правильный момент для bring-forward auto-fix v1.1.

### 07.4.3 Hash-pinned Handoff ↔ Content-addressed Snapshots (Git/SLSA)

> *Что должно быть:* Артефакт-снапшот, который **immutable** и проверяется на **drift** при любом использовании. Hash mismatch → status=stale, regenerate trigger. Индустрия: git internals (sha-256), Nix store, SLSA framework.
>
> *У тебя:* handoff.md frontmatter `artifact_hashes: sha256:...` per embedded artifact (V-H-02 🔴 Blocking — каждый embed обязан иметь hash); V-H-04 (🟡 Warning → status=stale при mismatch); regeneration через `/product:handoff --regenerate`; previous_version в frontmatter; git хранит history.
>
> *Match.* Это **direct port** content-addressed pattern из supply-chain в spec-engineering. Соответствие индустриальному паттерну сильное, **с уточнением:** в supply-chain hash-locking защищает от подмены или corruption (security-driven); у тебя — от silent drift (consistency-driven). Та же механика, разные threat models.
>
> **Что по индустрии есть, у тебя нет:**
>
> - **Sigstore-style signature** (cryptographic provenance) — overkill для solo, не нужно.
> - **Per-line hashing** (вместо per-artifact) — позволил бы granular drift detection. Не критично пока.
>
> **Drift signal в снапшоте:** если в snapshot N+1 ratio handoff в status=stale растёт, и regeneration rate отстаёт — это сигнал, что handoff'ы не используются как source of truth для receiver, и hash-locking превращается в формальность. Mitigation: review когда последний раз receiver actually consumed handoff после drift detection.

### 07.4.4 `/product:drift-check` ↔ Semantic Drift Detection

> *Что должно быть:* Механизм, который проверяет, **не отошла ли** общая direction экосистемы от исходных PS / primary HYP / MVP scope. Это **семантический** drift, не статический (статический ловится cascade + V-11). Индустрия: **не существует** canonical practice для living spec; ближайшее — alignment check в LLM agents (Anthropic introspection research, Constitutional AI), но это другой scale.
>
> *У тебя:* `/product:drift-check` — on-demand или auto перед `/product:handoff`; skill `drift-detector.md` reads PS + active HYP primary + MVP scope + последние 10 изменённых артефактов; produces direction alignment report (🟢 Aligned / 🟡 Drift signal / 🔴 Significant divergence).
>
> *Frontier match.* Это **fitness contribution**, у которого нет индустриального прецедента в spec-domain. SPECULATIVE класс по maturity caveats (00-overview §6).
>
> **Что заслуживает повышенного review:**
>
> 1. **Какие именно артефакты «recent»?** Last 10 — это эвристика. Может оказаться, что drift нарастает в зоне, которую last-10 не покрывает (например, FM в planned status, не trigger'ятся last-10).
> 2. **Какова baseline для «drift signal»?** Когда LLM выдаёт 🟡 Drift, это true positive или просто LLM consistency variance? Без golden set / regression tests на drift-check невозможно ответить.
> 3. **Self-meta-feedback risk:** drift-detector skill сам — артефакт экосистемы. Если он drifts (например, после Phase 4 он стал чрезмерно chatty или mute), это **sycophancy на мета-уровне** — модель перестала видеть drift, чтобы не огорчать пользователя. Mitigation: при snapshot review проверять, что drift-check продолжает выдавать 🟡 на artificial drift cases (вручную создал тестовый «drift» — детектится?).
>
> **Drift signal в снапшоте для самого drift-check:** если snapshot N+1 показывает значительные изменения в `.product/`, но drift-check всегда 🟢 — подозрительно. Если drift-check всегда 🟡/🔴 — тоже подозрительно (overfit к paranoia).

### 07.4.5 Adapter Pattern ↔ Anti-Corruption Layer (DDD)

> *Что должно быть:* На границе с внешним инструментом — translating shim, который защищает внутренний язык от чужого вокабуляра/формата. DDD ACL pattern.
>
> *У тебя:* Integrator adapters (`.claude/integrator/adapters/handoff-to-<tool>.js`); universal handoff = внутренний язык; adapter = ACL.
>
> *Match.* Чистое portage DDD ACL в PMO/tooling architecture. Strong fit с tool-agnostic principle (DEC-A06).

### 07.4.6 Что в индустрии есть, у тебя НЕ покрыто (intentional или нет)

1. **Bounded contexts beyond `.product/`** — DDD предполагает, что domain делится на несколько bounded contexts с context map'ом. У тебя один продукт = один bounded context, поэтому context map тривиален. **Intentional N/A.** Если в будущем экосистема будет управлять multi-product workspace (упомянуто в v2 candidates) — придётся вводить.
2. **Visual RTM** — нет; есть pmo-mapping.yaml но другого scope. **Intentional partial.** Manual workaround через frontmatter inspection.
3. **Cryptographic signatures на handoff** — нет (только hashes). **Intentional N/A.** Не нужно для solo.
4. **Shared kernel pattern** между ecosystem и пользовательскими проектами — нет. Сейчас templates copy-paste при bootstrap. **Intentional partial.** ECOSYSTEM 3.0 устанавливается как глобальный кэш, не как shared kernel; это разумно, но если нужна more granular sharing — паттерн есть в DDD.

---

## 07.5 Анти-паттерны для отслеживания

1. **Glossary без mass-rename → terminology drift.** Симптомы: BG растёт, но old + new названия одной сущности существуют параллельно. Synonym detection не cleanup'ится. **Источник:** Evans 2003 ch.14 «Maintaining Model Integrity».

2. **Bi-directional ссылки только в одну сторону → orphans.** Симптомы: artifacts переезжают в `.product/.pending/`, но never resurface. V-15 orphan check disabled или тихо ignored. **Источник:** Wiegers ch.30; Gotel & Finkelstein 1994 — RTM dec.

3. **Hashes без verify → false security.** Симптомы: handoff genertal с hashes, но receiver никогда не verify drift. V-H-04 disabled or auto-acknowledged. **Источник:** SLSA framework — hash without provenance check is theatre.

4. **Cascade без auto-fix → manual burnout.** Симптомы: cascade-pending.yaml накапливается, не resolved неделями; user перестаёт открывать `/product:cascade --pending`. **Источник:** Aurum & Wohlin 2005 — manual RTM always drifts.

5. **Immutable snapshot, который не immutable.** Симптомы: handoff regenerated overwrites previous version в же файл без version bump в frontmatter; previous_version не указывает на git history. **Источник:** SLSA hierarchy — immutability requires write-once или explicit versioning.

6. **Living documentation, которая не living.** Симптомы: V-08 terminology check downgrades to Info; SC меняются, VC под ними не пересматриваются (V-07 false positive accepted). **Источник:** Adzic 2011 ch.10-11 — living docs failure mode.

7. **Drift-check ratio always 🟢 OR always 🟡/🔴.** Симптомы (как в §07.4.4) — sycophancy / overfit. **Источник:** Sharma 2023; Anthropic introspection research.

8. **Adapter, который не is ACL.** Симптомы: adapter mutates `.product/` (write upstream); adapter passes external tool concepts back into Product Module artifacts. **Источник:** Vernon 2013 ch.3 — ACL as one-way translation.

9. **Validation tier abuse — все на pilot forever.** Симптомы: tier never upgrades (mvp / full); rules стали permanently disabled через pilot tier rather than override. **Источник:** (нет канонического, derived from tiered linting practice).

10. **Synonym detection как noise, а не signal.** Симптомы: synonym warnings dismissed массово; synonym candidates never merge. **Источник:** аналог DDD model integrity — synonym debt накапливается.

---

## 07.6 Сигналы для сравнения снапшотов

При diff'е snapshot N+1 vs N в зоне consistency mechanisms — конкретные вопросы:

### Vocabulary / BG

1. **BG size growth rate.** Растёт ли BG примерно proportional количеству artifacts? Если BG flat при росте artifacts — extraction broken. Если BG растёт быстрее artifacts — synonym debt.
2. **`used_in[]` populated?** Каждый BG term должен иметь non-empty `used_in[]`. Empty — кандидат на orphan deprecation.
3. **V-08 terminology check status.** Severity всё ещё Warning? Не downgrade'нут? Не disabled per-project через `validation_overrides`?
4. **Mass-rename frequency.** Использовался ли `/product:bg:rename` за период? Если 0 раз — либо нет drift (well), либо drift не детектится. Если 5+ раз — bring-forward trigger v1.1 atomic.
5. **BG version numbers.** Инкрементируются (значит mass-renames происходят)? Что в frontmatter `deprecated_terms[]` — растёт?

### Cross-references

6. **V-11 auto-fix invocations.** Hook отрабатывает? Errors в `.claude/hooks/*.log`?
7. **Asymmetric refs detected by `/product:patterns`.** Counts? Растут или падают?
8. **`cascade-pending.yaml` size.** Растёт без resolution? Это burnout signal.
9. **Semantic link types.** Появились ли явные `link_type:` поля? Это extension в сторону Wiegers RTM. Если да — есть рационал?

### Hash-locking & drift

10. **handoff status distribution.** Сколько ready / partial / blocked / stale? stale rate растёт — handoff не regenerated после `.product/` changes; это drift в действии.
11. **Time between artifact change и handoff regenerate.** Длится дни-недели — handoff не работает как living snapshot.
12. **V-H-02 / V-H-04 firing rate.** Validation pass / fail counts.

### Drift detection (semantic)

13. **`/product:drift-check` invocation rate.** Auto перед handoff срабатывает? Manual invocations?
14. **Distribution of drift-check verdicts.** 🟢:🟡:🔴 ratio. Если всегда 🟢 — подозрительно (sycophancy на мета-уровне). Если всегда 🟡/🔴 — overfit к paranoia.
15. **Resolution actions от drift detection.** Что делаешь когда видишь 🟡? Записывается ли это в DEV_JOURNAL? Если drift-check выдаёт сигналы, но действий не следует — система drifts despite knowing it drifts.

### Living documentation

16. **V-08 + V-07 + V-MK-01 firing rates.** Эти три — основные «реальность драфтов несинхронна с примерами» проверки. Тренды?
17. **`requires_review` status appearances.** При cascade-detected impact, downstream артефакт получает `requires_review`. Сколько живут в `requires_review` без resolution?

### Anti-corruption / adapters

18. **Adapter count в `.claude/integrator/adapters/`.** При росте — новые external tools (good); при падении — упрощение (good if conscious).
19. **Adapter changes log (через git).** Адаптеры эволюционируют по мере изменения handoff schema или external tool API. Если адаптер меняется одновременно с upstream `.product/` artifact's frontmatter — handoff schema, возможно, должна быть формализована (что в roadmap не упомянуто).

### Validation tier system

20. **Active tier per project.** pilot / mvp / full?
21. **Tier upgrade events.** Когда последний tier upgrade произошёл? Это **сознательное** решение, или drift?
22. **Per-rule overrides count.** Сколько правил в `validation-config.yaml` с downgrade severity? Это легитимные fitness adjustments или quiet acceptance of debt?

---

## 07.7 Связи с другими разделами

- **§04 Functional Artifact Coverage** — BG, cascade, hash-locking упоминаются там как механизмы, поддерживающие отдельные артефакты. Здесь — как самостоятельные механизмы.
- **§06 Validation & Quality Safeguards** — V-* правила (V-08, V-11, V-14a, V-15, V-H-*) часть consistency mechanisms. Здесь — функциональный взгляд; там — каталог самих правил.
- **§09 Handoff & Tool-agnostic Delegation** — adapter pattern как ACL раскрывается там детальнее. Здесь — упоминается в контексте consistency.
- **§11 Meta-governance** — `/product:meta-feedback`, `/product:patterns`, `/product:drift-check` обсуждаются там как self-improvement mechanisms. Здесь — как drift detection.

---

**Конец раздела 07.**
