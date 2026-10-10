# Cambios de Acta

Cambios relevantes para usuarios y operadores. Estructura basada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y política de [Semantic Versioning](docs/RELEASING.md#política-de-versiones). Se conservan las categorías convencionales en inglés; las entradas se redactan en español.

La historia pública comienza con Acta. No se reconstruyen releases ni fechas de lanzamiento a partir del trabajo privado. Los resultados técnicos del snapshot permanecen en el [manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Titularidad y autorización confirmadas; licencia AGPL-3.0-only y DCO 1.1 adoptados el 2026-10-01.

## Unreleased

Sin cambios adicionales por anunciar.

## 0.6.0 — 2026-10-10

### Dirección C

Rediseño visual y de presentación del frontend, sin funcionalidad nueva de
dominio. Es compatible con los contratos, el backend y la persistencia de v0.5.0:
el código de backend, los contratos, Prisma, las migraciones, los permisos y las
reglas de publicación no cambian. Las únicas modificaciones fuera del frontend y
la documentación son las de la compilación de VersityGW descritas en *Security*.

### Added / Improved

- **Dirección C.** Sistema de diseño común (tokens, tipografía operativa y
  documental, estados con glifo y palabra, tema oscuro en la experiencia del
  participante) y componentes compartidos para todas las pantallas. No quedan
  pantallas con la presentación de la generación anterior.
- **Jerarquía visual.** Cada pantalla tiene un único encabezado propio con una
  línea de propósito y, cuando corresponde, una acción principal. La pregunta, la
  respuesta o la decisión dominan sobre los metadatos.
- **Navegación.** Barra lateral, riel o barra inferior según el ancho, con los
  destinos reales del proyecto y de la organización. Los diálogos devuelven el
  foco a quien los abrió.
- **Atención.** Agrupa por lo que requiere acción y no pinta una fila por cada
  pregunta: el tamaño de la página no crece con el número de preguntas; los
  grupos extensos se revelan por tramos.
- **Cuestionario.** Tabla con la pregunta en primer lugar y metadatos
  subordinados, controles reducidos a dos filas en escritorio, filtros accesibles
  en móvil, selección por página, resultados o tema, y autoría reordenada. Las
  operaciones masivas conservan sus alcances y validaciones.
- **Aportaciones.** Conjunto de aportaciones vigentes con detalle e historial
  separados, y acciones por aportación en un menú accesible único.
- **Conflictos.** Comparación simétrica en una tabla: una columna por postura y
  una fila por campo, sin color propio por bando; en pantallas estrechas se
  intercala por campo. «Contraste» permite comparar dos aportaciones cualesquiera.
- **Aclaraciones.** Intercambio cronológico junto a la aportación, con quién
  pregunta, quién responde, de quién es el turno y el estado.
- **Decisiones.** Presentación como documento: resultado, alcance y excepciones,
  fundamentos numerados con persona, envío y archivos, y la línea «Cómo se llegó
  aquí» derivada de los datos existentes. El registro de decisiones usa filas
  con estado; los roles de solo lectura no ven controles de edición.
- **Participantes.** Mi trabajo con avance en palabras, aclaración pendiente
  destacada y estado de cada pregunta con glifo y palabra; respuesta enviada con
  recibo y «Qué sigue» basado solo en estados reales. El borrador se conserva al
  guardar y salir; la interfaz no simula un autoguardado.
- **Invitaciones.** Invitación externa que abre con la organización que invita,
  vigencia y aviso de identidad visibles al inicio en móvil; gestor con estado,
  actividad y vigencia en días; asistente de cuatro pasos con pie fijo.
- **Administración y tablas.** Pestañas de Usuarios, Áreas y Proyectos, una
  acción principal por pestaña y una tabla de datos común que se apila en
  tarjetas con etiquetas por debajo de 760 px. La Bitácora nombra los eventos en
  lenguaje claro y conserva el código original debajo de cada uno.
- **Responsive y accesibilidad.** Recorridos revisados a 1440, 1024, 768, 390 y
  320 px, teclado, foco, nombres accesibles y reflujo. Las comprobaciones
  automáticas con axe no detectaron violaciones en las pantallas y anchos
  medidos; no equivalen a certificación.

### Security

- VersityGW 1.8.0 se compila desde el código fuente oficial de la release
  (commit `fd04bc1df2656298577b82667a4195c77f8c7563`, verificado en el build)
  con Go 1.27.2 y `golang.org/x/net` v0.60.0, en lugar de usar el binario
  publicado, que `govulncheck` reportaba como afectado. La imagen base de
  compilación está fijada por digest y no se modifica ningún archivo fuente de
  VersityGW: solo sus manifiestos de dependencias.
- El gate de vulnerabilidades del almacenamiento se conserva sin excepciones ni
  desactivaciones y se ejecuta sobre el binario resultante: 0 vulnerabilidades
  que afecten al código (`govulncheck` en modo binario).
- Procedencia, licencia Apache-2.0, avisos y modificaciones quedan documentados
  en `docker/versity/UPSTREAM-MODIFICATIONS` y en
  [proveedores S3](docs/S3-PROVIDERS.md). Cuando exista una imagen oficial
  corregida podrá reevaluarse; hoy no se publica ninguna imagen.

### Fixed

- Composición: Importar, Exportar, Trazabilidad, Bitácora, Miembros e
  Invitaciones dejan de usar el nombre del proyecto como título y de repetir un
  segundo encabezado; en la decisión, los identificadores técnicos pasan al pie.
- Duplicación de información: Atención ya no repite el motivo en cada fila y las
  acciones por aportación pasan de un selector a un único menú accesible.
- Navegación y foco: los diálogos devuelven el foco a quien los abrió, el
  enlace «Abrir la aportación» enfoca la aportación citada y volver desde la
  comparación restituye el foco.
- Estados y acciones contextuales: una revisión sin aportaciones explica el
  siguiente paso, un lote sin cambios se presenta como información y no como
  error, y las acciones aparecen según el estado y el rol.
- Responsive: tablas apiladas sin perder semántica ni nombre accesible,
  controles táctiles de al menos 44 px en las pantallas medidas y sin
  desbordes horizontales en los anchos probados.

### Known limitations

- Proyecto pre-1.0, con soporte comunitario de mejor esfuerzo y sin SLA.
- Las comprobaciones de accesibilidad son focalizadas y no equivalen a
  certificación ni a declaración de conformidad WCAG. No se realizaron pruebas
  con lector de pantalla real, dispositivos táctiles reales ni colores forzados.
- La interfaz no acredita identidad mediante enlaces: un enlace de invitación es
  una credencial compartible y el nombre mostrado no implica identidad
  verificada. El contrato no entrega el destinatario previsto y la interfaz no lo
  inventa.
- Un conflicto resuelto o una decisión validada no producen por sí solos efectos
  jurídicos ni sustituyen las reglas de autorización de la organización.
- El registro de decisiones no muestra el texto del resultado: el contrato
  actual no lo entrega en el listado.
- La documentación de self-hosting acredita Linux ARM64. No se extiende esa
  afirmación a una validación integral de Linux AMD64, multi-node o alta
  disponibilidad. VersityGW sigue siendo el proveedor S3 predeterminado
  verificado; MinIO es legacy, Garage no está soportado con el contrato actual
  y los demás endpoints S3 no se declaran ensayados.
- El build conserva la advertencia conocida de un bundle JavaScript mayor de
  500 kB.
- El texto nuevo de la interfaz está pendiente de revisión editorial.

Ver [alcance, verificación, capturas y límites](docs/design/ACTA-DIRECTION-C-IMPLEMENTATION.md)
y las [notas de la versión](docs/releases/v0.6.0.md).

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
