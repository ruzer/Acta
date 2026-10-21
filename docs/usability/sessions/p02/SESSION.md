# P02 — Analista frecuente

## Alcance y resultado

Persona simulada: analista que entiende procesos, sin conocimiento previo de la ubicación de funciones de Acta y sin programación como parte de su rol. Sesión independiente por UI real en http://localhost:4441. Se trabajó exclusivamente en «Servicios de ejemplo — 50», cuenta Persona 2 de prueba. No se consultaron código, pruebas, documentación técnica, SQL, APIs de aplicación ni informes ajenos. El navegador fue operado por un intermediario Playwright; esto limita la equivalencia con un usuario humano.

**Resultado: objetivo administrativo completado según la UI.** Las 50 preguntas quedaron publicadas, con área responsable Equipo de operaciones y asignación obligatoria a Participante A demo. Se corrigió un enunciado y se movió una pregunta. La sesión no inició como Participante A; su experiencia efectiva para responder no fue comprobada. No se enviaron respuestas ni se modificaron otros proyectos.

## ACTUAL PATH

Proyecto observado: `/projects/50296570-2e8e-4b9b-ade9-effd8cfc1152`.

1. `/` — iniciar sesión → Mis proyectos → «Resumen del proyecto».
2. `/projects/50296570-2e8e-4b9b-ade9-effd8cfc1152/dashboard` — resumen con 0 publicadas → «Editor».
3. `/projects/50296570-2e8e-4b9b-ade9-effd8cfc1152/editor` — Escribir (50 borradores) → Organizar.
4. Pregunta Canal de entrada 1 → detalle → ⋯ Acciones → Editar pregunta → guardar el enunciado «¿Por qué canales reciben las solicitudes del servicio de ejemplo 1?».
5. Buscar «¿Quién confirma» → 5 resultados → casilla de la pregunta del ejemplo 1. La barra de selección no mostró movimiento → abrir texto de la pregunta → detalle → ⋯ Acciones → Mover a otro tema → Cierre y seguimiento → Mover pregunta.
6. Revisar → 10 errores de dependencia y 50 advertencias sin participantes → volver a Organizar. Se reiniciaron búsqueda y selección.
7. Seleccionar todos los resultados (50) → Asignar área → Cambiar las 50 seleccionadas → Equipo de operaciones → Revisar lote → Confirmar 50 preguntas.
8. Seleccionar todos los resultados (50) otra vez → Agregar participantes → Participante A demo · Equipo de operaciones → Obligatorias → Revisar lote → Confirmar 50 preguntas.
9. Seleccionar todos los resultados (50) otra vez → Publicar seleccionadas → Revisar lote → 50 aplicables, 0 bloqueadas, 0 advertencias → Confirmar 50 preguntas.
10. Filtrar Área responsable = Equipo de operaciones y Estado de publicación = Publicada → 50 resultados. Revisar → Información no bloqueante (50), sin errores ni advertencias, «No hay preguntas en borrador».
11. «Ver preguntas publicadas» → ruta base del proyecto, con secciones 9/10/10/10/11 y enunciado corregido visible. Fin.

## Resultados por subtarea

| Subtarea | Resultado y evidencia |
|---|---|
| Encontrar y comprender el cuestionario | Éxito. 50 preguntas descubiertas en editor, cinco temas iniciales de 10; el resumen solo contaba publicadas. Transcript 04:24:33–04:25:00 UTC. |
| Organizar | Éxito. Responsable de cierre 9 pasó de Recepción de solicitudes a Cierre y seguimiento. UI confirmó «Pregunta movida. Se guardaron los órdenes de ambos temas», conteos 9 y 11. Transcript 04:27:24.859 UTC. |
| Corregir enunciado | Éxito. Canal de entrada 1 guardada y luego visible en consulta publicada. Transcript 04:26:11.313 y 04:33:12.194 UTC; captura 08. |
| Encontrar qué falta | Éxito. Revisar identificó 10 dependencias y 50 preguntas sin participantes. Captura 03; transcript 04:27:35.061 UTC. |
| Asignar área | Éxito. Lote de 50 aplicables confirmado; filtro final devuelve 50 en Equipo de operaciones. Captura 06. |
| Asignar Participante A demo | Éxito administrativo. Revisión mostró 50 asignaciones nuevas obligatorias y 0 existentes; confirmación posterior «50 preguntas actualizadas». Captura 04 y transcript 04:30:13.941–04:30:36.769 UTC. |
| Dejar listas/publicar | Éxito administrativo. Confirmación de lote y filtro final 50 Publicada; revisión sin borradores. Capturas 05, 06, 07, 08. Acceso real del participante no comprobado. |

