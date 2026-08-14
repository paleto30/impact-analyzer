# Impact Analyzer

## 1. Propósito del documento

Este documento define la idea, el problema, el alcance inicial, la arquitectura conceptual y la hoja de ruta de desarrollo de **Impact Analyzer**.

El documento está pensado para servir como **contexto técnico para una IA de desarrollo de software**. La IA que reciba este documento debe comprender qué problema se pretende resolver, qué debe construir, qué decisiones deben respetarse y qué funcionalidades deben dejarse para fases posteriores.

---

# 2. Resumen del proyecto

**Impact Analyzer** será una herramienta orientada a desarrolladores que analiza los cambios realizados en un repositorio Git y determina qué partes del sistema podrían verse afectadas por dichos cambios.

La pregunta central que debe responder es:

> **"¿Qué puedo romper con este cambio y qué debería probar?"**

La herramienta no debe limitarse a mostrar los archivos modificados por Git. Debe analizar el código fuente, comprender sus relaciones y construir un modelo de dependencias que permita determinar el posible impacto de una modificación.

Ejemplo conceptual:

```text
PaymentService.calculate()
        │
        ├── CheckoutService
        │       │
        │       └── CheckoutController
        │
        ├── InvoiceService
        │
        └── SubscriptionService
                │
                └── SubscriptionWorker
```

Si el desarrollador modifica:

```text
PaymentService.calculate()
```

Impact Analyzer debería poder identificar que existen múltiples componentes que dependen directa o indirectamente de esa función.

Además, debería relacionar dichos componentes con las pruebas automatizadas existentes y generar una evaluación de riesgo.

---

# 3. Problema que se pretende solucionar

En proyectos de software medianos y grandes, un cambio aparentemente pequeño puede afectar múltiples partes del sistema.

Git permite conocer qué archivos fueron modificados:

```bash
git diff main...feature/payment-refactor
```

y puede mostrar algo similar a:

```text
47 files changed
1,283 additions
421 deletions
```

Sin embargo, Git no responde preguntas importantes para el desarrollador:

- ¿Qué componentes utilizan el código que modifiqué?
- ¿Qué funcionalidades dependen de este cambio?
- ¿Qué endpoints pueden verse afectados?
- ¿Qué servicios pueden romperse?
- ¿Qué workers o procesos asíncronos dependen de esta lógica?
- ¿Qué pruebas cubren las áreas afectadas?
- ¿Qué áreas potencialmente afectadas no tienen pruebas?
- ¿Qué tan riesgoso es este cambio?
- ¿Qué debería probar antes de hacer merge?

El objetivo de Impact Analyzer es convertir un cambio de código en un **mapa de impacto técnico accionable**.

---

# 4. Propuesta de valor

Impact Analyzer no pretende reemplazar Git, un linter, un sistema de testing, un SAST ni una plataforma completa de observabilidad.

Su propósito específico es:

> **Analizar el impacto potencial de un cambio de código antes de integrarlo al código principal.**

El resultado debe ser una respuesta técnica y accionable.

Ejemplo:

```text
CHANGE IMPACT ANALYSIS

Base: main
Current: feature/payment-refactor

Changed:
  PaymentService.calculate()

Potentially affected:
  ├── CheckoutService
  ├── InvoiceService
  ├── SubscriptionService
  └── PaymentWorker

Tests:
  ├── payment.test.ts       ✓
  ├── checkout.test.ts      ✓
  ├── invoice.test.ts       ✗
  └── subscription.test.ts  ✗

Risk: HIGH

Reason:
PaymentService.calculate() is used by 7 symbols.
Two affected services have no related automated tests.
```

---

# 5. Alcance inicial

La primera versión debe ser deliberadamente pequeña.

## Lenguaje objetivo

El MVP debe enfocarse exclusivamente en:

- TypeScript
- JavaScript
- Node.js

No se debe intentar soportar inicialmente:

- Java
- Python
- Go
- Rust
- C#
- PHP
- otros lenguajes

