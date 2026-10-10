import { expect, request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type {
  ProjectView,
  QuestionnaireView,
  QuestionView,
  ResponseView,
  ReviewDetail,
} from "@requirements/contracts";

// Fictitious review cases built only through the public API of a disposable
// installation: no SQL, no seeded identifiers. Sessions are API-level so that
// fifty participants can be created, log in and submit in seconds.
const temporary = () => process.env.DEMO_PASSWORD!;
const changed = () => temporary() + "-Reviewed2B";

export type Api = {
  call<T>(path: string, body?: unknown, method?: string): Promise<T>;
  /** Binary body with extra headers (the questionnaire import). */
  upload<T>(
    path: string,
    body: Buffer,
    headers?: Record<string, string>,
  ): Promise<T>;
  dispose(): Promise<void>;
};

/** Signs in without the UI. `fresh` accounts still carry their temporary password. */
export async function apiSession(
  baseURL: string,
  username: string,
  fresh = false,
): Promise<Api> {
  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });
  const login = (password: string) =>
    context.post("/api/v1/auth/login", { data: { username, password } });
  let response = await login(fresh ? temporary() : changed());
  // Existing demo accounts may still hold the temporary password on a new database.
  if (!response.ok() && !fresh) response = await login(temporary());
  expect(response.ok(), `El acceso de prueba de ${username} funciona`).toBe(
    true,
  );
  let me = await response.json();
  if (me.user.mustChangePassword) {
    const update = await context.post("/api/v1/auth/change-password", {
      data: { currentPassword: temporary(), newPassword: changed() },
      headers: { "X-CSRF-Token": me.csrfToken },
    });
    expect(update.ok()).toBe(true);
    response = await login(changed());
    me = await response.json();
  }
  return {
    async call<T>(
      path: string,
      body?: unknown,
      method = body === undefined ? "GET" : "POST",
    ) {
      const result = await context.fetch(`/api/v1${path}`, {
        method,
        headers: { "X-CSRF-Token": me.csrfToken },
        ...(body === undefined ? {} : { data: body }),
      });
      // Never put credentials or invitation links in failure output.
      if (!result.ok())
        throw new Error(`${method} ${path}: ${result.status()}`);
      return (await result.json()) as T;
    },
    async upload<T>(path: string, body: Buffer, headers = {}) {
      const result = await context.post(`/api/v1${path}`, {
        data: body,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-CSRF-Token": me.csrfToken,
          ...headers,
        },
      });
      if (!result.ok()) throw new Error(`POST ${path}: ${result.status()}`);
      return (await result.json()) as T;
    },
    dispose: () => context.dispose(),
  };
}

type Area = { id: string; code: string; name: string };
type Member = { id: string; userId: string };

async function importQuestionnaire(api: Api, projectId: string, file: unknown) {
  const body = Buffer.from(JSON.stringify(file));
  const preview = await api.upload<{
    errors: unknown[];
    payloadHash: string;
    expectedProjectVersion: number;
  }>(`/projects/${projectId}/imports/preview`, body);
  expect(
    preview.errors,
    "La importación ficticia no tiene errores",
  ).toHaveLength(0);
  await api.upload(`/projects/${projectId}/imports/confirm`, body, {
    "X-Import-Command": encodeURIComponent(
      JSON.stringify({
        payloadHash: preview.payloadHash,
        expectedProjectVersion: preview.expectedProjectVersion,
        requestId: randomUUID(),
        createMissingAreas: false,
      }),
    ),
  });
}

function template(
  project: ProjectView,
  area: Area,
  questions: { title: string; question: string }[],
  type: "SHORT_TEXT" | "LONG_TEXT" = "SHORT_TEXT",
) {
  return {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: { externalId: project.externalId, name: project.name },
    areas: [{ code: area.code, name: area.name }],
    sections: [{ externalId: "TEMA-RC", title: "Revisión ficticia", order: 0 }],
    questions: questions.map((item, index) => ({
      externalId: `RC-${String(index).padStart(3, "0")}`,
      sectionExternalId: "TEMA-RC",
      title: item.title,
      question: item.question,
      type,
      required: true,
      priority: "P2",
      responsibleAreaCode: area.code,
      order: index,
      options: [],
      references: [],
    })),
    conditions: [],
    traceabilityReferences: [],
  };
}

