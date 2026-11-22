# Mediciones de referencia de recursos

Medición del 2026-11-17 sobre datos ficticios del [ensayo de actualización](UPGRADE-REHEARSAL.md).
**No son mínimos garantizados ni una prueba de capacidad institucional.** Son
observaciones de una ejecución corta en una computadora compartida con otros
proyectos. No se detuvo ni midió el contenido de esos proyectos.

## Laboratorio y método

- Host macOS ARM64, modelo Mac14,5: 12 CPU lógicas, 32 GiB de RAM.
- Docker Desktop: servidor Docker 29.8.2, Linux aarch64, 12 CPU y 8 319 238 144
  bytes de memoria disponibles para su máquina virtual (7,75 GiB).
- Código de producto basado en `7aaa10c71cdbacc4cb06f8a4b45face93f8c806a`.
  PostgreSQL 18.6, VersityGW 1.11.0, backend y frontend construidos localmente.
- Cuatro servicios persistentes; inicialización, migraciones y creación del bucket
  ya habían terminado. No se midió el consumo de construcción de imágenes.
- `docker stats --no-stream --format '{{json .}}'` sobre los cuatro IDs propios:
  cinco muestras en reposo y cuatro durante la carga (aproximadamente una cada
  dos segundos). «Reposo» mantiene healthchecks y tareas normales activos.
- CPU según Docker: 100 % equivale aproximadamente a una CPU lógica; puede
  superar 100 %. RAM es `MemUsage` reportada por Docker, no toda la RAM del host.
  Los rangos siguientes son mínimos y máximos **muestreados**, no picos continuos.

| Servicio | CPU reposo | RAM reposo (MiB) | CPU carga | RAM carga (MiB) |
| --- | --- | --- | --- | --- |
| Backend | 0–9,34 % | 246–248,3 | 70,87–102,42 % | 409,7–572 |
| Frontend nginx | 0–1,47 % | 10,37–12,02 | 1,26–2,39 % | 12,15–12,41 |
| PostgreSQL | 0–5,77 % | 44,66–46,16 | 49,91–50,45 % | 87,97–89,75 |
| VersityGW | 0,06–7,79 % | 40,39–41,94 | 0,02–5,47 % | 40,64–41,54 |

## Carga ejecutada

Sobre el **destino restaurado**, cinco participantes distintos, cada uno asignado
a una pregunta, hicieron 30 ciclos seguidos: consultar Mi trabajo, leer respuesta,
guardar borrador y enviarlo. Son 150 ciclos / 600 peticiones en esos bucles.
Simultáneamente, Administración importó otro CSV de 300 preguntas / 12 temas por
la interfaz y un participante subió un PNG ficticio de ruido aleatorio.

- Resultado: PASS, sin errores HTTP ni de integridad.
- Duración observada: 8 169 ms, incluyendo muestreo y comprobaciones finales.
- Importación CSV por navegador: 1 452 ms.
- Evidencia subida y almacenada: 3 637 610 bytes (3,47 MiB). Se adjuntó y envió
  después de los bucles para no competir con la edición del mismo borrador;
  la descarga coincidió con el SHA-256 devuelto por el servidor.
- Base tras carga: 14 874 303 bytes. Los cinco participantes conservaron sus
  revisiones independientes; no se reutilizó una sola cuenta como cinco personas.

Para repetir, termina primero la actualización y restauración de la guía y ejecuta
**una vez**, desde la candidata, contra el destino ficticio recién verificado:

```sh
ACTA_UPGRADE_REHEARSAL_ALLOWED=true node scripts/upgrade-rehearsal.mjs \
  --phase measure --root "$lab/restore" --project acta-upgrade-restore \
  --origin http://127.0.0.1:4492 --state "$lab/state.json"
```