El objetivo es conseguir un análisis profundo y confiable de un ecosistema concreto antes de ampliar el soporte.

---

# 6. Forma inicial del producto

La primera versión será una herramienta CLI.

Ejemplo:

```bash
npx impact-analyzer
```

También puede evolucionar posteriormente hacia:

```bash
impact analyze
```

La CLI debe funcionar sobre un repositorio Git existente.

Ejemplo:

```bash
cd my-project
npx impact-analyzer
```

La herramienta debería detectar automáticamente:

- repositorio Git
- branch actual
- branch base
- cambios existentes
- archivos modificados

---

# 7. Arquitectura conceptual

La arquitectura debe separar claramente el motor de análisis de la interfaz CLI.

Conceptualmente:

```text
                  ┌──────────────────┐
                  │       CLI        │
                  └────────┬─────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Impact Analyzer    │
                │       Engine        │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼───────────────────┐
        │                  │                   │
        ▼                  ▼                   ▼
     Git Layer          Parser              Graph
        │                  │                   │
        └──────────────────┼───────────────────┘
                           ▼
                    Impact Analysis
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
           Test Mapping          Risk Engine
                │                     │
                └──────────┬──────────┘
                           ▼
                       Reporter
```

La arquitectura debe permitir que posteriormente el mismo motor pueda ser utilizado por:

- CLI
- GitHub Action
- extensión de VS Code
- interfaz web
- API
- otras integraciones CI/CD

---

# 8. Estructura propuesta del proyecto

Una estructura inicial razonable:

```text
impact-analyzer/
│
├── src/
│   ├── cli/
│   │
│   ├── git/
│   │
│   ├── parser/
│   │
│   ├── graph/
│   │
│   ├── analyzer/
│   │
│   ├── tests/
│   │
│   ├── risk/
│   │
│   └── reporter/
│
├── test/
│   └── fixtures/
│       ├── simple-project/
│       ├── nest-project/
│       └── complex-project/
│
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── .gitignore
```

Los nombres pueden modificarse si existen mejores alternativas, pero la separación de responsabilidades debe mantenerse.

---

# 9. Componentes principales

## 9.1 Git Layer

Responsabilidad:

- detectar el repositorio
- obtener branch actual
- determinar branch base
- obtener diferencias
- identificar archivos añadidos
- identificar archivos modificados
- identificar archivos eliminados
- eventualmente utilizar historial Git

Ejemplo conceptual:

```text
main
  │
  │ git diff
  ▼
feature/payment-refactor
```

Salida interna:

```typescript
interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}
```

Inicialmente se puede utilizar la CLI de Git mediante procesos del sistema.

No es necesario implementar un parser Git propio.

---

# 10. Parser y AST

No se debe analizar código mediante expresiones regulares como mecanismo principal.

El sistema debe comprender la estructura sintáctica del código.

Para TypeScript/JavaScript se puede utilizar:

- TypeScript Compiler API
- ts-morph

Para el MVP, `ts-morph` puede ser una opción práctica debido a su API de alto nivel.

El parser debe permitir identificar elementos como:

- archivos
- imports
- exports
- clases
- métodos
- funciones
- interfaces
- llamadas a funciones
- instanciaciones
- herencia
- implementaciones
- decorators
- dependencias
- referencias entre símbolos

Ejemplo:

```typescript
@Injectable()
export class CheckoutService {
  constructor(
    private readonly paymentService: PaymentService
  ) {}

  createOrder() {
    return this.paymentService.calculate();
  }
}
```

El analizador debería poder comprender relaciones como:

```text
CheckoutService
    ↓
PaymentService
    ↓
calculate()
```

---

# 11. Dependency Graph

El Dependency Graph será uno de los componentes fundamentales del proyecto.

Debe representar las relaciones entre los elementos del código.

Inicialmente se puede trabajar con:

```text
File → File
```

pero la arquitectura debe permitir evolucionar hacia:

```text
File
  ↓
Class
  ↓
Method
  ↓
Function
```

Ejemplo:

