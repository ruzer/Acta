# Acta — estudio de usabilidad

Investigación sobre `8940be59e64d8bd5568e80a1b0cc2a7c3af033ca`, 5 de octubre de 2026, America/Mexico_City (registros UTC del 6 de octubre). Producto: **Questions. Evidence. Decisions.**

## Executive summary

**Acta permitió completar los recorridos probados, pero no puede afirmarse todavía que una persona nueva lo use correctamente sin capacitación.** Fueron diez agentes independientes usando navegadores reales, no diez sujetos humanos. El acceso a árboles accesibles y la rapidez de lectura de un agente favorecen el descubrimiento frente a una persona; la sesión open source además pudo leer documentación pública.

La diferencia más importante no fue entre «tener» o «no tener» funciones. En 50 y 300 preguntas se descubrieron y usaron operaciones por lote sin instrucciones. Dos administradores, en cambio, prepararon diez preguntas con diez asignaciones y diez publicaciones individuales. El problema de escala es real como repetición/discoverability, pero esta versión **ya dispone** de la capacidad conjunta: no procede diagnosticar que falta e implementarla de nuevo.

Dos problemas destacan para estudiar primero: pérdida de foco tras ciertas operaciones y señales diferentes entre revisión individual de dependencias y publicación conjunta. Otros costes recuperables son trabajo Por consultar fuera del resumen, acceso indirecto a importar, membresía frente a asignación, contexto descartado y necesidad de volver para confirmar un envío. No se observaron pérdida de respuestas, corrupción de datos ni operaciones irreversibles equivocadas en estas sesiones; tampoco se probaron fallos de red o carga de producción.

Los datos, capturas y cuentas son ficticios y pertenecen a una instalación descartable independiente. No se cambió frontend, backend, contratos, esquema ni UX. No hay commit ni push. Las propuestas se separan del [registro de observaciones](FRICTION-LOG.md).

## Personas

| ID | Perfil simulado | Dataset | Acceso previo y límites | Sesión |
|---|---|---:|---|---|
| P01 | Administrador novato | Crea 10 | Sin instrucciones de controles ni documentación | [Registro](sessions/p01/SESSION.md) |
| P02 | Analista frecuente | 50 | Sin guía; proyecto propio | [Registro](sessions/p02/SESSION.md) |
| P03 | Analista de escala | 300 | Dos equipos/personas; no se le anunció selección, lotes o filtros | [Registro](sessions/p03/SESSION.md) |
| P04 | Participante novato | 10 | Sin terminología técnica ni guía | [Registro](sessions/p04/SESSION.md) |
| P05 | Participante ocupado | 30 | Interrupción y regreso en misma sesión, no días reales | [Registro](sessions/p05/SESSION.md) |
| P06 | Revisor | 10, tres envíos iniciales | Respuesta a aclaración por actor externo ficticio, sin guía de navegación | [Registro](sessions/p06/SESSION.md) |
| P07 | Administrador ocasional | 10 | Retorno simulado; no evidencia de memoria humana a dos meses | [Registro](sessions/p07/SESSION.md) |
| P08 | Participante móvil | 10 | Chromium 390 × 1000; no teléfono físico ni teclado virtual | [Registro](sessions/p08/SESSION.md) |
| P09 | Usuario exclusivamente de teclado | 10, actúa sobre 3 | Teclas reales; lectura de foco permitida, sin clic/fill/foco programático | [Registro](sessions/p09/SESSION.md) |
| P10 | Administrador open source | Importa 10 | README/guía públicos permitidos; instalación y cuenta ya preparadas | [Registro](sessions/p10/SESSION.md) |

Agentes con contexto nuevo y sesiones propias. Ninguno leyó informes ajenos ni código/tests. El evaluador heurístico trabajó después, sin recibir hallazgos. El control de accesibilidad se efectuó también después. Ver [protocolo](STUDY-PROTOCOL.md) y [datos](DATASETS.md).

## Tasks

**Expected path** es el camino semántico mínimo construido después de las sesiones, no una instrucción entregada ni un conteo ideal de clics. No se considera que toda diferencia sea un defecto: algunas son exploración normal o confirmaciones de seguridad.

