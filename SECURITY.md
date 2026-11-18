# Seguridad de Acta

## Error normal o vulnerabilidad

Un bug sin impacto de seguridad corresponde a [Issues](https://github.com/ruzer/Acta/issues). Una vulnerabilidad puede exponer datos, permitir acceso indebido o afectar integridad/disponibilidad. **No reportes vulnerabilidades mediante Issues o PR públicos.** No publiques credenciales, datos personales, evidencia real ni reproducciones sensibles.

## Reporte privado

**GitHub Private Vulnerability Reporting es el canal preferido.** Su habilitación se comprobó mediante la API de GitHub el 2026-11-17. Usa [Report a vulnerability](https://github.com/ruzer/Acta/security/advisories/new), en Security del repositorio. GitHub requiere iniciar sesión. No uses Issues o PR públicos para vulnerabilidades.

Incluye versión, impacto y reproducción mínima con datos ficticios. Se coordinará evaluación, corrección y divulgación para evitar exposición innecesaria; no se promete tiempo de respuesta o resolución. No envíes credenciales, evidencia real ni datos sensibles innecesarios. Si no puedes acceder al formulario privado, conserva el reporte privadamente; un issue público no es una alternativa.

La verificación citada corresponde a esa fecha; no demuestra disponibilidad continua ni un plazo de atención. Si la siguiente inspección encuentra la función deshabilitada, su activación o un canal privado equivalente será requisito antes de recibir reportes. No se ha enviado un reporte ficticio. [Configuración oficial](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Versiones y responsabilidad

La política vigente es de atención best effort a la última versión publicada en las [Releases oficiales](https://github.com/ruzer/Acta/releases), sin plazos garantizados de respuesta o corrección ni ramas LTS. Quien use una versión anterior debe planear su actualización siguiendo las notas y conservar un respaldo recuperable. [Soporte](SUPPORT.md) y [proceso de release](docs/RELEASING.md). Los scans o pruebas funcionales no sustituyen actualizaciones, supervisión ni backups.

En futuras contribuciones, las correcciones de seguridad se preparan por el canal privado apropiado antes de abrir un PR público. DCO o aprobación de PR no resuelven un incidente de exposición de secretos. [Preparación de GitHub](docs/GITHUB-SETUP.md).

## Control de dependencias y excepción temporal

CI exige `npm audit --audit-level=high` sobre todas las dependencias, de
producción y de desarrollo. No hay excepciones vigentes: un aviso alto o crítico
bloquea la verificación.

Si aparece un aviso alto o crítico sin parche publicado, el propietario debe
decidir en un PR explícito, con motivo y fecha de caducidad. No reducir el umbral,
excluir todo desarrollo ni usar `audit fix --force`.

## Operación segura

Usa HTTPS, origen exacto y cookies Secure fuera del entorno local. La API autoriza accesos por sesión, organización, proyecto y asignación; las descargas privadas verifican permisos e integridad. PostgreSQL y object storage no deben exponerse directamente a Internet.

VersityGW es el default. MinIO es continuidad legacy con riesgos documentados, no una recomendación para nuevas instalaciones. [Self-hosting](docs/SELF-HOSTING.md) · [Configuración](docs/CONFIGURATION.md) · [Backup](docs/BACKUP-RESTORE.md) · [Licencia](LICENSE).
