import type { DependencyGraph } from "./dependency.js";
import { FileStatus, type ChangedFile } from "./git/types.js";
import type { FileAnalysis } from "./parser.js";

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

export function printConsoleReport(reportItems: ImpactReportItem[]): void {
    console.log("\n==================================================");
    console.log(" 🔍 IMPACT ANALYZER - IMPACT REPORT");
    console.log("==================================================");

    let totalDependentsCount = 0;
    for (const item of reportItems) {
        totalDependentsCount += item.dependents.length;
    }

    // Determine risk level based on total dependents
    let riskLevel = "🟢 LOW";
    if (totalDependentsCount > 2 && totalDependentsCount <= 5) {
        riskLevel = "🟡 MODERATE";
    } else if (totalDependentsCount > 5) {
        riskLevel = "🔴 HIGH";
    }

    console.log(`\n 📊 Risk Level: ${riskLevel} (${totalDependentsCount} dependent files at risk)`);

    for (const item of reportItems) {
        let statusLabel = "MODIFIED";
        if (item.file.status === FileStatus.Added) statusLabel = "ADDED";
        if (item.file.status === FileStatus.Deleted) statusLabel = "DELETED";

        console.log(`\n 📄 [${statusLabel}] ${item.file.path}`);

        // Collect all exported symbols into a flat vertical list with their type
        const symbols: { name: string; type: string }[] = [];

        if (item.analysis) {
            const { functions, classes, interfaces, types, enums } = item.analysis.exports;

            functions.forEach(f => symbols.push({ name: f, type: "function" }));
            classes.forEach(c => symbols.push({ name: c.name, type: `class (${c.methods.length} methods)` }));
            interfaces.forEach(i => symbols.push({ name: i, type: "interface" }));
            types.forEach(t => symbols.push({ name: t, type: "type" }));
            enums.forEach(e => symbols.push({ name: e, type: "enum" }));
        }

        // Display exported symbols vertically
        if (symbols.length > 0) {
            console.log(`    └─ Exported Symbols:`);
            symbols.forEach((sym, index) => {
                const isLast = index === symbols.length - 1;
                const prefix = isLast ? "       └─" : "       ├─";
                console.log(`${prefix} ${sym.name} (${sym.type})`);
            });
        } else {
            console.log(`    └─ Exported Symbols: None`);
        }

        // Display affected dependents vertically
        const dependents = item.dependents;
        if (dependents.length > 0) {
            console.log(`    └─ Potentially Affected Dependents (${dependents.length}):`);
            dependents.forEach((dep, index) => {
                const isLast = index === dependents.length - 1;
                const prefix = isLast ? "       └─" : "       ├─";
                console.log(`${prefix} ${dep}`);
            });
        } else {
            console.log(`    └─ Potentially Affected Dependents: None (Isolated change)`);
        }
    }

    // Global impact summary
    console.log("\n--------------------------------------------------");
    console.log(` 📊 Summary: ${reportItems.length} files analyzed | ${totalDependentsCount} dependent files impacted`);
    console.log("==================================================\n");
}