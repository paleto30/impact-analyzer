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

    return reportItems;
}

export function printConsoleReport(
    reportItems: ImpactReportItem[],
    gitContext?: { branch: string; base: string }
): void {
    console.log(`\n${colors.cyan}${colors.bold}==================================================${colors.reset}`);
    console.log(` ${colors.bold}🔍 IMPACT ANALYZER — BLAST RADIUS REPORT${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}==================================================${colors.reset}`);

    if (gitContext) {
        console.log(` ${colors.bold}📂 Git Context:${colors.reset}`);
        console.log(`    ${colors.gray}├─ Branch     :${colors.reset} ${colors.bold}${gitContext.branch}${colors.reset}`);
        console.log(`    ${colors.gray}└─ Comparing  :${colors.reset} ${colors.bold}HEAD vs ${gitContext.base}${colors.reset}`);
        console.log(`${colors.cyan}--------------------------------------------------${colors.reset}`);
    }

    console.log(`\n${colors.dim}ℹ️  What is this? This report evaluates the downstream impact${colors.reset}`);
    console.log(`${colors.dim}   of your changes before merging or pushing code.${colors.reset}`);

    // Collect ALL unique dependent files across all changed items using a Set
    const uniqueDependents = new Set<string>();
    for (const item of reportItems) {
        for (const dep of item.dependents) {
            uniqueDependents.add(dep);
        }
    }
    const uniqueCount = uniqueDependents.size;

    // Determine risk level based on UNIQUE affected files
    let riskLevelText = `${colors.green}🟢 LOW RISK${colors.reset}`;
    let riskDescription = "Changes are isolated or have minimal downstream exposure.";

    if (uniqueCount > 2 && uniqueCount <= 5) {
        riskLevelText = `${colors.yellow}🟡 MODERATE RISK${colors.reset}`;
        riskDescription = "Changes affect a few dependent modules. Verify them before proceeding.";
    } else if (uniqueCount > 5) {
        riskLevelText = `${colors.red}🔴 HIGH RISK${colors.reset}`;
        riskDescription = "Wide blast radius! Core contracts or heavily used files were altered.";
    }

    console.log(`\n 📊 Risk Assessment: ${riskLevelText}`);
    console.log(`    ${colors.gray}${riskDescription} (${uniqueCount} unique dependent file${uniqueCount === 1 ? '' : 's'} at risk)${colors.reset}`);

    // Iterar sobre cada archivo modificado como una "Tarjeta" independiente
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

        // --- TARJETA DE ARCHIVO ---
        console.log(`\n${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
        console.log(` 📄 [${statusColor}${statusLabel}${colors.reset}] ${colors.bold}${colors.cyan}${item.file.path}${colors.reset}`);
        console.log(`${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);

        // 1. Símbolos exportados en este archivo
        const symbols: { name: string; type: string }[] = [];
        if (item.analysis) {
            const { functions, classes, interfaces, types, enums } = item.analysis.exports;
            functions.forEach(f => symbols.push({ name: f, type: "function" }));
            classes.forEach(c => symbols.push({ name: c.name, type: `class (${c.methods.length} methods)` }));
            interfaces.forEach(i => symbols.push({ name: i, type: "interface" }));
            types.forEach(t => symbols.push({ name: t, type: "type" }));
            enums.forEach(e => symbols.push({ name: e, type: "enum" }));
        }

        if (symbols.length > 0) {
            console.log(` ${colors.bold}⚡ Exported Symbols:${colors.reset}`);
            symbols.forEach(sym => {
                const wasModified = item.modifiedSymbolNames?.has(sym.name) ?? false;
                const marker = wasModified ? `${colors.yellow}✏️ ` : "   ";
                const suffix = wasModified ? ` ${colors.dim}(modified)${colors.reset}` : "";

                console.log(`    ${marker}${colors.bold}${sym.name}${colors.reset} ${colors.dim}(${sym.type})${colors.reset}${suffix}`);
            });
        } else {
            console.log(` ${colors.bold}⚡ Exported Symbols:${colors.reset} ${colors.gray}None${colors.reset}`);
        }

        // 2. Usos y consumos detallados (Downstream Usages)
        if (item.symbolImpacts && item.symbolImpacts.length > 0) {
            console.log(`\n ${colors.bold}🔍 Downstream Usages (Where it is used):${colors.reset}`);

            const consumersByFile = new Map<string, { symbol: string; line: number; snippet: string }[]>();

            for (const symImpact of item.symbolImpacts) {
                for (const consumer of symImpact.consumers) {
                    if (consumer.snippet.trim().startsWith("import ")) continue;

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
                entries.forEach(([consumerFile, usages]) => {
                    console.log(`    📂 Consumer File: ${colors.cyan}${colors.bold}${consumerFile}${colors.reset}`);
                    usages.forEach(usage => {
                        console.log(`       ↳ Symbol: ${colors.bold}${usage.symbol}${colors.reset} (Line ${colors.cyan}${usage.line}${colors.reset})`);
                        console.log(`         ${colors.gray}💻 "${colors.reset}${colors.blue}${usage.snippet.trim()}${colors.reset}${colors.gray}"${colors.reset}`);
                    });
                });
            } else {
                console.log(`    ${colors.gray}↳ No active execution usages outside of imports.${colors.reset}`);
            }
        }

        // 3. Dependientes potencialmente afectados
        const dependents = item.dependents;
        if (dependents.length > 0) {
            console.log(`\n ${colors.bold}⚠️ Potentially Affected Files (${dependents.length}):${colors.reset}`);
            dependents.forEach(dep => {
                console.log(`    • ${colors.cyan}${dep}${colors.reset}`);
            });
        } else {
            console.log(`\n ${colors.green}✔ Affected dependents: None (Isolated change)${colors.reset}`);
        }
    }

    console.log(`\n${colors.cyan}==================================================${colors.reset}`);
    console.log(` ${colors.bold}💡 Recommended Action:${colors.reset}`);
    if (uniqueCount > 0) {
        console.log(`    Run tests covering the dependent files listed above`);
        console.log(`    to ensure no unexpected regressions were introduced.`);
    } else {
        console.log(`    This change is completely safe from downstream regressions.`);
    }

    console.log(`\n ${colors.bold}📊 Summary:${colors.reset} ${reportItems.length} files analyzed | ${colors.bold}${uniqueCount}${colors.reset} unique dependent files impacted`);
    console.log(`${colors.cyan}${colors.bold}==================================================${colors.reset}\n`);
}