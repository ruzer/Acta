
# Contrato de importación y exportación


**DISEÑO APROBADO · versión 1.0; IMPLEMENTADO en 2E.** Este documento define el esquema; el importador y exportadores operan con contratos Zod ejecutables. Los ejemplos son ficticios.

## Límites y estrategia

Primer importador: estructura de un solo proyecto vacío. ADMIN/ANALYST selecciona proyecto autorizado ya creado; `project.externalId` debe coincidir y la organización procede de la sesión. Nombre/descripción importados se muestran como cambios en preview. No importar usuarios, roles, asignaciones, respuestas, archivos, aclaraciones, validaciones ni estados.

No upsert silencioso. Un proyecto con secciones/preguntas/referencias existentes se rechaza; reintentar un lote ya confirmado con mismo requestId/hash devuelve el resultado anterior. Áreas se resuelven por código exacto en la organización; solo ADMIN puede crear códigos faltantes. ANALYST recibe errores de mapeo y solicita alta al ADMIN. No se crea una organización desde archivo.

UTF-8, JSON estricto sin claves duplicadas, máximo inicial 5 MiB, profundidad 20, 100 secciones, 2,000 preguntas, 20,000 enlaces y 10,000 referencias. Límites propuestos configurables en servidor; rechazar antes de agotar memoria.

## Esquema contractual

Todos los objetos rechazan propiedades no declaradas. IDs se comparan exactamente, sin trim, cambio de mayúsculas o padding; espacios inicial/final se rechazan con error. `externalId`/code: string 1–128, caracteres alfanuméricos y `._:/-`; no exige un prefijo de negocio. UUID internos no entran en el contrato.

| Objeto | Campos obligatorios | Opcionales y reglas |
|---|---|---|
| Raíz | formatVersion=`"1.0"`, kind=`"questionnaire-template"`, project, areas[], sections[], questions[], conditions[], traceabilityReferences[] | Arrays vacíos permitidos salvo sections/questions para confirmar; ninguna otra clave |
| project | externalId, name (1–200) | description (≤4,000) |
| area | code, name (1–200) | Código único en el archivo; nombre distinto al existente es error, no actualización |
| section | externalId, title (1–200), order (entero ≥0) | description (≤4,000); ID y orden únicos en proyecto |
| question | externalId, sectionExternalId, title (1–200), question (1–10,000), priority, type, required (boolean), responsibleAreaCode, order, options[], references[] | helpText (≤10,000), groupParentExternalId, sourceLocator, config; orden único por sección |
| option | value (código 1–64), label (1–500), order (entero ≥0) | Valor y orden únicos por pregunta; no usar etiqueta como valor |
| condition | parentQuestionExternalId, operator, value, childQuestionExternalId | Un predicado por hijo, referencias locales, sin ciclos, valor tipado |
| traceabilityReference | type, externalId, label (1–500) | url HTTPS ≤2,000; priority original P0/P1/P2/P3, description ≤4,000 |
| question.references[] | type, externalId | scopeNote ≤4,000: qué parte ayuda a aclarar, sin declarar validación |
| sourceLocator | document, anchor | part opcional (`P`, `S01` u otra cadena ≤64); localizadores documentales, nunca rutas para leer archivos automáticamente |

`priority`: P0, P1, P2, P3. `type`: YES_NO, SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_TEXT, LONG_TEXT, DATE, NUMBER, MATRIX. Referencias: QUESTION, BUSINESS_RULE, REQUIREMENT, CAPABILITY, WORKFLOW, DOCUMENT, CODE, OTHER. Clave única de referencia: `(type, externalId)` dentro del proyecto; un mismo ID en otro tipo puede existir, por eso el enlace siempre incluye ambos.

## Tipos de pregunta y respuesta

