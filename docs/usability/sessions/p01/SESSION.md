# P01 — Evaluación independiente de usabilidad de Acta

Fecha de interacción: 2026-10-06 04:17:24–04:36:26 UTC (2026-10-05 22:17–22:36, Ciudad de México).
Persona simulada: administrativa novata, conocimientos técnicos bajos, primer uso.
Objetivo: crear «Atención vecinal de ejemplo», preparar aproximadamente diez preguntas por temas, asignarlas a Participante A demo y dejarlas disponibles para responder.
Entorno autorizado: http://localhost:4441. Proyecto creado: /projects/2df391fc-5bb7-46db-aaf4-5f791e8499ec.

## Alcance y limitaciones

Sesión de un agente que simula una persona, no una prueba con un usuario humano real. Las dudas son interpretaciones de esta persona simulada; no se midieron emociones ni satisfacción humana. Solo se descubrieron flujos mediante navegador real, controles observados y capturas. No se leyó código, documentación técnica, APIs de aplicación ni informes de otros agentes. No hubo cambios de producto. Los únicos cambios fueron datos ficticios del proyecto creado y la membresía/asignaciones del participante dentro de ese proyecto.

El resultado de disponibilidad está verificado desde la interfaz administrativa: membresía activa, diez asignaciones activas/requeridas guardadas, diez publicaciones confirmadas y dos temas visibles en la vista publicada. No se inició sesión como Participante A demo ni se envió una respuesta; la experiencia efectiva bajo esa cuenta queda fuera de lo comprobado.

## Resultado por subtarea

| Subtarea | Estado | Evidencia |
|---|---|---|
| Iniciar sesión | COMPLETE | transcript 04:17:32 y 04:24:02 |
| Crear el proyecto solicitado | COMPLETE | Nombre exacto, identificador AV-EJEMPLO-01, guardado confirmado 04:25:20 |
| Crear diez preguntas | COMPLETE | AV-01 a AV-10; cinco preguntas en cada uno de dos temas, 04:29:39 |
| Agrupar por temas | COMPLETE | Experiencia de atención; Necesidades del vecindario; capturas 08 y 09 |
| Dar acceso al participante | COMPLETE | Participante A demo, Área participante, Área solicitante, Activo; 04:30:16 |
| Asignar diez preguntas | COMPLETE | Diez guardados de asignación, reducción de diez advertencias a cero, 04:30:50–04:33:15 |
| Publicar para participantes asignados | COMPLETE | Diez confirmaciones, diez contenidos publicados/protegidos y «No hay preguntas en borrador», 04:35:47 |
| Comprobar respuesta desde cuenta participante | NOT ATTEMPTED | No formaba parte de esta sesión administrativa ni se usaron otras credenciales |

Resultado del objetivo: COMPLETE desde la perspectiva administrativa, con el límite de verificación anterior. No se encontró bloqueo persistente del producto.

## ACTUAL PATH — cronología real