## Observaciones

- **P02-O01 — Entrada indirecta y alcance del resumen.** Elegí Resumen del proyecto para encontrar pendientes. Mostró «0 preguntas», «Sin preguntas» y «Todavía no hay preguntas publicadas para revisar». El texto explica que cuenta publicadas, pero no informa allí sobre los 50 borradores. Fue necesario entrar a Editor. Esto fue un desvío de descubrimiento, no una falla. Evidencia: 01-resumen-cero.png, transcript 04:24:33.632.
- **P02-O02 — Identificación clara de modos.** Los nombres Escribir, Organizar y Revisar permitieron descubrir las funciones sin instrucciones de ubicación. Organizar ofreció búsqueda, temas y selección de todos los resultados. La distinción 40 de página / 50 de resultados dio confianza para abarcar el lote completo. Transcript 04:25:00.037 y captura 06.
- **P02-O03 — Casilla y detalle llevan a acciones diferentes.** Para reorganizar seleccioné primero la casilla. La barra mostró Asignar área, Agregar participantes, Publicar seleccionadas y Limpiar selección, sin movimiento. Recuperé el recorrido abriendo el texto de la pregunta y luego ⋯ Acciones, donde sí estaba Mover a otro tema. Un intento de camino sin el control esperado; no un error de ejecución. Captura 02 y transcript 04:26:19.629–04:27:24.859.
- **P02-O04 — Feedback útil al guardar y mover.** Guardar explicó que el contenido sigue en preparación hasta publicarlo. Mover confirmó ambos órdenes y actualizó conteos de temas. Evitó confundir guardado con publicación. Transcript 04:26:11.313 y 04:27:24.859.
- **P02-O05 — Revisión extensa y lenguaje técnico.** Revisar presentó 10 errores y 50 advertencias, cada una con Ir a corregir, seguidas de 50 controles individuales para publicar. La advertencia «nadie podrá responder todavía» fue concreta. «El servidor vuelve a validar permisos, versiones y reglas» y «publicación atómica» excedían el lenguaje operativo de esta persona. Captura 03 y transcript 04:27:35.061. No se midió lectura humana completa de todas las tarjetas.
- **P02-O06 — Diferencia de alcance entre revisión y lote.** Revisar decía «Publica primero la pregunta principal» en 10 seguimientos y deshabilitaba su publicación individual. Al elegir las 50 en Organizar, la revisión del lote aceptó las 50 sin bloqueos. La persona tuvo una duda sobre si debía publicar primero cinco principales; la resolvió explorando el lote que ya había descubierto. No se intentó publicar individualmente una pregunta bloqueada. Capturas 03 y 05; transcript 04:27:35.061 y 04:31:52.084.
- **P02-O07 — Área y persona están diferenciadas.** Asignar área informó «Elegir un área no asigna personas». La selección de participantes incluyó el área junto al nombre. Esto hizo explícitos dos pasos del objetivo. Transcript 04:28:36.656 y 04:29:51.364.
- **P02-O08 — Repetición de selección y confirmaciones.** Tras cada lote confirmado la selección pasó de 50 a 0. Fue necesario Seleccionar todos tres veces para área, persona y publicación. Cada lote usó Revisar lote y Confirmar 50 preguntas. La confirmación previa mostró cantidad aplicable y bloqueos, útil para confiar en el alcance. Transcript 04:28:22.866–04:32:14.380.
- **P02-O09 — Cambio de pestaña descarta contexto de organización.** Al ir de Organizar a Revisar y regresar, desaparecieron la búsqueda «¿Quién confirma» y la selección de una pregunta. En esta sesión facilitó volver al conjunto, pero obligó a comprobar nuevamente el alcance. Transcript 04:27:24.859 y 04:27:46.556.
- **P02-O10 — Confirmación final verificable, mensaje genérico.** Los tres lotes terminaron con el mismo «Operación aplicada: 50 preguntas actualizadas; 0 sin cambios». Para constatar publicación y área utilicé ambos filtros: resultaron 50. Revisar mostró 50 avisos informativos idénticos de contenido protegido y no había borradores. Capturas 06 y 07; transcript 04:32:34.106 y 04:32:48.274. La confianza final depende de esa comprobación adicional y del resultado de asignación anterior.
- **P02-O11 — Consulta publicada limitada al rol actual.** El enlace final abrió una vista de Analista con secciones y consultas de fuentes; no un formulario para Participante A. Confirmó enunciado y organización publicados, pero no permite afirmar que se probó responder como ese participante. Captura 08; transcript 04:33:12.194.

