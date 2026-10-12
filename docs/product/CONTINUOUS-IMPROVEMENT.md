# Mejora continua de Acta

Registro ligero de oportunidades concretas para que Acta sea más fácil de comprender, usar y mantener. Una página por iteración; cada entrada dice el problema, la evidencia, la mejora, su estado y el resultado. No contiene métricas de productividad ni resultados con personas: la evidencia es lo observado en una sesión técnica con datos ficticios.

Principio: eliminar, simplificar, reorganizar y reutilizar antes de añadir. Las mejoras pequeñas, compatibles y sin cambios de contratos, permisos ni migraciones se implementan directamente en una rama; las importantes se proponen primero.

## Iteración 1 — 2026-10-11

**Cómo se exploró.** Chromium sobre una instalación desechable con datos ficticios (puertos y base propios). Recorridos como ADMIN (crear proyecto, áreas, miembros), ANALYST (importar, organizar, asignar, publicar, invitar, revisar), STAKEHOLDER (responder, enviar), VIEWER e INVITADO externo (enlace privado). Se partió de los documentos de UX existentes y no se repitieron sus auditorías.

| # | Problema | Evidencia | Mejora | Estado |
|---|---|---|---|---|
| 1 | El asistente de invitación bloquea «Continuar» por un campo que no se ve | «Área de la aportación» es obligatoria y estaba al final del paso «Preguntas», bajo una lista larga y tapada por el pie fijo: aparecía solo una burbuja nativa del navegador | Se pide en el primer paso, junto al destinatario, con una ayuda breve. Mismos datos y reglas | Hecho (PR de esta iteración) |
| 2 | La importación pide copiar el identificador del proyecto, pero no se muestra en ningún sitio | La ayuda dice «Copia su identificador externo exactamente»; el listado de proyectos ya lo entrega y la interfaz no lo usaba. Los errores se veían como información | Se muestra donde se elige el archivo y junto al error de coincidencia; los errores usan el estilo de error y las advertencias siguen informativas | Hecho |
| 3 | Con un solo elemento el texto queda mal: «1 preguntas», «Volver a 1 aportaciones», «1 errores» | Unos 30 textos unían un número con un plural fijo; había ~15 con manejo manual correcto | Un ayudante `plural()` junto a los componentes de UI, aplicado donde faltaba el singular y con concordancia de verbo y adjetivo | Hecho |
| 4 | Estados vacíos sin siguiente paso | Un cuestionario vacío mostraba la barra de uno de 300 preguntas y un «Nueva pregunta» que parecía deshabilitado sin explicación; Atención vacía no indicaba a dónde ir; Invitaciones decía «en esta página» sin haber ninguna | Cuestionario vacío con una sola acción dentro de su tarjeta (y la razón si falta un área activa); enlace al cuestionario en Atención para el analista; mensajes de Invitaciones según el caso | Hecho |
| 5 | Tras decidir una pregunta no hay «siguiente por revisar» | Cada decisión obliga a volver a Atención y localizar la fila siguiente: dos pasos repetidos por pregunta de la cola | **Propuesta, no implementada**: ofrecer «Siguiente pregunta por revisar» usando el orden de la cola de Atención que ya está en el contexto de sesión | Hecho en la iteración 2, con la lista, el orden y los filtros de Atención y solo con datos ya cargados |

**Verificación.** Unitarias y de componente completas, lint, typecheck y formato de lo tocado; E2E focalizadas en Chromium de los recorridos afectados (invitaciones, importación, lotes, cuestionario, plataforma, editor y atención). La suite completa queda para el CI del PR. Los tests que fijaban los textos erróneos se actualizaron y están nombrados en los commits.

**Observado y no priorizado** (candidatos a la siguiente iteración): Administración › Proyectos no lista los proyectos ni enlaza al proyecto recién creado, y «Identificador externo» no dice para qué sirve; en Organizar, los controles ocupan la mayor parte de la primera pantalla (con 10 preguntas se ven 3) y «Seleccionar esta página» y «Todos los resultados» coinciden cuando todo cabe en una página; el `h1` recibe un recuadro de foco muy marcado al cargar sin ratón; Miembros conserva un enlace «← Cuestionario» además de la ruta de migas.

**Límites.** Una sesión, Chromium, datos ficticios y sin personas usuarias reales: no hay conclusiones sobre productividad ni sobre comprensión.

## Iteración 2 — 2026-10-12

