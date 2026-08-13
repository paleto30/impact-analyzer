import { simpleGit, type SimpleGit, CleanOptions } from "simple-git"

export async function detectRepo() {
    const git: SimpleGit = simpleGit(process.cwd());

    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
        console.log("Este directorio no es un repositorio Git.");
        return
    }

    const branchSummary = await git.branch()
    const currentBranch = branchSummary.current

    console.log(`Es un repositorio Git: ${isRepo}`);
    console.log(`Branch actual: ${currentBranch}`);
}