```text
CheckoutController
        │
        ▼
CheckoutService
        │
        ▼
PaymentService
        │
        ▼
PaymentRepository
```

Una posible representación interna:

```typescript
interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  path: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: DependencyType;
}
```

Los tipos concretos pueden evolucionar durante el desarrollo.

---

# 12. Identificación de símbolos modificados

No es suficiente detectar:

```text
PaymentService.ts modified
```

El sistema debe intentar identificar qué símbolos concretos fueron modificados.

Por ejemplo:

```diff
class PaymentService {

- calculate(amount) {
-   return amount * 0.19;
- }

+ calculate(amount) {
+   return amount * 0.21;
+ }
}
```

Debe producir conceptualmente:

```text
Modified symbol:

PaymentService.calculate()
```

Esto permitirá hacer análisis de impacto a nivel de símbolo.

---

# 13. Change Impact Analysis

Una vez identificado un símbolo modificado, el sistema debe recorrer el Dependency Graph para encontrar:

1. dependencias directas
2. dependencias indirectas
3. consumidores
4. posibles puntos de entrada
5. componentes potencialmente afectados

Ejemplo:

```text
PaymentService.calculate()
          │
          ▼
CheckoutService.createOrder()
          │
          ▼
CheckoutController.create()
```

Resultado:

```text
Level 0:
PaymentService.calculate()

Level 1:
CheckoutService.createOrder()

Level 2:
CheckoutController.create()
```

El recorrido puede realizarse mediante BFS, DFS u otro algoritmo apropiado dependiendo de la representación del grafo.

---

# 14. Test Mapping

Una característica importante será relacionar código afectado con pruebas automatizadas.

Ejemplo:

```text
PaymentService.calculate()
        │
        ├── PaymentService.test.ts       ✓
        ├── CheckoutService.test.ts      ✓
        ├── InvoiceService.test.ts       ✗
        └── SubscriptionService.test.ts  ✗
```

El sistema debe detectar, como mínimo:

- archivos de test
- suites
- tests relacionados
- archivos que importan directamente el código afectado
- posibles relaciones entre test y código

El mapeo de tests no necesita ser perfecto en el MVP.

Debe producir una estimación útil y explicable.

---

# 15. Impact Coverage

Una métrica importante será la cobertura de las áreas afectadas, no solamente la cobertura global del proyecto.

Ejemplo:

```text
Affected components: 4
Covered: 2
Uncovered: 2

Impact Coverage: 50%
```

Esto permite detectar situaciones como:

```text
Global test coverage: 82%
```

pero:

```text
Impact coverage: 35%
```

La segunda métrica puede ser mucho más relevante para evaluar un cambio específico.

---

# 16. Risk Engine

El sistema debe producir inicialmente un riesgo determinístico.

No se debe introducir IA para calcular el riesgo en la primera versión.

Una posible fórmula inicial:

```text
Risk Score =
    caller impact
  + affected files
  + dependency depth
  + test gaps
  + change size
  + historical information
```

Ejemplo de factores:

```text
+20  muchos consumidores directos
+15  muchos archivos potencialmente afectados
+20  ausencia de pruebas relacionadas
+15  gran profundidad de dependencias
+10  gran cantidad de líneas modificadas
+10  alta frecuencia histórica de cambios
+10  componente utilizado por múltiples entry points
```

La fórmula exacta debe ser configurable y debe evolucionar mediante experimentación.

Clasificación inicial:

```text
0-25     LOW
26-50    MEDIUM
51-75    HIGH
76-100   CRITICAL
```

No debe presentarse el score como una verdad absoluta.

Debe entenderse como una estimación basada en señales observables.

---

# 17. Explicabilidad

Una regla fundamental del producto:

> **La herramienta debe explicar por qué considera riesgoso un cambio.**

No basta:

```text
Risk: HIGH
```

Debe mostrar:

```text
Risk: HIGH

Reasons:

- PaymentService.calculate() has 7 consumers.
- 3 affected components have no detected tests.
- The modified method is 3 dependency levels away from 2 controllers.
- 14 files may be affected.
```

