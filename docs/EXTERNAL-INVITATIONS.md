# Responder mediante una invitación privada

> Capacidad en validación en esta rama. La publicación depende de los gates de
> seguridad, navegador y CI descritos en el [plan técnico](EXTERNAL-INVITATIONS-DESIGN.md).

Una invitación permite responder preguntas concretas sin crear una cuenta ni
recordar una contraseña. Se utiliza para una aportación puntual. Para trabajo
habitual, administración de proyectos o revisión de respuestas, utiliza una cuenta.

## Qué garantiza el enlace

El backend limita el acceso a un proyecto y a las preguntas seleccionadas.
Cada invitación conserva sus propios borradores, envíos, evidencia y aclaraciones.
Crear tres invitaciones a la misma pregunta produce tres aportaciones
independientes. El envío de una no completa ni sobrescribe las otras.

El enlace es una credencial: quien lo tenga puede usarlo hasta que venza o sea
revocado. **No verifica la identidad física de quien responde**, ni la propiedad
de un correo. El nombre registrado describe al destinatario previsto. No hay OTP,
verificación por correo ni envío automático de invitaciones.

No compartas un enlace entre varias personas. No lo publiques en un sitio,
chat grupal, captura de pantalla, ticket o informe. Para otra persona, crea otra
invitación. Si se comparte por error, revócala; si sigue siendo necesario recibir
la aportación, crea una nueva y comunica el cambio al destinatario.

## Crear una invitación

Como analista o administrador del proyecto:

1. Abre el editor y entra a **Organizar**.
2. Selecciona entre 1 y 500 preguntas **publicadas** y elige **Invitar mediante enlace**.
   Esta acción no publica borradores. Si una pregunta tiene una condición,
   selecciona también las preguntas de las que depende; no se añaden en secreto.
3. Escribe una referencia para distinguir la invitación y los datos del
   destinatario requeridos por la instalación.
4. Selecciona el **Área de la aportación**. Es contexto de la respuesta;
   no es una comprobación de afiliación ni una asignación automática de identidad.
5. Define el vencimiento o utiliza el plazo predeterminado. Decide explícitamente
   si permites adjuntar y descargar evidencia propia.
6. Revisa las preguntas incluidas y pulsa **Crear enlace privado**.
7. Copia el enlace y compártelo directamente con la persona por un canal adecuado.
   Acta lo muestra al crearlo; no conserva una copia recuperable del token.

Si pierdes el enlace o su creación se completó pero no recibiste la respuesta,
consulta **Invitaciones mediante enlace** antes de crear otra aportación.
Puedes renovar la invitación existente: obtendrás un nuevo enlace para el mismo
avance y el anterior dejará de funcionar.

La selección puede hacerse por pregunta, grupo o filtros mediante las operaciones
existentes de Organizar. Cada creación sigue representando una sola invitación;
no hay una carga masiva de destinatarios en esta fase. Un seguimiento agrupado
no se convierte automáticamente en una pregunta condicional.

## Responder, guardar y continuar

1. Abre el enlace privado. Verás el contexto del proyecto, las preguntas y el avance.
2. Elige **Responder**, completa los campos y pulsa **Guardar borrador**.
3. Puedes volver a la lista, salir y abrir el **enlace original** para continuar.
   Conserva ese enlace de forma privada: la dirección que queda en el navegador
   después de abrirlo ya no contiene la credencial.
4. Cuando la respuesta esté lista, pulsa **Enviar respuesta** y confirma.
   El envío se hace por pregunta, no por todo el cuestionario a la vez.
5. Comprueba la confirmación **Respuesta enviada**.

Los cambios sin guardar no se conservan automáticamente. Una pérdida de conexión
no equivale a un guardado confirmado. Si dos ventanas editan a la vez, Acta puede
rechazar una versión desactualizada; conserva tu texto antes de actualizar.

Tras enviar puedes consultar tu respuesta mientras el enlace esté vigente.
**Preparar una corrección** crea un nuevo borrador; al enviarlo se crea otra
versión de la misma respuesta, conservando la anterior. Como en una cuenta
tradicional, un nuevo envío puede exigir revisar de nuevo una decisión existente.
No crea otra persona ni sobrescribe las respuestas de los demás.

