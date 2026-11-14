# Crear usuarios en lote — diseño aprobado

**Estado: implementado según el diseño aprobado; pendiente de integración.** Se autorizaron los contratos aditivos
`POST /users/bulk/preview` y `POST /users/bulk/confirm`, sin modificar los
endpoints existentes, dependencias ni migraciones.

## Experiencia

Administración → Usuarios → **Crear varios usuarios**. Pegar una tabla desde una
hoja de cálculo, revisar cada fila y confirmar el lote completo. Encabezados en
español: **Usuario, Nombre, Proyecto, Rol, Área**; nunca contraseñas.

| Usuario | Nombre | Proyecto | Rol | Área |
| --- | --- | --- | --- | --- |
| persona.demo | Persona de ejemplo | PROYECTO-DEMO | Participante | AREA-DEMO |
| analista.demo | Analista de ejemplo | PROYECTO-DEMO | Analista | |

Proyecto y Área usan los códigos existentes, mostrados junto a sus nombres en la
vista previa. Área es obligatoria para Participante, como exige hoy `memberInput`.
Un área responsable no asigna una persona ni otorga acceso a respuestas.

Solo cuentas nuevas. Un usuario existente produce error: las membresías de cuentas
existentes conservan su pantalla actual. Puede repetirse un usuario nuevo en varios
proyectos si el nombre coincide; se crea una cuenta y una membresía por proyecto.
Un par usuario/proyecto repetido, o nombres contradictorios, rechaza el lote.

Roles mostrados: Administración del proyecto (`ADMIN`), Analista (`ANALYST`),
Participante (`STAKEHOLDER`) y Consulta (`VIEWER`). El lote nunca concede
`isOrganizationAdmin`. El modelo actual no requiere correo electrónico.

## Validación y confirmación

- Primera versión: tabla pegada con tabuladores, una fila por membresía; máximo
  de 50 filas y 64 KiB UTF-8. Rechazar columnas desconocidas, filas
  incompletas y límites excedidos; no descartar ni corregir datos silenciosamente.
- Reutilizar las restricciones actuales: usuario de 3–64 caracteres permitidos,
  comparación en minúsculas y nombre de 1–200 caracteres. Mostrar la normalización
  del usuario antes de confirmar. No convertir códigos de proyecto/área en números.
- El servidor valida institución, usuario, proyecto activo, área activa y rol.
  La vista previa no escribe y no genera contraseñas. Devuelve errores por fila y
  columna, sin revelar cuentas de otras instituciones.
- La confirmación revalida todo: no confía en la vista previa ni en identificadores
  enviados por el navegador. Si cambió un proyecto/área, no crea parte del lote.
- Resumen de errores enfocable, asociación de error a cada celda y navegación por
  teclado. El éxito anuncia cuentas y membresías creadas, como conceptos distintos.

## Permisos, atomicidad y concurrencia

Solo administración **de la institución**, comprobada en el servidor en ambas
fases. Se reutiliza `AccessService.organizationAdmin` y se conservan las
reglas de membresía de `AdministrationService`; nunca se amplía acceso a contenido del proyecto.

Generar y hashear contraseñas después de autorizar/validar, con concurrencia acotada
(dos hashes simultáneos). Luego una sola transacción crea cuentas,
membresías y eventos sin secretos. Tomar bloqueos de proyectos en orden estable,
revalidar y respetar restricciones únicas. Una colisión o fallo revierte **todo**.
No encadenar llamadas individuales a `createUser`/`setMember`: sus transacciones
independientes no garantizan un lote atómico. Se reutilizan sus reglas, no un bucle
de endpoints. No asigna preguntas, publica contenido ni cambia cuentas existentes.

