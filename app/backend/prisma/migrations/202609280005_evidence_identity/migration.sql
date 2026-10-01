CREATE FUNCTION protect_response_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."projectId",NEW."questionId",NEW."respondentId",NEW."createdAt") IS DISTINCT FROM ROW(OLD."projectId",OLD."questionId",OLD."respondentId",OLD."createdAt") THEN RAISE EXCEPTION 'response identity is immutable'; END IF;
 IF NEW."lockVersion" < OLD."lockVersion" THEN RAISE EXCEPTION 'response version cannot decrease'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER response_identity BEFORE UPDATE ON "Response" FOR EACH ROW EXECUTE FUNCTION protect_response_identity();
CREATE FUNCTION evidence_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Response" WHERE id=NEW."responseId" AND "respondentId"=NEW."uploadedById" AND "projectId"=NEW."projectId") THEN RAISE EXCEPTION 'evidence owner mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidence_owner BEFORE INSERT ON "Evidence" FOR EACH ROW EXECUTE FUNCTION evidence_owner_guard();
