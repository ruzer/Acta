# ACTA NEXT — implementación y verificación

Base funcional: Acta v0.4.0, `d92cd9b8abd9d0bafbad24ca218233be1070f024`.
Rama de trabajo: `feat/acta-next-frontend`. Fecha: 7 de octubre de 2026.

La evolución recompone el frontend. El backend, el contrato compartido, Prisma,
las autorizaciones y las reglas de publicación, asignación, respuesta y evidencia
siguen siendo los de v0.4.0. Las pruebas usan datos ficticios y un stack aislado.

## Checkpoints

| Checkpoint | Alcance                                                    | Estado                                        |
| ---------- | ---------------------------------------------------------- | --------------------------------------------- |
| 1          | Cuestionario, Organizar, aportaciones y autoría contextual | Implementado y verificado de forma focalizada |
| 2          | Atención, navegación y retorno al contexto                 | Implementado y verificado de forma focalizada |
| 3          | Contraste y decisión documental                            | Implementado y verificado de forma focalizada |
| 4          | Invitaciones, invitado y ajustes del participante          | Pendiente                                     |

El objetivo completo todavía no está terminado. Las capturas de un checkpoint
no demuestran los siguientes; la revisión funcional completa y CI remoto quedan
para la integración final.

## Datos y contratos

La autoridad compartida sigue en `packages/contracts/src/index.ts`.

| Presentación                           | Fuente existente                                             | Interpretación                                                   |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Estructura y preparación               | `questionnaireView`                                          | Misma identidad, orden, grupo, área y asignaciones               |
| Número de aportaciones                 | `dashboardView.questions[].submittedRespondents`             | Envíos vigentes según la cobertura del backend                   |
| Conjunto de aportaciones               | `reviewDetailView.submissions` filtradas por `current`       | Una aportación vigente por línea de respuesta; historia separada |
| Aclaración/conflicto de una aportación | Hilos y participantes del conflicto por `responseRevisionId` | Señales de esa revisión concreta                                 |
| Publicación y estado operativo         | `QuestionView.publication/status` y proyección de dashboard  | No se crean estados nuevos                                       |

N no cuenta versiones, borradores privados, archivos ni mensajes. Tampoco mide
consenso. Una pregunta en preparación muestra cero envíos; para preguntas
publicadas, la ausencia de una proyección no se convierte en cero: se muestra
carga o indisponibilidad. Los errores permiten reintentar.

El editor carga el cuestionario y el dashboard; no solicita el detalle de cada
una de las 304 preguntas. El detalle se obtiene al abrir una pregunta.

### CONTRACT GAP — contexto del invitado

`invitationAccessView` expone `invitationId`, `csrfToken`, `expiresAt`,
`allowEvidence` y `work`. No entrega la identidad o etiqueta del destinatario.
El gestor autenticado sí tiene esos datos; la sesión de invitación no puede
consultarlo. Se detiene únicamente la presentación del destinatario previsto:
no se añade una API, se adivina una identidad ni se interpreta el enlace como
prueba de identidad. Organización, proyecto, vigencia y progreso sí están
expuestos y pueden utilizarse en el checkpoint 4.

El detalle de revisión tampoco entrega un origen estructurado independiente de
`respondent.displayName`. Se muestra el actor que entrega el contrato; no se
infiere una identidad verificada a partir de un prefijo textual.

## Checkpoint 1

- Organizar es la entrada del editor. Preparar y Analizar son enfoques de las
  mismas preguntas, sin duplicar datos ni estados.
- Bandas de tema, sangría, colapso de grupos y contexto de la principal cuando un
  filtro encuentra únicamente al seguimiento.
- Área, aportaciones, estado y acción junto al enunciado. Código y tipo son
  secundarios. En móvil se presentan como bloques, sin comprimir una tabla.
- La selección conserva los alcances de página, resultados, tema y grupo. Se
  avisa antes de seleccionar preguntas fuera de página/filtro o plegadas.
  Contraer no selecciona ni deselecciona; los filtros limpian la selección como
  en v0.4.0. Se distingue cuántas seleccionadas están fuera de la página.
