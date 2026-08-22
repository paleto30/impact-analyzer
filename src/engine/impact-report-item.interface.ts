import type { ChangedFile } from "./git/changed-file.interface.js";
import type { FileAnalysis } from "./parser/file-analysis.interface.js";
import type { SymbolImpact } from "./analyzer/symbol-impact.interface.js";
import type { DependencyGraph } from "./graph/dependency-graph.interface.js";
import type { TransitiveImpact } from "./graph/transitive-impact.interface.js";

export interface ImpactReportItem {
    file: ChangedFile;
    analysis?: FileAnalysis | undefined;
    dependents: string[];
    transitiveImpact?: TransitiveImpact;
    symbolImpacts?: SymbolImpact[];
    modifiedSymbolNames?: Set<string>;
    modifiedSymbolLineCounts?: Map<string, number>;
    modifiedClassMethods?: Map<string, string[]>; // className -> [methodName1, methodName2, ...]
    relatedTests?: string[];
}