# Cambios de Acta

Cambios relevantes para usuarios y operadores. Estructura basada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y política de [Semantic Versioning](docs/RELEASING.md#política-de-versiones). Se conservan las categorías convencionales en inglés; las entradas se redactan en español.

La historia pública comienza con Acta. No se reconstruyen releases ni fechas de lanzamiento a partir del trabajo privado. Los resultados técnicos del snapshot permanecen en el [manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Titularidad y autorización confirmadas; licencia AGPL-3.0-only y DCO 1.1 adoptados el 2026-10-01.

## Unreleased

### Fixed

- **Accesos sin cambios involuntarios.** Al elegir un miembro se conservan su rol, área y estado actuales; las cuentas nuevas requieren elegir rol. El formulario muestra las diferencias, evita envíos sin cambios y pide confirmar los cambios de acceso sensibles, con advertencia al retirar la propia administración.

- **Controles no disponibles con motivo.** Los componentes compartidos admiten una explicación visible asociada al control; los botones conservan el foco sin ejecutar la acción. El puntero de espera se reserva a una operación ocupada y los valores fijos se presentan como texto seleccionable con su motivo: el identificador de una pregunta existente, el código de instalación y los valores administrados externamente.

- **Motivos claros en el editor.** Los temas protegidos, la búsqueda que mantiene grupos desplegados y la falta de áreas activas explican por qué una acción no está disponible y cómo continuar. Las preguntas archivadas no ofrecen selección y los valores que no se pueden editar muestran su motivo.

- **Motivos en todas las pantallas.** Las restricciones de formularios, selecciones, descargas y navegación muestran su causa; los enlaces y textos de solo lectura conservan la copia. Los estados de espera se distinguen de los bloqueos y el editor mantiene una jerarquía accesible de encabezados.

- **Datos de la pregunta sin desbordamiento.** El código y el tipo pasan a otra línea cuando no caben juntos en la lista de Organizar, también en pantallas intermedias.

- **Preguntas legibles al abrir el detalle.** Los enlaces de Organizar conservan el tamaño y peso del texto anterior; en móvil el enunciado sigue completo, sin recortarlo a dos líneas.

- **Fila visible al recorrer páginas.** Anterior y Siguiente muestran la fila de la pregunta abierta también al cruzar una página de Organizar, sin perder la selección ni el foco del panel.

### Changed

- **Movimiento y teclado del panel.** El cierre admite interrupciones y recorrer preguntas conserva el panel sin repetir la entrada. En móvil, Más acciones abre una hoja inferior y el pie se ajusta al teclado. El movimiento reducido usa solo fundido y el teclado evita la animación. Los controles responden brevemente al presionarlos; con movimiento reducido, lo hacen sin desplazarse.

- **Abrir y recorrer preguntas.** El título subrayado abre el mismo panel en Escribir y Organizar, con opciones, área, participantes y acciones según el estado. Cambiar de tema está junto al tema y Más acciones reúne la configuración, el orden, la selección de grupo y el archivado. La dirección conserva la pregunta; Atrás y Escape vuelven a la lista, y anterior/siguiente respetan los resultados visibles. Organizar distingue Contenido y Respuestas sin cambiar las pestañas. El panel se superpone sin estrechar la lista; presenta pregunta y opciones antes de los datos, con la acción principal y Más acciones al pie. En móvil ocupa toda la pantalla.

- **Cambiar el tema al editar.** Los borradores permiten elegir el tema antes del contenido y guardar ambos cambios juntos. La pregunta principal y todos sus seguimientos se mueven como un grupo; si alguien no es borrador, el motivo indica quién lo impide.

- **Grupos completos entre temas.** El traslado conserva la principal y sus seguimientos, respeta las posiciones reservadas y registra la edición y el movimiento en una sola operación. Un reintento desactualizado se rechaza sin repetir cambios.

- **Cambiar de tema desde las acciones.** El diálogo usa el mismo nombre en el editor y la ayuda, permite trasladar grupos completos y explica qué pregunta impide el cambio.

- **Encontrar la pregunta trasladada.** El aviso de cambio de tema ofrece Ver, cierra la vista previa si estaba abierta, enfoca la pregunta en su destino y la resalta brevemente; los filtros de Organizar se conservan. Con movimiento reducido, el resalte no se anima.

## [0.12.0] - 2026-11-24

Seguimiento de participación, plazos, autoguardado, plantillas y ayuda para el piloto,
integrados en los PR [#137](https://github.com/ruzer/Acta/pull/137),
[#140](https://github.com/ruzer/Acta/pull/140),
[#141](https://github.com/ruzer/Acta/pull/141),
[#143](https://github.com/ruzer/Acta/pull/143),
[#152](https://github.com/ruzer/Acta/pull/152),
[#153](https://github.com/ruzer/Acta/pull/153),
[#154](https://github.com/ruzer/Acta/pull/154),
[#155](https://github.com/ruzer/Acta/pull/155),
[#156](https://github.com/ruzer/Acta/pull/156),
[#157](https://github.com/ruzer/Acta/pull/157),
[#158](https://github.com/ruzer/Acta/pull/158),
[#159](https://github.com/ruzer/Acta/pull/159),
[#160](https://github.com/ruzer/Acta/pull/160),
[#164](https://github.com/ruzer/Acta/pull/164) (consolida #161–#163) y
[#165](https://github.com/ruzer/Acta/pull/165). Incluye el formulario del participante,
fechas y horas de la organización, tablero de Atención, filtros con memoria,
revisión seguida y movimiento sutil.
Las [notas de la versión](docs/releases/v0.12.0.md) explican la actualización,
la migración aditiva y los límites de la evidencia. La publicación requiere la
aprobación del propietario.

### Added

- **Kit de piloto con personas.** Plan ajustable, guion de observación, guías breves de Administración, Participante y Revisión, y plantillas para medir resultados y decidir continuar, ajustar o detener; no sustituye una validación con personas ni certifica producción.

- **Borradores con autoguardado y recuperación.** Los cambios se guardan tras una pausa al escribir, con un máximo de un intento automático cada 30 segundos y sin solicitudes simultáneas. El texto pendiente puede recuperarse en la misma pestaña; la copia se limita a la cuenta y pregunta actuales y se retira al guardar, enviar o terminar la sesión.

- **Medición reproducible de guardados simultáneos.** Un ensayo local crea 300 preguntas y 50 participantes ficticios, informa latencias y errores reales y comprueba por qué debe conservarse el recálculo de revisión al guardar borradores. La primera medición registró fallos bajo esa carga; no acredita operación institucional con esa concurrencia.

- **Entregables a la vista.** Atención y Decisiones ofrecen Informe para imprimir y Exportar; una decisión vigente anuncia que el informe está listo. La plantilla y el CSV descargados usan UTF-8 con BOM y encabezados en español, sin cambiar la salida técnica predeterminada para integraciones.

- **Seguimiento de participación.** Administración y análisis del proyecto consultan conteos por persona, filtran su avance y copian un recordatorio sin respuestas ni claves. Atención enlaza al seguimiento y explica qué hacer cuando aún no hay envíos; los permisos y la vigencia de las respuestas siguen siendo autoridad del servidor.

- **Fecha límite informativa.** Administración puede fijar o quitar una fecha al crear o editar el plazo del proyecto. Se guarda al final del día en la zona horaria de la instalación y se muestra en Atención, Mi trabajo y Participación, sin bloquear envíos. Una sola migración agrega una columna vacía a los proyectos existentes.

- **Primeros pasos y ayuda por perfil:** el proyecto nuevo indica los pasos pendientes con datos reales; el menú de cuenta ofrece las guías de cada rol, verificadas contra las etiquetas de la interfaz.

- **Cuestionarios reutilizables:** descarga la estructura sin respuestas ni personas como CSV sencillo o plantilla JSON completa, o úsala desde otro proyecto autorizado con la vista previa y confirmación habituales.

- **Comprobación de los pendientes menores.** Se conserva el respaldo de nombres ausentes en exportes históricos y se fija una prueba de la columna «Área» en Miembros; ambos comportamientos ya estaban presentes en la base.

- **Medición de guardados con ritmo espaciado.** El laboratorio puede medir dos rondas de 50 personas, con un inicio cada 0,6 segundos; informa éxitos, fallos y latencias. En ese ensayo inicial no se optimizó ni cambió la revisión.

- **Centro de ayuda versionado.** Glosario, solución de problemas y preguntas frecuentes por audiencia, con guías enlazadas, prueba anti-deriva y mapa `llms.txt` para consultar las fuentes sin duplicarlas.

- **Aviso de almacenamiento identificado.** Se documenta GO-2026-5932 en OpenPGP, incluido en una dependencia de VersityGW pero no importado por su binario, y una revisión propuesta para el propietario. No se cambia el proveedor ni se excluye el aviso del escáner.

- **Revisión seguida dentro de la lista.** Al abrir una pregunta desde la bandeja, Anterior y Siguiente recorren las mismas preguntas y conservan su orden aunque cambien de estado. Registrar una decisión permite guardar y pasar a la siguiente, con las mismas validaciones y permisos. La carga no se duplica al montar la pantalla y se interrumpe al abandonar la lista o vencer la sesión.

### Changed

- **Menos lecturas al guardar borradores.** Se reutiliza la carga inicial de la respuesta y se consulta la cobertura de participantes en conjunto, sin volver a cargar un grafo completo por persona. Se conserva el recálculo completo de estados, las consultas solicitadas, los permisos y los límites de conexión. En las mediciones espaciadas mejoró el guardado, pero las ráfagas de 50 simultáneos todavía tuvieron 56 fallos de 150 intentos; no se acredita capacidad institucional.

- **Atención con cifras a la vista.** El tablero muestra estados, validación por tema y área, y personas con preguntas pendientes; sus cifras reutilizan los filtros existentes. Distingue las preguntas con al menos una respuesta y conserva la tabla de métricas. Los cambios de avance se señalan entre visitas sin movimiento al usar el teclado o la preferencia de movimiento reducido.

- **Filtros y seguimiento con contexto.** La bandeja conserva sus filtros mientras carga y al volver de una pregunta; las opciones se limitan al proyecto elegido. Organizar y Participación recuerdan los filtros en la dirección de la página. Participación muestra los envíos por persona, las obligatorias pendientes y los cambios sin enviar por separado, con búsqueda y filas más compactas en móvil.

- **Barras que muestran el cambio.** Mi trabajo y la posición en el cuestionario conservan el último valor visto por cuenta y proyecto; solo animan los cambios, sin movimiento en la primera visita, con teclado o con movimiento reducido. Mantienen sus cifras, etiquetas y dimensiones.

- **Confirmación de envío suave.** El aviso de respuesta enviada aparece con un fundido breve, conserva su anuncio y permanece disponible para leerlo; no se anima con teclado ni con movimiento reducido.

- **Cierre con una señal breve.** Al terminar las preguntas, el círculo y la palomita confirman el cierre una sola vez, sin animar las cifras. «Listo por ahora», el teclado y el movimiento reducido permanecen quietos.

- **Respuesta breve al presionar.** Los botones confirman la pulsación con un cambio mínimo de escala, conservando el espacio, el foco y el objetivo táctil. Los controles deshabilitados y el movimiento reducido no cambian.

- **Diálogos con entrada suave.** El diálogo y su fondo aparecen en 160 ms cuando el navegador lo admite. El foco, Escape y Cerrar siguen funcionando de inmediato; el teclado y el movimiento reducido no animan la entrada y el cierre permanece instantáneo.

### Fixed

- **Acceso al proyecto sin jerga.** La administración, el alta de cuentas y los mensajes de ayuda hablan de accesos al proyecto; dar acceso sigue siendo distinto de asignar preguntas.

- **Conteos claros al crear cuentas.** La vista previa, la tabla, el botón y la entrega distinguen una cuenta de varias y cuentan por separado los accesos a proyectos.

- **Atención según el acceso y el estado del proyecto.** La administración conoce qué puede preparar y consultar; un proyecto archivado indica que solo permite consulta, también al equipo analista.

- **Un solo nombre para importar.** Los enlaces, la ruta de navegación y la guía de Administración dicen «Importar cuestionario», igual que la pantalla a la que llevan.

- **Acceso sin callejones.** Cerrar sesión o cambiar de cuenta lleva al inicio; los permisos denegados y el menú móvil ofrecen volver a Mis proyectos. El acceso y el cambio de contraseña permiten mostrarla; tras cambiarla, solo se conserva el usuario en memoria para volver a entrar.

- **Carga y navegación legibles en móvil.** Mis proyectos, Mi trabajo, Atención y Responder muestran una carga accesible sin animación; los nombres del menú lateral siguen visibles en anchos intermedios. Las acciones de respuesta permanecen al pie en pantallas pequeñas, respetando el área segura.

- **Atención sin filas repetidas.** Cada pregunta ocupa un solo grupo, conserva la misma acción al filtrar y anuncia los envíos nuevos desde la última visita de esa cuenta y proyecto.

- **Más espacio para responder en móvil.** Solo Guardar y salir y Enviar respuesta permanecen al pie; la consulta y la ayuda se desplazan con el contenido.

- **Reintentos de autoguardado con pausa creciente.** Tras fallar, los intentos se espacian a 60, 120 y hasta 300 segundos; un guardado correcto o una acción manual recupera el intervalo de 30 segundos, sin perder el texto pendiente.

- **Guardar o enviar con un solo clic tras un fallo automático.** La acción manual espera el intento pendiente y realiza su propio guardado si falló, conservando la versión y el contenido actuales. Las pruebas ampliadas verifican que se reintente con la edición más reciente y que un segundo fallo conserve el texto con un aviso claro; esta ampliación no cambia el comportamiento.

- **Recordatorios individuales.** Cada persona con pendientes tiene un botón para copiar solo su recordatorio; si no se puede usar el portapapeles, el texto queda seleccionado para copiarlo.

- **Participación ordenada por avance.** El orden por estado sigue Sin iniciar, En borrador, Envió parte y Completo; los empates se ordenan por nombre.

- **Carga inicial coherente.** El arranque, la comprobación de sesión y las pantallas diferidas usan el mismo esqueleto accesible y sin animación que las pantallas de trabajo.

- **Foco en preguntas con errores.** Si el servidor rechaza un campo, el editor espera a que vuelva a estar habilitado antes de enfocarlo y abre los grupos con errores, también con respuestas rápidas.

- **Prueba de pausa del autoguardado.** La comprobación en navegador mide los 60 segundos desde el primer intento con el reloj detenido y una respuesta de error demorada, conservando las aserciones de tiempo y texto sin cambiar el producto.

- **Actualizaciones con licencias coherentes.** Se actualizan juntos los tres paquetes de NestJS a 12.5.1, React Query a 5.107.1, el complemento React de Vite a 6.3.0, Prettier a 3.10.1 y user-event a 14.6.12. El inventario se regenera desde el lockfile para conservar la comprobación de licencias.

- **Perfiles de revisión sin ambigüedad.** Las guías y la ayuda distinguen la administración de accesos de la revisión: solo Analista puede pedir aclaraciones y registrar decisiones, con un perfil por persona y proyecto.

- **Revisión de solo lectura explicada.** Los proyectos activos indican por qué Administración y Consulta no tienen botones de revisión; la ayuda conserva el mismo mensaje.

- **Respuesta visible en móviles bajos.** El pie deja de permanecer fijo cuando la pantalla móvil tiene poca altura, sin reducir los botones ni cambiar las vistas altas y de escritorio.

- **Aclaraciones con el mismo recorrido en las guías.** Mi trabajo, la ayuda y las preguntas frecuentes nombran el aviso y los enlaces reales para responder una aclaración, también desde la respuesta enviada.

- **Exportaciones legibles en la Bitácora.** El tipo de archivo y su alcance se muestran en palabras claras; sus valores originales siguen disponibles al abrir el identificador de exportación.

- **Ayuda comprobada para el piloto.** Se actualiza su referencia de verificación. La prueba detecta atribuciones incorrectas de revisión a Administración, distingue las frases negativas y acepta decisiones sobre fechas, participantes y publicación, y aclaraciones a Sistemas. No cambia permisos del producto.

- **Campo visible al responder en móvil.** El formulario reserva espacio cuando se reduce el área visible y desplaza el campo enfocado por encima de las acciones; el pie deja de permanecer fijo con poca altura, también ante el teclado.

- **Aclaración con enlace visible.** Mi trabajo muestra «Responder aclaración», igual que las guías y la ayuda; conserva su nombre accesible y el destino de la consulta.

- **Conflicto explicado en la consulta.** La nota de solo lectura conserva la explicación del conflicto abierto, sin conceder acciones de revisión a otros perfiles.

- **Prueba exacta del primer autoguardado.** La comprobación en navegador detiene el reloj antes de escribir y verifica que no se guarde a los 7.999 ms y sí a los 8.000 ms. Se conserva la revisión de accesibilidad; no cambia el funcionamiento del guardado.

- **Zoom sin espacio de teclado.** Al ampliar la respuesta con un gesto de pellizco, el pie conserva su posición y no agrega el espacio reservado para el teclado; el teclado sigue dejando visible el campo.

- **Formulario del participante más claro y fiable.** Límites y contadores junto a la respuesta, estados de guardado diferenciados y opción de guardar desde el diálogo de salida. «Por consultar» se puede deshacer durante ocho segundos. El avance excluye «No aplica», distingue envíos de posición y explica los borradores sin contarlos dos veces; los campos móviles usan al menos 16 px. Hola muestra el plazo de cada proyecto cuando está disponible, sin bloquear la pantalla. Ayuda y guía actualizadas, sin cambiar los tiempos ni la frecuencia del autoguardado.

- **Fechas y horas de la organización.** La Bitácora y la hora de guardado usan la zona configurada; las fechas de respuesta se leen como día/mes/año y los plazos explican su zona con un nombre legible. El asistente propone la zona del navegador solo cuando aún no existe una elección explícita. Se conservan los instantes guardados, los exportes y la frecuencia del autoguardado.

### Security

- **Auditoría completa sin excepciones.** Se retira la excepción temporal de picomatch porque GitHub retiró GHSA-fc5q-39xc-vjpf el 2026-11-18T15:38:56Z; CI vuelve a exigir `npm audit --audit-level=high` sin excepciones. La comprobación del 2026-11-18 devuelve cero vulnerabilidades.

- **Node de seguridad y respaldo coherente.** Las imágenes de construcción, ejecución y secretos usan Node 26.13.1. Compose descarga también la imagen auxiliar que necesita el respaldo; una prueba evita que sus versiones vuelvan a separarse.

- **Herramientas Prisma sin el aviso de Effect.** Se fija únicamente la dependencia Effect de `@prisma/config` en 3.22.1 para corregir GHSA-7589-6fvf-x4pw, sin actualizar Prisma ni omitir controles. La fijación podrá retirarse cuando Prisma incorpore una versión corregida.

## 0.11.0 — 2026-11-17

Correcciones de Administración y cookie de sesión neutral de los PR
[#134](https://github.com/ruzer/Acta/pull/134) y
[#135](https://github.com/ruzer/Acta/pull/135), acompañadas de un ensayo de
actualización/restauración y mediciones de recursos. La sesión anterior sigue
siendo válida durante esta versión; sin migraciones ni endpoints nuevos.
Alcance para evaluar un piloto institucional en las [notas de 0.11.0](docs/releases/v0.11.0.md).

### Changed

- **Dependencias e inventario de licencias al día.** Se retira `@hookform/resolvers`, que no se utiliza; se conserva `react-hook-form`. Los inventarios npm se regeneran desde el lockfile con un comando reproducible, sin añadir dependencias ni confundir metadatos declarados con autorización de redistribución.

- **Cookie de sesión con nombre propio de Acta.** Los accesos nuevos usan `acta_session` y retiran la cookie anterior. Las sesiones abiertas con `fgeo_session` siguen funcionando durante esta versión; su lectura se retirará en una versión posterior. Cerrar sesión o cambiar la contraseña elimina ambas cookies, conservando las protecciones de autenticación y las invitaciones externas.

### Fixed

- **Navegación accesible en Administración.** Los botones de Usuarios, Áreas y Proyectos forman un grupo con nombre accesible y conservan su selección y apariencia.

- **Altas duplicadas con mensajes claros.** Al crear usuarios, áreas o proyectos, se indica qué nombre de usuario, código o identificador ya existe en la institución. Se conservan los permisos, la protección ante altas simultáneas y el código de error.

- **Documentación acorde con el producto.** Política de seguridad vigente, capacidades CSV e informes, usuarios en lote integrados y alcance de instalación/restauración en CI Linux x86_64; los resultados históricos conservan su fecha y sus límites.

### Added

- **Actualización con datos comprobada.** Ensayo reproducible de v0.10.0 a la candidata y restauración en volúmenes nuevos, con huellas por fila, evidencia, informe e invitaciones y continuidad de la sesión anterior.

- **Recursos medidos con carga ficticia.** Referencia reproducible de cinco usuarios concurrentes, CSV de 300 preguntas y evidencia de varios MiB, con consumo de CPU/RAM y tamaños; no representa mínimos ni capacidad garantizados.

### Security

- **Aceptación temporal y explícita de picomatch.** Solo GHSA-fc5q-39xc-vjpf, sin parche publicado y limitado a herramientas de desarrollo, se acepta hasta 2027-01-15 inclusive UTC. Producción mantiene auditoría sin excepciones; el control completo sigue bloqueando cualquier otro aviso alto o crítico y las excepciones vencidas.

## 0.10.0 — 2026-11-16

Cuestionarios desde una hoja de cálculo, informes para imprimir y creación segura
de usuarios en lote. Reúne la consolidación de dependencias
[#125](https://github.com/ruzer/Acta/pull/125), CSV
[#126](https://github.com/ruzer/Acta/pull/126) y
[#129](https://github.com/ruzer/Acta/pull/129), el informe
[#127](https://github.com/ruzer/Acta/pull/127), el diseño y alta de usuarios
[#128](https://github.com/ruzer/Acta/pull/128) y
[#130](https://github.com/ruzer/Acta/pull/130), y el pulido de uso
[#131](https://github.com/ruzer/Acta/pull/131). Sin migraciones nuevas ni cambios
en los contratos existentes. Los dos endpoints nuevos de usuarios en lote
requieren backend 0.10.0. Instrucciones y límites en las
[notas de 0.10.0](docs/releases/v0.10.0.md).

### Fixed

- **Actualizaciones de dependencias consolidadas.** NestJS common/core/platform-express
  pasan juntos a 12.4.2, Argon2 a 0.45.2, dotenv a 18.0.10,
  `@hookform/resolvers` a 7.0.5 y Vite a 8.3.7. El lockfile conserva una sola
  copia de Vite y Rolldown para evitar el error de tipos del plugin de React
  al instalar la actualización aislada de Vite. No cambian contratos,
  migraciones ni la versión de Acta.

- **Acciones del informe accesibles al tacto.** Los enlaces para abrir el informe
  y volver a decisiones reutilizan el botón secundario de 44 px de altura mínima,
  también en tablet y móvil. El lector regresa a Preguntas publicadas, sin ofrecer
  acceso a la gestión de decisiones.

- **CSV preparado para hojas de cálculo.** Recorta los bordes de los campos,
  agrupa temas y áreas sin distinguir acentos, mayúsculas ni espacios sobrantes
  y rechaza catálogos ambiguos. Admite Título opcional o un resumen del enunciado;
  ignora solo filas vacías y conserva la línea real en los errores.

- **Importación y alta de usuarios más claras.** Importar empieza con una plantilla
  CSV, tres pasos y la explicación de sus columnas; JSON queda en la ayuda avanzada.
  El alta en lote muestra un ejemplo alineado, errores ordenados y una vista previa
  compacta con tarjetas en móvil, conserva el foco de los errores y usa «Participante»
  de forma consistente. Las dos acciones de crear usuarios comparten la cabecera.

### Added

- **Importación sencilla desde CSV.** Plantilla de siete columnas en español, cinco
  tipos de pregunta y errores con fila/columna. Reutiliza la revisión y confirmación
  de JSON, los permisos de áreas y los límites; conserva códigos y textos literales.

- **Informe de decisiones para imprimir o guardar como PDF.** Presenta preguntas,
  respuesta final, responsables, fechas y fuentes legibles con la marca de la
  instalación. Reutiliza el exporte autorizado de decisiones vigentes y oculta
  la navegación al imprimir; no amplía permisos ni incluye borradores.

- **Creación segura de usuarios en lote.** Administración institucional puede pegar
  hasta 50 filas, revisar errores y crear cuentas y membresías de forma atómica.
  Las contraseñas temporales tecleables se entregan una sola vez, con impresión
  explícita de una hoja por persona y cambio obligatorio en el primer acceso.
  Los reintentos conservan solo un recibo sin secretos; no hay nuevas migraciones.

## 0.9.0 — 2026-11-11

Administración institucional, revisión y exportes más claros, y operación con
backup/restauración verificados. Incluye los PR de administración
[#45](https://github.com/ruzer/Acta/pull/45) y
[#47](https://github.com/ruzer/Acta/pull/47)–[#50](https://github.com/ruzer/Acta/pull/50),
seguridad y mantenimiento [#101](https://github.com/ruzer/Acta/pull/101),
[#103](https://github.com/ruzer/Acta/pull/103),
[#107](https://github.com/ruzer/Acta/pull/107) y
[#108](https://github.com/ruzer/Acta/pull/108), y almacenamiento
[#114](https://github.com/ruzer/Acta/pull/114) y
[#119](https://github.com/ruzer/Acta/pull/119). **Una migración aditiva de permisos
y una incompatibilidad acotada en Sistema**: actualizar frontend/backend juntos
y recargar las pestañas. Alcance completo, otros PR e instrucciones en las
[notas de 0.9.0](docs/releases/v0.9.0.md).

### Fixed

- **Docker Compose** ahora pasa `APP_LOGO_SECONDARY` y `APP_SECONDARY_NAME` al
  backend. En v0.8.0 estaban documentadas pero `docker-compose.yml` no las
  entregaba, así que definirlas en `.env` no tenía efecto en una instalación con
  Docker. Siguen vacías por defecto y la precedencia no cambia: una variable
  definida manda y se muestra como «administrado externamente». Una prueba
  comprueba que Compose pase todas las variables de apariencia.
- **«+ Agregar tema» vuelve a verse en Organizar con preguntas.** En pantallas
  de 900 px o más quedaba exactamente debajo de «Nueva pregunta» y no se veía;
  ahora cada botón tiene su columna, alineada con los filtros. Una prueba
  comprueba que ninguno tape al otro a 1440, 1024, 900 y 390 px.
- **Ajustes visuales de captura y administración.** Sin temas, Escribir ofrece
  «+ Agregar tema» como acción principal dentro del aviso, igual que Organizar;
  en el encabezado de cada tema la cuenta y el menú quedan en el borde derecho;
  «1 pregunta» ya no se escribe «1 preguntas»; los campos apilados del formulario
  de pregunta en móvil tienen separación; y el diálogo de desactivar un área no
  repite la lista de lo que se conserva ni deja detrás el aviso de la acción
  anterior.
- **Finalización simultánea del asistente de instalación.** Si otra solicitud
  termina la instalación entre la comprobación inicial y la lectura bloqueada
  del código, se devuelve el 409 de «instalación completada», que permite salir
  del asistente, en lugar de un 403 y un intento fallido registrado por error.
  Los códigos inválidos o vencidos siguen devolviendo 403 mientras la instalación
  está pendiente.
- **Decisiones conserva los cambios consecutivos de filtros.** Cambiar rápido
  la búsqueda, el área y el tema ya no pierde el área de la URL antes de abrir
  una decisión; al regresar se recupera el contexto completo. No cambian las
  rutas ni las dependencias.
- **Captura en Organizar en móvil.** «+ Agregar tema» y «Nueva pregunta»
  comparten una fila sin taparse; Preparar/Analizar conserva su propia fila.
- **El nombre del participante ya no se recorta.** En la cabecera del
  participante, el nombre se muestra completo junto al icono y al logotipo,
  también en móvil, con nombres largos y en modo oscuro.
- **Los títulos ya no muestran un recuadro de foco.** Al navegar, el foco sigue
  yendo al título, pero sin el recuadro; los botones, enlaces y campos conservan
  su indicador de foco por teclado.
- **Mi trabajo explica las preguntas condicionales.** Junto al avance indica
  cuántas preguntas dependen aún de tus respuestas o quedan fuera del recorrido,
  y Responder muestra solo «Pregunta N de M». El cálculo del avance no cambia.
- **Trazabilidad se lee en español.** Los tipos de referencia usan las mismas
  etiquetas del editor y las tres cifras se presentan como un resumen.
- **Importar avisa antes de subir el archivo.** Si el proyecto ya contiene
  estructura, lo dice, enlaza a Cuestionario y deshabilita la subida; los
  ejemplos siguen disponibles. El servidor mantiene su validación.

- **Los fallos de acceso de una dirección no bloquean otras detrás de nginx.**
  Compose entrega la IP de cliente validada a los límites de acceso.
  Sistema muestra el estado del proxy.
- **Las capturas E2E no modifican la documentación versionada.** Dirección C y
  el asistente usan `test-results/design-evidence` por defecto; todos respetan
  `ACTA_DIRECTION_C_EVIDENCE_DIR` y se conservan las imágenes históricas.

- **Descargar evidencia libera la conexión durante la lectura del almacenamiento.**
  La autorización y la auditoría usan transacciones cortas; solo se registra la
  descarga después de leer y verificar los bytes, sin cambiar permisos ni errores.

- **Reconciliación de evidencia por lotes.** Consulta hasta 1.000 claves por vez
  y conserva la misma regla de eliminación de objetos huérfanos o rechazados sin
  vínculos, evitando una consulta adicional por cada archivo.

- **Caché del frontend sin perder cabeceras de seguridad.** El shell HTML se
  revalida y los assets con nombre versionado se conservan un año como inmutables;
  las rutas SPA mantienen las cuatro cabeceras y el proxy de la API no cambia.

- **«Continuar» espera un destino actualizado.** Al guardar un borrador, Mi
  trabajo y el inicio del participante muestran «Actualizando tu avance…»
  mientras se refresca la consulta, sin ofrecer el enlace anterior ni retrasar
  la navegación. El guardado, las prioridades y la API no cambian.

- **El foco de ruta respeta la navegación por teclado.** Si el título tarda
  en aparecer, deja de esperarlo cuando detecta el foco en un control de la
  página o después de cinco segundos. Conserva el enfoque inicial al resolver
  las rutas diferidas y limpia la espera al salir.

- **Exporte Markdown legible para revisión.** Agrupa por tema y pregunta, usa
  nombres de autores y áreas, respuestas y estados de la interfaz y fuentes por
  envío. Omite excepciones vacías y conserva el ID de validación al final, sin
  cambiar JSON, CSV ni la protección frente a contenido hostil.

- **Textos y títulos de pantalla más claros.** El lema se muestra en español,
  cada pestaña identifica la pantalla y la instalación, y las fechas no duplican
  el punto final. Los ajustes de invitaciones quedan plegados debajo de la lista
  e indican con claridad qué datos personales exige la instalación.

- **Registrar decisión muestra errores accesibles en español.** Los campos
  obligatorios están indicados, cada error se asocia a su campo y el resumen
  recibe el foco. Ninguna fuente se preselecciona; con dos o más se puede
  seleccionar todo explícitamente. Se conservan los requisitos del servidor.

- **Atención abre la lista completa y prioriza los casos accionables.** Primero
  muestra conflictos, aclaraciones, respuestas listas para decidir y parciales
  con aportaciones; conserva el orden del cuestionario dentro de cada grupo y
  la carga por tramos. No infiere qué aportaciones ya fueron revisadas.

- **El exporte Markdown neutraliza cualquier esquema con `://`.** Las direcciones
  FTP y otros protocolos no se convierten en enlaces activos al renderizar;
  se conserva el resto del escapado y el formato de JSON y CSV.

- **Los encabezados Markdown conservan la pregunta completa.** Solo en el título
  se unifican espacios y saltos de línea y se protegen los signos `#` finales;
  el cuerpo del documento y las exportaciones JSON/CSV no cambian.

- **Los errores de Registrar decisión se limpian al corregir cada campo.**
  Desaparecen el aviso y su asociación accesible, sin borrar los demás errores;
  al corregir el último se retira el resumen. La validación y el foco al fallar
  siguen ocurriendo al enviar, también al seleccionar fuentes en conjunto.

- **Restauración con comprobaciones claras:** compara versión, commit y migraciones antes de operar; informa imágenes ausentes, configuración distinta y permisos de la copia sin falsos avisos por reconstruir imágenes.

- **Guía de recuperación actualizada:** distingue construcción y descarga de imágenes, explica los avisos y límites de verificación, y registra el ensayo remoto del PR #107 y el simulacro local.

- **Exporte Markdown tolerante a snapshots incompletos:** comparte con Revisión la lectura de nombres y usa respaldos para autor y área. Conserva las fuentes y los formatos JSON/CSV; es robustez ante datos históricos o editados fuera de la aplicación.

- **VersityGW 1.11.0 como almacenamiento incluido.** Se fija la release oficial
  en el gateway y su aprovisionador, compilada con Go 1.27.4; conserva POSIX, IAM y la
  configuración existentes. Incluye correcciones de multipart, carreras de
  archivos y listados; se actualizan las atribuciones de dependencias y se
  comprueban cargas multipart, borrado múltiple y errores de credenciales.
  El ensayo de actualización y restauración desde 1.10.0 se documenta en
  [Proveedores S3](docs/S3-PROVIDERS.md).

- **Compatibilidad con main actualizado:** se revalidó la actualización de
  VersityGW 1.11.0 tras incorporar NestJS 12.4.0 desde main, sin conflictos ni
  cambios adicionales en la aplicación.

- **Ajustes visuales de Escribir, Organizar y Administración.** En Escribir, el
  aviso hacia «Organizar preguntas» es un enlace dentro de la frase (antes era
  un botón con borde que rompía el renglón) y en cada tema la cuenta de
  preguntas va antes del menú también en móvil. En Organizar, el filtro de
  temas usa el mismo borde que la búsqueda y los otros filtros. En
  Administración → Áreas, «Renombrar» se alinea con las etiquetas de la tarjeta
  en móvil, y en Mis proyectos la nota para administración deja espacio antes
  de la primera tarjeta. Una prueba E2E comprueba cada caso; no cambian reglas
  de negocio ni permisos.

- **CodeQL ignora los mockups de diseño.** Su primera corrida reportó una alerta
  `js/xss-through-dom` en `docs/design/mockups/original/…prototype.html`, un
  prototipo estático conservado como evidencia que no se compila, empaqueta ni
  sirve. Una configuración excluye `docs/design/**` del análisis; el código del
  producto sigue analizándose sin cambios y los checks requeridos no cambian.

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

- **Backup coordinado sin sobrescrituras.** `scripts/backup.sh` conserva el dump,
  seis volúmenes y configuración privada, registra hashes y recuentos de control
  y reanuda los servicios que estaban activos; una copia fallida queda INCOMPLETE.

- **Verificación y restauración en destino nuevo.** Los scripts comprueban el
  inventario, SHA-256, tar, firma del dump y recuentos; rechazan copias incompletas,
  destinos con datos y cambios mayores de PostgreSQL, sin borrar ni sobrescribir.

- **CI ejercita backup y restauración completa.** El job `selfhosting` copia el
  fixture a un proyecto nuevo, compara recuentos y verifica respuesta, decisión,
  invitación y evidencia; registra duración y limpia solo sus dos proyectos.

- **Guía operativa de copias y simulacros.** Documenta scripts, programación,
  ventana sin escritores, secretos, retención y assets externos; conserva la
  receta manual y distingue los ensayos locales de los ejecutados en CI.

- **Escaneo de código y acciones agrupadas:** CodeQL analiza JavaScript/TypeScript en PR, main y semanalmente; Dependabot agrupa las acciones en una propuesta semanal. No se alteran los checks requeridos.

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
- **Dependabot y CI.** Dependabot agrupa las familias que deben subir juntas
  (React y React DOM, NestJS, Prisma, Zod) en un solo PR, y sigue también
  `docker/versity/Dockerfile` (VersityGW) y la imagen de PostgreSQL de
  `docker-compose.yml` (sin saltos de versión mayor). El CI se ejecuta además
  cada lunes, para que un aviso nuevo de dependencias o de `govulncheck` aparezca
  de forma programada y no en medio de otro cambio.
- **CI sin corridas duplicadas por rama.** Los pushes ejecutan CI solo en main;
  los PR conservan todos sus checks y cancelan únicamente sus corridas obsoletas.
  Cada corrida de main tiene un grupo propio, para conservar tanto las pendientes
  como las que ya se ejecutan; continúan la ejecución manual y la semanal.

- **Retención horaria de autenticación.** Elimina por lotes intentos de más de
  7 días, sesiones vencidas o revocadas hace más de 30 días y buckets caducados;
  conserva la auditoría y evita limpiar buckets en cada acceso por invitación.
  Una migración concede al rol de aplicación el borrado de las dos tablas de
  sesiones, sin ampliar los permisos de la bitácora ni del contenido.

- **Las pantallas de gestión se cargan cuando se abren.** Administración, editor,
  revisión, ajustes, intercambio y visibilidad usan carga diferida con un estado
  accesible y foco en el título al terminar. Acceso, instalación y participante
  permanecen en la carga inicial.

- **Dependencias consolidadas y verificadas.** React Router pasa a 7.18.5,
  el plugin de React para Vite a 6.2.1, jsdom a 31.0.0 y los tipos de Node a
  26.6.6. Las propuestas de Dependabot se validan juntas, sin modificar código
  de la aplicación, contratos ni pruebas existentes.

- **nginx 1.30.5 → 1.30.6** en la imagen del frontend, dentro de la línea estable.

- **Actualización conjunta de frontend y backend.** `GET /api/v1/system` añade
  `security.clientIpFromProxy` a un contrato estricto: la pantalla Sistema de un
  cliente v0.8.0 rechaza la respuesta nueva y un cliente 0.9.0 rechaza la anterior.
  Actualiza ambos servicios juntos y recarga las pestañas abiertas (recarga
  forzada o cerrar y abrir). Hasta entonces Sistema puede no cargar; los forks
  que consuman esa ruta deben incorporar el campo. Es una incompatibilidad
  acotada anunciada en este MINOR pre-1.0; no se suaviza el contrato.

### Security

- **Go 1.27.4** (antes 1.27.3) en la compilación de VersityGW y de la imagen
  opcional de MinIO legado, y en el control `govulncheck` del CI; VersityGW y
  el control fijan la imagen por digest. Corrige GO-2026-6859 en `net/http`
  (caída del servidor HTTP/1 por una condición de carrera con `MaxBytesReader`), publicado después de la última
  ejecución verde y que hacía fallar el control del binario de almacenamiento.
  No cambia la versión de VersityGW ni el almacenamiento por defecto.
- **Vite 8.3.5**, tras la corrección de seguridad de 8.3.1 a 8.3.4, incorpora
  las correcciones de GHSA-587h-7wmj-h5pm y avisos relacionados de `launch-editor`.
  El aviso alto afectaba a Vite hasta 8.3.2 en esa línea y permitía eludir una
  comprobación de rutas en Windows. Afecta al servidor de desarrollo, no al
  frontend estático servido por nginx.
- **Node 26 LTS** en todas las imágenes (backend, frontend, almacenamiento y
  scripts; antes 24.21.0) y en el CI. Node 26 es LTS desde el 28 de octubre de
  2026; `engines` ya admitía `>=24.15 <27`, así que Node 24 sigue permitido.
- **Dependencias de ejecución actualizadas:** Zod 4.6.7 en backend, frontend y
  contratos corrige el agotamiento de memoria al validar colecciones grandes;
  NestJS (`common`, `core` y `platform-express`) 12.3.2 incorpora Multer 2.5.0,
  que corrige una denegación de servicio con `fileFilter` asíncrono pendiente.
  Acta no configura `fileFilter`, por lo que la exposición a ese caso era baja,
  pero el aviso bloqueaba el control de seguridad de dependencias.
- **VersityGW 1.11.0** (antes 1.8.0 en Acta v0.8.0), compilado con
  Go 1.27.4. Conserva desde 1.10.0 `klauspost/compress` 1.20.3, que corrige
  GO-2026-6865 (pánico con tramas de dos bloques); el control `govulncheck` del binario
  fallaba por ese aviso. Respecto de la 1.8.0 incluida en Acta v0.8.0, conserva
  las correcciones de 1.9.0 para GHSA-7qcr-88c3-f9p7 (path traversal mediante
  `uploadId` y borrado múltiple) y GHSA-5gjv-3vhq-4chv (cuerpos chunked sin
  consumir y reutilización de conexiones). Go 1.27.3 corrige además
  GO-2026-6809 en `crypto/x509`. LICENSE y NOTICE se verificaron idénticos a la
  release; alcance y límites en [Proveedores S3](docs/S3-PROVIDERS.md).
- **Dirección de cliente mediante proxies configurados.** nginx sobrescribe
  `X-Forwarded-For` y solo acepta direcciones de proxies en `TRUSTED_PROXY_CIDRS`.
  `TRUSTED_PROXY_HOPS` vale cero en código y uno en el Compose con backend privado;
  las direcciones se validan y normalizan antes del hash. Login, invitaciones y
  códigos del asistente conservan sus límites. Un NAT puede seguir compartiendo
  dirección; [configuración y comprobación](docs/PROXY-TRUST.md).
- La imagen opcional de **MinIO legado** se compila con Go 1.27.4. Con Go 1.26.9
  y 1.27.2 el binario incluía GO-2026-6809 (`crypto/x509`), corregido en 1.26.10
  y 1.27.3. No cambia el almacenamiento por defecto (VersityGW). El binario de
  MinIO conserva avisos de sus propias dependencias, que dependen de esa release
  fija y no del compilador; por eso sigue siendo «legacy, no recomendado».
- **minimatch 11.0.5** en las herramientas de desarrollo (`overrides`). ESLint y
  typescript-eslint piden minimatch 10, que tiene GHSA-g3hv-75wg-m249
  (denegación de servicio por amplificación con patrones de glob); no existía
  una versión corregida dentro de su rango y el aviso mantenía abierta la alerta
  de Dependabot. Solo afecta a lint y pruebas, no a lo que se despliega; lint,
  tipos y pruebas unitarias pasan con la versión 11.
- **El límite de acceso distingue cuenta y dirección.** En quince minutos se
  permiten hasta 10 fallos por cuenta+IP, 30 por IP y 100 por cuenta; cada fallo
  cuenta en los tres. Se conservan los candados concurrentes, la respuesta para
  cuentas inexistentes y el flujo de acceso correcto. Diez fallos desde otra IP
  ya no bloquean por sí solos al administrador legítimo.

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
la documentación son las de la compilación de VersityGW descritas en _Security_.

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

[0.12.0]: https://github.com/ruzer/Acta/compare/v0.11.0...v0.12.0
