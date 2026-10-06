# Comprobación técnica de accesibilidad — Acta

Fecha: 5 de octubre de 2026, 23: 08–23:19, America/Mexico_City (registro UTC 6 de octubre, 05: 08–05:19). Sitio local: http://localhost:4441. Chromium real headless 153.0.8010.12 mediante Playwright; axe-core 4.13.0; idioma del navegador en-US. No es certificación WCAG ni auditoría exhaustiva. No se consultaron informes de personas ni se modificó código de producto.

## Cobertura y evidencia

Diez interfaces representativas, con dos estados de error adicionales: **12 muestras finales axe**, cero reglas en `violations`, cero nodos en `violations`. Se ejecutaron 13 análisis: el primer análisis de error de matriz coincidió con un estado transitorio; se repitió al estabilizarse y se conservó el JSON final. Cuatro muestras tienen `incomplete`: cuatro instancias de regla, 15 nodos, dos reglas distintas. Una revisión manual no convierte estos resultados en conformidad.

| JSON de la muestra | Violaciones | Incomplete, nodos | Reglas que pasan |
|---|---:|---|---:|
| 01-login-axe.json | 0 | 0 | 28 |
| 02-editor-axe.json | 0 | color-contrast, 12 | 40 |
| 03-crear-pregunta-axe.json | 0 | 0 | 28 |
| 04-crear-error-axe.json | 0 | 0 | 32 |
| 05-organizar-axe.json | 0 | aria-prohibited-attr, 1 | 44 |
| 06-revisar-axe.json | 0 | 0 | 38 |
| 07-asignar-axe.json | 0 | color-contrast, 1 | 22 |
| 08-editar-axe.json | 0 | 0 | 29 |
| 09-publicar-axe.json | 0 | color-contrast, 1 | 17 |
| 10-mi-trabajo-axe.json | 0 | 0 | 36 |
| 11-responder-matriz-axe.json | 0 | 0 | 41 |
| 12-matriz-error-axe.json | 0 | 0 | 41 |

Los JSON no incluyen contraseñas, cookies ni tokens. `transcript.jsonl` registra acciones, DOM accesible y foco; `audit-summary.json` contiene los conteos. Hay 25 capturas PNG. No se exporta el archivo de credenciales como evidencia.

## Hallazgos

### A11Y-01 — ISSUE — Escape pierde el foco al cerrar Asignar participante y Publicar pregunta

Proyecto «Preparación del servicio — Teclado». Apertura mediante Enter desde la acción enfocada del menú, sin guardar ni confirmar:

| Diálogo | Antes de Enter | Foco dentro | Tras Escape |
|---|---|---|---|
| Asignar participante / Canal de entrada | BUTTON «Asignar participantes» | BUTTON «Cerrar» | BODY, sin contorno visible; menú cerrado |
| Publicar pregunta / Información necesaria | BUTTON «Publicar» | BUTTON «Cerrar» | BODY, sin contorno visible; menú cerrado |
| Editar pregunta / Información necesaria | BUTTON «Editar pregunta» | TEXTAREA `question` | SUMMARY «Acciones de Información necesaria», contorno de 3 px |
| Agregar pregunta / Recepción de solicitudes | BUTTON «+ Agregar pregunta» | TEXTAREA `question` | BUTTON «+ Agregar pregunta», contorno de 3 px |

En Asignar, un Tab adicional todavía produjo BODY. No se observó restitución al abridor ni al summary de esa pregunta en los dos diálogos afectados. La pérdida se refiere a `document.activeElement` y continuidad visible del foco; no se hizo ensayo con lector de pantalla. Evidencia: registros 05:15:31, 05:15:42, 05:16: 03 y 05:16:17 UTC; `07-asignar.png`, `08-editar.png`, `09-publicar.png`.

### A11Y-02 — ISSUE — Resumen de errores de Crear usa enlaces indistinguibles

