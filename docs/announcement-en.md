# ImpactWave — Announcement (EN)

> Diffusion material: full article for blogs/forums and a short version for LinkedIn or social media. Feel free to adapt it.

---

## Article

# What can you break with your next merge?

That question haunted me for years. Not because I'm a bad developer, but because on any real project the honest answer was always: **no idea**.

## What ImpactWave is

[ImpactWave](https://npm.im/impactwave) is an open source CLI that analyzes your Git changes before merging and tells you — with data, not gut feeling — what you can break and what you should test. It's this simple:

```bash
cd my-project
npx impactwave
```

In seconds it produces a report that combines four views of your change:

- **Modified symbols**: it doesn't look at plain text, it looks at the AST. It detects which exported functions, classes, public methods and interfaces your diff physically touched.
- **Real consumers**: it finds every active usage of those symbols, with file, line and code snippet. An `import` nobody executes doesn't count as impact.
- **Blast radius**: it walks the dependency graph and shows every file reached, directly and transitively, level by level.
- **Impact coverage**: it crosses affected areas with your tests (`*.test.ts`, `*.spec.ts`) and lists exactly what's left uncovered.

Everything ends in a **risk score from 0 to 100**, deterministic —the same change always produces the same number— and explainable: every point comes with its reason. "4 consumers of modified symbols (12 pts)". No black boxes, no AI guessing.

## Why it was born

It comes from a very specific frustration: small changes are the most treacherous ones. You change a tax rate in a payment service and, without touching any other line, you break three modules that consume that method. Code review relies on intuition, the full test suite takes minutes and doesn't tell you *where to start*, and the real impact usually surfaces... in production.

I thought: if I can know which symbols I touched and who consumes them, I don't need faith anymore — I need a list. That's where ImpactWave came from: turning that list into an actionable report before the merge, not after the incident.

## What problems it solves today

- Knowing **who is affected** by your change before pushing, not when it fails.
- Knowing **which tests to run first** instead of running everything blindly.
- Detecting **affected areas with zero tests** — the exact list of files you should cover before merging.
- Putting an objective, discussable number on a PR's risk — useful even as a reference during code review.

## My current usage (with honesty)

ImpactWave today is a tool I use to verify my own commits in TypeScript and JavaScript projects, specifically **backends**. And that nuance matters: it doesn't replace tests, CI, or human review — nothing does. What it gives me is extra confidence: when the report says LOW and I see the consumers covered by their tests, merging stops feeling like a leap into the void and starts feeling like what it should always be — an informed decision.

About React and frontend projects: **I haven't tested it there yet**. The tool analyzes generic TypeScript/JavaScript, but I don't want to promise anything I haven't verified myself. If you try it on a frontend project, I'd genuinely love to hear about your experience.

## Try it

No global install, no configuration:

```bash
npx impactwave
```

If you find it useful, a star on [GitHub](https://github.com/paleto30/impactwave) helps other developers discover it. And if it breaks something or you have ideas, issues are open.

Because in the end it comes down to this: **less faith, more data, at the exact moment you decide to merge your code with everyone else's.**

---

## Short version (LinkedIn / forums)

```
What can you break with your next merge?

For years the honest answer was: no idea. You change one line in a service
and break three modules that consume that method. Code review relies on
intuition, and real impact surfaces in production.

Tired of that, I built ImpactWave: an open source CLI that analyzes your
Git changes before merging and tells you what you can break and what you
should test.

How it works:
→ Detects via AST which exported symbols your diff physically touched
→ Finds the real consumers of those symbols (file, line and snippet)
→ Traces the blast radius across the dependency graph
→ Crosses affected areas with your tests and lists what's left uncovered

It all ends in a 0-100 risk score, deterministic and explainable:
every point comes with its reason. No black boxes, no AI guessing.

Usage: cd your-project && npx impactwave. No install, no configuration.

Full transparency: today I use it to verify my own commits in TypeScript
and JavaScript backends. It doesn't replace tests, CI or review — it just
makes a merge stop feeling like a leap into the void. React/frontend?
Haven't tested it there yet; if you do, I want to read about it.

GitHub: https://github.com/paleto30/impactwave
npm: https://npm.im/impactwave

Feedback and issues welcome.
```
