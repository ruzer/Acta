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
