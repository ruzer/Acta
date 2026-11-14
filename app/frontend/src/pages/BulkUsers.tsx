import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  roleLabels,
  type BulkUsersPreview,
  type BulkUsersResult,
} from "@requirements/contracts";
import { api } from "../api";
import { Alert, Button, Dialog, Textarea } from "../ui";
import "./bulk-users.css";

const columns = ["Usuario", "Nombre", "Proyecto", "Rol", "Área"] as const;
export function BulkUsers({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<BulkUsersPreview | null>(null);
  const [delivery, setDelivery] = useState<BulkUsersResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const requestId = useRef("");
  const summary = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    const lifecycle = generation;
    alive.current = true;
    const resume = () => {
      alive.current = true;
    };
    const clear = () => {
      alive.current = false;
      lifecycle.current++;
      flushSync(() => {
        setBusy(false);
        setDelivery(null);
        setPrinting(false);
        setText("");
        setPreview(null);
      });
    };
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", resume);
    window.addEventListener("session-expired", clear);
    return () => {
      alive.current = false;
      lifecycle.current++;
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("session-expired", clear);
    };
  }, []);
  useEffect(() => {
    if (preview || delivery || error) summary.current?.focus();
  }, [preview, delivery, error]);
  async function review() {
    const current = generation.current;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await api("bulkUsersPreview", {}, { text });
      if (alive.current && current === generation.current) {
        requestId.current = crypto.randomUUID();
        setPreview(result);
      }
    } catch (e) {
      if (alive.current && current === generation.current)
        setError((e as Error).message);
    } finally {
      if (alive.current && current === generation.current) setBusy(false);
    }
  }
  async function confirm() {
    const current = generation.current;
    if (!preview?.canConfirm) return;
    setBusy(true);
    setError("");
    try {
      // La respuesta con claves nunca entra en una query/mutation cache.
      const result = await api(
        "bulkUsersConfirm",
        {},
        {
          text,
          previewHash: preview.previewHash,
          requestId: requestId.current,
        },
      );
      if (alive.current && current === generation.current) {
        setDelivery(result);
        setText("");
        setPreview(null);
        onCreated();
      }
    } catch (e) {
      if (alive.current && current === generation.current)
        setError((e as Error).message);
    } finally {
      if (alive.current && current === generation.current) setBusy(false);
    }
  }
  function print() {
    flushSync(() => setPrinting(true));
    try {
      window.print();
    } finally {
      setPrinting(false);
    }
  }
  return (
    <Dialog title="Crear varios usuarios" onClose={onClose}>
      <div className="bulk-users-screen">
        {delivery ? (
          <div className="bulk-user-delivery">
            <h3 tabIndex={-1} ref={summary}>
              Entrega de acceso
            </h3>
            <p role="status">
              Se crearon {delivery.users.length} cuentas y{" "}
              {delivery.memberships} membresías.
            </p>
            {delivery.delivery === "NEW" ? (
              <>
                <Alert>
                  Estas contraseñas solo se muestran ahora. Al cerrar o salir se
                  borran de esta pantalla. Entrégalas por un canal privado. Si
                  las pierdes, restablece cada contraseña desde Usuarios.
                </Alert>
                {delivery.users.map((user) => (
                  <section
                    className="bulk-user-card"
                    key={user.id}
                    aria-label={`Acceso de ${user.displayName}`}
                  >
                    <h4>{user.displayName}</h4>
                    <dl>
                      <dt>Usuario</dt>
                      <dd>{user.username}</dd>
                      <dt>Contraseña temporal</dt>
                      <dd data-secret>
                        <code>
                          {
                            delivery.credentials.find(
                              (c) => c.username === user.username,
                            )?.temporaryPassword
                          }
                        </code>
                      </dd>
                      <dt>Enlace de acceso</dt>
                      <dd>{window.location.origin}/</dd>
                    </dl>
                    <p>
                      En el primer acceso deberás elegir una contraseña nueva.
                    </p>
                  </section>
                ))}
                <Button onClick={print}>Imprimir hoja de entrega</Button>
                <p>
                  Una hoja por persona. Guarda las hojas o el PDF en un lugar
                  privado y elimínalos después de la entrega.
                </p>
              </>
            ) : (
              <Alert>
                Este lote ya se confirmó. Las contraseñas no pueden mostrarse de
                nuevo. Si no se entregaron, restablécelas individualmente desde
                Usuarios.
              </Alert>
            )}
            <Button tone="secondary" onClick={onClose}>
              Cerrar entrega
            </Button>
          </div>
        ) : (
          <>
            <p>
              Pega una tabla desde tu hoja de cálculo, con los encabezados
              Usuario, Nombre, Proyecto, Rol y Área. No incluyas contraseñas.
              Máximo 50 filas; una fila por usuario y proyecto.
            </p>
            <p>
              Usa los códigos de proyectos y áreas existentes. Roles:
              Administración del proyecto, Analista, Participante o Consulta.
              Para Participante, indica un área. Las cuentas existentes se
              administran individualmente.
            </p>
            <pre
              className="bulk-users-example"
              tabIndex={0}
              aria-label="Ejemplo de tabla con tabuladores"
            >
              Usuario{"\t"}Nombre{"\t"}Proyecto{"\t"}Rol{"\t"}Área{"\n"}
              persona.demo{"\t"}Persona de ejemplo{"\t"}PROYECTO-DEMO{"\t"}
              Participante{"\t"}AREA-DEMO
            </pre>
            <Textarea
              label="Tabla de usuarios"
              data-autofocus
              value={text}
              disabled={busy}
              maxLength={65536}
              rows={8}
              hint="Copia también la fila de encabezados. La revisión no crea cuentas ni contraseñas."
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
                setError("");
                requestId.current = "";
              }}
            />
            {error && (
              <>
                <h3 tabIndex={-1} ref={summary}>
                  No se completó la operación
                </h3>
                <Alert error>{error}</Alert>
              </>
            )}
            <Button disabled={busy || !text} onClick={() => void review()}>
              {busy ? "Procesando…" : "Revisar usuarios"}
            </Button>
            {preview && (
              <section aria-label="Vista previa de usuarios">
                <h3 tabIndex={-1} ref={summary}>
                  Revisar el lote
                </h3>
                {preview.errors.length ? (
                  <div role="alert">
                    <p>
                      No se creará ninguna cuenta hasta corregir todos los
                      errores.
                    </p>
                    <ul>
                      {preview.errors.map((e, i) => {
                        const message = `Fila ${e.row}, ${e.column}: ${e.message}`;
                        return (
                          <li key={i} id={`bulk-error-${i}`}>
                            {preview.rows.some((row) => row.line === e.row) ? (
                              <a
                                href={`#bulk-cell-${e.row}-${e.column === "Fila" ? "Usuario" : e.column}`}
                              >
                                {message}
                              </a>
                            ) : (
                              message
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p role="status">
                    Se crearán {preview.users} cuentas y {preview.memberships}{" "}
                    membresías. Los usuarios se muestran en minúsculas. Ninguna
                    cuenta será administradora de la institución.
                  </p>
                )}
                {preview.rows.map((row) => (
                  <section
                    key={row.line}
                    className="bulk-user-card"
                    aria-label={`Fila ${row.line}`}
                  >
                    <h4>Fila {row.line}</h4>
                    <dl>
                      {[
                        row.username,
                        row.displayName,
                        [row.projectCode, row.projectName]
                          .filter(Boolean)
                          .join(" — "),
                        roleLabels[row.role as keyof typeof roleLabels] ??
                          row.role,
                        [row.areaCode, row.areaName]
                          .filter(Boolean)
                          .join(" — ") || "Sin área",
                      ].map((value, i) => {
                        const errors = preview.errors.flatMap((e, j) =>
                          e.row === row.line &&
                          (e.column === columns[i] || e.column === "Fila")
                            ? [`bulk-error-${j}`]
                            : [],
                        );
                        return (
                          <div key={columns[i]}>
                            <dt>{columns[i]}</dt>
                            <dd
                              id={`bulk-cell-${row.line}-${columns[i]}`}
                              tabIndex={-1}
                              aria-invalid={errors.length ? true : undefined}
                              aria-describedby={
                                errors.length ? errors.join(" ") : undefined
                              }
                            >
                              {value || "Sin dato"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </section>
                ))}
                <Button
                  disabled={busy || !preview.canConfirm}
                  onClick={() => void confirm()}
                >
                  Crear {preview.users} cuentas y sus membresías
                </Button>
              </section>
            )}
          </>
        )}
      </div>
      {printing &&
        delivery?.delivery === "NEW" &&
        createPortal(
          <div className="bulk-users-print">
            {delivery.users.map((user) => (
              <section key={user.id} className="bulk-users-sheet">
                <h1>Hoja de entrega de acceso</h1>
                <h2>{user.displayName}</h2>
                <dl>
                  <dt>Usuario</dt>
                  <dd>{user.username}</dd>
                  <dt>Contraseña temporal</dt>
                  <dd data-secret>
                    {
                      delivery.credentials.find(
                        (c) => c.username === user.username,
                      )?.temporaryPassword
                    }
                  </dd>
                  <dt>Enlace de acceso</dt>
                  <dd>{window.location.origin}/</dd>
                </dl>
                <p>
                  Abre el enlace e inicia sesión con estos datos. En el primer
                  acceso deberás elegir una contraseña nueva. No compartas tu
                  contraseña y destruye esta hoja después de cambiarla.
                </p>
              </section>
            ))}
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
