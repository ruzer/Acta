import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { ActorRequest } from "../common/http.js";
import { loadConfig } from "../common/config.js";
import { AuthService, equal, hash } from "./auth.service.js";
export const BinaryUpload = () => SetMetadata("binaryUpload", true);
export const Public = () => SetMetadata("public", true);
export const PasswordAllowed = () => SetMetadata("passwordAllowed", true);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ActorRequest>();
    req.requestId = randomUUID();
    const safe = ["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (!safe && req.get("origin") !== loadConfig().APP_ORIGIN)
      throw new ForbiddenException(
        "El origen de la solicitud no está autorizado.",
      );
    if (
      !safe &&
      !(this.reflector.get<boolean>("binaryUpload", context.getHandler())
        ? req.is("application/octet-stream")
        : req.is("application/json"))
    )
      throw new ForbiddenException("Se requiere una solicitud JSON.");
    if (
      this.reflector.getAllAndOverride<boolean>("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.["fgeo_session"];
    const { session, csrfToken } = await this.auth.authenticate(
      typeof token === "string" ? token : "",
    );
    req.actor = session.user;
    req.sessionId = session.id;
    req.csrfToken = csrfToken;
    if (!safe) {
      const csrf = req.get("x-csrf-token") || "";
      if (!equal(hash(csrf), session.csrfSecretHash))
        throw new ForbiddenException(
          "La sesión de seguridad cambió. Actualiza la página.",
        );
    }
    if (
      req.actor.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>("passwordAllowed", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new ForbiddenException(
        "Cambia tu contraseña temporal para continuar.",
      );
    return true;
  }
}
