# Preparación de GitHub para Acta

**Configuración de publicación en curso.** Upstream oficial: [github.com/ruzer/Acta](https://github.com/ruzer/Acta). La inspección inicial confirmó repositorio privado vacío y permisos administrativos; [gate remoto](../REMOTE-PUBLICATION-PLAN.md). Los checks sin marcar no se presentan como activos.

## Antes de cambiar visibilidad o recibir contribuciones

- [x] Titularidad y autorización confirmadas por Cristóbal Ruz Escobar; AGPL-3.0-only adoptada y LICENSE oficial agregado. Avisos de terceros conservados.
- [x] Initial maintainer y responsable de moderación: Cristóbal Ruz Escobar.
- [ ] Verificar permisos efectivos sobre el repositorio y el canal privado de moderación.
- [x] [DCO 1.1 + Signed-off-by](CONTRIBUTION-ORIGIN.md) adoptado; sin CLA inicialmente. No se instala ningún bot.
- [ ] Revisar el snapshot exacto a distribuir, secretos y datos, sin copiar historia privada.
- [ ] Confirmar visibilidad pública apropiada y rama por defecto `main` únicamente en la fase autorizada.
- [ ] Habilitar y probar reporte privado de vulnerabilidades y moderación antes de abrir colaboración; reemplazar placeholders con canales reales.

## Comunidad y mantenimiento

- [ ] Habilitar Issues; comprobar las plantillas Bug report, Feature request y Documentation issue en la rama por defecto. No necesitan labels o assignees preexistentes.
- [ ] Habilitar Discussions si está disponible: preguntas, ideas amplias y arquitectura. Issues conserva bugs y trabajo concreto. No anunciar Discussions antes de verificarla.
- [ ] Preferir GitHub Private Vulnerability Reporting si lo permite la configuración/plan; si no, acordar y probar un contacto privado equivalente. No usar Issues para recibir vulnerabilidades.
- [ ] Confirmar SECURITY, SUPPORT, CONTRIBUTING, GOVERNANCE y código de conducta desde la vista de una persona externa.
- [ ] Activar/revisar Dependabot, alertas de dependencias y los avisos de terceros. El archivo actual cubre npm, Actions y Docker de frontend/backend/legacy; revisar en una tarea de configuración la cobertura de imágenes del default en `docker/versity`. No se cambia ahora el archivo ni el provider.
- [ ] Verificar disponibilidad y activar secret scanning y push protection. No sustituye a Gitleaks ni resuelve secretos ya publicados; una alerta real exige respuesta y rotación según el caso.
- [ ] Evaluar CODEOWNERS solo después de designar responsables reales. No crear nombres ficticios ni requerir aprobaciones de equipos inexistentes.

[Reporte privado: documentación oficial](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository). Es una capacidad que debe habilitarse, no un estado comprobado de Acta.

## CI y checks requeridos

Inspección del workflow [CI](../.github/workflows/ci.yml). Está preparado para `push`, `pull_request` y ejecución manual, con permiso global `contents: read`. **No se ejecutó en GitHub en esta fase.**

| Job existente | Incluye | Política inicial propuesta |
|---|---|---|
| `verify` | Install; Prisma generate/validate; lint; typecheck; unit/component; integración PostgreSQL; build frontend/backend; npm audit high; build contenedores; revisión de vulnerabilidades del binario storage | Required en PR |
| `secrets` | Gitleaks sobre toda la historia con redacción y excepciones exactas | Required en PR |
| `selfhosting` | Instalación Docker aislada, S3 real, bootstrap/evidencia autorizada y persistencia tras reinicio | Required en PR, aunque sea más pesado |

Lint, typecheck, unit/component, integración y build son pasos de `verify`, **no checks independientes actuales**. Tras la primera ejecución real, seleccionar los contextos de checks que GitHub emita para esos tres jobs; no inventar nombres de checks ni proteger la rama con contextos que nunca se emiten. Una división futura necesitaría mantener cobertura y aprobación explícita, no saltarse trabajo costoso.

Playwright completo, axe de navegador, validación visual y restauración destructiva de TEST no están programados en este workflow. Para cambios funcionales que los afecten y antes de release, el maintainer debe revisar evidencia de esas suites según [CONTRIBUTING](../CONTRIBUTING.md#verificación-esperada) y [RELEASING](RELEASING.md). No confundir el smoke API con E2E de navegador o con backup/restore.

Las pruebas costosas son integración PostgreSQL/S3, instalación Docker, navegador y restauración. Usar infraestructura efímera y revisar coste; no relajar assertions, introducir skips o retries para hacer verde un PR. La restauración nunca apunta a datos productivos. Los errores en scanning necesitan triage, no un bypass silencioso.

## Protección de main y PR de forks

- [ ] Exigir PR, resolución de conversaciones y los tres checks reales sobre cambios actuales. Bloquear force pushes y eliminación accidental de `main`.
- [ ] Mantener ramas cortas; no añadir `develop`, GitFlow ni merge queue sin necesidad/configuración adicional.
- [ ] Activar revisión independiente cuando exista otra persona elegible. Un maintainer solo no puede aprobar su propio PR: documentar esa limitación, conservar self-review y CI, y no configurar una aprobación imposible ni automatizar su simulación. Cambios sensibles pueden esperar a un reviewer autorizado.
- [ ] Confirmar cómo invalidar aprobaciones cuando cambie el PR y quién puede realizar excepciones; cualquier excepción debe ser justificada y visible, sin borrar controles de seguridad.
- [ ] Revisar PR de forks sin secretos de producción ni runners propios con acceso a infraestructura interna. Mantener permisos mínimos; no cambiar a `pull_request_target` para ejecutar código no confiable con privilegios.
- [ ] Probar el comportamiento con un PR inocuo cuando esté autorizada la configuración. No asumir que un YAML local equivale a protección activa.

[Protección de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) y [precauciones con pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target). Su disponibilidad y nombres efectivos deben comprobarse durante publicación.

## Releases, packages y badges

- [ ] Confirmar la versión inicial recomendada y la checklist de [RELEASING](RELEASING.md); no crear tags o releases por el solo hecho de completar este documento.
- [ ] GitHub Releases: notas, assets autorizados y commit verificado. Packages/GHCR u otros registros: decisión posterior; no hay publicación automática habilitada aquí.
- [ ] Agregar badges únicamente cuando sus destinos existan y estén comprobados: CI real, licencia aplicada y última release. No colocar un badge AGPL antes de adoptar LICENSE.
- [ ] Revisar enlaces y quitar **PENDING UNTIL PUBLICATION** únicamente de canales realmente habilitados.

No se inicializa Git, crea remote, usa API/CLI de GitHub ni publica imágenes al preparar este plan.
