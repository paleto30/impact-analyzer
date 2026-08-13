import { Project } from "ts-morph";

export function analyzeFile(filePath: string) {
    const project = new Project();
    
    // Añadimos el archivo al proyecto de ts-morph
    const sourceFile = project.addSourceFileAtPath(filePath);

    console.log(`Analizando AST para el archivo: ${sourceFile.getFilePath()}`);

    // Extraemos las funciones exportadas como primer ejemplo
    const exportedFunctions = sourceFile.getFunctions().filter(f => f.isExported());
    
    for (const func of exportedFunctions) {
        console.log(` - Función exportada: ${func.getName()}`);
    }
}