La confirmación utiliza un identificador de solicitud y una huella del contenido.
El registro durable de resultado contiene solo IDs, usuarios, nombres y recuentos,
nunca contraseñas; una repetición devuelve ese recibo sin crear cuentas ni recuperar
secretos. Misma solicitud con otra huella: rechazo. Se verificó antes de implementar
que `AuditEvent.requestId`, `payloadHash`, `result`, `eventIndex` y su restricción
única permiten esta deduplicación. Como la bitácora es inmutable, huella y recibo
se insertan juntos dentro de la transacción, sin actualizar eventos anteriores.

## Entrega única de contraseñas

El servidor genera una contraseña distinta por cuenta con un generador
criptográfico: 16 caracteres de un alfabeto sin `0`, `O`, `1`, `l` ni `I`,
agrupados de cuatro en cuatro con guiones. La selección uniforme con `randomInt`
aporta más de 90 bits de entropía; los guiones solo facilitan la lectura. La
hashea con el mecanismo actual y guarda `mustChangePassword=true`.

El texto original solo viaja en la respuesta HTTPS de la primera confirmación
exitosa, con `Cache-Control: no-store`, y se muestra una vez en una pantalla de
entrega accesible. No se guarda en bitácora, logs, métricas, trazas, errores, URL,
historial de navegación, caché de consultas ni almacenamiento del navegador.
Solo estado efímero de la pantalla; borrarlo al salir, cerrar o cerrar sesión.
El botón explícito **Imprimir hoja de entrega** prepara una hoja por persona, con
usuario, contraseña temporal, enlace de acceso e instrucciones para cambiarla.
Solo imprime al pulsarlo; el resto de la aplicación no incorpora esas hojas en
sus impresiones. El operador controla las copias físicas o PDF que decida crear.
No copiar al portapapeles ni descargar automáticamente. El operador entrega cada
clave por un canal institucional privado, fuera de Acta.

El primer acceso exige cambiarla mediante el flujo existente. Si se pierde la
respuesta o se cierra la pantalla, no puede recuperarse: utilizar el restablecimiento
individual existente, que también exige cambio y revoca sesiones. No presentar un
reintento como una segunda entrega. JavaScript no permite garantizar el borrado
físico de memoria; sí evitar persistencia y referencias innecesarias.

## Impacto y gates de implementación

| Elemento | Impacto aprobado |
| --- | --- |
| Contratos públicos | Nuevos contratos de vista previa/confirmación por lote y respuesta efímera; cambios aditivos, sin modificar los endpoints individuales. Autorizados expresamente. |
| Base de datos | `User`, `ProjectMember` y `AuditEvent` ya contienen los datos necesarios. La deduplicación y atomicidad se verifican contra PostgreSQL; no se añade migración. |
| Dependencias | Ninguna nueva; reutilizar validación, criptografía, hashing, transacciones y controles de interfaz existentes. |
| Recursos | Máximo 50 filas y 64 KiB, dos hashes simultáneos y transacción de hasta 15 s. La medición local no demuestra capacidad de producción; no se introduce una cuota institucional nueva. |
| Auditoría | Eventos de cuentas/membresías y resumen saneado del lote; jamás claves ni hashes de contraseñas, ni copia íntegra de la solicitud. |

Pruebas exigidas antes de habilitarlo: permisos y aislamiento entre instituciones;
validación fila/columna; usuarios repetidos y simultáneos; reversión completa ante
fallo; cambios entre vista previa/confirmación; reintento con misma/otra huella;
entrega única y respuesta perdida; ausencia de secretos en logs/bitácora/cachés;
cambio obligatorio; CSRF, límites, teclado y lector de pantalla.

No se implementan invitaciones, envío de correo, restablecimiento masivo, creación
de áreas ni concesión de administración institucional. La implementación debe demostrar los gates anteriores antes de integrarse.

## Referencias actuales

- [Contratos de usuarios y membresías](../packages/contracts/src/index.ts).
- [Administración y cambios de contraseña](../app/backend/src/administration/administration.service.ts).
- [Permisos](../app/backend/src/administration/access.service.ts).
- [Modelo y restricciones](../app/backend/prisma/schema.prisma).
