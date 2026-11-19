-- Fecha informativa: no altera datos ni cierra respuestas.
ALTER TABLE "Project" ADD COLUMN "responseDueAt" TIMESTAMPTZ(3);
-- El rol de aplicación conserva SELECT/INSERT/UPDATE a nivel de tabla.
