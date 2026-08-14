import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function git(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" });
}

export interface GitRepoFixture {
    dir: string;
    cleanup: () => void;
}

/**
 * Creates a temporary git repository with an initial commit containing the
 * given files (or a README placeholder when empty).
 */
export function createGitRepo(files: Record<string, string> = {}): GitRepoFixture {
    const dir = mkdtempSync(path.join(os.tmpdir(), "impact-analyzer-test-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.name", "Test");
    git(dir, "config", "user.email", "test@example.com");

    const entries = Object.entries(files);
    if (entries.length === 0) {
        writeFileSync(path.join(dir, "README.md"), "fixture");
    }
    for (const [name, content] of entries) {
        writeFileSync(path.join(dir, name), content);
    }

    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");

    return {
        dir,
        cleanup: () => rmSync(dir, { recursive: true, force: true })
    };
}