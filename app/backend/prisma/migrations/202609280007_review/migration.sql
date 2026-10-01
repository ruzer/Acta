-- Phase 2D. ImportBatch remains read-only; no 2E capabilities are enabled.
GRANT INSERT ON "ClarificationThread", "ClarificationMessage", "Validation", "ValidationSource", "ValidationMessage", "ValidationResolution", "Conflict", "ConflictParticipant", "ConflictResolution", "ConflictResolutionSource", "QuestionDisposition" TO requirements_app;
GRANT UPDATE (status,"lockVersion","closedAt","closedById","closeReason") ON "ClarificationThread" TO requirements_app;
GRANT UPDATE (status,"lockVersion") ON "Conflict" TO requirements_app;
GRANT UPDATE ("invalidatedAt","invalidatedById","invalidationReason") ON "Validation" TO requirements_app;
GRANT UPDATE ("revokedAt","revokedById","revokeReason") ON "QuestionDisposition" TO requirements_app;
CREATE FUNCTION protect_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed text[];
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'Validation' THEN
   allowed:=ARRAY['invalidatedAt','invalidatedById','invalidationReason'];
   IF OLD."invalidatedAt" IS NOT NULL THEN RAISE EXCEPTION 'Invalidation is final'; END IF;
 WHEN 'QuestionDisposition' THEN
   allowed:=ARRAY['revokedAt','revokedById','revokeReason'];
   IF OLD."revokedAt" IS NOT NULL THEN RAISE EXCEPTION 'Revocation is final'; END IF;
 WHEN 'ClarificationThread' THEN
   allowed:=ARRAY['status','lockVersion','closedAt','closedById','closeReason'];
   IF OLD.status='CLOSED' THEN RAISE EXCEPTION 'Closed thread is immutable'; END IF;
 WHEN 'Conflict' THEN
   allowed:=ARRAY['status','lockVersion'];
   IF OLD.status='RESOLVED' THEN RAISE EXCEPTION 'Resolved conflict is immutable'; END IF;
   IF NEW.status<>'RESOLVED' OR NEW."lockVersion"<>OLD."lockVersion"+1 THEN RAISE EXCEPTION 'Conflict update must resolve once'; END IF;
 END CASE;
 IF to_jsonb(NEW)-allowed IS DISTINCT FROM to_jsonb(OLD)-allowed THEN RAISE EXCEPTION 'Review history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validation_history BEFORE UPDATE ON "Validation" FOR EACH ROW EXECUTE FUNCTION protect_review_history();
CREATE TRIGGER disposition_history BEFORE UPDATE ON "QuestionDisposition" FOR EACH ROW EXECUTE FUNCTION protect_review_history();
CREATE TRIGGER thread_history BEFORE UPDATE ON "ClarificationThread" FOR EACH ROW EXECUTE FUNCTION protect_review_history();
CREATE TRIGGER conflict_history BEFORE UPDATE ON "Conflict" FOR EACH ROW EXECUTE FUNCTION protect_review_history();
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['Validation','QuestionDisposition','ClarificationThread','Conflict'] LOOP
 EXECUTE format('CREATE TRIGGER no_review_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_historical_change()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['ValidationSource','ValidationMessage','ValidationResolution','ConflictParticipant','ConflictResolution','ConflictResolutionSource'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_review_source BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_historical_change()',tab);
 END LOOP;
