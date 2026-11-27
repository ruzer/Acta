# Ensayo de actualización con datos ficticios

Este procedimiento comprueba v0.12.0 → candidata v0.12.1 y conserva las rutas
históricas desde v0.10.0 y v0.11.0, sobre los mismos siete volúmenes y una
restauración en siete volúmenes nuevos. No opera sobre instalaciones
de trabajo. Reutiliza Compose, el importador, el alta de usuarios y los scripts de
[backup/restauración](BACKUP-RESTORE.md); no escribe datos de negocio por SQL.

## Preparación

Se necesitan Docker Compose, Git, Node compatible con `package.json`, las
dependencias de la candidata (`npm ci`) y Chromium (`npx playwright install chromium`).
En macOS, antepón `caffeinate -dimsu` a los comandos largos. El host debe permanecer
encendido: la expiración normal de una sesión no se desactiva para el ensayo.

Desde un clon de Acta, elige cuatro directorios nuevos, dos nombres Compose exclusivos
que empiecen por `acta-upgrade-` y dos puertos libres. Ejemplo, sustituyendo los
nombres si ya existen. `ref` fija la versión candidata: cambia su valor por el
tag o la rama que quieras evaluar; la base predeterminada es v0.12.0; usa `base_ref=v0.10.0` o
`base_ref=v0.11.0` para los recorridos anteriores. El checkout debe contener
el script actualizado que admite las tres bases publicadas:

```sh
umask 077
lab=$(mktemp -d /tmp/acta-upgrade.XXXXXX)
chmod 700 "$lab"
base_ref=v0.12.0
ref=HEAD
git worktree add --detach "$lab/base" "$base_ref"
git worktree add --detach "$lab/candidate" "$ref"
git worktree add --detach "$lab/restore" "$ref"
git worktree add --detach "$lab/restore-base" "$base_ref"
cp "$lab/base/.env.example" "$lab/source.env"
cp "$lab/candidate/.env.example" "$lab/restore.env"
```

En `source.env`, configura `APP_PORT=4491` y `APP_ORIGIN=http://127.0.0.1:4491`.
En `restore.env`, usa 4492 en ambos valores. Deja demo desactivada y secretos vacíos:
la instalación oficial los genera una sola vez en sus volúmenes privados. Crea los
enlaces `.env` de base y candidata a `source.env`, y el del destino a `restore.env`.
Si Docker agotó sus subredes automáticas, declara dos subredes libres por proyecto
en un override privado, sin reutilizar redes ajenas. Base y candidata usan el mismo
override. Los overrides y `.env` no deben incorporarse a Git.

Comprueba los puertos y nombres antes de arrancar. Ejecuta `npm ci` desde la
candidata. En los ejemplos siguientes, `candidate` es esa ruta absoluta y `lab`
el directorio anterior; conserva ambas variables en la misma terminal.

```sh
candidate="$lab/candidate"
ln -s "$lab/source.env" "$lab/base/.env"
ln -s "$lab/source.env" "$candidate/.env"
ln -s "$lab/restore.env" "$lab/restore/.env"
ln -s "$lab/restore.env" "$lab/restore-base/.env"
(cd "$candidate" && npm ci && npx playwright install chromium)
(cd "$lab/base" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase prepare --root "$lab/base" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
```

`prepare` exige una base vacía de versión 0.10.0, 0.11.0 o 0.12.0. Instala fixtures oficiales,
crea cinco participantes mediante vista previa/confirmación y cambio de contraseña,
importa un CSV de 300 preguntas por la interfaz y registra cinco respuestas.
Los fixtures incluyen evidencia, decisión y una invitación externa usada.
Conserva la cookie **real** de esa base (`fgeo_session` en v0.10.0; `acta_session` en v0.11.0) y las huellas por fila en `state.json`,
fuera de Git, modo 600. Ese archivo contiene credenciales ficticias: no adjuntarlo
a un PR, capturas ni registros públicos. Si falla la preparación, su estado queda
incompleto; diagnostica el error y empieza otro laboratorio, no continúes con él.

## Backup, actualización y restauración