La explicabilidad será especialmente importante si posteriormente se incorpora IA.

---

# 18. Reporte CLI

El MVP debe producir una salida clara en terminal.

Ejemplo:

```text
╭──────────────────────────────────────────────╮
│          CHANGE IMPACT ANALYSIS              │
╰──────────────────────────────────────────────╯

Base: main
Current: feature/payment-refactor

Changed files:
  M src/payment/PaymentService.ts
  M src/payment/PaymentController.ts

Changed symbols:
  PaymentService.calculate()

Potentially affected:
  ├── CheckoutService
  ├── InvoiceService
  ├── SubscriptionService
  └── PaymentWorker

Tests:
  ✓ PaymentService.test.ts
  ✓ CheckoutService.test.ts
  ✗ InvoiceService.test.ts
  ✗ SubscriptionService.test.ts

Impact Coverage:
  50%

Risk:
  HIGH

Reasons:
  - 7 consumers detected
  - 2 affected areas without tests
  - multiple production entry points
```

La salida debe priorizar legibilidad.

---

# 19. Fixture Projects

El proyecto debe tener proyectos de prueba artificiales.

Ejemplo:

```text
test/fixtures/simple-project/
```

Puede contener:

```text
A.ts
B.ts
C.ts
```

con:

```text
A → B
B → C
```

La herramienta debe detectar exactamente esas relaciones.

Después se deben crear fixtures progresivamente más complejos:

```text
simple-project
nested-dependencies
multiple-callers
circular-dependencies
test-coverage
nestjs-project
dynamic-imports
barrel-exports
```

Los fixtures son fundamentales para comprobar que el análisis no depende de proyectos reales específicos.

---

# 20. Desarrollo incremental

El proyecto debe construirse por fases.

## Fase 1 — Git analysis

Objetivo:

```bash
npx impact-analyzer
```

Debe detectar:

- repositorio
- branch
- base
- archivos modificados

Salida:

```text
Changed files:

 M src/payment/PaymentService.ts
 M src/payment/PaymentController.ts
 A src/payment/PaymentValidator.ts
```

---

## Fase 2 — AST analysis

Detectar:

- clases
- funciones
- métodos
- imports
- exports
- llamadas
- referencias

---

## Fase 3 — Dependency Graph

Construir:

```text
nodes
+
edges
```

y permitir consultas como:

```text
Who depends on PaymentService?
```

---

## Fase 4 — Symbol-level impact

Detectar:

```text
PaymentService.calculate()
```

y encontrar consumidores.

---

## Fase 5 — Test mapping

Relacionar:

```text
affected symbol
       ↓
related tests
```

---

## Fase 6 — Risk Engine

Agregar:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

y explicación del riesgo.

---

## Fase 7 — GitHub Action

Permitir ejecutar el análisis automáticamente en Pull Requests.

Ejemplo:

```yaml
- run: npx impact-analyzer
```

Posteriormente se puede publicar un comentario en el PR.

---

## Fase 8 — IA

Solo después de tener datos estructurados confiables.

La IA podría responder:

```text
Why is this PR high risk?
```

o:

```text
What should I test?
```

o:

```text
Explain the affected architecture.
```

La IA no debe sustituir al motor de análisis.

Debe actuar como una capa de razonamiento y explicación sobre los resultados obtenidos mediante análisis estático.

---

## Fase 9 — VS Code Extension

Posteriormente:

```text
VS Code
    ↓
Impact Analyzer Engine
    ↓
Visual impact graph
```

Podría permitir seleccionar una función y visualizar:

```text
Who uses this?
What can this affect?
Which tests cover it?
```

---

# 21. Futuras capacidades

Una vez validado el núcleo se podrían incorporar:

## Git history

Analizar:

- frecuencia de cambios
- archivos con muchos bugs
- commits anteriores
- hotspots
- autores
- churn

Ejemplo:

```text
PaymentService.ts

Changed 48 times in the last 3 months.
Affected by 6 previous production fixes.
```

Esto puede aumentar la precisión del riesgo.

---

