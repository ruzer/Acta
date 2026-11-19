import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { QuestionView, ProjectView } from "@requirements/contracts";
import { command } from "./workbench";

/** Proyecto ficticio separado: no cambia el cuestionario compartido de la demo. */
export async function draftProject(admin: Page) {
  const suffix = randomUUID();
  const project = await command<ProjectView>(admin, "/projects", {
    externalId: `CONSTANT-${suffix}`,
    name: "Seguimiento ficticio",
    description: "Prueba aislada de uso constante",
  });
  const area = await command<{ id: string }>(admin, "/areas", {
    code: `CONSTANT-${suffix}`,
    name: "Área ficticia",
  });
  const users = await command<{ id: string; username: string }[]>(
    admin,
    "/users",
  );
  for (const role of ["analyst", "stakeholder", "viewer"] as const) {
    const user = users.find((u) => u.username === role)!;
    await command(admin, `/projects/${project.id}/members`, {
      userId: user.id,
      role: role.toUpperCase(),
      areaId: role === "stakeholder" ? area.id : null,
      active: true,
    });
  }
  const members = await command<{ id: string; userId: string }[]>(
    admin,
    `/projects/${project.id}/members`,
  );
  const member = members.find(
    (m) => m.userId === users.find((u) => u.username === "stakeholder")!.id,
  )!;
  const section = await command<{ id: string }>(
    admin,
    `/projects/${project.id}/sections`,
    { externalId: "TEMA-1", title: "Trabajo cotidiano", order: 0 },
  );
  const questions: QuestionView[] = [];
  for (let i = 0; i < 2; i++) {
    let q = await command<QuestionView>(
      admin,
      `/projects/${project.id}/questions`,
      {
        externalId: `CONS-${i}`,
        sectionId: section.id,
        title: `Actividad ${i + 1}`,
        question: `Describe la actividad ficticia ${i + 1}.`,
        type: "LONG_TEXT",
        required: true,
        priority: "P2",
        responsibleAreaId: area.id,
        order: i,
      },
    );
    q = await command<QuestionView>(
      admin,
      `/projects/${project.id}/questions/${q.id}/assign`,
      {
        projectMemberId: member.id,
        active: true,
        required: true,
        expectedVersion: q.lockVersion,
      },
    );
    q = await command<QuestionView>(
      admin,
      `/projects/${project.id}/questions/${q.id}/publish`,
      { expectedVersion: q.lockVersion },
    );
    questions.push(q);
  }
  return { project, area, questions };
}
