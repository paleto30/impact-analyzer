import { Project } from "ts-morph";



export interface FileAnalysis {
    filePath: string;
    exports: {
        functions: string[];
        classes: {
            name: string;
            methods: string[];
        }[];
    };
    imports: string[];
}

export function analyzeFile(filePath: string): FileAnalysis {
    const project = new Project();

    // Añadimos el archivo al proyecto de ts-morph
    const sourceFile = project.addSourceFileAtPath(filePath);

    // 1. Extraer funciones exportadas
    const functions = sourceFile.getFunctions()
        .filter(f => f.isExported())
        .map(f => f.getName() ?? "anonymous");

    // 2. Extraer clases exportadas y sus métodos
    const classes = sourceFile.getClasses()
        .filter(c => c.isExported())
        .map(c => {
            const className = c.getName() ?? "AnonymousClass";
            const methods = c.getMethods().map(m => m.getName());
            return {
                name: className,
                methods
            };
        });

    // 3. Extraer los imports del archivo (módulos o rutas relativas que importa)
    const imports = sourceFile.getImportDeclarations()
        .map(imp => imp.getModuleSpecifierValue());

    return {
        filePath: sourceFile.getFilePath(),
        exports: {
            functions,
            classes
        },
        imports
    };
}