En macOS, antepón `caffeinate -dimsu`. El comando reutiliza las precondiciones del
ensayo, exige las huellas originales y emite JSON de medidas sin credenciales.
Modifica **solo el fixture de destino**: no es un monitor para instalaciones reales.
No vuelvas a ejecutar la comparación contra las huellas anteriores en ese destino:
la carga añade un proyecto, revisiones y evidencia deliberadamente. Para repetir,
restaura otra vez en un proyecto nuevo. Conserva los logs fuera de Git.

## Disco e imágenes después del conjunto inicial

Medidos en el origen actualizado, antes de cargar datos adicionales allí. Hay
302 preguntas, siete revisiones de respuesta, una validación y dos evidencias.
`pg_database_size(current_database())` devuelve **12 334 783 bytes**. El backup
coordinado, incluyendo configuración y manifiesto, ocupó **368 542 bytes**.

| Imagen construida o utilizada | Tamaño reportado por Docker (bytes) |
| --- | ---: |
| Backend runtime | 1 198 496 735 |
| Frontend | 94 585 890 |
| PostgreSQL | 642 912 581 |
| VersityGW | 469 612 021 |

No se deben sumar estos tamaños como disco exclusivo: las capas se comparten.
No incluyen toda la caché de construcción, imágenes anteriores ni reservas del
disco virtual de Docker. `migrate` reutiliza el runtime; `storage-init` añade el
binario de administración de almacenamiento.

| Volumen | `du -sk` (KiB asignados) |
| --- | ---: |
| pgdata, con cluster y WAL | 68 552 |
| objectdata | 128 |
| evidence | 12 |
| db-secrets | 16 |
| api-secrets | 8 |
| object-secrets | 12 |
| provision-secrets | 20 |

Para medir sin leer contenido: verifica la etiqueta `com.docker.compose.project`
de cada volumen; ejecuta `du -sk /input` con su nombre exacto montado `:ro` en un
contenedor auxiliar sin red. Se necesita UID 0 **solo en ese contenedor de lectura**
para recorrer el volumen de PostgreSQL. No cambies el usuario del servicio.
Consulta las imágenes por el nombre de `Config.Image` de cada contenedor propio
con `docker image inspect --format '{{.Size}}' IMAGEN`. Algunas imágenes
multiplataforma presentan un ID de manifiesto distinto del ID inspeccionable.
No se usa `docker system df` global para atribuir a Acta datos de otros proyectos.

## Uso para dimensionar

Sistemas debe repetir el escenario con su hardware, datos y concurrencia esperada,
reservando espacio para objetos, auditoría, WAL, copias, imágenes y crecimiento.
Un backup de 300 preguntas casi sin archivos no representa una instalación con
miles de evidencias. La prueba corta no mide saturación, latencias percentiles,
retención prolongada, fugas, uso de muchos usuarios, otros proveedores S3, HA ni
recuperación ante caída del host. No extrapolar estos resultados ARM64 a un
servidor x86_64: la instalación funcional en CI x86_64 acredita otro alcance.


## Guardados simultáneos y autoguardado — 2026-11-18

Laboratorio descartable propio sobre `b6093c9`, en el mismo host ARM64 compartido;
no se cambiaron el servidor, el pool ni los límites de transacción. Se añadieron
300 preguntas publicadas, 50 cuentas ficticias y 15 000 asignaciones mediante
importación y operaciones oficiales. Cada cuenta envió un borrador independiente
al mismo tiempo. No se reutilizó una cuenta como si fueran 50 personas.

| Medida | Resultado real |
| --- | ---: |
| Peticiones de guardado simultáneas | 50 |
| Respuestas HTTP 200 | 12 |
| Respuestas HTTP 500 | 38 |
| Duración de la tanda | 29,77 s |
| Mínimo / mediana / percentil 95 / máximo por petición | 2,04 / 15,06 / 28,34 / 29,76 s |

**Esta carga no pasó como prueba de capacidad.** El backend registró 38 errores
Prisma `P2028` durante la tanda. Los fallos cuentan en los tiempos;
no se ocultaron ni reintentaron. No es una recomendación para operar con 50 personas
concurrentes. Es una medición de una tanda, no una promesa ni un límite universal.

