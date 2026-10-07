# Cambios de Acta

Cambios relevantes para usuarios y operadores. Estructura basada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y política de [Semantic Versioning](docs/RELEASING.md#política-de-versiones). Se conservan las categorías convencionales en inglés; las entradas se redactan en español.

La historia pública comienza con Acta. No se reconstruyen releases ni fechas de lanzamiento a partir del trabajo privado. Los resultados técnicos del snapshot permanecen en el [manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Titularidad y autorización confirmadas; licencia AGPL-3.0-only y DCO 1.1 adoptados el 2026-10-01.

## Unreleased

Sin cambios adicionales por anunciar.

## 0.5.0

### Acta Next

Evolución del frontend compatible con los contratos de v0.4.0. Esta sección
prepara la versión; su publicación se confirma por el tag y la release oficial.

### Changed

- ACTA NEXT: Cuestionario operativo con enfoques Preparar/Analizar, jerarquía,
  colapso, área, aportaciones vigentes y acción contextual. La selección masiva
  conserva su alcance explícito y las reglas existentes.
- Navegación por Atención, Cuestionario y Decisiones, con invitaciones accesibles
  y retorno a filtros, posición y selección dentro de la sesión.
- Conjunto de aportaciones, contraste simétrico de dos fuentes y decisión con
  resultado, contexto, fuentes e historial. N aportaciones no implica consenso.
- Invitaciones en cuatro pasos con resumen previo; contexto y guardado más
  claros para invitados y evidencia compacta para participantes. Sin cambios
  de backend, contratos, migraciones, permisos ni seguridad de invitaciones.
- Presentación adaptable de preguntas y contraste en escritorio y móvil, con
  bloques legibles a 390 px y autoría que mantiene opciones/MATRIX junto al tipo.

### Fixed

- El retorno al cuestionario conserva su posición incluso cuando el cambio de
  ruta emite eventos de scroll antes de completar la navegación.
- Retorno de foco, apertura y asociación de errores con sus campos, reflujo y
  controles por teclado comprobados en los recorridos focalizados. Axe sin
  violaciones en esas muestras no equivale a certificación WCAG.
- Organizar distingue un cuestionario vacío de una búsqueda sin coincidencias
  y explica el siguiente paso sin atribuir la ausencia de preguntas a filtros.

Ver [alcance, verificación, capturas y límites](docs/design/ACTA-NEXT-IMPLEMENTATION.md).


## 0.4.0

[Acta v0.4.0](https://github.com/ruzer/Acta/releases/tag/v0.4.0) incorpora respuestas externas mediante invitaciones privadas. La fecha y el commit de publicación se registran en la release oficial.

### Added

- Invitaciones externas mediante enlaces privados con alcance explícito, vencimiento, renovación y revocación. Cada invitación conserva borradores, respuestas, evidencia y aclaraciones independientes sin exigir una cuenta.
- Administración de invitaciones desde Organizar y recorrido externo adaptable a móvil, con controles de identidad configurables por instalación.
- Guardar, salir y continuar con el enlace; envíos y correcciones por pregunta, aclaraciones sin cuenta y evidencia con los mismos controles privados de Acta.
- Varias invitaciones a una pregunta conservan respuestas independientes; el envío de una persona no completa ni sobrescribe las demás. El flujo tradicional con cuenta sigue disponible.

### Security

- Tokens aleatorios almacenados como hash, sesiones de invitación separadas de las cuentas, protección de origen/CSRF, límites de abuso y pruebas de aislamiento entre organizaciones, proyectos, preguntas y aportaciones.
- Auditoría de invitaciones y aportaciones, concurrencia, replay y revocación sin borrar respuestas enviadas. Los enlaces son credenciales compartibles; no prueban la identidad física del destinatario. No se incorpora correo automático ni OTP.

### Upgrade

- Migración aditiva para invitaciones; realizar backup de PostgreSQL, evidencia y configuración antes de actualizar y aplicar las migraciones oficiales. Se verificó actualización desde un esquema anterior con datos.
- Identidad y plazos configurables mediante `INVITATION_IDENTITY`, `INVITATION_DEFAULT_DAYS` y `INVITATION_MAX_DAYS`. Consulta la [guía de invitaciones](docs/EXTERNAL-INVITATIONS.md).

## 0.3.0 — 2026-10-06

[Publicada el 6 de octubre de 2026](https://github.com/ruzer/Acta/releases/tag/v0.3.0).

### Large questionnaire management

Operaciones conjuntas para preparar cuestionarios grandes con selección y alcance explícitos. Conserva revisión previa, confirmación y validación en el servidor; no incorpora dependencias ni sobrescribe asignaciones implícitamente.

### Added

- Operaciones masivas en Organizar: asignar área, añadir participantes y publicar, con selección por página, resultados, tema o grupo y filtro por área.
- Revisión previa del lote, confirmación atómica, control de concurrencia y reintentos idempotentes; las dependencias externas requieren selección explícita.

### Simplicity and usability

#### Changed

- El editor orienta hacia las operaciones conjuntas existentes desde Escribir y Revisar; distingue una dependencia pendiente para publicación individual de un conjunto que debe revisarse en Organizar.
- Por consultar aparece en el resumen y filtro de atención del participante; la confirmación de envío permanece en la pregunta de destino.
- Inicio administrativo, membresías e importación desde un editor vacío explican mejor el siguiente paso, sin asignaciones ni publicaciones implícitas.

#### Fixed

- Retorno de foco tras cancelar o completar asignación/publicación, incluso cuando desaparece el control del inspector.
- Enlaces de errores identificables por campo, agrupación accesible de controles y conservación de filtros al volver de una revisión.
- Los avisos repetidos sobre preguntas publicadas se resumen en una sola indicación en Revisar.

### Accessibility

- Retorno de foco probado tras cancelar/completar operaciones y al desaparecer el control del inspector; enlaces de error distinguibles y agrupaciones accesibles.
- Teclado, reduced motion y reflow comprobados en navegador, con regresión responsive y siete recorridos equivalentes. Axe no detectó violaciones en esas muestras; dos resultados de contraste quedaron incompletos y se conservaron para revisión. No se declara conformidad WCAG ni usabilidad validada con personas humanas.

### Security

- Actualización transitiva de desarrollo `source-map-js` a 1.2.2 para corregir [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), conservando el gate de auditoría de dependencias.

## 0.2.0 — 2026-10-02

Primera versión pública, [publicada el 2 de octubre de 2026](https://github.com/ruzer/Acta/releases/tag/v0.2.0).

### Added

- Proyectos, temas y ocho tipos de pregunta, con edición, orden transaccional y control de concurrencia.
- Participante con borradores persistentes, evidencia privada y envíos inmutables.
- Aclaraciones, conflictos, decisiones y fuentes verificables.
- Dashboard, importación JSON con preview, exportación autorizada y bitácora.
- Ejemplos JSON mínimo y completo descargables, guía de importación y validación automatizada con el importador real.
- Branding configurable y bootstrap explícito, sin contraseña universal.
- Abstracción S3 con VersityGW como default self-hosted, LOCAL y continuidad legacy.
- Migraciones, secretos por instalación, healthchecks, backups documentados y CI sin publicación de imágenes.
- Guías por audiencia, desarrollo e índice funcional de contratos; galería real con datos ficticios.
- Gobernanza upstream, guía de forks, proceso de releases, roadmap y soporte; plantillas preparadas de PR e Issues.

### Changed

- Identidad pública Acta y tagline Questions. Evidence. Decisions.; defaults configurables y nombres técnicos de persistencia conservados.
- Autor, titular y maintainer inicial: Cristóbal Ruz Escobar. AGPL-3.0-only y DCO 1.1 + Signed-off-by adoptados; sin CLA ni bot. Primera versión pública: 0.2.0, pre-1.0.
- Ayuda para preparar archivos y localizar errores de importación, conservando sus detalles técnicos y el contrato existente.
- Cierre documental local: textos oficiales de LICENSE y DCO cotejados, enlaces de licencia y contribución coherentes, decisiones humanas cerradas y pendientes remotos separados de las verificaciones históricas.

### Deprecated

Sin entradas por anunciar.

### Removed

Sin entradas por anunciar.

### Fixed

- Navegación de inspector con retorno de foco respetuoso de la interacción posterior, incorporada en la base del snapshot.
- Foco de la vista previa de importación aplicado después del render, sin depender de un temporizador.

### Security

- Reporte de vulnerabilidades exclusivamente privado. La habilitación de GitHub Private Vulnerability Reporting se registró el 2026-10-01; el cierre local no vuelve a comprobar su disponibilidad. El contacto de moderación permanece pendiente. Esta precisión documental no es una corrección nueva de una vulnerabilidad.
