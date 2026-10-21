# Acta — Simplicity & Usability Pass

Implementación y verificación: 6 de octubre de 2026. Base: `8940be59e64d8bd5568e80a1b0cc2a7c3af033ca`. Rama: `fix/usability-context-and-readiness`.

Este informe corresponde a una fase posterior al [estudio](USABILITY-STUDY.md). Los documentos de investigación conservan sus observaciones y su estado histórico de «no implementado»; este informe registra qué se cambió después. No se reconstruye el estudio como si ya hubiera probado las correcciones.

## Decisiones y alcance

Orden aplicado: eliminar repetición y ruido, simplificar explicación, reutilizar controles y rutas, conservar contexto por defecto, automatizar únicamente el retorno de foco; añadir enlaces a capacidades existentes como último recurso.

| Hallazgo | Intervención | Estado |
|---|---|---|
| FRICTION-001, HIGH: foco perdido al asignar/publicar | Restaurar después de desmontar el diálogo; preferir acciones de la misma pregunta, fila si el inspector desapareció, modo activo como último recurso. No robar foco si la persona ya lo movió. | IMPLEMENTADO / VERIFICADO |
| FRICTION-002, HIGH: Revisar presenta dependencia pendiente como error global | Explicar publicación individual frente a conjunta. Dependencia DRAFT pasa a advertencia contextual con acceso a Organizar. Publicación individual continúa bloqueada; principal ausente/archivada y ciclos siguen siendo errores. | IMPLEMENTADO / VERIFICADO |
| FRICTION-003: capacidad conjunta difícil de descubrir | Una orientación breve en Escribir con más de una pregunta; reutiliza Organizar, no agrega otra barra de lotes. | IMPLEMENTADO / VERIFICADO |
| FRICTION-004: Por consultar fuera del resumen | Integrarlo en atención y su filtro, con desglose aclaración/consulta; conserva estado y prioridad de Continuar. | IMPLEMENTADO / VERIFICADO |
| FRICTION-005: rodeo para importar | Enlace al importador existente cuando no hay preguntas. El contrato sigue rechazando proyectos poblados. | IMPLEMENTADO / VERIFICADO |
| FRICTION-007/008: membresía/asignación e inicio administrativo | Explicar los pasos distintos, enlazar el editor y orientar al administrador nuevo hacia Administración → Proyectos. No asignar automáticamente. | IMPLEMENTADO / VERIFICADO |
| FRICTION-010: volver al listado para confirmar envío | Quitar el temporizador de cinco segundos; mantener confirmación en la entrada de navegación de destino. | IMPLEMENTADO / VERIFICADO |
| Pérdida de filtros al volver desde revisión | Conservar la búsqueda de la bandeja en el enlace de retorno. Acceso directo conserva al menos el proyecto. | IMPLEMENTADO / VERIFICADO en componente y regresión E2E |
| Ruido de preguntas publicadas | Un resumen en Revisar en lugar de una incidencia informativa por cada publicada. | IMPLEMENTADO / VERIFICADO |
| A11Y: errores indistinguibles y grupos sin rol | Anteponer etiqueta de campo a cada enlace de error; agrupar selección/filtros con rol apropiado. | IMPLEMENTADO / VERIFICADO |

No se modificaron backend, contratos, esquema, permisos, estados, atomicidad, concurrencia ni condiciones. El servidor conserva la autoridad para revisar y confirmar el lote. No se calcula una promesa de publicación desde el frontend ni se seleccionan dependencias implícitamente.

## Evaluado y aplazado

- **FRICTION-006, aclaración respondida en bandeja:** sigue pendiente. `reviewInboxItem` expone `openClarifications`, no el desglose de quién debe actuar; el detalle sí contiene `WAITING_ANALYST`. Requiere diseñar una proyección mínima autorizada y probar su semántica, no inferirla de la fecha o descargar todos los detalles. No se amplía el contrato en este pase.
- **FRICTION-009, retención de selección entre operaciones/modos/filtros:** no se conserva automáticamente. La selección se limpia explícitamente como antes; conservar elementos ocultos o versiones obsoletas requiere una decisión de interacción y seguridad. Reseleccionar continúa siendo trabajo repetitivo conocido.
- **Identificadores y título obligatorio:** no se autogeneran ni se eliminan requisitos contractuales.
- **Fuentes de resolución/validación:** no se copian implícitamente entre actos distintos.
- **Otros MEDIUM/LOW:** advertencias repetidas de asignación/dependencias a escala, feedback de borrador incompleto y controles nativos de archivo no se rediseñan. Se conserva la lista de deuda del estudio.
- No hay nuevos modos, dashboard, inspector, wizard, telemetría ni cambios específicos de una organización.

