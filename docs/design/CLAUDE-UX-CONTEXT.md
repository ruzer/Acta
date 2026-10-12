# Acta v0.5.0 — contexto UX/UI para revisión independiente

Este documento describe el producto existente y dónde está implementado. **No prescribe un rediseño.** Las evaluaciones y el mockup anteriores son referencias históricas, no decisiones obligatorias. Las futuras propuestas deben distinguir problemas observados, hipótesis y cambios que exigirían modificar contratos.

Referencia: **v0.5.0**, commit `d2340e763ea398de0d0f350e65aa319125354e28`. Inspección documental/código: 7 de octubre de 2026, America/Mexico_City (registro UTC en el JSON). No se ejecutaron suites ni se modificó el producto en esta tarea.

## 1. Resumen del producto

Acta — **Questions. Evidence. Decisions.** — permite preparar preguntas estructuradas, asignarlas, recoger respuestas y archivos, aclarar discrepancias, comparar aportaciones y documentar decisiones con fuentes dentro de una instalación propia. Sirve para levantamiento de requerimientos, acuerdos entre áreas y definición de procesos. Su revisión humana y trazabilidad lo diferencian de una encuesta que solo acumula respuestas.

La estructura es Organization → Project → Section (tema) → Question. «Cuestionario» agrupa la estructura de un proyecto; no es una entidad separada en la base. Una misma pregunta puede recibir aportaciones independientes de varias personas. Cada Response mantiene borrador privado; enviar crea una ResponseRevision inmutable. El conjunto visual usa envíos vigentes, no cada versión histórica ni borradores.

Conceptos que la interfaz presenta por separado:

- Área responsable, membresía y asignación de pregunta no son equivalentes.
- Principal/seguimiento (`groupParentId`) no crea por sí mismo una condición.
- DRAFT/PUBLISHED/ARCHIVED describen publicación; revisión usa otro conjunto de estados.
- Guardar no es enviar. No hay autoguardado general en el recorrido de respuesta.
- Comparar no crea conflicto; resolver conflicto no valida una pregunta; N aportaciones no significa consenso.
- Una decisión registra resultado, alcance, excepciones y fuentes. No implica firma electrónica ni efecto jurídico adicional.
- Invitado externo es un acceso acotado por enlace, no un rol de cuenta ni identidad acreditada.

## 2. Arquitectura frontend

React 19.3, React Router 7.18, TanStack Query 5.104, React Hook Form 7.89, Zod 4.6 y Vite 8.3 según el package del tag. TypeScript y contratos compartidos `@requirements/contracts`; backend NestJS, PostgreSQL/Prisma y evidencia LOCAL/S3. El despliegue incluido usa VersityGW. El servidor decide permisos, aislamiento y estado; el diseño no debe inferir permisos por ausencia/presencia de botones.

`index.html` → `src/main.tsx` (StrictMode) → `App.tsx` → QueryClientProvider / BrandingProvider / RouterProvider. `/invite` monta la experiencia externa fuera de Session. Las rutas con cuenta pasan por sesión, posible cambio de contraseña y shell correspondiente. Login se muestra al no tener sesión, no en una ruta `/login` separada.

`api.ts` llama `/api/v1` con cookies same-origin, CSRF y parseo Zod de respuestas. `invitation-api.ts` mantiene una sesión distinta: captura/retira el fragmento antes del render y no lo conserva en query cache ni storage del navegador. Las copias contienen código, nunca sesiones ni enlaces privados reales.

`workbench-context.ts` conserva destino, filtros, scroll y foco por proyecto dentro de QueryClient. Editor conserva su propio contexto de modo/selección. Cachés se limpian al cerrar sesión/cambiar de cuenta; no se promete que ese contexto visual sobreviva un cierre del navegador. Los borradores persistentes son un mecanismo diferente.

## 3. Estructura de carpetas

```text
app/frontend/index.html, package.json, vite.config.ts, tsconfig.json
app/frontend/public/fonts/       fuentes locales y OFL
app/frontend/src/App.tsx         rutas, sesión y shells
app/frontend/src/ui/             controles compartidos y diálogo
app/frontend/src/pages/          pantallas, subvisiones y helpers
app/frontend/src/pages/editor/   organizar, preview, lotes y readiness
app/frontend/src/*.css           capas visuales globales y por experiencia
packages/contracts/src/          schemas, etiquetas y endpoints
app/backend/src/                 autoridad de acceso/estado (referencia)
tests/e2e/, tests/integration/    recorridos y reglas reales
docs/design/, docs/usability/    implementación Next e investigaciones previas
docs/assets/                    galería histórica del producto
```

## 4. Pantallas por rol

ADMIN de organización administra cuentas/áreas/proyectos; ADMIN de proyecto administra miembros y cuestionario. ANALYST prepara cuestionario y realiza revisión/validación cuando el proyecto está activo. STAKEHOLDER es el identificador real del participante con cuenta. VIEWER consulta el alcance autorizado y decisiones vigentes; no escribe respuestas ni valida. El invitado entra por su enlace, sin acceso al espacio administrativo. Las capacidades exactas siguen a backend (`canReview`, AccessService), no a esta tabla de navegación.

**ADMIN no equivale a ANALYST:** `ReviewReadService` permite consulta administrativa pero `canReview` exige ANALYST y proyecto ACTIVE. **VIEWER** no obtiene el dashboard analítico; su detalle de revisión está restringido a decisiones autorizadas.

