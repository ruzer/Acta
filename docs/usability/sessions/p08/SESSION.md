# P08 — Participante desde móvil de 390 px

Sesión independiente simulada por agente; observación e interacción exclusiva mediante navegador. Viewport conservado en 390 × 1000. Inicio en http://localhost:4441. Proyecto encontrado en pantalla: «Solicitudes de ejemplo — Móvil». Sin lectura de código, tests, bases de datos, API ni informes ajenos. Sin implementación ni propuestas de solución.

## Resultado de las tareas

| Subtarea | Estado | Evidencia |
|---|---|---|
| Entender pendientes y localizar trabajo | COMPLETE | Inicio: 10 pendientes, 0 borradores, 0 enviadas; dos temas de 5 preguntas. `02-inicio-final.png` |
| Contestar pregunta sencilla | COMPLETE | Canal de entrada: texto ficticio sobre correo y ventanilla. `09-retomar.png`, `18-respuesta-enviada.png` |
| Adjuntar archivo ficticio | COMPLETE | Selector observado «Seleccionar evidencia» → guia-ficticia.pdf → «Adjuntar al borrador». Archivo confirmado en borrador y luego en respuesta enviada. `07-adjunto-guardado.png`, `18-respuesta-enviada.png` |
| Guardar y salir | COMPLETE | Regreso a Mi trabajo con 9 pendientes y 1 borrador. `08-borrador-en-lista.png` |
| Regresar y retomar | COMPLETE | «Continuar: Canal de entrada» recuperó texto, estado Borrador guardado y Adjuntar evidencia (1). `09-retomar.png` |
| Enviar pregunta sencilla | COMPLETE | Acción condujo a pregunta 2; regreso a lista confirmó 1 enviada; vista posterior mostró texto, archivo y En revisión. `10-envio-canal.png`, `11-lista-enviada.png`, `18-respuesta-enviada.png` |
| Contestar avisos en distintos momentos | COMPLETE | Recepción Sí; revisión A veces; cierre Sí; comentario ficticio. Envío confirmado en lista y lectura posterior. `14-avisos-formulario.png`, `15-avisos-scroll-acciones.png`, `17-lista-dos-enviadas.png`, `20-avisos-enviados.png` |
| Cerrar navegador | COMPLETE | browser.close() completado a 2026-10-06T04:57:23Z |

Estado final visible: 8 pendientes, 0 borradores, 0 requieren atención, 2 enviadas. Las dos respuestas enviadas muestran En revisión. No se intentó completar las 8 restantes.

## Recorrido y observaciones

- **P08-O01 — Orientación inicial clara.** La primera pantalla muestra el resumen numérico, el nombre del proyecto, los temas y la pregunta completa junto a su estado y acción Responder. Fue posible elegir la pregunta sencilla directamente, sin entrar antes en otra pantalla del proyecto. El aviso inicial explica expresamente el uso de Guardar y salir. Evidencia: `02-inicio-final.png`.
- **P08-O02 — Formulario sencillo utilizable a 390 px.** La pregunta, el contexto ficticio, Tu respuesta, comentario opcional y acciones aparecen en una sola columna. Guardar y salir y Enviar respuesta tienen ancho amplio y separación vertical. Antes de expandir evidencia, el formulario sencillo completo cabe en los 1000 px de alto. No se observaron etiquetas cortadas en esa pantalla. Evidencia: `04-canal-estable.png`. La operación fue mediante automatización de navegador; no demuestra precisión de toque humano ni experiencia del teclado virtual.
- **P08-O03 — Evidencia exige selección y confirmación separadas, explicadas en pantalla.** Después del selector apareció «guia-ficticia.pdf · pendiente de adjuntar», el botón Adjuntar al borrador y el aviso de que era necesario adjuntar o cancelar antes de continuar. Guardar y enviar estaban deshabilitados. El texto aclara que adjuntar confirma cambios del borrador pero no envía. La operación se completó sin error. Evidencia: captura `06-adjunto-pendiente.png` y árbol accesible de 04:50:53Z; éxito en `07-adjunto-guardado.png`.
- **P08-O04 — Mensajes mixtos del selector.** El control nativo visual muestra «Choose File / No file chosen» aunque el texto español separado ya dice que guia-ficticia.pdf está pendiente de adjuntar. Una vez adjunto sigue mostrando ese texto nativo, mientras el archivo sí aparece arriba con Descargar y Retirar. Posible duda sobre si la selección ocurrió; en esta sesión el nombre y el estado español permitieron avanzar. Evidencia: `06-adjunto-pendiente.png`, `07-adjunto-guardado.png`. Puede depender del idioma del navegador de laboratorio; no se atribuye a todos los móviles.
- **P08-O05 — Expansión del adjunto alarga la tarea y desplaza contexto.** Se hizo scroll real de 480 px para trabajar con la selección. En la vista estable del archivo adjuntado, ya no se ve la pregunta ni el título superior: se ven la parte baja de la respuesta, el archivo y las acciones. Guardar y enviar permanecen accesibles al final del contenido; no hubo bloqueo. Evidencia: `07-adjunto-guardado.png`. Una captura tomada inmediatamente durante el scroll (`06`) presenta una franja superior sin contenido; no se interpreta como fallo de producto porque la captura estable posterior no la reproduce.
- **P08-O06 — Borrador recuperable con confirmación verificable.** Guardar y salir volvió a la lista, cambió la tarjeta a Borrador/Continuar y el contador a 1 borrador. Al abrirla de nuevo, el texto coincidía y «Adjuntar evidencia (1)» preservaba la referencia al archivo; aparece fecha de guardado. No fue necesario volver a escribir ni adjuntar. Evidencia: `08-borrador-en-lista.png`, `09-retomar.png`.
- **P08-O07 — El envío avanza directamente y la confirmación se comprobó con retroceso.** Tras cada Enviar respuesta apareció la siguiente pregunta (2 y 9 respectivamente). En las capturas estables de destino no había confirmación persistente del envío anterior. La sesión volvió por Mi trabajo para comprobar estados y contadores; luego abrió Ver para verificar contenido y En revisión. Esto describe la confirmación observable, sin afirmar que nunca hubiera un aviso transitorio. Evidencia: `10-envio-canal.png`, `16-envio-avisos.png`, `17-lista-dos-enviadas.png`, `18-respuesta-enviada.png`, `20-avisos-enviados.png`.
- **P08-O08 — Localización de avisos requiere recorrer la lista.** Desde la cabecera de Mi trabajo se hicieron dos desplazamientos reales (730 y 390 px) hasta la pregunta de avisos en el segundo tema. Las preguntas siguen legibles y las acciones son anchas. En la comprobación final se descubrió y utilizó el colapso de «Recepción de solicitudes», que acercó el segundo tema. No se usó Buscar y filtrar. Evidencia: `12-lista-scroll.png`, `13-avisos-localizado.png`, `19-lista-seccion-colapsada.png`.
- **P08-O09 — Avisos se entiende como tres decisiones separadas.** La pantalla presenta «Tu respuesta por fila» y tres selectores etiquetados: recepción, resultado de revisión, cierre. Se pudo elegir Sí/A veces/Sí y añadir contexto. No apareció tabla horizontal. La pregunta 8 de 10 y el tema estaban visibles al comenzar. Evidencia: `14-avisos-formulario.png`, `15-avisos-scroll-acciones.png`.
- **P08-O10 — Acciones inferiores de avisos requieren scroll.** En la vista inicial de 1000 px el botón Enviar queda parcialmente al borde inferior y el aviso sobre inmutabilidad queda más abajo. Se hizo scroll real de 420 px para observar y accionar el bloque inferior completo. En ese punto la pregunta se ve cortada en la parte superior y la cabecera ya no está. Los tres valores, comentario y acciones sí caben juntos y se enviaron correctamente. Evidencia: `14-avisos-formulario.png`, `15-avisos-scroll-acciones.png`.
- **P08-O11 — Lectura posterior verificable y compacta.** Las respuestas enviadas distinguen Solo lectura y En revisión; la sencilla conserva botón de descarga del archivo. Avisos muestra cada etapa con su valor en líneas separadas y conserva el comentario. Evidencia: `18-respuesta-enviada.png`, `20-avisos-enviados.png`.

