# Administración y visibilidad de proyectos

## Qué pasaba

Una persona administradora creaba un proyecto y otra administradora de la misma institución **no lo veía**; además, el proyecto aparecía en «Mis proyectos», lo que hacía pensar que era suyo.

**Causa real**: la única lista de proyectos (`GET /projects`) devuelve los proyectos en los que la cuenta tiene **acceso activo al proyecto**, y Administración → Proyectos la reutilizaba. Al crear un proyecto solo se hace miembro ADMIN a quien lo crea. No era un filtro de interfaz ni un fallo de aislamiento: era la regla de acceso al proyecto aplicada a una pantalla que debía mostrar la institución. El modelo de autorización no tenía una limitación de fondo: la administración ya podía gestionar quién pertenece a un proyecto (`/projects/:id/members`), solo que no tenía forma de **encontrarlo**.

## Modelo de permisos (sin cambios de fondo)

| Quién | Qué alcanza |
|---|---|
| **Administración de la institución** (`isOrganizationAdmin`) | Usuarios, áreas, configuración, crear proyectos y gestionar los accesos a cualquier proyecto de su institución. **No** abre respuestas, evidencias ni decisiones. |
| **ADMIN de proyecto** | Administra el proyecto del que es miembro, incluidos los accesos al proyecto. |
| **ANALYST** | Prepara, publica y revisa dentro de los proyectos de los que es miembro. |
| **VIEWER** | Consulta lo habilitado en sus proyectos. |
| **STAKEHOLDER** | Responde lo que se le asignó. |
| **Invitación** (invitado externo) | Una cuenta solo-invitación con rol STAKEHOLDER y alcance fijo a las preguntas de su enlace. |

Todo acceso al contenido de un proyecto exige **acceso activo** a él; la administración de la institución no lo sustituye. Una organización no ve nada de otra.

## Qué se cambia

- **Mis proyectos**: los proyectos donde tengo acceso. Sin cambios.
- **Administración → Proyectos**: todos los proyectos de la institución, con estado (activo o archivado), quién los administra («Sin administrador activo» cuando no hay ninguno), el rol propio o «Sin acceso» y las acciones **Miembros** y, solo si participo, **Abrir**. Es solo metadatos: `GET /administration/projects` (solo administración de la institución) no devuelve contenido.
- **Unirse es explícito**: para trabajar en un proyecto ajeno, la administración se agrega como miembro en «Miembros»; queda en la bitácora (`PROJECT_MEMBER_CHANGED`). Ver el proyecto en la lista no concede nada.
- La página de miembros muestra el nombre del proyecto aunque la administración no pertenezca a él.

## ¿Hace falta SUPERADMIN? No

- Una instalación atiende a **una** institución. Lo que sería «administración de la instalación» ya es de quien opera el servidor: variables de entorno, `bootstrap-admin`, `setup-token` y las copias de seguridad. La configuración de la aplicación (Configuración) pertenece a la institución.
- Todo lo que faltaba (encontrar proyectos, repararlos, darles administrador) cabe en el rol de administración de la institución sin darle acceso al contenido.
- Un SUPERADMIN añadiría un privilegio por encima de toda la institución, difícil de acotar y de auditar. Se reconsidera solo si Acta pasa a alojar varias instituciones en una instalación.
- «GUEST» ya existe como invitación; no requiere un rol nuevo.

## Casos límite

- **Proyecto creado por otra administración**: aparece en la lista; se pueden ver los accesos al proyecto y agregar miembros.
- **Sin administrador activo** (por ejemplo, la cuenta se desactivó): se marca en la lista y la administración le asigna uno. Desactivar una cuenta no reescribe accesos a proyectos.
- **Archivado**: se lista; no admite cambios de acceso al proyecto.
- **Cuentas desactivadas**: no cuentan como administradoras ni como miembros activos.
- **Otra institución**: no aparece, y acceder a su proyecto por URL responde 404.
- **Escalamiento**: ningún rol de proyecto puede agregarse como administrador de otro proyecto ni crear administración de la institución; la lista no cambia ningún permiso existente.

## Seguir la participación

En **Atención → Ver participación**, la administración y el equipo analista del proyecto ven quién empezó, quién guarda borradores y quién envió sus respuestas. **Filtrar participación** y **Ordenar participación** ayudan a encontrar pendientes. «Completo» no significa revisado: solo que ya se enviaron las preguntas obligatorias que aplican a esa persona. Si solo tiene preguntas opcionales, debe enviarlas todas para aparecer como completo.

