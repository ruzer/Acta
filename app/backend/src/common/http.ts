import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export interface ActorRequest extends Request {
  actor: User;
  sessionId: string;
  csrfToken: string;
  requestId: string;
}
export type CommandContext = Pick<ActorRequest, "actor" | "requestId">;
export class SchemaPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
export function serialize<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Output contract violation");
  return parsed.data;
}
@Catch()
@Injectable()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<ActorRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "No fue posible completar la operación.";
    let fieldErrors: Record<string, string> | undefined;
    if (error instanceof z.ZodError) {
      status = 400;
      code = "INVALID_INPUT";
      message = "Revisa los campos indicados.";
      fieldErrors = {};
      for (const issue of error.issues)
        fieldErrors[issue.path.join(".") || "form"] = issue.message;
    } else if (
      error instanceof SyntaxError &&
      "status" in error &&
      error.status === 400
    ) {
      status = 400;
      code = "INVALID_JSON";
      message = "La solicitud no contiene JSON válido.";
    } else if (
      error instanceof Error &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "La solicitud excede el tamaño permitido.";
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      code = String(status);
      message = error.message;
      const detail = error.getResponse();
      if (
        typeof detail === "object" &&
        detail !== null &&
        "fieldErrors" in detail
      )
        fieldErrors = detail.fieldErrors as Record<string, string>;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2002", "P2034"].includes(error.code)) {
        status = 409;
        code = "CONFLICT";
        message =
          "El registro ya existe o cambió. Actualiza la vista e inténtalo de nuevo.";
      } else if (["P2003", "P2014", "P2004"].includes(error.code)) {
        status = 409;
        code = "INVARIANT";
        message =
          "La operación no respeta las relaciones o el estado del registro.";
      } else if (error.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "No se encontró el recurso solicitado.";
      }
    }
    // Never log input, SQL, credentials, cookie headers or raw exception messages.
    const requestId = req.requestId || randomUUID();
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          kind: error instanceof Error ? error.name : "UnknownError",
          ...(error instanceof Prisma.PrismaClientKnownRequestError
            ? { databaseCode: error.code }
            : {}),
        }),
      );
    res.status(status).json({
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      requestId,
    });
  }
}
export type Tx = Prisma.TransactionClient;
export function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export async function audit(
  tx: Tx,
  actor: User,
  action: string,
  objectType: string,
  objectId: string,
  projectId: string | null,
  before: unknown,
  after: unknown,
  requestId: string = randomUUID(),
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizationId: actor.organizationId,
      projectId,
      actorId: actor.id,
      actorSnapshot: {
        displayName: actor.displayName,
        username: actor.username,
      },
      action,
      objectType,
      objectId,
      before: before === null ? Prisma.JsonNull : jsonValue(before),
      after: after === null ? Prisma.JsonNull : jsonValue(after),
      requestId,
    },
  });
}