## Before vs After

La base fueron diez agentes independientes. La repetición posterior fue un recorrido guiado por automatización en Chromium real, con siete perfiles equivalentes y conocimiento del camino esperado. **No es un segundo estudio humano ciego, ni demuestra aprendizaje espontáneo, tiempos humanos o prevalencia poblacional.** Los conteos son acciones/estados observados en esos recorridos.

| Perfil / tarea equivalente | Before | After observado | Límite |
|---|---|---|---|
| Administrador nuevo P10 | Orientación para esperar acceso; cuatro navegaciones adicionales desde editor vacío para hallar importación | Orientación administrativa correcta; editor → importación por un enlace, cero rodeos; preview/confirmación crea 10 preguntas/2 temas | No mide descubrimiento humano; crear proyecto aún requiere elegir Proyectos dentro de Administración |
| Administrador ocasional P07, 10 preguntas | Diez asignaciones y diez publicaciones individuales | Una operación revisada de participantes y una de publicación; ninguna publicación individual de principal | Con camino conocido; no se afirma ahorro de un número total de clics humanos |
| Analista P02, 50 preguntas | 10 errores aparentes de principal pendiente pese a lote válido | Advertencia que distingue alcances; lote de 50 validado y publicado; cero publicaciones individuales necesarias | La selección debe repetirse después de asignar |
| Analista P03, 300 preguntas | 60 errores aparentes; 300 avisos informativos tras publicación | Lote válido de 300; un solo resumen de contenido publicado | Antes de asignar todavía hay muchas advertencias; no se declara resuelta toda la densidad de Revisar |
| Participante P05 | Una consulta no aparecía en atención; filtro devolvía vacío | Con 30 preguntas: 28 pendientes + 1 borrador + 1 atención; Por consultar accesible desde atención. Retoma borrador, envía y ve confirmación en siguiente pregunta | Dataset equivalente, no exactamente el mismo punto de envíos del estudio |
| Teclado P09 | 14–15 Tab para recuperar pregunta tras perder foco | Cero Tab de recuperación tras cancelar/guardar asignación y publicar; foco en acciones de la misma pregunta | Recorrido con teclas reales; no lector de pantalla humano |
| Móvil P08 | Regreso al listado para comprobar envío | A 390 px conserva borrador, sale, retoma, envía y ve confirmación junto a la siguiente pregunta | Chromium emulado, no teléfono físico |

Se automatizó continuidad de foco, no decisiones ni escrituras. Se conservan selección explícita, revisión previa y confirmación. El volumen de UI no tiene una métrica universal: se quitaron avisos repetidos, texto de rol incorrecto y temporizador; se añadieron únicamente pistas y enlaces a rutas existentes.

## Evidencia y revisión visual

[Resultados por perfil](simplicity-pass/results.json) y [hashes de evidencia posterior](simplicity-pass/manifest.json). Procedencia: instalación descartable, usuarios y contenido ficticios. No contiene credenciales ni configuración del laboratorio.

| Pantalla | Evidencia posterior |
|---|---|
| Inicio administrativo | [Inicio vacío](simplicity-pass/p10-empty-admin.png) |
| Cuestionario importado | [10 preguntas](simplicity-pass/p10-imported.png) |
| Descubrimiento desde Escribir | [10 preguntas](simplicity-pass/p07-write.png), [50 preguntas](simplicity-pass/p02-write.png) |
| Revisar y publicar a escala | [Advertencias](simplicity-pass/p03-readiness.png), [preview de 50](simplicity-pass/p02-publication-preview.png), [resumen de 300](simplicity-pass/p03-publication-summary.png) |
| Consulta y envío | [Atención](simplicity-pass/p05-consultation-filter.png), [confirmación](simplicity-pass/p05-submission-feedback.png) |
| Móvil / teclado | [390 px](simplicity-pass/p08-mobile-confirmation.png), [foco después de publicar](simplicity-pass/p09-keyboard-publication.png) |

