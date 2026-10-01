import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { login } from "./login-helper";
let projectId: string, ids: string[];
const suffix = randomUUID().slice(0, 8);
const questions = [
  "¿Recibes solicitudes por escrito?",
  "¿Cómo se reciben las solicitudes?",
  "¿Quién realiza cada actividad?",
  "¿Qué contexto necesita el equipo?",
  "¿Cuándo comienza el procedimiento?",
  "¿Cuántos días tarda el trámite?",
  "¿Qué canales se utilizan?",
  "¿Se requiere autorización previa?",
];
async function call(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const r = await fetch("/api/v1" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(`${path}: ${r.status} ${data.message}`);
      return data;
    },
    { path, method, body },
  );
}
async function work(page: Page) {
  await page.goto(`/projects/${projectId}/work`);
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
}
async function open(page: Page, index: number) {
  await page.goto(`/projects/${projectId}/respond/${ids[index]}`);
  await expect(
    page.getByRole("heading", { name: questions[index], exact: true }),
  ).toBeVisible();
}
async function send(page: Page) {
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
}
async function axe(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  await login(page, "admin");
  const result = await page.evaluate(
    async ({ suffix, questions }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      async function call(path: string, method = "GET", body?: unknown) {
        const r = await fetch("/api/v1" + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": me.csrfToken,
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(`${path}: ${r.status} ${d.message}`);
        return d;
      }
      const users = await call("/users"),
        areas = await call("/areas");
      const p = await call("/projects", "POST", {
        externalId: "PARTICIPANT-" + suffix,
        name: "Atención ciudadana · prueba " + suffix,
        description:
          "Cuestionario ficticio para verificar la experiencia del participante",
      });
      let member = "";
      for (const [username, role] of [
        ["stakeholder", "STAKEHOLDER"],
        ["analyst", "ANALYST"],
      ]) {
        const m = await call(`/projects/${p.id}/members`, "POST", {
          userId: users.find(
            (u: { username: string }) => u.username === username,
          ).id,
          role,
          areaId: role === "STAKEHOLDER" ? areas[0].id : null,
          active: true,
        });
        if (role === "STAKEHOLDER") member = m.id;
      }
      const topic = await call(`/projects/${p.id}/sections`, "POST", {
        externalId: "SOLICITUDES",
        title: "Solicitud de servicio",
        description: "",
        order: 1,
      });
      const types = [
          "YES_NO",
          "SHORT_TEXT",
          "MATRIX",
          "LONG_TEXT",
          "DATE",
          "NUMBER",
          "MULTIPLE_CHOICE",
          "SINGLE_CHOICE",
        ],
        ids = [];
      for (let i = 0; i < types.length; i++) {
        const config =
          types[i] === "MATRIX"
            ? {
                rows: [
                  { key: "R1", label: "Recibir" },
                  { key: "R2", label: "Revisar" },
                ],
                columns: [
                  { key: "C1", label: "Área uno" },
                  { key: "C2", label: "Área dos" },
                ],
              }
            : undefined;
        let q = await call(`/projects/${p.id}/questions`, "POST", {
          externalId: `UX-${i + 1}`,
          sectionId: topic.id,
          title: `P${i + 1}`,
          question: questions[i],
          type: types[i],
          required: true,
          priority: "P1",
          responsibleAreaId: areas[0].id,
          order: i,
          ...(config ? { config } : {}),
          ...(i >= 6
            ? {
                options: [
                  { value: "O0", label: "Presencial", order: 0 },
                  { value: "O1", label: "En línea", order: 1 },
                ],
              }
            : {}),
        });
        q = await call(`/projects/${p.id}/questions/${q.id}/assign`, "POST", {
          projectMemberId: member,
          active: true,
          required: true,
          expectedVersion: q.lockVersion,
        });
        q = await call(`/projects/${p.id}/questions/${q.id}/publish`, "POST", {
          expectedVersion: q.lockVersion,
        });
        ids.push(q.id);
      }
      return { projectId: p.id, ids };
    },
    { suffix, questions },
  );
  projectId = result.projectId;
  ids = result.ids;
  await mkdir("artifacts/participant-ux", { recursive: true });
  await writeFile(
    "artifacts/participant-ux/fixture.json",
    JSON.stringify({ projectId, ids, questions }),
  );
  await context.close();
});
test("guardar intacta, recuperar tras logout, prioridad borrador y consulta recuperable", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await open(page, 0);
  await axe(page);
  await page
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/work$`));
  const row = page
    .locator(".participant-work-row")
    .filter({ hasText: questions[0] });
  await expect(row).toContainText("Borrador");
  const view = await call(
    page,
    `/projects/${projectId}/questions/${ids[0]}/response`,
  );
  expect(view.draft.answer).toBe(null);
  expect(view.revisions).toHaveLength(0);
  await page.locator(".participant-account summary").click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await login(page, "stakeholder");
  await work(page);
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(ids[0] + "$"));
  await page.getByRole("button", { name: "Necesito consultar esto" }).click();
  await expect(page).toHaveURL(new RegExp(ids[1] + "$"));
  await open(page, 0);
  await send(page);
  await expect(page.getByRole("alert")).toContainText(
    "necesita una respuesta completa",
  );
  const consulting = await call(
    page,
    `/projects/${projectId}/questions/${ids[0]}/response`,
  );
  expect(consulting.draft.consultationRequested).toBe(true);
  await open(page, 1);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Procedimiento ficticio persistente");
  await page.getByRole("button", { name: "Guardar y salir" }).click();
  await expect(
    page.locator(".participant-work-row").filter({ hasText: questions[0] }),
  ).toContainText("Por consultar");
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(ids[1] + "$"));
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Procedimiento ficticio persistente",
  );
  await axe(page);
});
test("P1 → P2 → P3 sin saltos, evidencia real y MATRIX completa", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await open(page, 0);
  await page.getByRole("radio", { name: "Sí", exact: true }).check();
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[1] + "$"));
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Evidencia ficticia participante");
  await page.getByText("Adjuntar evidencia", { exact: true }).click();
  await page.getByLabel("Seleccionar evidencia").setInputFiles({
    name: "participante-ficticio.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Adjuntar al borrador" }).click();
  await expect(
    page.getByRole("button", { name: "Descargar participante-ficticio.pdf" }),
  ).toBeVisible();
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[2] + "$"));
  await page.getByLabel("Recibir", { exact: true }).selectOption("C1");
  await page.getByLabel("Revisar", { exact: true }).selectOption("C2");
  await axe(page);
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[3] + "$"));
  await work(page);
  const sent = page
    .locator(".participant-work-row")
    .filter({ hasText: questions[1] });
  await expect(sent).toContainText("Enviada");
  await sent.getByRole("link", { name: "Ver: P2" }).click();
  await expect(
    page.getByRole("button", {
      name: /Enviar respuesta|Preparar nueva|Editar|Corregir/,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Procedimiento ficticio persistente"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar participante-ficticio.pdf" }),
  ).toBeVisible();
  await axe(page);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar participante-ficticio.pdf" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "participante-ficticio.pdf",
  );
  await work(page);
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(ids[3] + "$"));
});
test("aclaración tiene prioridad; al contestar ya no queda pendiente del participante", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext(),
    analyst = await context.newPage();
  await login(analyst, "analyst");
  const detail = await call(
    analyst,
    `/projects/${projectId}/questions/${ids[1]}/review`,
  );
  await call(
    analyst,
    `/projects/${projectId}/questions/${ids[1]}/review/clarifications/request`,
    "POST",
    {
      expectedVersion: detail.lockVersion,
      requestId: randomUUID(),
      responseRevisionId: detail.submissions[0].id,
      body: "¿Puedes precisar qué guía utiliza el área?",
    },
  );
  await login(page, "stakeholder");
  await work(page);
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/clarifications/${ids[1]}$`));
  await expect(
    page.getByText("¿Puedes precisar qué guía utiliza el área?", {
      exact: true,
    }),
  ).toBeVisible();
  await axe(page);
  await page
    .getByLabel("Tu aclaración")
    .fill("Utilizamos la guía ficticia de solicitudes.");
  await page
    .getByRole("button", { name: "Enviar aclaración", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(ids[3] + "$"));
  await work(page);
  const answered = page
    .locator(".participant-work-row")
    .filter({ hasText: questions[1] });
  await expect(answered).toContainText("En revisión");
  await expect(answered).not.toContainText("Requiere tu aclaración");
  const updated = await call(
      analyst,
      `/projects/${projectId}/questions/${ids[1]}/review`,
    ),
    thread = updated.threads[0];
  await call(
    analyst,
    `/projects/${projectId}/questions/${ids[1]}/review/clarifications/close`,
    "POST",
    {
      expectedVersion: updated.lockVersion,
      requestId: randomUUID(),
      threadId: thread.id,
      expectedThreadVersion: thread.lockVersion,
      reason: "Aclaración suficiente para esta prueba",
    },
  );
  const current = await call(
    analyst,
    `/projects/${projectId}/questions/${ids[1]}/review`,
  );
  await call(
    analyst,
    `/projects/${projectId}/questions/${ids[1]}/review/validate`,
    "POST",
    {
      expectedVersion: current.lockVersion,
      requestId: randomUUID(),
      decisionText: "Se utiliza la guía ficticia de solicitudes",
      scope: "Prueba de participante",
      validationComment: "Aportación y aclaración revisadas",
      responseRevisionIds: [current.submissions[0].id],
      clarificationMessageIds: current.threads[0].messages.map(
        (m: { id: string }) => m.id,
      ),
    },
  );
  await work(page);
  await answered.getByRole("link", { name: "Ver: P2" }).click();
  await expect(
    page.locator(".participant-badge").filter({ hasText: "Validada" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await axe(page);
  await context.close();
});
test("ocho tipos preservados, consulta y recibo honesto al terminar el tramo documental", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await open(page, 3);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Contexto ficticio para revisión");
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[4] + "$"));
  await page.getByLabel("Tu respuesta: fecha").fill("2026-10-01");
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[5] + "$"));
  await page.getByLabel("Tu respuesta: número").fill("3");
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[6] + "$"));
  await page.getByRole("checkbox", { name: "Presencial", exact: true }).check();
  await send(page);
  await expect(page).toHaveURL(new RegExp(ids[7] + "$"));
  await page.getByRole("button", { name: "Necesito consultar esto" }).click();
  await expect(
    page.getByRole("heading", { name: "Listo por ahora", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 por consultar.", { exact: true }),
  ).toBeVisible();
  await axe(page);
  await page.getByRole("link", { name: "Continuar con pendientes" }).click();
  await expect(page).toHaveURL(new RegExp(ids[7] + "$"));
  await page.getByRole("radio", { name: "En línea", exact: true }).check();
  await send(page);
  await expect(
    page.getByRole("heading", { name: "Terminaste tus preguntas" }),
  ).toBeVisible();
  await axe(page);
});
test("390px, teclado, reduced motion, buscar y filtrar sin acciones de edición postenvío", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await work(page);
  await axe(page);
  await page.getByRole("button", { name: "Buscar y filtrar" }).click();
  await page.getByLabel("Buscar en Mi trabajo").fill("actividad");
  await expect(page.locator(".participant-work-row")).toHaveCount(1);
  await page.getByRole("link", { name: "Ver: P3" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Recibir: Área uno", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await axe(page);
  await page.screenshot({
    path: "artifacts/participant-ux/product-matrix-390.png",
    fullPage: true,
  });
});
