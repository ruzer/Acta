# P07 — administrador ocasional

Sesión independiente de uso por navegador. Persona simulada: usó una vez la aplicación hace dos meses y vuelve sin recordar la interfaz. Esto no mide memoria humana longitudinal. No se consultaron código, pruebas, documentación privada ni informes de otras personas. No se modificó el producto. Se editaron datos ficticios mediante sus controles visibles.

Fecha: 2026-10-05, aproximadamente 22:40–22:48 America/Mexico_City. Los tiempos incluyen demoras de herramientas y no son una medida humana de tiempo de tarea.

Proyecto observado: «Procedimiento de ejemplo existente», /projects/3bff5a30-d9ea-4a1a-bce6-c430df886c49.

## Resultado de subtareas

| Subtarea | Estado | Evidencia |
|---|---|---|
| Cambiar el primer tema a «Recepción y registro» | COMPLETE | Guardado explícito «Tema guardado» y nombre persistente en vista publicada, 11-lista-final.png. |
| Precisar canal de entrada indicando canal principal | COMPLETE | Pregunta guardada: «¿Cómo reciben las solicitudes de servicio? Indique el canal principal de entrada.» Visible después de navegar fuera del editor, 11-lista-final.png. |
| Mover «Próxima revisión» al segundo tema | NOT ATTEMPTED | La condición ya estaba satisfecha al entrar: estaba en «Evaluación del servicio», segundo tema. No se fabricó un movimiento. Se confirmó la posición al terminar, 12-segundo-tema.png. |
| Preparar el cuestionario para Participante A demo | COMPLETE | Miembro activo confirmado; diez asignaciones activas/requeridas guardadas individualmente; diez publicaciones confirmadas; revisión final sin borradores ni advertencias de falta de asignaciones. |
| Comprobar respuesta real desde la cuenta del participante | NOT ATTEMPTED | La sesión fue de administrador. No se afirma que el participante haya iniciado sesión ni respondido. |

## Camino ejecutado

1. Inicio de sesión → Mis proyectos → «Editar cuestionario» en la tarjeta del proyecto.
2. Escribir → menú ⋯ del primer tema → Editar tema → Nombre → Guardar tema.
3. Menú de «Canal de entrada» → Editar pregunta → campo Pregunta → Guardar cambios.
4. Revisar: dos errores por preguntas dependientes de una principal no publicada y diez advertencias de falta de participantes.
5. Administrar miembros: Participante A demo ya estaba activo como Área participante, Equipo de operaciones. No se alteró la membresía.
6. ← Cuestionario: regresó al modo Escribir. Menú de Canal de entrada → Asignar participantes → Participante A demo → Guardar asignación.
7. Se repitió la asignación para las nueve preguntas restantes. En cada diálogo se observó su título, selector y casillas; en cada guardado se obtuvo «Asignación guardada».
8. Revisar: las diez advertencias desaparecieron. Publicar Canal de entrada → Confirmar publicación. Desaparecieron los dos errores de dependencia.
9. Se publicaron individualmente las otras nueve preguntas, observando cada diálogo y confirmando cada publicación. Diez mensajes de éxito en total.
10. Revisar mostró «Información · no bloquea (10)» y «No hay preguntas en borrador».
11. Ver preguntas publicadas → primer tema y luego segundo tema. Se verificaron nombre y texto editados y la ubicación de Próxima revisión. Se cerró el navegador.

## Observaciones

