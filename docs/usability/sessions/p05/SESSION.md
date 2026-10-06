# P05 — Participante ocupado

Evaluación independiente mediante interfaz, realizada por agente simulado. No es una sesión con sujeto humano ni un benchmark de tiempo. La interrupción se simuló cerrando sesión y entrando de nuevo en el mismo recorrido; no se probó retención durante días.

## Alcance y resultado

Proyecto: **Solicitudes de ejemplo — Jornada breve**, 30 preguntas asignadas. Inicio en `http://localhost:4441/`. Sin lectura de código, tests, informes ajenos o documentación privada; sin API, SQL, mutaciones de DOM, force clicks, sleeps arbitrarios ni cambios al producto. Las respuestas introducidas son ficticias.

| Subtarea | Resultado | Evidencia |
|---|---|---|
| Entrar y encontrar trabajo asignado | COMPLETE | Inicio con 30 pendientes y botón Continuar; captura 01. |
| Contestar preguntas conocidas | COMPLETE | Q1 texto y Q2 Sí enviadas; listado posterior con ambas Enviada. |
| Dejar incertidumbre recuperable | COMPLETE | Q3 Necesito consultar esto → Por consultar; Q4 Correo + comentario → Guardar y salir → Borrador; captura 05. |
| Salir por UI | COMPLETE | Menú del nombre → Cerrar sesión → Sesión cerrada; captura 06. |
| Regresar por UI y recuperar borrador | COMPLETE | Inicio de sesión → Continuar → Q4 con selección y comentario intactos; capturas 07 y 08. |
| Completar lo previamente reservado | COMPLETE | Q4 completada; Q3 localizada mediante Pendientes y enviada; capturas 10–12. |
| Verificar respuesta final | COMPLETE | Detalle Q4 en solo lectura: Correo, Teléfono, comentario actualizado, En revisión; captura 14. |
| Completar las 30 preguntas | NOT ATTEMPTED | Fuera del alcance breve: estado final 4 enviadas y 26 pendientes. |
| Retención varios días, adjuntos y ejemplos | NOT ATTEMPTED | No se simula evidencia sobre estas funciones. |

Navegador cerrado mediante `browser.close()` al finalizar. URL final antes del cierre: `http://localhost:4441/projects/a28597e0-e70c-48b2-b726-fa54dc511b97/submitted/a107f13d-d5cd-4fb5-a126-bc6d206be046`.

## Recorrido real

1. Acceso → Mi trabajo. El resumen presenta 30 pendientes, 0 borradores, 0 requieren atención, 0 enviadas. La lista se divide en dos temas de 15 preguntas y abre el primero. Uso **Continuar**.
2. Q1 Canal de entrada: escribo recepción por correo y ventanilla del servicio ficticio y pulso **Enviar respuesta**. Aparece Q2, sin paso intermedio de confirmación observado.
3. Q2 Registro de entrada: selecciono **Sí** y envío. Aparece Q3.
4. Q3 Medio de contacto: no sé qué canal es principal. Pulso **Necesito consultar esto** esperando reservarla para después. Se observa brevemente **Guardando…** y después aparece Q4. No se solicita una explicación adicional antes del avance.
5. Q4 Información necesaria: selecciono **Correo** y escribo en comentario que necesito confirmar si el teléfono es obligatorio. Pulso **Guardar y salir**, esperando conservar selección y nota. Regreso a Mi trabajo: Q3 figura **Por consultar**, Q4 **Borrador**. El resumen marca 26 pendientes, 1 borrador, 0 requieren atención y 2 enviadas; esas cifras suman 29 mientras la lista contiene la pregunta por consultar.
6. Para la interrupción, pulso mi nombre visible, encuentro **Cerrar sesión** y lo uso. La pantalla informa **Sesión cerrada**.
7. Vuelvo a iniciar sesión. El proyecto y sus estados reaparecen. **Continuar** abre Q4, el borrador más reciente, con Correo marcado y la nota completa. Completo la consulta ficticia, marco también Teléfono, sustituyo la nota y envío. Aparece Q5.
8. Para recuperar Q3, vuelvo a **Mi trabajo**. Pruebo **Requiere atención**, porque la pregunta reservada necesita una consulta mía. Devuelve **No encontramos preguntas con estos filtros**. Cambio a **Pendientes** y allí aparece Q3 **Por consultar**, mezclada con las que no he empezado. Abro **Continuar** de esa fila.
9. Q3 muestra **Por consultar** y **Borrador guardado** aunque el resumen anterior tenía 0 borradores. Selecciono Correo, añado nota de consulta ficticia resuelta y envío. El flujo salta a Q5, evitando Q4 ya enviada.
10. Vuelvo a Mi trabajo y filtro **Enviadas**: cuatro preguntas, 26 pendientes, 0 borradores, 0 requieren atención. Abro **Ver** de Q4: texto final, dos selecciones y **Solo lectura / En revisión** confirman el estado.

