#!/usr/bin/env node
import { Command } from "commander";
import { branchExists, detectBaseBranch, detectRepo, getChangedFiles } from "./engine/git/detect.js";
import { FileStatus } from "./engine/git/types.js";
import { analyzeFile } from "./engine/parser.js";

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

        console.log("\nChanged files & AST Analysis:");
        for (const file of changedFiles) {
            console.log(`\n📄 Archivo: ${file.path} [${file.status}]`);

            // Si el archivo fue borrado, no podemos leer su AST del disco
            if (file.status === FileStatus.Deleted) {
                console.log("   (Archivo eliminado, se omite análisis estático)");
                continue;
            }

            try {
                const analysis = analyzeFile(file.path);
                console.log("   📦 Estructura AST detectada:");
                console.log(`      - Funciones exportadas: ${analysis.exports.functions.length > 0 ? analysis.exports.functions.join(", ") : "Ninguna"}`);

                if (analysis.exports.classes.length > 0) {
                    console.log("      - Clases exportadas:");
                    for (const cls of analysis.exports.classes) {
                        console.log(`        * ${cls.name} [Métodos: ${cls.methods.join(", ") || "Ninguno"}]`);
                    }
                }

                console.log(`      - Dependencias (imports): ${analysis.imports.length > 0 ? analysis.imports.join(", ") : "Ninguna"}`);
            } catch (error) {
                console.log(`   ⚠️ No se pudo parsear el archivo: ${error}`);
            }
        }

        console.log("Changed files:");
        console.log(changedFiles);
    })

program.parse(process.argv);