```sh
(cd "$lab/base" && scripts/backup.sh --project acta-upgrade-source --out "$lab/backup-base")
"$lab/base/scripts/verify-backup.sh" "$lab/backup-base"
(cd "$candidate" && docker compose -p acta-upgrade-source up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$candidate" --project acta-upgrade-source \
  --origin http://127.0.0.1:4491 --state "$lab/state.json"
(cd "$candidate" && docker compose -p acta-upgrade-source stop)
(cd "$lab/restore-base" && docker compose -p acta-upgrade-restore build && \
  docker compose -p acta-upgrade-restore pull --ignore-buildable && \
  scripts/restore.sh --project acta-upgrade-restore --backup "$lab/backup-base")
(cd "$lab/restore" && docker compose -p acta-upgrade-restore up --build -d --wait)
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node "$candidate/scripts/upgrade-rehearsal.mjs" \
  --phase verify --root "$lab/restore" --project acta-upgrade-restore \
  --origin http://127.0.0.1:4492 --state "$lab/state.json"
```

Detén el origen antes de arrancar el destino: mantén un solo laboratorio activo.
La restauración advierte diferencias de código o de configuración, por ejemplo
el puerto distinto. No sobrescribe volúmenes existentes. La verificación compara
huellas por fila de las tablas de negocio, incluidas migraciones, cuentas, accesos a proyectos, preguntas,
respuestas, evidencias y decisiones. En AuditEvent admite eventos adicionales,
pero exige conservar cada evento anterior. Excluye de la comparación byte a byte
Session, InvitationSession, LoginAttempt e InvitationRateBucket, que cambian al
usar el sistema; verifica la autenticación funcionalmente. Comprueba el SHA-256 de
la evidencia, el texto de decisión en el informe HTML y su impresión a PDF.

Se restaura primero con el código de la base: los scripts exigen recuentos iguales,
incluidas sus migraciones. Solo después se actualiza el destino a la candidata.
Desde v0.12.0 se exigen las mismas 14 migraciones, sin nuevas, y huellas completas
de la fecha límite y su migración. Ejecuta también `prisma migrate status` en
ambas versiones: no debe haber pendientes. Para las rutas históricas desde
v0.10.0/v0.11.0 se conservan las 13 migraciones anteriores más
`202611180001_response_due_at` (14 en total); solo en esas rutas se retira la
columna nueva de la huella y se exige que sea nula. No se relaja el respaldo.

Además verifica: sesión anterior válida (la cookie real de cada base); nuevo acceso con `acta_session` que retira
`fgeo_session`; cierre que retira ambas e invalida la sesión nueva; ambos smoke
oficiales `--verify`. Un error detiene el ensayo: no se reemplaza una cookie antigua
caducada por otra para presentar una continuidad falsa.

Los resultados del 17 y 18 de noviembre conservan sus versiones y alcance
históricos. El apartado del 24 de noviembre identifica el código final ensayado; el del
22 de noviembre se conserva como histórico, anterior a los lotes F/G.
Cada ejecución debe registrar su commit exacto, las huellas por fila antes y
después y la migración aplicada; no se trasladan resultados a otro código.

## Resultado ejecutado el 2026-11-17

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.10.0,
`f343b70007b8e9aaba91a17dafb98bab04a5aaf8`; código candidato basado en
`7aaa10c71cdbacc4cb06f8a4b45face93f8c806a`, sin cambios de producto en este ensayo. Se repitió el gate completo con
`4b78bc6` (mismo producto que `75dff75`, usado por el destino de restauración);
los resultados de la tabla corresponden a esta segunda ejecución.

| Comprobación | Resultado real |
| --- | --- |
| Preparación por API/UI | PASS: cinco usuarios, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto completo con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 decisión validada, 2 evidencias |
| Migraciones / marca | 13 / 0 assets en base; iguales tras restaurar |
| Backup + verificación | PASS; 20,46 s; 368 841 bytes incluyendo manifiesto; 9 archivos verificados |
| Actualización en los mismos volúmenes | PASS; 29,85 s incluyendo construcción con caché |
| Restauración en volúmenes nuevos | PASS; 33,60 s sin la construcción previa; ocho recuentos iguales |
| Huellas, cookie anterior, evidencia, informe e invitación | PASS antes y después de actualizar y de restaurar |
| SHA-256 de evidencia | `9341f158d49680c2d89bdc3346b24097c1d84b7b07de3180bcf3d50dad0a98ef` |

