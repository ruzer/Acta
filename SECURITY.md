# Seguridad de Acta

## Error normal o vulnerabilidad

Un bug sin impacto de seguridad corresponde al futuro issue tracker: [Issues previstos](https://github.com/ruzer/Acta/issues) — **PENDING UNTIL PUBLICATION**, no habilitación verificada. Una vulnerabilidad puede exponer datos, permitir acceso indebido o afectar integridad/disponibilidad. **No reportes vulnerabilidades mediante Issues o PR públicos.** No publiques credenciales, datos personales, evidencia real ni reproducciones sensibles.

## Reporte privado

**PRIVATE SECURITY CONTACT — PENDING BEFORE PUBLICATION.** No existe todavía un canal de recepción del proyecto confirmado. El placeholder no es un destino para enviar reportes; no se pide contactar a una persona conocida ni se inventa un email.

La opción preferida para publicación es **GitHub Private Vulnerability Reporting**, si el repositorio y configuración lo permiten. No está declarado habilitado. Durante publicación se debe activar, comprobar recepción y documentar el acceso real desde Security / Report a vulnerability; si no está disponible, designar y probar un canal privado equivalente. [Configuración oficial](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

Mientras no exista un canal confirmado, conserva el reporte privadamente; no uses un issue público como alternativa. Cuando se habilite, incluye versión, impacto y reproducción mínima con datos ficticios. Se coordinará evaluación, corrección y divulgación para evitar exposición innecesaria; no se promete tiempo de respuesta o resolución. Compartir datos sensibles no es necesario para una primera descripción del impacto.

## Versiones y responsabilidad

No hay releases públicas ni una matriz de versiones con mantenimiento garantizado. La política inicial será best effort y deberá actualizarse al publicar la primera versión. [Soporte](SUPPORT.md) y [proceso de release](docs/RELEASING.md). Los scans o pruebas funcionales no sustituyen actualizaciones, supervisión ni backups.

En futuras contribuciones, las correcciones de seguridad se preparan por el canal privado apropiado antes de abrir un PR público. DCO o aprobación de PR no resuelven un incidente de exposición de secretos. [Preparación de GitHub](docs/GITHUB-SETUP.md).

## Operación segura

Usa HTTPS, origen exacto y cookies Secure fuera del entorno local. La API autoriza accesos por sesión, organización, proyecto y asignación; las descargas privadas verifican permisos e integridad. PostgreSQL y object storage no deben exponerse directamente a Internet.

VersityGW es el default. MinIO es continuidad legacy con riesgos documentados, no una recomendación para nuevas instalaciones. [Self-hosting](docs/SELF-HOSTING.md) · [Configuración](docs/CONFIGURATION.md) · [Backup](docs/BACKUP-RESTORE.md) · [Licencia](LICENSE).
