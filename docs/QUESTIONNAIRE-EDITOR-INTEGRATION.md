# Integración del editor de cuestionarios

El cuestionario sigue siendo la estructura de un proyecto: temas, preguntas y seguimientos. Escribir, Organizar y Revisar son vistas del mismo contenido. Las operaciones individuales y la experiencia del participante se conservan.

## Selección y operaciones por lote

**IMPLEMENTADO:** Organizar mantiene el ID de la pregunta activa separado de los IDs seleccionados. Hay selección individual, de grupo por `groupParentId`, tema completo, página de hasta 40 preguntas y todos los resultados filtrados. La selección no necesita nodos DOM fuera de la página.

Búsqueda, tema, estado de publicación y área responsable delimitan resultados. Cambiar de página conserva selección; cambiar filtros la limpia con aviso. Grupo y tema pueden incluir elementos fuera del filtro y lo anuncian explícitamente. Las archivadas permanecen consultables y no se incorporan mediante los controles de selección.

`BulkDialog` reutiliza el diálogo nativo y los controles existentes. La configuración precede a la revisión del servidor y a la confirmación. Un cambio concurrente exige actualizar/revisar; un fallo de transporte conserva el mismo requestId para reintentar la confirmación idempotente. Las respuestas exitosas reales producen feedback y recarga de datos, sin éxito optimista.

El área no asigna personas. Añadir participantes conserva las asignaciones activas existentes y su obligatoriedad. Publicar no agrega automáticamente dependencias y conserva las revisiones inmutables. [Semántica y límites](BULK-QUESTIONNAIRE-OPERATIONS.md).

## Componentes

### Acciones no disponibles en el editor

- Editar tema conserva el foco y muestra el motivo si hay preguntas publicadas o archivadas: el nombre y la descripción están protegidos.
- Con una búsqueda activa, Expandir todos los grupos, Contraer todos los grupos y el control de cada fila explican que todos los grupos ya se muestran desplegados. Limpia la búsqueda para volver a plegarlos. Pulsarlos mientras no están disponibles no cambia el plegado guardado ni la selección.
- Nueva pregunta y + Agregar pregunta explican la falta de un área activa, también si ya hay preguntas. Pide a la administración de la institución que la active en Administración. Antes de crear una pregunta debe existir un tema.
- Una pregunta archivada sigue visible para consulta. No muestra una casilla inutilizable: el texto aclara que no se puede seleccionar.
- En la edición de un borrador, **Tema al que pertenece** aparece arriba del contenido. Elige el destino y guarda el tema junto con tus cambios. **Cambiar de tema** permite hacerlo sin editar el contenido. Ambos caminos mueven el grupo completo (principal y todos sus seguimientos) al final del destino. Si alguna integrante no es borrador, el tema queda como texto y el motivo nombra a esa pregunta.
- No cambies el vínculo de seguimiento y el tema en el mismo guardado: guarda uno antes de hacer el otro. El servidor conserva el orden del grupo y las posiciones reservadas; un reintento con información anterior se rechaza sin repetir el movimiento.

Mover arriba o abajo explica cuándo el tema o la pregunta ya está en un extremo. La paginación avisa si estás en la primera o última página. Publicar muestra los problemas concretos que hay que resolver; revisar un lote pide completar su configuración o actualizar una vista previa que haya cambiado.

En Escribir, los menús de acciones en pantallas pequeñas quedan por encima de la navegación inferior y permiten desplazarse si los motivos no caben; conservan Escape y el retorno del foco.

Estos motivos son visibles y están asociados con sus controles. No cambian los permisos ni las reglas del servidor.

### Controles no disponibles

`Button`, `Input`, `Select`, `Textarea`, `Checkbox` y `Radio` comparten el estado `unavailable`, que exige un `reason` no vacío. El motivo se muestra como texto y se asocia con `aria-describedby`; no sustituye el nombre del control ni desaparece si hay un error de validación. Para varios controles relacionados, `describedBy` puede señalar un motivo visible común, cuya asociación debe comprobarse en las pruebas.

Un botón no disponible conserva el foco con `aria-disabled` y bloquea clic, Enter, Espacio y el envío del formulario. No añade un contenedor que cambie los selectores directos de menús o tablas. Los campos que puedan habilitarse más adelante mantienen su control nativo bloqueado con el motivo al lado; un valor que nunca cambia en ese contexto utiliza `UnavailableValue` como texto, con etiqueta y explicación.

El puntero normal indica que una acción no está disponible. `aria-busy="true"` reserva el puntero de espera a una operación ocupada. `disabled` exige `aria-busy` explícito y verdadero mientras la operación está ocupada. Las restricciones de datos usan `unavailable` con su motivo; no se admite un bloqueo sin explicación. Los campos de solo lectura que sirven para copiar conservan esa función y requieren `readOnlyReason`, visible y asociado aunque haya un error.

### Estructura del editor

- `Organize`: filtros, paginación, selección, barra contextual e inspector existente.
- `bulk-selection`: recorrido de descendientes estructurales; nunca usa condiciones para ampliar selección.
- `BulkDialog`: configuración, preview, corrección, inclusión explícita de dependencias y confirmación.
- `Editor`: feedback e invalidación de caché después de la operación.
- `editor.css`: controles de selección, resumen y reflow, acotados al editor.

**VERIFICADO localmente:** tests de selección a 10/50/120/304 preguntas, independencia del inspector, alcance de filtros/páginas, cancelación, conflictos y reintentos. Playwright incluye el recorrido de 304 preguntas y cuatro anchos. Los conteos finales y el estado del gate se mantienen en [Operaciones masivas](BULK-QUESTIONNAIRE-OPERATIONS.md#verificación).

**PENDIENTE / fuera de alcance:** archivado, borrado, reemplazo de participantes, condiciones, prioridad y trazabilidad masivos. No hay nuevos estados de aprobación ni una entidad Questionnaire. Este cambio no crea una release ni modifica la versión de paquetes.


La misma regla se aplica en las demás pantallas: la restricción indica qué falta,
y los estados de espera solo corresponden a una operación real en curso. Consulta
[los casos de acceso, importación, invitaciones y respuesta](ayuda/SOLUCION-DE-PROBLEMAS.md#una-acción-está-atenuada-o-un-dato-no-se-puede-editar).
