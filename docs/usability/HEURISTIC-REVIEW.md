# Evaluación heurística independiente de Acta

Fecha: 5 de octubre de 2026, aproximadamente 23: 08–23:13, America/Mexico_City (registros UTC del 6 de octubre).

## Alcance y método

Inspección independiente en navegador real de `http://localhost:4441`, con la cuenta de rol **Analista**, en **Preparación del servicio — Teclado**. Se recorrieron Mis proyectos, Resumen, revisión de Canal de entrada, bandeja Revisión, filtros, editor Escribir/Organizar/Revisar, edición de un borrador, configuración avanzada, vista previa y formulario de asignación abierto desde una advertencia.

No se leyeron sesiones de personas, sus conclusiones, código, pruebas ni documentación de usabilidad. Esta es una evaluación de propiedades observadas de la interfaz, no evidencia de comportamiento humano, comprensión, satisfacción o éxito de usuarios. Los juicios negativos señalan tensiones heurísticas dentro del recorrido; no constituyen tasas de error ni defectos de implementación confirmados.

No se guardaron cambios de datos. Se escribió temporalmente un título en el formulario de edición y se descartó mediante su confirmación nativa; al reabrir, el título seguía siendo «Información necesaria». La vista previa declaró que era una simulación local sin respuestas ni borradores; se aplicó un valor vacío únicamente allí. Se cerraron los formularios y el navegador al terminar. No se usaron APIs, SQL, cambios del DOM ni acciones forzadas.

## Evaluación por heurística

### 1. Visibilidad del estado

- **Positivo:** el resumen ofrece «Sin revisar», cantidades y métricas con denominadores; aclara que una respuesta enviada aún necesita revisión. La pregunta distingue «Sin respuestas vigentes» y «Falta respuesta» del participante. El editor muestra «Publicada»/«Borrador» y el formulario distingue «Sin cambios pendientes» de «Cambios sin guardar». Al filtrar se observó «Cargando información…» y después «0 preguntas encontradas».
- **Evidencia:** H02, H03, H06, H07, H08, H10, H11.
- **Limitación:** no se evaluó retroalimentación después de guardar, publicar, enviar o fallar una operación remota. El proyecto tenía tres preguntas publicadas sin respuestas, por lo que no se inspeccionaron todos los estados de revisión.

### 2. Lenguaje humano y correspondencia con el trabajo

- **Positivo:** «Prepara las preguntas, asigna participantes y publica cuando el contenido esté listo», «Texto breve», «Una opción», «Varias opciones» y la advertencia «nadie podrá responder todavía» expresan tareas y consecuencias concretas.
- **Negativo:** en Revisar aparecen «el servidor vuelve a validar permisos, versiones y reglas», «publicación atómica» y «metadatos permitidos». Son términos de implementación dentro de una tarea operativa. En Mis proyectos, la cuenta Analista recibe además «Guarda tus borradores y envía cada respuesta…», aunque sus accesos visibles son resumen, revisión y edición; esa instrucción no corresponde de forma directa a esos accesos.
- **Evidencia:** H01, H10, H16.
- **Limitación:** no se midió si los destinatarios conocen esos términos ni si la cuenta puede asumir otros roles en contextos no recorridos.

### 3. Control y libertad del usuario

- **Positivo:** la edición ofrece Cerrar y Cancelar; ante un título modificado, Cancelar solicita «Hay cambios sin guardar en esta pregunta. ¿Descartarlos?». Rechazar la confirmación conserva el formulario y aceptar lo cierra. La vista previa dispone de «Volver al cuestionario». «Limpiar filtros» recuperó las tres preguntas después del resultado vacío.
- **Negativo:** el regreso «← Revisión» desde una pregunta abierta en Resumen lleva a la bandeja general `/review`, con Proyecto en «Todos»; no regresa al resumen desde el que se entró. Es una discontinuidad observable en el recorrido, sin afirmar que cause desorientación.
- **Evidencia:** H03, H05, H07, H11, H12, H13. La confirmación nativa está registrada como mensaje observado en esta inspección; las capturas H11/H12 muestran antes y después, no el diálogo nativo.
- **Limitación:** no se probaron deshacer cambios guardados, navegación con datos sucios fuera del formulario ni conservación de filtros entre varios proyectos. Solo había un proyecto accesible.

### 4. Consistencia y convenciones

- **Positivo:** las etiquetas Publicada/Borrador y las acciones de cada pregunta mantienen el patrón entre Escribir y Organizar. Mis proyectos permanece en la navegación superior. Los formularios observados tienen un control Cerrar con texto.
- **Negativo:** «Revisar» designa la preparación del cuestionario dentro del editor, mientras «Revisión» se refiere a aportaciones de participantes. La propia pestaña agrega una explicación que distingue ambas. Además, al editar una pregunta hay Cerrar y Cancelar, mientras en Asignar participante la única salida visible es Cerrar; cambia la convención de salida del formulario.
- **Evidencia:** H05, H08, H10, H15, H16, H18.
- **Limitación:** se observó solo este conjunto de pantallas; no se afirma inconsistencia global de todo Acta ni confusión real de usuarios.

