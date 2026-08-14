export interface FileAnalysis {
    filePath: string;
    exports: {
        functions: string[];
        classes: { name: string; methods: string[] }[];
        interfaces: string[];
        types: string[];
        enums: string[];
    };
    imports: string[];
}