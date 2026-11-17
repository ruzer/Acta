# Verificación en instalaciones descartables

Esta guía es para desarrollar o verificar el despliegue, no para administrar una instalación con datos reales. Los resultados fechados permanecen en el [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md).

## Plataformas y evidencia vigente

**Verificado en CI (GitHub Actions, Linux x86_64):** instalación Docker desde
volúmenes vacíos, PostgreSQL, contrato S3 y privacidad con VersityGW 1.11.0,
respuesta con evidencia autorizada y SHA-256, decisión con fuente, invitación
externa, reinicio, respaldo y restauración en volúmenes nuevos. La instalación
guiada comprueba además administrador, ajustes, logo y persistencia tras reinicio.

Ejecución terminada de main `7aaa10c71cdbacc4cb06f8a4b45face93f8c806a`:
[selfhosting](https://github.com/ruzer/Acta/actions/runs/44039798926/job/133891327239)
y [guided-install](https://github.com/ruzer/Acta/actions/runs/44039798926/job/133891327323).
El log identifica la imagen `ubuntu-26.04`, paquetes `amd64` instalados y bibliotecas
`x86_64-linux-gnu`; no se deduce solo de `runs-on`. Ambos jobs pasaron. El ciclo
de backup/restauración de selfhosting tardó 52 s, con ocho recuentos iguales y
ambos smoke aprobados. Se añade al inicio de ambos jobs una salida informativa de
`uname -m` y `docker version` para dejar explícito el entorno en futuras corridas;
no modifica nombres ni condiciones de los controles.

Esto usa datos ficticios y un runner de GitHub. No certifica hardware o
virtualización institucional concreta, rendimiento, capacidad mínima, alta
disponibilidad ni proveedores S3 distintos. ARM64 local y x86_64 en CI son
ensayos separados, no una certificación de todas las plataformas.

## Prueba de instalación limpia

En una copia descartable de los archivos de repositorio, sin node_modules ni .env real: copiar `.env.example`, utilizar nombre Compose y puerto independientes y ejecutar el comando normal. No montar DB/objetos/secretos de otras instalaciones. Comprobar que los volúmenes no existían y guardar el resultado.

La prueba `scripts/selfhost-smoke.mjs` se ejecuta dentro del backend con `SELFHOST_SMOKE_ALLOWED=true`, exige DB sin usuarios y crea datos ficticios mediante API: bootstrap, login, proyecto, tema, pregunta, asignación, envío, decisión validada por un miembro ANALYST y PDF privado. Verifica hash de descarga, rechazo anónimo/no asignado, alcance de proyecto y privilegios S3. Guarda estado de prueba privado en el volumen legacy para verificar respuesta, decisión y fuente, y archivo tras reinicio con `--verify`. No ejecutar contra producción ni contra la instancia habitual.

Ejemplo solo para un proyecto descartable ya levantado:

```sh
docker compose -p installation-test exec -T -e SELFHOST_SMOKE_ALLOWED=true backend node scripts/selfhost-smoke.mjs
docker compose -p installation-test restart
docker compose -p installation-test up -d --wait
docker compose -p installation-test exec -T -e SELFHOST_SMOKE_ALLOWED=true backend node scripts/selfhost-smoke.mjs --verify
```

Usar --env-file/directorio y puertos del entorno de prueba consistente en todos los comandos. Consultar los resultados realmente ejecutados en [el manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md); este procedimiento por sí solo no demuestra PASS.

## Gate reproducible de storage — instalación desechable exclusivamente

**Nunca ejecutar este gate contra el bucket de una instalación real.** Reutiliza las pruebas API de evidencia y adelanta el reloj de reconciliación; la base de pruebas es temporal, pero comparte el bucket dedicado del gate. La configuración de este comando concede credenciales de propietario DB únicamente al contenedor efímero de pruebas, no al servicio API.

```sh
# Directorio de copia de pruebas, con .env basado en .env.example y puerto libre.
export COMPOSE_PROJECT_NAME=readiness-test
docker compose up --build -d --wait
docker compose run --rm --no-deps   -v "$PWD/tests:/app/tests:ro"   -v readiness-test_db-secrets:/run/db-secrets:ro   -e SELFHOST_STORAGE_TEST_ALLOWED=true   backend node scripts/test-storage-container.mjs
# La base principal sigue vacía; bootstrap + recorrido ficticio explícito.
docker compose exec -T -e SELFHOST_SMOKE_ALLOWED=true backend node scripts/selfhost-smoke.mjs
docker compose restart
docker compose up -d --wait
docker compose exec -T -e SELFHOST_SMOKE_ALLOWED=true backend node scripts/selfhost-smoke.mjs --verify
# Solo al terminar y después de verificar que sigue siendo el proyecto de prueba:
docker compose down --volumes
```

El smoke guarda credenciales aleatorias de su fixture en el volumen evidence, con permiso 0600, únicamente para comprobar reinicio/restauración. No usar ese archivo como mecanismo de bootstrap productivo ni copiarlo a Git. La instalación normal usa `bootstrap-admin.mjs` y no crea ese fixture.

## Ida y vuelta de backup en selfhosting

Después de comprobar restart, el CI usa `scripts/backup.sh` sobre `readiness-ci`,
`verify-backup.sh` sin Docker y `restore.sh` en `readiness-ci-restore`, con volúmenes
nuevos y etiquetas comprobadas. Reutiliza la caché de build, detiene el origen para
liberar su puerto y ejecuta ambos smoke con `--verify` en el destino. El estado
privado del fixture viaja en `evidence`; no se suben backups como artifacts. La
limpieza `always()` se limita a esos dos nombres explícitos. Los nombres de los
checks requeridos no cambian.

El paso registra su duración y avisa si supera 10 minutos: requiere revisión,
no omisión de comprobaciones. El ensayo local ARM64 pasó; también pasó en Linux x86_64 en
la ejecución remota citada abajo, con instalación limpia y restauración real. Para una
instalación arbitraria usa hashes/recuentos y las comprobaciones funcionales de
[Backup y restauración](BACKUP-RESTORE.md#scripts-para-operadores); los fixtures
siguen siendo exclusivos de instalaciones desechables.

[Suite S3 y límites](S3-PROVIDERS.md) · [Backup y restauración](BACKUP-RESTORE.md).
