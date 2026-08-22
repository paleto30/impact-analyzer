# Standing Agent Rule — Coding Principles

> **Status: permanent restriction for every coding session in this repository.**
> This rule applies automatically to ANY task that writes or modifies code
> (features, bug fixes, refactors, tests). It does not need to be re-asked.

---

## 1. The Rule

Whenever you develop any new feature (or modify existing code), the code
MUST be written following **SOLID**, **Clean Code** and **Clean
Architecture** — always the cleanest, most decoupled, maintainable and
professional version that is practical.

"Working code" is not done. Clean code that respects the architecture is done.

---

## 2. SOLID — concrete application in this project

| Principle | Required practice |
|---|---|
| **S**ingle Responsibility | One reason to change per module/function. Orchestration lives in the entry point (`cli.ts`) split into named step functions; pure computation lives in its own module (see `risk/`); rendering never transforms data (`buildExportedSymbolsView` pattern). If a function mixes data transformation with I/O or presentation, split it first. |
| **O**pen/Closed | Extend via configuration/data, not by editing logic. Precedent: `RiskWeights` + saturation thresholds. New variants (e.g. output formats) must enter through a seam (interface/factory), not through branching inside existing renderers/computers. |
| **L**iskov Substitution | No inheritance hierarchies without behavioral contracts. Prefer composition. Any subtype must be usable wherever its base is expected without surprising behavior. |
| **I**nterface Segregation | Small, focused interfaces (see `*.interface.ts`, 4–29 lines each). Never force consumers to depend on fields they don't use. Discriminated results (`{ ok: true; weights } \| { ok: false; message }`) instead of throwing across layers. |
| **D**ependency Inversion | Dependencies point inward: `engine/` never imports from the CLI layer. Core modules receive their inputs as parameters (inject `projectRoot`, don't call `process.cwd()` internally). No hidden singletons/global mutable state for anything but the deliberate shared AST cache (`project.ts`). |

---

## 3. Clean Code — required practices

- **Names**: intention-revealing, consistent vocabulary (`getModifiedSymbolNames`, `isImportOnlyUsage`). No abbreviations unless universally obvious.
- **Small functions**: one level of abstraction per function. If a function exceeds ~40–50 lines or mixes emoji/ANSI/formatting with logic, extract.
- **Single source of truth**: predicates and rules used in more than one place get one exported definition (`usage-filter.ts` pattern). Copy-paste of a rule across modules is a defect.
- **Explicit types over stringly-typed**: semantic discriminators are typed unions (`ExportedSymbolKind`), never substrings of display labels. Primitive obsession has already caused a real bug here — do not reintroduce it.
- **Error handling**: fail fast on invalid input at the boundary with clear messages; catch ONLY what you can meaningfully handle. Silent catches are allowed solely for expected environmental failures (unparseable user files), never for internal logic.
- **Comments explain WHY**, not what. Reference decisions and docs when relevant.
- **No dead code, no commented-out code, no speculative generality (YAGNI).**

---

## 4. Clean Architecture — layers of this project

```
src/cli.ts                      ← Frameworks/Drivers + composition root
src/engine/git/, parser/,       ← Interface Adapters (simple-git, ts-morph)
src/engine/testing/, reporter/
src/engine/analyzer/,           ← Use Cases (orchestration-free pure-ish logic)
src/engine/assessment.ts
src/engine/risk/,               ← Entities / pure domain (no I/O, no console)
src/**/*.interface.ts
```

Non-negotiables:

1. **The dependency rule**: source dependencies point inward only. Domain/use-case code must not import adapters or frameworks.
2. **Domain purity**: everything in `risk/` stays deterministic and free of I/O — it is the reference standard for the rest of the engine.
3. **Adapters translate, they do not decide**: git/ts-morph wrappers expose project concepts, leaking neither simple-git nor ts-morph types outward.
4. **Testability follows design**: if a unit can't be tested without spawning a whole repo, the design is wrong — add a seam (parameter, interface) instead of accepting integration-only coverage.

---

## 5. Definition of Done gate (check before presenting work)

- [ ] Each change sits in the correct architectural layer.
- [ ] No duplicated rule/predicate introduced; if found pre-existing, unify instead of extending the duplication.
- [ ] New behavior reachable via configuration/seam where variation is plausible.
- [ ] Functions small, names intentional, no silent catches added.
- [ ] `npm run build` + full test suite green.
- [ ] Behavior-preserving refactors verified output-identical (snapshot/diff) before claiming no functional change.
- [ ] Docs (`README.md`, `README.en.md`, `docs/GUIA.md`, `docs/GUIDE.en.md`) updated when observable behavior or usage changes.

---

## 6. Conflict resolution

If deadlines, user requests or pragmatism push toward breaking this rule,
do it explicitly: state which principle is being traded, why, and leave a
code comment or doc note marking the debt. Never break the rules silently.
