import { z } from "zod";
const limits = z.object({
  IMPORT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(5242880)
    .default(5242880),
  IMPORT_MAX_DEPTH: z.coerce.number().int().positive().max(20).default(20),
  IMPORT_MAX_SECTIONS: z.coerce.number().int().positive().max(100).default(100),
  IMPORT_MAX_QUESTIONS: z.coerce
    .number()
    .int()
    .positive()
    .max(2000)
    .default(2000),
  IMPORT_MAX_LINKS: z.coerce
    .number()
    .int()
    .positive()
    .max(20000)
    .default(20000),
  IMPORT_MAX_REFERENCES: z.coerce
    .number()
    .int()
    .positive()
    .max(10000)
    .default(10000),
});
export function importLimits() {
  return limits.parse(process.env);
}
