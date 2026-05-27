# Local Docs Polish Plan

> **Что:** light-touch documentation improvement track. Заменяет deferred Phase D Wiki initiative.
>
> **Почему:** phantom-audience guard fired. Pre-pilot Ecosystem 3.0 не имеет реальных end-user/stakeholder consumers — единственная audience сейчас solo dev. Непропорционально инвестировать 32-50ч в 3-audience MkDocs wiki, когда 80% value достижимо через 3-12ч Obsidian + README polish.
>
> **Создан:** 2026-05-27 (planning session, pivot from Phase D).
>
> **Source of truth для deferred Phase D:** [`dev/PHASE_D_IMPLEMENTATION_PLAN.md`](PHASE_D_IMPLEMENTATION_PLAN.md) (DEFERRED banner) + [`dev/wiki-design.md`](wiki-design.md) (design preserved).
>
> **Bring-forward triggers** для возврата к full Phase D wiki:
> - First real end-user feedback / ask «where do I start»
> - Stakeholder asks for shareable URL
> - Solo dev обнаруживает Obsidian недостаточным (e.g., audience-tagging нужен, cross-tool sharing)
> - Ecosystem 3.0 готовится к public release (>2 weeks horizon)

---

## Стратегические принципы

1. **Phantom-audience guard** — не строить инфраструктуру для несуществующих consumers. Возвращаться к Phase D wiki **только** при появлении конкретного триггера выше.
2. **Local-first** — все артефакты живут в репо как обычные markdown файлы. Obsidian просто **обогащает чтение/навигацию**, не диктует формат.
3. **GitHub-compatible** — все markdown остаётся валидным GitHub-render'ом. `[[wiki-links]]` используем минимально (Obsidian fallback'ит на relative paths нормально, GitHub их не рендерит — поэтому где critically важно для GH browse, оставляем relative).
4. **Reversible** — если pivot оказался ошибкой, всё можно откатить за <1ч (delete .obsidian/, revert polish commits).

---

## Stage 1 — Pivot recording (~30 min)

**Deliverable:** decisions + status updates committed

- [ ] 1.1 DEV_JOURNAL DEC-DEV-NNNN entry:
  - Title: «Pivot from Phase D wiki to local docs polish»
  - Rationale: phantom-audience guard, audience reality check
  - Decision: defer Phase D, pursue Obsidian+README track
  - Bring-forward triggers (см. выше)
  - Reversibility note
- [ ] 1.2 Add DEFERRED banner на `dev/PHASE_D_IMPLEMENTATION_PLAN.md` (done в этой сессии)
- [ ] 1.3 Add DEFERRED banner на `dev/PHASE_D_DOCS_WIKI_READINESS.md` — со ссылкой на новый план
- [ ] 1.4 Update `dev/v1_1_backlog.md`:
  - Add «Phase D — Wiki initiative» как deferred item
  - Originally planned: 2026-05-26 design freeze
  - Defer date: 2026-05-27
  - Defer rationale: phantom-audience pre-pilot
  - Bring-forward triggers (full list)
  - Estimated effort на возврат: 32-50ч (unchanged from design)
- [ ] 1.5 Update `ROADMAP.md`:
  - Phase D строки 63-64: статус → ⏸ deferred to v1.1+
  - Add brief note: «pivoted to local docs polish — см. `dev/LOCAL_DOCS_POLISH_PLAN.md`»
  - «Где мы сейчас» reflect pivot
- [ ] 1.6 Update `CLAUDE.md` «Где мы сейчас» snapshot:
  - Phase 5.1 done (unchanged)
  - Phase D status → ⏸ deferred
  - Next: local docs polish (this plan)
- [ ] 1.7 **Commit:** `docs: defer Phase D wiki, pivot to local docs polish (DEC-DEV-NNNN)`

---

## Stage 2 — Obsidian vault setup (~1-2ч)

**Deliverable:** repo opens as Obsidian vault; graph view функционален

### 2.1 — Vault scope decision

- [ ] Default: **whole repo as vault** (root = `claude-ecosystem-3.0/`)
- [ ] Reasoning: graph view хочет видеть все cross-references; commands/, skills/, hooks/ всё взаимосвязаны
- [ ] Alternative considered: только `docs/` + `dev/` + root .md — rejected, обрезает 60% графа

### 2.2 — Install Obsidian

- [ ] Если не установлен — download obsidian.md/download
- [ ] Open vault → выбрать `claude-ecosystem-3.0/` root

### 2.3 — `.obsidian/` config strategy

- [ ] **Decision:** commit baseline config (theme, plugins, graph settings) для воспроизводимости; gitignore per-session UI state
- [ ] Update `gitignore.template` (если шипуется end-user проектам — добавить Obsidian patterns)
- [ ] Update repo `.gitignore`:
  ```
  # Obsidian per-user state (vault config committed; UI state per-machine)
  .obsidian/workspace.json
  .obsidian/workspace-mobile.json
  .obsidian/graph.json
  ```

