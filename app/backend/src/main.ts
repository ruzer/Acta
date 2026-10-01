import "reflect-metadata";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { json } from "express";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./common/config.js";
import { Errors } from "./common/http.js";
export async function createApp() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
    bodyParser: false,
  });
  app.use(helmet());
  app.use(json({ limit: "256kb", strict: true }));
  app.use(cookieParser());
  app.use(
    (
      _: unknown,
      res: { setHeader: (key: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  await app.listen(config.PORT, "0.0.0.0");
  return app;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  void createApp().catch(() => {
    console.error(
      "No fue posible iniciar el backend. Verifica configuración y conexión.",
    );
    process.exitCode = 1;
  });
