-- Phase 2C only. Later review/import tables keep their revoked privileges.
GRANT INSERT, UPDATE ON "Response", "ResponseDraft", "Evidence" TO requirements_app;
GRANT DELETE ON "ResponseDraft", "DraftEvidence" TO requirements_app;
GRANT INSERT ON "ResponseRevision", "DraftEvidence", "RevisionEvidence" TO requirements_app;
CREATE INDEX "ResponseDraft_updatedAt_idx" ON "ResponseDraft"("updatedAt");
CREATE INDEX "Evidence_status_createdAt_idx" ON "Evidence"(status,"createdAt");
CREATE FUNCTION response_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_response uuid; q uuid;
BEGIN
  SELECT "questionId" INTO q FROM "Response" WHERE id=NEW."responseId";
  IF NOT EXISTS(SELECT 1 FROM "QuestionRevision" WHERE id=NEW."questionRevisionId" AND "questionId"=q) THEN RAISE EXCEPTION 'response question mismatch'; END IF;
  IF TG_TABLE_NAME='ResponseDraft' THEN
   IF NEW."basedOnRevisionId" IS NOT NULL THEN
    SELECT "responseId" INTO owner_response FROM "ResponseRevision" WHERE id=NEW."basedOnRevisionId";
    IF owner_response IS DISTINCT FROM NEW."responseId" THEN RAISE EXCEPTION 'draft source mismatch'; END IF;
   END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER response_draft_source BEFORE INSERT OR UPDATE ON "ResponseDraft" FOR EACH ROW EXECUTE FUNCTION response_source_guard();
CREATE TRIGGER response_revision_source BEFORE INSERT ON "ResponseRevision" FOR EACH ROW EXECUTE FUNCTION response_source_guard();
CREATE FUNCTION evidence_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_response uuid; source_response uuid; source_status "EvidenceStatus"; created_tx xid;
BEGIN
  SELECT "responseId",status INTO source_response,source_status FROM "Evidence" WHERE id=NEW."evidenceId";
  IF TG_TABLE_NAME='DraftEvidence' THEN
    SELECT "responseId" INTO target_response FROM "ResponseDraft" WHERE id=NEW."responseDraftId";
  ELSE
    SELECT "responseId",xmin INTO target_response,created_tx FROM "ResponseRevision" WHERE id=NEW."responseRevisionId";
    IF created_tx::text <> pg_current_xact_id()::text THEN RAISE EXCEPTION 'historical evidence is immutable'; END IF;
  END IF;
  IF target_response IS DISTINCT FROM source_response OR source_status <> 'READY' THEN RAISE EXCEPTION 'evidence source mismatch or unavailable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER draft_evidence_source BEFORE INSERT ON "DraftEvidence" FOR EACH ROW EXECUTE FUNCTION evidence_link_guard();
CREATE TRIGGER revision_evidence_source BEFORE INSERT ON "RevisionEvidence" FOR EACH ROW EXECUTE FUNCTION evidence_link_guard();
CREATE FUNCTION protect_evidence_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."projectId",NEW."responseId",NEW."uploadedById",NEW."originalName",NEW."detectedMimeType",NEW."byteSize",NEW.sha256,NEW.backend,NEW."storageKey",NEW."createdAt") IS DISTINCT FROM ROW(OLD."projectId",OLD."responseId",OLD."uploadedById",OLD."originalName",OLD."detectedMimeType",OLD."byteSize",OLD.sha256,OLD.backend,OLD."storageKey",OLD."createdAt") THEN RAISE EXCEPTION 'evidence identity is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evidence_identity BEFORE UPDATE ON "Evidence" FOR EACH ROW EXECUTE FUNCTION protect_evidence_identity();
CREATE FUNCTION deny_revision_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'revision evidence is immutable'; END $$;
CREATE TRIGGER revision_evidence_immutable BEFORE UPDATE OR DELETE ON "RevisionEvidence" FOR EACH ROW EXECUTE FUNCTION deny_revision_evidence_mutation();
