import path from "node:path";
import { existsSync } from "node:fs";
import { Project } from "ts-morph";

let sharedProject: Project | undefined;
let sharedProjectRoot: string | undefined;

/**
 * Returns a single Project instance per project root.
 *
 * parser, dependency and symbol-analyzer share the same AST tree and the same
 * tsconfig settings (path aliases, target/module), avoiding parsing the same
 * files multiple times with different projects.
 *
 * A root tsconfig.json is optional: monorepo workspaces usually have one
 * tsconfig per package and none at the root. In that case default compiler
 * options are used and src/ is scanned explicitly — required because symbol
 * impact analysis runs before buildDependencyGraph loads any files, so
 * findReferences would otherwise resolve against an empty project.
 */
export function getProject(projectRoot: string): Project {
    if (!sharedProject || sharedProjectRoot !== projectRoot) {
        const tsconfigPath = path.join(projectRoot, "tsconfig.json");

        if (existsSync(tsconfigPath)) {
            sharedProject = new Project({
                tsConfigFilePath: tsconfigPath,
                skipAddingFilesFromTsConfig: false
            });
        } else {
            sharedProject = new Project();
            sharedProject.addSourceFilesAtPaths(`${projectRoot}/src/**/*.ts`);
        }

        sharedProjectRoot = projectRoot;
    }
    return sharedProject;
}