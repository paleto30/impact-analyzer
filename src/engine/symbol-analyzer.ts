import path from "path";
import { Project, type SourceFile, type Node, InterfaceDeclaration, TypeAliasDeclaration, ClassDeclaration, FunctionDeclaration, EnumDeclaration } from "ts-morph";


type ExportableNode =
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | ClassDeclaration
    | FunctionDeclaration
    | EnumDeclaration;

export interface SymbolImpact {
    symbolName: string;
    filePath: string;
    consumers: {
        filePath: string;
        line: number;
        snippet: string;
    }[];
}

function rangeIntersectsModifiedLines(
    startLine: number,
    endLine: number,
    modifiedLines: Set<number>
): boolean {
    for (let line = startLine; line <= endLine; line++) {
        if (modifiedLines.has(line)) return true;
    }
    return false;
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

    /**
     * Resuelve el nodo AST real de un símbolo exportado por nombre.
     * Compartido entre analyzeSymbolImpact y getModifiedSymbolNames
     * para no duplicar la cadena de lookup.
     */
    private getExportNode(sourceFile: SourceFile, symbolName: string): ExportableNode | undefined {
        return (
            sourceFile.getInterface(symbolName) ||
            sourceFile.getTypeAlias(symbolName) ||
            sourceFile.getClass(symbolName) ||
            sourceFile.getFunction(symbolName) ||
            sourceFile.getEnum(symbolName)
        );
    }

    /**
     * Determina, de una lista de símbolos exportados, cuáles tienen su
     * rango de líneas físicamente superpuesto con las líneas modificadas
     * por Git. No busca referencias (operación cara) — solo intersección
     * de rangos, para uso en el reporte (qué marcar como "modificado").
     */
    public getModifiedSymbolNames(
        relativePath: string,
        symbolNames: string[],
        modifiedLines: Set<number>
    ): Set<string> {
        const modified = new Set<string>();

        const absolutePath = path.resolve(this.projectRoot, relativePath);
        const sourceFile = this.project.getSourceFile(absolutePath);

        if (!sourceFile || modifiedLines.size === 0) {
            return modified;
        }

        for (const symbolName of symbolNames) {
            const exportNode = this.getExportNode(sourceFile, symbolName);
            if (!exportNode) continue;

            const startLine = exportNode.getStartLineNumber();
            const endLine = exportNode.getEndLineNumber();

            if (rangeIntersectsModifiedLines(startLine, endLine, modifiedLines)) {
                modified.add(symbolName);
            }
        }

        return modified;
    }

    public analyzeSymbolImpact(
        relativePath: string,
        symbolNames: string[],
        modifiedLines?: Set<number>
    ): SymbolImpact[] {
        const absolutePath = path.resolve(this.projectRoot, relativePath);
        const sourceFile = this.project.getSourceFile(absolutePath);

        if (!sourceFile || symbolNames.length === 0) {
            return []
        }

        const impacts: SymbolImpact[] = [];

        for (const symbolName of symbolNames) {
            const exportNode = this.getExportNode(sourceFile, symbolName);

            if (!exportNode) continue;

            if (modifiedLines && modifiedLines.size > 0) {
                const startLine = exportNode.getStartLineNumber();
                const endLine = exportNode.getEndLineNumber();

                if (!rangeIntersectsModifiedLines(startLine, endLine, modifiedLines)) {
                    continue;
                }
            }

            const consumersMap = new Map<string, { filePath: string; line: number; snippet: string }>();
            const referencedSymbols = exportNode.findReferences();

            for (const ref of referencedSymbols) {
                for (const refNode of ref.getReferences()) {
                    const refSourceFile = refNode.getSourceFile();
                    const refFilePath = path.relative(this.projectRoot, refSourceFile.getFilePath());

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