| Pantalla | Ruta / estado | Rol | Implementación principal |
|---|---|---|---|
| Login | `Acceso sin sesión / cualquier ruta de cuenta` | SIN SESIÓN | [Login](../../app/frontend/src/pages/Access.tsx) |
| Mis proyectos | `/` | ADMIN, ANALYST, STAKEHOLDER, VIEWER | [Projects](../../app/frontend/src/pages/Access.tsx) |
| Mi contraseña | `/password` | USUARIO CON CUENTA | [Password](../../app/frontend/src/pages/Access.tsx) |
| Administración | `/admin` | ADMIN DE ORGANIZACIÓN | [Administration](../../app/frontend/src/pages/Administration.tsx) |
| Miembros | `/projects/:projectId/members` | ADMIN DE PROYECTO | [Members](../../app/frontend/src/pages/Administration.tsx) |
| Atención / resumen | `/projects/:projectId/dashboard` | ADMIN, ANALYST | [Dashboard → ProjectAttention](../../app/frontend/src/pages/Visibility.tsx) |
| Cuestionario / Escribir | `/projects/:projectId/editor` | ADMIN, ANALYST | [Editor → EditorWorkspace](../../app/frontend/src/pages/Editor.tsx) |
| Organizar / Preparar / Analizar | `Estado interno del editor` | ADMIN, ANALYST | [Organize → QuestionInspector](../../app/frontend/src/pages/editor/Organize.tsx) |
| Crear / editar pregunta | `Diálogo del editor` | ADMIN, ANALYST | [QuestionForm](../../app/frontend/src/pages/QuestionForm.tsx) |
| Asignación individual | `Diálogo del editor` | ADMIN, ANALYST | [Editor / ActionForm](../../app/frontend/src/pages/Editor.tsx) |
| Operaciones masivas | `Diálogo de Organizar` | ADMIN, ANALYST | [BulkDialog](../../app/frontend/src/pages/editor/BulkDialog.tsx) |
| Revisar publicación | `Estado interno del editor` | ADMIN, ANALYST | [ReadinessPanel](../../app/frontend/src/pages/editor/ReadinessPanel.tsx) |
| Vista previa | `Estado interno del editor` | ADMIN, ANALYST | [Preview → AnswerControl](../../app/frontend/src/pages/editor/Preview.tsx) |
| Importación | `/projects/:projectId/import` | ADMIN, ANALYST | [ImportStructure](../../app/frontend/src/pages/Exchange.tsx) |
| Exportación | `/projects/:projectId/export` | ADMIN, ANALYST, VIEWER (alcance restringido) | [ExportProject](../../app/frontend/src/pages/Exchange.tsx) |
| Invitaciones | `/projects/:projectId/invitations` | ADMIN, ANALYST | [Invitations / CreateInvitation / InvitationLink](../../app/frontend/src/pages/Invitations.tsx) |
| Invitado externo | `/invite` | INVITADO EXTERNO (sin rol de cuenta) | [InvitedResponse](../../app/frontend/src/pages/InvitedResponse.tsx) |
| Mi trabajo | `/projects/:projectId/work` | STAKEHOLDER | [MyWork / ProjectWork](../../app/frontend/src/pages/MyWork.tsx) |
| Responder | `/projects/:projectId/respond/:id` | STAKEHOLDER | [Respond → AnswerControl](../../app/frontend/src/pages/Respond.tsx) |
| Respuesta enviada | `/projects/:projectId/submitted/:id` | STAKEHOLDER | [SubmittedResponse / SubmittedResponseContent](../../app/frontend/src/pages/ParticipantFlow.tsx) |
| Acuse de trabajo | `/projects/:projectId/receipt` | STAKEHOLDER | [SessionReceipt](../../app/frontend/src/pages/ParticipantFlow.tsx) |
| Aclaraciones | `/projects/:projectId/clarifications/:id` | STAKEHOLDER | [Clarifications / ThreadMessages](../../app/frontend/src/pages/Clarifications.tsx) |
| Bandeja de revisión | `/review` | ANALYST | [ReviewInbox](../../app/frontend/src/pages/ReviewInbox.tsx) |
| Revisión de pregunta | `/projects/:projectId/review/:id` | ANALYST (acciones), ADMIN (consulta), VIEWER (decisiones autorizadas) | [ReviewDetail](../../app/frontend/src/pages/ReviewDetail.tsx) |
| Aportaciones múltiples | `Dentro de revisión de pregunta` | ANALYST, LECTURA AUTORIZADA | [ContributionSet](../../app/frontend/src/pages/ContributionSet.tsx) |
| Comparar / conflicto | `Dentro de revisión de pregunta` | ANALYST, LECTURA AUTORIZADA | [ContributionComparison / ConflictComparison](../../app/frontend/src/pages/ContributionComparison.tsx) |
| Decisiones | `/projects/:projectId/decisions` | ADMIN, ANALYST | [ProjectDecisions → ReviewDetail → DecisionRecord](../../app/frontend/src/pages/ProjectDecisions.tsx) |
| Preguntas publicadas / lector | `/projects/:projectId` | MIEMBROS AUTORIZADOS, VIEWER | [Participant](../../app/frontend/src/pages/Access.tsx) |
| Trazabilidad | `/projects/:projectId/traceability` | ADMIN, ANALYST | [Traceability](../../app/frontend/src/pages/Visibility.tsx) |
| Bitácora | `/projects/:projectId/history` | ADMIN, ANALYST | [History](../../app/frontend/src/pages/Visibility.tsx) |
| Evidencia | `Dentro de responder / invitado / revisión` | ACTOR AUTORIZADO | [uploadEvidence / downloadEvidence; InvitationClient](../../app/frontend/src/api.ts) |
| Vacíos / errores / confirmaciones | `Transversal` | TODOS | [EmptyState / ErrorState / Alert / Dialog](../../app/frontend/src/ui/index.tsx) |

## 5. Flujos principales

Preparación: Login → Mis proyectos → Cuestionario → Escribir o Organizar → crear/editar → área y participantes → Revisar publicación → preview/confirmación. Organizar dispone de Preparar y Analizar sobre las mismas preguntas. La selección distingue página, resultados, tema y grupo; solo confirmar ejecuta cambios.

Importación: proyecto vacío → archivo → preview → revisar incidencias/conteos → confirmar. Usa `ImportStructure`; no cargar respuestas ni interpretar este flujo como seed. Exportación es otra operación con alcance por rol.

Aportación interna: Mi trabajo → responder → guardar borrador/salir → continuar → evidencia → enviar → respuesta enviada/acuse → aclaración si se solicita. Tipos: YES_NO, SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_TEXT, LONG_TEXT, DATE, NUMBER y MATRIX.

Aportación externa: Invitaciones → destinatario previsto → preguntas → vigencia → resumen → crear → compartir manualmente → `/invite` → guardar/enviar/aclarar. Renovar invalida acceso previo; revocar conserva envíos. La interfaz no promete correo automático ni prueba de identidad.

Análisis: Atención / bandeja → revisión de pregunta → conjunto 0/1/N → consultar o comparar A/B → aclarar / registrar conflicto / resolver → validar con fuentes → Decisiones. Historia y fuentes siguen consultables; cambios y nuevas versiones pueden afectar vigencia conforme al backend.

Lectura: preguntas publicadas → consulta autorizada de decisión y fuentes → exportación restringida. Trazabilidad y bitácora son herramientas del espacio analítico.

Estados transversales: carga, error y reintento; ausencia de contenido distinta de filtro vacío; error de campo; guardado/enviado; archivo pendiente; conflicto de versión; sesión caducada; descarte/confirmación; información parcial no debe aparentar cero.

## 6. Componentes compartidos reales

