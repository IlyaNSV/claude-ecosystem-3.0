---
description: Phase 4 smoke test fixtures — pending state snapshots for guided runtime smoke session in my-first-test pilot.
---

# Phase 4 smoke fixtures

Snapshot'ы pending state, которые seed'ятся в `my-first-test/.product/.pending/` перед прогоном runtime smoke сессии (см. [`../PHASE_4_SMOKE_TEST_PLAN.md`](../PHASE_4_SMOKE_TEST_PLAN.md) Setup).

## Зачем нужны

`my-first-test/.product/.pending/` gitignored (ephemeral state, hook-managed). После предыдущих cleanup-сессий все три pending файла = `entries: []`. Это исключает verification S12 `--pending-hygiene`:

- Без non-empty `cascade-pending.yaml` AI не показывает делегацию к `/product:cascade --pending --revalidate` (anti-pattern #5, DEC-DEV-0036).
- Без pre-existing `da-pending.yaml` entries AI не упражняется flag-only path (anti-pattern #2 + session-window guard).

Эти fixtures — minimal trim из real pre-cleanup snapshot (2026-05-13), достаточный для observable behavior.

## Файлы

| Fixture | Размер | Назначение |
|---|---|---|
| `cascade-pending.yaml` | 20 entries | BR-001..020 V-11 auto-fixed entries от 2026-04-30. Filename'ы verified против `my-first-test/.product/business-rules/`. |
| `da-pending.yaml` | 3 entries | BR-046, BR-047, IC-001 — все `status: active` (stale per skill); `queued_at: 2026-05-13` (pre-existing, session-window guard НЕ срабатывает). |
| `validation-pending.yaml` | empty | `entries: []` baseline; S12 validation-pending hygiene runs no-op. |

## Setup команды

См. [`../PHASE_4_SMOKE_TEST_PLAN.md`](../PHASE_4_SMOKE_TEST_PLAN.md) §«Setup → 2. Seed pending state».

Идемпотентно: повторный `cp` перезаписывает state. После любого `/product:cleanup --pending-hygiene` apply'a (либо ручного wipe) — re-seed нужен для следующего прогона.

## Maintenance

При изменении `my-first-test` artifact filenames (renames в BR-001..020 или BR-046/047/IC-001) — обновить соответствующие `file:` paths в fixtures. Check'ить через:

```bash
cd my-first-test
node -e "
const yaml = require('fs').readFileSync('../claude-ecosystem-3.0/dev/phase-4-smoke-fixtures/cascade-pending.yaml','utf-8');
const files = [...yaml.matchAll(/^    file: (.+)$/gm)].map(m => m[1]);
const missing = files.filter(f => !require('fs').existsSync(f));
console.log(missing.length ? 'MISSING:\n' + missing.join('\n') : 'All ' + files.length + ' fixture files exist.');
"
```
