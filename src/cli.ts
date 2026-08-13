#!/usr/bin/env node
import { Command } from "commander";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/types.js";
import { analyzeFile, type FileAnalysis } from "./engine/parser.js";
import { buildDependencyGraph } from "./engine/dependency.js";
import { generateReport, printConsoleReport } from "./engine/reporter.js";

const program = new Command();

program
    .name("impact-analyzer")
    .description("Analiza el impacto de tus cambios de codigo")
    .version("0.0.1");

program
    .command("analyze")
    .description("Analiza los cambios actuales del repositorio")
    .option("-b, --base <branch>", "Branch base para comparar")
    .action(async (options) => {

        const git = await detectRepo()
        if (!git) return;

        // 1. Determinar la base candidata
        let baseBranch = options.base

        // Si el usuario no pasó --base, intentamos detectarla automáticamente
        if (!baseBranch) {
            baseBranch = await detectBaseBranch(git);
        }

        // Si la detección automática tampoco encontró nada, usamos el fallback
        if (!baseBranch) {
            console.log("⚠️ No se pudo determinar una branch base automática. Usando 'HEAD~1' por defecto.");
            baseBranch = "HEAD~1";
        }

        // 2. Validación defensiva (Fail Fast & Clear)
        const exists = await branchExists(git, baseBranch);
        if (!exists) {
            console.error(`❌ Error: La branch o referencia base '${baseBranch}' no existe en este repositorio.`);
            console.error(`💡 Consejo: Si estás en un clon superficial (CI), asegúrate de hacer fetch de la branch base.`);
            process.exit(1);
        }

        console.log(`🔍 Analizando cambios contra la base: ${baseBranch}`);

        const currentBranch = "HEAD";
        const changedFiles = await getChangedFiles(git, baseBranch, currentBranch);

        // 1. Recopilar análisis AST de los archivos modificados
        const analyses = new Map<string, FileAnalysis>();
        for (const file of changedFiles) {
            if (file.status === FileStatus.Deleted) continue;
            try {
                const analysis = analyzeFile(file.path);
                analyses.set(file.path, analysis);
            } catch (error) {
                // Archivo no parseable o binario, se omite silenciosamente del AST
            }
        }

        // 2. Construir grafo de dependencias
        const graph = buildDependencyGraph(process.cwd());

        // 3. Generar y mostrar el reporte estructurado
        const reportItems = generateReport(changedFiles, analyses, graph);
        printConsoleReport(reportItems);
    })

program.parse(process.argv);