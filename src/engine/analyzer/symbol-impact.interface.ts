export interface SymbolImpact {
    symbolName: string;
    filePath: string;
    consumers: {
        filePath: string;
        line: number;
        snippet: string;
    }[];
}