| Persona | Expected path retrospectivo | Actual path y desviación observada |
|---|---|---|
| P01 | Crear proyecto → temas/preguntas → habilitar miembro → asignar → publicar → confirmar | Inicio vacío → Administración/Usuarios/Proyectos; intento sin ID; crea diez; membresía; descubre falta de asignaciones en Revisar; diez asignaciones + diez publicaciones individuales |
| P02 | Localizar contenido → corregir/reordenar → preparar área/persona → publicar conjunto válido | Resumen 0 publicadas → Editor; busca movimiento primero en selección y luego detalle; tres lotes de 50; vuelve de Revisar por señal de dependencia; comprueba filtros y publicación |
| P03 | Identificar alcance por equipo → áreas → personas → publicación de principales/seguimientos válidos | Descubre Organizar, página/tema/resultados; pierde selección al cambiar tema; cuatro lotes de área, dos de personas, uno de 300; vuelve de Revisar tras ver 60 errores |
| P04 | Localizar pendiente → responder parcialmente → guardar → salir → entrar → retomar → enviar | Recorrido completo; tras avance a pregunta 2, vuelve al listado y abre Ver para confirmar envío |
| P05 | Responder conocido → reservar duda → interrumpir → recuperar ambos tipos de trabajo → enviar | Dos envíos; una consulta y un borrador; reentrada prioriza borrador; Requiere atención vacío, encuentra consulta en Pendientes; cuatro envíos finales |
| P06 | Aportaciones → evidencia → aclaración/comparación → resolución → decisión con fuentes | Descubre cada operación; participante externo responde; vuelve desde detalle perdiendo filtro; el aviso externo le hace retomar aclaración; cierra hilo y confirma una decisión validada |
| P07 | Reconocer editor → editar tema/enunciado → comprobar participación → publicar | Acciones en menús; membresía ya activa; diez asignaciones y publicaciones; el movimiento pedido no se ejecuta porque ya estaba satisfecho |
| P08 | Localizar → texto/archivo → conservar → retomar → enviar; matriz → enviar | Completo a 390 px, scroll real; vuelve a lista para comprobar envíos y localizar matriz; dos detalles en lectura confirmados |
| P09 | Navegar con teclado → editar → asignar tres → publicar → mantener posición y confirmar | Completa escrituras; recupera SELECT con teclado; cancelar/guardar pierde foco; 14–15 Tab para volver; tres publicadas vistas como Analista, no como destinatario |
| P10 | Comprender producto → proyecto vacío → importar/preview/confirmar → membresía/asignación → publicar | Documentación ayuda; entra a editor vacío, pasa por publicadas/Mis proyectos/Resumen para hallar Importar; un lote de asignación; principal individual y nueve restantes por lote |

## Task success

Se preservan los criterios y límites de cada sesión. **Diez sesiones ejecutadas; nueve objetivos declarados completos dentro de su rol; P09 conserva verificación parcial de disponibilidad desde el destinatario.** Esto no es una tasa de éxito humana ni una prueba integral de permisos de seis proyectos administrativos.

| Persona | Resultado observable | Estado global / límite |
|---|---|---|
| P01 | Proyecto, 2 temas, 10 preguntas, miembro, 10 asignaciones y 10 publicaciones | COMPLETE administrativo; no login destinatario |
| P02 | 50 área/persona/publicadas; 1 enunciado editado y 1 movimiento entre temas | COMPLETE administrativo; no login destinatario |
| P03 | 180 operaciones/A, 120 servicios/B, 300 publicadas | COMPLETE administrativo; no respuesta A/B; eligió obligatoriedad por inferencia explícita |
| P04 | Borrador tras logout/login, contenido ampliado y un envío verificado en lectura | COMPLETE; 9 restantes fuera del objetivo |
| P05 | Consulta y borrador retomados; cuatro respuestas enviadas | COMPLETE; 26 restantes fuera de sesión breve |
| P06 | Evidencia leída, aclaración solicitada/respondida/cerrada, conflicto resuelto, decisión validada | COMPLETE; aviso externo para respuesta; segunda pregunta no validada ni requerida para el objetivo |
| P07 | Tema/enunciado modificados; diez asignadas/publicadas | COMPLETE; movimiento NOT ATTEMPTED por condición ya satisfecha; no login destinatario |
| P08 | Texto + archivo retomados/enviados; matriz enviada; ambos leídos después | COMPLETE; no móvil físico |
| P09 | Edición, tres asignaciones y publicaciones confirmadas | PARTIAL solo en comprobación como participante; escrituras COMPLETE |
| P10 | Proyecto, preview e importación 10/2, membresía, asignación y publicación | COMPLETE administrativo; no instala desde cero ni responde |