Se inspeccionaron visualmente esas capturas. Se excluyó una captura prematura de P10 que todavía mostraba la lista de proyectos y una captura del fallo de preparación de P05: no prueban la pantalla posterior esperada. El enlace de importación fue utilizado y verificado funcionalmente.

Siete comprobaciones axe posteriores: cero violaciones; dos muestras conservan `color-contrast` como resultado incompleto, que exige juicio visual. Se revisaron foco visible, jerarquía, contraste aparente y ausencia de desbordamiento en los recorridos. No equivale a certificación WCAG ni reemplaza pruebas humanas con tecnologías de asistencia. E2E adicional comprueba inspector sin duplicación, teclado, reduced motion, errores distintos y reflow; la regresión existente cubre 1440/1024/768/390.

## Validación reproducible y resultados

- `npm test`: **130/130**, 19 archivos.
- Integración PostgreSQL real: **94/94**, cero omitidos/cancelados.
- Playwright completo: **40/40**, cero omitidos y sin retries, incluyendo tres casos nuevos de `tests/e2e/simplicity.spec.ts`.
- `npm run lint`, `npm run typecheck`, `npm run build`: **PASS**. Se conserva la advertencia de tamaño de chunk de Vite, sin nueva optimización fuera de alcance.
- `git diff --check`: **PASS**.
- Enlaces relativos: **570 destinos de archivo válidos**; hashes de los manifiestos coinciden. No se verificó disponibilidad de enlaces externos en este control.
- Gitleaks 8.30.1: **cero hallazgos** en el snapshot del índice Git y el estudio. Escaneo de referencias privadas en los archivos preparados: cero coincidencias; no se añadieron excepciones al detector.
- El CI remoto se registra en el PR; ningún resultado local sustituye su ejecución.

Los tests usan backend/PostgreSQL reales y fixtures ficticios. Los E2E nuevos preparan 10/50/300 por las APIs existentes, después ejercitan la interfaz. No alteran el DOM para cerrar diálogos ni usan force clicks, sleeps arbitrarios, skips o retries. La suite completa también recorre participante, borradores, consulta, aclaraciones, MATRIX, evidencia, conflictos, decisiones, dashboard e importación.

Incidencias de verificación, conservadas para distinguir producto y harness:

1. El primer arreglo devolvía foco antes de que React desmontara el diálogo tras una operación asíncrona. Cancelar pasaba y guardar fallaba. Se corrigió la causa restaurando después del commit de estado; se probaron ambos recorridos y el fallback de inspector.
2. La primera integración no montó `examples/` en el contenedor de pruebas. Se corrigió el montaje y se ejecutaron de nuevo los 94 casos, sin cambio de producto.
3. Una corrida E2E dio 38/40: expectativa antigua de ERROR en Revisar y configuración de nombre de organización ausente en el runner. Se actualizó la expectativa a la semántica legítima, conservando el bloqueo individual, y se repitió la suite completa con configuración consistente.
4. Una repetición completa sobre la base demo ya consumida encontró preguntas enviadas en casos que requieren borradores nuevos; se interrumpió esa corrida. El intento de crear otro laboratorio alcanzó el límite local de redes Docker. Se recrearon exclusivamente los volúmenes y redes del gate descartable y se repitió la suite desde cero. No se modificaron tests ni otras instalaciones para esconder esos estados.
5. El recorrido guiado P05 tuvo una expectativa incorrecta de visibilidad durante login. Se corrigió la observación del harness y se completaron los perfiles pendientes; no se cuenta como ejecución humana independiente ni se oculta con retries.

## Criterio de éxito y límites

Mejora demostrada: se conserva mejor foco/contexto y se puede usar la capacidad conjunta existente sin publicar principales una a una. Diez preguntas conservan una lista sencilla; 300 aprovechan la misma selección, preview y confirmación sin nuevo workflow. El participante puede ver consulta y confirmación sin una pantalla adicional.

**No demostrado:** que cualquier persona nueva comprenda todo sin capacitación. Hace falta repetir con participantes humanos y tecnologías de asistencia. Se mantiene deuda explícita, especialmente selección entre lotes y aclaraciones listas para el analista.

La recomendación de versión es incluir estas correcciones junto con las operaciones masivas ya presentes en una futura **0.3.0**. No se cambia la versión, crea tag, release o merge como parte de este pase. El PR queda sujeto al CI y revisión habituales.
