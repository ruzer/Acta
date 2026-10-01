import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { questionInput, QuestionInput } from "@requirements/contracts";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./common/config.js";
import { Database } from "./database/database.module.js";
import { QuestionnaireService } from "./questionnaire/questionnaire.service.js";
import { hashPassword } from "./auth/auth.service.js";
import { CommandContext, audit } from "./common/http.js";
async function seed() {
  if (process.env.DEMO_SEED !== "true") return;
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const institutionCode = loadConfig().ORGANIZATION_CODE;
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 20 || password.includes("REPLACE"))
    throw new Error("Generate a private DEMO_PASSWORD before seeding");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const db = app.get(Database);
    const service = app.get(QuestionnaireService);
    if (
      (await db.organization.count()) > 0 &&
      !(await db.organization.findUnique({ where: { code: institutionCode } }))
    )
      throw new Error(
        "Configured organization does not match this installation; demo does not create a second tenant implicitly",
      );
    const org = await db.organization.upsert({
      where: { code: institutionCode },
      create: {
        code: institutionCode,
        name: process.env.ORGANIZATION_NAME || "Demonstration organization",
      },
      update: {},
    });
    const hash = await hashPassword(password);
    const users = [];
    for (const role of ["admin", "analyst", "stakeholder", "viewer"] as const) {
      users.push(
        await db.user.upsert({
          where: {
            organizationId_username: { organizationId: org.id, username: role },
          },
          create: {
            organizationId: org.id,
            username: role,
            displayName: {
              admin: "Administración demo",
              analyst: "Analista demo",
              stakeholder: "Participante demo",
              viewer: "Consulta demo",
            }[role],
            passwordHash: hash,
            mustChangePassword: true,
            isOrganizationAdmin: role === "admin",
          },
          update: {},
        }),
      );
    }
    const admin = users[0]!;
    const areas = [];
    for (const [code, name] of [
      ["SOLICITANTE", "Área solicitante"],
      ["REVISORA", "Área revisora"],
    ] as const)
      areas.push(
        await db.area.upsert({
          where: { organizationId_code: { organizationId: org.id, code } },
          create: { organizationId: org.id, code, name },
          update: {},
        }),
      );
    const project = await db.project.upsert({
      where: {
        organizationId_externalId: {
          organizationId: org.id,
          externalId: "DEMO-PRINCIPAL",
        },
      },
      create: {
        organizationId: org.id,
        externalId: "DEMO-PRINCIPAL",
        name: "Proyecto demostración",
        description:
          "Organización de solicitudes y atención de servicios internos. Todos los datos son ficticios.",
      },
      update: {},
    });
    const second = await db.project.upsert({
      where: {
        organizationId_externalId: {
          organizationId: org.id,
          externalId: "DEMO-SECUNDARIO",
        },
      },
      create: {
        organizationId: org.id,
        externalId: "DEMO-SECUNDARIO",
        name: "Proyecto de ejemplo adicional",
        description: "Permite comprobar membresías independientes.",
      },
      update: {},
    });
    const roles = ["ADMIN", "ANALYST", "STAKEHOLDER", "VIEWER"] as const;
    const members = [];
    for (const [i, u] of users.entries())
      members.push(
        await db.projectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: u.id } },
          create: {
            projectId: project.id,
            userId: u.id,
            role: roles[i]!,
            areaId: areas[i === 2 ? 0 : 1]!.id,
          },
          update: {},
        }),
      );
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: second.id, userId: admin.id } },
      create: { projectId: second.id, userId: admin.id, role: "ADMIN" },
      update: {},
    });
    const sections = [];
    for (const [i, title] of [
      "Solicitud de servicio",
      "Atención y seguimiento",
    ].entries())
      sections.push(
        await db.section.upsert({
          where: {
            projectId_externalId: {
              projectId: project.id,
              externalId: "SECCION-" + (i + 1),
            },
          },
          create: {
            projectId: project.id,
            externalId: "SECCION-" + (i + 1),
            title,
            order: i + 1,
          },
          update: {},
        }),
      );
    const reference = await db.traceabilityReference.upsert({
      where: {
        projectId_type_externalId: {
          projectId: project.id,
          type: "REQUIREMENT",
          externalId: "REQ-DEMO-001",
        },
      },
      create: {
        projectId: project.id,
        type: "REQUIREMENT",
        externalId: "REQ-DEMO-001",
        label: "Necesidad de autorización por confirmar",
        priority: "P0",
      },
      update: {},
    });
    const specs: Partial<QuestionInput>[] = [
      {
        title: "Recepción de solicitudes",
        question: "¿El área recibe solicitudes de servicio por escrito?",
        type: "YES_NO",
      },
      {
        title: "Autorización previa",
        question:
          "¿Cuándo se necesita una autorización para atender una solicitud?",
        type: "SINGLE_CHOICE",
        options: [
          { value: "SIEMPRE", label: "Siempre", order: 1 },
          { value: "DEPENDE", label: "Depende del servicio", order: 2 },
          { value: "NUNCA", label: "Nunca", order: 3 },
        ],
      },
      {
        title: "Casos que requieren autorización",
        question: "Describe en qué casos debe solicitarse autorización.",
        type: "LONG_TEXT",
        helpText:
          "Puedes mencionar criterios generales, sin nombres ni datos personales.",
      },
      {
        title: "Canales de atención",
        question: "¿Qué canales utiliza el área para atender las solicitudes?",
        type: "MULTIPLE_CHOICE",
        options: [
          { value: "CORREO", label: "Correo institucional", order: 1 },
          { value: "PRESENCIAL", label: "Atención presencial", order: 2 },
          { value: "SISTEMA", label: "Sistema interno", order: 3 },
        ],
      },
      {
        title: "Nombre del procedimiento",
        question: "¿Cómo se llama el procedimiento que utiliza el área?",
        type: "SHORT_TEXT",
      },
      {
        title: "Inicio del procedimiento",
        question: "¿Desde qué fecha se utiliza el procedimiento actual?",
        type: "DATE",
      },
      {
        title: "Plazo de atención",
        question:
          "¿Cuántos días se consideran para atender una solicitud habitual?",
        type: "NUMBER",
        config: { min: 0, max: 365, integer: true },
      },
      {
        title: "Responsabilidad por actividad",
        question: "Identifica qué área participa en cada actividad.",
        type: "MATRIX",
        config: {
          rows: [
            { key: "RECIBIR", label: "Recibir la solicitud" },
            { key: "REVISAR", label: "Revisar la información" },
          ],
          columns: [
            { key: "SOLICITANTE", label: "Área solicitante" },
            { key: "REVISORA", label: "Área revisora" },
          ],
        },
      },
      {
        title: "Pregunta en preparación",
        question: "¿Qué detalle adicional conviene preguntar al área?",
        type: "LONG_TEXT",
      },
    ];
    let mainId: string | undefined;
    for (const [i, spec] of specs.entries()) {
      const externalId = "FORM-DEMO-" + String(i + 1).padStart(2, "0");
      const old = await db.question.findUnique({
        where: { projectId_externalId: { projectId: project.id, externalId } },
      });
      if (old) {
        if (i === 1) mainId = old.id;
        continue;
      }
      const d = questionInput.parse({
        externalId,
        sectionId: sections[i < 3 ? 0 : 1]!.id,
        title: "",
        question: "",
        type: "SHORT_TEXT",
        required: true,
        priority: i < 3 ? "P0" : "P1",
        responsibleAreaId: areas[0]!.id,
        order: i + 1,
        options: [],
        references:
          i === 1
            ? [
                {
                  referenceId: reference.id,
                  scopeNote: "Criterio general, pendiente de respuesta",
                },
              ]
            : [],
        ...spec,
        ...(i === 2
          ? {
              groupParentId: mainId,
              condition: {
                parentQuestionId: mainId,
                operator: "EQUALS",
                value: "DEPENDE",
              },
            }
          : {}),
      });
      const req = { actor: admin, requestId: randomUUID() } as CommandContext;
      let q = await service.create(req, project.id, d);
      if (i === 1) mainId = q.id;
      q = await service.assign(
        { ...req, requestId: randomUUID() },
        project.id,
        q.id,
        {
          projectMemberId: members[2]!.id,
          active: true,
          required: true,
          expectedVersion: q.lockVersion,
        },
      );
      if (i !== 8)
        await service.publish(
          { ...req, requestId: randomUUID() },
          project.id,
          q.id,
          q.lockVersion,
        );
    }
    await db.$transaction((tx) =>
      audit(
        tx,
        admin,
        "DEMO_SEED_COMPLETED",
        "Project",
        project.id,
        project.id,
        null,
        { synthetic: true },
      ),
    );
    console.log(
      "Demo ficticia lista. Contexto institucional configurado por servidor; cuentas admin, analyst, stakeholder y viewer. Contraseña temporal externa: DEMO_PASSWORD.",
    );
  } finally {
    await app.close();
  }
}
void seed().catch(() => {
  console.error(
    "No fue posible preparar la demo. Revisa configuración y migraciones.",
  );
  process.exitCode = 1;
});
