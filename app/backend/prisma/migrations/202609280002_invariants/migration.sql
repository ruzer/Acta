-- Additional PostgreSQL invariants; intentionally kept separate from Prisma-generated DDL.
ALTER TABLE "ProjectMember" ADD CONSTRAINT stakeholder_area_required CHECK (NOT active OR role <> 'STAKEHOLDER' OR "areaId" IS NOT NULL);
ALTER TABLE "Question" ADD CONSTRAINT question_order_nonnegative CHECK ("order" >= 0);
ALTER TABLE "QuestionRevision" ADD CONSTRAINT question_revision_positive CHECK (number > 0);
ALTER TABLE "ResponseRevision" ADD CONSTRAINT response_revision_positive CHECK (number > 0);
ALTER TABLE "Evidence" ADD CONSTRAINT evidence_size_positive CHECK ("byteSize" > 0);
ALTER TABLE "Question" ADD CONSTRAINT question_current_revision_fk FOREIGN KEY (id, "currentRevisionNumber") REFERENCES "QuestionRevision"("questionId", number) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Question" ADD CONSTRAINT question_published_revision_fk FOREIGN KEY (id, "publishedRevisionNumber") REFERENCES "QuestionRevision"("questionId", number) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX validation_one_current ON "Validation"("questionId") WHERE "invalidatedAt" IS NULL;
CREATE UNIQUE INDEX disposition_one_current ON "QuestionDisposition"("questionId") WHERE "revokedAt" IS NULL;

CREATE FUNCTION deny_historical_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records cannot be updated or deleted' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_question_revision BEFORE UPDATE OR DELETE ON "QuestionRevision" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();
CREATE TRIGGER immutable_question_option BEFORE UPDATE OR DELETE ON "QuestionOption" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();
CREATE TRIGGER immutable_submitted_revision BEFORE UPDATE OR DELETE ON "ResponseRevision" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();
CREATE TRIGGER immutable_message BEFORE UPDATE OR DELETE ON "ClarificationMessage" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();

CREATE FUNCTION enforce_organization_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; own_org uuid; target_org uuid; row_data jsonb;
BEGIN
 row_data := to_jsonb(NEW);
 own_org := (row_data->>'organizationId')::uuid;
 IF own_org IS NULL THEN SELECT "organizationId" INTO own_org FROM "Project" WHERE id=(row_data->>'projectId')::uuid; END IF;
 target := (row_data->>TG_ARGV[0])::uuid;
 IF target IS NULL THEN RETURN NEW; END IF;
 EXECUTE format('SELECT "organizationId" FROM %I WHERE id=$1',TG_ARGV[1]) INTO target_org USING target;
 IF own_org IS NULL OR target_org IS NULL OR own_org <> target_org THEN RAISE EXCEPTION 'Cross-organization relation rejected' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER member_user_scope BEFORE INSERT OR UPDATE ON "ProjectMember" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('userId','User');
CREATE TRIGGER member_area_scope BEFORE INSERT OR UPDATE ON "ProjectMember" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('areaId','Area');
CREATE TRIGGER question_area_scope BEFORE INSERT OR UPDATE ON "Question" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('responsibleAreaId','Area');
CREATE TRIGGER question_author_scope BEFORE INSERT OR UPDATE ON "QuestionRevision" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('createdById','User');
CREATE TRIGGER response_author_scope BEFORE INSERT OR UPDATE ON "Response" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('respondentId','User');
CREATE TRIGGER draft_area_scope BEFORE INSERT OR UPDATE ON "ResponseDraft" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('areaId','Area');
CREATE TRIGGER revision_area_scope BEFORE INSERT OR UPDATE ON "ResponseRevision" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('areaId','Area');
CREATE TRIGGER audit_actor_scope BEFORE INSERT OR UPDATE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('actorId','User');
CREATE TRIGGER audit_project_scope BEFORE INSERT OR UPDATE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('projectId','Project');