### 2.4 — Plugin configuration (core only — minimal)

- [ ] Enable: Backlinks, Outline, Tag pane, Graph view, Page preview
- [ ] Disable noise: Daily notes, Audio recorder, Random note
- [ ] Skip community plugins на этой итерации (избегать lock-in)

### 2.5 — Graph view tuning

- [ ] Exclude noise: `node_modules`, `_archive`, `.product`, `*.template`
- [ ] Color groups (если ROI ясен):
  - DEC-DEV entries — синие
  - SPEC.md files — зелёные
  - Phase docs — оранжевые

### 2.6 — Spot-check

- [ ] Open `ROADMAP.md` в Obsidian — backlinks panel показывает страницы, которые ссылаются на ROADMAP
- [ ] Open `DEV_JOURNAL.md` — anchor-навигация работает через outline
- [ ] Open `CLAUDE.md` — все relative paths кликабельны

### 2.7 — Commit

- [ ] **Commit:** `feat(docs): obsidian vault baseline config + gitignore patterns`

---

## Stage 3 — README + cross-link polish (~2-6ч)

**Deliverable:** «front door» discoverability улучшен

### 3.1 — Inventory existing entry points

- [ ] Audit:
  - `README.md` (root)
  - `CLAUDE.md`
  - `BOOTSTRAP.md`
  - `INSTALL-HUMAN.md`
  - `ROADMAP.md`
  - `DEV_JOURNAL.md`
  - `CHANGELOG.md`
  - `docs/product-module/SPEC.md`
  - `docs/integrator-module/SPEC.md`
  - `docs/design-module/SPEC.md`
  - `docs/pmo/pmo-map.md`
  - `docs/pmo/processes.md`
  - `docs/pmo/validation.md`
  - `docs/pmo/artifacts/README.md`
- [ ] Identify: какие из них **dead-end** (нет cross-link обратно), какие **орфаны**

### 3.2 — README.md root — «Start here» upgrade

- [ ] Top-of-file: tri-audience navigation block:
  ```
  ## Where to start
  
  - 🤔 **First time?** → mental model + 5-min overview → CLAUDE.md
  - 🔧 **Want to install?** → BOOTSTRAP.md → INSTALL-HUMAN.md
  - 📖 **Building features?** → ROADMAP.md «Где мы сейчас» + DEV_JOURNAL latest
  - 🧠 **Understanding decisions?** → DEV_JOURNAL.md (DEC-DEV-XXXX entries)
  - 📚 **API/module reference?** → docs/<module>/SPEC.md
  ```
- [ ] Уже существует partially? — augment, не дублировать

### 3.3 — docs/README.md — create index

- [ ] Если отсутствует — создать как entry-point для `docs/`:
  - One paragraph: «docs/ contains SPEC and PMO catalogs — source-of-truth для архитектуры»
  - Table of module SPECs с one-line описанием
  - Link на `docs/pmo/pmo-map.md` как «PMO carte starting point»

### 3.4 — Module SPECs — «Related» block

- [ ] Каждый `docs/<module>/SPEC.md` верх — block «Related docs»:
  - Peer SPECs (другие модули)
  - PMO artifacts touched (cross-link to `docs/pmo/artifacts/<artifact>.md`)
  - Closest DEV_JOURNAL DEC-DEV entries

### 3.5 — PMO catalog discoverability

- [ ] `docs/pmo/pmo-map.md` (тот, что ты открыл в IDE) — top section: navigation table «5 processes → ссылки на processes.md sections»
- [ ] `docs/pmo/processes.md` — каждая секция процесса заканчивается «See artifacts: [PS]([[ps]]), [HYP]([[hyp]])» (минимально invasive — Obsidian резолвит, GitHub gracefully shows as text)

### 3.6 — DEV_JOURNAL anchor navigation

- [ ] Verify все DEC-DEV-XXXX entries имеют consistent heading format (`## DEC-DEV-0044 — Title`)
- [ ] Это уже convention; check для последних entries
- [ ] Obsidian тогда показывает каждый DEC-DEV как node в графе через outline

### 3.7 — Cross-link sanity sweep

- [ ] Grep broken relative links: `grep -rn "\[.*\](.*\.md)" docs/ dev/ | <verify each>`
- [ ] Fix any 404s found

### 3.8 — Commit (или 2-3 commits если работа sequential)

- [ ] **Commit:** `docs: cross-link polish for obsidian navigability + onboarding`

---

## Stage 4 — (Optional, deferred by default) MCP bridge (~1-2ч)

> **Status:** deferred unless concrete need surfaces.

