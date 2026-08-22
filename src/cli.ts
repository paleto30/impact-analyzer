#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import type { SimpleGit } from "simple-git";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles, getModifiedLines } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/file-status.js";
import { analyzeFile, getExportedSymbolNames } from "./engine/parser/parser.js";
import type { FileAnalysis } from "./engine/parser/file-analysis.interface.js";
import { buildDependencyGraph } from "./engine/graph/dependency.js";
import { computeAssessment, generateReport } from "./engine/assessment.js";
import { printConsoleReport } from "./engine/reporter/reporter.js";
import { buildTestMapping } from "./engine/testing/test-mapping.js";
import { parseRiskWeights } from "./engine/risk/risk.weights.js";
import type { RiskWeights } from "./engine/risk/risk.types.js";
import { SymbolAnalyzer } from "./engine/analyzer/symbol-analyzer.js";
import type { SymbolImpact } from "./engine/analyzer/symbol-impact.interface.js";
import type { ImpactReportItem } from "./engine/impact-report-item.interface.js";
import type { ChangedFile } from "./engine/git/changed-file.interface.js";

interface ChangedFileAnalysis {
    analysis: FileAnalysis;
    modifiedLines: Set<number>;
    modifiedSymbols: Set<string>;
    modifiedSymbolLineCounts?: Map<string, number>;
    modifiedClassMethods?: Map<string, string[]>;
    symbolImpacts: SymbolImpact[];
}

interface CollectedChanges {
    analyses: Map<string, FileAnalysis>;
    changedFileAnalyses: Map<string, ChangedFileAnalysis>;
    skippedFiles: number;
}

/**
 * Resolves the candidate base branch: explicit option, auto-detection,
 * or a HEAD~1 fallback (announced so the user is never silently surprised).
 */
async function resolveBaseBranch(git: SimpleGit, requested?: string): Promise<string> {
    if (requested) return requested;

    const detected = await detectBaseBranch(git);
    if (detected) return detected;

    console.log("⚠️ Could not determine an automatic base branch. Using 'HEAD~1' by default.");
    return "HEAD~1";
}

/**
 * Validates the --risk-weights option up front (fail fast). Exits the
 * process with a clear message when the value is not acceptable.
 */
function requireRiskWeights(raw?: string): RiskWeights | undefined {
    if (!raw) return undefined;

    const parsed = parseRiskWeights(raw);
    if (!parsed.ok) {
        console.error(`❌ Error: ${parsed.message}`);
        process.exit(1);
    }
    return parsed.weights;
}

/**
 * Analyzes every non-deleted changed file: exported symbols, modified
 * lines, physically modified symbols/methods and their real consumers.
 *
 * Only the file parse is guarded: unparseable/binary files are counted as
 * skipped. Any other failure is an internal bug and must surface.
 */
async function collectChangedFileAnalyses(
    git: SimpleGit,
    baseBranch: string,
    changedFiles: ChangedFile[],
    symbolAnalyzer: SymbolAnalyzer
): Promise<CollectedChanges> {
    const analyses = new Map<string, FileAnalysis>();
    const changedFileAnalyses = new Map<string, ChangedFileAnalysis>();
    let skippedFiles = 0;

    for (const file of changedFiles) {
        if (file.status === FileStatus.Deleted) continue;

        let analysis: FileAnalysis;
        try {
            analysis = analyzeFile(file.path);
        } catch {
            // Non-parseable or binary file: skip silently
            skippedFiles++;
            continue;
        }

        analyses.set(file.path, analysis);

        const exportedSymbols = getExportedSymbolNames(analysis);
        if (exportedSymbols.length === 0) continue;

        const modifiedLines = await getModifiedLines(git, baseBranch, "HEAD", file.path);

        // Which symbols were physically touched in this file
        const modifiedSymbols = symbolAnalyzer.getModifiedSymbolNames(
            file.path,
            exportedSymbols,
            modifiedLines
        );

        // How many lines were modified per symbol
        const modifiedSymbolLineCounts = symbolAnalyzer.getModifiedSymbolLineCounts(
            file.path,
            exportedSymbols,
            modifiedLines
        );

        // Which methods were modified per class
        const modifiedClassMethods = symbolAnalyzer.getModifiedClassMethods(
            file.path,
            analysis,
            modifiedLines
        );

        // KEY FILTER: only analyze the impact if at least one symbol changed
        const symbolImpacts = modifiedSymbols.size > 0
            ? symbolAnalyzer.analyzeSymbolImpact(
                file.path,
                Array.from(modifiedSymbols),
                modifiedLines
            )
            : [];

        // Class-level references miss call sites like "service.calculate()";
        // method-level impacts add the consumers of each modified method.
        const methodImpacts = symbolAnalyzer.getModifiedMethodImpacts(
            file.path,
            modifiedClassMethods
        );

        changedFileAnalyses.set(file.path, {
            analysis,
            modifiedLines,
            modifiedSymbols,
            modifiedSymbolLineCounts,
            modifiedClassMethods,
            symbolImpacts: [...symbolImpacts, ...methodImpacts]
        });
    }

    return { analyses, changedFileAnalyses, skippedFiles };
}

/**
 * Links the per-file analysis data to its report item.
 */
