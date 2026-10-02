# Importar un cuestionario

Puedes preparar temas y preguntas fuera de Acta y cargarlos juntos en un proyecto vacío. La importación usa un archivo JSON: primero lo revisas y solo después confirmas. No necesitas conocer los identificadores internos de la aplicación.

## Cuándo utilizar importación

Úsala si ya tienes un cuestionario que quieres preparar como archivo. Para pocas preguntas también puedes utilizar **Escribir → Agregar tema → Agregar pregunta**. Acta todavía no importa directamente Excel, CSV, Word ni PDF.

## Antes de comenzar

1. Entra con un perfil Administrador o Analista autorizado en el proyecto.
2. Crea un proyecto **vacío y activo**. Anota su identificador externo: aparece en la creación/administración del proyecto.
3. Abre **Importar** dentro del proyecto. Si ya tiene temas, preguntas, referencias o una importación previa, no se puede importar otra estructura, aunque los elementos estén archivados. **No hay mezcla, actualización ni reemplazo** de contenido existente.
4. Prepara las áreas responsables. Un Administrador puede confirmar la creación de las faltantes; un Analista debe pedir que se creen primero. Crear un área no asigna participantes.

## Opción rápida: partir del ejemplo mínimo

- [Ejemplo mínimo JSON](../examples/questionnaire-template.minimal.json): un tema y dos preguntas, Sí/No y Texto corto.
- [Ejemplo completo JSON](../examples/questionnaire-template.full.json): diez preguntas en cuatro temas, con los ocho tipos de respuesta.

La pantalla Importar permite descargar ambos. Desde el repositorio puedes copiar el archivo JSON o guardarlo usando la vista Raw. Edita una copia con un editor de texto; guárdala como `.json`, en UTF-8, sin comentarios ni comas al final.

Para probar el mínimo sin alterar sus identificadores, crea el proyecto con identificador **EXAMPLE-MINIMAL**. Para el completo, usa **EXAMPLE-FULL** en otro proyecto vacío. Si utilizas tu propio proyecto, cambia **solo `project.externalId` para que coincida exactamente** con el suyo. Después adapta textos, temas y áreas.

El nombre y la descripción de `project` en el archivo reemplazarán el nombre y la descripción del proyecto al confirmar. Si omites `description`, quedará vacía. Revisa esos valores antes de importar.

## Estructura del archivo

Conserva `formatVersion: "1.0"` y `kind: "questionnaire-template"`.

| Parte | Qué contiene |
|---|---|
| `project` | Identificador, nombre y descripción opcional del proyecto destino |
| `areas` | Catálogo de equipos responsables del cuestionario |
| `sections` | Temas y su orden |
| `questions` | Preguntas y configuración de respuesta |
| `conditions` | Reglas para mostrar preguntas; `[]` si no hay |
| `traceabilityReferences` | Catálogo de referencias; `[]` si no hay |

No agregues campos como `status`, `users` o `responses`: el formato los rechaza. Los ejemplos son archivos completos; los fragmentos siguientes solo explican partes.

## Temas

```json
{"externalId":"RECEPTION","title":"Recepción","order":1}
```

En el archivo un tema se llama `section`. `description` es opcional. Usa un identificador distinto para cada tema y un `order` entero no negativo sin repetir dentro del proyecto. Puedes empezar por 1. Cada pregunta indica su tema mediante `sectionExternalId`.

## Preguntas

Modifica el enunciado en `question` y el título breve en `title`. `helpText` es una ayuda opcional. El archivo también exige `priority` (P0, P1, P2 o P3), área responsable, orden, opciones y referencias; el ejemplo mínimo ya incluye todos esos campos.

`required: true` indica obligatoria; `false` indica opcional. No escribas esos valores entre comillas. `order` no debe repetirse entre preguntas de un mismo tema. Conserva `options: []` y `references: []` cuando no correspondan.

### Identificadores externos

`externalId` es un código que tú eliges para reconocer preguntas y enlazarlas dentro del archivo. No necesitas UUID. **REQ-001 y REQ-01 son diferentes**: Acta conserva exactamente el identificador, incluso al ordenar después.

Usa de 1 a 128 caracteres. El primero debe ser una letra ASCII o un número; después se admiten letras ASCII, números, punto, guion, guion bajo, dos puntos y diagonal. No uses espacios, tildes ni normalices códigos existentes. Si cambias un código, actualiza también las referencias a él en el archivo.