**Когда включить:**
- Claude (через Code) уже отлично читает файлы напрямую — встроенный Read tool
- MCP bridge для Obsidian имел бы смысл если AI нужны: backlinks pane, graph data, или specific Obsidian-only metadata
- На текущей итерации — **не нужен**

**Если в будущем понадобится:**
- [ ] 4.1 Research available Obsidian MCP servers
- [ ] 4.2 Setup + configure
- [ ] 4.3 Verify Claude может query backlinks / graph

---

## Stage 5 — Closure (~30 min)

**Deliverable:** track formally closed, next-step clarity

- [ ] 5.1 CHANGELOG.md — Modified section:
  ```
  ## [Unreleased]
  ### Modified
  - Docs: cross-link polish, Obsidian vault baseline config (DEC-DEV-NNNN). 
    Pivoted from Phase D wiki (deferred to v1.1+ — phantom-audience guard).
  ```
- [ ] 5.2 Memory MCP sync:
  - `project_ecosystem_status.md` — update «Next» с «local docs polish done, Phase D deferred»
  - No architecture change (no new modules / hooks / skills) — `project_ecosystem_architecture.md` unchanged
- [ ] 5.3 DEV_JOURNAL DEC-DEV-NNNN closure entry — findings:
  - Что worked
  - Что не worked
  - Lessons (особенно: помогло ли это решение реально или decoration?)
- [ ] 5.4 Decision на next step:
  - Phase 5 S5 runtime verification (deferred хвост Phase 5.1) — closable now?
  - Phase 6 conditional (Design Module) — есть ли trigger (first UI feature)?
  - Что-то ещё из ROADMAP
- [ ] 5.5 **Commit:** `docs: local docs polish closure (DEC-DEV-NNNN)`

---

## Total estimate

| Stage | Hours |
|---|---|
| 1. Pivot recording | 0.5 |
| 2. Obsidian setup | 1-2 |
| 3. README + cross-link polish | 2-6 |
| 4. MCP bridge (deferred) | 0 |
| 5. Closure | 0.5 |
| **Total** | **4-9ч** |

Per ×2-4 множитель — **8-18ч realistic** (но scope меньше, так что multiplier тоже меньше; expect ближе к ×1.5).

---

## Definition of Done

- [ ] Obsidian opens репо как vault; graph view показывает meaningful connections
- [ ] Future-you (или новый contributor) находит «where to start» <30 секунд от root README
- [ ] DEC-DEV entries cross-reference корректно через Obsidian backlinks
- [ ] ROADMAP + CLAUDE.md + DEV_JOURNAL + v1_1_backlog обновлены
- [ ] v1_1_backlog имеет Phase D wiki с explicit bring-forward triggers
- [ ] Phase D plan + readiness gate marked DEFERRED (banners)
- [ ] Все relative cross-links резолвятся (no 404s)

---

## What's explicitly NOT included

(All from full Phase D design — deferred to bring-forward triggers):
- ❌ Public URL (GH Pages)
- ❌ Audience-tagging admonitions
- ❌ Auto-sync GitHub Action
- ❌ Charter discipline (immutability, append-only)
- ❌ `/ecosystem:docs-init|update|verify` commands
- ❌ `wiki-author|source-mapper|drift-detector` skills
- ❌ `protect-wiki-charter` hook
- ❌ MkDocs config + deploy workflow
- ❌ ~25 wiki narrative pages
- ❌ Decisions wiki таблица
- ❌ End-user / stakeholder onboarding artifact

**Если что-то из этого реально потребуется** — это сигнал bring-forward trigger fired, и мы возвращаемся к [`dev/PHASE_D_IMPLEMENTATION_PLAN.md`](PHASE_D_IMPLEMENTATION_PLAN.md).

---

## Risks (minor — this is light-touch)

| # | Risk | Mitigation |
|---|---|---|
| L1 | Obsidian config diverges between machines | gitignore workspace.json, commit minimal baseline |
| L2 | `[[wiki-link]]` использование ломает GitHub rendering | Использовать минимально, в основном relative paths |
| L3 | Cross-link polish revealed serious doc rot | Treat как separate sweep — выйти из Stage 3 если scope explodes |
| L4 | Phase D deferral оказался ошибкой через месяц | Bring-forward trigger documented; полный план сохранён; 1-2 week response time |

---

## References

- [`dev/PHASE_D_IMPLEMENTATION_PLAN.md`](PHASE_D_IMPLEMENTATION_PLAN.md) — full Phase D plan (DEFERRED)
- [`dev/PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md) — Phase D readiness gate (DEFERRED)
- [`dev/wiki-design.md`](wiki-design.md) — full wiki design (preserved для bring-forward)
- [`dev/v1_1_backlog.md`](v1_1_backlog.md) — где Phase D будет жить как deferred item
- [`CLAUDE.md`](../CLAUDE.md) §4 «Cuttable scope» — обоснование подхода