Al intentar crear sin rellenar campos, los tres enlaces del resumen anuncian exactamente «Please fill out this field.», tienen `href="#"` y carecen de `aria-label` que nombre el campo. En el resumen no puede distinguirse Pregunta, Identificador externo y Título breve por su nombre accesible. El idioma inglés corresponde al navegador en-US; no se afirma que ocurra igual con navegador en español.

Los campos individuales sí reciben `aria-invalid="true"` y `aria-describedby` hacia su propio mensaje; el foco vuelve a Pregunta y existe resumen `role="alert"`. Por tanto, no hay ausencia global de asociación ni ausencia de identificación de error. No se siguieron los enlaces individuales para evaluar su manejador. Evidencia: `04-crear-error-axe.json`, `03-crear-error.png`, registros 05:10:31 y 05:10:43 UTC.

### A11Y-03 — ISSUE — Nombre ARIA colocado sobre contenedor sin rol en Organizar

`div.qe-selection-controls` tiene `aria-label="Alcance de selección"` sin rol semántico. Axe lo deja en `incomplete` de `aria-prohibited-attr`; el DOM confirma el atributo en un `div` genérico y el snapshot no expone un grupo con ese nombre. Sus dos botones sí tienen nombres distinguibles («Seleccionar esta página (10)» y «Seleccionar todos los resultados (10)»). Es una anomalía semántica acotada al nombre de agrupación, sin pérdida observada de nombre de los botones. No se infiere comportamiento de todos los lectores de pantalla. Evidencia: `05-organizar-axe.json` y snapshot 05:11: 03 UTC.

### A11Y-04 — NOT OBSERVED — Falta de etiquetas en los controles representativos

Usuario y Contraseña, campos visibles de Crear/Editar, radios de tipo, selector Participante y tres selectores de matriz tienen nombres accesibles. En matriz, las etiquetas son «Recepción de solicitud», «Resultado de revisión» y «Cierre de solicitud»; pertenecen al fieldset «Tu respuesta por fila». No se observaron violaciones de etiquetas en las 12 muestras. Esto no cubre todos los formularios, estados, iconos ni adjuntos del producto.

### A11Y-05 — NOT OBSERVED — Fallo de contraste confirmado en la muestra; quedan dos comprobaciones manuales abiertas

Los 12 nodos de contraste incompleto del editor son los símbolos ⋯ de menús. Axe informa `nonBmp` (solo caracteres no textuales), no contraste insuficiente. Color calculado de los 12: rgb(27,29,34), tamaño 24 px. Para el primer menú de tema se comprobó cadena de ancestros con fondo blanco opaco, sin imagen: razón calculada 16.86:1. No se midieron por separado todos los fondos de los 12 símbolos.

Los dos incompletos restantes de contraste son párrafos de ayuda en Asignar y Publicar: axe no pudo determinar fondo por solapamiento parcial. Inspección visual de las capturas los muestra legibles, sin texto recortado, sobre el diálogo blanco. **NOT TESTED:** razón de contraste individual exacta de estos dos párrafos y de todos los estados hover/disabled/focus. Permanecen como revisión manual pendiente, no como passes añadidos ni violaciones confirmadas.

### A11Y-06 — NOT OBSERVED — Bloqueo de teclado en los recorridos probados

Login: Tab recorre Usuario → Contraseña → Iniciar sesión; contorno computado rgb(174,98,12), sólido, 3 px. Enter vacío activa validación nativa y enfoca Usuario.

Crear: se probaron 16 Tab consecutivos, pasando por ayuda, radio seleccionado, obligatoriedad, identificador, título, configuración avanzada, Crear, Cancelar y reinicio del diálogo. El foco pasó transitoriamente por BODY; no se alcanzaron controles interactivos del fondo durante ese ciclo. No se certifica un atrapamiento perfecto de foco ni comportamiento de navegador con interfaz visible.

Pestañas: ArrowRight desde Escribir enfocó/seleccionó Organizar y después Revisar; se verificaron `aria-selected` y roving tabindex 0/-1. El foco visible fue de 3 px.

