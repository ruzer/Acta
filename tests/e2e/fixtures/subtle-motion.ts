import { expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  ProjectView,
  QuestionView,
  ResponseView,
} from "@requirements/contracts";
import { asUser, command } from "./workbench";

export async function motionProject(browser: Browser) {
  const fixture = await asUser(browser, "admin", async (page) => {
    const project = await command<ProjectView>(page, "/projects", {
      externalId: `MOTION-${randomUUID()}`,
      name: "Movimiento ficticio",
      description: "",
    });
    const areas = await command<{ id: string }[]>(page, "/areas");
    const users = await command<{ id: string; username: string }[]>(
      page,
      "/users",
    );
    const userId = users.find((user) => user.username === "stakeholder")!.id;
    const member = await command<{ id: string }>(
      page,
      `/projects/${project.id}/members`,
      {
        userId,
        role: "STAKEHOLDER",
        areaId: areas[0]!.id,
        active: true,
      },
    );
    const section = await command<{ id: string }>(
      page,
      `/projects/${project.id}/sections`,
      {
        externalId: "MOV",
        title: "Proceso ficticio",
        description: "",
        order: 1,
      },
    );
    const questions: QuestionView[] = [];
    for (let i = 0; i < 4; i++) {
      let q = await command<QuestionView>(
        page,
        `/projects/${project.id}/questions`,
        {
          externalId: `MOV-${i}`,
          sectionId: section.id,
          title: `Paso ${i + 1}`,
          question: `¿Cómo realizas el paso ${i + 1}?`,
          type: "SHORT_TEXT",
          required: true,
          priority: "P1",
          responsibleAreaId: areas[0]!.id,
          order: i,
        },
      );
      q = await command<QuestionView>(
        page,
        `/projects/${project.id}/questions/${q.id}/assign`,
        {
          projectMemberId: member.id,
          active: true,
          required: true,
          expectedVersion: q.lockVersion,
        },
      );
      questions.push(
        await command<QuestionView>(
          page,
          `/projects/${project.id}/questions/${q.id}/publish`,
          {
            expectedVersion: q.lockVersion,
          },
        ),
      );
    }
    return { project, questions, userId };
  });
  await asUser(browser, "stakeholder", async (page) => {
    for (const i of [0, 1]) {
      const path = `/projects/${fixture.project.id}/questions/${fixture.questions[i]!.id}/response`;
      const response = await command<ResponseView>(page, path);
      const saved = await command<ResponseView>(
        page,
        path + "/draft",
        {
          answer: `Respuesta ficticia ${i}`,
          comment: "",
          example: "",
          consultationRequested: false,
          requestId: randomUUID(),
          expectedVersion: response.lockVersion,
        },
        "PUT",
      );
      if (i === 0)
        await command(page, path + "/submit", {
          requestId: randomUUID(),
          expectedVersion: saved.lockVersion,
        });
    }
  });
  return fixture;
}

export async function observeMotion(page: Page) {
  await page.addInitScript(() => {
    const seen = new WeakSet<Animation>();
    const measurements: {
      target: string;
      duration: number;
      delay: number;
      frames: ComputedKeyframe[];
    }[] = [];
    Object.assign(window, { motionMeasurements: measurements });
    const sample = () => {
      for (const animation of document.getAnimations()) {
        if (seen.has(animation)) continue;
        seen.add(animation);
        const effect = animation.effect as KeyframeEffect;
        const target = effect?.target;
        if (target instanceof Element)
          measurements.push({
            target:
              target.className instanceof Object
                ? target.tagName
                : target.className,
            duration: Number(effect.getTiming().duration),
            delay: effect.getTiming().delay,
            frames: effect.getKeyframes(),
          });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
export async function motion(page: Page, target: string) {
  return page.evaluate((target) => {
    const measurements = (
      window as unknown as {
        motionMeasurements: {
          target: string;
          duration: number;
          delay: number;
          frames: Record<string, unknown>[];
        }[];
      }
    ).motionMeasurements;
    return measurements.filter((item) => item.target.includes(target));
  }, target);
}
export async function settleMotion(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => undefined)),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}
export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
