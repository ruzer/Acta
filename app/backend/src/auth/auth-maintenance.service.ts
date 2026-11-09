import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "../database/database.module.js";

@Injectable()
export class AuthMaintenanceService {
  private running = false;
  constructor(private readonly db: Database) {}

  async cleanup(now = new Date()) {
    if (this.running) return;
    this.running = true;
    const attemptsBefore = new Date(now.getTime() - 7 * 86400000);
    const sessionsBefore = new Date(now.getTime() - 30 * 86400000);
    try {
      // Each bounded delete commits separately; SKIP LOCKED permits concurrent workers.
      for (const query of [
        Prisma.sql`WITH expired AS (
          SELECT id FROM "LoginAttempt" WHERE "occurredAt" < ${attemptsBefore}
          LIMIT 1000 FOR UPDATE SKIP LOCKED
        ) DELETE FROM "LoginAttempt" USING expired WHERE "LoginAttempt".id = expired.id`,
        Prisma.sql`WITH expired AS (
          SELECT id FROM "Session" WHERE "expiresAt" < ${sessionsBefore} OR "revokedAt" < ${sessionsBefore}
          LIMIT 1000 FOR UPDATE SKIP LOCKED
        ) DELETE FROM "Session" USING expired WHERE "Session".id = expired.id`,
        Prisma.sql`WITH expired AS (
          SELECT id FROM "InvitationSession" WHERE "expiresAt" < ${sessionsBefore} OR "revokedAt" < ${sessionsBefore}
          LIMIT 1000 FOR UPDATE SKIP LOCKED
        ) DELETE FROM "InvitationSession" USING expired WHERE "InvitationSession".id = expired.id`,
        Prisma.sql`WITH expired AS (
          SELECT key FROM "InvitationRateBucket" WHERE "expiresAt" < ${now}
          LIMIT 1000 FOR UPDATE SKIP LOCKED
        ) DELETE FROM "InvitationRateBucket" USING expired WHERE "InvitationRateBucket".key = expired.key`,
      ]) {
        while ((await this.db.$executeRaw(query)) === 1000) {
          // Return to the event loop between batches instead of holding one transaction.
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }
    } finally {
      this.running = false;
    }
  }
}
