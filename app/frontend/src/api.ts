import { contracts, errorView } from "@requirements/contracts";
import { z } from "zod";
let csrfToken = "";
export function setCsrf(value: string) {
  csrfToken = value;
}
export class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
type Key = Exclude<
  keyof typeof contracts,
  "stageEvidence" | "downloadEvidence"
>;
export async function api<K extends Key>(
  key: K,
  params: Record<string, string> = {},
  input?: unknown,
): Promise<z.infer<(typeof contracts)[K]["output"]>> {
  const c = contracts[key];
  let path: string = c.path;
  for (const [k, v] of Object.entries(params))
    path = path.replace(":" + k, encodeURIComponent(v));
  if (c.method === "GET" && input && "input" in c) {
    const parsed = c.input.parse(input);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(parsed))
      if (value !== undefined) query.set(key, String(value));
    path += "?" + query.toString();
  }
  const response = await fetch("/api/v1" + path, {
    method: c.method,
    credentials: "same-origin",
    headers: {
      ...(c.method !== "GET"
        ? { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }
        : {}),
    },
    ...(c.method !== "GET" ? { body: JSON.stringify(input ?? {}) } : {}),
  }).catch(() => {
    throw new ApiFailure(
      0,
      "No hay conexión con el servicio. Conserva esta pantalla e inténtalo nuevamente.",
    );
  });
  const body: unknown = await response.json().catch(() => {
    throw new ApiFailure(
      response.status,
      "No fue posible leer la respuesta del servicio. Inténtalo nuevamente.",
    );
  });
  if (!response.ok) {
    const e = errorView.safeParse(body);
    if (response.status === 401 && key !== "login" && key !== "me")
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiFailure(
      response.status,
      e.success ? e.data.message : "No fue posible completar la operación.",
      e.success ? e.data.fieldErrors : {},
    );
  }
  const result = c.output.safeParse(body);
  if (!result.success)
    throw new ApiFailure(
      500,
      "La información recibida no tiene el formato esperado. Actualiza la página o contacta a la administración.",
    );
  return result.data as z.infer<(typeof contracts)[K]["output"]>;
}
export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<
    string,
    string
  >;
}

export async function uploadEvidence(
  params: Record<string, string>,
  metadata: unknown,
  file: File,
) {
  const c = contracts.stageEvidence;
  const parsed = c.input.parse(metadata);
  let path: string = c.path;
  for (const [k, v] of Object.entries(params))
    path = path.replace(":" + k, encodeURIComponent(v));
  const r = await fetch("/api/v1" + path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-CSRF-Token": csrfToken,
      "X-Evidence-Metadata": encodeURIComponent(JSON.stringify(parsed)),
    },
    body: file,
  }).catch(() => {
    throw new ApiFailure(
      0,
      "La carga no se confirmó. Conserva el archivo e inténtalo de nuevo.",
    );
  });
  const body: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("session-expired"));
    const e = errorView.safeParse(body);
    throw new ApiFailure(
      r.status,
      e.success ? e.data.message : "No se pudo cargar el archivo.",
    );
  }
  return c.output.parse(body);
}
export async function downloadEvidence(projectId: string, id: string) {
  const r = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/evidence/${encodeURIComponent(id)}/download`,
    { credentials: "same-origin" },
  ).catch(() => {
    throw new ApiFailure(0, "No se pudo conectar para descargar.");
  });
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("session-expired"));
    const e = errorView.safeParse(await r.json().catch(() => null));
    throw new ApiFailure(
      r.status,
      e.success ? e.data.message : "No se pudo descargar el archivo.",
    );
  }
  return r.blob();
}

export async function exchangeRequest<T>(
  projectId: string,
  operation: string,
  schema: z.ZodType<T>,
  options?: {
    file?: File;
    command?: unknown;
    input?: unknown;
    query?: Record<string, string>;
  },
): Promise<T> {
  const response = await exchangeFetch(projectId, operation, options);
  return schema.parse(await response.json());
}
export async function exchangeFetch(
  projectId: string,
  operation: string,
  options?: {
    file?: File;
    command?: unknown;
    input?: unknown;
    query?: Record<string, string>;
  },
) {
  const query = options?.query
    ? "?" + new URLSearchParams(options.query).toString()
    : "";
  const mutation = !!options?.file || options?.input !== undefined;
  const r = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/${operation}${query}`,
    {
      method: mutation ? "POST" : "GET",
      credentials: "same-origin",
      headers: {
        ...(mutation
          ? {
              "X-CSRF-Token": csrfToken,
              "Content-Type": options?.file
                ? "application/octet-stream"
                : "application/json",
            }
          : {}),
        ...(options?.command
          ? {
              "X-Import-Command": encodeURIComponent(
                JSON.stringify(options.command),
              ),
            }
          : {}),
      },
      ...(mutation
        ? { body: options?.file ?? JSON.stringify(options?.input) }
        : {}),
    },
  ).catch(() => {
    throw new ApiFailure(
      0,
      "No hay conexión. Conserva el archivo y vuelve a intentarlo.",
    );
  });
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("session-expired"));
    const e = errorView.safeParse(await r.json().catch(() => null));
    throw new ApiFailure(
      r.status,
      e.success ? e.data.message : "No se pudo completar la operación.",
      e.success ? e.data.fieldErrors : {},
    );
  }
  return r;
}
export function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
