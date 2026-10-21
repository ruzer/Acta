# Acta usability lab — protocolo

Estado: INVESTIGACIÓN CERRADA. Este archivo conserva el protocolo; conclusiones y propuestas se encuentran en documentos separados. Diez sesiones terminaron antes de la revisión heurística/técnica; propuestas posteriores a ambas.

## Pregunta y alcance

¿Puede alguien completar su trabajo correctamente sin capacitación sobre Acta? Evaluación de tareas, descubrimiento, esfuerzo, recuperación, escala y accesibilidad sobre el commit `8940be59e64d8bd5568e80a1b0cc2a7c3af033ca`.

Diez agentes independientes simulan personas; **no son diez participantes humanos**. El comportamiento observado prueba recorridos y fricción del sistema, pero no estima satisfacción real, adopción poblacional ni retención a dos meses. No se infiere cumplimiento WCAG completo de axe.

## Independencia y orden

1. Preparar datos ficticios en una instalación Docker descartable, separada de instalaciones existentes. Solo se crean datos mediante contratos existentes; no se modifica esquema, backend, frontend ni contratos.
2. Cada agente recibe una tarea de negocio y credenciales de prueba. Contexto nuevo, navegador y cuenta propios. No recibe explicaciones de controles, recorrido esperado, capacidades específicas ni hallazgos ajenos.
3. Interacción real en navegador: observar, decidir, actuar y volver a observar. Sin API de aplicación, SQL, mutaciones DOM ni atajos de automatización para completar tareas. La preparación de fixtures del coordinador no cuenta como éxito de un evaluador.
4. Guardar cronología y evidencia, separando error de usuario/producto de error de automatización o infraestructura. No proponer soluciones en las sesiones.
5. Solo después de las diez sesiones: evaluación heurística independiente, comprobaciones de accesibilidad y contraste de expected path frente a actual path.
6. Consolidar fricciones, patrones, severidad y prioridades. Separar observaciones, hipótesis causales y propuestas. No implementar.

## Personas y criterios de éxito

| ID | Persona | Objetivo observable |
|---|---|---|
| P01 | Administrador novato | Crear proyecto, temas y unas 10 preguntas; asignarlas y hacerlas disponibles para responder |
| P02 | Analista | Preparar 50 preguntas; organizar, encontrar faltantes y habilitar participación |
| P03 | Analista de escala | Preparar 300 preguntas para dos equipos y participantes conforme a temas |
| P04 | Participante novato | Entrar, comprender pendientes, guardar, salir, regresar, retomar y enviar |
| P05 | Participante ocupado | Responder lo conocido, conservar lo que requiere consulta y retomarlo después |
| P06 | Analista revisor | Encontrar aportaciones, consultar evidencia, pedir aclaración, comparar, resolver y validar |
| P07 | Administrador ocasional | Modificar contenido existente sin instrucciones de navegación |
| P08 | Usuario móvil | Completar tareas reales de participación a 390 px, incluyendo formulario y evidencia |
| P09 | Usuario de teclado | Modificar/preparar preguntas usando solo teclado; recuperar errores y conservar foco |
| P10 | Administrador open source | Entender producto/documentación pública, crear proyecto, importar y habilitar participación |

El recorrido esperado es el mínimo semántico permitido por contratos y UI, construido para el análisis posterior; no se muestra a las personas. Un resultado guardado/publicado debe confirmarse, no basta abrir un diálogo.

## Datos y límites

Contenido neutral sobre solicitudes y servicios de ejemplo. SMALL: 10 preguntas; MEDIUM: 50; LARGE: 300. Además 30 preguntas para la jornada breve. Ocho tipos de respuesta, agrupaciones estructurales y evidencia PDF ficticia. Cuentas distintas y proyectos separados evitan que una sesión complete trabajo de otra. No se usan datos personales, instituciones, evidencia real ni infraestructura productiva.

La instalación demo ya contiene algunos proyectos de ejemplo. Se registrarán posibles efectos de esos datos en la interpretación. La sesión open source comienza con una cuenta administrativa; no evalúa desde cero el proceso operativo de instalación.

## Registro y métricas

- Resultado por subtarea: COMPLETE / PARTIAL / BLOCKED / NOT ATTEMPTED, con evidencia.
- Acciones instrumentadas/estimadas, retrocesos, intentos fallidos, repetición y funciones descubiertas sin ayuda.
- Tiempo de sesión de agente y demoras de herramientas por separado. No convertir velocidad de agente en tiempo de usuario humano.
- Confianza: señales observables de alcance, feedback y reversibilidad; no puntuación emocional inventada.
- Severidad LOW / MEDIUM / HIGH / CRITICAL según consecuencia para la tarea y recuperación disponible. Frecuencia = personas/exposiciones observadas, no prevalencia poblacional.
- Capturas y transcript sin contraseñas, cookies o tokens. IDs ficticios no son evidencia de datos reales.

## Marcos de análisis

HEART se usa como mapa de futuras señales, no como datos de producción: [Google Research, Measuring the User Experience on a Large Scale](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).

La revisión de accesibilidad combina tareas y evaluación técnica; requiere después usuarios humanos y tecnologías de asistencia para validar experiencias no cubiertas aquí: [W3C, Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/) y [WCAG-EM](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/).

No hay commits, push, releases ni cambios funcionales en esta fase.
