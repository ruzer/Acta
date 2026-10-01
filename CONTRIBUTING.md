# Contribuir a Acta

Acta se distribuye bajo [AGPL-3.0-only](LICENSE). Se adopta [DCO 1.1](DCO) + Signed-off-by para contribuciones; no hay CLA inicialmente. Los canales remotos se indican como pendientes hasta verificar su habilitación.

## Cómo contribuir

### Encontré un bug

Cuando se habiliten los canales, busca un reporte existente y utiliza la plantilla **Bug report**. Incluye versión, entorno, pasos mínimos con datos ficticios, comportamiento esperado y observado. Adjunta logs o capturas únicamente después de revisar privacidad. Si el problema puede exponer datos, evadir permisos o comprometer seguridad, no abras un issue público: sigue [SECURITY](SECURITY.md).

### Tengo una idea

Utiliza Discussions para preguntas amplias, arquitectura o propuestas todavía abiertas. Un issue sirve para trabajo concreto y features suficientemente definidas. Explica quién tiene el problema, un ejemplo genérico y el resultado esperado antes de proponer la solución. Las propuestas no equivalen a features aceptadas.

### Quiero mejorar documentación

Puedes proponer un PR pequeño para una errata o instrucción incorrecta sin abrir una discusión previa. Para reorganizaciones mayores, acuerda el alcance primero. Comprueba enlaces, ejemplos y consistencia con el código. No presentes un procedimiento como probado si solo fue diseñado. Mantén el español editorial; nombres de API y licencias conservan su idioma original.

### Quiero contribuir código

Recorrido normal: **Issue / Discussion → rama → implementación → tests → Pull Request → review → merge**. El merge depende de la revisión, no está garantizado.

1. Consulta alcance y decisiones en el issue o Discussion correspondiente. Un fix pequeño y evidente puede empezar directamente con un PR que explique el problema.
2. Prepara [Desarrollo](docs/DEVELOPMENT.md), haz fork y crea una rama descriptiva desde el upstream actualizado. Usa `main` más ramas cortas; evita mezclar personalizaciones de una organización con una mejora genérica.
3. Implementa un cambio acotado. Conserva autorización en backend, aislamiento, concurrencia, externalId y versiones enviadas inmutables. No edites migraciones aplicadas.
4. Añade pruebas de comportamiento relevantes y ejecuta la verificación aplicable de abajo.
5. Abre el PR hacia `main` de Acta usando [la plantilla](.github/pull_request_template.md). Explica qué cambia, por qué, resultados reales, riesgos y documentación. Incluye capturas ficticias si cambia UI.
6. Atiende comentarios, vuelve a verificar los cambios y espera la decisión del maintainer. La revisión puede pedir reducir alcance o recomendar mantener el cambio en el fork.

### Quiero devolver una mejora desde un fork institucional

Identifica la parte reutilizable y extrae una rama limpia desde upstream. Elimina dependencias de sistemas privados, credenciales, nombres reales y reglas exclusivas. Conserva autoría y avisos de terceros. Confirma con tu organización que tienes autorización para aportar ese código; tener acceso al repositorio no demuestra titularidad.

Explica el problema con un ejemplo ficticio, evita traer todo el historial del fork y prueba el cambio sin servicios privados. Si no se puede separar con seguridad, discute primero una alternativa genérica. [Guía de forks y sincronización](docs/UPSTREAM-FORKS.md).

## Canales previstos

Todos los destinos siguientes son **PENDING UNTIL PUBLICATION**, sin acceso ni habilitación remota verificados:

- [Upstream previsto](https://github.com/ruzer/Acta).
- [Issues previstos](https://github.com/ruzer/Acta/issues): bugs y trabajo concreto.
- [Discussions previstas](https://github.com/ruzer/Acta/discussions): ideas, dudas y propuestas amplias. Si no se habilitan, el maintainer indicará cómo convertir propuestas concretas en issues.
- Contacto privado de seguridad: **PENDING BEFORE PUBLICATION**, véase [SECURITY](SECURITY.md).
- Contacto privado de moderación: **PENDING BEFORE PUBLICATION**, véase [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md).

No envíes información sensible a placeholders ni a issues públicos. [Soporte](SUPPORT.md) explica límites y responsabilidades.

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| `app/frontend` | React/Vite y componentes |
| `app/backend` | NestJS, Prisma, migraciones y casos de uso |
| `packages/contracts` | Esquemas y tipos compartidos |
| `tests` | Unit/component, PostgreSQL, navegador y S3 |
| `scripts`, `docker` | Instalación, bootstrap y operación |
| `docs` | Guías, arquitectura, dominio y contratos |
| `.github` | CI y plantillas preparadas |

## Verificación esperada

Los comandos y variables están en [Desarrollo](docs/DEVELOPMENT.md). Para cambios funcionales: lint, typecheck, Prisma validate, unit/component, integración PostgreSQL y build. Añade E2E del flujo y conserva la suite completa sin ocultar fallos con skips o retries. El CI actual y los checks a requerir están detallados en [GitHub setup](docs/GITHUB-SETUP.md#ci-y-checks-requeridos).

UI requiere teclado, foco, contraste y responsive. Cambios de storage/bootstrap requieren S3 real, instalación y persistencia en entornos descartables. No uses DB, buckets ni datos productivos. Un PR exclusivamente documental comprueba enlaces, Markdown, residuos y secretos; no necesita ejecutar pruebas destructivas localmente, aunque el CI general actual siga ejecutándose.

## Procedencia, licencia y privacidad

Las contribuciones aceptadas se distribuyen bajo la licencia vigente del proyecto, **AGPL-3.0-only**. Quien contribuye debe tener derecho a aportar el trabajo bajo esos términos y certificarlo mediante DCO. No se presume una cesión de copyright al maintainer ni autorización para firmar por otras personas.

Se requiere **DCO 1.1 + Signed-off-by**. Lee el [texto oficial íntegro](DCO) y usa `git commit -s` con tu identidad configurada. Git agrega `Signed-off-by: Name <email>` al mensaje: certificas procedencia y derecho a contribuir; no es firma criptográfica, transferencia automática de copyright ni CLA. No firmes por terceros. Nombre y correo quedan en el historial público; utiliza una identidad válida que hayas decidido hacer pública. La revisión es manual: no se ha instalado un bot. [Política y ejemplos](docs/CONTRIBUTION-ORIGIN.md).

Declara procedencia, licencia y avisos de código, iconos, fuentes o assets incorporados. Usa fixtures ficticios; no subas secretos, `.env`, evidencia real, datos personales, rutas locales ni artifacts temporales. Mantén las excepciones exactas preexistentes de [.gitleaks.toml](.gitleaks.toml); no amplíes exclusiones para aceptar secretos reales.

[Gobernanza](GOVERNANCE.md) · [Código de conducta](CODE_OF_CONDUCT.md) · [Roadmap](ROADMAP.md).
