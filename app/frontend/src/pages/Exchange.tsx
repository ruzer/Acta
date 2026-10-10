import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { api, exchangeRequest, exchangeFetch, saveDownload } from "../api";
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../ui";
import { PageHeader } from "../ui/semantic";
import minimalTemplateUrl from "../../../../examples/questionnaire-template.minimal.json?url";
import fullTemplateUrl from "../../../../examples/questionnaire-template.full.json?url";

function importIssueContext(path: string): string {
  const parts = path.split("/").slice(1);
  const collections: Record<string, string> = {
    questions: "Pregunta",
    sections: "Tema",
    areas: "Área",
    conditions: "Condición",
    traceabilityReferences: "Referencia",
    options: "Opción",
    references: "Referencia",
    rows: "Fila",
    columns: "Columna",
  };
  const fields: Record<string, string> = {
    externalId: "Identificador externo",
    sectionExternalId: "Tema de destino",
    responsibleAreaCode: "Área responsable",
    type: "Tipo de respuesta",
    required: "Obligatoriedad",
    priority: "Prioridad",
    order: "Orden",
    title: "Título",
    question: "Enunciado",
    helpText: "Ayuda",
    options: "Opciones",
    config: "Configuración de respuesta",
    code: "Código",
    name: "Nombre",
    value: "Valor",
    label: "Texto visible",
    url: "Enlace",
    groupParentExternalId: "Pregunta principal",
    operator: "Condición",
    parentQuestionExternalId: "Pregunta que activa la condición",
    childQuestionExternalId: "Pregunta dependiente",
  };
  const context: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i] ?? "";
    const label = Object.hasOwn(collections, key)
      ? collections[key]
      : undefined;
    const next = parts[i + 1];
    if (label && next && /^\d+$/.test(next)) {
      context.push(`${label} ${Number(next) + 1}`);
      i++;
    } else if (parts[i] === "project") context.push("Proyecto");
  }
  const fieldKey = parts.at(-1) ?? "";
  const field = Object.hasOwn(fields, fieldKey) ? fields[fieldKey] : undefined;
  if (field) context.push(field);
  return context.join(" · ") || "Archivo";
}
const countLabels = {
  projects: "Proyecto",
  sections: "Temas",
  questions: "Preguntas",
  options: "Opciones",
  conditions: "Condiciones",
  references: "Referencias",
  links: "Enlaces",
  areas: "Áreas nuevas",
};
export function ImportStructure() {
  const { projectId = "" } = useParams(),
    client = useQueryClient();
  const [file, setFile] = useState<File>(),
    [preview, setPreview] = useState<z.infer<typeof C.importPreviewView>>(),
    [result, setResult] = useState<z.infer<typeof C.importResultView>>(),
    [areas, setAreas] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID()),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);
  async function review() {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(undefined);
    try {
      const p = await exchangeRequest(
        projectId,
        "imports/preview",
        C.importPreviewView,
        { file },
      );
      setPreview(p);
      requestId.current = crypto.randomUUID();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!file || !preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await exchangeRequest(
        projectId,
        "imports/confirm",
        C.importResultView,
        {
          file,
          command: C.importConfirmInput.parse({
            payloadHash: preview.payloadHash,
            expectedProjectVersion: preview.expectedProjectVersion,
            requestId: requestId.current,
            createMissingAreas: areas,
          }),
        },
      );
      setResult(r);
      void client.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Importar cuestionario"
        lead="Seleccionar archivo → Revisar → Confirmar. Se importa estructura en un proyecto vacío; las preguntas quedarán en borrador."
      />
      {error && <Alert error>{error}</Alert>}
      {result ? (
        <>
          <Alert>
            Importación completada: {result.counts.questions} preguntas y{" "}
            {result.counts.sections} temas.
          </Alert>
          <Link to={`/projects/${projectId}/editor`}>
            Revisar estructura importada
          </Link>
        </>
      ) : (
        <>
          <h2>¿No tienes un archivo?</h2>
          <p>
            Descarga un ejemplo y adapta sus textos. El mínimo tiene un tema y
            dos preguntas; el completo muestra los ocho tipos de respuesta.
          </p>
          <ul>
            <li>
              <a
                href={minimalTemplateUrl}
                download="questionnaire-template.minimal.json"
              >
                Descargar ejemplo mínimo
              </a>
            </li>
            <li>
              <a
                href={fullTemplateUrl}
                download="questionnaire-template.full.json"
              >
                Descargar ejemplo completo
              </a>
            </li>
          </ul>
          <details>
            <summary>Cómo preparar el archivo</summary>
            <p>
              Crea un proyecto vacío. Copia su identificador externo exactamente
              en <code>project.externalId</code> dentro del archivo. Los
              ejemplos usan EXAMPLE-MINIMAL y EXAMPLE-FULL. El nombre y la
              descripción del archivo serán los del proyecto después de
              importar.
            </p>
            <p>
              Los temas están en <code>sections</code> y las preguntas en{" "}
              <code>questions</code>. Conserva los códigos que los relacionan.
              Cada área responsable debe figurar en <code>areas</code>: un
              Administrador puede confirmar su creación; un Analista necesita
              que ya exista con el mismo código y nombre.
            </p>
            <p>
              Guarda como JSON en UTF-8, selecciona el archivo y pulsa Revisar
              archivo. Si corriges algo, vuelve a seleccionarlo. No se mezclan
              ni reemplazan cuestionarios existentes. Excel, CSV y el JSON de
              exportación no son plantillas de importación.
            </p>
          </details>
          <h2>1. Seleccionar archivo</h2>
          <Input
            label="Archivo JSON"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            hint="Máximo 5 MiB. No incluye respuestas ni participantes."
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(undefined);
              setAreas(false);
              setError("");
              if (f && f.size > 5 * 1024 * 1024) {
                setError("El archivo supera 5 MiB.");
                setFile(undefined);
              } else setFile(f);
            }}
          />
          <Button disabled={!file || busy} onClick={() => void review()}>
            {busy ? "Procesando…" : "Revisar archivo"}
          </Button>
          {preview && (
            <section aria-label="Vista previa">
              <h2 ref={heading} tabIndex={-1}>
                2. Revisar importación
              </h2>
              <h3>{preview.projectName}</h3>
              <p>
                {preview.errors.length} errores · {preview.warnings.length}{" "}
                advertencias
              </p>
              <dl className="import-counts">
                {Object.entries(preview.counts).map(([key, value]) => (
                  <div key={key}>
                    <dt>{countLabels[key as keyof typeof countLabels]}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {[...preview.errors, ...preview.warnings].map((issue, i) => (
                <div className="alert" key={i}>
                  <p>
                    <strong>{importIssueContext(issue.path)}</strong>
                  </p>
                  <p>{issue.message}</p>
                  <details>
                    <summary>Detalles técnicos</summary>
                    <code>{issue.path || "/"}</code>
                  </details>
                </div>
              ))}
              {!!preview.missingAreas.length && (
                <>
                  <h3>Áreas faltantes</h3>
                  <ul>
                    {preview.missingAreas.map((a) => (
                      <li key={a.code}>
                        {a.name} ({a.code})
                      </li>
                    ))}
                  </ul>
                  {preview.canConfirm && (
                    <Checkbox
                      label="Confirmo crear estas áreas en la institución"
                      checked={areas}
                      disabled={busy}
                      onChange={(e) => setAreas(e.target.checked)}
                    />
                  )}
                </>
              )}
              <details>
                <summary>Identidad del archivo</summary>
                <p className="break-word">SHA-256: {preview.payloadHash}</p>
              </details>
              <h2>3. Confirmar</h2>
              <p>
                Se crearán los elementos mostrados en una sola operación.
                Después podrás asignar participantes y publicar.
              </p>
              <Button
                disabled={
                  busy ||
                  !preview.canConfirm ||
                  (preview.missingAreas.length > 0 && !areas)
                }
                onClick={() => void confirm()}
              >
                Confirmar importación
              </Button>
            </section>
          )}
        </>
      )}
    </>
  );
}
export function ExportProject() {
  const { projectId = "" } = useParams(),
    [format, setFormat] = useState<"JSON" | "CSV" | "MARKDOWN">("JSON"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const q = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
  if (q.isPending) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} />;
  const project = q.data.find((p) => p.id === projectId),
    viewer = project?.role === "VIEWER";
  if (!project || project.role === "STAKEHOLDER")
    return (
      <ErrorState
        error={new Error("Tu perfil no permite exportar este proyecto.")}
      />
    );
  async function download() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await exchangeFetch(projectId, "exports", {
        input: C.exportInput.parse({
          format: viewer ? "JSON" : format,
          scope: viewer ? "validated-decisions" : "full",
          requestId: crypto.randomUUID(),
        }),
      });
      saveDownload(
        await r.blob(),
        `proyecto.${format === "JSON" ? "json" : format === "CSV" ? "csv" : "md"}`,
      );
      setNotice("Archivo generado. Revisa las descargas de tu navegador.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {viewer && (
        <Link className="back" to={`/projects/${projectId}`}>
          ← Volver al proyecto
        </Link>
      )}
      <PageHeader
        title="Exportar proyecto"
        lead={
          viewer
            ? "JSON de decisiones vigentes: incluye únicamente decisiones y fuentes autorizadas. No incluye historial privado."
            : "Descarga el estado funcional de este proyecto."
        }
      />
      {error && <Alert error>{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}
      {viewer ? null : (
        <>
          <Select
            label="Formato de exportación"
            value={format}
            disabled={busy}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="JSON">JSON completo</option>
            <option value="CSV">CSV de estado</option>
            <option value="MARKDOWN">Markdown para revisión</option>
          </Select>
          <p>
            {format === "JSON"
              ? "Historial funcional autorizado, estructura y fuentes. Útil para procesamiento de datos."
              : format === "CSV"
                ? "Una fila por pregunta con estado, validación y referencias. Útil para hojas de cálculo."
                : "Documento legible con respuestas enviadas, decisión vigente y evidencia. Útil para revisión humana."}
          </p>
        </>
      )}
      <p>
        Una exportación funcional no es un backup completo. Los archivos de
        evidencia no se incrustan; sus descargas requieren autorización.
      </p>
      <Button disabled={busy} onClick={() => void download()}>
        {busy ? "Generando archivo…" : "Descargar exportación"}
      </Button>
    </>
  );
}
