import path from "node:path";
import { Project } from "ts-morph";

let sharedProject: Project | undefined;
let sharedProjectRoot: string | undefined;

/**
 * Returns a single Project instance per project root.
 *
 * parser, dependency and symbol-analyzer share the same AST tree and the same
 * tsconfig settings (path aliases, target/module), avoiding parsing the same
 * files multiple times with different projects.
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