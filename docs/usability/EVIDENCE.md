# Evidencia del estudio

Origen: navegadores Chromium independientes contra instalación local descartable, contenido y usuarios ficticios. Fecha local: 5 de octubre de 2026. No se incluyen credenciales, cookies, tokens, dumps, configuración privada ni archivos del producto.

## Documentos

- [Estudio completo y task success](USABILITY-STUDY.md)
- [Protocolo](STUDY-PROTOCOL.md) y [datasets iniciales](DATASETS.md)
- [Friction log sin soluciones](FRICTION-LOG.md)
- [Evaluación heurística independiente](HEURISTIC-REVIEW.md)
- [Comprobación de accesibilidad](ACCESSIBILITY.md)
- [Apoyo ficticio a la aclaración](SUPPORT-SCENARIO.md)
- [20 oportunidades de simplicidad](SIMPLICITY-REVIEW.md)
- [Propuestas HIGH, no implementadas](PROPOSALS.md)

## Diez sesiones independientes

- [P01 — sesión y evidencias](sessions/p01/SESSION.md)
- [P02 — sesión y evidencias](sessions/p02/SESSION.md)
- [P03 — sesión y evidencias](sessions/p03/SESSION.md)
- [P04 — sesión y evidencias](sessions/p04/SESSION.md)
- [P05 — sesión y evidencias](sessions/p05/SESSION.md)
- [P06 — sesión y evidencias](sessions/p06/SESSION.md)
- [P07 — sesión y evidencias](sessions/p07/SESSION.md)
- [P08 — sesión y evidencias](sessions/p08/SESSION.md)
- [P09 — sesión y evidencias](sessions/p09/SESSION.md)
- [P10 — sesión y evidencias](sessions/p10/SESSION.md)

## Comprobaciones visuales destacadas

| Observación | Evidencia |
|---|---|
| Revisión con 60 errores | [Antes](sessions/p03/03-revisar-60-errores.png) |
| Mismas 300 preguntas admitidas por el lote | [Plan conjunto](sessions/p03/04-publicar-300-sin-bloqueos.png) |
| Consulta fuera de los contadores | [Resumen29/30](sessions/p05/05-guardado-y-salida.png) |
| Importación buscada desde editor vacío | [Estado inicial](sessions/p10/02-editor-empty.png) |
| Aclaración respondida en la lista | [Bandeja](sessions/p06/10-list-after-clarification-reply.png) |
| Decisión con resultado y fuentes | [Validada](sessions/p06/09-validated-decision.png) |
| Matriz móvil | [Formulario390](sessions/p08/14-avisos-formulario.png) |
| Texto y evidencia conservados | [Enviada390](sessions/p08/18-respuesta-enviada.png) |

## Integridad y límites

- 184 archivos de evidencia consolidados, 14,428,760 bytes; hashes en [manifest](EVIDENCE-MANIFEST.json).
- Los informes de sesión enlazan sus capturas y registros redactados. Se excluyó la captura prematura P08-01 de acceso. Las capturas transitorias restantes se identifican como tales; no prueban fallo de producto.
- Se sustituyeron rutas de la máquina por referencias neutrales. Los IDs/rutas de proyectos son datos ficticios de esa instalación, no identificadores privados.
- Los transcripts contienen acciones y los valores devueltos al helper. Algunas lecturas console.log están solo en el registro original de herramientas; no se afirma conservación completa de todos los árboles accesibles.
- Se conservan JSON de 12 muestras finales axe, resumen, reflow y motion; no credenciales ni scripts de preparación. El transcript técnico permanece fuera de la distribución documental.
- El coordinador inspeccionó visualmente pares de revisión/lote, resumen de consulta, editor vacío, móvil, aclaración y decisión. Las personas y revisores registraron sus propias inspecciones.
- Los datos posteriores al ensayo de error no se confundieron con los resultados originales de P04. No se eliminó el borrador para presentar un resultado más favorable.
- El laboratorio queda disponible localmente para revisión; no se despliega ni modifica ninguna instancia de uso habitual.

[Cierre y controles documentales](VALIDATION.md).