Se conserva `recomputeReview`: sobre el mismo conjunto de preguntas, guardar
`consultationRequested=true` cambió una pregunta de `NOT_REVIEWED` a `PENDING`.
Omitir el recálculo de todos los borradores alteraría un resultado funcional.
La corrección de ese costo requiere una propuesta que conserve esas proyecciones;
no se cambia la revisión como atajo para acelerar esta entrega.

Para repetir en una instalación **descartable propia**, con la cuenta de prueba
`admin` ya activada, guarda `APP_ORIGIN` (HTTP local con puerto exclusivo),
`ACTA_DRAFT_LOAD_ALLOWED=true` y `ACTA_LOAD_ADMIN_PASSWORD` en un archivo privado
fuera de Git, modo 600. No uses credenciales reales:

```sh
caffeinate -dimsu node --env-file=/ruta/privada/carga.env scripts/draft-load.mjs
```

En Linux omite `caffeinate`. El script rechaza orígenes externos, crea datos
ficticios nuevos, imprime recuentos y tiempos sin credenciales y no elimina nada.
Retira después **solo el proyecto Compose y los volúmenes de ese laboratorio**,
verificando sus etiquetas. No ejecutarlo en una instalación de trabajo.

Por separado, una sesión Chromium de diez minutos reales hizo 50 cambios de texto,
uno cada 12 segundos. El autoguardado produjo **17 eventos `RESPONSE_DRAFTED`**:
por minuto, `2, 2, 1, 2, 2, 1, 2, 2, 1, 2`; intervalo mínimo **35,97 segundos**.
Ninguna ventana de 60 segundos tuvo más de dos eventos. Esta prueba usó pausas reales,
no el reloj simulado de las pruebas unitarias. El límite corresponde a intentos
automáticos; pulsar acciones de guardado o envío explícitamente sigue disponible.

## Guardados con ritmo espaciado — 2026-11-19

El modo `ACTA_DRAFT_LOAD_MODE=paced` conserva las 300 preguntas, 50 cuentas y
15 000 asignaciones ficticias del ensayo anterior. Inicia un guardado cada
0,6 segundos y realiza dos rondas: 100 peticiones en total. Cada persona
termina su primer guardado antes de iniciar el segundo y usa la versión que
confirmó el servidor. No se reintentan los errores. Sin esta variable se conserva
el modo anterior de 50 guardados simultáneos (`simultaneous`).

Añade `ACTA_DRAFT_LOAD_MODE=paced` al mismo archivo privado del ejemplo anterior.
El modo se valida antes de crear datos. No cambian el backend, `recomputeReview`,
el pool ni los límites de transacción.

Medición de esta entrega sobre la base `337db42`, con el backend de esa base en
un laboratorio Docker ARM64 propio, en un host compartido. Los cambios de este PR
son de interfaz y del script de medición. La tanda se completó; **no pasó como
prueba de capacidad**:

| Medida | Resultado observado |
| --- | ---: |
| Peticiones / rondas / intervalo | 100 / 2 / 0,6 s |
| Respuestas HTTP 200 / HTTP 500 | 67 / 33 |
| Duración total de la tanda | 69,59 s |
| Mínimo / mediana / percentil 95 / máximo | 2,03 / 9,52 / 15,13 / 21,76 s |

Los 33 errores corresponden a `P2028` en el backend propio y se incluyen en los
percentiles. Se conserva la comprobación de
proyección: pedir consulta en un borrador cambió una pregunta de `NOT_REVIEWED`
a `PENDING`, por lo que no se elimina el recálculo.

Como referencia **independiente proporcionada para este trabajo**, otro ensayo
sobre `337db42`, también del 2026-11-19 y en un host ARM64 compartido, informó
0,76 s para un guardado aislado y 100/100 HTTP 200 al mismo ritmo, con mediana
4,85 s, percentil 95 de 8,8 s y máximo de 9,1 s. No se presenta como resultado
reproducido por esta entrega. No se midió de nuevo el guardado aislado ni se
identificó la causa de la diferencia entre los dos entornos. Estas observaciones
no garantizan capacidad para una institución; se necesita medir su carga y
entorno reales antes de dimensionar.

