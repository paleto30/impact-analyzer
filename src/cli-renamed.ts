#!/usr/bin/env node
import { Command } from "commander";
import { detectRepo } from "./git/detect.js";

const program = new Command();

program
    .name("impact-analyzer")
    .description("Analiza el impacto de tus cambios de codigo")
    .version("0.0.1");

program
    .command("analyze")
    .description("Analiza los cambios actuales del repositorio")
    .action(async()=>{
        await detectRepo()
    })

program.parse(process.argv);