async function createProject(api: Api, label: string) {
  const suffix = randomUUID();
  const project = await api.call<ProjectView>("/projects", {
    externalId: `${label}-${suffix}`,
    name: `${label} ficticio · ${suffix.slice(0, 8)}`,
    description: "Datos ficticios autónomos para la verificación de UX",
  });
  const area = await api.call<Area>("/areas", {
    code: `${label}-${suffix}`,
    name: `Servicios de prueba ${suffix.slice(0, 8)}`,
  });
  return { suffix, project, area };
}
async function addMember(
  api: Api,
  projectId: string,
  userId: string,
  role: "STAKEHOLDER" | "ANALYST" | "VIEWER",
  areaId: string,
) {
  return api.call<Member>(`/projects/${projectId}/members`, {
    userId,
    role,
    areaId: role === "STAKEHOLDER" ? areaId : null,
    active: true,
  });
}
async function publishAll(
  api: Api,
  projectId: string,
  questions: QuestionView[],
) {
  const publish = {
    requestId: randomUUID(),
    questions: questions.map(({ id, lockVersion }) => ({
      id,
      expectedVersion: lockVersion,
    })),
  };
  const preview = await api.call<{ previewHash: string }>(
    `/projects/${projectId}/questions/bulk/publish/preview`,
    publish,
  );
  await api.call(`/projects/${projectId}/questions/bulk/publish/confirm`, {
    ...publish,
    previewHash: preview.previewHash,
  });
}
const sorted = (q: QuestionnaireView) =>
  [...q.questions].sort((a, b) => a.order - b.order);

// A real one-page PDF: the server validates its structure.
const pdf = async (label: string) => {
  const document = await PDFDocument.create();
  document.setTitle(label);
  document.addPage([300, 200]);
  return Buffer.from(await document.save());
};
async function attachEvidence(
  api: Api,
  projectId: string,
  question: QuestionView,
  names: string[],
) {
  const path = `/projects/${projectId}/questions/${question.id}`;
  for (const name of names) {
    const staged = await api.upload<{ id: string }>(
      `${path}/evidence`,
      await pdf(name),
      {
        "X-Evidence-Metadata": encodeURIComponent(
          JSON.stringify({ requestId: randomUUID(), originalName: name }),
        ),
      },
    );
    const current = await api.call<ResponseView>(`${path}/response`);
    await api.call(`${path}/response/evidence/attach`, {
      requestId: randomUUID(),
      expectedVersion: current.lockVersion,
      evidenceId: staged.id,
    });
  }
}
async function submit(
  api: Api,
  projectId: string,
  question: QuestionView,
  text: string,
  options: { comment?: string; evidence?: string[] } = {},
) {
  const path = `/projects/${projectId}/questions/${question.id}/response`;
  const initial = await api.call<ResponseView>(path);
  await api.call<ResponseView>(
    `${path}/draft`,
    {
      requestId: randomUUID(),
      expectedVersion: initial.lockVersion,
      answer: text,
      comment:
        options.comment ??
        "Comentario ficticio que aporta contexto a la respuesta.",
      example: "",
      consultationRequested: false,
    },
    "PUT",
  );
  if (options.evidence?.length)
    await attachEvidence(api, projectId, question, options.evidence);
  const draft = await api.call<ResponseView>(path);
  await api.call(`${path}/submit`, {
    requestId: randomUUID(),
    expectedVersion: draft.lockVersion,
  });
}
async function requestClarification(
  analyst: Api,
  projectId: string,
  questionId: string,
  respondentId: string,
  body: string,
) {
  const path = `/projects/${projectId}/questions/${questionId}/review`;
  const detail = await analyst.call<ReviewDetail>(path);
  const revision = detail.submissions.find(
    (s) => s.respondent.id === respondentId,
  )!;
  await analyst.call(`${path}/clarifications/request`, {
    requestId: randomUUID(),
    expectedVersion: detail.lockVersion,
    responseRevisionId: revision.id,
    body,
  });
}

export type ReviewCases = {
  project: ProjectView;
  area: Area;
  /** Questions keyed by how many current contributions they hold. */
  questions: Record<
    "zero" | "one" | "three" | "twelve" | "fifty",
    QuestionView
  >;
};

/**
 * One project with 0, 1, 3, 12 and 50 current contributions:
 * the 3 have an open conflict (and a clarification waiting on the person),
 * the 12 have one clarification waiting on the analyst and one on the person,
 * the 50 have two clarifications waiting on the person.
 */
