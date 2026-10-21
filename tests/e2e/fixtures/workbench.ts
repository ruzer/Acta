import { expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  InvitationView,
  ProjectView,
  QuestionnaireView,
  QuestionView,
  ResponseView,
  ReviewDetail,
} from "@requirements/contracts";
import { login } from "../login-helper";

type Area = { id: string; code: string; name: string };
export type Invitations = {
  items: InvitationView[];
  total: number;
  page: number;
};
export type Fixture = {
  project: ProjectView;
  area: Area;
  questions: QuestionView[];
  urgent: InvitationView;
  revoked: InvitationView;
  participantId: string;
};

// Use the configured demo installation and its public, authenticated commands.
// Each worker creates a new project; no seeded project IDs or database writes.
export async function command<T>(
  page: Page,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  return page.evaluate(
    async ({ path, body, method }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch(`/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Do not put invitation URLs, tokens or credentials in failure output.
      if (!response.ok)
        throw new Error(`${method} ${path}: ${response.status}`);
      return response.json();
    },
    { path, body, method },
  );
}

export async function asUser<T>(
  browser: Browser,
  username: string,
  work: (page: Page) => Promise<T>,
  newAccount = false,
) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, username, { temporary: newAccount });
    return await work(page);
  } finally {
    await context.close();
  }
}

export async function prepare(
  browser: Browser,
  questionCount = 54,
): Promise<Fixture> {
  const suffix = randomUUID();
  const otherUsername = `next_${suffix.replaceAll("-", "").slice(0, 16)}`;
  const fixture = await asUser(browser, "admin", async (page) => {
    const project = await command<ProjectView>(page, "/projects", {
      externalId: `NEXT-WORKBENCH-${suffix}`,
      name: `Workbench ficticio · ${suffix}`,
      description: "Datos ficticios autónomos para la navegación de ACTA NEXT",
    });
    const area = await command<Area>(page, "/areas", {
      code: `NEXT-WORKBENCH-${suffix}`,
      name: `Servicios de prueba ${suffix.slice(0, 8)}`,
    });
    const users = await command<{ id: string; username: string }[]>(
      page,
      "/users",
    );
    const other = await command<{ id: string }>(page, "/users", {
      username: otherUsername,
      displayName: "Segundo participante ficticio del workbench",
      temporaryPassword: process.env.DEMO_PASSWORD!,
    });
    const members: Record<string, string> = {};
    for (const username of [
      "analyst",
      "stakeholder",
      "viewer",
      otherUsername,
    ]) {
      const user =
        username === otherUsername
          ? other
          : users.find((candidate) => candidate.username === username);
      expect(user, `La instalación demo incluye ${username}`).toBeDefined();
      const role =
        username === "analyst"
          ? "ANALYST"
          : username === "viewer"
            ? "VIEWER"
            : "STAKEHOLDER";
      members[username] = (
        await command<{ id: string }>(page, `/projects/${project.id}/members`, {
          userId: user!.id,
          role,
          areaId: role === "STAKEHOLDER" ? area.id : null,
          active: true,
        })
      ).id;
    }
    const file = {
      formatVersion: "1.0",
      kind: "questionnaire-template",
      project: { externalId: project.externalId, name: project.name },
      areas: [{ code: area.code, name: area.name }],
      sections: [
        { externalId: "TEMA-NEXT", title: "Servicio ficticio", order: 0 },
      ],
      questions: Array.from({ length: questionCount }, (_, index) => ({
        externalId: `NEXT-WB-${String(index).padStart(2, "0")}`,
        sectionExternalId: "TEMA-NEXT",
        title: `Caso ficticio ${String(index).padStart(2, "0")}`,
        question: `¿Cómo se atiende el caso ficticio ${index}?`,
        type: "SHORT_TEXT",
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
    await page.evaluate(
      async ({ projectId, file }) => {
        const me = await (await fetch("/api/v1/auth/me")).json();
        const headers = {
          "Content-Type": "application/octet-stream",
          "X-CSRF-Token": me.csrfToken,
        };
        const previewResponse = await fetch(
          `/api/v1/projects/${projectId}/imports/preview`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(file),
          },
        );
        const preview = await previewResponse.json();
        if (!previewResponse.ok || preview.errors.length)
          throw new Error(`Import preview rejected: ${previewResponse.status}`);
        const confirmation = await fetch(
          `/api/v1/projects/${projectId}/imports/confirm`,
          {
            method: "POST",
            headers: {
              ...headers,
              "X-Import-Command": encodeURIComponent(
                JSON.stringify({
                  payloadHash: preview.payloadHash,
                  expectedProjectVersion: preview.expectedProjectVersion,
                  requestId: crypto.randomUUID(),
                  createMissingAreas: false,
                }),
              ),
            },
            body: JSON.stringify(file),
          },
        );
        if (!confirmation.ok)
          throw new Error(`Import confirmation: ${confirmation.status}`);
      },
      { projectId: project.id, file },
    );

    const questionnaire = () =>
      command<QuestionnaireView>(page, `/projects/${project.id}/questionnaire`);
    let questions = (await questionnaire()).questions.sort(
      (a, b) => a.order - b.order,
    );
    // The first four cases become: overlap, clarification, ready, validated.
    for (let index = 0; index < 4; index++) {
      for (const username of index === 0
        ? ["stakeholder", otherUsername]
        : ["stakeholder"]) {
        questions[index] = await command<QuestionView>(
          page,
          `/projects/${project.id}/questions/${questions[index].id}/assign`,
          {
            projectMemberId: members[username],
            active: true,
            required: true,
            expectedVersion: questions[index].lockVersion,
          },
        );
      }
    }
    const publish = {
      requestId: randomUUID(),
      questions: questions.map(({ id, lockVersion }) => ({
        id,
        expectedVersion: lockVersion,
      })),
    };
    const preview = await command<{ previewHash: string }>(
      page,
      `/projects/${project.id}/questions/bulk/publish/preview`,
      publish,
    );
    await command(
      page,
      `/projects/${project.id}/questions/bulk/publish/confirm`,
      {
        ...publish,
        previewHash: preview.previewHash,
      },
    );
    questions = (await questionnaire()).questions.sort(
      (a, b) => a.order - b.order,
    );
    expect(questions).toHaveLength(questionCount);
    expect(
      questions.every((question) => question.publication === "PUBLISHED"),
    ).toBe(true);

    async function invite(label: string, days: number) {
      const result = await command<{ invitation: InvitationView }>(
        page,
        `/projects/${project.id}/invitations`,
        {
          requestId: randomUUID(),
          label,
          questionIds: [questions[53].id],
          areaId: area.id,
          identity: {
            name: "Destinatario ficticio",
            email: "ficticio@example.invalid",
          },
          nonNominal: false,
          expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          allowEvidence: false,
        },
      );
      return result.invitation;
    }
    // Descending creation order puts both urgent links beyond the first API page.
    const urgent = await invite("Urgente ficticia de segunda página", 3);
    const revoked = await invite("Urgente revocada ficticia", 3);
    await command(
      page,
      `/projects/${project.id}/invitations/${revoked.id}/revoke`,
      {
        expectedVersion: revoked.lockVersion,
      },
    );
    for (let index = 0; index < 25; index++)
      await invite(
        `Vigencia amplia ficticia ${String(index).padStart(2, "0")}`,
        14,
      );
    return {
      project,
      area,
      questions,
      urgent,
      revoked,
      participantId: users.find((u) => u.username === "stakeholder")!.id,
    };
  });

  for (const username of ["stakeholder", otherUsername]) {
    await asUser(
      browser,
      username,
      async (page) => {
        for (const question of username === otherUsername
          ? fixture.questions.slice(0, 1)
          : fixture.questions.slice(0, 4)) {
          const path = `/projects/${fixture.project.id}/questions/${question.id}/response`;
          const initial = await command<ResponseView>(page, path);
          const draft = await command<ResponseView>(
            page,
            `${path}/draft`,
            {
              requestId: randomUUID(),
              expectedVersion: initial.lockVersion,
              answer: `Aportación ficticia de ${username} para ${question.title}`,
              comment: "",
              example: "",
              consultationRequested: false,
            },
            "PUT",
          );
          await command(page, `${path}/submit`, {
            requestId: randomUUID(),
            expectedVersion: draft.lockVersion,
          });
        }
      },
      username === otherUsername,
    );
  }
  await asUser(browser, "analyst", async (page) => {
    const path = (index: number) =>
      `/projects/${fixture.project.id}/questions/${fixture.questions[index].id}/review`;
    for (const index of [0, 1]) {
      const detail = await command<ReviewDetail>(page, path(index));
      await command(page, `${path(index)}/clarifications/request`, {
        requestId: randomUUID(),
        expectedVersion: detail.lockVersion,
        responseRevisionId: detail.submissions.find(
          (s) => s.respondent.id === fixture.participantId,
        )!.id,
        body: "Explica el alcance del procedimiento ficticio.",
      });
    }
    const overlap = await command<ReviewDetail>(page, path(0));
    await command(page, `${path(0)}/conflicts`, {
      requestId: randomUUID(),
      expectedVersion: overlap.lockVersion,
      reason: "Dos aportaciones ficticias describen procedimientos diferentes.",
      responseRevisionIds: overlap.submissions.map(
        (submission) => submission.id,
      ),
    });
    const decision = await command<ReviewDetail>(page, path(3));
    await command(page, `${path(3)}/validate`, {
      requestId: randomUUID(),
      expectedVersion: decision.lockVersion,
      decisionText: "Se adopta el procedimiento ficticio documentado.",
      scope: "Exclusivamente los casos ficticios de esta prueba",
      validationComment: "La aportación ficticia cubre el alcance.",
      responseRevisionIds: decision.submissions.map(
        (submission) => submission.id,
      ),
    });
    for (const [index, status] of [
      [0, "CONFLICT"],
      [1, "CLARIFICATION_REQUIRED"],
      [2, "ANSWERED"],
      [3, "VALIDATED"],
    ] as const)
      expect((await command<ReviewDetail>(page, path(index))).status).toBe(
        status,
      );
  });
  return fixture;
}