- El conjunto muestra 0/1/N: cero explica la ausencia de envíos; uno abre la
  respuesta; varios presentan primero actores, áreas, extractos, evidencia y
  señales. A partir de diez hay búsqueda por actor/área y filtro de situación.
- El historial se conserva separado. Abrir/volver restaura el foco y filtros.
- La autoría inicia por el enunciado. Tipos, tema y obligatoriedad siguen
  accesibles; opciones/MATRIX se presentan junto al tipo. Identificadores
  obligatorios permanecen visibles y la configuración avanzada sigue plegable.
- Los errores abren su grupo, mantienen contenido y enfocan el control concreto.

El contexto de presentación vive solamente en la caché de la sesión:
`questionnaire-context`. No se escribe en almacenamiento del navegador y se
borra al cerrar sesión o cambiar de usuario. Su permanencia no depende de los
cinco minutos de recolección de caché. El checkpoint 2 completa posición y retorno de foco mediante `workbench-context`, también limitado a la sesión.

### Evidencia de verificación

- Pruebas de componente: selección, jerarquía, estado de carga/error, N derivado,
  filtros, conservación de contexto y foco con Strict Mode.
- Playwright: importación real de cuestionarios ficticios de **12, 54 y 304**
  preguntas; identidad y DRAFT conservados; búsqueda, área, publicación, selección,
  colapso, inspector y retorno de foco.
- Regresión bulk existente: 304 asignaciones de área; grupo, participantes,
  publicación atómica de muestra; confirmación obsoleta sin aplicación parcial.
- Aportaciones reales por APIs oficiales: **0, 1, 3 y 12**. El caso de tres añade
  una revisión histórica, evidencia PDF ficticia, borrador privado posterior,
  conflicto y aclaración. N sigue siendo tres.
- Crear/editar MATRIX contra el backend real conserva los campos no editados.
  Los errores anidados de servidor se prueban también con una respuesta 400
  simulada explícita; esta simulación no demuestra un error real de backend.
- Anchos **1440, 1024, 768 y 390**: teclado, reflow, capturas y axe. Aportaciones:
  16 recorridos, sin violaciones ni desbordamiento. Autoría: ocho barridos sin
  violaciones; algunos contrastes fuera del área visible quedan incompletos.
  El caso visible de 1024 se revisó visualmente y con un barrido focalizado.

Cero violaciones de axe no equivale a certificación WCAG. Los recorridos son
simulaciones técnicas, no estudios con personas ni mediciones de productividad.

### Fricciones detectadas y corregidas

1. Strict Mode capturaba como retorno el encabezado del inspector en lugar del
   botón original. Se conserva el opener entre ejecuciones del efecto.
2. Plegar un grupo en otra página enviaba a la primera. Se conserva la página.
3. Un seguimiento que coincidía con un filtro podía quedar oculto por una
   principal excluida y plegada. Se conserva visible con contexto de la principal.
4. La caché eliminaba el contexto después de cinco minutos. Se mantiene hasta
   finalizar la sesión.
5. Si una aportación deja de coincidir con el filtro durante su lectura, el
   retorno usa el encabezado del conjunto cuando el botón anterior ya no existe.

El checkpoint 2 elimina la repetición de la cabecera de preparación y añade la navegación del proyecto. La lista de 12 aportaciones requiere desplazamiento en móvil;
el buscador permite acotar actor y área sin ocultar aportaciones silenciosamente.

## Regresión final pendiente

- Completar checkpoint 4 y sus recorridos visuales.
- Pruebas funcionales completas, PostgreSQL, navegador y CI remoto.
- Simulación integral de administrador, analista a escala, analista de
  aportaciones/conflictos, participante e invitado móvil.
- PR con DCO; sin release ni tag.

## Capturas del checkpoint 1

Procedencia: aplicación real con datos ficticios en una instalación aislada.
Son evidencia del checkpoint; la navegación definitiva se completa después.