## Tipos de respuesta

| En Acta | Valor de `type` | Configuración |
|---|---|---|
| Sí / No | `YES_NO` | Sin opciones; no agregues “Depende” |
| Opción única | `SINGLE_CHOICE` | Entre 2 y 50 opciones |
| Varias opciones | `MULTIPLE_CHOICE` | Entre 2 y 50 opciones; límites de selección opcionales |
| Texto corto | `SHORT_TEXT` | `config.maxLength` opcional, hasta 500 |
| Texto largo | `LONG_TEXT` | `config.maxLength` opcional, hasta 10,000 |
| Fecha | `DATE` | Fechas `YYYY-MM-DD`; límites opcionales |
| Número | `NUMBER` | Límites `min`, `max` e `integer` opcionales |
| Matriz | `MATRIX` | Filas y columnas obligatorias en `config` |

En el ejemplo completo, Recepción recoge registro y canales; Revisión documenta información y plazo; Autorización pregunta criterios y seguimientos; Seguimiento incluye fecha y matriz de avisos.

## Opciones

```json
"options": [
  {"value":"ALWAYS","label":"Siempre","order":1},
  {"value":"EXCEPTIONAL","label":"Solo en casos extraordinarios","order":2},
  {"value":"NEVER","label":"Nunca","order":3}
]
```

`label` es el texto visible y `value` el código que utilizan las condiciones. No repitas códigos ni posiciones dentro de una pregunta. Los tipos que no son Opción única o Varias opciones llevan `options: []`.

## Seguimientos

Añade `groupParentExternalId` con el código de la pregunta principal. Ambas deben estar en el mismo tema. Esto agrupa preguntas, **no crea una condición**.

El ejemplo completo muestra dos seguimientos de REQ-006: REQ-007 está agrupada sin condición; REQ-008 está agrupada y además tiene condición. No crees relaciones circulares.

## Condiciones

“Mostrar la pregunta REQ-008 si la respuesta a REQ-006 es Solo en casos extraordinarios” se escribe en `conditions` así:

```json
{
  "parentQuestionExternalId":"REQ-006",
  "childQuestionExternalId":"REQ-008",
  "operator":"EQUALS",
  "value":"EXCEPTIONAL"
}
```

- `EQUALS`: es igual a. `NOT_EQUALS`: no es igual a. Funcionan con Sí/No (valor `true` o `false`) u Opción única (código de opción).
- `CONTAINS`: contiene una opción. Solo para Varias opciones, con su código como valor.
- Solo hay una condición por pregunta dependiente. No hay AND/OR ni scripts.
- La pregunta que activa la condición debe existir en el mismo proyecto; puede estar en otro tema. Sin respuesta al padre, la condición sigue indeterminada, también en “no es igual a”.

## Matrices

```json
"config": {
  "rows": [{"key":"received","label":"Recepción"}],
  "columns": [
    {"key":"yes","label":"Sí"},
    {"key":"no","label":"No"}
  ]
}
```

Se elige una columna por fila. Entre 1 y 20 filas y entre 2 y 20 columnas; sus claves deben ser únicas en cada lista. Las claves admiten letras ASCII, números, guion y guion bajo, hasta 64 caracteres. Una matriz obligatoria requiere responder todas las filas. Sigue llevando `options: []`.

## Áreas responsables

Cada `responsibleAreaCode` debe aparecer en `areas`. Acta busca el código **exacto** dentro de tu institución. Si ya existe, debe estar activo y tener exactamente el mismo nombre del archivo; importar no renombra áreas existentes.

Si no existe, Administración verá una advertencia y deberá marcar **Confirmo crear estas áreas en la institución**. Un Analista verá un error hasta que Administración dé de alta el área. Es responsabilidad, no asignación automática de personas.

## Trazabilidad

Es opcional. Para un cuestionario sencillo deja vacíos `traceabilityReferences` y las `references` de cada pregunta.

En el completo, la pregunta REQ-004 enlaza con una guía ficticia y REQ-006 con una regla ficticia. El catálogo declara `type`, `externalId` y `label`; cada pregunta relaciona el mismo par `type` + `externalId`. No se descargan documentos ni URLs. Las URLs deben ser HTTPS y las referencias no reciben estados de validación por estar relacionadas.