CREATE FUNCTION protect_question() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_section uuid; cycles integer;
BEGIN
 IF TG_OP='UPDATE' AND OLD.publication <> 'DRAFT' THEN
  IF NEW."externalId" IS DISTINCT FROM OLD."externalId" OR NEW."sectionId" IS DISTINCT FROM OLD."sectionId" OR NEW."groupParentId" IS DISTINCT FROM OLD."groupParentId" OR NEW."supersedesQuestionId" IS DISTINCT FROM OLD."supersedesQuestionId" OR NEW."currentRevisionNumber" IS DISTINCT FROM OLD."currentRevisionNumber" OR NEW."publishedRevisionNumber" IS DISTINCT FROM OLD."publishedRevisionNumber" OR NEW.publication='DRAFT' THEN
   RAISE EXCEPTION 'Published question meaning is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.publication='PUBLISHED' AND NEW."publishedRevisionNumber" IS NULL THEN RAISE EXCEPTION 'Published revision required' USING ERRCODE='23514'; END IF;
 IF NEW."groupParentId" IS NOT NULL THEN
  SELECT "sectionId" INTO parent_section FROM "Question" WHERE id=NEW."groupParentId" AND "projectId"=NEW."projectId";
  IF parent_section IS DISTINCT FROM NEW."sectionId" THEN RAISE EXCEPTION 'Grouping must stay in the same section' USING ERRCODE='23514'; END IF;
  WITH RECURSIVE chain(id,parent) AS (
   SELECT id,"groupParentId" FROM "Question" WHERE id=NEW."groupParentId"
   UNION SELECT q.id,q."groupParentId" FROM "Question" q JOIN chain c ON q.id=c.parent
  ) SELECT count(*) INTO cycles FROM chain WHERE id=NEW.id;
  IF NEW."groupParentId"=NEW.id OR cycles>0 THEN RAISE EXCEPTION 'Grouping cycle' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_question_meaning BEFORE INSERT OR UPDATE ON "Question" FOR EACH ROW EXECUTE FUNCTION protect_question();

CREATE FUNCTION require_draft_question() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data jsonb; qid uuid; state "QuestionPublication";
BEGIN
 IF TG_OP='DELETE' THEN data:=to_jsonb(OLD); ELSE data:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='QuestionOption' THEN SELECT "questionId" INTO qid FROM "QuestionRevision" WHERE id=(data->>'questionRevisionId')::uuid;
 ELSE qid:=(data->>TG_ARGV[0])::uuid; END IF;
 SELECT publication INTO state FROM "Question" WHERE id=qid;
 IF state IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Question content is frozen after publication' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER revision_requires_draft BEFORE INSERT ON "QuestionRevision" FOR EACH ROW EXECUTE FUNCTION require_draft_question('questionId');
CREATE TRIGGER option_requires_draft BEFORE INSERT ON "QuestionOption" FOR EACH ROW EXECUTE FUNCTION require_draft_question('questionId');
CREATE TRIGGER condition_requires_draft BEFORE INSERT OR UPDATE OR DELETE ON "QuestionCondition" FOR EACH ROW EXECUTE FUNCTION require_draft_question('childQuestionId');
CREATE TRIGGER traceability_requires_draft BEFORE INSERT OR UPDATE OR DELETE ON "QuestionTraceability" FOR EACH ROW EXECUTE FUNCTION require_draft_question('questionId');

CREATE FUNCTION reject_condition_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cycles integer;
BEGIN
 PERFORM id FROM "Project" WHERE id=NEW."projectId" FOR UPDATE;
 WITH RECURSIVE chain(parent) AS (
  SELECT NEW."parentQuestionId"
  UNION SELECT c."parentQuestionId" FROM "QuestionCondition" c JOIN chain x ON c."childQuestionId"=x.parent WHERE c.id<>NEW.id
 ) SELECT count(*) INTO cycles FROM chain WHERE parent=NEW."childQuestionId";
 IF cycles>0 THEN RAISE EXCEPTION 'Condition cycle' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER condition_acyclic BEFORE INSERT OR UPDATE ON "QuestionCondition" FOR EACH ROW EXECUTE FUNCTION reject_condition_cycle();

CREATE FUNCTION check_assignment_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid integer;
BEGIN
 IF NEW.active THEN
  SELECT count(*) INTO valid FROM "ProjectMember" m JOIN "User" u ON u.id=m."userId" JOIN "Area" a ON a.id=m."areaId"
  WHERE m.id=NEW."projectMemberId" AND m."projectId"=NEW."projectId" AND m.active AND u.active AND a.active AND m.role='STAKEHOLDER';
  IF valid<>1 THEN RAISE EXCEPTION 'Assignment needs an active stakeholder of the project' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignment_member BEFORE INSERT OR UPDATE ON "QuestionAssignment" FOR EACH ROW EXECUTE FUNCTION check_assignment_member();

-- The runtime login never owns tables and cannot perform DDL or erase audit/history.
GRANT USAGE ON SCHEMA public TO requirements_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO requirements_app;
REVOKE ALL ON "_prisma_migrations" FROM requirements_app;
REVOKE UPDATE,DELETE ON "AuditEvent","QuestionRevision","QuestionOption","ResponseRevision","ClarificationMessage" FROM requirements_app;
