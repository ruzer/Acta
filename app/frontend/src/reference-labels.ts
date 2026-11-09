import type { referenceTypes } from "@requirements/contracts";

export const referenceTypeLabels = {
  QUESTION: "Pregunta",
  BUSINESS_RULE: "Regla de negocio",
  REQUIREMENT: "Requerimiento",
  CAPABILITY: "Capacidad",
  WORKFLOW: "Flujo de trabajo",
  DOCUMENT: "Documento",
  CODE: "Código",
  OTHER: "Otra referencia",
} satisfies Record<(typeof referenceTypes)[number], string>;
