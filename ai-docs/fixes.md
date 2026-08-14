# Impact Analyzer — Issues to Fix

Contexto: CLI de análisis de impacto de cambios de Git (TypeScript + ts-morph).
Motor: detección de cambios Git → análisis AST → grafo de dependencias → risk
scoring → test coverage mapping → reporte en consola.

Se detectaron los siguientes problemas al correr el analizador contra su
propio repositorio (dogfooding). Ordenados por prioridad.

## Estado

| # | Issue | Estado |
|---|---|---|
| 1 | Formato de blast radius | ✅ Resuelto (`35e1416`, verificado por `cli-integration.test.ts`) |
| 2 | `test-mapping` sin tests | ✅ Resuelto (`test-mapping.test.ts` existía; suite ampliada en `35cce00`) |
| 3 | Coverage con interfaces puras | ✅ Resuelto (`35e1416`) |
| 4 | Calibración de pesos | ✅ Resuelto — pesos actuales correctos, ver `RISK_CALIBRATION.md` |
| 5 | Related Tests sobre test files | ✅ Implementado (sin commit aún) |

---

## 1. [BUG] Inconsistencia en el formato de "Files in blast radius"

**Prioridad: Alta — es un bug de lógica, no de estilo.**

### Síntoma

En el mismo reporte, distintos ítems muestran el bloque "Files in blast
radius" con dos formatos distintos:

```
├─ Files in blast radius (1)
│    └─ src/cli.ts
```

```
├─ Files in blast radius (3 direct, 6 total, depth 2)
│    ├─ src/engine/assessment.ts
│    ├─ src/engine/impact-report-item.interface.ts
│    └─ src/engine/graph/dependency.ts
```

Algunos ítems muestran conteo simple `(N)` con una lista plana de
dependientes directos. Otros muestran `(N direct, M total, depth K)`, lo que
implica un cálculo transitivo real.

### Hipótesis

Probablemente hay dos caminos de código para calcular dependientes:
- Uno viejo/simple (dependientes directos únicamente, quizás en
  `dependency.ts` / `buildDependencyGraph` + lookup plano).
- Uno nuevo (`findTransitiveDependents`, con cálculo de profundidad).

Es posible que `assessment.ts` (o donde se arma `ImpactReportItem`) solo
llame a `findTransitiveDependents` bajo ciertas condiciones, y en otros
casos caiga a un fallback más simple que no debería seguir existiendo.

### Qué se pide

1. Ubicar en `assessment.ts` (o el archivo que construya
   `ImpactReportItem.transitiveImpact` / el campo equivalente de "dependents")
   los dos caminos de cálculo.
2. Unificar en un solo camino: **todos** los ítems del reporte deben usar
   `findTransitiveDependents` (o el nombre actual de esa función) y exponer
   siempre `{ direct: string[], total: string[], depth: number }` (o el shape
   que ya use `TransitiveImpact`).
3. Actualizar `reporter.ts` (`printBlastRadius` o función equivalente) para
   que imprima **siempre** el mismo formato `(N direct, M total, depth K)`,
   eliminando la rama que imprime solo `(N)`.
4. Si existe algún caso legítimo donde depth siempre sea 1 (ej. archivo sin
   dependientes transitivos, solo directos), debe seguir usando el mismo
   formato con `depth 1`, no un formato distinto.

### Validación

Correr el analizador contra un commit real y confirmar que **todos** los
ítems con `dependents.length > 0` muestran el mismo formato
`(N direct, M total, depth K)` sin excepción.

---

## 2. [TEST GAP] `test-mapping.ts` no tiene tests propios

**Prioridad: Alta — irónico y fácil de arreglar.**

### Síntoma

El propio reporte señala que `src/engine/testing/test-mapping.ts` (el
módulo que calcula qué tests cubren qué archivos) no está cubierto por
ningún test:

```
📄 [MODIFIED] src/engine/testing/test-mapping.ts
...
└─ Related Tests
     └─ ✗ No test covers this file
```

### Qué se pide

Crear `test/test-mapping.test.ts` cubriendo al menos:
- `isTestFile(path)`: casos positivos (`*.test.ts`, `*.spec.ts`, carpeta
  `test/`) y negativos (archivos de código normal).
- `buildTestMapping(projectRoot)`: que construya correctamente el mapping
  para un proyecto de prueba pequeño (fixture con 2-3 archivos, alguno con
  test asociado y alguno sin él).
- `getRelatedTests(mapping, filePath)`: que devuelva los tests correctos
  para un archivo dado, y un array vacío para un archivo sin tests.

Usar el mismo framework/runner que ya usan `dependency.test.ts` y
`test-mapping.test.ts`... (si `test-mapping.test.ts` no existe aún pese a
aparecer en el reporte, revisar si el archivo fue borrado o movido — el
reporte lo listó como test relacionado de otro archivo, así que debería
existir en algún punto del historial).

---

## 3. [DESIGN] Impact Coverage mezcla interfaces puras con lógica real

**Prioridad: Media — afecta la calidad de la métrica, no un bug funcional.**

### Síntoma

El cálculo de "Impact Coverage" (`computeImpactCoverage` en
`impact-coverage.ts`) cuenta como "sin cobertura" archivos que solo
contienen `interface`/`type` declarations (ej.
`changed-file.interface.ts`, `risk.types.ts`, `assessment-result.interface.ts`).
Estos archivos nunca tendrán (ni necesitan) un test directo razonable — son
solo contratos de tipos, sin lógica ejecutable.

