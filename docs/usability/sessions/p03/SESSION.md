# P03 — Preparar un cuestionario de 300 preguntas para dos equipos

## Resultado y alcance

**Completado desde la interfaz del analista:** se repartieron las 300 preguntas existentes, se agregaron los participantes previstos y se confirmó su publicación. La vista de preguntas publicadas muestra los cinco temas de 60 preguntas. No se inició sesión como Participante A ni B: la disponibilidad individual para responder se apoya en las confirmaciones de asignación y publicación; no es una prueba directa del recorrido de cada participante.

Persona simulada: analista que conoce procesos de negocio y no programación. Objetivo ficticio: preparar «Servicios de ejemplo — 300» para Equipo de operaciones / Participante A demo (Recepción, Evaluación y Atención) y Equipo de servicios / Participante B demo (Comunicación y Cierre). Se descubrieron las capacidades a partir de la UI, sin código, pruebas, documentación técnica, APIs, SQL ni sesiones ajenas. No se modificó el contenido de las preguntas: ya había 300 borradores organizados en cinco temas.

| Subtarea | Resultado observado | Evidencia propia |
|---|---|---|
| Encontrar el proyecto y sus preguntas | Éxito: proyecto único, enlace Editar cuestionario, 300 preguntas y cinco temas | transcript líneas 2–5 |
| Asignar Recepción a operaciones | Éxito: 60 actualizadas | líneas 8–13 |
| Asignar Evaluación a operaciones | Éxito: 60 actualizadas después de volver al tema | líneas 22–27 |
| Asignar Atención a operaciones | Éxito: 60 actualizadas | líneas 16–21 |
| Asignar Comunicación y Cierre a servicios | Éxito: restantes 120 del área coordinación; actualización confirmada y coordinación quedó en 0 | líneas 28–36; captura 01 |
| Agregar Participante A | Éxito: filtro operaciones encontró 180; revisión indicó 180 asignaciones nuevas; confirmación aplicada | líneas 37–42 |
| Agregar Participante B | Éxito: filtro servicios encontró 120; revisión indicó 120 asignaciones nuevas; confirmación aplicada | líneas 43–49; captura 02 |
| Publicar todas | Éxito: 300 aplicables, 0 bloqueadas, confirmación de 300 actualizadas | líneas 55–59; captura 04 |
| Verificar publicación | Éxito desde analista: Revisar muestra información de 300 publicadas; vista de publicadas contiene cinco temas de 60 | líneas 60–63; captura 05 |
| Verificar respuesta como cada participante | No ejecutada; no se facilitó acceso a esas identidades | Limitación de alcance |

Las asignaciones se eligieron como **Obligatorias** porque el formulario exigía esa decisión y se interpretó que cada persona era responsable de responder. La consigna no había especificado obligatoriedad; es una elección de esta sesión, no un requisito confirmado.

## ACTUAL PATH

Inicio de sesión → Mis proyectos → Editar cuestionario → Escribir (300 borradores) → Organizar → Recepción → Seleccionar tema completo (60) → Asignar área → Cambiar las 60 seleccionadas → Equipo de operaciones → Revisar lote → Confirmar 60 → Evaluación → Seleccionar tema completo → Atención (se pierde selección) → Seleccionar tema completo → Asignar área / operaciones / revisar / confirmar 60 → volver a Evaluación → seleccionar / asignar / revisar / confirmar 60 → Todos los temas → filtrar Equipo de coordinación (120) → Seleccionar todos los resultados → asignar Equipo de servicios / revisar / confirmar 120 → filtro Equipo de operaciones (180) → seleccionar todos → Agregar participantes → Participante A / Obligatorias → revisar / confirmar 180 → filtro Equipo de servicios (120) → seleccionar todos → Participante B / Obligatorias → revisar / confirmar 120 → Todas las áreas → Revisar (60 errores de dependencias) → regresar a Organizar → seleccionar 300 → Publicar seleccionadas → Revisar lote (300 aplicables, 0 bloqueadas) → confirmar 300 → Revisar (300 publicadas) → Ver preguntas publicadas.

Ruta real inicial: http://localhost:4441/ . Editor: http://localhost:4441/projects/d729246a-a45c-4cc2-bb0b-601485976aa9/editor . Ruta final: http://localhost:4441/projects/d729246a-a45c-4cc2-bb0b-601485976aa9 .

## Observaciones

