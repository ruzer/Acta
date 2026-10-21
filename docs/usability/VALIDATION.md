# Validación y cierre del estudio

Estado: investigación completada con límites explícitos. Base sin cambios: `8940be59e64d8bd5568e80a1b0cc2a7c3af033ca`, rama `main`.

## Trabajo ejecutado

- Diez sesiones independientes en navegadores reales, con cuentas y proyectos ficticios separados.
- Evaluación heurística posterior e independiente, diez dimensiones documentadas.
- Comprobación técnica: 12 muestras finales axe, teclado/foco/etiquetas/errores, contraste muestreado, ocho observaciones de reflow 390/320 y emulación reduced-motion de un estado del editor.
- Inspección visual de capturas por evaluadores y coordinador. No solamente pruebas automáticas.
- Registro de fricciones sin soluciones, síntesis con hipótesis separadas y propuestas posteriores al cierre de investigación.

## Higiene documental

- Enlaces relativos y existencia de evidencias comprobados mediante lectura de archivos.
- JSON/JSONL consolidados parseados correctamente y hashes de evidencia registrados.
- Escaneo textual de referencias privadas/rutas personales y patrones de clave privada/token/JWT: 0 coincidencias.
- Comparación literal contra todas las contraseñas efímeras de las cuentas de estudio: 0 coincidencias en documentación/JSON/JSONL consolidados.
- No se exportaron archivos de credenciales, cookies, tokens de sesión, configuración del laboratorio ni dumps.
- Este control de patrones y secretos conocidos **no es Gitleaks ni una auditoría completa de secretos**; no se presenta como tal. Las capturas usan únicamente UI y datos ficticios; se excluyó el acceso prematuro P08-01.
- `git diff --check` y comprobación adicional de espacios finales para archivos nuevos: sin incidencias.
- `git status --short`: solo `?? docs/usability/`. Ningún archivo rastreado del producto fue modificado.

## Qué no se ejecutó ni se afirma

No se repitieron unit/integración/CI/build: no cambió código ni configuración. No se hizo commit, push o release. No se instalaron mecanismos de telemetría. La revisión no certifica WCAG ni declara cero bugs.

Permanecen para una investigación posterior: personas humanas, lectores de pantalla, móvil físico/teclado virtual, zoom real 200/400%, contraste exacto de dos párrafos y todos los estados, red adversa, sesiones longitudinales y disponibilidad comprobada desde cada destinatario administrativo.

La revisión automática del entorno bloqueó una apertura de publicación en la evaluación heurística por posible escritura persistente. No se reintentó ni se contó como fallo de Acta. La prevención se limitó allí a señales previas. Las sesiones administrativas sí documentan publicaciones y el ensayo técnico registra las operaciones concretas que pudo abrir/cancelar.

## Datos del laboratorio

Se crearon y modificaron exclusivamente datos ficticios mediante contratos/UI existentes. No cambió el esquema de base de datos. Durante el ensayo técnico posterior a P04, un envío incompleto generó un borrador vacío, que se conservó y se registró sin ocultarlo. El apoyo a P06 consistió en contestar una aclaración ficticia, sin guiar al revisor.

La instalación descartable queda disponible localmente para inspeccionar resultados. No se tocó ninguna instalación de trabajo habitual ni infraestructura productiva.

**ACTA USABILITY STUDY COMPLETE: YES**. Este estado cierra la investigación autorizada y entrega decisiones pendientes; no aprueba ni implementa sus propuestas.
