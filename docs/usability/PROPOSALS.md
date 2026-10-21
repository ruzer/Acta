# Propuestas posteriores a la investigación — HIGH / CRITICAL

Las diez sesiones y las revisiones independientes se cerraron antes de redactar estas propuestas. **No implementadas.** Se proponen solo intervenciones de alcance para los dos problemas HIGH. No se observó CRITICAL. Los MEDIUM/LOW permanecen como oportunidades en [Simplicity review](SIMPLICITY-REVIEW.md), sin diseño detallado aprobado.

## Prioridad 1 — Continuidad de teclado al cerrar una operación

Problema: [FRICTION-001](FRICTION-LOG.md), P09-O04 y A11Y-01. Asignar/Publicar dejan foco en BODY; Editar/Crear lo devuelven de forma útil. Hubo navegación accidental y recorridos de 14–15 Tab. La inspección técnica independiente reprodujo Escape en los dos diálogos afectados.

| Orden de consideración | Evaluación |
|---|---|
| 1. Eliminar | Eliminar el recorrido extra causado por perder la posición. No eliminar el diálogo ni sus salvaguardas. |
| 2. Simplificar | Una regla comprensible: al cancelar/completar vuelvo al contexto de la operación. |
| 3. Reutilizar | Preferencia: extender el comportamiento de retorno ya observado en Editar/Crear a las operaciones que lo pierden. La causa concreta requiere una investigación de código posterior. |
| 4. Default | Destino predeterminado: control que inició la acción, o acciones de la misma pregunta si el menú se cerró. Definir destino lógico si ese elemento deja de existir. |
| 5. Automatizar | Gestionar retorno de foco, sin mover automáticamente la selección, guardar, publicar o abrir otra pantalla. |
| 6. UI nueva | No justificada por la evidencia. |

**Criterio de éxito para una fase autorizada:** el recorrido de P09 puede cancelar y completar edición/asignación/publicación sin salir de la pregunta por pérdida de foco; se verifica tras Escape y éxito real, y también si el control original desaparece. Mantener trap/labels/confirmaciones actuales; ensayar con teclado y, posteriormente, lector de pantalla humano. Cero escrituras adicionales como efecto del arreglo.

Riesgo: restaurar un elemento desmontado/oculto o saltar antes de actualizar la vista. No decidir implementación ni refactor compartido sin inspeccionar qué diálogos lo necesitan.

## Prioridad 2 — Comunicar preparación según el alcance que se va a publicar

Problema: [FRICTION-002](FRICTION-LOG.md). P02/P03 vieron 10/60 errores de principal pendiente; la publicación conjunta de 50/300 pasó sin cambios de contenido. P10 publicó una principal separada antes de usar el lote.

| Orden de consideración | Evaluación |
|---|---|
| 1. Eliminar | Eliminar la interpretación de que todo seguimiento necesita corrección manual previa cuando una operación conjunta válida incluye su principal. No eliminar la restricción real. |
| 2. Simplificar | Explicar la diferencia entre «esta pregunta sola» y «estas preguntas juntas» en términos de trabajo, evitando presentar reglas de una como diagnóstico absoluto de la otra. |
| 3. Reutilizar | Preferencia: utilizar el plan/resultado de revisión de publicación ya existente como autoridad para el alcance elegido. Investigar cómo se relaciona con Revisar; no mantener otra predicción desconectada. |
| 4. Default | No cambiar a publicación conjunta automática. La persona conserva alcance, preview y confirmación explícitos. |
| 5. Automatizar | Si se puede con el contrato existente, verificar el conjunto antes de presentar un bloqueo como definitivo; no publicar ni corregir dependencias automáticamente. |
| 6. UI nueva | No se justifica un nuevo modo o pantalla. Empezar por reutilizar patrón y lenguaje actuales; una señal adicional solo si pruebas humanas muestran que lo anterior no basta. |

**Criterio de éxito:** una tarea con principal y seguimientos distingue correctamente publicación individual bloqueada de lote válido; dependencias externas, inválidas o no autorizadas siguen bloqueando. Comparar10/50/300 sin exigir pasos individuales evitables ni reducir validaciones, atomicidad o concurrencia. Mostrar solo resultados comprobables por contrato; si hace falta ampliarlo, diseñarlo por separado antes de código.

Riesgo: convertir un aviso de preparación en garantía de éxito futuro, ignorar cambios concurrentes o confundir agrupación con condición. La autoridad final sigue siendo backend; grupo y condición conservan sus significados.

## Orden recomendado de decisión

1. Autorizar una corrección acotada de continuidad de teclado.
2. Autorizar diagnóstico de coherencia Revisar/publicación conjunta, conservando todos los controles de seguridad.
3. Con personas reales, repetir entrada administrativa, localizar importación, preparación de 10/50 preguntas y recuperación de Por consultar. Esto determina cuál MEDIUM justifica intervención siguiente.
4. Mantener lo que funcionó: borradores, evidencia, separación enviar/validar y preview de operaciones. No agregar funcionalidades antes de comprobar si basta hacer visibles y coherentes las existentes.

## Fuera de alcance

Ningún código, cambio de dominio/contratos, instrumentación de telemetría, PR, commit, push ni release. No hay propuesta de arreglar toda la lista a la vez. La investigación identifica y prioriza; la decisión de implementación sigue pendiente.
