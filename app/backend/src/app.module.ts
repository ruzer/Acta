import { InvitationsModule } from "./invitations/invitations.module.js";
import { ExchangeModule } from "./exchange/exchange.module.js";
import { ReviewModule } from "./review/review.module.js";
import {
  Controller,
  Inject,
  Get,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Database, DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { Public } from "./auth/auth.guard.js";
import { AdministrationModule } from "./administration/administration.module.js";
import { QuestionnaireModule } from "./questionnaire/questionnaire.module.js";
import { ResponsesModule } from "./responses/responses.module.js";
import { STORAGE, StorageProvider } from "./responses/storage.js";
@Controller("health")
class HealthController {
  constructor(
    private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}
  @Public() @Get() async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      await this.storage.health?.();
      return {
        status: "ok",
        database: "ok",
        storage: "ok",
        phase: "2A-2B-2C-2D-2E",
      };
    } catch {
      throw new ServiceUnavailableException(
        "Servicio temporalmente no disponible.",
      );
    }
  }
}
import { publicBranding } from "./common/config.js";
@Controller("configuration")
class PublicConfigurationController {
  @Public() @Get("public") get() {
    return publicBranding();
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AdministrationModule,
    QuestionnaireModule,
    ResponsesModule,
    ReviewModule,
    ExchangeModule,
    InvitationsModule,
  ],
  controllers: [HealthController, PublicConfigurationController],
})
export class AppModule {}
