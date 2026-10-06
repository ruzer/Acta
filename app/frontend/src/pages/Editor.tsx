import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  priorities,
  referenceTypes,
  type QuestionnaireView,
  type QuestionView,
} from "@requirements/contracts";
import { api } from "../api";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  ErrorState,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "../ui";
import { ActionForm } from "./Administration";
import { QuestionForm } from "./QuestionForm";
import { EditorWorkspace } from "./editor/EditorWorkspace";
import "../editor.css";
const refLabels = {
  QUESTION: "Pregunta",
  BUSINESS_RULE: "Regla de negocio",
  REQUIREMENT: "Requerimiento",
  CAPABILITY: "Capacidad",
  WORKFLOW: "Flujo de trabajo",
  DOCUMENT: "Documento",
  CODE: "Código",
  OTHER: "Otra referencia",
};
export function Editor() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const structureTrigger = useRef<HTMLElement | null>(null);
  function rememberStructureTrigger() {
    const active = document.activeElement as HTMLElement;
    structureTrigger.current =
      active.closest("details")?.querySelector("summary") ?? active;
  }
  function closeStructureDialog() {
    setEditingTopic(null);
    setMoving(null);
    requestAnimationFrame(() => {
      const target = structureTrigger.current;
      if (target?.isConnected) target.focus();
      else
        document
          .querySelector<HTMLElement>('.qe-modes [aria-selected="true"]')
          ?.focus();
    });
  }
  const [editing, setEditing] = useState<QuestionView | "new" | null>(null);
  const [action, setAction] = useState<{
    kind: "assign" | "publish" | "archive" | "metadata";
    q: QuestionView;
  } | null>(null);
  const [topic, setTopic] = useState<string>();
  const [focusField, setFocusField] = useState<string>();
  const [editingTopic, setEditingTopic] = useState<{
    id: string;
    title: string;
    description: string;
    version: number;
  } | null>(null);
  const [moving, setMoving] = useState<{
    question: QuestionView;
    snapshot: QuestionnaireView;
  } | null>(null);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingReference, setCreatingReference] = useState(false);
  const [topicExternalId, setTopicExternalId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["questionnaire", projectId],
    queryFn: () => api("questionnaire", { projectId }),
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["questionnaire", projectId] });
    void qc.invalidateQueries({ queryKey: ["projects"] });
  };
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const data = q.data;
  const project = projects.data?.find((x) => x.id === projectId);
  const composer = editing ? (
    <QuestionForm
      data={data}
      defaultSectionId={topic}
      focusField={focusField}
      initial={editing === "new" ? undefined : editing}
      onCancel={() => setEditing(null)}
      onSave={async (d) => {
        if (editing === "new") await api("createQuestion", { projectId }, d);
        else
          await api(
            "editQuestion",
            { projectId, id: editing.id },
            { ...d, expectedVersion: editing.lockVersion },
          );
        setEditing(null);
        setNotice(
          "Pregunta guardada. Su contenido sigue en preparación hasta que la publiques.",
        );
        refresh();
      }}
    />
  ) : null;
  async function command(kind: "publish" | "archive", question: QuestionView) {
    setBusy(true);
    setError("");
    try {
      await api(
        kind,
        { projectId, id: question.id },
        { expectedVersion: question.lockVersion },
      );
      setAction(null);
      setNotice(
        kind === "publish"
          ? "Pregunta publicada. Su contenido quedó protegido."
          : "Pregunta archivada. Se conserva su historial.",
      );
      refresh();
    } catch (e) {
      setError((e as Error).message);
      setAction(null);
    } finally {
      setBusy(false);
    }
  }
  function scope(
    snapshot: QuestionnaireView,
    sectionId: string,
    orderedIds?: string[],
  ) {
    const rows = snapshot.questions
      .filter((x) => x.sectionId === sectionId)
      .sort((a, b) => a.order - b.order);
    return {
      sectionId,
      expected: rows.map(({ id, order, lockVersion }) => ({
        id,
        order,
        lockVersion,
      })),
      orderedIds:
        orderedIds ??
        rows.filter((x) => x.publication !== "ARCHIVED").map((x) => x.id),
    };
  }
  async function organize(run: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
      setNotice(message);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function topicAction(kind: "edit" | "up" | "down", id: string) {
    const section = data.sections.find((s) => s.id === id)!;
    if (kind === "edit") {
      rememberStructureTrigger();
      setEditingTopic({ ...section, version: data.structureVersion });
      return;
    }
    const rows = [...data.sections].sort((a, b) => a.order - b.order),
      ids = rows.map((s) => s.id),
      index = ids.indexOf(id),
      to = index + (kind === "up" ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to]!, ids[index]!];
    void organize(
      () =>
        api(
          "reorderSections",
          { projectId },
          {
            expectedVersion: data.structureVersion,
            expected: rows.map(({ id, order }) => ({ id, order })),
            orderedIds: ids,
          },
        ),
      "Orden de temas guardado.",
    );
  }
  function reorderQuestion(kind: "up" | "down", question: QuestionView) {
    const section = scope(data, question.sectionId),
      ids = section.orderedIds,
      index = ids.indexOf(question.id),
      to = index + (kind === "up" ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to]!, ids[index]!];
    void organize(
      () =>
        api(
          "reorderQuestions",
          { projectId },
          { expectedVersion: data.structureVersion, sections: [section] },
        ),
      "Orden de preguntas guardado.",
    );
  }
  return (
    <div className="qe-shell av-scope">
      {composer}
      <Link to="/" className="back">
        ← Mis proyectos
      </Link>
      <p className="eyebrow">EDITOR DE CUESTIONARIO</p>
      <h1>{project?.name || "Cuestionario del proyecto"}</h1>
      <p>
        Prepara las preguntas, asigna participantes y publica cuando el
        contenido esté listo.
      </p>
      {notice && <Alert>{notice}</Alert>}
      {error && (
        <Alert error>
          {error}{" "}
          <Button
            tone="secondary"
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            Actualizar información
          </Button>
        </Alert>
      )}
      <div className="actions">
        <Link className="button secondary" to={"/projects/" + projectId}>
          Ver preguntas publicadas
        </Link>
        {project?.role === "ADMIN" && (
          <Link
            className="button secondary"
            to={"/projects/" + projectId + "/members"}
          >
            Administrar miembros
          </Link>
        )}
      </div>
      <EditorWorkspace
        onRefresh={async () => {
          const result = await q.refetch();
          if (result.error) throw result.error;
          return result.data!;
        }}
        onBulkComplete={(message) => {
          setNotice(message);
          refresh();
        }}
        data={data}
        projectId={projectId}
        onCreateTopic={() => {
          setTopicExternalId(crypto.randomUUID());
          setCreatingTopic(true);
        }}
        onTopicAction={topicAction}
        onCreateReference={() => setCreatingReference(true)}
        onEdit={(question, sectionId, field) => {
          setTopic(sectionId);
          setFocusField(field);
          setEditing(question ?? "new");
          setNotice("");
        }}
        onAction={(kind, question) => {
          if (kind === "up" || kind === "down") reorderQuestion(kind, question);
          else if (kind === "move") {
            rememberStructureTrigger();
            setMoving({ question, snapshot: data });
          } else setAction({ kind, q: question });
        }}
      />
      {editingTopic && (
        <Dialog title="Editar tema" onClose={closeStructureDialog}>
          <ActionForm
            label="Guardar tema"
            onDone={() => {
              closeStructureDialog();
              setNotice("Tema guardado.");
              refresh();
            }}
            onSubmit={(d) =>
              api(
                "editSection",
                { projectId, id: editingTopic.id },
                {
                  title: d.title,
                  description: d.description,
                  expectedVersion: editingTopic.version,
                },
              )
            }
          >
            <Input
              label="Nombre"
              name="title"
              required
              maxLength={200}
              defaultValue={editingTopic.title}
            />
            <Textarea
              label="Descripción (opcional)"
              name="description"
              defaultValue={editingTopic.description}
            />
          </ActionForm>
          <Button tone="secondary" onClick={closeStructureDialog}>
            Cancelar
          </Button>
        </Dialog>
      )}
      {moving && (
        <Dialog title="Mover a otro tema" onClose={closeStructureDialog}>
          <p>{moving.question.question}</p>
          <ActionForm
            label="Mover pregunta"
            onDone={() => {
              closeStructureDialog();
              setNotice(
                "Pregunta movida. Se guardaron los órdenes de ambos temas.",
              );
              refresh();
            }}
            onSubmit={(d) => {
              const snapshot = moving.snapshot,
                origin = scope(snapshot, moving.question.sectionId),
                destination = scope(snapshot, d.sectionId!);
              origin.orderedIds = origin.orderedIds.filter(
                (id) => id !== moving.question.id,
              );
              destination.orderedIds.push(moving.question.id);
              return api(
                "reorderQuestions",
                { projectId },
                {
                  expectedVersion: snapshot.structureVersion,
                  sections: [origin, destination],
                },
              );
            }}
          >
            <Select
              label="Tema de destino"
              name="sectionId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecciona un tema
              </option>
              {data.sections
                .filter((s) => s.id !== moving.question.sectionId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </Select>
          </ActionForm>
          <Button tone="secondary" onClick={closeStructureDialog}>
            Cancelar
          </Button>
        </Dialog>
      )}
      {creatingTopic && (
        <Dialog title="Nuevo tema" onClose={() => setCreatingTopic(false)}>
          <ActionForm
            label="Crear tema"
            onDone={() => {
              setCreatingTopic(false);
              refresh();
              setNotice("Tema creado.");
            }}
            onSubmit={(d) =>
              api(
                "createSection",
                { projectId },
                {
                  ...d,
                  externalId: topicExternalId,
                  order: Math.max(0, ...data.sections.map((s) => s.order)) + 1,
                },
              )
            }
          >
            <Input label="Nombre" name="title" required maxLength={200} />
            <Textarea label="Descripción (opcional)" name="description" />
          </ActionForm>
        </Dialog>
      )}
      {creatingReference && (
        <Dialog
          title="Crear referencia"
          onClose={() => setCreatingReference(false)}
        >
          <ActionForm
            label="Crear referencia"
            onDone={() => {
              setCreatingReference(false);
              refresh();
            }}
            onSubmit={(d) =>
              api(
                "createReference",
                { projectId },
                { ...d, url: d.url || null, priority: null },
              )
            }
          >
            <Select label="Tipo de referencia" name="type">
              {referenceTypes.map((t) => (
                <option key={t} value={t}>
                  {refLabels[t]}
                </option>
              ))}
            </Select>
            <Input
              label="Identificador de referencia"
              name="externalId"
              required
            />
            <Input
              label="Descripción breve de referencia"
              name="label"
              required
            />
            <Input label="Enlace HTTPS (opcional)" name="url" type="url" />
            <Textarea label="Contexto de referencia" name="description" />
          </ActionForm>
        </Dialog>
      )}
      {action && (
        <Dialog
          title={
            {
              assign: "Asignar participante",
              publish: "Publicar pregunta",
              archive: "Archivar pregunta",
              metadata: "Configurar pregunta",
            }[action.kind]
          }
          onClose={() => !busy && setAction(null)}
        >
          <h3>{action.q.title}</h3>
          {action.kind === "publish" || action.kind === "archive" ? (
            <>
              <p>
                {action.kind === "publish"
                  ? "El contenido quedará protegido y estará disponible para los participantes asignados. Revisa las opciones y condiciones antes de continuar."
                  : "Dejará de mostrarse como pregunta disponible. Se conservará su contenido e historial."}
              </p>
              <Button
                disabled={busy}
                tone={action.kind === "archive" ? "danger" : "primary"}
                onClick={() =>
                  void command(action.kind as "publish" | "archive", action.q)
                }
              >
                {busy
                  ? "Procesando…"
                  : action.kind === "publish"
                    ? "Confirmar publicación"
                    : "Confirmar archivado"}
              </Button>
            </>
          ) : action.kind === "assign" ? (
            <>
              <p>
                Las preguntas condicionadas requieren que el participante tenga
                asignada también la pregunta principal.
              </p>
              <ActionForm
                label="Guardar asignación"
                onDone={() => {
                  setAction(null);
                  setNotice("Asignación guardada.");
                  refresh();
                }}
                onSubmit={(d) =>
                  api(
                    "assign",
                    { projectId, id: action.q.id },
                    {
                      projectMemberId: d.projectMemberId,
                      required: d.required === "on",
                      active: d.active === "on",
                      expectedVersion: action.q.lockVersion,
                    },
                  )
                }
              >
                <Select label="Participante" name="projectMemberId" required>
                  <option value="">Selecciona un participante</option>
                  {data.members
                    .filter((m) => m.active && m.role === "STAKEHOLDER")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} · {m.areaName}
                        {action.q.assignments.some(
                          (a) => a.projectMemberId === m.id && a.active,
                        )
                          ? " (asignado)"
                          : ""}
                      </option>
                    ))}
                </Select>
                <Checkbox
                  label="Asignación activa"
                  name="active"
                  defaultChecked
                />
                <Checkbox
                  label="Participación requerida"
                  name="required"
                  defaultChecked
                />
              </ActionForm>
            </>
          ) : (
            <ActionForm
              label="Guardar configuración"
              onDone={() => {
                setAction(null);
                refresh();
                setNotice(
                  "Configuración actualizada. El contenido de la pregunta se conserva.",
                );
              }}
              onSubmit={(d) =>
                api(
                  "metadata",
                  { projectId, id: action.q.id },
                  {
                    priority: d.priority,
                    responsibleAreaId: d.responsibleAreaId,
                    order: action.q.order,
                    expectedVersion: action.q.lockVersion,
                  },
                )
              }
            >
              <Select
                label="Prioridad"
                name="priority"
                defaultValue={action.q.priority}
              >
                {priorities.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Select
                label="Área responsable"
                name="responsibleAreaId"
                defaultValue={action.q.responsibleAreaId}
              >
                {data.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </ActionForm>
          )}
        </Dialog>
      )}
    </div>
  );
}
