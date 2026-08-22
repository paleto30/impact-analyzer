# ImpactWave

> **🌐 [English](README.en.md) | Español**

Herramienta CLI que analiza el impacto de tus cambios de código antes de hacer merge.

> **"¿Qué puedo romper con este cambio y qué debería probar?"**

📖 **¿Cómo se usa y cómo leer los reportes?** → [docs/GUIA.md](docs/GUIA.md) (guía completa para desarrolladores)

## Instalación y uso

```bash
npm install -g impactwave   # o: npx impactwave
```

Ejecutar dentro de un repositorio Git:

```bash
cd my-project
impactwave
```

> `analyze` es el comando por defecto: `impactwave` y `impactwave analyze` son equivalentes.

Opciones:

| Opción | Descripción |
|---|---|
| `-b, --base <branch>` | Rama base a comparar (autodetección: `origin/HEAD` → `main`/`master` → `HEAD~1`) |
| `--risk-weights <json>` | Pesos personalizados de los factores de riesgo, ej. `{"callerImpact":40,"testGaps":30}`. Propiedades configurables: `callerImpact`, `affectedFiles`, `dependencyDepth`, `testGaps`, `changeSize` (todas opcionales; las omitidas valen 0). Ver [docs/GUIA.md](docs/GUIA.md#21-pesos-configurables-del-riesgo) |

## Qué hace

1. **Git**: detecta el repo, la rama base y los archivos modificados (A/M/D).
2. **AST**: con ts-morph extrae exports e imports de los archivos cambiados, usando un único proyecto indexado con tu `tsconfig.json`. Si el repo no tiene tsconfig en la raíz (típico en monorepos), hace *fallback* al escaneo explícito de `src/**/*.ts`.
3. **Símbolos modificados**: intersecta los rangos de líneas de cada símbolo exportado con las líneas del diff.
4. **Consumidores reales**: `findReferences` encuentra los usos activos de cada símbolo (los imports puros no cuentan como impacto).
5. **Grafo de dependencias**: índice inverso y directo de imports relativos + recorrido transitivo (BFS) con profundidad.
6. **Test mapping**: detecta archivos `*.test.ts`/`*.spec.ts` y mapea qué código cubren.
7. **Risk engine**: score determinístico 0-100 con razones explicables.

## Modelo de riesgo

Cinco factores con umbrales de saturación. Pesos por defecto (configurables con `--risk-weights`):

| Factor | Peso | Señal |
|---|---|---|
| Caller impact | 30 | consumidores directos de símbolos modificados (umbral 10) |
| Affected files | 20 | archivos alcanzados transitivamente (umbral 15) |
| Dependency depth | 15 | niveles de profundidad máxima (umbral 4) |
| Test gaps | 20 | proporción de áreas afectadas sin tests |
| Change size | 15 | líneas modificadas (umbral 200) |

Niveles: `0-25 LOW · 26-50 MEDIUM · 51-75 HIGH · 76-100 CRITICAL`.

Los nombres de los factores son las claves JSON de `--risk-weights` (todas opcionales).

## Reporte

El reporte incluye: contexto git, riesgo con score y razones (con puntos), **Impact Coverage** (áreas afectadas cubiertas por tests — los archivos de solo contratos de tipos no cuentan —, con las descubiertas listadas), y por cada archivo: símbolos exportados (marcando los modificados con ✏️, su conteo de líneas modificadas y, en clases, los métodos públicos concretos modificados), usos downstream con línea y snippet, blast radius con dirección explícita (`imported by ↓`: archivos que importan al modificado) y tests relacionados (✓/✗).

## Desarrollo

```bash
npm test       # suite de tests (node:test)
npm run build  # compilación a dist/
npm run dev    # ejecutar en desarrollo
```

Los fixtures en `test/fixtures/` validan el análisis contra proyectos artificiales:
`simple-project` (cadena A→B→C), `circular-dependencies` (X↔Y) y `test-coverage` (servicios con y sin tests).

## Estado del MVP

Completado según la propuesta (`ai-docs/impactwave-context.md`):

- ✅ Fase 1 — Git analysis
- ✅ Fase 2 — AST analysis
- ✅ Fase 3 — Dependency Graph
- ✅ Fase 4 — Symbol-level impact
- ✅ Fase 5 — Test mapping
- ✅ Fase 6 — Risk engine (+ explicabilidad, coverage, fixtures y tests propios)

Futuras fases (fuera del MVP): GitHub Action, capa de IA, extensión VS Code, historial Git.