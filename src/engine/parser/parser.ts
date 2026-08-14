import path from "node:path";
import { getProject } from "../project.js";
import type { FileAnalysis } from "./file-analysis.interface.js";

export function analyzeFile(filePath: string): FileAnalysis {
    const project = getProject(process.cwd());
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);
    const sourceFile = project.addSourceFileAtPath(absolutePath);

    // 1. Functions
    const functions = sourceFile.getFunctions()
        .filter(f => f.isExported())
        .map(f => f.getName() ?? "anonymous");

    // 2. Classes
    const classes = sourceFile.getClasses()
        .filter(c => c.isExported())
        .map(c => ({
            name: c.getName() ?? "AnonymousClass",
            methods: c.getMethods().map(m => m.getName())
        }));

    // 3. Interfaces
    const interfaces = sourceFile.getInterfaces()
        .filter(i => i.isExported())
        .map(i => i.getName());

    // 4. Type Aliases
    const types = sourceFile.getTypeAliases()
        .filter(t => t.isExported())
        .map(t => t.getName());

    // 5. Enums
    const enums = sourceFile.getEnums()
        .filter(e => e.isExported())
        .map(e => e.getName());

    // 6. Imports
    const imports = sourceFile.getImportDeclarations()
        .map(imp => imp.getModuleSpecifierValue());

    return {
        filePath: sourceFile.getFilePath(),
        exports: { functions, classes, interfaces, types, enums },
        imports
    };
}

/**
 * Returns a flat list of all symbol names exported by the file.
 */
export function getExportedSymbolNames(analysis: FileAnalysis): string[] {
    const names: string[] = [];
    names.push(...analysis.exports.functions);
    analysis.exports.classes.forEach(c => names.push(c.name));
    names.push(...analysis.exports.interfaces);
    names.push(...analysis.exports.types);
    names.push(...analysis.exports.enums);
    return names;
}