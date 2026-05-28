---
description: HTML emergency fallback за D.2/D.3 generation когда Stitch unavailable AND Claude Design subscription отсутствует. v1.0 minimal — single HTML page, DS tokens via CSS vars, no React, no multi-screen per DEC-DEV-0052 C4.
---

> **User-facing output language:** Russian. Token identifiers / file paths — verbatim.

# HTML Fallback — Skill (v1.0 minimal)

> **Status:** v1.0 minimal per DEC-DEV-0052 Q4/C4. Full React + multi-screen — v1.1+ candidate (см. `dev/v1_1_backlog.md` «Design Module — html-fallback.md React + multi-screen (C4 cut)»).
>
> **Use case:** «Stitch down» emergency unblock — single HTML page sufficient для session continuation; не «HTML mode primary».

## Activation context

Loaded когда `design-session.md` dispatches D.2/D.3 с `design_tool: html` — typically:
- Last в fallback chain после Stitch failed AND Claude Design subscription absent
- User explicit set в `.claude/design.yaml.default_design_tool: html` (rare; e.g. local-only no-network workflow)

## v1.0 capabilities

Per DEC-DEV-0052 Q4/C4:
- Single HTML page per `/design:start` request (NOT multi-screen — even если Screen Inventory has 4 screens, single page renders all sections sequentially OR most-critical only с note)
- DS tokens via CSS custom properties (`--ds-color-primary: #3B82F6;`)
- Vanilla HTML/CSS (no React, no JSX, no JavaScript framework)
- Static — no interactive state transitions (component states represented via CSS pseudo-classes `:hover`, `:focus`, OR separate classes shown в comments)
- Accessibility: aria-* attributes, semantic HTML5, tab order natural via source order

## v1.0 limitations (cuts из C4)

- ❌ React components (deferred к v1.1)
- ❌ Multi-screen navigation (deferred — v1.0 emits one HTML file; если 2+ screens needed, surface к user: «v1.0 minimal — render single SI per session; multi-screen via Stitch / Claude Design when available»)
- ❌ State machine animations (deferred)
- ❌ Mini-router via sessionStorage (deferred — part of multi-screen)

## Algorithm

### Step 1 — Determine target screen

Если Screen Inventory has 1 SI → use it.
Если ≥2 SI → prompt user choice:
```
v1.0 HTML fallback renders single screen. Choose primary:
  [1] SI-1 <title> — main screen
  [2] SI-2 <title> — modal
  [3] SI-3 ...
  [N] SI-N
  [skip] — abort fallback; suggest Stitch/Claude Design retry

Silence ≠ continue.
```

### Step 2 — Compose HTML

Generate `.product/.design-sessions/<MK-id>-html/index.html`:

```html
<!DOCTYPE html>
<html lang="<from .claude/design.yaml.default_language>" dir="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><Screen title></title>
  <style>
    :root {
      /* DS tokens — populated from current DS state */
      <DS.color.* mapped → CSS vars>
      <DS.spacing.* mapped>
      <DS.typography.* mapped>
      <DS.border.* / radius.*>
      <DS.shadow.*>
    }
    /* Base reset + typography */
    body {
      font-family: var(--ds-font-sans, system-ui);
      color: var(--ds-color-gray-900);
      background: var(--ds-color-white, #fff);
      margin: 0;
      padding: var(--ds-spacing-lg);
    }
    /* Component styles — minimal */
    <per-component CSS — buttons, inputs, cards с state classes>
  </style>
</head>
<body>
  <main aria-label="<Screen title>">
    <h1><Screen title></h1>
    <!-- Component instances -->
    <component instances mapped from Screen Inventory> с aria-labels + accessibility attributes
  </main>
  <!-- Component state samples — non-interactive demo -->
  <section aria-label="Component States" style="margin-top:var(--ds-spacing-2xl);border-top:1px solid var(--ds-color-gray-100);padding-top:var(--ds-spacing-lg)">
    <h2>Component State Samples</h2>
    <!-- per component, render все states side-by-side с label -->
  </section>
</body>
</html>
```

**Token mapping rule:**
- For each DS.<category>.<name> token referenced в MK → emit `--ds-<category>-<name>: <value>` в `:root`
- Bare-color fallback only if token не resolved (e.g. `--ds-color-primary` missing → use `#3B82F6` literal с comment «TODO: add to DS»)

### Step 3 — Accessibility checks

Inline static checks:
- All `<button>` / `<a>` have visible text OR `aria-label`
- All form inputs have associated `<label>` (via `for=`)
- Color contrast: skill cannot compute live; emit warning в HTML header comment если token combinations look low-contrast (e.g., `DS.color.gray-50` text on `DS.color.gray-100` background — both light)
- Touch targets: emit warning if any button width OR height < 44px

Surface warnings к user inline:

```
HTML fallback warnings (v1.0 — manual contrast check recommended):
  • <warning 1>
  • <warning 2>
```

### Step 4 — Output structure

```
.product/.design-sessions/<MK-id>-html/
  index.html
  README.md       — emit description: «v1.0 minimal HTML fallback. Single SI rendered. Open index.html в browser to view.»
```

Return к orchestrator:
- `tool_url_or_path: file://<full path to index.html>`
- `description: «HTML fallback: SI-N rendered single-page»`
- `issues: [<contrast warnings, missing tokens, etc.>]`

### Step 5 — Iteration handling (D.3)

D.3 «small» / «medium» updates → regenerate `index.html` with refined content (in-place overwrite — no version proliferation).
D.3 «large» (2+ screens) → surface к user: «v1.0 HTML fallback single-page only. Options: [retry Stitch/Claude Design when available] / [accept current as final] / [drop session, /design:start --abandon]».

## Anti-patterns

1. **Generating React despite C4 cut.** v1.0 emits vanilla HTML/CSS. React = anti-pattern per cut.

2. **Multi-screen без user explicit override.** v1.0 renders single SI. Skipping user choice prompt = anti-pattern.

3. **Hardcoded hex colors instead of CSS vars.** Always use `var(--ds-color-...)` referencing DS tokens. Bare hex only fallback.

4. **Missing aria-labels.** Accessibility part of MK Accessibility Notes — must propagate to HTML output.

5. **Skipping accessibility warnings.** Emit even if not-blocking; user awareness critical.

6. **Force-staying на HTML when Stitch recovered.** Skill is emergency fallback; if Stitch becomes available again → recommend `/design:migrate <MK-id> --to stitch` для quality regen.

## Failure modes

| Failure | Recovery |
|---|---|
| DS empty (first MK ever) | Use baseline tokens inline (Inter font, basic palette); warn user to populate DS post-session |
| Screen Inventory empty | Refuse — surface к user «No SI to render»; suggest D.1 brief revisit |
| Filesystem write fails | Surface error; suggest manual paste-to-clipboard fallback |
| Output HTML rendered broken (manual browser open shows breakage) | Iterate via D.3 cycle; minimal CSS rarely fails but layout edge cases possible |

## Related

- Parent skill: `design-session.md` (D.2/D.3 dispatch when fallback chain reaches html)
- Sibling tools: `stitch-workflow.md` (primary), `claude-design-workflow.md` (mid-chain stub)
- v1.1+ backlog: «Design Module — `html-fallback.md` React + multi-screen (C4 cut)» — full upgrade after evidence
- Cross-platform: emit LF-only line endings; UTF-8 encoding; cross-browser baseline (no Edge-specific / Chrome-specific tricks)
