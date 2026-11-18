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

**Copiar recordatorio** prepara un texto con las personas y sus preguntas obligatorias pendientes. Pégalo tú en el medio acordado con el equipo. Acta no envía mensajes ni incluye respuestas o contraseñas. Si el dispositivo no permite copiar, ofrece el texto seleccionable. Un participante o lector no puede abrir este seguimiento; administrar la institución tampoco otorga acceso automático.

## Fecha límite para responder

Al **Crear proyecto**, **Fecha límite para responder (opcional)** puede dejarse vacía. Para cambiarla después, abre **Administración → Proyectos → Fecha límite** en la fila del proyecto y pulsa **Guardar fecha límite**. Borrar el valor quita el plazo. Se guarda hasta el final del día en la zona horaria de la instalación, también si ese día cambia el horario.

Mi trabajo y Atención muestran si falta tiempo, vence hoy o ya venció. Participación cuenta las personas con plazo vencido y preguntas obligatorias pendientes. La fecha solo orienta: **no cierra el proyecto ni impide guardar o enviar**. Cambiarla requiere administración de la institución; la consulta mantiene los accesos del proyecto. Administración institucional puede consultar este dato general sin obtener respuestas ni evidencia.

## Primeros pasos y ayuda

Atención muestra **Primeros pasos** mientras no hay respuestas enviadas. Usa preguntas, accesos y asignaciones actuales para retirar las tareas completadas. Puede replegarse y desaparece con el primer envío. El analista solicita a la administración los accesos que no puede conceder; la tarjeta no amplía permisos. **Ayuda**, en el menú de cuenta, reúne las guías de los roles actuales. La administración institucional ve todas; el lector recibe orientación para consultar sus proyectos.