No contar cerrar navegador como éxito funcional. No contar las preguntas no solicitadas como fallos, ni estados preparados por fixture como logros del evaluador. No convertir un diálogo de confirmación abierto en operación aplicada. Las seis verificaciones administrativas (P01/P02/P03/P07/P09/P10) no sustituyen un ensayo posterior de acceso de cada destinatario.

### Esfuerzo y errores

| Señal medida | Resultado | Interpretación permitida |
|---|---|---|
| Acciones de P01 | 132 llamadas UI; 50 dedicadas a asignar/publicar diez | Evidencia de repetición, no duración humana |
| Acciones de P02 | 40 llamadas UI; tres lotes de 50, una edición/un movimiento | Descubrimiento útil de la capacidad conjunta |
| Acciones de P03 | 59 llamadas UI; siete lotes; ocho selecciones colectivas | 300 preguntas preparadas sin iterar una por una |
| Acciones de P10 | 40 llamadas UI; una carga de archivo y dos lotes | Lectura del README antecedió al descubrimiento de lotes |
| Teclado P09 | Recuperaciones de 14–15 Tab tras perder posición | Coste secuencial observable, no una preferencia estética |
| Error P01 | Intento de crear proyecto sin ID obligatorio | Recuperado en el mismo formulario |
| Error P09 | Selección nativa no cambió con flechas; posterior error de navegación | SELECT limitado por entorno; pérdida de posición sí observable; recuperación por teclado |
| Escrituras de producto | No fallos persistentes en subtareas ejecutadas | No prueba resistencia a red, concurrencia ni errores de servidor |

Las acciones proceden de llamadas registradas; no representan gestos humanos exactos ni contemplan toda lectura. No comparar 132 frente a 59 como velocidad entre 10 y 300: P01 creó contenido desde cero y P03 recibió borradores. Los tiempos brutos y su overhead están en sesiones; hubo una demora de canal de unos 6 min 30 s en los primeros recorridos. No se usan para ranking de rendimiento. No hubo SUS, SEQ ni valoraciones emocionales reales.

## Top friction points

Todos los IDs remiten al [log](FRICTION-LOG.md). Hipótesis de causa, **no diagnóstico de implementación**: esta etapa no inspeccionó el código para atribuir raíces.

| Prioridad | Problema real | Severidad | Frecuencia / personas | Evidencia | Hipótesis causal |
|---:|---|---|---|---|---|
| 1 | FRICTION-001: foco perdido tras operaciones | HIGH | P09, repetido; única sesión solo teclado | P09-O02–O04; contraste técnico en Accessibility | Distinto tratamiento del elemento que abrió cada diálogo |
| 2 | FRICTION-002: Revisar presenta bloqueo que lote completo resuelve | HIGH | Comparación directa P02/P03; paso adicional P10 | P02-O06, P03-O06, P10-O07 | Revisión individual y plan conjunto no comunican su diferencia de alcance |
| 3 | FRICTION-003: preparación individual repetida sin descubrir lotes | MEDIUM | P01/P07 de cinco sesiones comparables | P01-O06, P07-O07; positivos P02/P03 | Ruta Escribir→Revisar permite terminar sin encontrar la capacidad de Organizar |
| 4 | FRICTION-004: consulta reservada fuera de resumen | MEDIUM | P05, 1/1 consulta ensayada | P05-O04/O06, contador 29/30 | Categorías numéricas, filtro y etiqueta local describen subconjuntos diferentes |
| 5 | FRICTION-005: importación alejada del editor vacío | MEDIUM | P10, 1/1 importación | P10-O03 y editor vacío | Entrada esperada por tarea distinta de la navegación donde está disponible |
| 6 | FRICTION-006: aclaración respondida no distingue siguiente actor en lista | MEDIUM | P06, 1/1 hilo respondido | P06-O02 | Estado global abierto no expresa turno/último acto en la bandeja |
| 7 | FRICTION-007: membresía activa confundida con asignación | MEDIUM | P01/P07; P10 recupera con documentación | P01-O04, P07-O06, P10-O05 | Relación entre permiso del proyecto y responsabilidad concreta visible en pantallas distintas |
| 8 | FRICTION-008: primera administración recibe mensaje de esperar acceso | MEDIUM | P01/P10, 2/2 admins nuevos | P01-O01, P10-O01/O02 | Estado vacío común a roles con trabajos iniciales diferentes |
| 9 | FRICTION-009: contexto seleccionado descartado | MEDIUM | P02/P03/P10, 3/3 usuarios de lotes | P02-O08/O09, P03-O02/O03 | Protección contra alcance obsoleto obliga a reconstruir el conjunto sin distinguir tareas sucesivas |
| 10 | FRICTION-010: certeza del envío requiere volver a lista | MEDIUM | P04/P08, 2/3 participantes | P04-O08, P08-O07 | Avance inmediato prioriza continuidad, pero feedback duradero observado queda en otra vista |

