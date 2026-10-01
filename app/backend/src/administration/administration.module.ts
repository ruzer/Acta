import { Global, Module } from "@nestjs/common";
import { AccessService } from "./access.service.js";
import { AdministrationService } from "./administration.service.js";
import { AdministrationController } from "./administration.controller.js";
@Global()
@Module({
  providers: [AccessService, AdministrationService],
  controllers: [AdministrationController],
  exports: [AccessService, AdministrationService],
})
export class AdministrationModule {}
