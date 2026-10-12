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
