import { Module } from "@nestjs/common";
import { ReviewModule } from "../review/review.module.js";
import { VisibilityService } from "../visibility/visibility.service.js";
import { ImportService } from "./import.service.js";
import { ExportService } from "./export.service.js";
import { ExchangeController } from "./exchange.controller.js";
@Module({
  imports: [ReviewModule],
  providers: [VisibilityService, ImportService, ExportService],
  controllers: [ExchangeController],
})
export class ExchangeModule {}
