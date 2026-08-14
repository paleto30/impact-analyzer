Quiero mejorar la organización y estructura del proyecto siguiendo un principio de **separación clara de responsabilidades a nivel de archivos**.

No quiero que un mismo archivo contenga diferentes tipos de elementos solo porque técnicamente sea posible.

Por ejemplo, si un archivo contiene:

* interfaces
* clases
* funciones
* tipos
* constantes
* utilidades

quiero evaluar si estos elementos deben estar separados en archivos independientes.

### Regla principal

Cada archivo debe tener una responsabilidad clara y fácilmente identificable por su nombre.

Prefiero tener algunos archivos adicionales si eso hace que la estructura sea más clara, mantenible y fácil de navegar.

Por ejemplo, en lugar de:

```text
user.ts
├── User interface
├── User class
├── UserMapper
├── createUser()
└── USER_STATUS
```

prefiero una estructura como:

```text
user/
├── user.interface.ts
├── user.ts
├── user.mapper.ts
├── user.factory.ts
└── user.constants.ts
```

No quiero aplicar esta separación de manera ciega. Si dos elementos pertenecen claramente a la misma responsabilidad y mantenerlos juntos mejora la legibilidad, puedes mantenerlos juntos.

Pero como regla general:

> **No mezclar diferentes responsabilidades o abstracciones en un mismo archivo únicamente para reducir el número de archivos.**

### Nombres

Los nombres de los archivos deben dejar claro qué contiene cada uno.

Por ejemplo:

```text
user.interface.ts
user.service.ts
user.repository.ts
user.mapper.ts
user.factory.ts
user.constants.ts
```

debe ser preferido sobre archivos genéricos como:

```text
utils.ts
helpers.ts
common.ts
types.ts
misc.ts
```

cuando sea posible utilizar un nombre más específico.

### Objetivo

Quiero que alguien pueda recorrer el proyecto y entender rápidamente dónde está cada cosa sin tener que abrir archivos grandes para descubrir qué contienen.

Prioriza:

1. Separación clara de responsabilidades.
2. Archivos pequeños y enfocados.
3. Nombres descriptivos.
4. Facilidad de navegación.
5. Mantenibilidad.
6. Cohesión alta dentro de cada archivo.

Antes de hacer cambios, analiza la estructura actual del proyecto y determina qué archivos necesitan ser divididos. No hagas cambios innecesarios si la separación no aporta claridad.

Aplica este criterio de forma consistente en todo el proyecto, no únicamente en el código que se modifique durante esta tarea.