## GitHub / GitLab

Integración con:

- Pull Requests
- Merge Requests
- comentarios
- checks
- CI/CD

---

## Visualización

Generar gráficos como:

```text
Changed Code
     │
     ├──── Service A
     │       └── Controller A
     │
     ├──── Service B
     │       └── Worker B
     │
     └──── Service C
```

---

## IA

La IA podría proporcionar:

- explicación del impacto
- resumen del PR
- recomendaciones de testing
- explicación arquitectónica
- detección de riesgos semánticos
- preguntas que deberían revisarse manualmente

---

# 22. Qué NO debe hacer el MVP

El MVP no debe:

- generar automáticamente código
- modificar archivos
- ejecutar cambios destructivos
- eliminar código
- corregir código automáticamente
- depender de un LLM
- requerir una base de datos
- requerir login
- requerir una aplicación web
- soportar múltiples lenguajes
- intentar reemplazar SonarQube
- intentar reemplazar Sentry
- intentar reemplazar GitHub
- intentar reemplazar herramientas de testing

La primera versión debe concentrarse exclusivamente en:

> **Analizar cambios y determinar su posible impacto.**

---

# 23. Principios técnicos

## Determinismo

La misma entrada debe producir resultados consistentes.

## Explicabilidad

Cada conclusión debe poder relacionarse con evidencia encontrada en el código.

## Modularidad

Git, parsing, graph, analysis, tests, risk y reporting deben ser componentes independientes.

## Extensibilidad

El diseño debe permitir agregar otros lenguajes y otras interfaces posteriormente.

## Offline-first

El análisis fundamental debe funcionar localmente sin necesidad de enviar código fuente a un servicio externo.

## Privacy by design

El código del usuario no debe enviarse a terceros para realizar el análisis estático básico.

## Performance

El sistema debe poder analizar proyectos pequeños y medianos rápidamente.

---

# 24. Arquitectura futura

La visión a largo plazo puede ser:

```text
                    ┌──────────────────┐
                    │    VS Code       │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │       CLI        │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Impact Analyzer  │
                    │      Engine      │
                    └────────┬─────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
     Git                Static Analysis         Tests
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
                       Impact Graph
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
             Risk Engine            AI Layer
                 │                       │
                 └───────────┬───────────┘
                             ▼
                          Reports
```

---

# 25. Ejemplo completo de funcionamiento

Supongamos que el proyecto contiene:

```text
PaymentController
        ↓
PaymentService
        ↓
PaymentRepository
```

y además:

```text
InvoiceService
        ↓
PaymentService
```

Se modifica:

```text
PaymentService.calculate()
```

Impact Analyzer obtiene:

```text
Changed symbol:

PaymentService.calculate()
```

Analiza el grafo:

```text
PaymentService.calculate()
       │
       ├── CheckoutService
       │      └── CheckoutController
       │
       └── InvoiceService
              └── InvoiceController
```

Encuentra tests:

```text
PaymentService.test.ts       ✓
CheckoutService.test.ts      ✓
InvoiceService.test.ts       ✗
```

Calcula:

```text
Impact Coverage: 66%
```

Y finalmente:

```text
Risk: HIGH

Reasons:

- 2 production flows depend on the modified method.
- InvoiceService has no detected automated test.
- The modified symbol has 2 direct consumers.
- The impact reaches 2 HTTP controllers.
```

Esto es exactamente el tipo de información que el producto debe proporcionar.

---

# 26. Criterio de éxito del MVP

El MVP no se considera exitoso porque tenga muchas funcionalidades.

Se considera exitoso si un desarrollador puede ejecutar:

```bash
npx impact-analyzer
```

y obtener información que normalmente tendría que descubrir manualmente leyendo el proyecto.

La pregunta para validar cada funcionalidad será:

> **"¿Esto ahorra al desarrollador tiempo para entender el impacto de su cambio?"**

Si la respuesta es no, probablemente no pertenece al núcleo del producto.

---

# 27. Primer objetivo de implementación

El primer milestone técnico es:

