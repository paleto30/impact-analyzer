import type { DependencyGraph, TransitiveImpact } from "../graph/dependency.js";
import { FileStatus, type ChangedFile } from "../git/types.js";
import type { FileAnalysis } from "../parser/parser.js";
import type { SymbolImpact } from "../analyzer/symbol-analyzer.js";
import { computeImpactCoverage, isTestFile, type TestMapping } from "../testing/test-mapping.js";
import { findTransitiveDependents } from "../graph/dependency.js";
import { evaluateRisk, type RiskLevel, type RiskWeights } from "../risk/risk.js";

// ANSI color codes for zero-dependency terminal styling
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    gray: "\x1b[90m"
};

export interface ImpactReportItem {
    file: ChangedFile;
    analysis?: FileAnalysis | undefined;
    dependents: string[];
    transitiveImpact?: TransitiveImpact;
    symbolImpacts?: SymbolImpact[];
    modifiedSymbolNames?: Set<string>;
    relatedTests?: string[];
}

export function generateReport(
    changedFiles: ChangedFile[],
    analyses: Map<string, FileAnalysis>,
    graph: DependencyGraph
): ImpactReportItem[] {
    const reportItems: ImpactReportItem[] = [];

    for (const file of changedFiles) {
        const dependents = graph.dependents[file.path] || [];

        reportItems.push({
            file,
            analysis: analyses.get(file.path),
            dependents,
            transitiveImpact: findTransitiveDependents(graph, file.path)
        });
    }

    return reportItems;
}

export interface ReportOptions {
    gitContext?: { branch: string; base: string };
    testMapping?: TestMapping;
    riskWeights?: RiskWeights;
    changedLines?: number;
}

