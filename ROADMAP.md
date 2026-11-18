# Roadmap de Acta

Prioridades sin fechas ni compromiso de implementación. Esta lista no declara features nuevas ni sustituye decisiones de alcance. [Estado verificado y límites](PUBLIC-SNAPSHOT-MANIFEST.md).

## Now

- Titularidad, autorización, AGPL-3.0-only, maintainer y DCO 1.1: resueltos por el titular el 2026-10-01. Conservar avisos de terceros.
- Designar y verificar el contacto privado de moderación. El canal privado de seguridad se verificó habilitado el 2026-11-17; mantener su disponibilidad y revisar los canales comunitarios.
- Mantener las [releases publicadas](https://github.com/ruzer/Acta/releases), la documentación y los controles automáticos.
- Conservar y repetir la evidencia de actualización, recuperación y recursos de [0.11.0](docs/releases/v0.11.0.md); el [piloto con personas](docs/pilot/README.md) es la siguiente validación, con autorización y aceptación propias.

## Next

- Ejecutar el [plan de piloto](docs/pilot/PLAN-PILOTO.md) con personas administrativas no técnicas y registrar logros sin ayuda, tiempos, incidentes y satisfacción antes de decidir continuar, ajustar o detener. El estudio con agentes de IA no sustituye esta validación.

- Validar un piloto en el hardware y la virtualización que elija la institución. Linux x86_64 ya está [verificado en CI](docs/VERIFICATION.md#plataformas-y-evidencia-vigente); eso no certifica rendimiento ni cualquier servidor.
- Evaluar ensayos de SeaweedFS y endpoints externos únicamente si existe capacidad de mantenimiento y necesidad; hoy siguen sin verificar. No cambiar el default. [S3-PROVIDERS](docs/S3-PROVIDERS.md).
- Repetir las [mediciones de referencia](docs/RESOURCE-REFERENCE.md) en el servidor del piloto y observar crecimiento y concurrencia; no hay mínimos garantizados.
- Revisar con quien opere el piloto la configuración de [proxies confiables](docs/PROXY-TRUST.md), ya implementada; confiar únicamente en la topología autorizada.

## Later

- Reconsiderar plataformas y almacenamiento adicionales según resultados y aportes de la comunidad.
- Evaluar mejoras genéricas provenientes de forks mediante el proceso de contribución, sin prometer un ecosistema de plugins o nuevas integraciones.
- Webhooks y correo saliente: solo existe un [diseño mínimo](docs/INTEGRATIONS-DESIGN.md); implementarlos requiere revisión de seguridad propia (SSRF, firma, datos mínimos, auditoría).
- Cambio de proveedor de almacenamiento, rotación de credenciales y migración de evidencia desde la aplicación: hoy son procedimientos de infraestructura.

No se programa HA, migración automática de proveedores, nuevos tipos de pregunta o internacionalización completa. Son propuestas posibles, no deuda aprobada ni compromisos de esta hoja de ruta.