| Tipo | Configuración admitida | Answer enviado |
|---|---|---|
| YES_NO | options=[]; config ausente | boolean, nunca `"sí"`/`"false"` |
| SINGLE_CHOICE | 2–50 options; config ausente | string exactamente igual a option.value |
| MULTIPLE_CHOICE | 2–50 options; config `{minSelections,maxSelections}` opcional, enteros coherentes | array de códigos únicos; vacío solo si no requerida |
| SHORT_TEXT | options=[]; config `{maxLength}` opcional (1–500), default 500 | string no vacío si requerida |
| LONG_TEXT | options=[]; config `{maxLength}` opcional (1–10,000), default 10,000 | string no vacío si requerida |
| DATE | options=[]; config `{min,max}` opcional, fechas reales `YYYY-MM-DD` | string de fecha válida sin zona horaria |
| NUMBER | options=[]; config `{min,max,integer}` opcional, min≤max | número JSON finito, rango seguro; precisión decimal máxima propuesta 6; sin dinero/cómputo financiero |
| MATRIX | options=[]; config obligatorio `{rows:[{key,label}],columns:[{key,label}]}`; 1–20 filas y 2–20 columnas, claves únicas | objeto `{rowKey: columnKey}`; una elección por fila; todas las filas si required |

Borrador permite answer nulo/parcial; un valor presente debe ser compatible con el tipo. Envío opcional permite answer nulo únicamente con comentario explicativo no vacío; cuenta como aportación enviada y pendiente de revisión, nunca como decisión validada. Envío sin valor ni comentario se rechaza y debe permanecer borrador. Envío requerido necesita valor completo. Comentario y ejemplo son campos separados, cada uno ≤10,000 caracteres. Ni “no sé” ni “necesito consultar” se transforman en NOT_APPLICABLE.

La interfaz puede ofrecer “Necesito consultar” como acción, no como un valor universal escondido dentro de los ocho tipos. Condición EQUALS/NOT_EQUALS recibe boolean o código de SINGLE_CHOICE; CONTAINS recibe un código de MULTIPLE_CHOICE. Un padre desconocido nunca satisface NOT_EQUALS. Reglas completas en [dominio](DOMAIN-MODEL.md).

## Ejemplo ficticio completo

Los IDs FORM/REQ/RN del ejemplo son ficticios; el ejemplo no es un seed automático.

```json
{
  "formatVersion": "1.0",
  "kind": "questionnaire-template",
  "project": {
    "externalId": "DEMO-SERVICIOS",
    "name": "Servicios internos — demostración ficticia",
    "description": "Ejemplo sin personas ni respuestas reales"
  },
  "areas": [
    {"code": "AREA-DEMO", "name": "Área de ejemplo"}
  ],
  "sections": [
    {"externalId": "SEC-01", "title": "Solicitud de servicio", "order": 1}
  ],
  "questions": [
    {
      "externalId": "FORM-01",
      "sectionExternalId": "SEC-01",
      "title": "Autorización previa",
      "question": "¿La solicitud necesita autorización antes de atenderse?",
      "helpText": "Describe el proceso del área; no incluyas datos personales.",
      "priority": "P0",
      "type": "SINGLE_CHOICE",
      "required": true,
      "responsibleAreaCode": "AREA-DEMO",
      "order": 1,
      "options": [
        {"value": "SIEMPRE", "label": "Siempre", "order": 1},
        {"value": "NUNCA", "label": "Nunca", "order": 2},
        {"value": "DEPENDE", "label": "Depende", "order": 3}
      ],
      "references": [
        {"type": "QUESTION", "externalId": "Q-001", "scopeNote": "Criterio general"},
        {"type": "BUSINESS_RULE", "externalId": "RN-001"},
        {"type": "REQUIREMENT", "externalId": "REQ-001"}
      ],
      "sourceLocator": {"document": "entrevista-demo.md", "anchor": "form-01", "part": "P"}
    },
    {
      "externalId": "FORM-01-S01",
      "sectionExternalId": "SEC-01",
      "groupParentExternalId": "FORM-01",
      "title": "Casos que requieren autorización",
      "question": "¿En qué casos se necesita autorización?",
      "priority": "P1",
      "type": "LONG_TEXT",
      "required": true,
      "responsibleAreaCode": "AREA-DEMO",
      "order": 2,
      "options": [],
      "references": [{"type": "QUESTION", "externalId": "Q-001", "scopeNote": "Excepciones"}],
      "sourceLocator": {"document": "entrevista-demo.md", "anchor": "form-01", "part": "S01"}
    },
    {
      "externalId": "FORM-02",
      "sectionExternalId": "SEC-01",
      "title": "Canales de recepción",
      "question": "Indica si cada canal se utiliza para recibir solicitudes.",
      "priority": "P2",
      "type": "MATRIX",
      "required": false,
      "responsibleAreaCode": "AREA-DEMO",
      "order": 3,
      "options": [],
      "config": {
        "rows": [{"key": "CORREO", "label": "Correo"}, {"key": "VENTANILLA", "label": "Ventanilla"}],
        "columns": [{"key": "SI", "label": "Sí"}, {"key": "NO", "label": "No"}]
      },
      "references": []
    }
  ],
  "conditions": [
    {"parentQuestionExternalId": "FORM-01", "operator": "EQUALS", "value": "DEPENDE", "childQuestionExternalId": "FORM-01-S01"}
  ],
  "traceabilityReferences": [
    {"type": "QUESTION", "externalId": "Q-001", "label": "Autorización", "priority": "P0"},
    {"type": "BUSINESS_RULE", "externalId": "RN-001", "label": "Regla por confirmar"},
    {"type": "REQUIREMENT", "externalId": "REQ-001", "label": "Necesidad propuesta", "url": "https://example.org/requisitos/REQ-001"}
  ]
}
```