export async function seedReviewCases(baseURL: string): Promise<ReviewCases> {
  const admin = await apiSession(baseURL, "admin");
  try {
    const { suffix, project, area } = await createProject(admin, "RC");
    const accounts =
      await admin.call<{ id: string; username: string }[]>("/users");
    const people = [] as { id: string; username: string; member: string }[];
    for (let index = 0; index < 50; index++) {
      const username = `rc_${suffix.replaceAll("-", "").slice(0, 10)}_${String(index).padStart(2, "0")}`;
      const user = await admin.call<{ id: string }>("/users", {
        username,
        displayName: `Participante ${String(index + 1).padStart(2, "0")} de revisión`,
        temporaryPassword: temporary(),
      });
      const member = await addMember(
        admin,
        project.id,
        user.id,
        "STAKEHOLDER",
        area.id,
      );
      people.push({ id: user.id, username, member: member.id });
    }
    for (const [username, role] of [
      ["analyst", "ANALYST"],
      ["viewer", "VIEWER"],
    ] as const) {
      const user = accounts.find((a) => a.username === username);
      expect(user, `La demo incluye ${username}`).toBeDefined();
      await addMember(admin, project.id, user!.id, role, area.id);
    }
    const spec = [
      ["zero", 0, "Caso sin aportaciones"],
      ["one", 1, "Caso con una aportación"],
      ["three", 3, "Caso con tres aportaciones y un conflicto"],
      ["twelve", 12, "Caso con doce aportaciones y aclaraciones"],
      ["fifty", 50, "Caso con cincuenta aportaciones"],
    ] as const;
    await importQuestionnaire(
      admin,
      project.id,
      template(
        project,
        area,
        spec.map(([, , title]) => ({
          title,
          question: `¿Cómo se atiende el procedimiento ficticio «${title.toLowerCase()}» cuando cambian las condiciones del servicio?`,
        })),
      ),
    );
    let questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    // Everyone who will answer is assigned; the empty case has three people who have not.
    for (const [index, [, count]] of spec.entries()) {
      const assigned = index === 0 ? 3 : count;
      for (let person = 0; person < assigned; person++)
        questions[index] = await admin.call<QuestionView>(
          `/projects/${project.id}/questions/${questions[index]!.id}/assign`,
          {
            projectMemberId: people[person]!.member,
            active: true,
            required: true,
            expectedVersion: questions[index]!.lockVersion,
          },
        );
    }
    await publishAll(admin, project.id, questions);
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    const sessions = new Map<number, Api>();
    try {
      for (let person = 0; person < 50; person++) {
        const api = await apiSession(baseURL, people[person]!.username, true);
        sessions.set(person, api);
        for (const [index, [key, count]] of spec.entries())
          if (person < count)
            await submit(
              api,
              project.id,
              questions[index]!,
              `Aportación ficticia de la persona ${person + 1} para «${key}»: ${"el procedimiento se documenta y se revisa periódicamente. ".repeat(2)}`,
            );
      }
      const analyst = await apiSession(baseURL, "analyst");
      try {
        const detail = (index: number) =>
          analyst.call<ReviewDetail>(
            `/projects/${project.id}/questions/${questions[index]!.id}/review`,
          );
        // 3 contributions: a conflict between the first two and a clarification on the third.
        const three = await detail(2);
        await analyst.call(
          `/projects/${project.id}/questions/${questions[2]!.id}/review/conflicts`,
          {
            requestId: randomUUID(),
            expectedVersion: three.lockVersion,
            reason:
              "Dos aportaciones ficticias describen procedimientos diferentes.",
            responseRevisionIds: three.submissions
              .filter((s) =>
                [people[0]!.id, people[1]!.id].includes(s.respondent.id),
              )
              .map((s) => s.id),
          },
        );
        await requestClarification(
          analyst,
          project.id,
          questions[2]!.id,
          people[2]!.id,
          "Indica en qué documento se apoya tu procedimiento.",
        );
        // 12 contributions: person 8 answered a clarification (waits on the analyst),
        // person 4 has not answered yet (waits on the person).
        for (const person of [7, 3])
          await requestClarification(
            analyst,
            project.id,
            questions[3]!.id,
            people[person]!.id,
            "Explica el alcance del procedimiento ficticio.",
          );
        const mine = await sessions.get(7)!.call<{
          lockVersion: number;
          threads: { id: string; lockVersion: number; status: string }[];
        }>(`/projects/${project.id}/questions/${questions[3]!.id}/clarifications`);
        const open = mine.threads.find(
          (thread) => thread.status === "WAITING_STAKEHOLDER",
        )!;
        await sessions
          .get(7)!
          .call(
            `/projects/${project.id}/questions/${questions[3]!.id}/review/clarifications/reply`,
            {
              requestId: randomUUID(),
              expectedVersion: mine.lockVersion,
              threadId: open.id,
              expectedThreadVersion: open.lockVersion,
              body: "El procedimiento se documentó en la guía interna.",
            },
          );
        // 50 contributions: two clarifications waiting on the person.
        for (const person of [4, 21])
          await requestClarification(
            analyst,
            project.id,
            questions[4]!.id,
            people[person]!.id,
            "¿Podrías indicar el documento que sustenta este criterio?",
          );
      } finally {
        await analyst.dispose();
      }
    } finally {
      for (const api of sessions.values()) await api.dispose();
    }
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    return {
      project,
      area,
      questions: {
        zero: questions[0]!,
        one: questions[1]!,
        three: questions[2]!,
        twelve: questions[3]!,
        fifty: questions[4]!,
      },
    };
  } finally {
    await admin.dispose();
  }
}