- **P07-O01 — Entrada reconocible, positiva.** «Editar cuestionario» estaba directamente en la tarjeta del proyecto. No fue necesario explorar Administración. La frase del editor «Prepara las preguntas, asigna participantes y publica cuando el contenido esté listo» recuperó el orden general de trabajo. Evidencia: snapshot 04:41:53Z; 03-editor-listo.png.
- **P07-O02 — Acciones detrás de ⋯.** Renombrar el tema requirió abrir su menú. A simple vista se veía el nombre del tema y el botón de tres puntos; la etiqueta «Editar tema» apareció después. Tras descubrirlo, fue natural buscar la edición de pregunta en el mismo patrón. Evidencia: 03-editor-listo.png y snapshots 04:42:56Z/04:43:08Z.
- **P07-O03 — Confirmaciones explícitas, positivas.** Guardar tema produjo «Tema guardado». Guardar pregunta produjo «Pregunta guardada. Su contenido sigue en preparación hasta que la publiques». El segundo mensaje evitó confundir edición guardada con disponibilidad para responder. Evidencia: snapshots 04:44:00Z y 04:45:18Z.
- **P07-O04 — Estado de partida incompatible con una operación pedida.** Próxima revisión ya pertenecía al segundo tema en la primera inspección. La tarea no permitió evaluar descubrimiento ni ejecución de mover una pregunta; sí se vio la opción «Mover a otro tema» en el menú de Canal de entrada. Evidencia: primer snapshot de editor 04:42:18Z; snapshot menú 04:44:43Z; 12-segundo-tema.png.
- **P07-O05 — Revisar guía la preparación.** Al intentar entender cómo dejar listo el cuestionario, Revisar distinguió errores y advertencias y explicó «Sin participantes asignados: nadie podrá responder todavía. Esto no impide publicar». Los dos errores pedían publicar primero la pregunta principal. La publicación de la principal los resolvió sin editar preguntas dependientes. Evidencia: 06-revisar.png y snapshots 04:46:51Z/04:47:07Z.
- **P07-O06 — Miembro y asignación son pasos distintos.** Se consultó Administrar miembros por duda acerca del acceso de A. Su membresía ya existía, aunque Revisar había señalado cero asignaciones. Hubo una ida y vuelta adicional y al regresar el editor abrió Escribir en vez de conservar Revisar. Evidencia: 07-miembros.png, 08-asignar.png.
- **P07-O07 — Trabajo repetido por pregunta.** Preparar diez preguntas para una misma persona requirió diez ciclos de menú, asignación, selección de persona y guardado; después diez ciclos de publicar y confirmar. Una vez aprendido el diálogo, el patrón fue repetible dentro de la sesión. No se observó una acción colectiva en las vistas utilizadas. Esto no prueba que sea inexistente en toda la aplicación. Evidencia: 08-asignar.png, 09-confirmar-publicacion.png y registro de diez confirmaciones de cada operación.
- **P07-O08 — Persistencia de asignación poco visible en Escribir.** Tras guardar, se veía «Asignación guardada», pero las tarjetas seguían mostrando tipo y Borrador, sin nombre del participante en la vista observada. Para confirmar cobertura global se volvió a Revisar y se comprobó que las diez advertencias desaparecieron. Evidencia: snapshot 04:46:04Z y 04:46:51Z.
- **P07-O09 — Publicación final verificable.** El mensaje «Pregunta publicada. Su contenido quedó protegido», diez ítems informativos y «No hay preguntas en borrador» dieron una comprobación acumulada. La vista publicada confirmó las dos secciones con cinco preguntas cada una y el texto nuevo. Evidencia: 10-publicado.png, 11-lista-final.png, 12-segundo-tema.png.
- **P07-O10 — Vocabulario técnico durante revisión.** Revisar muestra al administrador «El servidor vuelve a validar permisos, versiones y reglas… no es una publicación atómica del cuestionario» y «Los metadatos permitidos siguen disponibles». Se observó ese texto; no se midió comprensión humana. Evidencia: 06-revisar.png y 10-publicado.png.

## Errores, recuperación y límites de herramienta

- El navegador no arrancó dentro del sandbox; se reinició con escalación autorizada. No es un error del producto.
- El primer uso de snap sin console.log no mostró el árbol; se corrigió la llamada. No es comportamiento de la interfaz.
- Un snapshot inmediatamente después de enviar login conservó la pantalla anterior y expuso el valor del campo contraseña en la salida. No se reproduce aquí. Se avisó al coordinador; debe redactarse esa salida si se comparte el registro. Un siguiente intento de captura fue rechazado por revisión automática por el riesgo de repetir la exposición. La recuperación fue esperar que el campo Contraseña estuviera oculto y redactar credenciales antes de imprimir el snapshot. No se atribuye a comportamiento humano.
- Un clic por coordenadas basado en captura fue rechazado automáticamente antes de ejecutarse. Se retomó mediante el texto del control observado. No hubo force-click.
- Dos localizadores de herramienta para el menú de pregunta fallaron: texto exacto ⋯ no resuelto y texto Acciones dirigido a un span de lector de pantalla interceptado por el summary. Se recuperó con el grupo accesible dentro del artículo. Estos timeouts no se cuentan como errores humanos ni como memoria deficiente de la persona.
- No se hizo lectura de API, SQL, mutación del DOM, inspección de código ni pausas artificiales. Las repeticiones finales usaron exclusivamente los mismos controles observados, observaron cada diálogo y esperaron su cierre real.
- Las capturas son de viewport, no siempre contienen todo el contenido del snapshot. 02-editor.png se tomó durante transición; la evidencia del editor estable es 03-editor-listo.png.
- No se puede concluir memorabilidad a dos meses. Sólo hubo reconocimiento y reutilización del patrón dentro de esta sesión simulada.

## Cierre

Navegador cerrado al final. No se crearon propuestas de rediseño. No se enviaron respuestas en nombre del participante.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [02-editor.png](02-editor.png)
- [03-editor-listo.png](03-editor-listo.png)
- [05-editar-pregunta.png](05-editar-pregunta.png)
- [06-revisar.png](06-revisar.png)
- [07-miembros.png](07-miembros.png)
- [08-asignar.png](08-asignar.png)
- [09-confirmar-publicacion.png](09-confirmar-publicacion.png)
- [10-publicado.png](10-publicado.png)
- [11-lista-final.png](11-lista-final.png)
- [12-segundo-tema.png](12-segundo-tema.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