Esto diluye la métrica: un "20% coverage" que incluye 6+ archivos de puros
tipos es engañoso comparado con un 20% que reflejara solo archivos con
lógica de negocio real sin testear.

### Qué se pide

1. En `impact-coverage.ts` (`computeImpactCoverage`), excluir del
   denominador (archivos "afectados" que cuentan para la métrica) aquellos
   archivos cuyo `FileAnalysis` no contenga ninguna función ni método de
   clase exportado — es decir, archivos que solo exportan
   `interface`/`type`/`enum` sin comportamiento.
   - Puede aprovecharse `FileAnalysis.exports` (ya existe en `parser.ts`):
     si `functions.length === 0 && classes.length === 0`, el archivo se
     considera "no testeable" y se excluye del cálculo de coverage (aunque
     puede seguir apareciendo en el reporte general, solo no cuenta para el
     % de Impact Coverage).
2. Ajustar el reporte (`printImpactCoverage` en `reporter.ts`) para que la
   lista de "Uncovered" no incluya estos archivos de puros tipos, o los
   marque aparte con una nota (ej. "N/A — types only") en vez de `✗`.

### Validación

Correr contra el mismo commit de prueba (28 archivos, varios `.interface.ts`)
y confirmar que el % de Impact Coverage sube (porque el denominador baja) y
que la lista de "Uncovered" ya no incluye archivos puramente de tipos.

---

## 4. [CALIBRATION] Umbrales de risk scoring no calibrados para commits reales

**Prioridad: Media — no es un bug, pero afecta la utilidad práctica.**

### Síntoma

El commit de prueba usado (agregar de una vez todo el motor de risk +
testing + assessment: 28 archivos, 645 líneas) dio un score de 92/100
("CRITICAL"). Ese commit no es representativo de un commit de trabajo
normal — es equivalente a un scaffolding masivo.

### Riesgo si no se corrige

Si los pesos actuales en `risk.constants.ts`
(`DEFAULT_RISK_WEIGHTS`) están calibrados/probados solo contra este tipo de
commit extremo, es probable que la herramienta marque como "CRITICAL" o
"HIGH" commits normales de tamaño moderado (3-5 archivos, un par de
funciones tocadas) — generando fatiga de alertas y que el equipo empiece a
ignorar el risk assessment.

### Qué se pide

1. Correr el analizador contra 5-10 commits **reales y típicos** del
   historial del propio proyecto (no el mega-commit de scaffolding) —
   idealmente commits de una sola función modificada, un bugfix pequeño,
   una feature de 2-3 archivos.
2. Registrar el score resultante de cada uno.
3. Ajustar los pesos en `risk.constants.ts` (`DEFAULT_RISK_WEIGHTS`) de
   forma que:
   - Un cambio aislado de 1 archivo sin dependientes → score bajo (LOW).
   - Un cambio con 2-4 dependientes directos y sin tests → MODERATE.
   - Solo cambios con amplio blast radius transitivo (>10 archivos) y/o
     símbolos core sin tests → HIGH/CRITICAL.
4. Documentar en un comentario en `risk.constants.ts` (o en un
   `RISK_CALIBRATION.md`) qué tipo de commit corresponde a cada rango de
   score, para que futuros ajustes de pesos tengan un punto de referencia.

### Validación

Los commits típicos usados para calibrar deben caer en LOW/MODERATE, y solo
cambios genuinamente grandes/riesgosos deben alcanzar HIGH/CRITICAL.

---

## 5. [REPORTING] "Related Tests" ruidoso para archivos de test

**Prioridad: Baja-Media — señal/ruido del reporte; no afecta métricas.**

### Síntoma

Un archivo de test cambiado muestra en su propia sección:

```
└─ Related Tests
     └─ ✗ No test covers this file
```

Engañoso: el archivo *es* un test; la línea sugiere falta de cobertura donde
no aplica. El score de riesgo ya excluye archivos de test (igual que el #3
excluye interfaces puras), así que el problema es puramente de presentación.

### Qué se pide

1. En `reporter.ts` (`printRelatedTests`), cuando el archivo cambiado sea un
   test (`isTestFile`) y no tenga tests relacionados, reemplazar el `✗` con
   una nota neutra (ej. `ℹ️ Test file — not counted as a covered area`).
2. Conservar las relaciones reales: si otro test importa el archivo cambiado
   (ej. helpers de test como `test/helpers/git-repo.ts`), deben seguir
   listándose con `✓`. No ocultar la sección completa.
3. Dejar los archivos de producción sin exports (ej. `src/cli.ts`, entry
   points) con el `✗` actual — posible mejora futura, no parte de este fix.

### Validación

Correr contra un commit que toque archivos de test: los `.test.ts` muestran
la nota neutra y ningún `✗`; los archivos de producción sin tests siguen con
`✗`; los helpers importados por tests siguen listando sus tests con `✓`.

---

## Orden sugerido de implementación

1. Issue #1 (bug de inconsistencia) — es lo único que es un bug real de
   lógica, corregirlo primero.
2. Issue #2 (test faltante) — rápido, y valida indirectamente que el fix
   del #1 no rompió nada relacionado.
3. Issue #3 (diseño de coverage) — cambio acotado a un archivo.
4. Issue #4 (calibración) — requiere trabajo exploratorio (correr contra
   varios commits), dejar para el final.
5. Issue #5 (reporting de test files) — cosmético, hacer cuando se quiera
   limpiar el ruido del reporte.