## Validación y confirmación

1. Leer con límites y rechazar claves duplicadas, versión/kind desconocidos, campos extra y tipos inválidos. No interpretar fechas/booleanos mediante coerción.
2. Verificar unicidad, áreas y proyecto objetivo, secciones existentes en lote, pertenencia de opciones, filas/celdas, padres/grupos y referencias resueltas. Agrupación también debe ser acíclica y dentro de la misma sección; condición puede cruzar secciones del mismo proyecto.
3. Comprobar DAG de condiciones y compatibilidad parent/operator/value. No inferir condición a partir de palabras como “depende” en el texto.
4. Mostrar conteos, nuevos elementos, advertencias, errores con JSON Pointer (por ejemplo `/questions/1/references/0/externalId`) y hash SHA-256 del archivo exacto. Preview no crea datos de dominio.
5. Confirmar reenviando el mismo archivo, hash, expectedProjectVersion y requestId. Revalidar permisos, límites, archivo y ausencia de estructura; bloquear/versionar Project para excluir dos importaciones concurrentes.
6. Transacción única: áreas nuevas solo si ADMIN, estructura, referencias, enlaces, condiciones, ImportBatch y PROJECT_IMPORTED. Cualquier error revierte todo. Preguntas DRAFT/NOT_REVIEWED y sin respuestas.



## Exportación A: JSON funcional completo

Envelope distinto: formatVersion=`"1.0"`, kind=`"project-export"`, exportedAt UTC, project, exportScope, sections, questions (incluye todas las revisiones autorizadas), conditions, traceabilityReferences, assignments, responses, responseRevisions, evidence, revisionEvidence, clarifications/messages, validations/sources/messages, conflicts/participants/resolutions, dispositions, auditEvents e importBatches.

`exportScope` declara rol, alcance y exclusiones. ADMIN/ANALYST recibe todo el historial **enviado** y las decisiones, incluso revocadas; no recibe borradores privados ajenos. Los metadatos de auditoría de guardado pueden aparecer sin texto del borrador. STAKEHOLDER puede obtener copia individual de su historial por función de consulta, pero no exportación del proyecto. VIEWER solo exporta decisiones vigentes y sus fuentes permitidas, con kind=`"validated-decisions-export"`.

Todos los enlaces usan UUID y externalId, timestamps ISO 8601 UTC; números de revisión no se recalculan. Evidencia incluye id, nombre original, MIME, tamaño, SHA-256, autor/fecha y enlace autenticado, nunca storageKey/ruta/secreto. Binarios no se incrustan: export JSON no sustituye backup de DB+archivos. Audit before/after se filtra por acceso; incluye revocaciones sin exponer credenciales. Session y passwordHash jamás se exportan.

