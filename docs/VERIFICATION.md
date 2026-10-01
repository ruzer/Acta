# Verificación en instalaciones descartables

Esta guía es para desarrollar o verificar el despliegue, no para administrar una instalación con datos reales. Los resultados fechados permanecen en el [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md).

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


[Suite S3 y límites](S3-PROVIDERS.md) · [Backup y restauración](BACKUP-RESTORE.md).
