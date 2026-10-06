# Integración del editor de cuestionarios

El cuestionario sigue siendo la estructura de un proyecto: temas, preguntas y seguimientos. Escribir, Organizar y Revisar son vistas del mismo contenido. Las operaciones individuales y la experiencia del participante se conservan.

## Selección y operaciones por lote

**IMPLEMENTADO:** Organizar mantiene el ID de la pregunta activa separado de los IDs seleccionados. Hay selección individual, de grupo por `groupParentId`, tema completo, página de hasta 40 preguntas y todos los resultados filtrados. La selección no necesita nodos DOM fuera de la página.

Búsqueda, tema, estado de publicación y área responsable delimitan resultados. Cambiar de página conserva selección; cambiar filtros la limpia con aviso. Grupo y tema pueden incluir elementos fuera del filtro y lo anuncian explícitamente. Las archivadas permanecen consultables y no se incorporan mediante los controles de selección.

`BulkDialog` reutiliza el diálogo nativo y los controles existentes. La configuración precede a la revisión del servidor y a la confirmación. Un cambio concurrente exige actualizar/revisar; un fallo de transporte conserva el mismo requestId para reintentar la confirmación idempotente. Las respuestas exitosas reales producen feedback y recarga de datos, sin éxito optimista.

El área no asigna personas. Añadir participantes conserva las asignaciones activas existentes y su obligatoriedad. Publicar no agrega automáticamente dependencias y conserva las revisiones inmutables. [Semántica y límites](BULK-QUESTIONNAIRE-OPERATIONS.md).

## Componentes

- `Organize`: filtros, paginación, selección, barra contextual e inspector existente.
- `bulk-selection`: recorrido de descendientes estructurales; nunca usa condiciones para ampliar selección.
- `BulkDialog`: configuración, preview, corrección, inclusión explícita de dependencias y confirmación.
- `Editor`: feedback e invalidación de caché después de la operación.
- `editor.css`: controles de selección, resumen y reflow, acotados al editor.

**VERIFICADO localmente:** tests de selección a 10/50/120/304 preguntas, independencia del inspector, alcance de filtros/páginas, cancelación, conflictos y reintentos. Playwright incluye el recorrido de 304 preguntas y cuatro anchos. Los conteos finales y el estado del gate se mantienen en [Operaciones masivas](BULK-QUESTIONNAIRE-OPERATIONS.md#verificación).

**PENDIENTE / fuera de alcance:** archivado, borrado, reemplazo de participantes, condiciones, prioridad y trazabilidad masivos. No hay nuevos estados de aprobación ni una entidad Questionnaire. Este cambio no crea una release ni modifica la versión de paquetes.
