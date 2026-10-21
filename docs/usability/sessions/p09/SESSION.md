# P09 — Uso exclusivo de teclado

Simulación realizada por un agente, no sesión con un sujeto humano. Fecha local: 5 de octubre de 2026, aproximadamente 22:49–22:59 (America/Mexico_City). Proyecto observado: «Preparación del servicio — Teclado». Cuenta: Persona 9 de prueba, rol Analista. Sitio: http://localhost:4441. Navegador independiente cerrado al terminar.

## Alcance y resultado

| Subtarea | Estado | Evidencia y límite |
|---|---|---|
| Precisar el enunciado de una pregunta | COMPLETE | «Canal de entrada» quedó con «¿Por qué canales reciben las solicitudes de servicio (presencial, teléfono, correo electrónico u otro)?». Se observó el mensaje de guardado y luego el texto publicado. |
| Preparar las primeras tres para Participante A demo | COMPLETE | Canal de entrada, Registro de entrada y Medio de contacto: asignación activa y requerida a Participante A demo; las tres se publicaron mediante Confirmar publicación y quedaron etiquetadas Publicada. |
| Comprobar que quedan disponibles | PARTIAL | «Ver preguntas publicadas» muestra Recepción de solicitudes 3 preguntas y las tres tarjetas correctas. Es evidencia con rol Analista; no se comprobó la pantalla real de Participante A ni se respondió con esa identidad. |

Toda interacción con el producto se hizo mediante `page.keyboard.press` o `page.keyboard.type`. Lecturas del árbol accesible y de `document.activeElement` no modificaron la página. Sin clic, fill, selectOption, foco programático, API, SQL, código del producto, tests, otras sesiones ni esperas artificiales. No hubo cambios de producto. Los únicos cambios de datos fueron el enunciado, tres asignaciones y tres publicaciones del proyecto de prueba.

## Recorrido y observaciones

### P09-O01 — Acceso y controles principales alcanzables

Desde login: Tab → Usuario; escribir usuario; Tab → contraseña; escribir contraseña; Tab → Iniciar sesión; Enter. La siguiente pantalla mostró Mis proyectos. El recorrido de ocho Tab alcanzó, en orden: Ir al contenido, Acta, Mis proyectos, Mi contraseña, Cerrar sesión, Resumen del proyecto, Revisar respuestas, Editar cuestionario. Enter abrió el editor. Resultado esperado y observado: navegación y acceso sin ratón.

En el editor, Tab recorrió enlaces y Vista previa, luego el tab Escribir y el panel, acciones de tema y acciones de cada pregunta. Los SUMMARY tienen nombres accesibles específicos («Acciones de Canal de entrada», etc.), aunque el árbol los presenta como grupos «⋯ Acciones». Esto permitió distinguir el objetivo por foco actual. Evidencia: llamadas 04:51:23Z–04:52:16Z en transcript.jsonl y salida de herramientas de la sesión.

### P09-O02 — Edición con foco útil y confirmación clara

Se exploraron 13 posiciones y se retrocedió seis Shift+Tab hasta acciones de la primera pregunta. Enter desplegó las acciones; dos Tab saltaron el botón deshabilitado Mover arriba y llegaron a Editar pregunta. Enter abrió el diálogo con foco en el textarea Pregunta. Meta+A y escritura reemplazaron el texto.

Ocho Tab desde Pregunta alcanzaron Guardar cambios, pasando por ayuda desplegable, textarea de ayuda, radio seleccionado, obligatoriedad, identificador, título y configuración avanzada. Enter guardó. Mensaje observado: «Pregunta guardada. Su contenido sigue en preparación hasta que la publiques». El foco volvió a SUMMARY «Acciones de Canal de entrada». El borde de foco en Configuración avanzada se ve claramente en 01-editar-teclado.png. Resultado esperado y observado: edición y guardado completos, diferenciando guardar de publicar.

### P09-O03 — Selección de participante: error y recuperación

Primera asignación: Enter en acciones, cinco Tab hasta Asignar participantes, Enter. El diálogo abrió con foco en Cerrar; Tab llegó al SELECT. ArrowDown dejó «Selecciona un participante». Tres Tab y Enter en Guardar asignación no guardaron: el foco volvió al SELECT obligatorio. La lectura de validación nativa devolvió `Please select an item in the list.`; no apareció un error equivalente en el árbol accesible de la aplicación.

Segundo intento: Space, ArrowDown, Enter tampoco cambió la opción observada; se repitió el intento de guardar. Después KeyP seleccionó Participante A demo. Enter desde el SELECT inició aparentemente el envío del formulario: en la siguiente interacción, los tres Tab y Enter que yo esperaba dirigir a Guardar asignación acabaron en Mis proyectos. La asignación sí quedó guardada: al reabrir su diálogo figuró «Participante A demo · Equipo de operaciones (asignado)». No atribuyo sin más la conducta de flechas a un defecto del producto: fue Chromium headless en macOS y un SELECT nativo.

En las otras dos asignaciones usé Tab → KeyP → tres Tab → Guardar asignación → Enter, confirmando antes el nombre seleccionado y el botón con foco; funcionaron. Mensaje observado en ambas: «Asignación guardada». Evidencia: 04:53:47Z–04:56:55Z, 04:57:57Z–04:58:31Z y 02-asignacion-seleccion.png.

### P09-O04 — El foco no vuelve al origen al cerrar o completar diálogos de asignación/publicación

