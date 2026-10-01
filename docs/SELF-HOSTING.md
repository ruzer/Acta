# Self-hosting

Despliegue de un solo host con PostgreSQL y VersityGW, sin alta disponibilidad. Linux ARM64 está verificado; Linux AMD64 todavía no. Acta se distribuye bajo AGPL-3.0-only; los componentes de terceros conservan sus propios avisos.

## Elegir el recorrido

| Necesidad | Recorrido |
|---|---|
| Evaluar en tu computadora | [Demo ficticia](../README.md#quiero-probarlo-con-datos-ficticios) |
| Comenzar sin datos de ejemplo | [Instalación vacía y administrador](../README.md#quiero-instalar-una-instancia-vacía) |
| Instalar en un servidor | Arranque vacío + red/HTTPS de esta guía |
| Desarrollar código | [Desarrollo](DEVELOPMENT.md) |
| Comprobar despliegue sobre datos descartables | [Verificación](VERIFICATION.md) |

## Antes de instalar

Docker, Docker Compose **2.24.4+**, conexión para descargar dependencias/imágenes y disco persistente. No necesitas Node, Go ni PostgreSQL en el host.

**No published minimum yet.** No hay mediciones publicadas de CPU, RAM o disco que permitan establecer mínimos. Dimensiona según carga, evidencia, retención y backups, y mide en tu entorno antes de comprometer capacidad. El tamaño máximo por archivo y otros límites están en [Configuración](CONFIGURATION.md); no equivalen a requisitos mínimos del servidor.

## Quick Start local

Desde la raíz, con DEMO_SEED=false:

```sh
cp .env.example .env
docker compose up --build
```

En otra terminal:

```sh
docker compose ps
docker compose exec backend node scripts/bootstrap-admin.mjs
```

Espera PostgreSQL, object-storage, backend y frontend saludables. Los trabajos secrets-init, migrate y storage-init deben finalizar correctamente; no son servicios permanentes. Abre [localhost:4317](http://localhost:4317), inicia sesión y cambia la contraseña temporal.

Para ejecución en segundo plano usa `docker compose up --build -d --wait`. Si no termina correctamente, revisa `docker compose ps -a` y logs del servicio afectado. No compartas logs sin revisar datos sensibles. No borres volúmenes para intentar reparar el arranque.

## Servidor real: acceso y HTTPS

Por defecto, el frontend está publicado **solo en 127.0.0.1:4317 del host Docker**. Desde otra computadora, localhost se refiere a esa otra computadora. PostgreSQL 5432 y S3 9000 quedan en la red interna; no tienen puertos públicos. No hay consola de storage expuesta.

Para evaluar remotamente sin exposición pública puedes establecer un túnel SSH autorizado al puerto loopback del servidor. Debes acceder con el origen que coincide con APP_ORIGIN. El túnel es una opción operativa; su configuración y permisos dependen del host y no fueron parte del gate del snapshot.

Para acceso estable, utiliza el reverse proxy que ya operes (Caddy, Nginx o Traefik, por ejemplo). Ninguno es dependencia obligatoria del proyecto. El proxy termina TLS y reenvía al frontend local, incluyendo las rutas `/api`; conserva Host y esquema de la solicitud.

1. Configura DNS y un certificado válido para el dominio elegido.
2. En `.env`, establece APP_ORIGIN al origen HTTPS exacto, NODE_ENV=production y COOKIE_SECURE=true. Mantén DEMO_SEED=false.
3. Configura el proxy al loopback del frontend y conserva sus límites de carga/timeouts. El proxy necesita permitir el tamaño de evidencia autorizado; Nginx incluido limita cuerpos a 21 MiB.
4. Aplica configuración con `docker compose up --build -d --wait` y prueba login, cambio de contraseña y upload/download autorizado desde el origen HTTPS.
5. Restringe puertos de administración y protege acceso a Docker y backups.

**Integración de proxy: guía operativa, no receta TLS verificada para un proxy específico.** Un proxy en otro contenedor no puede alcanzar el host mediante su propio 127.0.0.1; necesita una red/topología explícita. No expongas DB o almacenamiento para resolverlo. No uses CORS comodín ni desactives CSRF.

## Dónde se guardan los datos

| Volumen | Contenido |
|---|---|
| pgdata | Base de datos PostgreSQL |
| objectdata | Archivos, metadata, IAM y marcador de formato de VersityGW |
| evidence | Evidencia LOCAL histórica, cuando existe; no reemplaza objectdata |
| db-secrets / api-secrets | Credenciales propietarias y limitadas de aplicación |
| object-secrets / provision-secrets | Identidad del almacenamiento y aprovisionamiento |

El nombre real suele llevar el prefijo del proyecto Compose. Conserva ese nombre al actualizar y comprueba los volúmenes antes de operar. `stop`, `restart` y recrear contenedores conservan volúmenes; eliminarlos destruye los datos que contienen. Usa [el backup coordinado](BACKUP-RESTORE.md).

## Secretos y privacidad

Los campos vacíos de secretos se generan una sola vez y se conservan en volúmenes privados. La API no recibe credenciales propietarias de PostgreSQL ni root del storage. Cambiar overrides posteriormente no rota credenciales: consulta [Configuración](CONFIGURATION.md). Protege `.env` y los volúmenes; nunca los subas al repositorio.

VersityGW es un servicio S3 para guardar adjuntos privados. Las descargas pasan por la autorización del backend; no habilites acceso público al bucket. La interfaz no requiere fuentes/CDN/analytics externos. El build sí descarga dependencias públicas.

## Actualizar

1. Lee el changelog y confirma compatibilidad de aplicación, PostgreSQL y provider.
2. Ejecuta y verifica un backup coordinado de DB, objetos y configuración.
3. Conserva `.env`, nombre del proyecto Compose y volúmenes. Cambiar de directorio no debe cambiar la identidad del despliegue.
4. Ejecuta `docker compose up --build -d --wait` con la nueva versión autorizada. El trabajo de migración aplica migraciones versionadas; nunca uses db push.
5. Verifica salud, login y una descarga conocida. Cambiar código hacia atrás no revierte automáticamente las migraciones; usa una restauración coordinada si hace falta volver.

No ejecutes `down --volumes` sobre datos que quieras conservar. Mantén disponibilidad de la versión previa y su backup; no mezcles escritores de versiones distintas.

## Supervisión

Healthchecks: PostgreSQL consulta la DB; VersityGW responde a `/_health`; API comprueba DB/bucket; frontend sirve su documento. Monitorea además disco, memoria, logs y backups. Un 200 no acredita integridad de todos los objetos ni reemplaza supervisión.

## Instalaciones anteriores y almacenamiento avanzado

Esta sección es solo para continuidad de instalaciones existentes. Conserva nombre Compose, credenciales, códigos de organización y volúmenes originales. Una instalación LOCAL mantiene sus archivos históricos en evidence: activar S3 no los mueve y no autoriza borrar ese volumen. Registros MINIO legados se leen mediante el adaptador S3 con bucket/claves correctos.

MinIO es legacy, con riesgos upstream; no se recomienda para instalaciones nuevas. No montes un volumen físico de un provider sobre otro ni mantengas dos implementaciones escribiendo el mismo volumen. Cambiar S3_ENDPOINT no migra archivos.

Consulta [Proveedores S3](S3-PROVIDERS.md) para overrides y límites. El recorrido básico sigue utilizando únicamente VersityGW; los endpoints externos deben ser aprovisionados por el operador y no se declaran verificados.
