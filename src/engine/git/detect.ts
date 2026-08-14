import { simpleGit, type SimpleGit } from "simple-git"
import { FileStatus, type ChangedFile } from "./types.js";

export async function detectRepo(): Promise<SimpleGit | null> {
    const git: SimpleGit = simpleGit(process.cwd());

    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
        console.log("This directory is not a Git repository.");
        return null;
    }

    return git;
}


export async function detectBaseBranch(git: SimpleGit): Promise<string | null> {
    try {
        const remoteHead = await git.raw([
            "symbolic-ref",
            "refs/remotes/origin/HEAD"
        ]);

        // refs/remotes/origin/main -> main
        return remoteHead.trim().split("/").pop() ?? null;

    } catch (error) {
        const branchSummary = await git.branchLocal();

        if (branchSummary.all.includes("main"))
            return "main";

        if (branchSummary.all.includes("master"))
            return "master";

        return null;
    }
}

export async function getChangedFiles(
    git: SimpleGit,
    base: string,
    current: string
): Promise<ChangedFile[]> {

    const output = await git.diff(["--name-status", base, current]);

    const changedFiles: ChangedFile[] = [];

    const lines = output
        .split("\n")
        .filter((line) => line.trim() !== "");

    for (const line of lines) {
        const parts = line.split("\t");
        const status = parts[0];

        if (!status) {
            throw new Error(`Invalid git diff line: ${line}`);
        }

        // Renames: "R100\told/path.ts\tnew/path.ts" -> 3 columns
        if (status.startsWith("R")) {
            const [, oldPath, newPath] = parts;

            if (!oldPath || !newPath) {
                throw new Error(`Invalid rename line: ${line}`);
            }

            changedFiles.push({ path: oldPath, status: FileStatus.Deleted });
            changedFiles.push({ path: newPath, status: FileStatus.Added });
            continue;
        }

        // Normal cases: "M\tpath.ts" -> 2 columns
        const [, path] = parts;

        if (!path) {
            throw new Error(`Invalid git diff line: ${line}`);
        }

        switch (status) {
            case "A":
                changedFiles.push({ path, status: FileStatus.Added });
                break;

            case "M":
                changedFiles.push({ path, status: FileStatus.Modified });
                break;

            case "D":
                changedFiles.push({ path, status: FileStatus.Deleted });
                break;

            default:
                throw new Error(`Unsupported git status: ${status}`);
        }
    }

    return changedFiles;
}


export async function branchExists(git: SimpleGit, ref: string) {
    try {
        await git.raw(["rev-parse", "--verify", ref]);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Obtiene un conjunto de números de línea que fueron modificados en un archivo respecto a la rama base.
 */
export async function getModifiedLines(git: SimpleGit, base: string, head: string, filePath: string): Promise<Set<number>> {
    const modifiedLines = new Set<number>();
    try {
        // Obtenemos el diff unificado para el archivo específico
        const diff = await git.diff([base, head, "--", filePath]);
        const lines = diff.split("\n");

        let currentNewLine = 0;

        for (const line of lines) {
            if (line.startsWith("@@")) {
                // Formato de chunk de git diff: @@ -l,s +l,s @@
                const match = line.match(/\+([0-9]+)(?:,([0-9]+))?/);
                if (match && match[1]) {
                    currentNewLine = parseInt(match[1], 10);
                }
            } else if (line.startsWith("+") && !line.startsWith("+++")) {
                // Es una línea añadida o modificada
                modifiedLines.add(currentNewLine);
                currentNewLine++;
            } else if (line.startsWith(" ") && !line.startsWith("---")) {
                // Línea de contexto (sin cambios)
                currentNewLine++;
            }
            // Las líneas que empiezan con '-' no avanzan el contador del archivo nuevo
        }
    } catch (error) {
        // Si falla el diff, devolvemos conjunto vacío por seguridad
    }
    return modifiedLines;
}