1. 04:17:24. Login observado. Completar Usuario/Contraseña y pulsar Iniciar sesión.
2. 04:17:32–04:24:02. La observación siguiente quedó pendiente en la herramienta durante aproximadamente 6 min 30 s. El comando de observación finalmente ejecutado duró 5 ms. Este intervalo se clasifica como overhead del canal, no como lentitud del producto.
3. 04:24:02. «Mis proyectos» vacío: «La administración debe asignarte una membresía para comenzar». Había enlace Administración; entrar por él.
4. 04:24:29. Administración abrió en Usuarios; cambiar a Proyectos. Se mostró Crear proyecto.
5. 04:24:40. Completar nombre y descripción, dejar vacío Identificador externo porque su significado no era claro para la persona simulada, pulsar Crear proyecto. No avanzó.
6. 04:24:56. La captura mostró foco en Identificador externo y tooltip nativo «Please fill out this field.». Completar AV-EJEMPLO-01 y volver a crear.
7. 04:25:20–04:25:57. «Operación guardada» limpió formulario. Seguir Mis proyectos, encontrar tarjeta del nuevo proyecto, entrar por Editar cuestionario.
8. 04:26:06–04:26:25. Agregar tema «Experiencia de atención». El estado vacío indicaba agregar primer tema.
9. 04:26:41–04:28:35. Crear cinco preguntas una por una. Cada formulario: Pregunta, tipo, Identificador externo y Título breve; mantener obligatoria. Confirmación de guardado y aclaración de borrador.
10. 04:28:46–04:29:39. Agregar «Necesidades del vecindario» y crear cinco preguntas más. Se usaron Sí o no, Texto breve, Número y Texto amplio. Cada tema mostró cinco preguntas.
11. 04:29:48–04:30:16. Administrar miembros. Elegir Participante A demo, cambiar rol predeterminado Administración a Área participante, elegir Área solicitante por aviso de obligatoriedad, guardar. Tabla confirmó estado Activo.
12. 04:30:28. Volver por ← Cuestionario y abrir Revisar. Diez advertencias «Sin participantes asignados: nadie podrá responder todavía. Esto no impide publicar». La membresía no había asignado preguntas.
13. 04:30:39–04:33:15. «Ir a corregir» abrió directamente Asignar participante. Elegir Participante A demo · Área solicitante y Guardar asignación, manteniendo Asignación activa y Participación requerida. Repetir en diez preguntas. Las advertencias bajaron 10→9→…→0. Apareció «Sin incidencias detectadas».
14. 04:33:27–04:35:47. Publicar pregunta y Confirmar publicación por cada una de diez preguntas. El diálogo explicó disponibilidad para asignados y protección del contenido. Diez guardados efectivos; «Información · no bloquea (10)» y «No hay preguntas en borrador».
15. 04:35:57–04:36:25. Abrir Ver preguntas publicadas. Primer tema: cinco preguntas; elegir segundo tema: cinco preguntas. Registrar ambas vistas y finalizar.

## Observaciones

### P01-O01 — Entrada inicial sin guía directa a crear

Hecho observado: al iniciar con cuenta administrativa sin proyectos, Mis proyectos mostró «La administración debe asignarte una membresía para comenzar» y no un control Crear proyecto. Se encontró la ruta por el enlace global Administración, cuya primera pestaña fue Usuarios.
Interpretación de persona simulada: el mensaje parece dirigido a alguien que depende de otra persona administradora; no explica el siguiente paso de quien necesita crear. No bloqueó el objetivo: se descubrió Administración → Proyectos en el primer intento.
Evidencia: 01-espacio-vacio.png; transcript 04:24:02–04:24:29.

### P01-O02 — Identificador externo obligatorio descubierto al enviar

Hecho observado: Crear proyecto pedía Identificador externo, con ayuda «Se conservará exactamente como lo escribas». Se dejó vacío y el envío se detuvo. La captura mostró validación nativa en inglés «Please fill out this field.». No había explicación visible de qué identificador usar en este proyecto ficticio.
Impacto observado: un envío inválido y una corrección. Se eligió AV-EJEMPLO-01 y continuó. La lengua del tooltip depende también del navegador del laboratorio; no se atribuye automáticamente a una cadena escrita por Acta.
Evidencia: 02-crear-identificador-duda.png, 03-crear-sin-identificador.png; transcript 04:24:40–04:25:20.

### P01-O03 — Tres textos por pregunta y repetición

Hecho observado: cada pregunta requirió trabajar con Pregunta, Identificador externo y Título breve. La ayuda sí explicó el propósito del identificador para referencias/exportaciones. La sesión completó treinta entradas de texto para las diez preguntas y abrió/guardó diez formularios.
Interpretación: para este objetivo administrativo pequeño, construir identificadores y títulos además del enunciado supuso trabajo adicional, sin provocar errores ni bloqueo. No se concluye que deban eliminarse campos.
Evidencia: transcript 04:26:41–04:29:39.

### P01-O04 — Membresía y asignación son pasos separados, descubiertos en revisión

