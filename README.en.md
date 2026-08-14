# Impact Analyzer

> **English | [Español](README.md)**

CLI tool that analyzes the impact of your code changes before merging.

> **"What can I break with this change, and what should I test?"**

## Installation and usage

```bash
npm install -g impact-analyzer   # or: npx impact-analyzer
```

Run inside a Git repository:

```bash
cd my-project
impact-analyzer analyze
```

Options:

| Option | Description |
|---|---|
| `-b, --base <branch>` | Base branch to compare against (auto-detection: `origin/HEAD` → `main`/`master` → `HEAD~1`) |
| `--risk-weights <json>` | Custom weights for the risk factors, e.g. `{"callerImpact":40,"testGaps":30}` |

## What it does

1. **Git**: detects the repository, the base branch and changed files (A/M/D).
2. **AST**: with ts-morph (a single indexed project using your tsconfig) extracts exports and imports of changed files.
3. **Modified symbols**: intersects each exported symbol's line range with the diff lines.
4. **Real consumers**: `findReferences` finds the active usages of each symbol (pure imports don't count as impact).
5. **Dependency graph**: reverse and forward indexes of relative imports + transitive traversal (BFS) with depth.
6. **Test mapping**: detects `*.test.ts`/`*.spec.ts` files and maps which code they cover.
7. **Risk engine**: deterministic 0-100 score with explainable reasons.

## Risk model

Five factors with saturation thresholds. Default weights (configurable with `--risk-weights`):

| Factor | Weight | Signal |
|---|---|---|
| Caller impact | 30 | direct consumers of modified symbols (threshold 10) |
| Affected files | 20 | transitively reached files (threshold 15) |
| Dependency depth | 15 | maximum depth levels (threshold 4) |
| Test gaps | 20 | share of affected areas without tests |
| Change size | 15 | modified lines (threshold 200) |

Levels: `0-25 LOW · 26-50 MEDIUM · 51-75 HIGH · 76-100 CRITICAL`.

## Report

The report includes: Git context, risk with score and reasons (with points), **Impact Coverage** (affected areas covered by tests, with uncovered ones listed), and per file: exported symbols (marking the modified ones), downstream usages with line and snippet, blast radius (direct/transitive/depth) and related tests (✓/✗).

## Development

```bash
npm test       # test suite (node:test)
npm run build  # compile to dist/
npm run dev -- analyze  # run in development
```

Fixtures in `test/fixtures/` validate the analysis against artificial projects:
`simple-project` (A→B→C chain), `circular-dependencies` (X↔Y) and `test-coverage` (services with and without tests).

## MVP status

Completed according to the proposal (`ai-docs/impact-analyzer-context.md`):

- ✅ Phase 1 — Git analysis
- ✅ Phase 2 — AST analysis
- ✅ Phase 3 — Dependency Graph
- ✅ Phase 4 — Symbol-level impact
- ✅ Phase 5 — Test mapping
- ✅ Phase 6 — Risk engine (+ explainability, coverage, fixtures and own tests)

Future phases (outside the MVP): GitHub Action, AI layer, VS Code extension, Git history.