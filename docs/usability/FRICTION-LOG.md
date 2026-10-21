# Friction log — observaciones, sin soluciones

Base: `8940be59e64d8bd5568e80a1b0cc2a7c3af033ca`. Diez sesiones independientes de agentes en navegador real; no diez sujetos humanos. Datos ficticios. Las frecuencias indican exposiciones de este estudio, no prevalencia poblacional. Las incidencias de herramientas no cuentan como fallos del producto.

Severidad: **HIGH** afecta de forma importante orientación/continuidad o transmite un bloqueo global que contradice otra operación válida; **MEDIUM** exige búsqueda, repetición o comprobación recuperable; **LOW** coste acotado sin impedir la tarea. **CRITICAL** requeriría pérdida grave, operación irreversible equivocada o bloqueo esencial confirmado: no observado en estas sesiones. La prioridad final no se deduce solo del número de personas.

## FRICTION-001 — Pérdida de posición al cerrar operaciones

- Persona/tarea: P09, editar, asignar y publicar tres preguntas con teclado.
- Observación: editar devuelve foco a las acciones de origen; cancelar/completar asignación y publicación deja `BODY` como elemento activo. Una expectativa de retorno abrió por error Nuevo tema; no se creó contenido. Recuperar la pregunta exigió recorridos de 14–15 Tab.
- Impacto: navegación accidental y repetición después de operaciones correctas; recuperación posible.
- Frecuencia: 1/1 sesión exclusivamente de teclado; patrón repetido en cancelación, guardado y publicación.
- Severidad: **HIGH**. Categorías: ACCESSIBILITY, NAVIGATION, CONSISTENCY.
- Evidencia: [P09-O02–O04](sessions/p09/SESSION.md), [transcript](sessions/p09/transcript.jsonl) y reproducción posterior independiente [A11Y-01](ACCESSIBILITY.md). No se atribuye a este hallazgo la dificultad del SELECT nativo del entorno.

## FRICTION-002 — Señales distintas de bloqueo para el mismo cuestionario

- Persona/tarea: P02 y P03, publicar 50/300 preguntas con principales y seguimientos.
- Observación: Revisar mostró 10/60 errores «Publica primero la pregunta principal». Sin modificar contenido ni relaciones, el lote completo indicó 0 bloqueadas y publicó todas. P10 publicó una principal antes de volver al lote después de leer esa señal.
- Impacto: duda sobre si corregir contenido, publicar individualmente o confiar en la operación conjunta; desvío entre modos.
- Frecuencia: 2/2 sesiones que contrastaron directamente ambas evaluaciones; 1 recorrido adicional condicionado por el aviso (P10). No son tres fallos del backend.
- Severidad: **HIGH**. Categorías: CONSISTENCY, ERROR PREVENTION, FEEDBACK, SCALE.
- Evidencia: [P02-O06](sessions/p02/SESSION.md), [P03-O06](sessions/p03/SESSION.md), [60 errores](sessions/p03/03-revisar-60-errores.png), [lote 300](sessions/p03/04-publicar-300-sin-bloqueos.png), [P10-O07](sessions/p10/SESSION.md).
- Límite: son operaciones de alcance distinto. La sesión demuestra incoherencia de orientación visible; no demuestra que la validación transaccional sea incorrecta.

## FRICTION-003 — Preparación individual repetida sin descubrir la capacidad conjunta

- Persona/tarea: P01 y P07, habilitar diez preguntas para una misma persona.
- Observación: ambas recorrieron diez asignaciones y diez publicaciones individuales. P01 registró 30 acciones de asignación y 20 de publicación. Ninguna encontró una operación conjunta en su recorrido. P02/P03 sí la descubrieron; P10 llegó con lectura del README.
- Impacto: repetición administrativa evitable dentro de la capacidad que ya existe, sin bloqueo ni pérdida.
- Frecuencia: 2 de 5 sesiones administrativas/analíticas de preparación comparable (P01/P02/P03/P07/P10). P09 tenía un objetivo acotado de tres preguntas y no integra ese denominador.
- Severidad: **MEDIUM**. Categorías: DISCOVERABILITY, REPETITION, SCALE.
- Evidencia: [P01-O06](sessions/p01/SESSION.md), [P07-O07](sessions/p07/SESSION.md), contraste [P02-O02](sessions/p02/SESSION.md), [P03-O01](sessions/p03/SESSION.md), [P10-O06](sessions/p10/SESSION.md).
- Límite: no se observó a un novato repetir 300 veces; ese coste es un riesgo de extrapolación, no un resultado medido.