- [Cuestionario 304, escritorio](acta-next-evidence/checkpoint-1/questionnaire-304-1440.png).
- [Cuestionario 304, móvil](acta-next-evidence/checkpoint-1/questionnaire-304-390.png).
- [Tres aportaciones, escritorio](acta-next-evidence/checkpoint-1/contributions-3-1440.png).
- [Tres aportaciones, móvil](acta-next-evidence/checkpoint-1/contributions-3-390.png).
- [Autoría, escritorio](acta-next-evidence/checkpoint-1/authoring-1440.png).
- [MATRIX, móvil](acta-next-evidence/checkpoint-1/authoring-matrix-390.png).

Regresión focalizada ejecutada: `bulk.spec.ts` (3/3),
`editor.spec.ts` + `simplicity.spec.ts` (11/11) y
`next-questionnaire.spec.ts` (3/3). Los cinco recorridos antiguos que
asumían la entrada Escribir ahora la seleccionan explícitamente. Sus aserciones
siguen intactas; no se incorporaron retries ni skips.


## Checkpoint 2

Atención, Cuestionario y Decisiones son destinos estables del proyecto para
ADMIN/ANALYST. Invitaciones queda visible como acceso secundario; herramientas,
importación, exportación, trazabilidad y bitácora siguen accesibles. VIEWER y
STAKEHOLDER conservan sus destinos y permisos anteriores. No se exponen enlaces
privilegiados sin un rol confirmado.

- Atención muestra conflictos, preguntas con aclaraciones abiertas, respondidas
  listas para revisión de decisión e invitaciones sin revocar que vencen dentro
  de siete días. Cada grupo expresa su unidad; no se suman grupos solapados.
- Conflictos y respondidas usan el estado proyectado del dashboard. Aclaraciones
  usa toda la bandeja paginada de ANALYST; para ADMIN/proyectos archivados se
  conserva CLARIFICATION_REQUIRED y se consultan los conflictos cuyo estado puede
  ocultar un hilo abierto, con concurrencia limitada a cuatro lecturas.
- Invitaciones consulta las páginas del endpoint existente antes de filtrar.
  Un error, cambio de total o conjunto incompleto muestra indisponibilidad, nunca
  un cero engañoso. La fecha se actualiza cada minuto en vistas abiertas.
- Decisiones lista únicamente preguntas VALIDATED de la proyección existente,
  con búsqueda, área y tema. La lectura documental se completa en el checkpoint 3 descrito abajo.
- El retorno conserva filtros, tema, selección, página, posición y foco según el
  destino. Los filtros/página de invitaciones están en la URL. La caché local de
  presentación se limpia al cerrar sesión o cambiar de cuenta.
- Se distingue **Revisar publicación** del editor de **Revisar respuestas**.
  No cambian comandos, reglas, estados ni validaciones del backend.
- Resumen, estados y desgloses permanecen en «Resumen y métricas». El contexto
  del proyecto se reutiliza también en las herramientas secundarias.

### Verificación del checkpoint 2

- `next-workbench.spec.ts`: **10/10**. Navegación por teclado y axe a
  1440/1024/768/390; retorno desde Atención/Decisiones; filtros/selección/página y
  scroll del cuestionario a 1440 y 390; invitación de la segunda página API;
  revocada excluida; retorno al gestor conservando página; cuatro roles.
- Regresión: editor **8/8**, simplicidad **3/3**, intercambio **3/3**, invitaciones
  **7/7**, revisión **4/4** y cuestionario a escalas 12/54/304 **3/3**.
  Son ejecuciones focalizadas, no una afirmación de suite completa ni de CI remoto.
- Componentes: **194/194**; lint, typecheck, build y diff check aprobados.
  La compilación mantiene la advertencia de tamaño del bundle principal.
- Galería real: **16 recorridos**, cuatro destinos a cuatro anchos; cero
  violaciones axe, overflow horizontal o errores JavaScript. No equivale a
  certificación WCAG. Las capturas representan datos ficticios de prueba.
- El primer ensayo detectó un error en el fixture de la prueba de participante:
  la aclaración se pedía a una revisión elegida por posición. Ahora selecciona
  explícitamente al participante previsto por su identidad. No se cambió el
  comportamiento del producto ni se añadieron retries/skips.
- La revisión visual redujo cabeceras repetidas y altura de las entradas móviles
  conservando tipografía legible y controles táctiles. No se midió productividad
  humana. El nombre largo del proyecto de prueba verifica el reflujo.