## Vista previa

Selecciona el archivo y pulsa **Revisar archivo**. Esta operación no guarda estructura ni crea áreas.

La vista muestra el nombre de proyecto propuesto por el archivo, conteos de temas, preguntas, opciones, condiciones, referencias, enlaces y **áreas nuevas**, junto con errores y advertencias. Las áreas ya existentes no se cuentan como nuevas. La ruta de la pantalla determina el proyecto destino; `project.externalId` debe coincidir con él.

Si editas el archivo, vuelve a seleccionarlo y genera otra vista previa. No confirmes una revisión anterior. Los detalles técnicos conservan la ruta exacta del error; la pantalla identifica el elemento con una posición legible, empezando por 1.

## Errores comunes

| Mensaje/situación | Qué hacer |
|---|---|
| El identificador no coincide con el proyecto | Copia el identificador externo del proyecto destino a `project.externalId` |
| El proyecto ya contiene estructura | Usa otro proyecto vacío; no se mezclan ni reemplazan datos |
| Pregunta 8 · Área responsable | Revisa `responsibleAreaCode`, el catálogo `areas` y las áreas disponibles; la ruta técnica `/questions/7/responsibleAreaCode` cuenta desde cero |
| Esta pregunta hace referencia a un tema que no existe | Comprueba que su `sectionExternalId` esté en `sections` |
| Identificador o posición repetido | Da un código único al elemento y un orden único dentro de su tema |
| Opciones/configuración no corresponden al tipo | Revisa al menos dos opciones para selección, o filas/columnas para matriz; no pongas opciones en texto, fecha o Sí/No |
| Propiedades no permitidas | Quita campos ajenos al formato; no uses un JSON de exportación como plantilla |
| Tipo, formato o límite no válido | Revisa el campo indicado; `true` no es `"true"` y los números no van entre comillas |
| El archivo no contiene JSON válido | Revisa comas, comillas dobles y llaves con un editor; no incluyas comentarios |
| Esta propiedad aparece más de una vez | Elimina claves duplicadas; Acta no elige una de ellas silenciosamente |
| Ciclo de agrupación/condiciones | Evita que una pregunta termine dependiendo de sí misma |

Máximos predeterminados: 5 MiB, profundidad 20, 100 temas, 2,000 preguntas, 10,000 referencias y 20,000 enlaces. La instalación puede reducir esos límites. Si hay errores, no se habilita la confirmación.

## Confirmar importación

Revisa los errores, las advertencias y las áreas faltantes; después pulsa **Confirmar importación**. Todo se guarda en una única operación o no se guarda nada. Si el proyecto o el archivo cambió desde la vista previa, Acta pedirá revisarlo otra vez. No es necesario gestionar hashes ni números de versión manualmente.

## Qué ocurre después

1. Abre **Revisar estructura importada**.
2. Las preguntas quedan en **Borrador**, sin respuestas ni participantes asignados.
3. Revisa los textos, opciones, seguimientos y condiciones en el editor.
4. Agrega participantes concretos al proyecto y asígnales las preguntas correspondientes.
5. Revisa antes de publicar y publica con los controles existentes. En preguntas condicionales, prepara/publica primero sus dependencias.

## Qué NO importa Acta

No importa usuarios, roles, contraseñas, sesiones, asignaciones, respuestas, borradores de respuesta, evidencia, validaciones, aclaraciones, conflictos, archivos privados ni estados funcionales. Tampoco crea una institución desde el archivo.

Un JSON de **exportación** no es una plantilla importable ni un backup completo. El importador no restaura ni sincroniza proyectos.

## Detalles técnicos y mantenimiento

El [contrato técnico](IMPORT-FORMAT.md) describe campos y límites. La autoridad ejecutable es `templateInput` junto con el parser estricto, las reglas de preguntas y la validación contextual del backend. No hay un JSON Schema independiente autoritativo: generar solo la forma Zod no comprobaría relaciones, ciclos, configuración según tipo ni permisos. La vista previa de Acta sigue siendo necesaria.

Los ejemplos se prueban automáticamente con el validador de producción y con preview/confirmación HTTP sobre PostgreSQL de test. [Evaluación de Excel/CSV](SIMPLE-IMPORT-PROPOSAL.md): propuesta futura, no una opción de importación disponible.