No se elevan artificialmente todos a HIGH. La frecuencia de una persona no basta para descartarlo —teclado es esencial— ni para llamarlo universal. Revisión extensa/técnica, IDs manuales y pérdidas menores de contexto continúan en FRICTION-011–017 aunque no estén entre los diez.

## Cross-persona patterns

1. **Capacidad existente versus descubrimiento.** P02/P03 encontraron lotes en la interfaz; P10 los conoció mediante README; P01/P07 no los encontraron en su recorrido. Son vías distintas y no deben mezclarse como una tasa de descubrimiento espontáneo.
2. **Estado correcto versus certeza.** Guardados y publicaciones tuvieron feedback; varios usuarios hicieron una comprobación adicional en lista/detalle. El participante distingue enviado/validado, pero necesita localizar prueba del primer paso.
3. **Contexto se pierde donde empieza otra operación.** Selección tras lote, filtro al regresar a revisión y foco tras diálogo afectan tareas diferentes. No son el mismo bug ni justifican una solución única automática.
4. **Relaciones del dominio requieren explicación.** Membresía/asignación, área/persona, principal/seguimiento y resolución/validación no son equivalentes. La explicación situada funcionó mejor que el vocabulario de servidor/atomicidad.
5. **Repetición puede ser legítima.** Motivo de conflicto, resolución y decisión son actos distintos. El estudio registra coste; no autoriza fusionarlos ni preseleccionar fuentes sin revisión.

## Small questionnaire findings

Crear dentro de un tema, tipos legibles y estados de borrador funcionaron. P01 hizo treinta entradas de texto para diez preguntas por enunciado/título/ID, más ciclos de asignación/publicación. P07 reconoció menús y pudo editar. Un cuestionario pequeño puede terminarse incluso con una ruta poco eficiente: éxito no demuestra simplicidad.

El movimiento pedido a P07 ya estaba resuelto en los datos; se documenta como tarea no ensayada. P02 sí movió una pregunta y recibió confirmación de los dos órdenes.

## Large questionnaire findings

P03 preparó 300 preguntas en siete operaciones: cuatro cambios de área, dos asignaciones de personas y una publicación conjunta. Alcance página40/tema60/resultados300 fue explícito. P02 hizo tres operaciones sobre 50. No se observó bloqueo de escala en esas operaciones; no se midió rendimiento de producción ni lectura visual completa de 300 preguntas.

El coste residual se concentra en construir/reconstruir el conjunto, pasar de revisión individual a lote y recorrer listados repetitivos. Revisar llegó a 60 errores y después 300 ítems informativos. La simulación demuestra que el procesamiento conjunto existe y puede descubrirse; **no** que cualquier usuario de 300 preguntas lo descubrirá ni que necesite otra pantalla.

## Participant findings

P04/P05 conservaron borradores tras logout/login; P08 conservó texto y adjunto al salir/retomar. P05 pudo reservar una consulta sin inventar respuesta y luego completarla. El recorrido evitó reabrir Q4 ya enviada al enviar Q3. P04/P08 verificaron resultados en lectura, separados de la validación del analista.

Fricciones: Por consultar no contribuyó al resumen y no estuvo en Requiere atención; confirmación persistente del envío no observada en pregunta siguiente. En móvil el scroll permitió completar ambas tareas y la matriz se expresó como decisiones por fila, sin tabla horizontal. El selector nativo mostró señal inglesa discrepante, dependiente del entorno. No se evaluaron mano real, teclado virtual, conectividad móvil o retención prolongada.

## Analyst findings

