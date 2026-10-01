# Contratos 2C — respuestas y evidencia


## Operaciones y semántica

`personalProject` devuelve secciones asignadas, progreso propio y punto de continuación. `getResponse` y `getDraft` devuelven la pregunta, borrador privado (null si no existe), historia propia y versión de concurrencia. `saveDraft` reemplaza contenido del único borrador sin crear envío; `submitResponse` envía el borrador confirmado. El cliente guarda primero cualquier cambio local. `attachEvidenceToDraft` y `removeDraftEvidence` modifican asociaciones del borrador e incrementan versión. `stageEvidence` recibe bytes privados todavía sin vincular. No crea respuesta enviada ni borrador.

El contrato de subida usa cuerpo binario `application/octet-stream`, metadatos `stageEvidenceInput` JSON codificados con encodeURIComponent en `X-Evidence-Metadata`, Origin y X-CSRF-Token. No confía en Content-Type del archivo. `downloadEvidence` es la excepción binaria: éxito 200 bytes del objeto descrito por evidenceView, Content-Type detectado, Content-Disposition attachment y nosniff; el cliente no interpreta los bytes como JSON. Errores usan errorView.

IDs opacos para transporte, nunca etiquetas visibles. `answer:null` significa sin valor. Borrador tolera incompletitud, no tipos incorrectos. Comentario/ejemplo vacíos son cadenas vacías. Envío opcional sin valor requiere comentario no vacío. Envío requerido exige valor completo. Fechas reales sin zona y sin coerción. Solo SUBMITTED en la historia; nunca DRAFT en ResponseRevision.

## Durabilidad y validación

Se utiliza validación Zod strict sin coerción. Storage recibe claves opacas, nunca rutas del dominio. Los bytes se escriben y finalizan antes de registrar READY. Una caída puede dejar objetos huérfanos, pero no debe confirmar READY sin bytes. La reconciliación elimina temporales/huérfanos vencidos, no objetos referenciados. La integridad se comprueba antes de asociar/enviar y descargar. No se promete atomicidad física entre PostgreSQL y almacenamiento ni resistencia al borrado externo: se requiere backup coordinado.

## Concurrencia e idempotencia

expectedVersion corresponde a Response.lockVersion, monotónica incluso cuando se consume/recrea el borrador; ResponseDraft.lockVersion refleja el mismo contador al guardar. Empieza en cero si no hay Response. Evita el problema ABA de una pestaña anterior a un envío. Toda mutación requiere UUID requestId. Hash canónico de operación, proyecto, pregunta y payload (más SHA-256 real para upload). La auditoría guarda hash y resultado en la misma transacción. Repetición idéntica devuelve resultado original, sin efectos; otro payload devuelve 409. El cliente conserva requestId al reintentar una petición cuya respuesta se perdió. Permisos se comprueban incluso al repetir.

400 forma inválida; 401 reautenticar sin borrar texto local; 403 rol/CSRF; 404 fuera de alcance; 409 versión/contexto/requestId incompatible; 413 tamaño; 422 valor/archivo inválido; 503 almacenamiento temporalmente indisponible. UI conserva texto ante errores. Tras conflicto ofrece consultar servidor y adopción explícita, nunca sustitución automática.

## Condiciones y avance

El contexto persistido contiene IDs de los envíos vigentes de todos los ancestros. Padre sin envío = indeterminado. Cambiar padre conserva borradores e historia, pero hace no vigente el envío dependiente. Al guardar se reconfirma contenido contra contexto actual; al enviar se exige coincidencia con el contexto guardado. Avance solo envíos vigentes sobre preguntas habilitadas, sin decisiones 2D. Cero habilitadas no equivale a 100%. Continuar prefiere el último borrador confirmado habilitado, después pendientes en orden de sección/pregunta.

## Decisiones técnicas dentro de la base aprobada


`responseView.evidencePolicy` comunica los límites configurados al formulario. Cargas sin asociación caducan tras 24 horas: estado REJECTED auditado bajo bloqueo de proyecto y después eliminación de bytes; metadatos/idempotencia permanecen. Reconciliación al arranque y cada hora. READY e historia nunca se purgan automáticamente. Reintentos de staging comprueban el resultado antes de escribir nuevos bytes. Cuota se comprueba antes y dentro de transacción; máximo dos cargas simultáneas por instancia.

Referencias de validadores: [PDF-LIB](https://pdf-lib.js.org/docs/api/classes/pdfdocument), [sharp: decodificación y límites](https://sharp.pixelplumbing.com/api-constructor/), [yauzl: entradas y tamaños](https://github.com/thejoshwolfe/yauzl). Su uso no sustituye un escáner antimalware institucional.

## Ampliación aditiva 2D

ResponseView incluye reviewStatus para explicar No aplica y bloquear controles de contribución; el servidor mantiene la guarda. PersonalQuestion incluye reviewStatus, clarificationWaiting y clarificationCount propios. Continuar da prioridad a aclaraciones pendientes y omite No aplica. El historial de hilos permanece consultable. Estas ampliaciones no cambian la persistencia de Draft ni crean ResponseRevision al guardar. Las decisiones y permisos nuevos se especifican en [CONTRACTS-2D](CONTRACTS-2D.md); las secciones anteriores describen la base 2C conservada.
