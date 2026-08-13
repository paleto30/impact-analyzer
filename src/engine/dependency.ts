import path from "path";
import { Project } from "ts-morph";


export interface DependencyGraph {
    // Relación: "archivo base" -> "archivos que lo importan"
    [targetFile: string]: string[];
}

export function buildDependencyGraph(projectRoot: string): DependencyGraph {
    const project = new Project();

    // Añadimos todos los archivos fuente del proyecto
    project.addSourceFilesAtPaths(`${projectRoot}/src/**/*.ts`);

    const graph: DependencyGraph = {};

    for (const sourceFile of project.getSourceFiles()) {
        const filePath = path.relative(projectRoot, sourceFile.getFilePath());

        // Revisar cada import que hace este archivo
        for (const importDecl of sourceFile.getImportDeclarations()) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();

            // Solo nos interesan los imports relativos (ej: "./parser.js" o "../git/detect.js")
            if (moduleSpecifier.startsWith(".")) {
                // Resolver la ruta absoluta/relativa del archivo importado
                const importedSourceFile = importDecl.getModuleSpecifierSourceFile();

                if (importedSourceFile) {
                    const importedPath = path.relative(projectRoot, importedSourceFile.getFilePath());

                    if (!graph[importedPath]) {
                        graph[importedPath] = [];
                    }

                    // Añadir el archivo actual a la lista de dependientes
                    if (!graph[importedPath].includes(filePath)) {
                        graph[importedPath].push(filePath);
                    }
                }
            }
        }
    }

    return graph;
}