### P03-O01 — Descubrimiento directo de la organización por lotes

En Mis proyectos fue visible «Editar cuestionario». El editor abrió en Escribir y enumeró las preguntas; el nombre de la pestaña Organizar guió el siguiente paso. Allí aparecieron cinco temas, búsqueda, filtros, conteos, paginación y acciones de selección. Se descubrió sin ayuda. La diferencia entre «Seleccionar esta página (40)» y «Seleccionar tema completo (60)» permitió abarcar las preguntas que no estaban en la primera página. Confianza inferida alta en el alcance por los números explícitos. Evidencia: líneas 2–7, 04:23:36–04:24:43 UTC.

### P03-O02 — La selección no se acumula entre temas

Se seleccionaron 60 preguntas de Evaluación y se pasó a Atención con la intención exploratoria de reunir los temas de operaciones. La selección pasó a 0 y apareció «Se limpió la selección al cambiar los filtros. Selecciona las preguntas que deseas modificar». Hubo una selección descartada y un regreso posterior a Evaluación. No hubo modificación equivocada. La recuperación fue entendible porque el aviso explicó el cambio, pero el trabajo de seleccionar se repitió. Evidencia: líneas 14–17 y 22–23, 04:25:57–04:27:46 UTC.

### P03-O03 — El lote aplicado vuelve a dejar cero seleccionadas

Después de asignar el área de Recepción, apareció «Operación aplicada: 60 preguntas actualizadas; 0 sin cambios» y «0 preguntas seleccionadas». El mismo comportamiento se repitió tras los siete lotes. El objetivo requería área, persona y publicación para el mismo contenido, por lo que se hicieron selecciones nuevas para cada operación. La sesión cambió a filtrar por áreas para reunir 180 y 120 preguntas. El resultado se alcanzó sin repetir preguntas individualmente. Evidencia: líneas 13, 21, 27, 36–49, 59.

### P03-O04 — Revisión y confirmación del alcance transmiten control

Los diálogos mostraron áreas actuales, número de seleccionadas, aplicables, sin cambios, bloqueadas y advertencias. «Elegir un área no asigna personas» evitó tomar el área como asignación individual. Las revisiones de participantes identificaron expresamente la persona, obligatoriedad y cantidad de asignaciones nuevas. Se aplicaron cuatro lotes de área, dos de participantes y uno de publicación; todos terminaron con cantidades explícitas. No se observaron fallos de esas operaciones. Evidencia: líneas 8–13, 18–21, 24–27, 31–36, 39–49, 56–59; capturas 01, 02, 04.

### P03-O05 — Vocabulario que exige una decisión adicional

Agregar participantes exigió elegir «Obligatorias» u «Opcionales» antes de revisar. La sesión pudo continuar, pero tuvo que inferir esa preferencia no incluida en la tarea. El texto adicional habla de asignaciones activas, inactivas y reactivadas; no fue necesario resolver esos estados porque los lotes indicaron todas las asignaciones como nuevas. Evidencia: líneas 39–41 y 45–47.

### P03-O06 — La revisión general y el lote ofrecen señales distintas sobre dependencias

Antes de publicar, la pestaña Revisar mostró «Errores · resuelve antes de publicar (60)» y «Publica primero la pregunta principal». Se retrocedió a Organizar para comprobar la publicación conjunta descubierta antes. Sin cambiar contenido, relaciones ni asignaciones, el lote de 300 indicó 300 aplicables, 0 bloqueadas y 0 advertencias; se confirmó con éxito. Después, Revisar mostró «Información · no bloquea (300)» y contenido publicado. La señal inicial produjo duda sobre si hacían falta correcciones o publicaciones individuales. No se investigó la lógica interna: el hallazgo es la diferencia visible entre ambas evaluaciones y el desvío del recorrido. Además, Revisar contiene términos «servidor», «versiones» y «publicación atómica», mientras el lote dice que se aplica completo o no se aplica. Confianza inferida reducida en la revisión general y recuperada con el resultado del lote. Evidencia: líneas 51–60; capturas 03 y 04.

### P03-O07 — Comprobación final suficiente para el analista, limitada para el destinatario

La vista publicada muestra las cinco secciones con 60 preguntas y el aviso «Consulta las preguntas publicadas». La cuenta conserva el rol Analista y ofrece consultar decisiones/fuentes, no controles de responder. Por ello, se confirma publicación y asignación desde el analista; no se afirma haber probado acceso o envío con A/B. Evidencia: líneas 60–63; captura 05.

