// @vitest-environment node
import { ArgumentsHost, HttpException } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import { expect, it, vi } from "vitest";
import { Errors } from "../../app/backend/src/common/http";

const oversizedBody = () =>
  Object.assign(new Error("request entity too large"), {
    type: "entity.too.large",
    status: 413,
    statusCode: 413,
    expose: true,
  });

function respond(error: unknown) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: "payload-test" }),
      getResponse: () => response,
    }),
  } as ArgumentsHost;
  new Errors().catch(error, host);
  return response;
}

it.each(["raw", "NestJS adapter"])(
  "preserves the safe payload error contract for %s errors",
  (source) => {
    const error = oversizedBody();
    const response = respond(
      source === "raw" ? error : new ExpressAdapter().mapException(error),
    );
    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith({
      code: "PAYLOAD_TOO_LARGE",
      message: "La solicitud excede el tamaño permitido.",
      requestId: "payload-test",
    });
  },
);

it.each([
  new HttpException("Otro límite", 413),
  new HttpException("Otro límite", 413, { cause: new Error("Other cause") }),
  new HttpException("Acceso denegado", 403, { cause: oversizedBody() }),
])("preserves unrelated HTTP errors: %s", (error) => {
  const response = respond(error);
  expect(response.status).toHaveBeenCalledWith(error.getStatus());
  expect(response.json).toHaveBeenCalledWith({
    code: String(error.getStatus()),
    message: error.message,
    requestId: "payload-test",
  });
});
