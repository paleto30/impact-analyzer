#!/usr/bin/env node
import { Command } from "commander";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles, getModifiedLines } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/file-status.js";
import { analyzeFile, getExportedSymbolNames } from "./engine/parser/parser.js";
import type { FileAnalysis } from "./engine/parser/file-analysis.interface.js";
import { buildDependencyGraph } from "./engine/graph/dependency.js";
import { computeAssessment, generateReport } from "./engine/assessment.js";
import { printConsoleReport } from "./engine/reporter/reporter.js";
import { buildTestMapping } from "./engine/testing/test-mapping.js";
import { RISK_WEIGHT_KEYS } from "./engine/risk/risk.constants.js";
import type { RiskWeights } from "./engine/risk/risk.types.js";
import { SymbolAnalyzer } from "./engine/analyzer/symbol-analyzer.js";
import type { SymbolImpact } from "./engine/analyzer/symbol-impact.interface.js";

interface ChangedFileAnalysis {
    analysis: FileAnalysis;
    modifiedLines: Set<number>;
    modifiedSymbols: Set<string>;
    symbolImpacts: SymbolImpact[];
}

const program = new Command();

program
    .name("impact-analyzer")
    .description("Analyze the impact of your code changes")
    .version("1.0.0");

program
    .command("analyze")
    .description("Analyze current repository changes")
    .option("-b, --base <branch>", "Base branch to compare against")
    .option("--risk-weights <json>", "JSON with custom risk factor weights (e.g. {\"callerImpact\":40,\"testGaps\":30})")
    .action(async (options) => {

        const git = await detectRepo();
        if (!git) return;

        // 1. Determine the candidate base branch
        let baseBranch = options.base;

        // Auto-detect if the user didn't pass --base
        if (!baseBranch) {
            baseBranch = await detectBaseBranch(git);
        }

        // Fallback if auto-detection fails
        if (!baseBranch) {
            console.log("⚠️ Could not determine an automatic base branch. Using 'HEAD~1' by default.");
            baseBranch = "HEAD~1";
        }

        // 2. Defensive validation (Fail Fast & Clear)
        const exists = await branchExists(git, baseBranch);
        if (!exists) {
            console.error(`❌ Error: The base branch or reference '${baseBranch}' does not exist in this repository.`);
            console.error(`💡 Tip: If you are in a shallow clone (CI), make sure to fetch the base branch.`);
            process.exit(1);
        }

        const changedFiles = await getChangedFiles(git, baseBranch, "HEAD");

        // 3. Symbol analyzer with a single shared AST index (high performance)
        const symbolAnalyzer = new SymbolAnalyzer(process.cwd());

        // 4. Analyze each changed file: exported symbols, modified lines,
        //    physically modified symbols, and their real consumers
        const analyses = new Map<string, FileAnalysis>();
        const changedFileAnalyses = new Map<string, ChangedFileAnalysis>();
        let skippedFiles = 0;

        for (const file of changedFiles) {
            if (file.status === FileStatus.Deleted) continue;
            try {
                const analysis = analyzeFile(file.path);
                analyses.set(file.path, analysis);

                const exportedSymbols = getExportedSymbolNames(analysis);
                if (exportedSymbols.length === 0) continue;

                const modifiedLines = await getModifiedLines(git, baseBranch, "HEAD", file.path);

                // 4.1 Which symbols were physically touched in this file
                const modifiedSymbols = symbolAnalyzer.getModifiedSymbolNames(
                    file.path,
                    exportedSymbols,
                    modifiedLines
                );

                // 4.2 KEY FILTER: only analyze the impact if at least one symbol changed
                const symbolImpacts = modifiedSymbols.size > 0
                    ? symbolAnalyzer.analyzeSymbolImpact(
                        file.path,
                        Array.from(modifiedSymbols),
                        modifiedLines
                    )
                    : [];

                changedFileAnalyses.set(file.path, {
                    analysis,
                    modifiedLines,
                    modifiedSymbols,
                    symbolImpacts
                });
            } catch (error) {
                // Non-parseable or binary file: skip silently
                skippedFiles++;
            }
        }

        // 5. Build the dependency graph and the test mapping
        const graph = buildDependencyGraph(process.cwd());
        const testMapping = buildTestMapping(process.cwd());

        // 6. Build the report items and link the per-file analysis data
        const reportItems = generateReport(changedFiles, analyses, graph);

        reportItems.forEach(item => {
            const changed = changedFileAnalyses.get(item.file.path);
            item.symbolImpacts = changed?.symbolImpacts ?? [];
            item.modifiedSymbolNames = changed?.modifiedSymbols ?? new Set<string>();
            item.relatedTests = testMapping.coverage.get(item.file.path) ?? [];
        });

        // 7. Compute the assessment (risk score, impact coverage, counts)
        let riskWeights: RiskWeights | undefined;
        if (options.riskWeights) {
            try {
                riskWeights = JSON.parse(options.riskWeights);
            } catch (error) {
                console.error("❌ Error: --risk-weights must be a valid JSON object.");
                process.exit(1);
            }

            const parsedWeights = JSON.parse(options.riskWeights) as unknown as Record<string, unknown>;
            const hasUnknownKey = Object.keys(parsedWeights).some(
                key => !(RISK_WEIGHT_KEYS as readonly string[]).includes(key)
            );
            const hasInvalidValue = Object.values(parsedWeights).some(
                value => typeof value !== "number" || !Number.isFinite(value)
            );
            if (hasUnknownKey || hasInvalidValue) {
                console.error(
                    "❌ Error: --risk-weights must only contain numeric keys: " +
                    "callerImpact, affectedFiles, dependencyDepth, testGaps, changeSize."
                );
                process.exit(1);
            }
        }

        const changedLines = Array.from(changedFileAnalyses.values())
            .reduce((acc, file) => acc + file.modifiedLines.size, 0);

        const assessment = computeAssessment(reportItems, testMapping, changedLines, riskWeights);

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