## Errores, recuperación y límites

- No hubo errores de formulario ni fallos de guardado, adjunto o envío en las dos tareas. No se provocaron errores de validación artificiales.
- Fallo inicial de herramienta: Chromium no pudo iniciar bajo sandbox; se abrió mediante la escalación autorizada del laboratorio. No es un problema de Acta.
- Incidente de instrumentación de login: la espera a que desapareciera el botón llamado Iniciar sesión se resolvió cuando cambió su nombre a Iniciando sesión. El snapshot prematuro aún contenía el campo de contraseña efímera del laboratorio. Se avisó al coordinador; no se reproduce aquí. Se esperó posteriormente a que el campo desapareciera para confirmar la pantalla final. Excluir `01-inicio.png` y ese fragmento de log de materiales compartidos. `03-pregunta-canal.png` también se tomó en transición y no fundamenta hallazgos.
- Las horas mostradas por la UI corresponden a la configuración del navegador del laboratorio; no se infiere defecto de zona horaria.
- Esta sesión es evidencia de tareas ejecutadas por un agente, no medición de usuarios humanos. No se midieron tasas de error humanas, ergonomía de mano, lector de pantalla, teclado virtual ni rendimiento en red móvil.

## Datos ficticios introducidos

Canal de entrada: «En el servicio ficticio recibimos solicitudes por correo electrónico y en una ventanilla de atención. La persona encargada registra cada entrada antes de asignarla.» Archivo: guia-ficticia.pdf, 0.9 KB según UI.

Avisos: recepción Sí; resultado de revisión A veces; cierre Sí. Comentario: «Ejemplo ficticio: al recibir y cerrar se envía un correo; durante la revisión se avisa solo si falta información.»

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [02-inicio-final.png](02-inicio-final.png)
- [03-pregunta-canal.png](03-pregunta-canal.png)
- [04-canal-estable.png](04-canal-estable.png)
- [05-adjunto-abierto.png](05-adjunto-abierto.png)
- [06-adjunto-pendiente.png](06-adjunto-pendiente.png)
- [07-adjunto-guardado.png](07-adjunto-guardado.png)
- [08-borrador-en-lista.png](08-borrador-en-lista.png)
- [09-retomar.png](09-retomar.png)
- [10-envio-canal.png](10-envio-canal.png)
- [11-lista-enviada.png](11-lista-enviada.png)
- [12-lista-scroll.png](12-lista-scroll.png)
- [13-avisos-localizado.png](13-avisos-localizado.png)
- [14-avisos-formulario.png](14-avisos-formulario.png)
- [15-avisos-scroll-acciones.png](15-avisos-scroll-acciones.png)
- [16-envio-avisos.png](16-envio-avisos.png)
- [17-lista-dos-enviadas.png](17-lista-dos-enviadas.png)
- [18-respuesta-enviada.png](18-respuesta-enviada.png)
- [19-lista-seccion-colapsada.png](19-lista-seccion-colapsada.png)
- [20-avisos-enviados.png](20-avisos-enviados.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
