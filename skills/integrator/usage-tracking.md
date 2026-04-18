---
description: Empirical confidence tracking via usage_stats in tool profiles. Autoinstrumentation rules, threshold-based actions, integration with /product:meta-feedback.
---

# Usage Tracking — Skill for Integrator

**Purpose:** make confidence ratings **empirical**, not just declared. Catch tools that "sound great in docs but fail on our stack".

Complements `smoke-test-protocols.md` — smoke tests verify at add-time, usage tracking verifies continuously.

## What gets tracked

Per tool (stored в `~/.claude/integrator/tool-catalog/<tool>.yaml` — `usage_stats` section):

```yaml
usage_stats:
  # Counters
  invocations: 47                        # total invocations since stats_reset_at
  successes: 43
  failures: 4
  failure_rate_percent: 8.5              # auto-computed: (failures / invocations) * 100

  # Temporal
  last_success: 2026-04-18T14:30:00Z
  last_failure: 2026-04-17T11:15:00Z
  first_tracked: 2026-04-01T00:00:00Z
  stats_reset_at: 2026-04-01T00:00:00Z   # когда stats были reset (init or version upgrade)

  # Recent failure detail (last 5 для quick debug)
  recent_failures:
    - timestamp: 2026-04-17T11:15:00Z
      context: "FM-007 spec-init during handoff adapter"
      error_excerpt: "MK-002 Design Package format unexpected"
      journal_ref: DEC-INT-0073
      resolved: true                     # был ли debug решён

  # Derived
  empirical_confidence: medium           # computed per §Thresholds
  stats_window: "rolling-20"             # mode: rolling (last 20) | cumulative (all-time)
  confidence_last_computed: 2026-04-18T15:30:00Z
```

## When usage is recorded

### Autoinstrumented (preferred)

**Via Integrator adapters:** когда tool invoked через `handoff-to-<tool>` adapter, adapter script records outcome:
```javascript
// in handoff-to-ccsdd.js
const result = await ccSdd.invoke(handoff);
require('~/.claude/integrator/usage-tracker')
  .record('cc-sdd', result.ok ? 'success' : 'failure', {
    context: `FM-${fm.id} spec-init`,
    error_excerpt: result.error?.slice(0, 120)
  });
```

**Via smoke tests:** каждый `/integrator:verify` run фиксирует outcomes.

**Via contract verification:** при `/integrator:verify` на конкретный contract — outcome фиксируется для producer И consumer tools.

### Manual recording

Для tools вызываемых **вне adapter** (например, из другого Claude Code chat, или human-invoked):

```
/integrator:record-outcome <tool> <success|failure> [--context "<desc>"] [--error "<excerpt>"]
```

Эта команда обновляет profile's `usage_stats` и пишет journal entry.

### Не tracked

- Tool не установлен через Integrator (external, manually installed)
- Tool в global catalog, но не в active-tools этого проекта (track per project)
- Invocations внутри smoke test (meta-loop; tracked отдельно как smoke history)

## Thresholds → Automatic actions

### Window determination

- **< 5 invocations:** no empirical confidence yet, use `declared_confidence`, mark `confidence_source: declared`, reason "insufficient data"
- **5-9 invocations:** preliminary empirical, `confidence_source: declared`, but surface early warnings
- **10+ invocations:** full empirical mode, `confidence_source: hybrid`, use `min(declared, empirical)`

### Confidence derivation

```
failure_rate_percent over last 20 invocations (rolling window):

  0-5%     → empirical_confidence: high
  5-15%    → empirical_confidence: medium
  15-30%   → empirical_confidence: low
  30%+     → empirical_confidence: very_low (effectively blocks use)
```

### Actions by failure rate

| Condition | Integrator action |
|---|---|
| `failure_rate_percent > 20%` и `invocations >= 10` | Auto-suggest `/product:meta-feedback`: «propose declared confidence downgrade?» |
| `failure_rate_percent > 40%` | Automatic downgrade `empirical_confidence` → `low`. Warn в `/integrator:status`. Block future `/integrator:add` of dependent contracts без debug run |
| `3+ consecutive failures` | Suggest `/integrator:debug <tool>` немедленно (not waiting for meta-feedback) |
| `No invocations > 30 days` | Mark `empirical_confidence: stale`, suggest `/integrator:verify <tool>` |
| `First success after 5+ consecutive failures` | Journal entry «recovery signal», NOT immediate confidence upgrade (need sustained pattern) |

