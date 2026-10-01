-- Approved initial-installation transition. Keep UUIDs and every scoped relationship.
-- Never merge two institutions or move their users/projects implicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE code = 'FGEO-DEMO') THEN
    IF EXISTS (SELECT 1 FROM "Organization" WHERE code = 'FGEO') THEN
      RAISE EXCEPTION 'Institution context conflict: reconcile installation configuration before migration';
    END IF;
    UPDATE "Organization"
      SET code = 'FGEO', name = 'Fiscalía General del Estado de Oaxaca', "updatedAt" = now()
      WHERE code = 'FGEO-DEMO';
  END IF;
END $$;