## Métricas y tiempos reales

Tiempos del agente según transcript, no estimaciones de una persona ni medición de latencia del producto. Incluyen razonamiento, herramientas y observación.

- Primera acción de login registrada: 2026-10-06 04:23:26.478 UTC (2026-10-05 22:23:26.478, Ciudad de México).
- Última captura de UI: 2026-10-06 04:37:23.316 UTC (2026-10-05 22:37:23.316 local).
- Intervalo de interacción registrada: **13 min 56.838 s**.
- Primera selección completa descubierta: 04:24:43 UTC, aproximadamente 1 min 17 s desde login.
- Última asignación de área confirmada: 04:30:40 UTC; verificación de coordinación vacía a 04:30:52.
- Participante A confirmado: 04:32:31 UTC; B: 04:34:06 UTC.
- 60 errores vistos: 04:34:32 UTC; lote sin bloqueos: 04:35:50 UTC; publicación confirmada: 04:36:14 UTC.
- 63 entradas de transcript; **59 acciones de interacción**: 41 clics, 2 llenados de credenciales, 6 selecciones de radio/checkbox, 10 selecciones de menú.
- 7 lotes confirmados: 4 áreas (60 + 60 + 60 + 120), 2 participantes (180 + 120), 1 publicación (300).
- 8 acciones de selección masiva; 1 selección descartada al cambiar tema; 7 selecciones usadas para lotes.
- 1 regreso a un tema pendiente; 1 regreso de Revisar a Organizar por la señal de dependencias.
- 5 capturas; 0 errores de ejecución del navegador en el transcript; 0 operaciones de producto fallidas durante la tarea.

## Errores de herramienta y límites de observación

El primer intento de lanzar Chromium fue rechazado por el sandbox del sistema (bootstrap_check_in, Permission denied) antes de interactuar con Acta. Se recuperó relanzando con el permiso del entorno. **Es un incidente de herramienta, no de producto.** No se contó en el intervalo del transcript. Durante varias navegaciones, la captura inmediatamente posterior al clic conservó transitoriamente la página anterior o un estado «Procesando…»; se observó de nuevo sin repetir la acción. No se atribuye la duración entre capturas al rendimiento de Acta.

El árbol accesible de Escribir y de Revisar era muy largo y algunas salidas de herramienta se truncaron. Se consultaron tramos y resúmenes del mismo árbol visible. Esto es un límite de presentación de la herramienta, no evidencia por sí solo de un problema visual. El archivo browser-events registra un 401 durante la comprobación inicial de sesión, antes del login; no hubo un error de autenticación visible tras ingresar las credenciales.

Este es un agente simulando el rol, no una persona real. Los juicios de duda y confianza son inferencias de señales visibles y decisiones de navegación, no testimonios ni mediciones psicológicas. El agente lee árboles accesibles y maneja selectores con más precisión que un usuario corriente, y conoce la consigna completa. No hubo estudio de comprensión de cada una de las 300 preguntas ni prueba con lectores de pantalla. No se leyeron archivos de configuración, fixtures o credenciales para extraer comportamiento; las credenciales solo se usaron a través de las variables del navegador.

## Evidencias

- `transcript.jsonl`: recorrido cronológico, acciones, resultados y tiempos. Los números de línea de este informe corresponden a sus 63 entradas.
- `browser-events.jsonl`: dos eventos iniciales de sesión no autenticada.
- `01-area-servicios-120-revision.png`: lote de área, antes de confirmar.
- `02-participante-b-120-revision.png`: asignaciones B, antes de confirmar.
- `03-revisar-60-errores.png`: errores de dependencias en revisión general.
- `04-publicar-300-sin-bloqueos.png`: mismo contenido listo para publicación conjunta.
- `05-preguntas-publicadas.png`: vista publicada desde la cuenta analista.

No se formulan propuestas de solución.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-area-servicios-120-revision.png](01-area-servicios-120-revision.png)
- [02-participante-b-120-revision.png](02-participante-b-120-revision.png)
- [03-revisar-60-errores.png](03-revisar-60-errores.png)
- [04-publicar-300-sin-bloqueos.png](04-publicar-300-sin-bloqueos.png)
- [05-preguntas-publicadas.png](05-preguntas-publicadas.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
