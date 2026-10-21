# Publicación inicial de Acta

Inspección de solo lectura: **2026-10-01**, GitHub API autenticada y `git ls-remote`. Destino oficial: [ruzer/Acta](https://github.com/ruzer/Acta). Este informe distingue el gate inicial de operaciones posteriores.

## REMOTE CURRENT STATE

- El repositorio existe, con visibilidad **private** al inspeccionarlo; no está archivado ni deshabilitado.
- Rama por defecto declarada: **main**, todavía sin referencia creada.
- **0 ramas, 0 tags, 0 releases y 0 Issues**; sin archivos ni commits. GitHub respondió explícitamente que el repositorio está vacío; `ls-remote` no devolvió refs.
- Issues habilitado. Discussions deshabilitado. Actions habilitado, sin workflows ni ejecuciones.
- La cuenta autenticada dispone de permisos admin/maintain/push.
- Private Vulnerability Reporting devolvió 404: no se considera habilitado ni se concluye disponibilidad en esta visibilidad.
- La consulta de protección de main devolvió 403 por limitación de plan/visibilidad privada. No se considera protegida; se verificará después de publicar.

## PUBLIC SNAPSHOT STATE

Acta · Questions. Evidence. Decisions. Autor, titular y maintainer inicial: Cristóbal Ruz Escobar. Licencia **AGPL-3.0-only**, texto íntegro GNU; DCO 1.1 + Signed-off-by adoptado. Versión coherente **0.2.0** en los cuatro paquetes, sin cambios de versión. Avisos de terceros conservados. No se importa historia privada.

Los resultados del cierre local y la procedencia legal se registran en [el manifiesto](PUBLIC-SNAPSHOT-MANIFEST.md). Las obligaciones de futura distribución de imágenes binarias siguen separadas: no se publica ningún contenedor en esta fase.

## CONFLICTS

No hay contenido ni refs remotos con los que el snapshot pueda entrar en conflicto en la inspección inicial. La visibilidad privada y la falta de configuraciones de seguridad son tareas de publicación, no contenido a sobrescribir. Un cambio remoto posterior invalida este gate y exige detenerse antes del push.

## CONTENT TO PRESERVE

No hay historia, archivos, assets, releases o Issues remotos que preservar. Se conserva el repositorio existente, su identidad y la cuenta propietaria; no se borra ni recrea. El repositorio interno de desarrollo permanece independiente e intacto.

## PROPOSED PUBLICATION STRATEGY

1. Completar auditoría local: links, residuos clasificados, secretos, LICENSE/DCO y avisos.
2. Solo con esos checks y este gate en YES: inicializar historia nueva en main, revisar gitignore y el conjunto exacto de staging.
3. Crear un único commit inicial firmado mediante DCO: `chore: publish initial Acta open-source snapshot`. Usar el nombre aprobado y una identidad de correo verificada; no copiar metadata privada de otro repositorio.
4. Añadir origin al destino oficial y ejecutar fetch. Si aparece cualquier ref o cambio inesperado, detenerse; no fusionar, sobrescribir ni forzar.
5. Hacer push normal de main, sin force. Verificar igualdad entre commit local y remoto.
6. Publicar la visibilidad del repositorio como parte de la publicación autorizada, verificar README/LICENSE/DCO/docs/capturas desde acceso anónimo y consultar Actions reales.
7. Habilitar/verificar Issues, Discussions, reporte privado de vulnerabilidades, protecciones y scanning donde GitHub lo permita. Required checks solo con nombres observados. No instalar DCO bot.
8. No crear tags, release 0.2.0 ni publicar imágenes. La primera release formal requerirá CI/configuración/revisión completos y autorización posterior.

## REMOTE SAFE FOR INITIAL PUBLICATION: YES

Gate válido para el estado vacío observado. Antes del push se comprobará de nuevo; cualquier divergencia exige detenerse sin modificar historia remota.

## Preparación local posterior al gate

Git se inicializó con historia nueva en main después de confirmar el remoto vacío y el escaneo local sin secretos. El staging coincide con el inventario público. Las comprobaciones iniciales detectaron únicamente CRLF/espacios originales en dos OFL y tres CSV de inventarios: .gitattributes preserva sus bytes y acota esas excepciones, sin relajar controles de código ni Gitleaks. LICENSE, DCO, fuentes y avisos siguen íntegros.

El autor confirmó expresamente la identidad de correo para la autoría y Signed-off-by del commit inicial. Titularidad, licencia, maintainer e identidad del commit están resueltos. El push continúa condicionado a la comprobación inmediata del remoto.

## Publicación inicial comprobada

El 2026-10-01 se creó el commit raíz `ca2c5ee38df791b96f85e9c88f30264a0d1f5068`, con DCO y el mensaje previsto. Tras añadir origin, fetch y ls-remote confirmaron de nuevo ausencia de refs; el push normal creó main sin sustituir historia. El repositorio se hizo público. README, hero, LICENSE, DCO y plantillas se comprobaron mediante acceso anónimo. GitHub detecta AGPL-3.0.

Issues, Discussions, Private Vulnerability Reporting, Dependabot alerts/security updates, secret scanning y push protection se habilitaron y verificaron por API. La actualización documental posterior refleja únicamente esos canales realmente activos. El resultado de CI debe consultarse en Actions; publicación del código no equivale a release formal. No hay tag ni release 0.2.0 ni imágenes publicadas.