export type DocumentCases = {
  project: ProjectView;
  /** Questions that exercise long answers, evidence, exchanges and decisions. */
  questions: Record<
    "conflict" | "decision" | "reopened" | "long",
    QuestionView
  >;
};

const longAnswer = (person: number) =>
  `Criterio de la persona ${person}: ` +
  "el procedimiento debe documentarse de forma completa, indicando el fundamento, el responsable de cada paso, los plazos aplicables y las excepciones admitidas; además, cualquier cambio posterior debe comunicarse por escrito a todas las áreas que participan en la operación. ".repeat(
    3,
  );

/**
 * Cases for the composition of conflicts, exchanges and decisions: a conflict
 * with evidence on one side only, a decision with every kind of ground (two
 * answers with files, a closed clarification and a resolved conflict), a
 * decision that was reopened, and twelve long answers with files.
 */
export async function seedDocumentCases(
  baseURL: string,
): Promise<DocumentCases> {
  const admin = await apiSession(baseURL, "admin");
  try {
    const { suffix, project, area } = await createProject(admin, "DOC");
    const accounts =
      await admin.call<{ id: string; username: string }[]>("/users");
    const people = [] as { id: string; username: string; member: string }[];
    for (let index = 0; index < 12; index++) {
      const username = `dc_${suffix.replaceAll("-", "").slice(0, 10)}_${String(index).padStart(2, "0")}`;
      const user = await admin.call<{ id: string }>("/users", {
        username,
        displayName: [
          "Lucía Barrera",
          "Mateo Ibarra",
          "Paula Quintana",
          "Héctor Villalobos",
          "Renata Solís",
          "Camilo Ortega",
          "Inés Navarro",
          "Tomás Aguirre",
          "Valeria Rojas",
          "Andrés Paredes",
          "Julia Montes",
          "Bruno Cárdenas",
        ][index]!,
        temporaryPassword: temporary(),
      });
      const member = await addMember(
        admin,
        project.id,
        user.id,
        "STAKEHOLDER",
        area.id,
      );
      people.push({ id: user.id, username, member: member.id });
    }
    for (const [username, role] of [
      ["analyst", "ANALYST"],
      ["viewer", "VIEWER"],
    ] as const) {
      const user = accounts.find((a) => a.username === username);
      expect(user, `La demo incluye ${username}`).toBeDefined();
      await addMember(admin, project.id, user!.id, role, area.id);
    }
    const spec = [
      ["conflict", 2, "Umbral de fianza de cumplimiento"],
      ["decision", 3, "Plazo máximo de pago a proveedores"],
      ["reopened", 2, "Comunicación del resultado"],
      ["long", 12, "Criterios de adjudicación directa"],
    ] as const;
    await importQuestionnaire(
      admin,
      project.id,
      template(
        project,
        area,
        spec.map(([, , title]) => ({
          title,
          question: `¿Cuál es el criterio ficticio para «${title.toLowerCase()}» y qué excepciones por tipo de bien o de proveedor deben considerarse?`,
        })),
        "LONG_TEXT",
      ),
    );
    let questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    for (const [index, [, count]] of spec.entries())
      for (let person = 0; person < count; person++)
        questions[index] = await admin.call<QuestionView>(
          `/projects/${project.id}/questions/${questions[index]!.id}/assign`,
          {
            projectMemberId: people[person]!.member,
            active: true,
            required: true,
            expectedVersion: questions[index]!.lockVersion,
          },
        );
    await publishAll(admin, project.id, questions);
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    const sessions = new Map<number, Api>();
    try {
      for (let person = 0; person < 12; person++) {
        const api = await apiSession(baseURL, people[person]!.username, true);
        sessions.set(person, api);
        for (const [index, [key, count]] of spec.entries()) {
          if (person >= count) continue;
          const evidence =
            key === "conflict" && person === 0
              ? [
                  "Manual_de_adquisiciones_art_48_version_vigente.pdf",
                  "Dictamen_juridico_2023.pdf",
                ]
              : key === "decision" && person < 2
                ? [`Acta_de_recepcion_documental_${person + 1}.pdf`]
                : key === "long" && person < 4
                  ? Array.from(
                      { length: person },
                      (_, n) => `Soporte_${person + 1}_${n + 1}.pdf`,
                    )
                  : [];
          await submit(
            api,
            project.id,
            questions[index]!,
            key === "long" || key === "conflict"
              ? longAnswer(person + 1)
              : `Respuesta ficticia de la persona ${person + 1} para «${key}».`,
            { evidence },
          );
        }
      }
      const analyst = await apiSession(baseURL, "analyst");
      try {
        const review = (index: number) =>
          `/projects/${project.id}/questions/${questions[index]!.id}/review`;
        const detail = (index: number) =>
          analyst.call<ReviewDetail>(review(index));
        const idsOf = (d: ReviewDetail, count: number) =>
          d.submissions
            .filter((s) =>
              people.slice(0, count).some((p) => p.id === s.respondent.id),
            )
            .map((s) => s);
        // conflict: open conflict between the first two.
        const conflict = await detail(0);
        await analyst.call(`${review(0)}/conflicts`, {
          requestId: randomUUID(),
          expectedVersion: conflict.lockVersion,
          reason:
            "Umbrales incompatibles: 500 UMA sin excepciones frente a 1,200 UMA con excepción por pago contra entrega.",
          responseRevisionIds: idsOf(conflict, 2).map((s) => s.id),
        });
        // decision: conflict (1,2) + clarification (3) → resolved and closed → validated.
        let decision = await detail(1);
        await analyst.call(`${review(1)}/conflicts`, {
          requestId: randomUUID(),
          expectedVersion: decision.lockVersion,
          reason: "Las dos primeras aportaciones fijan plazos distintos.",
          responseRevisionIds: idsOf(decision, 2).map((s) => s.id),
        });
        await requestClarification(
          analyst,
          project.id,
          questions[1]!.id,
          people[2]!.id,
          "¿El plazo aplica también a bienes de importación?",
        );
        const mine = await sessions.get(2)!.call<{
          lockVersion: number;
          threads: { id: string; lockVersion: number; status: string }[];
        }>(`/projects/${project.id}/questions/${questions[1]!.id}/clarifications`);
        const asked = mine.threads.find(
          (t) => t.status === "WAITING_STAKEHOLDER",
        )!;
        await sessions.get(2)!.call(`${review(1)}/clarifications/reply`, {
          requestId: randomUUID(),
          expectedVersion: mine.lockVersion,
          threadId: asked.id,
          expectedThreadVersion: asked.lockVersion,
          body: "Sí: para bienes de importación se admiten 30 días naturales.",
        });
        decision = await detail(1);
        const thread = decision.threads[0]!;
        await analyst.call(`${review(1)}/clarifications/close`, {
          requestId: randomUUID(),
          expectedVersion: decision.lockVersion,
          threadId: thread.id,
          expectedThreadVersion: thread.lockVersion,
          reason: "Aclarado: el criterio queda documentado.",
        });
        decision = await detail(1);
        const open = decision.conflicts.find((c) => c.status === "OPEN")!;
        await analyst.call(`${review(1)}/conflicts/resolve`, {
          requestId: randomUUID(),
          expectedVersion: decision.lockVersion,
          conflictId: open.id,
          expectedConflictVersion: open.lockVersion,
          resolutionText: "Se adopta el plazo de 20 días naturales.",
          responseRevisionIds: [idsOf(decision, 1)[0]!.id],
        });
        decision = await detail(1);
        await analyst.call(`${review(1)}/validate`, {
          requestId: randomUUID(),
          expectedVersion: decision.lockVersion,
          decisionText:
            "El plazo máximo de pago es de 20 días naturales contados desde la recepción de la factura validada por Almacén. Se admiten 30 días naturales únicamente para bienes de importación.",
          scope:
            "Todas las adquisiciones del Instituto con recurso propio, a partir de los contratos y convenios modificatorios firmados desde el 1 de enero de 2027.",
          exceptions:
            "No aplica a contratos plurianuales vigentes ni a pagos sujetos a recurso federal con calendario propio.",
          validationComment: "Comentario interno ficticio del analista.",
          responseRevisionIds: idsOf(decision, 3).map((s) => s.id),
          clarificationMessageIds: decision.threads[0]!.messages.map(
            (m) => m.id,
          ),
          conflictResolutionIds: [
            decision.conflicts.find((c) => c.resolution)!.resolution!.id,
          ],
        });
        // reopened: validated and then reopened, so the decision is historical.
        let reopened = await detail(2);
        await analyst.call(`${review(2)}/validate`, {
          requestId: randomUUID(),
          expectedVersion: reopened.lockVersion,
          decisionText: "Se comunica el resultado por el canal registrado.",
          scope: "Solicitudes del proyecto ficticio.",
          exceptions: "",
          validationComment: "Comentario interno ficticio.",
          responseRevisionIds: idsOf(reopened, 2).map((s) => s.id),
          clarificationMessageIds: [],
          conflictResolutionIds: [],
        });
        reopened = await detail(2);
        await analyst.call(`${review(2)}/reopen`, {
          requestId: randomUUID(),
          expectedVersion: reopened.lockVersion,
          reason: "Cambió el alcance de la comunicación.",
        });
      } finally {
        await analyst.dispose();
      }
    } finally {
      for (const api of sessions.values()) await api.dispose();
    }
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    return {
      project,
      questions: {
        conflict: questions[0]!,
        decision: questions[1]!,
        reopened: questions[2]!,
        long: questions[3]!,
      },
    };
  } finally {
    await admin.dispose();
  }
}