### 5. Prevención de errores

- **Positivo:** la salida de un formulario modificado solicita confirmación antes de descartar. Revisar muestra por pregunta la falta de participantes, su consecuencia y que no bloquea la publicación. La vista previa informa antes de operar que no crea respuestas ni borradores. La configuración avanzada aclara que asignar área responsable no asigna participantes automáticamente.
- **Evidencia:** H11, H12, H13, H16, H20.
- **Limitación:** no se verificaron los mecanismos que previenen una publicación incorrecta ni las validaciones al guardar. La revisión automática del entorno rechazó abrir «Publicar: Información necesaria» por el riesgo de una escritura persistente; el clic no se ejecutó. No se reintentó ni se usó otra vía. Esto es una limitación de la evaluación, no un defecto de Acta.

### 6. Reconocimiento en lugar de memoria

- **Positivo:** preguntas agrupadas por tema, estado y tipo visibles; los seguimientos indican su pregunta principal. La vista previa lista los títulos y permite seleccionar una pregunta. El formulario de identificación explica el propósito del título y del identificador externo.
- **Negativo:** Prioridad ofrece P0, P1, P2 y P3 sin una definición visible en el filtro de revisión ni en Configuración avanzada. Para interpretar el significado operativo de cada nivel hace falta conocimiento que esas pantallas no muestran.
- **Evidencia:** H05, H08, H13, H15, H20.
- **Limitación:** no se buscó una guía externa ni se evaluaron convenciones internas de la organización; podría existir un significado compartido fuera de la interfaz recorrida.

### 7. Flexibilidad y eficiencia

- **Positivo:** Organizar reúne búsqueda, selección por tema, filtros por área y publicación, y selección de página o todos los resultados. La bandeja Revisión ofrece seis dimensiones de filtro. Las advertencias tienen «Ir a corregir»: el de Próxima revisión abrió directamente Asignar participante con esa pregunta identificada.
- **Negativo:** la bandeja Revisión recorrida no mostró búsqueda textual, mientras Organizar sí la ofrece. Para localizar una pregunta por una frase, las capacidades visibles difieren según la tarea.
- **Evidencia:** H05, H15, H16, H18.
- **Limitación:** solo diez preguntas en el editor y tres publicadas; no se ejecutaron operaciones masivas, no se compararon tiempos y no se evaluaron grandes volúmenes ni atajos de teclado.

### 8. Diseño minimalista y relevancia

- **Positivo:** Escribir presenta el enunciado y estado; agrupa acciones en un menú. La configuración avanzada y la trazabilidad son desplegables. El formulario de edición mantiene a la vista Guardar cambios, Cancelar y el estado de cambios mientras su contenido es desplazable.
- **Negativo:** en Revisar, siete preguntas repiten la misma advertencia de falta de participantes y después aparecen tres avisos de contenido protegido y otra lista de publicación. En el contexto concreto se repiten enunciados y consecuencias en una pantalla extensa. Es densidad/repetición observada, no una afirmación de carga cognitiva medida.
- **Evidencia:** H08, H09, H10, H16, H20.
- **Limitación:** evaluación visual en una ventana de escritorio de 1440 × 1000; no se revisaron móvil, zoom, preferencias visuales ni variaciones de contenido.

### 9. Reconocer, diagnosticar y recuperarse de problemas

- **Positivo:** el resultado vacío dice «No hay preguntas para estos filtros», conserva el estado seleccionado y muestra Limpiar filtros; esa acción recuperó resultados. Las advertencias antes de publicar identifican la pregunta, la causa y una acción que abre el formulario pertinente.
- **Negativo:** el texto secundario del resultado vacío explica dónde aparecerán preguntas publicadas, pero no señala cuál de los filtros activos causa la exclusión; la explicación del encabezado y el control Limpiar filtros son los únicos apoyos explícitos observados para esa recuperación.
- **Evidencia:** H07, H16, H18; retorno de tres resultados tras Limpiar filtros observado en el registro del recorrido.
- **Limitación:** no se provocaron fallos del servidor, errores de autorización, conflictos de versión ni envíos inválidos. Aplicar una cadena vacía en la simulación produjo «Valor aplicado solo en esta vista previa»; eso no demuestra cómo valida la respuesta real ni constituye una prueba de error de guardado.

### 10. Ayuda contextual

- **Positivo:** el editor explica su secuencia de trabajo, la identificación explica para qué sirven sus campos y Configuración avanzada distingue área responsable de asignación. Asignar participante explica la relación entre una pregunta condicionada y su principal. La vista previa declara su carácter temporal antes y después de aplicar un valor.
- **Negativo:** no se observó explicación junto a los códigos de opción email/phone/portal ni de sus restricciones; Prioridad tampoco expone la semántica P0–P3 en los lugares inspeccionados. La ayuda es concreta en algunas relaciones del modelo, pero desigual entre campos.
- **Evidencia:** H10, H13, H14, H18, H20.
- **Limitación:** solo se evalúa la ayuda local visible en el recorrido. No se investigaron documentación externa ni mecanismos de ayuda en otras secciones.