## FRICTION-004 — Trabajo por consultar fuera de los contadores

- Persona/tarea: P05, reservar información desconocida y retomarla después.
- Observación: con 30 preguntas, el resumen mostró 26 pendientes + 1 borrador + 0 atención + 2 enviadas = 29. La restante seguía en la lista como Por consultar. Requiere atención devolvió vacío; Pendientes permitió encontrarla. Al abrirla apareció Borrador guardado.
- Impacto: no se ve en el resumen cuánto trabajo se reservó; un cambio de filtro para recuperar. No hubo pérdida de pregunta ni borrador.
- Frecuencia: 1/1 sesión que reservó una consulta, comprobado en dos estados del resumen.
- Severidad: **MEDIUM**. Categorías: LANGUAGE, FEEDBACK, DISCOVERABILITY.
- Evidencia: [P05-O04/O06](sessions/p05/SESSION.md), [conteos](sessions/p05/05-guardado-y-salida.png), [atención vacía](sessions/p05/09-filtro-atencion.png), [pendientes](sessions/p05/10-filtro-pendientes.png).

## FRICTION-005 — Rodeo para importar desde un cuestionario vacío

- Persona/tarea: P10, cargar un cuestionario recibido.
- Observación: entró en Editar cuestionario, no encontró Importar, probó Ver preguntas publicadas, regresó a Mis proyectos y abrió Resumen, donde encontró Importar. La guía decía «dentro del proyecto».
- Impacto: cuatro navegaciones adicionales tras entrar al editor; el flujo de importación finalmente funcionó completo.
- Frecuencia: 1/1 sesión de importación.
- Severidad: **MEDIUM**. Categorías: DISCOVERABILITY, NAVIGATION, HELP.
- Evidencia: [P10-O03](sessions/p10/SESSION.md), [editor vacío](sessions/p10/02-editor-empty.png), [preview correcto](sessions/p10/03-import-preview.png).

## FRICTION-006 — Respuesta a aclaración poco distinguible en la bandeja

- Persona/tarea: P06, retomar una aclaración respondida.
- Observación: antes/después de respuesta del participante, el listado conservó Requiere aclaración / 1 aclaraciones abiertas. Cambió la fecha; «Lista para revisar» solo se observó dentro del detalle. El coordinador avisó que la respuesta ficticia ya estaba disponible.
- Impacto: el listado no hizo evidente quién debía actuar; la sesión no demuestra descubrimiento espontáneo de la respuesta nueva.
- Frecuencia: 1/1 aclaración respondida revisada.
- Severidad: **MEDIUM**. Categorías: FEEDBACK, DISCOVERABILITY, LANGUAGE.
- Evidencia: [P06-O02](sessions/p06/SESSION.md), [listado](sessions/p06/10-list-after-clarification-reply.png), [detalle](sessions/p06/11-clarification-ready.png).

## FRICTION-007 — Membresía activa no equivale a trabajo asignado

- Persona/tarea: P01/P07, habilitar participación.
- Observación: P01 guardó membresía y luego encontró diez advertencias de falta de participantes; P07 consultó membresía activa al ver esas advertencias y tuvo que volver a asignar preguntas. P10 entendió ambos pasos con apoyo de la guía.
- Impacto: expectativa no satisfecha/ida y vuelta, recuperadas gracias a «nadie podrá responder todavía» e Ir a corregir. La distinción de permisos no es un defecto por sí misma.
- Frecuencia: 2/3 sesiones administrativas que revisaron membresía en esta preparación.
- Severidad: **MEDIUM**. Categorías: COGNITIVE LOAD, NAVIGATION, LANGUAGE.
- Evidencia: [P01-O04](sessions/p01/SESSION.md), [P07-O06](sessions/p07/SESSION.md), [P10-O05](sessions/p10/SESSION.md).

## FRICTION-008 — Inicio vacío dirigido a quien espera acceso, incluso siendo administrador

