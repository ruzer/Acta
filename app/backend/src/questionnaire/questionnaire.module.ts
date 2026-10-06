import { BulkQuestionnaireService } from "./bulk-questionnaire.service.js";
import { BulkQuestionnaireController } from "./bulk-questionnaire.controller.js";
import { Module } from "@nestjs/common";
import { QuestionnaireService } from "./questionnaire.service.js";
import { QuestionnaireController } from "./questionnaire.controller.js";
@Module({
  providers: [QuestionnaireService, BulkQuestionnaireService],
  controllers: [QuestionnaireController, BulkQuestionnaireController],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