export type ParticipantCases = {
  project: ProjectView;
  /** What the demo participant sees in "Mi trabajo". */
  questions: {
    submitted: QuestionView;
    clarification: QuestionView;
    validated: QuestionView;
    draft: QuestionView;
    pending: QuestionView[];
  };
  /** An external invitation for three of the pending questions (the link is a secret: never log it). */
  invitation: { url: string; questionIds: string[] };
};

/**
 * The demo participant with every state of their own work: a submitted answer
 * with a file, a clarification waiting on them, a validated decision, a saved
 * draft and pending questions; plus an external invitation for three of those.
 */
export async function seedParticipantCases(
  baseURL: string,
): Promise<ParticipantCases> {
  const admin = await apiSession(baseURL, "admin");
  try {
    const { project, area } = await createProject(admin, "PRT");
    const accounts =
      await admin.call<{ id: string; username: string }[]>("/users");
    const uid = (name: string) => accounts.find((a) => a.username === name)!.id;
    const stakeholder = await addMember(
      admin,
      project.id,
      uid("stakeholder"),
      "STAKEHOLDER",
      area.id,
    );
    await addMember(admin, project.id, uid("analyst"), "ANALYST", area.id);
    await addMember(admin, project.id, uid("viewer"), "VIEWER", area.id);
    const titles = [
      "Presentación de una requisición",
      "Criterio de urgencia fuera de calendario",
      "Plazo máximo de pago a proveedores",
      "Estudio de mercado previo a la contratación",
      "Datos de contacto del proveedor",
      "Formato de entregas parciales",
      "Responsable del finiquito de contratos",
      "Revisión de garantías de cumplimiento",
    ];
    await importQuestionnaire(
      admin,
      project.id,
      template(
        project,
        area,
        titles.map((title) => ({
          title,
          question: `¿Cómo debe atenderse «${title.toLowerCase()}» para que el procedimiento pueda continuar con claridad y sin retrasos?`,
        })),
        "LONG_TEXT",
      ),
    );
    let questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    for (const [index, question] of questions.entries())
      questions[index] = await admin.call<QuestionView>(
        `/projects/${project.id}/questions/${question.id}/assign`,
        {
          projectMemberId: stakeholder.id,
          active: true,
          required: true,
          expectedVersion: question.lockVersion,
        },
      );
    await publishAll(admin, project.id, questions);
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    const person = await apiSession(baseURL, "stakeholder");
    const analyst = await apiSession(baseURL, "analyst");
    try {
      await submit(
        person,
        project.id,
        questions[0]!,
        "Una requisición se considera completa cuando incluye la descripción del bien o servicio, la cantidad, el área usuaria, la justificación y la suficiencia presupuestaria validada por Finanzas.",
        { evidence: ["Formato_requisicion_vigente.pdf"] },
      );
      await submit(
        person,
        project.id,
        questions[1]!,
        "Cualquier requisición urgente debe autorizarla la persona titular del área con la justificación escrita del hecho que la origina.",
      );
      await submit(
        person,
        project.id,
        questions[2]!,
        "El pago se realiza dentro de los veinte días naturales posteriores a la recepción de la factura validada.",
      );
      const draftPath = `/projects/${project.id}/questions/${questions[3]!.id}/response`;
      const initial = await person.call<ResponseView>(draftPath);
      await person.call(
        `${draftPath}/draft`,
        {
          requestId: randomUUID(),
          expectedVersion: initial.lockVersion,
          answer:
            "Borrador: el estudio de mercado se exige en los rubros de mayor monto.",
          comment: "",
          example: "",
          consultationRequested: false,
        },
        "PUT",
      );
      await requestClarification(
        analyst,
        project.id,
        questions[1]!.id,
        accounts.find((a) => a.username === "stakeholder")!.id,
        "¿Quién autoriza una requisición urgente fuera del calendario anual y con qué criterio se justifica?",
      );
      const validated = await analyst.call<ReviewDetail>(
        `/projects/${project.id}/questions/${questions[2]!.id}/review`,
      );
      await analyst.call(
        `/projects/${project.id}/questions/${questions[2]!.id}/review/validate`,
        {
          requestId: randomUUID(),
          expectedVersion: validated.lockVersion,
          decisionText: "El plazo máximo de pago es de 20 días naturales.",
          scope: "Todas las adquisiciones con recurso propio.",
          exceptions: "",
          validationComment: "Comentario interno ficticio.",
          responseRevisionIds: validated.submissions.map((s) => s.id),
          clarificationMessageIds: [],
          conflictResolutionIds: [],
        },
      );
      const invited = questions.slice(4, 7);
      const link = await analyst.call<{ url: string }>(
        `/projects/${project.id}/invitations`,
        {
          requestId: randomUUID(),
          label: "Invitación ficticia de verificación",
          questionIds: invited.map((q) => q.id),
          areaId: area.id,
          identity: { name: "Persona invitada ficticia" },
          nonNominal: false,
          allowEvidence: true,
        },
      );
      return {
        project,
        questions: {
          submitted: questions[0]!,
          clarification: questions[1]!,
          validated: questions[2]!,
          draft: questions[3]!,
          pending: questions.slice(4),
        },
        invitation: {
          url: link.url,
          questionIds: invited.map((q) => q.id),
        },
      };
    } finally {
      await person.dispose();
      await analyst.dispose();
    }
  } finally {
    await admin.dispose();
  }
}

