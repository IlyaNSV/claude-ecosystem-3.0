# Work-rails — index of work-units (DEC-DEV-0108)

Deterministic **projection** of `git log` (+ `DEV_JOURNAL.md`) into a compact,
reference-based index of work-units — to answer "how many times / with what
intent / what outcome did we touch area X", spot skill-candidates, and navigate
rollbacks. **Not a second source of truth:** regenerable any time → cannot drift
(same pattern as `scripts/check-counts.js`).

## Run

```sh
node dev/meta-improvement/scripts/rails-build.js                 # this repo
node dev/meta-improvement/scripts/rails-build.js --repo <dir>    # another repo (e.g. the pilot)
node dev/meta-improvement/scripts/rails-build.js --list <area>   # debug: files mapped to an area
```

## Files

| file | tracked? | what |
|---|---|---|
| `rail-areas.json` | ✅ | ordered path→area taxonomy (first-match-wins; tune freely) |
| `README.md` | ✅ | this file |
| `RAILS.md` | ❌ gitignored | human digest (regenerated) |
| `rails-rollup.ndjson` | ❌ gitignored | machine facets, one line per area (regenerated) |

Outputs are gitignored on purpose: a regenerable projection committed across many
branches/worktrees = merge churn. Run the script to get current state.

## Granularity layers (each reference-based — drill down)

- **L0** area · **L1** commit · **L2** file × artifact-ID × content-signature
  (blob-SHA version history → churn-loops; `hash.js` HEAD bodies → clone/skill candidates)
  · **L3** tool-action (transcript JSONL, opt-in — not yet built).

Every record holds references (SHA / path / artifact-ID / date / hash), never
content — so granularity stays high while the index stays compact.

## Notes

- `area` is **path-derived** → the index is retroactive over full history even
  before any `Rail-*` commit trailer exists.
- artifact-IDs come from file paths **+ commit subjects + the DEV_JOURNAL catalog**.
- L2 clone/churn signals need a templated, ID-named substrate to light up — they
  are empty on this (append-only, DRY) repo by design; the pilot (`my-first-test`)
  is where they earn their keep.

## Planned next

- generalize to the pilot (`--repo`) with a pilot-specific `rail-areas.json`;
- capture-forward: `Rail-Intent` / `Rail-Supersedes` / `Outcome` commit trailers
  + an auto-`area` `prepare-commit-msg` hook;
- optional L3 transcript indexer (sub-commit / abandoned-edit granularity).
