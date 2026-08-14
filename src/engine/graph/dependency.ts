import path from "path";
import { getProject } from "../project.js";

export interface DependencyGraph {
    // Relación: "archivo importado" -> "archivos que lo importan" (who depends on this)
    dependents: { [targetFile: string]: string[] };
    // Relación: "archivo" -> "archivos que importa" (what does this affect directly)
    imports: { [sourceFile: string]: string[] };
}

export interface TransitiveImpact {
    files: string[];
    maxDepth: number;
    depthMap: Map<string, number>;
}

export function buildDependencyGraph(projectRoot: string): DependencyGraph {
    const project = getProject(projectRoot);

    // Añadimos todos los archivos fuente del proyecto (idempotente: los ya
    // cargados por tsconfig se reutilizan, no se vuelven a parsear)
    project.addSourceFilesAtPaths(`${projectRoot}/src/**/*.ts`);

    const dependents: { [targetFile: string]: string[] } = {};
    const imports: { [sourceFile: string]: string[] } = {};

    for (const sourceFile of project.getSourceFiles()) {
        const filePath = path.relative(projectRoot, sourceFile.getFilePath());

        const importedByThis = imports[filePath] ?? [];
        imports[filePath] = importedByThis;

        // Revisar cada import que hace este archivo
        for (const importDecl of sourceFile.getImportDeclarations()) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();

            // Solo nos interesan los imports relativos (ej: "./parser.js" o "../git/detect.js")
            if (!moduleSpecifier.startsWith(".")) continue;

            // Resolver la ruta del archivo importado
            const importedSourceFile = importDecl.getModuleSpecifierSourceFile();
            if (!importedSourceFile) continue;

            const importedPath = path.relative(projectRoot, importedSourceFile.getFilePath());

            if (!dependents[importedPath]) {
                dependents[importedPath] = [];
            }

            // Añadir el archivo actual a la lista de dependientes del importado
            if (!dependents[importedPath].includes(filePath)) {
                dependents[importedPath].push(filePath);
            }

            // Añadir el importado a la lista de imports del archivo actual
            if (!importedByThis.includes(importedPath)) {
                importedByThis.push(importedPath);
            }
        }
    }

    return { dependents, imports };
}

/**
 * Recorre transitivamente el grafo de dependientes (BFS) desde un archivo
 * fuente para responder "¿qué afecta A?" (§13 del documento original).
 *
 * - files: todos los dependientes directos e indirectos (sin el archivo origen)
 * - depthMap: distancia en saltos de import desde el origen
 * - maxDepth: profundidad máxima alcanzada
 *
 * El set de visitados protege contra dependencias circulares.
 */
export function findTransitiveDependents(
    graph: DependencyGraph,
    sourceFile: string
): TransitiveImpact {
    const visited = new Set<string>([sourceFile]);
    const depthMap = new Map<string, number>();
    let maxDepth = 0;

    let queue: string[] = [sourceFile];

    while (queue.length > 0) {
        const next: string[] = [];

        for (const file of queue) {
            const parentDepth = depthMap.get(file) ?? 0;

            for (const dependent of graph.dependents[file] ?? []) {
                if (visited.has(dependent)) continue;

                visited.add(dependent);
                const depth = parentDepth + 1;
                depthMap.set(dependent, depth);
                maxDepth = Math.max(maxDepth, depth);
                next.push(dependent);
            }
        }

        queue = next;
    }

    const files = Array.from(visited).filter(f => f !== sourceFile);

    return { files, maxDepth, depthMap };
}