Las preguntas condicionales dependen de tus propias respuestas. Tener una
invitación no elimina las reglas de aplicabilidad, validación ni revisión.

## Aclaraciones

Si el analista solicita una aclaración, vuelve con el mismo enlace y abre la
pregunta. Escribe en **Tu aclaración** y pulsa **Enviar aclaración**. No necesitas
crear una cuenta. Acta no envía un aviso por correo automáticamente: el equipo
que solicita la aclaración debe avisarte por el canal acordado.

Si el enlace venció, el analista puede **renovarlo**. La renovación conserva tu
respuesta e historial. Una invitación revocada no puede reactivarse; su historial
permanece disponible al equipo autorizado, pero su acceso externo se cerró.

## Evidencia

Solo puedes adjuntar archivos si la invitación lo permite. Se aplican los mismos
controles de tamaño, contenido MIME real, SHA-256, almacenamiento privado y
revisión que a las respuestas con cuenta. No uses el archivo como sustituto de
una respuesta requerida. Completa la carga y asociación antes de enviar.

No puedes descargar los adjuntos de otro invitado aunque conozcas su identificador.
La evidencia enviada se vincula a la versión de respuesta correspondiente.
Cerrar o revocar un enlace no borra automáticamente las respuestas ni sus fuentes.

## Administrar acceso y estado

Desde el editor abre **Invitaciones mediante enlace**. Las invitaciones se listan
por páginas y se distinguen de las asignaciones a usuarios con cuenta.

| Estado | Significado |
|---|---|
| Pendiente | No se ha registrado un primer acceso correcto |
| Abrió el enlace | Se utilizó el enlace; no prueba quién lo abrió |
| Borrador | Existe un borrador guardado, incluso si corrige un envío previo |
| Envío parcial | Algunas preguntas tienen un envío |
| Enviado | Todas las preguntas del alcance tienen algún envío |
| Expirado | El plazo terminó y ya no permite acceso |
| Revocado | El equipo cerró el acceso explícitamente |

«Enviado» no significa que el analista haya validado el contenido ni que una
respuesta antigua siga vigente después de cambios en otras respuestas.
La revisión de cada pregunta sigue siendo la autoridad para esas decisiones.

**Renovar enlace** cambia la credencial y cierra las sesiones anteriores,
conservando la misma aportación. La interfaz aplica el plazo predeterminado de
la instalación; el contrato también permite una fecha explícita dentro del máximo.
**Revocar** cierra el enlace y sus sesiones; no borra historial y no se deshace.

El alcance y la identidad de una invitación creada no se amplían ni cambian.
Si necesitas otro alcance o destinatario, crea una invitación nueva; revoca la
anterior cuando ya no deba utilizarse.

## Privacidad y operación

La instalación configura si exige nombre, correo, ambos o ninguno. Una invitación
sin datos personales solo puede crearse cuando la instalación lo permite y un
administrador del proyecto lo habilita expresamente. «No nominal» no significa
sin historial: la bitácora identifica la invitación que produjo la aportación.

No se deduce la identidad por IP. Internamente se utiliza un principal limitado
para conservar las relaciones y trazabilidad del dominio; no es una cuenta
ordinaria ni aparece como usuario al que asignar tareas o restablecer contraseña.

El enlace contiene un token aleatorio en su fragmento, sin nombre ni correo.
El navegador lo retira de la dirección y lo intercambia por una sesión separada.
La base guarda hashes de las credenciales, no sus valores originales. La sesión
y el enlace están sujetos a vencimiento y revocación. HTTPS es obligatorio en
producción y un navegador o canal comprometido puede exponer el enlace.

Las respuestas y datos del destinatario permanecen en la instalación según su
política de conservación. Revocar no sustituye una política de privacidad o
borrado. Usa solo los datos necesarios y no incluyas información personal en la
referencia de la invitación cuando no sea necesaria.

Consulta [Configuración](CONFIGURATION.md) para plazos, identidad y límites de
abuso, y [Seguridad](../SECURITY.md) para reportar vulnerabilidades de forma privada.
