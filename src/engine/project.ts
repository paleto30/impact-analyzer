import path from "path";
import { Project } from "ts-morph";

let sharedProject: Project | undefined;
let sharedProjectRoot: string | undefined;

/**
 * Devuelve una única instancia de Project por raíz de proyecto.
 *
 * parser, dependency y symbol-analyzer comparten el mismo árbol AST y la
 * misma configuración de tsconfig (paths aliases, target/module), evitando
 * parsear los mismos archivos varias veces con proyectos distintos.
 */
export function getProject(projectRoot: string): Project {
    if (!sharedProject || sharedProjectRoot !== projectRoot) {
        sharedProject = new Project({
            tsConfigFilePath: path.join(projectRoot, "tsconfig.json"),
            skipAddingFilesFromTsConfig: false
        });
        sharedProjectRoot = projectRoot;
    }
    return sharedProject;
}