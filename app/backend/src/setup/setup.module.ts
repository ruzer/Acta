import { Module } from "@nestjs/common";
import { SetupController } from "./setup.controller.js";
import { SetupService } from "./setup.service.js";

@Module({ providers: [SetupService], controllers: [SetupController] })
export class SetupModule {}