### Recovery (upgrading empirical confidence back)

Empirical recovery **requires sustained pattern**, not single success:
- 10+ consecutive successes → `empirical_confidence` moves up one level
- 20+ consecutive successes → can reach `high` again

This prevents whiplash ratings.

## Reset conditions

When to reset stats (set `stats_reset_at` to now, clear counters):

| Condition | Action |
|---|---|
| Tool version major upgrade (semver X.y.z → X+1.0.0) | Auto-reset. Previous stats archived в `.claude/integrator/backups/<tool>-stats-<timestamp>.yaml` |
| Tool minor upgrade (x.Y.z) | **Не reset.** Surface warning «minor upgrade may have changed behavior, monitor failure rate» |
| Manual reset: `/integrator:reset-stats <tool>` | Requires rationale, journal entry, backup. Used after fundamental fix |
| New project bootstrap | Stats are **per-project** (в `.claude/integrator/` не в global catalog) — fresh project starts fresh |

Global catalog `~/.claude/integrator/tool-catalog/<tool>.yaml` aggregates across projects (future v1.1 feature); v1 каждый project has own stats.

## Integration с meta-feedback (C3 modification)

When `failure_rate > 20%` triggers meta-feedback suggestion:

```
[Integrator]
Meta-feedback proposal:

Empirical observation: cc-sdd v2.3 has failure_rate 22% (11/50 invocations)
over last 14 days. Declared confidence for D2-Tech-02 is "high".

Proposal:
  - Downgrade declared confidence to "medium"
  - OR run /integrator:debug cc-sdd to identify root cause before downgrading

Recent failures context:
  - FM-007 (2026-04-17): Design Package format issue (DEC-INT-0073, resolved)
  - FM-012 (2026-04-15): Timeout on large feature (DEC-INT-0071, open)
  - FM-014 (2026-04-13): ... (3 more in last 20)

Suggested: debug first, then decide on downgrade based on root cause.

Actions:
  [1] Run /integrator:debug cc-sdd now
  [2] Downgrade declared confidence immediately (temp mitigation)
  [3] Mark as known-issue with rationale (document and monitor)
  [4] Defer (keep monitoring)
```

User chooses; выбор logged в journal.

## Stats display

### In `/integrator:status`

```
TOOL HEALTH
─────────────────────────
cc-sdd v2.3.0
  Declared:     high (D2-Tech-02)
  Empirical:    medium (22% failure over 50 invocations)
  Effective:    medium (min of declared/empirical)
  Recent:       ✗ ✗ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✓ (last 10, newest→oldest)
  Last fail:    2026-04-17 (FM-007, resolved DEC-INT-0073)
  Trend:        recovering (5/6 recent success)
  Action:       Monitor; if failure rate persists — consider debug

beads v1.2.0
  Declared:     medium (D3-01)
  Empirical:    high (2% over 100+ invocations)
  Effective:    medium (declared cap)
  Recent:       ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
  Action:       Declared may be conservative; empirical is trustworthy
```

### In `/integrator:map`

Main coverage table gets `Empirical` и `Effective` columns (see integrator SPEC §4.5).

## Anti-patterns

1. **Don't inflate counts.** Each invocation = one discrete event. Don't record "success" for partial work.
2. **Don't hide failures.** If tool failed silently (no exception but wrong output) — still mark failure with context.
3. **Don't reset stats to clear bad track record.** Reset only when fundamental change (major upgrade, infrastructure change). Otherwise stats show truth.
4. **Don't auto-downgrade in quiet.** Always surface downgrade as meta-feedback proposal — human approves.
5. **Don't oversample smoke tests into stats.** Smoke test outcomes tracked separately (`last_smoke_result`), not in main `usage_stats`. Otherwise empirical is biased toward controlled scenarios.

## Privacy / storage

- Usage stats stored локально в tool profile — no telemetry to external service
- `error_excerpt` ограничено 120 chars — не сохраняем full stack traces или sensitive data
- Journal refs linked (DEC-INT-NNNN) — details в journal, не в stats
