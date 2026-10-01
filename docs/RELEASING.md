# Versionado y releases de Acta

**PROCESO FUTURO; no hay release pública.** Titularidad, autorización, AGPL-3.0-only y DCO 1.1 están confirmados. La publicación del código exige superar el gate remoto; la release formal requiere además CI, configuración y revisión. El [manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md) demuestra pruebas del snapshot, no autorización legal ni una release.

## Política de versiones

Se prepara [Semantic Versioning](https://semver.org/lang/es/) en formato **MAJOR.MINOR.PATCH**:

| Incremento | Intención |
|---|---|
| PATCH | Correcciones compatibles de bugs o seguridad |
| MINOR | Funcionalidad compatible y deprecaciones anunciadas |
| MAJOR | Cambios incompatibles del contrato público |

El contrato público incluye API documentada, configuración, formatos de intercambio y requisitos de actualización/persistencia. No basta con que TypeScript compile para afirmar compatibilidad. Antes de 1.0 no se promete estabilidad absoluta; los cambios incompatibles deben anunciarse, agruparse en un incremento MINOR de `0.x` y acompañarse de instrucciones de migración. PATCH seguirá reservado para cambios compatibles. Una corrección de seguridad que rompa compatibilidad debe decirlo y usar la versión apropiada.

### Primera versión prevista

**0.2.0, versión inicial prevista aprobada.** `0.1.0` es una opción válida para empezar una historia pública, pero los cuatro manifiestos de paquetes ya declaran `0.2.0` y el snapshot usa esa base. Conservar 0.2.0 evita renumerar tooling o sugerir un downgrade sin beneficio funcional. No implica que exista una release pública 0.1.0: la historia pública empieza con Acta.

Si se necesita una candidata, evaluar `0.2.0-rc.1` antes de la release final; no se crea ahora. Los manifiestos y lockfile ya están alineados en 0.2.0 y se conservan. La creación de tag/release requiere una fase posterior autorizada. Las releases publicadas serán inmutables: correcciones posteriores usan otra versión, sin mover tags existentes.

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