## Registro de evidencia

Cada Hxx refiere a una observación propia en esta sesión. Las capturas están en esta misma carpeta. Las URL y los árboles accesibles se observaron mediante `snap()`; `transcript.jsonl` conserva la secuencia de acciones del recorrido, no sustituye las capturas.

| Evidencia | Archivo | Contexto |
|---|---|---|
| H01 | `H01-mis-proyectos.png` | Rol, accesos de analista e instrucción de borradores/respuestas |
| H02 | `H02-resumen.png` | Resumen y acceso a preguntas que requieren atención |
| H03 | `H03-revision-pregunta-estable.png` | Pregunta sin respuestas y estado/participante |
| H04 | `H04-trazabilidad-desplegada.png` | Despliegue sin referencias vinculadas |
| H05 | `H05-lista-revision.png` | Bandeja general, filtros y preguntas |
| H06 | `H06-filtro-vacio.png` | Estado transitorio de carga después de filtrar |
| H07 | `H07-filtro-vacio-estable.png` | Resultado vacío estable y Limpiar filtros |
| H08 | `H08-editor.png` | Escribir: temas, tipos, estados y seguimientos |
| H09 | `H09-menu-acciones.png` | Menú de acciones de un borrador |
| H10 | `H10-editar-pregunta.png` | Formulario de edición y estado sin cambios |
| H11 | `H11-salida-cambios.png` | Formulario aún abierto después de rechazar descarte |
| H12 | `H12-cancelacion-confirmada.png` | Regreso al editor después de aceptar descarte |
| H13 | `H13-vista-previa.png` | Simulación local, selectores y regreso al cuestionario |
| H14 | `H14-simulacion-vacia.png` | Mensaje al aplicar un valor vacío solo en simulación |
| H15 | `H15-organizar.png` | Búsqueda, filtros y selección de resultados |
| H16 | `H16-revisar-publicacion.png` | Advertencias, lenguaje técnico y accesos de corrección |
| H18 | `H18-ir-a-corregir.png` | Formulario pertinente abierto desde una advertencia |
| H19 | `H19-configuracion-avanzada.png` | Configuración desplegada, título original al reabrir |
| H20 | `H20-ayuda-prioridad.png` | Detalle visible de ayuda, identificación y prioridad |

H17 no existe: el intento de abrir publicación fue rechazado por el entorno antes de ejecutarse. `H03-revision-pregunta.png` corresponde a una captura transitoria temprana y no se usa para juzgar la pantalla estable. No se infieren problemas de rendimiento a partir de esos instantes de transición.

## Límites de cierre

Inspección completada dentro del alcance permitido. No hay conclusiones sobre conducta de las diez personas ni comparación con sus sesiones. No hay propuestas de solución ni cambios funcionales. La publicación, persistencia de asignaciones y recuperación de errores remotos quedan sin evaluar. El navegador se cerró al finalizar.

## Capturas enlazadas

- [H01-mis-proyectos.png](heuristic/H01-mis-proyectos.png)
- [H02-resumen.png](heuristic/H02-resumen.png)
- [H03-revision-pregunta-estable.png](heuristic/H03-revision-pregunta-estable.png)
- [H04-trazabilidad-desplegada.png](heuristic/H04-trazabilidad-desplegada.png)
- [H05-lista-revision.png](heuristic/H05-lista-revision.png)
- [H06-filtro-vacio.png](heuristic/H06-filtro-vacio.png)
- [H07-filtro-vacio-estable.png](heuristic/H07-filtro-vacio-estable.png)
- [H08-editor.png](heuristic/H08-editor.png)
- [H09-menu-acciones.png](heuristic/H09-menu-acciones.png)
- [H10-editar-pregunta.png](heuristic/H10-editar-pregunta.png)
- [H11-salida-cambios.png](heuristic/H11-salida-cambios.png)
- [H12-cancelacion-confirmada.png](heuristic/H12-cancelacion-confirmada.png)
- [H13-vista-previa.png](heuristic/H13-vista-previa.png)
- [H14-simulacion-vacia.png](heuristic/H14-simulacion-vacia.png)
- [H15-organizar.png](heuristic/H15-organizar.png)
- [H16-revisar-publicacion.png](heuristic/H16-revisar-publicacion.png)
- [H18-ir-a-corregir.png](heuristic/H18-ir-a-corregir.png)
- [H19-configuracion-avanzada.png](heuristic/H19-configuracion-avanzada.png)
- [H20-ayuda-prioridad.png](heuristic/H20-ayuda-prioridad.png)