### Capturas del checkpoint 2

- [Atención, escritorio](acta-next-evidence/checkpoint-2/attention-1440.png).
- [Atención, móvil](acta-next-evidence/checkpoint-2/attention-390.png).
- [Cuestionario, escritorio](acta-next-evidence/checkpoint-2/questionnaire-1440.png).
- [Cuestionario, móvil](acta-next-evidence/checkpoint-2/questionnaire-390.png).
- [Decisiones, escritorio](acta-next-evidence/checkpoint-2/decisions-1440.png).
- [Decisiones, móvil](acta-next-evidence/checkpoint-2/decisions-390.png).


## Checkpoint 3

El conjunto de aportaciones permite contrastar dos envíos vigentes sin crear un
conflicto, una votación ni una decisión. Con tres o doce aportaciones se elige el
par A/B; una misma fuente no puede ocupar las dos posturas. El contador expresa
«Comparando 2 de N». El filtro del conjunto y el foco se conservan al volver.

Un conflicto conserva exactamente sus fuentes registradas. Cuando estas son
vigentes se informa su alcance dentro de N; si incluye fuentes históricas se
identifica expresamente el conjunto histórico. Las fuentes no disponibles no se
sustituyen silenciosamente. Actor/área, respuesta, contexto, evidencia y versión
mantienen el mismo orden y peso visual en ambas posturas. El conflicto abierto
precede al resto de aportaciones; resolverlo sigue siendo distinto de validar.

La decisión muestra el identificador real del registro, estado, validador/fecha,
pregunta contextual, resultado, alcance, excepciones y fuentes consultables.
No crea un identificador oficial, documento nuevo ni efecto jurídico. Las fuentes
abren el envío vinculado y conservan la descarga autorizada existente. El historial
permanece después del resultado y «Reabrir pregunta» es secundaria. Los permisos
de revisión y la vista de solo lectura no cambian.

### Verificación del checkpoint 3

- Componentes: **205/205**, incluidos ocho casos de contraste y tres pruebas
  adicionales de retorno, fuentes y presentación de decisión/permisos.
- Revisión E2E: **4/4**, aclaración, respuesta, cierre, decisión, reapertura,
  conflicto, resolución y evidencia. La descarga desde una fuente de decisión
  conserva exactamente los bytes descargados desde la postura original.
- Galería real: **16 recorridos** a 1440/1024/768/390 con conjuntos de tres y doce,
  conflicto y decisión. Sin violaciones axe, overflow, errores JavaScript ni
  escrituras al backend durante el contraste. Teclado, foco, vuelta al filtro y
  consulta desplegable de fuentes comprobados.
- La revisión visual descubrió una colisión de cascada CSS al introducir el
  separador A/B. Se corrigió el alcance del selector y se añadió una aserción
  geométrica: misma altura inicial/ancho en escritorio, bloques consecutivos en
  móvil. No se recorta ninguna respuesta para igualar alturas.
- Lint, typecheck y build aprobados. La advertencia existente de tamaño del bundle
  permanece visible. No se añadieron retries ni skips. La primera ejecución de
  una prueba nueva corrigió su expectativa al rótulo real «Fuentes utilizadas»;
  un ensayo de galería corrigió el nombre del buscador, sin cambios al producto.

### Capturas del checkpoint 3

Procedencia: aplicación real con datos exclusivamente ficticios. Las capturas
centradas en el contraste muestran las posturas después de desplazar la página.

- [Doce aportaciones, escritorio](acta-next-evidence/checkpoint-3/compare-12-1440.png).
- [Doce aportaciones, móvil](acta-next-evidence/checkpoint-3/compare-12-390.png).
- [Conflicto, escritorio](acta-next-evidence/checkpoint-3/conflict-1440.png).
- [Conflicto, móvil](acta-next-evidence/checkpoint-3/conflict-390.png).
- [Decisión, escritorio](acta-next-evidence/checkpoint-3/decision-1440.png).
- [Decisión, móvil](acta-next-evidence/checkpoint-3/decision-390.png).
