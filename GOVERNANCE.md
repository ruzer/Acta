# Gobernanza de Acta

**Autor, titular e Initial Maintainer: Cristóbal Ruz Escobar.** Licencia: **AGPL-3.0-only**, [LICENSE](LICENSE). Modelo de contribución: [DCO 1.1](DCO) + Signed-off-by; sin CLA inicialmente. Decisiones confirmadas el 2026-10-01.

## Acta crece desde el upstream

El upstream oficial es [Acta](https://github.com/ruzer/Acta). El código es público; las releases formales se anuncian por separado. Acta mantiene un núcleo genérico. Las organizaciones pueden adaptarlo mediante forks, conforme a AGPL-3.0-only. Devolver mejoras de utilidad amplia ayuda a otros usuarios y reduce la divergencia de esos forks.

Contribuir mediante Pull Request es una invitación y una práctica del proyecto, no una obligación atribuida a la licencia. No enviar un PR no es motivo, por sí solo, para considerar inválido un fork.

## Personas y decisiones

| Rol | Responsabilidad |
|---|---|
| Maintainer | Revisa PR, mantiene calidad, seguridad, documentación y compatibilidad razonable; decide merges y releases. Puede rechazar cambios demasiado específicos o costosos de mantener y debe explicar el motivo. |
| Contributor | Propone, documenta, prueba y aporta cambios cuya procedencia y autorización puede justificar. Atiende la revisión y respeta el código de conducta. |

Cualquier contributor puede revisar propuestas; no se crea un cargo separado de reviewer. No hay fundación, comité ni sistema de votación. Los maintainers buscarán acuerdo en el PR o Discussion y dejarán la decisión técnica y su motivo por escrito. Para cambios pequeños basta el PR; cambios de contratos, permisos, datos o compatibilidad necesitan discusión de alcance antes de implementar. Una propuesta rechazada puede revisarse con nueva evidencia sin abrir disputas personales.

Quienes mantengan el proyecto deberán declarar conflictos de interés. Un incidente sobre su propia conducta requiere revisión por otra persona autorizada cuando exista; si no hay una disponible, debe informarse esa limitación y designarse una antes de prometer revisión independiente. [Código de conducta](CODE_OF_CONDUCT.md).

## Principios de aceptación

Evaluar utilidad general, seguridad, calidad, mantenibilidad, pruebas, documentación, compatibilidad y accesibilidad cuando aplique. Evitar dependencias institucionales innecesarias y cambios de alcance ocultos. No se exige perfección: una mejora pequeña, comprobable y sostenible puede ser suficiente. Las limitaciones conocidas deben quedar explícitas.

Las pruebas pasan antes de fusionar. Cambios sensibles se revisan con especial atención; el acceso a secretos o datos de una instalación nunca es requisito para contribuir. [Contribuir](CONTRIBUTING.md) y [preparación de GitHub/CI](docs/GITHUB-SETUP.md).

## Política de forks

Acta está diseñado para admitir y fomentar forks conforme a la licencia AGPL-3.0-only. **Acta upstream** identifica la línea mantenida por este proyecto; **Acta-derived fork** identifica una variante derivada. La compatibilidad depende de los cambios y pruebas del fork, no de su mera existencia. Ser un fork no implica rechazo, falta de legitimidad ni respaldo automático del upstream.

Cada fork puede mantener personalizaciones y su propio soporte, y proponer mejoras al núcleo. No se crea una política de marcas ni restricciones adicionales. Mantener cambios fuera del upstream no elimina obligaciones legales de distribución o acceso al código que puedan corresponder. [Sincronización y contribución desde forks](docs/UPSTREAM-FORKS.md).

## Mantenimiento inicial

Rama principal `main` y ramas cortas de trabajo. No se establece GitFlow ni ramas permanentes adicionales. El soporte será comunitario y best effort: [SUPPORT](SUPPORT.md). No se prometen plazos, SLA ni ramas LTS.

[Roadmap](ROADMAP.md) recoge prioridades sin fechas; [Releases](docs/RELEASING.md) define versionado y publicación futura; [procedencia de contribuciones](docs/CONTRIBUTION-ORIGIN.md) documenta DCO 1.1 + Signed-off-by adoptado, sin CLA ni bot. Cualquier cambio de estas políticas se propondrá y explicará mediante PR, sin aplicar nuevas obligaciones retroactivamente de forma silenciosa.