Matriz: activar «Ir al contenido» dejó activeElement en BODY, pero el Tab siguiente fue al primer select de la matriz, saltando la cabecera. Siete Tab consecutivos recorrieron tres selectores, comentario, Agregar ejemplo, Adjuntar evidencia y Necesito consultar esto. Contorno computado azul de 2 px más sombra de 3 px. No se cambiaron valores ni se probaron todos los comandos de selección, adjuntos o consulta. Las pérdidas de foco al cerrar diálogos se consignan por separado en A11Y-01.

### A11Y-07 — NOT OBSERVED — Desbordamiento horizontal del documento a 390/320 CSS px

Se probaron Organizar, Crear, Mi trabajo y matriz con error a **390×800** y **320×800 CSS px**: ocho observaciones. En todas, `documentElement.scrollWidth` y `body.scrollWidth` coinciden con el ancho del viewport. Capturas comparables por interfaz y ancho: `organizar-390/320.png`, `crear-390/320.png`, `mi-trabajo-390/320.png`, `matriz-390/320.png`. Se inspeccionaron visualmente las capturas de 320 px de Organizar, Crear y matriz: texto reorganizado y controles dentro del ancho; Crear conserva pie de acciones y cuerpo desplazable.

El barrido geométrico de Crear a 320 px listó seis botones de menús del documento de fondo; estaban dentro de details cerrados, fuera del diálogo activo. Este barrido no filtraba el cierre de details y no se toma como desbordamiento visible confirmado.

Se emuló ancho reducido, **no zoom real del navegador**. 320 CSS px reproduce la anchura disponible de una ventana base de 1280 CSS px al 400%, pero no reproduce todo el comportamiento de zoom, tamaño físico ni altura equivalente. **NOT TESTED:** zoom de texto 200%, zoom real 400%, totalidad de contenido desplazado o todos los formularios en esos anchos.

### A11Y-08 — NOT OBSERVED — Animación activa en editor con o sin reduced motion

En editor de diez preguntas se emuló `prefers-reduced-motion` primero `no-preference` y después `reduce`. `matchMedia` cambió false → true. En ambos casos: scroll-behavior `auto`; ningún elemento con animation-name distinto de none o transition-duration mayor que cero en el barrido computado; las capturas no muestran diferencia de disposición. Evidencia: `motion.json`, `editor-motion-no-preference.png`, `editor-motion-reduce.png`.

**NOT TESTED:** secuencias temporales de animaciones, animaciones activadas por interacción, pseudos, transiciones de otras pantallas ni preferencia del sistema operativo. La ausencia de movimiento en un estado estático no demuestra soporte integral de reduced motion.

### A11Y-09 — NOT OBSERVED — Ausencia total de asociación del error de matriz

Tras la respuesta vacía, aparece alerta enfocada «Esta pregunta necesita una respuesta completa» y mensaje dentro de `fieldset`. El fieldset tiene `aria-describedby="_r_27_"` hacia ese mensaje. Los tres select conservan `aria-invalid="false"` y no tienen descripción individual; esta evidencia no permite afirmar ausencia total de asociación. No se comprobó anuncio real mediante lector de pantalla. Evidencia: `12-matriz-error-axe.json`, `12-matriz-error-settled.png`, lectura DOM 05:18:30 UTC.

## Desviación de ejecución y conservación de datos

El ensayo técnico posterior a la sesión P04 **creó un borrador vacío inesperado**. Se pulsó Enviar respuesta en la matriz vacía para observar validación, esperando un bloqueo local. La aplicación pasó por «Guardando…», rechazó la respuesta incompleta y mostró «No se pudo guardar». Al volver a Mi trabajo, los conteos cambiaron de **9 pendientes / 0 borradores / 1 enviada** a **8 pendientes / 1 borrador / 1 enviada**. No se rellenó ningún campo y no aumentaron las respuestas enviadas. Por ello, esta revisión no puede describirse como completamente de solo lectura. El intento no fue exclusivamente validación local.

