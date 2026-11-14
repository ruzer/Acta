import { Global, Module } from "@nestjs/common";
import { AccessService } from "./access.service.js";
import { AdministrationService } from "./administration.service.js";
import { AdministrationController } from "./administration.controller.js";
import { BulkUsersService } from "./bulk-users.service.js";
@Global()
@Module({
  providers: [AccessService, AdministrationService, BulkUsersService],
  controllers: [AdministrationController],
  exports: [AccessService, AdministrationService],
})
export class AdministrationModule {}