Los tiempos son de este fixture pequeño y de imágenes con caché. No acreditan una
base institucional, otras versiones iniciales, S3 externo, HA, cambios mayores de
PostgreSQL ni restauración de assets externos. No son una prueba de carga ni un
RTO garantizado. Las [mediciones de recursos](RESOURCE-REFERENCE.md) son separadas.

## Resultado de fecha límite ejecutado el 2026-11-18

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.11.0
`d3fabd45daed0fd93784c2c2ae6a1f929f27bd6e`; candidata del lote C con
`202611180001_response_due_at`. Datos ficticios y demo desactivada.

| Comprobación | Resultado real |
| --- | --- |
| Preparación oficial | PASS: 300 preguntas / 12 temas, cinco cuentas nuevas, 5 publicadas / 295 borradores |
| Conjunto con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 decisión y 2 evidencias |
| Backup y restauración con la base | PASS: ocho recuentos iguales, incluidas 13 migraciones |
| Actualización en los mismos volúmenes y del destino restaurado | PASS: 13 → 14 migraciones; columna nueva nula en los proyectos existentes |
| Huellas por fila | PASS: 38 tablas de negocio; eventos anteriores intactos, solo se admite auditoría adicional |
| Sesión previa y nueva, evidencia, informe e invitación | PASS en actualización y restauración; informe HTML e impresión Chromium a PDF comprobados |

Además, sobre otro laboratorio propio con demo activa se conservaron las 20 893
filas previas de 42 tablas: únicamente se agregó el evento esperado
`DEMO_SEED_COMPLETED` al reiniciar. Se excluyó de la comparación solo la nueva
fila de migración y la columna nueva, que se comprobó nula. No se borraron ni
alteraron filas previas. La ruta v0.10.0 se conserva en el script y sus pruebas;
no se repitió su ensayo completo en esta ejecución. No se verificó una base
institucional ni otra arquitectura.

## Resultado sobre el código final ejecutado el 2026-11-22

**Histórico:** este resultado corresponde a `b9cbe64`, antes de los lotes F/G.
No acredita el código final `e2e3a41`; consulta el ensayo del 24 de noviembre.

Host macOS ARM64, Docker Linux arm64. Base publicada v0.11.0
`d3fabd45daed0fd93784c2c2ae6a1f929f27bd6e`; candidata
`b9cbe64f2ddfcba795bd2f039edb2bfa82f8028c`, que incorpora los cambios
de los PR #154–#157. Datos ficticios, demo desactivada y scripts oficiales sin
cambios. Las imágenes se construyeron desde ambos commits antes de preparar el
fixture; el recorrido completo se ejecutó bajo `caffeinate`, con un solo
laboratorio activo y el origen detenido antes de restaurar el destino.

| Comprobación | Resultado real |
| --- | --- |
| Preparación oficial | PASS: cinco cuentas nuevas, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 validación y 2 evidencias |
| Backup + verificación | PASS: 368 665 bytes incluyendo manifiesto, 9 archivos verificados; 20,096 s + 0,163 s |
| Actualización en los mismos siete volúmenes | PASS: 26,011 s, imágenes precargadas; 13 → 14 migraciones |
| Restauración con la base en siete volúmenes nuevos | PASS: 34,226 s; ocho recuentos iguales, incluidas 13 migraciones |
| Actualización del destino restaurado | PASS: 26,012 s; 13 → 14 migraciones |
| Huellas por fila | PASS: 787 filas previas en 38 tablas conservadas al actualizar, al restaurar la base y al actualizar el destino; eventos previos intactos y columna nueva nula |
| Sesión previa y nueva, evidencia, informe e invitación | PASS en actualización y restauración: cookie original válida, cierre comprobado, informe HTML/PDF y ambos smoke oficiales `--verify` |
| Retirada | Inventario ajeno idéntico por identificador: 74 contenedores, 380 volúmenes y 10 activos |

