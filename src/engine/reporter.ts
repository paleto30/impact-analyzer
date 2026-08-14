import type { DependencyGraph } from "./dependency.js";
import { FileStatus, type ChangedFile } from "./git/types.js";
import type { FileAnalysis } from "./parser.js";
import type { SymbolImpact } from "./symbol-analyzer.js";

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
    symbolImpacts?: SymbolImpact[];
    modifiedSymbolNames?: Set<string>; // <-- nuevo: qué símbolos realmente cambiaron
}


export function generateReport(
    changedFiles: ChangedFile[],
    analyses: Map<string, FileAnalysis>,
    graph: DependencyGraph
): ImpactReportItem[] {
    const reportItems: ImpactReportItem[] = [];

    for (const file of changedFiles) {
        reportItems.push({
            file,
            analysis: analyses.get(file.path),
            dependents: graph[file.path] || []
        });
    }
    // lo reconoce como modificado
    return reportItems;
}

export function printConsoleReport(
    reportItems: ImpactReportItem[],
    gitContext?: { branch: string; base: string }
): void {
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
    // UNIQUE DEPENDENTS
    // ------------------------------------------------------------

    const uniqueDependents = new Set<string>();

    for (const item of reportItems) {
        for (const dep of item.dependents) {
            uniqueDependents.add(dep);
        }
    }

    const uniqueCount = uniqueDependents.size;

    // ------------------------------------------------------------
    // RISK ASSESSMENT
    // ------------------------------------------------------------

    let riskLevelText = `${colors.green}🟢 LOW RISK${colors.reset}`;
    let riskLevelLabel = "LOW";
    let riskDescription =
        "Changes are isolated or have minimal downstream exposure.";

    if (uniqueCount > 2 && uniqueCount <= 5) {
        riskLevelText = `${colors.yellow}🟡 MODERATE RISK${colors.reset}`;
        riskLevelLabel = "MODERATE";
        riskDescription =
            "Changes affect a few dependent modules. Verify them before proceeding.";
    } else if (uniqueCount > 5) {
        riskLevelText = `${colors.red}🔴 HIGH RISK${colors.reset}`;
        riskLevelLabel = "HIGH";
        riskDescription =
            "Wide blast radius! Core contracts or heavily used files were altered.";
    }

    console.log("");
    console.log(
        `${colors.yellow}╭─ Risk Assessment ────────────────────────────────────────╮${colors.reset}`
    );
    console.log(
        `${colors.yellow}│${colors.reset} ${riskLevelText}`
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
        `${colors.yellow}╰──────────────────────────────────────────────────────────╯${colors.reset}`
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

        const dependents = item.dependents;

        if (dependents.length > 0) {
            console.log(
                `    ${colors.gray}└─${colors.reset} ` +
                `${colors.bold}Files in blast radius (${dependents.length})${colors.reset}`
            );

            dependents.forEach((dep, index) => {
                const isLast = index === dependents.length - 1;
                const prefix = isLast ? "└─" : "├─";

                console.log(
                    `         ${colors.gray}${prefix}${colors.reset} ` +
                    `${colors.cyan}${dep}${colors.reset}`
                );
            });
        } else {
            console.log(
                `    ${colors.gray}└─${colors.reset} ` +
                `${colors.green}Files in blast radius: None (Isolated change)${colors.reset}`
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
        `Dependent files      : ${colors.bold}${uniqueCount}${colors.reset}`
    );

    console.log(
        `${colors.cyan}│${colors.reset} ` +
        `Risk level           : ${riskLevelText}`
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
    } else {
        console.log(
            `    This change is completely safe from downstream regressions.`
        );
    }

    console.log("");
}