Hecho observado: después de guardar Participante A demo como miembro activo, Revisar mostró las diez preguntas sin participantes. El aviso especificó la consecuencia «nadie podrá responder todavía». Se asignó cada pregunta desde Ir a corregir.
Impacto: la persona simulada esperaba haber dado participación al incorporar al miembro; necesitó un segundo paso por pregunta. El aviso y su botón hicieron posible recuperarse sin volver a buscar en otra pantalla.
Evidencia: 04-membresia-configurada.png, 05-revisar-diez-sin-participantes.png; transcript 04:30:16–04:33:15.

### P01-O05 — Vocabulario técnico en revisión

Hecho observado: Revisar presenta «El servidor vuelve a validar permisos, versiones y reglas al publicar cada pregunta; no es una publicación atómica del cuestionario», «metadatos permitidos» y «Un fallo no revierte publicaciones anteriores».
Interpretación de persona de conocimientos bajos: servidor/publicación atómica/metadatos no ayudan directamente a decidir si el cuestionario está listo. No hubo error atribuible a esta redacción en la sesión.
Evidencia: 05-revisar-diez-sin-participantes.png, 06-sin-incidencias-diez-publicaciones.png, 07-diez-publicadas.png; transcript 04:30:28 y 04:35:47.

### P01-O06 — Asignación y publicación requirieron repetición por pregunta

Hecho observado: diez ciclos Ir a corregir → seleccionar participante → Guardar asignación (30 acciones) y diez ciclos Publicar → Confirmar publicación (20 acciones). No se encontró una acción para asignar/publicar todo el cuestionario en las pantallas recorridas. La interfaz dice explícitamente confirmar cada pregunta por separado. No se hizo búsqueda exhaustiva de controles en otros modos.
Impacto observado: 50 acciones repetidas para preparar disponibilidad tras haber creado y agrupado el contenido. Completado sin errores.
Evidencia: transcript 04:30:39–04:35:47; 06-sin-incidencias-diez-publicaciones.png.

### P01-O07 — Orden de revisión mezcló temas y varió entre guardados

Hecho observado: en Escribir se veían dos temas, cada uno con sus cinco preguntas. Revisar listó preguntas de ambos temas intercaladas; en snapshots posteriores hubo cambios de orden (por ejemplo, Solicitud reciente/Necesidad principal). Se usó el texto de cada pregunta para elegir la correcta.
Impacto observado: no se cometió asignación errónea. Puede aumentar la necesidad de releer; esto es una interpretación de la persona simulada, no un defecto funcional demostrado.
Evidencia: transcript 04:30:28, 04:32:25, 04:32:38, 04:35:38.

## Puntos positivos y confianza observable

- Editor vacío da una instrucción concreta: agregar el primer tema.
- Los tipos de respuesta tienen nombres comprensibles y se eligen directamente.
- La creación dentro de cada tema mantuvo la pertenencia correcta; no hubo preguntas en el tema equivocado.
- Guardar pregunta aclara que el contenido sigue en preparación hasta publicarlo.
- La tabla de miembros mostró nombre, rol, área y estado después de guardar.
- La revisión detectó las diez asignaciones faltantes y facilitó ir directamente al diálogo correcto.
- El contador de advertencias disminuyó conforme se guardaron asignaciones.
- Publicar tiene confirmación explícita y un mensaje posterior distinto del guardado de borrador.
- La ausencia de borradores y las dos secciones de cinco preguntas en la vista publicada sustentan la confianza en la finalización administrativa.

## Errores, retrocesos y funciones no encontradas

Errores de usuario simulado: 1 envío de Crear proyecto sin Identificador externo; corregido. No se borraron ni duplicaron datos por equivocación.
Retrocesos de recuperación: corrección en el mismo formulario del proyecto; paso de Revisar a diez diálogos de asignación tras considerar inicialmente suficiente la membresía. Volver de miembros al cuestionario fue navegación normal, no error.
Funciones no encontradas en la ruta recorrida: creación directa desde estado vacío; acción conjunta para asignar/publicar cuestionario completo. Se registra descubribilidad, no inexistencia universal.
Errores de automatización/selector: 0 comandos con error en transcript.
Incidente de herramienta: una llamada de observación permaneció pendiente aproximadamente 6 min 30 s; recuperó sin reiniciar ni cambiar datos. Otras llamadas tuvieron overhead variable de ejecución/transporte. Algunas observaciones inmediatamente después del clic captaron la UI previa o Guardando; se volvió a observar o se esperó un elemento visible. No se cuenta esto como fallo de producto.