| Archivo / exports | Reutilización observada |
|---|---|
| [setCsrf, ApiFailure, api, formValues, uploadEvidence, downloadEvidence, exchangeRequest, exchangeFetch, saveDownload](../../app/frontend/src/api.ts) | 24 módulos consumidores directos: App.tsx, branding.tsx, invitation-api.ts, Access.tsx, Administration.tsx, Clarifications.tsx, Editor.tsx, Exchange.tsx, Invitations.tsx, InvitedResponse.tsx, MyWork.tsx, ParticipantFlow.tsx, ParticipantShell.tsx, ProjectDecisions.tsx, QuestionForm.tsx, Respond.tsx, ReviewActions.tsx, ReviewDetail.tsx, ReviewInbox.tsx, ReviewShared.tsx, Visibility.tsx, attention-data.ts, BulkDialog.tsx, invitation-data.ts |
| [formatDate, useBranding, BrandingProvider, Brand](../../app/frontend/src/branding.tsx) | 7 módulos consumidores directos: App.tsx, Access.tsx, Invitations.tsx, InvitedResponse.tsx, ParticipantShell.tsx, Respond.tsx, ReviewShared.tsx |
| [ActionForm, Administration, Members](../../app/frontend/src/pages/Administration.tsx) | 2 módulos consumidores directos: App.tsx, Editor.tsx |
| [AnalystStatus, DecisionRecord, ConflictComparison, AttentionPanel](../../app/frontend/src/pages/AnalystVisual.tsx) | 6 módulos consumidores directos: ProjectAttention.tsx, ProjectDecisions.tsx, ReviewDetail.tsx, ReviewInbox.tsx, Visibility.tsx, Organize.tsx |
| [answerText, AnswerControl](../../app/frontend/src/pages/AnswerControl.tsx) | 6 módulos consumidores directos: ContributionSet.tsx, InvitedResponse.tsx, ParticipantFlow.tsx, Respond.tsx, ReviewShared.tsx, Preview.tsx |
| [ContributionComparison](../../app/frontend/src/pages/ContributionComparison.tsx) | 2 módulos consumidores directos: AnalystVisual.tsx, ContributionSet.tsx |
| [ContributionSet](../../app/frontend/src/pages/ContributionSet.tsx) | 1 módulos consumidores directos: ReviewDetail.tsx |
| [InvitationLink, CreateInvitation, Invitations](../../app/frontend/src/pages/Invitations.tsx) | 2 módulos consumidores directos: App.tsx, Organize.tsx |
| [PersonalProgress, ParticipantHome, MyWork, ProjectWork](../../app/frontend/src/pages/MyWork.tsx) | 2 módulos consumidores directos: App.tsx, Access.tsx |
| [participantLabels, ParticipantBadge, participantPath, nextParticipantPath, participantCounts, ParticipantSummary, ParticipantFocus, SessionReceipt, SubmittedResponse, SubmittedResponseContent, ParticipantNotice](../../app/frontend/src/pages/ParticipantFlow.tsx) | 4 módulos consumidores directos: App.tsx, Clarifications.tsx, MyWork.tsx, Respond.tsx |
| [ParticipantIcon](../../app/frontend/src/pages/ParticipantIcon.tsx) | 7 módulos consumidores directos: AnalystVisual.tsx, Clarifications.tsx, MyWork.tsx, ParticipantFlow.tsx, ParticipantShell.tsx, Respond.tsx, EditorWorkspace.tsx |
| [ProjectWorkbench](../../app/frontend/src/pages/ProjectWorkbench.tsx) | 5 módulos consumidores directos: Editor.tsx, Invitations.tsx, ProjectDecisions.tsx, ReviewDetail.tsx, Visibility.tsx |
| [reviewLabels, threadLabels, dateText, SubmittedAnswer, ThreadMessages](../../app/frontend/src/pages/ReviewShared.tsx) | 8 módulos consumidores directos: AnalystVisual.tsx, Clarifications.tsx, ContributionComparison.tsx, ContributionSet.tsx, ParticipantFlow.tsx, ProjectAttention.tsx, ReviewDetail.tsx, ReviewInbox.tsx |
| [ProjectTools, Metric, Dashboard, Traceability, History](../../app/frontend/src/pages/Visibility.tsx) | 2 módulos consumidores directos: App.tsx, Exchange.tsx |
| [publications, Publication, QuestionActions, TopicActions, EditorModeSwitcher, EditorWorkspace](../../app/frontend/src/pages/editor/EditorWorkspace.tsx) | 3 módulos consumidores directos: Editor.tsx, Organize.tsx, ReadinessPanel.tsx |
| [questionAncestors, unfoldedQuestions](../../app/frontend/src/pages/editor/questionnaire-presentation.ts) | 3 módulos consumidores directos: Editor.tsx, EditorWorkspace.tsx, Organize.tsx |
| [loadProjectInvitations, invitationQueryOptions, expiringInvitations](../../app/frontend/src/pages/invitation-data.ts) | 2 módulos consumidores directos: Invitations.tsx, ProjectAttention.tsx |
| [Button, Field, Input, Select, Textarea, Checkbox, Radio, StatusBadge, Progress, Alert, EmptyState, LoadingState, ErrorState, Table, Dialog](../../app/frontend/src/ui/index.tsx) | 29 módulos consumidores directos: App.tsx, branding.tsx, Access.tsx, Administration.tsx, AnswerControl.tsx, Clarifications.tsx, ContributionComparison.tsx, ContributionSet.tsx, Editor.tsx, Exchange.tsx, Invitations.tsx, InvitedResponse.tsx, MyWork.tsx, ParticipantFlow.tsx, ParticipantShell.tsx, ProjectAttention.tsx, ProjectDecisions.tsx, QuestionForm.tsx, Respond.tsx, ReviewActions.tsx, ReviewDetail.tsx, ReviewInbox.tsx, ReviewShared.tsx, Visibility.tsx, BulkDialog.tsx, EditorWorkspace.tsx, Organize.tsx, Preview.tsx, ReadinessPanel.tsx |
| [workbenchPath, rememberWorkbenchItem, useWorkbenchContext](../../app/frontend/src/workbench-context.ts) | 3 módulos consumidores directos: Editor.tsx, ProjectWorkbench.tsx, ReviewDetail.tsx |

No se localizaron componentes propios llamados PageHeader, QuestionCard, ResponseCard, DataTable o Breadcrumb. Sus funciones se distribuyen en componentes existentes y CSS. `Table` y `Field` son los nombres reales de los controles base; `ProjectWorkbench` es la cabecera/contexto analítico, no un router nuevo.

## 7. Sistema visual actual

**Centralización parcial.** `styles.css` define base global, `--ink`, `--muted`, `--line`, `--primary`, `--radius`, espacios `--s1..--s4`, headings, botones, formularios, alerts, tablas y diálogo. Muchos tamaños, colores y espaciados continúan como valores literales en hojas por contexto.

`participant.css` agrega tokens scoped para superficie/acento/estados/movimiento y `--font-display`/`--font-body`; incluye fuentes locales Manrope e IBM Plex Sans. `analyst-visual.css` usa la familia `--av-*` para estados, posturas y decisiones. `editor.css` aporta tipografía y composición del cuestionario. `project-workbench.css` y las seis hojas `next-*.css` incorporan la recomposición Next. No hay Tailwind en la aplicación actual ni una librería externa de componentes listada en el package frontend.

La base nombra Inter como primera opción, pero no distribuye una fuente Inter ni la descarga de Google en runtime: utiliza el fallback del sistema donde no aplican las fuentes locales. No confundirla con el HTML del mockup, que sí depende de Google Fonts y Tailwind CDN.

`BrandingProvider` modifica nombre/título, logo, favicon, idioma del documento, timezone de formatos y `--installation-accent`. Locale no equivale a traducción completa automática. No existe un sistema i18n general en upstream.

Iconos: `ParticipantIcon` contiene SVG propios; otras señales usan texto/símbolos y `AnalystStatus`. Estados y colores no deben interpretarse como nuevas reglas de dominio. `StatusBadge` es genérico y distinto de `AnalystStatus`, `Publication` y `ParticipantBadge`.

Responsive distribuido: reglas a 480, 600, 650, 767/768, 800, 1023, 1100, 1279/1280 px; detalles exactos por hoja en JSON. No existe catálogo único de breakpoints. `prefers-reduced-motion` aparece en base/editor/analista/participante. `prefers-color-scheme: dark` aparece en participante; **no se ha demostrado un tema oscuro completo de toda la aplicación**.

Formularios combinan controles propios, HTML nativo, React Hook Form/Zod en autoría y estado local en otros flujos. `Dialog` usa `<dialog>` con gestión de foco y cierre; hay confirmaciones adicionales por contexto. Tarjetas, filas, badges y encabezados no se resuelven mediante un único kit de composición.

| Hoja | Responsabilidad |
|---|---|
| [ibm-plex-sans.css](../../app/frontend/public/fonts/ibm-plex-sans.css) | Archivo app/frontend/public/fonts/ibm-plex-sans.css del snapshot de referencia. |
| [manrope.css](../../app/frontend/public/fonts/manrope.css) | Archivo app/frontend/public/fonts/manrope.css del snapshot de referencia. |
| [analyst-visual.css](../../app/frontend/src/analyst-visual.css) | Tokens y presentaciones analíticas: estado, conflicto, decisión y atención. |
| [editor.css](../../app/frontend/src/editor.css) | Editor: tipografía, temas, modos, inspector, formularios y operaciones por lote. |
| [invitation.css](../../app/frontend/src/invitation.css) | Base de enlaces privados y formularios del invitado. |
| [next-attention.css](../../app/frontend/src/next-attention.css) | Tareas de atención y listado de decisiones. |
| [next-authoring.css](../../app/frontend/src/next-authoring.css) | Composición del diálogo de pregunta, tipos y bloques progresivos. |
| [next-comparison.css](../../app/frontend/src/next-comparison.css) | Posturas A/B y adaptación móvil; fuentes no truncadas. |
| [next-contributions.css](../../app/frontend/src/next-contributions.css) | Lista compacta de aportaciones, detalle y navegación. |
| [next-invitations.css](../../app/frontend/src/next-invitations.css) | Gestor y asistente de invitaciones; contexto del invitado. |
| [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css) | Outliner Acta Next, preparar/analizar y densidad responsive. |
| [participant.css](../../app/frontend/src/participant.css) | Shell participante, fuentes locales, tokens por contexto, estados, móvil y modo oscuro parcial. |
| [project-workbench.css](../../app/frontend/src/project-workbench.css) | Cabecera y navegación de proyecto. |
| [styles.css](../../app/frontend/src/styles.css) | Base global: tokens, tipografía fallback, controles, tablas, diálogos y responsive. |

## 8. Documentos de diseño y precedencia

Para comportamiento actual, leer primero código/contratos v0.5.0 y después ACTA-NEXT-IMPLEMENTATION. Para motivaciones, revisar los informes históricos. Una anotación «pendiente/no implementado» en un estudio viejo no prueba que siga pendiente en v0.5.0; consultar el informe de implementación posterior.

