# Configuración

## Requerida / arranque

`.env.example` funciona como inicio local sin editar: origen loopback, cookies no Secure solo en loopback, demo desactivada y secretos generados por `secrets-init`. Para producción configurar `APP_ORIGIN=https://…`, `NODE_ENV=production`, `COOKIE_SECURE=true` y TLS externo. Configuración inválida impide arrancar; no se imprimen valores secretos.

`ORGANIZATION_CODE` es el código interno de instalación (DEFAULT por defecto), nunca un campo de login. `ORGANIZATION_NAME` se usa al bootstrap/demo y en branding. El nombre inicial queda persistido en Organization; no existe una pantalla para renombrar organizaciones existentes. Cambiar el código de despliegue no mueve usuarios ni crea acceso cruzado. Cambiar el nombre de despliegue no sobrescribe registros existentes automáticamente.

## Opcional / branding

| Variable               | Default               | Regla                                                                                        |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| APP_NAME               | Acta | Nombre visible / título, hasta 100 caracteres                                                |
| APP_SHORT_NAME         | Acta                  | Hasta 40 caracteres                                                                          |
| ORGANIZATION_NAME      | Example Organization       | Nombre inicial y contexto de instalación                                                     |
| APP_LOGO / APP_FAVICON | vacío                 | Ruta local `/branding/archivo.png` (png/jpg/jpeg/webp/ico/svg), sin traversal ni URL externa |
| APP_ACCENT             | #2b4d7c               | Hexadecimal; contraste mínimo 4.5:1 sobre blanco                                             |
| DEFAULT_LOCALE         | es-MX                 | Locale válido para formato; no implica traducción de toda la UI                              |
| DEFAULT_TIMEZONE       | UTC                   | Zona IANA válida para fechas de revisión/participante                                        |

Añadir assets propios en `app/frontend/public/branding/` y reconstruir frontend, o montar un directorio de assets revisados en `/usr/share/nginx/html/branding` de solo lectura. No incorporar logos con restricciones sin permiso. Solo estos datos públicos salen por `/api/v1/configuration/public`; nunca se expone el entorno completo.

## Secretos y persistencia

POSTGRES_PASSWORD, APP_DB_PASSWORD, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, S3_ACCESS_KEY y S3_SECRET_KEY vacíos generan valores aleatorios únicos. Se guardan en volúmenes separados; el servicio API recibe solo credenciales de aplicación. El propietario de DB pertenece al trabajo temporal de migración; root del almacenamiento pertenece al provider incluido y al trabajo de inicialización. Archivos mode 0600, directorios 0700.

Overrides iniciales: valores privados de al menos 20 caracteres, sin marcadores conocidos ni saltos de línea. No utilizar datos ficticios como credenciales productivas. Los valores persistidos prevalecen como identidad de instalación: un cambio posterior de overrides provoca error, no una rotación silenciosa. Para rotar, hacer backup, detener escritores, actualizar credencial en DB/IAM y archivos privados de forma coordinada, ensayar reinicio y guardar la nueva configuración. Nunca borrar volúmenes de secretos para «regenerar» una instalación existente.

Las sesiones no usan JWT ni una contraseña global: tokens aleatorios opacos y sus hashes/CSRF se guardan en PostgreSQL. No se añade una clave JWT inexistente.

## Storage

`STORAGE_PROVIDER=S3` por defecto en Compose; LOCAL por defecto fuera de Compose para compatibilidad de desarrollo/tests. S3 requiere endpoint, bucket y credenciales; region=us-east-1 y forcePathStyle=true por defecto. Endpoints remotos requieren HTTPS; HTTP únicamente para los nombres internos object-storage/minio o loopback.

`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`. Para AWS S3 usar endpoint regional, región adecuada y normalmente forcePathStyle=false. VersityGW y el override MinIO legacy tienen pruebas funcionales documentadas en [S3-PROVIDERS](S3-PROVIDERS.md); esto no elimina los riesgos de MinIO. Garage no satisface el contrato actual de escrituras condicionales y no se soporta. SeaweedFS queda como candidato avanzado no verificado. AWS/Ceph y otros endpoints son configurables, no compatibilidad funcional afirmada.