La comparación excluye `Session`, `InvitationSession`, `LoginAttempt` e
`InvitationRateBucket`, que cambian por uso; la autenticación se verificó
funcionalmente. Los 98 eventos de auditoría previos permanecieron y se añadieron
nueve en cada verificación. Solo se excluyen la nueva migración y la nueva
columna `responseDueAt`, comprobada nula; las 13 migraciones anteriores conservan
sus huellas.

SHA-256 de evidencia comprobado en ambas rutas:
`37af9893dcc9c8f632b5c47af6bdc4c803c67a6224aaf61ed4d44eea85ca0ade`.

Un primer intento quedó incompleto por caducidad normal de la sesión tras
saltos del reloj del host: superó los 30 minutos de inactividad. Sus 787
filas previas estaban intactas, pero no acredita continuidad de sesión ni
restauración. No se sustituyó la cookie ni se cambió su duración. La tabla
anterior corresponde exclusivamente al segundo intento, con un fixture nuevo
y ejecución continua de 174,485 s desde la preparación
hasta la última comprobación. Con precarga, arranque y limpieza fueron 223,857 s. Los tiempos se midieron
con reloj monotónico.

Son tiempos de un fixture pequeño con imágenes precargadas; no acreditan
capacidad ni un RTO. No se probó una base institucional, S3 externo, HA, cambios
mayores de PostgreSQL, assets externos, otra arquitectura ni la ruta v0.10.0.

## Resultado sobre el código final ejecutado el 2026-11-24

Host macOS ARM64, Docker Linux aarch64. Base publicada v0.11.0
`d3fabd45daed0fd93784c2c2ae6a1f929f27bd6e`; candidata final
`e2e3a41d7306cfc006eab82b0e2e3e72855f1670`, merge del PR #165, con los
lotes F/G incorporados. El cierre documental conserva ese producto:
`git diff --stat e2e3a41 HEAD` solo enumera `.md`. Este ensayo nuevo no sustituye
ni traslada las mediciones de carga de otros commits.

Se ejecutaron los scripts oficiales sin modificaciones y con datos ficticios.
`npm ci --ignore-scripts` se ejecutó una vez en la candidata. Se construyeron y
precargaron las imágenes antes del fixture para evitar consumir el tiempo de
sesión durante la construcción. Hubo un solo laboratorio activo: el origen se
detuvo antes de arrancar el destino de restauración. Se usaron puertos y subredes
propios porque el grupo de subredes automáticas de Docker estaba ocupado.
Los comandos largos se ejecutaron con `caffeinate -dimsu`; tiempos medidos con
reloj monotónico e imágenes precargadas.

| Comprobación | Resultado real |
| --- | --- |
| Preparación oficial | PASS; 12,334 s; cinco cuentas nuevas, CSV de 300 preguntas / 12 temas, 5 publicadas / 295 borradores |
| Conjunto con fixtures | 3 proyectos, 13 temas, 302 preguntas, 7 revisiones, 1 validación, 2 evidencias y 0 archivos de marca |
| Backup + verificación | PASS; 21,236 s + 0,962 s; 368 757 bytes incluido manifiesto; 9 archivos verificados |
| Actualización en los mismos siete volúmenes | PASS; 29,845 s; 13 → 14 migraciones; verificación posterior 11,159 s |
| Restauración de la base en siete volúmenes nuevos | PASS; 33,910 s; ocho recuentos iguales, incluidas las 13 migraciones; huellas 787/787 y auditoría 98/98 |
| Actualización del destino restaurado | PASS; 38,410 s; 13 → 14 migraciones; verificación posterior 11,545 s |
| Huellas por fila | PASS; 787 filas previas de 38 tablas conservadas en ambas rutas; 98 eventos anteriores intactos |
| Sesión, evidencia, informe e invitación | PASS; sesión original, cookie nueva y cierre, SHA-256, informe HTML/PDF Chromium y ambos smoke oficiales `--verify` |
| Retirada | 81 contenedores y 387 volúmenes ajenos al ensayo, mismos identificadores/nombres al empezar y terminar; limpieza 2,583 s |

