# P04 — Participante novato: primera participación

Evaluación independiente mediante agente que simula a una persona invitada sin terminología técnica. No es una sesión humana ni un benchmark de tiempos. Proyecto: «Solicitudes de ejemplo — Primera participación». Sesión observada el 5 de octubre de 2026 (México); el transcript registra UTC del 6 de octubre. Se utilizó exclusivamente la interfaz del navegador, con cuenta demo y contenido ficticio. No se consultaron código, API, base de datos, pruebas, documentación privada ni informes de otras personas. No hubo modificaciones de archivos del producto.

## Resultado por subtarea

| Subtarea | Resultado | Evidencia |
|---|---|---|
| Entrar al proyecto | COMPLETE | Inicio de sesión; clic en el nombre del proyecto; 01-inicio.png y transcript |
| Entender qué queda pendiente | COMPLETE | Resumen 10 pendientes / 0 borradores / 0 enviadas y preguntas agrupadas por tema, 01-inicio.png |
| Responder parte | COMPLETE | Respuesta inicial y comentario que identifica información faltante, 04-respuesta-parcial.png |
| Guardar | COMPLETE | Guardar y salir; resumen pasa a 9 pendientes / 1 borrador; 05-borrador-guardado.png |
| Salir de la sesión | COMPLETE | Menú de perfil y Cerrar sesión; estado Sesión cerrada, 06-busqueda-salida.png y 07-sesion-cerrada.png |
| Regresar | COMPLETE | Nuevo inicio de sesión; mismo proyecto y borrador visible, 08-regreso.png |
| Continuar el borrador | COMPLETE | Continuar abre ambos campos guardados; luego se amplía respuesta y ejemplo, 09-borrador-retomado.png y 10-respuesta-completada.png |
| Enviar una respuesta | COMPLETE | Avance a pregunta 2, contador 1 enviada, detalle Solo lectura / En revisión con contenido final; 11-tras-enviar.png, 12-envio-confirmado.png y 13-detalle-enviada.png |
| Completar las otras nueve | NOT ATTEMPTED | Fuera del alcance necesario del recorrido. Quedan 9 pendientes, 0 borradores, 1 enviada. |

## Recorrido real

1. Inicio de sesión desde la pantalla inicial con los campos Usuario y Contraseña. La pantalla de trabajo muestra diez preguntas en dos grupos de cinco. Expectativa de la persona simulada: «Tengo diez cosas por contestar y aquí veo cuáles son».
2. Clic en el título del proyecto. El contenido se mantiene prácticamente igual. Después se usa el botón principal Continuar y se abre la pregunta 1: «¿Cómo reciben las solicitudes de servicio?».
3. Lectura de la indicación de usar un servicio ficticio, de Obligatoria para enviar y de la explicación de Guardar y salir frente a Enviar respuesta. Se escribe: «Recibimos las solicitudes por correo electrónico y en el mostrador de atención». En comentario se deja que falta confirmar quién revisa el correo ante una ausencia.
4. Clic en Guardar y salir. Se vuelve al listado y la primera pregunta ahora figura Borrador, con acción Continuar. Los contadores son 9 pendientes y 1 borrador.
5. Para salir completamente, clic sobre el nombre de perfil en la esquina superior derecha. Se despliegan Mi contraseña y Cerrar sesión. Clic en Cerrar sesión: aparece la pantalla de acceso con Sesión cerrada.
6. Nuevo inicio de sesión. Regresa al proyecto y conserva el borrador. El botón principal Continuar abre exactamente la pregunta guardada, con respuesta y comentario intactos.
7. Se completa la respuesta con revisión diaria por recepción, registro antes de turnar y suplencia durante ausencias. Se sustituye el comentario por «Descripción ficticia del servicio de ejemplo». Se despliega Agregar un ejemplo (opcional) y se escribe un caso de reparación de una lámpara solicitado por correo.
8. Clic en Enviar respuesta. Se observa Guardando… con campos y acciones deshabilitados; la siguiente observación muestra directamente la pregunta 2.
9. La persona simulada vuelve por Mi trabajo para comprobar el envío, ya que en la pantalla de la pregunta 2 no encuentra confirmación persistente de la respuesta anterior. El resumen muestra 1 enviada y la pregunta 1 dice Enviada / Ver.
10. Clic en Ver de la primera pregunta. El detalle muestra el texto final, comentario, ejemplo, Solo lectura, fecha de envío y Estado actual: En revisión. Se termina el recorrido sin responder la pregunta 2.

## Observaciones

