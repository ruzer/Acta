GRANT INSERT ON "ImportBatch" TO requirements_app;
REVOKE UPDATE, DELETE ON "ImportBatch" FROM requirements_app;
CREATE FUNCTION protect_import_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Import batch is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Project" p JOIN "User" u ON u."organizationId"=p."organizationId" WHERE p.id=NEW."projectId" AND u.id=NEW."importedById") THEN RAISE EXCEPTION 'Import actor scope mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER import_batch_guard BEFORE INSERT OR UPDATE OR DELETE ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION protect_import_batch();
CREATE UNIQUE INDEX "ImportBatch_actor_request" ON "ImportBatch" ("importedById", "requestId");
