# Documentación de Acta

El idioma editorial principal es **español**, conforme a la documentación y la interfaz actuales. Se conservan identificadores, nombres de productos, comandos y etiquetas de soporte. Los textos de licencia de terceros se mantienen íntegros en su idioma original. Cambiar DEFAULT_LOCALE modifica formatos, no traduce toda la aplicación.

| Audiencia | Empieza aquí | Consulta después |
|---|---|---|
| Usuarios | [Producto y primeros pasos](../README.md) | [Galería](assets/README.md) |
| Operadores | [Self-hosting](SELF-HOSTING.md) | [Configuración](CONFIGURATION.md), [Backup/restore](BACKUP-RESTORE.md), [Proveedores S3](S3-PROVIDERS.md) |
| Desarrolladores | [Desarrollo](DEVELOPMENT.md) | [Arquitectura](ARCHITECTURE.md), [Dominio](DOMAIN-MODEL.md), [Contratos por función](CONTRACTS.md) |
| Contribuidores | [Contribuir](../CONTRIBUTING.md) | [Gobernanza](../GOVERNANCE.md), [Forks](UPSTREAM-FORKS.md), [Seguridad](../SECURITY.md), [Conducta](../CODE_OF_CONDUCT.md) |

[Manifiesto](../PUBLIC-SNAPSHOT-MANIFEST.md): resultados fechados y límites verificados. [Avisos de terceros](THIRD-PARTY-NOTICES.md): procedencia y obligaciones. [Identidad](NAMING-NOTES.md): Acta, nombre seleccionado y alcance de su descriptor.

Cada guía operativa describe su procedimiento; el manifiesto registra pruebas, no reemplaza instrucciones. Los contratos históricos permanecen enlazados desde el índice funcional sin exigir conocer su numeración.

## Importar cuestionarios

[Guía de importación](IMPORTING-QUESTIONNAIRES.md): para usuarios que preparan archivos, administradores que revisan áreas y permisos, y desarrolladores que mantienen ejemplos. [Ejemplo mínimo](../examples/questionnaire-template.minimal.json) · [Ejemplo completo](../examples/questionnaire-template.full.json) · [Contrato técnico](IMPORT-FORMAT.md).

## Preparación upstream

- [Gobernanza](../GOVERNANCE.md): roles, aceptación y política de forks.
- [Contribución desde forks](UPSTREAM-FORKS.md): sincronización y separación entre core y personalizaciones.
- [Procedencia DCO/CLA](CONTRIBUTION-ORIGIN.md): DCO 1.1 + Signed-off-by adoptado; sin CLA ni bot.
- [Releases y versiones](RELEASING.md): proceso futuro y recomendación pre-1.0.
- [GitHub setup](GITHUB-SETUP.md): checklist pendiente y checks CI reales.
- [Roadmap](../ROADMAP.md) y [Soporte](../SUPPORT.md): prioridades sin fechas y límites comunitarios.

Las políticas viven en esos documentos; el manifiesto registra resultados fechados y el changelog resume cambios. La estructura preparada no habilita colaboración o publicación por sí misma.