- Persona/tarea: P01/P10, crear el primer proyecto.
- Observación: «La administración debe asignarte una membresía para comenzar» apareció para quien debía iniciar el proyecto; Administración abrió Usuarios, luego se encontró Proyectos. Crear mostró Operación guardada y vació el formulario; se localizó el nuevo proyecto desde Mis proyectos.
- Impacto: orientación inicial indirecta; ambos se recuperaron sin ayuda privada.
- Frecuencia: 2/2 primeras administraciones sin proyectos.
- Severidad: **MEDIUM**. Categorías: LANGUAGE, DISCOVERABILITY, NAVIGATION.
- Evidencia: [P01-O01](sessions/p01/SESSION.md), [P10-O01/O02](sessions/p10/SESSION.md), [inicio](sessions/p10/01-empty-admin.png).

## FRICTION-009 — Contexto seleccionado descartado entre operaciones

- Persona/tarea: P02/P03/P10, aplicar área, participantes o publicación sobre conjuntos relacionados.
- Observación: confirmar un lote limpia selección; P02 seleccionó las 50 tres veces. P03 perdió 60 seleccionadas al cambiar de tema, recibió aviso y volvió al tema. Cambiar entre Organizar/Revisar también descartó búsqueda/selección en P02.
- Impacto: reselección y comprobación del alcance. No se modificaron elementos equivocados; el aviso de limpieza evitó ambigüedad.
- Frecuencia: 3/3 usuarios de lotes repitieron selección tras una operación; 1 exploración de acumulación entre temas fracasó.
- Severidad: **MEDIUM**. Categorías: REPETITION, NAVIGATION, ERROR PREVENTION.
- Evidencia: [P02-O08/O09](sessions/p02/SESSION.md), [P03-O02/O03](sessions/p03/SESSION.md), [P10-O06](sessions/p10/SESSION.md).
- Límite: la limpieza puede ser una protección deliberada; no se concluye que conservar todo siempre sea seguro.

## FRICTION-010 — Confirmación del envío buscada fuera de la pregunta siguiente

- Persona/tarea: P04/P08, enviar y saber que terminó correctamente.
- Observación: el envío avanzó a la siguiente pregunta; en la observación estable de destino no hubo confirmación persistente de la anterior. Volvieron a Mi trabajo y Ver para comprobar estado/contenido. P05 aprovechó el avance sin retroceder por cada envío.
- Impacto: vueltas de comprobación, sin envío duplicado ni datos perdidos.
- Frecuencia: 2/3 sesiones de participante realizaron explícitamente esa comprobación por duda de confirmación.
- Severidad: **MEDIUM**. Categorías: FEEDBACK, NAVIGATION.
- Evidencia: [P04-O08](sessions/p04/SESSION.md), [P08-O07](sessions/p08/SESSION.md), [destino](sessions/p04/11-tras-enviar.png), [detalle](sessions/p08/18-respuesta-enviada.png).
- Límite: no se afirma que nunca exista un aviso transitorio; el intermediario pudo no capturarlo.

## FRICTION-011 — Revisión extensa con mensajes repetidos y vocabulario de implementación

- Persona/tarea: P01/P02/P03 y otros recorridos por Revisar.
- Observación: Revisar llegó a mostrar 10/50/300 ítems informativos sobre contenido publicado. Antes de publicar, P02 vio 10 errores + 50 advertencias y los controles individuales. Aparecen «servidor», «versiones», «metadatos» y «publicación atómica». P09 recorrió 11 botones con nombre «Ir a corregir» antes de Publicar.
- Impacto: lectura/recorrido repetidos para distinguir trabajo pendiente de información; no se midió comprensión humana ni tiempo de lectura total.
- Frecuencia: tres tamaños con repetición documentada; una ruta de teclado con 13 Tab al botón de publicación.
- Severidad: **MEDIUM**. Categorías: SCALE, COGNITIVE LOAD, LANGUAGE, ACCESSIBILITY.
- Evidencia: [P02-O05/O10](sessions/p02/SESSION.md), [P03-O06](sessions/p03/SESSION.md), [P09-O06](sessions/p09/SESSION.md), [50 publicadas](sessions/p02/07-revision-sin-borradores.png).

