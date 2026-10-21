import {
  contracts,
  errorView,
  type InvitationAccessView,
} from "@requirements/contracts";
import { z } from "zod";
import { ApiFailure } from "./api";
type Key =
  | "invitationExchange"
  | "invitationAccess"
  | "invitationLogout"
  | "invitationResponse"
  | "invitationSave"
  | "invitationSubmit"
  | "invitationAttach"
  | "invitationRemove"
  | "invitationClarifications"
  | "invitationReply";

// Capture before rendering or requesting configuration. The capability never
// enters router state, query caches, browser storage, logs or an HTTP URL.
let capturedToken = "";
let opening: Promise<InvitationAccessView> | undefined;
export function captureInvitationFragment() {
  if (
    window.location.pathname !== "/invite" ||
    !window.location.hash ||
    window.location.hash === "#main"
  )
    return false;
  capturedToken = window.location.hash.slice(1);
  opening = undefined;
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname,
  );
  return true;
}
export function discardInvitationFragment() {
  capturedToken = "";
}
captureInvitationFragment();

export class InvitationClient {
  private id = "";
  private csrf = "";
  private generation = 0;
  private assertCurrent(generation: number) {
    if (generation !== this.generation)
      throw new ApiFailure(
        409,
        "El enlace cambió. Abre de nuevo la pregunta desde la invitación actual.",
      );
  }
  private headers(binary = false) {
    return {
      "Content-Type": binary ? "application/octet-stream" : "application/json",
      "X-Invitation-Id": this.id,
      "X-CSRF-Token": this.csrf,
    };
  }
  private async fetch(path: string, init: RequestInit) {
    const r = await fetch("/api/v1" + path, {
      ...init,
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
    }).catch(() => {
      throw new ApiFailure(
        0,
        "No hay conexión. Conserva esta pantalla y vuelve a intentarlo.",
      );
    });
    if (!r.ok) {
      const e = errorView.safeParse(await r.json().catch(() => null));
      throw new ApiFailure(
        r.status,
        e.success ? e.data.message : "No fue posible completar la operación.",
        e.success ? e.data.fieldErrors : {},
      );
    }
    return r;
  }
  async request<K extends Key>(
    key: K,
    id = "",
    input?: unknown,
  ): Promise<z.infer<(typeof contracts)[K]["output"]>> {
    const c = contracts[key];
    const generation = this.generation;
    const r = await this.fetch(c.path.replace(":id", encodeURIComponent(id)), {
      method: c.method,
      headers: this.headers(),
      ...(c.method !== "GET" ? { body: JSON.stringify(input ?? {}) } : {}),
    });
    const body = await r.json();
    this.assertCurrent(generation);
    return c.output.parse(body) as z.infer<(typeof contracts)[K]["output"]>;
  }
  async open(token: string, expectedId: string): Promise<InvitationAccessView> {
    this.generation++;
    this.id = expectedId;
    this.csrf = "";
    const result = token
      ? await this.request("invitationExchange", "", { token })
      : await this.request("invitationAccess");
    this.id = result.invitationId;
    this.csrf = result.csrfToken;
    return result;
  }
  async upload(questionId: string, file: File, requestId: string) {
    const c = contracts.invitationStage;
    const generation = this.generation;
    const metadata = c.input.parse({ originalName: file.name, requestId });
    const r = await this.fetch(
      c.path.replace(":id", encodeURIComponent(questionId)),
      {
        method: "POST",
        headers: {
          ...this.headers(true),
          "X-Evidence-Metadata": encodeURIComponent(JSON.stringify(metadata)),
        },
        body: file,
      },
    );
    const body = await r.json();
    this.assertCurrent(generation);
    return c.output.parse(body);
  }
  async download(id: string) {
    const generation = this.generation;
    const r = await this.fetch(
      contracts.invitationDownload.path.replace(":id", encodeURIComponent(id)),
      { method: "GET", headers: this.headers() },
    );
    const body = await r.blob();
    this.assertCurrent(generation);
    return body;
  }
}
export const invitationClient = new InvitationClient();
export function openInvitation() {
  if (!opening) {
    const token = capturedToken;
    capturedToken = "";
    // Only the non-secret invitation identifier is retained for reload and
    // multi-tab binding. Possessing this identifier never grants access.
    const expectedId = String(window.history.state?.actaInvitationId ?? "");
    opening = invitationClient.open(token, expectedId).then((result) => {
      window.history.replaceState(
        { ...window.history.state, actaInvitationId: result.invitationId },
        "",
        "/invite",
      );
      return result;
    });
  }
  return opening;
}
