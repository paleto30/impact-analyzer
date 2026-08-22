import type { FileAnalysis } from "../parser/file-analysis.interface.js";

export type ExportedSymbolKind =
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "variable";

export interface ExportedSymbolView {
    name: string;
    kind: ExportedSymbolKind;
    methodCount?: number;
}

/**
 * Flattens a FileAnalysis into the ordered symbol list shown in the report.
 *
 * Presentation-free: `kind` carries the semantics and display labels are
 * derived by the formatter. This keeps data transformation out of the
 * rendering code and avoids string-typed discriminators.
 */
export function buildExportedSymbolsView(analysis: FileAnalysis): ExportedSymbolView[] {
    const symbols: ExportedSymbolView[] = [];

    analysis.exports.functions.forEach(f =>
        symbols.push({ name: f, kind: "function" })
    );

    analysis.exports.classes.forEach(c =>
        symbols.push({
            name: c.name,
            kind: "class",
            methodCount: c.methods.length
        })
    );

    analysis.exports.interfaces.forEach(i =>
        symbols.push({ name: i, kind: "interface" })
    );

    analysis.exports.types.forEach(t =>
        symbols.push({ name: t, kind: "type" })
    );

    analysis.exports.enums.forEach(e =>
        symbols.push({ name: e, kind: "enum" })
    );

    analysis.exports.variables.forEach(v =>
        symbols.push({ name: v, kind: "variable" })
    );

    return symbols;
}

/**
 * Display label for a symbol, e.g. "function" or "class, 3 methods".
 */
export function formatSymbolKind(symbol: ExportedSymbolView): string {
    if (symbol.kind !== "class") return symbol.kind;
    const count = symbol.methodCount ?? 0;
    return `class, ${count} ${count === 1 ? "method" : "methods"}`;
}