No hubo retroceso mediante botón del navegador ni repetición accidental de envíos. Hubo dos regresos deliberados a Mi trabajo para localizar o verificar preguntas y un cambio de filtro tras una expectativa no satisfecha.

## Observaciones

### P05-O01 — Entrada orientada al trabajo

La pantalla inicial presenta de inmediato el total y un único **Continuar** destacado; no necesité abrir primero una administración de proyectos. Los temas acotan la lista inicial. La instrucción sobre Guardar y salir anticipa cómo interrumpir. Señal positiva. Evidencia: `01-mi-trabajo-inicial.png`, transcript 04:40:22–04:40:38 UTC.

### P05-O02 — Guardar y enviar tienen consecuencias explícitas

En cada formulario se explica que el borrador es privado y que enviar registra una versión no modificable. El envío avanza automáticamente, lo que evitó una vuelta a la lista tras Q1, Q2 y Q4. La confirmación duradera que observé fue el estado Enviada en lista y posteriormente el detalle; no afirmo ausencia de una notificación transitoria que pudiera no haberse capturado. Evidencia: `02-respuesta-enviada.png`, `08-borrador-recuperado.png`, `12-cuatro-enviadas.png`, `14-detalle-enviado.png`.

### P05-O03 — Reservar una consulta permite seguir sin inventar una respuesta

**Necesito consultar esto** guardó Q3 sin seleccionar ninguna opción y avanzó a Q4. Después apareció una etiqueta distinta, **Por consultar**, con enlace **Continuar**. La función se encontró en el primer formulario, sin buscar ayuda. Señal positiva para una jornada interrumpida. Evidencia: `03-necesito-consultar.png`, `04-consulta-resultado.png`, `05-guardado-y-salida.png`, `11-consulta-recuperada.png`.

### P05-O04 — La pregunta Por consultar no queda representada en el resumen numérico

Con 30 preguntas, el resumen tras guardar Q4 marcó 26 pendientes + 1 borrador + 0 atención + 2 enviadas = 29. La fila Q3 seguía disponible como Por consultar. Después de enviar Q4, el resumen marcó 26 + 0 + 0 + 3 = 29. No encontré una cuenta ni filtro explícito de Por consultar entre los controles visibles. Esto deja menos clara la magnitud del trabajo reservado sin que se haya perdido la pregunta. Evidencia: `05-guardado-y-salida.png`, `07-reentrada.png`, `09-filtro-atencion.png`.

### P05-O05 — Recuperación preservada tras cierre de sesión

Cerrar sesión fue localizable pulsando el nombre. Al volver, Continuar abrió Q4 con Correo marcado y la nota exacta pendiente de confirmación. El formulario mostró fecha de borrador guardado. La expectativa de retomar se cumplió sin reescribir lo anterior. Evidencia: `06-sesion-cerrada.png`, `07-reentrada.png`, `08-borrador-recuperado.png`. Alcance: reentrada inmediata en esta sesión de prueba.

### P05-O06 — Fricción semántica al buscar lo que requiere una consulta propia