| Documento | Función |
|---|---|
| [README.md](../../README.md) | Acta |
| [CHANGELOG.md](../../CHANGELOG.md) | Cambios de Acta |
| [README.md](../README.md) | Documentación de Acta |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Arquitectura |
| [DOMAIN-MODEL.md](../DOMAIN-MODEL.md) | Modelo de dominio |
| [CONTRACTS.md](../CONTRACTS.md) | Contratos por función |
| [CONTRACTS-2AB.md](../CONTRACTS-2AB.md) | Contratos 2A/2B |
| [CONTRACTS-2C.md](../CONTRACTS-2C.md) | Contratos 2C — respuestas y evidencia |
| [CONTRACTS-2D.md](../CONTRACTS-2D.md) | Contratos de revisión — Fase 2D |
| [CONTRACTS-2E.md](../CONTRACTS-2E.md) | Contratos 2E — visibilidad e intercambio |
| [CONFIGURATION.md](../CONFIGURATION.md) | Configuración |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | Desarrollo local |
| [BULK-QUESTIONNAIRE-OPERATIONS.md](../BULK-QUESTIONNAIRE-OPERATIONS.md) | Operaciones masivas de cuestionario |
| [QUESTIONNAIRE-EDITOR-INTEGRATION.md](../QUESTIONNAIRE-EDITOR-INTEGRATION.md) | Integración del editor de cuestionarios |
| [DESIGN-REVIEW.md](../DESIGN-REVIEW.md) | Revisión de diseño — operaciones de cuestionario por lote |
| [EXTERNAL-INVITATIONS-DESIGN.md](../EXTERNAL-INVITATIONS-DESIGN.md) | External response invitations — audit and implementation plan |
| [EXTERNAL-INVITATIONS.md](../EXTERNAL-INVITATIONS.md) | Responder mediante una invitación privada |
| [IMPORT-FORMAT.md](../IMPORT-FORMAT.md) | Contrato de importación y exportación |
| [IMPORTING-QUESTIONNAIRES.md](../IMPORTING-QUESTIONNAIRES.md) | Importar un cuestionario |
| [SIMPLE-IMPORT-PROPOSAL.md](../SIMPLE-IMPORT-PROPOSAL.md) | Propuesta: plantilla tabular sencilla |
| [ACTA-NEXT-IMPLEMENTATION.md](ACTA-NEXT-IMPLEMENTATION.md) | ACTA NEXT — implementación y verificación |
| [README.md](../assets/README.md) | Galería de Acta |
| [ACCESSIBILITY.md](../usability/ACCESSIBILITY.md) | Comprobación técnica de accesibilidad — Acta |
| [DATASETS.md](../usability/DATASETS.md) | Escenarios ficticios del laboratorio |
| [EVIDENCE.md](../usability/EVIDENCE.md) | Evidencia del estudio |
| [FRICTION-LOG.md](../usability/FRICTION-LOG.md) | Friction log — observaciones, sin soluciones |
| [HEURISTIC-REVIEW.md](../usability/HEURISTIC-REVIEW.md) | Evaluación heurística independiente de Acta |
| [PROPOSALS.md](../usability/PROPOSALS.md) | Propuestas posteriores a la investigación — HIGH / CRITICAL |
| [SIMPLICITY-PASS.md](../usability/SIMPLICITY-PASS.md) | Acta — Simplicity & Usability Pass |
| [SIMPLICITY-REVIEW.md](../usability/SIMPLICITY-REVIEW.md) | Simplicity review — oportunidades, no alcance aprobado |
| [STUDY-PROTOCOL.md](../usability/STUDY-PROTOCOL.md) | Acta usability lab — protocolo |
| [SUPPORT-SCENARIO.md](../usability/SUPPORT-SCENARIO.md) | Apoyo externo al escenario P06 |
| [USABILITY-STUDY.md](../usability/USABILITY-STUDY.md) | Acta — estudio de usabilidad |
| [VALIDATION.md](../usability/VALIDATION.md) | Validación y cierre del estudio |
| [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) | Third-party notices |

`MOCKUP-v0.4-COMPARISON.md`: **NOT FOUND**. `MOCKUP-v0.4-DESIGN-REVIEW.md`: **NOT FOUND** en las ubicaciones locales acotadas. No se reconstruyeron sus conclusiones ni se usó un recuerdo como archivo existente. La implementación Next y los originales encontrados cubren parte del contexto, sin sustituir esos documentos exactos.

## 9. Mockup original

- [acta_interactive_high_fidelity_prototype.html](mockups/original/acta_interactive_high_fidelity_prototype.html)
- [acta_documento_de_dise_o_y_especificaci_n_t_cnica.md](mockups/original/acta_documento_de_dise_o_y_especificaci_n_t_cnica.md)

Autorización expresa del usuario para compartir ambos originales con Claude; confirmó que usan datos ficticios. Se conservan los bytes originales. El HTML se entrega como **prototipo independiente**, no como frontend productivo, base de datos ni prueba de persistencia. Tiene Tailwind CDN y Google Fonts: abrirlo puede hacer peticiones externas y sin conexión puede no reproducir su estilo. No se ejecutó aquí ni se envió contenido a esos servicios.

La propuesta describe workbench, outliner, comparación simétrica, presentación documental de decisiones y experiencia externa simplificada. Sus afirmaciones de autosalvado, identidad, accesibilidad garantizada o pruebas con personas **no deben asumirse ciertas para Acta ni como validación independiente del mockup**. En Acta real el guardado es explícito, los contratos limitan la identidad visible y las pruebas descritas son simulaciones técnicas. Evaluar la propuesta libremente y comprobar cada capacidad contra el código.

## 10. Capturas disponibles

Inventario completo de 199 imágenes upstream en JSON: pantalla/archivo, dimensiones reales, origen, carácter ficticio y selección portable. Se incluyen 34 capturas de la galería pública y de los cuatro checkpoints Next. La galería histórica es anterior; cp1 antecede a la navegación cp2; no confundir cada imagen con el estado final de todas las pantallas. No se crearon ni retocaron imágenes para esta entrega.

Procedencia: `docs/assets/README.md`, `docs/usability/EVIDENCE.md` y `docs/design/ACTA-NEXT-IMPLEMENTATION.md`. Datos y cuentas ficticios. Se revisó una muestra visual representativa además de procedencia, metadata y scans. Las otras capturas históricas quedan referenciadas, no copiadas por defecto. No hay capturas de la instalación institucional ni enlaces privados de invitación en el paquete.