Autorizada por producto. Se resolvieron las cuatro oportunidades acordadas, sin cambios de contratos ni de backend: «Siguiente por revisar» (entrada 5 de la iteración 1), Administración › Proyectos con lista y accesos, controles de Organizar más ligeros y el identificador explicado en el alta. Pendiente de la iteración 1 que sigue abierto: el recuadro de foco del `h1` al cargar sin ratón y el enlace «← Cuestionario» de Miembros. Los dos botones de selección de Organizar se dejan como están: duplican su conteo solo cuando todo cabe en una página, están plegados por defecto y fundirlos habría tocado ~10 pruebas por poco beneficio.

## Iteración 3 — 2026-10-12

Exploración con un proyecto ficticio de 300 preguntas y 41 aportaciones (analista, participante, administración). Con 300 preguntas la importación, la asignación y la publicación en lote tardan menos de un segundo, y «Mi trabajo» y Atención ya escalan; lo que quedaba era la tarea más repetida: decidir.

| Problema | Evidencia | Mejora | Resultado |
|---|---|---|---|
| Decidir cada pregunta pedía más pasos de los necesarios y el campo obligatorio «Fuentes» quedaba fuera de la vista del diálogo, con un error genérico | El diálogo muestra cuatro cuadros altos; las fuentes quedan bajo el pliegue, el foco abre en «Cerrar» y el error no dice qué falta | Fuente única ya elegida, foco inicial en el primer campo y mensaje específico que enfoca la fuente | 12 decisiones seguidas con «Siguiente por revisar»: 5 acciones por pregunta más el salto |
| «Escribir» con 300 preguntas era una página de ~48 000 px y ~5 600 nodos | Medido en el navegador; «Mi trabajo» ya pliega por tema | Temas plegados desde 40 preguntas, el primero abierto por identificador | Prueba E2E de reordenar con 300 preguntas ajustada por el diseño, no debilitada |
| Tras una operación en lote el mismo mensaje salía dos veces | «Operación aplicada: 300 preguntas…» arriba y junto a la selección | Se dice una vez | Aserción E2E de que aparece una sola vez |
| «Contraseña temporal» como botón parecía un estado | Fila de usuarios | «Restablecer contraseña», con el nombre para lectores de pantalla | Hecho |

Pendiente (resuelto en la iteración 4): Decisiones y Bitácora con volumen no se llegaron a medir (se reinició la base de pruebas). Se descarta el recuadro de foco del `h1`: aparece solo con foco por teclado o sin ratón y es lo esperado. «← Cuestionario» de Miembros se quedó entonces; la iteración 4 lo hace depender de dónde llegó la persona.

## Iteración 4 — 2026-10-12

Exploración con un proyecto ficticio de 150 preguntas, 63 invitaciones (50 aportaciones en una pregunta, 12 en otras dos y una persona respondiendo 127), 120 decisiones y 658 eventos de bitácora, como analista y como administrador. La revisión de una pregunta con 50 aportaciones ya funciona bien (lista con búsqueda y filtro, contraste con selectores); los problemas estaban en lo que rodea a la decisión y en los registros largos.

| Problema | Evidencia | Mejora | Resultado |
|---|---|---|---|
| Decidir con 50 aportaciones obliga a marcar 50 casillas sin ver qué dice cada una | Diálogo de ~3 100 px, casillas con solo «Invitación: … · envío #1», sin conteo ni selección en bloque | Con más de seis fuentes: conteo, «Seleccionar todas», «Quitar selección», inicio de cada respuesta y lista acotada | Diálogo de ~1 300 px; el foco se queda en el botón pulsado (una primera versión lo deshabilitaba y lo perdía) |
| La Bitácora pedía escribir el código en inglés y ocultaba qué pregunta era | «Objeto: Question, ImportBatch…» y «Acción» como texto libre con filtro exacto; cada evento de decisión decía «Pregunta ▸ Identificador» (un UUID) | Listas en español con el código por debajo; las preguntas se nombran y enlazan a su revisión con datos ya cargados; «Detalle» solo si hay detalle; «Página 1 de N» | 120 eventos de decisión distinguibles; sin cambios de API |
| Decisiones con 120 registros repetía «Vigente» y ocupaba ~14 900 px | 121 px por fila y la misma marca en todas | Una línea por decisión y sin la marca repetida | ~6 200 px (49 px por fila); en móvil 70 px |
| Miembros abierto desde Administración ofrecía «← Cuestionario» | El administrador llega desde Administración › Proyectos y el único retorno iba al editor | Vuelve a Administración, a la lista de Proyectos; desde el proyecto sigue volviendo al cuestionario | Hecho |

