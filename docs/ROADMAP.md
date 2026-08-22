# Roadmap — Mejoras futuras

Mejoras identificadas durante el desarrollo del MVP, ordenadas por valor.
Ninguna está implementada todavía; son candidatas para la siguiente iteración.

## 1. Salida JSON y exit codes (`analyze --json`)

**Estado: diseño discutido, sin implementar.**

El reporte es hoy 100% consola (human-readable) y el exit code es siempre 0
salvo errores de uso. Para consumo por herramientas/CI hace falta:

- `impactwave --json`: emitir el reporte (contexto git, risk
  score con razones, impact coverage, ítems por archivo con consumers y
  blast radius) como JSON a stdout.
- Exit code condicional (`--fail-on HIGH|CRITICAL`): el proceso termina con
  código distinto de 0 cuando el score supera el umbral.

**Por qué es el primero:** abre el caso de uso DevOps/CI (gate de merges),
que es el mayor valor pendiente de la herramienta.

## 2. Comando `check` (gate de CI)

**Estado: propuesto.**

Envoltorio no interactivo del análisis pensado para CI: misma lógica que
`analyze`, pero sin reporte completo — solo el nivel/score y el exit code
según umbral (`--fail-on`). Complementa al punto 1: donde `--json` es para
máquinas que leen, `check` es para pipelines que deciden.

## 3. Comando `init` + archivo de configuración

**Estado: propuesto.**

Generar un `.impactwaverc` con la configuración del proyecto:

- pesos de `--risk-weights` (hoy solo por flag)
- rama base por defecto
- patrones de archivos de test (hoy fijos: `*.test.ts`, `*.spec.ts`)

**Valor:** estandarizar la configuración por equipo (mismo score para
todos) y reducir flags repetitivos. Es requisito previo natural de una
adopción más amplia.

## 4. Comando `doctor` (diagnóstico)

**Estado: propuesto.**

Verificación de entorno para troubleshooting sin leer un reporte completo:

- ¿es un repo git? ¿la rama base resuelve?
- cuántos archivos parseados, cuántos tests detectados
- timing por fase (parseo, análisis de símbolos, grafo)
- errores de parseo silenciados (hoy se cuentan como `skippedFiles`)

**Cuándo:** cuando aparezcan los primeros reportes de CI "raros" que pidan
verificar el setup.

## 5. Otros candidatos menores

- `--head <ref>` en `analyze`: analizar entre dos refs arbitrarios (hoy el
  rango es siempre `<base>..HEAD`).
- Publicación a npm (el `bin` ya apunta a `dist/cli.js`; falta `publish` +
  sección de CI en README).
- Validación de rendimiento en monorepos grandes (`findReferences` de
  ts-morph es la operación más cara; posible caché incremental).
- Posible mejora futura de reporting (fuera de este roadmap): nota neutra
  para archivos de producción sin exports (ej. entry points como
  `src/cli.ts`), análoga al issue #5 de `ai-docs/fixes.md`.