Esperaba retomar las acciones de la pregunta, como ocurrió al guardar edición. Al pulsar Escape en Publicar pregunta, el elemento activo quedó BODY. Shift+Tab llevó a + Agregar tema; al asumir que había vuelto a la pregunta abrí Nuevo tema por error. No escribí ni creé tema: recorrí sus controles y lo cerré con Enter en Cerrar. Al cerrarlo también quedó BODY. La recuperación requirió 13 Tab hasta acciones de Canal de entrada.

El patrón volvió a observarse al cerrar Asignar participante con Escape y después de guardar la asignación de Registro de entrada y publicar Canal de entrada. Tras guardar asignaciones/publicar, recuperar la pregunta siguiente exigió recorridos de 14–15 Tab, incluyendo navegación global; el primer Tab aún reportaba BODY antes de alcanzar Ir al contenido. No hubo bloqueo total, pero sí pérdida de posición y navegación accidental. Evidencia: foco observado 04:56:03Z/04:56:18Z/04:57:45Z/04:58:10Z y secuencias registradas en transcript.jsonl.

### P09-O05 — Los controles de pestañas funcionan con flechas y aportan requisitos útiles

Desde Escribir, ArrowRight dos veces seleccionó Revisar y mostró su panel. Allí se entendió que Registro de entrada y Medio de contacto eran seguimientos y requerían publicar primero Canal de entrada. Las dos acciones de publicación estaban deshabilitadas con explicación «Publica primero la pregunta principal». También mostraba advertencias por falta de participantes y decía que publicar sin asignación no permite responder todavía.

Esto confirmó una distinción necesaria para la tarea. Más tarde ArrowLeft dos veces volvió a Escribir. No se requirió Enter para cambiar de pestaña. Evidencia: árbol accesible 04:57:07Z.

### P09-O06 — Coste de recorrido y repetición de nombres en Revisar

Desde el tab Revisar, hicieron falta 13 Tab para llegar a «Publicar: Canal de entrada»: el panel, once botones «Ir a corregir» y Publicar. Los botones de corrección comparten nombre accesible; su artículo circundante aporta la pregunta. Los botones Publicar sí tienen nombre accesible que incluye el título. No activé una corrección equivocada en esta parte. No se infiere comportamiento de las correcciones, porque no se usaron.

### P09-O07 — Publicación confirmada y mensajes observables

Canal de entrada se publicó desde Revisar. Registro de entrada y Medio de contacto se publicaron desde sus menús de acciones (Enter, cinco Tab a Publicar, Enter). Cada diálogo abrió con foco en Cerrar; Tab llegó a Confirmar publicación; Enter completó. Se observó el mensaje «Pregunta publicada. Su contenido quedó protegido». La captura 03-tres-publicadas-editor.png y el árbol final muestran las primeras tres Publicada y las restantes siete Borrador. La confirmación separada evitó ejecutar por accidente la publicación cuando abrí inicialmente el diálogo de Registro de entrada antes de asignarla; Escape lo cerró.

### P09-O08 — Disponibilidad visible, con límite por rol

Después de la tercera publicación, ocho Tab alcanzaron Ver preguntas publicadas y Enter abrió la vista pública del proyecto para Analista. Aparecieron «Recepción de solicitudes 3 preguntas», Pregunta 1 de 3 Canal de entrada con el nuevo enunciado, Pregunta 2 de 3 Registro de entrada y Pregunta 3 de 3 Medio de contacto. Evaluación del servicio mostró cero preguntas. La página es de consulta para Analista y ofrece Consultar decisión y fuentes; no permite demostrar la experiencia de respuesta de Participante A. Evidencia: 04-preguntas-disponibles.png y árbol 04:59:07Z.

## Incidencias de instrumentación, separadas del producto

- El primer lanzamiento de Chromium dentro del sandbox falló por `bootstrap_check_in ... Permission denied (1100)`. Se reinició con la vía de aprobación prevista y funcionó. No es un fallo de Acta.
- `snap()` devuelve un objeto y no lo imprime por sí mismo; la primera lectura sin console.log no produjo árbol. Las siguientes sí lo imprimieron. No afectó datos del producto.
- Los bucles de Tab fueron secuencias reales de teclado, con lectura del foco tras cada paso; no se seleccionó ni enfocó ningún elemento mediante API. Algunos errores fueron consecuencia de anticipar el retorno de foco y no se presentan como acciones deliberadas de la interfaz.
- SELECT nativo: resultado de ArrowDown/Space limitado al navegador de esta simulación; se recuperó mediante KeyP. No se hizo prueba en otro navegador ni con tecnología asistiva real.

## Evidencias y cierre

- `transcript.jsonl`: secuencias ejecutadas y tiempos; las salidas de los árboles/foco están además en el registro de herramientas de esta sesión.
- `browser-events.jsonl`: eventos del navegador de la instrumentación.
- `01-editar-teclado.png`: edición, cambio pendiente y foco visible.
- `02-asignacion-seleccion.png`: selección de participante en el primer recorrido.
- `03-tres-publicadas-editor.png`: tres primeras Publicada.
- `04-preguntas-disponibles.png`: tres preguntas en vista de consulta.

Navegador cerrado con `browser.close()` a las 04:59:25Z. Sin propuestas de solución; este documento registra únicamente recorrido, resultados, dificultades y límites observados.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-editar-teclado.png](01-editar-teclado.png)
- [02-asignacion-seleccion.png](02-asignacion-seleccion.png)
- [03-tres-publicadas-editor.png](03-tres-publicadas-editor.png)
- [04-preguntas-disponibles.png](04-preguntas-disponibles.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