```text
M1 — Git Change Detection
```

Requisitos:

1. Detectar si el directorio es un repositorio Git.
2. Detectar la branch actual.
3. Determinar una branch base.
4. Ejecutar el diff.
5. Detectar archivos añadidos.
6. Detectar archivos modificados.
7. Detectar archivos eliminados.
8. Exponer esa información a un servicio interno.
9. Mostrar un reporte básico en CLI.
10. Crear tests para esta funcionalidad.

Ejemplo:

```text
$ impact analyze

Base branch: main
Current branch: feature/payment-refactor

Changed files:

  M src/payment/PaymentService.ts
  M src/payment/PaymentController.ts
  A src/payment/PaymentValidator.ts
  D src/payment/OldPaymentService.ts
```

No se debe implementar todavía el análisis AST ni el Dependency Graph hasta que esta primera fase sea estable.

---

# 28. Segundo objetivo de implementación

Después de completar M1:

```text
M2 — TypeScript AST Analysis
```

Debe poder responder:

```text
What classes exist?
What methods exist?
What functions exist?
What imports exist?
What exports exist?
What symbols changed?
```

Ejemplo:

```text
PaymentService.ts

Class:
  PaymentService

Methods:
  calculate()
  validate()
  process()

Modified:
  calculate()
```

---

# 29. Tercer objetivo

```text
M3 — Dependency Graph
```

Debe permitir construir y consultar:

```text
A → B
B → C
C → D
```

y realizar preguntas:

```text
Who depends on B?
```

Resultado:

```text
A
```

o:

```text
What does A affect?
```

Resultado:

```text
B
C
D
```

---

# 30. Filosofía del proyecto

Impact Analyzer debe construirse bajo una filosofía sencilla:

> **Primero evidencia, después interpretación.**

El motor debe descubrir relaciones reales a partir de:

- código
- AST
- imports
- llamadas
- Git
- tests
- historial

Y solo posteriormente utilizar heurísticas o IA para interpretar esos datos.

No se debe construir una herramienta que simplemente "adivine" qué puede romperse.

Debe construir un modelo técnico del proyecto y utilizarlo para producir una estimación explicable.

---

# 31. Visión final

La visión a largo plazo de Impact Analyzer es convertirse en una especie de:

> **"Sistema de navegación de impacto para código."**

Un desarrollador debería poder preguntar:

```text
What did I change?
```

```text
What does this affect?
```

```text
Who depends on this?
```

```text
What should I test?
```

```text
Why is this change risky?
```

```text
What production flows could be affected?
```

y obtener respuestas basadas en el código real del proyecto.

La herramienta debería reducir una tarea actualmente muy manual:

```text
Leer código
     ↓
Seguir imports
     ↓
Buscar referencias
     ↓
Seguir llamadas
     ↓
Buscar tests
     ↓
Revisar Git
     ↓
Intentar imaginar qué puede romperse
```

a:

```text
npx impact-analyzer
        ↓
Impact report
        ↓
Developer understands the risk
```

Ese es el núcleo del producto.

---

# 32. Regla principal para cualquier IA que continúe el desarrollo

Si una IA recibe este documento como contexto, debe mantener estas prioridades:

1. No ampliar innecesariamente el alcance.
2. No introducir IA/LLM antes de que el análisis estático sea funcional.
3. Priorizar TypeScript/JavaScript.
4. Mantener el motor desacoplado de la CLI.
5. Crear pruebas automatizadas desde las primeras funcionalidades.
6. Utilizar proyectos fixture para validar el Dependency Graph.
7. Evitar análisis basados principalmente en regex.
8. Mantener los resultados explicables.
9. No construir frontend antes de validar el CLI.
10. Implementar una funcionalidad completa y comprobable antes de avanzar a la siguiente fase.

El objetivo no es construir una plataforma enorme desde el comienzo.

El objetivo es construir primero un **motor confiable de análisis de impacto de cambios de código**, demostrar que resuelve un problema real y posteriormente convertirlo en una herramienta profesional para el ecosistema de desarrollo.