- **P04-O01 — Orientación inicial positiva.** El resumen numérico, los estados de cada pregunta y los dos temas permiten reconocer el trabajo pendiente sin conocer términos técnicos. La primera respuesta se encuentra mediante Continuar; no fue necesario usar búsqueda ni ayuda externa. Evidencia: 01-inicio.png, 03-editor.png.
- **P04-O02 — El nombre de proyecto parece prometer una entrada distinta, pero conduce a contenido casi idéntico.** Se pulsó el título antes de Continuar y no se obtuvo una diferencia sustancial en la lista. Fue un paso adicional, sin bloqueo ni necesidad de recuperación. La diferencia posterior de encabezado se vuelve visible al cargar la ruta de trabajo. Evidencia: transcript de 04:36:13 UTC y 01-inicio.png.
- **P04-O03 — Guardar y enviar se distinguen en lenguaje comprensible.** El texto explica que el borrador es privado y que lo enviado no se puede modificar. Esto permitió elegir guardar la respuesta incompleta sin enviarla prematuramente. Evidencia: 03-editor.png, 04-respuesta-parcial.png.
- **P04-O04 — El cambio a borrador confirma conservación; el conteo exige sumar categorías.** Al guardar, Pendientes baja de 10 a 9 aunque todavía no se ha enviado ninguna respuesta; aparece 1 en Borradores. Interpretación de la persona simulada: quedan nueve sin iniciar y una iniciada, diez por entregar. No impidió continuar, pero Pendientes aislado no representa todo lo aún no enviado. Evidencia: 05-borrador-guardado.png, 08-regreso.png.
- **P04-O05 — La salida se descubre en el perfil.** Cerrar sesión no está visible en la vista inicial; aparece al pulsar el nombre. Se encontró en el primer intento usando la convención de cuenta personal. La acción devolvió una confirmación explícita de sesión cerrada. Evidencia: 06-busqueda-salida.png, 07-sesion-cerrada.png.
- **P04-O06 — Reanudar conserva contexto y datos.** Después de cerrar sesión y volver a entrar, el botón Continuar lleva al borrador de la primera pregunta; se conservan tanto respuesta como comentario y se muestra Borrador guardado con fecha. No se requirió volver a escribir lo anterior ni buscar la pregunta. Evidencia: 08-regreso.png y 09-borrador-retomado.png.
- **P04-O07 — Modificar el borrador da retroalimentación clara.** El estado cambia a Cambios sin guardar al ampliar el contenido. El ejemplo opcional se descubre y abre por su propia etiqueta. No aparecieron términos técnicos en los controles que bloquearan esta tarea. Evidencia: transcript de 04:38:03 UTC, 10-respuesta-completada.png.
- **P04-O08 — Confirmación de envío recuperada mediante un retroceso.** Tras enviar se avanza a la pregunta 2. En esa observación no aparece un mensaje persistente de éxito de la pregunta 1; se usa Mi trabajo y después Ver para comprobar que quedó enviada. No se pulsó Enviar respuesta de nuevo ni se duplicó contenido. Es una duda observada en esta simulación, no una afirmación de que nunca exista un aviso transitorio. Evidencia: 11-tras-enviar.png, 12-envio-confirmado.png, 13-detalle-enviada.png.
- **P04-O09 — El detalle enviado confirma contenido y estado.** Solo lectura, el contenido completo, la fecha y En revisión permiten diferenciar el envío de una aprobación final. La tarea pedía enviar, por lo que no se intentó ni se afirmó aprobación. Evidencia: 13-detalle-enviada.png.
- **P04-O10 — Aviso de guardado reaparece al volver a iniciar sesión.** La observación inmediatamente posterior al segundo inicio de sesión incluye «Borrador guardado. Puedes retomarlo después», aunque la acción de guardado se hizo antes de cerrar sesión. Es consistente con que el borrador existe, pero no distingue en ese momento entre un guardado nuevo y uno anterior. Evidencia: 08-regreso.png y transcript de 04:37:29 UTC.

## Errores, recuperaciones y límites

- No hubo errores de validación, pérdida de datos, bloqueo de interfaz, clics fallidos ni envío repetido en este recorrido.
- Hubo un retroceso deliberado desde la segunda pregunta a Mi trabajo para comprobar el envío. Se reabrió la primera pregunta en modo de lectura. No hubo navegación atrás del navegador ni rutas profundas introducidas manualmente.
- El primer lanzamiento del navegador falló por permisos del sandbox. Se recuperó con el inicio autorizado fuera del sandbox. Es un fallo de herramienta, anterior al recorrido de interfaz.
- Algunas instantáneas tomadas inmediatamente tras un clic reflejaron la pantalla anterior o un estado transitorio. Se observó otra vez antes de actuar; no se registró eso como fallo de interfaz ni se midió como demora humana.
- Una instantánea técnica durante el primer inicio de sesión incluyó el valor de un campo de acceso; no se reproduce en el informe ni en las capturas. La coordinación confirmó que la redacción del transcript persistido estaba activa. Esto se trata como incidencia de herramienta, no de usabilidad.
- No se probaron adjuntos, consultas, filtros ni nueve respuestas adicionales. No se derivan conclusiones sobre esos recorridos.

## Evidencia

Capturas PNG en esta misma carpeta: 01-inicio, 02-pregunta-inicial (estado transitorio), 03-editor, 04-respuesta-parcial, 05-borrador-guardado, 06-busqueda-salida, 07-sesion-cerrada, 08-regreso, 09-borrador-retomado, 10-respuesta-completada, 11-tras-enviar, 12-envio-confirmado y 13-detalle-enviada. Los transcript automáticos de la sesión contienen acciones e instantáneas accesibles. El resultado final observado es 9 pendientes, 0 borradores y 1 enviada, con la respuesta enviada En revisión.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-inicio.png](01-inicio.png)
- [02-pregunta-inicial.png](02-pregunta-inicial.png)
- [03-editor.png](03-editor.png)
- [04-respuesta-parcial.png](04-respuesta-parcial.png)
- [05-borrador-guardado.png](05-borrador-guardado.png)
- [06-busqueda-salida.png](06-busqueda-salida.png)
- [07-sesion-cerrada.png](07-sesion-cerrada.png)
- [08-regreso.png](08-regreso.png)
- [09-borrador-retomado.png](09-borrador-retomado.png)
- [10-respuesta-completada.png](10-respuesta-completada.png)
- [11-tras-enviar.png](11-tras-enviar.png)
- [12-envio-confirmado.png](12-envio-confirmado.png)
- [13-detalle-enviada.png](13-detalle-enviada.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
