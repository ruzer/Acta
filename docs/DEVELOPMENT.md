# Desarrollo local

Esta guía prepara una instalación de desarrollo ficticia, separada de cualquier despliegue real. Para evaluar sin instalar Node, usa [la demo Docker](../README.md#quiero-probarlo-con-datos-ficticios). Las contribuciones usan AGPL-3.0-only y DCO 1.1; verifica los canales disponibles en CONTRIBUTING.

## Requisitos

- Node **24.21.0**, fijado en [.nvmrc](../.nvmrc), y npm.
- Docker y Compose 2.24.4+ para PostgreSQL de desarrollo.
- Terminal POSIX, puertos 4317 (Vite), 3000 (API) y 55439 (PostgreSQL) libres.
- Acceso a registros públicos durante la instalación. No hay dependencias runtime obligatorias de fuentes/CDN.

Usa un directorio de trabajo sin `.env` previo. No copies credenciales de producción. Los comandos siguientes se ejecutan desde la raíz del proyecto.

## Dependencias y entorno

```sh
npm ci
npm run setup:demo
```

`setup:demo` crea `.env` privado con contraseñas aleatorias, DATABASE_URL para `requirements_app`, MIGRATION_DATABASE_URL para `requirements_owner`, DEMO_PASSWORD, organización DEFAULT y origen local. Se niega a sobrescribir un archivo existente. No uses su opción `--stdout` en logs compartidos. El generador es una comodidad exclusiva de desarrollo; no reemplaza el bootstrap de una instalación vacía.

Antes de continuar, comprueba estos valores en tu `.env` privado:

| Variable | Uso local |
|---|---|
| DATABASE_URL | Rol limitado de aplicación, PostgreSQL en `127.0.0.1:55439` |
| MIGRATION_DATABASE_URL | Rol propietario para migraciones y bases efímeras de test |
| APP_ORIGIN | `http://localhost:4317` |
| COOKIE_SECURE / NODE_ENV | `false` / `development`, solo local |
| DEMO_SEED / DEMO_PASSWORD | `true` y contraseña temporal privada generada |
| STORAGE_PROVIDER | Añade `LOCAL` explícitamente para este recorrido |
| EVIDENCE_ROOT | Añade `./.private-evidence`, excluido de distribución |

Mantén el puerto DB de las URLs coherente con DB_PORT. Cambiar un puerto exige actualizar todas sus referencias. Las variables ya exportadas en la terminal pueden prevalecer sobre el archivo; evita mezclar sesiones de otros entornos.

## PostgreSQL y migraciones

```sh
export COMPOSE_PROJECT_NAME=requirements-development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait postgres
npm run prisma:generate
node --env-file=.env scripts/migrate.mjs
npm run build
node --env-file=.env app/backend/dist/seed.js
```

El override expone PostgreSQL únicamente en loopback. La dependencia secrets-init prepara sus credenciales; no se arranca el stack completo. `migrate.mjs` utiliza MIGRATION_DATABASE_URL; las migraciones conceden al rol de aplicación sus permisos. No uses `prisma db push` ni edites migraciones aplicadas. El seed crea únicamente usuarios y cuestionario ficticios y exige cambiar las contraseñas iniciales.

## Arrancar frontend y backend

Después del build inicial, abre tres terminales desde la raíz:

```sh
# Terminal 1: recompilar backend al editar TypeScript (no inicia servidor)
npm run dev -w @requirements/backend
```

```sh
# Terminal 2: API; Node reinicia al cambiar el JavaScript compilado
node --env-file=.env --watch app/backend/dist/main.js
```

```sh
# Terminal 3: frontend; el puerto debe coincidir con APP_ORIGIN
npm run dev -w @requirements/frontend -- --port 4317 --strictPort
```

Interfaz: [localhost:4317](http://localhost:4317). API: [localhost:3000/api/v1/health](http://localhost:3000/api/v1/health). Vite reenvía `/api` al backend. Entra como `analyst` o `stakeholder` usando DEMO_PASSWORD y completa el cambio obligatorio. Para preparar usuarios/proyectos usa `admin`.

El proceso Node escucha en todas las interfaces según su configuración actual: este recorrido es para un equipo de desarrollo protegido por firewall, no un servidor expuesto. No publiques los puertos 3000/55439. Si cambias contratos compartidos, recompila `@requirements/contracts` y reinicia consumidores; no hay un watcher global de todos los workspaces.

## Evidencia y S3 durante desarrollo

LOCAL guarda archivos en EVIDENCE_ROOT y sirve para el recorrido anterior; no prueba S3. Para validar S3 usa una instalación Docker separada con VersityGW, bucket propio y credenciales de aplicación. No apuntes tests de reconciliación a evidencia real ni extraigas secretos de una instalación productiva.

El backend acepta S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY y S3_FORCE_PATH_STYLE. La suite y su entorno descartable están descritos en [Proveedores S3](S3-PROVIDERS.md). No se promete compatibilidad con proveedores no ensayados.

## Pruebas y build

```sh
npm run lint
npm run typecheck
npm run prisma:validate
npm test
# Carga explícita de variables para el proceso de integración y sus hijos:
node --env-file=.env --run test:integration
npm run build
```

Prisma carga `.env` según su configuración. Las integraciones crean bases efímeras con el rol propietario y usan un rol limitado para la API; necesitan permiso de crear bases. Conserva una DB de desarrollo descartable y no uses DATABASE_URL de producción.

Para navegador, levanta otra demo nueva con un puerto propio y prepara privadamente E2E_URL y DEMO_PASSWORD:

```sh
npx playwright install chromium
npm run test:e2e
```

Las pruebas modifican datos: necesitan una demo nueva para cada ejecución completa. No reutilices la instancia de capturas o datos personales. Para S3 consulta el runner dedicado, que necesita autorización explícita y bucket descartable.

## Estructura y resolución de problemas

- `app/frontend`: React/Vite; `app/backend`: NestJS/Prisma; `packages/contracts`: Zod y tipos compartidos.
- `tests/unit`, pruebas colocadas junto a componentes, `tests/integration`, `tests/e2e`, `tests/selfhosting`: niveles de comprobación.
- “Connection refused”: comprueba salud de PostgreSQL y puertos de DATABASE_URL.
- Error Origin/CSRF: comprueba APP_ORIGIN y que accedes exactamente por `localhost:4317`.
- Cliente Prisma ausente: ejecuta prisma:generate después de instalar dependencias.
- Cambios backend no visibles: el comando dev solo compila; necesita el proceso Node de la segunda terminal.
- No elimines volúmenes para resolver errores de credenciales: [Configuración](CONFIGURATION.md).

[Contratos](CONTRACTS.md) · [Arquitectura](ARCHITECTURE.md) · [Contribuir](../CONTRIBUTING.md).
