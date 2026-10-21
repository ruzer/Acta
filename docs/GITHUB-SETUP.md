# Preparación de GitHub para Acta

**Publicación inicial realizada; configuración verificada el 2026-10-01.** Upstream oficial: [github.com/ruzer/Acta](https://github.com/ruzer/Acta). La inspección inicial confirmó repositorio privado vacío y permisos administrativos; [gate remoto](../REMOTE-PUBLICATION-PLAN.md). Los checks sin marcar no se presentan como activos.

## Alcance del registro

Las casillas marcadas y el estado remoto descrito conservan evidencia de la verificación del 2026-10-01. El cierre local del 2026-10-02 no consulta ni modifica GitHub. Antes de publicar nuevos commits, comprobar de nuevo repositorio, canales, CI y protección de main; no tomar este registro histórico como confirmación del estado actual. Titularidad, licencia, maintainer y DCO ya están resueltos y no requieren nueva decisión. El canal privado de moderación sigue pendiente.

## Antes de cambiar visibilidad o recibir contribuciones

- [x] Titularidad y autorización confirmadas por Cristóbal Ruz Escobar; AGPL-3.0-only adoptada y LICENSE oficial agregado. Avisos de terceros conservados.
- [x] Initial maintainer y responsable de moderación: Cristóbal Ruz Escobar.
- [x] Permisos administrativos verificados.
- [ ] Designar y verificar canal privado de moderación; no confundirlo con reporte de vulnerabilidades.
- [x] [DCO 1.1 + Signed-off-by](CONTRIBUTION-ORIGIN.md) adoptado; sin CLA inicialmente. No se instala ningún bot.
- [x] Revisar el snapshot exacto a distribuir, secretos y datos, sin copiar historia privada.
- [x] Confirmar visibilidad pública apropiada y rama por defecto `main` únicamente en la fase autorizada.
- [x] Reporte privado de vulnerabilidades habilitado y comprobado por API. No se envió un reporte ficticio.

## Comunidad y mantenimiento

- [x] Habilitar Issues; comprobar las plantillas Bug report, Feature request y Documentation issue en la rama por defecto. No necesitan labels o assignees preexistentes.
- [x] Habilitar Discussions si está disponible: preguntas, ideas amplias y arquitectura. Issues conserva bugs y trabajo concreto. No anunciar Discussions antes de verificarla.
- [x] Preferir GitHub Private Vulnerability Reporting si lo permite la configuración/plan; si no, acordar y probar un contacto privado equivalente. No usar Issues para recibir vulnerabilidades.
- [x] Confirmar SECURITY, SUPPORT, CONTRIBUTING, GOVERNANCE y código de conducta desde la vista de una persona externa.
- [x] Dependabot alerts/security updates habilitados; avisos de terceros conservados. El archivo actual cubre npm, Actions y Docker de frontend/backend/legacy; revisar en una tarea de configuración la cobertura de imágenes del default en `docker/versity`. No se cambia ahora el archivo ni el provider.
- [x] Verificar disponibilidad y activar secret scanning y push protection. No sustituye a Gitleaks ni resuelve secretos ya publicados; una alerta real exige respuesta y rotación según el caso.
- [ ] Evaluar CODEOWNERS solo después de designar responsables reales. No crear nombres ficticios ni requerir aprobaciones de equipos inexistentes.

[Reporte privado: documentación oficial](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository). Habilitado y comprobado mediante API; no se envió un reporte ficticio.

## CI y checks requeridos

Inspección del workflow [CI](../.github/workflows/ci.yml). Está preparado para `push`, `pull_request` y ejecución manual, con permiso global `contents: read`. La primera ejecución real está en [Actions](https://github.com/ruzer/Acta/actions/runs/36908495209). Se observaron los checks `verify`, `secrets` y `selfhosting`; consultar su resultado antes de declarar CI aprobado.

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

- [x] Versión inicial prevista 0.2.0 confirmada. La checklist de [RELEASING](RELEASING.md) sigue siendo requisito antes de crear una release.
- [ ] GitHub Releases: notas, assets autorizados y commit verificado. Packages/GHCR u otros registros: decisión posterior; no hay publicación automática habilitada aquí.
- [ ] Agregar badges únicamente cuando sus destinos existan y estén comprobados: CI real, licencia aplicada y última release. No colocar un badge AGPL antes de adoptar LICENSE.
- [x] Revisar enlaces y quitar **PENDING UNTIL PUBLICATION** únicamente de canales realmente habilitados.

La release [v0.2.0](https://github.com/ruzer/Acta/releases/tag/v0.2.0) se publicó el 2026-10-02. La preparación de v0.3.0 no crea tag, release ni imágenes; su publicación posterior sigue sujeta al proceso de [RELEASING](RELEASING.md).

## Estado remoto comprobado

- Repositorio público, `main`, historia pública nueva; remoto inicialmente vacío.
- Issues y Discussions habilitados; plantillas incluidas en `main`.
- Private Vulnerability Reporting habilitado. Canal de moderación separado aún pendiente.
- Dependabot alerts y security updates habilitados. Secret scanning y push protection habilitados. DCO manual, sin app ni CLA.
- Protección comprobada el 2026-10-06: PR obligatorio, checks reales `verify`, `secrets`, `selfhosting`, rama actualizada y conversaciones resueltas; sin force push ni eliminación. La consulta de GitHub confirmó estas reglas activas, incluido enforce_admins.
- Maintainer único: cero aprobaciones ajenas obligatorias inicialmente, porque no puede aprobar su propio PR. Se mantiene PR, self-review y CI; no se habilita bypass administrativo. Activar revisión independiente cuando exista otra persona elegible.
- La configuración Dependabot heredada todavía no cubre el Dockerfile default `docker/versity`; revisar esa cobertura en una tarea posterior sin cambiar storage. El CI sí contiene su build y gate de vulnerabilidades.