## Menos lecturas al guardar borradores — 2026-11-21

**Mejora medida, con un límite pendiente:** la candidata completó 300/300 guardados
espaciados y 94/150 en ráfagas de 50. Las ráfagas aún tuvieron **56 errores**.
Esto no demuestra capacidad garantizada para 50 personas simultáneas.

Se comparó la base [`4e7390c`](https://github.com/ruzer/Acta/commit/4e7390cc586a2532247538c82606a0b6cc271d5f)
con el cambio [`659bf8a`](https://github.com/ruzer/Acta/commit/659bf8a6214bdb35753408b920582bb4acc66b52).
Los commits posteriores de esta entrega solo registran la medición; no cambian
el código medido. El backend compilado tiene 67 archivos JavaScript en ambas
versiones: solo difieren `responses.service.js` y `review-state.js`.

### Entorno y protocolo

Docker Desktop ARM64, 12 CPU y 7,748 GiB de RAM para la VM; el laboratorio no tiene
cuotas individuales. PostgreSQL 18.6: `max_connections=100`, `shared_buffers=128 MB`,
`work_mem=4 MB`. El pool efectivo de `pg` conserva `max=10`; Prisma conserva
`maxWait=2000 ms` y la transacción de `AccessService.mutate` tiene `timeout=15000 ms`.
El bloqueo por proyecto se mantiene.

El **proyecto medido** contiene 300 preguntas publicadas, 50 cuentas ficticias y
15 000 asignaciones. La base completa conservó dos preparaciones fallidas:
3 proyectos, 600 preguntas, 150 participantes y 21 000 asignaciones en total
(151 cuentas contando Administración). Solo las 50 personas del proyecto medido
enviaron peticiones. Ese mismo respaldo, incluidos los restos ficticios, se restauró
para ambas versiones; esta es una limitación del montaje. No representa datos
institucionales.

La primera serie conservó el estado entre tandas. La comparación emparejada
restauró el respaldo inicial y reinició únicamente el backend antes de **cada**
tanda, alternando base y candidata por modo tres veces. Se usaron
`scheduleDraftWrites` y `summarizeDraftWrites` de `scripts/draft-load.mjs`:
`paced` programa 100 guardados en total, separados por 600 ms, sin solapar dos de la misma cuenta;
`simultaneous` inicia 50 juntos. También se hicieron 20 guardados aislados por
versión. No hubo reintentos y los tiempos incluyen éxitos y fallos.

Restauración, inicio y comprobación de salud quedaron fuera del cronómetro.
Para reutilizar las mismas cuentas y sesiones ficticias se refrescaron solo
`lastSeenAt` y `expiresAt`, de igual forma para ambas versiones y fuera del tiempo
medido. No se ejecutó `ANALYZE`, ni se cambiaron dependencias, cuotas o límites.
El montaje y la instrumentación fueron privados, fuera de Git; no son herramientas
nuevas del producto. Las pruebas se ejecutaron con `caffeinate -dimsu`.

Durante la primera serie había 10 contenedores ajenos activos. Durante toda la
comparación final había esos mismos 10 y un PostgreSQL propio inactivo, usado antes
para la integración. No corrieron otros tests, builds o navegadores de esta tarea
mientras se medía. Se capturaron `uptime`, límites, CPU/RAM y contenedores activos
antes y durante cada tanda, aproximadamente cada tres segundos. La carga del host
observada en la comparación varió entre 2,57–12,38 / 3,90–6,86 / 4,57–5,80
(1 / 5 / 15 minutos). No se controló la actividad ajena del host.

### Primera serie: estado conservado, sin instrumentación

| Tanda | Versión | HTTP 200 / 500 (P2028) | Mín. ms | Mediana ms | p95 ms | Máx. ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1-paced | base | 95 / 5 | 883,97 | 6088,53 | 9307,13 | 9456,14 |
| 2-simultánea | base | 24 / 26 | 820,41 | 11081,84 | 16331,11 | 17757,00 |
| 3-paced | base | 93 / 7 | 721,96 | 6336,39 | 10181,52 | 10588,23 |
| 4-simultánea | base | 21 / 29 | 788,86 | 8462,40 | 13487,22 | 14895,61 |
| 5-paced | base | 94 / 6 | 717,64 | 5442,75 | 10385,21 | 10831,05 |
| 6-simultánea | base | 21 / 29 | 791,88 | 8869,94 | 14328,53 | 15851,17 |
| 7-20 aislados | base | 20 / 0 | 684,42 | 727,43 | 810,91 | 871,56 |

El primer contador automático de contenedores ajenos devolvió un cero incorrecto;
la captura corregida durante esa tanda confirmó 14 activos: 4 propios y 10 ajenos.
No se interpreta aquel cero como aislamiento. Las siguientes capturas usaron
el contador corregido.

### Comparación emparejada: respaldo restaurado antes de cada tanda

Ventana de peticiones: 18:14:38–18:24:15 UTC. Cada pareja siguió base → candidata;
no se mezclan estos resultados con la primera serie para calcular mejoras.

| Tanda | Versión | HTTP 200 / 500 (P2028) | Mín. ms | Mediana ms | p95 ms | Máx. ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1-paced | base | 66 / 34 | 2061,53 | 9548,07 | 15036,28 | 22681,48 |
| 1-paced | candidata | 100 / 0 | 262,03 | 298,92 | 391,68 | 489,87 |
| 1-simultánea | base | 21 / 29 | 2081,82 | 11833,11 | 17343,07 | 18843,88 |
| 1-simultánea | candidata | 31 / 19 | 508,01 | 8004,15 | 10651,62 | 11347,21 |
| 2-paced | base | 61 / 39 | 2024,30 | 9530,66 | 15048,08 | 17655,26 |
| 2-paced | candidata | 100 / 0 | 259,33 | 296,89 | 404,09 | 485,70 |
| 2-simultánea | base | 15 / 35 | 2081,65 | 14410,51 | 18776,43 | 20147,54 |
| 2-simultánea | candidata | 31 / 19 | 506,10 | 8048,43 | 10648,66 | 11351,52 |
| 3-paced | base | 49 / 51 | 2022,53 | 9328,33 | 16938,56 | 29426,55 |
| 3-paced | candidata | 100 / 0 | 265,22 | 304,31 | 397,62 | 496,39 |
| 3-simultánea | base | 8 / 42 | 2085,95 | 14900,84 | 17288,88 | 18882,27 |
| 3-simultánea | candidata | 32 / 18 | 517,59 | 8511,06 | 11217,19 | 11908,07 |
| 20 aislados | base | 20 / 0 | 724,49 | 3142,49 | 3493,70 | 3630,70 |
| 20 aislados | candidata | 20 / 0 | 348,44 | 366,30 | 412,66 | 496,15 |

Los logs sin instrumentación registran el código P2028 para cada HTTP 500;
no permiten asignar su causa exacta a cada petición. La clasificación de causas
se obtuvo por separado, como se indica abajo.

Rangos de los picos observados por tanda, incluidos los aislados:

| Versión | CPU backend % | RAM backend MiB | CPU PostgreSQL % | RAM PostgreSQL MiB |
| --- | ---: | ---: | ---: | ---: |
| base | 92,67–114,65 | 651,90–1148,93 | 88,66–96,65 | 91,62–202,30 |
| candidata | 66,04–110,50 | 564,00–631,60 | 27,16–46,80 | 83,78–199,80 |

El 100% de CPU equivale aproximadamente a un núcleo; no es el porcentaje de toda
la VM. Los registros privados conservan también las muestras y los tiempos
separados por respuesta HTTP.

### Desglose de un guardado, separado de la carga sin instrumentación

La primera serie instrumentada de 20 aislados sobre la base ya utilizada dio
745,04 ms de mediana en `save`: 708,88 ms en recálculo, incluidos 578,87 ms en
cobertura. Ese trabajo explica aproximadamente el 95% del tiempo de servicio
observado y el guardado aislado cercano a 0,76 s de la referencia anterior.

Para comparar ambas versiones se instrumentaron después otros 20 aislados por
versión, restaurando el mismo respaldo antes de cada serie. Medianas en ms:

| Fase | Base | Candidata |
| --- | ---: | ---: |
| `loadGraph.execute` | 56,38 | 57,13 |
| `loadGraph.save` | 54,97 | se reutiliza |
| `upsert.response` | 0,51 | 0,54 |
| `upsert.responseDraft` | 1,47 | 1,47 |
| `coverage` | 2872,22 | 154,86 |
| `recomputeReview` | 3000,27 | 241,66 |
| `loadGraph.final` | 56,67 | 58,50 |
| `save.total` | 3178,92 | 364,72 |

Cobertura está incluida en recálculo: no se suman como fases independientes.
Se conserva el recálculo completo; cambia la forma de obtener los datos que usa.

Las sentencias SQL bajaron de **678 a 71 por guardado aislado**, con el mismo
conteo en los 20 casos de cada versión: 4 de autenticación y 674 → 67 dentro de
la transacción. Cada guardado tomó cinco préstamos **secuenciales** del pool
(cuatro de autenticación y uno de transacción), sobre un mismo identificador de
conexión observado. No son cinco conexiones simultáneas.

Operaciones ORM del recálculo; las medianas son por llamada:

| Operación | Llamadas base / candidata por guardado | Mediana base / candidata, ms |
| --- | ---: | ---: |
| `coverage.question.findMany` | 50 / 1 | 52,45 / 6,03 |
| `coverage.questionAssignment.findMany` | 1 / 1 | 133,10 / 136,75 |
| `coverage.response.findMany` | 50 / 1 | 1,36 / 5,99 |
| `coverage.responseInvitation.findMany` | 0 / 1 | — / 5,94 |
| `recomputeReview.clarificationThread.findMany` | 1 / 1 | 1,69 / 1,98 |
| `recomputeReview.conflict.findMany` | 1 / 1 | 1,71 / 1,99 |
| `recomputeReview.question.findMany` | 1 / 1 | 1,38 / 1,65 |
| `recomputeReview.questionDisposition.findMany` | 1 / 1 | 1,69 / 1,97 |
| `recomputeReview.validation.findMany` | 1 / 1 | 1,73 / 2,01 |

Estas son mediciones con instrumentación privada, sin parámetros SQL ni contenido
de respuestas. Prisma puede agrupar consultas de autenticación bajo concurrencia;
el conteo exacto por petición anterior corresponde a los aislados completos.

Resultados HTTP de todas las series instrumentadas finales, informados aparte:

| Tanda | Versión | HTTP 200 / 500 (P2028) | Mín. ms | Mediana ms | p95 ms | Máx. ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 20 aislados | base | 20 / 0 | 739,63 | 3186,45 | 3329,05 | 3346,99 |
| paced | base | 47 / 53 | 2624,48 | 14401,18 | 21570,33 | 32208,25 |
| 20 aislados | candidata | 20 / 0 | 351,78 | 371,55 | 389,41 | 515,40 |
| simultánea | candidata | 30 / 20 | 508,73 | 7672,50 | 10210,23 | 10920,55 |

### Qué significa P2028 en este ensayo

En la serie inicial instrumentada, los 27 errores de la ráfaga y los 8 del ritmo
espaciado fueron espera agotada **antes** de iniciar la transacción.
El protocolo restaurado mostró también el segundo mecanismo:

- **Base restaurada, ritmo espaciado instrumentado:** 47/100 correctos; 36 esperas
  agotadas al iniciar y 17 transacciones vencidas. Estas últimas esperaron una
  mediana de 14 399,45 ms, máximo 14 453,23 ms, en `Project FOR UPDATE`; quedaba muy
  poco del límite de 15 000 ms para trabajar.
- **Candidata restaurada, ráfaga instrumentada:** 30/50 correctos; los 20 errores
  fueron espera agotada al iniciar. Ninguno llegó a `BEGIN` ni al bloqueo del
  proyecto antes de responder. No hubo expiraciones observadas en esa muestra.
  Entre los éxitos, adquirir la conexión transaccional tardó una mediana de
  704,75 ms y máximo de 1895,78 ms; esperar el bloqueo del proyecto, 3180,44 ms de
  mediana y 3378,11 ms como máximo.

Mensaje exacto de adquisición:

```text
Transaction API error: Unable to start a transaction in the given time.
```

Ejemplo exacto de expiración de la base:

```text
Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 15000 ms, however 15046 ms passed since the start of the transaction. Consider increasing the interactive transaction timeout or doing less work in the transaction.
```

Una expiración se detectó a los 25 549 ms; la demora adicional no quedó explicada.
La autenticación anterior también espera conexiones, por lo que la duración HTTP
de un error de adquisición puede superar los dos segundos de `maxWait`.
La candidata reduce trabajo mientras se retiene el bloqueo, pero **no elimina**
la espera de conexiones ante una ráfaga de 50.

### Variación observada y límites

La primera serie conservó borradores y un backend ya utilizado; la comparación
final restauró datos y reinició el proceso en cada tanda. Tras restaurar,
`QuestionAssignment` no tenía `last_analyze` ni `last_autoanalyze`, y registraba
21 000 cambios pendientes de análisis. En la serie aislada de la base apareció
`autoanalyze` a las 18:24:02 UTC; al terminar la candidata aún no había ocurrido.
Se observó fuera del cronómetro, sin intervenir. Es compatible con efectos de
estadísticas y caché, pero no aísla una causa. Reinicio, compilación interna de
JavaScript y actividad del host tampoco se aislaron experimentalmente.

**La diferencia histórica entre 67/100 y 100/100 no tiene una explicación
concluyente.** Estas repeticiones muestran variación incluso en el mismo commit,
pero no reconstruyen las condiciones de aquellos ensayos. Las cifras no deben
mezclarse ni extrapolarse a otro servidor.

La primera captura detallada del ritmo espaciado instrumentado conservó 82/100
trazas, aunque sí todos los tiempos HTTP y los ocho errores; no se usa para el
desglose comparativo final. Las cuatro capturas finales conservaron 190/190 trazas
mediante lectura continua del log. Se separó un mensaje de error intercalado en
una línea, manteniendo también los registros crudos.

Se aplicó únicamente la reducción de lecturas (3b). No se cambió el ritmo del
cliente: este ensayo por API no mide la alineación de pestañas reales; el
retroceso de reintentos existente permanece. No se añadieron opciones de pool.
Tampoco se acotó el recálculo a una pregunta (3c), por lo que **no se ejecutó ni se
atribuye la prueba de 2000 secuencias** requerida para autorizar ese cambio.

La integración compara la cobertura con el cargador anterior en ocho casos de
PostgreSQL real: consultas, condiciones, versiones, asignaciones, varias personas,
revisión e invitaciones. Además, dos guardados sobre un borrador existente, con y
sin consulta solicitada, devolvieron bytes idénticos (869 y 863 bytes) y los mismos
estados y versiones de todas las preguntas. Ese ensayo usa el mismo estado inicial,
`SAVEPOINT` y un reloj de datos controlado; no elimina campos del resultado ni
constituye equivalencia exhaustiva de todos los efectos persistidos.

No se midieron otros hosts, x86_64, otros tamaños, otros pools, red externa,
personas reales ni producción. Persisten los 56 fallos de las ráfagas candidatas.
Cualquier decisión de capacidad requiere un ensayo propio con la carga esperada.
