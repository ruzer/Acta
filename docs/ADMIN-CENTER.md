# Instalación guiada y Configuración

Acta se puede instalar de dos maneras que **conviven**. Ninguna reemplaza a la otra y ninguna es obligatoria para que Acta arranque.

| | Instalación guiada | Instalación avanzada |
|---|---|---|
| Para | Una persona que instala Acta por primera vez | Operaciones, DevOps, CI/CD |
| Cómo | `sh scripts/install.sh` y el asistente web | `.env` + Docker Compose + `bootstrap-admin` |
| Secretos | Los genera Acta en volúmenes privados | Los defines tú o los generan los contenedores; pueden venir de un gestor externo |
| Administrador | Se crea en el asistente | `docker compose exec backend node scripts/bootstrap-admin.mjs` (acepta JSON por stdin, sin terminal) |
| Apariencia | Se elige en el asistente y en **Configuración** | Variables de entorno (`APP_NAME`, `APP_ACCENT`, …) |

El asistente es **opcional**: si la instalación ya se configuró por el procedimiento avanzado, nunca aparece; y con `SETUP_WIZARD=disabled` se apaga por completo.

## Quién decide cada valor

Cada ajuste pertenece a una de cuatro clases. Esto evita que la configuración externa y la de la aplicación se contradigan.

| Clase | Qué es | Dónde se cambia | Ejemplos |
|---|---|---|---|
| **A. Infraestructura** | Necesaria antes de arrancar los servicios | `.env`, Compose, gestor de secretos | `APP_ORIGIN`, `COOKIE_SECURE`, `NODE_ENV`, `ORGANIZATION_CODE`, contraseñas de PostgreSQL, `S3_*`, límites, sesiones, invitaciones |
| **B. Instalación** | Se decide una sola vez, en el primer uso | Asistente (o `bootstrap-admin`) | Primer administrador, nombre de la institución |
| **C. Administración** | Se modifica desde la aplicación | **Administración → Configuración** | Nombre de la aplicación, nombre corto, color, formato regional, zona horaria, logotipo principal y secundario, entidad del segundo logotipo, favicon |
| **D. Organización** | Personalización de la institución | Configuración | Nombre de la institución |

Los secretos fundamentales (contraseñas de base de datos, claves del almacenamiento) **siguen fuera de la aplicación**: nada de eso se guarda en PostgreSQL ni se puede ver o cambiar desde la interfaz.

### Regla de precedencia

Para los valores de la clase C:

1. Si la **infraestructura** define la variable (no vacía), manda. La pantalla la muestra como **«Administrado externamente (APP_NAME)»**, de solo lectura, y el servidor rechaza cualquier intento de cambiarla o restablecerla (`409`).
2. Si no, vale lo que un administrador **guardó** en Configuración.
3. Si nadie eligió nada, vale el **predeterminado** del producto (`Acta`, `Acta`, `#2b4d7c`, `es-MX`, `UTC`).

Una variable vacía o ausente cuenta como «no definida». `.env.example` trae esas variables comentadas a propósito: copiarlo no fija la apariencia. Si tu instalación ya las define en `.env`, siguen mandando y la pantalla lo dice; para gestionarlas desde Acta, quita la variable y reinicia (el valor guardado antes, si existe, vuelve a aplicar).

El **nombre de la institución** vive en la base de datos; `ORGANIZATION_NAME` solo se usa como valor inicial.

## Instalación guiada

```sh
sh scripts/install.sh                                        # evaluación local en http://localhost:4317
sh scripts/install.sh --origin https://acta.example.org      # servidor detrás de tu proxy HTTPS
```

El script comprueba Docker y Compose, escribe un `.env` mínimo **solo si no existe uno** y se le pasaron opciones (nunca sobrescribe), arranca los servicios y muestra una dirección con el **código de instalación**. Los secretos de base de datos y almacenamiento los generan los contenedores en volúmenes privados; el script no los ve. Ejecutarlo de nuevo no cambia nada de lo que ya existe.

