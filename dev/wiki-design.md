# Phase D — Wiki Design Document

> **Назначение:** полный design doc для интерактивной документации по самой Ecosystem 3.0 в Confluence-like стиле через MkDocs Material + защищённый Charter + auto-sync GitHub Action.
>
> **Статус:** design frozen 2026-05-26 (design conversation). Implementation — Phase D, заблокирован Phase 5 closure ritual (см. [`PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md)).
>
> **Audience:** developer, который будет реализовывать Phase D (включая будущего себя в next session).
>
> **НЕ путать с:** документацией для END-USER проектов (через Ecosystem 3.0). Этот wiki — про **саму экосистему**.

---

## §1. Mission, audiences, format

### Mission

Создать единый интерактивный документационный слой для Ecosystem 3.0 как продукта (meta-tooling над Claude Code). Wiki обслуживает три аудитории одновременно, оставаясь актуальной за счёт частичной автоматизации синхронизации с кодом + Charter, который ограничивает деградацию через AI-editing.

### Аудитории (multi-select из design conversation)

| Аудитория | Цель | Тон |
|---|---|---|
| Solo dev (я сам) | Внешняя память: где что лежит, какие decisions, текущий статус | Internal, можно жаргон |
| End-users Ecosystem 3.0 | Onboarding + reference: как использовать команды, что делают модули | Formal, без assumed context |
| Stakeholders / показ наружу | Концепция + progress: что это, зачем, где сейчас | Marketing-ish, концептуальные диаграммы |

**Подход:** одна wiki, audience-aware через MkDocs admonitions (`!!! note "for-stakeholders"`, `!!! tip "for-internal"`). Без раздельных секций per audience — естественная прогрессия overview → guide → reference → internals.

### Формат

**MkDocs Material** (Python-based SSG). Причины выбора (vs Docusaurus):
- Меньше moving parts (нет npm-deps, нет MDX)
- Faster dev-serve
- Admonitions для audience-tags из коробки
- Mermaid через plugin
- mike plugin для versioning (если понадобится — сейчас deferred)
- Deploy на GitHub Pages в 1 action

**Versioning:** только current (без mike). По CLAUDE.md «6. Backwards compatibility пока не важна» — solo dev, нет внешних users до PILOT POINT.

### Истина

Wiki — **narrative-слой со ссылками** на source-of-truth артефакты (SPEC.md, README.md, DEV_JOURNAL.md, ROADMAP.md). НЕ aggregator (не дублирует body), НЕ reading-order (не просто навигация).

Пример: `docs/wiki/concepts/modules.md` содержит краткое narrative-описание Product Module + ссылку на `docs/product-module/SPEC.md` как primary reference. Не копирует body SPEC'а.

---

## §2. Charter — структура и расположение

### Расположение

`dev/wiki-charter.md` — **вне** `docs/wiki/**` build. Charter не рендерится в SSG как страница wiki. Это process-документ, читаемый командами и hook'ом.

**Rationale:**
- Чистое разделение «process» (как поддерживать wiki) vs «product» (сам wiki контент)
- Charter содержит internal-правила про AI (immutability markers, exclusion patterns) — не для внешних readers
- `dev/` уже established convention для internal docs (per CLAUDE.md «Repository structure»)

### Внешний вид

Каждая секция Charter обёрнута HTML-комментариями со маркерами mutability. Hook (`protect-wiki-charter.js`) парсит эти маркеры и решает, блокировать ли AI-правку.

```markdown
<!-- charter-section: mission, mutability: immutable -->
## 1. Mission & audiences
...
<!-- /charter-section -->

<!-- charter-section: taxonomy, mutability: append-only -->
## 2. Wiki taxonomy
...
<!-- /charter-section -->
```

### 8 секций (frozen на момент design freeze)

| # | Секция | Mutability | Содержимое |
|---|---|---|---|
| 1 | Mission & audiences | **immutable** | Зачем wiki, для кого, какой тон per audience |
| 2 | Wiki taxonomy | **append-only** | Иерархия `docs/wiki/**`; можно добавлять секции, нельзя удалять/переименовывать |
| 3 | Source-to-target map | **append-only** | Таблица «source pattern → wiki target → action»; можно добавлять mappings |
| 4 | Exclusion list | **append-only** | Paths и commit patterns, которые НЕ триггерят wiki sync |
| 5 | Anti-patterns | **immutable** | Что НЕ писать в wiki (no duplicate SPEC body, no WIP, etc.) |
| 6 | Page templates | **immutable** | Inline templates per page type (concept / reference / guide / decision-index) |
| 7 | Audience tagging conventions | **immutable** | Как использовать admonitions (`!!! note "for-stakeholders"` etc.) |
| 8 | Versioning policy | **immutable** | Только current; bring-forward criteria для mike |

### Логика «append-only»

Hook должен различать:
- ✅ **Pure addition** — old_string полностью присутствует в new_string как substring; new_string = old + appended content. Разрешено.
- ❌ **Modification existing** — old_string изменён в new_string. Blocked.
- ❌ **Removal** — old_string присутствует в файле, но не в new_string. Blocked.

Pseudocode для проверки:
```javascript
function isStrictAppend(old_string, new_string) {
  // new_string должен начинаться с old_string и иметь дополнения
  if (!new_string.startsWith(old_string.trim())) return false;
  const appended = new_string.slice(old_string.length);
  return appended.length > 0;
}
```

**Edge case:** правки в middle of section (например, добавить mapping между двумя существующими) — могут быть legitimate, но трудно отличить от modification. Подход: append-only означает только в конец секции; для middle-insert — нужен `[charter-change]` tag.

---

## §3. Wiki taxonomy (canonical structure)

```
docs/wiki/
├── index.md                       # Stakeholder landing — что/зачем/status badge
├── getting-started/
│   ├── index.md                   # Section overview
│   ├── install.md                 # /ecosystem:bootstrap walkthrough
│   ├── first-product.md           # /product:init → /product:plan workflow
│   └── mental-model.md            # 4 модуля + PMO + D7 как концепция
├── concepts/
│   ├── index.md
│   ├── pmo-overview.md            # PMO carte, 22 артефакта, 5 процессов (cross-link к docs/pmo/)
│   ├── modules.md                 # Product/Design/Integrator/Orchestrator (per-section narrative)
│   ├── artifacts.md               # Catalog 22 типов с описанием namespace и lifecycle
│   ├── processes.md               # 5 процессов overview
│   ├── handoff.md                 # Tool-agnostic delegation механика
│   └── d7-meta.md                 # Methodology layer (kickoff/closure, patterns)
├── reference/
│   ├── index.md
│   ├── commands.md                # Auto-generated table из commands/**/*.md (group by namespace)
│   ├── skills.md                  # Auto-generated table из skills/**/*.md
│   ├── agents.md                  # Auto-generated table из agents/**/*.md
│   ├── hooks.md                   # Auto-generated table из hooks/**/manifest.yaml
│   └── adapters.md                # Auto-generated table из adapters/*.js
├── guides/
│   ├── index.md
│   ├── bootstrap.md               # Full setup walkthrough (extends getting-started/install.md)
│   ├── add-integrator.md          # /integrator:add deep guide
│   ├── write-skill.md             # Skill convention guide (per DEC-DEV-0012)
│   └── troubleshoot.md            # Common issues + solutions
├── decisions/
│   └── index.md                   # ТАБЛИЦА: DEC-ID → title → date → ссылка на DEV_JOURNAL.md anchor
└── roadmap/
    ├── index.md                   # Mirror "Где мы сейчас" из ROADMAP.md
    └── phase-history.md           # Archived phases с links на closure DEC-DEV entries
```

**Соглашения:**
- Каждая поддиректория содержит `index.md` как entry-point
- Cross-links между wiki-страницами через relative paths (`../concepts/modules.md`)
- Links на source-of-truth — через relative paths за пределы wiki (`../../../docs/product-module/SPEC.md`)
- Audience admonitions помечают параграфы для специфической аудитории (по умолчанию контент для всех)

---

## §4. Source-to-target map (Charter §3)

Полная таблица mappings. Каждая запись — YAML-структура в Charter секции 3.

```yaml
mappings:
  # Reference pages — auto-regenerated indexes
  - source: "commands/**/*.md"
    target: "docs/wiki/reference/commands.md"
    action: regenerate-index
    grouping: by-namespace            # ecosystem: / product: / integrator: / design:
    fields_from_frontmatter: [description]

  - source: "skills/**/*.md"
    target: "docs/wiki/reference/skills.md"
    action: regenerate-index
    grouping: by-module

  - source: "agents/**/*.md"
    target: "docs/wiki/reference/agents.md"
    action: regenerate-index

  - source: "hooks/**/manifest.yaml"
    target: "docs/wiki/reference/hooks.md"
    action: regenerate-table
    columns: [name, event, matcher, module]

  - source: "adapters/*.js"
    target: "docs/wiki/reference/adapters.md"
    action: regenerate-list
    metadata_from: "// @adapter-meta" comment block

  # Concepts — section updates (не regeneration, чтобы сохранить narrative)
  - source: "docs/product-module/SPEC.md"
    target: "docs/wiki/concepts/modules.md"
    action: update-section
    section_marker: "<!-- module: product -->"
    update_strategy: "refresh-summary"   # 2-3 sentence summary из § H2 SPEC.md
    cross_link: true                     # ensure ../docs/product-module/SPEC.md link present

  - source: "docs/integrator-module/SPEC.md"
    target: "docs/wiki/concepts/modules.md"
    action: update-section
    section_marker: "<!-- module: integrator -->"
    update_strategy: "refresh-summary"

  - source: "docs/design-module/SPEC.md"
    target: "docs/wiki/concepts/modules.md"
    action: update-section
    section_marker: "<!-- module: design -->"
    update_strategy: "refresh-summary"

  - source: "docs/pmo/pmo-map.md"
    target: "docs/wiki/concepts/pmo-overview.md"
    action: cross-link-refresh
    update_strategy: "verify-link-targets"   # check, что упомянутые в wiki артефакты ещё существуют

  - source: "docs/pmo/artifacts/**/*.md"
    target: "docs/wiki/concepts/artifacts.md"
    action: regenerate-catalog
    fields_from_frontmatter: [name, namespace, lifecycle]

  - source: "docs/pmo/processes.md"
    target: "docs/wiki/concepts/processes.md"
    action: cross-link-refresh

  - source: "docs/product-module/handoff-spec.md"
    target: "docs/wiki/concepts/handoff.md"
    action: cross-link-refresh

  - source: "dev/meta-improvement/**/*.md"
    target: "docs/wiki/concepts/d7-meta.md"
    action: cross-link-refresh
    update_strategy: "list-checklists-and-patterns"

  # Decisions — append-only index
  - source: "DEV_JOURNAL.md"
    target: "docs/wiki/decisions/index.md"
    action: append-new-decisions
    detect_pattern: "^## DEC-DEV-(\\d{4})"
    columns: [id, title, date, summary_first_sentence, journal_anchor]

  # Roadmap — section sync
  - source: "ROADMAP.md"
    target: "docs/wiki/roadmap/index.md"
    action: sync-section
    source_section: "## Где мы сейчас"
    target_section: "<!-- where-we-are -->"

  # Status — landing page update
  - source: "CHANGELOG.md"
    target: "docs/wiki/index.md"
    action: update-status-block
    source_pattern: "^## \\[(\\d+\\.\\d+\\.\\d+)\\]"  # latest version
    target_section: "<!-- current-version -->"
```

### Mapping actions — semantics

| Action | Поведение |
|---|---|
| `regenerate-index` | Полная перезапись target page из current state source files. Подходит для reference pages (нет narrative, чисто table) |
| `regenerate-table` | Аналогично, но строит table с указанными columns |
| `regenerate-list` | Аналогично, простой bullet-list |
| `regenerate-catalog` | Для artifacts: rebuild catalog с per-artifact entries |
| `update-section` | Заменить только marker-делимитированную секцию в target; не трогать narrative вокруг |
| `cross-link-refresh` | Проверить, что cross-links в target резолвятся; если source moved/renamed — update reference |
| `sync-section` | Точечный copy секции из source в target (mirror) |
| `update-status-block` | Update маленький status badge/block; preserves остальной контент |
| `append-new-decisions` | Append-only: добавляет новые entries, не трогает existing |

---

## §5. Exclusion list (Charter §4)

```yaml
excluded_paths:
  - "dev/**"                       # internal phase docs
  - ".product/**"                  # если когда-нибудь dogfood
  - "_archive/**"
  - "**/fixtures/**"               # test fixtures
  - "**/*.test.*"
  - "docs/wiki/**"                 # anti-cycle (наш target)
  - "dev/wiki-charter.md"          # protected charter
  - ".github/**"                   # workflows не triggers wiki
  - "node_modules/**"
  - "*.template"                   # template файлы
  - ".env*"
  - "*.lock"                       # package-lock и т.п.
  - "**/.last-sync"                # state markers

excluded_commit_message_patterns:
  - "^docs\\(wiki\\):"             # anti-cycle (наш auto-sync коммит)
  - "\\[skip-docs\\]"
  - "^wip:"                        # work in progress
  - "^chore\\(deps\\):"            # dependency bumps

heuristics:
  - name: "typo-only-diff"
    skip_if:
      total_diff_lines: "<10"
      AND_no_new_files: true
      AND_only_changed_files_match: ["**.md"]

  - name: "single-line-comment-only"
    skip_if:
      total_diff_lines: "<5"
      AND_only_changed_lines_match: "^(\\s*//|\\s*#)"
```

### Зачем такая жёсткая фильтрация

1. **Cost control** — каждый Action run = call headless Claude = credits
2. **PR noise control** — каждый auto-PR требует моего review
3. **Anti-cycle** — без exclusion `docs/wiki/**` + commit-msg-filter Action будет триггерить себя

---

## §6. Hook logic — `protect-wiki-charter.js`

### PreToolUse hook (Edit/Write/NotebookEdit)

**Расположение:** `hooks/ecosystem/protect-wiki-charter.js` + entry в `hooks/ecosystem/manifest.yaml`.

**Pseudocode:**

```javascript
// @event PreToolUse
// @matcher tool=Edit|Write|NotebookEdit
// @scope ecosystem

const CHARTER_PATH = "dev/wiki-charter.md";

function main(input) {
  const { tool_name, tool_input } = input;
  const filePath = tool_input.file_path || "";

  if (!filePath.endsWith("wiki-charter.md")) {
    return { allow: true };
  }

  if (tool_name === "Write") {
    return {
      allow: false,
      reason: "Charter file is protected. Full rewrite by AI is not permitted. " +
              "Use Edit for append-only sections only. For immutable sections, " +
              "user must edit manually with [charter-change] commit tag."
    };
  }

  if (tool_name === "Edit") {
    const { old_string, new_string } = tool_input;
    const charterContent = readCharterContent(filePath);
    const section = locateSection(charterContent, old_string);

    if (!section) {
      return {
        allow: false,
        reason: "Edit doesn't match any tagged Charter section. " +
                "All Charter content must be within <!-- charter-section: NAME, mutability: X --> markers. " +
                "If you're trying to add a new section, that's a [charter-change] operation requiring user action."
      };
    }

    if (section.mutability === "immutable") {
      return {
        allow: false,
        reason: `Section "${section.name}" is marked immutable. ` +
                `Manual user edit required, with [charter-change] commit tag and DEV_JOURNAL entry.`
      };
    }

    if (section.mutability === "append-only") {
      if (!isStrictAppend(old_string, new_string)) {
        return {
          allow: false,
          reason: `Section "${section.name}" is append-only. ` +
                  `Detected modification or removal of existing content. ` +
                  `Only pure addition (new entries at end of section) is permitted.`
        };
      }
      return { allow: true };
    }

    return { allow: true };
  }

  return { allow: true };
}

function locateSection(content, old_string) {
  // Parse <!-- charter-section: NAME, mutability: X --> markers
  // Return { name, mutability, start, end } if old_string is within a section
  // ...
}

function isStrictAppend(old_string, new_string) {
  const trimmedOld = old_string.trim();
  return new_string.startsWith(trimmedOld) && new_string.length > trimmedOld.length;
}
```

### Defence-in-depth — git pre-commit hook

**Расположение:** `hooks/ecosystem/git-precommit-charter.sh` + installation instructions в `dev/wiki-design.md` (этом файле).

```bash
#!/usr/bin/env bash
# git pre-commit hook: defence against Bash-bypass on wiki-charter

if git diff --cached --name-only | grep -q "^dev/wiki-charter\.md$"; then
  COMMIT_MSG_FILE="${1:-.git/COMMIT_EDITMSG}"
  if [ -f "$COMMIT_MSG_FILE" ]; then
    if ! grep -q "\[charter-change\]" "$COMMIT_MSG_FILE"; then
      echo "ERROR: dev/wiki-charter.md changed but commit message lacks [charter-change] tag." >&2
      echo "Charter modifications require explicit tag + DEV_JOURNAL entry." >&2
      exit 1
    fi
  fi
fi

exit 0
```

**Установка:** через `.githooks/` directory + `git config core.hooksPath .githooks/` (рекомендованный pattern; добавить инструкцию в README/CONTRIBUTING).

### Почему dual layer

| Threat | PreToolUse hook | Git pre-commit | Outcome |
|---|---|---|---|
| AI Edit immutable section | ✅ blocks | n/a (Edit didn't fire commit) | Blocked at source |
| AI Write rewrite | ✅ blocks | n/a | Blocked at source |
| AI Bash bypass: `echo > charter.md` | ❌ doesn't fire (Bash not matched) | ✅ blocks at commit | Caught at commit |
| Human legitimate edit | ✅ allowed (PreToolUse only fires for AI) | ✅ allowed if `[charter-change]` tag | Allowed via proper channel |
| Append-only legitimate addition by AI | ✅ allowed | ✅ allowed (no `[charter-change]` needed) | Allowed |

---

## §7. Commands

### 7.1 `/ecosystem:docs-init`

**Frontmatter:**
```yaml
---
description: Bootstrap Ecosystem 3.0 wiki under docs/wiki/ from existing repo docs (one-shot). Reads dev/wiki-charter.md, creates taxonomy, generates initial pages.
---
```

**Workflow:**
1. Verify `dev/wiki-charter.md` exists (если нет — error «run /ecosystem:docs-init only after Charter is committed»)
2. Read Charter, extract: taxonomy (§2), source-to-target map (§3), exclusion list (§4), page templates (§6)
3. Create directory tree per taxonomy
4. Generate `mkdocs.yml` (theme=material, plugins=[search, mermaid2], nav structure from taxonomy, edit_uri pointing to GitHub)
5. For each mapping in Source-to-target map:
   - Read source(s)
   - Invoke skill `wiki-author` to draft initial page
   - Write target page
6. Generate per-section `index.md` files with cross-links to siblings
7. Write `docs/wiki/.last-sync` with `{sha: <HEAD>, timestamp: <now>, action_run_id: null}`
8. Run `/ecosystem:docs-verify` for sanity check
9. Suggest commit: `feat(wiki): bootstrap initial wiki structure (DW.D)`

**Idempotency:** Если `docs/wiki/` уже существует — refuse, suggest `/ecosystem:docs-update` instead. Не overwrite existing wiki silently.

### 7.2 `/ecosystem:docs-update`

**Frontmatter:**
```yaml
---
description: Incrementally update wiki against repo changes since last sync. Respects exclusion list. Use --dry-run to preview.
---
```

**Args:**
- `--since=<sha>` — override last-sync SHA
- `--dry-run` — show proposed changes без write
- `--force` — apply даже если diff кажется суspicious (skip heuristic filters)

**Workflow:**
1. Read `docs/wiki/.last-sync` → `last_sha`
2. `git diff <last_sha>..HEAD --name-status` → changed paths + statuses
3. Read commit messages между `last_sha..HEAD` → check для exclusion patterns
4. Apply exclusion filter (paths + commit msg patterns + heuristics)
5. For each unfiltered path:
   - Lookup matching mapping(s) в Charter source-to-target map
   - Если нет mapping → warning «no mapping for X. Consider extending Charter §3 (requires [charter-change] commit)»
   - Apply action per mapping:
     - `regenerate-*` → invoke `wiki-source-mapper` skill, rewrite target
     - `update-section` → invoke `wiki-author` skill для section refresh
     - `cross-link-refresh` → invoke `wiki-drift-detector` (subset: link verification)
     - `append-new-decisions` → invoke `wiki-source-mapper` для appending
6. If `--dry-run`: print diff, exit
7. Else: write changes
8. Update `docs/wiki/.last-sync`
9. Run `/ecosystem:docs-verify` (post-update sanity)
10. Suggest commit: `docs(wiki): auto-sync against <new_sha>` (использует `docs(wiki)` prefix для anti-cycle filter)

### 7.3 `/ecosystem:docs-verify`

**Frontmatter:**
```yaml
---
description: Non-mutating drift detection between wiki and source-of-truth docs. Reports orphans, missing pages, broken cross-links, status drift.
---
```

**Workflow:**
1. Read Charter source-to-target map
2. For each mapping:
   - Check source exists (или is allowed deletion если page-level)
   - Check target exists
   - Check cross-links в target резолвятся (file existence + anchor existence)
3. Check для **orphan pages** — wiki pages не покрытые ни одним mapping
4. Check для **missing pages** — sources, у которых mapping есть, но target page отсутствует
5. Check **status drift** — `index.md` status block vs `CHANGELOG.md` latest version
6. Check **roadmap drift** — `roadmap/index.md` «Где мы сейчас» vs `ROADMAP.md`
7. Output structured report:
   ```
   Drift report:
   - Orphan pages: 2
     - docs/wiki/legacy-stuff.md (no source)
   - Missing pages: 0
   - Broken cross-links: 3
     - docs/wiki/concepts/modules.md:42 → docs/product-module/OLD_SPEC.md (404)
   - Status drift: NONE
   - Roadmap drift: NONE

   Severity: WARNING (3 broken links)
   Exit code: 0 (warnings) | 1 (critical) | 2 (errors)
   ```

**Non-mutating:** только reports. Fix — через `/ecosystem:docs-update` или manual edit.

---

## §8. GitHub Action — `docs-sync.yml`

**Расположение:** `.github/workflows/docs-sync.yml`.

```yaml
name: Wiki auto-sync

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/wiki/**'
      - 'dev/**'
      - '.product/**'
      - '_archive/**'
      - '*.template'
      - '.github/**'
      - 'node_modules/**'
      - '*.lock'

concurrency:
  group: docs-sync
  cancel-in-progress: false   # queue, don't cancel — previous sync должен complete

jobs:
  sync:
    name: Run /ecosystem:docs-update + open draft PR
    if: |
      !contains(github.event.head_commit.message, '[skip-docs]') &&
      !startsWith(github.event.head_commit.message, 'docs(wiki):') &&
      !startsWith(github.event.head_commit.message, 'wip:') &&
      !startsWith(github.event.head_commit.message, 'chore(deps):')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    timeout-minutes: 20
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run docs-update headless
        id: sync
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          set -e
          claude --print "/ecosystem:docs-update" 2>&1 | tee sync.log
          echo "EXIT_CODE=$?" >> $GITHUB_OUTPUT

      - name: Detect wiki changes
        id: diff
        run: |
          if git diff --quiet docs/wiki/; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Create draft PR
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v6
        with:
          branch: docs/auto-sync-${{ github.sha }}
          title: "docs(wiki): auto-sync against ${{ github.sha }}"
          body-path: sync.log
          draft: true
          labels: docs-auto-sync
          commit-message: "docs(wiki): auto-sync against ${{ github.sha }}"
          delete-branch: true
```

### Anti-cycle (triple gate)

1. **`paths-ignore: docs/wiki/**`** — если push затрагивает только wiki (наш собственный auto-sync merge), Action не fires
2. **Commit message filter** — `startsWith('docs(wiki):')` skip'ает наш sync commit (тот, что Action создаёт)
3. **Draft PR** (не auto-merge) — я review'ю и merge вручную; защита от cascade ошибок

### Cost control

- `paths-ignore` filters most commits
- Commit message filters skip frequent low-signal коммитов (wip, chore(deps))
- `concurrency: docs-sync` — только 1 run одновременно
- Heuristic filter в `/docs-update` skip'ает typo-only diff'ы (даже если path triggered Action)
- Timeout 20 min — hard cap на runaway calls

### Safety net — `docs-verify.yml` (nightly)

**Расположение:** `.github/workflows/docs-verify.yml`.

Запускается раз в день (cron `0 6 * * *` UTC) — non-mutating `/ecosystem:docs-verify` → если drift score выше threshold → создаёт issue с label `docs-drift`. Catches случаи, когда sync action сломан и я не заметил неделю.

---

## §9. Deploy workflow — `docs-deploy.yml`

**Расположение:** `.github/workflows/docs-deploy.yml`.

```yaml
name: Deploy wiki to GH Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/wiki/**'
      - 'mkdocs.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install MkDocs + plugins
        run: pip install mkdocs-material mkdocs-mermaid2-plugin
      - name: Build
        run: mkdocs build --strict
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Strict mode** — `mkdocs build --strict` падает при broken links. Catches drift до публикации.

---

## §10. Last-sync state format

**Расположение:** `docs/wiki/.last-sync` (JSON).

```json
{
  "sha": "7c9dcd1abc...",
  "timestamp": "2026-05-26T14:30:00Z",
  "action_run_id": "9876543210",
  "synced_by": "github-action | manual",
  "version": 1
}
```

**Версия 1** — на случай эволюции формата. `synced_by` помогает дебажить «кто это сделал».

---

## §11. Sub-phase decomposition + estimates

(Дублирую из readiness для удобства; truth там.)

| # | Sub-phase | Estimate | Deliverables |
|---|---|---|---|
| DW.A | Charter draft | 2-3 ч | `dev/wiki-charter.md` |
| DW.B | Hook + git-precommit | 1-2 ч | `hooks/ecosystem/protect-wiki-charter.js` + manifest + `.githooks/pre-commit-charter.sh` |
| DW.C | Skills | 2-3 ч | 3 skills в `skills/ecosystem/wiki-*.md` |
| DW.D | `/docs-init` + initial wiki | 3-4 ч | Command + `docs/wiki/**` tree + `mkdocs.yml` + `.last-sync` |
| DW.E | `/docs-update` | 2-3 ч | Command + filters |
| DW.F | `/docs-verify` | 1-2 ч | Command |
| DW.G | MkDocs config + deploy workflow | 1-2 ч | `.github/workflows/docs-deploy.yml` |
| DW.H | `docs-sync.yml` workflow + headless test | 2-3 ч | `.github/workflows/docs-sync.yml` + test commit + branch |
| DW.I | E2E pilot | 1-2 ч | Findings doc (not committable in code) |
| DW.J | Closure | 1 ч | DEV_JOURNAL DEC-DEV-NNNN + CHANGELOG `[1.4.0]` + smoke plan + Phase 6 readiness refresh |

**Total:** 16-25 ч (per ×2-4 multiplier — realistic 32-50 ч).

---

## §12. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Action создаёт мусорные правки | High (initial) | Medium (draft PR closable) | Draft (не auto-merge); review дисциплина; cuttable DW.H |
| R2 | Credit drain от частых runs | Medium | Low (predictable) | Exclusion filters + heuristics + concurrency 1; monitoring per month |
| R3 | Cycle (Action → push → Action) | Low | High (infinite loop) | Triple anti-cycle gate |
| R4 | Charter corruption via Bash | Low | High (silent drift) | Git pre-commit hook + `[charter-change]` tag requirement |
| R5 | Wiki drift unnoticed | Medium | Medium (degrades over time) | Nightly `docs-verify.yml` → issue |
| R6 | Spec wiki без validation pilot | High (meta-проект risk) | Medium (rework cost) | После DW.D — manual review + Charter refinement before DW.H |
| R7 | Skills-overload (3 новых skill) | Low | Low | Все три used только командами `docs-*`, не affect'ят Product Module |
| R8 | MkDocs build failures на CI (broken links) | Medium | Low (visible immediately) | `mkdocs build --strict` ловит pre-deploy |
| R9 | Cross-link rot при file rename | Medium | Medium | `/docs-verify` + nightly run catches; `wiki-drift-detector` skill |
| R10 | Headless Claude API key leak | Low | High | GitHub secrets (encrypted); never log key; rotation policy в README |

---

## §13. Open questions for kickoff

Заполняется на kickoff session per `dev/meta-improvement/checklists/phase-kickoff.md`. Список ниже — preliminary.

- **OQ-DW-01** — Concurrency lock уровень: `cancel-in-progress: true` (новый push отменяет старый) vs `false` (queue). Design предлагает `false` для completeness; revisit если выявится bottleneck.
- **OQ-DW-02** — Headless Claude CLI authentication: `ANTHROPIC_API_KEY` env через secrets — стандартно, но какие limits на large diff'ах (>100 files)? Возможно нужен chunking.
- **OQ-DW-03** — Charter section markers syntax — HTML-комментарии vs YAML-frontmatter per section vs single frontmatter с section meta. Design предлагает HTML-комментарии (наименее invasive); revisit при impl.
- **OQ-DW-04** — `wiki-author` skill методология: один skill с разветвлениями per page type, vs 4 skills (concept-author / reference-author / guide-author / decision-author). Design предлагает первый вариант; revisit если первый окажется слишком complex.
- **OQ-DW-05** — Reference pages auto-generation: inline (Claude reads все source files каждый раз) vs precomputed manifest (script extracts metadata, Claude использует manifest). Design не specifies; решить на DW.C/D.
- **OQ-DW-06** — Cross-link syntax: relative paths (portable, refactor-fragile) vs MkDocs `[[wiki-link]]` plugin (robust против renames, less portable). Design не specifies; решить на DW.D.
- **OQ-DW-07** — Should Charter Section 3 (Source-to-target map) live в Charter inline, или в separate `dev/wiki-mappings.yaml`? Latter более machine-parseable, но раздвигает Charter integrity. Design предлагает inline (mappings — part of Charter contract).
- **OQ-DW-08** — Should `/docs-update` autoapply, или always require human confirmation? Design предлагает autoapply (Action runs headless), но в interactive mode (run from session) можно prompt'ить. Решить UX.

---

## §14. Implementation start sequence

1. **Phase 5 closure ritual Unit 2** (D7 phase-closure.md 6 steps fresh-session) — outside Phase D scope
2. **Phase 5 runtime smoke S1-S6** — outside Phase D scope
3. **Phase D kickoff session** — fresh-session per `dev/meta-improvement/checklists/phase-kickoff.md`. Substrate: this file + `PHASE_D_DOCS_WIKI_READINESS.md` + последние DEV_JOURNAL entries.
4. **DEV_JOURNAL DEC-DEV-NNNN** — open Phase D + ROADMAP insertion + OQ-DW-* resolutions
5. **DW.A** — Charter draft (this design → real Charter file)
6. **DW.B** — Hook + git-precommit (parse Charter from DW.A)
7. **DW.C** — Skills (need Charter to write `wiki-author` page templates section consumer)
8. **DW.D** — `/docs-init` + initial wiki (depends on Skills + Charter)
9. **Pause for manual review** — wiki spot-check: правильный narrative, корректные cross-links, audience tags работают
10. **DW.E** — `/docs-update` (uses same mappings as DW.D init)
11. **DW.F** — `/docs-verify` (uses same Charter)
12. **DW.G** — MkDocs config + deploy workflow (parallel to DW.E/F допустимо)
13. **DW.H** — `docs-sync.yml` workflow + headless test commit
14. **DW.I** — E2E pilot
15. **DW.J** — Closure ritual + CHANGELOG `[1.4.0]` + Phase 6 readiness refresh

**Принцип incremental pilot:** after DW.D (initial wiki) — пауза, manual review, итерация Charter если нужно. Не запускать DW.H (action) до того как wiki spot-check passed. Per CLAUDE.md «2. Incremental pilot, не waterfall».

---

## §15. Connections с другими частями экосистемы

- **CLAUDE.md** «Hook конвенции» — DW.B `protect-wiki-charter.js` следует pattern: `.js` файл в `hooks/ecosystem/` + manifest entry; auto-registered через `/ecosystem:bootstrap` идемпотентно.
- **CLAUDE.md** «Skill конвенции» (DEC-DEV-0012) — DW.C 3 skills получают explicit frontmatter templates если создают артефакты. `wiki-author` creates wiki pages — но не из `docs/pmo/artifacts/` catalog, так что convention partial: templates per page type в Charter §6, skill consumes.
- **D7 meta-improvement** — `dev/meta-improvement/checklists/phase-kickoff.md` mandatory pre-DW.A; `phase-closure.md` mandatory post-DW.J.
- **DEV_JOURNAL convention** — Phase D open + close = 2 entries minimum. OQ-DW-* resolutions — group в open entry per phase-kickoff.md Section 1.
- **Memory** — Phase D shipping updates 2 memory files (`project_ecosystem_status.md`, `project_ecosystem_architecture.md`) per F.1 readiness.
- **Templates project** — `templates/project/CLAUDE.md.template` НЕ затрагивается. Wiki — для самой экосистемы, не для end-user проектов. Если end-user проект захочет аналогичный wiki — отдельный Phase (post-pilot).

---

## §16. Что НЕ входит в Phase D

Чтобы избежать scope creep, explicit non-goals:

- ❌ Wiki content saturation (full body для всех 25 страниц) — initial bootstrap + minimum viable narrative; полное content building — pilot dogfood track после Phase D
- ❌ i18n (RU/EN parallel) — solo dev RU, end-users потенциально EN, но premature до first end-user feedback
- ❌ Algolia search — MkDocs Material built-in search достаточно для starter
- ❌ Wiki versioning (mike plugin) — только current per design freeze
- ❌ Per-decision wiki pages — только таблица-индекс per design freeze
- ❌ End-user-проект wiki generation (применить wiki-механику к user projects через bootstrap) — отдельный Phase post-pilot
- ❌ Custom theming / branding — default MkDocs Material theme; кастомизация — post-pilot если stakeholders запросят
- ❌ Auto-translation hook (EN ← RU) — premature; manual если понадобится
- ❌ PDF export — MkDocs plugin доступен, но не goal Phase D

---

## §17. Источники и references

- Design conversation 2026-05-26 — закрепляет 4 раунда AskUserQuestion ответов (audiences, format, истина, automation; SSG; cost control; charter location; immutability; versioning; deploy; roadmap fit; decisions wiki)
- [`CLAUDE.md`](../CLAUDE.md) — repo conventions (hooks, skills, commits, DEV_JOURNAL)
- [`dev/meta-improvement/checklists/phase-kickoff.md`](meta-improvement/checklists/phase-kickoff.md) — kickoff procedure
- [`dev/meta-improvement/checklists/phase-closure.md`](meta-improvement/checklists/phase-closure.md) — closure procedure
- [`dev/PHASE_5_READINESS.md`](PHASE_5_READINESS.md) — structural reference для readiness style
- MkDocs Material docs — https://squidfunk.github.io/mkdocs-material/
- peter-evans/create-pull-request — https://github.com/peter-evans/create-pull-request