export type ScaleFixture = {
  project: ProjectView;
  total: number;
  /** The question that has both an open conflict and an open clarification. */
  overlap: QuestionView;
  /** Counts of the rows each Atención group should hold. */
  action: number;
  clarificationsOnly: number;
  waiting: number;
  /** Questions nobody is assigned to stay "not reviewed": only the full list holds them. */
  unassigned: number;
};

/**
 * `count` published questions on a disposable project: one conflict, one open
 * clarification, two ready to decide, a share assigned to a person who has not
 * answered (waiting on others) and the rest without participants.
 */
export async function seedScale(
  baseURL: string,
  count: number,
): Promise<ScaleFixture> {
  const admin = await apiSession(baseURL, "admin");
  try {
    const { suffix, project, area } = await createProject(admin, "ESC");
    const accounts =
      await admin.call<{ id: string; username: string }[]>("/users");
    const uid = (name: string) => accounts.find((a) => a.username === name)!.id;
    const other = await admin.call<{ id: string }>("/users", {
      username: `esc_${suffix.replaceAll("-", "").slice(0, 12)}`,
      displayName: "Segundo participante ficticio",
      temporaryPassword: temporary(),
    });
    const stakeholder = await addMember(
      admin,
      project.id,
      uid("stakeholder"),
      "STAKEHOLDER",
      area.id,
    );
    const second = await addMember(
      admin,
      project.id,
      other.id,
      "STAKEHOLDER",
      area.id,
    );
    await addMember(admin, project.id, uid("analyst"), "ANALYST", area.id);
    await addMember(admin, project.id, uid("viewer"), "VIEWER", area.id);
    await importQuestionnaire(
      admin,
      project.id,
      template(
        project,
        area,
        Array.from({ length: count }, (_, index) => ({
          title: `Caso ficticio ${String(index).padStart(3, "0")}`,
          question: `¿Cómo se atiende el caso ficticio ${index} del servicio de prueba?`,
        })),
      ),
    );
    let questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    const waiting = Math.max(0, Math.floor((count - 4) * 0.4));
    const assign = async (index: number, member: Member) => {
      questions[index] = await admin.call<QuestionView>(
        `/projects/${project.id}/questions/${questions[index]!.id}/assign`,
        {
          projectMemberId: member.id,
          active: true,
          required: true,
          expectedVersion: questions[index]!.lockVersion,
        },
      );
    };
    for (let index = 0; index < Math.min(4, count); index++) {
      await assign(index, stakeholder);
      if (index === 0) await assign(index, second);
    }
    // Two required people, only one will answer: the question is partial and waits on the other.
    for (let index = 4; index < 4 + waiting && index < count; index++) {
      await assign(index, stakeholder);
      await assign(index, second);
    }
    await publishAll(admin, project.id, questions);
    questions = sorted(
      await admin.call<QuestionnaireView>(
        `/projects/${project.id}/questionnaire`,
      ),
    );
    for (const [username, fresh, indexes] of [
      [
        "stakeholder",
        false,
        [0, 1, 2, 3, ...Array.from({ length: waiting }, (_, i) => 4 + i)],
      ],
      [`esc_${suffix.replaceAll("-", "").slice(0, 12)}`, true, [0]],
    ] as const) {
      const person = await apiSession(baseURL, username, fresh);
      try {
        for (const index of indexes.filter((i) => i < count))
          await submit(
            person,
            project.id,
            questions[index]!,
            `Aportación ficticia de ${username} para el caso ${index}.`,
          );
      } finally {
        await person.dispose();
      }
    }
    const analyst = await apiSession(baseURL, "analyst");
    try {
      const path = (index: number) =>
        `/projects/${project.id}/questions/${questions[index]!.id}/review`;
      const respondent = uid("stakeholder");
      if (count > 1)
        await requestClarification(
          analyst,
          project.id,
          questions[1]!.id,
          respondent,
          "Explica el alcance del caso ficticio.",
        );
      const overlap = await analyst.call<ReviewDetail>(path(0));
      await analyst.call(`${path(0)}/conflicts`, {
        requestId: randomUUID(),
        expectedVersion: overlap.lockVersion,
        reason:
          "Dos aportaciones ficticias describen procedimientos diferentes.",
        responseRevisionIds: overlap.submissions.map((s) => s.id),
      });
      // The same conflicted question also carries an open clarification.
      await requestClarification(
        analyst,
        project.id,
        questions[0]!.id,
        respondent,
        "¿Qué documento respalda esta aportación?",
      );
      if (count > 3) {
        const decision = await analyst.call<ReviewDetail>(path(3));
        await analyst.call(`${path(3)}/validate`, {
          requestId: randomUUID(),
          expectedVersion: decision.lockVersion,
          decisionText: "Se adopta el procedimiento ficticio documentado.",
          scope: "Exclusivamente los casos ficticios de esta prueba",
          validationComment: "La aportación ficticia cubre el alcance.",
          responseRevisionIds: decision.submissions.map((s) => s.id),
        });
      }
    } finally {
      await analyst.dispose();
    }
    return {
      project,
      total: count,
      overlap: questions[0]!,
      // conflict (with a clarification) + one ready to decide; index 3 is validated.
      action: 1 + (count > 2 ? 1 : 0),
      clarificationsOnly: count > 1 ? 1 : 0,
      waiting,
      unassigned: Math.max(0, count - 4 - waiting),
    };
  } finally {
    await admin.dispose();
  }
}