## FRICTION-012 — Identificadores y títulos requieren elaboración adicional al redactar

- Persona/tarea: P01, crear proyecto y diez preguntas sencillas.
- Observación: creación de proyecto vacía en Identificador externo produjo un envío inválido y validación nativa. Para diez preguntas se completaron treinta textos: enunciado, título e identificador.
- Impacto: corrección de un intento y trabajo administrativo adicional; los datos se guardaron correctamente.
- Frecuencia: 1/1 creación manual de diez preguntas; no se midió velocidad humana de escritura.
- Severidad: **MEDIUM**. Categorías: COGNITIVE LOAD, REPETITION, LANGUAGE.
- Evidencia: [P01-O02/O03](sessions/p01/SESSION.md), [validación](sessions/p01/03-crear-sin-identificador.png).
- Límite: son campos exigidos por el contrato actual; la observación no autoriza suprimirlos ni generarlos silenciosamente.

## FRICTION-013 — Regreso a revisión sin el filtro de proyecto

- Persona/tarea: P06, cambiar entre respuestas del mismo proyecto.
- Observación: abrió detalle desde `/review?projectId=…`; ← Revisión regresó a `/review` con Proyecto=Todos. Sucedió en los regresos durante aclaración/conflicto/verificación.
- Impacto: perdió un contexto explícito; un solo proyecto disponible evitó una búsqueda costosa.
- Frecuencia: 1 sesión revisora, tres regresos observados.
- Severidad: **LOW** con este dataset. Categorías: NAVIGATION, CONSISTENCY.
- Evidencia: [P06-O03](sessions/p06/SESSION.md). Riesgo a varios proyectos no ensayado.

## FRICTION-014 — Selección repetida de las mismas fuentes en decisiones distintas

- Persona/tarea: P06, marcar conflicto, resolver y registrar decisión.
- Observación: seleccionó las dos respuestas tres veces; en la decisión añadió también la resolución. Redactó motivo, resolución y decisión/alcance en pasos diferentes.
- Impacto: repetición confirmada sin error. Son actos distintos y la sesión no prueba que toda esa repetición sea innecesaria.
- Frecuencia: 1 conflicto/decisión, tres selecciones del mismo par de fuentes.
- Severidad: **LOW**. Categorías: REPETITION, COGNITIVE LOAD.
- Evidencia: [P06-O08](sessions/p06/SESSION.md), [resolución](sessions/p06/07-resolution-draft.png), [decisión](sessions/p06/08-decision-draft.png).

## FRICTION-015 — Selector de archivo con señales visuales distintas

- Persona/tarea: P08, adjuntar evidencia en móvil.
- Observación: el control nativo mostraba «No file chosen» mientras otro texto mostraba nombre pendiente/adjunto. El aviso español y el archivo visible permitieron completar sin error.
- Impacto: posible duda recuperable sobre si se seleccionó; no se perdió archivo.
- Frecuencia: 1/1 tarea con archivo en móvil, en Chromium de laboratorio.
- Severidad: **LOW**. Categorías: FEEDBACK, CONSISTENCY, LANGUAGE.
- Evidencia: [P08-O04](sessions/p08/SESSION.md), [archivo](sessions/p08/07-adjunto-guardado.png).
- Límite: idioma/apariencia del control nativo dependen del navegador. No se generaliza a móviles físicos.

## FRICTION-016 — Resumen de proyecto vacío pese a existir borradores

- Persona/tarea: P02, identificar trabajo pendiente al entrar.
- Observación: Resumen mostró 0 preguntas/Sin preguntas y aclaró «publicadas»; Editor contenía 50 borradores. Entró al editor para encontrar el trabajo.
- Impacto: desvío de descubrimiento, sin conteo funcional incorrecto demostrado.
- Frecuencia: 1 entrada por resumen con borradores.
- Severidad: **LOW**. Categorías: DISCOVERABILITY, FEEDBACK, LANGUAGE.
- Evidencia: [P02-O01](sessions/p02/SESSION.md), [resumen](sessions/p02/01-resumen-cero.png).

## FRICTION-017 — Orden de revisión que no sigue la agrupación editorial

