import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  assignmentInput,
  editQuestionInput,
  editSectionInput,
  reorderSectionsInput,
  reorderQuestionsInput,
  metadataInput,
  questionInput,
  referenceInput,
  sectionInput,
  versionCommand,
} from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { QuestionnaireService } from "./questionnaire.service.js";
@Controller("projects/:projectId")
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}
  @Get("questionnaire") editor(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.service.editor(r.actor, p);
  }
  @Get("participant") participant(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.service.participant(r.actor, p);
  }
  @Post("sections") section(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(sectionInput)) d: z.infer<typeof sectionInput>,
  ) {
    return this.service.createSection(r, p, d);
  }
  @Put("sections/:id/draft") editSection(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(editSectionInput)) d: z.infer<typeof editSectionInput>,
  ) {
    return this.service.editSection(r, p, id, d);
  }
  @Post("sections/reorder") reorderSections(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(reorderSectionsInput))
    d: z.infer<typeof reorderSectionsInput>,
  ) {
    return this.service.reorderSections(r, p, d);
  }
  @Post("questions/reorder") reorderQuestions(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(reorderQuestionsInput))
    d: z.infer<typeof reorderQuestionsInput>,
  ) {
    return this.service.reorderQuestions(r, p, d);
  }
  @Post("references") reference(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(referenceInput)) d: z.infer<typeof referenceInput>,
  ) {
    return this.service.createReference(r, p, d);
  }
  @Post("questions") create(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(questionInput)) d: z.infer<typeof questionInput>,
  ) {
    return this.service.create(r, p, d);
  }
  @Put("questions/:id/draft") edit(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(editQuestionInput))
    d: z.infer<typeof editQuestionInput>,
  ) {
    return this.service.edit(r, p, id, d);
  }
  @Post("questions/:id/metadata") metadata(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(metadataInput)) d: z.infer<typeof metadataInput>,
  ) {
    return this.service.metadata(r, p, id, d);
  }
  @Post("questions/:id/assign") assign(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(assignmentInput)) d: z.infer<typeof assignmentInput>,
  ) {
    return this.service.assign(r, p, id, d);
  }
  @Post("questions/:id/publish") publish(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(versionCommand)) d: z.infer<typeof versionCommand>,
  ) {
    return this.service.publish(r, p, id, d.expectedVersion);
  }
  @Post("questions/:id/archive") archive(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(versionCommand)) d: z.infer<typeof versionCommand>,
  ) {
    return this.service.archive(r, p, id, d.expectedVersion);
  }
}