La capacidad conjunta y sus previews transmiten alcance: aplicables, sin cambios, bloqueadas, participantes concretos. Área no asigna personas queda explícito. La señal de dependencia en Revisar genera trabajo/duda distinto al lote completo. En revisión de respuestas, la comparación y decisión con fuentes se completaron; resolver nunca se confundió con validar. El listado no diferenció claramente la aclaración ya respondida y el regreso perdió filtro de proyecto. No se demostró fallo de autorización, inmutabilidad ni consistencia de almacenamiento.

## Administrator findings

Primer proyecto e importación fueron posibles, pero la entrada vacía estaba redactada para quien espera permiso. La importación ofreció preview/confirmación correctos una vez encontrada. Ser miembro activo no asigna preguntas: la distinción fue descubierta en revisión o aprendida en documentación. El README ayudó a P10 a comprender el producto y los lotes; eso es ayuda pública útil, no descubrimiento sin documentación. Bootstrap, despliegue y administración de cuentas desde cero no se evaluaron.

## Accessibility findings

Ver [revisión técnica](ACCESSIBILITY.md) para resultados finales y límites; [P09](sessions/p09/SESSION.md) aporta las tareas completas de teclado y [P08](sessions/p08/SESSION.md) el uso móvil. El estudio distingue resultados automáticos, comprobación manual y experiencia simulada. Ninguno constituye una certificación WCAG ni una sesión con lector de pantalla.

Resultado técnico: **12 muestras finales axe (13 ejecuciones), 0 violations automáticas; 15 nodos en cuatro instancias incomplete de dos reglas**. No equivale a cero problemas. Se reprodujo el retorno de foco defectuoso y se observaron enlaces de error indistinguibles y una etiqueta ARIA en contenedor genérico. Un menú medido dio 16.86:1; dos párrafos conservan revisión manual exacta pendiente. Cuatro pantallas a 390/320 CSS px (ocho observaciones) no mostraron overflow horizontal del documento; no fue zoom real. Reduced motion se emuló en un estado del editor sin animaciones computadas en ambas preferencias, no en todas las transiciones.

El envío de matriz vacía creó un borrador pese al mensaje «No se pudo guardar»: ensayo técnico posterior, no cambio retroactivo del resultado P04. Se documentó sin eliminar el dato (FRICTION-018). Los nuevos hallazgos de accesibilidad quedan en FRICTION-019/020; no se inventa conformidad WCAG. Lectores de pantalla, zoom real, móviles físicos y contrastes pendientes requieren otra comprobación.

La pérdida de foco es un impacto de continuidad observado incluso cuando la operación funciona. La navegación entre modos mediante flechas funcionó y los controles de creación/edición mostraron foco visible. Los resultados técnicos posteriores complementan estas observaciones, no las anulan.

## HEART signals

HEART se utiliza para formular preguntas, no para inventar métricas de producción. Referencia: [Google Research](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).

| Dimensión | Evidencia actual | Qué medir después con personas/uso autorizado |
|---|---|---|
| Happiness | No medida. Dudas/certeza son interpretación de agentes y señales UI | Pregunta breve de facilidad/confianza tras tarea; entrevistas sobre momento de duda |
| Engagement | Número de pasos de tareas impuestas, no engagement espontáneo | Finalización significativa de trabajo; no maximizar clics ni permanencia |
| Adoption | Dos descubrimientos espontáneos de lotes; uno con documentación; dos no descubrimientos en ruta | Primera tarea completada sin ayuda; qué entrada permitió descubrir una capacidad |
| Retention | P04/P05 retoman tras cierre inmediato; P07 retorno solo simulado | Reanudación real después de días/semanas y recuperación de contexto |
| Task Success | Resultados por subtarea/rol, errores recuperados, repetición y límites | Éxito sin ayuda, errores reales, esfuerzo de tarea comparable y confirmación desde cada rol |

No añadir telemetría ni rastreo como resultado de este estudio. Cualquier medición futura necesita propósito, minimización y decisión explícita de privacidad.

## Things Acta already does well