Mi expectativa simulada fue encontrar Q3 en **Requiere atención**. El filtro devolvió vacío; **Pendientes** sí mostró Q3 **Por consultar**. Recuperé la tarea cambiando de filtro, sin ayuda externa. El resultado es una confusión recuperable de denominaciones, no un bloqueo ni evidencia de datos perdidos. Además, al abrir Q3 se llama **Borrador guardado** a un estado que no contribuía a Borradores en el resumen. Evidencia: `09-filtro-atencion.png`, `10-filtro-pendientes.png`, `11-consulta-recuperada.png`.

### P05-O07 — Cierre verificable de las respuestas retomadas

Q3 y Q4 pasaron a Enviada. Al enviar Q3, el recorrido llegó a Q5, omitiendo Q4 ya completada. El detalle de Q4 conserva Correo, Teléfono y el comentario actualizado, y dice Solo lectura / En revisión. Señal positiva de continuidad y comprobación. Evidencia: `12-cuatro-enviadas.png`, `14-detalle-enviado.png`.

### P05-O08 — Contenido del ejemplo puede introducir duda independiente del flujo

Q4 pregunta qué información se pide antes de atender, pero ofrece Correo, Teléfono y Portal. Correo y teléfono se interpretaron como datos de contacto; Portal resulta menos claro como información solicitada. Se registra como contenido observado del escenario de prueba, sin atribuirlo a una limitación estructural del producto. Evidencia: `08-borrador-recuperado.png`.

## Evidencias y límites de instrumentación

- Carpeta: `./`.
- Transcripción de comandos: `transcript.jsonl`; registro del navegador: `browser-events.jsonl`. Los tiempos no representan velocidad humana.
- Capturas más útiles: 05 (estados antes de salir), 06 (logout), 08 (datos recuperados), 09 (filtro vacío), 10 (consulta en Pendientes), 11 (estado recuperado), 12 (cuatro enviadas), 14 (detalle final).
- Las capturas 02 y 04 muestran la pantalla siguiente a la acción; sus nombres no prueban por sí mismos el guardado. La verificación se apoya en las listas y detalles posteriores. La captura 13 se tomó durante transición; usar 14 para el detalle estable.
- El primer intento de abrir Chromium falló por permisos del sandbox. Se reintentó con la autorización de entorno TEST. Es tooling, no fallo del producto.
- Un snapshot del primer login se tomó mientras el formulario aún contenía la contraseña de prueba y la salida de herramienta la expuso. Se informó al coordinador sin repetir el valor. La comprobación del transcript propio encontró cero coincidencias del valor, por lo que no hubo contenido que sanear allí. En la reentrada se esperó el encabezado Mi trabajo antes de capturar. Esto es un incidente de instrumentación; no constituye un hallazgo de la UI para participantes.
- No se observaron errores del producto, pérdida de respuestas ni bloqueos en las subtareas recorridas. No se probaron validaciones de campos inválidos, adjuntos, fechas, mobile, teclado o recuperación ante caída de red.

No se implementaron cambios ni se proponen soluciones en este registro.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-mi-trabajo-inicial.png](01-mi-trabajo-inicial.png)
- [02-respuesta-enviada.png](02-respuesta-enviada.png)
- [03-necesito-consultar.png](03-necesito-consultar.png)
- [04-consulta-resultado.png](04-consulta-resultado.png)
- [05-guardado-y-salida.png](05-guardado-y-salida.png)
- [06-sesion-cerrada.png](06-sesion-cerrada.png)
- [07-reentrada.png](07-reentrada.png)
- [08-borrador-recuperado.png](08-borrador-recuperado.png)
- [09-filtro-atencion.png](09-filtro-atencion.png)
- [10-filtro-pendientes.png](10-filtro-pendientes.png)
- [11-consulta-recuperada.png](11-consulta-recuperada.png)
- [12-cuatro-enviadas.png](12-cuatro-enviadas.png)
- [13-respuesta-final.png](13-respuesta-final.png)
- [14-detalle-enviado.png](14-detalle-enviado.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
