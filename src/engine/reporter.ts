import type { DependencyGraph } from "./dependency.js";
import { FileStatus, type ChangedFile } from "./git/types.js";
import type { FileAnalysis } from "./parser.js";

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

    // Mostrar el contexto de Git de forma limpia si existe
    if (gitContext) {
        console.log(` ${colors.bold}📂 Git Context:${colors.reset}`);
        console.log(`    ${colors.gray}├─ Branch     :${colors.reset} ${colors.bold}${gitContext.branch}${colors.reset}`);
        console.log(`    ${colors.gray}└─ Comparing  :${colors.reset} ${colors.bold}HEAD vs ${gitContext.base}${colors.reset}`);
        console.log(`${colors.cyan}--------------------------------------------------${colors.reset}`);
    }

    console.log(`\n${colors.dim}ℹ️  What is this? This report evaluates the downstream impact${colors.reset}`);
    console.log(`${colors.dim}   of your changes before merging or pushing code.${colors.reset}`);

    let totalDependentsCount = 0;
    for (const item of reportItems) {
        totalDependentsCount += item.dependents.length;
    }

    // Determine risk level with colors
    let riskLevelText = `${colors.green}🟢 LOW RISK${colors.reset}`;
    let riskDescription = "Changes are isolated or have minimal downstream exposure.";

    if (totalDependentsCount > 2 && totalDependentsCount <= 5) {
        riskLevelText = `${colors.yellow}🟡 MODERATE RISK${colors.reset}`;
        riskDescription = "Changes affect a few dependent modules. Verify them before proceeding.";
    } else if (totalDependentsCount > 5) {
        riskLevelText = `${colors.red}🔴 HIGH RISK${colors.reset}`;
        riskDescription = "Wide blast radius! Core contracts or heavily used files were altered.";
    }

    console.log(`\n 📊 Risk Assessment: ${riskLevelText}`);
    console.log(`    ${colors.gray}${riskDescription} (${totalDependentsCount} dependent files at risk)${colors.reset}`);

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

        console.log(`\n ${colors.bold}📄 [${statusColor}${statusLabel}${colors.reset}${colors.bold}] ${item.file.path}${colors.reset}`);

        // Collect all exported symbols
        const symbols: { name: string; type: string }[] = [];
        if (item.analysis) {
            const { functions, classes, interfaces, types, enums } = item.analysis.exports;
            functions.forEach(f => symbols.push({ name: f, type: "function" }));
            classes.forEach(c => symbols.push({ name: c.name, type: `class (${c.methods.length} methods)` }));
            interfaces.forEach(i => symbols.push({ name: i, type: "interface" }));
            types.forEach(t => symbols.push({ name: t, type: "type" }));
            enums.forEach(e => symbols.push({ name: e, type: "enum" }));
        }

        // Display exported symbols
        if (symbols.length > 0) {
            console.log(`    ${colors.gray}└─ Exported contracts/symbols modified:${colors.reset}`);
            symbols.forEach((sym, index) => {
                const isLast = index === symbols.length - 1;
                const prefix = isLast ? "       └─" : "       ├─";
                console.log(`    ${colors.gray}${prefix}${colors.reset} ${colors.bold}${sym.name}${colors.reset} ${colors.dim}(${sym.type})${colors.reset}`);
            });
        } else {
            console.log(`    ${colors.gray}└─ Exported symbols: None${colors.reset}`);
        }

        // Display affected dependents
        const dependents = item.dependents;
        if (dependents.length > 0) {
            console.log(`    ${colors.yellow}└─ Potentially affected files (${dependents.length}):${colors.reset}`);
            dependents.forEach((dep, index) => {
                const isLast = index === dependents.length - 1;
                const prefix = isLast ? "       └─" : "       ├─";
                console.log(`    ${colors.gray}${prefix}${colors.reset} ${colors.cyan}${dep}${colors.reset}`);
            });
        } else {
            console.log(`    ${colors.green}└─ Affected dependents: None (Isolated change)${colors.reset}`);
        }
    }

    // Actionable recommendation footer
    console.log(`\n${colors.cyan}--------------------------------------------------${colors.reset}`);
    console.log(` ${colors.bold}💡 Recommended Action:${colors.reset}`);
    if (totalDependentsCount > 0) {
        console.log(`    Run tests covering the dependent files listed above`);
        console.log(`    to ensure no unexpected regressions were introduced.`);
    } else {
        console.log(`    This change is completely safe from downstream regressions.`);
    }

    // Global summary
    console.log(`\n ${colors.bold}📊 Summary:${colors.reset} ${reportItems.length} files analyzed | ${colors.bold}${totalDependentsCount}${colors.reset} dependent links impacted`);
    console.log(`${colors.cyan}${colors.bold}==================================================${colors.reset}\n`);
}