END $$;
ALTER TABLE "Validation" ADD CONSTRAINT validation_invalidation_complete CHECK (("invalidatedAt" IS NULL AND "invalidatedById" IS NULL AND "invalidationReason" IS NULL) OR ("invalidatedAt" IS NOT NULL AND "invalidatedById" IS NOT NULL AND "invalidationReason" IS NOT NULL AND length(trim("invalidationReason"))>0));
ALTER TABLE "QuestionDisposition" ADD CONSTRAINT disposition_revocation_complete CHECK (("revokedAt" IS NULL AND "revokedById" IS NULL AND "revokeReason" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND "revokeReason" IS NOT NULL AND length(trim("revokeReason"))>0));
ALTER TABLE "ClarificationThread" ADD CONSTRAINT thread_closure_complete CHECK ((status='CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closeReason" IS NOT NULL AND length(trim("closeReason"))>0) OR (status<>'CLOSED' AND "closedAt" IS NULL AND "closedById" IS NULL AND "closeReason" IS NULL));
CREATE FUNCTION review_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_q uuid; source_q uuid; created_tx xid; row_data jsonb; parent_table text; parent_key text;
BEGIN
 row_data:=to_jsonb(NEW);
 CASE TG_TABLE_NAME
 WHEN 'ValidationSource','ValidationMessage','ValidationResolution' THEN parent_table:='Validation';parent_key:='validationId';
 WHEN 'ConflictParticipant' THEN parent_table:='Conflict';parent_key:='conflictId';
 WHEN 'ConflictResolutionSource' THEN parent_table:='ConflictResolution';parent_key:='resolutionId';
 END CASE;
 IF parent_table='ConflictResolution' THEN
 SELECT c."questionId",r.xmin INTO parent_q,created_tx FROM "ConflictResolution" r JOIN "Conflict" c ON c.id=r."conflictId" WHERE r.id=(row_data->>parent_key)::uuid;
 ELSIF parent_table='Validation' THEN SELECT "questionId",xmin INTO parent_q,created_tx FROM "Validation" WHERE id=(row_data->>parent_key)::uuid AND "invalidatedAt" IS NULL;
 ELSE SELECT "questionId",xmin INTO parent_q,created_tx FROM "Conflict" WHERE id=(row_data->>parent_key)::uuid AND status='OPEN';
 END IF;
 IF created_tx IS NULL OR created_tx::text<>pg_current_xact_id()::text THEN RAISE EXCEPTION 'Cannot add a source to historical review'; END IF;
 IF row_data ? 'responseRevisionId' THEN
 SELECT r."questionId" INTO source_q FROM "ResponseRevision" v JOIN "Response" r ON r.id=v."responseId" WHERE v.id=(row_data->>'responseRevisionId')::uuid AND v.status='SUBMITTED';
 ELSIF TG_TABLE_NAME='ValidationMessage' THEN
 SELECT r."questionId" INTO source_q FROM "ClarificationMessage" m JOIN "ClarificationThread" t ON t.id=m."threadId" JOIN "ResponseRevision" v ON v.id=t."responseRevisionId" JOIN "Response" r ON r.id=v."responseId" WHERE m.id=NEW."clarificationMessageId" AND t.status='CLOSED';
 ELSE
 SELECT c."questionId" INTO source_q FROM "ConflictResolution" r JOIN "Conflict" c ON c.id=r."conflictId" WHERE r.id=NEW."conflictResolutionId" AND c.status='RESOLVED';
 END IF;
 IF source_q IS NULL OR source_q IS DISTINCT FROM parent_q THEN RAISE EXCEPTION 'Review source must belong to the same question'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['ValidationSource','ValidationMessage','ValidationResolution','ConflictParticipant','ConflictResolutionSource'] LOOP
 EXECUTE format('CREATE TRIGGER review_source_scope BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION review_source_guard()',tab);
 END LOOP;
END $$;
CREATE FUNCTION closed_thread_message_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "ClarificationThread" WHERE id=NEW."threadId" AND status='CLOSED') THEN RAISE EXCEPTION 'Closed thread cannot receive messages'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER closed_thread_message BEFORE INSERT ON "ClarificationMessage" FOR EACH ROW EXECUTE FUNCTION closed_thread_message_guard();
CREATE TRIGGER thread_requester_scope BEFORE INSERT ON "ClarificationThread" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('requestedById','User');
CREATE TRIGGER thread_closer_scope BEFORE UPDATE ON "ClarificationThread" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('closedById','User');
CREATE TRIGGER message_author_scope BEFORE INSERT ON "ClarificationMessage" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('authorId','User');
CREATE TRIGGER validation_author_scope BEFORE INSERT ON "Validation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('validatedById','User');
CREATE TRIGGER validation_invalidator_scope BEFORE UPDATE ON "Validation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('invalidatedById','User');
CREATE TRIGGER conflict_author_scope BEFORE INSERT ON "Conflict" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('openedById','User');
CREATE TRIGGER resolution_author_scope BEFORE INSERT ON "ConflictResolution" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('resolvedById','User');
CREATE TRIGGER disposition_author_scope BEFORE INSERT ON "QuestionDisposition" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('markedById','User');
CREATE TRIGGER disposition_revoker_scope BEFORE UPDATE ON "QuestionDisposition" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('revokedById','User');
CREATE INDEX "ClarificationThread_status_idx" ON "ClarificationThread"("projectId",status);
CREATE INDEX "Question_review_idx" ON "Question"("projectId",publication,status);
