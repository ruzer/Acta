# Versionado y releases de Acta

**Proceso para preparar y publicar releases.** La primera release pública es [v0.2.0](https://github.com/ruzer/Acta/releases/tag/v0.2.0). Titularidad, autorización, AGPL-3.0-only y DCO 1.1 están confirmados. La publicación del código exige superar el gate remoto; la release formal requiere además CI, configuración y revisión. El [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md) demuestra pruebas del snapshot, no autorización legal ni una release.

## Política de versiones

Se prepara [Semantic Versioning](https://semver.org/lang/es/) en formato **MAJOR.MINOR.PATCH**:

| Incremento | Intención |
|---|---|
| PATCH | Correcciones compatibles de bugs o seguridad |
| MINOR | Funcionalidad compatible y deprecaciones anunciadas |
| MAJOR | Cambios incompatibles del contrato público |

El contrato público incluye API documentada, configuración, formatos de intercambio y requisitos de actualización/persistencia. No basta con que TypeScript compile para afirmar compatibilidad. Antes de 1.0 no se promete estabilidad absoluta; los cambios incompatibles deben anunciarse, agruparse en un incremento MINOR de `0.x` y acompañarse de instrucciones de migración. PATCH seguirá reservado para cambios compatibles. Una corrección de seguridad que rompa compatibilidad debe decirlo y usar la versión apropiada.

### Preparación de 0.6.1 — Grupos y publicación conjunta

La base es [v0.6.0](https://github.com/ruzer/Acta/releases/tag/v0.6.0).
**0.6.1** reúne las correcciones compatibles de los PR
[#29](https://github.com/ruzer/Acta/pull/29) y
[#30](https://github.com/ruzer/Acta/pull/30): controles globales de grupos y
actualización del cuestionario antes de la vista previa de operaciones masivas.
No cambia contratos, backend, permisos, configuración ni migraciones.

Los manifiestos, las referencias entre paquetes y el lockfile se preparan en
0.6.1, sin actualizar dependencias externas. Las
[notas de la versión](releases/v0.6.1.md) incluyen la evidencia del CI de la base.
El PR de preparación requiere CI verde y merge manual del maintainer. Después
se debe verificar el CI del `main` resultante antes de crear un tag anotado
`v0.6.1` sobre ese commit exacto y publicar la GitHub Release como Latest.
Verificar también el CI del tag. La preparación y la fecha del changelog no
constituyen por sí solas una publicación; no se publican imágenes Docker ni se
actualizan downstreams en este proceso.

### Preparación de 0.6.0 — Dirección C

La base anterior es [v0.5.0](https://github.com/ruzer/Acta/releases/tag/v0.5.0). **0.6.0** corresponde a una evolución compatible y sustancial de la presentación del frontend (Dirección C: jerarquía, navegación, cuestionario, aportaciones, conflictos, aclaraciones, decisiones, participantes e invitaciones) y a la actualización de seguridad de VersityGW, compilado desde su fuente oficial. Un patch `0.5.x` no describe ese alcance. No se documenta un cambio incompatible de API, configuración o formatos de intercambio.

SemVer trata `0.y.z` como desarrollo inicial. La política de Acta adopta MINOR para evolución compatible sustancial y PATCH para correcciones compatibles, sin prometer estabilidad absoluta antes de 1.0. Esta versión conserva backend, dominio, contratos, permisos, reglas de publicación y almacenamiento; no añade migraciones. Las únicas modificaciones fuera del frontend y la documentación son las de la compilación de VersityGW (`docker/versity/` y la etapa equivalente del `Dockerfile` del backend).

Raíz, frontend, backend, contracts, referencias internas y lockfile se preparan coherentemente en 0.6.0 mediante PR que solo modifica versiones, changelog y documentación de release. La preparación no equivale a publicación: verificar CI del commit final antes de crear el tag y la GitHub Release. Las releases publicadas son inmutables; no mover ni reemplazar tags. Las [notas de la versión](releases/v0.6.0.md) resumen el alcance para administradores y usuarios técnicos.

Se conservan los límites del contrato: el acceso del invitado no expone su destinatario previsto y la revisión no entrega un origen estructurado independiente del actor. La UI no inventa esos datos ni acredita identidad a partir del enlace. El [informe de la Dirección C](design/ACTA-DIRECTION-C-IMPLEMENTATION.md) registra alcance, pruebas y límites; el [changelog](../CHANGELOG.md) resume los cambios para usuarios.

Los forks permanecen en su base estable actual durante esta preparación. Después de publicar v0.6.0 deben verificar su tag y commit, probar la actualización en una rama propia y hacer backup antes de desplegar. No actualizar instalaciones directamente desde `main`. Seguir [invitaciones](EXTERNAL-INVITATIONS.md), [configuración](CONFIGURATION.md) y [backup/restauración](BACKUP-RESTORE.md).

## Preparar, verificar y autorizar

1. Conservar LICENSE, DCO y avisos; cerrar el [checklist GitHub](GITHUB-SETUP.md). Responsable inicial de release: Cristóbal Ruz Escobar, como maintainer designado.
2. Cerrar el alcance desde `main`, revisar PR y cambios de seguridad, datos, permisos, compatibilidad y dependencias. No trasladar historia privada al changelog.
3. Ejecutar lint, typecheck, Prisma validate, unit/component, integración PostgreSQL, build y scans. Ejecutar Playwright completo sin skips nuevos ni retries que oculten fallos. Registrar commit exacto, entorno y resultados reales.
4. Para la primera release y cambios de instalación/storage: validar Docker desde cero, S3 real, evidencia autorizada, persistencia y backup/restore en recursos descartables. Nunca utilizar volúmenes productivos. [Verificación](VERIFICATION.md).
5. Revisar guías, traducciones de documentación aplicables, capturas y notices; documentar plataformas/provider realmente ensayados. Actualizar el manifiesto sin reutilizar un PASS anterior como si fuera actual.
6. Elegir versión y actualizar coherentemente los manifiestos/lockfile afectados mediante PR. Pasar las entradas relevantes de `Unreleased` a una sección versionada y fechada en [CHANGELOG](../CHANGELOG.md); dejar nuevo `Unreleased`. Repetir verificaciones afectadas por esos cambios.
7. Tras review/merge y autorización explícita, crear el tag de esa versión sobre el commit verificado y preparar GitHub Release con cambios, actualización, riesgos, plataformas y assets aprobados. Es un paso futuro: no se proporcionan automatismos de publicación aquí.
8. Si posteriormente existen imágenes públicas aprobadas, construirlas desde ese mismo commit, revisar licencias/scans, identificar versiones/digests y registrar procedencia. Hoy no hay publicación a registros ni garantía multiarch. No añadir paquetes o contenedores a una release solo porque se pudieron compilar.
9. Probar los archivos efectivamente distribuidos y enlazar soporte y reporte privado. Si aparece un defecto, documentarlo y preparar corrección; no sobrescribir silenciosamente la release. Volver atrás en código no revierte migraciones: seguir la restauración coordinada.

Un scan con hallazgos relevantes necesita evaluación y resolución; no se desactiva para publicar. No hay calendario, SLA, LTS ni soporte indefinido de versiones. Cualquier política futura de ramas mantenidas deberá publicarse explícitamente. [SUPPORT](../SUPPORT.md) · [SECURITY](../SECURITY.md).
