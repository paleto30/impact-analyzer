#!/usr/bin/env node
import { Command } from "commander";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/types.js";
import { analyzeFile, getExportedSymbolNames, type FileAnalysis } from "./engine/parser.js";
import { buildDependencyGraph } from "./engine/dependency.js";
import { generateReport, printConsoleReport } from "./engine/reporter.js";
import { SymbolAnalyzer, type SymbolImpact } from "./engine/symbol-analyzer.js";

const program = new Command();

program
    .name("impact-analyzer")
    .description("Analyze the impact of your code changes")
    .version("0.0.1");

program
    .command("analyze")
    .description("Analyze current repository changes")
    .option("-b, --base <branch>", "Base branch to compare against")
    .action(async (options) => {

        const git = await detectRepo();
        if (!git) return;

        // 1. Determine candidate base branch
        let baseBranch = options.base;

        // If the user didn't pass --base, attempt auto-detection
        if (!baseBranch) {
            baseBranch = await detectBaseBranch(git);
        }

        // Fallback if auto-detection fails
        if (!baseBranch) {
            console.log("⚠️ Could not determine an automatic base branch. Using 'HEAD~1' by default.");
            baseBranch = "HEAD~1";
        }

        // 2. Defensive validation (Fail Fast & Clear)
        const exists = await branchExists(git, baseBranch);
        if (!exists) {
            console.error(`❌ Error: The base branch or reference '${baseBranch}' does not exist in this repository.`);
            console.error(`💡 Tip: If you are in a shallow clone (CI), make sure to fetch the base branch.`);
            process.exit(1);
        }

        const changedFiles = await getChangedFiles(git, baseBranch, "HEAD");

        // 3. Inicializar el Analizador de Símbolos con Indexación Única (Alto Rendimiento)
        const symbolAnalyzer = new SymbolAnalyzer(process.cwd());

        // 4. Collect AST analysis & Symbol Impacts of modified files
        const analyses = new Map<string, FileAnalysis>();
        const allSymbolImpacts: SymbolImpact[] = [];

        for (const file of changedFiles) {
            if (file.status === FileStatus.Deleted) continue;
            try {
                const analysis = analyzeFile(file.path);
                analyses.set(file.path, analysis);

                // Extraer los símbolos exportados y buscar sus consumidores exactos en el proyecto
                const exportedSymbols = getExportedSymbolNames(analysis);
                if (exportedSymbols.length > 0) {
                    const impacts = symbolAnalyzer.analyzeSymbolImpact(file.path, exportedSymbols);
                    allSymbolImpacts.push(...impacts);
                }
            } catch (error) {
                // Non-parseable or binary file, skip silently from AST
            }
        }

        // 5. Build dependency graph
        const graph = buildDependencyGraph(process.cwd());

        // 6. Generate and print the structured report
        const reportItems = generateReport(changedFiles, analyses, graph);

        // Vincular los impactos de símbolos específicos a cada ítem del reporte
        reportItems.forEach(item => {
            item.symbolImpacts = allSymbolImpacts.filter(si => si.filePath === item.file.path);
        });

        const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();

        printConsoleReport(reportItems, {
            branch: currentBranch,
            base: baseBranch
        });
    })

program.parse(process.argv);