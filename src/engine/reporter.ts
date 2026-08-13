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
        let statusLabel = "MODIFIED";
        if (item.file.status === FileStatus.Added) statusLabel = "ADDED";
        if (item.file.status === FileStatus.Deleted) statusLabel = "DELETED";

        console.log(`\n📄 [${statusLabel}] ${item.file.path}`);

        // 1. Display analyzed symbols (if any)
        if (item.analysis) {
            const { functions, classes, interfaces, types, enums } = item.analysis.exports;

            if (functions.length > 0) {
                console.log(`   🔹 Exported functions: ${functions.join(", ")}`);
            }
            if (classes.length > 0) {
                const classNames = classes.map(c => `${c.name} (${c.methods.length} methods)`).join(", ");
                console.log(`   🔹 Exported classes: ${classNames}`);
            }
            if (interfaces.length > 0) {
                console.log(`   🔹 Exported interfaces: ${interfaces.join(", ")}`);
            }
            if (types.length > 0) {
                console.log(`   🔹 Exported types: ${types.join(", ")}`);
            }
            if (enums.length > 0) {
                console.log(`   🔹 Exported enums: ${enums.join(", ")}`);
            }
        }

        // 2. Display affected dependents hierarchically
        const dependents = item.dependents;
        totalDependentsCount += dependents.length;

        if (dependents.length > 0) {
            console.log(`   ⚠️ Potentially affected files (${dependents.length}):`);
            dependents.forEach((dep, index) => {
                const isLast = index === dependents.length - 1;
                const prefix = isLast ? "      └─" : "      ├─";
                console.log(`${prefix} ${dep}`);
            });
        } else {
            console.log(`   ✅ Isolated change: no other files depend directly on this.`);
        }
    }

    // 3. Global impact summary
    console.log("\n--------------------------------------------------");
    console.log(` 📊 Summary: ${reportItems.length} files analyzed | ${totalDependentsCount} dependent files impacted`);
    console.log("==================================================\n");
}