### Pasos del asistente

Bienvenida (código) → Administrador → Organización → Almacenamiento (solo comprueba) → Personalización con vista previa → Verificación → Finalizar. Los valores que la infraestructura controla aparecen de solo lectura y no se envían.

El logotipo y el favicon se añaden después, en **Configuración → Apariencia**.

### Cómo se evita que otra persona tome una instalación nueva

- El asistente solo funciona con un **código de un solo uso** que emite quien opera el servidor (`docker compose exec backend node scripts/setup-token.mjs`). Son 256 bits aleatorios, caducan a las 2 horas y emitir otro anula el anterior.
- La base de datos guarda solo su **SHA-256**; el código se muestra una vez en esa terminal, no en el navegador ni en los registros. La dirección lo lleva en el fragmento (`#setup=…`), que el navegador no envía al servidor, y la pantalla lo retira de la barra al leerlo.
- Los códigos erróneos se cuentan por dirección de red (10 por 15 minutos, luego `429`). Las solicitudes deben venir del origen de la aplicación.
- La creación del administrador, la organización y los ajustes ocurre en **una sola transacción** bajo el mismo candado que `bootstrap-admin`: o existe todo o no cambió nada, solicitudes simultáneas crean exactamente un administrador, y el asistente y el comando no pueden correr a la vez.
- Si el navegador se cierra a medias no se guarda nada: el código sigue valiendo hasta que caduque.
- **No reaparece**: cualquier administrador existente (activo o no) o el registro de instalación completada cierran el asistente para siempre. Las instalaciones creadas antes de esta función quedan cerradas por la migración.
- La contraseña no se registra ni se guarda en la auditoría.

## Centro de configuración

**Administración → Configuración** (solo administración de la institución). Solo se ofrecen las secciones que el producto puede sostener:

| Sección | Qué hace |
|---|---|
| **General** | Formato regional y zona horaria |
| **Apariencia** | **Identidad**: nombre de la institución, de la aplicación y corto, entidad del segundo logotipo y color principal (verificación de contraste con texto blanco ≥ 4.5:1). **Imágenes**: logotipo principal, segundo logotipo (opcional) y favicon. Una **vista previa** muestra la pestaña, la navegación y la pantalla de acceso con lo que escribes y con las imágenes que eliges *antes* de guardarlas. Sin CSS ni JavaScript propio |
| **Almacenamiento** | Estado, proveedor, servidor, bucket y región, evidencia por proveedor y **prueba de conexión**. Solo lectura |
| **Sistema** | Versión, entorno, base de datos, dirección y HTTPS, cookies seguras, sesiones, invitaciones y límites. Solo lectura |

Los cambios se ven al instante, sin recompilar el frontend ni reiniciar Docker: la pantalla de acceso, el título y el favicon leen la configuración vigente.

### Logotipos: jerarquía

- **Logotipo principal** = la identidad de la institución. Va más grande: en la pantalla de acceso (sobre el nombre), en la barra lateral (como marca única en la barra estrecha) y en el encabezado móvil.
- **Segundo logotipo** (opcional) = una entidad colaboradora, un área responsable o una identidad complementaria. Va más pequeño, después de un separador: en la pantalla de acceso (con el nombre de la entidad escrito bajo el de la institución) y en el encabezado de las **invitaciones externas**, que es donde quien responde necesita ver quién pregunta. No aparece en la navegación, los encabezados ni las pantallas administrativas, para no añadir ruido.
- En pantallas estrechas las marcas se apilan, la principal primero. Las proporciones siempre se conservan (nada se estira ni se recorta).
- Sin segundo logotipo, nada cambia ni se reserva espacio. Acta sigue siendo reconocible: su nombre y «Questions. Evidence. Decisions.» permanecen en el acceso.

