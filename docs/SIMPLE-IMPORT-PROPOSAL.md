# Importación sencilla CSV

**IMPLEMENTADO: subconjunto CSV.** La especificación de uso vigente está en
[Importar cuestionarios](IMPORTING-QUESTIONNAIRES.md#plantilla-sencilla-csv).

Se admiten siete columnas, cinco tipos simples y archivos UTF-8 separados por coma
o punto y coma. La conversión en el navegador reutiliza `questionnaire-template`
1.0 y la revisión/confirmación del servidor. No hay persistencia, mezcla o reemplazo
alternativos. No se incorporaron dependencias, .xlsx ni inferencias de condiciones.

El CSV conserva códigos y textos; genera identificadores de temas/áreas nuevos,
usa el código de pregunta como título y prioridad P2. Se mantienen los límites,
permisos y protección del CSV exportado. Opciones, matrices, relaciones y referencias
requieren JSON. El catálogo de áreas no se resuelve por nombres cuando es ambiguo
o la consulta existente alcanza su límite: en ese caso se solicita JSON explícito.
