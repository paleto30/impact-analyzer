import { analyzeFile } from "./engine/parser.js";

export function testImpactFunction() {
    return "Hello Impact Analyzer";
}

export class Prueba {
    public runCheck() {
        return analyzeFile("src/test.ts");
    }
}