function wireReportData(
    reportItems: ImpactReportItem[],
    changedFileAnalyses: Map<string, ChangedFileAnalysis>,
    testCoverage: Map<string, string[]>
): void {
    reportItems.forEach(item => {
        const changed = changedFileAnalyses.get(item.file.path);
        item.symbolImpacts = changed?.symbolImpacts ?? [];
        item.modifiedSymbolNames = changed?.modifiedSymbols ?? new Set<string>();
        item.modifiedSymbolLineCounts = changed?.modifiedSymbolLineCounts ?? new Map();
        item.modifiedClassMethods = changed?.modifiedClassMethods ?? new Map();
        item.relatedTests = testCoverage.get(item.file.path) ?? [];
    });
}

/**
 * Total number of modified lines across all analyzed changed files.
 */
function collectChangedLines(changedFileAnalyses: Map<string, ChangedFileAnalysis>): number {
    return Array.from(changedFileAnalyses.values())
        .reduce((acc, file) => acc + file.modifiedLines.size, 0);
}

/**
 * Single source of truth for the CLI version: package.json sits one level
 * above this file both in src/ (dev, via tsx) and dist/ (published bin).
 */
const { version } = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")
) as { version: string };

const program = new Command();

program
    .name("impactwave")
    .description("Analyze the blast radius of your code changes before merging")
    .version(version)
    .addHelpText("before", `
ImpactWave answers one question before you merge:

  "What can I break with this change, and what should I test?"

It combines your Git diff with AST analysis to find the exported symbols you
modified, who really consumes them, whether tests cover the affected areas,
and computes a deterministic risk score (0-100) with explainable reasons.
`)
    .addHelpText("after", `
Documentation: https://github.com/paleto30/impactwave#readme

Tip: running bare "impactwave" inside a Git repository is equivalent to
"impactwave analyze". Run "impactwave analyze --help" for options and examples.`);

program
    .command("analyze", { isDefault: true })
    .description("Analyze the impact of your committed changes in the current Git repository (default command)")
    .summary("Analyze changed code impact in this repository")
    .option(
        "-b, --base <branch>",
        "base branch or ref to compare HEAD against " +
        '(default: auto-detected: origin/HEAD -> main/master -> HEAD~1)'
    )
    .option(
        "--risk-weights <json>",
        'JSON object with custom risk factor weights; omitted keys count as 0. ' +
        "Valid keys: callerImpact, affectedFiles, dependencyDepth, testGaps, changeSize. " +
        'Defaults: {"callerImpact":30, "affectedFiles":20, "dependencyDepth":15, "testGaps":20, "changeSize":15}'
    )
    .addHelpText("after", `
Purpose:
  Analyze what your current changes could break and what you should test,
  before merging.

How it works:
  Compares HEAD against a base branch (git diff <base>..HEAD), finds which
  exported symbols were physically modified, locates their real consumers,
  traces the blast radius across the dependency graph and maps test coverage
  over the affected areas. It ends in a risk assessment: a deterministic
  score from 0 to 100 with explainable reasons.

Default behavior:
  - Without --base, the base branch is auto-detected:
      origin/HEAD -> main/master -> HEAD~1 (with a warning on fallback).
  - Only committed changes are analyzed; uncommitted working-tree edits are
    not included.
  - Prints a human-readable report to stdout and exits 0 unless there is a
    usage error (e.g. unknown base branch or invalid --risk-weights JSON).

Examples:
  # Analyze HEAD vs the auto-detected base branch
  $ impactwave

  # Compare against an explicit base branch
  $ impactwave analyze -b main

  # Emphasize test coverage gaps in the score
  $ impactwave --risk-weights '{"callerImpact":30,"testGaps":35}'

  # Score only by direct consumers of modified symbols
  $ impactwave analyze --risk-weights '{"callerImpact":100}'

Full guide: https://github.com/paleto30/impactwave/blob/main/docs/GUIA.md`)
    .action(async (options) => {

        const git = await detectRepo();
        if (!git) return;

        // 1. Determine the candidate base branch
        const baseBranch = await resolveBaseBranch(git, options.base);

        // 2. Defensive validation (Fail Fast & Clear)
        const exists = await branchExists(git, baseBranch);
        if (!exists) {
            console.error(`❌ Error: The base branch or reference '${baseBranch}' does not exist in this repository.`);
            console.error(`💡 Tip: If you are in a shallow clone (CI), make sure to fetch the base branch.`);
            process.exit(1);
        }

        // Custom weights are validated before any expensive work runs.
        const riskWeights = requireRiskWeights(options.riskWeights);

        const changedFiles = await getChangedFiles(git, baseBranch, "HEAD");

        // 3. Symbol analyzer with a single shared AST index (high performance)
        const symbolAnalyzer = new SymbolAnalyzer(process.cwd());

        // 4. Per-file analysis: symbols, modified lines, real consumers
        const { analyses, changedFileAnalyses, skippedFiles } =
            await collectChangedFileAnalyses(git, baseBranch, changedFiles, symbolAnalyzer);

        // 5. Build the dependency graph and the test mapping
        const graph = buildDependencyGraph(process.cwd());
        const testMapping = buildTestMapping(process.cwd());

        // 6. Build the report items and link the per-file analysis data
        const reportItems = generateReport(changedFiles, analyses, graph);
        wireReportData(reportItems, changedFileAnalyses, testMapping.coverage);

        // 7. Compute the assessment (risk score, impact coverage, counts)
        const assessment = computeAssessment(
            reportItems,
            testMapping,
            collectChangedLines(changedFileAnalyses),
            riskWeights
        );

        // 8. Print the report
        const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();

        printConsoleReport(reportItems, {
            gitContext: {
                branch: currentBranch,
                base: baseBranch
            },
            testMapping,
            assessment,
            ...(skippedFiles > 0 ? { skippedFiles } : {})
        });
    });

program.parse(process.argv);
