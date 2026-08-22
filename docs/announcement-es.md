# ImpactWave — Anuncio (ES)

> Material de difusión: artículo completo para blog/foros y versión corta para LinkedIn u otras redes. Siéntete libre de adaptarlo.

---

## Artículo

# ¿Qué puedes romper con tu próximo merge?

Esa pregunta me persiguió durante años. No porque sea mal desarrollador, sino porque en cualquier proyecto real la respuesta honesta siempre era: **ni idea**.

## Qué es ImpactWave

[ImpactWave](https://npm.im/impactwave) es una CLI open source que analiza tus cambios en Git antes de hacer merge y te dice, con datos y no con intuición, qué puedes romper y qué deberías probar. Se usa así de simple:

```bash
cd mi-proyecto
npx impactwave
```

En unos segundos genera un reporte que combina cuatro miradas sobre tu cambio:

- **Símbolos modificados**: no mira texto plano, mira el AST. Detecta qué funciones, clases, métodos públicos e interfaces exportaste y cuáles tocó físicamente tu diff.
- **Consumidores reales**: encuentra cada uso activo de esos símbolos, con archivo, línea y fragmento de código. Un `import` que nadie ejecuta no cuenta como impacto.
- **Blast radius**: traza el grafo de dependencias y muestra todos los archivos alcanzados, directa y transitivamente, nivel por nivel.
- **Cobertura de impacto**: cruza las áreas afectadas con tus tests (`*.test.ts`, `*.spec.ts`) y te lista exactamente qué quedó sin cubrir.

Todo eso termina en un **score de riesgo de 0 a 100**, determinístico —el mismo cambio produce siempre el mismo número— y explicable: cada punto viene acompañado de su razón. "4 consumidores de símbolos modificados (12 pts)". Nada de cajas negras ni IA adivinando.

## Por qué nace

La idea nace de una frustración concreta: los cambios pequeños son los más traicioneros. Cambias una tasa de interés en un servicio de pagos y, sin tocar ninguna otra línea, rompes tres módulos que consumen ese método. El code review se apoya en intuición, la suite completa de tests tarda minutos y no te dice *por dónde empezar*, y el impacto real suele descubrirse... en producción.

Pensé: si puedo saber qué símbolos toqué y quién los consume, ya no necesito fe, necesito una lista. De ahí salió ImpactWave: convertir esa lista en un reporte accionable antes del merge, no después del incidente.

## Qué problemas resuelve hoy

- Saber **a quién afecta** tu cambio antes de pushear, no cuando falla.
- Saber **qué tests ejecutar primero** en lugar de correr todo a ciegas.
- Detectar **zonas afectadas sin ningún test** — la lista exacta de archivos que deberías cubrir antes de fusionar.
- Ponerle un número discutible y objetivo al riesgo de un PR, útil incluso como referencia en code review.

## Mi uso actual (con honestidad)

ImpactWave hoy es una herramienta que uso para verificar mis propios commits en proyectos de TypeScript y JavaScript, concretamente en **backends**. Y ese matiz importa: no reemplaza tests, ni CI, ni revisión humana. La suma de todo eso es irreemplazable. Lo que hace es darme tranquilidad extra: cuando el reporte dice LOW y veo los consumidores cubiertos por sus tests, el merge deja de sentirse como un salto al vacío y se siente como lo que debería ser siempre — una decisión informada.

Sobre React y proyectos de frontend: **no lo he probado ahí todavía**. La herramienta analiza TypeScript/JavaScript genérico, pero no quiero prometer nada que no haya verificado yo mismo. Si la pruebas en un proyecto de frontend, me encantará conocer tu experiencia.

## Pruébalo

No necesita instalación global ni configuración:

```bash
npx impactwave
```

Si te sirve, una estrella en [GitHub](https://github.com/paleto30/impactwave) ayuda a que más devs lo encuentre. Y si rompe algo o quieres proponer mejoras, los issues están abiertos.

Porque al final se trata de esto: **menos fe, más datos, en el momento exacto en que decides mezclar tu código con el de todos.**

---

## Versión corta (LinkedIn / foros)

```
¿Qué puedes romper con tu próximo merge?

Durante años la respuesta honesta era: ni idea. Cambias una línea en un
servicio y rompes tres módulos que consumen ese método. El review se apoya
en intuición y el impacto real se descubre en producción.

Cansado de eso construí ImpactWave: una CLI open source que analiza tus
cambios en Git antes del merge y te dice qué puedes romper y qué deberías
probar.

Cómo funciona:
→ Detecta vía AST qué símbolos exportados tocó físicamente tu diff
→ Encuentra los consumidores reales de esos símbolos (archivo, línea y snippet)
→ Traza el blast radius por el grafo de dependencias
→ Cruza las áreas afectadas con tus tests y te lista lo que quedó sin cubrir

Todo termina en un score de riesgo 0-100, determinístico y explicable:
cada punto viene con su razón. Sin cajas negras ni IA adivinando.

Uso: cd tu-proyecto && npx impactwave. Sin instalación, sin configuración.

Siendo transparente: hoy lo uso para verificar mis commits en backends
de TypeScript y JavaScript. No reemplaza tests, CI ni review — solo hace
que un merge deje de sentirse como un salto al vacío. ¿React/frontend?
Aún no lo pruebo ahí; si lo haces tú, quiero leer tu experiencia.

GitHub: https://github.com/paleto30/impactwave
npm: https://npm.im/impactwave

Feedback e issues bienvenidos.
```
