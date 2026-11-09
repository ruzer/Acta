-- Hourly retention removes only expired/revoked authentication sessions.
-- AuditEvent and domain-record privileges remain unchanged.
GRANT DELETE ON "Session", "InvitationSession" TO requirements_app;
