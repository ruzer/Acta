-- Archive/deactivate domain records. Only mutable draft links and technical attempts may be removed.
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM requirements_app;
GRANT DELETE ON "QuestionCondition", "QuestionTraceability", "LoginAttempt" TO requirements_app;
-- Future tables exist for design completeness but have no write capability during 2A/2B.
REVOKE INSERT,UPDATE,DELETE ON "Response","ResponseDraft","ResponseRevision","Evidence","DraftEvidence","RevisionEvidence","ClarificationThread","ClarificationMessage","Validation","ValidationSource","ValidationMessage","Conflict","ConflictParticipant","ConflictResolution","ConflictResolutionSource","ValidationResolution","QuestionDisposition","ImportBatch" FROM requirements_app;
