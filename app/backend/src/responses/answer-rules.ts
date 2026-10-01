import { UnprocessableEntityException } from "@nestjs/common";
import { z } from "zod";
import { ResponseContent, ResponseQuestionView } from "@requirements/contracts";
export function validateAnswer(
  q: Pick<ResponseQuestionView, "type" | "required" | "config" | "options">,
  content: ResponseContent,
  submit: boolean,
) {
  const a = content.answer;
  const c = q.config || {};
  const fail = (message: string): never => {
    throw new UnprocessableEntityException({
      message,
      fieldErrors: { answer: message },
    });
  };
  const missing =
    a === null ||
    (typeof a === "string" && !a.trim()) ||
    (Array.isArray(a) && a.length === 0) ||
    (typeof a === "object" &&
      a !== null &&
      !Array.isArray(a) &&
      !Object.keys(a).length);
  if (a !== null) {
    switch (q.type) {
      case "YES_NO":
        if (typeof a !== "boolean") fail("Selecciona Sí o No.");
        break;
      case "SINGLE_CHOICE":
        if (typeof a !== "string" || !q.options.some((o) => o.value === a))
          fail("Selecciona una opción disponible.");
        break;
      case "MULTIPLE_CHOICE": {
        if (
          !Array.isArray(a) ||
          a.some((v) => !q.options.some((o) => o.value === v)) ||
          new Set(a).size !== a.length
        )
          fail("Selecciona opciones disponibles sin repetirlas.");
        const values = a as string[];
        if (
          values.length > Number(c.maxSelections ?? q.options.length) ||
          (submit && !missing && values.length < Number(c.minSelections ?? 0))
        )
          fail("Revisa el número de opciones seleccionadas.");
        break;
      }
      case "SHORT_TEXT":
      case "LONG_TEXT":
        if (
          typeof a !== "string" ||
          a.length >
            Number(c.maxLength ?? (q.type === "SHORT_TEXT" ? 500 : 10000))
        )
          fail("El texto excede la longitud permitida.");
        if (submit && q.required && !(a as string).trim())
          fail("Escribe una respuesta antes de enviar.");
        break;
      case "DATE":
        if (
          typeof a !== "string" ||
          !z.iso.date().safeParse(a).success ||
          (typeof c.min === "string" && a < c.min) ||
          (typeof c.max === "string" && a > c.max)
        )
          fail("Introduce una fecha válida dentro del rango permitido.");
        break;
      case "NUMBER":
        if (
          typeof a !== "number" ||
          !Number.isFinite(a) ||
          Math.abs(a) > Number.MAX_SAFE_INTEGER ||
          (c.integer === true && !Number.isInteger(a)) ||
          (typeof c.min === "number" && a < c.min) ||
          (typeof c.max === "number" && a > c.max) ||
          Math.abs(a * 1e6 - Math.round(a * 1e6)) > 1e-6
        )
          fail(
            "Introduce un número válido, con hasta seis decimales y dentro del rango permitido.",
          );
        break;
      case "MATRIX": {
        const cfg = c as {
          rows: { key: string }[];
          columns: { key: string }[];
        };
        if (typeof a !== "object" || Array.isArray(a))
          fail("Selecciona una opción por fila.");
        const values = a as Record<string, string>;
        if (
          Object.entries(values).some(
            ([k, v]) =>
              !cfg.rows.some((r) => r.key === k) ||
              !cfg.columns.some((col) => col.key === v),
          )
        )
          fail("La matriz contiene una fila u opción no disponible.");
        if (
          submit &&
          q.required &&
          cfg.rows.some((r) => !Object.hasOwn(values, r.key))
        )
          fail("Completa todas las filas antes de enviar.");
        break;
      }
    }
  }
  if (submit && missing && (q.required || !content.comment.trim()))
    fail(
      q.required
        ? "Esta pregunta necesita una respuesta completa."
        : "Explica en el comentario por qué envías la pregunta sin respuesta.",
    );
}