Se restauró primero con v0.11.0 para comprobar los ocho recuentos originales y
solo después se actualizó el destino al mismo código final. No se omitió ni
relajó una comprobación para permitir la migración. Se aplicó únicamente
`202611180001_response_due_at`: las 13 migraciones anteriores mantuvieron sus
huellas y `responseDueAt` quedó nulo en los proyectos previos.

La comparación excluye `Session`, `InvitationSession`, `LoginAttempt` e
`InvitationRateBucket`, que cambian por uso; las sesiones se verificaron
funcionalmente sin sustituir la cookie original. En las tablas comparadas, el
origen actualizado conservó las 787 filas anteriores y agregó diez eventos de
auditoría tras la verificación y un acceso visual (797 filas / 108 eventos).
El destino actualizado agregó nueve (796 filas / 107 eventos). Ninguna otra
alteración se aceptó. SHA-256 de la evidencia comprobada en ambas rutas:
`76396e2cf90386978c0f8537a284a58cd5fd437b97c3a3cdd91deeefd72f2b32`.

Además del script, se recorrió la interfaz real con Chromium a 1440 × 900 y
se inspeccionaron visualmente cuatro capturas con los datos migrados:

- Participante: **Mi trabajo** mostró 1 de 1 enviada y su tarjeta; **Responder**
  conservó el texto ficticio previo, en revisión y solo lectura.
- Analista: **Atención** mostró una pregunta validada y una parcial; **Revisar
  respuestas** cargó ambas aportaciones, filtros y estados.

No se observaron errores de página ni solicitudes fallidas en ese recorrido.
No se editaron respuestas ni decisiones para observarlas. Una primera espera
del arnés privado buscaba **Cerrar sesión** visible, pero en participante está
dentro del menú: se corrigió la espera al encabezado real, sin tocar el producto.
No se repitieron las suites completas de navegador ni integración locales.

Se comprobaron las etiquetas exactas de los 14 volúmenes propios antes de retirar
los dos proyectos con `down -v`. Los contenedores y volúmenes ajenos quedaron
intactos. Configuración privada, credenciales y respaldos permanecieron fuera de Git.

El resultado corresponde a este fixture y host. No acredita teléfonos físicos,
iOS, lectores de pantalla, Safari/Firefox, otras máquinas ni x86_64 local,
personas reales, infraestructura institucional, S3 externo, alta disponibilidad,
cambios mayores de PostgreSQL, recuperación de archivos de marca externos ni la
ruta desde v0.10.0. Los tiempos no son una prueba de carga ni un plazo de
recuperación garantizado.

## Intento detenido el 2026-11-27 — v0.12.0 a candidata v0.12.1

**No acredita actualización ni restauración.** Host macOS ARM64 y Docker
29.8.2 Linux aarch64. Base `a16d3ee0b7eda30fb8fd065e468b7503d4f40b6e`
(v0.12.0); candidata `693742f256ce0b8ae246faac6daedc8ccb8a6123`.
El script admite la base v0.12.0 por excepción expresa del propietario;
no se modificó el código de aplicación.

Laboratorio propio `acta-upgrade-20261127-v0121-source` (puerto 4591), destino
reservado `acta-upgrade-20261127-v0121-restore` (4592), configuración privada,
demo desactivada y secretos generados solo en volúmenes propios. Las imágenes
de base, candidata y base de restauración se construyeron correctamente.

