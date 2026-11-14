# Crear usuarios en lote — propuesta para aprobación

**Estado: borrador, no implementado.** Esta propuesta requiere aprobación antes
de cambiar contratos o código. No añade una pantalla, un endpoint ni un importador.

## Experiencia propuesta

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
  propuesto de 50 filas y 64 KiB UTF-8. Rechazar columnas desconocidas, filas
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
fases. Se reutilizan `AccessService.organizationAdmin`, `membershipAdmin` y las
reglas de `AdministrationService`; nunca se amplía acceso a contenido del proyecto.

Generar y hashear contraseñas después de autorizar/validar, con concurrencia acotada
(propuesta: dos hashes simultáneos). Luego una sola transacción crea cuentas,
membresías y eventos sin secretos. Tomar bloqueos de proyectos en orden estable,
revalidar y respetar restricciones únicas. Una colisión o fallo revierte **todo**.
No encadenar llamadas individuales a `createUser`/`setMember`: sus transacciones
independientes no garantizan un lote atómico. Se reutilizan sus reglas, no un bucle
de endpoints. No asigna preguntas, publica contenido ni cambia cuentas existentes.

La confirmación utiliza un identificador de solicitud y una huella del contenido.
El registro durable de resultado contiene solo IDs/recuentos, nunca contraseñas;
una repetición devuelve ese resumen sin crear cuentas ni recuperar secretos.
Misma solicitud con otra huella: rechazo. Antes de implementar, comprobar que
`AuditEvent.requestId`, `payloadHash`, `result`, `eventIndex` y su restricción única
permiten esta deduplicación transaccional usando los mecanismos existentes.

## Entrega única de contraseñas

El servidor genera una contraseña distinta por cuenta con un generador
criptográfico (propuesta: 24 bytes aleatorios codificados como base64url), la
hashea con el mecanismo actual y guarda `mustChangePassword=true`.

El texto original solo viaja en la respuesta HTTPS de la primera confirmación
exitosa, con `Cache-Control: no-store`, y se muestra una vez en una pantalla de
entrega accesible. No se guarda en bitácora, logs, métricas, trazas, errores, URL,
historial de navegación, caché de consultas ni almacenamiento del navegador.
Solo estado efímero de la pantalla; borrarlo al salir, cerrar o cerrar sesión.
No copiar al portapapeles ni descargar automáticamente. El operador entrega cada
clave por un canal institucional privado, fuera de Acta.

El primer acceso exige cambiarla mediante el flujo existente. Si se pierde la
respuesta o se cierra la pantalla, no puede recuperarse: utilizar el restablecimiento
individual existente, que también exige cambio y revoca sesiones. No presentar un
reintento como una segunda entrega. JavaScript no permite garantizar el borrado
físico de memoria; sí evitar persistencia y referencias innecesarias.

## Impacto y gates de implementación

| Elemento | Impacto previsto, sujeto a aprobación |
| --- | --- |
| Contratos públicos | Nuevos contratos de vista previa/confirmación por lote y respuesta efímera; cambios aditivos, sin modificar los endpoints individuales. Requieren aprobación explícita antes de implementarse. |
| Base de datos | `User`, `ProjectMember` y `AuditEvent` ya contienen los datos necesarios. No se propone migración ahora; demostrar deduplicación/atomicidad. Si exige nueva persistencia, pedir aprobación de la migración antes de escribirla. |
| Dependencias | Ninguna nueva prevista; reutilizar validación, criptografía, hashing, transacciones y controles de interfaz existentes. |
| Recursos | Medir tiempo/memoria de 50 filas, hashes y duración de transacción; validar límites y cuota por institución antes de aprobarlos como operativos. |
| Auditoría | Eventos de cuentas/membresías y resumen saneado del lote; jamás claves ni hashes de contraseñas, ni copia íntegra de la solicitud. |

Pruebas exigidas antes de habilitarlo: permisos y aislamiento entre instituciones;
validación fila/columna; usuarios repetidos y simultáneos; reversión completa ante
fallo; cambios entre vista previa/confirmación; reintento con misma/otra huella;
entrega única y respuesta perdida; ausencia de secretos en logs/bitácora/cachés;
cambio obligatorio; CSRF, límites, teclado y lector de pantalla.

No se implementan invitaciones, envío de correo, restablecimiento masivo, creación
de áreas ni concesión de administración institucional. **La siguiente acción es
revisar y aprobar este diseño; no desarrollar automáticamente.**

## Referencias actuales

- [Contratos de usuarios y membresías](../packages/contracts/src/index.ts).
- [Administración y cambios de contraseña](../app/backend/src/administration/administration.service.ts).
- [Permisos](../app/backend/src/administration/access.service.ts).
- [Modelo y restricciones](../app/backend/prisma/schema.prisma).
