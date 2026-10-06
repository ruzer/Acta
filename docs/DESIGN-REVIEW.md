# Revisión de diseño — operaciones de cuestionario por lote

## Problema y alcance

**DISEÑADO e IMPLEMENTADO:** cientos de preguntas requieren operaciones repetitivas para área, participantes y publicación. La solución añade selección y revisión de lotes a Organizar, conservando composición, tipografía, tokens, menús individuales e inspector. No reemplaza las otras vistas del editor ni modifica pantallas del participante o revisión de respuestas.

## Decisiones verificables

- Casillas nativas independientes del botón que abre el inspector; seleccionar no abre un detalle.
- Etiquetas y conteos distintos para página, resultados, tema y grupo. El grupo indica cuántas preguntas se añadirán, incluso fuera de página/filtro. Agrupar no crea condiciones.
- Selección en IDs: como máximo 40 casillas de preguntas renderizadas en una página, aun con 304 seleccionadas.
- Barra contextual con tres operaciones y limpiar. No se añaden acciones masivas a cada fila.
- Origen de área explícito o toda la selección; resumen de áreas actuales. Ningún nombre de área tiene significado especial en el core.
- Agregar participantes conserva asignaciones existentes; obligatoriedad de nuevas/reactivadas elegida explícitamente.
- Preview muestra aplicables, omitidas, bloqueadas y advertencias. Las advertencias se resumen por causa; el detalle por pregunta se abre bajo demanda. Un error abre el detalle y ofrece corrección.
- Una dependencia externa se incorpora solo por acción explícita y obliga a revisar nuevamente. No hay publicación silenciosa ni confirmación parcial.

## Accesibilidad y responsive

**VERIFICADO localmente:** recorrido con teclado, foco en revisión, retorno al disparador al cancelar, Escape en diálogo, foco visible y controles con nombre accesible. Checks axe WCAG 2/2.1/2.2 AA y reflow en 1440, 1024, 768 y 390 px. En móvil, acciones apiladas y texto ajustable; no tabla horizontal. Se respeta la regla existente de reduced motion, sin animación continua nueva.

La inspección visual utiliza capturas de datos ficticios generadas por `tests/e2e/bulk.spec.ts`. Son artefactos locales de validación, no assets distribuidos. Las pruebas automáticas no sustituyen una evaluación completa con todas las tecnologías de asistencia.

## Seguridad y límites de diseño

La interfaz comunica el alcance; el servidor decide autorización, aplicabilidad, concurrencia y atomicidad. Las versiones esperadas y el hash del preview detectan cambios antes de confirmar. La selección por nombres o filtros no se reinterpreta en servidor: viajan IDs explícitos.

No se promete deshacer publicación, SLA ni operaciones ilimitadas. Los límites de preguntas/participantes se documentan en [Operaciones masivas](BULK-QUESTIONNAIRE-OPERATIONS.md). El gate completo, mediciones y estado remoto se registran allí para evitar conteos contradictorios.