- Lenguaje de tarea en respuestas y tipos; enunciados completos y agrupación por temas.
- Guardar separado de enviar, con explicación de privacidad/inmutabilidad.
- Borradores, comentarios, selección múltiple y evidencia conservados en los recorridos.
- Consulta reservada permite avanzar sin fabricar respuesta.
- Matriz vertical utilizable a 390 px y lectura posterior compacta.
- Revisión identifica faltantes y ofrece corrección contextual; advertencias distinguen no bloqueante.
- Lotes muestran alcance y plan antes de confirmar; no se observó escritura equivocada.
- Importación muestra cantidades y valida antes de crear estructura.
- Descartar cambios protege el contenido; evaluación heurística verificó cancelar y descartar sin guardar.
- Conflicto, aclaración, resolución y decisión conservan distinciones; decisión validada muestra alcance, excepciones y fuentes.

## Things users did not discover

Registrar ausencia de descubrimiento **en la ruta recorrida**, no inexistencia de función:

- P01/P07 no descubrieron preparación conjunta; P09 no la necesitó para su ensayo acotado.
- P10 no encontró importar desde el editor vacío, pero sí después desde Resumen.
- P05 no encontró consulta reservada en Requiere atención; la recuperó en Pendientes.
- P06 no demostró descubrir respuesta nueva al hilo sin aviso externo.
- P08 no usó búsqueda; descubrió colapso de temas al comprobar resultados. No se interpreta falta de uso como fracaso si la tarea se cumplió.

## Repetitive workflows

- Diez asignaciones y diez publicaciones individuales en P01/P07.
- Reconstruir selección para acciones sucesivas en P02/P03/P10.
- Repetir enunciado/título/identificador al crear preguntas (P01).
- Seleccionar dos fuentes al marcar, resolver y decidir (P06); actos diferentes, coste no necesariamente prescindible.
- Volver a lista/detalle para comprobar envíos (P04/P08).
- Volver a la pregunta con 14–15 Tab tras operaciones (P09).
- Avisos repetidos de publicación/asignación en Revisar (varios tamaños).

## Unnecessary complexity

La evidencia permite identificar **candidatos**, no declarar innecesarias reglas del dominio: mensajes de implementación para tareas ordinarias, navegación hacia importar/primer proyecto, relectura de avisos iguales, reconstrucción del contexto y coexistencia de categorías que no explican dónde quedó una consulta. Ver [revisión de simplicidad](SIMPLICITY-REVIEW.md), preparada después del cierre de investigación. Nada de esto autoriza quitar la confirmación de operaciones, asignar miembros automáticamente, autogenerar IDs o combinar resolución/validación.

## Risks

- Agentes técnicamente capaces no representan usuarios novatos reales. Árbol accesible global y auto-scroll de localizadores pueden facilitar descubrimiento. P09 sí restringió acciones a teclado y P08 hizo scroll explícito.
- Los 300 elementos repiten diez patrones neutrales; no representan 300 enunciados largos únicos ni estructura institucional. Todos usan condiciones simples del fixture y no se ensayaron configuraciones arbitrarias/ciclos.
- El revisor recibió aviso externo de respuesta; no se comprobó espera/descubrimiento autónomo.
- Validación de disponibilidad administrativa no es login de todos los destinatarios ni auditoría de permisos.
- Snapshots transitorios/login, timeouts de localizador y rechazo de auto-review quedan fuera de problemas del producto. La apertura de publicación quedó limitada en la heurística; no se reintentó.
- Algunas salidas console.log no quedaron en el retorno JSON del transcript. Hay informes y capturas, pero no se afirma transcripción completa de todos los árboles.
- No hay participantes humanos, lector de pantalla real, dispositivo táctil, retención larga, carga concurrente, errores de red ni WCAG completo.
- No usar hipótesis como diagnóstico de código ni este estudio como aprobación automática de rediseño. Cualquier cambio requiere objetivo acotado y repetir tareas comparables.

## Lectura y trazabilidad

[Protocolo](STUDY-PROTOCOL.md) · [Datasets](DATASETS.md) · [Friction log](FRICTION-LOG.md) · [Heurísticas](HEURISTIC-REVIEW.md) · [Accesibilidad](ACCESSIBILITY.md) · [Simplicidad](SIMPLICITY-REVIEW.md) · [Propuestas](PROPOSALS.md) · [Índice de evidencias](EVIDENCE.md).

## Estado de cierre

Investigación cerrada tras diez sesiones, revisión heurística independiente y comprobación técnica de accesibilidad. Propuestas redactadas después (2026-10-06 05:23 UTC). **ACTA USABILITY STUDY COMPLETE: YES** significa que se ejecutó y documentó este estudio con sus límites, no que Acta esté libre de fricción ni certificado para todos los usuarios.
