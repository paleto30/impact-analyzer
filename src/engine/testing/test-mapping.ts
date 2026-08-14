import path from "path";
import { getProject } from "../project.js";

export interface TestMapping {
    testFiles: string[];
    coverage: Map<string, string[]>;
}

/**
 * Determina si una ruta corresponde a un archivo de test (nombre-based).
 */
export function isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(filePath);
}

/**
 * Construye el mapeo test -> código cubierto.
 *
 * Un archivo de test "cubre" un archivo de producción si lo importa
 * directamente (imports relativos). La cobertura transitiva no se
 * considera en el MVP.
 */
export function buildTestMapping(projectRoot: string): TestMapping {
    const project = getProject(projectRoot);
    const coverage = new Map<string, string[]>();
    const testFiles: string[] = [];

    for (const sourceFile of project.getSourceFiles()) {
        const filePath = path.relative(projectRoot, sourceFile.getFilePath());
        if (!isTestFile(filePath)) continue;

        testFiles.push(filePath);

        for (const importDecl of sourceFile.getImportDeclarations()) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();
            if (!moduleSpecifier.startsWith(".")) continue;

            const importedSourceFile = importDecl.getModuleSpecifierSourceFile();
            if (!importedSourceFile) continue;

            const importedPath = path.relative(projectRoot, importedSourceFile.getFilePath());
            const list = coverage.get(importedPath) ?? [];
            if (!list.includes(filePath)) list.push(filePath);
            coverage.set(importedPath, list);
        }
    }

    return { testFiles, coverage };
}

/**
 * Devuelve los archivos de test que cubren directamente un archivo.
 */
export function getRelatedTests(mapping: TestMapping, filePath: string): string[] {
    return mapping.coverage.get(filePath) ?? [];
}

export interface ImpactCoverage {
    affected: number;
    covered: number;
    uncovered: number;
    uncoveredFiles: string[];
    percentage: number;
}

/**
 * Calcula la cobertura de las áreas afectadas (§15 del documento original).
 *
 * Las áreas afectadas son los archivos de producción impactados por el
 * cambio (los archivos de test no se cuentan como áreas, son instrumentos).
 * Un área está cubierta si existe al menos un test que la importa.
 */
export function computeImpactCoverage(
    affectedFiles: string[],
    mapping: TestMapping
): ImpactCoverage {
    const affected = affectedFiles.filter(f => !isTestFile(f));

    const uncoveredFiles = affected.filter(
        f => getRelatedTests(mapping, f).length === 0
    );
    const covered = affected.length - uncoveredFiles.length;
    const percentage = affected.length === 0
        ? 0
        : Math.round((covered / affected.length) * 100);

    return {
        affected: affected.length,
        covered,
        uncovered: uncoveredFiles.length,
        uncoveredFiles,
        percentage
    };
}