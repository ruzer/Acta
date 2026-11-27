# Una definición de obligatoriedad para cada persona

**Propuesta sin aprobar.** Diseño para decidir; no cambia contratos, datos ni comportamiento. Refs [#177](https://github.com/ruzer/Acta/issues/177).

Base examinada: [Acta v0.12.0, commit a16d3ee0b7eda30fb8fd065e468b7503d4f40b6e](https://github.com/ruzer/Acta/tree/a16d3ee0b7eda30fb8fd065e468b7503d4f40b6e). Las líneas del inventario corresponden a ese árbol. Los ejemplos son ficticios. Las cifras de reproducción del issue son evidencia aportada en el issue, no una medición nueva de este documento ni una frecuencia de uso real.

## Decisión solicitada

Recomiendo **A: la asignación expresa el compromiso de cada persona; la pregunta aporta el valor inicial de las asignaciones nuevas**. El formulario, el envío y el seguimiento deben leer el mismo compromiso efectivo. Se mantienen los dos campos con responsabilidades distintas; no se eliminan ni se igualan datos en silencio.

Antes de implementar, el propietario debe aprobar:

1. La opción A o una alternativa de la comparación siguiente.
2. Exponer la obligatoriedad de la asignación mediante una lectura nueva de contexto, sin añadir campos obligatorios a `responseView` ni reinterpretar resultados históricos de reintentos. La coordinación de frontend y backend no basta por sí sola para esa compatibilidad.
3. Mantener los valores de asignación existentes, incluidas las invitaciones opcionales. Presentar los desajustes para revisión humana, sin una actualización masiva automática.
4. Aplicar el nuevo criterio a envíos futuros y correcciones, sin revalidar retrospectivamente ni borrar envíos o decisiones anteriores por el solo cambio de versión.
5. Qué valor inicial tendrán las invitaciones nuevas: se recomienda el de cada pregunta, mostrado antes de confirmar, con excepción explícita por pregunta cuando se autorice el contrato. Hoy siempre es falso.

El alcance de este diseño es únicamente documental; incorporarlo al PR consolidado no lo aprueba ni lo implementa. Una aprobación del concepto no equivale a autorizar cualquier modificación de contratos o migraciones: la implementación debe delimitar y someter esos cambios al propietario.

## Problema y alcance

Una persona puede leer «Opcional» en el formulario y aparecer con esa misma pregunta como obligatoria pendiente en Participación. También existe el caso inverso. No hay una sola regla aplicada de modo diferente: actualmente hay dos reglas distintas con el nombre `required`.

- `QuestionRevision.required`: condición de la pregunta que controla la explicación y la validación al enviar.
- `QuestionAssignment.required`: compromiso de una persona, usado en los pendientes, cobertura y fuentes necesarias de una decisión.

«Opcional» tampoco significa que se pueda enviar cualquier cosa: una respuesta ausente necesita comentario explicativo, y una respuesta presente debe ser válida para su tipo. Guardar borrador y enviar tienen reglas distintas.

No se rediseñan aquí los permisos, el alcance de invitaciones, la aplicabilidad condicional, los tipos de respuesta ni la distribución de miembros. No se diseña ni implementa #173.

## Inventario comprobado: dónde se decide y dónde se cuenta

En esta tabla, **P** es la revisión vigente de la pregunta; **A** es la asignación de la persona. Se excluyen los atributos HTML `required` de nombre, contraseña o campos administrativos que no expresan obligatoriedad de una respuesta.

| Superficie o regla | Fuente exacta en la base | Campo y comportamiento actual |
| --- | --- | --- |
| Persistencia de la pregunta | `app/backend/prisma/schema.prisma:336`, `:345` | `QuestionRevision.required`, sin valor inicial en el esquema. |
| Persistencia de la asignación | `app/backend/prisma/schema.prisma:395`, `:400` | `QuestionAssignment.required`, valor inicial de esquema `true`; los servicios pueden indicarlo explícitamente. |
| Crear o editar pregunta | `app/frontend/src/pages/QuestionForm.tsx:60`, `:78`, `:623`; `app/backend/src/questionnaire/questionnaire.service.ts:688` | P. Pregunta nueva inicia en `true`; edición conserva el valor recibido. |
| Lectura del cuestionario y sus asignaciones | `app/backend/src/questionnaire/questionnaire.service.ts:75`, `:107`; `packages/contracts/src/index.ts:302`, `:510` | Se exponen P y A por separado. Organizar muestra P en `app/frontend/src/pages/editor/Organize.tsx:134`. |
| Formulario de quien responde | `app/backend/src/responses/response-graph.ts:213`, `:239`; `packages/contracts/src/index.ts:631`; `app/frontend/src/pages/AnswerControl.tsx:24` | P. `responseView.question.required` procede de la revisión, no de la asignación. |
| Borrador y envío | `app/backend/src/responses/responses.service.ts:188`, `:282`; `app/backend/src/responses/answer-rules.ts:57`, `:101`, `:109` | P. El servicio valida borrador con `submit=false` y envío con `true`. Texto vacío, matriz incompleta y ausencia de respuesta tienen controles específicos. |
| Mi trabajo, avance y Continuar | `app/backend/src/responses/response-graph.ts:155`, `:175`, `:196` | No cuentan solo obligatorias: consideran preguntas aplicables y envíos vigentes, sin filtrar por P o A. No confundir su `pending` con el de Participación. |
| Participación | `app/backend/src/visibility/participation.ts:71`, `:87`, `:32`, `:33`, `:52` | A. El `q.required` del resultado SQL es un alias del CTE que selecciona `a.required`, no P. Cuenta obligatorias aplicables sin envío vigente. |
| Texto de Participación | `app/frontend/src/pages/Participation.tsx:35`, `:161`; `app/frontend/src/pages/ParticipationPeople.tsx:60` | Presenta los pendientes de A y los usa en recordatorios. «Completo» no equivale a todas las opcionales enviadas. |
| Atención: personas que bloquean | `app/frontend/src/pages/ProgressBoard.tsx:343`, `:347`, `:555` | Reutiliza Participación; no recalcula P. |
| Atención: cobertura por pregunta | `app/backend/src/visibility/visibility.service.ts:101`, `:128`; `app/frontend/src/pages/attention-groups.ts:94`, `:98` | `requiredRespondents` cuenta A aplicables; `submittedRespondents` cuenta todas las aportaciones vigentes, no solo las obligatorias. La agrupación usa esos dos totales; no es un nuevo cálculo individual de obligación. |
| Revisión: cobertura y estado | `app/backend/src/review/review-state.ts:112`, `:133`, `:143`, `:150` | A. `missing` aumenta por asignación obligatoria aplicable sin revisión vigente; contribuye al estado junto con otros motivos. |
| Revisión: ficha y lista de personas | `app/backend/src/review/review-read.service.ts:224`; `app/frontend/src/pages/ReviewDetail.tsx:346`, `:443`; `packages/contracts/src/index.ts:876` | La ficha dice obligatoria/opcional con P, mientras cada persona dice aportación requerida/opcional con A. |
| Registrar e invalidar decisiones | `app/backend/src/review/review.service.ts:559`, `:564`; `app/backend/src/review/review-state.ts:297`, `:303` | A. Exige cobertura y fuentes de participantes requeridos; una decisión puede invalidarse cuando cambia la cobertura o sus fuentes. |
| Asignación individual | `app/frontend/src/pages/Editor.tsx:615`, `:642`; `packages/contracts/src/index.ts:321`; `app/backend/src/questionnaire/questionnaire.service.ts:1005`, `:1008` | A se envía explícitamente; el formulario lo inicia marcado, no desde P. El contrato tiene valor predeterminado `true`. Crear o actualizar guarda lo indicado. |
| Asignación masiva | `app/frontend/src/pages/editor/BulkDialog.tsx:55`, `:120`, `:279`; `app/backend/src/questionnaire/bulk-questionnaire.service.ts:105`, `:110`, `:372` | A se elige explícitamente para el lote. Asignaciones activas existentes se conservan; nuevas y reactivadas usan la elección. No heredan P. |
| Invitación por enlace | `app/backend/src/invitations/invitations.service.ts:303`, `:311` | Crea A=`false`, sin mirar P. El formulario y envío siguen recibiendo P. |
| Formulario y envío por invitación | `app/frontend/src/pages/InvitedResponse.tsx:616`; `app/backend/src/invitations/invitation-response.controller.ts:105`, `:120` | Reutiliza AnswerControl y ResponsesService: P gobierna la indicación y validación de envío. |
| Cierre y avance de quien responde | `app/frontend/src/pages/ParticipantFlow.tsx:138`; `app/frontend/src/pages/InvitedResponse.tsx:242`, `:244` | No consultan A para declarar el cierre: la pantalla con cuenta usa siguiente pregunta y casos indeterminados; la de invitación compara preguntas con envíos. No equiparar estos cierres con «Completo» de Participación. |
| Importación CSV | `app/frontend/src/questionnaire-csv.ts:208`, `:273`; `app/frontend/src/pages/Exchange.tsx:361` | «Obligatoria» se transforma en P. No es una asignación a una persona. |
| Importación de plantilla | `app/backend/src/exchange/import.service.ts:268`, `:277` | Guarda P en la primera revisión. **Este importador no crea asignaciones**; no existe hoy una obligatoriedad individual que reconciliar durante la importación. |
| Exportar plantilla de cuestionario | `app/backend/src/exchange/questionnaire-template.ts:95`, `:223` | CSV y plantilla conservan P. No exportan compromisos individuales. |
| Exporte completo JSON | `app/backend/src/exchange/export.service.ts:259`, `:264`; `packages/contracts/src/index.ts:1845`, `:1864` | Conserva ambos: revisiones de pregunta y asignaciones. No unifica el significado. |
| Exporte de resultados CSV | `app/backend/src/exchange/export.service.ts:299`, `:329`; `app/backend/src/exchange/renderers.ts:67` | «Personas requeridas» viene de cobertura A; no es la columna «Obligatoria» del CSV de plantilla. |
| Exporte Markdown | `app/backend/src/exchange/export.service.ts:374`, `:390` | No imprime una etiqueta de obligatoriedad ni aplica validación de envío. Formatea respuestas históricas mediante tipo/configuración/opciones. |
| Decisiones JSON e informe imprimible | `app/backend/src/exchange/export.service.ts:141`, `:155`; `app/frontend/src/pages/ProjectReport.tsx:36`, `:73`, `:103` | El JSON reutiliza el detalle (P y participantes A cuando son visibles al rol); el informe muestra decisiones vigentes y fuentes, no una etiqueta de obligatoriedad. La vigencia depende indirectamente de la cobertura A. No añade permisos. |
| Datos de demostración | `app/backend/src/seed.ts:256`, `:292` | Establecen explícitamente P y A; no constituyen una regla de herencia del producto. |

### Matices que no se deben perder

Participación excluye asignaciones que no aplican, preguntas no aplicables, miembros/usuarios inactivos e invitaciones vencidas o revocadas (`app/backend/src/visibility/participation.ts:28`, `:99`). Revisión conserva aportaciones de invitaciones vencidas o revocadas para el historial (`app/backend/src/review/review-state.ts:80`). La consulta SQL de abajo diagnostica combinaciones almacenadas, no replica esos conteos funcionales.

Participación marca «Completo» si no hay obligatorias pendientes y hay alguna obligatoria, aunque falten opcionales. Si no hay ninguna obligatoria, su regla actual exige todos los envíos aplicables para marcar «Completo» (`app/backend/src/visibility/participation.ts:52`). Cambiar esa excepción sería otra decisión: esta propuesta la conserva.

## Matriz del comportamiento actual

Supuestos: asignación activa, pregunta publicada y aplicable, persona activa, sin envío vigente. «Cuenta» describe la contribución de esta asignación; no garantiza por sí sola el estado de todo el proyecto o la posibilidad de decidir.

| P: pregunta | A: asignación | Formulario | Participación / Atención / revisión | Enviar sin valor, con comentario explicativo |
| --- | --- | --- | --- | --- |
| Obligatoria | Obligatoria | Necesaria para enviar | Cuenta como obligatoria pendiente y falta de cobertura | Rechaza. |
| Obligatoria | Opcional | Necesaria para enviar | No cuenta como obligatoria pendiente; puede quedar fuera del compromiso exigido para decidir | Rechaza, aunque no cuente como pendiente obligatoria. |
| Opcional | Obligatoria | Opcional | Cuenta como obligatoria pendiente y falta de cobertura | Admite ausencia representada correctamente para el tipo, con comentario. El envío puede cubrir ese compromiso. |
| Opcional | Opcional | Opcional | No cuenta como obligatoria pendiente | Admite ausencia representada correctamente para el tipo, con comentario. |

Sin comentario, una ausencia se rechaza también en una pregunta opcional. Una fecha inválida o una opción inexistente siguen siendo inválidas. Una matriz parcialmente llena con P obligatoria debe completar sus filas. Un borrador puede permanecer incompleto; la obligatoriedad no obliga a enviarlo antes de guardar. No se cambia aplicabilidad condicional.

## Opciones para decidir

| Opción | Pantallas y reglas que cambian | Contrato / migración | Datos y cifras existentes | Riesgo y esfuerzo relativo |
| --- | --- | --- | --- | --- |
| **A. Asignación = compromiso; pregunta = valor inicial** | Formulario y envío usan A; editor/importación explican P como valor inicial; asignación individual/masiva e invitaciones muestran la herencia. Revisión distingue valor inicial de compromiso personal. | Nueva lectura explícita de contexto con A; `responseView` y los resultados históricos de comandos se conservan. Revisar entrada de invitaciones y lote para excepciones por pregunta. No necesita eliminar columnas ni migrar valores existentes. | Mantener A conserva inicialmente los conteos de pendientes/cobertura. Cambia la exigencia del próximo envío en los desajustes; no cambiar envíos históricos. Nuevas invitaciones podrían contar como obligatorias donde antes eran opcionales. | Medio-alto: atraviesa formulario, envío, asignación e invitaciones; conserva flexibilidad individual y resuelve la contradicción. |
| **B. Pregunta = única obligación para todos** | Participación, Atención, cobertura, validación de decisiones y asignaciones pasan a usar P; el formulario ya la usa. Quitar o explicar controles de A. | Los conteos pueden cambiar sin cambiar la forma de salida, pero sí su significado. Eliminar A exigiría migración y compatibilidad de contratos/exportes; conservarlo temporalmente exigiría declarar que deja de gobernar. | Los conteos cambian inmediatamente en ambos tipos de desajuste; personas completas pueden dejar de estarlo y puede cambiar la cobertura de decisiones. No borrar A ni reescribir historia. | Alto riesgo de cambio de negocio: elimina excepciones por persona y exige una estrategia de transición de decisiones. |
| **C. Mantener ambas y explicarlas** | Formulario distingue «valor necesario al enviar» de «envío requerido para ti»; equipo ve discrepancias. No cambia el algoritmo de envío ni de cobertura. | Exponer A al formulario para explicarlo también requiere contrato. Sin migración de datos. | Cifras y validación se conservan. La contradicción de términos se hace visible, pero siguen existiendo dos obligaciones distintas. | Medio: menor cambio de negocio, mayor carga de comprensión para personas no técnicas. No cumple una definición única como solución final. |

**Recomendación: A.** El compromiso puede diferir por persona sin obligar a duplicar una pregunta. C sería una mitigación, no una solución definitiva. B es más uniforme, pero elimina una facultad que el producto ya permite al asignar.

### Desarrollo propuesto de A, sujeto a aprobación

- Conservar `question.required` como valor de la pregunta para editar, importar y exportar. No reinterpretar silenciosamente el mismo campo en unas operaciones y en otras.
- Añadir una lectura de contexto personal que entregue A separada de `responseView`, según la estrategia de compatibilidad siguiente. El formulario y el servicio de envío toman A como obligatoriedad efectiva. El servidor obtiene A desde la asignación autorizada; no acepta que el cliente la decida al guardar una respuesta.
- Mantener la forma de todas las operaciones actuales que reutilizan `responseView`, incluidas invitaciones, resultados idempotentes y exportes. La nueva lectura necesita actualización coordinada del formulario y del servidor, pero no altera esos esquemas estrictos. La compatibilidad debe probarse también con resultados guardados antes de la actualización, no solo con peticiones nuevas.
- Conservar las reglas de tipo, tamaño, opciones, matriz, comentario y condición. Cambiar cuál de P/A controla la obligatoriedad **sí modifica el comportamiento del envío en los dos desajustes**: debe aprobarse y probarse; no describirlo como una corrección solo visual.
- Para nuevas asignaciones, copiar P una vez y mostrar la elección antes de guardar. Cambiar P más adelante no cambia automáticamente compromisos existentes. Una reactivación conserva su elección anterior salvo cambio explícito, con vista previa; no tratarla como una asignación nueva silenciosa.
- En un lote con preguntas de valores distintos, presentar «Usar el valor de cada pregunta» o una sustitución explícita. La representación de esa elección necesita diseño de contrato aprobado; el booleano actual por persona no representa valores distintos por pregunta dentro del lote.
- La importación sigue creando preguntas, no participantes. Su «Obligatoria» proporciona el valor inicial para la asignación posterior. No agregar asignaciones al importador ni cambiar el formato JSON/CSV como efecto secundario.
- Antes de activar la versión, inventariar desajustes y avisar al equipo. Mantener A existentes; cada ajuste posterior debe ser una decisión explícita con bitácora. Sin SQL de conciliación ni migración que iguale campos en silencio.
- Mantener válidos los envíos anteriores bajo sus reglas originales, sin recrear revisiones ni fuentes. Una corrección futura se valida con el compromiso vigente. Los efectos de un cambio manual de A en decisiones siguen las reglas de cobertura existentes y deben advertirse antes de confirmar.
- No eliminar A ni P. Esta vía no requiere una migración de valores ni una columna nueva; si para registrar la política histórica por envío se propone ampliar persistencia, presentar esa necesidad aparte antes de aprobar código. La bitácora de asignación actual no debe presentarse como un nuevo snapshot de la regla aplicada a cada envío.

### Compatibilidad de reintentos: no reconstruir una obligación histórica

`app/backend/src/responses/responses.service.ts:124` busca el resultado previo en `AuditEvent` por actor, institución, `requestId` e índice; `:133` comprueba la huella y `:137` lo valida con el esquema actual. Los comandos de guardar y enviar utilizan `responseView` (`:184`, `:260`). Por tanto, agregarle `assignmentRequired` obligatorio haría fallar un reintento legítimo cuyo resultado anterior no contenga el campo. Cambiar juntos frontend y backend **no corrige ese registro histórico**.

**Estrategia recomendada: contrato de lectura adicional, comandos y replays existentes intactos.**

1. Conservar `responseView`, las entradas actuales de guardar/enviar, sus nombres de operación y el cálculo de huella. No editar `AuditEvent.result`, no agregar valores históricos deducidos de la asignación vigente y no volver a ejecutar el trabajo de un `requestId` ya resuelto.
2. Proponer `responseContextView = { response: responseView, requirement: { required: boolean, source: "ASSIGNMENT", assignmentId: UUID, updatedAt: fecha UTC } }`. `requirement` describe **el compromiso actual**, no la regla que se aplicó a un envío anterior. La lectura ocurre en una misma transacción para evitar mezclar una respuesta con una asignación leída en otro instante.
3. Rutas nuevas propuestas: `GET /projects/:projectId/questions/:id/response-context` para cuentas y `GET /invitations/access/questions/:id/response-context` para invitados. Reutilizan la autorización y alcance de la lectura de respuesta existente. Declararlas aparte en `packages/contracts`; no sustituir ni ampliar la salida de los endpoints anteriores. Requieren aprobación expresa.
4. El formulario nuevo carga ese contexto y muestra la obligatoriedad de `requirement`; conserva P dentro de `response.question.required` para representar la definición de la pregunta. Los comandos guardan/envían con los contratos actuales. Al recibir su resultado, el cliente actualiza el estado de respuesta y vuelve a leer el contexto antes de mostrar un compromiso vigente; el reintento no se trata como una lectura actual. Esa lectura adicional y su costo deben medirse en la implementación, sin ocultarlos como si no cambiaran las peticiones.
5. Un envío nuevo valida contra A leído por el servidor dentro de la transacción actual. Un reintento con el mismo `requestId` y contenido devuelve el resultado anterior por la rama idempotente, sin revalidarlo con la obligación actual. Si la asignación cambió desde que se abrió el formulario, la autoridad sigue siendo el servidor; ante un rechazo por obligatoriedad, refrescar el contexto y explicar la exigencia actual, conservando el borrador.
6. No llenar campos faltantes de resultados antiguos con `false`, con P ni con A actual: cualquiera inventaría una condición histórica. Los datos actuales solo se muestran con la lectura de contexto claramente separada.

La nueva lectura no convierte el historial en una prueba de qué obligación se aplicó a cada envío antiguo. Tampoco resuelve compatibilidad de comportamiento de una pestaña antigua: aunque los contratos anteriores sigan siendo válidos, esa pestaña puede mostrar P mientras el envío nuevo exige A. Debe anunciarse actualización coordinada y recarga; mantener simultáneamente ambas políticas de envío requeriría otro diseño aprobado.

**Prueba obligatoria previa a implementar:** en la versión anterior, guardar y enviar usando `requestId` conocidos y conservar sus resultados y huellas; actualizar; repetir exactamente esas solicitudes. Deben retornar los mismos resultados lógicos, sin error de esquema, nuevas revisiones, nuevas auditorías ni cambios a `AuditEvent.result`. Repetir un ID con otro contenido conserva el rechazo existente. Cambiar A después de la operación original debe afectar al contexto actual y a operaciones nuevas, nunca al resultado de su replay. Cubrir cuentas, invitados y todos los comandos que pasen por `execute` con `responseView`.

### Cifras que no deben prometerse como iguales

Mantener A conserva el criterio de «obligatorias pendientes» de las asignaciones actuales; no promete idénticas cifras para siempre. Nuevos envíos, condiciones que cambien, nuevas asignaciones y decisiones explícitas pueden modificarlas. Las barras de envíos de Mi trabajo y Participación siguen contando envíos, no un porcentaje de aprobación ni de validación del contenido.

El registro del caso «opcionales respondidas + obligatorias sin responder» en Atención merece una prueba específica: actualmente `submittedRespondents` incluye todas las aportaciones y no es equivalente a «obligatorias respondidas». No arreglar esa aritmética sin delimitarla en la implementación correspondiente.

## Diagnóstico de solo lectura por proyecto

La consulta cuenta las cuatro combinaciones, incluso cuando alguna vale cero. Incluye asignaciones activas sobre preguntas publicadas; usa la revisión vigente de la pregunta. No modifica datos y no debe ejecutarse automáticamente al actualizar. La persona operadora decide en qué instalación y con qué rol autorizado ejecutarla.

No filtra condiciones, estado NOT_APPLICABLE, miembros inactivos ni vigencia de invitaciones. Por eso sirve para medir divergencias almacenadas, **no** para cotejar directamente el número mostrado en Participación. No devuelve nombres de personas ni respuestas.

```sql
BEGIN TRANSACTION READ ONLY;
WITH combinaciones(pregunta_obligatoria, asignacion_obligatoria) AS (
  VALUES (false, false), (false, true), (true, false), (true, true)
), recuentos AS (
  SELECT a."projectId" AS proyecto_id,
         qr.required AS pregunta_obligatoria,
         a.required AS asignacion_obligatoria,
         count(*)::bigint AS asignaciones
  FROM "QuestionAssignment" a
  JOIN "Question" q
    ON q.id = a."questionId" AND q."projectId" = a."projectId"
  JOIN "QuestionRevision" qr
    ON qr."questionId" = q.id AND qr."projectId" = q."projectId"
   AND qr.number = q."currentRevisionNumber"
  WHERE a.active AND q.publication = 'PUBLISHED'
  GROUP BY a."projectId", qr.required, a.required
)
SELECT p.id AS proyecto_id,
       p."externalId" AS codigo_proyecto,
       c.pregunta_obligatoria,
       c.asignacion_obligatoria,
       COALESCE(r.asignaciones, 0)::bigint AS asignaciones,
       c.pregunta_obligatoria <> c.asignacion_obligatoria AS desajuste
FROM "Project" p
CROSS JOIN combinaciones c
LEFT JOIN recuentos r
  ON r.proyecto_id = p.id
 AND r.pregunta_obligatoria = c.pregunta_obligatoria
 AND r.asignacion_obligatoria = c.asignacion_obligatoria
ORDER BY p."externalId", p.id,
         c.pregunta_obligatoria, c.asignacion_obligatoria;
COMMIT;
```

**Ejecución comprobada:** el 26 de noviembre de 2026 se ejecutó esta consulta con `psql` y `ON_ERROR_STOP`, dentro de una transacción de solo lectura, sobre PostgreSQL 18.6 en el laboratorio desechable del lote H. Devolvió 20 filas: las cuatro combinaciones para cada uno de cinco proyectos con datos ficticios; la transacción terminó con `COMMIT`. Esta comprobación acredita que la consulta ejecuta y entrega las combinaciones; todavía no constituye una prueba dedicada con un conteo esperado distinto para cada combinación. No se ejecutó contra WORK ni datos reales.

## Interfaz y ayuda, si se aprueba A

Textos propuestos; todavía no existen:

- En la pregunta: «Obligatoria al asignar por primera vez. Puedes ajustar este valor para cada persona».
- En la asignación: «Esta persona debe responder» y, si difiere, «Distinto del valor inicial de la pregunta».
- En el formulario: «Debes responder esta pregunta. Puedes guardar un borrador incompleto» o «Esta pregunta es opcional para ti. Si la envías sin respuesta, explica el motivo».
- En el seguimiento: «Obligatorias pendientes: N»; conservar «Enviadas X de Y» para los envíos, sin llamarlo validación o aprobación.
- En revisión: «Compromiso de esta persona: obligatorio/opcional»; la ficha de pregunta debe decir «Valor inicial al asignar», no competir con ese compromiso.

Actualizar `Help.tsx`, las guías de participante, revisión y asignación en `docs/ayuda/`, la documentación de importación e invitaciones y sus pruebas de consistencia en los mismos PR que cambien textos. Explicar que guardar borrador no satisface una obligación de envío y que una respuesta enviada no acredita aprobación de su contenido.

### Relación acotada con #173

[#173](https://github.com/ruzer/Acta/issues/173) plantea poder agregar preguntas a una participación existente. Si reutilizara sin cambios la creación actual de invitaciones, nacerían con A=`false`. Resolver y aprobar primero la semántica de #177 evita perpetuar ese desajuste. Este documento no diseña enlaces, actualización de su alcance ni vinculación de cuentas.

## Validación necesaria y secuencia de implementación

1. Aprobar semántica, transición de datos y contrato exacto. Preparar pruebas de las cuatro combinaciones, con y sin comentario, tipo matriz, condición no aplicable y respuesta anterior.
2. Un PR de contrato de contexto y lectura efectiva, con prueba de reintentos creados antes de actualizar y compatibilidad de clientes. Conservar `responseView` y `AuditEvent.result`; no activar parcialmente formulario y servidor. Requiere autorización previa del propietario.
3. Aplicar el mismo criterio en formulario y envío; conservar tipos, condiciones y controles de acceso. Probar cuentas e invitados, revisión, decisiones vigentes y correcciones de envíos antiguos.
4. En un PR coordinado, cambiar los valores iniciales de asignación individual, masiva e invitaciones, mostrando excepciones y reactivaciones. Importación debe seguir sin crear miembros ni asignaciones.
5. Probar el recorrido completo: crear/importar pregunta → asignar con valor distinto → formulario → envío → Participación → Atención → revisión → exporte/informe. Pruebas de regresión para decisiones ya registradas y JSON/CSV histórico.
6. Verificar teclado, foco, lector de pantalla automatizado y móvil, junto con pruebas de ayuda. Distinguir comprobación automatizada de lector de pantalla humano.

Estimación relativa: **media-alta**, al menos dos PR funcionales coordinados después del contrato, con riesgo de estados transitorios incoherentes. No se fija una fecha ni se propone publicar una versión en este documento.

## Impacto y límites

Esta propuesta se entrega solo como documento y no se implementa en esta tanda. No se ejecutan actualizaciones de tablas. El trabajo futuro afectaría backend, contratos y pantallas indicadas en el inventario; no se puede prometer que sea solo CSS ni que no requiera coordinación de actualización con forks. En particular, el texto de importación vive en `Exchange.tsx`, archivo personalizado en algunos forks: minimizar el cambio y revisarlo durante la integración correspondiente.

No se ha ejecutado la matriz de comportamiento nueva, porque aún no existe. No se acredita capacidad, producción, compatibilidad con clientes externos ni una migración de datos. La evidencia actual es lectura del código y la ejecución de la consulta diagnóstica en cinco proyectos ficticios, descrita arriba.
