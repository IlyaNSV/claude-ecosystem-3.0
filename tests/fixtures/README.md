# Test fixtures

Self-contained handoff/artifact fixtures for adapter contract tests, hook smoke tests, and skill verification.

## Files

| File | Used by | Purpose |
|---|---|---|
| `FM-FIXTURE-001-handoff.md` | `adapters/handoff-to-ccsdd.js --verify-only` | Minimal but realistic handoff (13 sections, frontmatter complete) for cc-sdd contract test (Phase 5 Stage 6 verify) |

## Conventions

- Fixture IDs use `FM-FIXTURE-NNN` (not `FM-NNN`) to make grep'ability obvious and avoid collision with real pilot artifacts.
- Fake hash values: `sha256:0000…000NNN` (last digit identifies the artifact). Adapter contract tests do not re-verify hashes; that's V-H-04 territory and lives in Product Module.
- Keep fixtures **minimal** — just enough to exercise the contract. Add new fixtures rather than bloating existing ones.

## Running adapter contract test

```bash
node adapters/handoff-to-ccsdd.js --verify-only --fixture tests/fixtures/FM-FIXTURE-001-handoff.md
```

Expected: exit 0, JSON output containing `contract_validation.passed: true` and a populated `cc_sdd_input` object.
