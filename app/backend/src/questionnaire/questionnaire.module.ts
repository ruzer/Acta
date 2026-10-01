import { Module } from "@nestjs/common";
import { QuestionnaireService } from "./questionnaire.service.js";
import { QuestionnaireController } from "./questionnaire.controller.js";
@Module({
  providers: [QuestionnaireService],
  controllers: [QuestionnaireController],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
