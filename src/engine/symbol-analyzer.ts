import path from "path";
import { Project } from "ts-morph";


export interface SymbolImpact {
    symbolName: string;
    filePath: string;
    consumers: {
        filePath: string;
        line: number;
        snippet: string;
    }[];
}


export class SymbolAnalyzer {

    private project: Project;
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;

        this.project = new Project({
            tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
            skipAddingFilesFromTsConfig: false
        });
    }

    public analyzeSymbolImpact(relativePath: string, symbolNames: string[]): SymbolImpact[] {
        const absolutePath = path.resolve(this.projectRoot, relativePath);
        const sourceFile = this.project.getSourceFile(absolutePath);

        if (!sourceFile || symbolNames.length === 0) {
            return []
        }

        const impacts: SymbolImpact[] = [];

        for (const symbolName of symbolNames) {
            const exportNode =
                sourceFile.getInterface(symbolName) ||
                sourceFile.getTypeAlias(symbolName) ||
                sourceFile.getClass(symbolName) ||
                sourceFile.getFunction(symbolName) ||
                sourceFile.getEnum(symbolName);

            if (!exportNode) continue;

            const consumersMap = new Map<string, { filePath: string; line: number; snippet: string }>();

            // Encontramos todas las referencias en el proyecto de manera optimizada
            const referencedSymbols = exportNode.findReferences();


            for (const ref of referencedSymbols) {
                for (const refNode of ref.getReferences()) {
                    // Evitamos contarnos a nosotros mismos dentro del archivo original
                    const refSourceFile = refNode.getSourceFile();
                    const refFilePath = path.relative(this.projectRoot, refSourceFile.getFilePath());

                    // Omitimos la definición propia
                    if (refNode.isDefinition()) continue;

                    const pos = refNode.getNode().getStart();
                    const line = refSourceFile.getLineAndColumnAtPos(pos).line;
                    const snippet = refSourceFile.getFullText().split('\n')[line - 1]?.trim() || '';

                    const key = `${refFilePath}:${line}`;
                    if (!consumersMap.has(key)) {
                        consumersMap.set(key, {
                            filePath: refFilePath,
                            line,
                            snippet
                        });
                    }
                }
            }

            impacts.push({
                symbolName: symbolName,
                filePath: relativePath,
                consumers: Array.from(consumersMap.values())
            });
        }

        return impacts;

    }
}