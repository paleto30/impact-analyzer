#!/usr/bin/env node
import { Command } from "commander";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles, getModifiedLines } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/types.js";
import { analyzeFile, getExportedSymbolNames, type FileAnalysis } from "./engine/parser/parser.js";
import { buildDependencyGraph } from "./engine/graph/dependency.js";
import { generateReport, printConsoleReport } from "./engine/reporter/reporter.js";
import { buildTestMapping } from "./engine/testing/test-mapping.js";
import type { RiskWeights } from "./engine/risk/risk.js";
import { SymbolAnalyzer, type SymbolImpact } from "./engine/analyzer/symbol-analyzer.js";

const program = new Command();

program
    .name("impact-analyzer")
    .description("Analyze the impact of your code changes")
    .version("1.0.0");

program
    .command("analyze")
    .description("Analyze current repository changes")
    .option("-b, --base <branch>", "Base branch to compare against")
    .option("--risk-weights <json>", "JSON with custom risk factor weights (e.g. {\"callerImpact\":40,\"testGaps\":30})")
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

        // Mapas temporales para almacenar las líneas y símbolos modificados por cada archivo
        const modifiedLinesMap = new Map<string, Set<number>>();
        const modifiedSymbolNamesMap = new Map<string, Set<string>>();

        for (const file of changedFiles) {
            if (file.status === FileStatus.Deleted) continue;
            try {
                const analysis = analyzeFile(file.path);
                analyses.set(file.path, analysis);

                const exportedSymbols = getExportedSymbolNames(analysis);
                if (exportedSymbols.length > 0) {
                    const modifiedLines = await getModifiedLines(git, baseBranch, "HEAD", file.path);
                    modifiedLinesMap.set(file.path, modifiedLines);

                    // 1. Obtenemos qué símbolos se tocaron físicamente en este archivo
                    const modifiedSymbols = symbolAnalyzer.getModifiedSymbolNames(
                        file.path,
                        exportedSymbols,
                        modifiedLines
                    );
                    modifiedSymbolNamesMap.set(file.path, modifiedSymbols);

                    // 2. ⚡ FILTRO CLAVE: Solo analizamos el impacto si AL MENOS UN símbolo cambió
                    if (modifiedSymbols.size > 0) {
                        // Pasamos solo los símbolos que realmente sufrieron cambios al analizador
                        const impacts = symbolAnalyzer.analyzeSymbolImpact(
                            file.path,
                            Array.from(modifiedSymbols),
                            modifiedLines
                        );
                        allSymbolImpacts.push(...impacts);
                    }
                }
            } catch (error) {
                // Non-parseable or binary file, skip silently
            }
        }

        // 5. Build dependency graph
        const graph = buildDependencyGraph(process.cwd());

        // 5b. Build test mapping (Fase 5)
        const testMapping = buildTestMapping(process.cwd());

        // 6. Generate and print the structured report
        const reportItems = generateReport(changedFiles, analyses, graph);

        // Vincular los impactos y los símbolos realmente modificados por rango de líneas a cada ítem del reporte
        reportItems.forEach(item => {
            item.symbolImpacts = allSymbolImpacts.filter(si => si.filePath === item.file.path);

            item.modifiedSymbolNames = modifiedSymbolNamesMap.get(item.file.path) || new Set<string>();

            item.relatedTests = testMapping.coverage.get(item.file.path) ?? [];
        });

        const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();

        let riskWeights: RiskWeights | undefined;
        if (options.riskWeights) {
            try {
                riskWeights = JSON.parse(options.riskWeights);
            } catch (error) {
                console.error("❌ Error: --risk-weights must be a valid JSON object.");
                process.exit(1);
            }
        }

        const changedLines = Array.from(modifiedLinesMap.values())
            .reduce((acc, lines) => acc + lines.size, 0);

        printConsoleReport(reportItems, {
            gitContext: {
                branch: currentBranch,
                base: baseBranch
            },
            testMapping,
            ...(riskWeights ? { riskWeights } : {}),
            changedLines
        });
    });

program.parse(process.argv);