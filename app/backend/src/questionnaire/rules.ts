import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { QuestionInput } from "@requirements/contracts";
const key = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const item = z.strictObject({ key, label: z.string().min(1).max(200) });
const unique = (xs: (string | number)[]) => new Set(xs).size === xs.length;
export function validateQuestion(d: QuestionInput): void {
  if (
    !unique(d.options.map((x) => x.value)) ||
    !unique(d.options.map((x) => x.order))
  )
    throw new BadRequestException(
      "Los códigos y posiciones de opciones no pueden repetirse.",
    );
  if (!unique(d.references.map((x) => x.referenceId)))
    throw new BadRequestException("No repitas una referencia.");
  const choice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(d.type);
  if (choice && d.options.length < 2)
    throw new BadRequestException("Agrega al menos dos opciones.");
  if (!choice && d.options.length)
    throw new BadRequestException("Este tipo no admite opciones.");
  const cfg = d.config || {};
  switch (d.type) {
    case "MATRIX": {
      const c = z
        .strictObject({
          rows: z.array(item).min(1).max(20),
          columns: z.array(item).min(2).max(20),
        })
        .parse(cfg);
      if (
        !unique(c.rows.map((x) => x.key)) ||
        !unique(c.columns.map((x) => x.key))
      )
        throw new BadRequestException(
          "Las filas y columnas deben tener claves únicas.",
        );
      break;
    }
    case "SHORT_TEXT":
      z.strictObject({
        maxLength: z.number().int().min(1).max(500).optional(),
      }).parse(cfg);
      break;
    case "LONG_TEXT":
      z.strictObject({
        maxLength: z.number().int().min(1).max(10000).optional(),
      }).parse(cfg);
      break;
    case "MULTIPLE_CHOICE": {
      const c = z
        .strictObject({
          minSelections: z.number().int().nonnegative().optional(),
          maxSelections: z.number().int().positive().optional(),
        })
        .parse(cfg);
      if (
        (c.minSelections || 0) > (c.maxSelections || d.options.length) ||
        (c.maxSelections || 0) > d.options.length
      )
        throw new BadRequestException("Revisa los límites de selección.");
      break;
    }
    case "NUMBER": {
      const c = z
        .strictObject({
          min: z.number().optional(),
          max: z.number().optional(),
          integer: z.boolean().optional(),
        })
        .parse(cfg);
      if (c.min !== undefined && c.max !== undefined && c.min > c.max)
        throw new BadRequestException(
          "El mínimo no puede ser mayor que el máximo.",
        );
      break;
    }
    case "DATE": {
      const c = z
        .strictObject({
          min: z.iso.date().optional(),
          max: z.iso.date().optional(),
        })
        .parse(cfg);
      if (c.min && c.max && c.min > c.max)
        throw new BadRequestException("Revisa el rango de fechas.");
      break;
    }
    default:
      z.strictObject({}).parse(cfg);
  }
}
export function assertAcyclic(
  edges: ReadonlyArray<{ child: string; parent: string }>,
): void {
  const parents = new Map(edges.map((e) => [e.child, e.parent]));
  for (const start of parents.keys()) {
    const seen = new Set<string>();
    let node: string | undefined = start;
    while (node) {
      if (seen.has(node))
        throw new BadRequestException(
          "La relación crearía un ciclo de preguntas.",
        );
      seen.add(node);
      node = parents.get(node);
    }
  }
}
