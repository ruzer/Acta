# Escenarios ficticios del laboratorio

Los fixtures se prepararon en una instalación descartable mediante los contratos existentes. Ningún resultado de preparación se contabiliza como tarea completada por una persona. No se alteran instalaciones ni datos existentes.

| Proyecto | Preguntas | Temas | Publicadas al inicio | Asignaciones activas iniciales |
|---|---:|---:|---:|---:|
| Servicios de ejemplo — 50 | 50 | 5 | 0 | 0 |
| Servicios de ejemplo — 300 | 300 | 5 | 0 | 0 |
| Solicitudes de ejemplo — Primera participación | 10 | 2 | 10 | 10 |
| Solicitudes de ejemplo — Jornada breve | 30 | 2 | 30 | 30 |
| Decisiones sobre servicios de ejemplo | 10 | 2 | 10 | 20 |
| Procedimiento de ejemplo existente | 10 | 2 | 0 | 0 |
| Solicitudes de ejemplo — Móvil | 10 | 2 | 10 | 10 |
| Preparación del servicio — Teclado | 10 | 2 | 0 | 0 |

P01 comienza sin un proyecto propio y debe crear el suyo. P10 recibe un archivo JSON ficticio de 10 preguntas y debe crear/importar su proyecto. Las personas usan cuentas separadas y no comparten estado de navegación. Los participantes A y B son identidades ficticias disponibles en los escenarios de analistas.

La biblioteca tiene texto corto, sí/no, opción única, varias opciones, número, fecha, texto largo y matriz. Los temas tratan recepción, evaluación, atención, comunicación y cierre de solicitudes. Algunas preguntas están agrupadas como seguimientos; las agrupaciones no implican condiciones. La repetición temática a escala es sintética: no representa 300 preguntas de una institución real.

El escenario revisor contiene dos aportaciones diferentes sobre el canal/plazo de atención, una aportación que necesita precisión y archivos PDF ficticios. Ninguna decisión queda prevalidada por el coordinador.

La preparación detectó un error del harness al ordenar por posición sin considerar el tema y tratar una pregunta DATE como texto. El backend rechazó el dato; se corrigió únicamente el fixture de preparación antes de P06. No se contabiliza como fricción de una persona ni como bug del producto.

No se almacenan credenciales, cookies, tokens, respaldos ni volúmenes en estos documentos.

## Cambios posteriores a las sesiones

El revisor P06 solicitó una respuesta de participante, representada por el coordinador mediante otra sesión UI: ver [apoyo externo](SUPPORT-SCENARIO.md). No se guió al revisor en controles.

Durante accesibilidad, después de finalizar P04, un intento de envío de matriz vacía creó un borrador sin enviar respuesta. Los contadores pasaron 9/0/1 a 8/1/1 (pendientes/borradores/enviadas). El dato no fue eliminado. No usar ese estado posterior para alterar el resultado original de la sesión. No hubo cambios a esquema ni código.
