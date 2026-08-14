import path from "node:path";
import { getProject } from "../project.js";
import type { TestMapping } from "./test-mapping.interface.js";

/**
 * Determines whether a path corresponds to a test file (name-based).
 */
export function isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(filePath);
}

/**
 * Builds the mapping test -> covered code.
 *
 * A test file "covers" a production file if it imports it directly
 * (relative imports). Transitive coverage is not considered in the MVP.
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
 * Returns the test files that directly cover a file.
 */
export function getRelatedTests(mapping: TestMapping, filePath: string): string[] {
    return mapping.coverage.get(filePath) ?? [];
}