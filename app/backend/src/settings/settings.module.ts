import { Module } from "@nestjs/common";
import {
  PublicConfigurationController,
  SettingsController,
} from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

@Module({
  providers: [SettingsService],
  controllers: [SettingsController, PublicConfigurationController],
  exports: [SettingsService],
})
export class SettingsModule {}