| Captura | Dimensiones | Origen |
|---|---|---|
| [01-editor-write](../assets/01-editor-write.png) | 1440 × 1100 | Galería histórica de producto |
| [02-editor-organize](../assets/02-editor-organize.png) | 1440 × 1100 | Galería histórica de producto |
| [03-my-work](../assets/03-my-work.png) | 1440 × 1100 | Galería histórica de producto |
| [04-answer](../assets/04-answer.png) | 1440 × 1100 | Galería histórica de producto |
| [05-conflict](../assets/05-conflict.png) | 1440 × 1100 | Galería histórica de producto |
| [06-validated-decision](../assets/06-validated-decision.png) | 1440 × 1100 | Galería histórica de producto |
| [07-dashboard](../assets/07-dashboard.png) | 1440 × 1100 | Galería histórica de producto |
| [08-participant-mobile](../assets/08-participant-mobile.png) | 390 × 844 | Galería histórica de producto |
| [authoring-1440](acta-next-evidence/checkpoint-1/authoring-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [authoring-matrix-390](acta-next-evidence/checkpoint-1/authoring-matrix-390.png) | 390 × 844 | Aplicación real; evidencia de checkpoint Acta Next |
| [contributions-3-1440](acta-next-evidence/checkpoint-1/contributions-3-1440.png) | 1440 × 2608 | Aplicación real; evidencia de checkpoint Acta Next |
| [contributions-3-390](acta-next-evidence/checkpoint-1/contributions-3-390.png) | 390 × 844 | Aplicación real; evidencia de checkpoint Acta Next |
| [questionnaire-304-1440](acta-next-evidence/checkpoint-1/questionnaire-304-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [questionnaire-304-390](acta-next-evidence/checkpoint-1/questionnaire-304-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [attention-1440](acta-next-evidence/checkpoint-2/attention-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [attention-390](acta-next-evidence/checkpoint-2/attention-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [decisions-1440](acta-next-evidence/checkpoint-2/decisions-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [decisions-390](acta-next-evidence/checkpoint-2/decisions-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [questionnaire-1440](acta-next-evidence/checkpoint-2/questionnaire-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [questionnaire-390](acta-next-evidence/checkpoint-2/questionnaire-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [compare-12-1440](acta-next-evidence/checkpoint-3/compare-12-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [compare-12-390](acta-next-evidence/checkpoint-3/compare-12-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [conflict-1440](acta-next-evidence/checkpoint-3/conflict-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [conflict-390](acta-next-evidence/checkpoint-3/conflict-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [decision-1440](acta-next-evidence/checkpoint-3/decision-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [decision-390](acta-next-evidence/checkpoint-3/decision-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [create-summary-1440](acta-next-evidence/checkpoint-4/create-summary-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [create-summary-390](acta-next-evidence/checkpoint-4/create-summary-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [guest-actions-1440](acta-next-evidence/checkpoint-4/guest-actions-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [guest-actions-390](acta-next-evidence/checkpoint-4/guest-actions-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [invitations-1440](acta-next-evidence/checkpoint-4/invitations-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [invitations-390](acta-next-evidence/checkpoint-4/invitations-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [participant-actions-1440](acta-next-evidence/checkpoint-4/participant-actions-1440.png) | 1440 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |
| [participant-actions-390](acta-next-evidence/checkpoint-4/participant-actions-390.png) | 390 × 1000 | Aplicación real; evidencia de checkpoint Acta Next |

No se localizó una colección identificable de capturas del mockup original ni un antes/después controlado que cubra toda la app. Los estudios y checkpoints permiten comparación histórica, con versiones/datasets distintos. No se afirma una mejora medida por esa comparación.

## 11. Problemas visuales conocidos y estado de la evidencia

| Referencia | Observación previa | Lectura correcta al revisar v0.5.0 |
|---|---|---|
| FRICTION-001/002/003, SIMPLICITY-PASS | Retorno de foco, publicación conjunta poco descubrible y dependencia presentada como error global | Registrados como corregidos en el pase de simplicidad; no tratarlos como bugs actuales sin reproducir |
| FRICTION-004/005/010 | Por consultar fuera del resumen, importación alejada del editor vacío, confirmación efímera de envío | Registrados como corregidos; Next añade orientación del editor realmente vacío |
| Heurística histórica | «Revisar» ambiguo, contexto perdido al regresar, bloques repetidos, códigos P0–P3 y ayuda desigual | Next diferencia Revisar publicación / Revisar respuestas y conserva contexto; el resto necesita reevaluación, no heredar veredicto |
| FRICTION-006 | Lista no distingue quién debe actuar en aclaración respondida | El informe de simplicidad lo aplazó por proyección limitada. Next agrega atención a aclaraciones mediante lectura autorizada; no equivale a una nueva proyección universal de bandeja |
| FRICTION-009 | Reseleccionar tras operaciones/filtros | Selección se limpia por seguridad en casos definidos; Next conserva contexto de navegación, no promete retener selección oculta en cualquier cambio |
| Next CP1/CP3 | Demasiadas respuestas completas ocultaban el conjunto; filas a escala y conflicto/decisión poco diferenciados | Implementados conjunto compacto, Preparar/Analizar, comparación de 2 de N y decisión documental; evaluar ahora su composición, no reconstruirlos desde cero |
| Next CP4 | Guardado separado de acciones, evidencia plegada poco visible | Información aproximada a botones y nombres de archivo resumidos; no incorpora autosalvado |
| Next CONTRACT GAP | Identidad prevista no expuesta al invitado; origen del actor no estructurado en revisión | Límite real de contrato. No inferirlo de nombres ni diseñar como si el dato ya existiera |
| Next / accesibilidad | Scroll vertical largo con doce aportaciones o resumen móvil; controles nativos; tecnologías de asistencia no exhaustivas | Límites reconocidos. Axe sin violaciones no certifica WCAG ni facilidad de uso humana |
| CI histórico Next | Retorno de scroll dependiente del momento de navegación | Corregido con useLayoutEffect y regresión bajo carga; evidencia histórica, no nueva corrida aquí |

Estas referencias son insumos para una evaluación nueva. No se ordena conservar su estética ni aplicar propuestas históricas. La tarea posterior puede cuestionar jerarquía, claridad y facilidad de uso de todas las pantallas, explicitando qué cambio es visual y cuál altera comportamiento/contratos.

## 12. Archivos prioritarios para revisar

1. README + DOMAIN-MODEL + CONTRACTS: producto y semántica, antes de leer críticas previas.
2. App.tsx, Access.tsx, ProjectWorkbench.tsx y workbench-context.ts: acceso, roles y navegación.
3. styles.css, participant.css, analyst-visual.css y ui/index.tsx: controles y capas visuales.
4. Editor.tsx → EditorWorkspace → Organize; QuestionForm, BulkDialog y ReadinessPanel: cuestionarios grandes.
5. ReviewDetail → ContributionSet → ContributionComparison; AnalystVisual y ReviewActions: aportaciones, conflicto, decisión.
6. MyWork, Respond, AnswerControl, ParticipantFlow y Clarifications: experiencia interna de respuesta.
7. Invitations, InvitedResponse e invitation-api: invitaciones y acceso externo.
8. Visibility, ProjectAttention, ProjectDecisions, Exchange y Administration: completar la aplicación, no centrarse solo en cuestionario.
9. Capturas Next y después estudios/mockup: contrastar estructura real con evidencias, sin aceptar una estética por autoridad.

El inventario permite filtrar por `screen`, `role`, `category`, `used_by` y `related_files`. Contiene **todos los 92 archivos versionados del frontend**, incluso pruebas, fuentes y configuración. No incluye node_modules, dist ni archivos de entorno.

## 13. Ubicaciones y separación upstream/downstream

Upstream: `/Users/ruzer/Proyectos/Requirements_Platform_Public` · main · `d2340e763ea398de0d0f350e65aa319125354e28` · v0.5.0 · limpio al inicio.

Downstream (solo referencia): `/Users/ruzer/Proyectos/Acta-FGEO` · main · `776d24659a9f1e78292a626a4324ee081b9a5c3e` · package 0.5.0 / describe v0.5.0-26-g776d246 · limpio. No modificado.

Originales encontrados en `/Users/ruzer/Downloads/` y archivados sin cambios en `/Users/ruzer/Proyectos/Requirements_Platform_Public/docs/design/mockups/original/`.

**Este documento y JSON locales incluyen rutas absolutas de trabajo: usar la versión saneada de artifacts/claude-ux-review para compartir.** Las entradas PRIVATE/REQUIRES REVIEW del JSON son referencias, nunca archivos incluidos.

Búsqueda acotada: ambos repositorios, Downloads y Requirements_Design_Lab (profundidad máxima 5), directorio de visualización conocido de esta tarea y carpetas Acta/design/mockup de /private/tmp (máximo 3). Se excluyeron .git, node_modules, dist, backups, logs y evidencia privada; no se rastreó todo el disco.

Las diferencias visuales downstream inspeccionadas son capa de marca, logos autorizados, hoja CSS institucional, marca secundaria de coordinación, textos españoles y configuración visual. El diff frontend respecto del tag afecta App/main, Access/Exchange/Visibility y agrega spanish.ts/tests; los contratos frontend no se modifican en ese diff. Acta Next y la navegación v0.5.0 permanecen como base.

Solo se describe la naturaleza de esas diferencias. **No se comparten logos institucionales, código privado downstream, datos RH, fuentes de cuestionarios, configuración de instancia ni capturas de uso institucional.** El permiso de uso local de marca no es una licencia para redistribución externa. Las antiguas exploraciones Basis/Criterio/hybrid permanecen fuera por falta de revisión de procedencia y datos.

## 14. Mapa pantalla → componente → estilo → hooks → API → tests

### Login

Contexto de organización, contraseña y errores; no existe una ruta /login independiente.

- Componente: [Login](../../app/frontend/src/pages/Access.tsx).
- Secundarios directos: Alert, Brand, Button, Container, EmptyState, ErrorState, Input, Link, LoadingState, ParticipantHome, PersonalProgress, StatusBadge.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQueries, useQuery, useRef, useState.
- API relacionada: `branding`, `loginContext`, `login`, `password`, `projects`, `participant`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [invitations.spec.ts](../../tests/e2e/invitations.spec.ts), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Mis proyectos

Accesos según membresía; ParticipantHome cuando todos los proyectos son STAKEHOLDER.

- Componente: [Projects](../../app/frontend/src/pages/Access.tsx).
- Secundarios directos: Alert, Brand, Button, Container, EmptyState, ErrorState, Input, Link, LoadingState, ParticipantHome, PersonalProgress, StatusBadge.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQueries, useQuery, useRef, useState.
- API relacionada: `branding`, `loginContext`, `login`, `password`, `projects`, `participant`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Mi contraseña

Cambio obligatorio inicial y cambio posterior; se distingue de recuperación de sesión.

- Componente: [Password](../../app/frontend/src/pages/Access.tsx).
- Secundarios directos: Alert, Brand, Button, Container, EmptyState, ErrorState, Input, Link, LoadingState, ParticipantHome, PersonalProgress, StatusBadge.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQueries, useQuery, useRef, useState.
- API relacionada: `branding`, `loginContext`, `login`, `password`, `projects`, `participant`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Administración

Usuarios, áreas, proyectos, activación y reset; el rol de organización es distinto del rol en proyecto.

- Componente: [Administration](../../app/frontend/src/pages/Administration.tsx).
- Secundarios directos: ActionForm, Alert, Button, Checkbox, Dialog, EmptyState, ErrorState, Input, Link, LoadingState, Select, StatusBadge, Table, Textarea.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useEffect, useId, useParams, useQuery, useQueryClient, useRef, useState.
- API relacionada: `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Miembros

Membresía explícita; no equivale a asignación de preguntas.

- Componente: [Members](../../app/frontend/src/pages/Administration.tsx).
- Secundarios directos: ActionForm, Alert, Button, Checkbox, Dialog, EmptyState, ErrorState, Input, Link, LoadingState, Select, StatusBadge, Table, Textarea.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useEffect, useId, useParams, useQuery, useQueryClient, useRef, useState.
- API relacionada: `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Atención / resumen

Tareas de atención y resumen/métricas; grupos solapables, no sumar como total único.

- Componente: [Dashboard → ProjectAttention](../../app/frontend/src/pages/Visibility.tsx).
- Secundarios directos: Alert, AnalystStatus, Button, EmptyState, ErrorState, Input, Link, LoadingState, Metric, MetricRow, ProjectAttention, ProjectTools, ProjectWorkbench, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-attention.css](../../app/frontend/src/next-attention.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useAttentionClarifications, useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `dashboard`, `traceability`, `history`, `listReviewInbox`, `getReviewDetail`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [Visibility.test.tsx](../../app/frontend/src/pages/Visibility.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [next-workbench.spec.ts](../../tests/e2e/next-workbench.spec.ts), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Cuestionario / Escribir

Escribir, Organizar, Revisar publicación y vista previa comparten estructura; Organizar predeterminado.

- Componente: [Editor → EditorWorkspace](../../app/frontend/src/pages/Editor.tsx).
- Secundarios directos: ActionForm, Alert, Button, Checkbox, Dialog, EditorWorkspace, ErrorState, Input, Link, LoadingState, ProjectWorkbench, QuestionForm, Select, Textarea.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Organizar / Preparar / Analizar

Filtros, paginación de 40, grupos, selección y lectura de aportaciones 0/1/N. Preparar/Analizar son perspectivas, no estados de dominio.

- Componente: [Organize → QuestionInspector](../../app/frontend/src/pages/editor/Organize.tsx).
- Secundarios directos: AnalystStatus, BulkDialog, Button, CreateInvitation, EmptyState, Fragment, Input, InspectorFrame, Publication, QuestionActions, QuestionInspector, Select, TopicActions.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [bulk.spec.ts](../../tests/e2e/bulk.spec.ts), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [next-workbench.spec.ts](../../tests/e2e/next-workbench.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Crear / editar pregunta

Ocho tipos, MATRIX, identificación, configuración avanzada, errores por campo y contenido sin guardar.

- Componente: [QuestionForm](../../app/frontend/src/pages/QuestionForm.tsx).
- Secundarios directos: Alert, Button, Checkbox, Dialog, Input, Select, Textarea.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Asignación individual

Área responsable y participantes son relaciones distintas; no asigna personas por área.

- Componente: [Editor / ActionForm](../../app/frontend/src/pages/Editor.tsx).
- Secundarios directos: ActionForm, Alert, Button, Checkbox, Dialog, EditorWorkspace, ErrorState, Input, Link, LoadingState, ProjectWorkbench, QuestionForm, Select, Textarea.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [bulk.spec.ts](../../tests/e2e/bulk.spec.ts), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Operaciones masivas

Área, añadir participantes y publicar: alcance explícito, preview, confirmación y conflictos de versión.

- Componente: [BulkDialog](../../app/frontend/src/pages/editor/BulkDialog.tsx).
- Secundarios directos: Alert, Button, Checkbox, Dialog, Radio, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [bulk.spec.ts](../../tests/e2e/bulk.spec.ts), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Revisar publicación

Incidencias de preparación; no confundir con revisión de respuestas ni decisión institucional.

- Componente: [ReadinessPanel](../../app/frontend/src/pages/editor/ReadinessPanel.tsx).
- Secundarios directos: Alert, Button, EmptyState.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [bulk.spec.ts](../../tests/e2e/bulk.spec.ts), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [simplicity.spec.ts](../../tests/e2e/simplicity.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Vista previa

Simulación local de preguntas y condiciones; no genera respuestas persistidas.

- Componente: [Preview → AnswerControl](../../app/frontend/src/pages/editor/Preview.tsx).
- Secundarios directos: Alert, AnswerControl, Button, EmptyState, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [editor.css](../../app/frontend/src/editor.css), [next-authoring.css](../../app/frontend/src/next-authoring.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-invitations.css](../../app/frontend/src/next-invitations.css), [next-questionnaire.css](../../app/frontend/src/next-questionnaire.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useLayoutEffect, useLocation, useMemo, useNavigate, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `users`, `areas`, `createUser`, `createArea`, `createProject`, `resetPassword`, `userState`, `members`, `setMember`, `dashboard`, `questionnaire`, `projects`, `createQuestion`, `editQuestion`, `<expression>`, `reorderSections`, `reorderQuestions`, `editSection`, `createSection`, `createReference`, `assign`, `metadata`, `invitationPolicy`, `createInvitation`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `bulkAreaPreview`, `bulkParticipantsPreview`, `bulkPublishPreview`, `bulkAreaConfirm`, `bulkParticipantsConfirm`, `bulkPublishConfirm`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Importación

Archivo, preview y confirmación oficiales; no es importación de respuestas. Contrato restringe proyectos poblados.

- Componente: [ImportStructure](../../app/frontend/src/pages/Exchange.tsx).
- Secundarios directos: Alert, Button, Checkbox, ErrorState, Input, Link, LoadingState, ProjectTools, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-attention.css](../../app/frontend/src/next-attention.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useAttentionClarifications, useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `imports/preview`, `imports/confirm`, `projects`, `<expression>`, `dashboard`, `traceability`, `history`, `listReviewInbox`, `getReviewDetail`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [Visibility.test.tsx](../../app/frontend/src/pages/Visibility.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [exchange.spec.ts](../../tests/e2e/exchange.spec.ts), [import-examples.spec.ts](../../tests/e2e/import-examples.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Exportación

Alcance autorizado; VIEWER exporta decisiones vigentes.

- Componente: [ExportProject](../../app/frontend/src/pages/Exchange.tsx).
- Secundarios directos: Alert, Button, Checkbox, ErrorState, Input, Link, LoadingState, ProjectTools, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-attention.css](../../app/frontend/src/next-attention.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useAttentionClarifications, useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `imports/preview`, `imports/confirm`, `projects`, `<expression>`, `dashboard`, `traceability`, `history`, `listReviewInbox`, `getReviewDetail`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [Visibility.test.tsx](../../app/frontend/src/pages/Visibility.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [exchange.spec.ts](../../tests/e2e/exchange.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Invitaciones

Asistente de cuatro pasos; política, vigencia, alcance y actividad. Compartir enlace es manual; no envía correo.

- Componente: [Invitations / CreateInvitation / InvitationLink](../../app/frontend/src/pages/Invitations.tsx).
- Secundarios directos: Alert, Button, Checkbox, CreateInvitation, Dialog, ErrorState, Input, InvitationLink, LoadingState, ProjectWorkbench, Select, Textarea.
- Estilos: [next-invitations.css](../../app/frontend/src/next-invitations.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `invitationPolicy`, `createInvitation`, `projects`, `questionnaire`, `setInvitationPolicy`, `revokeInvitation`, `renewInvitation`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [invitations.spec.ts](../../tests/e2e/invitations.spec.ts), [next-workbench.spec.ts](../../tests/e2e/next-workbench.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Invitado externo

Fragmento privado canjeado antes de renderizar; sesión acotada, guardar/enviar/evidencia/aclaraciones.

- Componente: [InvitedResponse](../../app/frontend/src/pages/InvitedResponse.tsx).
- Secundarios directos: Alert, AnswerControl, Brand, Button, Checkbox, Dialog, Input, InvitedQuestion, LoadingState, Textarea.
- Estilos: [invitation.css](../../app/frontend/src/invitation.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useCallback, useContext, useEffect, useId, useQuery, useRef, useState.
- API relacionada: `branding`, `invitationAccess`, `invitationLogout`, `invitationResponse`, `invitationClarifications`, `invitationSave`, `invitationAttach`, `invitationRemove`, `invitationReply`, `invitationSubmit`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [invitations.spec.ts](../../tests/e2e/invitations.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Mi trabajo

Pendientes, borradores, enviados, aclaraciones y Por consultar; tarea individual priorizada.

- Componente: [MyWork / ProjectWork](../../app/frontend/src/pages/MyWork.tsx).
- Secundarios directos: Button, EmptyState, ErrorState, Input, Link, LoadingState, ParticipantBadge, ParticipantFocus, ParticipantIcon, ParticipantSummary, ProjectWork, Topic, Welcome.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQueries, useQuery, useRef, useState.
- API relacionada: `branding`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [responses.spec.ts](../../tests/e2e/responses.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Responder

Borrador privado y envío explícito; evidencia, versiones, errores y salida con cambios pendientes.

- Componente: [Respond → AnswerControl](../../app/frontend/src/pages/Respond.tsx).
- Secundarios directos: Alert, AnswerControl, Button, Dialog, ErrorState, Input, Link, LoadingState, ParticipantIcon, ResponseEditor, SubmittedResponseContent, Textarea.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useContext, useEffect, useForm, useId, useLocation, useNavigate, useParams, useQuery, useQueryClient, useRef, useState, useWatch.
- API relacionada: `branding`, `personalProject`, `getResponse`, `<expression>`, `saveDraft`, `submitResponse`, `attachEvidenceToDraft`, `removeDraftEvidence`, `getDraft`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [responses.spec.ts](../../tests/e2e/responses.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Respuesta enviada

Lectura del envío inmutable y consulta de resultado autorizado.

- Componente: [SubmittedResponse / SubmittedResponseContent](../../app/frontend/src/pages/ParticipantFlow.tsx).
- Secundarios directos: Alert, Button, EmptyState, ErrorState, Link, LoadingState, Notice, ParticipantFocus, ParticipantIcon, Receipt, Sent, SubmittedResponseContent.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQuery, useRef, useState.
- API relacionada: `branding`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [responses.spec.ts](../../tests/e2e/responses.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Acuse de trabajo

Resumen de trabajo al terminar; posición en recorrido no equivale a número de envíos.

- Componente: [SessionReceipt](../../app/frontend/src/pages/ParticipantFlow.tsx).
- Secundarios directos: Alert, Button, EmptyState, ErrorState, Link, LoadingState, Notice, ParticipantFocus, ParticipantIcon, Receipt, Sent, SubmittedResponseContent.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQuery, useRef, useState.
- API relacionada: `branding`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Aclaraciones

Respuesta a hilos asociados a aportaciones; invitado tiene recorrido equivalente dentro de /invite.

- Componente: [Clarifications / ThreadMessages](../../app/frontend/src/pages/Clarifications.tsx).
- Secundarios directos: Alert, Button, Dialog, EmptyState, ErrorState, Link, LoadingState, ParticipantFocus, ParticipantIcon, Reply, SubmittedAnswer, Textarea, ThreadMessages.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBeforeUnload, useBlocker, useBranding, useContext, useEffect, useId, useLocation, useNavigate, useParams, useQuery, useQueryClient, useRef, useState.
- API relacionada: `branding`, `replyClarification`, `myClarifications`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [participant.spec.ts](../../tests/e2e/participant.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Bandeja de revisión

Bandeja filtrada por proyecto y estados; no es Revisar publicación.

- Componente: [ReviewInbox](../../app/frontend/src/pages/ReviewInbox.tsx).
- Secundarios directos: AnalystStatus, Button, EmptyState, ErrorState, Link, LoadingState, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useQuery, useRef, useSearchParams, useState.
- API relacionada: `branding`, `listReviewInbox`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [review.spec.ts](../../tests/e2e/review.spec.ts), [simplicity.spec.ts](../../tests/e2e/simplicity.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Revisión de pregunta

canReview procede del backend; ADMIN no adquiere las acciones del analista por ser administrador.

- Componente: [ReviewDetail](../../app/frontend/src/pages/ReviewDetail.tsx).
- Secundarios directos: Alert, AnalystStatus, Button, ConflictComparison, ContributionSet, DecisionRecord, ErrorState, Link, LoadingState, ProjectWorkbench, ReviewActionDialog, Select, ThreadMessages.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-contributions.css](../../app/frontend/src/next-contributions.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `getReviewDetail`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Aportaciones múltiples

Conjunto de envíos vigentes; búsqueda, selección, detalle e historial separado. N no implica consenso.

- Componente: [ContributionSet](../../app/frontend/src/pages/ContributionSet.tsx).
- Secundarios directos: Button, ContributionComparison, EmptyState, Input, Select, SubmissionSignals, SubmittedAnswer.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-contributions.css](../../app/frontend/src/next-contributions.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `getReviewDetail`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [next-questionnaire.spec.ts](../../tests/e2e/next-questionnaire.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Comparar / conflicto

Comparar A/B no crea conflicto. Conflicto conserva fuentes reales, incluso históricas; resolver no valida.

- Componente: [ContributionComparison / ConflictComparison](../../app/frontend/src/pages/ContributionComparison.tsx).
- Secundarios directos: Fragment, Select, SubmittedAnswer.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [next-contributions.css](../../app/frontend/src/next-contributions.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `getReviewDetail`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Decisiones

Listado desde dashboard VALIDATED; consulta documental, alcance, excepciones y fuentes. VIEWER tiene otro acceso de lectura autorizado.

- Componente: [ProjectDecisions → ReviewDetail → DecisionRecord](../../app/frontend/src/pages/ProjectDecisions.tsx).
- Secundarios directos: AnalystStatus, Button, EmptyState, ErrorState, Input, Link, LoadingState, ProjectWorkbench, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `dashboard`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [next-workbench.spec.ts](../../tests/e2e/next-workbench.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Preguntas publicadas / lector

Nombre de export histórico Participant; también consulta del lector, no confundir con formulario de respuesta.

- Componente: [Participant](../../app/frontend/src/pages/Access.tsx).
- Secundarios directos: Alert, Brand, Button, Container, EmptyState, ErrorState, Input, Link, LoadingState, ParticipantHome, PersonalProgress, StatusBadge.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useBranding, useContext, useEffect, useId, useLocation, useParams, useQueries, useQuery, useRef, useState.
- API relacionada: `branding`, `loginContext`, `login`, `password`, `projects`, `participant`, `personalProject`, `getResponse`, `<expression>`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Trazabilidad

Referencias y enlaces a preguntas; una referencia no hereda VALIDATED.

- Componente: [Traceability](../../app/frontend/src/pages/Visibility.tsx).
- Secundarios directos: Alert, AnalystStatus, Button, EmptyState, ErrorState, Input, Link, LoadingState, Metric, MetricRow, ProjectAttention, ProjectTools, ProjectWorkbench, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-attention.css](../../app/frontend/src/next-attention.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useAttentionClarifications, useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `dashboard`, `traceability`, `history`, `listReviewInbox`, `getReviewDetail`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [Visibility.test.tsx](../../app/frontend/src/pages/Visibility.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Bitácora

Eventos con actor/fecha, sin convertir historial en estado vigente.

- Componente: [History](../../app/frontend/src/pages/Visibility.tsx).
- Secundarios directos: Alert, AnalystStatus, Button, EmptyState, ErrorState, Input, Link, LoadingState, Metric, MetricRow, ProjectAttention, ProjectTools, ProjectWorkbench, Select.
- Estilos: [analyst-visual.css](../../app/frontend/src/analyst-visual.css), [next-attention.css](../../app/frontend/src/next-attention.css), [next-comparison.css](../../app/frontend/src/next-comparison.css), [project-workbench.css](../../app/frontend/src/project-workbench.css), [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useAttentionClarifications, useBranding, useContext, useEffect, useId, useLayoutEffect, useLocation, useParams, useQuery, useQueryClient, useRef, useSearchParams, useState, useWorkbenchContext.
- API relacionada: `branding`, `<expression>`, `projects`, `dashboard`, `traceability`, `history`, `listReviewInbox`, `getReviewDetail`, `invitations`.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [ProjectWorkbench.test.tsx](../../app/frontend/src/pages/ProjectWorkbench.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [Visibility.test.tsx](../../app/frontend/src/pages/Visibility.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [workbench-context.test.tsx](../../app/frontend/src/workbench-context.test.tsx), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Evidencia

Carga al borrador, vinculación al envío, hash y descarga autorizada; API no expone objetos libremente.

- Componente: [uploadEvidence / downloadEvidence; InvitationClient](../../app/frontend/src/api.ts).
- Secundarios directos: No aplica: helper transversal.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): Sin hooks propios.
- API relacionada: Recibe datos/callbacks; consultar contenedor en related_files.
- Tests relacionados: [AnalystVisual.test.tsx](../../app/frontend/src/pages/AnalystVisual.test.tsx), [AnswerControl.test.tsx](../../app/frontend/src/pages/AnswerControl.test.tsx), [ContributionComparison.test.tsx](../../app/frontend/src/pages/ContributionComparison.test.tsx), [ContributionSet.test.tsx](../../app/frontend/src/pages/ContributionSet.test.tsx), [Exchange.test.tsx](../../app/frontend/src/pages/Exchange.test.tsx), [Invitations.test.tsx](../../app/frontend/src/pages/Invitations.test.tsx), [MyWork.test.tsx](../../app/frontend/src/pages/MyWork.test.tsx), [ProjectAttention.test.tsx](../../app/frontend/src/pages/ProjectAttention.test.tsx), [ProjectDecisions.test.tsx](../../app/frontend/src/pages/ProjectDecisions.test.tsx), [QuestionForm.test.tsx](../../app/frontend/src/pages/QuestionForm.test.tsx), [ReviewActions.test.tsx](../../app/frontend/src/pages/ReviewActions.test.tsx), [BulkDialog.test.tsx](../../app/frontend/src/pages/editor/BulkDialog.test.tsx), [BulkSelection.test.tsx](../../app/frontend/src/pages/editor/BulkSelection.test.tsx), [EditorWorkspace.test.tsx](../../app/frontend/src/pages/editor/EditorWorkspace.test.tsx), [QuestionnairePresentation.test.tsx](../../app/frontend/src/pages/editor/QuestionnairePresentation.test.tsx), [readiness.test.tsx](../../app/frontend/src/pages/editor/readiness.test.tsx), [invitations.spec.ts](../../tests/e2e/invitations.spec.ts), [responses.spec.ts](../../tests/e2e/responses.spec.ts), [review.spec.ts](../../tests/e2e/review.spec.ts), [bulk-contracts.test.ts](../../tests/unit/bulk-contracts.test.ts), [contracts.test.ts](../../tests/unit/contracts.test.ts), [import-examples.test.ts](../../tests/unit/import-examples.test.ts), [invitations-contracts.test.ts](../../tests/unit/invitations-contracts.test.ts), [participant.test.ts](../../tests/unit/participant.test.ts), [responses.test.ts](../../tests/unit/responses.test.ts), [review.test.ts](../../tests/unit/review.test.ts).

### Vacíos / errores / confirmaciones

Diálogos, carga, reintento, errores de campo y confirmaciones; App contiene 404 y recuperación de sesión.

- Componente: [EmptyState / ErrorState / Alert / Dialog](../../app/frontend/src/ui/index.tsx).
- Secundarios directos: Alert, Button, Field.
- Estilos: [styles.css](../../app/frontend/src/styles.css).
- Hooks (directos/transitivos): useEffect, useId, useRef.
- API relacionada: Recibe datos/callbacks; consultar contenedor en related_files.
- Tests relacionados: [ui.test.tsx](../../app/frontend/src/ui/ui.test.tsx), [editor.spec.ts](../../tests/e2e/editor.spec.ts), [invitations.spec.ts](../../tests/e2e/invitations.spec.ts), [platform.spec.ts](../../tests/e2e/platform.spec.ts), [simplicity.spec.ts](../../tests/e2e/simplicity.spec.ts).


Las rutas HTTP exactas para llamadas literales están en `api_contracts` del JSON. `api.ts` añade `/api/v1`; import/export usa exchangeRequest/exchangeFetch. Un `<expression>` representa despacho dinámico que debe leerse en el archivo, no un endpoint faltante inventado. Los CSS relacionados incluyen dependencias transitivas; no equivalen a una medición de todos los selectores computados en navegador.

## 15. Limitaciones y cómo usar este contexto

- Inventario de un commit fijado, sin consultar main remoto ni ejecutar el downstream. La pestaña local abierta es institucional; no se usó como evidencia del upstream.
- No se ejecutaron tests, builds, lectores de pantalla ni una nueva sesión de usabilidad. Los conteos de pruebas en documentos copiados son históricos y fechados.
- El paquete es para lectura, no es un clon instalable. Se copió el frontend sin sus tests, contratos/referencias acotadas y documentos seleccionados. Las pruebas y archivos adicionales están inventariados y enlazados al tag público.
- Los estudios previos describen agentes/automatización, no una muestra humana representativa. Las valoraciones son referencias, no prioridades obligatorias.
- Las copias documentales portables conservan contenido pero convierten enlaces hacia archivos no incluidos en enlaces al tag. Los originales del repositorio no fueron editados. Código, fuentes, capturas y mockup se copian sin cambiar bytes.
- No se resolvieron los dos documentos NOT FOUND. El inventario local registra referencias que requieren revisión; el paquete no incluye sus contenidos.
- Gitleaks, scan de rutas/datos y comprobación de enlaces/archivos se documentan en VALIDATION.md del paquete. Ningún scan prueba por sí solo ausencia universal de información sensible.
- Para proponer cambios: separar observación, evidencia, hipótesis y propuesta; indicar impacto visual, flujo y contratos. No implementar ni asumir que el mockup es el objetivo aprobado.