export function printConsoleReport(
    reportItems: ImpactReportItem[],
    options?: ReportOptions
): void {
    const { gitContext, testMapping, riskWeights, changedLines = 0 } = options ?? {};
    // ------------------------------------------------------------
    // REPORT HEADER
    // ------------------------------------------------------------

    console.log("");
    console.log(
        `${colors.cyan}╭──────────────────────────────────────────────────────────╮${colors.reset}`
    );
    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `${colors.bold}🔍 IMPACT ANALYZER — BLAST RADIUS REPORT${colors.reset}`
    );
    console.log(
        `${colors.cyan}╰──────────────────────────────────────────────────────────╯${colors.reset}`
    );

    // ------------------------------------------------------------
    // GIT CONTEXT
    // ------------------------------------------------------------

    if (gitContext) {
        console.log("");
        console.log(` ${colors.bold}📂 Git Context${colors.reset}`);

        console.log(
            `    ${colors.gray}├─ Branch     :${colors.reset} ` +
            `${colors.bold}${gitContext.branch}${colors.reset}`
        );

        console.log(
            `    ${colors.gray}└─ Comparing  :${colors.reset} ` +
            `${colors.bold}HEAD vs ${gitContext.base}${colors.reset}`
        );
    }

    // ------------------------------------------------------------
    // DESCRIPTION
    // ------------------------------------------------------------

    console.log("");
    console.log(
        `${colors.dim}ℹ️  What is this? This report evaluates the downstream impact${colors.reset}`
    );
    console.log(
        `${colors.dim}   of your changes before merging or pushing code.${colors.reset}`
    );

    // ------------------------------------------------------------
    // REAL SYMBOL IMPACTS
    // ------------------------------------------------------------

    /*
     * IMPORTANT:
     *
     * The dependency graph represents potential/static dependencies.
     * It must NOT be used to determine the actual blast radius.
     *
     * The actual blast radius is based only on consumers of symbols
     * that were detected as impacted.
     *
     * Import statements are ignored because they do not represent
     * an active execution/use of the symbol.
     */
    const uniqueImpactedFiles = new Set<string>();

    for (const item of reportItems) {
        if (!item.symbolImpacts) {
            continue;
        }

        for (const symbolImpact of item.symbolImpacts) {
            for (const consumer of symbolImpact.consumers) {
                if (consumer.snippet.trim().startsWith("import ")) {
                    continue;
                }

                uniqueImpactedFiles.add(consumer.filePath);
            }
        }
    }

    const uniqueCount = uniqueImpactedFiles.size;

    // Tests que cubren las áreas afectadas (excluyendo los archivos de test)
    const testsCoveringAffected = new Set<string>();
    for (const file of uniqueImpactedFiles) {
        if (isTestFile(file)) continue;
        for (const test of testMapping?.coverage.get(file) ?? []) {
            testsCoveringAffected.add(test);
        }
    }

    // ------------------------------------------------------------
    // IMPACT COVERAGE (§15)
    // ------------------------------------------------------------

    const impactCoverage = computeImpactCoverage(
        Array.from(uniqueImpactedFiles),
        testMapping ?? { testFiles: [], coverage: new Map() }
    );

    // ------------------------------------------------------------
    // RISK ASSESSMENT (§16)
    // ------------------------------------------------------------

    const transitiveFiles = new Set<string>();
    let maxDepth = 0;
    for (const item of reportItems) {
        for (const file of item.transitiveImpact?.files ?? []) {
            transitiveFiles.add(file);
        }
        maxDepth = Math.max(maxDepth, item.transitiveImpact?.maxDepth ?? 0);
    }

    const assessment = evaluateRisk({
        uniqueConsumers: uniqueCount,
        transitiveFiles: transitiveFiles.size,
        maxDepth,
        affectedComponents: impactCoverage.affected,
        uncoveredComponents: impactCoverage.uncovered,
        changedLines
    }, riskWeights);

    const riskStyles: Record<RiskLevel, { text: string; emoji: string; description: string }> = {
        LOW: {
            text: "LOW RISK",
            emoji: "🟢",
            description: "Changes are isolated or have minimal downstream exposure."
        },
        MEDIUM: {
            text: "MEDIUM RISK",
            emoji: "🟡",
            description: "Changes affect a few dependent modules. Verify them before proceeding."
        },
        HIGH: {
            text: "HIGH RISK",
            emoji: "🟠",
            description: "Wide blast radius! Core contracts or heavily used files were altered."
        },
        CRITICAL: {
            text: "CRITICAL RISK",
            emoji: "🔴",
            description: "Critical core changes with broad downstream exposure. Review before merging."
        }
    };

    const riskLevelText = `${riskStyles[assessment.level].emoji} ${assessment.level} RISK`;
    const riskDescription = riskStyles[assessment.level].description;

    console.log("");
    console.log(
        `${colors.yellow}╭─ Risk Assessment ────────────────────────────────────────╮${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset} ${riskLevelText} ` +
        `${colors.dim}(score: ${assessment.score}/100)${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset} ${colors.gray}${riskDescription}${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset} ${colors.gray}${uniqueCount} unique dependent file${uniqueCount === 1 ? "" : "s"} at risk${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset} ${colors.bold}Reasons:${colors.reset}`
    );
    for (const reason of assessment.reasons) {
        console.log(
            `${colors.yellow}│${colors.reset}   ${colors.gray}•${colors.reset} ${reason.label}` +
            (reason.points > 0 ? ` ${colors.dim}(${reason.points} pts)${colors.reset}` : "")
        );
    }
    console.log(
        `${colors.yellow}╰──────────────────────────────────────────────────────────╯${colors.reset}`
    );

    // ------------------------------------------------------------
    // IMPACT COVERAGE BOX
    // ------------------------------------------------------------

    console.log("");
    console.log(
        `${colors.blue}╭─ Impact Coverage ─────────────────────────────────────────╮${colors.reset}`
    );
    console.log(
        `${colors.blue}│${colors.reset} ` +
        `Affected components : ${colors.bold}${impactCoverage.affected}${colors.reset}`
    );
    console.log(
        `${colors.blue}│${colors.reset} ` +
        `Covered             : ${colors.green}${colors.bold}${impactCoverage.covered}${colors.reset}`
    );
    console.log(
        `${colors.blue}│${colors.reset} ` +
        `Uncovered           : ${colors.red}${colors.bold}${impactCoverage.uncovered}${colors.reset}`
    );
    console.log(
        `${colors.blue}│${colors.reset} ` +
        `Impact coverage     : ${colors.bold}${impactCoverage.affected === 0 ? "—" : `${impactCoverage.percentage}%`}${colors.reset}`
    );

    if (impactCoverage.uncoveredFiles.length > 0) {
        console.log(
            `${colors.blue}│${colors.reset}`
        );
        console.log(
            `${colors.blue}│${colors.reset} ${colors.red}${colors.bold}Uncovered:${colors.reset}`
        );
        impactCoverage.uncoveredFiles.forEach(file => {
            console.log(
                `${colors.blue}│${colors.reset}   ${colors.gray}✗${colors.reset} ${colors.cyan}${file}${colors.reset}`
            );
        });
    }

    console.log(
        `${colors.blue}╰──────────────────────────────────────────────────────────╯${colors.reset}`
    );

    // ------------------------------------------------------------
    // FILE ANALYSIS
    // ------------------------------------------------------------

    for (const item of reportItems) {
        let statusColor = colors.blue;
        let statusLabel = "MODIFIED";

        if (item.file.status === FileStatus.Added) {
            statusColor = colors.green;
            statusLabel = "ADDED";
        } else if (item.file.status === FileStatus.Deleted) {
            statusColor = colors.red;
            statusLabel = "DELETED";
        }

        // --------------------------------------------------------
        // FILE HEADER
        // --------------------------------------------------------

        console.log("");
        console.log(
            `${colors.cyan}╭──────────────────────────────────────────────────────────╮${colors.reset}`
        );
        console.log(
            `${colors.cyan}│${colors.reset} ` +
            `${colors.bold}📄 [${statusColor}${statusLabel}${colors.reset}${colors.bold}] ` +
            `${item.file.path}${colors.reset}`
        );
        console.log(
            `${colors.cyan}╰──────────────────────────────────────────────────────────╯${colors.reset}`
        );

        // --------------------------------------------------------
        // EXPORTED SYMBOLS
        // --------------------------------------------------------

        const symbols: { name: string; type: string }[] = [];

        if (item.analysis) {
            const {
                functions,
                classes,
                interfaces,
                types,
                enums
            } = item.analysis.exports;

            functions.forEach(f =>
                symbols.push({
                    name: f,
                    type: "function"
                })
            );

            classes.forEach(c =>
                symbols.push({
                    name: c.name,
                    type: `class, ${c.methods.length} methods`
                })
            );

            interfaces.forEach(i =>
                symbols.push({
                    name: i,
                    type: "interface"
                })
            );

            types.forEach(t =>
                symbols.push({
                    name: t,
                    type: "type"
                })
            );

            enums.forEach(e =>
                symbols.push({
                    name: e,
                    type: "enum"
                })
            );
        }

        console.log("");
        console.log(
            `    ${colors.gray}├─${colors.reset} ` +
            `${colors.bold}Exported symbols${colors.reset}`
        );

        if (symbols.length > 0) {
            symbols.forEach((sym, index) => {
                const isLast = index === symbols.length - 1;
                const prefix = isLast ? "└─" : "├─";

                const wasModified =
                    item.modifiedSymbolNames?.has(sym.name) ?? false;

                const marker = wasModified
                    ? `${colors.yellow}✏️  `
                    : "";

                const suffix = wasModified
                    ? ` ${colors.dim}(modified)${colors.reset}`
                    : "";

                console.log(
                    `    ${colors.gray}│${colors.reset}    ` +
                    `${colors.gray}${prefix}${colors.reset} ` +
                    `${marker}${colors.bold}${sym.name}${colors.reset} ` +
                    `${colors.dim}(${sym.type})${colors.reset}` +
                    suffix
                );
            });
        } else {
            console.log(
                `    ${colors.gray}│${colors.reset}    ` +
                `${colors.gray}└─ Exported symbols: None${colors.reset}`
            );
        }

        // --------------------------------------------------------
        // DETAILED DOWNSTREAM USAGES
        // --------------------------------------------------------

        console.log(
            `    ${colors.gray}│${colors.reset}`
        );

        console.log(
            `    ${colors.gray}├─${colors.reset} ` +
            `${colors.bold}Detailed Downstream Usages${colors.reset}`
        );

        if (item.symbolImpacts && item.symbolImpacts.length > 0) {
            const consumersByFile = new Map<
                string,
                {
                    symbol: string;
                    line: number;
                    snippet: string;
                }[]
            >();

            for (const symImpact of item.symbolImpacts) {
                for (const consumer of symImpact.consumers) {
                    // Omitir líneas de importación pura para evitar ruido visual repetitivo
                    if (consumer.snippet.trim().startsWith("import ")) {
                        continue;
                    }

                    if (!consumersByFile.has(consumer.filePath)) {
                        consumersByFile.set(consumer.filePath, []);
                    }

                    consumersByFile.get(consumer.filePath)!.push({
                        symbol: symImpact.symbolName,
                        line: consumer.line,
                        snippet: consumer.snippet
                    });
                }
            }

            const entries = Array.from(consumersByFile.entries());

            if (entries.length > 0) {
                entries.forEach(([consumerFile, usages], fileIndex) => {
                    const isLastFile = fileIndex === entries.length - 1;
                    const filePrefix = isLastFile ? "└─" : "├─";

                    console.log(
                        `    ${colors.gray}│${colors.reset}    ` +
                        `${colors.gray}${filePrefix}${colors.reset} ` +
                        `📂 Affected File: ` +
                        `${colors.cyan}${colors.bold}${consumerFile}${colors.reset}`
                    );

                    usages.forEach((usage, usageIndex) => {
                        const isLastUsage =
                            usageIndex === usages.length - 1;

                        const usagePrefix = isLastUsage ? "└─" : "├─";

                        console.log(
                            `    ${colors.gray}│${colors.reset}         ` +
                            `${colors.gray}${usagePrefix}${colors.reset} ` +
                            `🔸 Target Symbol: ` +
                            `${colors.bold}${usage.symbol}${colors.reset} ` +
                            `(Line ${colors.cyan}${usage.line}${colors.reset})`
                        );

                        console.log(
                            `    ${colors.gray}│${colors.reset}                ` +
                            `${colors.gray}💻 Code snippet : "${colors.reset}` +
                            `${colors.blue}${usage.snippet.trim()}${colors.reset}` +
                            `${colors.gray}"${colors.reset}`
                        );
                    });
                });
            } else {
                console.log(
                    `    ${colors.gray}│${colors.reset}    ` +
                    `${colors.gray}└─ No active execution usages found outside of imports${colors.reset}`
                );
            }
        } else {
            console.log(
                `    ${colors.gray}│${colors.reset}    ` +
                `${colors.gray}└─ No downstream usages detected${colors.reset}`
            );
        }

        // --------------------------------------------------------
        // FILES IN BLAST RADIUS
        // --------------------------------------------------------

        console.log(
            `    ${colors.gray}│${colors.reset}`
        );

        /*
         * Keep the original dependency graph here because this section
         * intentionally shows the static/potential dependency information.
         *
         * Risk Assessment above is based on REAL symbol impacts only.
         */
        const dependents = item.dependents;

        const transitive = item.transitiveImpact;

        if (dependents.length > 0) {
            const reachSummary =
                transitive && transitive.maxDepth > 1
                    ? ` (${dependents.length} direct, ${transitive.files.length} total, depth ${transitive.maxDepth})`
                    : ` (${dependents.length})`;

            console.log(
                `    ${colors.gray}├─${colors.reset} ` +
                `${colors.bold}Files in blast radius${colors.reset}` +
                `${colors.dim}${reachSummary}${colors.reset}`
            );

            dependents.forEach((dep, index) => {
                const isLast = index === dependents.length - 1;
                const prefix = isLast ? "└─" : "├─";

                console.log(
                    `    ${colors.gray}│${colors.reset}    ` +
                    `${colors.gray}${prefix}${colors.reset} ` +
                    `${colors.cyan}${dep}${colors.reset}`
                );
            });
        } else {
            console.log(
                `    ${colors.gray}├─${colors.reset} ` +
                `${colors.green}Files in blast radius: None (Isolated change)${colors.reset}`
            );
        }

        // --------------------------------------------------------
        // RELATED TESTS
        // --------------------------------------------------------

        console.log(
            `    ${colors.gray}│${colors.reset}`
        );

        console.log(
            `    ${colors.gray}└─${colors.reset} ` +
            `${colors.bold}Related Tests${colors.reset}`
        );

        const relatedTests = item.relatedTests ?? [];

        if (relatedTests.length > 0) {
            relatedTests.forEach((testFile, index) => {
                const isLast = index === relatedTests.length - 1;
                const prefix = isLast ? "└─" : "├─";

                console.log(
                    `         ${colors.gray}${prefix}${colors.reset} ` +
                    `${colors.green}✓${colors.reset} ${colors.cyan}${testFile}${colors.reset}`
                );
            });
        } else {
            console.log(
                `         ${colors.gray}└─ ${colors.red}✗ No test covers this file${colors.reset}`
            );
        }
    }

    // ------------------------------------------------------------
    // ANALYSIS SUMMARY
    // ------------------------------------------------------------

    console.log("");
    console.log(
        `${colors.cyan}╭─ Analysis Summary ───────────────────────────────────────╮${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Files analyzed       : ${colors.bold}${reportItems.length}${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Test files detected  : ${colors.bold}${testMapping?.testFiles.length ?? 0}${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Tests on affected    : ${colors.bold}${testsCoveringAffected.size}${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Dependent files      : ${colors.bold}${uniqueCount}${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Risk level           : ${riskLevelText}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Impact coverage      : ${colors.bold}${impactCoverage.affected === 0 ? "—" : `${impactCoverage.percentage}%`}${colors.reset}`
    );

    console.log(
        `${colors.cyan}╰──────────────────────────────────────────────────────────╯${colors.reset}`
    );

    // ------------------------------------------------------------
    // RECOMMENDED ACTION
    // ------------------------------------------------------------

    console.log("");
    console.log(
        ` ${colors.bold}💡 Recommended Action${colors.reset}`
    );

    if (uniqueCount > 0) {
        console.log(
            `    Run tests covering the dependent files listed above`
        );
        console.log(
            `    to ensure no unexpected regressions were introduced.`
        );

        if (impactCoverage.uncoveredFiles.length > 0) {
            console.log("");
            console.log(
                `    ${colors.red}${colors.bold}⚠️  These affected areas have no detected tests:${colors.reset}`
            );
            impactCoverage.uncoveredFiles.forEach(file => {
                console.log(
                    `    ${colors.gray}├─${colors.reset} ${colors.cyan}${file}${colors.reset}`
                );
            });
            console.log(
                `    ${colors.gray}└─${colors.reset} Consider adding tests before merging.`
            );
        }
    } else {
        console.log(
            `    This change is completely safe from downstream regressions.`
        );
    }

    console.log("");
}