## Métricas y tiempos reales

Reloj registrado en UTC, fecha 2026-10-06; corresponde a noche del 2026-10-05 en America/Mexico_City.

- Inicio de navegador: 04:17:31 UTC. Primer snapshot registrado: 04:17:38.796. Última evidencia: 04:33:22.556. Duración bruta primer–último registro: **15 min 43.760 s**.
- Hubo un intervalo de **6 min 30.160 s** entre primer snapshot y envío del formulario de login (04:24:08.956); no es una latencia comprobada del producto. Incluye espera/orquestación del agente.
- Desde login enviado a evidencia final: **9 min 13.600 s**, incluyendo herramientas, lectura del árbol, decisiones, captura y mensajes del agente. No representa tiempo de un usuario humano.
- Desde Organizar (04:25:00.037) a guardado confirmado (04:26:11.313): 71.276 s. Desde búsqueda para mover (04:26:11.313) a movimiento confirmado (04:27:24.859): 73.546 s.
- Primer diagnóstico Revisar: 04:27:35.061. Área confirmada observable: 04:29:28.787. Participante confirmado observable: 04:30:36.769. Publicación confirmada observable: 04:32:14.380. Verificación de filtros: 04:32:34.106. Estas son cotas de observación, no latencias de servidor.
- **48 comandos registrados**, **28 clics**, **4 rellenos de texto** (incluye login), **3 selecciones de casilla/radio**, **5 selecciones de lista**; 40 acciones UI contadas por llamadas. **8 capturas**. 3 operaciones de lote de 50, 1 edición, 1 movimiento.
- Suma de durationMs de comandos del navegador: **1.812 s**; no incluye toda la carga asíncrona ni el tiempo del transporte. No se debe restar para obtener un tiempo puro de uso o rendimiento.
- **0 errores de automatización** registrados, 0 formularios fallidos, 0 recuperaciones por excepción. Un desvío inicial al resumen y un intento de reorganizar por selección sin movimiento disponible. Un retorno de Revisar a Organizar para aplicar lotes.
- Se observaron árboles momentáneamente anteriores después de navegar o estados «Procesando…» inmediatamente tras clic. Se realizó una nueva observación, sin sleeps, force-click ni mutación de DOM; esto no se clasifica como fallo funcional.
- browser-events.jsonl contiene un 401 de comprobación de sesión antes de login y su mensaje de consola, ambos 04:17:31 UTC. No hubo error visible que bloqueara la tarea. No se consultó la API directamente.

## Evidencia y límites

Archivos en esta misma carpeta: transcript.jsonl (acciones, hora y resultados UI), browser-events.jsonl y capturas 01 a 08. Las capturas son de viewport; los detalles fuera del encuadre están en los snapshots del transcript. Algunas salidas de snapshots se recortaron expresamente para leer el diálogo o cabecera; los snapshots completos relevantes de Revisar se conservaron.

No se leyeron credenciales ni fixture desde archivos; las credenciales se usaron como variables opacas del navegador. No se evaluaron otros participantes, dispositivos, móvil, lector de pantalla, teclado completo, resultados humanos ni carga de producción. El acceso al árbol completo y el desplazamiento automático del intermediario pueden facilitar encontrar controles comparado con lectura visual humana. Se reportan conductas de una persona simulada, no afirmaciones sobre todos los usuarios. No se incluyen soluciones.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-resumen-cero.png](01-resumen-cero.png)
- [02-seleccion-sin-mover.png](02-seleccion-sin-mover.png)
- [03-revisar-10-errores-50-advertencias.png](03-revisar-10-errores-50-advertencias.png)
- [04-participante-lote-50.png](04-participante-lote-50.png)
- [05-publicacion-lote-acepta-dependencias.png](05-publicacion-lote-acepta-dependencias.png)
- [06-50-publicadas-operaciones.png](06-50-publicadas-operaciones.png)
- [07-revision-sin-borradores.png](07-revision-sin-borradores.png)
- [08-consulta-publicadas-final.png](08-consulta-publicadas-final.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
