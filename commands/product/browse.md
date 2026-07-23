---
description: Generate a self-contained visual browser (.product/browser.html) over all product artifacts — a solo-Confluence view with search, cross-links and a work panel. Read-only over artifacts; writes only the generated HTML.
argument-hint: "[--open] [--out <path>]"
---

# /product:browse

User invoked: `/product:browse $ARGUMENTS`

Builds a **self-contained HTML browser** over `.product/` — an offline, single-file view of every artifact (frontmatter + rendered body), ID cross-links, backlinks, full-text search, and a "Work" panel (handoffs/staleness, pending/ghosts, FM/RL status board, stale drafts). Thin command over a **deterministic generator** — the whole page is assembled in the script, no LLM judgment, fully reproducible.

## Step 1 — Check initialization

If `.product/` doesn't exist (check via `.claude/product.yaml`):

```
Product Module not initialized.

Use /ecosystem:bootstrap to set up the project, or /product:init to start Discovery.
```

Refuse and stop.

## Step 2 — Run the generator (deterministic, SSOT for the page)

Parse `$ARGUMENTS`:
- **`--out <path>`** — write the HTML to `<path>` instead of the default `.product/browser.html`.
- **`--open`** — after a successful generation, open the produced file in the default browser (Step 4).

Run the generator, passing `--out` through when present:

```bash
node .claude/hooks/product/lib/product-browser-html.cjs --root . [--out <path>]
```

The generator scans `.product/**/*.md` (frontmatter + body; dot-folders are skipped), pulls the census/work snapshot from the collector, renders markdown, wires ID cross-links + backlinks, builds a search index, and emits one self-contained HTML file. It prints a short census/summary to **stdout** and exits **0** on success, **2** on a hard failure.

- **exit 0** → capture stdout (the census summary) for Step 3.
- **exit 2** → abort. Print the generator's **stderr** verbatim so the user sees the real cause; do not attempt a partial hand-built page.

## Step 3 — Report (numbers from the generator, not from you)

On success, report:
- the path to the produced file (`.product/browser.html` by default, or the `--out` path);
- the census/summary line(s) **exactly as printed by the generator's stdout**.

**Do not re-count artifacts, pending entries or any other number yourself** — the generator (and the collector behind it) is the single source of truth for every count. LLM re-counting is exactly the drift this deterministic path removes (DEC-DEV-0217). Your job is to surface the generator's output, not to reproduce it.

Example shape (fill from actual stdout):

```
✓ Product browser generated: .product/browser.html
<census summary as printed by the generator>

Open it in a browser, or re-run /product:browse --open.
```

## Step 4 — `--open` (optional)

If `--open` was passed and generation succeeded, open the produced file in the OS default browser. Pick the command by platform:

| Platform | Command |
|---|---|
| Windows | `start "" "<path>"` |
| macOS | `open "<path>"` |
| Linux | `xdg-open "<path>"` |

`<path>` is the `--out` path if given, else `.product/browser.html`. If the open command fails (no GUI / headless), it is not a hard error — report the file path and note that the file can be opened manually.

## Important constraints

- **Read-only over artifacts.** The command never modifies any artifact in `.product/`. The **only** file it writes is the generated HTML (default `.product/browser.html`).
- **The HTML is a generated snapshot — never hand-edited.** It is regenerated in full by re-running `/product:browse` (or the generator directly). Any manual edit is lost on the next run; treat the file as build output, not source.
- **Gitignored.** `.product/browser.html` is listed in `gitignore.template` — it is a regeneratable snapshot and must not be committed.
- **Reproducible.** The page is assembled deterministically in the script; running the generator by hand produces the same file:
  `node .claude/hooks/product/lib/product-browser-html.cjs --root .`

## Error handling

| Error | Action |
|---|---|
| `.product/` missing | Refuse; point to `/ecosystem:bootstrap` (Step 1) |
| Generator exits 2 | Abort; print its stderr verbatim — do not hand-build a partial page |
| Vendored libs missing (`hooks/product/lib/vendor/marked.umd.js` / `minisearch.umd.js`) — generator errors on a missing dependency | Report the missing file and suggest `/ecosystem:update` to re-sync the ecosystem into `.claude/` |
| Collector unavailable (partial data) | Not fatal — the generator degrades: HTML is produced with a warning in the header and the "Work" panel omitted. Surface the generator's warning; do not invent missing fields |
| `--open` command fails (headless / no default browser) | Not fatal — report the file path so it can be opened manually |

## Related

- `/product:status` — textual dashboard of the same corpus (counts, pending, handoffs, sessions).
- `/design:map --html` — visual App Map (`.product/app-map.html`), UI-flow view over Design artifacts.
- `/product:ask "<question>"` — Q&A over `.product/` with mandatory pointers (skill: `.claude/skills/product/corpus-qa.md`).
- Generator: `.claude/hooks/product/lib/product-browser-html.cjs` (self-contained, exit 0/2).
