import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  areaInput,
  createUserInput,
  memberInput,
  projectInput,
  resetPasswordInput,
  userStateInput,
} from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { AdministrationService } from "./administration.service.js";
@Controller()
export class AdministrationController {
  constructor(private readonly service: AdministrationService) {}
  @Get("organization") organization(@Req() r: ActorRequest) {
    return this.service.organization(r.actor);
  }
  @Get("users") users(@Req() r: ActorRequest) {
    return this.service.users(r.actor);
  }
  @Post("users") createUser(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(createUserInput)) d: z.infer<typeof createUserInput>,
  ) {
    return this.service.createUser(r, d);
  }
  @Post("users/:id/set-active") setActive(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(userStateInput)) d: z.infer<typeof userStateInput>,
  ) {
    return this.service.setActive(r, id, d.active);
  }
  @Post("users/:id/reset-password") reset(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(resetPasswordInput))
    d: z.infer<typeof resetPasswordInput>,
  ) {
    return this.service.resetPassword(r, id, d.temporaryPassword);
  }
  @Get("areas") areas(@Req() r: ActorRequest) {
    return this.service.areas(r.actor);
  }
  @Post("areas") createArea(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(areaInput)) d: z.infer<typeof areaInput>,
  ) {
    return this.service.createArea(r, d);
  }
  @Get("projects") projects(@Req() r: ActorRequest) {
    return this.service.projects(r.actor);
  }
  @Post("projects") createProject(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(projectInput)) d: z.infer<typeof projectInput>,
  ) {
    return this.service.createProject(r, d);
  }
  @Get("projects/:projectId/members") members(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.service.members(r.actor, p);
  }
  @Post("projects/:projectId/members") setMember(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(memberInput)) d: z.infer<typeof memberInput>,
  ) {
    return this.service.setMember(r, p, d);
  }
}