Cada guardado usa la **versión** que la persona vio: si otra persona cambió algo mientras tanto, se rechaza con `409` y no se pierde ningún cambio ajeno.

Las imágenes se validan por sus **bytes** (PNG o JPEG para los logotipos; PNG cuadrado o ICO para el favicon; 512 KB y 128 KB como máximo, con tamaño en píxeles acotado). **No se admite SVG.** Se guardan en la base de datos y se sirven como imagen inerte (`nosniff`, CSP sin recursos).

### Almacenamiento: por qué no se cambia desde Acta

El proveedor y las credenciales se leen al arrancar, y cambiarlos en caliente podría dejar la evidencia ya guardada inalcanzable. Se separan tres cosas: la **configuración inicial** (variables `S3_*` y `docker-compose.external-s3.yml`), la **rotación de credenciales** y la **migración** de archivos entre proveedores; ninguna es automática ni se ofrece en la pantalla. Ver [Proveedores S3](S3-PROVIDERS.md).

### Auditoría

Cada cambio queda en la bitácora con quién, qué cambió (antes/después, sin secretos) y cuándo: `INSTALLATION_BOOTSTRAPPED`, `SETTINGS_UPDATED`, `BRANDING_ASSET_CHANGED`, `BRANDING_ASSET_REMOVED` y `STORAGE_CONNECTION_TESTED`.

### API

Todas las rutas de administración exigen una sesión de administrador de la institución, origen de la aplicación y CSRF. Las únicas públicas son las que ya existían más lo necesario para el acceso:

| Ruta | Acceso |
|---|---|
| `GET /configuration/public`, `GET /configuration/assets/{logo,logoSecondary,favicon}` | Público: la pantalla de acceso necesita verse como la institución |
| `GET /setup/status` | Público: solo `PENDING`, `COMPLETED` o `DISABLED` |
| `POST /setup/{verify,checks,complete}` | Requieren el código de instalación; cerradas al completar |
| `GET/POST /settings`, `POST /settings/assets/:kind[/remove]` | Administración |
| `GET /system`, `POST /system/storage-test` | Administración |

## Compatibilidad con instalaciones existentes

- Las migraciones `202610120001_installation_setup_settings` y `202610130001_secondary_logo` solo **agregan** tablas, un valor de enumeración y una columna; no reescriben nada. Los logotipos y ajustes guardados se conservan y una instalación sin segundo logotipo no cambia. Si hay un administrador, registra la instalación como completada: el asistente nunca aparece.
- Sin ajustes guardados, la apariencia es exactamente la que dicen las variables de entorno. Quien ya definía `APP_NAME` y similares sigue igual y lo ve como «administrado externamente».
- Usuarios, contraseñas, evidencia, proyectos y sesiones no se tocan. `bootstrap-admin` sigue funcionando (y ahora también cierra el asistente).
- Un cambio de comportamiento menor: el nombre de la institución que se muestra en la pantalla de acceso y en el encabezado sale siempre de la base de datos (como ya ocurría en la sesión iniciada), no de `ORGANIZATION_NAME`.
- Actualiza como siempre: backup coordinado y `docker compose up --build -d --wait`. Esta versión **agrega una migración**.

## Lo que sigue requiriendo infraestructura

`APP_ORIGIN`, HTTPS y cookies seguras, proxy, `NODE_ENV`, secretos de PostgreSQL y del almacenamiento, proveedor y credenciales S3, límites de evidencia e importación, duración de sesiones y política de invitaciones. Todo eso se muestra en **Sistema** y **Almacenamiento**, pero se cambia en `.env`/Compose.

## Fuera de esta entrega

- **Correo**: Acta no envía correo; no hay configuración que mostrar.
- **Integraciones y webhooks**: no existen; hay solo un [diseño](INTEGRATIONS-DESIGN.md), sin implementar.
- **Idioma**: la interfaz está en español; «Formato regional» cambia fechas y números, no traduce.