- Persona/tarea: P01, preparar preguntas de dos temas.
- Observación: Escribir agrupó cinco por tema; Revisar intercaló preguntas de los dos temas y cambió el orden en observaciones después de guardar. Se identificaron por texto.
- Impacto: necesidad de releer inferida; no hubo asignación equivocada observada.
- Frecuencia: una sesión, varios guardados.
- Severidad: **LOW**. Categorías: CONSISTENCY, COGNITIVE LOAD.
- Evidencia: [P01-O07](sessions/p01/SESSION.md), [transcript](sessions/p01/transcript.jsonl).

## FRICTION-018 — Mensaje de fallo y borrador conservado tras envío incompleto

- Persona/tarea: ensayo técnico posterior a P04, enviar matriz vacía para observar errores.
- Observación: la UI mostró «No se pudo guardar» y respuesta incompleta. Al volver pasó de 9 pendientes/0 borradores/1 enviada a 8 pendientes/1 borrador/1 enviada. Se conservó un borrador vacío; no hubo envío.
- Impacto: el mensaje no permite deducir con precisión qué se conservó. El estado final se confirmó en la lista.
- Frecuencia: 1 ensayo técnico; no una nueva persona ni prueba de pérdida de datos.
- Severidad: **MEDIUM**. Categorías: FEEDBACK, ERROR RECOVERY, CONSISTENCY.
- Evidencia: [desviación de ejecución](ACCESSIBILITY.md), [estado posterior](accessibility/13-mi-trabajo-after-validation.png).
- Límite: la conservación puede ser deliberada. No se investigó el código ni se borró el borrador. El resultado original de P04 permanece fechado antes de este ensayo.

## FRICTION-019 — Resumen de errores con tres enlaces de igual nombre

- Persona/tarea: ensayo técnico de Crear pregunta sin campos obligatorios.
- Observación: tres enlaces anuncian «Please fill out this field.» sin nombrar cuál campo; los campos sí tienen aria-invalid y descripción propia; el foco va a Pregunta.
- Impacto: el resumen no distingue destinos por su nombre accesible. No se probó su activación ni anuncio por lector real.
- Frecuencia: 1 formulario vacío, tres enlaces.
- Severidad: **MEDIUM**. Categorías: ACCESSIBILITY, ERROR RECOVERY, LANGUAGE.
- Evidencia: [A11Y-02](ACCESSIBILITY.md), [errores](accessibility/03-crear-error.png).
- Límite: inglés corresponde al navegador en-US. No se afirma falta total de asociación de errores.

## FRICTION-020 — Nombre de grupo no expuesto en selección

- Persona/tarea: ensayo técnico de Organizar.
- Observación: aria-label «Alcance de selección» está en div genérico sin rol; el snapshot no expone el grupo. Sus dos botones sí tienen nombres distinguibles. Axe deja ese nodo en incomplete, no violations.
- Impacto: semántica de agrupación no confirmada; no se observó pérdida de accesibilidad de los botones.
- Frecuencia: 1 contenedor en una pantalla.
- Severidad: **LOW**. Categorías: ACCESSIBILITY, CONSISTENCY.
- Evidencia: [A11Y-03](ACCESSIBILITY.md), [JSON](accessibility/05-organizar-axe.json).

## Observaciones excluidas de defectos del producto

- Retrasos del canal, permisos sandbox, rechazos automáticos de herramientas, localizadores erróneos, snapshots durante transición/login: instrumentación, no usabilidad de Acta.
- Opciones Correo/Teléfono/Portal bajo «qué información se pide» (P05): inconsistencia del fixture ficticio, no del editor ni tipo de respuesta.
- Postura A ligada a Participante B demo (P06): letras de comparación distintas del nombre arbitrario del fixture. No se demostró inversión de datos ni clasificación incorrecta.
- PDF con solo un título: contenido deliberadamente mínimo del escenario, no fallo de descarga.
- Mover «Próxima revisión» al segundo tema (P07): ya estaba allí. No se cuenta movimiento ni éxito de descubrimiento.
- Truncamiento de árboles accesibles extensos: no demuestra por sí solo overflow ni rendimiento deficiente del producto.

Este registro conserva observaciones. Las hipótesis causales se encuentran en el estudio; cualquier propuesta se separa en su propio documento una vez cerrada la investigación.
