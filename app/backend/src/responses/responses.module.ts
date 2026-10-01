import { Global, Module, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ResponsesService } from "./responses.service.js";
import { ResponsesController } from "./responses.controller.js";
import { createStorage, STORAGE } from "./storage.js";
import { evidenceLimits } from "./file-validation.js";
@Global()
@Module({
  providers: [
    ResponsesService,
    { provide: STORAGE, useFactory: createStorage },
  ],
  controllers: [ResponsesController],
  exports: [ResponsesService, STORAGE],
})
export class ResponsesModule implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  constructor(private readonly service: ResponsesService) {}
  async onModuleInit() {
    evidenceLimits();
    await this.service.reconcile();
    this.timer = setInterval(
      () => {
        void this.service
          .reconcile()
          .catch(() =>
            console.error(
              JSON.stringify({ kind: "EvidenceReconciliationFailed" }),
            ),
          );
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
