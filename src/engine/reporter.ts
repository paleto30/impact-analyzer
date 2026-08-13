import type { DependencyGraph } from "./dependency.js";
import type { ChangedFile } from "./git/types.js";
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
    console.log(" 📊 IMPACT ANALYZER - REPORTE DE IMPACTO");
    console.log("==================================================");

    for (const item of reportItems) {
        console.log(`\n📄 [${item.file.status.toUpperCase()}] ${item.file.path}`);

        if (item.analysis) {
            const { functions, classes } = item.analysis.exports;
            if (functions.length > 0) {
                console.log(`   🔸 Funciones exportadas: ${functions.join(", ")}`);
            }
            if (classes.length > 0) {
                console.log(`   🔸 Clases exportadas: ${classes.map(c => c.name).join(", ")}`);
            }
        }

        if (item.dependents.length > 0) {
            console.log(`   ⚠️ Archivos afectados directamente (${item.dependents.length}):`);
            for (const dep of item.dependents) {
                console.log(`      └─ ${dep}`);
            }
        } else {
            console.log(`   ✅ Sin dependientes directos en el proyecto.`);
        }
    }
    console.log("\n==================================================");
}