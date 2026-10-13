-- Make services.name unique (concurrent webhooks could create duplicate services).
--
-- Existing duplicates are merged first: every row that references a duplicate
-- is re-pointed to the oldest service with that name, missing repo_url/language
-- are filled from the duplicates, and the duplicates are deleted.
-- Safe to re-run: with no duplicates left, the merge steps touch nothing.

DROP TABLE IF EXISTS service_dupes;

CREATE TEMP TABLE service_dupes AS
SELECT id, keep_id
FROM (
  SELECT id, FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY created_at, id) AS keep_id
  FROM services
) ranked
WHERE id <> keep_id;

-- Keep metadata the surviving service is missing
UPDATE services s
SET repo_url = COALESCE(s.repo_url, merged.repo_url),
    language = COALESCE(s.language, merged.language)
FROM (
  SELECT d.keep_id, MAX(dup.repo_url) AS repo_url, MAX(dup.language) AS language
  FROM service_dupes d
  JOIN services dup ON dup.id = d.id
  GROUP BY d.keep_id
) merged
WHERE s.id = merged.keep_id;

UPDATE deployments       t SET service_id = d.keep_id FROM service_dupes d WHERE t.service_id = d.id;
UPDATE vulnerabilities   t SET service_id = d.keep_id FROM service_dupes d WHERE t.service_id = d.id;
UPDATE secrets           t SET service_id = d.keep_id FROM service_dupes d WHERE t.service_id = d.id;
UPDATE risk_scores       t SET service_id = d.keep_id FROM service_dupes d WHERE t.service_id = d.id;
UPDATE policy_violations t SET service_id = d.keep_id FROM service_dupes d WHERE t.service_id = d.id;

DELETE FROM services s USING service_dupes d WHERE s.id = d.id;

DROP TABLE service_dupes;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "services_name_key" ON "services"("name");

-- CreateIndex: latest-score-per-service lookups (DISTINCT ON service_id ... ORDER BY calculated_at DESC)
CREATE INDEX IF NOT EXISTS "risk_scores_service_id_calculated_at_idx" ON "risk_scores"("service_id", "calculated_at");
