# Propuesta: plantilla tabular sencilla

**PROPUESTA, NO IMPLEMENTADA.** Acta acepta únicamente JSON `questionnaire-template` 1.0. No hay importador Excel/CSV ni conversor instalado.

## Evaluación

**B: una tabla sencilla representa solo un subconjunto.** Una fila por pregunta podría contener tema, código externo, título, enunciado, tipo, obligatoriedad, prioridad, área y posición. Sí/No, texto, fecha y número caben sin relaciones anidadas. El proyecto destino y el catálogo de áreas requieren información adicional y validación.

- Opciones múltiples: separar valores con comas o punto y coma puede perder etiquetas que ya contienen esos caracteres. Haría falta una tabla de opciones con códigos y orden explícitos.
- Matrices: necesitan tablas separadas de filas/columnas, claves y cardinalidades; no es seguro aplanarlas en una celda sin un esquema adicional.
- Condiciones y seguimientos: deben conservar relaciones distintas. Una fila indentada no debe convertirse automáticamente en condición. Los booleanos no deben confundirse con etiquetas.
- Referencias y trazabilidad: necesitan catálogo, tipo, identificador y enlaces múltiples por pregunta, con notas de alcance; no basta una columna de texto libre.

Un libro con varias hojas podría representar más capacidades, pero supondría diseñar y mantener un segundo formato. Una tabla única pretendidamente completa sería **C: ambigüedad o pérdida**.

## Subconjunto candidato

Una futura “plantilla sencilla” podría admitir Sí/No, Texto corto, Texto largo, Fecha y Número; temas, área responsable, identificadores explícitos y obligatoriedad. Inicialmente excluiría opciones de selección, matrices, condiciones, seguimientos y trazabilidad. Rechazaría lo no admitido en vez de descartarlo silenciosamente.

## Conversión prevista, no implementada

Archivo tabular → conversión explícita al JSON autoritativo → parser y validador existentes → preview → confirmación existente. No introducir otro camino de persistencia, merge ni overwrite. El usuario debe revisar el JSON/preview antes de confirmar. Mantener códigos como texto: REQ-001 y REQ-01 siguen siendo distintos.

Antes de implementarlo se requiere decisión de producto sobre columnas, catálogo de áreas, errores, configuración por tipo y formato descargable. No evaluar fórmulas/macros/enlaces externos. Evitar conversiones automáticas de fechas y números. Los ejemplos o exports destinados a hojas de cálculo necesitarían defensa contra fórmulas tras espacios o controles, sin alterar los valores originales. La propuesta no ejecuta código ni modifica el contrato actual.
