import { UnauthorizedException } from "@nestjs/common";
import { User } from "@prisma/client";
import { Tx } from "./http.js";

// Request-local proof cannot arrive through JSON or be persisted in actor snapshots.
type Proof = { sessionId: string; invitationId: string };
const proofs = new WeakMap<User, Proof>();
export const unavailableInvitation = () =>
  new UnauthorizedException("Invitación no disponible.");
export function bindInvitationActor(actor: User, proof: Proof): User {
  proofs.set(actor, proof);
  return actor;
}
export async function invitationAccess(tx: Tx, actor: User, projectId: string) {
  const proof = proofs.get(actor);
  if (!actor.invitationOnly || !proof) throw unavailableInvitation();
  const now = new Date();
  const session = await tx.invitationSession.findFirst({
    where: {
      id: proof.sessionId,
      invitationId: proof.invitationId,
      revokedAt: null,
      expiresAt: { gt: now },
      invitation: {
        respondentId: actor.id,
        projectId,
        organizationId: actor.organizationId,
        scopeSealed: true,
        revokedAt: null,
        expiresAt: { gt: now },
        respondent: { active: true, invitationOnly: true },
      },
    },
    include: { invitation: { include: { questions: true } } },
  });
  if (!session) throw unavailableInvitation();
  return session.invitation;
}
