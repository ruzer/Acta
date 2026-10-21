# Cambios de Acta

Cambios relevantes para usuarios y operadores. Estructura basada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y política de [Semantic Versioning](docs/RELEASING.md#política-de-versiones). Se conservan las categorías convencionales en inglés; las entradas se redactan en español.

La historia pública comienza con Acta. No se reconstruyen releases ni fechas de lanzamiento a partir del trabajo privado. Los resultados técnicos del snapshot permanecen en el [manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Titularidad y autorización confirmadas; licencia AGPL-3.0-only y DCO 1.1 adoptados el 2026-10-01.

## Unreleased

### Added

- **Administración → Proyectos lista todos los proyectos de la institución.**
  Antes mostraba solo aquellos en los que la cuenta tenía membresía, así que otra
  persona administradora no veía un proyecto creado por su colega, y «Mis
  proyectos» y Administración parecían lo mismo. Ahora «Mis proyectos» sigue
  siendo donde participas y Administración → Proyectos muestra todos, con su
  estado, quién los administra («Sin administrador activo» si no hay ninguno) y
  tu acceso; ofrece «Miembros» y, solo si participas, «Abrir». La lista es solo
  de metadatos: no da acceso a respuestas, evidencias ni decisiones, que siguen
  exigiendo membresía, y unirse es un acto explícito y auditado. No hace falta un
  rol SUPERADMIN; ver [Administración y visibilidad de proyectos](docs/PROJECT-ADMINISTRATION.md).
  Operación nueva: `GET /administration/projects` (solo administración de la
  institución).
- **Administración de áreas.** En Administración → Áreas se puede **renombrar**,
  **desactivar** y **reactivar** un área, y consultar las desactivadas con
  «Mostrar áreas desactivadas». El código no cambia y no existe borrado.
  Un área desactivada deja de poder elegirse para preguntas nuevas, miembros,
  invitaciones y operaciones masivas, y una pregunta de esa área no se publica
  hasta moverla; todo lo que ya la usa se conserva y sigue funcionando:
  preguntas (editables sin cambiar su área), asignaciones, participantes e
  invitaciones. Solo la administración de la institución puede hacerlo y cada
  cambio queda en la bitácora como «Área actualizada» (`AREA_UPDATED`, con el
  antes y el después). Operación nueva: `POST /areas/:id`.
- **Desactivar un área no deja pasar trabajo nuevo, ni en carrera.** Quien
  asigna trabajo a un área (pregunta, miembro, invitación, operación masiva o
  importación) la bloquea en lectura antes de comprobar que sigue activa, y
  desactivarla la bloquea en escritura: si ambas coinciden, la desactivación
  espera o el cambio nuevo se rechaza con su error junto al campo. Antes, una
  pregunta guardada en el mismo instante podía quedar en un área ya desactivada.
  Las asignaciones y el acceso de los participantes existentes no cambian.

### Changed

- **Capturar un cuestionario pide menos.** «+ Agregar tema» sale de un menú
  cerrado y de la última línea de una lista larga: ahora está junto a «Nueva
  pregunta» en Organizar y al inicio de Escribir, con cuestionarios vacíos y con
  cientos de preguntas. Una pregunta nueva propone el siguiente identificador
  libre (`P-001`, `P-002`…) y un título breve tomado de la primera oración de la
  redacción, sin servicios externos; ambos se pueden cambiar y el título no se
  vuelve a sobrescribir si lo modificas. Los identificadores existentes no
  cambian. Si dos personas guardan el mismo identificador a la vez, quien llega
  segundo recibe el error junto al campo (antes, un mensaje genérico) y el
  formulario propone el siguiente sin perder lo escrito.
- Los participantes de un área desactivada ya no pierden el acceso a lo que
  tenían asignado: antes esa condición ocultaba sus preguntas y los excluía del
  avance. La importación indica ahora con el nombre actual por qué rechaza un
  área existente (renombrada o desactivada) y los formularios muestran un error
  junto al campo cuando se elige un área desactivada.

## 0.8.0 — 2026-10-13

Instalación guiada, Centro de Configuración y personalización institucional con
segundo logotipo. PRs [#39](https://github.com/ruzer/Acta/pull/39) y
[#40](https://github.com/ruzer/Acta/pull/40). **Agrega dos migraciones aditivas**
(`202610120001_installation_setup_settings` y `202610130001_secondary_logo`:
tablas nuevas, un valor de enumeración y una columna; no reescriben datos). Las
instalaciones existentes conservan usuarios, evidencia, configuración y `.env`,
y no ven el asistente. Ver [Instalación guiada y Configuración](docs/ADMIN-CENTER.md)
y las [notas de la versión](docs/releases/v0.8.0.md), que incluyen cómo
actualizar desde v0.7.0 y los límites conocidos.

### Added

- **Asistente de primera instalación**, opcional: Bienvenida, Administrador,
  Organización, Almacenamiento (solo comprueba), Personalización con vista
  previa, Verificación y Finalizar. Solo funciona con un código de un solo uso
  que emite quien opera el servidor (`scripts/setup-token.mjs`), guardado como
  SHA-256, con caducidad, límite de intentos y una única transacción bajo el
  mismo candado que `bootstrap-admin`. No reaparece una vez que existe un
  administrador. `SETUP_WIZARD=disabled` lo apaga.
- `scripts/install.sh`: comprueba Docker, escribe un `.env` mínimo solo si no
  existe y se pidieron opciones, arranca Acta y muestra la dirección del
  asistente. Es un atajo: `docker compose up` con o sin `.env` sigue siendo
  válido.
- **Administración → Configuración**: General (formato regional y zona horaria),
  Apariencia, Almacenamiento (estado y prueba de conexión) y Sistema (versión,
  base de datos, seguridad y límites). Cambios con control de versión y
  auditados (`SETTINGS_UPDATED`, `BRANDING_ASSET_CHANGED/REMOVED`,
  `STORAGE_CONNECTION_TESTED`, `INSTALLATION_BOOTSTRAPPED`).
- **Apariencia** reúne identidad (institución, aplicación, nombre corto y
  entidad del segundo logotipo), color y tres imágenes: logotipo principal,
  **segundo logotipo opcional** (un área o entidad que acompaña a la
  institución) y favicon. La vista previa es realista (pestaña, navegación y
  acceso) y muestra lo escrito y las imágenes elegidas antes de guardarlas. Los
  cambios se ven sin recompilar ni reiniciar.
- Las imágenes se validan por sus bytes (PNG/JPEG para los logotipos, PNG/ICO
  para el favicon; sin SVG), con límites de tamaño, y se sirven como imagen
  inerte. También se definen por entorno (`APP_LOGO`, `APP_LOGO_SECONDARY`,
  `APP_FAVICON`) y entonces mandan.
- Jerarquía visual de las marcas: el principal es la identidad (acceso, barra
  lateral y encabezado móvil); el segundo es más pequeño y solo aparece en el
  acceso y en las invitaciones externas. Sin él, nada cambia ni se reserva
  espacio.
- Pruebas de instalación limpia y reinicio en CI (`guided-install`) y una guía
  de [diseño de integraciones](docs/INTEGRATIONS-DESIGN.md) (webhooks y correo,
  sin implementar).

### Changed

- Los valores de apariencia que define la infraestructura (`APP_NAME`,
  `APP_SHORT_NAME`, `APP_ACCENT`, `APP_LOGO`, `APP_LOGO_SECONDARY`,
  `APP_SECONDARY_NAME`, `APP_FAVICON`, `DEFAULT_LOCALE`, `DEFAULT_TIMEZONE`)
  se muestran como «administrado externamente» y no se pueden cambiar desde la
  aplicación; el resto lo elige la administración. `docker-compose.yml` ya no
  inyecta valores por defecto para ellas (los aplica la aplicación) y
  `.env.example` las deja comentadas.
- El nombre de la institución de la pantalla de acceso y del encabezado sale
  de la base de datos, igual que dentro de la sesión; `ORGANIZATION_NAME` es
  solo el nombre inicial.
- En el acceso, el logotipo principal se muestra grande sobre el nombre de la
  institución (antes iba pequeño junto al nombre de Acta). La ruta de
  navegación no repite el logotipo que la barra lateral ya muestra y, en la
  barra estrecha, la barra lateral muestra solo el logotipo (su nombre sigue
  disponible para lectores de pantalla). El encabezado de las invitaciones
  externas envuelve en pantallas estrechas en lugar de desbordarse.
- `bootstrap-admin` también registra la instalación como completada.
- La API pública de configuración (`GET /configuration/public`) añade
  `logoSecondary` y `secondaryName` (cadenas vacías si no se usan).

### Security

- Rutas públicas nuevas, acotadas: `GET /setup/status` (solo un estado),
  `/setup/*` (exigen el código de instalación y se cierran al completar la
  instalación) y `GET /configuration/assets/{logo,logoSecondary,favicon}`
  (imagen inerte con `nosniff` y CSP sin recursos). Las rutas de administración
  exigen administrador de la institución, origen de la aplicación y CSRF, y
  comprueban quién antes de validar qué. Ningún secreto aparece en respuestas
  ni en la auditoría.

## 0.7.0 — 2026-10-12

Mejora continua del frontend con datos de gran volumen y ampliaciones de
**lectura** compatibles en la API (ver el último párrafo).
PRs [#33](https://github.com/ruzer/Acta/pull/33),
[#34](https://github.com/ruzer/Acta/pull/34),
[#35](https://github.com/ruzer/Acta/pull/35),
[#36](https://github.com/ruzer/Acta/pull/36) y
[#37](https://github.com/ruzer/Acta/pull/37).

### Fixed

- El asistente de invitación pide el «Área de la aportación» en el primer paso,
  junto al destinatario; antes estaba al final del paso de preguntas, fuera de
  la vista, y bloqueaba «Continuar» sin explicación.
- Importar muestra el identificador del proyecto que el archivo debe repetir y
  lo recuerda junto al error de coincidencia; los errores de la revisión se
  presentan como errores y las advertencias como información.
- Los conteos de uno se escriben en singular («1 pregunta», «1 aportación»,
  «1 error») en toda la interfaz.
- Tras una operación en lote el resultado se dice una vez, no dos veces.
- Un cuestionario sin preguntas muestra solo cómo empezar, sin la barra de
  búsqueda, filtros y selección; Atención sin preguntas indica al analista dónde
  continuar e Invitaciones distingue entre no tener ninguna y un filtro sin
  resultados.
- Miembros de un proyecto abierto desde Administración › Proyectos vuelve a
  Administración, en esa misma lista, en lugar de enviar al cuestionario.
- Una pregunta que tuvo una decisión y ya no la tiene vigente lo dice en la
  pestaña Decisión («No hay una decisión vigente. La decisión anterior se
  conserva como antecedente»); antes solo mostraba una lista cerrada.

### Added

- «Siguiente por revisar» en la revisión de una pregunta: al llegar desde
  Atención, lleva a la siguiente pregunta de la misma lista, en su mismo orden
  y con sus mismos filtros, y conserva el retorno a Atención. Solo usa datos ya
  cargados; no aparece para quien solo consulta ni cuando no hay más casos.
- Administración › Proyectos lista los proyectos con su identificador,
  preguntas publicadas y accesos directos a abrirlos y a sus miembros, y el
  formulario de alta explica para qué sirve el identificador.
- Decisiones muestra el inicio de lo decidido en cada línea (extracto de hasta
  240 caracteres), su alcance, fecha y quién la registró, y la búsqueda también
  encuentra por el texto de la decisión. Las preguntas cuya decisión dejó de
  estar vigente aparecen aparte («Sin decisión vigente») con el antecedente y el
  motivo, y una línea resume cuántas están así y cuántas preguntas faltan por
  decidir, con enlace a Atención. Abrir una pregunta lleva a su registro
  completo.
- La Bitácora nombra sobre qué ocurrió cada evento de respuestas, decisiones e
  invitaciones: la pregunta (identificador y título, con enlace que vuelve a la
  Bitácora con sus filtros) o la invitación por su etiqueta; lo que no puede
  nombrar sigue mostrando su identificador.

### Changed

- Registrar una decisión es más directo: si hay una sola respuesta vigente ya
  viene elegida como fuente, el foco empieza en «Decisión acordada» y, si falta
  la fuente, el mensaje lo dice y lleva a ella en lugar de quedar fuera de la
  vista del diálogo.
- Escribir pliega los temas cuando el cuestionario tiene más de 40 preguntas
  (el primero queda abierto y cada tema muestra su conteo), como ya hace Mi
  trabajo; un cuestionario de 300 preguntas ya no es una sola página muy larga.
- La acción de cada cuenta en Administración se llama «Restablecer contraseña»
  y nombra a la persona para lectores de pantalla.
- Organizar dice el alcance de «Expandir/Contraer todos los grupos» solo cuando
  llega más allá de lo visible (filtros o varias páginas); antes ocupaba una
  línea fija.
- En móvil, las etiquetas de las tablas apiladas ya no se parten a mitad de
  palabra.
- Registrar una decisión con muchas respuestas vigentes (más de seis) dice
  cuántas fuentes hay elegidas, ofrece «Seleccionar todas» y «Quitar selección»,
  muestra el principio de cada respuesta y mantiene la lista en un área
  acotada; con 50 aportaciones el diálogo pasa de unos 3 100 a unos 1 300 px.
- La Bitácora se filtra por «Objeto» y «Acción» con listas en español en lugar
  de pedir el código en inglés; las preguntas aparecen con su identificador y
  título y enlazan a su revisión (antes, un identificador oculto); la columna
  «Detalle» solo se muestra si algún evento la usa y la paginación indica
  «Página 1 de N».
- Decisiones muestra una línea por decisión y no repite «Vigente» en cada fila
  (la página ya lo dice): 120 decisiones ocupan unos 6 200 px en vez de unos
  14 900.
- El filtro «Actor» de la Bitácora lista las cuentas y una sola opción,
  «Invitaciones externas (N)», en lugar de una opción por invitación; con cientos
  de invitaciones la lista ya no es inmanejable.

Cambios de contrato de la API, solo de lectura y compatibles (sin permisos,
escrituras, estados persistidos, almacenamiento ni migraciones nuevos): nuevo
`GET /projects/:projectId/decisions` (solo ADMIN y ANALYST; extractos de la
decisión vigente o, si se reabrió, de la última anterior; una lectura sin
consultas por registro); `GET /projects/:projectId/history` añade `subject` a
cada evento, `invitationActors` y el filtro `actorKind`, y `actors` pasa a
listar solo cuentas (más el actor filtrado). El contrato de exportación no
cambia. Ver el [registro de mejora continua](docs/product/CONTINUOUS-IMPROVEMENT.md)
y las [notas de la versión](docs/releases/v0.7.0.md).

## 0.6.1 — 2026-10-10

### Fixed

- **Grupos del cuestionario** ([#29](https://github.com/ruzer/Acta/pull/29)).
  «Expandir todos los grupos» y «Contraer todos los grupos» están juntos y
  visibles cuando hay preguntas con seguimientos. Afectan todos los grupos,
  incluidos los de otras páginas o fuera de los filtros, sin perder la
  selección ni los controles individuales. Durante una búsqueda se muestran
  también los seguimientos y se deshabilita la contracción global.
- **Publicación conjunta** ([#30](https://github.com/ruzer/Acta/pull/30)).
  La vista previa de operaciones masivas refresca el cuestionario antes de
  calcular el alcance. Evita usar versiones anteriores de las preguntas si
  acaba de confirmarse una asignación y su actualización sigue pendiente.
  Se conservan las dependencias, la confirmación explícita y las validaciones
  de concurrencia del backend.
- **Foco tras una revisión** ([#32](https://github.com/ruzer/Acta/pull/32)).
  Después de registrar una decisión u otro comando de revisión que retira el
  botón que tenía el foco, este pasa al título de la pregunta aunque la página
  tarde en actualizarse. Antes podía perderse al inicio del documento, lo que
  afectaba a quien navega con teclado o lector de pantalla. No cambia el
  comportamiento al cancelar un diálogo ni los datos que se registran.

Sin cambios de API, contratos, permisos, almacenamiento ni migraciones respecto
de v0.6.0. [Notas de la versión](docs/releases/v0.6.1.md).

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
