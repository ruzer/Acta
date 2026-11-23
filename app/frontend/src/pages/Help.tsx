import type { ReactNode } from "react";
import type { ProjectView } from "@requirements/contracts";
import { PageHeader } from "../ui/semantic";
type Guide = "participant" | "administration" | "review";
export const helpGuides: Record<Guide, { title: string; content: ReactNode }> =
  {
    participant: {
      title: "Guía de Participante",
      content: (
        <>
          <p>
            Necesitas la dirección de Acta, tu usuario, contraseña temporal y un
            archivo de prueba autorizado. No uses información sensible. Si
            entras por invitación, usa{" "}
            <a href="https://github.com/ruzer/Acta/blob/main/docs/EXTERNAL-INVITATIONS.md">
              la guía de invitaciones
            </a>
            .
          </p>
          <ol>
            <li>
              Abre la dirección recibida. Escribe <strong>Usuario</strong> y{" "}
              <strong>Contraseña</strong>; pulsa <strong>Iniciar sesión</strong>
              . No compartas tu acceso.
            </li>
            <li>
              En <strong>Cambia tu contraseña temporal</strong>, llena{" "}
              <strong>Contraseña actual</strong>,{" "}
              <strong>Nueva contraseña</strong> y{" "}
              <strong>Repetir nueva contraseña</strong>. Pulsa{" "}
              <strong>Actualizar contraseña</strong>. Vuelve a{" "}
              <strong>Iniciar sesión</strong> con la nueva contraseña.
            </li>
            <li>
              En <strong>Mi trabajo</strong>, revisa cuántas preguntas enviaste;
              <strong> No aplica</strong> no cuenta. La fecha límite permite
              responder después. Abre el proyecto y pulsa{" "}
              <strong>Responder</strong>. Revisa los límites y el contador; no
              inventes información.
            </li>
            <li>
              Acta guarda el borrador tras una pausa. Espera el aviso; aún no lo
              envías. <strong>Guardar y salir</strong> permite continuar
              después. Si recargas con texto pendiente, elige{" "}
              <strong>Restaurar texto de esta pestaña</strong>;{" "}
              <strong>Continuar</strong> permite retomar. Si te falta
              información, pulsa <strong>Necesito consultar esto</strong>. La
              pregunta anterior queda <strong>Por consultar</strong>. Puedes
              pulsar <strong>Deshacer</strong> durante ocho segundos; tu
              borrador se conserva.
            </li>
            <li>
              Si necesitas un comprobante, abre{" "}
              <strong>Adjuntar evidencia</strong>, usa{" "}
              <strong>Seleccionar evidencia</strong> y pulsa{" "}
              <strong>Adjuntar al borrador</strong>. Espera{" "}
              <strong>
                Evidencia adjunta al borrador. Todavía no se ha enviado.
              </strong>{" "}
              Revisa el nombre del archivo.
            </li>
            <li>
              Cuando termines, pulsa <strong>Enviar respuesta</strong>. Busca el
              aviso <strong>Respuesta enviada</strong>; Acta puede abrir la
              siguiente pregunta. Cada una se envía por separado.
            </li>
            <li>
              En <strong>Mi trabajo</strong>, pulsa{" "}
              <strong>Responder aclaración</strong> en el aviso{" "}
              <strong>Una aclaración espera tu respuesta</strong>. Después de
              enviar una respuesta, también puedes abrir{" "}
              <strong>Consultar aclaraciones</strong>. Completa{" "}
              <strong>Tu aclaración</strong> y pulsa{" "}
              <strong>Enviar aclaración</strong>. Busca{" "}
              <strong>Aclaración enviada</strong>; puede abrirse otra pregunta.
            </li>
            <li>
              Consulta <strong>Ayuda</strong> en el menú de tu cuenta. Al
              terminar, abre ese menú y pulsa <strong>Cerrar sesión</strong>,
              sobre todo si compartes la computadora.
            </li>
          </ol>
          <h3>Si algo no funciona</h3>
          <ul>
            <li>
              <strong>No fue posible iniciar sesión con esos datos.</strong>{" "}
              Revisa usuario y contraseña; si sigue ocurriendo, pide ayuda a
              quien te dio acceso. No mandes tu contraseña por chat.
            </li>
            <li>
              <strong>No se pudo guardar:</strong> revisa la causa indicada.
              <strong> Tu texto sigue aquí</strong> no confirma el guardado.
              Conserva la página y avisa al coordinador.
            </li>
            <li>
              Si no ves el proyecto o la pregunta, pide que revisen tu acceso y
              asignación. No uses la cuenta de otra persona.
            </li>
          </ul>
        </>
      ),
    },
    administration: {
      title: "Guía de Administración",
      content: (
        <>
          <p>Necesitas acceso de administración y permiso en el proyecto.</p>
          <p>
            Una persona tiene un solo perfil por proyecto. Quien coordina el
            acceso con perfil de Administración no puede pedir aclaraciones ni
            registrar decisiones con esa cuenta: para la revisión, crea o usa
            una cuenta con perfil Analista.
          </p>
          <ol>
            <li>
              Pide al equipo técnico confirmar un{" "}
              <a href="https://github.com/ruzer/Acta/blob/main/docs/BACKUP-RESTORE.md">
                respaldo verificado
              </a>
              . Anota fecha y responsable; no se hace desde esta pantalla.
            </li>
            <li>
              En <strong>Administración</strong> → <strong>Proyectos</strong> →{" "}
              <strong>Crear proyecto</strong>, completa{" "}
              <strong>Nombre del proyecto</strong>,{" "}
              <strong>Identificador externo</strong> y{" "}
              <strong>Descripción</strong>. Puedes indicar{" "}
              <strong>Fecha límite para responder (opcional)</strong>; no
              bloquea respuestas. Pulsa <strong>Crear proyecto</strong>.
            </li>
            <li>
              En <strong>Áreas</strong> → <strong>Crear área</strong>, completa{" "}
              <strong>Nombre del área</strong> y{" "}
              <strong>Código del área</strong>. Pulsa{" "}
              <strong>Crear área</strong>; conserva el código. Un área no asigna
              personas.
            </li>
            <li>
              En <strong>Usuarios</strong> →{" "}
              <strong>Crear varios usuarios</strong>, pega la tabla: Usuario,
              Nombre, Proyecto, Rol, Área. Usa los códigos anteriores; máximo 50
              filas, sin contraseñas. Pulsa <strong>Revisar usuarios</strong>;
              confirma con el botón que indica cuántas cuentas creará.
            </li>
            <li>
              En <strong>Entrega de acceso</strong>, pulsa{" "}
              <strong>Imprimir hoja de entrega</strong> si la necesitas. Entrega
              a cada persona solo su hoja, en privado. Las contraseñas aparecen
              una vez; deben cambiarlas al entrar. Pulsa{" "}
              <strong>Cerrar entrega</strong>.
            </li>
            <li>
              Abre el proyecto vacío: <strong>Cuestionario</strong> →{" "}
              <strong>Importar cuestionario</strong> →{" "}
              <strong>Descargar plantilla CSV</strong>. Completa una fila por
              pregunta y guarda como CSV UTF-8. Selecciona el archivo, pulsa{" "}
              <strong>Revisar archivo</strong>, revisa cantidades y áreas, y{" "}
              <strong>Confirmar importación</strong>;{" "}
              <a href="https://github.com/ruzer/Acta/blob/main/docs/IMPORTING-QUESTIONNAIRES.md">
                instrucciones
              </a>
              .
            </li>
            <li>
              En <strong>Cuestionario</strong> → <strong>Organizar</strong> →{" "}
              <strong>Seleccionar preguntas</strong>, elige el alcance. Pulsa{" "}
              <strong>Agregar participantes</strong>, marca personas y elige si
              su respuesta será obligatoria. Pulsa <strong>Revisar lote</strong>{" "}
              y confirma la cantidad indicada. Vuelve a seleccionar solo lo
              autorizado: <strong>Publicar seleccionadas</strong> →{" "}
              <strong>Revisar lote</strong>, revisa y confirma. Asignar no
              publica.
            </li>
            <li>
              Consulta <strong>Atención</strong>,{" "}
              <strong>Primeros pasos</strong> y <strong>Participación</strong>.
              Usa <strong>Copiar recordatorio</strong> para avisar por tu medio
              habitual. Consulta <strong>Ayuda</strong> en tu cuenta. Cuando
              haya decisiones, abre <strong>Decisiones</strong> →{" "}
              <strong>Informe para imprimir</strong>;{" "}
              <a href="https://github.com/ruzer/Acta/blob/main/docs/PROJECT-REPORT.md">
                instrucciones
              </a>
              . Revisa los{" "}
              <a href="https://github.com/ruzer/Acta/blob/main/docs/PROJECT-ADMINISTRATION.md">
                accesos al proyecto
              </a>
              .
            </li>
          </ol>
          <h3>Si algo no funciona</h3>
          <ul>
            <li>
              <strong>
                No tienes permiso para administrar la institución.
              </strong>{" "}
              Pide revisar tu acceso; no uses otra cuenta.
            </li>
            <li>
              <strong>
                Este proyecto ya contiene estructura. La importación requiere un
                proyecto vacío.
              </strong>{" "}
              No borres trabajo: pide un proyecto nuevo.
            </li>
            <li>
              Si pierdes una contraseña temporal, usa <strong>Usuarios</strong>{" "}
              → <strong>Restablecer contraseña</strong> para esa persona; no
              repitas el lote.
            </li>
          </ul>
        </>
      ),
    },
    review: {
      title: "Guía de Revisión",
      content: (
        <>
          <p>
            Necesitas acceso como Analista. Trabaja con las respuestas del
            piloto. Una decisión de prueba no aprueba un procedimiento oficial.
          </p>
          <ol>
            <li>
              En <strong>Mis proyectos</strong>, pulsa{" "}
              <strong>Revisar respuestas</strong> en el proyecto del piloto y
              abre la pregunta. Lee el enunciado y las aportaciones de cada
              persona; no supongas que todas dicen lo mismo.
            </li>
            <li>
              Consulta los archivos adjuntos que tengas permiso de ver. Si falta
              información, abre <strong>Otras acciones</strong> →{" "}
              <strong>Solicitar aclaración</strong>. Selecciona{" "}
              <strong>Respuesta sobre la que necesitas aclaración</strong>,
              escribe <strong>Pregunta de aclaración</strong> y pulsa{" "}
              <strong>Enviar solicitud</strong>.
            </li>
            <li>
              Espera que la persona responda. Vuelve a la pregunta y lee su
              aclaración. Si quedó resuelta, pulsa{" "}
              <strong>Cerrar aclaración</strong>, escribe{" "}
              <strong>Motivo</strong> y confirma. Cerrar una aclaración no
              registra una decisión.
            </li>
            <li>
              Cuando tengas sustento suficiente, pulsa{" "}
              <strong>Registrar decisión</strong>. Completa{" "}
              <strong>Decisión acordada</strong>, <strong>Alcance</strong> y{" "}
              <strong>Comentario interno</strong>; anota{" "}
              <strong>Excepciones (opcional)</strong> cuando existan. Marca las
              respuestas y demás fuentes que realmente revisaste. No selecciones
              todo sin leerlo.
            </li>
            <li>
              Revisa el texto y pulsa <strong>Registrar como validada</strong>.
              Comprueba que la decisión aparece en <strong>Decisiones</strong>.
              Si hay información faltante o un conflicto sin resolver, no
              confirmes solo para terminar la tarea: avisa al coordinador.
            </li>
            <li>
              Abre <strong>Informe para imprimir</strong> y pulsa{" "}
              <strong>Imprimir o guardar como PDF</strong>. Revisa nombre del
              proyecto, decisión, fecha y fuentes en la vista previa. Sigue{" "}
              <a href="https://github.com/ruzer/Acta/blob/main/docs/PROJECT-REPORT.md">
                la guía del informe
              </a>
              ; guarda o imprime solo donde esté autorizado. Consulta{" "}
              <strong>Participación</strong> y{" "}
              <strong>Copiar recordatorio</strong> desde{" "}
              <strong>Atención</strong>. En tu cuenta está{" "}
              <strong>Ayuda</strong>. Cierra sesión al terminar.
            </li>
          </ol>
          <h3>Si algo no funciona</h3>
          <ul>
            <li>
              <strong>
                Revisa los campos indicados antes de registrar la decisión.
              </strong>{" "}
              Lee los errores marcados, completa los campos y elige el sustento
              de la decisión antes de volver a confirmar.
            </li>
            <li>
              <strong>
                Información actualizada. Tu texto se conservó: revisa las
                fuentes antes de registrar.
              </strong>{" "}
              Otra operación cambió la pregunta; revisa la información
              nuevamente. No confirmes sin comprobarla.
            </li>
            <li>
              Si no ves una respuesta o un archivo, pide revisar tus permisos.
              No pidas que te compartan una cuenta ni el archivo por un medio no
              autorizado.
            </li>
          </ul>
        </>
      ),
    },
  };
