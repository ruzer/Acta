import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/*
 * The rules of the first-run setup, kept free of HTTP so the web wizard and the
 * operator command (scripts/setup-token.mjs) apply exactly the same ones.
 *
 * The setup code is the authorization: it is created on the server by someone
 * who can run commands on it, shown once to that person and stored only as a
 * SHA-256. Anyone who merely reaches the address of a new installation can read
 * its status but cannot create the administrator.
 */
type Client = PrismaClient | Prisma.TransactionClient;

/** Same lock as scripts/bootstrap-admin.mjs: only one administrator can ever be created. */
export const INSTALLATION_LOCK = 18002901;
export const SETUP_ROW = "installation";
/** How long a setup code works. Running the command again issues a new one. */
export const SETUP_CODE_MINUTES = 120;

export const hashSetupCode = (code: string) =>
  createHash("sha256").update(code.trim()).digest("hex");

export function setupCodeMatches(
  presented: string,
  stored: string | null | undefined,
) {
  if (!stored) return false;
  const a = Buffer.from(hashSetupCode(presented));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function lockInstallation(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INSTALLATION_LOCK})`;
}

/**
 * A completed installation never opens the wizard again: the recorded
 * completion, or any organization administrator (active or not), closes it. The
 * second condition protects installations created before the wizard existed.
 */
export async function setupIsClosed(tx: Client) {
  const row = await tx.installationSetup.findUnique({
    where: { id: SETUP_ROW },
    select: { state: true },
  });
  if (row?.state === "COMPLETED") return true;
  return (await tx.user.count({ where: { isOrganizationAdmin: true } })) > 0;
}

export type PendingSetup = {
  tokenHash: string | null;
  tokenExpiresAt: Date | null;
};

/** The presented code is the issued one and has not expired. */
export function codeIsValid(
  row: PendingSetup | null,
  presented: string,
  now = new Date(),
) {
  return (
    !!row &&
    !!row.tokenExpiresAt &&
    row.tokenExpiresAt > now &&
    setupCodeMatches(presented, row.tokenHash)
  );
}

/**
 * Create a new setup code, replacing any earlier one. The caller holds the
 * installation lock inside a transaction. Returns the plain code: it is not
 * stored anywhere and cannot be recovered.
 */
export async function issueSetupCode(
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  if (await setupIsClosed(tx))
    throw new Error("Setup is closed: an administrator already exists");
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SETUP_CODE_MINUTES * 60000);
  const data = {
    state: "PENDING" as const,
    tokenHash: hashSetupCode(code),
    tokenIssuedAt: now,
    tokenExpiresAt: expiresAt,
  };
  await tx.installationSetup.upsert({
    where: { id: SETUP_ROW },
    create: { id: SETUP_ROW, ...data },
    update: data,
  });
  return { code, expiresAt };
}