**Copiar recordatorio** prepara un texto con las personas y sus preguntas obligatorias pendientes. El botón de cada fila prepara el aviso únicamente para esa persona. Pégalo tú en el medio acordado con el equipo. Acta no envía mensajes ni incluye respuestas o contraseñas. Si el dispositivo no permite copiar, ofrece el texto seleccionable. Un participante o lector no puede abrir este seguimiento; administrar la institución tampoco otorga acceso automático.

## Fecha límite para responder

Al **Crear proyecto**, **Fecha límite para responder (opcional)** puede dejarse vacía. Para cambiarla después, abre **Administración → Proyectos → Fecha límite** en la fila del proyecto y pulsa **Guardar fecha límite**. Borrar el valor quita el plazo. Se guarda hasta el final del día en la zona horaria de la instalación, también si ese día cambia el horario.

Mi trabajo y Atención muestran si falta tiempo, vence hoy o ya venció. Participación cuenta las personas con plazo vencido y preguntas obligatorias pendientes. La fecha solo orienta: **no cierra el proyecto ni impide guardar o enviar**. Cambiarla requiere administración de la institución; la consulta mantiene los accesos del proyecto. Administración institucional puede consultar este dato general sin obtener respuestas ni evidencia.

## Primeros pasos y ayuda

Atención muestra **Primeros pasos** mientras no hay respuestas enviadas. Usa preguntas, accesos y asignaciones actuales para retirar las tareas completadas. Puede replegarse y desaparece con el primer envío. El analista solicita a la administración los accesos que no puede conceder; la tarjeta no amplía permisos. **Ayuda**, en el menú de cuenta, reúne las guías de los roles actuales. La administración institucional ve todas; el lector recibe orientación para consultar sus proyectos.

## Atención sin repeticiones

Una pregunta aparece una sola vez: primero conflictos o respuestas listas, después aclaraciones, pendientes de otras personas y preguntas sin asignación. «Otras preguntas» reúne lo que no entró en esos grupos. Los filtros mantienen las mismas acciones. Los contadores del resumen pueden coincidir porque una pregunta puede tener conflicto y aclaración a la vez.

Atención anuncia los envíos nuevos desde la visita anterior; cuenta cada envío, no los borradores. La fecha de visita se guarda en este navegador por cuenta y proyecto, sin respuestas. La primera visita no anuncia novedades; otro navegador tiene su propio historial.


## Actualizar el acceso al proyecto

En **Miembros**, el formulario **Asignar o actualizar acceso al proyecto** conserva el orden Usuario, Rol, Área y Acceso al proyecto activo.

1. Elige la cuenta. Si ya pertenece al proyecto, se cargan su rol, área y estado actuales, incluso si su acceso está inactivo. En el directorio institucional aparece «ya está en el proyecto» junto al nombre.
2. Cambia solo lo necesario. El resumen muestra las diferencias; **Sin cambios** indica que el botón no enviará una operación. Para agregar una cuenta, **Selecciona un rol** exige una elección explícita; nunca se asigna Administración por omisión.
3. Pulsa **Guardar acceso al proyecto**. Los ascensos a Administración, quitar un área existente y desactivar el acceso abren **Confirmar cambio de acceso**. **Cancelar**, **Cerrar** o Escape vuelven al formulario sin guardar y devuelven el foco al botón.
4. Si quitas tu propia Administración o desactivas tu acceso, aparece «Estás quitando tu propio acceso de administración». Si la lista tiene menos de 500 personas y no muestra otra activa con Administración, aparece además «Eres la única administración activa de este proyecto; después solo la administración de la institución podrá devolverla». Revisa esa consecuencia antes de confirmar. Con 500 personas o más, la lista puede estar incompleta y el aviso pide consultar a la administración de la institución, sin afirmar que eres la única administración.
5. Comprueba **Operación guardada.** Si aparece un error, los valores propuestos permanecen para corregirlos. El servidor sigue validando los permisos y las asignaciones activas; una confirmación no omite esas reglas.

Estos avisos ayudan a decidir; no agregan una prohibición de retirar al último administrador ni cambian permisos. Tampoco amplían el directorio de usuarios: quien no administra la institución conserva el aviso actual y la selección de miembros existentes. Las limitaciones de listados y búsqueda se diseñan por separado.