Los formatos export no son aceptados por el importador de estructura. Restauración completa o reintegración entre instancias es posterior, no una promesa de round-trip del MVP.

## Exportación B: CSV de estado

Una fila por Question, incluyendo filtros declarados: projectExternalId, sectionExternalId, questionExternalId, title, priority, responsibleArea, status, published, archived, submittedRespondents, requiredRespondents, validatedBy, validatedAt, validationId, traceabilityIds y exportedAt. Columnas de validación vacías si no hay decisión vigente. Referencias serializadas como array JSON en una celda entrecomillada; no perder múltiples enlaces por concatenaciones ambiguas.

UTF-8, encabezados estables, coma, escape de comillas/saltos de línea. Neutralizar celdas que puedan comenzar fórmula (`=`, `+`, `-`, `@`, tabuladores/control, incluso tras espacios) antes de abrir en Excel; esto no cambia externalId en BD o JSON. Documentar esa protección en el encabezado/README de exportación.

## Exportación C: Markdown

Documento con fecha/alcance y secciones por externalId. Para VALIDATED: pregunta y versión, decisión validada, alcance/excepciones, revisiones fuentes con respuesta original, evidencias con metadatos/hash y enlaces autenticados, analista, fecha, comentario, hilos/resolución citados y todas las referencias. Para otros estados: “Sin decisión validada vigente”; no presentar un borrador como respuesta aprobada. Un anexo puede incluir validaciones anteriores claramente revocadas para ADMIN/ANALYST.

Ejemplo de estructura, sin valores ficticiamente aprobados:

```markdown
## FORM-01
Estado: ANSWERED
Pregunta: ¿La solicitud necesita autorización antes de atenderse?
Decisión validada: Sin decisión validada vigente.
Respuesta enviada: [contenido de la revisión autorizada]
Evidencia: [nombre, SHA-256, enlace autenticado]
Validado por: —
Fecha de validación: —
Relacionada con: QUESTION/Q-001; BUSINESS_RULE/RN-001; REQUIREMENT/REQ-001
```

Escapar HTML/Markdown aportado por usuarios; enlaces solo HTTPS o descargas propias autorizadas. El exportador entrega un documento para revisión humana; no publica ni modifica repositorios externos.

## Implementación 2E y precisiones operativas

Contratos runtime: `templateInput`, `importPreviewView`, `importConfirmInput`, `importResultView`, `projectExportDocument` y `validatedDecisionsExportDocument` en @requirements/contracts. ExportScope declara rol, alcance y exclusiones. Los conjuntos históricos se presentan como arrays separados con UUID estables; QuestionRevisions y QuestionOptions no se aplanan ni renumeran.

Preview inválido retorna hasta 100 errores con JSON Pointer; no guarda archivo ni dominio. SHA-256 se calcula sobre bytes originales, no sobre JSON reserializado. El máximo de profundidad cuenta la raíz como nivel 1. Se rechazan claves peligrosas para prototipos también en objetos anidados. La configuración NUMBER se limita a valores seguros con seis decimales, de acuerdo con validación de respuestas.

Los localizadores documentales se preservan en QuestionRevision.sourceLocator; no se leen sus rutas. Áreas ya existentes deben coincidir en code/nombre y estar activas. Counts.areas indica áreas nuevas, no las ya resueltas. Las referencias sin enlaces pueden permanecer en el catálogo; «huérfana» significa enlace a una referencia inexistente, no obliga artificialmente a utilizar todo el catálogo.

Presupuesto de exportación síncrona: 100,000 registros y 32 MiB de representación JSON estimada por BD; archivo máximo 64 MiB, dos exportaciones por instancia. Esta precisión operativa no altera decisiones/estados ni promete restauración de backup. CSV prefija fórmulas con apóstrofo; no normaliza el dato original. Los datos de auditoría de borradores se reducen a metadatos seguros.