**Verificación.** Unitarias de lo tocado (decisión, Bitácora, Decisiones, Administración), lint y typecheck, y las 121 E2E de los recorridos relacionados (decisiones y conflictos, intercambio, revisión, plataforma, Atención, UX y Direction C) sobre una base reiniciada. La suite completa queda para el CI del PR.

**Decisión de diseño.** Se retira la marca «Vigente» de cada fila de Decisiones porque la lista solo contiene decisiones vigentes y la página ya lo dice; el estado no se pierde, simplemente no se repite. Los tests de CP5 y V-12 que la fijaban se actualizaron a propósito.

**Observado y no hecho** (necesita el servidor o es de poco valor): la lista de Decisiones no puede mostrar el texto de cada decisión porque la proyección actual no lo entrega (cambio de contrato: propuesta pendiente); los eventos de respuesta (borrador/envío) de la Bitácora solo traen el identificador de la respuesta y no se pueden nombrar sin ampliar la API; el selector de «Actor» de la Bitácora lista a cada invitación como una persona más (66 opciones).

## Iteración 5 — 2026-10-12

Decisiones y trazabilidad para quien tiene que entender el resultado sin abrir cada pantalla. Mismo proyecto ficticio de volumen (150 preguntas, 63 invitaciones, 120 decisiones, 658 eventos) con una decisión reabierta, una con segunda versión, una larga con excepciones y una cerrada como «no aplica». Por primera vez hay **ampliación de contratos de lectura**, compatible y sin tocar permisos, escrituras, estados ni migraciones.

| Problema | Evidencia | Mejora | Resultado |
|---|---|---|---|
| El listado de Decisiones identifica la pregunta, pero no dice qué se decidió | La proyección del tablero solo trae estado y conteos; había que abrir las 120 | Nuevo `GET /projects/:id/decisions` (solo ADMIN/ANALYST): una lectura, extractos de 240 caracteres, alcance, fecha, autor, excepciones y decisiones anteriores; la página los muestra y la búsqueda encuentra por su texto | Una línea por decisión con su contenido; si el endpoint falla, la lista sigue como antes |
| Los estados no se distinguían: una decisión que dejó de estar vigente no aparecía en ningún sitio y su pestaña «Decisión» solo mostraba una lista cerrada | Q-004 reabierta: ni en Decisiones ni una frase que lo dijera | Grupo «Sin decisión vigente» con el antecedente y el motivo; línea de resumen (con decisión anterior · por decidir, con enlace a Atención); la pestaña dice «No hay una decisión vigente…» | Vigente, anterior, sin decisión vigente y por decidir se distinguen sin añadir marcas por fila |
| Los eventos de respuestas no decían qué pregunta afectaban | 201 «Respuesta enviada»/«Borrador guardado» solo con «Identificador»; el primer borrador se registra con el id de la pregunta | `history` añade `subject` (pregunta o etiqueta de la invitación) con una lectura por tipo, sin consulta por evento; la página lo muestra con enlace que vuelve a la Bitácora con sus filtros | Los 25 eventos de una página quedan nombrados; lo que no se puede nombrar conserva su identificador |
| El filtro «Actor» listaba a cada invitación | 66 opciones con 63 invitaciones | Cuentas + «Invitaciones externas (N)» (`actorKind`) y el actor filtrado si es una invitación | Lista de 4 opciones con el mismo proyecto |

**Contratos (solo lectura, aditivos).** `decisionRegisterView` (nuevo); `historyView`: `items[].subject`, `invitationActors` y `actors` solo cuentas; `historyQuery`: `actorKind`. `auditSummary` (usado por la exportación) no cambia. Documentado en `docs/CONTRACTS-2E.md`.

**Garantías comprobadas con pruebas de integración.** Solo ADMIN/ANALYST (VIEWER, STAKEHOLDER y otro participante reciben 403; sin sesión 401; un proyecto ajeno no filtra nada); la decisión histórica nunca se presenta como vigente (estado `REOPENED`, con motivo y fecha de fin); una pregunta cerrada como «no aplica» no se lista como reabierta; el texto completo, el comentario interno y las fuentes no salen; el extracto se corta en una palabra.

**Observado y no hecho.** Las decisiones de «no aplica» tampoco aparecen en Decisiones (es un cambio de significado de la página: queda como propuesta); las 120 filas con contenido miden unos 10 000 px (el costo de mostrar qué se decidió; la búsqueda y los filtros acotan); el nombre de otros objetos de la Bitácora (evidencia, asignaciones) no se resuelve.

