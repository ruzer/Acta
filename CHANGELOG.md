# Cambios de Acta

Cambios relevantes para usuarios y operadores. Estructura basada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y política de [Semantic Versioning](docs/RELEASING.md#política-de-versiones). Se conservan las categorías convencionales en inglés; las entradas se redactan en español.

La historia pública comienza con Acta. No se reconstruyen releases ni fechas de lanzamiento a partir del trabajo privado. Los resultados técnicos del snapshot permanecen en el [manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Titularidad y autorización confirmadas; licencia AGPL-3.0-only y DCO 1.1 adoptados el 2026-10-01.

## Unreleased

### Added

- Operaciones masivas en Organizar: asignar área, añadir participantes y publicar, con selección por página, resultados, tema o grupo y filtro por área.
- Revisión previa del lote, confirmación atómica, control de concurrencia y reintentos idempotentes; las dependencias externas requieren selección explícita.

## 0.2.0 — 2026-10-02

Primera versión pública preparada. La fecha corresponde a esta preparación; la publicación se confirmará mediante el tag y la release después de aprobar este changelog y verificar el commit definitivo.

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