| Paso | Resultado real |
| --- | --- |
| Construcción de candidata | Salida 0; 136,867 s |
| Construcción base con caché / base de restauración | Salida 0; 1,919 s / 13,252 s |
| Pull de imágenes no construibles del destino | Salida 0; 1,353 s |
| Arranque de v0.12.0 con `up -d --wait --no-build` | **Salida 1; 7,011 s:** object-storage quedó unhealthy; dependencia de almacenamiento no disponible |
| Fixture, migrate status, backup, actualización y restauración | No ejecutados; se detuvo el procedimiento sin reintentos |
| Retirada | Siete volúmenes propios con etiqueta individual verificada; `down -v` solo del proyecto origen; destino nunca arrancado |
| Inventario inicial y final | **81 contenedores / 387 volúmenes**, mismos IDs/nombres; cero añadidos o retirados ajenos |

No se diagnosticó ni corrigió la causa del estado unhealthy; no se atribuye
el fallo al cambio de versión ni se propone una corrección de producto sin
evidencia. No se ejecutaron los gates locales completos ni se abrió PR después
del fallo. La instalación preliminar del clon (`npm ci --ignore-scripts`) sí
terminó con salida 0 y auditoría informativa de cero vulnerabilidades; no
sustituye las dos auditorías y las suites requeridas sobre la cabeza final.
Los ensayos históricos anteriores conservan su propio alcance y SHA.

## Retirada

Solo después de guardar la evidencia no sensible, confirma para **cada** volumen
el nombre exacto y la etiqueta `com.docker.compose.project`. Retira únicamente los
dos proyectos creados por este ensayo con `docker compose -p NOMBRE down -v` desde
sus directorios respectivos. Compara los identificadores de contenedores ajenos
con el inventario anterior. Nunca uses comodines ni prune. Retira enlaces privados
y worktrees propios; conserva o elimina el backup privado según tu política, nunca
lo publiques. No ejecutes estos comandos sobre una instalación de trabajo.


## Control de diagnóstico del 2026-11-27 (sin ensayo completo)

Tras autorizar el propietario subredes privadas exclusivamente para el laboratorio,
se ejecutó el instalador oficial `sh scripts/install.sh` de v0.12.0
(`230a8833c41d230be0fe4da55e271fd527e5195e`), siguiendo la ruta del job
`guided-install`, sin el script adaptado de ensayo. Proyecto propio
`acta-diag-20261127-2251`, puerto local 4495; sin modificar producto ni healthchecks.

El primer control terminó con salida 1 antes de arrancar servicios: Docker informó
`all predefined address pools have been fully subnetted`. Se retiraron sus recursos.
El control autorizado posterior usó un override privado con web `10.253.241.0/28`
y data `10.253.241.16/28`, comprobados sin solapamiento con las redes Docker y
las rutas IPv4 específicas observadas (se excluye la ruta por defecto).
El instalador terminó con salida 0; object-storage quedó `healthy`, sin fallos,
en su primera comprobación registrada, 2026-11-27T23:00:06Z.

Se observaron UID/GID 1000:1000 (`node`), directorios de datos internos modo 700,
volumen object-secrets de solo lectura, directorio modo 700 y sus dos archivos
modo 600. No se leyó su contenido. El healthcheck original conserva intervalo
5 s, timeout 3 s y 30 reintentos; no hay publicación de puerto del almacenamiento.
Compose, Dockerfile y arranque de Versity del laboratorio anterior coinciden
byte a byte con este control. Su source.env difiere del ejemplo únicamente en
APP_ORIGIN y APP_PORT (comparación sin publicar valores ni secretos).

El contenedor del intento histórico ya había sido eliminado: no se recuperaron
su Health.Log, logs, permisos ni tiempos internos. El control sano apunta al
laboratorio previo y no reproduce un defecto del producto, pero **no determina
la causa concreta de aquel unhealthy**. El agotamiento actual de subredes no
se presenta como explicación del fallo histórico, que sí llegó a arrancar el
almacenamiento. Se detuvo la fase por falta de causa demostrable, sin inventar
una corrección ni transformar el intento detenido en PASS. No se ejecutaron el
ensayo completo, las comprobaciones finales ni el push/PR de preparación.


El propietario autorizó después continuar el ensayo completo conservando el
incidente como «causa no determinada; no reproducido en el control». Esta
excepción levanta únicamente esa parada; no afirma una corrección del producto.
El alcance autorizado termina en el PR de preparación de upstream.