export function availableGuides(
  organizationAdmin: boolean,
  roles: ProjectView["role"][],
): Guide[] {
  if (organizationAdmin) return ["participant", "administration", "review"];
  return [
    ...new Set(
      roles.flatMap((role): Guide[] =>
        role === "ADMIN"
          ? ["administration"]
          : role === "ANALYST"
            ? ["review"]
            : role === "STAKEHOLDER"
              ? ["participant"]
              : [],
      ),
    ),
  ];
}
export function Help({
  organizationAdmin,
  roles,
}: {
  organizationAdmin: boolean;
  roles: ProjectView["role"][];
}) {
  const guides = availableGuides(organizationAdmin, roles);
  return (
    <>
      <PageHeader
        title="Ayuda"
        lead="Pasos para trabajar en Acta según tu acceso."
      />
      {!guides.length && (
        <p>
          Tu acceso es de consulta o todavía no tienes un proyecto asignado.
          Abre Mis proyectos para ver lo disponible; pide apoyo a quien
          administra los accesos.
        </p>
      )}
      <nav aria-label="Guías de ayuda">
        {guides.map((id) => (
          <p key={id}>
            <a href={`#help-${id}`}>{helpGuides[id].title}</a>
          </p>
        ))}
      </nav>
      {guides.map((id) => (
        <section key={id} aria-labelledby={`help-${id}`}>
          <h2 id={`help-${id}`}>{helpGuides[id].title}</h2>
          {id === "administration" && (
            <p>
              Crear cuentas y áreas requiere administración de la institución.
              Si administras solo un proyecto, solicita esas tareas a quien
              tenga ese permiso.
            </p>
          )}
          {helpGuides[id].content}
        </section>
      ))}
    </>
  );
}
