# Seguridad de Acta

## Error normal o vulnerabilidad

Un bug sin impacto de seguridad corresponde a [Issues](https://github.com/ruzer/Acta/issues). Una vulnerabilidad puede exponer datos, permitir acceso indebido o afectar integridad/disponibilidad. **No reportes vulnerabilidades mediante Issues o PR públicos.** No publiques credenciales, datos personales, evidencia real ni reproducciones sensibles.

## Reporte privado

**GitHub Private Vulnerability Reporting está habilitado**, verificado mediante la API de GitHub el 2026-10-01. Usa [Report a vulnerability](https://github.com/ruzer/Acta/security/advisories/new), en Security del repositorio. GitHub requiere iniciar sesión. No uses Issues o PR públicos para vulnerabilidades.

Incluye versión, impacto y reproducción mínima con datos ficticios. Se coordinará evaluación, corrección y divulgación para evitar exposición innecesaria; no se promete tiempo de respuesta o resolución. No envíes credenciales, evidencia real ni datos sensibles innecesarios. Si no puedes acceder al formulario privado, conserva el reporte privadamente; un issue público no es una alternativa.

La verificación confirma que la función está habilitada; no se ha enviado un reporte ficticio ni probado un plazo de atención. [Configuración oficial](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Versiones y responsabilidad

No hay releases públicas ni una matriz de versiones con mantenimiento garantizado. La política inicial será best effort y deberá actualizarse al publicar la primera versión. [Soporte](SUPPORT.md) y [proceso de release](docs/RELEASING.md). Los scans o pruebas funcionales no sustituyen actualizaciones, supervisión ni backups.

En futuras contribuciones, las correcciones de seguridad se preparan por el canal privado apropiado antes de abrir un PR público. DCO o aprobación de PR no resuelven un incidente de exposición de secretos. [Preparación de GitHub](docs/GITHUB-SETUP.md).

## Operación segura

Usa HTTPS, origen exacto y cookies Secure fuera del entorno local. La API autoriza accesos por sesión, organización, proyecto y asignación; las descargas privadas verifican permisos e integridad. PostgreSQL y object storage no deben exponerse directamente a Internet.

VersityGW es el default. MinIO es continuidad legacy con riesgos documentados, no una recomendación para nuevas instalaciones. [Self-hosting](docs/SELF-HOSTING.md) · [Configuración](docs/CONFIGURATION.md) · [Backup](docs/BACKUP-RESTORE.md) · [Licencia](LICENSE).