## Métricas y tiempos

Cálculo sobre el transcript propio, no estimación de comportamiento humano:

- 63 registros de herramienta; 61 observaciones snap; 9 capturas.
- 132 acciones explícitas sobre controles: 77 clics, 37 llenados, 5 selecciones de radio, 13 selecciones de menú.
- 1 intento inválido de creación de proyecto; 0 errores de selector/automatización; 0 bloqueos persistentes del producto.
- 10 preguntas, 2 temas, 1 membresía nueva, 10 asignaciones, 10 publicaciones.
- Intervalo de pared de primera observación a captura final: 19 min 1.836 s.
- Intervalo aislado del canal tras login: aproximadamente 6 min 30 s. Resto de la sesión: aproximadamente 12 min 32 s, que aún incluye razonamiento, transporte, observaciones y escritura de comandos; no es tiempo humano activo ni medida de rendimiento del producto.
- Suma de durationMs de los 63 comandos dentro del helper: 5.185 s. Es tiempo técnico de ejecución de acciones/observaciones, no tiempo de interacción humano. La mayor parte del tiempo de pared fue overhead del agente/herramienta y deliberación; no existe instrumentación suficiente para separar con exactitud todos esos componentes.
- No se simuló tiempo de escritura humana ni se asignaron puntuaciones SUS/SEQ ficticias.

## Evidencia disponible

Todo en ./:

- transcript.jsonl: instrucciones ejecutadas, tiempo UTC, duración y árboles accesibles.
- browser-events.jsonl: eventos del navegador (no se usaron para aprender flujos).
- 01-espacio-vacio.png
- 02-crear-identificador-duda.png
- 03-crear-sin-identificador.png
- 04-membresia-configurada.png
- 05-revisar-diez-sin-participantes.png
- 06-sin-incidencias-diez-publicaciones.png
- 07-diez-publicadas.png
- 08-publicadas-primer-tema.png
- 09-publicadas-segundo-tema.png

No se incluyen credenciales ni propuestas de solución.

Cierre operativo: navegador de P01 cerrado a las 04:38:14 UTC. El comando de cierre posterior añade un registro al transcript (64 total); las métricas anteriores corresponden únicamente a la interacción hasta la captura final, excluyendo la redacción del informe y el cierre.

## Evidencia consolidada

Copia revisada para el estudio; datos ficticios. Las rutas de la máquina se sustituyeron por referencias neutrales; no se incluyen credenciales ni archivos de sesión. Se omite la captura de acceso P08-01. Los estados transitorios permanecen identificados como tales y no fundamentan hallazgos. Algunas lecturas impresas por console.log no quedaron en el valor devuelto del transcript: en esos casos la evidencia disponible es el informe, las capturas y el registro original de herramientas; no se afirma trazabilidad textual completa.

- [01-espacio-vacio.png](01-espacio-vacio.png)
- [02-crear-identificador-duda.png](02-crear-identificador-duda.png)
- [03-crear-sin-identificador.png](03-crear-sin-identificador.png)
- [04-membresia-configurada.png](04-membresia-configurada.png)
- [05-revisar-diez-sin-participantes.png](05-revisar-diez-sin-participantes.png)
- [06-sin-incidencias-diez-publicaciones.png](06-sin-incidencias-diez-publicaciones.png)
- [07-diez-publicadas.png](07-diez-publicadas.png)
- [08-publicadas-primer-tema.png](08-publicadas-primer-tema.png)
- [09-publicadas-segundo-tema.png](09-publicadas-segundo-tema.png)
- [transcript.jsonl](transcript.jsonl)
- [browser-events.jsonl](browser-events.jsonl)