No hay URLs firmadas ni acceso directo desde navegador: backend autoriza y verifica bytes/hash. El usuario de aplicación tiene permiso de bucket/listado y Get/Put/Delete solo bajo `evidence/v1/`; no administra buckets ni usuarios. El bucket externo debe aprovisionarse privado por el operador. No descargar URLs aportadas como referencias.

## Límites y desarrollo

Evidence: 20 MiB/archivo, 10 adjuntos y 2 GiB/proyecto por defecto. Import: 5 MiB, profundidad 20, 100 temas, 2.000 preguntas, 20.000 enlaces y 10.000 referencias. Nginx limita cuerpos a 21 MiB: aumentar un límite de backend exige revisar también proxy/memoria.

`DEMO_SEED=false`; habilitar solo en una instalación de prueba con DEMO_PASSWORD privada (mínimo 20 caracteres), nunca en producción. Los datos demo son ficticios y no dependen de una institución real.

Para desarrollo en host: URLs DATABASE_URL/MIGRATION_DATABASE_URL privadas y EVIDENCE_ROOT; `docker-compose.dev.yml` expone PostgreSQL solamente a loopback, de forma explícita. No es necesario para quick start. Las credenciales de volúmenes de Docker no se imprimen automáticamente ni se copian al host.

## Privacidad de infraestructura — antecedente MinIO

Los scripts del MinIO incluido fijan `MINIO_UPDATE=off`, `MC_UPDATE=off` y `MINIO_CALLHOME_ENABLE=off`; la consola también permanece desactivada. Evitan comprobaciones de actualización/call-home automáticas de esos procesos. Las actualizaciones y auditorías las ejecuta el operador explícitamente; el build y los escáneres sí consultan registros públicos. No hay fuentes/CDN/analytics externos en la UI. Un S3 externo configurado por el operador recibe los objetos correspondientes.


## Alcance de instalación

- El despliegue recomendado configura una organización por instalación. Organization y el aislamiento multi-organización permanecen en el dominio; no se solicita selector ni código de organización al login. Host routing multi-tenant no se presenta como capacidad implementada.
- Las credenciales S3 son estáticas de aplicación en esta versión. Para AWS se configura endpoint regional HTTPS, región y path-style; no se afirma soporte IAM role/web identity/rotación automática. Ceph/Garage no se ejecutaron en el gate.
- Para S3 externo, usar docker-compose.external-s3.yml además del archivo base; cambiar solo S3_ENDPOINT no elimina los servicios locales. El bucket externo y sus políticas son responsabilidad del operador.
- Un endpoint S3 malformado falla con mensaje genérico que omite el valor para no filtrar configuración.
- La migración LOCAL → S3 de objetos históricos NO es automática: se conservan sus referencias/backend y volumen LOCAL. Nunca borrar ese volumen por activar S3.


## Configuración actual de storage

El default es `S3_ENDPOINT=http://object-storage:9000` con VersityGW 1.8.0 fijado. Los nombres `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` se conservan como aliases operativos históricos del generador de secretos, no como dependencia del dominio: controlan el root del storage incluido. Mantenerlos vacíos genera secretos únicos; no rotarlos borrando volúmenes. API solo recibe S3_ACCESS_KEY/S3_SECRET_KEY.

El override `docker-compose.external-s3.yml` permite omitir storage/init locales para un bucket externo ya privado. La comprobación API de HeadBucket sigue fallando si las credenciales/provider no sirven. No se usan URLs firmadas ni se cambia la autorización del dominio.

VersityGW se inicia sin debug, LDAP, WebUI, métricas externas ni endpoints adicionales; no se habilitó telemetría opcional. La observación de red previa era acotada al navegador; no equivale a auditar todo el binario. El build y las herramientas de auditoría sí consultan registros públicos.

## Identidad por defecto

APP_NAME y APP_SHORT_NAME usan **Acta**. Una instalación puede cambiarlos mediante configuración sin editar código; ORGANIZATION_NAME conserva su significado independiente. APP_LOGO/APP_FAVICON vacíos usan el wordmark sin inventar un logo. El nombre técnico del proyecto Compose y los volúmenes existentes se conservan para no alterar persistencia.
