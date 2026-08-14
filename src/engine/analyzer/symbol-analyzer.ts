import path from "node:path";
import { type Project, type SourceFile, type Node, InterfaceDeclaration, TypeAliasDeclaration, ClassDeclaration, FunctionDeclaration, EnumDeclaration, VariableDeclaration } from "ts-morph";
import { getProject } from "../project.js";
import type { SymbolImpact } from "./symbol-impact.interface.js";

type ExportableNode =
    | InterfaceDeclaration
    | TypeAliasDeclaration
    | ClassDeclaration
    | FunctionDeclaration
    | EnumDeclaration
    | VariableDeclaration;

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
        this.project = getProject(projectRoot);
    }

    /**
     * Resolves the real AST node of an exported symbol by name.
     * Shared between analyzeSymbolImpact and getModifiedSymbolNames
     * to avoid duplicating the lookup chain.
     */
    private getExportNode(sourceFile: SourceFile, symbolName: string): ExportableNode | undefined {
        return (
            sourceFile.getInterface(symbolName) ||
            sourceFile.getTypeAlias(symbolName) ||
            sourceFile.getClass(symbolName) ||
            sourceFile.getFunction(symbolName) ||
            sourceFile.getEnum(symbolName) ||
            sourceFile.getVariableDeclaration(symbolName)
        );
    }

    /**
     * Determines, from a list of exported symbols, which ones have their line
     * range physically overlapping the lines modified by Git. It does not
     * search references (an expensive operation) — only range intersection,
     * for reporting purposes (what to mark as "modified").
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