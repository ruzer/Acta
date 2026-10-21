# Simplicity review — oportunidades, no alcance aprobado

Preparado **después de cerrar las diez sesiones, la revisión heurística y el ensayo técnico**. Cada fila es una pregunta de simplificación basada en evidencia. Las veinte filas no son veinte features, ni compromisos de implementación: varias son maneras alternativas de abordar una misma fricción. Mantener autorizaciones, inmutabilidad, validaciones, concurrencia, alcance explícito y diferenciación entre guardar/enviar y resolver/validar.

## 5 REMOVE — qué coste podría desaparecer

| Candidato | Evidencia | Límite |
|---|---|---|
| Recorrer navegación global de nuevo para volver a la pregunta al cerrar una operación | FRICTION-001 | No eliminar diálogo ni confirmación; eliminar la pérdida de posición |
| Interpretar un bloqueo individual como impedimento de publicar el conjunto válido | FRICTION-002 | No retirar validaciones ni permitir hijos sin principal cuando sea inválido |
| Leer un aviso idéntico de contenido protegido por cada pregunta ya publicada | FRICTION-011 | Conservar estado y acceso a detalle; no ocultar errores individuales |
| Leer instrucciones de participante para iniciar trabajo administrativo | FRICTION-008; heurística H01 | Personalizar orientación según permisos reales; no inventar capacidades |
| Descifrar términos de implementación para decidir una acción cotidiana | FRICTION-011; H16 | Explicar consecuencias prácticas y conservar detalle técnico donde sirva |

## 5 SIMPLIFY — qué recorrido podría ser más corto/claro

| Candidato | Evidencia | Límite |
|---|---|---|
| Entender la relación entre pertenecer al proyecto y tener preguntas asignadas | FRICTION-007 | No asignar implícitamente miembros o áreas |
| Pasar de crear proyecto a trabajar en él | FRICTION-008 | No crear contenido ni membresías extra por conveniencia |
| Encontrar la importación desde el contexto de cuestionario vacío | FRICTION-005 | Reutilizar importación/preview/confirmación existentes |
| Interpretar qué queda pendiente, reservado o enviado | FRICTION-004 | No introducir un estado formal nuevo; conservar datos y semántica |
| Reconocer a quién le toca actuar después de una aclaración | FRICTION-006 | Basarse en hilo/autor/respuesta real, no fingir notificaciones o leído/no leído |

## 5 AUTOMATE OR DEFAULT — qué recuperación podría hacerse segura

| Candidato | Evidencia | Condición de seguridad |
|---|---|---|
| Devolver el foco al control/pregunta de origen | FRICTION-001 | Destino existente y visible; alternativa lógica si desapareció |
| Restituir contexto al regresar a la bandeja | FRICTION-013 | Filtros vigentes y accesibles, sin ampliar permisos |
| Reutilizar contexto de trabajo después de un lote | FRICTION-009 | No conservar ciegamente IDs/versiones obsoletos ni aplicar una acción nueva automáticamente |
| Reducir reselección de fuentes ya usadas mediante una sugerencia revisable | FRICTION-014 | Ninguna fuente se acepta ni decisión se valida sin confirmación; evaluar antes si aporta valor |
| Hacer que el resumen represente todo el trabajo conservado | FRICTION-004 | Derivar de datos reales y verificar reglas de conteo; no añadir métricas ficticias |

## 5 BETTER DISCOVERABILITY — qué ya existe y cuesta encontrar

| Capacidad/relación | Evidencia | Pregunta para validar con personas |
|---|---|---|
| Operaciones conjuntas en Organizar | FRICTION-003 | ¿Se reconoce esa ruta desde donde alguien prepara/publica por primera vez? |
| Importación dentro del proyecto | FRICTION-005 | ¿La guía nombra un acceso que una persona encuentra desde su punto de entrada? |
| Preguntas reservadas para consultar | FRICTION-004 | ¿Puede encontrarlas y conocer su cantidad sin probar varios filtros? |
| Respuesta nueva dentro de una aclaración abierta | FRICTION-006 | ¿La bandeja comunica el siguiente actor sin abrir cada detalle? |
| Movimiento individual dentro del detalle de pregunta | P02-O03 | ¿Se distingue seleccionar para un lote de abrir una pregunta para moverla? No inventar movimiento masivo |

## Qué no se propone

No añadir otro modo, inspector, menú global, wizard o dashboard como respuesta automática. No borrar IDs, fusionar roles, autogenerar datos contractuales, publicar sin preview, preseleccionar fuentes de decisión sin revisión ni eliminar confirmaciones. La siguiente decisión corresponde al usuario: elegir problemas, no aprobar de una vez todas estas oportunidades.