El borrador no se eliminó ni alteró para ocultar el efecto. No se usaron APIs de aplicación ni SQL para modificar datos, no se guardó asignación, no se confirmó publicación y no se cambió código. La observación corresponde al ensayo técnico posterior; no modifica retroactivamente el resultado de P04 al cierre de su sesión. Evidencia: `10-mi-trabajo.png`, `13-mi-trabajo-after-validation.png`, registros 05:17:14–05:19: 08 UTC.

## Límites restantes

**NOT TESTED:** lectores de pantalla (VoiceOver/NVDA/JAWS), navegación táctil, dictado, alto contraste/forced-colors, OS reduced motion, múltiples navegadores, tablas de administración, importación completa, gestión de miembros, cargas/descargas y edición de respuestas enviadas. Los nombres/roles del snapshot y axe son evidencia técnica, no sustituyen pruebas con tecnologías de asistencia. No se formula declaración WCAG ni propuestas de reparación.

El navegador fue cerrado y confirmado a las 05:19:21 UTC. Los datos quedaron intactos desde la observación final del borrador inesperado.

## Evidencias enlazadas

- [01-login-axe.json](accessibility/01-login-axe.json)
- [01-login-keyboard-focus.png](accessibility/01-login-keyboard-focus.png)
- [01-login.png](accessibility/01-login.png)
- [02-editor-axe.json](accessibility/02-editor-axe.json)
- [02-editor.png](accessibility/02-editor.png)
- [03-crear-error.png](accessibility/03-crear-error.png)
- [03-crear-pregunta-axe.json](accessibility/03-crear-pregunta-axe.json)
- [03-crear-pregunta.png](accessibility/03-crear-pregunta.png)
- [04-crear-error-axe.json](accessibility/04-crear-error-axe.json)
- [05-organizar-axe.json](accessibility/05-organizar-axe.json)
- [05-organizar.png](accessibility/05-organizar.png)
- [06-revisar-axe.json](accessibility/06-revisar-axe.json)
- [06-revisar.png](accessibility/06-revisar.png)
- [07-asignar-axe.json](accessibility/07-asignar-axe.json)
- [07-asignar.png](accessibility/07-asignar.png)
- [08-editar-axe.json](accessibility/08-editar-axe.json)
- [08-editar.png](accessibility/08-editar.png)
- [09-publicar-axe.json](accessibility/09-publicar-axe.json)
- [09-publicar.png](accessibility/09-publicar.png)
- [10-mi-trabajo-axe.json](accessibility/10-mi-trabajo-axe.json)
- [10-mi-trabajo.png](accessibility/10-mi-trabajo.png)
- [11-responder-matriz-axe.json](accessibility/11-responder-matriz-axe.json)
- [11-responder-matriz.png](accessibility/11-responder-matriz.png)
- [12-matriz-error-axe.json](accessibility/12-matriz-error-axe.json)
- [12-matriz-error-settled.png](accessibility/12-matriz-error-settled.png)
- [12-matriz-error.png](accessibility/12-matriz-error.png)
- [13-mi-trabajo-after-validation.png](accessibility/13-mi-trabajo-after-validation.png)
- [audit-summary.json](accessibility/audit-summary.json)
- [crear-320.png](accessibility/crear-320.png)
- [crear-390.png](accessibility/crear-390.png)
- [editor-motion-no-preference.png](accessibility/editor-motion-no-preference.png)
- [editor-motion-reduce.png](accessibility/editor-motion-reduce.png)
- [matriz-320.png](accessibility/matriz-320.png)
- [matriz-390.png](accessibility/matriz-390.png)
- [mi-trabajo-320.png](accessibility/mi-trabajo-320.png)
- [mi-trabajo-390.png](accessibility/mi-trabajo-390.png)
- [motion.json](accessibility/motion.json)
- [organizar-320.png](accessibility/organizar-320.png)
- [organizar-390.png](accessibility/organizar-390.png)
- [reflow.json](accessibility/reflow.json)

El transcript técnico queda en el laboratorio, fuera del árbol de documentos; los JSON y capturas enlazados son la evidencia consolidada. Las referencias horarias permiten contrastar el registro original si se requiere.
